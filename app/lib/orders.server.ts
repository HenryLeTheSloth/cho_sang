import { randomInt } from "node:crypto";
import { type OrderStatus, type PaymentMethod, type PaymentStatus, Prisma } from "~/generated/prisma/client";
import { cartTotals } from "./cart";
import { visible } from "./catalog.server";
import { CART_MAX_QTY } from "./config";
import { db } from "./db.server";
import { vnDate, vnDateTimeLabel } from "./delivery";
import { type AppSession, canViewOrder } from "./session.server";

/** Một dòng đặt hàng. M4: món trong giỏ quà và vỏ giỏ là các dòng có `bundleId`, cùng sản phẩm có thể lặp lại. */
export type OrderLineInput = { productId: number; qty: number; bundleId?: string | null };

export type PlaceOrderInput = {
  checkoutKey: string; // uuid do loader /checkout cấp; bấm "Đặt hàng" 2 lần gửi cùng khoá → chỉ 1 đơn
  userId: number | null;
  customerName: string;
  phone: string;
  address: string;
  note: string;
  callOnSubstitute: boolean;
  deliveryDate: string; // "YYYY-MM-DD" giờ VN
  deliverySlot: string;
  paymentMethod: PaymentMethod;
  lines: OrderLineInput[];
  expectedTotalVnd: number; // tổng khách đã thấy trên nút "Đặt hàng · …"; khác đi là không đặt
};

export type OutOfStock = { productId: number; name: string; unit: string; available: number };
export type PlaceOrderResult =
  | { ok: true; code: string }
  | { ok: false; reason: "out-of-stock"; outOfStock: OutOfStock[] }
  | { ok: false; reason: "changed" }; // giá hoặc giỏ đổi sau khi khách xem tổng tiền

class OutOfStockError extends Error {
  constructor(readonly items: OutOfStock[]) {
    super("Hết hàng");
  }
}
class TotalChangedError extends Error {}

const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // bỏ I, O, 0, 1 cho khỏi đọc nhầm qua điện thoại

/** "DH" + ngày VN (yymmdd) + 4 ký tự ngẫu nhiên, vd. "DH261015K7QX" (spec mục 5). */
export function newOrderCode(now: Date): string {
  const random = Array.from({ length: 4 }, () => CODE_CHARS[randomInt(CODE_CHARS.length)]).join("");
  return `DH${vnDate(now).slice(2).replaceAll("-", "")}${random}`;
}

/**
 * Gộp số lượng theo sản phẩm (dòng thường + món trong giỏ quà + vỏ giỏ), sắp theo id tăng dần:
 * hai đơn đồng thời luôn khoá các dòng Product theo cùng một thứ tự, nên không thể deadlock.
 */
export function aggregateQty(lines: { productId: number; qty: number }[]): Map<number, number> {
  const total = new Map<number, number>();
  for (const l of lines) total.set(l.productId, (total.get(l.productId) ?? 0) + l.qty);
  return new Map([...total].sort(([a], [b]) => a - b));
}

/**
 * Đặt hàng trong MỘT transaction (spec mục 5): chụp tên/đơn vị/giá → tạo đơn (giữ `checkoutKey`) → trừ kho
 * từng sản phẩm bằng `UPDATE … SET stock = stock - q WHERE id = ? AND stock >= q` → tạo dòng đơn.
 * Một sản phẩm không đủ kho thì huỷ cả đơn và báo đúng món đó. Tổng tiền khác `expectedTotalVnd` (giá đổi,
 * món vừa hết bị bỏ khỏi giỏ) thì không đặt: khách chỉ bị tính đúng số tiền đã thấy trên nút.
 * Hai request cùng `checkoutKey` (bấm 2 lần): request sau chờ ở unique index tới khi request đầu commit,
 * rồi nhận lại đúng mã đơn đó. Tra khoá chạy TRƯỚC mọi kiểm tra khác, nên gửi lại form khi giỏ đã xoá vẫn về đơn cũ.
 */
export async function placeOrder(input: PlaceOrderInput, now = new Date()): Promise<PlaceOrderResult> {
  const existing = await orderForKey(input.checkoutKey);
  if (existing) return { ok: true, code: existing.code };
  if (input.lines.length === 0) return { ok: false, reason: "changed" };

  for (let attempt = 1; ; attempt++) {
    try {
      return { ok: true, code: await db.$transaction((tx) => insertOrder(tx, input, now)) };
    } catch (error) {
      if (error instanceof OutOfStockError) return { ok: false, reason: "out-of-stock", outOfStock: error.items };
      if (error instanceof TotalChangedError) return { ok: false, reason: "changed" };
      // P2003 trên khoá ngoại OrderItem.bundleId: giỏ quà trong cookie bị xoá khỏi DB giữa lúc xem và lúc đặt (cổng M3 N4).
      // Khoá ngoại khác (vd. userId) vẫn là lỗi thật, để nó ra 500 thay vì báo "giỏ đã thay đổi" sai
      if (isBundleGone(error)) return { ok: false, reason: "changed" };
      if (!(error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002")) throw error;
      // Trùng unique: hoặc request kia (cùng checkoutKey) vừa tạo đơn, hoặc trùng mã đơn ngẫu nhiên (thử lại)
      const duplicate = await orderForKey(input.checkoutKey);
      if (duplicate) return { ok: true, code: duplicate.code };
      if (attempt === 3) throw error;
    }
  }
}

const isBundleGone = (error: unknown) =>
  error instanceof Prisma.PrismaClientKnownRequestError &&
  error.code === "P2003" &&
  JSON.stringify(error.meta).includes("OrderItem_bundleId_fkey"); // meta của adapter-pg: driverAdapterError.cause.constraint.index

/** Đơn đã tạo bằng khoá checkout này (form gửi lại). Action /checkout tra nó TRƯỚC khi kiểm form và khung giờ (cổng M3 I1). */
export async function orderForKey(key: unknown) {
  if (typeof key !== "string" || !key) return null;
  return db.order.findUnique({ where: { checkoutKey: key }, select: { code: true, paymentMethod: true } });
}

async function insertOrder(tx: Prisma.TransactionClient, input: PlaceOrderInput, now: Date): Promise<string> {
  const quantities = aggregateQty(input.lines);
  const products = await tx.product.findMany({
    where: { id: { in: [...quantities.keys()] }, isActive: true },
    select: { id: true, name: true, unit: true, priceVnd: true },
  });
  const byId = new Map(products.map((p) => [p.id, p]));
  const gone = [...quantities.keys()].filter((id) => !byId.has(id));
  if (gone.length) throw new TotalChangedError(); // món ngừng bán sau khi khách xem trang: giỏ đã đổi

  const items = input.lines.map((l) => {
    const p = byId.get(l.productId)!;
    return {
      productId: p.id,
      bundleId: l.bundleId ?? null,
      nameSnapshot: p.name,
      unitSnapshot: p.unit,
      priceSnapshotVnd: p.priceVnd,
      qty: l.qty,
    };
  });
  // Cùng hàm tính tiền với drawer và nút "Đặt hàng", giá đọc lại từ DB ngay trong transaction.
  // stock: 1 = mọi dòng đều tính tiền: đơn chỉ commit khi MỌI dòng đã trừ kho thành công (không dựa vào số
  // tồn đọc lúc đầu, vì một đơn huỷ đồng thời có thể hoàn kho ngay sau đó → món miễn phí; cổng M3).
  const { subtotalVnd, shippingVnd, totalVnd } = cartTotals(items.map((i) => ({ priceVnd: i.priceSnapshotVnd, qty: i.qty, stock: 1 })));
  if (totalVnd !== input.expectedTotalVnd) throw new TotalChangedError();

  // Tạo đơn TRƯỚC khi trừ kho: request trùng checkoutKey dừng ngay ở đây, không khoá dòng Product nào
  const order = await tx.order.create({
    data: {
      code: newOrderCode(now),
      checkoutKey: input.checkoutKey,
      userId: input.userId,
      customerName: input.customerName,
      phone: input.phone,
      address: input.address,
      note: input.note,
      callOnSubstitute: input.callOnSubstitute,
      deliveryDate: new Date(input.deliveryDate),
      deliverySlot: input.deliverySlot,
      subtotalVnd,
      shippingVnd,
      totalVnd,
      paymentMethod: input.paymentMethod,
    },
    select: { id: true, code: true },
  });

  const short: OutOfStock[] = [];
  for (const [productId, qty] of quantities) {
    // Một câu UPDATE có điều kiện (spike M3: updateMany sinh đúng câu này): Postgres khoá dòng, đơn sau
    // chờ đơn trước commit rồi kiểm lại `stock >= q` trên giá trị mới → kho không bao giờ âm.
    const { count } = await tx.product.updateMany({
      where: { id: productId, isActive: true, stock: { gte: qty } },
      data: { stock: { decrement: qty } },
    });
    if (count === 0) {
      const p = byId.get(productId)!;
      const current = await tx.product.findUnique({ where: { id: productId }, select: { stock: true } });
      short.push({ productId, name: p.name, unit: p.unit, available: current?.stock ?? 0 });
    }
  }
  if (short.length) throw new OutOfStockError(short); // rollback: đơn vừa tạo và kho đã trừ đều quay lại

  await tx.orderItem.createMany({ data: items.map((i) => ({ ...i, orderId: order.id })) });
  return order.code;
}

/** Huỷ khi còn `pending` và hoàn kho, trong một transaction. Huỷ 2 lần cùng lúc chỉ hoàn kho 1 lần. */
export async function cancelOrder(orderId: number, now = new Date()): Promise<boolean> {
  return db.$transaction(async (tx) => {
    const { count } = await tx.order.updateMany({
      where: { id: orderId, status: "pending" },
      data: { status: "cancelled", cancelledAt: now },
    });
    if (count === 0) return false; // đã xử lý/đã huỷ: không hoàn kho thêm lần nữa
    const items = await tx.orderItem.findMany({ where: { orderId }, select: { productId: true, qty: true } });
    for (const [productId, qty] of aggregateQty(items)) {
      await tx.product.update({ where: { id: productId }, data: { stock: { increment: qty } } });
    }
    return true;
  });
}

const PAYMENT_STEPS = {
  pay: { from: ["unpaid"], data: { paymentStatus: "paid" } },
  fail: { from: ["unpaid"], data: { paymentStatus: "failed" } },
  retry: { from: ["failed"], data: { paymentStatus: "unpaid" } },
  cod: { from: ["unpaid", "failed"], data: { paymentMethod: "cod", paymentStatus: "unpaid" } },
} satisfies Record<string, { from: PaymentStatus[]; data: Prisma.OrderUpdateManyMutationInput }>;
export type PaymentStep = keyof typeof PAYMENT_STEPS;
export const isPaymentStep = (v: unknown): v is PaymentStep => typeof v === "string" && Object.hasOwn(PAYMENT_STEPS, v);

/**
 * Cổng thanh toán giả lập: chờ → thành công | thất bại → thử lại | chuyển COD. Chỉ áp cho đơn online còn `pending`.
 * ponytail: đơn online thất bại vẫn giữ kho tới khi khách/admin huỷ (spec), không có TTL; thêm job dọn đơn treo nếu chạy thật.
 */
export async function setOnlinePayment(orderId: number, step: PaymentStep): Promise<boolean> {
  const { from, data } = PAYMENT_STEPS[step];
  const { count } = await db.order.updateMany({
    where: { id: orderId, status: "pending", paymentMethod: "online_mock", paymentStatus: { in: from } },
    data,
  });
  return count === 1;
}

/** Số đơn chưa huỷ theo "YYYY-MM-DD|khung", từ hôm nay (giờ VN), để khoá khung đã đủ SLOT_CAPACITY. */
export async function takenSlots(now: Date): Promise<Record<string, number>> {
  const rows = await db.order.groupBy({
    by: ["deliveryDate", "deliverySlot"],
    where: { deliveryDate: { gte: new Date(vnDate(now)) }, status: { not: "cancelled" } },
    _count: { _all: true },
  });
  return Object.fromEntries(rows.map((r) => [`${r.deliveryDate.toISOString().slice(0, 10)}|${r.deliverySlot}`, r._count._all]));
}

/**
 * Điền sẵn checkout. Đã đăng nhập: đơn gần nhất của tài khoản, chưa có đơn thì SĐT tài khoản.
 * Khách: đơn mới nhất trong phiên (C3a), chỉ đơn phiên này xem được (`canViewOrder`), nên không lộ gì mới.
 */
export async function checkoutPrefill(session: AppSession) {
  const select = { customerName: true, phone: true, address: true, code: true, userId: true } as const;
  const userId = session.get("userId");
  const last = userId
    ? await db.order.findFirst({ where: { userId }, orderBy: { createdAt: "desc" }, select })
    : await db.order.findFirst({ where: { code: { in: session.get("guestOrderCodes") ?? [] } }, orderBy: { createdAt: "desc" }, select });
  if (last && canViewOrder(session, last)) return { name: last.customerName, phone: last.phone, address: last.address };
  if (!userId) return null;
  const user = await db.user.findUnique({ where: { id: userId }, select: { name: true, phone: true } });
  return user && { name: user.name ?? "", phone: user.phone, address: "" };
}

/** Đơn + dòng đơn + các giỏ quà của đơn (ảnh xem trước qua /gift/preview/:id, lời chúc, số món trong layout). */
export async function getOrder(code: string) {
  const order = await db.order.findUnique({
    where: { code },
    include: { items: { orderBy: { id: "asc" }, include: { product: { select: { isWeighed: true } } } } },
  });
  if (!order) return null;
  const ids = [...new Set(order.items.flatMap((i) => (i.bundleId ? [i.bundleId] : [])))];
  const rows = ids.length
    ? await db.giftBundle.findMany({ where: { id: { in: ids } }, select: { id: true, message: true, layout: true } })
    : [];
  // theo thứ tự dòng đơn (ids theo id món tăng dần): khối giỏ quà không đổi chỗ giữa các lần tải (admin M5 dùng lại)
  const bundles = ids.flatMap((id) => rows.filter((r) => r.id === id));
  return { ...order, bundles };
}

export type OrderWithItems = NonNullable<Awaited<ReturnType<typeof getOrder>>>;

/**
 * Tra đơn bằng mã + SĐT (khách vãng lai). Sai mã hay sai SĐT đều trả null như nhau (không lộ đơn nào tồn tại).
 * ponytail: không giới hạn số lần tra (phải đoán đúng cả SĐT lẫn 4 ký tự ngẫu nhiên trong ngày); thêm bộ đếm như admin nếu chạy thật.
 */
export const findOrderForPhone = (code: string, phone: string) =>
  db.order.findFirst({ where: { code: code.trim().toUpperCase(), phone }, select: { code: true } });

/** "Mua lại đơn này": số lượng tuyệt đối cho cookie giỏ, bỏ món ngừng bán/hết hàng, kẹp theo tồn kho. */
export async function reorderQuantities(orderId: number): Promise<Array<[number, number]>> {
  const items = await db.orderItem.findMany({ where: { orderId, bundleId: null }, select: { productId: true, qty: true } });
  const wanted = aggregateQty(items);
  const products = await db.product.findMany({
    where: { ...visible, id: { in: [...wanted.keys()] }, stock: { gt: 0 } },
    select: { id: true, stock: true },
  });
  return products.map((p) => [p.id, Math.min(wanted.get(p.id)!, p.stock, CART_MAX_QTY)]);
}

const STATUS_LABEL: Record<OrderStatus, string> = {
  pending: "Đã nhận đơn",
  preparing: "Đang chuẩn bị",
  shipping: "Đang giao",
  done: "Đã giao",
  cancelled: "Đơn đã huỷ",
};
const DAY = new Intl.DateTimeFormat("vi-VN", { timeZone: "UTC", weekday: "long", day: "2-digit", month: "2-digit" });

type OrderState = { status: OrderStatus; paymentMethod: PaymentMethod; paymentStatus: PaymentStatus };

/** Đơn online còn chờ khách trả (cổng giả lập còn mở cho đơn này). */
export const awaitingPayment = (o: OrderState) => o.status === "pending" && o.paymentMethod === "online_mock" && o.paymentStatus !== "paid";

/** Trạng thái khách thấy, một nguồn cho trang đơn và /orders: đơn online chưa trả không được trông như "đã nhận" (cổng M3 D2). */
export function orderStatusLabel(o: OrderState): string {
  if (awaitingPayment(o)) return o.paymentStatus === "failed" ? "Thanh toán chưa thành công" : "Chờ thanh toán";
  return STATUS_LABEL[o.status];
}

/** Dòng thanh toán dưới trạng thái. Đơn huỷ sau khi đã trả online thì báo hoàn tiền, không ghi "Đã thanh toán" trơ trụi. */
export function paymentNote(o: OrderState): string | null {
  if (o.status === "cancelled") return o.paymentStatus === "paid" ? "Tiền demo sẽ được hoàn cho bạn." : "Bạn không phải trả gì.";
  return o.paymentMethod === "online_mock" && o.paymentStatus === "paid" ? "Đã thanh toán (DEMO)" : null;
}

const itemView = (i: OrderWithItems["items"][number]) => ({
  id: i.id,
  name: i.nameSnapshot,
  unit: i.unitSnapshot,
  priceVnd: i.priceSnapshotVnd,
  qty: i.qty,
  isWeighed: i.product.isWeighed,
});

/** Đơn → dữ liệu hiển thị (nhãn và giờ VN tính sẵn ở server). Timeline 4 bước đọc từ các cột `*_at` (M5 ghi). */
export function toOrderView(order: OrderWithItems) {
  const at = (d: Date | null) => (d ? vnDateTimeLabel(d) : null);
  return {
    code: order.code,
    status: order.status,
    statusLabel: orderStatusLabel(order),
    awaitingPayment: awaitingPayment(order),
    paymentFailed: order.paymentStatus === "failed",
    paymentNote: paymentNote(order),
    createdAt: vnDateTimeLabel(order.createdAt),
    cancelledAt: at(order.cancelledAt),
    timeline: [
      { label: "Đã đặt hàng", at: at(order.createdAt) },
      { label: "Đang chuẩn bị", at: at(order.preparingAt) },
      { label: "Đang giao", at: at(order.shippingAt) },
      { label: "Đã giao", at: at(order.doneAt) },
    ],
    customerName: order.customerName,
    phone: order.phone,
    address: order.address,
    note: order.note,
    callOnSubstitute: order.callOnSubstitute,
    delivery: `${order.deliverySlot} · ${DAY.format(order.deliveryDate)}`,
    paymentMethod: order.paymentMethod,
    items: order.items.filter((i) => !i.bundleId).map(itemView),
    // Món theo nhóm giỏ quà (spec mục 3): ảnh xem trước + lời chúc + vỏ giỏ và từng món, đúng giá đã chụp lúc đặt
    bundles: order.bundles.map((b) => {
      const items = order.items.filter((i) => i.bundleId === b.id).map(itemView);
      return {
        id: b.id,
        message: b.message,
        itemCount: (b.layout as unknown[]).length,
        items,
        totalVnd: items.reduce((sum, i) => sum + i.priceVnd * i.qty, 0),
      };
    }),
    subtotalVnd: order.subtotalVnd,
    shippingVnd: order.shippingVnd,
    totalVnd: order.totalVnd,
  };
}

export type OrderView = ReturnType<typeof toOrderView>;

/** Danh sách cho /orders: theo tài khoản, hoặc theo các mã đơn khách có trong phiên. */
export async function listOrders(where: { userId: number } | { codes: string[] }) {
  const rows = await db.order.findMany({
    where: "userId" in where ? { userId: where.userId } : { code: { in: where.codes } },
    orderBy: { createdAt: "desc" },
    take: 50,
    select: { code: true, createdAt: true, totalVnd: true, status: true, paymentMethod: true, paymentStatus: true, items: { select: { bundleId: true } } },
  });
  return rows.map((o) => ({
    code: o.code,
    createdAt: vnDateTimeLabel(o.createdAt),
    totalVnd: o.totalVnd,
    statusLabel: orderStatusLabel(o),
    // Số dòng như khách thấy lúc đặt: mỗi dòng thường 1, mỗi giỏ quà 1 (không đếm từng món trong giỏ)
    itemCount: o.items.filter((i) => !i.bundleId).length + new Set(o.items.flatMap((i) => (i.bundleId ? [i.bundleId] : []))).size,
  }));
}
