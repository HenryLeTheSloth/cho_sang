export const SHIPPING_VND = 20000;
export const FREESHIP_FROM_VND = 300000;
export const CART_MAX_LINES = 50;
export const CART_MAX_QTY = 99;

export const PAGE_SIZE = 24;
export const MAX_PAGE = 20;

// Thông tin cửa hàng demo: không phải số/địa chỉ thật
export const HOTLINE_DISPLAY = "0123 456 789";
export const HOTLINE_TEL = "+84123456789";
export const ZALO_URL = "https://zalo.me/0123456789";
export const STORE_ADDRESS = "Số 1 đường Chợ Sáng, Quận 1, TP.HCM";
export const OPENING_HOURS = "6:00–21:00 hằng ngày";

// Khung giờ giao (giờ Việt Nam). Mỗi khung nhận tối đa SLOT_CAPACITY đơn chưa huỷ (spec mục 5).
export const DELIVERY_SLOTS = ["08:00–10:00", "10:00–12:00", "14:00–16:00", "17:00–19:00"];
export const SLOT_CAPACITY = 20;
// SĐT quản trị demo (seed tạo User role admin). Đăng nhập bằng ADMIN_PASSCODE, không bao giờ qua OTP (spec mục 2).
export const ADMIN_PHONE = "0909000000";

// Giỏ quà Fabric (spec mục 5). Cookie `b` giữ tối đa CART_MAX_BUNDLES id GiftBundle (M2 đã validate ≤10).
export const GIFT_MAX_ITEMS = 10;
export const GIFT_MESSAGE_MAX = 120;
export const GIFT_PREVIEW_MAX = 60 * 1024; // độ dài tối đa của data URL ảnh xem trước (ký tự = byte)
export const GIFT_PREVIEW_PX = 480; // cạnh tối đa (px) của ảnh xem trước: client xuất đúng cỡ này, server chặn ảnh khai báo lớn hơn
export const CART_MAX_BUNDLES = 10;
