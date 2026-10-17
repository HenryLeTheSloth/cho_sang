import { useEffect, useRef } from "react";
import { Link } from "react-router";
import { type CollectionQuery, collectionHref } from "~/lib/collection-query";

type Props = {
  categories: { slug: string; name: string }[];
  activeSlug: string;
  query: CollectionQuery;
};

const chip =
  "inline-flex min-h-11 shrink-0 items-center rounded-full border px-4 text-sm whitespace-nowrap transition-colors duration-150 ease-snappy";

export function CategoryChips({ categories, activeSlug, query }: Props) {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    const nav = ref.current;
    const el = nav?.querySelector<HTMLElement>('[aria-current="page"]');
    if (nav && el) nav.scrollLeft = el.offsetLeft - (nav.clientWidth - el.offsetWidth) / 2;
  }, [activeSlug]);
  const all = [{ slug: "all", name: "Tất cả" }, ...categories];
  return (
    <nav ref={ref} aria-label="Danh mục" className="relative -mx-4 flex gap-2 overflow-x-auto px-4 py-2">
      {all.map((c) => {
        const active = c.slug === activeSlug;
        return (
          <Link
            key={c.slug}
            to={collectionHref(`/collections/${c.slug}`, query, {})}
            aria-current={active ? "page" : undefined}
            className={`${chip} ${active ? "border-ink bg-ink text-surface" : "border-line bg-surface hover:border-ink-muted"}`}
          >
            {c.name}
          </Link>
        );
      })}
    </nav>
  );
}
