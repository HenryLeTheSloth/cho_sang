import { redirect } from "react-router";
import { readForm, safeRedirect } from "~/lib/security.server";
import { commitSession, sessionStorage } from "~/lib/session.server";
import type { Route } from "./+types/logout";

// Chỉ có action POST (GET không có loader nên RR trả lỗi): đăng xuất bằng link/ảnh từ trang khác là không được.
export async function action({ request }: Route.ActionArgs) {
  const form = await readForm(request);
  // Phiên mới: quên userId, OTP và mã đơn khách (máy dùng chung). Cookie `cart` riêng nên giỏ vẫn còn.
  const fresh = await sessionStorage.getSession();
  fresh.flash("toast", "Đã đăng xuất");
  return redirect(safeRedirect(form.get("redirectTo")), { headers: { "Set-Cookie": await commitSession(fresh) } });
}
