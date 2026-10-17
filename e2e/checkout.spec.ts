import { expect, test } from "@playwright/test";
import { addToCart, fillCheckout, ordersByPhone, placeCodOrder, product, sql, waitForHydration } from "./helpers";

test("DoD M3: thêm vào giỏ → COD → thấy đơn", async ({ page }) => {
  const before = (await product("rau-muong")).stock;
  await page.goto("/collections/all");
  await waitForHydration(page);
  await page.getByRole("button", { name: "Thêm Rau muống vào giỏ" }).click();
  await expect(page.locator("#cart-button")).toHaveAccessibleName("Giỏ hàng, 1 món");
  await page.locator("#cart-button").click();
  await page.getByRole("link", { name: "Thanh toán · 35.000₫" }).click();

  await expect(page).toHaveURL(/\/checkout$/);
  await expect(page.getByText("Giá tạm tính, cân thực tế ±10%")).toBeVisible(); // rau muống là hàng cân ký
  await fillCheckout(page, "0911000001");
  await page.getByRole("button", { name: "Đặt hàng · 35.000₫" }).click();

  await expect(page).toHaveURL(/\/orders\/DH\d{6}[A-Z0-9]{4}$/);
  await expect(page.getByRole("status").filter({ hasText: "Đặt hàng thành công" })).toBeVisible();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Đã nhận đơn"); // trạng thái trước, mã đơn là dòng phụ (D1)
  await expect(page.getByText(`Mã đơn ${page.url().split("/").at(-1)!}`)).toBeVisible();
  await expect(page.getByText("Rau muống × 1")).toBeVisible();
  await expect(page.getByRole("list", { name: "Tiến trình đơn hàng" }).getByText("Đã đặt hàng")).toBeVisible();
  await expect(page.locator("#cart-button")).toHaveAccessibleName("Giỏ hàng, 0 món");
  expect((await product("rau-muong")).stock).toBe(before - 1);
});

test("bấm Đặt hàng 2 lần (double tap, gửi trùng) chỉ tạo 1 đơn và trừ kho 1 lần", async ({ page }) => {
  const phone = "0911000002";
  const before = (await product("rau-muong")).stock;
  await addToCart(page, "rau-muong", 2);
  await page.goto("/checkout");
  await waitForHydration(page);
  await fillCheckout(page, phone);
  // Hai POST cùng nội dung (cùng khoá đặt hàng) bay song song, như double tap trên mạng chậm
  const responses = await page.evaluate(async () => {
    const body = new URLSearchParams(new FormData(document.querySelector<HTMLFormElement>("main form")!) as never);
    const send = () => fetch("/checkout", { method: "POST", body, redirect: "manual" });
    return (await Promise.all([send(), send()])).map((r) => r.type); // "opaqueredirect" = 302 về trang đơn, không phải lỗi 500
  });
  expect(responses).toEqual(["opaqueredirect", "opaqueredirect"]);
  await page.getByRole("button", { name: /^Đặt hàng/ }).dblclick(); // lần thứ ba, bằng UI, vẫn cùng khoá
  await expect(page).toHaveURL(/\/orders\/DH/);
  expect(await ordersByPhone(phone)).toBe("1");
  expect((await product("rau-muong")).stock).toBe(before - 2);
});

test("2 khách tranh món cuối cùng lúc: đúng 1 người đặt được, người kia được báo hết hàng", async ({ browser }) => {
  const nho = await product("nho-xanh-ninh-thuan");
  await sql('UPDATE "Product" SET stock = 1 WHERE id = $1', [nho.id]);
  const pages = await Promise.all(
    ["0911000003", "0911000004"].map(async (phone) => {
      const page = await (await browser.newContext()).newPage();
      await addToCart(page, "nho-xanh-ninh-thuan");
      await page.goto("/checkout");
      await waitForHydration(page);
      await fillCheckout(page, phone);
      return page;
    }),
  );
  await Promise.all(pages.map((p) => p.getByRole("button", { name: /^Đặt hàng/ }).click()));
  const outcome = await Promise.all(
    pages.map((p) =>
      Promise.race([
        p.waitForURL(/\/orders\/DH/).then(() => "đặt được"),
        p.getByRole("alert").filter({ hasText: "Nho xanh Ninh Thuận vừa hết hàng" }).waitFor().then(() => "hết hàng"),
      ]),
    ),
  );
  expect(outcome.sort()).toEqual(["hết hàng", "đặt được"].sort());
  expect((await product("nho-xanh-ninh-thuan")).stock).toBe(0);
  await Promise.all(pages.map((p) => p.context().close()));
});

test("huỷ đơn còn chờ thì hoàn kho", async ({ page }) => {
  const before = (await product("rau-muong")).stock;
  await placeCodOrder(page, "0911000005");
  expect((await product("rau-muong")).stock).toBe(before - 1);
  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "Huỷ đơn" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Đơn đã huỷ");
  await expect(page.getByText(/Huỷ lúc .* Bạn không phải trả gì\./)).toBeVisible();
  await expect(page.getByRole("button", { name: "Huỷ đơn" })).toHaveCount(0);
  expect((await product("rau-muong")).stock).toBe(before);
});

test("cổng thanh toán giả lập: DEMO, thất bại → thử lại → thành công", async ({ page }) => {
  await addToCart(page, "rau-muong");
  await page.goto("/checkout");
  await waitForHydration(page);
  await fillCheckout(page, "0911000006");
  await page.getByLabel(/Thanh toán online/).check();
  await page.getByRole("button", { name: /^Đặt hàng/ }).click();

  await expect(page).toHaveURL(/\/checkout\/pay\/DH/);
  await expect(page.getByText("DEMO, không trừ tiền thật")).toBeVisible();
  await page.getByRole("button", { name: "Giả lập thanh toán thất bại" }).click();
  await expect(page.getByRole("alert")).toContainText("Thanh toán chưa thành công");
  await expect(page.getByRole("button", { name: "Chuyển sang trả tiền mặt (COD)" })).toBeVisible();
  await page.getByRole("button", { name: "Thử lại" }).click();
  await page.getByRole("button", { name: /^Thanh toán \d/ }).click();
  await expect(page).toHaveURL(/\/orders\/DH/);
  await expect(page.getByText("Đã thanh toán (DEMO)")).toBeVisible();
});

test("người lạ mở link đơn của người khác chỉ thấy form nhập SĐT (IDOR)", async ({ page, browser }) => {
  const code = await placeCodOrder(page, "0911000007");
  const stranger = await (await browser.newContext()).newPage();
  await stranger.goto(`/orders/${code}`);
  await expect(stranger.getByText("Nhập số điện thoại đã dùng khi đặt để xem đơn này.")).toBeVisible();
  await expect(stranger.getByText("12 Lê Lợi")).toHaveCount(0);
  await stranger.goto(`/checkout/pay/${code}`);
  await expect(stranger).toHaveURL(new RegExp(`/orders/${code}$`));
  await waitForHydration(stranger);
  await stranger.getByLabel("Số điện thoại đặt hàng").fill("0911999999");
  await stranger.getByRole("button", { name: "Xem đơn" }).click();
  await expect(stranger.getByText("Số điện thoại không khớp với mã đơn này.")).toBeVisible();
  await stranger.getByLabel("Số điện thoại đặt hàng").fill("0911 000 007");
  await stranger.getByRole("button", { name: "Xem đơn" }).click();
  await expect(stranger.getByText("12 Lê Lợi, P. Bến Nghé, Q.1")).toBeVisible();
  await stranger.context().close();
});

test("các trang M3 không có lỗi console hay lỗi hydrate (giờ VN tính sẵn ở server)", async ({ page }) => {
  const problems: string[] = [];
  page.on("console", (m) => {
    if (m.type() === "error" || m.type() === "warning") problems.push(m.text());
  });
  page.on("pageerror", (e) => problems.push(String(e)));
  const code = await placeCodOrder(page, "0911000008");
  // Đơn online chưa trả: có trang /checkout/pay/:code để ghé (T7c)
  await addToCart(page, "rau-muong");
  await page.goto("/checkout");
  await waitForHydration(page);
  await fillCheckout(page, "0911000008");
  await page.getByLabel(/Thanh toán online/).check();
  await page.getByRole("button", { name: /^Đặt hàng/ }).click();
  await expect(page).toHaveURL(/\/checkout\/pay\/DH/);
  const payPath = new URL(page.url()).pathname;
  await addToCart(page, "rau-muong"); // /checkout cần giỏ có hàng, nếu không sẽ chuyển trang
  for (const path of ["/", "/orders", `/orders/${code}`, "/login", "/collections/all", "/checkout", payPath]) {
    await page.goto(path);
    await expect(page).toHaveURL(path);
    await waitForHydration(page);
  }
  await page.waitForLoadState("networkidle"); // lỗi hydrate muộn của trang cuối cũng kịp ghi lại
  expect(problems).toEqual([]);
});
