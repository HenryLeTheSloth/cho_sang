import { expect, test } from "vitest";
import { cartCookie, readCart } from "~/lib/cart.server";
import { action } from "~/routes/cart";

const post = (fields: [string, string][], cookie?: string) =>
  action({
    request: new Request("http://localhost/cart", {
      method: "POST",
      body: new URLSearchParams(fields),
      headers: cookie ? { Cookie: cookie } : {},
    }),
  } as Parameters<typeof action>[0]);
type Result = Awaited<ReturnType<typeof post>>;
const setCookie = (res: Result) => new Headers(res.init?.headers).get("Set-Cookie");
const cookieOf = (res: Result) => setCookie(res)?.split(";")[0] ?? "";
const linesOf = async (cookie: string) => (await readCart(new Request("http://localhost/", { headers: { Cookie: cookie } }))).l;

test("set → remove → Hoàn tác (set lại qty cũ)", async () => {
  const added = await post([["intent", "set"], ["pid", "7"], ["qty", "3"]]);
  expect(added.data).toEqual({ error: null });
  expect(await linesOf(cookieOf(added))).toEqual([[7, 3]]);
  const removed = await post([["intent", "remove"], ["pid", "7"]], cookieOf(added));
  expect(await linesOf(cookieOf(removed))).toEqual([]);
  const undone = await post([["intent", "set"], ["pid", "7"], ["qty", "3"]], cookieOf(removed));
  expect(await linesOf(cookieOf(undone))).toEqual([[7, 3]]);
});

test("cookie giữ 30 ngày, httpOnly, sameSite=lax, cho cả site", async () => {
  const header = setCookie(await post([["intent", "set"], ["pid", "7"], ["qty", "1"]]));
  expect(header).toContain("Max-Age=2592000");
  expect(header).toContain("HttpOnly");
  expect(header).toContain("SameSite=Lax");
  expect(header).toContain("Path=/");
});

test("form sai trả 400 và không ghi cookie", async () => {
  const res = await post([["intent", "set"], ["pid", "abc"], ["qty", "1"]]);
  expect(res.init?.status).toBe(400);
  expect(setCookie(res)).toBeNull();
});

test("món khác thứ 51 bị từ chối bằng lời nhắn tiếng Việt", async () => {
  const full = (await cartCookie.serialize({ l: Array.from({ length: 50 }, (_, i) => [i + 1, 1]), b: [] })).split(";")[0];
  const res = await post([["intent", "set"], ["pid", "51"], ["qty", "1"]], full);
  expect(res.init?.status).toBe(400);
  expect(res.data).toEqual({ error: "Giỏ hàng chỉ chứa tối đa 50 món khác nhau." });
});

test("cookie giả mạo coi như giỏ rỗng, thao tác vẫn chạy", async () => {
  const res = await post([["intent", "set"], ["pid", "7"], ["qty", "2"]], "cart=gia-mao");
  expect(await linesOf(cookieOf(res))).toEqual([[7, 2]]);
});

test("POST từ trang khác bị chặn 403, cookie không đổi (CSRF trên resource route)", async () => {
  const res = await action({
    request: new Request("http://localhost/cart", {
      method: "POST",
      body: new URLSearchParams([["intent", "set"], ["pid", "7"], ["qty", "3"]]),
      headers: { Origin: "http://evil.test" },
    }),
  } as Parameters<typeof action>[0]).catch((e: Response) => e);
  expect(res).toBeInstanceOf(Response);
  expect((res as Response).status).toBe(403);
});

test("giỏ quà: Hoàn tác (bundleAdd) trả lại đúng id; remove kèm pid/qty; id không có thật bị bỏ qua", async () => {
  const { db } = await import("~/lib/db.server");
  const base = await db.product.findFirstOrThrow({ where: { isGiftBase: true } });
  const { id } = await db.giftBundle.create({ data: { baseProductId: base.id, layout: [], preview: "data:image/webp;base64,AAAA" } });
  try {
    const start = (await cartCookie.serialize({ l: [[7, 1]], b: [id] })).split(";")[0];
    const removed = await post([["intent", "bundle"], ["bundleRemove", id], ["pid", "7"], ["qty", "2"]], start);
    expect(removed.data).toEqual({ error: null });
    const afterRemove = await readCart(new Request("http://localhost/", { headers: { Cookie: cookieOf(removed) } }));
    expect(afterRemove).toEqual({ l: [[7, 2]], b: [] });
    const undone = await post([["intent", "bundle"], ["bundleAdd", id], ["bundleAdd", "cmgr0x9k10000abcd1234efgh"]], cookieOf(removed));
    expect((await readCart(new Request("http://localhost/", { headers: { Cookie: cookieOf(undone) } }))).b).toEqual([id]);
  } finally {
    await db.giftBundle.delete({ where: { id } });
  }
});

test("giỏ quà: MỘT request mang remove [A] + add [B] + cặp pid/qty → có B, không A, cặp được áp (xen kẽ Hoàn tác X + xoá Y)", async () => {
  const { db } = await import("~/lib/db.server");
  const base = await db.product.findFirstOrThrow({ where: { isGiftBase: true } });
  const mk = (n: string) => db.giftBundle.create({ data: { baseProductId: base.id, layout: [], preview: `data:image/webp;base64,${n}` } });
  const [a, b] = await Promise.all([mk("AAAA"), mk("BBBB")]);
  try {
    const start = (await cartCookie.serialize({ l: [[7, 1]], b: [a.id] })).split(";")[0];
    const res = await post([["intent", "bundle"], ["bundleRemove", a.id], ["bundleAdd", b.id], ["pid", "7"], ["qty", "4"]], start);
    expect(res.data).toEqual({ error: null });
    expect(await readCart(new Request("http://localhost/", { headers: { Cookie: cookieOf(res) } }))).toEqual({ l: [[7, 4]], b: [b.id] });
  } finally {
    await db.giftBundle.deleteMany({ where: { id: { in: [a.id, b.id] } } });
  }
});

test("giỏ quà: id sai dạng → 400, cookie không đổi", async () => {
  for (const f of ["bundleRemove", "bundleAdd"]) {
    const res = await post([["intent", "bundle"], [f, "../x"]]);
    expect(res.init?.status).toBe(400);
    expect(setCookie(res)).toBeNull();
  }
});
