import { Link } from "react-router";
import {
  DELIVERY_SLOTS,
  FREESHIP_FROM_VND,
  HOTLINE_DISPLAY,
  HOTLINE_TEL,
  OPENING_HOURS,
  SHIPPING_VND,
  STORE_ADDRESS,
  ZALO_URL,
} from "~/lib/config";
import { formatVnd } from "~/lib/format";

// py-2.5 + dòng 24px = vùng bấm 44px; nét dạ quang (hl-link) chỉ nằm trong dòng chữ
const link = "hl-link inline-block py-2.5";

/** Tấm bảng hiệu carton trên nền mực: thông tin cửa hàng, khung giờ giao, link trang phụ. */
export function SiteFooter() {
  return (
    <footer className="mt-6 bg-ink pt-10 pb-7 text-on-ink">
      <div className="mx-auto max-w-6xl px-4">
        <div className="carton grid gap-7 px-5 pt-7 pb-6 text-ink md:grid-cols-[1fr_1.6fr] md:px-10 md:py-11">
          <div>
            <p className="font-display text-[clamp(2.4rem,9vw,4.2rem)] leading-tight font-extrabold">Chợ Sáng</p>
            <p className="mt-1.5 max-w-[34ch] text-ink-soft">Đồ ăn hằng ngày, ghi rõ giá và nguồn gốc, giao trong ngày ở TP.HCM.</p>
          </div>
          <div className="grid gap-6 text-[0.95rem] md:grid-cols-3">
            <div>
              <h2 className="mb-1.5 font-sans text-base font-extrabold">Cửa hàng</h2>
              <ul>
                <li>{STORE_ADDRESS}</li>
                <li>Mở cửa {OPENING_HOURS}</li>
                <li>
                  <a href={`tel:${HOTLINE_TEL}`} className={link}>
                    Hotline {HOTLINE_DISPLAY}
                  </a>
                </li>
                <li>
                  <a href={ZALO_URL} target="_blank" rel="noreferrer" className={link}>
                    Nhắn Zalo
                  </a>
                </li>
              </ul>
            </div>
            <div>
              <h2 className="mb-1.5 font-sans text-base font-extrabold">Khung giờ giao</h2>
              <ul className="my-1.5 flex flex-wrap gap-1.5 tabular-nums">
                {DELIVERY_SLOTS.map((s) => (
                  <li key={s} className="rounded-full border-2 border-ink px-2.5 py-0.5 text-sm font-bold">
                    {s}
                  </li>
                ))}
              </ul>
              <p className="tabular-nums">
                Ship {formatVnd(SHIPPING_VND)}, miễn phí từ {formatVnd(FREESHIP_FROM_VND)}
              </p>
            </div>
            <nav aria-label="Chân trang">
              <h2 className="mb-1.5 font-sans text-base font-extrabold">Thông tin</h2>
              <ul>
                <li><Link to="/about" className={link}>Giới thiệu</Link></li>
                <li><Link to="/contact" className={link}>Liên hệ</Link></li>
                <li><Link to="/orders" className={link}>Đơn hàng của tôi</Link></li>
                <li><Link to="/gift" className={link}>Giỏ quà biếu</Link></li>
              </ul>
            </nav>
          </div>
        </div>
        <div className="mt-5 grid gap-1 text-sm text-on-ink-muted">
          <p>Bản demo: không giao hàng và không thu tiền thật. Hotline, địa chỉ là thông tin minh hoạ.</p>
          <p>Ảnh sản phẩm là ảnh minh hoạ.</p>
        </div>
      </div>
    </footer>
  );
}
