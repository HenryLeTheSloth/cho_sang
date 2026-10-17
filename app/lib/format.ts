const vnd = new Intl.NumberFormat("vi-VN");

export const formatVnd = (n: number) => `${vnd.format(n)}₫`;

export const toSearch = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[đĐ]/g, "d")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();

/** "50.000₫/kg" để khách so sánh giá giữa các gói; ẩn khi gói đúng 1kg (trùng giá bán). */
export function pricePerKgLabel(priceVnd: number, netGrams: number | null | undefined): string | null {
  if (!netGrams || netGrams === 1000) return null;
  return `${formatVnd(Math.round((priceVnd * 1000) / netGrams / 100) * 100)}/kg`;
}
