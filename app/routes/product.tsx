import { ChevronLeft, ShieldCheck } from "lucide-react";
import { useRef } from "react";
import { data, Link } from "react-router";
import { CartControl } from "~/components/cart-control";
import { ProductImage } from "~/components/product-image";
import { getProduct } from "~/lib/catalog.server";
import { priceFacts, productFacts } from "~/lib/facts";
import type { Route } from "./+types/product";

export async function loader({ params }: Route.LoaderArgs) {
  const product = await getProduct(params.slug);
  if (!product) throw data(null, { status: 404 });
  return { product };
}

export default function Product({ loaderData }: Route.ComponentProps) {
  const { product } = loaderData;
  const img = useRef<HTMLImageElement>(null);
  const f = priceFacts(product);

  return (
    <main className="mx-auto max-w-6xl px-4 py-6">
      <title>{`${product.name} · Chợ Sáng`}</title>
      <meta name="description" content={product.description} />
      <Link
        to={`/collections/${product.category.slug}`}
        className="hl-link inline-flex min-h-11 items-center gap-1 text-sm text-ink-muted hover:text-ink"
      >
        <ChevronLeft aria-hidden className="size-4" />
        {product.category.name}
      </Link>

      <div className="mt-2 grid gap-6 md:grid-cols-2 md:gap-10">
        <div className="-mx-4 flex items-start snap-x snap-mandatory gap-3 overflow-x-auto px-4 md:mx-0 md:grid md:overflow-visible md:px-0">
          {product.images.map((image, i) => (
            <figure key={image} className={`${product.images.length === 1 ? "w-full" : "w-[85%]"} shrink-0 snap-center overflow-hidden rounded-2xl bg-surface md:w-full`}>
              <ProductImage
                ref={i === 0 ? img : undefined}
                image={image}
                alt={i === 0 ? product.name : `${product.name}, bổ đôi`}
                sizes="(min-width: 768px) 560px, 85vw"
                priority={i === 0}
              />
              {i === 1 && <figcaption className="px-3 py-2 text-sm text-ink-muted">Ảnh bổ đôi: xem ruột trước khi mua</figcaption>}
            </figure>
          ))}
        </div>

        <div className="space-y-4">
          <div>
            <h1 className="text-3xl">{product.name}</h1>
            <p className="mt-1 flex flex-wrap items-center gap-2 text-ink-muted">
              {product.unit}
              <span className={`inline-flex rounded-full px-3 py-1 text-sm ${f.stock.state === "out" ? "bg-ink/10 text-ink" : "bg-fresh-tint text-fresh"}`}>
                {f.stock.label}
              </span>
            </p>
          </div>

          <div>
            <p className="flex flex-wrap items-baseline gap-x-3">
              <span className={`font-display text-4xl font-extrabold tabular-nums ${f.compareAt ? "text-sale" : "text-price"}`}>{f.price}</span>
              {f.compareAt && <s className="text-ink-muted tabular-nums decoration-sale decoration-2">{f.compareAt}</s>}
            </p>
            {f.perKg && <p className="text-sm text-ink-muted tabular-nums">{f.perKg}</p>}
            {f.weighedNote && <p className="text-sm text-ink-muted">{f.weighedNote}</p>}
          </div>

          <dl className="divide-y divide-line rounded-2xl border border-line bg-surface">
            {productFacts(product).map(({ label, value }) => (
              <div key={label} className="flex gap-4 px-4 py-3 text-sm">
                <dt className="w-24 shrink-0 text-ink-muted">{label}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>

          <Link
            to="/contact"
            className="flex min-h-11 items-center gap-3 rounded-2xl border border-line bg-surface p-4 transition-colors duration-150 ease-snappy hover:border-ink"
          >
            <ShieldCheck aria-hidden className="size-6 shrink-0 text-fresh" />
            <span>
              <strong className="font-display font-extrabold">Hỏng, héo đổi mới trong 24h.</strong>{" "}
              <span className="text-ink-muted">Chụp ảnh gửi Zalo, chúng tôi đổi ngay.</span>
            </span>
          </Link>

          <p className="leading-relaxed">{product.description}</p>
        </div>
      </div>

      {/* Dính đáy khi cuộn; nằm trong luồng ở cuối <main> nên cuộn hết thì không che nội dung nào */}
      <section
        aria-label="Mua hàng"
        className="sticky bottom-0 z-20 -mx-4 mt-6 flex items-center justify-between gap-3 border-t border-line bg-surface/95 px-4 py-2 backdrop-blur md:mx-0 md:rounded-2xl md:border"
      >
        <p className="min-w-0">
          <span className={`font-display text-2xl font-extrabold tabular-nums ${f.compareAt ? "text-sale" : "text-price"}`}>{f.price}</span>{" "}
          <span className="text-sm text-ink-muted">{`/ ${product.unit}`}</span>
        </p>
        <CartControl product={product} flyFrom={img} addLabel="Thêm vào giỏ" />
      </section>
    </main>
  );
}
