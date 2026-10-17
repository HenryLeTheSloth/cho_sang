import { execFileSync } from "node:child_process";
import pg from "pg";

/**
 * DB riêng cho vitest + Playwright: database thứ hai `chosang_test` trong CÙNG container Postgres.
 * Đơn và kho của test không bao giờ chạm DB dev (đơn test không hiện trong admin lúc pitch).
 */
const TEST_DB = "chosang_test";

try {
  process.loadEnvFile(); // DATABASE_URL của dev: chỉ để lấy host/user/mật khẩu
} catch {}
const devUrl = new URL(process.env.DATABASE_URL ?? "postgresql://chosang:chosang@localhost:5432/chosang");
const testUrl = new URL(devUrl);
testUrl.pathname = `/${TEST_DB}`;
export const TEST_DATABASE_URL = testUrl.href;

const bin = (name: string) => `node_modules/.bin/${name}`;

/**
 * globalSetup của vitest và Playwright: tạo DB nếu chưa có → migrate deploy → xoá sạch → seed.
 * Không dùng lệnh reset của Prisma. Chỉ TRUNCATE sau khi chính Postgres xác nhận đang nối tới chosang_test.
 */
export default async function resetTestDb() {
  const server = new pg.Client({ connectionString: devUrl.href });
  await server.connect();
  try {
    const { rowCount } = await server.query("SELECT 1 FROM pg_database WHERE datname = $1", [TEST_DB]);
    if (!rowCount) await server.query(`CREATE DATABASE "${TEST_DB}"`); // không phá gì: chỉ thêm database
  } finally {
    await server.end();
  }

  const env = { ...process.env, DATABASE_URL: TEST_DATABASE_URL };
  execFileSync(bin("prisma"), ["migrate", "deploy"], { env, stdio: "pipe" }); // im lặng; lỗi thì stderr nằm trong Error

  const db = new pg.Client({ connectionString: TEST_DATABASE_URL });
  await db.connect();
  try {
    const { rows } = await db.query<{ name: string }>("SELECT current_database() AS name");
    if (rows[0].name !== TEST_DB) throw new Error(`Từ chối xoá dữ liệu: đang nối tới "${rows[0].name}", không phải ${TEST_DB}`);
    await db.query('TRUNCATE "OrderItem", "Order", "GiftBundle", "User", "Product", "Category" RESTART IDENTITY CASCADE');
  } finally {
    await db.end();
  }
  execFileSync(bin("tsx"), ["prisma/seed.ts"], { env, stdio: "pipe" });
}
