export const IMAGE_WIDTHS = [320, 640, 1080] as const;
export const IMAGE_FORMATS = ["avif", "webp"] as const;
export type ImageFormat = (typeof IMAGE_FORMATS)[number];

/** key dạng "products/<slug>" (đúng giá trị lưu trong Product.images). */
export const uploadUrl = (key: string, width: number, format: ImageFormat) => `/uploads/${key}-${width}.${format}`;

/** Ảnh tách nền cho giỏ quà: key "products/<slug>-cutout" (Product.cutoutUrl) → một file webp trong suốt. */
export const cutoutSrc = (key: string) => `/uploads/${key}.webp`;

export const imageSrcSet = (key: string, format: ImageFormat) =>
  IMAGE_WIDTHS.map((w) => `${uploadUrl(key, w, format)} ${w}w`).join(", ");
