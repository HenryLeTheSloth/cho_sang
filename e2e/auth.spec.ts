import { expect, type Page, test } from "@playwright/test";
import { E2E_ADMIN_PASSCODE, placeCodOrder, waitForHydration } from "./helpers";

const ADMIN_PHONE = "0909000000"; // seed: User role admin

async function sendCode(page: Page, phone?: string) {
  await waitForHydration(page);
  if (phone) await page.getByLabel("Số điện thoại").fill(phone);
  await page.getByRole("button", { name: "Gửi mã" }).click();
}

test("admin không đăng nhập được nếu thiếu/sai passcode và không bao giờ thấy OTP (DoD M3)", async ({ page }) => {
  await page.goto("/login");
  await sendCode(page, ADMIN_PHONE);
  await expect(page.getByText(`Số ${ADMIN_PHONE} là tài khoản quản trị`)).toBeVisible();
  await expect(page.getByText("Mã OTP của bạn")).toHaveCount(0); // không có toast DEMO nào cho admin

  await page.getByRole("button", { name: "Đăng nhập", exact: true }).click(); // passcode trống
  // Lỗi nằm ngay dưới ô (aria-describedby) và con trỏ quay lại ô đó (D4)
  await expect(page.getByLabel("Mã quản trị")).toHaveAccessibleDescription("Mã quản trị chưa đúng, còn 4 lần thử.");
  await expect(page.getByLabel("Mã quản trị")).toBeFocused();
  await page.getByLabel("Mã quản trị").fill("123456");
  await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
  await expect(page.getByLabel("Mã quản trị")).toHaveAccessibleDescription("Mã quản trị chưa đúng, còn 3 lần thử.");
  await page.goto("/orders");
  await expect(page.getByRole("link", { name: "Đăng nhập" }).first()).toBeVisible(); // vẫn là khách

  await page.goto("/login");
  await page.getByLabel("Mã quản trị").fill(E2E_ADMIN_PASSCODE);
  await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
  await expect(page.getByRole("status").filter({ hasText: "Đã đăng nhập" })).toBeVisible();
  await page.goto("/orders");
  await expect(page.getByText(`Đang đăng nhập bằng ${ADMIN_PHONE}`)).toBeVisible();
});

test("khách: 'Lưu đơn vào tài khoản' → OTP DEMO → đơn về tài khoản, quay lại đúng trang; đăng xuất giữ giỏ", async ({ page }) => {
  const phone = "0911000010";
  const code = await placeCodOrder(page, phone);
  await page.getByRole("link", { name: "Lưu đơn vào tài khoản" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Lưu đơn vào tài khoản"); // C6
  await expect(page.getByLabel("Số điện thoại")).toHaveValue(phone);
  await sendCode(page);

  const toast = page.getByRole("status").filter({ hasText: "Mã OTP của bạn" });
  await expect(toast).toContainText("DEMO");
  const otp = (await toast.locator("b").textContent())!;
  // Con trỏ đã ở ô mã, mã DEMO nhắc lại ngay dưới ô (bàn phím iOS che toast) (D5)
  await expect(page.getByLabel(/Mã 6 số/)).toBeFocused();
  await expect(page.getByLabel(/Mã 6 số/)).toHaveAccessibleDescription(`DEMO Mã của bạn: ${otp}`);
  await page.getByLabel(/Mã 6 số/).fill(otp === "000000" ? "111111" : "000000"); // sai 1 lần: mã DEMO vẫn còn trên màn hình
  await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
  await expect(page.getByLabel(/Mã 6 số/)).toHaveAccessibleDescription(new RegExp(`${otp}\\s*Mã OTP chưa đúng, còn 4 lần thử\\.$`));
  await expect(toast).toContainText(otp);
  await page.getByLabel(/Mã 6 số/).fill(otp);
  await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();

  await expect(page).toHaveURL(new RegExp(`/orders/${code}$`));
  await expect(page.getByRole("status").filter({ hasText: "Đã lưu đơn vào tài khoản" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Lưu đơn vào tài khoản" })).toHaveCount(0);
  await page.getByRole("link", { name: "Tài khoản và đơn hàng" }).click();
  await expect(page.getByRole("link", { name: new RegExp(code) })).toBeVisible();

  await page.goto("/collections/all");
  await waitForHydration(page);
  await page.getByRole("button", { name: "Thêm Rau muống vào giỏ" }).click();
  await expect(page.locator("#cart-button")).toHaveAccessibleName("Giỏ hàng, 1 món");
  await page.goto("/orders");
  await page.getByRole("button", { name: "Đăng xuất" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Đã đăng xuất" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Đăng nhập" }).first()).toBeVisible();
  await expect(page.locator("#cart-button")).toHaveAccessibleName("Giỏ hàng, 1 món"); // giỏ ở cookie riêng
});

test("redirectTo trỏ ra ngoài (//evil.test, /.//evil.test) bị bỏ qua: về trang chủ của shop (open redirect)", async ({ page }) => {
  await page.goto("/login?redirectTo=%2F%2Fevil.test");
  await sendCode(page, "0911000011");
  const otp = (await page.getByRole("status").filter({ hasText: "Mã OTP của bạn" }).locator("b").textContent())!;
  await page.getByLabel(/Mã 6 số/).fill(otp);
  await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
  await expect(page).toHaveURL("/");
  // Đã đăng nhập: loader /login chuyển hướng ngay, không cần bấm gì. "/./" chuẩn hoá ra "//evil.test" (cổng M3)
  await page.goto("/login?redirectTo=%2F.%2F%2Fevil.test");
  await expect(page).toHaveURL("/");
});
