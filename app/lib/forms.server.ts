import { z } from "zod";
import type { PaymentMethod } from "~/generated/prisma/client";
import type { DeliveryDay } from "./delivery";

/** "0912 345 678", "0912.345.678", "+84 912 345 678" → "0912345678". */
const normalizePhone = (s: string) => s.replace(/[\s.\-()]/g, "").replace(/^\+?84(?=\d{9}$)/, "0");
export const phoneSchema = z
  .string()
  .transform(normalizePhone)
  .pipe(z.string().regex(/^0\d{9}$/, "Số điện thoại cần 10 số, bắt đầu bằng 0."));

/** SĐT chuẩn hoá, hoặc null nếu sai dạng. */
export const parsePhone = (value: FormDataEntryValue | null) => {
  const parsed = phoneSchema.safeParse(typeof value === "string" ? value : "");
  return parsed.success ? parsed.data : null;
};

const STALE = "Phiên đặt hàng đã cũ, bạn tải lại trang giúp mình nhé.";
const checkoutSchema = z.object({
  name: z.string().trim().min(2, "Bạn nhập họ tên người nhận giúp mình nhé.").max(60, "Họ tên tối đa 60 ký tự."),
  phone: phoneSchema,
  address: z.string().trim().min(10, "Địa chỉ cần có số nhà, đường, phường/xã.").max(300, "Địa chỉ tối đa 300 ký tự."),
  slot: z.string().min(1, "Bạn chọn khung giờ giao giúp mình nhé."),
  note: z.string().trim().max(300, "Ghi chú tối đa 300 ký tự."),
  callOnSubstitute: z.string().transform((v) => v === "on"),
  paymentMethod: z.enum(["cod", "online_mock"], "Bạn chọn cách thanh toán giúp mình nhé."),
  key: z.uuid(STALE),
  // Tổng tiền khách đã thấy trên nút "Đặt hàng · …" (input ẩn); placeOrder đối chiếu trong transaction
  total: z.string().regex(/^\d{1,9}$/, STALE).transform(Number),
});

export type CheckoutField = "name" | "phone" | "address" | "slot" | "note" | "paymentMethod" | "form";
export type CheckoutErrors = Partial<Record<CheckoutField, string[]>>;
export type CheckoutFields = {
  customerName: string;
  phone: string;
  address: string;
  note: string;
  callOnSubstitute: boolean;
  deliveryDate: string;
  deliverySlot: string;
  paymentMethod: PaymentMethod;
  checkoutKey: string;
  expectedTotalVnd: number;
};

/** Validate form checkout ở server (zod). Khung giờ phải là khung đang mở trong `days` (không tin giá trị client gửi). */
export function parseCheckoutForm(
  form: FormData,
  days: DeliveryDay[],
): { ok: true; data: CheckoutFields } | { ok: false; errors: CheckoutErrors } {
  const text = (key: string) => {
    const v = form.get(key);
    return typeof v === "string" ? v : "";
  };
  const parsed = checkoutSchema.safeParse({
    name: text("name"),
    phone: text("phone"),
    address: text("address"),
    slot: text("slot"),
    note: text("note"),
    callOnSubstitute: text("callOnSubstitute"),
    paymentMethod: text("paymentMethod"),
    key: text("key"),
    total: text("total"),
  });
  const { key, total, ...fieldErrors } = parsed.success ? {} : z.flattenError(parsed.error).fieldErrors;
  const stale = key ?? total; // input ẩn sai: lỗi chung của form, không gắn vào field nào
  const errors: CheckoutErrors = { ...fieldErrors, ...(stale && { form: stale }) };
  const open = days.flatMap((d) => d.slots).find((s) => s.value === text("slot") && !s.disabled);
  if (text("slot") && !open) errors.slot = ["Khung giờ này vừa kín hoặc đã qua, bạn chọn khung khác nhé."];
  if (!parsed.success || !open) return { ok: false, errors };
  const { name, slot: _slot, key: checkoutKey, total: expectedTotalVnd, ...rest } = parsed.data;
  const [deliveryDate, deliverySlot] = open.value.split("|");
  return { ok: true, data: { ...rest, customerName: name, deliveryDate, deliverySlot, checkoutKey, expectedTotalVnd } };
}
