import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { readCart } from "~/lib/cart.server";
import { db } from "~/lib/db.server";
import { createBundle } from "~/lib/gift.server";
import { getOrder, placeOrder } from "~/lib/orders.server";
import { commitSession, getSession, sessionStorage } from "~/lib/session.server";
import { action, loader } from "~/routes/order";
import { action as ordersAction, loader as ordersLoader } from "~/routes/orders";

// DB test đã seed. Đơn tạo thẳng bằng placeOrder để test quyền xem/huỷ/mua lại của trang đơn.
const PHONE = "0900000066";
let code = "";
let rauMuong = 0;

beforeAll(async () => {
  rauMuong = (await db.product.findUniqueOrThrow({ where: { slug: "rau-muong" } })).id;
  const placed = await placeOrder({
    checkoutKey: crypto.randomUUID(), userId: null, customerName: "Chị Mai", phone: PHONE, address: "34 Hai Bà Trưng, Q.3",
    note: "", callOnSubstitute: false, deliveryDate: "2026-10-16", deliverySlot: "08:00–10:00", paymentMethod: "cod",
    lines: [{ productId: rauMuong, qty: 3 }],
    expectedTotalVnd: 65000, // 3 × 15.000₫ + ship 20.000₫
  });
  if (!placed.ok) throw new Error("không tạo được đơn test");
  code = placed.code;
});
afterAll(async () => {
  await db.order.deleteMany({ where: { phone: PHONE } });
  await db.$disconnect();
});

const req = (cookie = "", body?: Record<string, string>) =>
  new Request(`http://localhost/orders/${code}`, body ? { method: "POST", body: new URLSearchParams(body), headers: { Cookie: cookie } } : { headers: { Cookie: cookie } });
const view = (cookie = "") => loader({ request: req(cookie), params: { code } } as Parameters<typeof loader>[0]);
const act = (cookie: string, body: Record<string, string>) =>
  action({ request: req(cookie, body), params: { code } } as Parameters<typeof action>[0]).catch((e: unknown) => e);
const cookiesOf = (res: Response) => res.headers.getSetCookie().map((c) => c.split(";")[0]).join("; ");
const ownerCookie = async () => {
  const s = await sessionStorage.getSession();
  s.set("guestOrderCodes", [code]);
  return (await commitSession(s)).split(";")[0];
};

describe("/orders/:code (chống IDOR)", () => {
  test("người lạ chỉ thấy form nhập SĐT: không lộ tên, SĐT, địa chỉ; mã không tồn tại trả cùng một màn", async () => {
    const stranger = await view();
    expect(stranger).toEqual({ code, order: null, loggedIn: false });
    expect(JSON.stringify(stranger)).not.toContain("Hai Bà Trưng");
    const missing = await loader({ request: new Request("http://localhost/orders/DH000000ZZZZ"), params: { code: "DH000000ZZZZ" } } as Parameters<typeof loader>[0]);
    expect(missing).toEqual({ code: "DH000000ZZZZ", order: null, loggedIn: false });
  });
  test("tra sai SĐT: 400, không ghi phiên; đúng SĐT (khác định dạng): phiên nhớ mã và xem được đơn", async () => {
    expect(await act("", { intent: "lookup", phone: "0900000000" })).toMatchObject({ init: { status: 400 }, data: { error: "Số điện thoại không khớp với mã đơn này." } });
    const res = (await act("", { intent: "lookup", phone: "0900 000 066" })) as Response;
    expect(res.headers.get("Location")).toBe(`/orders/${code}`);
    const seen = await view(cookiesOf(res));
    expect(seen.order).toMatchObject({ code, address: "34 Hai Bà Trưng, Q.3", status: "pending" });
    expect(seen.order?.timeline.map((s) => s.at !== null)).toEqual([true, false, false, false]);
  });
  test("người lạ không huỷ được đơn của người khác (404), kho giữ nguyên", async () => {
    const before = (await db.product.findUniqueOrThrow({ where: { id: rauMuong } })).stock;
    const res = (await act("", { intent: "cancel" })) as Response;
    expect(res.status).toBe(404);
    expect((await db.order.findUniqueOrThrow({ where: { code } })).status).toBe("pending");
    expect((await db.product.findUniqueOrThrow({ where: { id: rauMuong } })).stock).toBe(before);
  });
  test("Mua lại: giỏ có lại các món của đơn, chuyển sang /checkout kèm toast", async () => {
    const res = (await act(await ownerCookie(), { intent: "reorder" })) as Response;
    expect(res.headers.get("Location")).toBe("/checkout");
    const next = new Request("http://localhost/", { headers: { Cookie: cookiesOf(res) } });
    expect((await readCart(next)).l).toEqual([[rauMuong, 3]]);
    expect((await getSession(next)).get("toast")).toBe("Đã thêm lại các món vào giỏ");
  });
  test("chủ đơn huỷ khi còn pending: hoàn kho; huỷ lần nữa báo không huỷ được", async () => {
    const cookie = await ownerCookie();
    const before = (await db.product.findUniqueOrThrow({ where: { id: rauMuong } })).stock;
    await act(cookie, { intent: "cancel" });
    expect((await db.order.findUniqueOrThrow({ where: { code } })).status).toBe("cancelled");
    expect((await db.product.findUniqueOrThrow({ where: { id: rauMuong } })).stock).toBe(before + 3);
    const again = (await act(cookie, { intent: "cancel" })) as Response;
    expect((await getSession(new Request("http://localhost/", { headers: { Cookie: cookiesOf(again) } }))).get("toast")).toMatch(/không huỷ được/);
  });
});

describe("/orders", () => {
  test("khách: chỉ liệt kê đơn có mã trong phiên", async () => {
    expect((await ordersLoader({ request: new Request("http://localhost/orders") } as Parameters<typeof ordersLoader>[0])).orders).toEqual([]);
    const mine = await ordersLoader({ request: new Request("http://localhost/orders", { headers: { Cookie: await ownerCookie() } }) } as Parameters<typeof ordersLoader>[0]);
    expect(mine.orders.map((o) => o.code)).toEqual([code]);
  });
  test("tra cứu mã + SĐT: đúng thì về trang đơn, sai mã hay sai SĐT cùng một lời nhắn", async () => {
    const lookup = (body: Record<string, string>) =>
      ordersAction({
        request: new Request("http://localhost/orders", { method: "POST", body: new URLSearchParams(body) }),
      } as Parameters<typeof ordersAction>[0]);
    const ok = (await lookup({ code: code.toLowerCase(), phone: PHONE })) as Response;
    expect(ok.headers.get("Location")).toBe(`/orders/${code}`);
    const wrongPhone = await lookup({ code, phone: "0911111111" });
    const wrongCode = await lookup({ code: "DH000000ZZZZ", phone: PHONE });
    expect(wrongPhone).toEqual(wrongCode);
  });
});

describe("đơn có giỏ quà (M4)", () => {
  let giftCode = "";
  let bundle = "";
  beforeAll(async () => {
    const rows = await db.product.findMany({ where: { slug: { in: ["cam-sanh", "gio-may-qua-bieu"] } } });
    const pid = Object.fromEntries(rows.map((r) => [r.slug, r.id]));
    bundle = (await createBundle({
      layout: [{ pid: pid["cam-sanh"], x: 0.5, y: 0.6, s: 1, r: 0 }],
      message: "Tặng mẹ",
      preview: "data:image/webp;base64,UklGRhYAAABXRUJQVlA4IAoAAAAwAQCdASoBAAEAAUAmJaQAA3AA/v3AgAA=",
    }))!;
    const placed = await placeOrder({
      checkoutKey: crypto.randomUUID(), userId: null, customerName: "Chị Mai", phone: PHONE, address: "34 Hai Bà Trưng, Q.3",
      note: "", callOnSubstitute: false, deliveryDate: "2026-10-16", deliverySlot: "08:00–10:00", paymentMethod: "cod",
      lines: [
        { productId: rauMuong, qty: 1 },
        { productId: pid["gio-may-qua-bieu"], qty: 1, bundleId: bundle },
        { productId: pid["cam-sanh"], qty: 1, bundleId: bundle },
      ],
      expectedTotalVnd: 15000 + 120000 + 39000 + 20000,
    });
    if (!placed.ok) throw new Error("không tạo được đơn giỏ quà");
    giftCode = placed.code;
  });
  const giftReq = (cookie: string, body?: Record<string, string>) =>
    new Request(`http://localhost/orders/${giftCode}`, body ? { method: "POST", body: new URLSearchParams(body), headers: { Cookie: cookie } } : { headers: { Cookie: cookie } });
  const owner = async () => {
    const s = await sessionStorage.getSession();
    s.set("guestOrderCodes", [giftCode]);
    return (await commitSession(s)).split(";")[0];
  };

  test("chủ đơn thấy món nhóm theo giỏ quà (lời chúc, số món); người lạ không thấy gì của giỏ quà", async () => {
    const seen = await loader({ request: giftReq(await owner()), params: { code: giftCode } } as Parameters<typeof loader>[0]);
    expect(seen.order?.items.map((i) => i.name)).toEqual(["Rau muống"]);
    expect(seen.order?.bundles).toMatchObject([{ id: bundle, message: "Tặng mẹ", itemCount: 1, totalVnd: 159000 }]);
    const stranger = await loader({ request: giftReq(""), params: { code: giftCode } } as Parameters<typeof loader>[0]);
    expect(JSON.stringify(stranger)).not.toContain(bundle);
  });

  test("Mua lại: dòng thường vào `l`, giỏ quà (cùng bố cục, ảnh, lời chúc) vào `b`", async () => {
    const res = (await action({ request: giftReq(await owner(), { intent: "reorder" }), params: { code: giftCode } } as Parameters<typeof action>[0])) as Response;
    expect(res.headers.get("Location")).toBe("/checkout");
    expect(await readCart(new Request("http://localhost/", { headers: { Cookie: cookiesOf(res) } }))).toEqual({ l: [[rauMuong, 1]], b: [bundle] });
  });

  test("Mua lại khi mọi món đã hết và giỏ quà có món ngừng bán: toast 'hết hàng', về /collections/all", async () => {
    const cam = await db.product.findUniqueOrThrow({ where: { slug: "cam-sanh" } });
    const rau = await db.product.findUniqueOrThrow({ where: { id: rauMuong } });
    await db.product.update({ where: { id: cam.id }, data: { isActive: false } });
    await db.product.update({ where: { id: rauMuong }, data: { stock: 0 } });
    try {
      const res = (await action({ request: giftReq(await owner(), { intent: "reorder" }), params: { code: giftCode } } as Parameters<typeof action>[0])) as Response;
      expect(res.headers.get("Location")).toBe("/collections/all");
      const session = await getSession(new Request("http://localhost/", { headers: { Cookie: cookiesOf(res) } }));
      expect(session.get("toast")).toBe("Các món trong đơn này đều đã hết hàng");
    } finally {
      await db.product.update({ where: { id: cam.id }, data: { isActive: true } });
      await db.product.update({ where: { id: rauMuong }, data: { stock: rau.stock } });
    }
  });

  test("getOrder: các giỏ quà theo thứ tự dòng đơn (id món đầu tiên), không theo thứ tự DB", async () => {
    const cam = (await db.product.findUniqueOrThrow({ where: { slug: "cam-sanh" } })).id;
    const base = (await db.product.findUniqueOrThrow({ where: { slug: "gio-may-qua-bieu" } })).id;
    const make = async () =>
      (await createBundle({ layout: [{ pid: cam, x: 0.5, y: 0.6, s: 1, r: 0 }], message: "", preview: "data:image/webp;base64,UklGRhYAAABXRUJQVlA4IAoAAAAwAQCdASoBAAEAAUAmJaQAA3AA/v3AgAA=" }))!;
    const first = await make(); // tạo trước (đứng trước trong bảng) nhưng nằm sau trong đơn
    const second = await make();
    const placed = await placeOrder({
      checkoutKey: crypto.randomUUID(), userId: null, customerName: "Chị Mai", phone: PHONE, address: "34 Hai Bà Trưng, Q.3",
      note: "", callOnSubstitute: false, deliveryDate: "2026-10-16", deliverySlot: "08:00–10:00", paymentMethod: "cod",
      lines: [
        { productId: base, qty: 1, bundleId: second },
        { productId: cam, qty: 1, bundleId: second },
        { productId: base, qty: 1, bundleId: first },
        { productId: cam, qty: 1, bundleId: first },
      ],
      expectedTotalVnd: 2 * (120000 + 39000), // ≥300.000₫: freeship
    });
    if (!placed.ok) throw new Error("không tạo được đơn 2 giỏ quà");
    expect((await getOrder(placed.code))!.bundles.map((b) => b.id)).toEqual([second, first]);
  });
});
