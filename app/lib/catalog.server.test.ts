import { afterAll, describe, expect, test } from "vitest";
import {
  getProduct,
  listCategories,
  listProducts,
  listPromotions,
  productFindArgs,
} from "~/lib/catalog.server";
import { db } from "~/lib/db.server";

const base = { q: "", sort: "relevant" as const, inStock: false, page: 1 };

afterAll(() => db.$disconnect());

describe("productFindArgs", () => {
  test("luôn ẩn vỏ giỏ quà và sản phẩm ngừng bán", () => {
    expect(productFindArgs(base, null).where).toEqual({ isActive: true, isGiftBase: false });
  });
  test("q được bỏ dấu và escape wildcard của LIKE", () => {
    expect(productFindArgs({ ...base, q: "Trứng 50%_" }, null).where).toMatchObject({
      nameSearch: { contains: "trung 50\\%\\_" },
    });
  });
  test("lọc danh mục và còn hàng", () => {
    expect(productFindArgs({ ...base, inStock: true }, 3).where).toMatchObject({ categoryId: 3, stock: { gt: 0 } });
  });
  test("lấy dư 1 dòng để biết còn trang sau", () => {
    expect(productFindArgs({ ...base, page: 2 }, null).take).toBe(49);
  });
  test("sắp xếp theo giá có id làm tiêu chí phụ", () => {
    expect(productFindArgs({ ...base, sort: "price-asc" }, null).orderBy).toEqual([{ priceVnd: "asc" }, { id: "asc" }]);
  });
});

describe("truy vấn trên DB đã seed", () => {
  test('gõ "trung" (không dấu) ra trứng', async () => {
    const { products } = await listProducts({ ...base, q: "trung" }, null);
    expect(products.map((p) => p.slug)).toEqual(expect.arrayContaining(["trung-ga-ta", "trung-vit"]));
  });
  test('ký tự "%" không trả về cả catalog', async () => {
    expect((await listProducts({ ...base, q: "%" }, null)).products).toHaveLength(0);
  });
  test("trang 1 có 24 sản phẩm và còn trang sau; trang 2 trả đủ 40", async () => {
    const p1 = await listProducts(base, null);
    expect([p1.products.length, p1.hasMore]).toEqual([24, true]);
    const p2 = await listProducts({ ...base, page: 2 }, null);
    expect([p2.products.length, p2.hasMore]).toEqual([40, false]);
  });
  test("lọc còn hàng loại món hết hàng", async () => {
    const { products } = await listProducts({ ...base, inStock: true, page: 2 }, null);
    expect(products.some((p) => p.slug === "tao-envy")).toBe(false);
  });
  test("khuyến mãi chỉ gồm món có giá gạch và còn hàng", async () => {
    const promos = await listPromotions();
    expect(promos.length).toBeGreaterThanOrEqual(3);
    expect(promos.every((p) => p.compareAtVnd !== null && p.stock > 0)).toBe(true);
  });
  test("vỏ giỏ quà và slug lạ không có trang sản phẩm", async () => {
    expect(await getProduct("gio-may-qua-bieu")).toBeNull();
    expect(await getProduct("khong-co")).toBeNull();
    expect((await getProduct("rau-muong"))?.category.slug).toBe("rau-cu");
  });
});
