import { defineConfig } from "@playwright/test";
import { E2E_ENV, E2E_PORT } from "./e2e/helpers.ts";

/**
 * E2E chạy trên BẢN BUILD PRODUCTION nối DB test `chosang_test` (không bao giờ DB dev).
 * Thứ tự (spike M3): webServer khởi động trước, rồi globalSetup reset DB test; server chỉ nối DB khi có request.
 */
export default defineConfig({
  testDir: "e2e",
  workers: 1, // các test dùng chung DB test và tồn kho
  reporter: "list",
  globalSetup: "./prisma/test-db.ts",
  use: {
    baseURL: `http://localhost:${E2E_PORT}`,
    viewport: { width: 375, height: 812 },
    locale: "vi-VN",
  },
  webServer: {
    command: "npm run build && npm start",
    // Đầu dò sẵn sàng KHÔNG chạm DB: webServer chạy trước globalSetup, máy mới chưa có chosang_test (cổng M3)
    url: `http://localhost:${E2E_PORT}/favicon.svg`,
    reuseExistingServer: false, // luôn là server nối DB test, không bao giờ dùng nhầm server dev đang chạy
    timeout: 180_000,
    env: E2E_ENV,
  },
});
