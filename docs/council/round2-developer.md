# DEVELOPER: Vòng 2, phản biện

## 1. Trả lời 5 câu của Designer

**1. Ngân sách hiệu năng.** Giữ được LCP <2.5s, với điều kiện 3D không nằm trên đường LCP. Các trần tôi chốt:
- JS route đầu tiên ≤ **110KB gzip** (RR8 + React khoảng 65KB, phần còn lại là code app).
- Ảnh poster hero ≤ **70KB AVIF**, `fetchpriority="high"`. Đây chính là phần tử LCP.
- Chunk 3D ≤ **170KB gzip** (chỉ three thuần, không R3F/drei). File glb ≤ **400KB**.
- Font: 2 file woff2 subset vietnamese, mỗi file ≤ 40KB.
- Chỉ tải 3D khi đủ 4 điều kiện: sau `load` + `requestIdleCallback`, không bật `saveData`, `deviceMemory ≥ 4`, không bật reduced-motion.
- Đo bằng Lighthouse mobile (Slow 4G) trong CI. Vượt trần là build fail.

**2. Pipeline ảnh.** Không làm resource route sharp chạy on-the-fly, vì mỗi request tốn CPU và phải thêm tầng cache. Thay vào đó, sharp chạy **một lần lúc admin upload** (seed cũng chạy qua cùng script):
- 3 cỡ 320/640/1080, mỗi cỡ AVIF + WebP.
- Crop vuông bằng `position: attention`, không cần UI crop ở client.
- Hiển thị bằng `<picture>` kèm `srcset`.

Chụp ảnh và tách nền **không phải việc của dev**. Khách hoặc Designer cung cấp khoảng 40 ảnh đồng bộ. Nếu thiếu thì demo dùng 1 bộ ảnh cùng nguồn, không trộn.

**3. Bundle giỏ quà.** Composition không nhét được vào cookie 4KB, nên cần thêm bảng `gift_bundles(id, items jsonb [[pid,qty]], layout jsonb, message)`. Luồng hoạt động:
- Cookie giỏ chỉ giữ `bundleIds`.
- Khi checkout, server đọc `items`, **tính lại giá từ `products`** cộng phí giỏ (hằng số), rồi trừ kho từng món như hàng thường.
- `order_items.bundle_id` nhóm các dòng lại.
- Admin và trang đơn render lại `layout` bằng chính chunk Fabric. Không lưu PNG.

**4. Hàng cân ký.** **Không dùng số lượng thập phân.** Hàng cân bán theo gói cố định (`net_grams`, ví dụ 500), số lượng là số nguyên gói, nên không có toán float.
- Giá/kg = `price*1000/net_grams`, tính khi hiển thị, không lưu.
- `is_weighed=true` thì hiện nhãn "Giá tạm tính ±10%".
- Khi chuyển đơn sang "Đang soạn", admin nhập `order_items.weighed_grams`. Server tính `final_price_vnd` và `orders.final_total_vnd`. COD thu theo số cuối cùng.
- Với thanh toán online giả lập, chỉ hiện dòng "chênh lệch thu/hoàn khi giao". Giới hạn: không có hoàn tiền thật.

**5. Cart lạc quan.** **Không giữ state cục bộ, nên không có code rollback.**
- Số lượng hiển thị = `fetcher.formData?.get('qty') ?? line.qty`.
- Stepper gửi **số lượng tuyệt đối**, không gửi delta. Bấm nhanh liên tục thì RR tự huỷ request cũ, request cuối thắng.
- Nếu lỗi, revalidate trả về giá trị server (đó chính là rollback) và hiện toast. Không bị nháy, vì giá trị chỉ đổi đúng một lần.
- Mỗi dòng dùng `useFetcher({key:'line-'+id})`. Badge ở header đọc `useFetchers()`.
- Rổ freeship là component con nhận `subtotal` đã tính sẵn, nên chỉ nó re-render, không kéo theo cả drawer.

## 2. Rổ freeship 3D và "Bổ thử": phản bác, đưa phương án trung gian

**Rổ 3D trong drawer: không làm.** Lý do:
- Drawer là thao tác dùng nhiều nhất. Mỗi lần mở lại phải khởi tạo WebGL context và compile shader (100–300ms trên Android tầm trung). Điều này vi phạm chính nguyên tắc không nhượng bộ "cart phải tức thì" của Designer.
- Muốn có "vật lý nhẹ" thì phải thêm khoảng 100KB thư viện, hoặc tự viết.

**Phương án trung gian: rổ SVG + CSS.**
- Dải "đầy" của rổ là `clip-path` có transition.
- Ảnh thumbnail 40px của 3 món mới thêm rơi vào bằng keyframes `translateY`.
- Dòng chữ "Còn 48.000₫ nữa để freeship".
- Thêm 0KB thư viện, mất **0.5 ngày**, giữ nguyên tác dụng tăng AOV.

**"Bổ thử" 3D: không làm.** Mỗi SKU cần một model có phần ruột, chi phí nội dung lớn hơn chi phí code. Trong khi Customer cần **ảnh thật** chứ không cần ảnh render.

**Phương án trung gian: slider so sánh ảnh nguyên quả / bổ đôi.**
- Làm bằng `<input type=range>` + `clip-path`.
- Áp dụng được cho mọi SKU có ảnh thứ hai, mất **0.5 ngày**.

Kết luận: Three.js chỉ còn **một** cảnh là hero homepage. Các nhóm hàng quanh rổ luôn có link HTML thật bên dưới, 3D chỉ để trang trí.

## 3. Giỏ quà Fabric: tôi đổi lập trường, chấp nhận

Hai phía cùng xếp số 1 và nó có câu chuyện kinh doanh, nên tôi nhận. Phiên bản MVP rẻ nhất:
- Route `/gift` có **1 mẫu giỏ** (ảnh nền) và **12 sản phẩm có ảnh tách nền** (`products.cutout_url`).
- Tối đa 10 món. Kéo, xoay, scale là tính năng có sẵn của Fabric.
- Lời chúc là một text object nằm trên giỏ, nên **gộp thiệp vào luôn** và bỏ bước thiệp ở checkout.
- Bấm "Thêm vào giỏ hàng" thì POST JSON lên server, server tạo `gift_bundles` rồi thêm vào giỏ.
- Không cho khách upload ảnh, không lưu nháp, không có nhiều mẫu giỏ.

Chi phí: **3.5 ngày** (canvas 1.5, bundle qua giỏ/checkout/đơn/admin 1.5, tích hợp ảnh 0.5). Thiệp cũ là 1.5 ngày, nên **ròng +2 ngày**. Rủi ro lớn nhất là thiếu 12 ảnh cut-out, và đó là việc của Designer.

## 4. Đối chiếu yêu cầu của Customer

| Yêu cầu | Trạng thái | Cách làm, chi phí |
|---|---|---|
| Checkout không cần tài khoản | Có sẵn | Thêm "Tạo tài khoản 1 chạm" ở trang xác nhận đơn (+0.25 ngày) |
| Giỏ được giữ | Có sẵn | Cookie `maxAge` 30 ngày |
| Giá/kg, tồn kho | Bổ sung | `net_grams`, badge "Hết hàng" và khoá nút + ngay trên card (gộp trong mục cân ký, 1 ngày) |
| Phí ship sớm, thanh freeship | Bổ sung | Hằng số: phí ship 20.000₫, freeship từ 300.000₫. Rổ SVG |
| Khung giờ giao | Bổ sung | `delivery_date`, `delivery_slot`, các slot là hằng số. "Còn trống" = đếm số đơn trong slot so với sức chứa (+0.5 ngày) |
| Ghi chú | Có sẵn | Thêm checkbox "Gọi hỏi nếu hết hàng" |
| Hoàn tác | Bổ sung | Xoá ngay, toast 5 giây, bấm "Hoàn tác" thì POST thêm lại (+0.25 ngày) |
| Mua lại đơn | Bổ sung | Action thêm các món còn hàng, toast "Đã thêm 7/8 món" (+0.25 ngày) |
| Huỷ khi chưa soạn | Bổ sung | `UPDATE … WHERE status='pending'` kèm hoàn kho trong transaction (+0.25 ngày) |
| Tìm kiếm | Bổ sung | Dùng `/collections/all?q=` với `unaccent` + `ILIKE`, để gõ "trung" vẫn ra "trứng". Chưa cần index cho dưới 500 SKU (+0.5 ngày) |
| Phân trang 1-2-3 | Thay đổi | Nút "Xem thêm" bằng fetcher (+0.25 ngày) |

Bỏ bộ lọc theo thương hiệu vì hàng tươi gần như không có thương hiệu. Địa chỉ là một textarea, không có dropdown tỉnh/huyện.

**Đăng nhập:** chọn **SĐT + OTP giả lập**.
- Mã OTP hiện trong toast có nhãn "DEMO", giống cách làm với thanh toán giả lập. Chỉ bật khi có biến môi trường `DEMO_OTP=1`.
- Mã được hash và lưu trong cookie ký, có hạn 5 phút. Không cần bảng riêng.
- Lợi ích: **bỏ hẳn mật khẩu**, argon2 và trang register. Lần đăng nhập đầu tiên tự tạo tài khoản. Admin là một SĐT đã seed sẵn.
- Khi lên production chỉ cần thay hàm `sendOtp` bằng nhà cung cấp SMS (tốn phí mỗi tin, và đăng ký brandname mất vài tuần).
- Google OAuth: +1 ngày với Better Auth. Chỉ làm khi khách chốt lên production.

## 5. Cập nhật thiết kế

**Data model:**
- `users`: `phone` unique bắt buộc, `email` tuỳ chọn, bỏ `password_hash`.
- `products`: thêm `is_weighed`, `net_grams`, `origin`, `shelf_life`, `storage`, `cutout_url?`. `images[1]` là ảnh bổ đôi.
- `orders`: thêm `delivery_date`, `delivery_slot`, `call_on_substitute`, `final_total_vnd?`. Bỏ `gift_card`.
  - `status` gồm: `pending` (Đã đặt), `preparing` (Đang soạn), `shipping` (Đang giao), `done` (Đã nhận), `cancelled`.
  - Timeline dùng các cột `preparing_at`, `shipping_at`, `done_at`, `cancelled_at`. Không cần bảng events.
- `order_items`: thêm `weighed_grams?`, `final_price_vnd?`, `bundle_id?`.
- Thêm bảng `gift_bundles`.
- Cookie giỏ có dạng `{lines, bundleIds}`.

**Route map:**
- Bỏ `/register`. `/login` gồm 2 bước OTP trong cùng một route.
- Thêm `/gift`.
- `/orders/:code` thêm các action `cancel`, `reorder`, `claim`.
- `/admin/orders/:id` thêm action `weigh`.

**Ước lượng:** 17 ngày (vòng 1), cộng thêm:
- Giỏ quà: +2
- Rổ SVG + slider ảnh: +1
- Các yêu cầu của Customer (bảng mục 4, cộng hàng cân ký 1 ngày): +3.5

Tổng **khoảng 23.5 ngày, tức khoảng 5 tuần**.

Nếu phải giữ 4 tuần, thứ tự cắt như sau:
1. Hero 3D (−2 ngày, Customer cũng thấy phiền).
2. Slider bổ đôi (−0.5).
3. "Xem thêm" (giữ phân trang).
4. Tạo tài khoản 1 chạm.

**Giỏ quà, checkout khách, trạng thái đơn thật thì không cắt.**
