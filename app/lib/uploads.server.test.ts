import path from "node:path";
import { expect, test } from "vitest";
import { env } from "~/lib/env.server";
import { resolveUpload } from "~/lib/uploads.server";

test("chấp nhận biến thể ảnh hợp lệ", () => {
  expect(resolveUpload("products/rau-muong-640.webp")).toEqual({
    file: path.join(env.UPLOAD_DIR, "products/rau-muong-640.webp"),
    type: "image/webp",
  });
  expect(resolveUpload("products/xoai-cat-hoa-loc-cut-1080.avif")?.type).toBe("image/avif");
  expect(resolveUpload("products/cam-sanh-cutout.webp")).toEqual({
    file: path.join(env.UPLOAD_DIR, "products/cam-sanh-cutout.webp"),
    type: "image/webp",
  }); // ảnh tách nền giỏ quà (M4)
});

test("từ chối path traversal, đuôi lạ, cỡ lạ, thư mục lạ", () => {
  for (const bad of [
    undefined,
    "",
    "../.env",
    "products/../../.env",
    "products/rau-muong-640.jpg",
    "products/rau-muong-500.webp",
    "secret/rau-muong-640.webp",
    "products/Rau-Muong-640.webp",
    "products/rau muong-640.webp",
    "products/cutout.webp",
    "products/cam-sanh-cutout.png",
    "products/cam-sanh-cutout-640.webp/../../.env",
  ]) {
    expect(resolveUpload(bad)).toBeNull();
  }
});
