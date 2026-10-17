import { Check, CircleAlert, CircleX, Clock, Gift, Phone, RotateCcw } from "lucide-react";
import { data, Form, Link, redirect, useNavigation } from "react-router";
import { Field } from "~/components/field";
import { cartCookie, readCart, setBundles, setQuantities } from "~/lib/cart.server";
import { CART_MAX_BUNDLES, CART_MAX_LINES, HOTLINE_DISPLAY, HOTLINE_TEL } from "~/lib/config";
import { formatVnd } from "~/lib/format";
import { previewUrl } from "~/lib/gift";
import { bundleViews } from "~/lib/gift.server";
import { parsePhone } from "~/lib/forms.server";
import { cancelOrder, findOrderForPhone, getOrder, reorderQuantities, toOrderView } from "~/lib/orders.server";
import { readForm } from "~/lib/security.server";
import { addGuestOrder, canViewOrder, commitSession, getSession } from "~/lib/session.server";
import type { Route } from "./+types/order";

export async function loader({ request, params }: Route.LoaderArgs) {
  const [order, session] = await Promise.all([getOrder(params.code), getSession(request)]);
  // Không có quyền và không tồn tại trả CÙNG một màn (form nhập SĐT): không lộ mã nào là đơn thật (chống IDOR)
  const visible = order && canViewOrder(session, order) ? toOrderView(order) : null;
  return { code: params.code, order: visible, loggedIn: session.has("userId") };
}

const NO_MATCH = "Số điện thoại không khớp với mã đơn này.";

/** intent: lookup (khách nhập SĐT để xem), cancel (huỷ khi còn pending, hoàn kho), reorder ("Mua lại đơn này"). */
export async function action({ request, params }: Route.ActionArgs) {
  const form = await readForm(request);
  const session = await getSession(request);
  const intent = form.get("intent");

  if (intent === "lookup") {
    const phone = parsePhone(form.get("phone"));
    const found = phone && (await findOrderForPhone(params.code, phone));
    if (!found) return data({ error: NO_MATCH }, { status: 400 });
    addGuestOrder(session, found.code);
    return redirect(`/orders/${found.code}`, { headers: { "Set-Cookie": await commitSession(session) } });
  }

  const order = await getOrder(params.code);
  if (!order || !canViewOrder(session, order)) throw new Response("Không tìm thấy đơn hàng.", { status: 404 });

  if (intent === "cancel") {
    const cancelled = await cancelOrder(order.id);
    session.flash("toast", cancelled ? "Đã huỷ đơn" : "Đơn đã được xử lý nên không huỷ được nữa, bạn gọi hotline giúp mình nhé.");
    return redirect(`/orders/${order.code}`, { headers: { "Set-Cookie": await commitSession(session) } });
  }
  if (intent === "reorder") {
    const changes = await reorderQuantities(order.id);
    const withLines = setQuantities(await readCart(request), changes);
    if (!withLines) return data({ error: `Giỏ hàng chỉ chứa tối đa ${CART_MAX_LINES} món khác nhau.` }, { status: 400 });
    // Giỏ quà mua lại nguyên giỏ (cùng bố cục, ảnh, lời chúc; giá đọc lại lúc đặt). Món trong giỏ hết hàng thì checkout báo (M4 Decision 9)
    const ids = order.bundles.map((b) => b.id);
    const cart = await setBundles(withLines, { remove: [], add: ids });
    if (!cart) return data({ error: `Giỏ hàng chỉ chứa tối đa ${CART_MAX_BUNDLES} giỏ quà.` }, { status: 400 });
    // Chỉ đếm giỏ quà giỏ hàng/checkout còn hiện (bỏ giỏ có món ngừng bán), như điều kiện redirect của /checkout
    const added = changes.length + (await bundleViews(ids)).length > 0;
    session.flash("toast", added ? "Đã thêm lại các món vào giỏ" : "Các món trong đơn này đều đã hết hàng");
    const headers = new Headers();
    headers.append("Set-Cookie", await commitSession(session));
    headers.append("Set-Cookie", await cartCookie.serialize(cart));
    // Mọi món đã hết: đi thẳng tới trang sản phẩm (qua /checkout sẽ bị redirect lần nữa và mất toast)
    return redirect(added ? "/checkout" : "/collections/all", { headers });
  }
  return data({ error: "Yêu cầu không hợp lệ." }, { status: 400 });
}

const secondary =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-ink px-5 transition-colors duration-150 ease-snappy hover:bg-ink/5";
const primary =
  "btn-cta inline-flex min-h-11 items-center gap-2 px-5 font-display font-extrabold";

export default function Order({ loaderData, actionData }: Route.ComponentProps) {
  const { code, order, loggedIn } = loaderData;
  const busy = useNavigation().state === "submitting";

  if (!order) {
    return (
      <main className="mx-auto max-w-md px-4 py-8">
        <title>Tra cứu đơn · Chợ Sáng</title>
        <h1 className="text-2xl">Đơn {code}</h1>
        <p className="mt-2 text-ink-muted">Nhập số điện thoại đã dùng khi đặt để xem đơn này.</p>
        <Form method="post" noValidate className="mt-4 space-y-3">
          <Field name="phone" label="Số điện thoại đặt hàng" type="tel" inputMode="tel" autoComplete="tel" error={actionData?.error ? [actionData.error] : undefined} />
          <button name="intent" value="lookup" disabled={busy} className="btn-cta inline-flex min-h-12 w-full items-center justify-center px-6 font-display font-extrabold">
            Xem đơn
          </button>
        </Form>
      </main>
    );
  }

  const step = order.timeline.filter((s) => s.at).length; // số bước đã qua
  const cancelled = order.status === "cancelled";
  const weighed = [...order.items, ...order.bundles.flatMap((b) => b.items)].some((i) => i.isWeighed);
  const StatusIcon = cancelled || order.paymentFailed ? CircleX : order.awaitingPayment ? Clock : Check;
  return (
    <main className="mx-auto max-w-2xl px-4 py-6">
      <title>{`Đơn ${order.code} · Chợ Sáng`}</title>
      {/* Khối trạng thái trước tiên: đã nhận chưa, giao lúc nào (cổng M3 D1). Mã đơn chỉ là dòng phụ */}
      <div className="flex items-start gap-3">
        <StatusIcon aria-hidden className={`mt-1 size-8 shrink-0 ${StatusIcon === Check ? "text-fresh" : ""}`} />
        <div className="min-w-0">
          <h1 className="text-3xl">{order.statusLabel}</h1>
          {!cancelled && <p className="mt-1 font-display text-xl font-extrabold tabular-nums">Giao {order.delivery}</p>}
          <p className="mt-1 text-sm text-ink-muted">
            Mã đơn <span className="tabular-nums">{order.code}</span> · đặt lúc {order.createdAt}
          </p>
        </div>
      </div>

      {cancelled ? (
        <p className="mt-4 rounded-2xl border border-line bg-surface p-4">
          Huỷ lúc {order.cancelledAt}. {order.paymentNote}
        </p>
      ) : (
        order.paymentNote && (
          <p className="mt-4 flex items-center gap-2">
            <Check aria-hidden className="size-5 shrink-0 text-fresh" />
            {order.paymentNote}
          </p>
        )
      )}

      {order.awaitingPayment && (
        <div className="mt-4">
          <Link
            to={`/checkout/pay/${order.code}`}
            className="btn-cta flex min-h-12 w-full items-center justify-center px-6 font-display text-lg font-extrabold"
          >
            Tiếp tục thanh toán · <span className="ml-1 tabular-nums">{formatVnd(order.totalVnd)}</span>
          </Link>
          <p className="mt-1 text-center text-sm text-ink-muted">Thanh toán online (DEMO). Đơn và hàng vẫn được giữ cho bạn.</p>
        </div>
      )}

      {!cancelled && (
        <ol aria-label="Tiến trình đơn hàng" className="mt-6 space-y-0">
          {order.timeline.map((s, i) => (
            <li key={s.label} aria-current={i === step - 1 ? "step" : undefined} className="relative flex gap-3 pb-5 last:pb-0">
              {i < order.timeline.length - 1 && (
                <span aria-hidden className={`absolute top-8 bottom-0 left-[0.9375rem] w-0.5 ${s.at && order.timeline[i + 1].at ? "bg-fresh" : "bg-line"}`} />
              )}
              <span
                aria-hidden
                className={`relative flex size-8 shrink-0 items-center justify-center rounded-full ${s.at ? "bg-fresh text-surface" : "border-2 border-line bg-surface"}`}
              >
                {s.at && <Check className="size-4" />}
              </span>
              <div className="pt-1">
                <p className={s.at ? "" : "text-ink-muted"}>{s.label}</p>
                <p className="text-sm text-ink-muted tabular-nums">{s.at ?? "Chưa tới"}</p>
              </div>
            </li>
          ))}
        </ol>
      )}

      <section aria-labelledby="order-delivery" className="mt-6 rounded-2xl border border-line bg-surface p-4 text-sm">
        <h2 id="order-delivery" className="text-lg">Giao hàng</h2>
        <p className="mt-2">{order.delivery}</p>
        <p>
          {order.customerName} · {order.phone}
        </p>
        <p>{order.address}</p>
        {order.note && <p className="text-ink-muted">Ghi chú: {order.note}</p>}
        <p className="text-ink-muted">{order.callOnSubstitute ? "Shop sẽ gọi hỏi nếu có món hết hàng." : "Món hết hàng sẽ được bỏ ra, không gọi hỏi."}</p>
        <p className="text-ink-muted">{order.paymentMethod === "cod" ? "Trả tiền mặt khi nhận hàng" : "Thanh toán online (DEMO)"}</p>
      </section>

      <section aria-labelledby="order-items" className="mt-4 rounded-2xl border border-line bg-surface p-4 text-sm">
        <h2 id="order-items" className="text-lg">Các món</h2>
        {order.bundles.map((b) => (
          <div key={b.id} className="mt-3 rounded-xl border border-line p-3">
            <div className="flex gap-3">
              <img src={previewUrl(b.id)} alt={`Ảnh giỏ quà ${b.itemCount} món`} width={96} height={96} className="size-24 shrink-0 rounded-lg border border-line object-cover" />
              <div className="min-w-0">
                <h3 className="flex items-center gap-1.5 text-base">
                  <Gift aria-hidden className="size-4 shrink-0" />
                  Giỏ quà · {b.itemCount} món
                </h3>
                {b.message && <p className="mt-1 text-ink-muted">Lời chúc: “{b.message}”</p>}
                <p className="mt-1 font-display font-extrabold tabular-nums">{formatVnd(b.totalVnd)}</p>
              </div>
            </div>
            <ul aria-label={`Trong giỏ quà ${b.itemCount} món`} className="mt-2 divide-y divide-line">
              {b.items.map((i) => (
                <li key={i.id} className="flex justify-between gap-3 py-1.5">
                  <span>
                    {i.name} × {i.qty}{" "}
                    <span className="text-ink-muted">
                      ({i.unit}){i.isWeighed && " · tạm tính ±10%"}
                    </span>
                  </span>
                  <span className="tabular-nums">{formatVnd(i.priceVnd * i.qty)}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
        <ul className="mt-2 divide-y divide-line">
          {order.items.map((i) => (
            <li key={i.id} className="flex justify-between gap-3 py-2">
              <span>
                {i.name} × {i.qty}{" "}
                <span className="text-ink-muted">
                  ({i.unit}){i.isWeighed && " · tạm tính ±10%"}
                </span>
              </span>
              <span className="tabular-nums">{formatVnd(i.priceVnd * i.qty)}</span>
            </li>
          ))}
        </ul>
        <dl className="mt-2 space-y-1 border-t border-line pt-2">
          <div className="flex justify-between">
            <dt>Tạm tính</dt>
            <dd className="tabular-nums">{formatVnd(order.subtotalVnd)}</dd>
          </div>
          <div className="flex justify-between">
            <dt>Phí giao hàng</dt>
            <dd className={`tabular-nums ${order.shippingVnd === 0 ? "font-display font-extrabold text-fresh" : ""}`}>
              {order.shippingVnd === 0 ? "Miễn phí" : formatVnd(order.shippingVnd)}
            </dd>
          </div>
          <div className="flex justify-between text-base">
            <dt className="font-display font-extrabold">Tổng</dt>
            <dd className="font-display font-extrabold text-price tabular-nums">{formatVnd(order.totalVnd)}</dd>
          </div>
        </dl>
        {weighed && <p className="mt-2 text-xs text-ink-muted">Giá tạm tính, cân thực tế ±10%. Shop báo lại số tiền chính xác khi soạn hàng.</p>}
      </section>

      {/* Lời mời lưu tài khoản là phụ, nằm sau biên nhận; đơn đã huỷ thì không mời (D1, D17) */}
      {!loggedIn && !cancelled && (
        <div className="mt-4 rounded-2xl border border-line bg-surface p-4">
          <p className="text-sm">Lưu đơn vào tài khoản để xem lại trên máy khác. Chỉ cần số điện thoại.</p>
          <Link
            to={`/login?phone=${encodeURIComponent(order.phone)}&redirectTo=${encodeURIComponent(`/orders/${order.code}`)}`}
            className={`${secondary} mt-3`}
          >
            Lưu đơn vào tài khoản
          </Link>
        </div>
      )}

      {actionData?.error && (
        <p role="alert" className="mt-4 flex items-start gap-1.5 text-sm text-danger">
          <CircleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
          {actionData.error}
        </p>
      )}

      <div className="mt-6 flex flex-wrap gap-3">
        <Form method="post">
          {/* Magenta chỉ khi đơn đã xong/đã huỷ: đơn vừa đặt mà mời "mua lại" là mời đặt trùng (D3) */}
          <button name="intent" value="reorder" disabled={busy} className={order.status === "done" || cancelled ? primary : secondary}>
            <RotateCcw aria-hidden className="size-5" />
            Mua lại đơn này
          </button>
        </Form>
        {order.status === "pending" && (
          <Form
            method="post"
            onSubmit={(e) => {
              if (!confirm("Huỷ đơn này? Hàng sẽ được trả lại kho.")) e.preventDefault();
            }}
          >
            <button name="intent" value="cancel" disabled={busy} className={secondary}>
              Huỷ đơn
            </button>
          </Form>
        )}
        <a href={`tel:${HOTLINE_TEL}`} className={secondary}>
          <Phone aria-hidden className="size-5" />
          Hotline {HOTLINE_DISPLAY}
        </a>
      </div>
    </main>
  );
}
