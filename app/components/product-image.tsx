import type { Ref } from "react";
import { imageSrcSet, uploadUrl } from "~/lib/image-urls";

type Props = {
  image: string; // key "products/<slug>"
  alt: string;
  sizes: string;
  priority?: boolean; // ảnh LCP: tải ngay, ưu tiên cao
  className?: string;
  ref?: Ref<HTMLImageElement>; // nút thêm giỏ cạnh ảnh dùng để cho ảnh bay vào giỏ
};

export function ProductImage({ image, alt, sizes, priority = false, className = "", ref }: Props) {
  return (
    <picture>
      <source type="image/avif" srcSet={imageSrcSet(image, "avif")} sizes={sizes} />
      <source type="image/webp" srcSet={imageSrcSet(image, "webp")} sizes={sizes} />
      <img
        ref={ref}
        src={uploadUrl(image, 640, "webp")}
        alt={alt}
        width={640}
        height={640}
        loading={priority ? "eager" : "lazy"}
        fetchPriority={priority ? "high" : "auto"}
        decoding="async"
        className={`aspect-square w-full object-cover ${className}`}
      />
    </picture>
  );
}
