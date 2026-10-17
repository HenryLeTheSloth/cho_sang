import { createCookie } from "react-router";
import { z } from "zod";
import type { BundleOp, CartBundle, CartLine } from "./cart";
import { visible } from "./catalog.server";
import { CART_MAX_BUNDLES, CART_MAX_LINES, CART_MAX_QTY } from "./config";
import { db } from "./db.server";
import { env } from "./env.server";
import { bundleViews } from "./gift.server";

const INT4_MAX = 2147483647; // Product.id là Int của Postgres: pid lớn hơn làm Prisma ném lỗi (spike M2)

/** Cookie riêng cho giỏ, tách khỏi __session nên đăng xuất vẫn giữ giỏ. Có ký: sửa tay là mất chữ ký. */
export const cartCookie = createCookie("cart", {
  path: "/",
  httpOnly: true,
  sameSite: "lax",
  secure: env.COOKIE_SECURE,
  maxAge: 60 * 60 * 24 * 30,
  secrets: [env.SESSION_SECRET],
});

const cartSchema = z.object({
  l: z
    .array(z.tuple([z.int().positive().max(INT4_MAX), z.int().min(1).max(CART_MAX_QTY)]))
    .max(CART_MAX_LINES)
    .refine((lines) => new Set(lines.map(([pid]) => pid)).size === lines.length, "pid trùng"),
  b: z
    .array(z.cuid())
    .max(CART_MAX_BUNDLES)
    .refine((ids) => new Set(ids).size === ids.length, "bundle trùng"), // id GiftBundle (M4)
});

export type Cart = z.infer<typeof cartSchema>;
export const EMPTY_CART: Cart = { l: [], b: [] };

/** Đọc + validate mỗi request. Không có, sai chữ ký hay sai dạng đều thành giỏ rỗng (không ném lỗi). */
export async function readCart(request: Request): Promise<Cart> {
  const parsed = cartSchema.safeParse(await cartCookie.parse(request.headers.get("Cookie")));
  return parsed.success ? parsed.data : EMPTY_CART;
}

const cartForm = z.object({
  intent: z.enum(["set", "remove", "bundle"]),
  pid: z.array(z.coerce.number().int().positive().max(INT4_MAX)).max(CART_MAX_LINES),
  qty: z.array(z.coerce.number().int().min(0).max(CART_MAX_QTY)),
});

/**
 * Form /cart → các cặp [pid, qty tuyệt đối]; intent `remove` = qty 0. Sai dạng trả null.
* `set`/`remove` cần ít nhất 1 pid; `bundle` mang theo các cặp đang chờ (có thể rỗng).
 */
export function parseCartForm(form: FormData): Array<[number, number]> | null {
  const parsed = cartForm.safeParse({ intent: form.get("intent"), pid: form.getAll("pid"), qty: form.getAll("qty") });
  if (!parsed.success) return null;
  const { intent, pid, qty } = parsed.data;
  if ((intent === "set" || intent === "remove") && pid.length === 0) return null;
  if (intent === "remove") return pid.map((id) => [id, 0]);
  return pid.length === qty.length ? pid.map((id, i) => [id, qty[i]]) : null;
}

const bundleForm = z.object({
  remove: z.array(z.cuid()).max(CART_MAX_BUNDLES),
  add: z.array(z.cuid()).max(CART_MAX_BUNDLES), // cả hai rỗng cũng hợp lệ
});

/** Hai danh sách giỏ quà của form /cart (bất kể intent); sai dạng trả null. */
export function parseBundleForm(form: FormData): BundleOp | null {
  const parsed = bundleForm.safeParse({ remove: form.getAll("bundleRemove"), add: form.getAll("bundleAdd") });
  return parsed.success ? parsed.data : null;
}

/** Bỏ `remove` trước, rồi thêm `add` (chỉ GiftBundle có thật, không trùng). Id cũ không còn trong DB được dọn trước khi đếm trần 10. */
export async function setBundles(cart: Cart, op: BundleOp): Promise<Cart | null> {
  const kept = cart.b.filter((id) => !op.remove.includes(id));
  if (op.add.length === 0) return { ...cart, b: kept };
  const b = await liveBundleIds([...new Set([...kept, ...op.add])]);
  return b.length > CART_MAX_BUNDLES ? null : { ...cart, b };
}

/** Các id GiftBundle còn trong DB, giữ thứ tự (id chết sau DB reset bị bỏ, không chiếm trần 10). */
export async function liveBundleIds(ids: string[]): Promise<string[]> {
  if (ids.length === 0) return [];
  const alive = new Set((await db.giftBundle.findMany({ where: { id: { in: ids } }, select: { id: true } })).map((f) => f.id));
  return ids.filter((id) => alive.has(id));
}

/** Ghi số lượng tuyệt đối (0 = xoá). Dòng mới nối cuối, dòng cũ giữ chỗ. Vượt 50 dòng trả null. */
export function setQuantities(cart: Cart, changes: Array<[number, number]>): Cart | null {
  const lines = new Map(cart.l);
  for (const [pid, qty] of changes) {
    if (qty === 0) lines.delete(pid);
    else lines.set(pid, qty);
  }
  return lines.size > CART_MAX_LINES ? null : { ...cart, l: [...lines] };
}

/**
 * Ghép giỏ với DB: giá đọc lại từ DB; món đã xoá, ẩn, hay vỏ giỏ quà bị bỏ qua (roadmap Review Focus 3).
 * `bundles`: các giỏ quà trong cookie `b` (M4), mỗi giỏ một dòng số lượng 1.
 */
export async function getCartView(cart: Cart): Promise<{ lines: CartLine[]; bundles: CartBundle[] }> {
  const [bundles, products] = await Promise.all([
    bundleViews(cart.b),
    cart.l.length === 0
      ? []
      : db.product.findMany({
          where: { ...visible, id: { in: cart.l.map(([pid]) => pid) } },
          select: { id: true, slug: true, name: true, unit: true, priceVnd: true, stock: true, isWeighed: true, images: true },
        }),
  ]);
  const byId = new Map(products.map((p) => [p.id, p]));
  return {
    bundles,
    lines: cart.l.flatMap(([pid, qty]) => {
      const p = byId.get(pid);
      if (!p) return [];
      const { images, ...fields } = p;
      return [{ ...fields, image: images[0], qty }];
    }),
  };
}
