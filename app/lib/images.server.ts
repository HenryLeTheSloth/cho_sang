import { mkdir } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { IMAGE_FORMATS, IMAGE_WIDTHS } from "./image-urls";

export { IMAGE_FORMATS, IMAGE_WIDTHS };

/** Cắt vuông (ưu tiên vùng nổi bật) và ghi 3 cỡ × 2 định dạng. */
export async function saveSquareImage(input: Buffer | string, outDir: string, name: string) {
  await mkdir(outDir, { recursive: true });
  const source = sharp(input).rotate(); // xoay theo EXIF của ảnh điện thoại
  await Promise.all(
    IMAGE_WIDTHS.flatMap((w) =>
      IMAGE_FORMATS.map((fmt) =>
        source
          .clone()
          .resize(w, w, { fit: "cover", position: sharp.strategy.attention })
          .toFormat(fmt, { quality: fmt === "avif" ? 50 : 75 })
          .toFile(path.join(outDir, `${name}-${w}.${fmt}`)),
      ),
    ),
  );
}

/** Cạnh dài của ảnh tách nền: món trên canvas ≈120/400 khung (≈100px CSS ở 375px, DPR 3 ≈ 300px) và ô chọn 72px. */
export const CUTOUT_SIZE = 400;

/** Ảnh tách nền (PNG trong suốt) → `<name>.webp` giữ kênh alpha, cắt sát viền trong suốt, cạnh dài 400px. */
export async function saveCutoutImage(input: Buffer | string, outDir: string, name: string) {
  await mkdir(outDir, { recursive: true });
  await sharp(input)
    .trim()
    .resize(CUTOUT_SIZE, CUTOUT_SIZE, { fit: "inside", withoutEnlargement: true })
    .webp({ quality: 80, alphaQuality: 90 })
    .toFile(path.join(outDir, `${name}.webp`));
}

const escapeXml = (s: string) => s.replace(/[&<>"]/g, (c) => `&#${c.charCodeAt(0)};`);

/** Ảnh tạm khi chưa có ảnh nguồn: nền màu danh mục + tên sản phẩm. */
export function placeholderImage(label: string, bg: string): Buffer {
  const lines: string[] = [];
  for (const word of label.split(" ")) {
    const last = lines.length - 1;
    if (last >= 0 && lines[last].length + 1 + word.length <= 16) lines[last] += " " + word;
    else lines.push(word);
  }
  const lineHeight = 86;
  const firstDy = -((lines.length - 1) * lineHeight) / 2;
  const tspans = lines
    .map((line, i) => `<tspan x="50%" dy="${i === 0 ? firstDy : lineHeight}">${escapeXml(line)}</tspan>`)
    .join("");
  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1080">` +
      `<rect width="100%" height="100%" fill="${bg}"/>` +
      `<text x="50%" y="50%" text-anchor="middle" dominant-baseline="middle" font-family="sans-serif" font-size="72" font-weight="700" fill="#2A1B3D">${tspans}</text>` +
      `</svg>`,
  );
}
