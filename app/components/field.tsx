import { CircleAlert } from "lucide-react";
import type { InputHTMLAttributes, ReactNode, TextareaHTMLAttributes } from "react";

export const inputClass =
  "w-full rounded-xl border border-line bg-surface px-3 py-2.5 text-base transition-colors duration-150 ease-snappy placeholder:text-ink-muted hover:border-ink-muted aria-invalid:border-danger";

type Common = { name: string; label: string; error?: string[]; hint?: ReactNode };
type Props =
  | (Common & { multiline?: false } & Omit<InputHTMLAttributes<HTMLInputElement>, "name">)
  | (Common & { multiline: true } & Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "name">);

/** Label luôn hiện + lỗi inline ngay dưới field (icon + chữ, màu danger), nối bằng aria-describedby (spec mục 4). */
export function Field({ name, label, error, hint, ...props }: Props) {
  const id = `f-${name}`;
  const describedBy = [hint && `${id}-hint`, error?.length && `${id}-error`].filter(Boolean).join(" ") || undefined;
  const shared = { id, name, "aria-invalid": error?.length ? true : undefined, "aria-describedby": describedBy, className: inputClass };
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-sm">
        {label}
      </label>
      {props.multiline ? (
        <textarea {...shared} {...withoutMultiline(props)} />
      ) : (
        <input {...shared} {...withoutMultiline(props)} className={`${inputClass} min-h-11`} />
      )}
      {hint && (
        <p id={`${id}-hint`} className="mt-1 text-sm text-ink-muted">
          {hint}
        </p>
      )}
      {error?.length ? (
        <p id={`${id}-error`} className="mt-1 flex items-start gap-1.5 text-sm text-danger">
          <CircleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
          {error[0]}
        </p>
      ) : null}
    </div>
  );
}

function withoutMultiline<T extends { multiline?: boolean }>({ multiline: _, ...rest }: T) {
  return rest;
}
