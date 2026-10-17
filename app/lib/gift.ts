import { GIFT_PREVIEW_MAX } from "./config";

/**
 * Một món trên canvas giỏ quà (spec mục 5: layout `[{pid,x,y,s,r}]` là nguồn duy nhất).
 * x, y: tâm món theo tỉ lệ 0–1 của khung vuông; s: tỉ lệ so với cỡ lúc mới thêm; r: góc xoay (độ).
 */
export type LayoutItem = { pid: number; x: number; y: number; s: number; r: number };

// Canvas xuất webp; Safari không mã hoá được webp nên trả PNG, client khi đó xuất jpeg (Decision 3)
const PREVIEW = /^data:image\/(?:webp|jpeg);base64,[A-Za-z0-9+/]+={0,2}$/;

/** Ảnh xem trước hợp lệ: đúng tiền tố, base64 sạch, ≤60KB. Kiểm lúc nhận (zod) và lúc phát ảnh (route preview). */
export const isPreview = (s: unknown): s is string => typeof s === "string" && s.length <= GIFT_PREVIEW_MAX && PREVIEW.test(s);

/** Danh sách món suy ra từ layout bằng cách đếm pid (không lưu `items` riêng: spec mục 2). */
export function countItems(layout: { pid: number }[]): Map<number, number> {
  const count = new Map<number, number>();
  for (const { pid } of layout) count.set(pid, (count.get(pid) ?? 0) + 1);
  return count;
}

/** URL ảnh xem trước của một giỏ quà: drawer, checkout, trang đơn chỉ hiện `<img>`, không tải Fabric. */
export const previewUrl = (bundleId: string) => `/gift/preview/${bundleId}`;
