import { Banknote, CircleAlert, CreditCard, Gift } from "lucide-react";
import { useEffect } from "react";
import { data, Form, redirect, type ShouldRevalidateFunction, useNavigation } from "react-router";
import { Field } from "~/components/field";
import { cartTotals } from "~/lib/cart";
import type { CartBundle, CartLine } from "~/lib/cart";
import { cartCookie, EMPTY_CART, getCartView, readCart } from "~/lib/cart.server";
import { deliveryDays, firstOpenSlot } from "~/lib/delivery";
import { type CheckoutErrors, parseCheckoutForm } from "~/lib/forms.server";
import { formatVnd } from "~/lib/format";
import { previewUrl } from "~/lib/gift";
import { checkoutPrefill, orderForKey, type PlaceOrderResult, placeOrder, takenSlots } from "~/lib/orders.server";
import { readForm } from "~/lib/security.server";
import { addGuestOrder, type AppSession, commitSession, getSession, getUser } from "~/lib/session.server";
import type { Route } from "./+types/checkout";

export async function loader({ request }: Route.LoaderArgs) {
  const [cart, session] = await Promise.all([readCart(request), getSession(request)]);
  const { lines, bundles } = await getCartView(cart);
  if (lines.length + bundles.length === 0) throw redirect("/collections/all"); // spec: giỏ rỗng thì redirect
  const now = new Date();
  const [taken, prefill] = await Promise.all([takenSlots(now), checkoutPrefill(session)]);
  const days = deliveryDays(now, taken);
  return {
    lines,
    bundles,
    totals: cartTotals([...lines, ...bundles]), // giỏ quà là một dòng số lượng 1, cùng hàm tính với drawer và transaction
    days,
    defaultSlot: firstOpenSlot(days),
    prefill,
    // Khoá chống đặt trùng: mỗi lần trang được tải là một khoá; gửi form 2 lần với cùng khoá chỉ ra 1 đơn
    checkoutKey: crypto.randomUUID(),
  };
}

/** Lời nhắn 409: món thiếu kho (tên + số còn), món vừa hết trong giỏ, hoặc giá/giỏ vừa đổi so với tổng đã thấy. */
function conflictMessage(result: Exclude<PlaceOrderResult, { ok: true }>, lines: CartLine[], bundles: CartBundle[]): string {
  if (result.reason === "out-of-stock") {
    // Món nằm trong giỏ quà: nói rõ, vì khách không thấy tên món đó trong danh sách dòng thường
    const inGift = new Set(bundles.flatMap((b) => b.components.map((c) => c.productId)));
    return (
      result.outOfStock
        .map((i) => {
          const name = inGift.has(i.productId) ? `${i.name} (có trong giỏ quà)` : i.name;
          return i.available > 0 ? `${name} chỉ còn ${i.available} ${i.unit}.` : `${name} vừa hết hàng.`;
        })
        .join(" ") + " Bạn sửa giỏ hàng rồi đặt lại nhé."
    );
  }
  const soldOut = [
    ...lines.filter((l) => l.stock === 0).map((l) => `${l.name} vừa hết hàng.`),
    ...bundles.filter((b) => b.stock === 0).map((b) => `Giỏ quà có món vừa hết hàng (${b.shortNames.join(", ")}).`),
  ];
  return soldOut.length
    ? `${soldOut.join(" ")} Tổng tiền đã cập nhật, bạn xem lại rồi đặt lại nhé.`
    : "Giá hoặc giỏ hàng vừa thay đổi, bạn xem lại tổng tiền rồi đặt lại nhé.";
}

export async function action({ request }: Route.ActionArgs) {
  const form = await readForm(request);
  const session = await getSession(request);
  // Đếm khung giờ TRƯỚC khi tra khoá (Kết quả M3): tra khoá sau đếm thì đơn đầu đã commit lúc đếm chắc chắn được
  // tra thấy, không còn khe vài ms để lần gửi lại bị báo "khung đã kín"
  const now = new Date();
  const taken = await takenSlots(now);
  // Gửi lại cùng khoá (bấm 2 lần, mạng thử lại, Back rồi gửi): về đúng đơn cũ TRƯỚC mọi kiểm tra form/khung giờ,
  // vì chính đơn đầu có thể vừa lấp chỗ cuối của khung (cổng M3 I1)
  const existing = await orderForKey(form.get("key"));
  if (existing) return placed(existing, session);

  const parsed = parseCheckoutForm(form, deliveryDays(now, taken));
  if (!parsed.ok) return data({ errors: parsed.errors }, { status: 400 });

  // Dòng hết hàng (stock 0) không vào đơn và không tính tiền, giống drawer (M2 Decision 6). Giỏ quà vào đơn thành
  // các dòng có `bundleId`: vỏ giỏ + từng món (spec mục 5); placeOrder gộp số lượng theo sản phẩm để trừ kho
  const { lines, bundles } = await getCartView(await readCart(request));
  const result = await placeOrder({
    ...parsed.data,
    userId: (await getUser(session))?.id ?? null, // userId cũ trỏ tới tài khoản đã xoá thì đặt như khách (FK)
    lines: [
      ...lines.filter((l) => l.stock > 0).map((l) => ({ productId: l.id, qty: l.qty })),
      ...bundles.filter((b) => b.stock > 0).flatMap((b) => b.components.map((c) => ({ ...c, bundleId: b.id }))),
    ],
  });
  if (!result.ok) {
    return data({ errors: { form: [conflictMessage(result, lines, bundles)] } satisfies CheckoutErrors, conflict: true }, { status: 409 });
  }
  return placed({ code: result.code, paymentMethod: parsed.data.paymentMethod }, session);
}

/** Đặt xong (hoặc gửi lại form của đơn đã đặt): phiên nhớ mã đơn + toast, xoá giỏ, sang trang đơn hoặc cổng thanh toán. */
async function placed(order: { code: string; paymentMethod: string }, session: AppSession) {
  addGuestOrder(session, order.code);
  const online = order.paymentMethod === "online_mock";
  session.flash("toast", online ? "Đã tạo đơn, mời bạn thanh toán" : "Đặt hàng thành công");
  const headers = new Headers();
  headers.append("Set-Cookie", await commitSession(session));
  headers.append("Set-Cookie", await cartCookie.serialize(EMPTY_CART)); // xoá cả dòng thường lẫn giỏ quà: không đặt lại lần nữa
  return redirect(online ? `/checkout/pay/${order.code}` : `/orders/${order.code}`, { headers });
}

// RR bỏ revalidate khi action trả ≥400. Riêng 400 (khung giờ vừa kín) và 409 (giỏ/giá vừa đổi) thì tải lại tóm tắt + nút tổng tiền mới;
// các ô đã nhập không mất vì input không điều khiển (uncontrolled).
export const shouldRevalidate: ShouldRevalidateFunction = ({ actionStatus, defaultShouldRevalidate }) =>
  actionStatus === 400 || actionStatus === 409 || defaultShouldRevalidate;

const chip =
  "flex min-h-11 flex-wrap cursor-pointer items-center gap-2 rounded-xl border border-line bg-surface px-3 py-2 text-sm transition-colors duration-150 ease-snappy hover:border-ink-muted has-checked:border-ink has-checked:bg-ink/5 has-disabled:cursor-not-allowed has-disabled:opacity-50 has-disabled:hover:border-line has-focus-visible:outline-2 has-focus-visible:outline-ink";

export default function Checkout({ loaderData, actionData }: Route.ComponentProps) {
  const { lines, bundles, totals, days, defaultSlot, prefill, checkoutKey } = loaderData;
  const errors: CheckoutErrors = actionData?.errors ?? {};
  const submitting = useNavigation().state === "submitting";
  const orderable = [...lines, ...bundles].filter((l) => l.stock > 0);
  const weighed = orderable.some((l) => l.isWeighed);
  const openDrawer = () => document.querySelector<HTMLDialogElement>("#cart-drawer")?.showModal();

  // Bấm nút dính đáy mà lỗi nằm ở đầu trang (375px): cuộn tới lỗi đầu tiên và đặt focus vào field đó
  useEffect(() => {
    if (!actionData?.errors) return;
    const first = document.querySelector<HTMLElement>("main [role=alert], main [aria-invalid=true]");
    first?.scrollIntoView({ block: "center" });
    if (first instanceof HTMLInputElement || first instanceof HTMLTextAreaElement) first.focus();
  }, [actionData]);

  return (
    <main className="mx-auto max-w-5xl px-4 py-6">
      <title>Đặt hàng · Chợ Sáng</title>
      <h1 className="text-3xl">Đặt hàng</h1>
      <p className="mt-1 text-ink-muted">Không cần tài khoản. Giao trong ngày, trả tiền khi nhận hàng.</p>

      {errors.form && (
        <div role="alert" className="mt-4 flex items-start gap-2 rounded-xl border border-danger/30 bg-surface p-3 text-sm text-danger">
          <CircleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
          <div>
            <p>{errors.form[0]}</p>
            {actionData && "conflict" in actionData && (
              <button type="button" onClick={openDrawer} className="hl-link mt-1 inline-flex min-h-11 items-center text-ink underline underline-offset-4">
                Sửa giỏ hàng
              </button>
            )}
          </div>
        </div>
      )}

      <Form method="post" noValidate className="mt-6 grid gap-8 md:grid-cols-[1fr_22rem] md:items-start">
        <input type="hidden" name="key" value={checkoutKey} />
        {/* Tổng khách đang thấy trên nút: server chỉ đặt đơn nếu tổng tính lại trong transaction bằng đúng số này */}
        <input type="hidden" name="total" value={totals.totalVnd} />
        <div className="space-y-8">
          <fieldset className="space-y-4">
            <legend className="mb-3 font-display text-xl font-extrabold">Người nhận</legend>
            <Field name="name" label="Họ tên" autoComplete="name" required defaultValue={prefill?.name} error={errors.name} />
            <Field name="phone" label="Số điện thoại" type="tel" inputMode="tel" autoComplete="tel" required defaultValue={prefill?.phone} error={errors.phone} />
            <Field
              multiline
              name="address"
              label="Địa chỉ giao hàng"
              rows={3}
              autoComplete="street-address"
              required
              defaultValue={prefill?.address}
              hint="Số nhà, đường, phường/xã, quận/huyện"
              error={errors.address}
            />
          </fieldset>

          <fieldset aria-describedby={errors.slot ? "slot-error" : undefined}>
            <legend className="mb-3 font-display text-xl font-extrabold">Giờ giao</legend>
            <div className="space-y-4">
              {/* Mỗi ngày một fieldset/legend: trình đọc màn hình đọc "Hôm nay 15/10, 14:00–16:00", không nhầm ngày (D7).
                  Khung "Đã qua" không hiện (D8); "Đã kín" vẫn hiện vì có thông tin */}
              {days.map((day) => {
                const slots = day.slots.filter((s) => s.reason !== "past");
                return (
                  <fieldset key={day.date}>
                    <legend className="mb-2 text-sm text-ink-muted">{day.label}</legend>
                    {slots.length === 0 ? (
                      <p className="text-sm text-ink-muted">Hôm nay đã hết giờ giao.</p>
                    ) : (
                      <div className="grid grid-cols-2 gap-2">
                        {slots.map((s) => (
                          <label key={s.value} className={chip}>
                            <input type="radio" name="slot" value={s.value} disabled={s.disabled} defaultChecked={s.value === defaultSlot} className="size-4 accent-ink" />
                            <span className="whitespace-nowrap tabular-nums">{s.slot}</span>
                            {s.reason && <span className="w-full pl-6 text-xs text-ink-muted">Đã kín</span>}
                          </label>
                        ))}
                      </div>
                    )}
                  </fieldset>
                );
              })}
            </div>
            {!defaultSlot && <p className="mt-2 text-sm">Hôm nay và ngày mai đã kín lịch giao. Bạn gọi hotline để hẹn giờ nhé.</p>}
            {errors.slot && (
              <p id="slot-error" role="alert" className="mt-2 flex items-start gap-1.5 text-sm text-danger">
                <CircleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
                {errors.slot[0]}
              </p>
            )}
          </fieldset>

          <div className="space-y-4">
            <Field multiline name="note" label="Ghi chú cho shipper (không bắt buộc)" rows={2} maxLength={300} error={errors.note} />
            <label className="flex min-h-11 cursor-pointer items-center gap-3">
              <input type="checkbox" name="callOnSubstitute" defaultChecked className="size-5 accent-ink" />
              Gọi hỏi tôi nếu có món hết hàng
            </label>
          </div>

          <fieldset>
            <legend className="mb-3 font-display text-xl font-extrabold">Thanh toán</legend>
            <div className="grid gap-2">
              <label className={chip}>
                <input type="radio" name="paymentMethod" value="cod" defaultChecked className="size-4 accent-ink" />
                <Banknote aria-hidden className="size-5" />
                Tiền mặt khi nhận hàng (COD)
              </label>
              <label className={chip}>
                <input type="radio" name="paymentMethod" value="online_mock" className="size-4 accent-ink" />
                <CreditCard aria-hidden className="size-5" />
                Thanh toán online
                <span className="ml-auto rounded-full border border-ink px-2 text-xs font-display font-extrabold">DEMO</span>
              </label>
            </div>
            {errors.paymentMethod && (
              <p role="alert" className="mt-2 flex items-start gap-1.5 text-sm text-danger">
                <CircleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
                {errors.paymentMethod[0]}
              </p>
            )}
          </fieldset>
        </div>

        {/* Điện thoại: `contents` để nút dính đáy suốt cả form. Máy tính: tóm tắt + nút dính cột phải */}
        <div className="contents md:sticky md:top-20 md:block md:space-y-4">
          <aside aria-labelledby="checkout-summary" className="rounded-2xl border border-line bg-surface p-4">
            <h2 id="checkout-summary" className="text-xl">
              Đơn hàng ({orderable.reduce((n, l) => n + l.qty, 0)} món)
            </h2>
            <ul className="mt-3 divide-y divide-line text-sm">
              {bundles.map((b) => (
                <li key={b.id} className="flex items-center justify-between gap-3 py-2">
                  <img src={previewUrl(b.id)} alt="" width={48} height={48} className={`size-12 shrink-0 rounded-lg border border-line object-cover ${b.stock === 0 ? "opacity-60 grayscale" : ""}`} />
                  <div className="min-w-0 flex-1">
                    <p className={`flex items-center gap-1.5 ${b.stock === 0 ? "text-ink-muted line-through" : ""}`}>
                      <Gift aria-hidden className="size-4 shrink-0" />
                      Giỏ quà · {b.itemCount} món
                    </p>
                    <p className="text-xs text-ink-muted">
                      {b.stock === 0 ? `Tạm hết ${b.shortNames.join(", ")}, không tính vào đơn` : b.message ? `“${b.message}”` : "Gồm vỏ giỏ và các món đã chọn"}
                    </p>
                  </div>
                  <p className={`shrink-0 tabular-nums ${b.stock === 0 ? "text-ink-muted line-through" : ""}`}>{formatVnd(b.priceVnd)}</p>
                </li>
              ))}
              {lines.map((l) => (
                <li key={l.id} className="flex justify-between gap-3 py-2">
                  <div className="min-w-0">
                    <p className={l.stock === 0 ? "text-ink-muted line-through" : ""}>
                      {l.name} × {l.qty}
                    </p>
                    <p className="text-xs text-ink-muted">
                      {l.stock === 0 ? "Tạm hết hàng, không tính vào đơn" : `${l.unit}${l.isWeighed ? " · tạm tính ±10%" : ""}`}
                    </p>
                  </div>
                  <p className={`shrink-0 tabular-nums ${l.stock === 0 ? "text-ink-muted line-through" : ""}`}>{formatVnd(l.priceVnd * l.qty)}</p>
                </li>
              ))}
            </ul>
            <dl className="mt-3 space-y-1 border-t border-line pt-3 text-sm">
              <div className="flex justify-between">
                <dt>Tạm tính</dt>
                <dd className="tabular-nums">{formatVnd(totals.subtotalVnd)}</dd>
              </div>
              <div className="flex justify-between">
                <dt>Phí giao hàng</dt>
                <dd className={`tabular-nums ${totals.shippingVnd === 0 ? "font-display font-extrabold text-fresh" : ""}`}>
                  {totals.shippingVnd === 0 ? "Miễn phí" : formatVnd(totals.shippingVnd)}
                </dd>
              </div>
              <div className="flex justify-between text-base">
                <dt className="font-display font-extrabold">Tổng</dt>
                <dd className="font-display font-extrabold text-price tabular-nums">{formatVnd(totals.totalVnd)}</dd>
              </div>
            </dl>
            {weighed && <p className="mt-2 text-xs text-ink-muted">Giá tạm tính, cân thực tế ±10%. Shop báo lại số tiền chính xác khi soạn hàng.</p>}
          </aside>

          {/* Nút đặt hàng dính đáy trên điện thoại: luôn thấy tổng tiền */}
          <div className="sticky bottom-0 -mx-4 border-t border-line bg-bg/95 px-4 py-3 backdrop-blur md:static md:mx-0 md:border-0 md:bg-transparent md:p-0">
            <button
              type="submit"
              disabled={submitting || orderable.length === 0 || !defaultSlot}
              className="btn-cta flex min-h-12 w-full items-center justify-center px-6 font-display text-lg font-extrabold"
            >
              {submitting ? "Đang đặt hàng…" : <>Đặt hàng · <span className="ml-1 tabular-nums">{formatVnd(totals.totalVnd)}</span></>}
            </button>
            <p className="mt-1 text-center text-xs text-ink-muted md:hidden">
              {totals.shippingVnd === 0 ? "Miễn phí giao" : `Gồm phí giao ${formatVnd(totals.shippingVnd)}`}
            </p>
          </div>
        </div>
      </Form>
    </main>
  );
}
