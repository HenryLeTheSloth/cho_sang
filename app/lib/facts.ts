import { formatVnd, pricePerKgLabel } from "./format";

/** Ngưỡng "Chỉ còn N": đủ ít để khách nên mua sớm, đủ nhiều để không hiện trên mọi thẻ. */
const LOW_STOCK = 5;

export type StockState = { state: "in" | "low" | "out"; label: string };

/** Một cách gọi tình trạng kho cho mọi nơi hiển thị (thẻ, trang sản phẩm, drawer, kệ hàng). */
export function stockState(stock: number): StockState {
  if (stock === 0) return { state: "out", label: "Tạm hết hàng" };
  if (stock <= LOW_STOCK) return { state: "low", label: `Chỉ còn ${stock}` };
  return { state: "in", label: "Còn hàng" };
}

type PriceInput = {
  priceVnd: number;
  compareAtVnd?: number | null;
  netGrams?: number | null;
  isWeighed?: boolean;
  stock: number;
};

/**
 * Mọi thứ một chỗ hiển thị giá cần: giá bán, giá cũ, % giảm, giá/kg, ghi chú hàng cân, tình trạng kho.
 * Component chỉ render kết quả, không tự tính lại.
 */
export function priceFacts(p: PriceInput) {
  const compareAt = p.compareAtVnd != null && p.compareAtVnd > p.priceVnd ? p.compareAtVnd : null;
  return {
    price: formatVnd(p.priceVnd),
    compareAt: compareAt != null ? formatVnd(compareAt) : null,
    discountPct: compareAt != null ? Math.round((1 - p.priceVnd / compareAt) * 100) : 0,
    perKg: pricePerKgLabel(p.priceVnd, p.netGrams),
    weighedNote: p.isWeighed ? "Giá tạm tính, cân thực tế ±10%." : null,
    stock: stockState(p.stock),
  };
}

export type PriceFacts = ReturnType<typeof priceFacts>;

/** Bảng thông tin món (nguồn gốc, hạn dùng, bảo quản): trang sản phẩm và khối tin cậy trang chủ dùng chung. */
export function productFacts(p: { origin: string; shelfLife: string; storage: string }) {
  return [
    { label: "Nguồn gốc", value: p.origin },
    { label: "Hạn dùng", value: p.shelfLife },
    { label: "Bảo quản", value: p.storage },
  ];
}
