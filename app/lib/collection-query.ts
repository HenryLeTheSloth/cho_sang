import { MAX_PAGE } from "./config";

export const SORTS = {
  relevant: "Phù hợp",
  "price-asc": "Giá tăng dần",
  "price-desc": "Giá giảm dần",
  new: "Mới về",
} as const;
export type Sort = keyof typeof SORTS;

export type CollectionQuery = { q: string; sort: Sort; inStock: boolean; page: number };

const isSort = (s: string | null): s is Sort => s !== null && Object.hasOwn(SORTS, s);

export function parseCollectionQuery(params: URLSearchParams): CollectionQuery {
  const page = Math.trunc(Number(params.get("page")));
  const sort = params.get("sort");
  return {
    q: (params.get("q") ?? "").trim().slice(0, 80),
    sort: isSort(sort) ? sort : "relevant",
    inStock: params.get("instock") === "1",
    page: Number.isFinite(page) ? Math.min(Math.max(page, 1), MAX_PAGE) : 1,
  };
}

/** URL cho một trạng thái lọc; đổi bất cứ gì ngoài `page` thì về trang 1. Bỏ giá trị mặc định cho URL gọn. */
export function collectionHref(path: string, query: CollectionQuery, patch: Partial<CollectionQuery> = {}) {
  const next = { ...query, page: "page" in patch ? query.page : 1, ...patch };
  const params = new URLSearchParams();
  if (next.q) params.set("q", next.q);
  if (next.sort !== "relevant") params.set("sort", next.sort);
  if (next.inStock) params.set("instock", "1");
  if (next.page > 1) params.set("page", String(next.page));
  const qs = params.toString();
  return qs ? `${path}?${qs}` : path;
}
