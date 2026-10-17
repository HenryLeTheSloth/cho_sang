import { createCookieSessionStorage, redirect, type Session } from "react-router";
import { db } from "./db.server";
import { env } from "./env.server";

/** OTP đang chờ nhập. `hash` = HMAC(SESSION_SECRET) của sđt + mã + hạn, nên đọc được cookie cũng không dò ra mã. */
export type OtpState = { phone: string; hash: string; exp: number; tries: number; admin: boolean };
type SessionData = { userId: number; guestOrderCodes: string[]; otp: OtpState };
type FlashData = { toast: string };
export type AppSession = Session<SessionData, FlashData>;

/** Cookie `__session` (spec mục 5): 30 ngày, httpOnly, lax, Secure ở production, ký bằng cùng SESSION_SECRET với `cart`. */
export const sessionStorage = createCookieSessionStorage<SessionData, FlashData>({
  cookie: {
    name: "__session",
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    secure: env.COOKIE_SECURE,
    maxAge: 60 * 60 * 24 * 30,
    secrets: [env.SESSION_SECRET],
  },
});

export const getSession = (request: Request) => sessionStorage.getSession(request.headers.get("Cookie"));
export const commitSession = (session: AppSession) => sessionStorage.commitSession(session);

const MAX_GUEST_CODES = 20; // cookie ≤4KB: 20 mã × 12 ký tự là đủ cho khách vãng lai

/** Khách vãng lai xem lại được đơn của mình nhờ mã đơn nằm trong phiên (mới nhất đứng đầu). */
export function addGuestOrder(session: AppSession, code: string) {
  const codes = session.get("guestOrderCodes") ?? [];
  session.set("guestOrderCodes", [code, ...codes.filter((c) => c !== code)].slice(0, MAX_GUEST_CODES));
}

/** Chống IDOR: chỉ chủ tài khoản của đơn, hoặc phiên đã đặt/đã tra đúng mã + SĐT, mới xem/thao tác được đơn. */
export function canViewOrder(session: AppSession, order: { code: string; userId: number | null }): boolean {
  const userId = session.get("userId");
  return (userId !== undefined && order.userId === userId) || (session.get("guestOrderCodes") ?? []).includes(order.code);
}

/** User đang đăng nhập; userId trỏ tới tài khoản đã bị xoá thì coi như chưa đăng nhập. */
export async function getUser(session: AppSession) {
  const id = session.get("userId");
  return id === undefined ? null : db.user.findUnique({ where: { id }, select: { id: true, phone: true, name: true, role: true } });
}

/** Cho layout /admin của M5: chưa đăng nhập → /login; customer → 403. */
export async function requireAdmin(request: Request) {
  const user = await getUser(await getSession(request));
  if (!user) {
    const url = new URL(request.url);
    throw redirect(`/login?redirectTo=${encodeURIComponent(url.pathname + url.search)}`);
  }
  if (user.role !== "admin") throw new Response("Bạn không có quyền vào trang quản trị.", { status: 403 });
  return user;
}
