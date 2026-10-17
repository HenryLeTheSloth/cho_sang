import { existsSync, statSync } from "node:fs";
import path from "node:path";
import { db } from "~/lib/db.server";
import { ADMIN_PHONE } from "~/lib/config";
import { env } from "~/lib/env.server";
import { toSearch } from "~/lib/format";
import { placeholderImage, saveCutoutImage, saveSquareImage } from "~/lib/images.server";
import { categories, giftBase, products } from "./catalog";

const SOURCE_DIR = "seed/images/products";
const CUTOUT_DIR = "seed/images/cutouts";
const OUT_DIR = path.join(env.UPLOAD_DIR, "products");

/**
 * Ảnh `products/<name>`: xử lý lại khi chưa có output hoặc nguồn mới hơn output.
 * Không có nguồn: dùng `fallback` (placeholder) nếu có, không thì bỏ qua (trả null).
 */
async function ensureImage(name: string, fallback: Buffer | null) {
  const src = path.join(SOURCE_DIR, `${name}.jpg`);
  const out = path.join(OUT_DIR, `${name}-640.webp`);
  const hasSrc = existsSync(src);
  if (!hasSrc && !fallback) return null;
  const upToDate = existsSync(out) && (!hasSrc || statSync(out).mtimeMs >= statSync(src).mtimeMs);
  if (!upToDate) await saveSquareImage(hasSrc ? src : fallback!, OUT_DIR, name);
  return `products/${name}`;
}

/** Ảnh tách nền cho giỏ quà (M4): `products/<slug>-cutout`. Catalog đánh dấu `cutout` mà thiếu PNG thì dừng seed. */
async function ensureCutout(slug: string) {
  const src = path.join(CUTOUT_DIR, `${slug}.png`);
  if (!existsSync(src)) throw new Error(`Thiếu ảnh tách nền ${src} (catalog có cutout: true)`);
  const out = path.join(OUT_DIR, `${slug}-cutout.webp`);
  if (!existsSync(out) || statSync(out).mtimeMs < statSync(src).mtimeMs) await saveCutoutImage(src, OUT_DIR, `${slug}-cutout`);
  return `products/${slug}-cutout`;
}

const categoryIds = new Map<string, number>();
for (const c of categories) {
  const data = { name: c.name, sort: c.sort, image: `products/${c.cover}` };
  const row = await db.category.upsert({ where: { slug: c.slug }, update: data, create: { slug: c.slug, ...data } });
  categoryIds.set(c.slug, row.id);
}

const colorOf = new Map(categories.map((c) => [c.slug, c.color]));
for (const p of [...products, giftBase]) {
  const { category, cutout, ...fields } = p;
  const main = (await ensureImage(p.slug, placeholderImage(p.name, colorOf.get(category)!)))!;
  const cut = await ensureImage(`${p.slug}-cut`, null); // ảnh bổ đôi, chỉ khi có nguồn
  const data = {
    ...fields,
    nameSearch: toSearch(p.name),
    categoryId: categoryIds.get(category)!,
    images: cut ? [main, cut] : [main],
    isGiftBase: p.isGiftBase ?? false,
    cutoutUrl: cutout ? await ensureCutout(p.slug) : null,
  };
  // update chỉ ghi field lấy từ catalog/ảnh (ruling M0): images, nameSearch, cutoutUrl (M4)
  await db.product.upsert({
    where: { slug: p.slug },
    update: {
      images: data.images,
      nameSearch: data.nameSearch,
      cutoutUrl: data.cutoutUrl,
      // ponytail: riêng vỏ giỏ ghi lại unit/description (bỏ chữ "nơ và thiệp" khỏi DB cũ, cổng UI M4 F4);
      // seed lại sẽ đè sửa của admin lên hai field này. Khi M5 cho admin sửa, bỏ dòng này.
      ...(p.isGiftBase ? { unit: data.unit, description: data.description } : {}),
    },
    create: data,
  });
}

// Tài khoản quản trị demo: chỉ đăng nhập được bằng ADMIN_PASSCODE, không bao giờ qua OTP (spec mục 2)
await db.user.upsert({
  where: { phone: ADMIN_PHONE },
  update: { role: "admin" },
  create: { phone: ADMIN_PHONE, role: "admin", name: "Chủ shop (demo)" },
});

console.log(`Seed xong: ${categories.length} danh mục, ${products.length + 1} sản phẩm, 1 tài khoản quản trị.`);
await db.$disconnect();
