import { Check } from "lucide-react";
import { data, Link } from "react-router";
import { CategoryChips } from "~/components/category-chips";
import { ProductCard } from "~/components/product-card";
import { listCategories, listProducts } from "~/lib/catalog.server";
import { collectionHref, parseCollectionQuery, type Sort, SORTS } from "~/lib/collection-query";
import type { Route } from "./+types/collection";

export async function loader({ params, request }: Route.LoaderArgs) {
  const query = parseCollectionQuery(new URL(request.url).searchParams);
  const categories = await listCategories();
  const category = params.slug === "all" ? null : categories.find((c) => c.slug === params.slug);
  if (category === undefined) throw data(null, { status: 404 });
  const { products, hasMore } = await listProducts(query, category?.id ?? null);
  return { slug: params.slug, query, categories, category, products, hasMore };
}

const pill =
  "inline-flex min-h-11 shrink-0 items-center gap-1 rounded-full px-3 text-sm whitespace-nowrap transition-colors duration-150 ease-snappy";

export default function Collection({ loaderData }: Route.ComponentProps) {
  const { slug, query, categories, category, products, hasMore } = loaderData;
  const path = `/collections/${slug}`;
  const heading = query.q ? `Kết quả cho “${query.q}”` : (category?.name ?? "Tất cả sản phẩm");

  return (
    <main className="mx-auto max-w-6xl px-4 py-6">
      <title>{`${heading} · Chợ Sáng`}</title>
      <h1 className="text-3xl">{heading}</h1>
      <CategoryChips categories={categories} activeSlug={slug} query={query} />

      <nav aria-label="Sắp xếp và lọc" className="-mx-4 flex gap-1 overflow-x-auto px-4 pb-3">
        <Link
          to={collectionHref(path, query, { inStock: !query.inStock })}
          aria-current={query.inStock ? "true" : undefined}
          preventScrollReset
          className={`${pill} border ${query.inStock ? "border-fresh bg-fresh-tint text-fresh" : "border-line text-ink-muted hover:text-ink"}`}
        >
          {query.inStock && <Check aria-hidden className="size-4" />}
          Còn hàng
        </Link>
        {(Object.keys(SORTS) as Sort[]).map((s) => (
          <Link
            key={s}
            to={collectionHref(path, query, { sort: s })}
            aria-current={query.sort === s ? "true" : undefined}
            preventScrollReset
            className={`${pill} ${query.sort === s ? "bg-ink/10" : "text-ink-muted hover:text-ink"}`}
          >
            {SORTS[s]}
          </Link>
        ))}
      </nav>

      {products.length === 0 ? (
        <div className="rounded-2xl border border-line bg-surface p-8 text-center">
          <h2 className="text-lg">Chưa có sản phẩm khớp bộ lọc.</h2>
          <p className="mt-1 text-ink-muted">Thử bỏ bớt bộ lọc hoặc gõ tên ngắn hơn, ví dụ “trứng”, “rau”.</p>
          <Link
            to={path}
            className="btn-cta mt-4 inline-flex min-h-11 items-center px-5 font-display font-extrabold"
          >
            Bỏ bộ lọc
          </Link>
        </div>
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {products.map((p, i) => (
            <li key={p.id}>
              <ProductCard product={p} priority={i === 0} />
            </li>
          ))}
        </ul>
      )}

      {hasMore && (
        <div className="mt-6 text-center">
          <Link
            to={collectionHref(path, query, { page: query.page + 1 })}
            preventScrollReset
            className="inline-flex min-h-11 items-center rounded-full border border-ink px-6 font-display font-extrabold hover:bg-ink hover:text-surface"
          >
            Xem thêm
          </Link>
        </div>
      )}
    </main>
  );
}
