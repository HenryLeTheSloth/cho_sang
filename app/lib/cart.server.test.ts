import { createCookie } from "react-router";
import { afterAll, describe, expect, test } from "vitest";
import {
  type Cart,
  cartCookie,
  EMPTY_CART,
  getCartView,
  parseBundleForm,
  parseCartForm,
  readCart,
  setBundles,
  setQuantities,
} from "~/lib/cart.server";
import { db } from "~/lib/db.server";

afterAll(() => db.$disconnect());

const BUNDLE = "cmgr0x9k10000abcd1234efgh";
const request = (cookie?: string) => new Request("http://localhost/", cookie ? { headers: { Cookie: cookie } } : {});
/** "cart=<giá trị>.<chữ ký>", đúng như trình duyệt gửi lên */
const signed = async (value: unknown) => (await cartCookie.serialize(value)).split(";")[0];
const form = (fields: [string, string][]) => {
  const f = new FormData();
  for (const [k, v] of fields) f.append(k, v);
  return f;
};

describe("readCart", () => {
  test("đọc lại đúng giỏ đã ghi", async () => {
    const cart: Cart = { l: [[1, 2], [5, 99]], b: [BUNDLE] };
    expect(await readCart(request(await signed(cart)))).toEqual(cart);
  });
  test("không có cookie hoặc cookie rác thì giỏ rỗng", async () => {
    expect(await readCart(request())).toEqual(EMPTY_CART);
    expect(await readCart(request("cart=abc"))).toEqual(EMPTY_CART);
  });
  test("sửa nội dung nhưng giữ chữ ký cũ thì giỏ rỗng", async () => {
    const valid = await signed({ l: [[1, 2]], b: [] });
    const signature = valid.slice(valid.indexOf("."));
    const forged = `cart=${encodeURIComponent(btoa(JSON.stringify({ l: [[1, 99]], b: [] })))}${signature}`;
    expect(await readCart(request(forged))).toEqual(EMPTY_CART);
  });
  test("ký bằng secret khác thì giỏ rỗng", async () => {
    const other = createCookie("cart", { secrets: ["secret-khac"] });
    const cookie = (await other.serialize({ l: [[1, 2]], b: [] })).split(";")[0];
    expect(await readCart(request(cookie))).toEqual(EMPTY_CART);
  });
  test.each([
    ["qty 0", { l: [[1, 0]], b: [] }],
    ["qty 100", { l: [[1, 100]], b: [] }],
    ["pid trùng", { l: [[1, 1], [1, 2]], b: [] }],
    ["pid lẻ", { l: [[1.5, 1]], b: [] }],
    ["pid vượt int4", { l: [[2147483648, 1]], b: [] }],
    ["51 dòng", { l: Array.from({ length: 51 }, (_, i) => [i + 1, 1]), b: [] }],
    ["thiếu b", { l: [[1, 1]] }],
    ["bundle id lạ", { l: [], b: ["../x"] }],
    ["bundle trùng", { l: [], b: [BUNDLE, BUNDLE] }],
    ["11 giỏ quà", { l: [], b: Array.from({ length: 11 }, (_, i) => `cmgr0x9k10000abcd1234ef${String(i).padStart(2, "0")}`) }],
  ])("chữ ký đúng nhưng sai dạng (%s) thì zod loại, giỏ rỗng", async (_, value) => {
    expect(await readCart(request(await signed(value)))).toEqual(EMPTY_CART);
  });
});

describe("parseCartForm", () => {
  test("set: nhiều cặp pid/qty tuyệt đối, qty 0 là xoá", () => {
    const fields: [string, string][] = [["intent", "set"], ["pid", "3"], ["qty", "2"], ["pid", "7"], ["qty", "0"]];
    expect(parseCartForm(form(fields))).toEqual([[3, 2], [7, 0]]);
  });
  test("remove: mọi pid về 0", () => {
    expect(parseCartForm(form([["intent", "remove"], ["pid", "3"]]))).toEqual([[3, 0]]);
  });
  test.each([
    ["intent lạ", [["intent", "add"], ["pid", "3"], ["qty", "1"]]],
    ["thiếu pid", [["intent", "set"]]],
    ["pid chữ", [["intent", "set"], ["pid", "abc"], ["qty", "1"]]],
    ["pid vượt int4", [["intent", "set"], ["pid", "2147483648"], ["qty", "1"]]],
    ["qty 100", [["intent", "set"], ["pid", "3"], ["qty", "100"]]],
    ["qty âm", [["intent", "set"], ["pid", "3"], ["qty", "-1"]]],
    ["lệch số pid/qty", [["intent", "set"], ["pid", "3"], ["pid", "4"], ["qty", "1"]]],
  ] as [string, [string, string][]][])("%s thì trả null", (_, fields) => {
    expect(parseCartForm(form(fields))).toBeNull();
  });
});

describe("giỏ quà trong form /cart (M4)", () => {
  test("intent bundle mang cặp pid/qty đang chờ + hai danh sách (cái nào cũng có thể rỗng)", () => {
    const fields: [string, string][] = [["intent", "bundle"], ["bundleRemove", BUNDLE], ["bundleAdd", "cmgr0x9k10000abcd1234ef01"], ["pid", "3"], ["qty", "2"]];
    expect(parseCartForm(form(fields))).toEqual([[3, 2]]);
    expect(parseBundleForm(form(fields))).toEqual({ remove: [BUNDLE], add: ["cmgr0x9k10000abcd1234ef01"] });
    expect(parseCartForm(form([["intent", "bundle"], ["bundleAdd", BUNDLE]]))).toEqual([]);
    expect(parseBundleForm(form([["intent", "bundle"]]))).toEqual({ remove: [], add: [] });
  });
  test.each([
    ["id lạ ở add", [["intent", "bundle"], ["bundleAdd", "../x"]]],
    ["id lạ ở remove", [["intent", "bundle"], ["bundleRemove", "../x"]]],
    ["11 id", [["intent", "bundle"], ...Array.from({ length: 11 }, (): [string, string] => ["bundleRemove", BUNDLE])]],
  ] as [string, [string, string][]][])("parseBundleForm: %s thì null", (_, fields) => {
    expect(parseBundleForm(form(fields))).toBeNull();
  });

  test("setBundles: bỏ trước, thêm sau (chỉ id có thật, không trùng); id cũ đã mất được dọn trước khi đếm trần 10", async () => {
    const base = await db.product.findFirstOrThrow({ where: { isGiftBase: true } });
    const made = await db.giftBundle.create({ data: { baseProductId: base.id, layout: [], preview: "data:image/webp;base64,AAAA" } });
    try {
      expect(await setBundles({ l: [[1, 1]], b: [made.id, BUNDLE] }, { remove: [BUNDLE], add: [] })).toEqual({ l: [[1, 1]], b: [made.id] });
      expect(await setBundles(EMPTY_CART, { remove: [], add: [made.id, BUNDLE] })).toEqual({ l: [], b: [made.id] }); // BUNDLE không có trong DB
      expect(await setBundles({ l: [], b: [made.id] }, { remove: [], add: [made.id] })).toEqual({ l: [], b: [made.id] });
      expect(await setBundles({ l: [], b: [made.id] }, { remove: [made.id], add: [made.id] })).toEqual({ l: [], b: [made.id] }); // remove trước, add sau
      const ten = Array.from({ length: 10 }, (_, i) => `cmgr0x9k10000abcd1234ef${String(i).padStart(2, "0")}`);
      expect(await setBundles({ l: [], b: ten }, { remove: [], add: [made.id] })).toEqual({ l: [], b: [made.id] }); // 10 id mồ côi bị dọn
      const real = await Promise.all(ten.map((_, i) => db.giftBundle.create({ data: { baseProductId: base.id, layout: [], preview: `data:image/webp;base64,AAA${i}` } })));
      try {
        expect(await setBundles({ l: [], b: real.map((r) => r.id) }, { remove: [], add: [made.id] })).toBeNull();
      } finally {
        await db.giftBundle.deleteMany({ where: { id: { in: real.map((r) => r.id) } } });
      }
    } finally {
      await db.giftBundle.delete({ where: { id: made.id } });
    }
  });
});

describe("setQuantities", () => {
  const cart: Cart = { l: [[1, 1], [2, 3]], b: [BUNDLE] };
  test("thêm dòng mới vào cuối, sửa dòng cũ tại chỗ, giữ nguyên b", () => {
    expect(setQuantities(cart, [[3, 2], [1, 5]])).toEqual({ l: [[1, 5], [2, 3], [3, 2]], b: [BUNDLE] });
  });
  test("qty 0 là xoá; đặt lại qty cũ (Hoàn tác) thì dòng quay lại cuối giỏ", () => {
    const removed = setQuantities(cart, [[1, 0]]);
    expect(removed?.l).toEqual([[2, 3]]);
    expect(setQuantities(removed!, [[1, 1]])?.l).toEqual([[2, 3], [1, 1]]);
  });
  test("không cho món khác thứ 51, nhưng vẫn sửa được dòng có sẵn khi đủ 50", () => {
    const full: Cart = { l: Array.from({ length: 50 }, (_, i): [number, number] => [i + 1, 1]), b: [] };
    expect(setQuantities(full, [[51, 1]])).toBeNull();
    expect(setQuantities(full, [[50, 9]])?.l.at(-1)).toEqual([50, 9]);
  });
  test("không sửa giỏ gốc", () => {
    setQuantities(cart, [[1, 0]]);
    expect(cart.l).toEqual([[1, 1], [2, 3]]);
  });
});

describe("getCartView (DB đã seed)", () => {
  test("giá đọc từ DB, bỏ món đã xoá/vỏ giỏ quà, giữ thứ tự (Review Focus 2)", async () => {
    const rows = await db.product.findMany({
      where: { slug: { in: ["rau-muong", "tao-envy", "gio-may-qua-bieu"] } },
      select: { id: true, slug: true },
    });
    const id = Object.fromEntries(rows.map((r) => [r.slug, r.id]));
    const { lines } = await getCartView({
      l: [[id["tao-envy"], 1], [999999, 2], [id["gio-may-qua-bieu"], 1], [id["rau-muong"], 2]],
      b: [],
    });
    expect(lines.map((l) => [l.slug, l.qty])).toEqual([["tao-envy", 1], ["rau-muong", 2]]);
    expect(lines[1]).toMatchObject({ priceVnd: 15000, unit: "bó ~300g", isWeighed: true, image: "products/rau-muong" });
    expect(lines[0].stock).toBe(0);
  });
  test("giỏ rỗng trả danh sách rỗng", async () => {
    expect(await getCartView(EMPTY_CART)).toEqual({ lines: [], bundles: [] });
  });
});
