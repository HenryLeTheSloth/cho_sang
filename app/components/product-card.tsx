import { useRef } from "react";
import { Link } from "react-router";
import type { ProductCardData } from "~/lib/catalog.server";
import { priceFacts } from "~/lib/facts";
import { CartControl } from "./cart-control";
import { ProductImage } from "./product-image";

// Thẻ giá ghim lệch mỗi thẻ một chút cho giống tay người ghim; theo id nên SSR và client khớp nhau
const TILTS = ["-rotate-3", "rotate-2", "-rotate-1"];

const STOCK_TONE = { in: "font-bold text-fresh", low: "font-bold text-ink", out: "text-ink-muted" };

export function ProductCard({ product, priority = false }: { product: ProductCardData; priority?: boolean }) {
  const img = useRef<HTMLImageElement>(null);
  const f = priceFacts(product);
  const out = f.stock.state === "out";

  return (
    <article className="group relative flex h-full flex-col">
      <div className="relative">
        <div className="overflow-hidden rounded-2xl bg-surface">
          <ProductImage
            ref={img}
            image={product.images[0]}
            alt={product.name}
            sizes="(min-width: 1024px) 270px, (min-width: 640px) calc(33vw - 24px), calc(50vw - 30px)"
            priority={priority}
            className={`transition-transform duration-500 ease-out-expo group-hover:-translate-y-1 ${out ? "opacity-60 grayscale" : ""}`}
          />
        </div>
        {f.discountPct > 0 && !out && (
          <span className="absolute top-2 right-2 rounded-full bg-cta px-2.5 py-0.5 text-sm font-extrabold tabular-nums">−{f.discountPct}%</span>
        )}
        <span
          className={`carton-tag absolute -bottom-3.5 left-1.5 px-3 pt-1 pb-1.5 font-display text-xl leading-tight font-extrabold text-price tabular-nums ${TILTS[product.id % 3]} ${
            out ? "" : "group-hover:translate-y-[-2px] group-hover:rotate-3 group-hover:bg-cta"
          }`}
        >
          {f.price}
        </span>
      </div>
      <div className="flex flex-1 flex-col gap-0.5 pt-6">
        <h3 className="font-sans text-base leading-snug font-bold">
          {/* ::after phủ cả thẻ: ảnh + tên bấm được, nút giỏ (z-10) nằm trên lớp phủ */}
          <Link
            to={`/products/${product.slug}`}
            prefetch="intent"
            className="hl-link after:absolute after:inset-0 after:rounded-2xl group-hover:bg-size-[100%_38%] focus-visible:outline-none focus-visible:after:outline-3 focus-visible:after:outline-offset-3 focus-visible:after:outline-ink"
          >
            {product.name}
          </Link>
        </h3>
        {/* Spec mục 3: thẻ phải có đơn vị + nguồn gốc */}
        <p className="text-sm leading-snug text-ink-muted">
          {product.unit}
          <br />
          {product.origin}
        </p>
        <div className="mt-auto flex flex-wrap items-end justify-between gap-2 pt-2">
          <p className="min-w-0 text-sm">
            <span className={`block ${STOCK_TONE[f.stock.state]}`}>{f.stock.label}</span>
            {(f.perKg || f.compareAt) && (
              <span className="block text-xs text-ink-muted tabular-nums">
                {f.perKg}
                {f.perKg && f.compareAt && ", "}
                {f.compareAt && <s className="decoration-sale decoration-2">{f.compareAt}</s>}
              </span>
            )}
          </p>
          <CartControl product={product} flyFrom={img} />
        </div>
      </div>
    </article>
  );
}
