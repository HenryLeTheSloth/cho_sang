# DEVELOPER: Đánh giá kỹ thuật

## 0. Kết quả xác minh (npm registry, Docker Hub, remix.run, ngày 14/10/2026)
- **Remix v2** (`@remix-run/*` 2.17.5) đã **hết hạn hỗ trợ (EOL) từ tháng 6/2026**. Không dùng.
- **React Router 8.4.0** (bản 8.0 ra ngày 17/06/2026) chính là bản kế thừa của Remix v2 ở "framework mode". Yêu cầu Node ≥22.22.0 (máy có 22.22.3, vừa đủ), React ≥19.2.7, Vite 7 hoặc 8. Middleware bật sẵn, chỉ hỗ trợ ESM.
- **Remix 3.0.0** lên npm ngày **01/10/2026**, tức mới 2 tuần. Blog chính thức mới chỉ có bài RC (31/08). Theo metadata npm, Remix 3 **không phụ thuộc React** mà dùng runtime riêng `@remix-run/component`.
  → Nghĩa là không dùng được @react-three/fiber, drei hay hệ sinh thái React. Hệ sinh thái lại quá non cho một bản demo giao cho khách.
- **Khuyến nghị:** khi chủ dự án nói "Remix", ta hiểu là **React Router 8 framework mode**. Cần chủ dự án xác nhận điều này bằng một dòng.
- Các phiên bản khác: three 0.186.1, @react-three/fiber 9.8.1 (React <19.4), drei 10.7.9, **fabric 7.4.0** (đã lên v7, API giống v6: import theo tên, dùng Promise).
- Prisma: bản ổn định là **7.10.0**. Lưu ý tag `latest` trên npm đang trỏ vào **8.0.0-rc.22**, nên phải ghim phiên bản (pin).
- drizzle-orm: bản ổn định là 0.45.4, còn bản 1.0 đang RC.
- Postgres: **18.6** (`postgres:18-alpine`), bản 19 vẫn là beta.
- Thư viện khác: better-auth 1.7.7, zod 4.6.7, tailwindcss 4.3.3, vite 8.3.4, vitest 5.0.4, Playwright 1.64.0, sharp 0.35.5, @node-rs/argon2 2.2.2.

## 1. Tính khả thi và rủi ro
Làm được. Phần cửa hàng là CRUD thông thường. Rủi ro thật nằm ở 4 chỗ:
- **Bundle 3D.** Riêng three đã khoảng 150KB gzip, thêm R3F và drei thành khoảng 250KB. Nếu nằm trên đường tải trang đầu tiên thì LCP trên mobile 4G sẽ rất tệ. **Cách xử lý:** chỉ đặt ở một route, `import()` động sau khi trang đã hiển thị, và không bao giờ là nội dung LCP.
- **SSR.** Cả Three và Fabric đều cần `window` hoặc canvas. Phải đặt trong `useEffect` kèm `import()` động. Không dùng thư viện "ClientOnly", vì vài dòng code là đủ. Server render ảnh poster tĩnh.
- **Mobile.** WebGL trên máy Android tầm trung dễ nóng máy và tụt FPS. Cần giới hạn DPR ≤ 1.5, dừng render khi khối nằm ngoài màn hình (IntersectionObserver), và tôn trọng `prefers-reduced-motion` (khi đó chỉ hiện ảnh tĩnh).
- **Ảnh sản phẩm.** Đây mới là thứ quyết định web chạy nhanh hay chậm, 3D chỉ là phụ. Khi upload, admin dùng sharp tạo ảnh webp 2 cỡ (480 và 1080), dùng `<img srcset loading="lazy">` có sẵn của trình duyệt, đặt `width`/`height` cố định để tránh nhảy layout (CLS).

## 2. Stack đề xuất
| Hạng mục | Chọn | Lý do |
|---|---|---|
| Framework | react-router 8.4 + @react-router/dev 8.4, React 19.3, Vite 8 | Kế thừa Remix, có loader/action, có SSR |
| DB | `postgres:18-alpine` qua docker-compose, mount volume | Bản ổn định mới nhất |
| ORM | **Prisma 7.10.0 (ghim cứng)** + `@prisma/adapter-pg` | Migrate ổn định, có Prisma Studio để sửa dữ liệu nhanh lúc demo. Drizzle đang chuyển sang 1.0 RC nên tránh lúc này |
| Auth | **Tự làm:** `createCookieSessionStorage` có sẵn của RR (httpOnly, sameSite=lax, secure, ký bằng secret) + `@node-rs/argon2` | Chỉ có email/mật khẩu, khoảng 80 dòng. Better Auth thừa cho nhu cầu này. Cần OAuth thì mới chuyển sang Better Auth |
| Styling | Tailwind 4.3, không dùng thư viện component | Cart drawer dùng `<dialog>` có sẵn của trình duyệt |
| Validation | zod 4 phía server trong action + validation HTML có sẵn ở client | Bỏ Conform: form ít, không đáng thêm một tầng |
| Ảnh | sharp, lưu vào `./uploads` (volume) | Không S3, không CDN, không image proxy |
| Test | Vitest 5 cho logic tiền (tổng đơn, trừ kho) + **1** luồng Playwright: thêm vào giỏ → COD → admin thấy đơn | Đủ để tự tin khi demo |
| Docker | Compose chỉ chạy `db`. App chạy trên host khi dev. Thêm một `Dockerfile` (node:24-alpine) khi cần deploy | Node 22 sẽ EOL khoảng 4/2027 |

**Cố tình KHÔNG dùng:** Redis, hàng đợi (queue), gửi email thật, i18n framework (chỉ có tiếng Việt), state manager (loader đã là state), GraphQL/tRPC, microservice, CMS headless, R3F hoặc drei (xem mục 5), tính năng RSC.

## 3. Data model
- `users`: id, email (unique), password_hash, name, phone, role (`customer`/`admin`), created_at
- `categories`: id, slug, name, image, sort
- `products`: id, slug, name, description, price_vnd (int), compare_at_vnd?, unit ("500g", "bó"), stock (int, CHECK ≥0), images (text[]), category_id, is_active, created_at
- `orders`: id, code (ví dụ "DH24xxxx"), user_id?, các trường snapshot `customer_name`, `phone`, `address`, `note`, `subtotal_vnd`, `shipping_vnd`, `total_vnd`, `payment_method` (`cod`/`online_mock`), `payment_status` (`unpaid`/`paid`/`failed`), `status` (`pending`/`confirmed`/`shipping`/`done`/`cancelled`), `gift_card` (jsonb?), created_at
- `order_items`: order_id, product_id, name_snapshot, price_snapshot_vnd, qty
- `contact_messages`: id, name, email, message, created_at

Tiền lưu dạng **số nguyên VND**, không dùng float. Trừ kho trong transaction bằng `UPDATE products SET stock = stock - $q WHERE id=$id AND stock >= $q`. Nếu không có dòng nào bị ảnh hưởng thì báo hết hàng.

**Giỏ hàng: lưu trong cookie session cho cả khách vãng lai lẫn người đã đăng nhập** (`[[productId, qty], ...]`). Giá luôn đọc lại từ DB, không tin cookie. Không cần bảng `carts`, không cần logic gộp giỏ khi đăng nhập. Giới hạn 4KB vẫn chứa được hơn 100 dòng.
Đánh đổi: giỏ hàng không đồng bộ giữa các thiết bị. Nếu khách cần tính năng đó thì thêm bảng `cart_items(user_id, …)` sau.

## 4. Route map (`app/routes.ts`)
- `/`: loader lấy danh mục và sản phẩm nổi bật. Hero 3D tải muộn.
- `/collections/:slug` (có cả `all`): loader đọc `?sort` và `?page` từ search params.
- `/products/:slug`: loader. Nút thêm vào giỏ là `fetcher.Form` gửi tới `/cart`.
- `/cart`: resource route. Loader trả chi tiết giỏ cho drawer (`fetcher.load`). Action xử lý add/update/remove. Drawer là `<dialog>` nằm trong root. Root loader trả số lượng trong giỏ.
- `/about`: trang tĩnh. `/contact`: action ghi vào `contact_messages`.
- `/login`, `/register`: action. `/logout`: chỉ có action (POST).
- `/checkout`: loader chuyển hướng nếu giỏ rỗng và điền sẵn thông tin user. Action validate bằng zod, tạo order trong transaction, xoá giỏ. COD thì chuyển sang `/orders/:code`. Online thì chuyển sang `/checkout/pay/:code`.
- `/checkout/pay/:code`: cổng thanh toán giả lập, có 2 nút "Thành công" / "Thất bại". Action cập nhật `payment_status`.
- `/orders/:code`: trang đơn hàng / xác nhận. Chủ đơn xem được, khách vãng lai xem bằng code kèm SĐT. `/account/orders`: lịch sử đơn.
- `/admin` (layout + middleware `requireAdmin`): `/admin/products`, `/admin/products/new`, `/admin/products/:id` (action upload ảnh + zod), `/admin/orders`, `/admin/orders/:id` (action đổi trạng thái).

## 5. Three.js và Fabric.js
**Three.js: duy nhất một hero 3D ở homepage.** Ví dụ một giỏ rau củ low-poly xoay nhẹ, có thể kéo để xoay.
- Dùng **three thuần** trong một `useEffect` (khoảng 100 dòng), 1 file `.glb` nén Draco ≤ 500KB.
- Ảnh poster SSR chính là phần tử LCP. Canvas fade-in đè lên khi đã tải xong.
- Mobile yếu hoặc reduced-motion thì giữ nguyên poster.
- Chỉ chuyển sang R3F nếu Designer muốn từ 2 cảnh 3D trở lên.

**Fabric.js: "Thiệp quà tặng kèm đơn"**, một bước tuỳ chọn ở checkout.
- Khách chọn mẫu nền, gõ lời chúc, kéo vài sticker trái cây có sẵn.
- Lưu `canvas.toJSON()` vào `orders.gift_card` (jsonb). Admin xem lại bằng cách load JSON đó (cùng chunk đã tải muộn).
- Fabric chỉ được tải khi bấm "Thêm thiệp". Có nút bỏ qua. Không có Fabric thì checkout vẫn hoạt động bình thường.

**Ranh giới tôi KHÔNG chấp nhận:**
- 3D trên từng trang sản phẩm (cần model cho mỗi SKU, chi phí nội dung rất lớn).
- 3D hoặc Fabric chặn luồng mua hàng.
- Khách upload ảnh tuỳ ý lên canvas (rủi ro kiểm duyệt nội dung và lưu trữ).
- "Tự xếp giỏ quà bằng kéo thả" đồng bộ với giỏ hàng (để v2).
- Physics, postprocessing, cảnh 3D chạy theo scroll.

## 6. Ước lượng (1 dev, tính bằng ngày công)
| Milestone | Nội dung | Ngày |
|---|---|---|
| M0 | Khung RR8, compose, Prisma, Tailwind, seed khoảng 40 sản phẩm | 1 |
| M1 | Home, collection, product, about, contact, pipeline ảnh | 3 |
| M2 | Auth, cart cookie, drawer | 2.5 |
| M3 | Checkout, COD + thanh toán giả lập, trang đơn, lịch sử đơn | 2.5 |
| M4 | Admin CRUD sản phẩm + upload, quản lý trạng thái đơn | 2.5 |
| M5 | Hero Three (chưa tính thời gian làm hoặc mua model) + thiệp Fabric | 3.5 |
| M6 | Test, đo hiệu năng trên máy Android thật, Dockerfile, seed demo | 2 |
| **Tổng** | | **khoảng 17 ngày, tức 3.5–4 tuần** kể cả dự phòng |

## Phản biện / câu hỏi gửi Designer
1. **Model 3D ai làm?** Nếu cần model riêng theo thương hiệu thì đó là chi phí lớn nhất của M5. Tôi đề xuất dùng model CC0 hoặc stock, kèm poster render từ chính model đó.
2. **Animation khi thêm vào giỏ** (ảnh bay vào giỏ, hiệu ứng confetti): tôi chỉ nhận CSS transition kèm badge số lượng nhảy. Không dùng GSAP hay Framer Motion cho một hiệu ứng.
3. **Ảnh sản phẩm:** cần chốt **một tỉ lệ duy nhất** (ví dụ 1:1, nền sáng). Nếu ảnh mỗi cái một tỉ lệ thì grid vỡ và phải crop thủ công.
4. **Cart drawer trên mobile:** dùng `<dialog>` toàn màn hình, không có swipe-to-close hay bottom sheet có gesture riêng. Nếu muốn có thì phải bỏ một thứ khác.
5. **Font và màu:** tối đa 2 font có hỗ trợ tiếng Việt, tự host. Không dùng icon font nặng, chỉ dùng SVG inline. Bộ lọc collection: chỉ lọc theo danh mục và sắp xếp theo giá, không có thanh trượt khoảng giá nhiều chiều cho bản MVP.

Nguồn: [Blog React Router v8](https://remix.run/blog/react-router-v8), [Changelog RR 8.0.0](https://reactrouter.com/8.0.0/changelog.md), [Lịch sử Remix](https://remix.run/remix-history), [Blog Remix](https://remix.run/blog). Phiên bản kiểm tra qua `npm view` và API Docker Hub vào ngày 14/10/2026.
