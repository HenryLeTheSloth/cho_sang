import { DELIVERY_SLOTS, SLOT_CAPACITY } from "./config";

const VN_OFFSET_MS = 7 * 60 * 60 * 1000; // Việt Nam UTC+7, không có giờ mùa hè; server có thể chạy UTC
const LEAD_MINUTES = 60; // cần ít nhất 1 giờ soạn hàng trước giờ bắt đầu khung

const pad = (n: number) => String(n).padStart(2, "0");
const inVn = (d: Date) => new Date(d.getTime() + VN_OFFSET_MS);

/** Ngày theo giờ Việt Nam, dạng "2026-10-15" (cộng thêm `addDays` ngày). */
export const vnDate = (now: Date, addDays = 0) => inVn(new Date(now.getTime() + addDays * 86_400_000)).toISOString().slice(0, 10);

/** "09:30 15/10" theo giờ Việt Nam. Chỉ gọi ở loader (chuỗi gửi xuống client, không lệch khi hydrate). */
export function vnDateTimeLabel(d: Date): string {
  const v = inVn(d);
  return `${pad(v.getUTCHours())}:${pad(v.getUTCMinutes())} ${pad(v.getUTCDate())}/${pad(v.getUTCMonth() + 1)}`;
}

export type SlotOption = { value: string; slot: string; disabled: boolean; reason: "past" | "full" | null };
export type DeliveryDay = { date: string; label: string; slots: SlotOption[] };

/**
 * Khung giờ giao hôm nay + ngày mai. Khung đã qua (hoặc bắt đầu trong <1 giờ) và khung đã đủ đơn bị khoá.
 * `taken`: số đơn chưa huỷ theo khoá "YYYY-MM-DD|khung". `value` của radio cũng là khoá đó.
 */
export function deliveryDays(now: Date, taken: Record<string, number>): DeliveryDay[] {
  const vn = inVn(now);
  const minutesNow = vn.getUTCHours() * 60 + vn.getUTCMinutes();
  return [0, 1].map((add) => {
    const date = vnDate(now, add);
    const [, month, day] = date.split("-");
    return {
      date,
      label: `${add === 0 ? "Hôm nay" : "Ngày mai"} ${day}/${month}`,
      slots: DELIVERY_SLOTS.map((slot) => {
        const value = `${date}|${slot}`;
        const start = Number(slot.slice(0, 2)) * 60 + Number(slot.slice(3, 5));
        const reason =
          add === 0 && minutesNow + LEAD_MINUTES > start ? "past" : (taken[value] ?? 0) >= SLOT_CAPACITY ? "full" : null;
        return { value, slot, disabled: reason !== null, reason };
      }),
    };
  });
}

/** Khung mặc định: khung còn mở sớm nhất (đặt lúc 21h thì nhảy sang sáng mai). null = không còn khung nào. */
export const firstOpenSlot = (days: DeliveryDay[]) => days.flatMap((d) => d.slots).find((s) => !s.disabled)?.value ?? null;
