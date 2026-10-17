// Dev: đọc .env (biến đã có trong môi trường được giữ nguyên). Production truyền env thật.
try {
  process.loadEnvFile();
} catch {}

export function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} chưa được đặt, hãy copy .env.example thành .env`);
  return value;
}

export const env = {
  DATABASE_URL: required("DATABASE_URL"),
  UPLOAD_DIR: process.env.UPLOAD_DIR || "uploads",
  SESSION_SECRET: required("SESSION_SECRET"), // ký cookie `cart` (M2) và `__session` (M3)
  // Secure ở production (spec). INSECURE_COOKIES=1 chỉ cho demo bản build qua http:// trong LAN:
  // điện thoại không lưu cookie Secure từ http, giỏ sẽ "tự quay về" sau mỗi lần bấm mà không báo lỗi gì.
  COOKIE_SECURE: process.env.NODE_ENV === "production" && process.env.INSECURE_COOKIES !== "1",
  // OTP giả lập (mã hiện trên màn hình, nhãn DEMO). Chỉ bật khi đúng "1"; thiếu hay giá trị khác là tắt (fail-closed)
  DEMO_OTP: process.env.DEMO_OTP === "1",
  // Mã cho SĐT admin. Rỗng = không admin nào đăng nhập được (fail-closed)
  ADMIN_PASSCODE: process.env.ADMIN_PASSCODE ?? "",
};

if (process.env.NODE_ENV === "production") {
  // Giá trị mẫu trong .env.example ai cũng đọc được: chạy production với nó là giả được cookie (kể cả phiên admin)
  if (env.SESSION_SECRET.startsWith("dev-only")) {
    throw new Error("SESSION_SECRET đang là giá trị mẫu, hãy đặt chuỗi ngẫu nhiên (openssl rand -hex 32)");
  }
  if (env.SESSION_SECRET.length < 32) {
    throw new Error("SESSION_SECRET phải dài ít nhất 32 ký tự (openssl rand -hex 32)");
  }
  if (env.ADMIN_PASSCODE && (env.ADMIN_PASSCODE.length < 12 || env.ADMIN_PASSCODE.startsWith("dev-only"))) {
    throw new Error("ADMIN_PASSCODE phải dài ít nhất 12 ký tự và không phải giá trị mẫu dev-only");
  }
}
