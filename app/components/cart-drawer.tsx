import { Gift, Trash2, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link, useLocation, useRouteLoaderData } from "react-router";
import { type CartLine, cartTotals } from "~/lib/cart";
import { stockState } from "~/lib/facts";
import { formatVnd } from "~/lib/format";
import { previewUrl } from "~/lib/gift";
import { useCart } from "~/lib/use-cart";
import type { loader as rootLoader } from "~/root";
import { CartControl } from "./cart-control";
import { FreeshipBasket } from "./freeship-basket";
import { ProductImage } from "./product-image";

const UNDO_MS = 5000;

/** Drawer giỏ: <dialog> gốc, showModal() cho sẵn focus trap + Esc. Mở từ nút #cart-button ở header. */
export function CartDrawer() {
  const ref = useRef<HTMLDialogElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const { lines, bundles, count, totals, error, setQty, removeBundle, restoreBundle } = useCart();
  const suggestions = useRouteLoaderData<typeof rootLoader>("root")?.suggestions ?? []; // chỉ có khi giỏ trống
  // Hoàn tác: dòng thường đặt lại qty cũ; giỏ quà thêm lại id (cùng layout, cùng ảnh, giá đọc lại)
  const [undo, setUndo] = useState<({ name: string } & ({ id: number; qty: number } | { bundleId: string })) | null>(null);
  const location = useLocation();
  const empty = lines.length + bundles.length === 0;
  const free = !empty && totals.toFreeshipVnd === 0;
  const close = () => ref.current?.close();

  // Bấm link trong drawer (tên món, "Xem sản phẩm", "Thanh toán") thì đóng khi trang mới về
  useEffect(() => {
    ref.current?.close();
  }, [location.key]);

  useEffect(() => {
    if (!undo) return;
    const timer = setTimeout(() => setUndo(null), UNDO_MS);
    return () => clearTimeout(timer);
  }, [undo]);

  const remove = (line: CartLine) => {
    setUndo({ id: line.id, name: line.name, qty: line.qty });
    void setQty(line.id, 0);
  };

  return (
    <dialog
      ref={ref}
      id="cart-drawer"
      aria-labelledby="cart-drawer-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) close(); // bấm vào nền mờ
      }}
      className="fixed inset-y-0 right-0 left-auto m-0 h-dvh max-h-none w-full max-w-md translate-x-full overflow-hidden bg-surface p-0 text-ink transition-[translate,overlay,display] duration-150 ease-snappy transition-discrete backdrop:bg-ink/40 open:translate-x-0 open:duration-200 starting:open:translate-x-full"
    >
      <div className="relative flex h-full flex-col">
        <div className="flex items-center justify-between border-b border-line py-1 pr-2 pl-4">
          <h2 id="cart-drawer-title" ref={titleRef} tabIndex={-1} className="text-xl focus-visible:outline-offset-[-2px]">
            Giỏ hàng{count > 0 && ` (${count})`}
          </h2>
          <button
            type="button"
            onClick={close}
            aria-label="Đóng giỏ hàng"
            className="btn-icon inline-flex size-11 items-center justify-center focus-visible:outline-offset-[-2px]"
          >
            <X aria-hidden className="size-6" />
          </button>
        </div>

        {error && (
          <p role="alert" className="mx-4 mt-3 rounded-xl bg-ink/5 px-3 py-2 text-sm">
            {error}
          </p>
        )}

        {empty ? (
          // Giỏ trống: rổ thương hiệu ở 0% + 3 món khuyến mãi có nút + (quyết định Designer ở cổng M2)
          <div className="flex flex-1 flex-col overflow-y-auto">
            <FreeshipBasket totals={cartTotals([])} />
            <h3 className="px-4 pt-4 text-lg">Giỏ hàng đang trống</h3>
            {suggestions.length > 0 && (
              <>
                <p className="px-4 text-sm text-ink-muted">Khuyến mãi hôm nay, bấm + để thêm ngay:</p>
                <ul className="divide-y divide-line px-4">
                  {suggestions.map((p) => (
                    <li key={p.id} className="flex items-center gap-3 py-3">
                      <div className="w-16 shrink-0 overflow-hidden rounded-xl border border-line">
                        <ProductImage image={p.images[0]} alt="" sizes="64px" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <Link to={`/products/${p.slug}`} className="hl-link line-clamp-2 text-sm">
                          {p.name}
                        </Link>
                        <p className="text-xs text-ink-muted">
                          {p.unit} · <span className="font-display font-extrabold text-price tabular-nums">{formatVnd(p.priceVnd)}</span>
                        </p>
                      </div>
                      <CartControl product={p} />
                    </li>
                  ))}
                </ul>
              </>
            )}
            <Link
              to="/collections/all"
              className="hl-link mx-auto my-4 inline-flex min-h-11 items-center text-sm font-bold"
            >
              Xem tất cả sản phẩm
            </Link>
          </div>
        ) : (
          <>
            <FreeshipBasket totals={totals} />
            <ul className="flex-1 divide-y divide-line overflow-y-auto px-4">
              {bundles.map((b) => (
                <li key={b.id} className="flex gap-3 py-3">
                  {/* Ảnh xem trước tạo ở /gift: drawer chỉ hiện <img>, không tải Fabric (spec mục 2) */}
                  <img
                    src={previewUrl(b.id)}
                    alt=""
                    width={64}
                    height={64}
                    loading="lazy"
                    className={`size-16 shrink-0 self-start rounded-xl border border-line bg-surface object-cover ${b.stock === 0 ? "opacity-60 grayscale" : ""}`}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-1.5 text-sm">
                      <Gift aria-hidden className="size-4 shrink-0 text-ink-muted" />
                      Giỏ quà · {b.itemCount} món
                    </p>
                    {b.message && <p className="line-clamp-1 text-xs text-ink-muted">“{b.message}”</p>}
                    {b.stock === 0 && <p className="text-xs text-ink-muted">{`${stockState(0).label}: ${b.shortNames.join(", ")}, không tính vào tổng`}</p>}
                    <p className={`mt-1 font-display font-extrabold tabular-nums ${b.stock === 0 ? "text-ink-muted line-through" : "text-price"}`}>{formatVnd(b.priceVnd)}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setUndo({ bundleId: b.id, name: `giỏ quà ${b.itemCount} món` });
                      void removeBundle(b.id);
                    }}
                    aria-label={`Xoá giỏ quà ${b.itemCount} món khỏi giỏ`}
                    className="inline-flex size-11 shrink-0 items-center justify-center rounded-full text-ink-muted transition-colors duration-150 ease-snappy hover:bg-cta hover:text-ink hover:text-ink"
                  >
                    <Trash2 aria-hidden className="size-5" />
                  </button>
                </li>
              ))}
              {lines.map((line) => (
                <li key={line.id} className="flex gap-3 py-3">
                  <div className={`w-16 shrink-0 self-start overflow-hidden rounded-xl border border-line ${line.stock === 0 ? "opacity-60 grayscale" : ""}`}>
                    <ProductImage image={line.image} alt="" sizes="64px" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <Link to={`/products/${line.slug}`} className="hl-link line-clamp-2 text-sm">
                      {line.name}
                    </Link>
                    <p className="text-xs text-ink-muted tabular-nums">
                      {line.unit} · {formatVnd(line.priceVnd)}
                    </p>
                    {line.stock === 0 && <p className="text-xs text-ink-muted">{stockState(0).label}, không tính vào tổng</p>}
                    {/* flex-wrap: ở 375px stepper (≈128px) + tiền dòng ≥ "1.000.000₫" không vừa ≈211px */}
                    <div className="mt-1 flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
                      <CartControl product={line} min={1} />
                      <p className={`font-display font-extrabold tabular-nums ${line.stock === 0 ? "text-ink-muted line-through" : "text-price"}`}>{formatVnd(line.priceVnd * line.qty)}</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => remove(line)}
                    aria-label={`Xoá ${line.name} khỏi giỏ`}
                    className="inline-flex size-11 shrink-0 items-center justify-center rounded-full text-ink-muted transition-colors duration-150 ease-snappy hover:bg-cta hover:text-ink hover:text-ink"
                  >
                    <Trash2 aria-hidden className="size-5" />
                  </button>
                </li>
              ))}
            </ul>
            <div className="order-2 space-y-1 border-t border-line p-4 text-sm">
              <p className="flex justify-between">
                <span>Tạm tính</span>
                <span className="tabular-nums">{formatVnd(totals.subtotalVnd)}</span>
              </p>
              <p className="flex justify-between">
                <span>Phí giao hàng</span>
                <span className={`tabular-nums ${free ? "font-display font-extrabold text-fresh" : ""}`}>{totals.shippingVnd === 0 ? "Miễn phí" : formatVnd(totals.shippingVnd)}</span>
              </p>
              {/* /checkout do M3 làm: trong M2 link này ra trang 404 (đã chấp nhận) */}
              <Link
                to="/checkout"
                className="btn-cta mt-3 flex min-h-12 items-center justify-center px-6 text-base font-display font-extrabold"
              >
                Thanh toán · <span className="ml-1 tabular-nums">{formatVnd(totals.totalVnd)}</span>
              </Link>
            </div>
          </>
        )}
        {/* Luôn mount (role=status). order-1 chen giữa danh sách và khối tổng tiền (order-2): trong tầm ngón cái, không che dòng freeship */}
        <div role="status" className="pointer-events-none relative z-10 order-1">
          {undo && (
            <p className="pointer-events-auto absolute inset-x-4 bottom-2 flex items-center justify-between gap-2 rounded-full bg-ink py-0.5 pr-1 pl-4 text-sm text-surface shadow-lg">
              <span className="min-w-0 truncate">Đã xoá {undo.name}</span>
              <button
                type="button"
                autoFocus
                onClick={() => {
                  void ("bundleId" in undo ? restoreBundle(undo.bundleId) : setQty(undo.id, undo.qty));
                  setUndo(null);
                  titleRef.current?.focus(); // nút Hoàn tác biến mất: đưa focus về tiêu đề drawer
                }}
                className="min-h-11 shrink-0 rounded-full px-3 font-display font-extrabold underline underline-offset-2 transition-colors duration-150 ease-snappy hover:bg-surface/10"
              >
                Hoàn tác
              </button>
            </p>
          )}
        </div>
      </div>
    </dialog>
  );
}
