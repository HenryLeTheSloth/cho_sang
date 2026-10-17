import { describe, expect, test } from "vitest";
import { applyPending, type CartLine, cartCount, cartFormData, cartTotals, pendingBundleOp, pendingQuantities } from "~/lib/cart";

const line = (id: number, priceVnd: number, qty: number, stock = 10): CartLine => ({
  id,
  slug: `sp-${id}`,
  name: `SP ${id}`,
  unit: "gói",
  priceVnd,
  stock,
  isWeighed: false,
  image: `products/sp-${id}`,
  qty,
});

describe("cartTotals", () => {
  test("giỏ rỗng: không tính ship, còn thiếu đủ 300.000₫", () => {
    expect(cartTotals([])).toEqual({ subtotalVnd: 0, shippingVnd: 0, totalVnd: 0, toFreeshipVnd: 300000, freeshipPct: 0 });
  });
  test("dưới ngưỡng: cộng ship 20.000₫ và báo số còn thiếu", () => {
    expect(cartTotals([line(1, 15000, 2), line(2, 39000, 1)])).toEqual({
      subtotalVnd: 69000,
      shippingVnd: 20000,
      totalVnd: 89000,
      toFreeshipVnd: 231000,
      freeshipPct: 23,
    });
  });
  test("thiếu 1.000₫ vẫn tính ship", () => {
    expect(cartTotals([line(1, 299000, 1)])).toMatchObject({ shippingVnd: 20000, totalVnd: 319000, toFreeshipVnd: 1000 });
  });
  test("đúng 300.000₫ là freeship", () => {
    expect(cartTotals([line(1, 100000, 3)])).toEqual({ subtotalVnd: 300000, shippingVnd: 0, totalVnd: 300000, toFreeshipVnd: 0, freeshipPct: 100 });
  });
  test("dòng hết hàng không tính tiền", () => {
    expect(cartTotals([line(1, 15000, 2), line(2, 159000, 1, 0)])).toMatchObject({ subtotalVnd: 30000, totalVnd: 50000 });
  });
});

describe("số lượng optimistic", () => {
  test("cartFormData và pendingQuantities đi một vòng giữ nguyên các cặp pid/qty", () => {
    const form = cartFormData(new Map([[3, 2], [7, 0]]));
    expect(form.get("intent")).toBe("set");
    expect([...pendingQuantities(form)]).toEqual([[3, 2], [7, 0]]);
    expect(pendingQuantities(undefined).size).toBe(0);
  });
  test("applyPending ghi đè số lượng, bỏ dòng về 0, giữ thứ tự", () => {
    const lines = [line(1, 1000, 1), line(2, 1000, 1), line(3, 1000, 1)];
    expect(applyPending(lines, new Map([[2, 0], [3, 5]])).map((l) => [l.id, l.qty])).toEqual([[1, 1], [3, 5]]);
  });
  test("cartCount cộng cả món vừa bấm + mà server chưa trả về", () => {
    expect(cartCount([line(1, 1000, 2), line(2, 1000, 1)], new Map([[2, 4], [9, 1]]))).toBe(7);
  });
  test("cartCount không có gì đang chờ thì bằng tổng số lượng", () => {
    expect(cartCount([line(1, 1000, 2), line(2, 1000, 3)], new Map())).toBe(5);
  });
});

describe("giỏ quà (M4)", () => {
  const ID = "cmgr0x9k10000abcd1234efgh";
  test("cartFormData kèm thao tác giỏ quà; pendingBundleOp/pendingQuantities đọc lại đúng", () => {
    const form = cartFormData(new Map([[3, 2]]), { remove: [ID], add: ["cother"] });
    expect(form.get("intent")).toBe("bundle");
    expect(pendingBundleOp(form)).toEqual({ remove: [ID], add: ["cother"] });
    expect([...pendingQuantities(form)]).toEqual([[3, 2]]);
    expect(cartFormData(new Map([[3, 2]])).get("intent")).toBe("set");
    expect(pendingBundleOp(cartFormData(new Map([[3, 2]])))).toEqual({ remove: [], add: [] });
    expect(pendingBundleOp(undefined)).toEqual({ remove: [], add: [] });
  });
  test("giỏ quà tính tiền như một dòng số lượng 1; giỏ có món hết hàng (stock 0) không tính", () => {
    const bundle = (priceVnd: number, stock: number) => ({ priceVnd, qty: 1 as const, stock });
    expect(cartTotals([line(1, 15000, 2), bundle(310000, 1)])).toMatchObject({ subtotalVnd: 340000, shippingVnd: 0 });
    expect(cartTotals([line(1, 15000, 2), bundle(310000, 0)])).toMatchObject({ subtotalVnd: 30000, shippingVnd: 20000 });
  });
});
