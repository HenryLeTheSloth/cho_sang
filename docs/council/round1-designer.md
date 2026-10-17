# DESIGNER: đánh giá ý tưởng web thực phẩm hằng ngày

*Đã load `frontend-design`, `ui-ux-pro-max` và chạy search của nó. Gợi ý mặc định của tool là emerald #059669 + cam #EA580C + font Rubik/Nunito Sans. Tôi **bác** gợi ý này: đó đúng là "bộ đồng phục" của mọi web grocery. Thêm nữa, tôi đã kiểm tra subset trong data Google Fonts: **Rubik, Fredoka và DM Sans không có subset tiếng Việt**.*

## 1. Đánh giá thẳng thắn
**Điểm mạnh:** đủ trang cho một luồng mua hàng trọn vẹn, có admin nên demo được hai phía (người mua và chủ shop). Hàng thiết yếu thì ai cũng hiểu, khách xem pitch không cần giải thích.

**Điểm nhạt / rủi ro:**
- "Tươi sáng, thân thiện" chưa phải là một concept, chỉ là tính từ. Không có concept thì kết quả sẽ là xanh lá + cam, card bo tròn, banner "Giảm 20%". Xem xong là quên.
- Three.js/Fabric.js đang là "công nghệ đi tìm việc". Nếu chỉ để trang trí thì nhà đầu tư sẽ hỏi "để làm gì?". Mỗi hiệu ứng phải trả lời được một nỗi lo khi mua đồ tươi online.
- Nỗi lo số 1 của người Việt khi mua đồ tươi online là **không được tận tay chọn**. Thiết kế phải bù vào chỗ đó: ảnh thật, cân thật, giờ giao thật.

## 2. Art direction
### Hướng chính: "Chợ Sáng"
Lấy chất liệu từ chợ sáng Việt Nam: rổ nhựa màu, bảng giá viết tay, lá chuối lót hàng. Phải hiện đại, sạch, **không** đi theo kiểu hoài cổ.
- **Palette** (đã tính contrast WCAG):
  - Nền "Gạo mới" `#FAFAF5`: trắng hơi lạnh, cố ý tránh tông kem.
  - Chữ "Cà tím" `#2A1B3D`: dùng thay màu đen, contrast 15:1.
  - Brand "Thanh long" `#C8246B`: CTA và tag giá, đạt 5.1:1 trên nền. Màu magenta hiếm trong ngành grocery nên là điểm khác biệt.
  - "Lá chuối" `#2F7A34`: chỉ dùng cho trạng thái còn hàng / tươi / thành công (5.1:1).
  - "Xoài cát" `#FFC83D`: chỉ làm nền highlight, luôn đi với chữ cà tím (10:1). **Cấm** đặt chữ trắng trên nền xoài.
  - "Ớt" `#E8432E`: chỉ dùng cho số giảm giá cỡ ≥24px đậm, vì chỉ đạt 3.8:1.
- **Font:**
  - **Bricolage Grotesque** cho display: variable, có trục width/opsz. Tag giá dùng bản condensed đậm, đóng vai "bảng giá viết tay" theo kiểu typographic.
  - **Be Vietnam Pro** cho body: do người Việt thiết kế, dấu chồng (ẫ, ặ, ộ) rất chuẩn.
  - Cả hai đều có subset vietnamese. Bắt buộc test chuỗi "Bưởi Diễn, Rau muống, Sữa tươi" ở weight 800. Line-height display ≥1.1 để dấu không bị cắt.
- **Hình ảnh:** sản phẩm chụp thật hoặc cut-out, **cùng góc 3/4, cùng ánh sáng, cùng nền**, có bóng đổ thật. Không trộn ảnh stock. Có lớp ảnh thứ hai là "ảnh cắt đôi" (quả bổ ra, bó rau mở ra) để thấy ruột/độ tươi.
- **Motion:** chỉ có **một** khoảnh khắc lớn: hàng "rơi vào rổ" khi thêm vào giỏ. Mọi motion khác đều là phản hồi cho hành động (stepper, drawer, toast), kéo dài 150–250ms, exit nhanh hơn enter. Tôn trọng `prefers-reduced-motion`. Không làm fade-up cho từng section.

### Hướng dự phòng: "Tủ Mát"
Sạch, lạnh, đáng tin, kiểu cửa hàng tiện lợi cao cấp. Rủi ro thấp hơn, build nhanh hơn.
- **Palette:** nền `#EEF6F4`, chữ teal đậm `#0E3B43` (11:1), CTA cam đất `#C2410C` (4.7:1), mint `#17705B`.
- **Font:** Lexend (display) + Be Vietnam Pro, cả hai đều có tiếng Việt.

## 3. Three.js & Fabric.js (xếp theo wow × giá trị thật)
### Three.js: lazy-load, chỉ ở 2 chỗ
1. **"Rổ đầy = Freeship"** (wow 4, giá trị 5). Trong cart drawer có một chiếc rổ 3D nhỏ. Mỗi món thêm vào là một sprite (texture = ảnh sản phẩm) rơi vào có vật lý nhẹ. Độ đầy của rổ chính là thanh tiến độ tới ngưỡng freeship. Tác dụng: kéo tăng AOV. Rẻ: plane + texture, không cần model.
2. **Hero "Rổ chợ sáng"** (wow 5, giá trị 2). Rổ xoay theo con trỏ hoặc độ nghiêng máy, quanh rổ là các nhóm hàng; chạm vào nhóm nào thì vào collection đó. Rất hợp để mở màn pitch. Trên mobile yếu hoặc khi bật reduced-motion thì dùng ảnh tĩnh.
3. **"Bổ thử"** trên product page, chỉ 3–5 sản phẩm chủ lực (dưa hấu, bơ, sầu riêng) (wow 4, giá trị 4). Kéo để xoay hoặc cắt đôi xem ruột, đúng vào nỗi lo "không được chọn tận tay". Cần file glb, nên làm cuối.

### Fabric.js
1. **"Tự xếp giỏ quà"** (wow 5, giá trị 5). Kéo sản phẩm vào giỏ trên canvas, sắp xếp, gắn thiệp có lời chúc, export ảnh xem trước. Kết quả thành một bundle trong giỏ hàng. Giỏ quà Tết/Trung thu/biếu là mảng biên lợi nhuận cao ở Việt Nam, đây là câu chuyện kinh doanh rõ nhất.
2. **Admin tạo tag giá / banner khuyến mãi** (wow 3, giá trị 4). Chủ shop chọn template, sửa giá, xuất PNG cho homepage. Thông điệp khi pitch: "không cần designer".
3. **Kế hoạch bữa tuần** (wow 3, giá trị 3). Kéo món vào lịch 7 ngày, sinh danh sách đi chợ, thêm tất cả vào giỏ. Để sau MVP.

## 4. Ghi chú từng page
- **Homepage:** hero rổ 3D có fallback ảnh. Ngay dưới fold là "Giao trong 2h, khung giờ còn trống hôm nay" (dữ liệu thật). Có "Mua lại đơn trước" khi đã đăng nhập. Không làm carousel banner.
- **Collection:** filter dạng chip cuộn ngang (mobile) và sticky. Card có giá/đơn vị rõ ràng ("45.000₫ / 500g", kèm giá quy ra /kg). Stepper +/− nằm ngay trên card. Skeleton đúng hình card. Empty state khi lọc: gợi ý bỏ bớt filter, không để màn trắng.
- **Product:** hai ảnh (nguyên quả / bổ đôi), nguồn gốc (vườn, tỉnh), hạn dùng. Với hàng cân ký: "Giá tạm tính, cân thực tế ±10%". Hết hàng thì có nút "Báo khi có hàng", không chỉ là nút xám.
- **Cart drawer:** focus trap, Esc để đóng, cập nhật lạc quan và rollback khi lỗi. Rổ freeship. Empty state là rổ trống kèm 3 món hay mua. Có "Xoá" và undo trong 5 giây.
- **Checkout:** một trang, mobile-first, có chọn **khung giờ giao**. Mặc định COD. Online giả lập phải có đủ màn chờ, thành công, thất bại, thử lại. Báo lỗi inline cạnh field. Nút ghi rõ số tiền: "Đặt hàng · 312.000₫".
- **Orders:** danh sách có badge trạng thái (màu + chữ, không dùng màu đơn thuần). Chi tiết đơn có timeline thật từ admin và nút "Mua lại cả đơn".
- **Sign in / Sign up:** ưu tiên SĐT, label hiển thị (không chỉ placeholder), có show/hide mật khẩu. Sign out xong có toast và quay về trang đang đứng.
- **About:** chuyện nguồn hàng với ảnh người trồng thật, không viết "sứ mệnh".
- **Contact:** Zalo/hotline click-to-call lên đầu, form để sau.
- **Admin:** bảng gọn, đổi trạng thái đơn ngay trên dòng, upload ảnh có preview và crop vuông.

## 5. Không nhượng bộ / Có thể thương lượng
**KHÔNG nhượng bộ:**
- Font và line-height an toàn cho dấu tiếng Việt.
- Ảnh sản phẩm đồng bộ.
- Đủ trạng thái hover/focus-visible/active/disabled/loading/empty/error cho mọi control.
- Vùng chạm ≥44px, layout 375px trước.
- Format VND thống nhất qua `Intl.NumberFormat('vi-VN')` và luôn kèm đơn vị bán.
- 3D/canvas là progressive enhancement: luôn có fallback tĩnh và tôn trọng reduced-motion.
- Không dùng emoji làm icon.
- Cart phải cho cảm giác tức thì.

**Thương lượng được:**
- Sprite thay cho model glb.
- Bỏ "Bổ thử" nếu thiếu thời gian.
- Dùng View Transitions native thay cho animation tự viết.
- Bỏ dark mode khỏi MVP.
- Dùng Lucide/Phosphor thay cho illustration vẽ riêng.
- About/Contact làm đơn giản.
- Meal planner để giai đoạn 2.

## Câu hỏi / thách thức gửi Developer
1. **Ngân sách hiệu năng:** lazy-load Three.js (chỉ chạy phía client) có giữ được LCP homepage <2.5s trên Android tầm trung không? Chốt mức trần KB cho bundle 3D.
2. **Pipeline ảnh:** dùng resource route trong Remix + sharp để xuất AVIF/WebP theo nhiều kích thước được không? Ai lo phần cut-out/chụp ảnh đồng bộ?
3. **Giỏ quà Fabric:** lưu composition thành JSON trong Postgres, render lại ở order detail/admin, **giá luôn tính lại phía server**. Mô hình bundle trong giỏ trông thế nào?
4. **Hàng cân ký:** số lượng thập phân và "giá tạm tính" ảnh hưởng thế nào tới schema, đơn hàng và admin (chỉnh khối lượng thực tế)?
5. **Cart lạc quan bằng `useFetcher`:** làm sao để rollback không gây nháy UI, và rổ 3D đồng bộ với state giỏ hàng mà không re-render cả drawer?
