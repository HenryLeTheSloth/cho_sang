import { afterAll, beforeAll, expect, test } from "vitest";
import { db } from "~/lib/db.server";

const slug = "__test-stock-check__";

beforeAll(async () => {
  await db.product.deleteMany({ where: { slug } });
  await db.category.deleteMany({ where: { slug } });
});

afterAll(async () => {
  await db.product.deleteMany({ where: { slug } });
  await db.category.deleteMany({ where: { slug } });
  await db.$disconnect();
});

test("Postgres từ chối kho âm", async () => {
  const category = await db.category.create({ data: { slug, name: "test", image: "x" } });
  const product = await db.product.create({
    data: {
      slug, name: "test", nameSearch: "test", description: "", categoryId: category.id,
      priceVnd: 1000, unit: "cái", origin: "x", shelfLife: "x", storage: "x", stock: 0,
    },
  });
  await expect(
    db.product.update({ where: { id: product.id }, data: { stock: { decrement: 1 } } }),
  ).rejects.toThrow();
});
