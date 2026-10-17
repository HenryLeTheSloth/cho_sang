import { randomBytes } from "node:crypto";
import sharp from "sharp";
import { z } from "zod";
import type { CartBundle } from "./cart";
import { visible } from "./catalog.server";
import { GIFT_MAX_ITEMS, GIFT_MESSAGE_MAX, GIFT_PREVIEW_PX } from "./config";
import { db } from "./db.server";
import { countItems, isPreview, type LayoutItem } from "./gift";

/** Trần body của POST /gift: ảnh xem trước ≤60KB (urlencoded phình thêm vì `+`, `/`, `=`) + layout + lời chúc (cổng M3). */
export const GIFT_FORM_BYTES = 100 * 1024;

const INT4_MAX = 2147483647;

// Mọi lỗi zod ra thẳng cho khách (issues[0].message), nên mỗi ràng buộc đều có lời nhắn tiếng Việt cố định
const BAD_LAYOUT = "Bố cục giỏ quà không hợp lệ.";
const BAD_PREVIEW = "Ảnh xem trước không hợp lệ, bạn thử lại giúp mình nhé.";
const layoutItem = z.object(
  {
    pid: z.int(BAD_LAYOUT).positive(BAD_LAYOUT).max(INT4_MAX, BAD_LAYOUT),
    x: z.number(BAD_LAYOUT).min(0, BAD_LAYOUT).max(1, BAD_LAYOUT),
    y: z.number(BAD_LAYOUT).min(0, BAD_LAYOUT).max(1, BAD_LAYOUT),
    s: z.number(BAD_LAYOUT).min(0.2, BAD_LAYOUT).max(5, BAD_LAYOUT),
    r: z.number(BAD_LAYOUT).min(-360, BAD_LAYOUT).max(360, BAD_LAYOUT),
  },
  BAD_LAYOUT,
);

/**
 * Ảnh xem trước: tiền tố + độ dài (isPreview), rồi đọc header bằng sharp (chỉ đọc header, không giải nén): định dạng phải
 * đúng tiền tố và cả hai cạnh ≤480px. Một webp vài KB có thể khai báo 16383×16383 (≈1GB khi giải nén) và làm treo tab
 * của chủ shop ở trang đơn/admin (cổng plan M4, thay đổi 2).
 */
async function isPreviewImage(s: string): Promise<boolean> {
  if (!isPreview(s)) return false;
  try {
    const { format, width = Infinity, height = Infinity, pages = 1 } = await sharp(Buffer.from(s.slice(s.indexOf(",") + 1), "base64")).metadata();
    // pages > 1: webp động (khách tự gửi) sẽ chạy trên màn hình chủ shop
    return pages <= 1 && format === s.slice("data:image/".length, s.indexOf(";")) && width <= GIFT_PREVIEW_PX && height <= GIFT_PREVIEW_PX;
  } catch {
    return false; // không đọc được header: không phải ảnh
  }
}

const giftForm = z.object({
  layout: z
    .string(BAD_LAYOUT)
    .max(4000, BAD_LAYOUT)
    .transform((s, ctx) => {
      try {
        return JSON.parse(s) as unknown;
      } catch {
        ctx.addIssue({ code: "custom", message: BAD_LAYOUT });
        return z.NEVER;
      }
    })
    .pipe(
      z
        .array(layoutItem, BAD_LAYOUT)
        .min(1, "Bạn chọn ít nhất 1 món cho giỏ quà nhé.")
        .max(GIFT_MAX_ITEMS, `Giỏ quà chứa tối đa ${GIFT_MAX_ITEMS} món.`),
    ),
  // NFC trước khi đếm: chữ Việt gõ trên macOS/iOS có thể là dạng tổ hợp (NFD), dài gấp 2–3 lần
  message: z
    .string(`Lời chúc tối đa ${GIFT_MESSAGE_MAX} ký tự.`)
    .transform((s) => s.normalize("NFC").trim())
    .pipe(z.string().max(GIFT_MESSAGE_MAX, `Lời chúc tối đa ${GIFT_MESSAGE_MAX} ký tự.`)),
  preview: z.string(BAD_PREVIEW).refine(isPreviewImage, BAD_PREVIEW),
});

export type GiftInput = { layout: LayoutItem[]; message: string; preview: string };

/** Form POST /gift → dữ liệu đã kiểm (layout ≤10 món, toạ độ trong khung, lời chúc ≤120, ảnh hợp lệ) hoặc lời nhắn lỗi đầu tiên. */
export async function parseGiftForm(form: FormData): Promise<{ ok: true; data: GiftInput } | { ok: false; error: string }> {
  const parsed = await giftForm.safeParseAsync({
    layout: form.get("layout") ?? "",
    message: form.get("message") ?? "",
    preview: form.get("preview") ?? "",
  });
  return parsed.success ? { ok: true, data: parsed.data } : { ok: false, error: parsed.error.issues[0].message };
}

/** Vỏ giỏ quà (sản phẩm `isGiftBase`, ẩn khỏi collection). */
export const getGiftBase = () =>
  db.product.findFirst({
    where: { isGiftBase: true, isActive: true },
    orderBy: { id: "asc" },
    select: { id: true, name: true, unit: true, priceVnd: true, stock: true },
  });

/** Món xếp được vào giỏ quà: có ảnh tách nền, đang bán, còn hàng. */
export const listGiftItems = () =>
  db.product.findMany({
    where: { ...visible, cutoutUrl: { not: null }, stock: { gt: 0 } },
    orderBy: { id: "asc" },
    select: { id: true, name: true, unit: true, priceVnd: true, cutoutUrl: true },
  });

/**
 * Lưu GiftBundle sau khi kiểm MỌI pid là sản phẩm đang bán, không phải vỏ giỏ, và có ảnh tách nền (spec mục 5).
 * pid lạ / không có cutout / vỏ giỏ hết bán thì trả null, không ghi gì.
 * ponytail: ai cũng tạo được GiftBundle (≤60KB/dòng) không cần đăng nhập; giới hạn tần suất /gift trước khi mở link công khai (M7).
 */
export async function createBundle(input: GiftInput): Promise<string | null> {
  const pids = [...countItems(input.layout).keys()];
  const [base, known] = await Promise.all([
    getGiftBase(),
    db.product.count({ where: { ...visible, cutoutUrl: { not: null }, id: { in: pids } } }),
  ]);
  if (!base || known !== pids.length) return null;
  const { id } = await db.giftBundle.create({
    data: {
      // id là "chìa khoá" xem ảnh /gift/preview/:id: 96 bit ngẫu nhiên an toàn (cuid v1 của Prisma đoán được phần lớn).
      // Vẫn đúng dạng cuid ("c" + chữ thường/số) nên cookie `b` và route ảnh nhận như cũ (cổng plan M4, thay đổi 3)
      id: `c${randomBytes(12).toString("hex")}`,
      baseProductId: base.id,
      layout: input.layout,
      message: input.message,
      preview: input.preview,
    },
    select: { id: true },
  });
  return id;
}

/**
 * Giỏ quà trong cookie `b` → dòng giỏ hàng, giá đọc lại từ DB, giữ thứ tự cookie.
 * Bundle không còn (DB đã reset) hoặc có món/vỏ giỏ ngừng bán thì bỏ cả dòng, như dòng thường (Review Focus 3 roadmap).
 */
export async function bundleViews(ids: string[]): Promise<CartBundle[]> {
  if (ids.length === 0) return [];
  const rows = await db.giftBundle.findMany({
    where: { id: { in: ids } },
    select: { id: true, layout: true, message: true, baseProductId: true },
  });
  const bundles = new Map(rows.map((b) => [b.id, { ...b, counts: countItems(b.layout as LayoutItem[]) }]));
  const pids = new Set(rows.flatMap((b) => [b.baseProductId, ...bundles.get(b.id)!.counts.keys()]));
  const products = await db.product.findMany({
    where: { id: { in: [...pids] }, isActive: true }, // không lọc isGiftBase: vỏ giỏ là sản phẩm ẩn nhưng vẫn bán
    select: { id: true, name: true, priceVnd: true, stock: true, isWeighed: true },
  });
  const byId = new Map(products.map((p) => [p.id, p]));
  return ids.flatMap((id) => {
    const b = bundles.get(id);
    if (!b) return [];
    const components = [{ productId: b.baseProductId, qty: 1 }, ...[...b.counts].map(([productId, qty]) => ({ productId, qty }))];
    if (components.some((c) => !byId.has(c.productId))) return [];
    const short = components.filter((c) => byId.get(c.productId)!.stock < c.qty).map((c) => byId.get(c.productId)!.name);
    return [
      {
        id,
        qty: 1 as const,
        itemCount: (b.layout as LayoutItem[]).length,
        priceVnd: components.reduce((sum, c) => sum + byId.get(c.productId)!.priceVnd * c.qty, 0),
        stock: short.length ? 0 : 1,
        shortNames: short,
        isWeighed: components.some((c) => byId.get(c.productId)!.isWeighed),
        message: b.message,
        components,
      },
    ];
  });
}

/** Ảnh xem trước của một giỏ quà (route /gift/preview/:id). Chỉ trả khi dữ liệu trong DB vẫn đúng tiền tố + kích thước. */
export async function bundlePreview(id: string): Promise<{ type: string; body: Buffer } | null> {
  const row = await db.giftBundle.findUnique({ where: { id }, select: { preview: true } });
  if (!row || !isPreview(row.preview)) return null;
  const comma = row.preview.indexOf(",");
  return { type: row.preview.slice(5, row.preview.indexOf(";")), body: Buffer.from(row.preview.slice(comma + 1), "base64") };
}
