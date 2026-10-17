import { bundlePreview } from "~/lib/gift.server";
import type { Route } from "./+types/gift-preview";

/**
 * Ảnh xem trước của giỏ quà cho drawer, checkout, trang đơn (và admin M5): chỉ là `<img>`, không tải Fabric.
 * id GiftBundle là cuid chỉ nằm trong cookie giỏ (ký, httpOnly) và đơn của người đó; GiftBundle không đổi sau khi tạo
 * nên cache lâu được. Dữ liệu trong DB được kiểm lại tiền tố + kích thước trước khi phát (cổng M3).
 */
export async function loader({ params }: Route.LoaderArgs) {
  const preview = /^c[a-z0-9]{20,32}$/.test(params.id) ? await bundlePreview(params.id) : null;
  if (!preview) return new Response("Không tìm thấy", { status: 404 });
  return new Response(new Uint8Array(preview.body), {
    headers: {
      "Content-Type": preview.type,
      "Cache-Control": "private, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff", // byte do khách gửi lên, phát từ chính origin của shop
    },
  });
}
