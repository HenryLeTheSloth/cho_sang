import { defineConfig } from "vitest/config";
import { TEST_DATABASE_URL } from "./prisma/test-db.ts";

export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    include: ["app/**/*.test.ts", "prisma/**/*.test.ts"],
    fileParallelism: false, // một DB test chung: test đơn hàng/kho ghi DB, không chạy song song
    globalSetup: "./prisma/test-db.ts", // tạo + migrate + xoá sạch + seed chosang_test trước mỗi lần chạy
    // Không phụ thuộc .env của từng máy: DB test, OTP demo bật, mã quản trị cố định cho test
    env: { DATABASE_URL: TEST_DATABASE_URL, DEMO_OTP: "1", ADMIN_PASSCODE: "test-ma-quan-tri-2026" },
  },
});
