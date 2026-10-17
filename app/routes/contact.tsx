import { Clock, MapPin, MessageCircle, Phone } from "lucide-react";
import { HOTLINE_DISPLAY, HOTLINE_TEL, OPENING_HOURS, STORE_ADDRESS, ZALO_URL } from "~/lib/config";

const action =
  "flex min-h-11 items-center justify-center gap-2 rounded-full px-5 font-display font-extrabold transition-colors duration-150 ease-snappy";

export default function Contact() {
  return (
    <main className="mx-auto max-w-xl space-y-6 px-4 py-8">
      <title>Liên hệ · Chợ Sáng</title>
      <h1 className="text-4xl">Liên hệ</h1>
      <p className="text-sm text-ink-muted">Số điện thoại, Zalo và địa chỉ dưới đây là thông tin demo.</p>

      <div className="grid gap-3 sm:grid-cols-2">
        <a href={`tel:${HOTLINE_TEL}`} className={`btn-cta ${action}`}>
          <Phone aria-hidden className="size-5" /> Gọi {HOTLINE_DISPLAY}
        </a>
        <a href={ZALO_URL} rel="noopener" className={`${action} border border-ink hover:bg-ink hover:text-surface`}>
          <MessageCircle aria-hidden className="size-5" /> Nhắn Zalo
        </a>
      </div>

      <dl className="divide-y divide-line rounded-2xl border border-line bg-surface">
        <div className="p-4">
          <dt className="sr-only">Địa chỉ</dt>
          <dd className="flex gap-3"><MapPin aria-hidden className="size-5 shrink-0 text-ink-muted" />{STORE_ADDRESS}</dd>
        </div>
        <div className="p-4">
          <dt className="sr-only">Giờ mở cửa</dt>
          <dd className="flex gap-3"><Clock aria-hidden className="size-5 shrink-0 text-ink-muted" />{OPENING_HOURS}</dd>
        </div>
      </dl>

      <section aria-labelledby="contact-policy" className="space-y-1">
        <h2 id="contact-policy" className="text-xl">Đổi hàng hỏng</h2>
        <p>Rau héo, trái dập, trứng vỡ: chụp ảnh gửi Zalo trong 24 giờ, chúng tôi đổi mới hoặc hoàn tiền.</p>
      </section>
    </main>
  );
}
