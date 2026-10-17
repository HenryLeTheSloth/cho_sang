# Spec: Web đi chợ "Chợ Sáng" (MVP demo)

*Ngày 14/10/2026. Nguồn: quyết định cuối của Consultant, sau 2 vòng tranh luận giữa Designer, Developer và Customer (biên bản trong `docs/council/`), cộng với các quyết định của chủ dự án ở mục 9.*

Nguyên tắc phân xử: (1) Khách xem pitch phải mua được một rổ hàng trong 3 phút trên điện thoại, (2) mỗi hiệu ứng Three/Fabric phải kể được một câu chuyện kinh doanh, (3) tiền và kho không được sai, (4) cái gì không cần cho buổi pitch thì không build.

---

## 1. Tóm tắt điều hành
1. **Sản phẩm:** web đi chợ online cho đồ ăn hằng ngày (rau, trái cây, thịt cá, trứng sữa), giao trong ngày theo khung giờ, COD mặc định. Tiếng Việt, VND, ưu tiên mobile. Có admin để chủ shop xử lý đơn.
2. **Câu chuyện pitch:** "Đi chợ sáng trong 3 phút, bằng một tay." Mở web, tìm "trung" ra trứng. Bấm + ngay trên thẻ. Rổ đầy dần tới mức freeship. Checkout một trang, không cần tài khoản. Sau đó chuyển sang admin đổi trạng thái đơn, quay lại thấy timeline của khách cập nhật.
3. **Đoạn cao trào khi pitch:** khách tự xếp **giỏ quà biếu** trên canvas (Fabric). Giỏ quà vào giỏ hàng, vào đơn, rồi hiện ra ở admin để soạn hàng. Đây là mảng biên lợi nhuận cao dịp Tết và Trung thu.
4. **Khác biệt:** art direction "Chợ Sáng" (CTA màu magenta thanh long, hiếm trong ngành grocery). Thông tin tạo niềm tin đặt lên trước: nguồn gốc, hạn dùng, giá/kg, đổi hàng hỏng trong 24h. Rổ freeship hiện con số còn thiếu. Tìm kiếm gõ không dấu vẫn ra.
5. **Kỹ thuật:** React Router 8 (framework mode, kế thừa Remix) + Postgres 18 + Prisma 7. Three.js chỉ dùng ở **một** hero homepage, dựng bằng code và tải sau. Fabric chỉ có ở `/gift`. Ước lượng khoảng **21 ngày công + 2 ngày dự phòng**.

---

## 2. Bảng phán quyết

| Chủ đề | Designer | Developer | Customer | **QUYẾT ĐỊNH** | Lý do |
|---|---|---|---|---|---|
| Framework | (không nêu) | React Router 8.4 framework mode, không dùng Remix 3 | (không nêu) | **React Router 8.4 framework mode.** Cấm import `@remix-run/*` | Remix v2 đã hết hỗ trợ (EOL). Remix 3 mới ra 2 tuần và không dùng React, nên mất cả hệ sinh thái React. RR8 chính là "Remix" về mặt kỹ thuật (loader/action/SSR). Cần chủ dự án xác nhận 1 dòng (câu hỏi Q1) |
| Art direction | Chợ Sáng, dự phòng Tủ Mát | (không nêu) | Chợ Sáng có điều kiện. Magenta gợi MoMo/mỹ phẩm | **Chợ Sáng.** Bỏ hướng Tủ Mát | Tủ Mát giống Kingfoodmart, xem xong là quên. Pitch cần khách nhớ được |
| Cách dùng magenta | CTA + tag giá | (không nêu) | Chỉ nút và giá, không phủ mảng lớn | **Magenta chỉ dùng cho: nút CTA, giá bán, badge số lượng giỏ, logo, focus ring.** Không làm nền section, không làm nền banner. Chiếm tối đa khoảng 10% diện tích mỗi màn hình. Màu xanh lá chuối ("Còn hàng / Mới về") phải luôn thấy được trên thẻ | Giữ được điểm khác biệt mà không biến web thành ví điện tử. Xanh lá giữ một nghĩa duy nhất là tươi/còn hàng |
| Phạm vi Three.js | Hero + rổ freeship + Bổ thử | Chỉ 1 hero | 1 chỗ nhỏ, tải sau | **Chỉ 1 hero homepage**, cao ≤45vh trên mobile. Thanh tìm kiếm và danh mục HTML nằm ngay dưới | Chủ dự án yêu cầu có Three. Một cảnh là đủ để mở màn pitch mà không đụng vào luồng mua |
| Model 3D | Dựng bằng `LatheGeometry` + sprite | glb nén Draco ≤400KB, nguồn CC0 | (không nêu) | **`LatheGeometry` (rổ) + texture đan nhựa vẽ bằng CanvasTexture + sprite dùng ảnh cut-out sản phẩm.** Không dùng glb, không dùng Draco | Không tốn chi phí model, đồng bộ ảnh sản phẩm, chunk nhỏ hơn, không phụ thuộc người làm 3D |
| Rổ freeship | Ban đầu WebGL, sau chuyển SVG | SVG + CSS | Phải có dòng chữ số tiền còn thiếu | **SVG + CSS `clip-path`**, kèm dòng "Còn 42.000₫ nữa được freeship" | Drawer là chỗ thao tác nhiều nhất, khởi tạo WebGL 100–300ms vi phạm "cart tức thì". Con số mới là thứ bán được hàng |
| "Bổ thử" | Từ 3D chuyển sang v2 | Slider ảnh | Ảnh bổ đôi thật, không cần 3D | **3D sang v2.** MVP: `images[1]` (ảnh bổ đôi) hiện thành ảnh thứ hai trong gallery. Slider `<input type=range>` + `clip-path` để mục "Nếu kịp" | Khách tin ảnh thật hơn model. Slider chỉ là lớp trình bày trên cùng dữ liệu đó |
| Fabric: thiệp hay giỏ quà | Giỏ quà nhanh | Giỏ quà (đã đổi lập trường) | Giỏ quà hay khi pitch. Thiệp phải ẩn | **Giỏ quà ở `/gift`.** Lời chúc là text object nằm trên canvas. **Không có bước thiệp ở checkout** | Đây là câu chuyện kinh doanh duy nhất có biên lợi nhuận. Checkout giữ ngắn đúng yêu cầu của Customer |
| Mô hình dữ liệu giỏ quà | Đẩy thành dòng giỏ thường, layout lưu vào `orders.gift_card` | Bảng `gift_bundles(items, layout, message)`, `order_items.bundle_id` | (không nêu) | **Bảng `gift_bundles`, nhưng gọn hơn bản của Dev:** `layout` là nguồn duy nhất (danh sách món suy ra bằng cách đếm `pid` trong layout, không lưu `items` riêng). **Vỏ giỏ là một product** (`is_gift_base`), nên phí giỏ, kho vỏ giỏ và snapshot đều đi theo đường của sản phẩm thường. Lưu thêm `preview` (webp dataURL ≤60KB, tạo ở client) để drawer/đơn/admin chỉ hiện `<img>`, **không tải Fabric ngoài `/gift`**. Trong giỏ hàng là 1 dòng "Giỏ quà · N món", số lượng cố định là 1 | Nếu đẩy thành dòng thường thì khách sửa số lượng trong drawer sẽ làm hỏng bố cục, và admin không biết món nào thuộc giỏ để soạn. Bỏ `items` thì hết cảnh hai nguồn dữ liệu lệch nhau. Coi vỏ giỏ là product thì không cần code xử lý riêng cho phí giỏ |
| Auth | (V2) SĐT + mật khẩu 6 ký tự | (V2) SĐT + OTP giả lập | SĐT+OTP hoặc Google; email cũng được miễn checkout khách | **SĐT + OTP giả lập**, chỉ chạy khi `DEMO_OTP=1`. Mã hiện trong toast có nhãn DEMO, mỗi mã thử tối đa 5 lần, hết hạn sau 5 phút, hash lưu trong cookie ký. **Admin không thấy OTP trên màn hình**: SĐT admin phải nhập `ADMIN_PASSCODE` (biến môi trường). Đăng nhập lần đầu tự tạo tài khoản và tự gắn các đơn khách vãng lai có cùng SĐT. Google để v2 | Đúng thói quen người Việt. Bỏ được mật khẩu, argon2 và trang register. SĐT cũng là khoá tra đơn. Nếu OTP admin hiện trên màn hình thì trên link demo công khai ai cũng thành admin, nên phải chặn |
| Giỏ hàng | (không nêu) | Cookie | Giữ được giỏ khi đóng tab | **Cookie `cart` riêng** (30 ngày, httpOnly, có ký), tách khỏi cookie session để đăng xuất vẫn giữ giỏ. Dạng `{l:[[pid,qty]], b:[bundleId]}`. Zod validate mỗi lần đọc (tối đa 50 dòng, qty 1–99). Giá luôn đọc lại từ DB | Không cần bảng carts, không cần gộp giỏ khi đăng nhập. Mất đồng bộ giữa các thiết bị thì không ai thấy trong buổi demo |
| Hàng cân ký | `unit_weight_g`, nhãn ±10% | Gói cố định `net_grams`, qty nguyên, admin nhập cân thực tế | Nhãn ±10% là đủ, bỏ được | **MVP:** `net_grams` + `is_weighed`, số lượng là số nguyên gói, giá/kg tính khi hiển thị, nhãn "Giá tạm tính, cân thực tế ±10%". **Admin nhập cân thực tế (`weighed_grams`, `final_*`) để mục "Nếu kịp"**, khi làm mới thêm cột | Không cần số thập phân trong toán tiền. Phần chỉnh giá sau khi cân không xuất hiện trong luồng pitch chính |
| Tìm kiếm | `unaccent` + ILIKE | `unaccent` + ILIKE ở `/collections/all?q=` | Bắt buộc | **Bắt buộc. Cột `products.name_search`** (bỏ dấu + chữ thường, `đ→d`, tính ở app khi seed/lưu) và dùng Prisma `contains`. Ô tìm kiếm dính ở header, `<Form method="get">` tới `/collections/all?q=` | Cùng kết quả với unaccent nhưng không cần `$queryRaw` hay extension, ghép chung một `findMany` với lọc, sắp xếp và phân trang. Một hàm `toSearch()` có 1 test |
| Phân trang | "Xem thêm", giữ `?page` | "Xem thêm" bằng fetcher | Không làm 1-2-3 | **"Xem thêm" là `<Link to="?page=n" preventScrollReset>`. Loader trả `take: n*24`** (tải lại từ đầu) | Không cần fetcher, không cần state nối danh sách, chạy được khi chưa có JS, URL chia sẻ được. Dưới 500 SKU nên tải lại vẫn rẻ |
| Lọc | Chip danh mục + "Còn hàng" | Danh mục + sắp xếp giá | Danh mục + giá + "Còn hàng" | **Chip danh mục + sắp xếp (giá tăng, giá giảm, mới) + toggle "Còn hàng"** | Toggle chỉ là một điều kiện WHERE, lại đúng nỗi đau Customer kể về Bách Hóa Xanh. Bỏ lọc theo thương hiệu |
| Contact | Hotline/Zalo lên đầu, form để sau | Form ghi DB | Form để sau | **Trang tĩnh**: `tel:`, link Zalo, địa chỉ, giờ mở cửa, chính sách đổi hàng hỏng. **Không làm form, không có bảng `contact_messages`** | Customer nói gọi điện là đủ. Bớt một bảng và một action |
| Timeline / budget | (không nêu) | 23.5 ngày | (không nêu) | **21 ngày công + 2 ngày dự phòng = 23 (khoảng 4.5 tuần, 1 dev).** Checkpoint cuối M3: trễ hơn 1.5 ngày thì áp dụng thứ tự cắt giảm ở mục 3 | Đã cắt form contact, admin cân, slider, "Mua lại" ở homepage, "Báo khi có hàng". Bù thêm phần giỏ quà và OTP |

---

## 3. Phạm vi

### MVP bắt buộc
- **Home:** poster hero (LCP) với rổ 3D phủ lên sau. Chip danh mục. Dòng "Giao trong 2h · Freeship từ 300.000₫". Mục "Khuyến mãi hôm nay" (sản phẩm có `compare_at_vnd`). Đường vào `/gift`. Không carousel.
- **Collection:** chip, sắp xếp, "Còn hàng", tìm kiếm, "Xem thêm". Thẻ có giá + đơn vị + giá/kg + nguồn gốc, nút **+** chuyển thành stepper ngay trên thẻ, badge "Hết hàng" và khoá nút khi hết.
- **Product:** 2 ảnh (nguyên quả / bổ đôi nếu có), đơn vị, giá/kg, nguồn gốc, hạn dùng, bảo quản, nhãn ±10%, cam kết "Hỏng/héo đổi trong 24h". Nút mua dính đáy màn hình.
- **Cart drawer** (`<dialog>`): stepper gửi số lượng tuyệt đối, xoá có toast "Hoàn tác" 5 giây, rổ SVG freeship có con số, nút đóng 44px, nút "Thanh toán · tổng" dính đáy, dòng giỏ quà có ảnh preview. Thêm hàng thì badge nảy, ảnh thu nhỏ bay vào bằng CSS.
- **Checkout 1 trang, không bắt đăng nhập:** tên, SĐT, địa chỉ (textarea), khung giờ (đầy thì disable), ghi chú, checkbox "Gọi hỏi nếu hết hàng", COD chọn sẵn, online giả lập. Nút ghi "Đặt hàng · 312.000₫".
- **Thanh toán giả lập** `/checkout/pay/:code`: banner "DEMO, không trừ tiền thật". Có đủ các nhánh: chờ, thành công, thất bại, thử lại, chuyển sang COD.
- **Đơn hàng:** `/orders/:code` có timeline 4 bước do admin cập nhật, huỷ khi đơn còn `pending` (hoàn kho), "Mua lại đơn này", hotline. Tra đơn bằng mã + SĐT. `/orders` liệt kê đơn.
- **Đăng nhập OTP / đăng xuất** (POST, toast, quay về trang cũ). Trang xác nhận đơn có nút "Lưu đơn vào tài khoản", dẫn tới `/login?phone=`.
- **Giỏ quà Fabric** `/gift`: 1 vỏ giỏ, khoảng 12 món có cut-out, chạm để thêm, kéo/xoay/phóng to, tối đa 10 món, lời chúc ≤120 ký tự, thêm vào giỏ hàng.
- **Admin:** danh sách đơn đổi trạng thái ngay trên dòng. Chi tiết đơn có món theo nhóm giỏ quà và ảnh preview. CRUD sản phẩm có upload ảnh (sharp).
- **About:** chuyện nguồn hàng, ảnh người trồng, chính sách đổi trả. **Contact:** trang tĩnh.

### Nếu kịp (theo thứ tự ưu tiên)
1. Slider ảnh bổ đôi (0.5 ngày)
2. View Transitions cho hiệu ứng bay vào giỏ (0.25)
3. "Mua lại" ở homepage cho người đã đăng nhập (0.25)
4. Admin nhập cân thực tế, tính `final_total_vnd` (1)
5. Form liên hệ (0.25)

### v2
"Bổ thử" 3D, rổ 3D có vật lý, kéo thả từ danh sách vào giỏ quà, sửa giỏ quà đã tạo, nhiều mẫu giỏ, giá combo, Fabric tạo banner trong admin, meal planner, dark mode, Google/SMS OTP thật, "Báo khi có hàng", gesture cho drawer, thanh trượt giá, đồng bộ giỏ giữa nhiều thiết bị, thanh toán thật.

### Thứ tự cắt khi trễ (cắt từ trên xuống)
1. Toàn bộ mục "Nếu kịp".
2. Hiệu ứng bay vào giỏ (chỉ giữ badge nảy).
3. Hero 3D chỉ tự xoay, bỏ tương tác kéo và chạm sprite (tiết kiệm 0.5–1 ngày). **Không cắt hẳn**, vì chủ dự án yêu cầu Three.
4. "Mua lại đơn này" và nút "Lưu đơn vào tài khoản".
5. Đòn bẩy cuối: giỏ quà bỏ `preview`, trang đơn/admin render lại layout bằng chunk Fabric (tiết kiệm khoảng 0.5 ngày).

**Không bao giờ cắt:** checkout khách, tìm kiếm, + trên thẻ, trạng thái đơn thật, giá/đơn vị/nguồn gốc, giỏ quà Fabric, nhãn DEMO.

---

## 4. Design system chốt

### Palette (đã tính lại contrast)
| Token | Hex | Vai trò | Contrast |
|---|---|---|---|
| `--bg` Gạo mới | `#FAFAF5` | Nền trang | n/a |
| `--surface` | `#FFFFFF` | Thẻ, drawer, form | n/a |
| `--ink` Cà tím | `#2A1B3D` | Chữ chính, icon | 15.2:1 trên bg |
| `--ink-muted` | `#5E5470` | Chữ phụ, đơn vị, giá gạch | 6.7:1 |
| `--line` | `#E4DFEA` | Viền, đường kẻ (chỉ trang trí) | n/a |
| `--brand` Thanh long | `#C8246B` | CTA, giá bán, badge giỏ, focus ring | 5.1:1 trên bg; chữ trắng trên nó 5.4:1 |
| `--brand-press` | `#A61D58` | Hover/active của CTA | chữ trắng 7.2:1 |
| `--fresh` Lá chuối | `#2F7A34` | Còn hàng, mới về, thành công, bước timeline đã qua | 5.1:1; trên tint 4.65:1 |
| `--fresh-tint` | `#E8F3E6` | Nền badge "Còn hàng" | n/a |
| `--sun` Xoài cát | `#FFC83D` | Chỉ dùng cho rổ freeship và badge khuyến mãi "−20%" | chữ cà tím trên nó 10.3:1 |
| `--danger` | `#B42318` | Chỉ cho lỗi form (luôn kèm icon + chữ) | 6.3:1 |

**Cấm:** chữ trắng hoặc chữ magenta trên nền xoài (3.5:1). Magenta làm nền section. Dùng màu đơn thuần để báo trạng thái (luôn kèm chữ). Bỏ màu "Ớt".

### Font
- **Display / giá:** Bricolage Grotesque, chỉ dùng 1–2 instance tĩnh (ExtraBold Condensed cho giá, Bold cho tiêu đề), không nạp đủ các trục variable.
- **Body:** Be Vietnam Pro 400 (sửa 15/10 theo quyết định Designer ở cổng M2: bỏ weight 600 và bỏ preload font để kéo LCP về ≤2.5s; nhấn mạnh dùng Bricolage 800; `font-synthesis-weight: none` để trình duyệt không giả đậm làm nhoè dấu).
- Tự host woff2 subset `vietnamese` + `latin`, tổng ≤100KB, không preload font (quyết định cổng M2). Giá dùng `font-variant-numeric: tabular-nums`. Line-height display ≥1.1, body 1.5. Phải test chuỗi "Bưởi Diễn, Rau muống, Sữa tươi" ở weight 800 tại M0.

### Motion
- Chỉ **một** khoảnh khắc đặc trưng: thêm vào giỏ thì ảnh thu nhỏ bay vào (350ms, kết thúc ở opacity 0, là ngoại lệ duy nhất của quy tắc 150–200ms) và badge nảy đúng lúc ảnh chạm giỏ. Mọi chuyển động khác chỉ là phản hồi cho hành động.
- Thời lượng: vào 200ms, ra 150ms, phản hồi nhỏ 150ms. Easing `cubic-bezier(.2,.8,.2,1)`.
- Không fade-up theo section, không carousel tự chạy, không video tự phát, không 3D chạy theo scroll.
- Khi bật `prefers-reduced-motion`: không dùng transform, chỉ đổi opacity ≤100ms, hero chỉ hiện poster.
- Hero 3D: DPR ≤1.5, dừng render khi khuất khỏi màn hình hoặc tab bị ẩn, dispose khi unmount.

### UX không nhượng bộ
Bố cục 375px làm trước. Vùng chạm ≥44px. Đủ trạng thái hover/focus-visible/active/disabled/loading/empty/error. Label luôn hiển thị (không chỉ placeholder). Báo lỗi inline ngay cạnh field. Giá luôn format bằng `Intl.NumberFormat('vi-VN')` và luôn kèm đơn vị bán. Ảnh 1:1, cùng nền sáng và cùng phong cách chụp. Mỗi nhóm ảnh lấy từ một nguồn, không trộn lẫn các phong cách (xem mục 9). Icon SVG (Lucide), không dùng emoji. Không popup hay xin quyền thông báo khi mới vào. Phí ship và ngưỡng freeship hiện ngay trong giỏ. 3D/canvas không bao giờ chặn nút mua và luôn có fallback tĩnh. Mọi màn thanh toán giả lập có nhãn DEMO.

---

## 5. Kiến trúc chốt

### Stack (ghim bản chính xác, `.npmrc: save-exact=true`, có `engines.node`)
| Gói | Phiên bản |
|---|---|
| Node (dev host + Dockerfile) | 22.22.x (`node:22.22-alpine`). Dùng cùng major giữa dev và runtime |
| react-router, @react-router/dev, @react-router/node, @react-router/serve | 8.4.0 |
| react, react-dom | 19.3.x (ghim theo lockfile) |
| vite | 8.3.4 |
| tailwindcss, @tailwindcss/vite | 4.3.3 (cấu hình CSS-first, không có `tailwind.config.js`) |
| prisma, @prisma/client, @prisma/adapter-pg (+ pg) | **7.10.0**. Tag `latest` trên npm là 8.0 RC, **cấm** dùng |
| PostgreSQL | `postgres:18.6-alpine` (docker-compose, volume `pgdata`) |
| zod | 4.6.7 |
| three | 0.186.1 (three thuần, **không** dùng R3F/drei) |
| fabric | 7.4.0 |
| sharp | 0.35.5 |
| lucide-react | ghim khi cài |
| vitest / @playwright/test | 5.0.4 / 1.64.0 |

**Không dùng:** Remix 3, `@remix-run/*`, R3F/drei, better-auth, argon2, Conform, state manager, Redis/queue, i18n lib, S3/CDN, thư viện component, GSAP/Framer Motion, Lighthouse CI.

### Data model (Prisma; tiền là `Int` VND; id của sản phẩm là `Int` để cookie nhỏ)
- **User:** id, phone (unique), name?, email?, role (`customer`|`admin`), createdAt
- **Category:** id, slug (unique), name, image, sort
- **Product:** id, slug (unique), name, nameSearch, description, categoryId, priceVnd, compareAtVnd?, unit ("500g", "bó ~300g", "hộp 10 quả"), netGrams?, isWeighed, origin, shelfLife, storage, stock (**CHECK ≥0** bằng SQL trong migration), images text[] ([0] chính, [1] bổ đôi), cutoutUrl? (có giá trị = được dùng trong giỏ quà), isGiftBase (vỏ giỏ, ẩn khỏi collection), isActive, createdAt
- **Order:** id, code (unique, "DH" + ngày + 4 ký tự ngẫu nhiên), userId?, customerName, phone, address, note, callOnSubstitute, deliveryDate, deliverySlot, subtotalVnd, shippingVnd, totalVnd, paymentMethod (`cod`|`online_mock`), paymentStatus (`unpaid`|`paid`|`failed`), status (`pending`|`preparing`|`shipping`|`done`|`cancelled`), createdAt, preparingAt?, shippingAt?, doneAt?, cancelledAt?
- **OrderItem:** id, orderId, productId, bundleId?, nameSnapshot, unitSnapshot, priceSnapshotVnd, qty
- **GiftBundle:** id (cuid), baseProductId, layout jsonb `[{pid,x,y,s,r}]` (≤10 phần tử, pid phải có cutout), message (≤120), preview (`data:image/(webp|jpeg);base64,…` ≤60KB, kiểm tra prefix, độ dài và header: định dạng đúng tiền tố, cả hai cạnh ≤480px; jpeg là nhánh dự phòng cho Safari), createdAt
- **Hằng số** (`app/lib/config.ts`): SHIPPING_VND=20000, FREESHIP_FROM_VND=300000, DELIVERY_SLOTS, SLOT_CAPACITY=20, GIFT_MAX_ITEMS=10, HOTLINE, ZALO_URL
- **Quy tắc:**
  - Checkout chạy trong một transaction: gộp số lượng theo sản phẩm (dòng thường + món trong giỏ quà + vỏ giỏ), rồi `UPDATE … SET stock=stock-q WHERE id=? AND stock>=q`. Nếu có dòng nào không cập nhật được thì báo hết hàng cho đúng món đó.
  - Huỷ đơn: `UPDATE … WHERE status='pending'` và hoàn kho.
  - Đơn trả online thất bại vẫn giữ kho tới khi huỷ (`ponytail:` không có TTL, thêm job dọn dẹp nếu chạy thật).
- **Cookie:** `__session` (userId, guestOrderCodes, otp {hash, exp, tries}) và `cart` (`{l, b}`). Đều 30 ngày, httpOnly, sameSite=lax, secure ở production, có ký.

### Route map (`app/routes.ts`)
| Route | Ghi chú |
|---|---|
| `/` | Home |
| `/collections/:slug` | Có `all`. Đọc `?q ?sort ?instock ?page` |
| `/products/:slug` | Trang sản phẩm |
| `/cart` | Resource route. Loader trả dữ liệu cho drawer. Action với intent `set`/`remove`/`bundle`; mọi lần gửi mang các cặp pid/qty đang chờ + hai danh sách giỏ quà `bundleRemove`/`bundleAdd` (bỏ trước, thêm sau); "Hoàn tác" là gọi lại `set`, hoặc `bundleAdd` lại id giỏ quà |
| `/gift` | Fabric tải động. Action tạo GiftBundle rồi thêm vào cookie |
| `/gift/preview/:id` | Resource route phát ảnh xem trước. id 96 bit (CSPRNG) là chìa khoá; `Cache-Control: private, immutable`; `X-Content-Type-Options: nosniff` |
| `/checkout` | Giỏ rỗng thì redirect. Điền sẵn thông tin từ đơn gần nhất của user. Action dùng zod + transaction |
| `/checkout/pay/:code` | Cổng thanh toán giả lập |
| `/orders` | Đã đăng nhập: đơn của user. Khách: các đơn trong session + form tra cứu |
| `/orders/:code` | Xem được nếu là chủ đơn hoặc mã nằm trong session; nếu không thì hiện form nhập SĐT. Action: `lookup`, `cancel`, `reorder` |
| `/login` | OTP 2 bước, `?redirectTo` (chỉ nhận path tương đối) |
| `/logout` | Chỉ có action POST |
| `/about`, `/contact` | Trang tĩnh |
| `/uploads/:file` | Resource route đọc ảnh từ volume `./uploads` (cache dài hạn). Không đặt trong `public/`, vì build sẽ không phục vụ file upload lúc chạy |
| `/admin/*` | Layout + middleware `requireAdmin`: `orders`, `orders/:id`, `products`, `products/new`, `products/:id` |

### Ngân sách hiệu năng (Android tầm trung, Slow 4G)
| Chỉ số | Trần |
|---|---|
| LCP | <2.5s (poster AVIF ≤70KB, `fetchpriority=high`) |
| CLS / INP | <0.1 / <200ms |
| JS route đầu | ≤130KB gzip (sửa 14/10 sau review M0: riêng React 19 + RR8 đã ≈107KB, phần code app ≤23KB) |
| Chunk 3D | ≤170KB gzip. Chỉ tải khi đủ: sau `load` + idle, không bật `saveData`, `deviceMemory ≥4` (hoặc trình duyệt không hỗ trợ), không bật reduced-motion, khối hero nằm trong viewport |
| Chunk Fabric | ≤130KB gzip, chỉ ở `/gift` |
| Font | ≤100KB tổng |
| Ảnh | sharp xử lý lúc upload/seed: 320/640/1080 × AVIF+WebP, crop `attention`, `<picture>` có `width`/`height` |

Đo bằng script `npm run size` (đọc kích thước gzip trong `build/client`, vượt trần thì exit 1) và Lighthouse mobile chạy tay ở cuối M1, M6, M7.

---

## 6. Milestones

| M | Nội dung | Ngày | Definition of Done | Review |
|---|---|---|---|---|
| **M0** Nền móng | Scaffold RR 8.4, compose Postgres, Prisma 7.10 + adapter-pg, Tailwind tokens, fonts, seed 6 danh mục / 40 SP qua script sharp, layout (header tìm kiếm dính), `formatVnd`, `toSearch`. **Spike 1 giờ:** `import()` three và fabric trong `useEffect` build được và SSR không lỗi | 1.5 | `docker compose up -d && npm run setup && npm run dev` chạy được. Typecheck pass. Vitest pass (formatVnd, toSearch có `đ`). Chuỗi dấu tiếng Việt hiển thị đúng | Consultant (kiến trúc, phiên bản), Designer (tokens, font) |
| **M1** Catalog | Home (chưa có 3D, poster tĩnh), collection (chip, sắp xếp, còn hàng, tìm kiếm, xem thêm), product, about, contact | 3 | Gõ "trung" ra trứng. "Xem thêm" chạy được khi chưa có JS. Lighthouse mobile LCP <2.5s. ui-check ở 375px | Designer, Customer |
| **M2** Giỏ hàng | Cookie cart, `/cart`, drawer `<dialog>` (focus trap, Esc), + và stepper trên thẻ, hoàn tác, rổ SVG, bay vào giỏ | 2.5 | Bấm nhanh liên tục thì giá trị cuối khớp server. Đóng tab mở lại vẫn còn giỏ. Cookie giả mạo bị zod loại bỏ. Test tính tổng/freeship pass | Customer, Designer, Developer review |
| **M3** Checkout + đơn + auth | Checkout khách, khung giờ, COD, cổng giả lập, trang đơn + timeline + huỷ + mua lại, OTP login/logout, gắn đơn theo SĐT, `/orders` | 4 | Playwright: thêm vào giỏ → COD → thấy đơn. Test transaction: 2 đơn tranh món cuối thì 1 đơn bị từ chối. Huỷ đơn hoàn kho. Admin không đăng nhập được nếu thiếu passcode. **Checkpoint tiến độ** | Customer (luồng), Developer review + `security-review` |
| **M4** Giỏ quà Fabric | `/gift`, GiftBundle, dòng giỏ quà trong drawer/checkout/đơn, trừ kho từng món | 3.5 | Xếp 10 món, thêm lời chúc, đặt COD, đơn hiện preview và đúng tổng tiền. Layout gửi lên với pid lạ hoặc quá 10 món bị từ chối. Fabric không có trong chunk route nào khác | Designer, Customer, Developer review |
| **M5** Admin | Đơn (đổi trạng thái ngay trên dòng, ghi các cột `*_at`, nhóm món theo giỏ quà), CRUD sản phẩm + upload | 2.5 | Admin đổi trạng thái thì timeline phía khách cập nhật. Upload ảnh 5MB ra đủ 6 biến thể. File không phải ảnh bị từ chối. Route `/admin` chặn customer | Developer review, Consultant |
| **M6** Hero Three | Rổ Lathe + texture + sprites, poster render từ chính scene, các điều kiện tải, fallback | 2 (có thể chạy song song từ sau M1) | Chunk ≤170KB. Bật reduced-motion hoặc saveData thì không tải three. LCP không đổi so với M1. Đo trên Android thật ≥45fps | Designer, Customer |
| **M7** Hoàn thiện | a11y, `npm run size`, Dockerfile + compose app, `npm run demo:reset`, kịch bản pitch 3 phút | 2 | Chạy hết kịch bản pitch trên điện thoại thật, không lỗi. Mọi trần ngân sách đạt. `verification-before-completion` | Customer (go/no-go người dùng), Consultant (go/no-go cuối) |
| | **Tổng** | **21 + 2 dự phòng** | | |

---

## 7. Skill & agent cho giai đoạn thực thi

| Vai trò | Skill dùng |
|---|---|
| Lead (điều phối) | `superpowers:writing-plans` để viết plan từng milestone, `superpowers:subagent-driven-development`, `superpowers:dispatching-parallel-agents` (M6 chạy song song) |
| Developer (implement) | `react-router` (cài mới), `prisma-cli` + `prisma-client-api` (cài mới), `superpowers:test-driven-development` / `tdd` cho tiền, kho, cart, OTP, bundle; `ponytail`; `superpowers:systematic-debugging` |
| Developer (review) | `superpowers:requesting-code-review`, `ponytail:ponytail-review`, `security-review` (auth, checkout, upload, admin) |
| Designer | `frontend-design`, `impeccable`, `ui-ux-pro-max` (kiểm token và contrast), `ui-check` sau mỗi trang |
| Customer | `agent-browser` để đi thử luồng ở viewport 375px như người dùng thật; `ui-check` |
| QA tự động | `playwright-cli` |
| Consultant | `superpowers:verification-before-completion` ở các cổng M0 và M7 |

**Không dùng `scroll-synced-scene`**, vì hero không chạy theo scroll (đã cấm).

### Đề xuất cài thêm (đã kiểm chứng)
```bash
# React Router: skill CHÍNH THỨC. Repo cũ remix-run/agent-skills đã archive; skill mới đọc docs trong node_modules theo đúng phiên bản 8.4
npx skills add https://github.com/remix-run/react-router --skill react-router

# Prisma: chính thức, cập nhật ngày 13/10/2026, nội dung nhắm Prisma 7
npx skills add prisma/skills@prisma-cli
npx skills add prisma/skills@prisma-client-api
```
- **KHÔNG cài** `prisma/skills@prisma-orm-setup` (hay bản tên cũ `prisma-database-setup`): skill này **mặc định đưa app mới lên Prisma 8**, mà Prisma 8 hiện vẫn là RC. Cũng không cài `prisma-postgres*`, vì đó là dịch vụ cloud Prisma Postgres, không phải Postgres trong Docker.
- **Three.js:** không cần. Có `CloudAI-X/threejs-skills` (3.5K sao), nhưng phạm vi chỉ là một cảnh khoảng 150 dòng.
- **Fabric.js:** không cần, vì không có skill nào đáng tin (≤11 lượt cài). Agent đọc `node_modules/fabric/dist/index.d.ts` của v7.
- **Tailwind v4:** không cài lúc đầu. Nếu agent còn sinh `tailwind.config.js` kiểu v3 thì cài `npx skills add lombiq/tailwind-agent-skills@tailwind-4-docs`.

---

## 8. Rủi ro & giảm thiểu (top 5)

| # | Rủi ro | Giảm thiểu |
|---|---|---|
| 1 | **Ảnh không đồng bộ hoặc giao trễ** (40 ảnh 1:1, 12 cut-out, ảnh vỏ giỏ). Thiếu là hỏng cả art direction lẫn giỏ quà | Đã chốt dùng ảnh minh hoạ miễn phí (mục 9); tuyển và tách nền xong trước M1, riêng cut-out xong trước M4 |
| 2 | **Agent viết sai API** (quen Remix v2/RR7 và `@remix-run/*`, Prisma 8 RC, Fabric v5) | Ghim exact version. Skill `react-router` đọc docs trong node_modules. Spike ở M0. Review M0 có grep cấm `@remix-run`. Tránh skill `prisma-orm-setup` |
| 3 | **Hiệu năng mobile kém** (3D, font, ảnh) làm hỏng ấn tượng đầu khi pitch | Poster làm LCP. Điều kiện tải 3D. `npm run size` fail khi vượt trần. Đo trên Android thật ở M1, M6, M7 |
| 4 | **Trễ tiến độ / phình phạm vi** (giỏ quà đi qua 4 tầng: canvas, cart, checkout, admin) | Checkpoint cuối M3 kèm thứ tự cắt ở mục 3. Mọi ý mới mặc định vào v2. Giỏ quà có đòn bẩy giảm phạm vi |
| 5 | **Sự cố trong buổi demo live** (OTP hiện trên màn hình, dữ liệu bẩn, khách tưởng bị trừ tiền thật) | `ADMIN_PASSCODE` cho admin, `DEMO_OTP` fail-closed, `npm run demo:reset` reseed trước buổi pitch, nhãn DEMO ở mọi màn thanh toán, kịch bản pitch đã chạy thử trên máy thật |

---

## 9. Quyết định của chủ dự án (14/10/2026)
1. **Framework:** dùng **React Router 8 framework mode**, đồng ý thay cho Remix 3.
2. **Ảnh sản phẩm:** dùng **ảnh minh hoạ miễn phí** (Unsplash/Pexels license), mỗi nhóm ảnh lấy từ cùng một nguồn/phong cách, footer ghi "Ảnh minh hoạ". Ghi nguồn vào `seed/images/CREDITS.md`.
   - 12 ảnh cut-out cho giỏ quà và ảnh vỏ giỏ: tách nền **một lần, offline**, bằng công cụ CLI (ví dụ `rembg`) ở M0/M4. Kết quả là PNG commit vào `seed/images/cutouts/`. Công cụ này **không** thành dependency của app.
3. **Thương hiệu:** chưa có, nên dùng **tên tạm "Chợ Sáng"**, palette ở mục 4 và số liệu mặc định ở mục 5 (ship 20.000₫, freeship từ 300.000₫). Hotline và Zalo là số giả có nhãn demo.
4. **Skill:** đã cài `react-router`, `prisma-cli`, `prisma-client-api` vào `.agents/skills/` (symlink sang `.claude/skills/`). Lưu ý: skill `prisma-cli` gợi ý chuyển sang `prisma-orm-setup` cho phần setup, **không làm theo**, vì skill đó kéo lên Prisma 8 RC.
5. **Ngày pitch / số dev:** chưa chốt. Mặc định 1 dev (agent) theo 23 ngày công. Nếu hạn ngắn hơn thì áp dụng thứ tự cắt ở mục 3, hoặc chạy M6 song song.
