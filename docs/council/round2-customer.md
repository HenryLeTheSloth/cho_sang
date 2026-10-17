# CUSTOMER, vòng 2: phản hồi Designer và Developer

## 1. "Chợ Sáng" hay "Tủ Mát"?
Tôi chọn **Chợ Sáng, nhưng có điều kiện**.

- Màu magenta thanh long thì lạ thật. Mới nhìn tôi nghĩ ngay tới MoMo hoặc web mỹ phẩm, chưa thấy "đồ ăn". Nó dùng được khi làm **nút bấm và tag giá**. Đừng phủ magenta lên mảng nền lớn.
- Thứ làm tôi thấy "tươi" là **ảnh rau thật** và màu xanh lá chuối. Vì vậy chữ "Còn hàng / Hôm nay mới về" bằng màu lá chuối phải thấy được ở mọi nơi.
- Bảng giá kiểu viết tay: tôi thích, vì nó gợi đúng cảm giác đi chợ. Có điều số phải **đọc được trong 1 giây**. Giữ font đậm kiểu bảng giá như Designer nói, đừng dùng font viết tay thật.
- Nền gạo mới, chữ cà tím thì ổn, dễ đọc.
- "Tủ Mát" an toàn, tin được, nhưng nhìn giống Kingfoodmart. Xem xong tôi không nhớ tên web.

## 2. Từng ý tưởng 3D/canvas
- **Hero rổ 3D:** chấp nhận nếu ảnh tĩnh hiện trước và thanh tìm kiếm + danh mục nằm ngay dưới. **Không** bắt tôi xoay rổ rồi chạm vào để vào danh mục. Danh mục phải là icon bấm bình thường.
- **Rổ đầy = freeship:** ý hay nhất trong các ý, tôi sẽ dùng thật. Nhưng phải có dòng chữ **"Còn 42.000đ nữa được freeship"**. Rổ đẹp mà không có con số thì tôi vẫn không biết thiếu bao nhiêu. Bấm "+" mà drawer bị giật là tôi ghét. Máy yếu thì làm bản 2D cũng được.
- **Bổ thử trái cây 3D:** nói thật là vô ích với tôi. Quả dưa 3D là model, đâu phải quả dưa tôi sẽ nhận. Thứ tôi tin là **ảnh chụp thật quả bổ đôi**. Bỏ phần 3D, giữ ảnh bổ đôi.
- **Tự xếp giỏ quà:** dịp Tết hoặc Trung thu thì tôi dùng, còn mua hằng ngày thì không. Đem pitch thì hay. Developer đẩy sang v2 thì tôi đồng ý.
- **Thiệp ở checkout:** đi chợ hằng ngày thì tôi không cần thiệp. Phải **ẩn mặc định**, chỉ là một dòng "Thêm thiệp (tuỳ chọn)", không được làm dài thêm checkout.
- **Admin tạo banner:** không ảnh hưởng gì tới tôi. Chỉ xin đừng biến nó thành carousel ở homepage.

## 3. Gửi Developer: chỗ bỏ sót và chỗ làm ẩu
**KHÔNG chấp nhận bỏ:**
1. **Tìm kiếm.** Route map không có `/search` hay ô tìm kiếm nào. Web bán đồ ăn mà không tìm được "trứng" là tôi thoát. Chỉ cần `?q=` với ILIKE trên tên sản phẩm là đủ.
2. **Nút + ngay trên card ở collection.** Plan mới ghi `fetcher.Form` ở product page. Bắt vào từng trang để thêm 10 món là tôi bỏ.
3. **Khung giờ giao.** Bảng `orders` không có trường này. Chỉ cần một select "Hôm nay 17–19h / Mai 8–10h..." và một cột text là xong.
4. **Nguồn gốc + hạn dùng/ngày đóng gói** trong `products`. Hiện chỉ có `unit`. Thêm 2 cột text là đủ. Thiếu thì tôi không tin hàng tươi.
5. **Phí ship và ngưỡng freeship hiện ngay trong giỏ**, không đợi tới checkout. Plan có `shipping_vnd` nhưng không thấy quy tắc tính.
6. **Hết hàng phải báo ngay ở danh sách** (đã có `stock`, chỉ cần hiển thị), đừng đợi tới lúc thanh toán mới báo.
7. **Checkout không bắt đăng nhập.** Plan có vẻ cho phép (`user_id?`, tra đơn bằng mã + SĐT). Nhờ ghi rõ ra để không ai lỡ tay thêm `requireUser`.

**Chấp nhận bỏ cho demo:**
- Đăng nhập bằng SĐT/OTP → dùng email/mật khẩu cũng được, **miễn là checkout khách không cần tài khoản**. Đừng đặt luật mật khẩu khó.
- Lọc nâng cao → chỉ cần danh mục + sắp xếp giá. Thêm được "Chỉ hiện còn hàng" thì càng tốt.
- Phân trang `?page` → làm nút "Xem thêm" thay cho 1-2-3.
- Hoàn tác khi xoá món, nút huỷ đơn, "Báo khi có hàng", giá cân ký ±10%.
- "Mua lại cả đơn" → muốn có nhưng bỏ được. Đổi lại, trạng thái đơn phải là timeline thật do admin cập nhật.
- Giỏ hàng không đồng bộ giữa các thiết bị: OK. Giữ được giỏ khi đóng tab là đủ.
- Riêng thanh toán giả lập thì màn hình bắt buộc phải ghi rõ **"DEMO, không trừ tiền thật"**.
- Contact: đưa hotline/Zalo bấm gọi lên trên, form gửi email để sau.

## 4. Top 5 "không có thì tôi không mua" (MVP)
*(Tiền đề: trang hiện nội dung và nút mua nhanh trên 4G. 3D không bao giờ chặn đường.)*
1. **Tìm kiếm** theo tên sản phẩm.
2. **Thêm vào giỏ ngay từ card**, không reload, sửa số lượng ngay trong drawer.
3. **Thông tin sản phẩm rõ ràng**: giá + đơn vị, nguồn gốc, hạn dùng, trạng thái còn/hết hàng hiện cả ở ngoài danh sách.
4. **Checkout 1 trang, không bắt đăng nhập, COD mặc định**, phí ship hiện từ trong giỏ, có chọn khung giờ giao.
5. **Trang đơn hàng có trạng thái thật** (Đã đặt → Đang soạn → Đang giao → Đã nhận), tra được bằng mã đơn + SĐT, kèm hotline.
