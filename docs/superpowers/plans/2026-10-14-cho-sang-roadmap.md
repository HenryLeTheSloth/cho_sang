# Chợ Sáng: Roadmap triển khai

> **For agentic workers:** Đây là roadmap tổng. Mỗi milestone có plan chi tiết riêng, viết bằng `superpowers:writing-plans` **ngay trước khi thực thi milestone đó**, vì plan sau dùng code thật của milestone trước. Thực thi bằng superpowers:subagent-driven-development hoặc superpowers:executing-plans.

**Goal:** Web đi chợ online "Chợ Sáng" (MVP demo cho khách): khách mua được một rổ hàng trong 3 phút trên điện thoại, có giỏ quà Fabric và hero Three.js, admin xử lý đơn.

**Architecture:** Một app React Router 8 framework mode (SSR, loader/action) nối Postgres 18 qua Prisma 7 + adapter-pg. Giỏ hàng nằm trong cookie ký, giá luôn đọc lại từ DB. Three.js và Fabric.js là progressive enhancement, chỉ tải ở client (hero homepage và `/gift`).

**Tech Stack:** react-router 8.4.0, React 19.3.0, Vite 8.3.4, Tailwind 4.3.3, Prisma 7.10.0, PostgreSQL 18.6 (Docker), zod 4.6.7, sharp 0.35.5, three 0.186.1, fabric 7.4.0, vitest 5.0.4, Playwright 1.64.0.

**Spec:** [docs/superpowers/specs/2026-10-14-cho-sang-grocery-design.md](../specs/2026-10-14-cho-sang-grocery-design.md). Spec là nguồn sự thật; roadmap chỉ sắp thứ tự và chốt hợp đồng giữa các milestone.

## Global Constraints

Áp dụng cho mọi milestone:
- Phiên bản ghim exact (`.npmrc: save-exact=true`): đúng bảng mục 5 của spec. **TypeScript ghim 5.9.3** (tag `latest` đã là 7.0, template RR8 vẫn dùng 5.9). **Prisma ghim 7.10.0**, cấm `prisma@latest` (đang là 8.0 RC).
- Node `>=22.22.0 <23` (`engines`). Dockerfile ở M7 dùng `node:22.22-alpine`.
- Cấm import `@remix-run/*`, R3F/drei, better-auth, argon2, Conform, GSAP/Framer Motion, thư viện component, state manager.
- Tiền là số nguyên VND (`Int`). Hiển thị bằng `formatVnd()` → `"312.000₫"`, luôn kèm đơn vị bán.
- Giao diện tiếng Việt. Bố cục 375px làm trước, vùng chạm ≥44px, `:focus-visible` dùng màu brand.
- Palette, font và motion lấy đúng mục 4 của spec. Magenta `#C8246B` chỉ dùng cho CTA, giá, badge giỏ, logo, focus ring.
- Three.js chỉ ở hero homepage. Fabric chỉ ở `/gift`. Cả hai luôn có fallback tĩnh và không bao giờ chặn nút mua.
- Mọi màn thanh toán giả lập và OTP giả lập có nhãn **DEMO**.
- **Không có git** trong giai đoạn này (chủ dự án sẽ tự init). Các bước "Commit" trong plan được thay bằng "Checkpoint": chạy test + typecheck.

## Thứ tự milestone

| M | Plan file | Phụ thuộc | Ngày | DoD (tóm tắt, chi tiết ở spec mục 6) |
|---|---|---|---|---|
| M0 Nền móng | `2026-10-14-m0-foundation.md` ✅ hoàn thành 14/10 | n/a | 1.5 | `docker compose up -d --wait && npm run setup && npm run dev` chạy được. Typecheck + test pass. Dấu tiếng Việt hiển thị đúng |
| M1 Catalog | `2026-10-14-m1-catalog.md` ✅ hoàn thành 14/10 | M0 | 3 | Tìm "trung" ra trứng. "Xem thêm" chạy khi chưa có JS. LCP <2.5s |
| M2 Giỏ hàng | `2026-10-15-m2-cart.md` ✅ hoàn thành 15/10 | M1 | 2.5 | Cookie cart, drawer, + trên thẻ, hoàn tác, rổ SVG freeship |
| M3 Checkout + đơn + auth | `2026-10-15-m3-checkout-orders-auth.md` ✅ hoàn thành 15/10 | M2 | 4 | Playwright: giỏ → COD → thấy đơn. Tranh món cuối: 1 đơn bị từ chối. **Checkpoint tiến độ** |
| M4 Giỏ quà Fabric | `2026-10-15-m4-gift.md` ✅ hoàn thành 15/10 | M3 | 3.5 | Xếp 10 món, đặt COD, đơn hiện preview, đúng tổng tiền |
| M5 Admin | `m5-admin.md` | M3 (M4 để hiện nhóm giỏ quà) | 2.5 | Đổi trạng thái thì timeline khách cập nhật. Upload ra 6 biến thể |
| M6 Hero Three | `m6-hero.md` | M1 (chạy song song được từ sau M1) | 2 | Chunk ≤170KB gzip. Reduced-motion/saveData thì không tải three |
| M7 Hoàn thiện | `m7-polish.md` | tất cả | 2 | Kịch bản pitch 3 phút chạy trên điện thoại thật, mọi ngân sách hiệu năng đạt |

## Hợp đồng module giữa các milestone

Milestone sau **dùng lại**, không viết lại. Tên và chữ ký dưới đây là cố định; plan chi tiết của milestone được bổ sung thêm export nhưng không đổi những cái đã có.

| File | Tạo ở | Export (cố định) | Milestone sau dùng |
|---|---|---|---|
| `app/lib/env.server.ts` | M0 | `env.DATABASE_URL`, `env.UPLOAD_DIR`, `required(name)` | M2 thêm `SESSION_SECRET`; M3 thêm `DEMO_OTP`, `ADMIN_PASSCODE` |
| `app/lib/db.server.ts` | M0 | `db: PrismaClient` | mọi loader/action |
| `app/generated/prisma/client` | M0 (generate) | `PrismaClient`, model types, enums `Role`, `OrderStatus`, `PaymentMethod`, `PaymentStatus` | mọi nơi |
| `app/lib/format.ts` | M0 | `formatVnd(n: number): string`, `toSearch(s: string): string` | M1 thêm `pricePerKgLabel()` |
| `app/lib/images.server.ts` | M0 | `saveSquareImage(input: Buffer \| string, outDir: string, name: string): Promise<void>`, `placeholderImage(label: string, bg: string): Buffer`, `IMAGE_WIDTHS`, `IMAGE_FORMATS` | M5 upload admin |
| Ảnh lưu đĩa | M0 | `${UPLOAD_DIR}/products/<slug>-<320\|640\|1080>.<avif\|webp>`; DB lưu key `products/<slug>` | M1 `/uploads/:file` + `<ProductImage>` |
| `prisma/catalog.ts` | M0 | `categories`, `products`, `giftBase` | M4 thêm `cutout` cho 12 món |
| `app/components/site-header.tsx`, `site-footer.tsx` | M0 | `SiteHeader`, `SiteFooter` | M2 thêm nút giỏ vào header |
| `app/lib/config.ts` | M1 | hằng số mục 5 spec | M2, M3, M4 |
| `app/lib/cart.server.ts` | M2 | đọc/ghi cookie `cart` | M3, M4 |
| `app/lib/session.server.ts` | M3 | cookie `__session`, `requireAdmin` | M5 |
| `app/lib/orders.server.ts` | M3 | `placeOrder()` (transaction trừ kho) | M4, M5 |

Schema Prisma **đầy đủ** (mọi model ở spec mục 5) được tạo một lần ở M0. Milestone sau chỉ thêm migration khi spec mục "Nếu kịp" yêu cầu cột mới (ví dụ `weighedGrams`).

## Phát hiện từ spike kỹ thuật (14/10/2026, đã chạy thật trong scratchpad)

1. **npm 12 chặn install script mặc định.** Sau `npm install` phải chạy `npm install-scripts approve @prisma/engines esbuild prisma` rồi `npm rebuild`. Kết quả nằm trong `allowScripts` của package.json.
2. **fabric 7.4.0 kéo optional dependency `canvas`** (node-canvas, cần node-gyp). Ở M4: `npm install-scripts deny canvas`, vì app chỉ dùng Fabric ở client.
3. **Prisma 7 không tự generate sau `migrate dev`.** Luôn chạy `prisma generate` (script `setup` đã gồm).
4. **Prisma 7 + tsx + alias `~/`** chạy được cho seed. `prisma.config.ts` tự đọc `.env` bằng `process.loadEnvFile()` (Node stdlib, không cần dotenv).
5. **CHECK constraint** thêm bằng `migrate dev --create-only` rồi nối SQL vào `migration.sql`. Đã xác nhận Postgres chặn `stock = -1`.
6. **Postgres 18 image:** volume phải mount `/var/lib/postgresql` (không phải `/var/lib/postgresql/data` như bản ≤17).
7. **Three.js:** `import("three")` lấy cả namespace tạo chunk **186.85KB gzip, vượt trần 170KB**. Ở M6: viết scene trong module riêng `hero-scene.client.ts` dùng **named imports** (`import { Scene, LatheGeometry, … } from "three"`), rồi `import("./hero-scene.client")` động; đo lại bằng `npm run size`.
8. **SSR an toàn:** `import()` three/fabric trong `useEffect` build được, server render trả 200.
9. **Font:** Be Vietnam Pro 400/600 + Bricolage Grotesque 800 (bản tĩnh, subset latin + vietnamese) = **93.8KB**, đạt trần 100KB. **Lệch spec:** không có bản "Condensed", vì tách instance từ font variable cần fonttools mà máy chưa có pip. Giá dùng Bricolage 800 bản thường + `tabular-nums`. Nếu Designer đòi condensed: cài `python3-venv` rồi dùng `fonttools varLib.instancer` (wdth=75, wght=800), chấp nhận thêm khoảng 10KB.
10. **Cổng 5433 trên máy dev đã có tiến trình khác chiếm.** Compose dùng 5432 (đang trống).

## Review Focus (toàn dự án)

Các tình huống spec ngụ ý nhưng DoD chưa nêu thẳng. Plan của milestone sở hữu code phải có test cho từng mục:
1. **Chạy lại `npm run setup` trên DB đã có dữ liệu** thì không nhân đôi sản phẩm, không crash (M0: seed idempotent).
2. **Người dùng gõ tìm kiếm có dấu, viết hoa, chữ Đ, hoặc chuỗi Unicode dạng NFD** (copy từ macOS/Zalo) vẫn ra kết quả (M0 `toSearch`, M1 query).
3. **Cookie `cart` cũ trỏ tới sản phẩm đã bị xoá hoặc ẩn** thì drawer bỏ dòng đó, không lỗi 500 (M2).
4. **Bấm "Đặt hàng" hai lần** (mạng chậm, double tap) thì chỉ tạo một đơn và chỉ trừ kho một lần (M3).
5. **Khung giờ giao đã qua trong ngày** (đặt lúc 21h) thì không cho chọn; mặc định nhảy sang ngày mai (M3).

## Kết quả M0 và việc chuyển sang milestone sau (14/10/2026)

M0 đã hoàn thành: 8 task, review từng task và review toàn milestone đều đạt sau các vòng sửa. 19/19 test pass. Kiểm tra setup sạch trong compose project tạm đã đạt.

**Ruling sau review cuối M0:**
1. **Ngân sách JS route đầu nâng từ 110KB lên 130KB gzip** (đã sửa spec mục 5). Lý do: riêng React 19 + RR8 đã chiếm ≈107KB, nên trần 110KB không thể đạt dù code app tối giản. Phần code app còn ≤23KB. `npm run size` ở M7 dùng trần mới.
2. **Seed chỉ cập nhật `images` + `nameSearch` cho sản phẩm đã có.** Mọi field mới lấy từ catalog (M1: `images[1]` ảnh bổ đôi; M4: `cutout` → `cutoutUrl`) **phải được thêm tường minh vào object `update` trong `prisma/seed.ts`**, nếu không DB dev hiện có sẽ không nhận. Plan M1 và M4 phải ghi rõ điều này.
3. **Agent không bao giờ chạy `prisma migrate reset`** (Prisma chặn khi chưa có sự đồng ý của chủ dự án). `demo:reset` ở M7 là lệnh do chủ dự án tự chạy; plan M7 phải có bước "user chạy".

**Chuyển sang M1 (đưa vào plan M1):**
- **DoD M1 bắt buộc:** hoàn tất tuyển ảnh. Còn 4 placeholder (`buoi-dien`, `trung-vit`, `nuoc-mam-phu-quoc`, `muoi-tom-tay-ninh`). `trung-vit` xuất hiện ngay trong lượt tìm "trung" của kịch bản pitch. Thay thêm `banh-trang-trang-bang` (ảnh phong cảnh) và `pho-mai-lat` (có hạt điều lẫn vào). Ảnh lệch style: `ca-hoi-phi-le`, `ca-basa-cat-khuc`, `ba-roi-heo`, `dau-an-dau-nanh`, `bi-do-ho-lo`.
- Header: thêm hover state cho logo và ô tìm kiếm; placeholder ngắn lại thành "Tìm sản phẩm…" (bản hiện tại bị cắt ở 375px); thêm favicon. Designer quyết có giữ label `sr-only` cho ô search hay không.

**Chuyển sang M3:** tạo DB test riêng (`chosang_test`) trước khi viết test đơn hàng/kho, để đơn test không hiện trong admin lúc pitch.

**Chuyển sang M5:**
- `Product.images` đang nullable và không có default. Thêm `@default([])` bằng một migration mới, không phá dữ liệu.
- Upload admin phải slug-validate `name` trước khi gọi `saveSquareImage` (hàm này ghép thẳng `name` vào path).
- Giữ key ảnh `products/<slug>`, vì seed refresh `images` mỗi lần chạy.
- Test ảnh nên kiểm cả 6 biến thể (hiện chỉ kiểm 640.webp).

**Chuyển sang M7:** image `node:22.22-alpine` không có font, nên placeholder SVG (librsvg `sans-serif`) sẽ ra chữ trống nếu seed chạy trong container. Cài gói font hoặc seed trên host.

## Kết quả M1 và việc chuyển sang milestone sau (14/10/2026)

M1 Catalog đã hoàn thành: 8 task, review từng task và review toàn milestone đều đạt sau các vòng sửa. 44/44 test pass. Mọi link nội bộ trả 200. JS route đầu là 118KB gzip (trần 130KB).

**Ruling quan trọng:**
1. **LCP lệch DoD (đã chấp nhận).** Các trang có LCP là ảnh đạt khoảng 2.6s trên Lighthouse mobile (Slow 4G mô phỏng), trần là 2.5s:
   - `/collections/all`: 2.6–2.7s.
   - `/products/xoai-cat-hoa-loc`: 2.6s.
   - Trang chủ: 2.0–2.2s, đạt vì LCP là chữ.

   Bản thân ảnh không phải nút thắt, vì ảnh LCP đã là 320w, khoảng 11KB. Phần sàn là khoảng 124KB JS framework cộng 6 file font (khoảng 96KB) tranh băng thông. **Trước M6, Designer phải quyết font** ở review M2. Phương án là bỏ Be Vietnam Pro 600 (−35KB) hoặc bỏ preload font; thử nghiệm bỏ preload cho 2.3–2.6s.
2. **Ảnh:** 3 placeholder được chấp nhận cho tới M7 (`banh-trang-trang-bang`, `trung-vit`, `nuoc-mam-phu-quoc`). **`trung-vit` phải có ảnh thật trước buổi pitch**, vì nó nằm ngay trong lượt tìm "trung". Cách rẻ nhất là chủ dự án chụp bằng điện thoại. `muoi-tom-tay-ninh` đang dùng ảnh bột ớt (gần nhất tìm được); chủ dự án quyết ở M7.
3. Vitest chạy `fileParallelism: false` vì test ghi DB đua với test đọc DB. M3 sẽ tách DB test riêng.

**Chuyển sang M2 (đưa vào plan M2):**
- **`ProductCard` phải tái cấu trúc.** Hiện cả thẻ là một `<Link>`, nên không đặt được nút "+" hay stepper bên trong `<a>`. Cách làm: chỉ link ảnh và tên, dùng `after:absolute after:inset-0` để phủ vùng bấm; nút đặt ngoài link với `relative z-10`.
- Một chỉ báo `useNavigation` toàn cục trong root: dùng cho cả "Xem thêm" lẫn các action giỏ.
- Thanh mua dính đáy ở trang sản phẩm phải hiện "giá / đơn vị". Bố trí lại để thẻ cam kết đổi trả không bị thanh này che.
- `compareAtVnd && …` có thể render ra số `0`. Đổi thành `!= null` ở card và trang sản phẩm.
- Pill "Tạm hết hàng" thêm `text-ink` khi làm trạng thái khoá nút mua.
- Hiện dòng giá/kg trên thẻ bị rớt xuống dòng riêng làm thẻ cao không đều; sửa khi dựng lại thẻ.
- Chụp màn hình cả ở desktop (≥640px), không chỉ 375px.

**Chuyển sang M3:** test catalog đang hard-code số 24/40 sản phẩm. Chuyển sang DB test riêng `chosang_test`.

**Chuyển sang M5:** `/uploads` cache 7 ngày và không có version. Admin upload ghi đè cùng key nên cần `?v=` hoặc hash. Zod admin phải bắt `compareAt > price`.

**Chuyển sang M6:** spec ghi M1 có "poster tĩnh" làm LCP của hero, nhưng M1 chỉ làm hero chữ. Vì vậy mốc "LCP không đổi so với M1" của M6 đang so với LCP chữ. Poster ≤70KB sẽ biến LCP trang chủ thành ảnh, dự kiến khoảng 2.6s. Phải tính chung với quyết định font ở trên.

**Chuyển sang M7:**
- `demo:reset` phải xoá `uploads/products`. `ensureImage` coi output cũ là còn mới khi file nguồn jpg bị xoá để quay về placeholder.
- Polish: pill sort đang chọn quá nhạt; gallery chưa focus được bằng bàn phím; hover chưa có transition; hotline ở footer còn yếu; ảnh xoài ở trang About lẫn vào nền trắng; thẻ khuyến mãi thứ 5 đứng lẻ; nhãn "Xem tất cả" nên đổi thành "Xem tất cả sản phẩm".
- Ảnh lệch style: `pho-mai-lat`, `buoi-dien-cut`, `xoai-cat-hoa-loc-cut`, `ca-hoi-phi-le`, `ca-basa-cat-khuc`, `ba-roi-heo`, `dau-an-dau-nanh`, `bi-do-ho-lo`.
- Heading trang collection nhảy từ h1 sang h3.

## Kết quả M2 và việc chuyển sang milestone sau (15/10/2026)

M2 Giỏ hàng chạy theo quy trình tự vận hành (`docs/superpowers/autonomous-pipeline.md`): Developer lập plan → Consultant duyệt (7 thay đổi, có spike chứng minh) → 8 task, mỗi task có review → cổng Consultant + cổng Designer/Customer → một lượt sửa → re-review đạt. 88/88 test pass. Bấm nhanh trên mạng chậm không mất món. Cookie giả mạo bị loại. JS route đầu khoảng 123KB.

**Hợp đồng module thêm mới:**
- `app/lib/cart.ts`: tính tiền thuần (`cartTotals`, `applyPending`, `pendingQuantities`, `cartCount`).
- `app/lib/cart.server.ts`: `cartCookie`, `readCart`, `parseCartForm`, `setQuantities`, `getCartView`.
- `app/lib/use-cart.ts`: `useCart()`, dùng fetcher chung key `"cart"` với `flushSync`.
- `app/routes/cart.ts`: loader / action / clientAction.
- Components: `cart-control.tsx`, `cart-drawer.tsx`, `freeship-basket.tsx`, `pending-bar.tsx`, `lib/fly-to-cart.ts`.
- `env.SESSION_SECRET`, `env.COOKIE_SECURE`; `catalog.server.ts` export `visible`.
- `react-router.config.ts`: `routeDiscovery: { mode: "initial" }` (bắt buộc, chống mất món khi bấm nhanh).

**Quyết định cổng M2 (đã ghi vào spec §4):**
- Font: chỉ còn Be Vietnam Pro 400 + Bricolage 800, không preload, `font-synthesis-weight: none`. Font còn khoảng 61KB.
- Bay vào giỏ 350ms, badge nảy lúc ảnh chạm giỏ.
- Có trạng thái "đã freeship" (màu fresh + Check).
- LCP sau khi đổi font: `/` 2.0s, `/collections/all` 2.4s (đạt); trang sản phẩm 2.6s (còn lệch).

**Chuyển sang M3 (bắt buộc trong plan M3):**
- **Port test bấm nhanh và test offline sang @playwright/test.** Không có test nào giữ `flushSync` và `routeDiscovery`; xoá 1 token là mất món mà không test nào báo.
- **Giỏ trống phải gợi ý 3 món khuyến mãi có nút +.** Designer overrule Consultant: hội đồng đã chốt "rổ trống + 3 món". Dùng lại `listPromotions()` và chỉ tải khi giỏ trống.
- Cookie `__session` dùng lại `SESSION_SECRET` / `COOKIE_SECURE`. Thêm kiểm tra `SESSION_SECRET` dài ≥32 ở production.
- Mọi POST action phải kiểm Origin và giới hạn kích thước body.
- Checkout xử lý dòng hết hàng (stock 0, không tính vào tổng). `CartLine` thiếu `isWeighed` nên nhãn "tạm tính ±10%" ở checkout không có dữ liệu.
- DB test riêng `chosang_test` (từ M0); chuyển test `cart.server` không còn phụ thuộc seed.
- Đo lại JS route đầu khi thêm route (manifest load ngay từ đầu nên lớn dần).
- Trang 404 `/checkout` hiện "0 món" là đúng thiết kế (root loader không chạy cho URL không khớp); M3 sẽ có route thật.

**Chuyển sang M7:**
- Pitch phải chạy HTTPS, hoặc đặt `INSECURE_COOKIES=1` nếu demo qua http trên mạng LAN (cookie Secure sẽ không lưu).
- LCP trang sản phẩm 2.6s: thử `sizes` sát hơn cho ảnh gallery.
- Polish:
  - nút "−" ở qty 1 nên thành nút xoá;
  - "Chỉ hàng còn" → "Còn hàng";
  - collection thiếu h2;
  - thanh cuộn chip;
  - lỗi giỏ nên nêu tên món;
  - "hết hàng" lặp 3 lần trên thẻ;
  - không có gợi ý khi + bị khoá ở mức tồn kho;
  - vòng focus trên ảnh tím;
  - alert lỗi ở header không có nút đóng;
  - toast hết giờ khi đang focus "Hoàn tác";
  - focus ring xuất hiện trên tiêu đề sau khi hoàn tác.

## Kết quả M3 và việc chuyển sang milestone sau (15/10/2026)

M3 chạy theo quy trình tự vận hành. Planner prototype toàn bộ plan; Consultant duyệt với 6 thay đổi, trong đó có sửa một lỗ **open redirect** khai thác được và ba lỗi về tiền. 8 task có review riêng (review tiền và bảo mật dùng model mạnh nhất). Sau đó là cổng Consultant, cổng Designer + Customer ("khách sẽ mua"), một lượt sửa, và re-review đạt.

Kết quả đo:
- Vitest 199, e2e Playwright 13 (bản build production, DB `chosang_test`).
- JS route đầu 125.5KB.
- LCP: `/` 2.1s; `/collections/all` 2.64s (ổn định, có A/B: không do M3 mà do lưới ảnh từ M2); trang sản phẩm 2.6s.

**Hợp đồng module thêm mới:**
- `session.server.ts`: `getSession`, `commitSession`, `addGuestOrder`, `canViewOrder`, `getUser`, `requireAdmin`.
- `orders.server.ts`: `placeOrder`, `aggregateQty`, `cancelOrder`, `setOnlinePayment`, `takenSlots`, `checkoutPrefill(session)`, `getOrder`, `findOrderForPhone`, `reorderQuantities`, `toOrderView`, `listOrders`, `orderForKey`, `awaitingPayment`, `orderStatusLabel`, `paymentNote`.
- `auth.server.ts`, `forms.server.ts`, `security.server.ts` (`readForm`, `safeRedirect` không bao giờ throw), `delivery.ts`.
- `field.tsx`, `toast.tsx` (`{text,id}`), `prisma/test-db.ts`, `e2e/helpers.ts`.
- `env.DEMO_OTP`, `env.ADMIN_PASSCODE`; `config.ts` thêm `DELIVERY_SLOTS`, `SLOT_CAPACITY`, `ADMIN_PHONE`.
- Cột `Order.checkoutKey`: **ngoại lệ** của quy tắc "schema đầy đủ ở M0" (migration `20261015120000_order_checkout_key`, tạo bằng `migrate diff` + `migrate deploy`).

**Ruling quan trọng:**
- Không áp thứ tự cắt giảm. Ngày công trong spec tính cho 1 dev người; pipeline agent chạy đủ phạm vi.
- Agent chạy song song **không được dùng chung `chosang_test`**: bản sao tạm phải dùng DB riêng.
- Máy có 2 Docker engine. DB của project nằm ở context `default`; CLI có thể đang trỏ Docker Desktop. Agent luôn đặt `DOCKER_CONTEXT=default`.

**Chuyển sang M4 (bắt buộc):**
- Checkout loader/action dựng dòng giỏ quà (`bundleId`) từ cookie `b`, đưa vào tóm tắt và `total` ẩn.
- Kiểm bundle id còn tồn tại (hoặc map P2003 → "changed").
- Checkout thành công phải xoá cả `b`.
- Giữ `insertOrder` chỉ cần `isActive` để vỏ giỏ ẩn vẫn đặt được.
- Thông báo hết hàng có cách nói riêng cho giỏ quà.
- Trang đơn nhóm món theo giỏ quà, kèm preview (kiểm prefix và kích thước, đi sau kiểm quyền xem).
- Quyết UX "Mua lại" với giỏ quà.
- `/gift` dùng `readForm` với trần khoảng 100KB.
- Ghim bằng test hành vi `stock: 1` trong tổng tiền.
- Thêm `GiftBundle` vào danh sách TRUNCATE của DB test.
- **Đổi thứ tự `takenSlots(now)` lên trước `orderForKey(key)` trong action checkout** (đóng khe race vài ms của I1).

**Chuyển sang M5 (bắt buộc):**
- Mọi action admin gọi `requireAdmin` + `readForm` (upload cần trần riêng, lớn hơn 16KB).
- Đổi trạng thái là update có điều kiện theo trạng thái hiện tại và ghi `preparingAt` / `shippingAt` / `doneAt` đúng thứ tự (timeline khách đọc các cột này).
- Admin huỷ đơn đang chuẩn bị / đang giao cần biến thể có hoàn kho, kèm nhãn hoàn tiền cho đơn đã trả online.
- Quy tắc cho đơn online chưa trả khi chuyển sang chuẩn bị: chặn, hoặc chuyển COD.
- Xoá sản phẩm phải là soft delete (`isActive=false`).
- `paymentFailed` phải tính là `awaitingPayment && failed`.
- Reset bộ khoá admin giữa các test.

**Chuyển sang M7:**
- Sau proxy TLS, `request.url` phải mang đúng scheme + host công khai. Cả kiểm Origin của RR lẫn `readForm` đều cần điều này.
- Ai cũng có thể giữ admin bị khoá, nên chủ shop đăng nhập admin **trước** buổi pitch.
- Với `DEMO_OTP=1`, không cho khách thật nhập dữ liệu thật trên link công khai.
- `demo:reset` nên **đổi `SESSION_SECRET`**, đóng cả hai trường hợp id dùng lại và id cũ.
- Trim `ADMIN_PASSCODE`.
- Map lỗi timeout transaction (P2028) → không trả 500.
- Thêm bộ đếm cho tra cứu đơn theo SĐT trước khi chạy thật.
- Cân nhắc gắn `checkoutKey` với phiên nếu dùng trên thiết bị dùng chung.
- LCP `/collections/all` 2.64s và trang sản phẩm 2.6s.
- Polish còn lại trong `.superpowers/agents/m3-ui-review.md` (phần M7).

## Kết quả M4 và việc chuyển sang milestone sau (15/10/2026)

M4 chạy theo quy trình tự vận hành. Planner prototype toàn bộ plan (23 patch dry-run sạch); Consultant duyệt với 6 thay đổi bắt buộc (gồm chặn "bom giải nén" ở ảnh preview và id giỏ quà 96 bit CSPRNG). 7 task có review riêng; Task 3 và Task 6 mỗi task 1 vòng sửa. Sau đó là cổng Consultant ("Ready with fixes", 9 mục), cổng Designer + Customer ("Pass with fixes", 11 mục), một lượt sửa gộp 20 mục, và re-review đạt.

Kết quả đo:
- Vitest 266, e2e Playwright 30 (`gift.spec.ts --repeat-each=3` 51/51, không chập chờn).
- JS route đầu `/` 127.207B, `/gift` 127.985B gzip (trần 133.120). Chunk Fabric 87.647B gzip, chỉ tải sau khi `/gift` hydrate; server build không có fabric/jsdom.
- LCP: `/` 2.3s; `/collections/all` 2.8s, trang sản phẩm 2.7s, `/gift` 2.7s (vượt 2.5s, chuyển M7 cùng gốc với M1/M2). CLS < 0.1 mọi trang.

**Hợp đồng module thêm mới:**
- `gift.ts`, `gift.server.ts` (`parseGiftForm`, `createBundle`, `bundleViews`, `bundlePreview`, `getGiftBase`, `listGiftItems`), route `/gift`, `/gift/preview/:id` (nosniff, immutable).
- `cart.ts`: `BundleOp = { remove: string[]; add: string[] }`, `pendingBundleOp`, `cartFormData(quantities, op)`; `cart.server.ts`: `parseBundleForm`, `setBundles`, `liveBundleIds`, `getCartView → { lines, bundles }`.
- `orders.server.ts`: `getOrder` trả `bundles` theo thứ tự dòng; `toOrderView` trả `items` + `bundles`; P2003 trên `OrderItem_bundleId_fkey` → `changed`.
- `gift-canvas.client.ts` (Fabric 7.4, chỉ import động từ `/gift`).
- Seed: vỏ giỏ (`isGiftBase`) được `update` thêm `unit` + `description` (ngoại lệ có `ponytail:`).

**Ruling quan trọng:**
- **Giao thức giỏ quà đổi so với plan:** mọi lần gửi của fetcher "cart" mang cả hai danh sách `remove`/`add`; server bỏ trước, thêm sau; "Hoàn tác" luôn `add`. Review Task 3 tìm ra 2 thứ tự thao tác làm mất giỏ quà với giao thức một-intent của plan; e2e ghim cả hai bằng kiểm đột biến.
- Playwright `route.fetch()` vẫn ghi Set-Cookie của request mà trang đã huỷ. Muốn mô phỏng "request bị huỷ không tới server" phải trễ **trước** `route.continue()`.
- Designer chốt: vỏ giỏ vẽ vector + lượt đan mây; giữ 12 món cho M4; đơn vị vỏ giỏ "cái", không hứa nơ/thiệp.
- **DB dev `chosang` vẫn còn chữ cũ "giỏ kèm nơ và thiệp"** cho tới khi chủ shop chạy lại `npm run setup` (seed upsert, không phá dữ liệu). Agent không ghi vào DB dev.

**Chuyển sang M5 (bắt buộc):**
- Trang chi tiết đơn admin dùng lại khối giỏ quà; preview ≥240px, chạm mở ảnh lớn (`<a href={previewUrl(id)} target="_blank">`); lời chúc hiển thị nổi bật (người đóng gói viết thiệp theo đó).
- Không bao giờ xoá cứng GiftBundle (khoá ngoại ON DELETE SET NULL làm đơn mất nhóm và mất lời chúc).
- Vỏ giỏ: `unit`/`description` sửa được ở admin xung đột với seed `update` (F4) — quyết ở M5.
- (Tuỳ chọn) xác nhận "Ẩn sản phẩm" nói rõ sẽ bỏ khỏi giỏ quà đang chờ của khách.

**Chuyển sang M6:**
- Rổ Lathe dùng màu mây giống vỏ giỏ canvas (`#B9874B` / `#8A5F2E`, highlight `#D9AE73`).

**Chuyển sang M7:**
- **Trước khi có link pitch công khai:** rate limit POST `/gift` theo IP (vd. 20/10 phút) + trần tổng số dòng; dọn GiftBundle mồ côi chỉ khi không đơn nào dùng (`NOT EXISTS`); `demo:reset` TRUNCATE GiftBundle và đổi `SESSION_SECRET`.
- Kiểm tồn kho gộp giữa các giỏ quà và dòng thường trong view giỏ (tránh 409 lúc đặt).
- Chiều ngược của race N2 (sửa drawer khi POST `/gift` còn bay).
- Ảnh chủ shop: làm lại cut-out gạo ST25 (túi 5kg) và phô mai lát; đổi bánh mì sandwich → nước mắm Phú Quốc, ớt hiểm → hạt điều rang muối.
- UI giỏ quà: tương phản chữ ô bị khoá (D12), dòng phụ tên món trong drawer/checkout (D13), vừa màn 375 (D15), huy hiệu "×N" trên ô, ảnh preview phóng to ở trang đơn của khách.
- Bộ đếm lời chúc theo NFC; lời chúc dài hơn 120 bị cắt im lặng ở `maxLength`; kẹp kéo theo tâm nên món phóng to/xoay vẫn có thể lố mép.
- Bàn phím chưa di chuyển/xoay được món (Decision 18).
- LCP `/collections/all`, trang sản phẩm, `/gift`.
- Chi tiết: `.superpowers/agents/m4-final-review.md` và `m4-ui-review.md` (phần Carry-overs).
