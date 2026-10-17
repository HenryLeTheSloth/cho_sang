import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, beforeEach, describe, expect, test } from "vitest";
import { cartTotals } from "~/lib/cart";
import { db } from "~/lib/db.server";
import {
  aggregateQty,
  cancelOrder,
  getOrder,
  listOrders,
  newOrderCode,
  orderStatusLabel,
  paymentNote,
  type PlaceOrderInput,
  type PlaceOrderResult,
  placeOrder,
  reorderQuantities,
  setOnlinePayment,
  takenSlots,
  toOrderView,
} from "~/lib/orders.server";

// Dữ liệu riêng của file này (DB test chosang_test), không dựa vào số tồn kho của seed
const SLUG = "__m3-orders__";
const PHONE = "0900000099";
let A: number; // giá 50.000₫
let B: number; // giá 120.000₫
let OFF: number; // ngừng bán
const PRICE = new Map<number, number>(); // id → giá, để tính tổng khách "đã thấy" như nút Đặt hàng

const stock = async (id: number) => (await db.product.findUniqueOrThrow({ where: { id } })).stock;
const setStock = (id: number, value: number) => db.product.update({ where: { id }, data: { stock: value } });
const totalOf = (lines: PlaceOrderInput["lines"]) =>
  cartTotals(lines.map((l) => ({ priceVnd: PRICE.get(l.productId)!, qty: l.qty, stock: 1 }))).totalVnd;
const order = (lines: PlaceOrderInput["lines"], extra: Partial<PlaceOrderInput> = {}): PlaceOrderInput => ({
  checkoutKey: randomUUID(),
  userId: null,
  customerName: "Chị Lan",
  phone: PHONE,
  address: "12 Lê Lợi, Quận 1",
  note: "",
  callOnSubstitute: true,
  deliveryDate: "2026-10-16",
  deliverySlot: "08:00–10:00",
  paymentMethod: "cod",
  lines,
  expectedTotalVnd: totalOf(lines),
  ...extra,
});
const ordersOf = (productId: number) => db.orderItem.count({ where: { productId, order: { phone: PHONE } } });

const cleanup = async () => {
  await db.order.deleteMany({ where: { phone: PHONE } }); // OrderItem xoá theo cascade
  await db.giftBundle.deleteMany({ where: { baseProduct: { slug: { startsWith: SLUG } } } }); // trước sản phẩm (khoá ngoại)
  await db.product.deleteMany({ where: { slug: { startsWith: SLUG } } });
  await db.category.deleteMany({ where: { slug: SLUG } });
};

beforeAll(async () => {
  await cleanup();
  const { id: categoryId } = await db.category.create({ data: { slug: SLUG, name: "test", image: "x" } });
  const make = (suffix: string, priceVnd: number, isActive = true) =>
    db.product.create({
      data: {
        slug: `${SLUG}${suffix}`, name: `Món ${suffix}`, nameSearch: suffix, description: "", categoryId, priceVnd,
        unit: "gói", origin: "x", shelfLife: "x", storage: "x", stock: 10, isActive,
      },
    });
  const made = await Promise.all([make("a", 50000), make("b", 120000), make("off", 10000, false)]);
  for (const p of made) PRICE.set(p.id, p.priceVnd);
  [A, B, OFF] = made.map((p) => p.id);
});

beforeEach(async () => {
  await Promise.all([setStock(A, 10), setStock(B, 10), setStock(OFF, 10)]);
});

afterAll(async () => {
  await cleanup();
  await db.$disconnect();
});

describe("thuần", () => {
  test("aggregateQty gộp cùng sản phẩm (dòng thường + món trong giỏ quà) và sắp id tăng dần", () => {
    const lines = [{ productId: 9, qty: 1 }, { productId: 3, qty: 2 }, { productId: 9, qty: 4 }];
    expect([...aggregateQty(lines)]).toEqual([[3, 2], [9, 5]]);
  });
  test('mã đơn = "DH" + ngày giờ VN (yymmdd) + 4 ký tự không gây nhầm', () => {
    expect(newOrderCode(new Date("2026-10-14T20:00:00Z"))).toMatch(/^DH261015[A-HJ-NP-Z2-9]{4}$/); // 03:00 sáng 15/10 ở VN
  });
});

describe("nhãn trạng thái (một nguồn cho trang đơn và /orders)", () => {
  const o = (status: "pending" | "cancelled", paymentMethod: "cod" | "online_mock", paymentStatus: "unpaid" | "paid" | "failed") =>
    ({ status, paymentMethod, paymentStatus }) as const;
  test("đơn online chưa trả/thất bại không được trông như 'đã nhận, chờ chuẩn bị' (D2)", () => {
    expect(orderStatusLabel(o("pending", "online_mock", "unpaid"))).toBe("Chờ thanh toán");
    expect(orderStatusLabel(o("pending", "online_mock", "failed"))).toBe("Thanh toán chưa thành công");
    expect(orderStatusLabel(o("pending", "online_mock", "paid"))).toBe("Đã nhận đơn");
    expect(orderStatusLabel(o("pending", "cod", "unpaid"))).toBe("Đã nhận đơn");
    expect(orderStatusLabel(o("cancelled", "online_mock", "failed"))).toBe("Đơn đã huỷ");
  });
  test("dòng thanh toán: đã trả online; huỷ sau khi đã trả thì báo hoàn tiền, không ghi 'Đã thanh toán' (Task 6)", () => {
    expect(paymentNote(o("pending", "online_mock", "paid"))).toBe("Đã thanh toán (DEMO)");
    expect(paymentNote(o("cancelled", "online_mock", "paid"))).toBe("Tiền demo sẽ được hoàn cho bạn.");
    expect(paymentNote(o("cancelled", "online_mock", "unpaid"))).toBe("Bạn không phải trả gì.");
    expect(paymentNote(o("cancelled", "cod", "unpaid"))).toBe("Bạn không phải trả gì.");
    expect(paymentNote(o("pending", "cod", "unpaid"))).toBeNull();
    expect(paymentNote(o("pending", "online_mock", "failed"))).toBeNull(); // nhãn trạng thái đã nói
  });
});

describe("placeOrder", () => {
  test("trừ kho, chụp tên/đơn vị/giá, tổng tiền giống giỏ (dưới 300.000₫ thì cộng ship)", async () => {
    const result = await placeOrder(order([{ productId: A, qty: 2 }, { productId: B, qty: 1 }]));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const saved = await db.order.findUniqueOrThrow({ where: { code: result.code }, include: { items: { orderBy: { id: "asc" } } } });
    expect(saved).toMatchObject({ subtotalVnd: 220000, shippingVnd: 20000, totalVnd: 240000, status: "pending", paymentStatus: "unpaid" });
    expect(saved.deliveryDate.toISOString()).toBe("2026-10-16T00:00:00.000Z");
    expect(saved.items.map((i) => [i.nameSnapshot, i.unitSnapshot, i.priceSnapshotVnd, i.qty])).toEqual([
      ["Món a", "gói", 50000, 2],
      ["Món b", "gói", 120000, 1],
    ]);
    expect([await stock(A), await stock(B)]).toEqual([8, 9]);
  });

  test("cùng sản phẩm ở nhiều dòng (giỏ quà M4) bị trừ kho theo tổng", async () => {
    await setStock(A, 3);
    const result = await placeOrder(order([{ productId: A, qty: 2 }, { productId: A, qty: 2 }]));
    expect(result).toEqual({ ok: false, reason: "out-of-stock", outOfStock: [{ productId: A, name: "Món a", unit: "gói", available: 3 }] });
    expect(await stock(A)).toBe(3);
  });

  test("2 đơn tranh món cuối cùng lúc: đúng 1 đơn thành công, đơn kia báo hết đúng món đó (DoD M3)", async () => {
    await setStock(A, 1);
    const before = await ordersOf(A);
    const results = await Promise.all([placeOrder(order([{ productId: A, qty: 1 }])), placeOrder(order([{ productId: A, qty: 1 }]))]);
    expect(results.filter((r) => r.ok)).toHaveLength(1);
    expect(results.find((r) => !r.ok)).toEqual({
      ok: false,
      reason: "out-of-stock",
      outOfStock: [{ productId: A, name: "Món a", unit: "gói", available: 0 }],
    });
    expect(await stock(A)).toBe(0);
    expect(await ordersOf(A)).toBe(before + 1);
  });

  test("một món thiếu kho thì huỷ cả đơn: món còn lại không bị trừ, không có đơn nào được tạo", async () => {
    await setStock(B, 1);
    const before = await db.order.count({ where: { phone: PHONE } });
    const result = await placeOrder(order([{ productId: A, qty: 2 }, { productId: B, qty: 3 }]));
    expect(result).toEqual({ ok: false, reason: "out-of-stock", outOfStock: [{ productId: B, name: "Món b", unit: "gói", available: 1 }] });
    expect([await stock(A), await stock(B)]).toEqual([10, 1]);
    expect(await db.order.count({ where: { phone: PHONE } })).toBe(before);
  });

  test("bấm Đặt hàng 2 lần (cùng checkoutKey, đồng thời): 1 đơn, kho trừ 1 lần, cả hai nhận cùng mã (Review Focus 4)", async () => {
    const input = order([{ productId: A, qty: 2 }]);
    const [first, second] = await Promise.all([placeOrder(input), placeOrder(input)]);
    expect(first.ok && second.ok && first.code === second.code).toBe(true);
    expect(await db.order.count({ where: { checkoutKey: input.checkoutKey } })).toBe(1);
    expect(await stock(A)).toBe(8);
    expect(await placeOrder(input)).toEqual(first); // gửi lại sau đó (Back rồi gửi lại form) cũng không tạo đơn mới
  });

  test("hai đơn khoá sản phẩm theo thứ tự ngược nhau vẫn chạy xong (không deadlock)", async () => {
    const results = await Promise.all([
      placeOrder(order([{ productId: A, qty: 1 }, { productId: B, qty: 1 }])),
      placeOrder(order([{ productId: B, qty: 1 }, { productId: A, qty: 1 }])),
    ]);
    expect(results.every((r) => r.ok)).toBe(true);
    expect([await stock(A), await stock(B)]).toEqual([8, 8]);
  });

  test("món ngừng bán bị từ chối, không trừ kho", async () => {
    const result = await placeOrder(order([{ productId: OFF, qty: 1 }]));
    expect(result).toEqual({ ok: false, reason: "changed" });
    expect(await stock(OFF)).toBe(10);
  });

  test("giỏ không còn dòng nào còn hàng thì không tạo đơn (báo 'giỏ đã thay đổi')", async () => {
    expect(await placeOrder(order([]))).toEqual({ ok: false, reason: "changed" });
  });

  test("tổng tiền khác số khách đã thấy (giá vừa đổi): không tạo đơn, không trừ kho (cổng M3)", async () => {
    const before = await db.order.count({ where: { phone: PHONE } });
    const lines = [{ productId: A, qty: 2 }];
    expect(await placeOrder(order(lines, { expectedTotalVnd: totalOf(lines) - 1000 }))).toEqual({ ok: false, reason: "changed" });
    expect(await stock(A)).toBe(10);
    expect(await db.order.count({ where: { phone: PHONE } })).toBe(before);
  });
});

describe("sau khi đặt", () => {
  test("huỷ đơn pending hoàn kho; huỷ 2 lần cùng lúc chỉ hoàn 1 lần (DoD M3)", async () => {
    const placed = await placeOrder(order([{ productId: A, qty: 3 }, { productId: B, qty: 1 }]));
    if (!placed.ok) throw new Error("đặt hàng thất bại");
    const { id } = await db.order.findUniqueOrThrow({ where: { code: placed.code } });
    expect([await stock(A), await stock(B)]).toEqual([7, 9]);
    expect((await Promise.all([cancelOrder(id), cancelOrder(id)])).sort()).toEqual([false, true]);
    expect([await stock(A), await stock(B)]).toEqual([10, 10]);
    expect(await db.order.findUniqueOrThrow({ where: { id } })).toMatchObject({ status: "cancelled", cancelledAt: expect.any(Date) });
  });

  test("đơn đã qua pending (admin đang chuẩn bị) thì không huỷ được, kho giữ nguyên", async () => {
    const placed = await placeOrder(order([{ productId: A, qty: 1 }]));
    if (!placed.ok) throw new Error("đặt hàng thất bại");
    const { id } = await db.order.update({ where: { code: placed.code }, data: { status: "preparing", preparingAt: new Date() } });
    expect(await cancelOrder(id)).toBe(false);
    expect(await stock(A)).toBe(9);
  });

  test("thanh toán giả lập: chờ → thất bại → thử lại → thành công; không trả lại được; COD chỉ khi chưa trả", async () => {
    const placed = await placeOrder(order([{ productId: A, qty: 1 }], { paymentMethod: "online_mock" }));
    if (!placed.ok) throw new Error("đặt hàng thất bại");
    const { id } = await db.order.findUniqueOrThrow({ where: { code: placed.code } });
    const status = async () => (await db.order.findUniqueOrThrow({ where: { id } })).paymentStatus;
    expect(await setOnlinePayment(id, "retry")).toBe(false); // chưa thất bại thì chưa có "thử lại"
    expect(await setOnlinePayment(id, "fail")).toBe(true);
    expect(await status()).toBe("failed");
    expect(await stock(A)).toBe(9); // thất bại vẫn giữ kho tới khi huỷ (spec)
    expect(await setOnlinePayment(id, "retry")).toBe(true);
    expect(await setOnlinePayment(id, "pay")).toBe(true);
    expect(await status()).toBe("paid");
    expect(await setOnlinePayment(id, "pay")).toBe(false);
    expect(await setOnlinePayment(id, "cod")).toBe(false); // đã trả rồi thì không đổi sang COD
  });

  test("chuyển sang COD từ trạng thái thất bại; đơn COD không đi được vào cổng giả lập", async () => {
    const placed = await placeOrder(order([{ productId: A, qty: 1 }], { paymentMethod: "online_mock" }));
    if (!placed.ok) throw new Error("đặt hàng thất bại");
    const { id } = await db.order.findUniqueOrThrow({ where: { code: placed.code } });
    await setOnlinePayment(id, "fail");
    expect(await setOnlinePayment(id, "cod")).toBe(true);
    expect(await db.order.findUniqueOrThrow({ where: { id } })).toMatchObject({ paymentMethod: "cod", paymentStatus: "unpaid" });
    expect(await setOnlinePayment(id, "pay")).toBe(false);
  });

  test("trang đơn và /orders cùng nhãn 'Chờ thanh toán' cho đơn online chưa trả; dòng hàng cân có isWeighed (D2, C4)", async () => {
    await db.product.update({ where: { id: B }, data: { isWeighed: true } });
    try {
      const placed = await placeOrder(order([{ productId: A, qty: 1 }, { productId: B, qty: 1 }], { paymentMethod: "online_mock" }));
      if (!placed.ok) throw new Error("đặt hàng thất bại");
      const view = toOrderView((await getOrder(placed.code))!);
      expect(view).toMatchObject({ statusLabel: "Chờ thanh toán", awaitingPayment: true, paymentNote: null });
      expect(view.items.map((i) => i.isWeighed)).toEqual([false, true]);
      expect((await listOrders({ codes: [placed.code] }))[0].statusLabel).toBe("Chờ thanh toán");
    } finally {
      await db.product.update({ where: { id: B }, data: { isWeighed: false } });
    }
  });

  test("takenSlots đếm đơn chưa huỷ theo ngày + khung", async () => {
    const day = { deliveryDate: "2031-01-02", deliverySlot: "14:00–16:00" };
    const a = await placeOrder(order([{ productId: A, qty: 1 }], day));
    await placeOrder(order([{ productId: A, qty: 1 }], day));
    if (!a.ok) throw new Error("đặt hàng thất bại");
    await cancelOrder((await db.order.findUniqueOrThrow({ where: { code: a.code } })).id);
    expect((await takenSlots(new Date("2031-01-01T17:30:00Z")))["2031-01-02|14:00–16:00"]).toBe(1);
  });

  test("Mua lại: kẹp theo tồn kho, bỏ món đã hết hàng", async () => {
    const placed = await placeOrder(order([{ productId: A, qty: 5 }, { productId: B, qty: 2 }]));
    if (!placed.ok) throw new Error("đặt hàng thất bại");
    const { id } = await db.order.findUniqueOrThrow({ where: { code: placed.code } });
    await Promise.all([setStock(A, 3), setStock(B, 0)]);
    expect(await reorderQuantities(id)).toEqual([[A, 3]]);
  });
});

describe("giỏ quà (M4)", () => {
  let BASE: number; // vỏ giỏ 100.000₫ (isGiftBase: ẩn khỏi collection nhưng vẫn đặt được)
  let BUNDLE: string; // layout: A, A, B
  const bundleLines = () => [
    { productId: BASE, qty: 1, bundleId: BUNDLE },
    { productId: A, qty: 2, bundleId: BUNDLE },
    { productId: B, qty: 1, bundleId: BUNDLE },
  ];

  beforeAll(async () => {
    const { categoryId } = await db.product.findUniqueOrThrow({ where: { id: A } });
    const base = await db.product.create({
      data: {
        slug: `${SLUG}base`, name: "Vỏ giỏ", nameSearch: "vo gio", description: "", categoryId, priceVnd: 100000,
        unit: "giỏ", origin: "x", shelfLife: "x", storage: "x", stock: 10, isGiftBase: true,
      },
    });
    BASE = base.id;
    PRICE.set(BASE, base.priceVnd);
    const at = { x: 0.5, y: 0.5, s: 1, r: 0 };
    ({ id: BUNDLE } = await db.giftBundle.create({
      data: { baseProductId: BASE, layout: [{ pid: A, ...at }, { pid: A, ...at }, { pid: B, ...at }], message: "Chúc mừng năm mới", preview: "data:image/webp;base64,AAAA" },
    }));
  });
  beforeEach(() => setStock(BASE, 10));

  test("gộp kho theo sản phẩm (dòng thường + món trong giỏ + vỏ giỏ), dòng giỏ quà mang bundleId, tổng = vỏ + món", async () => {
    const lines = [{ productId: A, qty: 1 }, ...bundleLines()];
    const result = await placeOrder(order(lines));
    if (!result.ok) throw new Error("đặt hàng thất bại");
    const saved = await db.order.findUniqueOrThrow({ where: { code: result.code }, include: { items: { orderBy: { id: "asc" } } } });
    expect(saved).toMatchObject({ subtotalVnd: 370000, shippingVnd: 0, totalVnd: 370000 }); // 50 + (100 + 2×50 + 120) nghìn
    expect(saved.items.map((i) => [i.productId, i.qty, i.bundleId])).toEqual([
      [A, 1, null],
      [BASE, 1, BUNDLE],
      [A, 2, BUNDLE],
      [B, 1, BUNDLE],
    ]);
    expect([await stock(A), await stock(B), await stock(BASE)]).toEqual([7, 9, 9]);
  });

  test("món trong giỏ quà thiếu kho (tính chung với dòng thường): báo đúng món, không trừ gì, kể cả vỏ giỏ", async () => {
    await setStock(A, 2);
    const result = await placeOrder(order([{ productId: A, qty: 1 }, ...bundleLines()]));
    expect(result).toEqual({ ok: false, reason: "out-of-stock", outOfStock: [{ productId: A, name: "Món a", unit: "gói", available: 2 }] });
    expect([await stock(A), await stock(B), await stock(BASE)]).toEqual([2, 10, 10]);
  });

  test("giỏ quà đã bị xoá khỏi DB giữa lúc xem và lúc đặt (P2003): báo 'giỏ đã thay đổi', không tạo đơn, không trừ kho", async () => {
    const gone = "cmgr0x9k10000abcd1234efgh"; // cuid hợp lệ nhưng không có GiftBundle nào
    const before = await db.order.count({ where: { phone: PHONE } });
    const result = await placeOrder(order([{ productId: BASE, qty: 1, bundleId: gone }, { productId: A, qty: 1, bundleId: gone }]));
    expect(result).toEqual({ ok: false, reason: "changed" });
    expect([await stock(A), await stock(BASE)]).toEqual([10, 10]);
    expect(await db.order.count({ where: { phone: PHONE } })).toBe(before);
  });

  test("tổng tiền tính MỌI dòng, kể cả món được hoàn kho đúng lúc đang đặt (ghim `stock: 1`, ledger M3 T3b)", async () => {
    await setStock(A, 0);
    const lines = [{ productId: A, qty: 1 }];
    const input = order(lines);
    let placing!: Promise<PlaceOrderResult>;
    // Một transaction giữ chỗ cùng checkoutKey (chưa commit): placeOrder đọc giá xong thì dừng ở bước tạo đơn.
    // Lúc đó một "đơn huỷ" hoàn kho A rồi commit; transaction giữ chỗ rollback, placeOrder chạy tiếp và trừ kho được.
    const rollback = new Error("rollback");
    await db
      .$transaction(async (tx) => {
        await tx.order.create({
          data: {
            code: "TESTHOLD", checkoutKey: input.checkoutKey, customerName: "x", phone: PHONE, address: "x",
            deliveryDate: new Date("2026-10-16"), deliverySlot: "08:00–10:00", subtotalVnd: 0, shippingVnd: 0, totalVnd: 0, paymentMethod: "cod",
          },
        });
        placing = placeOrder(input);
        await new Promise((resolve) => setTimeout(resolve, 300));
        await setStock(A, 1); // ngoài transaction này: commit ngay
        throw rollback;
      })
      .catch((error) => {
        if (error !== rollback) throw error;
      });
    const result = await placing;
    if (!result.ok) throw new Error(`đặt hàng thất bại: ${result.reason}`);
    // Nếu tổng chỉ tính dòng có tồn kho lúc đọc giá (kho = 0) thì A thành món miễn phí, hoặc đơn bị báo "changed"
    expect((await db.order.findUniqueOrThrow({ where: { code: result.code } })).totalVnd).toBe(totalOf(lines));
    expect(await stock(A)).toBe(0);
  });

  test("trang đơn nhóm món theo giỏ quà: lời chúc, số món trong layout, vỏ giỏ + món, tổng của giỏ", async () => {
    const result = await placeOrder(order([{ productId: B, qty: 1 }, ...bundleLines()]));
    if (!result.ok) throw new Error("đặt hàng thất bại");
    const view = toOrderView((await getOrder(result.code))!);
    expect(view.items.map((i) => [i.name, i.qty])).toEqual([["Món b", 1]]);
    expect(view.bundles).toHaveLength(1);
    expect(view.bundles[0]).toMatchObject({ id: BUNDLE, message: "Chúc mừng năm mới", itemCount: 3, totalVnd: 320000 });
    expect(view.bundles[0].items.map((i) => [i.name, i.qty])).toEqual([["Vỏ giỏ", 1], ["Món a", 2], ["Món b", 1]]);
  });

  test("/orders đếm 'món' như lúc đặt: dòng thường + 1 cho mỗi giỏ quà (không phải 4 dòng OrderItem)", async () => {
    const result = await placeOrder(order([{ productId: B, qty: 1 }, ...bundleLines()]));
    if (!result.ok) throw new Error("đặt hàng thất bại");
    expect((await listOrders({ codes: [result.code] }))[0].itemCount).toBe(2);
  });

  test("khoá ngoại khác (userId không tồn tại) không bị đổi thành 'giỏ đã thay đổi': vẫn là lỗi thật", async () => {
    await expect(placeOrder(order([{ productId: A, qty: 1 }], { userId: 999999 }))).rejects.toMatchObject({ code: "P2003" });
    expect(await stock(A)).toBe(10);
  });
});
