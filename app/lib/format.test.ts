import { describe, expect, test } from "vitest";
import { formatVnd, pricePerKgLabel, toSearch } from "~/lib/format";

describe("formatVnd", () => {
  test("nhóm nghìn bằng dấu chấm, ký hiệu ₫ dính liền", () => {
    expect(formatVnd(312000)).toBe("312.000₫");
    expect(formatVnd(1250000)).toBe("1.250.000₫");
  });
  test("số 0", () => {
    expect(formatVnd(0)).toBe("0₫");
  });
});

describe("toSearch", () => {
  test("bỏ dấu và viết thường", () => {
    expect(toSearch("Trứng gà ta")).toBe("trung ga ta");
    expect(toSearch("Bưởi Diễn")).toBe("buoi dien");
  });
  test("đ và Đ thành d", () => {
    expect(toSearch("Đậu hũ non")).toBe("dau hu non");
    expect(toSearch("đường mía")).toBe("duong mia");
  });
  test("chuỗi NFD (dấu tổ hợp) cho cùng kết quả", () => {
    expect(toSearch("Sữa tươi".normalize("NFD"))).toBe("sua tuoi");
  });
  test("trim khoảng trắng", () => {
    expect(toSearch("  Rau muống ")).toBe("rau muong");
  });
  test("gộp khoảng trắng liên tiếp", () => {
    expect(toSearch("rau   muống\tnon")).toBe("rau muong non");
  });
});

describe("pricePerKgLabel", () => {
  test("quy ra giá/kg, làm tròn tới 100₫", () => {
    expect(pricePerKgLabel(15000, 300)).toBe("50.000₫/kg");
    expect(pricePerKgLabel(32000, 300)).toBe("106.700₫/kg");
    expect(pricePerKgLabel(189000, 5000)).toBe("37.800₫/kg");
  });
  test("không hiện khi gói đúng 1kg hoặc không có khối lượng", () => {
    expect(pricePerKgLabel(35000, 1000)).toBeNull();
    expect(pricePerKgLabel(39000, null)).toBeNull();
    expect(pricePerKgLabel(39000, undefined)).toBeNull();
    expect(pricePerKgLabel(39000, 0)).toBeNull();
  });
});
