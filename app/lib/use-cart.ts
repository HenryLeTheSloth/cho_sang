import type { RefObject } from "react";
import { useFetcher, useRouteLoaderData } from "react-router";
import type { loader as rootLoader } from "~/root";
import { CART_MAX_QTY } from "./config";
import { flyToCart } from "./fly-to-cart";
import { applyPending, type BundleOp, cartCount, cartFormData, cartTotals, pendingBundleOp, pendingQuantities } from "./cart";

/**
 * Mọi nơi đọc/ghi giỏ đi qua hook này. Một fetcher dùng chung key "cart": lần gửi mới tự huỷ lần trước
 * (trình duyệt bỏ luôn Set-Cookie của lần bị huỷ), nên mỗi lần gửi mang theo MỌI số lượng còn đang chờ.
 * Nhờ vậy bấm nhanh trên nhiều thẻ không mất dòng, và giá trị cuối khớp lần bấm cuối (spike M2, mục 3–4).
 * flushSync: render lại đồng bộ ngay khi submit, để lần bấm sau (dù không chờ) đọc được `pending` mới (spike mục 10).
 * Giỏ quà (M4): hai danh sách `remove`/`add` đang bay cũng được lần gửi sau mang theo, nên bấm + ngay sau
 * khi xoá giỏ quà không làm giỏ quà sống lại.
 */
export function useCart() {
  const cart = useRouteLoaderData<typeof rootLoader>("root")?.cart;
  const serverLines = cart?.lines ?? [];
  const fetcher = useFetcher<{ error: string | null }>({ key: "cart" }); // dữ liệu từ action hoặc clientAction
  const pending = pendingQuantities(fetcher.formData);
  const bundleOp = pendingBundleOp(fetcher.formData); // { remove, add }: mỗi lần gửi mang cả hai (thêm sau bỏ)
  const lines = applyPending(serverLines, pending);
  const bundles = (cart?.bundles ?? []).filter((b) => !bundleOp.remove.includes(b.id) || bundleOp.add.includes(b.id));
  const submit = (quantities: Map<number, number>, op: BundleOp = bundleOp) =>
    fetcher.submit(cartFormData(quantities, op), { method: "post", action: "/cart", flushSync: true });
  return {
    lines,
    bundles,
    count: cartCount(serverLines, pending) + bundles.length,
    totals: cartTotals([...lines, ...bundles]),
    error: fetcher.data?.error ?? null,
    qtyOf: (id: number) => pending.get(id) ?? serverLines.find((l) => l.id === id)?.qty ?? 0,
    setQty: (id: number, qty: number) => submit(new Map(pending).set(id, qty)),
    removeBundle: (id: string) => submit(pending, { remove: [...bundleOp.remove, id], add: bundleOp.add.filter((x) => x !== id) }),
    // Hoàn tác luôn là `add`: thêm sau bỏ nên idempotent dù lệnh xoá đã về hay còn bay (không đoán theo fetcher.state).
    restoreBundle: (id: string) => submit(pending, { remove: bundleOp.remove.filter((x) => x !== id), add: [...bundleOp.add, id] }),
  };
}

/**
 * Thêm/bớt một món từ bất kỳ chỗ nào (bảng giá, kệ hàng, thẻ, drawer, trang sản phẩm). Mỗi chỗ tự vẽ nút;
 * hành vi (giới hạn kho, ảnh bay vào giỏ, badge nảy) chỉ nằm ở đây.
 * `flyFrom`: ảnh cạnh nút để bay vào giỏ ở lần thêm đầu tiên; không có thì chỉ badge nảy.
 */
export function useAddToCart(product: { id: number; stock: number }, flyFrom?: RefObject<HTMLImageElement | null>) {
  const { qtyOf, setQty } = useCart();
  const qty = qtyOf(product.id);
  const max = Math.min(CART_MAX_QTY, product.stock);
  const set = (next: number) => {
    // trước setQty: --bump-delay phải có trước khi header ép reflow cho badge nảy
    if (qty === 0 && next > 0 && flyFrom?.current) flyToCart(flyFrom.current);
    void setQty(product.id, next);
  };
  return { qty, max, soldOut: product.stock === 0, canAdd: qty < max, set, add: () => set(qty + 1) };
}
