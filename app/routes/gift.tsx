import { CircleAlert, Gift, Plus, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { data, useFetcher } from "react-router";
import { cartCookie, liveBundleIds, readCart } from "~/lib/cart.server";
import { CART_MAX_BUNDLES, GIFT_MAX_ITEMS, GIFT_MESSAGE_MAX } from "~/lib/config";
import { formatVnd } from "~/lib/format";
import type { GiftCanvas } from "~/lib/gift-canvas.client";
import { createBundle, GIFT_FORM_BYTES, getGiftBase, listGiftItems, parseGiftForm } from "~/lib/gift.server";
import { cutoutSrc } from "~/lib/image-urls";
import { readForm } from "~/lib/security.server";
import type { Route } from "./+types/gift";

export async function loader() {
  const [base, items] = await Promise.all([getGiftBase(), listGiftItems()]);
  if (!base) throw new Response("Không tìm thấy", { status: 404 });
  return { base, items: items.map(({ cutoutUrl, ...p }) => ({ ...p, src: cutoutSrc(cutoutUrl!) })) };
}

/** Tạo GiftBundle (layout + lời chúc + ảnh xem trước đã kiểm ở server) rồi thêm id vào cookie `b` (spec mục 5). */
export async function action({ request }: Route.ActionArgs) {
  const form = await readForm(request, GIFT_FORM_BYTES); // ảnh xem trước ≤60KB: trần riêng (cổng M3)
  const parsed = await parseGiftForm(form);
  if (!parsed.ok) return data({ error: parsed.error }, { status: 400 });
  const cart = await readCart(request);
  const b = await liveBundleIds(cart.b); // id chết (DB reset) không chiếm trần 10; ghi lại `b` đã dọn
  if (b.length >= CART_MAX_BUNDLES) return data({ error: `Giỏ hàng chỉ chứa tối đa ${CART_MAX_BUNDLES} giỏ quà.` }, { status: 400 });
  const id = await createBundle(parsed.data);
  if (!id) return data({ error: "Có món vừa ngừng bán, bạn tải lại trang rồi xếp lại giúp mình nhé." }, { status: 400 });
  return data({ error: null }, { headers: { "Set-Cookie": await cartCookie.serialize({ ...cart, b: [...b, id] }) } });
}

type Chosen = { uid: number; pid: number };

export default function GiftPage({ loaderData }: Route.ComponentProps) {
  const { base, items } = loaderData;
  const hostRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<GiftCanvas | null>(null);
  const nextUid = useRef(1); // không dùng crypto.randomUUID: không có trên http:// (demo qua LAN)
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [chosen, setChosen] = useState<Chosen[]>([]);
  const [message, setMessage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(0); // số ảnh món đang tải lên canvas: chưa xong thì chưa cho thêm vào giỏ hàng
  const fetcher = useFetcher<typeof action>();
  // Lệnh giỏ hàng của drawer còn bay: hai request cùng ghi cả cookie giỏ, lệnh về sau thắng (cổng M4 N2)
  const cartBusy = useFetcher({ key: "cart" }).state !== "idle";
  const byId = new Map(items.map((i) => [i.id, i]));
  const full = chosen.length >= GIFT_MAX_ITEMS;
  const total = base.priceVnd + chosen.reduce((sum, c) => sum + byId.get(c.pid)!.priceVnd, 0); // chỉ để xem: server tính lại
  const busy = fetcher.state !== "idle";

  // Fabric chỉ tải ở đây, sau khi trang đã hiện (SSR không bao giờ chạy nó). Lỗi tải thì báo, không làm hỏng trang.
  useEffect(() => {
    let alive = true;
    let gc: GiftCanvas | null = null;
    import("~/lib/gift-canvas.client")
      .then((m) => m.createGiftCanvas(hostRef.current!))
      .then((c) => {
        if (!alive) return void c.dispose();
        gc = c;
        canvasRef.current = c;
        setStatus("ready");
      })
      .catch(() => alive && setStatus("error"));
    return () => {
      alive = false;
      canvasRef.current = null;
      void gc?.dispose();
    };
  }, []);

  useEffect(() => {
    canvasRef.current?.setMessage(message);
  }, [message, status]);

  // Lệnh gửi đã xong hẳn (idle: root đã tải lại giỏ). Lỗi: hiện tới lần sửa kế tiếp. Thành công: bắt đầu giỏ quà mới và
  // mở drawer cho khách thấy dòng "Giỏ quà · N món" (mở lúc còn "loading" thì drawer hiện giỏ cũ)
  useEffect(() => {
    if (fetcher.state !== "idle" || !fetcher.data) return;
    if (fetcher.data.error) return setError(fetcher.data.error);
    for (const c of chosen) canvasRef.current?.remove(c.uid);
    setChosen([]);
    setMessage("");
    document.querySelector<HTMLDialogElement>("#cart-drawer")?.showModal();
  }, [fetcher.state, fetcher.data]);

  const remove = (uid: number) => {
    setError(null);
    setChosen((list) => list.filter((c) => c.uid !== uid));
    canvasRef.current?.remove(uid);
  };

  // Bỏ từ danh sách: focus sang nút "Bỏ" của dòng kế tiếp, hết dòng thì về tiêu đề "Trong giỏ quà" (không rơi về <body>)
  const removeFromList = (uid: number) => {
    const next = chosen[chosen.findIndex((c) => c.uid === uid) + 1];
    remove(uid);
    requestAnimationFrame(() => document.getElementById(next ? `gift-rm-${next.uid}` : "gift-in")?.focus());
  };

  const add = (pid: number) => {
    const canvas = canvasRef.current;
    if (full || !canvas) return;
    const uid = nextUid.current++;
    setError(null);
    setChosen((list) => [...list, { uid, pid }]);
    setLoading((n) => n + 1);
    canvas
      .add(uid, pid, byId.get(pid)!.src)
      .catch(() => {
        remove(uid);
        setError("Không tải được ảnh món, bạn thử lại giúp mình nhé.");
      })
      .finally(() => setLoading((n) => n - 1));
  };

  const submit = () => {
    const canvas = canvasRef.current;
    if (!canvas || chosen.length === 0) return;
    const layout = canvas.layout();
    if (layout.length !== chosen.length) return; // ảnh món còn đang tải (nút cũng đang khoá)
    try {
      // flushSync: nút khoá ngay trong lần chạm này, chạm đúp không gửi 2 lần
      void fetcher.submit({ layout: JSON.stringify(layout), message, preview: canvas.preview() }, { method: "post", flushSync: true });
      setError(null);
    } catch {
      setError("Không tạo được ảnh giỏ quà, bạn thử lại giúp mình nhé.");
    }
  };

  const canAdd = status === "ready" && !full && !busy; // đang gửi: món chạm thêm sẽ bị xoá cùng bố cục khi gửi xong
  return (
    <main className="mx-auto max-w-6xl px-4 py-6">
      <title>Giỏ quà biếu · Chợ Sáng</title>
      <meta name="description" content="Tự xếp giỏ quà biếu trái cây, đặc sản: chọn món, kéo thả, thêm lời chúc." />
      <h1 className="text-3xl">Xếp giỏ quà biếu</h1>
      <p className="mt-1 text-ink-muted">Chạm món để thêm, kéo để xếp, kéo núm tròn để xoay hoặc phóng to.</p>

      <div className="mt-4 grid gap-6 md:grid-cols-[minmax(0,30rem)_1fr] md:items-start">
        <div className="relative md:sticky md:top-20">
          {/* Canvas chỉ là phần nhìn; danh sách "Trong giỏ quà" + ô lời chúc bên dưới là bản cho bàn phím và trình đọc màn hình */}
          <div ref={hostRef} aria-hidden className="aspect-square w-full overflow-hidden rounded-2xl border border-line bg-surface" />
          {/* Trạng thái nằm NGOÀI khung aria-hidden: trình đọc màn hình biết vì sao các nút chọn món đang khoá (cổng plan M4) */}
          {status === "loading" && (
            <p role="status" className="absolute inset-0 flex items-center justify-center p-6 text-center text-sm text-ink-muted">
              Đang mở khung xếp giỏ…
            </p>
          )}
          {status === "error" && (
            <p role="alert" className="absolute inset-0 flex items-center justify-center gap-1.5 p-6 text-center text-sm text-danger">
              <CircleAlert aria-hidden className="size-4 shrink-0" />
              Không tải được khung xếp giỏ, bạn tải lại trang giúp mình nhé.
            </p>
          )}
          <noscript>
            <p className="mt-2 text-sm">Trang xếp giỏ quà cần bật JavaScript.</p>
          </noscript>
        </div>

        <div className="min-w-0 space-y-6">{/* min-w-0: hàng món cuộn ngang không được nới rộng cột lưới */}
          <section aria-labelledby="gift-pick">
            <div className="flex items-baseline justify-between gap-3">
              <h2 id="gift-pick" className="text-xl">Chọn món</h2>
              {/* aria-live: thêm món bằng bàn phím/trình đọc màn hình có phản hồi (canvas aria-hidden) */}
              <p aria-live="polite" className="text-sm text-ink-muted tabular-nums">
                Đã chọn {chosen.length}/{GIFT_MAX_ITEMS} món
              </p>
            </div>
            {full && <p className="mt-1 text-sm">Giỏ đã đủ {GIFT_MAX_ITEMS} món. Bỏ bớt một món nếu muốn đổi.</p>}
            {/* Điện thoại: một hàng cuộn ngang ngay dưới canvas, để thấy món hiện lên giỏ khi chạm. Máy tính: lưới */}
            <ul className="-mx-4 mt-2 flex snap-x scroll-px-4 gap-2 overflow-x-auto px-4 pb-2 md:mx-0 md:grid md:grid-cols-4 md:overflow-visible md:px-0">
              {items.map((item) => (
                <li key={item.id} className="w-24 shrink-0 snap-start md:w-auto">
                  <button
                    type="button"
                    onClick={() => add(item.id)}
                    disabled={!canAdd}
                    aria-label={`Thêm ${item.name} vào giỏ quà`}
                    className="group flex h-full w-full flex-col items-center gap-1 rounded-xl border border-line bg-surface p-2 text-center transition-colors duration-150 ease-snappy hover:border-ink-muted disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:border-line"
                  >
                    <span className="relative">
                      <img src={item.src} alt="" width={72} height={72} loading="lazy" className="size-18 object-contain" />
                      <Plus aria-hidden className="absolute -right-1 -bottom-1 size-6 rounded-full bg-cta p-1 text-ink" />
                    </span>
                    <span className="line-clamp-2 text-xs">{item.name}</span>
                    <span className="text-xs text-ink-muted tabular-nums">{formatVnd(item.priceVnd)}</span>
                    <span className="line-clamp-1 text-xs text-ink-muted">{item.unit}</span>
                  </button>
                </li>
              ))}
            </ul>
          </section>

          <section aria-labelledby="gift-in">
            <h2 id="gift-in" tabIndex={-1} className="text-xl">
              Trong giỏ quà
            </h2>
            <ul className="mt-2 divide-y divide-line rounded-2xl border border-line bg-surface px-4 text-sm">
              <li className="flex min-h-11 items-center justify-between gap-3 py-2">
                <span className="flex min-w-0 flex-1 items-start gap-2">
                  <Gift aria-hidden className="mt-1 size-4 shrink-0" />
                  <span>
                    {base.name} <span className="text-ink-muted">({base.unit})</span>
                  </span>
                </span>
                <span className="tabular-nums">{formatVnd(base.priceVnd)}</span>
              </li>
              {chosen.map((c) => {
                const item = byId.get(c.pid)!;
                return (
                  <li key={c.uid} className="flex items-center justify-between gap-2 py-1">
                    <span className="min-w-0 flex-1">
                      {item.name} <span className="text-ink-muted">({item.unit})</span>
                    </span>
                    <span className="tabular-nums">{formatVnd(item.priceVnd)}</span>
                    <button
                      type="button"
                      id={`gift-rm-${c.uid}`}
                      onClick={() => removeFromList(c.uid)}
                      aria-label={`Bỏ ${item.name} khỏi giỏ quà`}
                      className="inline-flex size-11 shrink-0 items-center justify-center rounded-full text-ink-muted transition-colors duration-150 ease-snappy hover:bg-ink/5 hover:text-ink"
                    >
                      <Trash2 aria-hidden className="size-5" />
                    </button>
                  </li>
                );
              })}
              {chosen.length === 0 && <li className="py-3 text-ink-muted">Chưa có món nào. Chạm vào món ở trên để thêm.</li>}
            </ul>
          </section>

          <div>
            <label htmlFor="gift-message" className="block font-display text-xl font-extrabold">
              Lời chúc
            </label>
            <p id="gift-message-hint" className="text-sm text-ink-muted">
              Hiện trên giỏ quà, tối đa {GIFT_MESSAGE_MAX} ký tự.
            </p>
            <textarea
              id="gift-message"
              value={message}
              onChange={(e) => {
                setError(null);
                setMessage(e.target.value);
              }}
              maxLength={GIFT_MESSAGE_MAX}
              rows={2}
              aria-describedby="gift-message-hint gift-message-count"
              placeholder="Ví dụ: Chúc mừng năm mới, an khang thịnh vượng!"
              className="mt-2 w-full rounded-xl border border-line bg-surface px-3 py-2 text-base transition-colors duration-150 ease-snappy placeholder:text-ink-muted hover:border-ink-muted"
            />
            <p id="gift-message-count" className="text-right text-xs text-ink-muted tabular-nums">
              {message.length}/{GIFT_MESSAGE_MAX}
            </p>
          </div>

          {error && (
            <p role="alert" className="flex items-start gap-1.5 text-sm text-danger">
              <CircleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
              {error}
            </p>
          )}

          <div className="sticky bottom-0 -mx-4 border-t border-line bg-bg/95 px-4 py-3 backdrop-blur md:mx-0 md:rounded-b-2xl">
            <button
              type="button"
              onClick={submit}
              disabled={busy || cartBusy || loading > 0 || status !== "ready" || chosen.length === 0 || base.stock === 0}
              className="btn-cta flex min-h-12 w-full items-center justify-center px-6 font-display text-lg font-extrabold"
            >
              {busy ? "Đang thêm…" : <>Thêm vào giỏ hàng · <span className="ml-1 tabular-nums">{formatVnd(total)}</span></>}
            </button>
            <p className="mt-1 text-center text-xs text-ink-muted">
              {base.stock === 0
                ? "Tạm hết vỏ giỏ quà, bạn quay lại sau nhé."
                : chosen.length === 0
                  ? "Chọn ít nhất 1 món để thêm vào giỏ hàng."
                  : `Gồm ${base.name.toLowerCase()} ${formatVnd(base.priceVnd)}`}
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
