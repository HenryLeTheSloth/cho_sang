import { expect, test } from "@playwright/test";
import { waitForHydration } from "./helpers";

// Port từ kiểm tra tay của M2 (gate M2, I1): giữ flushSync + routeDiscovery "initial". Bỏ một trong hai là test này đỏ.
test("bấm nhanh liên tục, response đầu về trễ: UI = server, không mất dòng, không gọi /__manifest", async ({ page }) => {
  let manifestRequests = 0;
  page.on("request", (r) => {
    if (r.url().includes("/__manifest")) manifestRequests++;
  });
  let n = 0;
  await page.route("**/cart.data*", async (route) => {
    const delay = n++ === 0 ? 800 : 100; // response đầu về sau cùng
    const response = await route.fetch().catch(() => null);
    await new Promise((r) => setTimeout(r, delay));
    if (response) await route.fulfill({ response }).catch(() => {});
    else await route.abort().catch(() => {});
  });
  await page.goto("/collections/all?page=2");
  await waitForHydration(page);
  const result = await page.evaluate(async () => {
    const $ = (s: string) => document.querySelector<HTMLElement>(s)!;
    $('[aria-label="Thêm Rau muống vào giỏ"]').click(); // không chờ giữa các lần bấm
    for (let i = 0; i < 7; i++) $('[aria-label="Thêm 1 Rau muống"]').click();
    $('[aria-label="Bớt 1 Rau muống"]').click();
    $('[aria-label="Thêm Trứng gà ta vào giỏ"]').click();
    await new Promise((r) => setTimeout(r, 3000));
    const server = (await (await fetch("/cart")).json()) as { lines: { slug: string; qty: number }[] };
    return {
      ui: $('output[aria-label="Số lượng Rau muống"]').textContent,
      badge: $("#cart-button").getAttribute("aria-label"),
      server: server.lines.map((l) => [l.slug, l.qty]),
    };
  });
  expect(result).toEqual({ ui: "7", badge: "Giỏ hàng, 8 món", server: [["rau-muong", 7], ["trung-ga-ta", 1]] });
  expect(manifestRequests).toBe(0);
});

test("mất mạng khi bấm +: trang còn nguyên, số lượng quay về, có lời nhắn; có mạng lại thì chạy", async ({ page }) => {
  await page.goto("/collections/all");
  await waitForHydration(page);
  await page.route("**/cart.data*", (route) => route.abort("internetdisconnected"));
  await page.getByRole("button", { name: "Thêm Rau muống vào giỏ" }).click();
  await expect(page.locator("header [role=alert]")).toHaveText("Mất kết nối, bạn thử lại giúp mình nhé.");
  await expect(page.locator("main h1")).toHaveText("Tất cả sản phẩm");
  await expect(page.locator('output[aria-label="Số lượng Rau muống"]')).toHaveCount(0);
  await page.unrouteAll();
  await page.getByRole("button", { name: "Thêm Rau muống vào giỏ" }).click();
  await expect(page.locator('output[aria-label="Số lượng Rau muống"]')).toHaveText("1");
  await expect(page.locator("header [role=alert]")).toHaveCount(0);
});

test("giỏ trống: rổ 0% + 3 món khuyến mãi có nút +; bấm + thì drawer thành giỏ có hàng", async ({ page }) => {
  await page.goto("/");
  await waitForHydration(page);
  await page.locator("#cart-button").click();
  const drawer = page.locator("#cart-drawer");
  await expect(drawer.getByText("Giỏ hàng đang trống")).toBeVisible();
  await expect(drawer.getByText("Còn 300.000₫ nữa được freeship")).toBeVisible();
  const adds = drawer.getByRole("button", { name: /^Thêm .+ vào giỏ$/ });
  await expect(adds).toHaveCount(3);
  await adds.first().click();
  await expect(drawer.getByRole("heading", { name: "Giỏ hàng (1)" })).toBeVisible();
  await expect(drawer.getByRole("link", { name: /^Thanh toán · / })).toBeVisible();
});
