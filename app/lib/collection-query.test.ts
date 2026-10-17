import { describe, expect, test } from "vitest";
import { type CollectionQuery, collectionHref, parseCollectionQuery } from "~/lib/collection-query";

const parse = (qs: string) => parseCollectionQuery(new URLSearchParams(qs));
const DEFAULT: CollectionQuery = { q: "", sort: "relevant", inStock: false, page: 1 };

describe("parseCollectionQuery", () => {
  test("mặc định khi không có tham số", () => {
    expect(parse("")).toEqual(DEFAULT);
  });
  test("đọc đủ tham số hợp lệ", () => {
    expect(parse("q=Trứng&sort=price-asc&instock=1&page=2")).toEqual({ q: "Trứng", sort: "price-asc", inStock: true, page: 2 });
  });
  test("tham số rác về mặc định", () => {
    expect(parse("sort=hack&page=abc&instock=yes")).toEqual(DEFAULT);
    expect(parse("page=-5").page).toBe(1);
    expect(parse("page=2.7").page).toBe(2);
  });
  test("page bị chặn trên ở MAX_PAGE", () => {
    expect(parse("page=99999").page).toBe(20);
  });
  test("q được trim và cắt tối đa 80 ký tự", () => {
    expect(parse("q=%20%20%20").q).toBe("");
    expect(parse(`q=${"a".repeat(200)}`).q).toHaveLength(80);
  });
});

describe("collectionHref", () => {
  const q: CollectionQuery = { q: "trứng", sort: "price-desc", inStock: true, page: 3 };
  test("bỏ giá trị mặc định khỏi URL", () => {
    expect(collectionHref("/collections/all", DEFAULT)).toBe("/collections/all");
  });
  test("đổi bộ lọc thì về trang 1", () => {
    expect(collectionHref("/collections/all", q, { sort: "new" })).toBe("/collections/all?q=tr%E1%BB%A9ng&sort=new&instock=1");
  });
  test("patch page giữ các tham số khác", () => {
    expect(collectionHref("/collections/rau-cu", q, { page: 4 })).toBe("/collections/rau-cu?q=tr%E1%BB%A9ng&sort=price-desc&instock=1&page=4");
  });
});
