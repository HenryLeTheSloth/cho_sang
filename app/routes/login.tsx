import { ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";
import { data, Form, redirect, useNavigation } from "react-router";
import { Field } from "~/components/field";
import { Toast, toastDock } from "~/components/toast";
import { signIn, startLogin, verifyLogin } from "~/lib/auth.server";
import { env } from "~/lib/env.server";
import { parsePhone } from "~/lib/forms.server";
import { readForm, safeRedirect } from "~/lib/security.server";
import { commitSession, getSession, getUser } from "~/lib/session.server";
import type { Route } from "./+types/login";

type Step = "phone" | "code" | "passcode";

export async function loader({ request }: Route.LoaderArgs) {
  const url = new URL(request.url);
  const redirectTo = safeRedirect(url.searchParams.get("redirectTo"));
  const session = await getSession(request);
  let headers: HeadersInit | undefined;
  if (session.has("userId")) {
    if (await getUser(session)) throw redirect(redirectTo);
    // userId trỏ tới tài khoản không còn (vd. demo:reset): xoá để vào được form, không bị đẩy ngược lại
    session.unset("userId");
    headers = { "Set-Cookie": await commitSession(session) };
  }
  const otp = session.get("otp");
  const active = otp && Date.now() <= otp.exp ? otp : null;
  const step: Step = !active ? "phone" : active.admin ? "passcode" : "code";
  return data({ step, phone: active?.phone ?? url.searchParams.get("phone") ?? "", redirectTo, demoOtp: env.DEMO_OTP }, { headers });
}

/** intent: `send` (gửi/gửi lại mã), `verify` (nhập mã hoặc passcode quản trị), `restart` (đổi số). */
export async function action({ request }: Route.ActionArgs) {
  const form = await readForm(request);
  const session = await getSession(request);
  const redirectTo = safeRedirect(form.get("redirectTo"));
  const reply = async (body: { step: Step; phone: string; error?: string; demoCode?: string }, status = 200) =>
    data(body, { status, headers: { "Set-Cookie": await commitSession(session) } });

  const intent = form.get("intent");
  if (intent === "restart") {
    session.unset("otp");
    return reply({ step: "phone", phone: "" });
  }
  if (intent === "send") {
    const phone = parsePhone(form.get("phone"));
    if (!phone) return reply({ step: "phone", phone: String(form.get("phone") ?? ""), error: "Số điện thoại cần 10 số, bắt đầu bằng 0." }, 400);
    const started = await startLogin(phone);
    if (!started.ok) return reply({ step: "phone", phone, error: started.error }, 400);
    session.set("otp", started.otp);
    return reply({ step: started.otp.admin ? "passcode" : "code", phone, demoCode: started.demoCode ?? undefined });
  }
  if (intent === "verify") {
    const otp = session.get("otp");
    const result = verifyLogin(otp, String(form.get("code") ?? ""));
    if (!result.ok) {
      if (result.otp) session.set("otp", result.otp);
      else session.unset("otp");
      const step: Step = !result.otp ? "phone" : result.otp.admin ? "passcode" : "code";
      return reply({ step, phone: otp?.phone ?? "", error: result.error }, 400);
    }
    session.unset("otp");
    const userId = await signIn(result.phone, result.viaPasscode);
    if (userId === null) return reply({ step: "phone", phone: "", error: "Không đăng nhập được bằng số này." }, 400);
    session.set("userId", userId);
    session.flash("toast", savingOrder(redirectTo) ? "Đã lưu đơn vào tài khoản" : "Đã đăng nhập");
    return redirect(redirectTo, { headers: { "Set-Cookie": await commitSession(session) } });
  }
  return reply({ step: "phone", phone: "", error: "Yêu cầu không hợp lệ." }, 400);
}

/** Tới từ nút "Lưu đơn vào tài khoản" của trang đơn: gọi đúng tên việc khách đang làm (C6). */
const savingOrder = (redirectTo: string) => redirectTo.startsWith("/orders/");

const primary =
  "btn-cta inline-flex min-h-12 w-full items-center justify-center px-6 font-display font-extrabold disabled:opacity-60";
const link = "hl-link inline-flex min-h-11 items-center px-2 text-sm underline underline-offset-4";

export default function Login({ loaderData, actionData }: Route.ComponentProps) {
  const step = actionData?.step ?? loaderData.step;
  const phone = actionData?.phone ?? loaderData.phone;
  const busy = useNavigation().state === "submitting";
  // Giữ mã DEMO trên màn hình qua các lần nhập sai (server chỉ giữ HMAC, không gửi lại được mã)
  const [demoCode, setDemoCode] = useState<string | null>(actionData?.demoCode ?? null); // có cả khi không JS (SSR)
  useEffect(() => {
    if (actionData?.demoCode) setDemoCode(actionData.demoCode);
  }, [actionData]);
  // Sai mã/số: đưa con trỏ về đúng ô có lỗi (lỗi nằm ngay dưới ô, nối bằng aria-describedby)
  useEffect(() => {
    if (actionData?.error) document.querySelector<HTMLInputElement>("main input[aria-invalid=true]")?.focus();
  }, [actionData]);
  const error = actionData?.error ? [actionData.error] : undefined;
  const hidden = <input type="hidden" name="redirectTo" value={loaderData.redirectTo} />;
  const title = savingOrder(loaderData.redirectTo) ? "Lưu đơn vào tài khoản" : "Đăng nhập";

  return (
    <main className="mx-auto max-w-md px-4 py-8">
      <title>{`${title} · Chợ Sáng`}</title>
      <h1 className="text-3xl">{title}</h1>
      <p className="mt-2 text-ink-muted">Bằng số điện thoại, không cần mật khẩu. Đơn bạn đã đặt bằng số này sẽ tự về tài khoản.</p>

      {step === "phone" ? (
        <Form method="post" noValidate className="mt-6 space-y-4">
          {hidden}
          <Field
            name="phone"
            label="Số điện thoại"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            defaultValue={phone}
            error={error}
            hint={loaderData.demoOtp ? "Bản demo: mã OTP hiện ngay trên màn hình, không gửi SMS." : undefined}
          />
          <button name="intent" value="send" disabled={busy} className={primary}>
            {busy ? "Đang gửi…" : "Gửi mã"}
          </button>
        </Form>
      ) : (
        <Form method="post" noValidate className="mt-6 space-y-4">
          {hidden}
          <input type="hidden" name="phone" value={phone} />
          {step === "passcode" ? (
            <>
              <p className="flex items-start gap-2 text-sm">
                <ShieldCheck aria-hidden className="mt-0.5 size-5 shrink-0" />
                Số {phone} là tài khoản quản trị. Nhập mã quản trị để tiếp tục.
              </p>
              <Field name="code" label="Mã quản trị" type="password" autoComplete="current-password" autoFocus error={error} />
            </>
          ) : (
            <Field
              name="code"
              label={`Mã 6 số gửi tới ${phone}`}
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              pattern="[0-9]*"
              autoFocus
              error={error}
              // Bàn phím iOS che toast ở đáy: nhắc lại mã DEMO ngay dưới ô (D5)
              hint={
                demoCode ? (
                  <>
                    <span className="rounded-full border border-ink px-2 text-xs font-display font-extrabold">DEMO</span> Mã của bạn: <b className="font-display font-extrabold tracking-widest text-ink tabular-nums">{demoCode}</b>
                  </>
                ) : undefined
              }
            />
          )}
          <button name="intent" value="verify" disabled={busy} className={primary}>
            {busy ? "Đang kiểm tra…" : "Đăng nhập"}
          </button>
          <div className="flex flex-wrap justify-between">
            {step === "code" && (
              <button name="intent" value="send" className={link}>
                Gửi lại mã
              </button>
            )}
            <button name="intent" value="restart" className={link}>
              Đổi số điện thoại
            </button>
          </div>
        </Form>
      )}

      {/* Mã OTP giả lập chỉ hiện ở đây, có nhãn DEMO; SĐT admin không bao giờ nhận demoCode */}
      <div role="status" className={toastDock}>
        {demoCode && step === "code" && (
          <Toast demo>
            Mã OTP của bạn: <b className="font-display font-extrabold tracking-widest tabular-nums">{demoCode}</b>
          </Toast>
        )}
      </div>
    </main>
  );
}
