/** Trần body của một form POST. M4 (/gift, ảnh preview ≤60KB) truyền trần lớn hơn qua tham số. */
export const MAX_FORM_BYTES = 16 * 1024;

/**
 * Cổng vào của MỌI action POST (spec: kiểm Origin + giới hạn body).
 * 1. Chặn request từ trang khác (CSRF). RR 8.4 tự kiểm Origin cho route có UI nhưng KHÔNG kiểm resource route
 *    như /cart, /logout (spike M3). Không có cả Origin lẫn Sec-Fetch-Site = không phải trình duyệt (curl, test): cho qua.
 * 2. Đọc body theo luồng và dừng ngay khi vượt trần, nên body chunked không có Content-Length cũng bị chặn.
 * Sai thì ném Response 403/413 (RR đưa lên ErrorBoundary; chỉ kẻ tấn công mới gặp).
 */
export async function readForm(request: Request, maxBytes = MAX_FORM_BYTES): Promise<FormData> {
  const origin = request.headers.get("Origin");
  const site = request.headers.get("Sec-Fetch-Site");
  const crossSite = origin
    ? origin !== new URL(request.url).origin
    : site !== null && site !== "same-origin" && site !== "none";
  if (crossSite) throw new Response("Yêu cầu từ trang khác bị chặn.", { status: 403 });

  const reader = request.body?.getReader();
  const chunks: Uint8Array<ArrayBuffer>[] = [];
  let size = 0;
  while (reader) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > maxBytes) {
      void reader.cancel();
      throw new Response("Dữ liệu gửi lên quá lớn.", { status: 413 });
    }
    chunks.push(value);
  }
  const type = request.headers.get("Content-Type") ?? "";
  return new Response(new Blob(chunks), { headers: { "Content-Type": type } }).formData().catch(() => new FormData());
}

/**
 * `redirectTo` chỉ nhận đường dẫn nội bộ. Dùng chính bộ phân tích URL của trình duyệt nên "//host", "/\host",
 * "/<tab>/host" (trình duyệt bỏ tab rồi hiểu thành "//host") đều về `fallback` (chống open redirect).
 * Kết quả còn bị kiểm lần nữa: "/.//host", "/..//host", "/%2e//host" chuẩn hoá xong thành "//host" (cổng M3).
 */
export function safeRedirect(to: FormDataEntryValue | null | undefined, fallback = "/"): string {
  if (typeof to !== "string" || !to.startsWith("/")) return fallback;
  try {
    const url = new URL(to, "http://n");
    const path = url.pathname + url.search + url.hash;
    return url.origin === "http://n" && !path.startsWith("//") ? path : fallback;
  } catch {
    return fallback; // "//a b" ném Invalid URL: về fallback thay vì 500
  }
}
