import { FREESHIP_FROM_VND, SHIPPING_VND } from "./config";

/** Một dòng giỏ đã ghép dữ liệu DB. Giá luôn đọc lại từ DB, cookie chỉ có [pid, qty]. */
export type CartLine = {
  id: number;
  slug: string;
  name: string;
  unit: string;
  priceVnd: number;
  stock: number;
  isWeighed: boolean; // hàng cân ký: checkout ghi "Giá tạm tính, cân thực tế ±10%"
  image: string; // key "products/<slug>"
  qty: number;
};

/**
 * Một giỏ quà trong giỏ hàng: 1 dòng "Giỏ quà · N món", số lượng cố định 1 (spec mục 2).
 * Cùng dạng `{ priceVnd, qty, stock }` với CartLine nên `cartTotals([...lines, ...bundles])` tính chung.
 */
export type CartBundle = {
  id: string;
  qty: 1;
  itemCount: number; // số món trong layout (không tính vỏ giỏ)
  priceVnd: number; // vỏ giỏ + mọi món, giá đọc lại từ DB
  stock: number; // 1 = đủ hàng; 0 = có món không đủ hàng: không tính vào tổng, như dòng thường (M2 Decision 6)
  shortNames: string[]; // tên các món đang thiếu hàng
  isWeighed: boolean; // có món cân ký: checkout ghi "Giá tạm tính, cân thực tế ±10%"
  message: string;
  components: { productId: number; qty: number }[]; // vỏ giỏ (qty 1) + từng món (qty = số lần có trong layout)
};

/** Thao tác giỏ quà gửi /cart kèm các cặp pid/qty đang chờ (xem useCart). */
export type BundleOp = { remove: string[]; add: string[] };

/** Tạm tính, phí ship, tổng, số tiền còn thiếu và % đã đạt tới freeship. Dòng hết hàng không tính tiền. */
export function cartTotals(lines: { priceVnd: number; qty: number; stock: number }[]) {
  const subtotalVnd = lines.reduce((sum, l) => (l.stock > 0 ? sum + l.priceVnd * l.qty : sum), 0);
  const shippingVnd = subtotalVnd === 0 || subtotalVnd >= FREESHIP_FROM_VND ? 0 : SHIPPING_VND;
  return {
    subtotalVnd,
    shippingVnd,
    totalVnd: subtotalVnd + shippingVnd,
    toFreeshipVnd: Math.max(0, FREESHIP_FROM_VND - subtotalVnd),
    freeshipPct: Math.min(100, (subtotalVnd / FREESHIP_FROM_VND) * 100),
  };
}

export type CartTotals = ReturnType<typeof cartTotals>;

/** Số lượng đang gửi đi (optimistic), đọc từ fetcher.formData: các cặp pid/qty cùng thứ tự. */
export function pendingQuantities(formData: FormData | undefined): Map<number, number> {
  const pending = new Map<number, number>();
  if (!formData) return pending;
  const qtys = formData.getAll("qty");
  formData.getAll("pid").forEach((pid, i) => pending.set(Number(pid), Number(qtys[i])));
  return pending;
}

/** Thao tác giỏ quà đang bay (đọc từ fetcher.formData); mỗi lần gửi mang cả hai danh sách. */
export function pendingBundleOp(formData: FormData | undefined): BundleOp {
  return { remove: formData?.getAll("bundleRemove").map(String) ?? [], add: formData?.getAll("bundleAdd").map(String) ?? [] };
}

/**
 * Form gửi /cart: MỌI cặp pid/qty còn đang chờ (số lượng tuyệt đối) + thao tác giỏ quà nếu có.
 * intent = `set`, hoặc `bundle` khi có thao tác giỏ quà (một lần gửi mang toàn bộ trạng thái đang chờ: cặp pid/qty + hai danh sách).
 */
export function cartFormData(quantities: Map<number, number>, bundleOp: BundleOp = { remove: [], add: [] }): FormData {
  const form = new FormData();
  form.set("intent", bundleOp.remove.length + bundleOp.add.length > 0 ? "bundle" : "set");
  for (const id of bundleOp.remove) form.append("bundleRemove", id);
  for (const id of bundleOp.add) form.append("bundleAdd", id);
  for (const [pid, qty] of quantities) {
    form.append("pid", String(pid));
    form.append("qty", String(qty));
  }
  return form;
}

/** Ghép số lượng đang chờ vào dòng từ server; qty 0 là vừa xoá. */
export function applyPending(lines: CartLine[], pending: Map<number, number>): CartLine[] {
  return lines.map((l) => ({ ...l, qty: pending.get(l.id) ?? l.qty })).filter((l) => l.qty > 0);
}

/** Số trên badge = tổng số lượng, gồm cả món vừa bấm + mà server chưa trả về. */
export function cartCount(lines: { id: number; qty: number }[], pending: Map<number, number>): number {
  const known = new Set(lines.map((l) => l.id));
  let count = lines.reduce((sum, l) => sum + (pending.get(l.id) ?? l.qty), 0);
  for (const [id, qty] of pending) if (!known.has(id)) count += qty;
  return count;
}
