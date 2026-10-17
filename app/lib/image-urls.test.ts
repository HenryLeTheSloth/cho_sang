import { expect, test } from "vitest";
import { imageSrcSet, uploadUrl } from "~/lib/image-urls";

test("uploadUrl ghép key + cỡ + định dạng", () => {
  expect(uploadUrl("products/rau-muong", 640, "webp")).toBe("/uploads/products/rau-muong-640.webp");
});

test("imageSrcSet liệt kê đủ 3 cỡ", () => {
  expect(imageSrcSet("products/rau-muong", "avif")).toBe(
    "/uploads/products/rau-muong-320.avif 320w, /uploads/products/rau-muong-640.avif 640w, /uploads/products/rau-muong-1080.avif 1080w",
  );
});
