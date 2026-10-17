import { Search, ShoppingBasket, UserRound } from "lucide-react";
import { useEffect, useRef } from "react";
import { Form, Link, useLocation, useRouteLoaderData, useSearchParams } from "react-router";
import { useCart } from "~/lib/use-cart";
import type { loader as rootLoader } from "~/root";

export function SiteHeader() {
  const [params] = useSearchParams();
  const q = params.get("q") ?? "";
  const { count, error } = useCart();
  const root = useRouteLoaderData<typeof rootLoader>("root");
  const user = root?.user ?? null;
  const categories = root?.categories ?? [];
  const { pathname, search } = useLocation();
  const badgeRef = useRef<HTMLSpanElement>(null);
  const prevCount = useRef(count);

  // Badge nảy mỗi khi số món tăng (cùng ảnh bay là khoảnh khắc đặc trưng duy nhất, spec mục 4)
  useEffect(() => {
    const badge = badgeRef.current;
    if (badge && count > prevCount.current) {
      badge.classList.remove("cart-bump");
      void badge.offsetWidth; // ép reflow để animation CSS chạy lại
      badge.classList.add("cart-bump");
    }
    prevCount.current = count;
  }, [count]);

  return (
    <header className="sticky top-0 z-30 border-b border-line bg-surface">
      {/* Mobile: logo + icon một hàng, ô tìm kiếm cả hàng dưới. Desktop: một hàng + thanh danh mục */}
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-2 gap-y-1 px-4 pt-2 pb-2.5 md:flex-nowrap md:gap-4 md:py-3">
        <Link
          to="/"
          className="mr-auto inline-flex min-h-11 -rotate-2 items-center bg-kraft px-3.5 pt-1 pb-1.5 font-display text-2xl leading-tight font-extrabold text-ink transition-[rotate,scale,background-color] duration-300 ease-spring [clip-path:polygon(2%_6%,30%_0%,64%_5%,98%_1%,100%_52%,97%_96%,62%_100%,28%_94%,1%_100%,0%_50%)] hover:scale-105 hover:rotate-1 hover:bg-cta md:mr-0 md:text-[1.7rem]"
        >
          Chợ Sáng
        </Link>
        <Form method="get" action="/collections/all" role="search" className="relative order-3 min-w-0 basis-full md:order-none md:basis-auto md:flex-1">
          <label htmlFor="site-search" className="sr-only">
            Tìm sản phẩm
          </label>
          <Search
            aria-hidden
            className="pointer-events-none absolute top-1/2 left-3.5 size-5 -translate-y-1/2 text-ink-muted"
          />
          <input
            key={q}
            id="site-search"
            name="q"
            type="search"
            defaultValue={q}
            placeholder="Tìm món, gõ không dấu cũng ra"
            autoComplete="off"
            enterKeyHint="search"
            className="h-12 w-full rounded-full border-2 border-transparent bg-bg pr-4 pl-11 text-base transition-colors duration-150 ease-snappy placeholder:text-ink-muted hover:border-line focus:border-ink focus:bg-surface focus:outline-none"
          />
        </Form>
        <Link
          to={user ? "/orders" : `/login?redirectTo=${encodeURIComponent(pathname + search)}`}
          aria-label={user ? "Tài khoản và đơn hàng" : "Đăng nhập"}
          className="btn-icon inline-flex size-11 shrink-0 items-center justify-center"
        >
          <UserRound aria-hidden className="size-6" />
        </Link>
        <button
          id="cart-button"
          type="button"
          onClick={() => document.querySelector<HTMLDialogElement>("#cart-drawer")?.showModal()}
          aria-label={`Giỏ hàng, ${count} món`}
          className="btn-icon inline-flex size-11 shrink-0 items-center justify-center"
        >
          <ShoppingBasket aria-hidden className="size-6" />
          {count > 0 && (
            <span
              ref={badgeRef}
              className="absolute -top-0.5 -right-1 inline-flex h-5.5 min-w-5.5 items-center justify-center rounded-full border-2 border-surface bg-cta px-1 text-xs font-extrabold text-ink tabular-nums"
            >
              {count > 99 ? "99+" : count}
            </span>
          )}
        </button>
      </div>
      <nav aria-label="Danh mục" className="mx-auto hidden max-w-6xl gap-5 overflow-x-auto px-4 pb-1.5 font-semibold whitespace-nowrap md:flex">
        {categories.map((c) => (
          <Link key={c.slug} to={`/collections/${c.slug}`} className="hl-link py-2.5">
            {c.name}
          </Link>
        ))}
        <Link to="/gift" className="hl-link py-2.5">
          Giỏ quà biếu
        </Link>
      </nav>
      {/* Lỗi thao tác giỏ (mất mạng, quá 50 món): thấy được cả khi drawer đóng; mất ở lần gửi thành công kế tiếp */}
      {error && (
        <p role="alert" className="border-t border-line bg-surface px-4 py-2 text-center text-sm">
          {error}
        </p>
      )}
    </header>
  );
}
