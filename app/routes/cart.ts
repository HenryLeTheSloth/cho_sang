import { data } from "react-router";
import { cartCount, cartTotals } from "~/lib/cart";
import { cartCookie, getCartView, parseBundleForm, parseCartForm, readCart, setBundles, setQuantities } from "~/lib/cart.server";
import { CART_MAX_BUNDLES, CART_MAX_LINES } from "~/lib/config";
import { readForm } from "~/lib/security.server";
import type { Route } from "./+types/cart";

// Resource route (không có component). Drawer đọc giỏ từ root loader; loader này cho M3/M4 và kiểm tra DoD.
export async function loader({ request }: Route.LoaderArgs) {
  const { lines, bundles } = await getCartView(await readCart(request));
  return { lines, bundles, count: cartCount(lines, new Map()) + bundles.length, ...cartTotals([...lines, ...bundles]) };
}

/**
 * intent `set` (qty tuyệt đối, 0 = xoá), `remove`, `bundle` (spec mục 5). Mọi lần gửi có thể mang cả cặp pid/qty lẫn
 * `bundleRemove`/`bundleAdd` (bỏ trước, thêm sau). "Hoàn tác" = `set` lại qty cũ, hoặc `bundleAdd` lại id giỏ quà.
 */
export async function action({ request }: Route.ActionArgs) {
  const form = await readForm(request); // chặn POST từ trang khác + giới hạn body
  const changes = parseCartForm(form);
  const bundleOp = parseBundleForm(form);
  if (!changes || !bundleOp) return data({ error: "Yêu cầu không hợp lệ, bạn tải lại trang giúp mình nhé." }, { status: 400 });
  const next = setQuantities(await readCart(request), changes);
  if (!next) return data({ error: `Giỏ hàng chỉ chứa tối đa ${CART_MAX_LINES} món khác nhau.` }, { status: 400 });
  const withBundles = await setBundles(next, bundleOp);
  if (!withBundles) return data({ error: `Giỏ hàng chỉ chứa tối đa ${CART_MAX_BUNDLES} giỏ quà.` }, { status: 400 });
  return data({ error: null }, { headers: { "Set-Cookie": await cartCookie.serialize(withBundles) } });
}

/**
 * Mất mạng khi bấm: trả lời nhắn thay vì để ErrorBoundary của root thay cả trang (spike M2, mục 12).
 * Status ≥400 để RR bỏ qua revalidate (revalidate lúc mất mạng cũng sẽ hỏng); UI optimistic tự quay về.
 */
export async function clientAction({ serverAction }: Route.ClientActionArgs) {
  try {
    return await serverAction();
  } catch {
    return data({ error: "Mất kết nối, bạn thử lại giúp mình nhé." }, { status: 503 });
  }
}
