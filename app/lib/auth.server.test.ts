import { afterAll, describe, expect, test, vi } from "vitest";
import { OTP_TTL_MS, signIn, startLogin, verifyLogin } from "~/lib/auth.server";
import { ADMIN_PHONE } from "~/lib/config";
import { db } from "~/lib/db.server";
import { addGuestOrder, canViewOrder, commitSession, getSession, requireAdmin, sessionStorage } from "~/lib/session.server";

// vitest.config.ts đặt DEMO_OTP=1 và ADMIN_PASSCODE=test-ma-quan-tri-2026; seed DB test có User admin ADMIN_PHONE
const PASSCODE = "test-ma-quan-tri-2026";
const PHONE = "0900000077";
const NOW = 1_800_000_000_000;

afterAll(async () => {
  await db.order.deleteMany({ where: { phone: PHONE } });
  await db.user.deleteMany({ where: { phone: PHONE } });
  await db.$disconnect();
});

const started = async (phone: string, now = NOW) => {
  const result = await startLogin(phone, now);
  if (!result.ok) throw new Error(result.error);
  return result;
};

describe("OTP khách (DEMO_OTP=1)", () => {
  test("mã 6 số chỉ trả về để hiện toast DEMO; cookie chỉ giữ HMAC, không giữ mã", async () => {
    const { otp, demoCode } = await started(PHONE);
    expect(demoCode).toMatch(/^\d{6}$/);
    expect(otp).toMatchObject({ phone: PHONE, tries: 0, admin: false, exp: NOW + OTP_TTL_MS });
    expect(otp.hash).toMatch(/^[0-9a-f]{64}$/);
    expect(JSON.stringify(otp)).not.toContain(demoCode!);
  });
  test("đúng mã thì đăng nhập; sai thì đếm lùi; sai lần thứ 5 phải gửi lại mã", async () => {
    const { otp, demoCode } = await started(PHONE);
    expect(verifyLogin(otp, demoCode!, NOW + 1000)).toEqual({ ok: true, phone: PHONE, viaPasscode: false });
    const wrong = demoCode === "000000" ? "111111" : "000000";
    let state = otp;
    for (let left = 4; left >= 1; left--) {
      const r = verifyLogin(state, wrong, NOW);
      expect(r).toEqual({ ok: false, error: `Mã OTP chưa đúng, còn ${left} lần thử.`, otp: { ...state, tries: 5 - left } });
      if (!r.ok && r.otp) state = r.otp;
    }
    expect(verifyLogin(state, wrong, NOW)).toEqual({ ok: false, error: "Bạn đã nhập sai 5 lần, bấm “Gửi lại mã” nhé.", otp: null });
    expect(verifyLogin({ ...state, tries: 5 }, demoCode!, NOW)).toMatchObject({ ok: false, otp: null }); // đúng mã cũng không qua
  });
  test("quá 5 phút thì mã hết hạn, kể cả nhập đúng", async () => {
    const { otp, demoCode } = await started(PHONE);
    expect(verifyLogin(otp, demoCode!, NOW + OTP_TTL_MS + 1)).toEqual({
      ok: false,
      error: "Mã đã hết hạn, bạn bấm “Gửi lại mã” nhé.",
      otp: null,
    });
  });
  test("mã của SĐT này không dùng được cho SĐT khác (hash gắn với SĐT)", async () => {
    const { otp, demoCode } = await started(PHONE);
    expect(verifyLogin({ ...otp, phone: "0900000078" }, demoCode!, NOW).ok).toBe(false);
  });
});

describe("Admin (spec: không bao giờ thấy OTP trên màn hình)", () => {
  test("SĐT admin không có mã OTP nào được tạo hay trả về", async () => {
    const { otp, demoCode } = await started(ADMIN_PHONE);
    expect(demoCode).toBeNull();
    expect(otp).toMatchObject({ admin: true, hash: "" });
  });
  test("thiếu passcode, passcode rỗng hay sai thì không vào được; đúng passcode thì vào (DoD M3)", async () => {
    const { otp } = await started(ADMIN_PHONE, NOW);
    expect(verifyLogin(otp, "", NOW).ok).toBe(false);
    expect(verifyLogin(otp, "123456", NOW).ok).toBe(false);
    expect(verifyLogin(otp, PASSCODE, NOW)).toEqual({ ok: true, phone: ADMIN_PHONE, viaPasscode: true });
  });
  test("ADMIN_PHONE chưa có dòng User (vừa deploy, giữa TRUNCATE và seed): vẫn không nhận OTP (cổng M3)", async () => {
    const admin = await db.user.findUniqueOrThrow({ where: { phone: ADMIN_PHONE } });
    await db.user.delete({ where: { id: admin.id } });
    try {
      const { otp, demoCode } = await started(ADMIN_PHONE);
      expect(demoCode).toBeNull();
      expect(otp.admin).toBe(true);
    } finally {
      await db.user.upsert({ where: { phone: ADMIN_PHONE }, update: { role: "admin" }, create: { phone: ADMIN_PHONE, role: "admin" } });
    }
  });
  test("tài khoản role admin không vào được bằng đường OTP, chỉ bằng passcode", async () => {
    expect(await signIn(ADMIN_PHONE, false)).toBeNull();
    const admin = await db.user.findUniqueOrThrow({ where: { phone: ADMIN_PHONE } });
    expect(await signIn(ADMIN_PHONE, true)).toBe(admin.id);
  });
  test("phát lại cookie cũ (tries=0) không giúp dò passcode: sai 5 lần là khoá 15 phút ở server", async () => {
    const { otp } = await started(ADMIN_PHONE, NOW + 1);
    for (let i = 0; i < 5; i++) verifyLogin(otp, `doan-${i}`, NOW + 1); // luôn gửi lại đúng trạng thái tries=0
    expect(verifyLogin(otp, PASSCODE, NOW + 2)).toEqual({
      ok: false,
      error: "Sai mã quản trị quá 5 lần, thử lại sau 15 phút.",
      otp: null,
    });
    const later = await started(ADMIN_PHONE, NOW + 16 * 60 * 1000);
    expect(verifyLogin(later.otp, PASSCODE, NOW + 16 * 60 * 1000).ok).toBe(true);
  });
});

describe("phiên + tài khoản", () => {
  test("đăng nhập lần đầu tự tạo tài khoản và gắn đơn khách vãng lai cùng SĐT", async () => {
    await db.order.create({
      data: {
        code: "DH000000TEST", phone: PHONE, customerName: "Khách", address: "x", deliveryDate: new Date("2026-10-16"),
        deliverySlot: "08:00–10:00", subtotalVnd: 1, shippingVnd: 0, totalVnd: 1, paymentMethod: "cod",
      },
    });
    const userId = await signIn(PHONE, false);
    expect(await signIn(PHONE, false)).toBe(userId); // lần sau không tạo thêm
    expect((await db.order.findUniqueOrThrow({ where: { code: "DH000000TEST" } })).userId).toBe(userId);
  });
  test("canViewOrder: chủ tài khoản hoặc mã trong phiên; người lạ thì không (chống IDOR)", async () => {
    const session = await sessionStorage.getSession();
    const order = { code: "DH261015ABCD", userId: 42 };
    expect(canViewOrder(session, order)).toBe(false);
    addGuestOrder(session, "DH261015ABCD");
    expect(canViewOrder(session, order)).toBe(true);
    const owner = await sessionStorage.getSession();
    owner.set("userId", 42);
    expect(canViewOrder(owner, order)).toBe(true);
    expect(canViewOrder(owner, { ...order, userId: null })).toBe(false);
  });
  test("phiên giữ tối đa 20 mã đơn khách, mới nhất đứng đầu, không trùng", async () => {
    const session = await sessionStorage.getSession();
    for (let i = 0; i < 25; i++) addGuestOrder(session, `DH${i}`);
    addGuestOrder(session, "DH24");
    expect(session.get("guestOrderCodes")).toHaveLength(20);
    expect(session.get("guestOrderCodes")?.[0]).toBe("DH24");
  });
  test("cookie __session: 30 ngày, HttpOnly, SameSite=Lax, có ký (sửa tay là mất phiên)", async () => {
    const session = await sessionStorage.getSession();
    session.set("userId", 1);
    const header = await commitSession(session);
    expect(header).toMatch(/^__session=.+; Max-Age=2592000; Path=\/; HttpOnly; SameSite=Lax$/);
    const valid = header.split(";")[0];
    const read = (cookie: string) => getSession(new Request("http://localhost/", { headers: { Cookie: cookie } }));
    expect((await read(valid)).get("userId")).toBe(1);
    // đổi userId nhưng giữ chữ ký cũ: phiên rỗng, không thành người khác được
    const forged = `__session=${encodeURIComponent(btoa(JSON.stringify({ userId: 2 })))}${valid.slice(valid.indexOf("."))}`;
    expect((await read(forged)).get("userId")).toBeUndefined();
  });
  test("requireAdmin: chưa đăng nhập → /login; customer → 403; admin → qua", async () => {
    const asUser = async (userId?: number) => {
      const s = await sessionStorage.getSession();
      if (userId) s.set("userId", userId);
      const cookie = (await commitSession(s)).split(";")[0];
      return requireAdmin(new Request("http://localhost/admin/orders?x=1", { headers: { Cookie: cookie } })).catch((e: Response) => e);
    };
    const guest = (await asUser()) as Response;
    expect([guest.status, guest.headers.get("Location")]).toEqual([302, "/login?redirectTo=%2Fadmin%2Forders%3Fx%3D1"]);
    const customer = await db.user.findUniqueOrThrow({ where: { phone: PHONE } });
    expect(((await asUser(customer.id)) as Response).status).toBe(403);
    const admin = await db.user.findUniqueOrThrow({ where: { phone: ADMIN_PHONE } });
    expect(await asUser(admin.id)).toMatchObject({ phone: ADMIN_PHONE, role: "admin" });
  });
});

describe("fail-closed (env tắt)", () => {
  const fresh = async (env: Record<string, string>) => {
    vi.resetModules();
    for (const [k, v] of Object.entries(env)) vi.stubEnv(k, v);
    return import("~/lib/auth.server");
  };
  test("DEMO_OTP tắt: khách không nhận mã, trạng thái OTP hợp lệ cũng bị từ chối", async () => {
    const on = await started(PHONE);
    const off = await fresh({ DEMO_OTP: "0" });
    expect(await off.startLogin(PHONE, NOW)).toEqual({ ok: false, error: expect.any(String) });
    expect(off.verifyLogin(on.otp, on.demoCode!, NOW).ok).toBe(false);
    vi.unstubAllEnvs();
  });
  test("ADMIN_PASSCODE rỗng: SĐT admin không vào được, kể cả nhập chuỗi rỗng", async () => {
    const mod = await fresh({ ADMIN_PASSCODE: "" });
    expect(await mod.startLogin(ADMIN_PHONE, NOW)).toEqual({ ok: false, error: expect.any(String) });
    const adminState = { phone: ADMIN_PHONE, hash: "", exp: NOW + OTP_TTL_MS, tries: 0, admin: true };
    expect(mod.verifyLogin(adminState, "", NOW).ok).toBe(false);
    vi.unstubAllEnvs();
  });
});
