import { describe, expect, test } from "vitest";
import { deliveryDays } from "~/lib/delivery";
import { parseCheckoutForm, parsePhone } from "~/lib/forms.server";

const days = deliveryDays(new Date("2026-10-15T14:00:00Z"), { "2026-10-16|10:00–12:00": 20 }); // 21h: chỉ còn ngày mai
const KEY = "0b7c1f2e-8d4a-4c3b-9e6f-1a2b3c4d5e6f";
const form = (fields: Record<string, string>) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(fields)) f.set(k, v);
  return f;
};
const valid = {
  name: "  Lê Thị Đào ",
  phone: "0912 345 678",
  address: "12 Lê Lợi, P. Bến Nghé, Q.1",
  slot: "2026-10-16|08:00–10:00",
  note: "",
  callOnSubstitute: "on",
  paymentMethod: "cod",
  key: KEY,
  total: "50000",
};

describe("parsePhone", () => {
  test.each([
    ["0912345678", "0912345678"],
    ["0912 345 678", "0912345678"],
    ["0912.345.678", "0912345678"],
    ["+84 912 345 678", "0912345678"],
    ["84912345678", "0912345678"],
    ["912345678", null],
    ["09123456789", null],
    ["abc", null],
  ])("%j → %j", (input, expected) => {
    expect(parsePhone(input)).toBe(expected);
  });
});

describe("parseCheckoutForm", () => {
  test("form hợp lệ: tên đã trim, SĐT chuẩn hoá, khung giờ tách thành ngày + khung", () => {
    expect(parseCheckoutForm(form(valid), days)).toEqual({
      ok: true,
      data: {
        customerName: "Lê Thị Đào",
        phone: "0912345678",
        address: "12 Lê Lợi, P. Bến Nghé, Q.1",
        note: "",
        callOnSubstitute: true,
        paymentMethod: "cod",
        deliveryDate: "2026-10-16",
        deliverySlot: "08:00–10:00",
        checkoutKey: KEY,
        expectedTotalVnd: 50000,
      },
    });
  });
  test("thiếu tên, SĐT sai, địa chỉ quá ngắn: lỗi tiếng Việt theo từng field", () => {
    const result = parseCheckoutForm(form({ ...valid, name: " ", phone: "12345", address: "Q1" }), days);
    expect(result).toEqual({
      ok: false,
      errors: {
        name: ["Bạn nhập họ tên người nhận giúp mình nhé."],
        phone: ["Số điện thoại cần 10 số, bắt đầu bằng 0."],
        address: ["Địa chỉ cần có số nhà, đường, phường/xã."],
      },
    });
  });
  test("form trống hoàn toàn vẫn ra lỗi tiếng Việt (không có 'Invalid input')", () => {
    const result = parseCheckoutForm(new FormData(), days);
    expect(JSON.stringify(result)).not.toMatch(/Invalid|expected/);
    expect(result.ok || Object.keys(result.errors).sort()).toEqual(["address", "form", "name", "paymentMethod", "phone", "slot"]);
  });
  test("khung đã qua (hôm nay lúc 21h), khung đã kín, khung bịa: báo chọn khung khác", () => {
    for (const slot of ["2026-10-15|17:00–19:00", "2026-10-16|10:00–12:00", "2030-01-01|08:00–10:00"]) {
      expect(parseCheckoutForm(form({ ...valid, slot }), days)).toEqual({
        ok: false,
        errors: { slot: ["Khung giờ này vừa kín hoặc đã qua, bạn chọn khung khác nhé."] },
      });
    }
  });
  test("không tick 'Gọi hỏi nếu hết hàng' là false; cách thanh toán lạ bị từ chối", () => {
    const off = parseCheckoutForm(form({ ...valid, callOnSubstitute: "", paymentMethod: "online_mock" }), days);
    expect(off.ok && off.data).toMatchObject({ callOnSubstitute: false, paymentMethod: "online_mock" });
    expect(parseCheckoutForm(form({ ...valid, paymentMethod: "momo" }), days)).toMatchObject({ ok: false, errors: { paymentMethod: expect.any(Array) } });
  });
  test("khoá đặt hàng không phải uuid, hoặc tổng tiền ẩn không phải số nguyên ≥0: lỗi chung của form", () => {
    for (const bad of [{ key: "x" }, { total: "" }, { total: "-1" }, { total: "1.5" }]) {
      expect(parseCheckoutForm(form({ ...valid, ...bad }), days)).toEqual({
        ok: false,
        errors: { form: ["Phiên đặt hàng đã cũ, bạn tải lại trang giúp mình nhé."] },
      });
    }
  });
});
