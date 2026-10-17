import { expect, type Page } from "@playwright/test";
import pg from "pg";
import { TEST_DATABASE_URL } from "../prisma/test-db.ts";

export const E2E_PORT = 3100;
export const E2E_ADMIN_PASSCODE = "e2e-ma-quan-tri-2026";
export const E2E_ENV = {
  NODE_ENV: "production",
  PORT: String(E2E_PORT),
  DATABASE_URL: TEST_DATABASE_URL,
  SESSION_SECRET: "e2e-chi-dung-cho-playwright-0123456789abcdef", // ≥32 ký tự (production)
  DEMO_OTP: "1",
  ADMIN_PASSCODE: E2E_ADMIN_PASSCODE,
};

/** Truy vấn thẳng DB test để kiểm kho/đơn (hoặc đặt kho cho ca tranh món cuối). */
export async function sql<T>(text: string, params: unknown[] = []): Promise<T[]> {
  const client = new pg.Client({ connectionString: TEST_DATABASE_URL });
  await client.connect();
  try {
    return (await client.query(text, params)).rows as T[];
  } finally {
    await client.end();
  }
}

export const product = async (slug: string) =>
  (await sql<{ id: number; stock: number }>('SELECT id, stock FROM "Product" WHERE slug = $1', [slug]))[0];
export const ordersByPhone = async (phone: string) =>
  (await sql<{ n: string }>('SELECT count(*) AS n FROM "Order" WHERE phone = $1', [phone]))[0].n;

/** Nút + chỉ chạy sau khi React hydrate xong: đợi tới khi nút giỏ có props React. */
export const waitForHydration = (page: Page) =>
  page.waitForFunction(() => Object.keys(document.querySelector("#cart-button") ?? {}).some((k) => k.startsWith("__reactProps")));

/** Bỏ thẳng món vào giỏ qua /cart (cùng cookie với trang), nhanh hơn bấm qua UI khi test không nhắm vào giỏ. */
export async function addToCart(page: Page, slug: string, qty = 1) {
  const { id } = await product(slug);
  const res = await page.request.post("/cart", { form: { intent: "set", pid: String(id), qty: String(qty) } });
  expect(res.ok()).toBe(true);
}

export async function fillCheckout(page: Page, phone: string) {
  await page.getByLabel("Họ tên").fill("Chị Lan");
  await page.getByLabel("Số điện thoại").fill(phone);
  await page.getByLabel("Địa chỉ giao hàng").fill("12 Lê Lợi, P. Bến Nghé, Q.1");
}

/** Đặt một đơn COD qua UI, trả mã đơn. */
export async function placeCodOrder(page: Page, phone: string, slug = "rau-muong") {
  await addToCart(page, slug);
  await page.goto("/checkout");
  await waitForHydration(page);
  await fillCheckout(page, phone);
  await page.getByRole("button", { name: /^Đặt hàng/ }).click();
  await expect(page).toHaveURL(/\/orders\/DH\d{6}[A-Z0-9]{4}$/);
  return page.url().split("/").at(-1)!;
}
