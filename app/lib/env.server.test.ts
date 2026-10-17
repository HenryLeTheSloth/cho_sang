import { afterEach, expect, test, vi } from "vitest";
import { env, required } from "~/lib/env.server";

const saved = { DEMO_OTP: process.env.DEMO_OTP, ADMIN_PASSCODE: process.env.ADMIN_PASSCODE };

const reload = () => {
  vi.resetModules();
  return import("~/lib/env.server");
};

afterEach(() => {
  process.env.SESSION_SECRET = env.SESSION_SECRET;
  process.env.NODE_ENV = "test";
  delete process.env.INSECURE_COOKIES;
  // gán undefined sẽ thành chuỗi "undefined" (spike M2, mục 7): biến không có thì xoá
  for (const [key, value] of Object.entries(saved)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  vi.resetModules();
});

test("required báo lỗi tiếng Việt khi thiếu biến", () => {
  expect(() => required("__CHO_SANG_KHONG_CO__")).toThrow(
    "__CHO_SANG_KHONG_CO__ chưa được đặt, hãy copy .env.example thành .env",
  );
});

test("required trả giá trị khi có", () => {
  process.env.__CHO_SANG_CO__ = "x";
  expect(required("__CHO_SANG_CO__")).toBe("x");
});

test("thiếu SESSION_SECRET thì báo đúng lỗi tiếng Việt của required()", async () => {
  process.env.SESSION_SECRET = ""; // rỗng: loadEnvFile không ghi đè biến đã có
  await expect(reload()).rejects.toThrow("SESSION_SECRET chưa được đặt, hãy copy .env.example thành .env");
});

test("production không nhận secret mẫu dev-only", async () => {
  process.env.NODE_ENV = "production";
  process.env.SESSION_SECRET = "dev-only-doi-chuoi-nay-khi-deploy";
  await expect(reload()).rejects.toThrow("SESSION_SECRET đang là giá trị mẫu");
});

test("cookie Secure ở production, chỉ tắt được bằng INSECURE_COOKIES=1 (demo http trong LAN)", async () => {
  process.env.NODE_ENV = "production";
  process.env.SESSION_SECRET = "chuoi-ngau-nhien-that-dai-hon-32-ky-tu";
  expect((await reload()).env.COOKIE_SECURE).toBe(true);
  process.env.INSECURE_COOKIES = "1";
  expect((await reload()).env.COOKIE_SECURE).toBe(false);
});

test("production: SESSION_SECRET ngắn hơn 32 ký tự bị từ chối", async () => {
  process.env.NODE_ENV = "production";
  process.env.SESSION_SECRET = "a".repeat(31);
  await expect(reload()).rejects.toThrow("SESSION_SECRET phải dài ít nhất 32 ký tự");
  process.env.SESSION_SECRET = "a".repeat(32);
  await expect(reload()).resolves.toBeDefined();
});

test("production: ADMIN_PASSCODE mẫu dev-only hoặc ngắn hơn 12 ký tự bị từ chối", async () => {
  process.env.NODE_ENV = "production";
  process.env.SESSION_SECRET = "b".repeat(32);
  process.env.ADMIN_PASSCODE = "dev-only-ma-quan-tri";
  await expect(reload()).rejects.toThrow("ADMIN_PASSCODE phải dài ít nhất 12 ký tự");
  process.env.ADMIN_PASSCODE = "ngan-qua";
  await expect(reload()).rejects.toThrow("ADMIN_PASSCODE phải dài ít nhất 12 ký tự");
  process.env.ADMIN_PASSCODE = ""; // không đặt: admin bị khoá (fail-closed), app vẫn chạy
  expect((await reload()).env.ADMIN_PASSCODE).toBe("");
});

test("DEMO_OTP chỉ bật khi đúng bằng \"1\" (fail-closed)", async () => {
  for (const [value, on] of [["1", true], ["true", false], ["0", false], ["", false]] as const) {
    process.env.DEMO_OTP = value;
    expect((await reload()).env.DEMO_OTP).toBe(on);
  }
});
