import { mkdtemp, readdir, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import sharp from "sharp";
import { afterAll, expect, test } from "vitest";
import { placeholderImage, saveCutoutImage, saveSquareImage } from "~/lib/images.server";

const dirs: string[] = [];
afterAll(() => Promise.all(dirs.map((d) => rm(d, { recursive: true, force: true }))));

test("saveSquareImage ghi 6 biến thể vuông từ ảnh ngang", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "chosang-img-"));
  dirs.push(dir);
  const input = await sharp({
    create: { width: 1200, height: 800, channels: 3, background: "#C8246B" },
  }).png().toBuffer();

  await saveSquareImage(input, dir, "ca-chua");

  expect((await readdir(dir)).sort()).toEqual([
    "ca-chua-1080.avif", "ca-chua-1080.webp",
    "ca-chua-320.avif", "ca-chua-320.webp",
    "ca-chua-640.avif", "ca-chua-640.webp",
  ]);
  const meta = await sharp(path.join(dir, "ca-chua-640.webp")).metadata();
  expect([meta.width, meta.height]).toEqual([640, 640]);
});

test("placeholderImage render được nhãn tiếng Việt và ký tự đặc biệt", async () => {
  const meta = await sharp(placeholderImage("Bưởi Diễn & <Cam>", "#E8F3E6")).metadata();
  expect([meta.width, meta.height]).toEqual([1080, 1080]);
});

test("placeholderImage ngắt nhãn dài thành nhiều dòng", () => {
  const svg = placeholderImage("Nước mắm Phú Quốc 40 độ đạm", "#fff").toString();
  expect(svg.match(/<tspan/g)!.length).toBeGreaterThanOrEqual(2);
});

test("saveCutoutImage: webp giữ nền trong suốt, cắt sát viền trong suốt, cạnh dài 400px (M4)", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "chosang-cut-"));
  dirs.push(dir);
  // 1000×600 trong suốt, giữa có quả tròn bán kính 250 (góc vẫn trong suốt): trim còn 500×500, thu về 400×400
  const input = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="600"><circle cx="500" cy="300" r="250" fill="#FFC83D"/></svg>');
  await saveCutoutImage(input, dir, "cam-sanh-cutout");
  expect(await readdir(dir)).toEqual(["cam-sanh-cutout.webp"]);
  const meta = await sharp(path.join(dir, "cam-sanh-cutout.webp")).metadata();
  expect([meta.format, meta.width, meta.height, meta.hasAlpha]).toEqual(["webp", 400, 400, true]);
});
