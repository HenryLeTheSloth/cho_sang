import { ChevronRight, LogOut } from "lucide-react";
import { data, Form, Link, redirect } from "react-router";
import { Field } from "~/components/field";
import { formatVnd } from "~/lib/format";
import { parsePhone } from "~/lib/forms.server";
import { findOrderForPhone, listOrders } from "~/lib/orders.server";
import { readForm } from "~/lib/security.server";
import { addGuestOrder, commitSession, getSession, getUser } from "~/lib/session.server";
import type { Route } from "./+types/orders";

export async function loader({ request }: Route.LoaderArgs) {
  const session = await getSession(request);
  const user = await getUser(session);
  const orders = user ? await listOrders({ userId: user.id }) : await listOrders({ codes: session.get("guestOrderCodes") ?? [] });
  return { orders, phone: user?.phone ?? null };
}

/** Tra đơn bằng mã + SĐT. Sai mã hay sai SĐT cùng một lời nhắn. */
export async function action({ request }: Route.ActionArgs) {
  const form = await readForm(request);
  const phone = parsePhone(form.get("phone"));
  const code = String(form.get("code") ?? "");
  const found = phone && code && (await findOrderForPhone(code, phone));
  if (!found) return data({ error: "Không tìm thấy đơn với mã và số điện thoại này." }, { status: 400 });
  const session = await getSession(request);
  addGuestOrder(session, found.code);
  return redirect(`/orders/${found.code}`, { headers: { "Set-Cookie": await commitSession(session) } });
}

export default function Orders({ loaderData, actionData }: Route.ComponentProps) {
  const { orders, phone } = loaderData;
  return (
    <main className="mx-auto max-w-2xl px-4 py-6">
      <title>Đơn hàng · Chợ Sáng</title>
      <h1 className="text-3xl">Đơn hàng của bạn</h1>
      {phone ? (
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
          <p className="text-ink-muted">Đang đăng nhập bằng {phone}</p>
          <Form method="post" action="/logout">
            <input type="hidden" name="redirectTo" value="/orders" />
            <button className="inline-flex min-h-11 items-center gap-2 rounded-full px-3 text-sm transition-colors duration-150 ease-snappy hover:bg-ink/5">
              <LogOut aria-hidden className="size-4" />
              Đăng xuất
            </button>
          </Form>
        </div>
      ) : (
        <p className="mt-2 text-ink-muted">
          Đơn đặt trên máy này hiện ở đây.{" "}
          <Link to="/login?redirectTo=%2Forders" className="hl-link underline underline-offset-4">
            Đăng nhập
          </Link>{" "}
          để xem mọi đơn của số điện thoại bạn.
        </p>
      )}

      {orders.length === 0 ? (
        <p className="mt-6 rounded-2xl border border-line bg-surface p-4">Chưa có đơn nào.</p>
      ) : (
        <ul className="mt-6 space-y-3">
          {orders.map((o) => (
            <li key={o.code}>
              <Link
                to={`/orders/${o.code}`}
                className="flex min-h-11 items-center gap-3 rounded-2xl border border-line bg-surface p-4 transition-colors duration-150 ease-snappy hover:border-ink-muted"
              >
                <div className="min-w-0 flex-1">
                  <p className="font-display font-extrabold tabular-nums">{o.code}</p>
                  <p className="text-sm text-ink-muted">
                    {o.createdAt} · {o.itemCount} món · {o.statusLabel}
                  </p>
                </div>
                <p className="font-display font-extrabold text-price tabular-nums">{formatVnd(o.totalVnd)}</p>
                <ChevronRight aria-hidden className="size-5 text-ink-muted" />
              </Link>
            </li>
          ))}
        </ul>
      )}

      {!phone && (
        <section aria-labelledby="lookup-title" className="mt-8 rounded-2xl border border-line bg-surface p-4">
          <h2 id="lookup-title" className="text-xl">Tra cứu đơn</h2>
          <Form method="post" noValidate className="mt-3 space-y-3">
            <Field name="code" label="Mã đơn" placeholder="VD: DH261015ABCD" autoCapitalize="characters" autoComplete="off" />
            <Field name="phone" label="Số điện thoại đặt hàng" type="tel" inputMode="tel" autoComplete="tel" error={actionData?.error ? [actionData.error] : undefined} />
            <button className="inline-flex min-h-11 items-center rounded-full border border-ink px-5 transition-colors duration-150 ease-snappy hover:bg-ink/5">Tra cứu</button>
          </Form>
        </section>
      )}
    </main>
  );
}
