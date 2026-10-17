import { Check, ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { useRef, useState } from "react";
import { Link } from "react-router";
import type { ProductCardData } from "~/lib/catalog.server";
import { priceFacts } from "~/lib/facts";
import { cutoutSrc } from "~/lib/image-urls";
import { useAddToCart } from "~/lib/use-cart";

/**
 * Kệ hàng ở hero: mỗi trang một món (ảnh tách nền đứng trên mép kệ). Cuộn ngang native nên vuốt được;
 * hai nút trượt đúng một món. Chuột thật: món nghiêng theo con trỏ, rê vào thì hiện thẻ giá và nút thêm.
 * Màn cảm ứng (không có hover): thẻ giá và nút luôn hiện.
 */
export function ProductShelf({ products }: { products: ProductCardData[] }) {
  const track = useRef<HTMLUListElement>(null);
  const [pos, setPos] = useState({ index: 0, atStart: true, atEnd: products.length <= 1 });

  const step = () => {
    const t = track.current!;
    return (t.firstElementChild as HTMLElement).offsetWidth + parseFloat(getComputedStyle(t).columnGap);
  };
  const sync = () => {
    const t = track.current!;
    setPos({
      index: Math.round(t.scrollLeft / step()),
      atStart: t.scrollLeft < 4,
      atEnd: t.scrollLeft + t.clientWidth > t.scrollWidth - 4,
    });
  };
  const slide = (dir: 1 | -1) => track.current?.scrollBy({ left: step() * dir });

  return (
    <section aria-roledescription="carousel" aria-labelledby="shelf-title" className="min-w-0">
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="shelf-title" className="text-2xl">
          Đang có trên kệ
        </h2>
        <p aria-live="polite" className="font-bold text-ink-muted tabular-nums">
          {pos.index + 1} / {products.length}
        </p>
      </div>
      <ul
        ref={track}
        onScroll={sync}
        className="mt-1 grid snap-x snap-mandatory auto-cols-[82%] grid-flow-col gap-3.5 overflow-x-auto overscroll-x-contain scroll-smooth px-0.5 pt-4.5 pb-1.5 [scrollbar-width:none] sm:auto-cols-[46%] lg:auto-cols-[100%]"
      >
        {products.map((p, i) => (
          <li key={p.id} aria-roledescription="slide" aria-label={`${i + 1} / ${products.length}`} className="snap-start">
            <ShelfItem product={p} eager={i < 2} />
          </li>
        ))}
      </ul>
      <div className="mt-2.5 flex gap-2.5">
        {([-1, 1] as const).map((dir) => (
          <button
            key={dir}
            type="button"
            onClick={() => slide(dir)}
            disabled={dir === -1 ? pos.atStart : pos.atEnd}
            aria-label={dir === -1 ? "Món trước" : "Món sau"}
            className="group/nav inline-flex size-12 items-center justify-center rounded-full border-2 border-ink bg-surface transition-[background-color,color,scale,opacity] duration-300 ease-spring hover:scale-105 hover:bg-ink hover:text-surface active:scale-95 disabled:cursor-default disabled:opacity-35 disabled:hover:scale-100 disabled:hover:bg-surface disabled:hover:text-ink"
          >
            {dir === -1 ? (
              <ChevronLeft aria-hidden className="size-6 transition-transform duration-300 ease-spring group-hover/nav:-translate-x-0.5" />
            ) : (
              <ChevronRight aria-hidden className="size-6 transition-transform duration-300 ease-spring group-hover/nav:translate-x-0.5" />
            )}
          </button>
        ))}
      </div>
    </section>
  );
}

function ShelfItem({ product, eager }: { product: ProductCardData; eager: boolean }) {
  const img = useRef<HTMLImageElement>(null);
  const [tilting, setTilting] = useState(false);
  const { qty, canAdd, add } = useAddToCart(product, img);
  const f = priceFacts(product);

  // Nghiêng theo con trỏ: chỉ chuột thật, và không khi người dùng giảm chuyển động
  const tilt = (e: React.PointerEvent<HTMLElement>) => {
    if (e.pointerType !== "mouse" || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const r = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width - 0.5;
    const y = (e.clientY - r.top) / r.height - 0.5;
    img.current?.style.setProperty("--ry", `${x * 28}deg`);
    img.current?.style.setProperty("--rx", `${-y * 18}deg`);
    setTilting(true);
  };
  const untilt = () => {
    img.current?.style.setProperty("--ry", "0deg");
    img.current?.style.setProperty("--rx", "0deg");
    setTilting(false);
  };

  // Lộ ra khi rê/focus trên máy có hover; máy cảm ứng thì luôn hiện
  const reveal = "[@media(hover:hover)]:opacity-0 group-hover:opacity-100 group-focus-within:opacity-100";

  return (
    <article onPointerMove={tilt} onPointerLeave={untilt} className="group relative grid justify-items-center px-2 pt-2 pb-1 text-center">
      {/* Lớp ngoài lo hiện/ẩn, thẻ bên trong lo lắc (carton-tag có transition riêng cho rotate/translate) */}
      <div className={`absolute top-0 left-1 z-10 transition-opacity duration-200 ${reveal}`}>
      <p
        className="carton-tag px-3.5 pt-1.5 pb-2 text-left font-display text-[1.6rem] leading-none font-extrabold text-price tabular-nums -rotate-4 [@media(hover:hover)]:-translate-x-1.5 [@media(hover:hover)]:-translate-y-2 [@media(hover:hover)]:-rotate-[14deg] group-hover:-rotate-4 group-hover:translate-0 group-focus-within:-rotate-4 group-focus-within:translate-0"
      >
        {f.price}
        <small className="mt-0.5 block font-sans text-xs font-normal text-ink-soft">
          {product.unit}
          {f.compareAt && (
            <>
              , giá cũ <s className="decoration-sale decoration-2">{f.compareAt}</s>
            </>
          )}
        </small>
      </p>
      </div>
      {/* Mép kệ (viền dưới) + bóng món trên mặt kệ */}
      <div className="relative grid h-57 w-full place-items-center border-b-3 border-ink [perspective:700px] after:absolute after:bottom-0 after:left-1/2 after:h-4.5 after:w-[62%] after:translate-x-[-50%] after:translate-y-1/2 after:bg-[radial-gradient(closest-side,rgb(31_30_28/0.28),transparent)] after:transition-[width,opacity] after:duration-400 group-hover:after:w-[48%] group-hover:after:opacity-70 lg:h-75">
        <img
          ref={img}
          src={cutoutSrc(product.cutoutUrl!)}
          alt={product.name}
          loading={eager ? "eager" : "lazy"}
          decoding="async"
          className={`max-h-50 w-auto max-w-[92%] object-contain drop-shadow-[0_6px_8px_rgb(31_30_28/0.18)] [transform:rotateX(var(--rx,0deg))_rotateY(var(--ry,0deg))_translateY(var(--lift,0px))_scale(var(--s,1))] transition-transform group-hover:[--lift:-14px] group-hover:[--s:1.06] group-focus-within:[--lift:-14px] group-focus-within:[--s:1.06] lg:max-h-67 ${
            tilting ? "duration-100 ease-linear" : "duration-500 ease-spring"
          }`}
        />
      </div>
      <h3 className="mt-3.5 font-sans text-base font-bold">
        <Link to={`/products/${product.slug}`} prefetch="intent" className="hl-link">
          {product.name}
        </Link>
      </h3>
      <p className="text-sm text-ink-muted">{product.origin}</p>
      <div className={`mt-3 transition-[opacity,translate] duration-450 ease-spring ${reveal} [@media(hover:hover)]:translate-y-2.5 group-hover:translate-y-0 group-focus-within:translate-y-0`}>
      <button type="button" onClick={add} disabled={!canAdd} className="btn-ink inline-flex min-h-11.5 items-center gap-2 px-5.5 font-bold">
        {qty > 0 ? <Check aria-hidden className="size-4.5 stroke-[2.6]" /> : <Plus aria-hidden className="size-4.5 stroke-[2.6]" />}
        {!canAdd ? "Đã đủ số lượng" : qty > 0 ? `Trong giỏ ${qty}, thêm 1` : "Thêm vào giỏ"}
      </button>
      </div>
    </article>
  );
}
