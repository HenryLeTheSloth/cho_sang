import { ArrowRight, Clock, RotateCcw, Truck, Wallet } from "lucide-react";
import { Link } from "react-router";
import { CartControl } from "~/components/cart-control";
import { ProductCard } from "~/components/product-card";
import { ProductImage } from "~/components/product-image";
import { ProductShelf } from "~/components/product-shelf";
import { getFeatured, listBoard, listCategories, listDeals, listShelf } from "~/lib/catalog.server";
import { FREESHIP_FROM_VND, SHIPPING_VND } from "~/lib/config";
import { deliveryDays } from "~/lib/delivery";
import { priceFacts, productFacts } from "~/lib/facts";
import { formatVnd } from "~/lib/format";
import { getGiftBase } from "~/lib/gift.server";
import { cutoutSrc } from "~/lib/image-urls";
import { takenSlots } from "~/lib/orders.server";
import type { Route } from "./+types/home";

export async function loader() {
  const now = new Date();
  const [categories, board, shelf, deals, featured, giftBase, taken] = await Promise.all([
    listCategories(),
    listBoard(),
    listShelf(),
    listDeals(),
    getFeatured(),
    getGiftBase(),
    takenSlots(now),
  ]);
  // Khung giao sớm nhất còn nhận đơn (hôm nay hoặc ngày mai), tính ở server để SSR và client khớp
  const day = deliveryDays(now, taken).find((d) => d.slots.some((s) => !s.disabled));
  const earliest = day && { slot: day.slots.find((s) => !s.disabled)!.slot, day: day.label.toLowerCase() };
  const today = new Intl.DateTimeFormat("vi-VN", { weekday: "long", day: "2-digit", month: "2-digit", timeZone: "Asia/Ho_Chi_Minh" }).format(now);
  return { categories, board, shelf, deals, featured, giftBase, earliest, today };
}

export default function Home({ loaderData }: Route.ComponentProps) {
  const { categories, board, shelf, deals, featured, giftBase, earliest, today } = loaderData;
  return (
    <main>
      <title>Chợ Sáng: đi chợ sáng trong 3 phút</title>
      <meta name="description" content="Rau củ, trái cây, thịt cá, trứng sữa giao trong ngày. Giá, nguồn gốc, hạn dùng ghi rõ từng món." />

      {/* HERO: tấm bảng giá bìa + kệ hàng */}
      <section aria-labelledby="hero-title" className="bg-surface pt-5 pb-2 md:pt-9">
        <div className="mx-auto grid max-w-6xl gap-9 px-4 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:items-center lg:gap-12">
          <div className="carton-shadow">
            <div className="carton sign-hang px-5.5 pt-7.5 pb-7 md:px-10 md:pt-11 md:pb-10">
              <h1 id="hero-title" className="max-w-[12ch] text-[clamp(2.1rem,8.4vw,4.4rem)] leading-[1.12]">
                Đi chợ sáng trong 3 phút
              </h1>
              <p className="mt-3 max-w-[38ch] text-ink-soft">
                Rau củ, trái cây, thịt cá, trứng sữa. Món nào cũng ghi rõ giá, nguồn gốc và hạn dùng. Hỏng, dập đổi trong 24 giờ.
              </p>

              <div className="mt-5.5 border-t-3 border-ink">
                <div className="flex items-baseline justify-between gap-3 pt-2.5 pb-1">
                  <h2 className="text-[1.35rem]">Giá sáng nay</h2>
                  <span className="text-sm text-ink-soft first-letter:uppercase">{today}</span>
                </div>
                <ul>
                  {board.map((p) => {
                    const f = priceFacts(p);
                    return (
                      <li key={p.id} className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-x-3 border-b-2 border-dashed border-ink/30 py-2.5">
                        <p className="leading-snug font-bold">
                          <Link to={`/products/${p.slug}`} className="hl-link">
                            {p.name}
                          </Link>
                          <span className="block text-sm font-normal text-ink-soft">{p.origin}</span>
                        </p>
                        <p className={`text-right font-display text-[clamp(1.25rem,5vw,1.5rem)] leading-tight font-extrabold whitespace-nowrap tabular-nums ${f.compareAt ? "text-sale" : "text-price"}`}>
                          {f.price}
                          <span className="block font-sans text-xs font-normal text-ink-soft">{p.unit}</span>
                          {f.compareAt && (
                            <span className="block font-sans text-xs font-normal text-ink-soft">
                              giá cũ <s className="decoration-sale decoration-2">{f.compareAt}</s>
                            </span>
                          )}
                        </p>
                        <CartControl product={p} />
                      </li>
                    );
                  })}
                </ul>
              </div>

              <div className="mt-5.5 flex flex-wrap items-center gap-x-5 gap-y-3">
                <Link to="/collections/all" className="btn-cta inline-flex min-h-13 items-center px-6.5 font-display text-lg font-extrabold">
                  Đi chợ ngay
                </Link>
                {earliest && (
                  <p className="inline-flex items-center gap-2 text-sm text-ink-soft">
                    <Clock aria-hidden className="size-5.5 shrink-0" />
                    <span>
                      Giao sớm nhất <strong className="text-ink tabular-nums">{earliest.slot}</strong> {earliest.day}
                    </span>
                  </p>
                )}
              </div>
            </div>
          </div>

          {shelf.length > 0 && <ProductShelf products={shelf} />}
        </div>
      </section>

      {/* Ba lời hứa: giấy note dán cạnh tấm bảng */}
      <section aria-label="Cam kết giao hàng" className="bg-surface pt-9 pb-12">
        <ul className="mx-auto grid max-w-6xl gap-4.5 px-4 md:grid-cols-3 md:gap-7">
          <li className="sticky-note -rotate-[1.5deg] bg-note-yellow px-5.5 pt-6.5 pb-7">
            <Truck aria-hidden className="size-6.5" />
            <h3 className="mt-2.5 text-xl">Giao trong ngày theo khung giờ</h3>
            <p className="mt-1.5 text-ink-soft tabular-nums">
              Phí ship {formatVnd(SHIPPING_VND)}, miễn phí cho đơn từ {formatVnd(FREESHIP_FROM_VND)}.
            </p>
          </li>
          <li className="sticky-note rotate-1 bg-note-pink px-5.5 pt-6.5 pb-7">
            <RotateCcw aria-hidden className="size-6.5" />
            <h3 className="mt-2.5 text-xl">Hỏng, dập đổi trong 24 giờ</h3>
            <p className="mt-1.5 text-ink-soft">Báo trong 24 giờ kể từ lúc nhận hàng.</p>
          </li>
          <li className="sticky-note -rotate-[0.6deg] bg-note-blue px-5.5 pt-6.5 pb-7">
            <Wallet aria-hidden className="size-6.5" />
            <h3 className="mt-2.5 text-xl">Nhận hàng rồi mới trả tiền</h3>
            <p className="mt-1.5 text-ink-soft">Không cần tạo tài khoản để đặt.</p>
          </li>
        </ul>
      </section>

      <section aria-labelledby="cats-title" className="mx-auto max-w-6xl px-4 py-12">
        <h2 id="cats-title" className="text-[clamp(1.7rem,5vw,2.5rem)]">Hôm nay mua gì?</h2>
        <ul className="mt-5 grid grid-cols-3 gap-3 md:grid-cols-6 md:gap-4">
          {categories.map((c, i) => (
            <li key={c.slug}>
              <Link to={`/collections/${c.slug}`} className="group relative block overflow-hidden rounded-2xl">
                <ProductImage
                  image={c.image}
                  alt=""
                  sizes="(min-width: 768px) 180px, 33vw"
                  className="transition-[scale,filter] duration-600 ease-out-expo group-hover:scale-107 group-hover:saturate-115"
                />
                <span
                  className={`carton-tag absolute bottom-2 left-2 max-w-[calc(100%-1rem)] px-2.5 pt-1 pb-1.5 font-display leading-tight font-extrabold group-hover:-translate-y-1 group-hover:bg-cta ${
                    i % 2 ? "rotate-[1.5deg] group-hover:-rotate-3" : "-rotate-2 group-hover:rotate-3"
                  }`}
                >
                  {c.name}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      {featured && <TrustSection product={featured} />}

      <section aria-labelledby="deals-title" className="mx-auto max-w-6xl px-4 py-12">
        <div className="flex items-baseline justify-between gap-4">
          <h2 id="deals-title" className="text-[clamp(1.7rem,5vw,2.5rem)]">Giá tốt sáng nay</h2>
          <Link to="/collections/all" className="hl-link group inline-flex shrink-0 items-center gap-1.5 py-2.5 font-bold whitespace-nowrap">
            Xem tất cả
            <ArrowRight aria-hidden className="size-4.5 transition-transform duration-300 ease-spring group-hover:translate-x-1" />
          </Link>
        </div>
        <ul className="mt-5 grid grid-cols-2 gap-x-3 gap-y-7 md:grid-cols-4 md:gap-x-5 md:gap-y-9">
          {deals.map((p) => (
            <li key={p.id}>
              <ProductCard product={p} />
            </li>
          ))}
        </ul>
      </section>

      {/* Đường vào /gift (spec mục 3). Không tải Fabric ở đây: chỉ là link */}
      <section aria-labelledby="gift-title" className="mx-auto max-w-6xl px-4 py-12">
        <div className="carton-shadow">
          <div className="carton grid items-center gap-6 px-5.5 py-8 md:grid-cols-[1.1fr_1fr] md:px-11 md:py-12">
            <div>
              <h2 id="gift-title" className="text-[clamp(1.9rem,6vw,3rem)]">Tự xếp giỏ quà biếu</h2>
              <p className="mt-2.5 max-w-[44ch] text-ink-soft">
                Chọn trái cây, đặc sản, kéo thả vào giỏ rồi viết lời chúc. Biếu Tết, mừng thọ, thăm người thân, giao trong ngày.
              </p>
              {giftBase && (
                <p className="mt-2.5 text-ink-soft tabular-nums">
                  <b className="text-ink">
                    {giftBase.name} {formatVnd(giftBase.priceVnd)}
                  </b>
                  , cộng tiền các món bạn chọn.
                </p>
              )}
              <Link to="/gift" className="btn-cta mt-5 inline-flex min-h-13 items-center px-6.5 font-display text-lg font-extrabold">
                Xếp giỏ quà
              </Link>
            </div>
            <div aria-hidden className="flex min-h-37 items-end justify-center">
              {shelf.slice(0, 4).map((p, i) => (
                <img
                  key={p.id}
                  src={cutoutSrc(p.cutoutUrl!)}
                  alt=""
                  loading="lazy"
                  className={`-mx-[2%] w-1/4 max-w-37 drop-shadow-[0_8px_10px_rgb(60_40_15/0.3)] ${i === 1 ? "-translate-y-3 -rotate-6" : i === 3 ? "-translate-y-2 rotate-8" : ""}`}
                />
              ))}
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}

/** "Đọc một bảng giá": một món mẫu với đủ mọi dòng thông tin, như bảng bìa cắm trên sạp nhưng ghi đủ hơn. */
function TrustSection({ product }: { product: NonNullable<Route.ComponentProps["loaderData"]["featured"]> }) {
  const f = priceFacts(product);
  const rows = [
    ...productFacts(product),
    ...(f.perKg ? [{ label: "Giá theo ký", value: f.perKg }] : []),
    ...(f.weighedNote ? [{ label: "Hàng cân ký", value: f.weighedNote }] : []),
    { label: "Tình trạng", value: f.stock.label },
  ];
  return (
    <section aria-labelledby="trust-title" className="bg-surface py-12">
      <div className="mx-auto max-w-6xl px-4">
        <h2 id="trust-title" className="text-[clamp(1.7rem,5vw,2.5rem)]">Món nào cũng có đủ bảng giá</h2>
        <p className="mt-2 max-w-[60ch] text-ink-muted">
          Như bảng bìa cắm trên sạp, nhưng ghi đủ hơn. Bạn biết món từ đâu tới, để được bao lâu và giá theo ký trước khi bấm mua.
        </p>
        <div className="mt-6 grid items-start gap-12 lg:grid-cols-2 lg:gap-14">
          <div className="relative">
            <div className="overflow-hidden rounded-2xl">
              <ProductImage image={product.images[0]} alt={product.name} sizes="(min-width: 1024px) 560px, 100vw" />
            </div>
            <div className="carton-shadow absolute -bottom-5.5 left-3.5 w-[min(78%,330px)] lg:right-[-28px] lg:bottom-7 lg:left-auto">
              <div className="carton -rotate-[2.5deg] px-4.5 pt-4.5 pb-4">
                <h3 className="text-2xl">{product.name}</h3>
                <p className={`mt-1.5 font-display text-4xl leading-none font-extrabold tabular-nums ${f.compareAt ? "text-sale" : "text-price"}`}>
                  {f.price} <small className="font-sans text-base font-normal text-ink-soft">{product.unit}</small>
                </p>
                {f.compareAt && (
                  <p className="mt-1 text-sm text-ink-soft tabular-nums">
                    Giá cũ <s className="decoration-sale decoration-2">{f.compareAt}</s>
                  </p>
                )}
              </div>
            </div>
          </div>
          <div>
            <dl className="border-t-3 border-ink">
              {rows.map(({ label, value }) => (
                <div key={label} className="grid grid-cols-[9.5rem_1fr] gap-3 border-b border-line py-3.5">
                  <dt className="font-extrabold">{label}</dt>
                  <dd>{value}</dd>
                </div>
              ))}
            </dl>
            <Link to="/contact" className="group mt-4.5 flex items-start gap-3 rounded-2xl bg-bg p-4.5 transition-colors duration-200 ease-out-expo hover:bg-note-yellow">
              <RotateCcw aria-hidden className="mt-0.5 size-5.5 shrink-0 transition-transform duration-500 ease-spring group-hover:-rotate-180" />
              <span>
                <b className="block">Không như bảng ghi, chúng tôi đổi.</b>
                Hỏng, dập hoặc khác mô tả: báo trong 24 giờ kể từ lúc nhận.
              </span>
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
