# DESIGNER: Vòng 2, phản biện

## 1. Trả lời 5 câu của Developer
1. **Model 3D: phản bác, có đề xuất rẻ hơn.** Không dùng glb và cũng không dùng model CC0. Model stock trông như stock, làm lệch art direction. Rổ dựng bằng code: `LatheGeometry` cộng một texture đan nhựa. Hàng trong rổ là sprite, dùng lại chính ảnh cut-out của sản phẩm. Chi phí model bằng 0, đồng bộ thương hiệu 100%, bundle nhỏ hơn vì không cần Draco loader. Poster dùng ảnh chụp từ chính scene đó.
2. **Animation thêm vào giỏ: chấp nhận.** Chỉ dùng CSS, gồm ảnh thu nhỏ bay về icon giỏ và badge nảy. Nếu trình duyệt có View Transitions thì dùng, không có thì chỉ nảy badge. Tôi **bỏ "rổ 3D có vật lý" trong drawer** và đổi thành một rổ SVG đầy dần theo ngưỡng freeship. Ý tưởng giữ nguyên, chi phí gần như bằng 0.
3. **Ảnh: chấp nhận 1:1.** Nền `#FAFAF5`, cut-out, góc 3/4. Đây vốn là điều kiện không nhượng bộ của tôi. Ảnh "bổ đôi" là tuỳ chọn, chỉ cần cho sản phẩm chủ lực.
4. **Drawer: chấp nhận, kèm 2 điều kiện.** Dùng `<dialog>` toàn màn hình, không có gesture. Nhưng bắt buộc có nút Đóng 44px ở góc trên, và nút "Thanh toán · tổng tiền" dính ở đáy (vùng ngón cái, theo yêu cầu của Customer). Cả hai đều chỉ là CSS.
5. **Font, icon, filter: chấp nhận gần hết.** Hai font Bricolage Grotesque và Be Vietnam Pro, tự host với subset vietnamese. Icon là SVG inline (Lucide). Bỏ thanh trượt giá. Xin **thêm toggle "Còn hàng"**: chỉ một mệnh đề `WHERE stock > 0`, mà lại là thứ Customer phàn nàn về Bách Hóa Xanh.

## 2. Three.js và Fabric
**Three: đồng ý chỉ có 1 hero, viết bằng three thuần.** "Bổ thử" chuyển sang v2. Hero cao tối đa 45vh trên mobile, thanh tìm kiếm dính phía trên, danh mục nằm ngay bên dưới. 3D chỉ để mở màn, không được chiếm chỗ của luồng mua.

**Fabric: phản bác việc chỉ làm "thiệp".** Riêng một tấm thiệp thì khi pitch không ai nhớ. Phiên bản MVP rẻ nhất tôi đề xuất là **"Giỏ quà nhanh"**, gộp chung vào chunk Fabric đã có:
- Một trang `/qua-tang` gồm 1 nền giỏ cố định và khoảng 12 sản phẩm quà chọn sẵn (dùng lại ảnh cut-out).
- **Chạm để thêm** thay vì kéo từ danh sách, nên không cần code drag-and-drop giữa DOM và canvas. Sau khi lên canvas thì kéo, xoay, phóng to là tính năng Fabric có sẵn. Tối đa 8 món, thiệp lời chúc nằm ngay trên canvas.
- "Thêm vào giỏ" sẽ đẩy các món thành **dòng giỏ hàng bình thường**. Không có mô hình bundle, không có giá combo, giá vẫn do server tính.
- Bố cục lưu gọn dạng `[{id,x,y,s,r}]` (khoảng 400B, vừa cookie) rồi ghi vào `orders.gift_card` mà Dev đã đề xuất. Admin xem lại bằng ảnh preview.
- Ước lượng: thêm khoảng 1–1,5 ngày so với chỉ làm thiệp. Đổi lại, câu chuyện kinh doanh giỏ quà Tết/biếu (biên lợi nhuận cao) demo được ngay. Kéo thả từ danh sách và bundle có giá riêng để sang v2.

## 3. Phản hồi Customer
**Đổi ý:**
- Hero không còn là "màn mở toàn trang". Ưu tiên tìm kiếm và danh mục (như trên).
- Palette rút còn 3 màu làm việc là Thanh long, Lá chuối, Xoài. **Bỏ màu Ớt**. Xoài chỉ dùng cho freeship và khuyến mãi. Như vậy hết loè loẹt.
- **Checkout khách, không cần tài khoản**, COD chọn sẵn. Online giả lập gắn nhãn "DEMO" rõ ràng.
- Phân trang: thay số trang bằng nút **"Xem thêm"**. URL vẫn giữ `?page` của Dev, không làm infinite scroll.
- Tìm kiếm thành **bắt buộc**: `ILIKE` kèm extension `unaccent` để gõ "trung" vẫn ra "trứng".
- Đăng nhập bằng **SĐT kèm mật khẩu tối thiểu 6 ký tự, không ép quy tắc**. OTP và Google để v2.

**Giữ nguyên:**
- **CTA màu magenta, không dùng xanh lá.** Xanh lá đã mang nghĩa "tươi / còn hàng / thành công". Nếu CTA cũng xanh thì trạng thái và hành động trộn lẫn, và trang trông như mọi web grocery khác.
- Có một khoảnh khắc motion (bay vào giỏ). Không thêm hiệu ứng nào khác.
- Ảnh đồng bộ là ngôi sao. Customer cũng nói đúng điều này.

**Đề nghị Dev bổ sung schema** (rẻ, nhưng là chỗ tạo niềm tin):
- `products.origin`, `products.storage_note`, `products.unit_weight_g` (để tính giá/kg).
- `orders.delivery_slot`.
- Ngưỡng freeship là một hằng số.

## 4. Danh sách cuối
**Bắt buộc MVP**
- Palette 3 màu, 2 font tiếng Việt, ảnh 1:1 đồng bộ, vùng chạm ≥44px, đủ các trạng thái (focus/loading/empty/error).
- Tìm kiếm không dấu, nút + trên card, toast "Đã thêm · Hoàn tác".
- Giá, đơn vị, giá/kg, nguồn gốc, bảo quản. Hàng cân ký ghi "tạm tính ±10%".
- Drawer có rổ SVG freeship và nút thanh toán dính đáy.
- Checkout khách một trang: khung giờ giao, COD mặc định, online giả lập đủ các nhánh chờ/thành công/thất bại/thử lại.
- Trang đơn có timeline từ admin và nút "Mua lại đơn này".
- Hero three thuần dựng bằng code, có poster làm LCP và fallback reduced-motion.
- Fabric "Giỏ quà nhanh" (có thiệp).

**Muốn có nếu kịp**
- Ảnh bay vào giỏ bằng View Transitions.
- Toggle "Còn hàng".
- "Mua lại" ở homepage.
- Ảnh bổ đôi.
- Fabric tạo tag giá/banner trong admin.
- Trang chính sách đổi trả hàng hỏng.

**Để v2**
- "Bổ thử" 3D.
- Rổ 3D có vật lý.
- Kéo thả từ danh sách vào giỏ quà, giá combo.
- Meal planner, dark mode.
- OTP/Google, gesture cho drawer, thanh trượt giá, đồng bộ giỏ giữa nhiều thiết bị.
