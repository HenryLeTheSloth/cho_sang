import { createHmac, randomInt, timingSafeEqual } from "node:crypto";
import { ADMIN_PHONE } from "./config";
import { db } from "./db.server";
import { env } from "./env.server";
import type { OtpState } from "./session.server";

export const OTP_TTL_MS = 5 * 60 * 1000;
export const OTP_MAX_TRIES = 5;
const ADMIN_LOCK_MS = 15 * 60 * 1000;

const hmac = (value: string) => createHmac("sha256", env.SESSION_SECRET).update(value).digest();
const sameHmac = (a: string, b: string) => timingSafeEqual(hmac(a), hmac(b)); // so sánh thời gian hằng
const otpHash = (phone: string, code: string, exp: number) => hmac(`otp:${phone}:${code}:${exp}`).toString("hex");

/**
 * ponytail: bộ đếm sai mã quản trị nằm trong RAM của MỘT tiến trình, mất khi khởi động lại. Nó là chốt chặn thật
 * cho ADMIN_PASSCODE vì `tries` trong cookie có thể bị phát lại (gửi lại cookie cũ là về 0 lần sai).
 * Chuyển sang bảng DB nếu chạy nhiều instance.
 * ponytail: với khách, giới hạn 5 lần sai và chống phát lại chỉ nằm trong cookie; cần bộ đếm phía server trước khi SMS thật thay DEMO.
 */
const adminFailures = new Map<string, { count: number; until: number }>();
const adminLocked = (phone: string, now: number) => {
  const f = adminFailures.get(phone);
  return f !== undefined && f.count >= OTP_MAX_TRIES && now < f.until;
};
function recordAdminFailure(phone: string, now: number) {
  const f = adminFailures.get(phone);
  const fresh = !f || now >= f.until;
  adminFailures.set(phone, { count: fresh ? 1 : f.count + 1, until: fresh ? now + ADMIN_LOCK_MS : f.until });
}

export type StartLogin = { ok: true; otp: OtpState; demoCode: string | null } | { ok: false; error: string };

/**
 * Bước 1. SĐT admin (role admin trong DB, HOẶC đúng ADMIN_PHONE kể cả khi chưa có dòng User: ví dụ lúc vừa deploy
 * chưa seed, hay giữa TRUNCATE và seed của demo:reset): không tạo OTP, không bao giờ hiện mã, chờ ADMIN_PASSCODE.
 * SĐT khác: chỉ khi DEMO_OTP=1 mới tạo mã 6 số và trả `demoCode` để hiện trong toast DEMO. Tắt cờ là fail-closed.
 */
export async function startLogin(phone: string, now = Date.now()): Promise<StartLogin> {
  const user = await db.user.findUnique({ where: { phone }, select: { role: true } });
  const exp = now + OTP_TTL_MS;
  if (user?.role === "admin" || phone === ADMIN_PHONE) {
    if (!env.ADMIN_PASSCODE) return { ok: false, error: "Tài khoản quản trị chưa được bật trên bản này." };
    return { ok: true, otp: { phone, hash: "", exp, tries: 0, admin: true }, demoCode: null };
  }
  if (!env.DEMO_OTP) return { ok: false, error: "Đăng nhập bằng mã OTP đang tắt trên bản này." };
  const code = String(randomInt(1_000_000)).padStart(6, "0");
  return { ok: true, otp: { phone, hash: otpHash(phone, code, exp), exp, tries: 0, admin: false }, demoCode: code };
}

export type VerifyLogin = { ok: true; phone: string; viaPasscode: boolean } | { ok: false; error: string; otp: OtpState | null };

/** Bước 2: tối đa 5 lần sai, hết hạn sau 5 phút. Trả `otp` mới (đã tăng `tries`) hoặc null nếu phải gửi lại mã. */
export function verifyLogin(otp: OtpState | undefined, input: string, now = Date.now()): VerifyLogin {
  if (!otp || now > otp.exp) return { ok: false, error: "Mã đã hết hạn, bạn bấm “Gửi lại mã” nhé.", otp: null };
  if (otp.tries >= OTP_MAX_TRIES) return { ok: false, error: "Bạn đã nhập sai 5 lần, bấm “Gửi lại mã” nhé.", otp: null };
  if (otp.admin && adminLocked(otp.phone, now)) {
    return { ok: false, error: "Sai mã quản trị quá 5 lần, thử lại sau 15 phút.", otp: null };
  }
  const ok = otp.admin
    ? env.ADMIN_PASSCODE !== "" && sameHmac(input, env.ADMIN_PASSCODE)
    : env.DEMO_OTP && sameHmac(otpHash(otp.phone, input.trim(), otp.exp), otp.hash);
  if (ok) {
    adminFailures.delete(otp.phone);
    return { ok: true, phone: otp.phone, viaPasscode: otp.admin };
  }
  if (otp.admin) recordAdminFailure(otp.phone, now);
  const tries = otp.tries + 1;
  if (tries >= OTP_MAX_TRIES) return { ok: false, error: "Bạn đã nhập sai 5 lần, bấm “Gửi lại mã” nhé.", otp: null };
  const what = otp.admin ? "Mã quản trị" : "Mã OTP";
  return { ok: false, error: `${what} chưa đúng, còn ${OTP_MAX_TRIES - tries} lần thử.`, otp: { ...otp, tries } };
}

/**
 * Đăng nhập thành công: lần đầu thì tự tạo tài khoản; mỗi lần đăng nhập gắn các đơn khách vãng lai cùng SĐT
 * vào tài khoản (spec mục 2 — làm mỗi lần thay vì chỉ lần đầu để đơn đặt lúc đã đăng xuất cũng về tài khoản).
 * Tài khoản admin CHỈ vào bằng passcode: đi đường OTP thì trả null (kể cả admin được nâng quyền sau, ở M5).
 */
export async function signIn(phone: string, viaPasscode: boolean): Promise<number | null> {
  const user = await db.user.upsert({
    where: { phone },
    update: {},
    create: { phone, role: viaPasscode ? "admin" : "customer" }, // passcode đúng = chủ shop, kể cả khi chưa seed
    select: { id: true, role: true },
  });
  if (user.role === "admin" && !viaPasscode) return null;
  await db.order.updateMany({ where: { phone, userId: null }, data: { userId: user.id } });
  return user.id;
}
