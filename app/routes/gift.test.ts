import sharp from "sharp";
import { afterAll, beforeAll, expect, test } from "vitest";
import { cartCookie, readCart } from "~/lib/cart.server";
import { db } from "~/lib/db.server";
import { createBundle } from "~/lib/gift.server";
import { action, loader } from "~/routes/gift";

// DB test đã seed: 12 món có ảnh tách nền, vỏ giỏ 120.000₫
let PREVIEW = "";
const pid: Record<string, number> = {};
const at = { x: 0.5, y: 0.6, s: 1, r: 0 };

beforeAll(async () => {
  const rows = await db.product.findMany({ where: { slug: { in: ["cam-sanh", "rau-muong"] } } });
  for (const r of rows) pid[r.slug] = r.id;
  PREVIEW = `data:image/webp;base64,${(await sharp({ create: { width: 8, height: 8, channels: 3, background: "#fff" } }).webp().toBuffer()).toString("base64")}`;
});
afterAll(() => db.$disconnect());

const post = (fields: Record<string, string>, cookie = "", headers: Record<string, string> = {}) =>
  action({
    request: new Request("http://localhost/gift", { method: "POST", body: new URLSearchParams(fields), headers: { Cookie: cookie, ...headers } }),
    params: {},
  } as Parameters<typeof action>[0]).catch((e: unknown) => e);
type Result = { init?: { status?: number; headers?: HeadersInit }; data: { error: string | null } };
const body = (pids: number[], extra: Record<string, string> = {}) => ({
  layout: JSON.stringify(pids.map((p) => ({ pid: p, ...at }))),
  message: "Chúc mừng năm mới",
  preview: PREVIEW,
  ...extra,
});
const cartFrom = async (res: Result) =>
  readCart(new Request("http://localhost/", { headers: { Cookie: new Headers(res.init?.headers).get("Set-Cookie")?.split(";")[0] ?? "" } }));

test("loader: vỏ giỏ + 12 món có ảnh tách nền (URL /uploads/products/<slug>-cutout.webp)", async () => {
  const data = await loader();
  expect(data.base).toMatchObject({ name: "Giỏ mây quà biếu", priceVnd: 120000 });
  expect(data.items).toHaveLength(12);
  expect(data.items.find((i) => i.id === pid["cam-sanh"])?.src).toBe("/uploads/products/cam-sanh-cutout.webp");
});

test("tạo giỏ quà 10 món: lưu GiftBundle, id vào cookie `b`, giữ các dòng thường đang có", async () => {
  const before = (await cartCookie.serialize({ l: [[pid["rau-muong"], 2]], b: [] })).split(";")[0];
  const res = (await post(body(Array(10).fill(pid["cam-sanh"])), before)) as Result;
  expect(res.data).toEqual({ error: null });
  const cart = await cartFrom(res);
  expect(cart.l).toEqual([[pid["rau-muong"], 2]]);
  expect(cart.b).toHaveLength(1);
  const saved = await db.giftBundle.findUniqueOrThrow({ where: { id: cart.b[0] } });
  expect([(saved.layout as unknown[]).length, saved.message, saved.preview]).toEqual([10, "Chúc mừng năm mới", PREVIEW]);
});

test.each([
  ["pid lạ", () => body([pid["cam-sanh"], 999999]), "Có món vừa ngừng bán, bạn tải lại trang rồi xếp lại giúp mình nhé."],
  ["món không có ảnh tách nền", () => body([pid["rau-muong"]]), "Có món vừa ngừng bán, bạn tải lại trang rồi xếp lại giúp mình nhé."],
  ["11 món", () => body(Array(11).fill(pid["cam-sanh"])), "Giỏ quà chứa tối đa 10 món."],
  ["ảnh xem trước sai", () => body([pid["cam-sanh"]], { preview: "data:image/svg+xml;base64,PHN2Zz4=" }), "Ảnh xem trước không hợp lệ, bạn thử lại giúp mình nhé."],
] as [string, () => Record<string, string>, string][])("DoD M4: layout có %s bị từ chối 400, không tạo giỏ quà, không ghi cookie", async (_, fields, error) => {
  const before = await db.giftBundle.count();
  const res = (await post(fields())) as Result;
  expect([res.init?.status, res.data.error]).toEqual([400, error]);
  expect(new Headers(res.init?.headers).get("Set-Cookie")).toBeNull();
  expect(await db.giftBundle.count()).toBe(before);
});

test("giỏ hàng đã có 10 giỏ quà còn sống: từ chối 400 trước khi tạo, không ghi cookie", async () => {
  const ten = await Promise.all(
    Array.from({ length: 10 }, async () => (await createBundle({ layout: [{ pid: pid["cam-sanh"], ...at }], message: "", preview: PREVIEW }))!),
  );
  const full = (await cartCookie.serialize({ l: [], b: ten })).split(";")[0];
  const before = await db.giftBundle.count();
  const res = (await post(body([pid["cam-sanh"]]), full)) as Result;
  expect([res.init?.status, res.data.error]).toEqual([400, "Giỏ hàng chỉ chứa tối đa 10 giỏ quà."]);
  expect(new Headers(res.init?.headers).get("Set-Cookie")).toBeNull();
  expect(await db.giftBundle.count()).toBe(before);
});

test("cookie có 10 id giỏ quà đã chết (DB reset): vẫn thêm được, id chết bị dọn khỏi `b`", async () => {
  const dead = Array.from({ length: 10 }, (_, i) => `cmgr0x9k10000abcd1234ef${String(i).padStart(2, "0")}`);
  const stale = (await cartCookie.serialize({ l: [], b: dead })).split(";")[0];
  const res = (await post(body([pid["cam-sanh"]]), stale)) as Result;
  expect(res.data).toEqual({ error: null });
  const cart = await cartFrom(res);
  expect(cart.b).toHaveLength(1);
  expect(dead).not.toContain(cart.b[0]);
});

test("body quá 100KB bị chặn 413; POST từ trang khác bị chặn 403", async () => {
  expect(((await post(body([pid["cam-sanh"]], { preview: "A".repeat(110 * 1024) }))) as Response).status).toBe(413);
  expect(((await post(body([pid["cam-sanh"]]), "", { Origin: "http://evil.test" })) as Response).status).toBe(403);
});
