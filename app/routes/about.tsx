import { ProductImage } from "~/components/product-image";

const sources = [
  ["Đà Lạt", "Rau ăn lá, cà rốt, khoai lang: rau VietGAP nhận lúc 4 giờ sáng."],
  ["Tiền Giang, Vĩnh Long", "Xoài cát Hòa Lộc, cam sành: trái chín cây, tuyển từng quả."],
  ["Cà Mau, An Giang", "Tôm, cá: cấp đông nhanh ngay tại cảng, giữ lạnh suốt đường về."],
];

export default function About() {
  return (
    <main className="mx-auto max-w-3xl space-y-10 px-4 py-8">
      <title>Giới thiệu · Chợ Sáng</title>
      <header className="space-y-3">
        <h1 className="text-4xl">Mỗi sáng, một phiên chợ</h1>
        <p className="text-lg">
          Chợ Sáng gom hàng từ những vườn và bến quen mỗi sáng sớm, soạn đơn trước 7 giờ và giao trong 2 giờ. Bạn được xem
          nguồn gốc, hạn dùng và giá theo ký trước khi mua, như khi tự tay chọn ở chợ.
        </p>
        <p className="text-sm text-ink-muted">Câu chuyện và hình ảnh trong bản demo là minh hoạ.</p>
      </header>

      <section aria-labelledby="about-sources" className="space-y-4">
        <h2 id="about-sources" className="text-2xl">Hàng về từ đâu</h2>
        <div className="grid grid-cols-3 gap-3">
          {["products/cai-ngot", "products/xoai-cat-hoa-loc", "products/tom-the"].map((image) => (
            <div key={image} className="overflow-hidden rounded-2xl">
              <ProductImage image={image} alt="" sizes="(min-width: 768px) 250px, 33vw" />
            </div>
          ))}
        </div>
        <dl className="space-y-3">
          {sources.map(([place, text]) => (
            <div key={place}>
              <dt>{place}</dt>
              <dd className="text-ink-muted">{text}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section aria-labelledby="about-policy" className="space-y-2 rounded-2xl border border-line bg-surface p-5">
        <h2 id="about-policy" className="text-2xl">Cam kết đổi trả</h2>
        <ul className="list-disc space-y-1 pl-5">
          <li>Rau héo, trái dập, trứng vỡ: đổi mới hoặc hoàn tiền trong 24 giờ.</li>
          <li>Chỉ cần chụp ảnh gửi Zalo, không cần trả lại hàng.</li>
          <li>Hàng cân ký chênh quá 10% so với tạm tính: hoàn phần chênh.</li>
        </ul>
      </section>
    </main>
  );
}
