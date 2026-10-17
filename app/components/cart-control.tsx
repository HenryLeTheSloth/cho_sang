import { Minus, Plus } from "lucide-react";
import { type RefObject, useRef } from "react";
import { useAddToCart } from "~/lib/use-cart";

type Props = {
  product: { id: number; name: string; stock: number };
  flyFrom?: RefObject<HTMLImageElement | null>; // ảnh cạnh nút: bay vào giỏ ở lần thêm đầu
  addLabel?: string; // có thì nút + ở trạng thái 0 có chữ (thanh mua trang sản phẩm)
  min?: number; // 0 trên thẻ (− về 0 là xoá), 1 trong drawer (xoá bằng nút thùng rác)
  className?: string;
};

const round = "inline-flex h-11 shrink-0 items-center justify-center rounded-full";

/** Nút + biến thành stepper ngay tại chỗ. Hành vi nằm ở useAddToCart; đây chỉ là một lớp vỏ. */
export function CartControl({ product, flyFrom, addLabel, min = 0, className = "" }: Props) {
  const { qty, max, soldOut, set } = useAddToCart(product, flyFrom);
  const plusRef = useRef<HTMLButtonElement>(null);

  const change = (next: number) => {
    set(next);
    if (next === 0) plusRef.current?.focus(); // nút − sắp biến mất: giữ focus cho bàn phím
  };

  if (soldOut && qty === 0) {
    return (
      <div className={`relative z-10 flex items-center ${className}`}>
        <button type="button" disabled className={`${round} bg-line px-4 text-sm text-ink-muted`}>
          Tạm hết hàng
        </button>
      </div>
    );
  }

  const labelled = qty === 0 && addLabel;
  return (
    <div className={`relative z-10 flex items-center gap-1 ${className}`}>
      {qty > 0 && (
        <>
          <button
            type="button"
            onClick={() => change(qty - 1)}
            disabled={qty <= min}
            aria-label={`Bớt 1 ${product.name}`}
            className={`${round} w-11 border-2 border-ink bg-surface transition-colors duration-150 ease-snappy hover:bg-cta disabled:cursor-not-allowed disabled:border-line disabled:bg-surface`}
          >
            <Minus aria-hidden className="size-5" />
          </button>
          <output aria-live="polite" aria-label={`Số lượng ${product.name}`} className="w-8 text-center font-display font-extrabold tabular-nums">
            {qty}
          </output>
        </>
      )}
      <button
        ref={plusRef}
        type="button"
        onClick={() => change(qty + 1)}
        disabled={qty >= max}
        aria-label={labelled ? undefined : qty === 0 ? `Thêm ${product.name} vào giỏ` : `Thêm 1 ${product.name}`}
        className={`${round} ${labelled ? "btn-cta gap-2 px-6 font-display font-extrabold" : "btn-ink w-11"}`}
      >
        <Plus aria-hidden className="size-5 stroke-[2.6]" />
        {labelled && addLabel}
      </button>
    </div>
  );
}
