import type { Prisma } from "~/generated/prisma/client";
import type { CollectionQuery } from "./collection-query";
import { PAGE_SIZE } from "./config";
import { db } from "./db.server";
import { toSearch } from "./format";

export const productCardSelect = {
  id: true,
  slug: true,
  name: true,
  unit: true,
  priceVnd: true,
  compareAtVnd: true,
  netGrams: true,
  origin: true,
  stock: true,
  isWeighed: true,
  images: true,
  cutoutUrl: true,
} satisfies Prisma.ProductSelect;

export type ProductCardData = Prisma.ProductGetPayload<{ select: typeof productCardSelect }>;

/** Thẻ + bảng thông tin (nguồn gốc, hạn dùng, bảo quản): cho khối "đọc một bảng giá" trên trang chủ. */
export const productFactsSelect = { ...productCardSelect, shelfLife: true, storage: true } satisfies Prisma.ProductSelect;

export type ProductFactsData = Prisma.ProductGetPayload<{ select: typeof productFactsSelect }>;

export const visible = { isActive: true, isGiftBase: false } satisfies Prisma.ProductWhereInput;

// Prisma `contains` không escape wildcard của LIKE (spike: "%" khớp mọi dòng)
const escapeLike = (s: string) => s.replace(/[\\%_]/g, "\\$&");

const ORDER: Record<CollectionQuery["sort"], Prisma.ProductOrderByWithRelationInput[]> = {
  relevant: [{ id: "asc" }],
  "price-asc": [{ priceVnd: "asc" }, { id: "asc" }],
  "price-desc": [{ priceVnd: "desc" }, { id: "asc" }],
  new: [{ createdAt: "desc" }, { id: "desc" }],
};

export function productFindArgs(query: CollectionQuery, categoryId: number | null) {
  const search = toSearch(query.q);
  const where: Prisma.ProductWhereInput = {
    ...visible,
    ...(categoryId !== null && { categoryId }),
    ...(search && { nameSearch: { contains: escapeLike(search) } }),
    ...(query.inStock && { stock: { gt: 0 } }),
  };
  // "Xem thêm" tải lại từ đầu tới trang n (spec: dưới 500 SKU nên vẫn rẻ); +1 để biết còn trang sau
  return { where, orderBy: ORDER[query.sort], take: query.page * PAGE_SIZE + 1 };
}

export const listCategories = () =>
  db.category.findMany({ orderBy: { sort: "asc" }, select: { id: true, slug: true, name: true, image: true } });

export async function listProducts(query: CollectionQuery, categoryId: number | null) {
  const args = productFindArgs(query, categoryId);
  const rows = await db.product.findMany({ ...args, select: productCardSelect });
  const limit = args.take - 1;
  return { products: rows.slice(0, limit), hasMore: rows.length > limit };
}

export const listPromotions = (limit = 8) =>
  db.product.findMany({
    where: { ...visible, compareAtVnd: { not: null }, stock: { gt: 0 } },
    orderBy: { id: "asc" },
    take: limit,
    select: productCardSelect,
  });

export const getProduct = (slug: string) =>
  db.product.findFirst({ where: { ...visible, slug }, include: { category: { select: { slug: true, name: true } } } });

/** Giá tốt: món đang giảm giá trước, thiếu thì lấp bằng món thường (giữ lưới đủ hàng). */
export async function listDeals(limit = 8) {
  const promos = await listPromotions(limit);
  if (promos.length >= limit) return promos;
  const rest = await db.product.findMany({
    where: { ...visible, compareAtVnd: null },
    orderBy: { id: "asc" },
    take: limit - promos.length,
    select: productCardSelect,
  });
  return [...promos, ...rest];
}

/** Bảng giá sáng nay: mỗi danh mục một món còn hàng, ưu tiên món đang giảm giá. */
export const listBoard = (limit = 4) =>
  db.product.findMany({
    where: { ...visible, stock: { gt: 0 } },
    distinct: ["categoryId"],
    orderBy: [{ categoryId: "asc" }, { compareAtVnd: { sort: "desc", nulls: "last" } }, { id: "asc" }],
    take: limit,
    select: productCardSelect,
  });

/** Kệ hàng: món có ảnh tách nền, còn hàng. */
export const listShelf = (limit = 8) =>
  db.product.findMany({
    where: { ...visible, stock: { gt: 0 }, cutoutUrl: { not: null } },
    orderBy: { id: "asc" },
    take: limit,
    select: productCardSelect,
  });

/** Món mẫu cho khối tin cậy: hàng cân ký đang giảm giá, nên hiện đủ mọi dòng (giá cũ, ±10%). */
export const getFeatured = () =>
  db.product.findFirst({
    where: { ...visible, stock: { gt: 0 }, compareAtVnd: { not: null }, isWeighed: true },
    orderBy: { id: "asc" },
    select: productFactsSelect,
  });
