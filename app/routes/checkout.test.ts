import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { cartCookie, readCart } from "~/lib/cart.server";
import { db } from "~/lib/db.server";
import { deliveryDays, firstOpenSlot } from "~/lib/delivery";
import { createBundle } from "~/lib/gift.server";
import { commitSession, getSession, sessionStorage } from "~/lib/session.server";
import { action as payAction, loader as payLoader } from "~/routes/checkout-pay";
import { action, loader } from "~/routes/checkout";

// DB test đã seed (chosang_test): rau-muong 15.000₫ còn 60, tao-envy hết hàng, nho-xanh-ninh-thuan còn 3
const PHONE = "0900000088";
const id: Record<string, number> = {};

beforeAll(async () => {
  const rows = await db.product.findMany({ where: { slug: { in: ["rau-muong", "tao-envy", "nho-xanh-ninh-thuan"] } } });
  for (const r of rows) id[r.slug] = r.id;
});
afterAll(async () => {
  await db.order.deleteMany({ where: { phone: PHONE } });
  await db.user.deleteMany({ where: { phone: { in: [PHONE, "0900000087"] } } });
  await db.$disconnect();
});

const cartOf = async (lines: [number, number][]) => (await cartCookie.serialize({ l: lines, b: [] })).split(";")[0];
const fields = (extra: Record<string, string> = {}) =>
  new URLSearchParams({
    name: "Chị Lan",
    phone: PHONE,
    address: "12 Lê Lợi, P. Bến Nghé, Q.1",
    slot: firstOpenSlot(deliveryDays(new Date(), {}))!,
    note: "",
    callOnSubstitute: "on",
    paymentMethod: "cod",
    key: crypto.randomUUID(),
    ...extra,
  });
const post = (body: URLSearchParams, cookie: string, headers: Record<string, string> = {}) =>
  action({
    request: new Request("http://localhost/checkout", { method: "POST", body, headers: { Cookie: cookie, ...headers } }),
    params: {},
  } as Parameters<typeof action>[0]).catch((e: unknown) => e);
const cookiesOf = (res: Response) => res.headers.getSetCookie().map((c) => c.split(";")[0]).join("; ");
const load = (cookie: string) =>
  loader({ request: new Request("http://localhost/checkout", { headers: { Cookie: cookie } }), params: {} } as Parameters<typeof loader>[0]);
/** Như trình duyệt: tải trang checkout (lấy tổng tiền đang hiện trên nút) rồi mới gửi form. */
const formFor = async (cart: string, extra: Record<string, string> = {}) =>
  fields({ total: String((await load(cart)).totals.totalVnd), ...extra });
const send = async (cart: string, extra: Record<string, string> = {}, headers: Record<string, string> = {}) =>
  post(await formFor(cart, extra), cart, headers);

describe("/checkout loader", () => {
  test("giỏ rỗng thì chuyển sang trang sản phẩm", async () => {
    const res = await loader({ request: new Request("http://localhost/checkout"), params: {} } as Parameters<typeof loader>[0]).catch((e) => e);
    expect([res.status, res.headers.get("Location")]).toEqual([302, "/collections/all"]);
  });
  test("có khoá đặt hàng mới mỗi lần tải; dòng hết hàng có trong danh sách nhưng không tính tiền", async () => {
    const cookie = await cartOf([[id["rau-muong"], 2], [id["tao-envy"], 1]]);
    const [a, b] = await Promise.all([load(cookie), load(cookie)]);
    expect(a.checkoutKey).not.toBe(b.checkoutKey);
    expect(a.lines.map((l) => [l.slug, l.isWeighed])).toEqual([["rau-muong", true], ["tao-envy", true]]);
    expect(a.totals).toMatchObject({ subtotalVnd: 30000, shippingVnd: 20000, totalVnd: 50000 });
  });
});

describe("/checkout action", () => {
  test("COD: 1 đơn (bỏ dòng hết hàng), về trang đơn, phiên nhớ mã đơn + toast, giỏ được xoá — 2 Set-Cookie", async () => {
    const res = (await send(await cartOf([[id["rau-muong"], 2], [id["tao-envy"], 1]]))) as Response;
    expect(res.status).toBe(302);
    const code = res.headers.get("Location")!.replace("/orders/", "");
    expect(code).toMatch(/^DH\d{6}[A-Z0-9]{4}$/);
    const order = await db.order.findUniqueOrThrow({ where: { code }, include: { items: true } });
    expect(order).toMatchObject({ totalVnd: 50000, paymentMethod: "cod", userId: null, callOnSubstitute: true });
    expect(order.items.map((i) => [i.nameSnapshot, i.qty])).toEqual([["Rau muống", 2]]);
    const next = new Request("http://localhost/", { headers: { Cookie: cookiesOf(res) } });
    expect((await getSession(next)).get("guestOrderCodes")).toEqual([code]);
    expect((await getSession(next)).get("toast")).toBe("Đặt hàng thành công");
    expect((await readCart(next)).l).toEqual([]);
  });
  test("online giả lập: chuyển tới cổng /checkout/pay/:code", async () => {
    const res = (await send(await cartOf([[id["rau-muong"], 1]]), { paymentMethod: "online_mock" })) as Response;
    const location = res.headers.get("Location")!;
    expect(location).toMatch(/^\/checkout\/pay\/DH/);
    expect((await db.order.findUniqueOrThrow({ where: { code: location.replace("/checkout/pay/", "") } })).paymentMethod).toBe("online_mock");
  });
  test("bỏ tick 'gọi hỏi tôi' thì đơn lưu callOnSubstitute = false", async () => {
    const body = await formFor(await cartOf([[id["rau-muong"], 1]]));
    body.delete("callOnSubstitute");
    const res = (await post(body, await cartOf([[id["rau-muong"], 1]]))) as Response;
    const code = res.headers.get("Location")!.replace("/orders/", "");
    expect((await db.order.findUniqueOrThrow({ where: { code } })).callOnSubstitute).toBe(false);
  });
  test("form sai: 400 kèm lỗi theo field, không tạo đơn", async () => {
    const before = await db.order.count({ where: { phone: PHONE } });
    const res = await send(await cartOf([[id["rau-muong"], 1]]), { name: "", address: "Q1" });
    expect(res).toMatchObject({ init: { status: 400 }, data: { errors: { name: expect.any(Array), address: expect.any(Array) } } });
    expect(await db.order.count({ where: { phone: PHONE } })).toBe(before);
  });
  test("gửi lại cùng form (cùng khoá) thì về đúng đơn cũ, không tạo đơn thứ hai", async () => {
    const cart = await cartOf([[id["rau-muong"], 1]]);
    const body = await formFor(cart);
    const [a, b] = (await Promise.all([post(body, cart), post(body, cart)])) as Response[];
    expect(a.headers.get("Location")).toBe(b.headers.get("Location"));
    expect(await db.order.count({ where: { checkoutKey: body.get("key") } })).toBe(1);
  });
  test("vượt tồn kho: 409, báo đúng tên món và số còn lại", async () => {
    const before = await db.order.count({ where: { phone: PHONE } });
    const res = await send(await cartOf([[id["nho-xanh-ninh-thuan"], 5]]));
    expect(res).toMatchObject({
      init: { status: 409 },
      data: { errors: { form: ["Nho xanh Ninh Thuận chỉ còn 3 hộp 500g. Bạn sửa giỏ hàng rồi đặt lại nhé."] } },
    });
    expect(await db.order.count({ where: { phone: PHONE } })).toBe(before);
  });
  test("giá đổi sau khi khách xem trang: 409, không tạo đơn (chỉ trả đúng tổng đã thấy trên nút)", async () => {
    const cart = await cartOf([[id["rau-muong"], 1]]);
    const body = await formFor(cart);
    const before = await db.order.count({ where: { phone: PHONE } });
    await db.product.update({ where: { id: id["rau-muong"] }, data: { priceVnd: 16000 } });
    try {
      expect(await post(body, cart)).toMatchObject({
        init: { status: 409 },
        data: { errors: { form: ["Giá hoặc giỏ hàng vừa thay đổi, bạn xem lại tổng tiền rồi đặt lại nhé."] } },
      });
      expect(await db.order.count({ where: { phone: PHONE } })).toBe(before);
    } finally {
      await db.product.update({ where: { id: id["rau-muong"] }, data: { priceVnd: 15000 } });
    }
  });
  test("món duy nhất vừa hết sau khi khách xem trang: 409 nêu đúng tên món, không phải 'giỏ trống'", async () => {
    const cart = await cartOf([[id["nho-xanh-ninh-thuan"], 1]]);
    const body = await formFor(cart);
    const { stock } = await db.product.findUniqueOrThrow({ where: { id: id["nho-xanh-ninh-thuan"] } });
    await db.product.update({ where: { id: id["nho-xanh-ninh-thuan"] }, data: { stock: 0 } });
    try {
      expect(await post(body, cart)).toMatchObject({
        init: { status: 409 },
        data: { errors: { form: ["Nho xanh Ninh Thuận vừa hết hàng. Tổng tiền đã cập nhật, bạn xem lại rồi đặt lại nhé."] } },
      });
    } finally {
      await db.product.update({ where: { id: id["nho-xanh-ninh-thuan"] }, data: { stock } });
    }
  });
  test("gửi lại form sau khi đơn đã tạo (giỏ đã xoá, ví dụ bấm Back rồi gửi lại): về đúng đơn cũ", async () => {
    const cart = await cartOf([[id["rau-muong"], 1]]);
    const body = await formFor(cart);
    const first = (await post(body, cart)) as Response;
    const again = (await post(body, cookiesOf(first))) as Response; // cookie mới: giỏ rỗng + phiên có mã đơn
    expect(again.headers.get("Location")).toBe(first.headers.get("Location"));
    expect(await db.order.count({ where: { checkoutKey: body.get("key") } })).toBe(1);
  });
  test("khung giờ vừa kín vì chính đơn này: gửi lại cùng khoá vẫn về đơn cũ, không 400, không tạo đơn thứ hai (cổng M3 I1)", async () => {
    const slot = deliveryDays(new Date(), {})[1].slots.at(-1)!.value; // 17:00–19:00 ngày mai: không bao giờ "đã qua"
    const [date, deliverySlot] = slot.split("|");
    const inSlot = { phone: PHONE, deliveryDate: new Date(date), deliverySlot };
    await db.order.createMany({
      data: Array.from({ length: 19 }, (_, i) => ({
        ...inSlot, code: `DHFILL${String(i).padStart(6, "0")}`, customerName: "x", address: "x",
        subtotalVnd: 0, shippingVnd: 0, totalVnd: 0, paymentMethod: "cod" as const,
      })),
    });
    try {
      const cart = await cartOf([[id["rau-muong"], 1]]);
      const body = await formFor(cart, { slot });
      const first = (await post(body, cart)) as Response;
      expect(first.status).toBe(302); // đơn thứ 20: khung vừa kín
      // Response đầu bị huỷ giữa đường (cookie xoá giỏ không tới): trình duyệt gửi lại đúng form cũ, giỏ còn nguyên
      const again = (await post(body, cart)) as Response;
      expect([again.status, again.headers.get("Location")]).toEqual([302, first.headers.get("Location")]);
      expect(await db.order.count({ where: inSlot })).toBe(20);
      const next = new Request("http://localhost/", { headers: { Cookie: cookiesOf(again) } });
      expect((await getSession(next)).get("guestOrderCodes")).toEqual([first.headers.get("Location")!.replace("/orders/", "")]);
      expect((await readCart(next)).l).toEqual([]);
    } finally {
      await db.order.deleteMany({ where: inSlot });
    }
  });
  test("userId trong phiên trỏ tới tài khoản đã xoá: vẫn đặt được, đơn không gắn tài khoản (N1)", async () => {
    const s = await sessionStorage.getSession();
    s.set("userId", 999_999);
    const cart = await cartOf([[id["rau-muong"], 1]]);
    const res = (await send(`${(await commitSession(s)).split(";")[0]}; ${cart}`)) as Response;
    expect(res.status).toBe(302);
    const code = res.headers.get("Location")!.replace("/orders/", "");
    expect((await db.order.findUniqueOrThrow({ where: { code } })).userId).toBeNull();
  });
  test("đã đăng nhập: điền sẵn từ đơn gần nhất; chưa có đơn thì chỉ có SĐT tài khoản", async () => {
    const user = await db.user.upsert({ where: { phone: PHONE }, update: {}, create: { phone: PHONE } });
    await db.order.updateMany({ where: { phone: PHONE }, data: { userId: user.id } });
    const fresh = await db.user.create({ data: { phone: "0900000087" } });
    const prefillFor = async (userId: number) => {
      const s = await sessionStorage.getSession();
      s.set("userId", userId);
      const cookie = `${(await commitSession(s)).split(";")[0]}; ${await cartOf([[id["rau-muong"], 1]])}`;
      return (await load(cookie)).prefill;
    };
    expect(await prefillFor(user.id)).toEqual({ name: "Chị Lan", phone: PHONE, address: "12 Lê Lợi, P. Bến Nghé, Q.1" });
    expect(await prefillFor(fresh.id)).toEqual({ name: "", phone: "0900000087", address: "" });
  });
  test("khách vãng lai: điền sẵn từ đơn mới nhất trong phiên; phiên lạ không thấy gì (C3a)", async () => {
    const cart = await cartOf([[id["rau-muong"], 1]]);
    const first = (await send(cart, { name: "Anh Tư", address: "9 Pasteur, Q.3" })) as Response;
    const session = cookiesOf(first).split("; ").find((c) => c.startsWith("__session="))!;
    expect((await load(`${session}; ${cart}`)).prefill).toEqual({ name: "Anh Tư", phone: PHONE, address: "9 Pasteur, Q.3" });
    expect((await load(cart)).prefill).toBeNull();
  });
  test("POST từ trang khác bị chặn 403", async () => {
    const res = (await send(await cartOf([[id["rau-muong"], 1]]), {}, { Origin: "http://evil.test" })) as Response;
    expect(res.status).toBe(403);
  });
});

describe("/checkout/pay/:code", () => {
  const placeOnline = async () => {
    const res = (await send(await cartOf([[id["rau-muong"], 1]]), { paymentMethod: "online_mock" })) as Response;
    const code = res.headers.get("Location")!.split("/").at(-1)!;
    return { code, cookie: cookiesOf(res) };
  };
  const pay = (code: string, cookie: string, intent: string) =>
    payAction({
      request: new Request(`http://localhost/checkout/pay/${code}`, { method: "POST", body: new URLSearchParams({ intent }), headers: { Cookie: cookie } }),
      params: { code },
    } as Parameters<typeof payAction>[0]).catch((e: unknown) => e) as Promise<Response>;

  test("người lạ (không có mã trong phiên) bị đưa về trang đơn, không thấy số tiền", async () => {
    const { code } = await placeOnline();
    const res = await payLoader({ request: new Request(`http://localhost/checkout/pay/${code}`), params: { code } } as Parameters<typeof payLoader>[0]).catch((e) => e);
    expect([res.status, res.headers.get("Location")]).toEqual([302, `/orders/${code}`]);
    expect((await pay(code, "", "pay")).headers.get("Location")).toBe(`/orders/${code}`);
    expect((await db.order.findUniqueOrThrow({ where: { code } })).paymentStatus).toBe("unpaid");
  });
  test("thất bại → ở lại cổng; thử lại; thành công → về trang đơn, đã thanh toán", async () => {
    const { code, cookie } = await placeOnline();
    expect((await pay(code, cookie, "fail")).headers.get("Location")).toBe(`/checkout/pay/${code}`);
    const failed = await payLoader({ request: new Request(`http://localhost/checkout/pay/${code}`, { headers: { Cookie: cookie } }), params: { code } } as Parameters<typeof payLoader>[0]);
    expect(failed).toMatchObject({ code, failed: true });
    await pay(code, cookie, "retry");
    expect((await pay(code, cookie, "pay")).headers.get("Location")).toBe(`/orders/${code}`);
    expect((await db.order.findUniqueOrThrow({ where: { code } })).paymentStatus).toBe("paid");
  });
  test("đơn online chưa trả: 'cod' chuyển sang tiền mặt; đơn đã huỷ thì 'pay' và 'cod' không đổi gì (T6c, T6d)", async () => {
    const unpaid = await placeOnline();
    expect((await pay(unpaid.code, unpaid.cookie, "cod")).headers.get("Location")).toBe(`/orders/${unpaid.code}`);
    expect(await db.order.findUniqueOrThrow({ where: { code: unpaid.code } })).toMatchObject({ paymentMethod: "cod", paymentStatus: "unpaid" });

    const { code, cookie } = await placeOnline();
    await db.order.update({ where: { code }, data: { status: "cancelled", cancelledAt: new Date() } });
    for (const intent of ["pay", "cod"]) expect((await pay(code, cookie, intent)).headers.get("Location")).toBe(`/orders/${code}`);
    expect(await db.order.findUniqueOrThrow({ where: { code } })).toMatchObject({ status: "cancelled", paymentMethod: "online_mock", paymentStatus: "unpaid" });
  });
});

describe("giỏ quà ở checkout (M4)", () => {
  // Giỏ quà: vỏ giỏ 120.000₫ + cam sành ×2 (39.000₫) + chuối ×1 (32.000₫) = 230.000₫
  const gift: Record<string, number> = {};
  let bundle = "";
  const bundleCart = async (lines: [number, number][] = []) => (await cartCookie.serialize({ l: lines, b: [bundle] })).split(";")[0];
  const stockOf = async (slug: string) => (await db.product.findUniqueOrThrow({ where: { slug } })).stock;

  beforeAll(async () => {
    const rows = await db.product.findMany({ where: { slug: { in: ["cam-sanh", "chuoi-gia", "gio-may-qua-bieu"] } } });
    for (const r of rows) gift[r.slug] = r.id;
    const at = { x: 0.5, y: 0.6, s: 1, r: 0 };
    bundle = (await createBundle({
      layout: [{ pid: gift["cam-sanh"], ...at }, { pid: gift["chuoi-gia"], ...at }, { pid: gift["cam-sanh"], ...at }],
      message: "Chúc mừng năm mới",
      preview: "data:image/webp;base64,UklGRhYAAABXRUJQVlA4IAoAAAAwAQCdASoBAAEAAUAmJaQAA3AA/v3AgAA=",
    }))!;
  });

  test("loader: giỏ chỉ có giỏ quà không bị chuyển trang; tổng gồm giỏ quà (một dòng số lượng 1)", async () => {
    const data = await load(await bundleCart([[id["rau-muong"], 1]]));
    expect(data.bundles.map((b) => [b.id, b.itemCount, b.priceVnd, b.stock])).toEqual([[bundle, 3, 230000, 1]]);
    expect(data.totals).toMatchObject({ subtotalVnd: 245000, shippingVnd: 20000, totalVnd: 265000 });
    expect((await load(await bundleCart())).bundles).toHaveLength(1);
  });

  test("COD: dòng giỏ quà vào đơn với bundleId (vỏ giỏ + từng món), trừ kho từng món và vỏ giỏ, xoá cả `l` lẫn `b`", async () => {
    const before = await Promise.all(["cam-sanh", "chuoi-gia", "gio-may-qua-bieu", "rau-muong"].map(stockOf));
    const res = (await send(await bundleCart([[id["rau-muong"], 1]]))) as Response;
    expect(res.status).toBe(302);
    const order = await db.order.findUniqueOrThrow({
      where: { code: res.headers.get("Location")!.replace("/orders/", "") },
      include: { items: { orderBy: { id: "asc" } } },
    });
    expect(order.totalVnd).toBe(265000);
    expect(order.items.map((i) => [i.nameSnapshot, i.qty, i.bundleId])).toEqual([
      ["Rau muống", 1, null],
      ["Giỏ mây quà biếu", 1, bundle],
      ["Cam sành", 2, bundle],
      ["Chuối già Nam Mỹ", 1, bundle],
    ]);
    expect(await Promise.all(["cam-sanh", "chuoi-gia", "gio-may-qua-bieu", "rau-muong"].map(stockOf))).toEqual(before.map((n, i) => n - [2, 1, 1, 1][i]));
    expect(await readCart(new Request("http://localhost/", { headers: { Cookie: cookiesOf(res) } }))).toEqual({ l: [], b: [] });
  });

  test("món của giỏ quà vừa không đủ hàng sau khi khách xem trang: 409 nói rõ là món trong giỏ quà", async () => {
    const cart = await bundleCart();
    const body = await formFor(cart);
    const stock = await stockOf("cam-sanh");
    await db.product.update({ where: { id: gift["cam-sanh"] }, data: { stock: 1 } });
    try {
      expect(await post(body, cart)).toMatchObject({
        init: { status: 409 },
        data: { errors: { form: ["Giỏ quà có món vừa hết hàng (Cam sành). Tổng tiền đã cập nhật, bạn xem lại rồi đặt lại nhé."] } },
      });
    } finally {
      await db.product.update({ where: { id: gift["cam-sanh"] }, data: { stock } });
    }
  });

  test("cùng món ở dòng thường và trong giỏ quà vượt tồn kho khi gộp: 409 nêu tên món kèm '(có trong giỏ quà)'", async () => {
    const stock = await stockOf("cam-sanh");
    await db.product.update({ where: { id: gift["cam-sanh"] }, data: { stock: 2 } }); // giỏ cần 2, dòng thường cần 1
    try {
      expect(await send(await bundleCart([[gift["cam-sanh"], 1]]))).toMatchObject({
        init: { status: 409 },
        data: { errors: { form: ["Cam sành (có trong giỏ quà) chỉ còn 2 túi ~1kg. Bạn sửa giỏ hàng rồi đặt lại nhé."] } },
      });
    } finally {
      await db.product.update({ where: { id: gift["cam-sanh"] }, data: { stock } });
    }
  });
});
