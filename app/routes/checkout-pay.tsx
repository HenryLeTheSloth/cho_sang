import { CircleX, Clock } from "lucide-react";
import { Form, redirect, useNavigation } from "react-router";
import { formatVnd } from "~/lib/format";
import { awaitingPayment, getOrder, isPaymentStep, setOnlinePayment } from "~/lib/orders.server";
import { readForm } from "~/lib/security.server";
import { canViewOrder, commitSession, getSession } from "~/lib/session.server";
import type { Route } from "./+types/checkout-pay";

/** Đơn online còn chờ trả và người xem có quyền; mọi trường hợp khác về trang đơn (trang đó tự hỏi SĐT nếu cần). */
async function payableOrder(request: Request, code: string) {
  const [order, session] = await Promise.all([getOrder(code), getSession(request)]);
  if (!order || !canViewOrder(session, order) || !awaitingPayment(order)) throw redirect(`/orders/${encodeURIComponent(code)}`);
  return { order, session };
}

export async function loader({ request, params }: Route.LoaderArgs) {
  const { order } = await payableOrder(request, params.code);
  return { code: order.code, totalVnd: order.totalVnd, failed: order.paymentStatus === "failed" };
}

/** intent: pay (thành công) | fail (giả lập thất bại) | retry (thử lại) | cod (chuyển sang trả tiền mặt). */
export async function action({ request, params }: Route.ActionArgs) {
  const form = await readForm(request);
  const { order, session } = await payableOrder(request, params.code);
  const step = form.get("intent");
  if (!isPaymentStep(step)) throw new Response("Yêu cầu không hợp lệ.", { status: 400 });
  const changed = await setOnlinePayment(order.id, step);
  if (changed && (step === "fail" || step === "retry")) return redirect(`/checkout/pay/${order.code}`);
  if (changed) session.flash("toast", step === "pay" ? "Thanh toán thành công (DEMO)" : "Đã chuyển sang trả tiền mặt khi nhận hàng");
  return redirect(`/orders/${order.code}`, { headers: { "Set-Cookie": await commitSession(session) } });
}

const primary =
  "btn-cta inline-flex min-h-12 w-full items-center justify-center px-6 font-display font-extrabold disabled:opacity-60";
const secondary =
  "inline-flex min-h-12 w-full items-center justify-center rounded-full border border-ink px-6 transition-colors duration-150 ease-snappy hover:bg-ink/5 disabled:opacity-60";

export default function Pay({ loaderData }: Route.ComponentProps) {
  const { code, totalVnd, failed } = loaderData;
  const busy = useNavigation().state === "submitting";
  return (
    <main className="mx-auto max-w-md px-4 py-6">
      <title>Thanh toán online (DEMO) · Chợ Sáng</title>
      {/* Spec: mọi màn thanh toán giả lập có nhãn DEMO */}
      <p role="note" className="rounded-xl border-2 border-dashed border-ink px-4 py-3 text-center font-display font-extrabold">
        DEMO, không trừ tiền thật
      </p>
      <h1 className="mt-6 text-2xl">Thanh toán đơn {code}</h1>
      <p className="mt-2 font-display text-4xl font-extrabold text-price tabular-nums">{formatVnd(totalVnd)}</p>

      <Form method="post" className="mt-6 space-y-3">
        {failed ? (
          <>
            <p role="alert" className="flex items-start gap-2">
              <CircleX aria-hidden className="mt-0.5 size-5 shrink-0" />
              Thanh toán chưa thành công. Đơn và hàng vẫn được giữ cho bạn.
            </p>
            <button name="intent" value="retry" disabled={busy} className={primary}>
              Thử lại
            </button>
            <button name="intent" value="cod" disabled={busy} className={secondary}>
              Chuyển sang trả tiền mặt (COD)
            </button>
          </>
        ) : (
          <>
            <p className="flex items-center gap-2 text-ink-muted">
              <Clock aria-hidden className="size-5" />
              {busy ? "Đang xử lý thanh toán…" : "Đang chờ bạn xác nhận thanh toán"}
            </p>
            <button name="intent" value="pay" disabled={busy} className={primary}>
              Thanh toán {formatVnd(totalVnd)}
            </button>
            <button name="intent" value="fail" disabled={busy} className={secondary}>
              Giả lập thanh toán thất bại
            </button>
            <button name="intent" value="cod" disabled={busy} className="hl-link inline-flex min-h-11 w-full items-center justify-center text-sm underline underline-offset-4">
              Đổi sang trả tiền mặt khi nhận hàng
            </button>
          </>
        )}
      </Form>
    </main>
  );
}
