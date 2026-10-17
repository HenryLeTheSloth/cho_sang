import sharp from "sharp";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { db } from "~/lib/db.server";
import { bundlePreview, bundleViews, createBundle, type GiftInput, listGiftItems, parseGiftForm } from "~/lib/gift.server";

// DB test đã seed: 12 món có ảnh tách nền (catalog `cutout: true`), vỏ giỏ "gio-may-qua-bieu" 120.000₫
const ids: Record<string, number> = {};
const created: string[] = [];
let WEBP: string; // ảnh xem trước thật (webp 8×8)
let JPEG: string;
let BIG: string; // webp 480×480 thật (cỡ lớn nhất client xuất ra)
let ANIM: string; // webp động 2 khung 480×480
let BOMB: string; // webp lossless 8000×8000 một màu: ≈2,5KB, giải nén ≈256MB (cổng plan M4, thay đổi 2)
const at = { x: 0.5, y: 0.6, s: 1, r: 15 };

beforeAll(async () => {
  const rows = await db.product.findMany({
    where: { slug: { in: ["cam-sanh", "chuoi-gia", "rau-muong", "gio-may-qua-bieu"] } },
    select: { id: true, slug: true },
  });
  for (const r of rows) ids[r.slug] = r.id;
  const img = sharp({ create: { width: 8, height: 8, channels: 3, background: "#ffffff" } });
  WEBP = `data:image/webp;base64,${(await img.clone().webp().toBuffer()).toString("base64")}`;
  JPEG = `data:image/jpeg;base64,${(await img.clone().jpeg().toBuffer()).toString("base64")}`;
  const webpOf = async (side: number, lossless = false) =>
    `data:image/webp;base64,${(await sharp({ create: { width: side, height: side, channels: 3, background: "#ffffff" } }).webp({ lossless }).toBuffer()).toString("base64")}`;
  [BIG, BOMB] = await Promise.all([webpOf(480), webpOf(8000, true)]);
  const frames = Buffer.concat([Buffer.alloc(480 * 480 * 3, 255), Buffer.alloc(480 * 480 * 3, 0)]);
  ANIM = `data:image/webp;base64,${(await sharp(frames, { raw: { width: 480, height: 960, channels: 3, pageHeight: 480 } }).webp().toBuffer()).toString("base64")}`;
});

afterAll(async () => {
  await db.giftBundle.deleteMany({ where: { id: { in: created } } });
  await db.$disconnect();
});

const form = (fields: Record<string, string>) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(fields)) f.set(k, v);
  return f;
};
const valid = () => ({
  layout: JSON.stringify([{ pid: ids["cam-sanh"], ...at }, { pid: ids["chuoi-gia"], ...at }, { pid: ids["cam-sanh"], ...at }]),
  message: "  Chúc mừng năm mới  ",
  preview: WEBP,
});
const make = async (input: GiftInput) => {
  const id = await createBundle(input);
  if (id) created.push(id);
  return id;
};

describe("parseGiftForm", () => {
  test("hợp lệ: layout ≤10 món, lời chúc được trim, ảnh webp (tới 480×480) hoặc jpeg (Safari)", async () => {
    const parsed = await parseGiftForm(form(valid()));
    expect(parsed.ok && parsed.data.message).toBe("Chúc mừng năm mới");
    expect(parsed.ok && parsed.data.layout).toHaveLength(3);
    expect((await parseGiftForm(form({ ...valid(), preview: JPEG }))).ok).toBe(true);
    expect((await parseGiftForm(form({ ...valid(), preview: BIG }))).ok).toBe(true);
  });

  test("lời chúc gõ dạng tổ hợp (NFD, macOS/iOS) được đếm sau khi chuẩn hoá NFC", async () => {
    const nfd = "Chúc mừng năm mới ".repeat(6).slice(0, 120).normalize("NFD");
    expect(nfd.length).toBeGreaterThan(120);
    const parsed = await parseGiftForm(form({ ...valid(), message: nfd }));
    expect(parsed.ok && parsed.data.message).toBe(nfd.normalize("NFC").trim());
  });

  const eleven = () => JSON.stringify(Array.from({ length: 11 }, () => ({ pid: ids["cam-sanh"], ...at })));
  test.each([
    ["layout không phải JSON", () => ({ layout: "[{" }), "Bố cục giỏ quà không hợp lệ."],
    ["layout không phải mảng", () => ({ layout: "{}" }), "Bố cục giỏ quà không hợp lệ."],
    ["giỏ rỗng", () => ({ layout: "[]" }), "Bạn chọn ít nhất 1 món cho giỏ quà nhé."],
    ["11 món", () => ({ layout: eleven() }), "Giỏ quà chứa tối đa 10 món."],
    ["toạ độ ngoài khung", () => ({ layout: JSON.stringify([{ pid: 1, ...at, x: 1.5 }]) }), undefined],
    ["pid chữ", () => ({ layout: JSON.stringify([{ ...at, pid: "1" }]) }), undefined],
    ["lời chúc 121 ký tự", () => ({ message: "a".repeat(121) }), "Lời chúc tối đa 120 ký tự."],
    ["ảnh PNG", () => ({ preview: "data:image/png;base64,iVBORw0KGgo=" }), "Ảnh xem trước không hợp lệ, bạn thử lại giúp mình nhé."],
    ["tiền tố webp nhưng nội dung là jpeg", () => ({ preview: JPEG.replace("jpeg", "webp") }), "Ảnh xem trước không hợp lệ, bạn thử lại giúp mình nhé."],
    ["ảnh quá 60KB", () => ({ preview: WEBP + "A".repeat(60 * 1024) }), "Ảnh xem trước không hợp lệ, bạn thử lại giúp mình nhé."],
    ["ảnh nhỏ nhưng khai báo 8000×8000 (bom giải nén)", () => ({ preview: BOMB }), "Ảnh xem trước không hợp lệ, bạn thử lại giúp mình nhé."],
    ["webp động (2 khung)", () => ({ preview: ANIM }), "Ảnh xem trước không hợp lệ, bạn thử lại giúp mình nhé."],
    ["layout quá dài (lời nhắn tiếng Việt, không phải mặc định zod)", () => ({ layout: "[" + " ".repeat(5000) }), "Bố cục giỏ quà không hợp lệ."],
    ["thiếu ảnh", () => ({ preview: "" }), "Ảnh xem trước không hợp lệ, bạn thử lại giúp mình nhé."],
  ] as [string, () => Record<string, string>, string | undefined][])("%s thì bị từ chối", async (_, override, message) => {
    const parsed = await parseGiftForm(form({ ...valid(), ...override() }));
    expect(parsed.ok).toBe(false);
    if (message && !parsed.ok) expect(parsed.error).toBe(message);
  });
});

describe("createBundle (DoD M4: pid lạ bị từ chối)", () => {
  const input = (pids: number[]): GiftInput => ({ layout: pids.map((pid) => ({ pid, ...at })), message: "", preview: WEBP });

  test("món có ảnh tách nền: lưu layout nguyên vẹn, vỏ giỏ là sản phẩm isGiftBase, id 96 bit ngẫu nhiên dạng cuid", async () => {
    const id = await make(input([ids["cam-sanh"], ids["chuoi-gia"]]));
    expect(id).toMatch(/^c[0-9a-f]{24}$/);
    const row = await db.giftBundle.findUniqueOrThrow({ where: { id: id! } });
    expect(row).toMatchObject({ baseProductId: ids["gio-may-qua-bieu"], message: "", preview: WEBP });
    expect(row.layout).toEqual([{ pid: ids["cam-sanh"], ...at }, { pid: ids["chuoi-gia"], ...at }]);
  });

  test.each([
    ["pid không tồn tại", () => 999999],
    ["món không có ảnh tách nền", () => ids["rau-muong"]],
    ["chính vỏ giỏ", () => ids["gio-may-qua-bieu"]],
  ])("%s: trả null, không ghi gì", async (_, pid) => {
    const before = await db.giftBundle.count();
    expect(await make(input([ids["cam-sanh"], pid()]))).toBeNull();
    expect(await db.giftBundle.count()).toBe(before);
  });

  test("món đang ngừng bán: trả null, không ghi gì", async () => {
    const before = await db.giftBundle.count();
    try {
      await db.product.update({ where: { id: ids["chuoi-gia"] }, data: { isActive: false } });
      expect(await make(input([ids["cam-sanh"], ids["chuoi-gia"]]))).toBeNull();
      expect(await db.giftBundle.count()).toBe(before);
    } finally {
      await db.product.update({ where: { id: ids["chuoi-gia"] }, data: { isActive: true } });
    }
  });

  test("listGiftItems: chỉ món có ảnh tách nền, còn hàng, không có vỏ giỏ", async () => {
    const items = await listGiftItems();
    expect(items).toHaveLength(12);
    expect(items.every((i) => i.cutoutUrl?.endsWith("-cutout"))).toBe(true);
    expect(items.map((i) => i.id)).not.toContain(ids["gio-may-qua-bieu"]);
  });
});

describe("bundleViews + bundlePreview", () => {
  test("giá = vỏ giỏ + từng món (đọc lại từ DB), số món đếm từ layout, giữ thứ tự cookie, bỏ id không còn", async () => {
    const parsed = await parseGiftForm(form(valid()));
    if (!parsed.ok) throw new Error(parsed.error);
    const a = (await make(parsed.data))!;
    const b = (await make({ ...parsed.data, layout: [{ pid: ids["chuoi-gia"], ...at }] }))!;
    const views = await bundleViews([b, "cmgr0x9k10000abcd1234efgh", a]);
    expect(views.map((v) => v.id)).toEqual([b, a]);
    expect(views[1]).toMatchObject({ qty: 1, itemCount: 3, priceVnd: 120000 + 2 * 39000 + 32000, stock: 1, shortNames: [], isWeighed: true });
    expect(views[1].components).toEqual([
      { productId: ids["gio-may-qua-bieu"], qty: 1 },
      { productId: ids["cam-sanh"], qty: 2 },
      { productId: ids["chuoi-gia"], qty: 1 },
    ]);
  });

  test("món trong giỏ không đủ hàng thì stock 0 và nêu tên; món ngừng bán thì bỏ cả giỏ", async () => {
    const id = (await make({ layout: [{ pid: ids["cam-sanh"], ...at }, { pid: ids["cam-sanh"], ...at }], message: "", preview: WEBP }))!;
    const { stock } = await db.product.findUniqueOrThrow({ where: { id: ids["cam-sanh"] } });
    try {
      await db.product.update({ where: { id: ids["cam-sanh"] }, data: { stock: 1 } });
      expect((await bundleViews([id]))[0]).toMatchObject({ stock: 0, shortNames: ["Cam sành"] });
      await db.product.update({ where: { id: ids["cam-sanh"] }, data: { isActive: false } });
      expect(await bundleViews([id])).toEqual([]);
    } finally {
      await db.product.update({ where: { id: ids["cam-sanh"] }, data: { stock, isActive: true } });
    }
  });

  test("bundlePreview trả đúng byte ảnh và kiểu; id lạ trả null", async () => {
    const id = (await make({ layout: [{ pid: ids["cam-sanh"], ...at }], message: "", preview: WEBP }))!;
    const preview = await bundlePreview(id);
    expect(preview?.type).toBe("image/webp");
    expect(preview?.body.toString("base64")).toBe(WEBP.split(",")[1]);
    expect(await bundlePreview("cmgr0x9k10000abcd1234efgh")).toBeNull();
  });
});
