import { describe, expect, test } from "vitest";
import { readForm, safeRedirect } from "~/lib/security.server";

const post = (body: BodyInit | null, headers: Record<string, string> = {}) =>
  new Request("http://localhost:5173/checkout", { method: "POST", body, headers, duplex: "half" } as RequestInit);
const statusOf = (p: Promise<unknown>) => p.then(() => "ok", (e: Response) => e.status);

describe("readForm", () => {
  test("cùng origin: đọc được form, giữ dấu tiếng Việt", async () => {
    const form = await readForm(post(new URLSearchParams({ name: "Lê Thị Đào" }), { Origin: "http://localhost:5173" }));
    expect(form.get("name")).toBe("Lê Thị Đào");
  });
  test("Origin trang khác bị chặn 403 (kể cả khi cùng host khác cổng)", async () => {
    expect(await statusOf(readForm(post("a=1", { Origin: "http://evil.test" })))).toBe(403);
    expect(await statusOf(readForm(post("a=1", { Origin: "http://localhost:3000" })))).toBe(403);
  });
  test("không có Origin: Sec-Fetch-Site cross-site/same-site bị chặn, same-origin/none cho qua", async () => {
    expect(await statusOf(readForm(post("a=1", { "Sec-Fetch-Site": "cross-site" })))).toBe(403);
    expect(await statusOf(readForm(post("a=1", { "Sec-Fetch-Site": "same-site" })))).toBe(403);
    expect(await statusOf(readForm(post("a=1", { "Sec-Fetch-Site": "same-origin" })))).toBe("ok");
    expect(await statusOf(readForm(post("a=1", { "Sec-Fetch-Site": "none" })))).toBe("ok");
  });
  test("client không phải trình duyệt (không Origin, không Sec-Fetch-Site) cho qua", async () => {
    const form = await readForm(post("a=1", { "Content-Type": "application/x-www-form-urlencoded" }));
    expect(form.get("a")).toBe("1");
  });
  test("body vượt 16KB bị chặn 413, kể cả gửi chunked không có Content-Length", async () => {
    expect(await statusOf(readForm(post(`a=${"x".repeat(17 * 1024)}`)))).toBe(413);
    const stream = new ReadableStream({
      start(c) {
        for (let i = 0; i < 40; i++) c.enqueue(new TextEncoder().encode("x".repeat(1000)));
        c.close();
      },
    });
    expect(await statusOf(readForm(post(stream)))).toBe(413);
    expect(await statusOf(readForm(post(`a=${"x".repeat(30 * 1024)}`), 64 * 1024))).toBe("ok"); // trần riêng (M4)
  });
  test("body rác hoặc rỗng thành form rỗng, không ném lỗi", async () => {
    expect([...(await readForm(post("rác", { "Content-Type": "multipart/form-data; boundary=zz" })))]).toEqual([]);
    expect([...(await readForm(post(null)))]).toEqual([]);
  });
});

describe("safeRedirect (chống open redirect)", () => {
  test.each([
    ["/orders/DH261015ABCD?x=1#a", "/orders/DH261015ABCD?x=1#a"],
    ["//evil.test", "/"],
    ["/\\evil.test", "/"],
    ["/\t/evil.test", "/"],
    ["/\n/evil.test", "/"],
    ["https://evil.test/", "/"],
    ["javascript:alert(1)", "/"],
    ["orders", "/"],
    ["", "/"],
    ["/.//evil.test", "/"], // chuẩn hoá dấu chấm ra "//evil.test" (cổng M3)
    ["/..//evil.test", "/"],
    ["/%2e//evil.test", "/"],
    ["/x/../\\evil.test", "/"],
    ["//a b", "/"], // URL không hợp lệ: không được ném lỗi
    ["// ..%2f", "/"],
  ])("%j → %j", (input, expected) => {
    expect(safeRedirect(input)).toBe(expected);
  });
  test("null/không có thì về fallback", () => {
    expect(safeRedirect(null, "/orders")).toBe("/orders");
  });
});
