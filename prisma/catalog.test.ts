import { existsSync } from "node:fs";
import { expect, test } from "vitest";
import { categories, giftBase, products } from "./catalog";

const all = [...products, giftBase];

test("đủ số lượng: 6 danh mục, 40 sản phẩm + 1 vỏ giỏ", () => {
  expect(categories).toHaveLength(6);
  expect(products).toHaveLength(40);
  expect(giftBase.isGiftBase).toBe(true);
  expect(products.every((p) => !p.isGiftBase)).toBe(true);
});

test("slug duy nhất, dạng kebab không dấu", () => {
  const slugs = all.map((p) => p.slug);
  expect(new Set(slugs).size).toBe(slugs.length);
  for (const s of [...slugs, ...categories.map((c) => c.slug)]) expect(s).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
});

test("mỗi sản phẩm thuộc danh mục có thật; mỗi danh mục có ảnh bìa là sản phẩm có thật", () => {
  const catSlugs = new Set(categories.map((c) => c.slug));
  for (const p of all) expect(catSlugs).toContain(p.category);
  const productSlugs = new Set(products.map((p) => p.slug));
  for (const c of categories) expect(productSlugs).toContain(c.cover);
});

test("tiền là số nguyên dương; giá gạch lớn hơn giá bán; kho không âm", () => {
  for (const p of all) {
    expect(Number.isInteger(p.priceVnd) && p.priceVnd > 0).toBe(true);
    if (p.compareAtVnd !== undefined) expect(p.compareAtVnd).toBeGreaterThan(p.priceVnd);
    expect(Number.isInteger(p.stock) && p.stock >= 0).toBe(true);
  }
});

test("hàng cân ký phải có netGrams", () => {
  for (const p of all.filter((p) => p.isWeighed)) expect(p.netGrams).toBeGreaterThan(0);
});

test("demo có ít nhất 1 món hết hàng và 3 món khuyến mãi", () => {
  expect(products.some((p) => p.stock === 0)).toBe(true);
  expect(products.filter((p) => p.compareAtVnd !== undefined).length).toBeGreaterThanOrEqual(3);
});

test("giỏ quà: 12 món có ảnh tách nền (PNG trong seed/images/cutouts), còn hàng, không phải vỏ giỏ (M4)", () => {
  const gift = products.filter((p) => p.cutout);
  expect(gift).toHaveLength(12);
  for (const p of gift) {
    expect(existsSync(`seed/images/cutouts/${p.slug}.png`)).toBe(true);
    expect(p.stock).toBeGreaterThan(0);
  }
  expect(giftBase.cutout).toBeUndefined();
});
