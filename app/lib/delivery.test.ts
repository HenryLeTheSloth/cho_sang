import { describe, expect, test } from "vitest";
import { deliveryDays, firstOpenSlot, vnDate, vnDateTimeLabel } from "~/lib/delivery";

const at = (iso: string) => new Date(iso);
const open = (now: Date, taken = {}) =>
  deliveryDays(now, taken).map((d) => [d.label, d.slots.filter((s) => !s.disabled).map((s) => s.slot)]);

describe("deliveryDays", () => {
  test("6:00 sáng: mọi khung hôm nay còn mở, mặc định 08:00–10:00 hôm nay", () => {
    const now = at("2026-10-14T23:00:00Z"); // 06:00 ngày 15/10 giờ VN
    expect(open(now)[0]).toEqual(["Hôm nay 15/10", ["08:00–10:00", "10:00–12:00", "14:00–16:00", "17:00–19:00"]]);
    expect(firstOpenSlot(deliveryDays(now, {}))).toBe("2026-10-15|08:00–10:00");
  });
  test("7:30 sáng: khung 8h còn chưa tới 1 giờ nên bị khoá, ghi lý do 'past'", () => {
    const days = deliveryDays(at("2026-10-15T00:30:00Z"), {});
    expect(days[0].slots[0]).toMatchObject({ slot: "08:00–10:00", disabled: true, reason: "past" });
    expect(firstOpenSlot(days)).toBe("2026-10-15|10:00–12:00");
  });
  test("ranh giới 1 giờ: 07:00 vẫn đặt được khung 08:00; 07:01 thì khung 08:00 'Đã qua' (T3d)", () => {
    expect(deliveryDays(at("2026-10-15T00:00:00Z"), {})[0].slots[0]).toMatchObject({ disabled: false, reason: null });
    expect(deliveryDays(at("2026-10-15T00:01:00Z"), {})[0].slots[0]).toMatchObject({ disabled: true, reason: "past" });
  });
  test("21h: hết khung hôm nay, mặc định nhảy sang 08:00 ngày mai (roadmap Review Focus 5)", () => {
    const days = deliveryDays(at("2026-10-15T14:00:00Z"), {});
    expect(days[0].slots.every((s) => s.reason === "past")).toBe(true);
    expect(days[1].label).toBe("Ngày mai 16/10");
    expect(firstOpenSlot(days)).toBe("2026-10-16|08:00–10:00");
  });
  test("khung đủ 20 đơn bị khoá với lý do 'full'; 19 đơn vẫn mở", () => {
    const now = at("2026-10-14T23:00:00Z");
    const days = deliveryDays(now, { "2026-10-15|08:00–10:00": 20, "2026-10-15|10:00–12:00": 19 });
    expect(days[0].slots[0]).toMatchObject({ disabled: true, reason: "full" });
    expect(days[0].slots[1].disabled).toBe(false);
  });
  test("không còn khung nào thì firstOpenSlot trả null", () => {
    const now = at("2026-10-15T14:00:00Z");
    const full = Object.fromEntries(["08:00–10:00", "10:00–12:00", "14:00–16:00", "17:00–19:00"].map((s) => [`2026-10-16|${s}`, 20]));
    expect(firstOpenSlot(deliveryDays(now, full))).toBeNull();
  });
});

test("ngày/giờ luôn theo giờ Việt Nam dù server chạy UTC", () => {
  expect(vnDate(at("2026-10-14T17:30:00Z"))).toBe("2026-10-15"); // 00:30 sáng 15/10 ở VN
  expect(vnDate(at("2026-10-14T16:59:00Z"))).toBe("2026-10-14");
  expect(vnDate(at("2026-10-14T17:30:00Z"), 1)).toBe("2026-10-16");
  expect(vnDateTimeLabel(at("2026-10-15T02:05:00Z"))).toBe("09:05 15/10");
});
