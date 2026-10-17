import { Check } from "lucide-react";
import type { CartTotals } from "~/lib/cart";
import { formatVnd } from "~/lib/format";

const BASKET = "M4 16h40l-5 22H9z"; // thân rổ hình thang

/** Rổ SVG đầy dần theo tạm tính (CSS clip-path, màu dạ quang). Con số còn thiếu mới là thứ bán được hàng. */
export function FreeshipBasket({ totals: { freeshipPct, toFreeshipVnd } }: { totals: CartTotals }) {
  return (
    <div className="flex items-center gap-3 border-b border-line px-4 py-3">
      <svg viewBox="0 0 48 40" aria-hidden className="h-10 w-12 shrink-0">
        <path
          d={BASKET}
          className="fill-cta transition-[clip-path] duration-200 ease-snappy"
          style={{ clipPath: `inset(${100 - freeshipPct}% 0 0 0)` }}
        />
        <path
          d={`${BASKET}M14 16l6-12M34 16l-6-12M7 24h34M8 31h32`}
          fill="none"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          className="stroke-ink"
        />
      </svg>
      <p aria-live="polite" className={`flex items-center gap-1.5 text-sm ${toFreeshipVnd > 0 ? "" : "text-fresh"}`}>
        {toFreeshipVnd > 0 ? (
          <>
            Còn <span className="font-display font-extrabold tabular-nums">{formatVnd(toFreeshipVnd)}</span> nữa được freeship
          </>
        ) : (
          <>
            <Check aria-hidden className="size-4" />
            Đã được freeship
          </>
        )}
      </p>
    </div>
  );
}
