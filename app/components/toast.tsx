import { useEffect, useState } from "react";
import { useLocation, useRouteLoaderData } from "react-router";
import type { loader as rootLoader } from "~/root";

/**
 * Viên toast ở đáy màn hình. `demo` thêm nhãn DEMO (mã OTP giả lập, spec mục 2).
 * Toast không chứa nút nào nên không nhận chạm (dock `pointer-events-none`): chạm xuyên qua tới nút dính đáy bên dưới (D6).
 */
export function Toast({ children, demo = false }: { children: React.ReactNode; demo?: boolean }) {
  return (
    <p className="flex max-w-md items-center gap-2 rounded-2xl bg-ink px-4 py-2.5 text-sm text-surface shadow-lg">
      {demo && (
        <span className="shrink-0 rounded-full border border-surface/60 px-2 text-xs font-display font-extrabold tracking-wide">DEMO</span>
      )}
      <span>{children}</span>
    </p>
  );
}

export const toastDock = "pointer-events-none fixed inset-x-0 bottom-4 z-40 flex justify-center px-4";
// /checkout trên điện thoại: nút "Đặt hàng · …" dính đáy, toast nằm trên nó để vẫn đọc được (D6)
const aboveCheckoutBar = "pointer-events-none fixed inset-x-0 bottom-28 z-40 flex justify-center px-4 md:bottom-4";

/** Thông báo một lần sau action (đặt hàng, đăng nhập, đăng xuất, huỷ…): root loader đọc flash `toast` của phiên. */
export function FlashToast() {
  const toast = useRouteLoaderData<typeof rootLoader>("root")?.toast ?? null;
  const onCheckout = useLocation().pathname === "/checkout";
  const [shown, setShown] = useState(toast?.text ?? null);
  useEffect(() => {
    setShown(toast?.text ?? null);
    if (!toast) return;
    const timer = setTimeout(() => setShown(null), 4000);
    return () => clearTimeout(timer);
  }, [toast?.id]);
  return (
    <div role="status" className={onCheckout ? aboveCheckoutBar : toastDock}>
      {shown && <Toast>{shown}</Toast>}
    </div>
  );
}
