export type CatalogCategory = {
  slug: string;
  name: string;
  sort: number;
  color: string; // nền placeholder
  cover: string; // slug sản phẩm làm ảnh danh mục
};

export type CatalogProduct = {
  slug: string;
  name: string;
  category: string;
  priceVnd: number;
  compareAtVnd?: number;
  unit: string;
  netGrams?: number;
  isWeighed: boolean;
  origin: string;
  shelfLife: string;
  storage: string;
  stock: number;
  description: string;
  isGiftBase?: boolean;
  cutout?: true; // có ảnh tách nền seed/images/cutouts/<slug>.png → Product.cutoutUrl, xếp được vào giỏ quà (M4)
};

export const categories: CatalogCategory[] = [
  { slug: "rau-cu", name: "Rau củ", sort: 1, color: "#E8F3E6", cover: "cai-ngot" },
  { slug: "trai-cay", name: "Trái cây", sort: 2, color: "#FFF1C9", cover: "xoai-cat-hoa-loc" },
  { slug: "thit-ca", name: "Thịt cá", sort: 3, color: "#FBE3EC", cover: "ca-hoi-phi-le" },
  { slug: "trung-sua", name: "Trứng & sữa", sort: 4, color: "#F3F0F7", cover: "trung-ga-ta" },
  { slug: "banh-mi-do-kho", name: "Bánh mì & đồ khô", sort: 5, color: "#F6EBDD", cover: "gao-st25" },
  { slug: "gia-vi", name: "Gia vị", sort: 6, color: "#FDE7E3", cover: "ot-hiem" },
];

const FRIDGE = "Ngăn mát tủ lạnh 2–5°C";
const DRY = "Nơi khô ráo, thoáng mát, tránh nắng";
const MEAT = "Ngăn mát 0–4°C, dùng trong 2 ngày hoặc cấp đông";

export const products: CatalogProduct[] = [
  // Rau củ
  { slug: "rau-muong", name: "Rau muống", category: "rau-cu", priceVnd: 15000, unit: "bó ~300g", netGrams: 300, isWeighed: true, origin: "Củ Chi, TP.HCM", shelfLife: "2 ngày", storage: FRIDGE, stock: 60, description: "Rau muống ta cọng nhỏ, hái sáng sớm, hợp xào tỏi hoặc luộc chấm mắm." },
  { slug: "cai-ngot", name: "Cải ngọt VietGAP", category: "rau-cu", priceVnd: 18000, unit: "bó ~300g", netGrams: 300, isWeighed: true, origin: "Đà Lạt, VietGAP", shelfLife: "3 ngày", storage: FRIDGE, stock: 45, description: "Cải ngọt lá non, trồng theo chuẩn VietGAP, nấu canh hay xào đều ngọt." },
  { slug: "ca-chua-bi", name: "Cà chua bi", category: "rau-cu", priceVnd: 32000, compareAtVnd: 39000, unit: "hộp 300g", netGrams: 300, isWeighed: false, origin: "Đà Lạt", shelfLife: "5 ngày", storage: FRIDGE, stock: 40, description: "Cà chua bi đỏ mọng, vị chua ngọt, ăn sống hoặc trộn salad." },
  { slug: "khoai-lang-nhat", name: "Khoai lang Nhật", category: "rau-cu", priceVnd: 35000, unit: "túi ~1kg", netGrams: 1000, isWeighed: true, origin: "Đà Lạt", shelfLife: "14 ngày", storage: DRY, stock: 50, description: "Khoai lang vỏ tím ruột vàng, nướng hoặc hấp đều dẻo bùi." },
  { slug: "ca-rot", name: "Cà rốt", category: "rau-cu", priceVnd: 22000, unit: "túi ~500g", netGrams: 500, isWeighed: true, origin: "Đà Lạt", shelfLife: "10 ngày", storage: FRIDGE, stock: 55, description: "Cà rốt củ đều, giòn ngọt, hợp nấu canh, ép nước hay làm đồ chua." },
  { slug: "bi-do-ho-lo", name: "Bí đỏ hồ lô", category: "rau-cu", priceVnd: 25000, unit: "quả ~1kg", netGrams: 1000, isWeighed: true, origin: "Lâm Đồng", shelfLife: "14 ngày", storage: DRY, stock: 30, description: "Bí đỏ hồ lô ruột dày, nấu canh hoặc làm súp đều béo." },
  { slug: "dua-leo", name: "Dưa leo", category: "rau-cu", priceVnd: 19000, unit: "túi ~500g", netGrams: 500, isWeighed: true, origin: "Củ Chi, TP.HCM", shelfLife: "5 ngày", storage: FRIDGE, stock: 50, description: "Dưa leo trái nhỏ, giòn, ít hạt, ăn kèm cơm hoặc làm salad." },
  { slug: "hanh-la", name: "Hành lá", category: "rau-cu", priceVnd: 8000, unit: "bó 100g", netGrams: 100, isWeighed: false, origin: "Hóc Môn, TP.HCM", shelfLife: "3 ngày", storage: FRIDGE, stock: 80, description: "Hành lá tươi, rửa sạch để ráo, gói giấy rồi cất ngăn mát." },
  // Trái cây
  { slug: "buoi-dien", name: "Bưởi Diễn", category: "trai-cay", priceVnd: 75000, unit: "quả ~1,2kg", netGrams: 1200, isWeighed: true, origin: "Phú Diễn, Hà Nội", shelfLife: "14 ngày", storage: DRY, stock: 25, description: "Bưởi Diễn vỏ mỏng, múi vàng ráo nước, ngọt thanh." },
  { slug: "xoai-cat-hoa-loc", name: "Xoài cát Hòa Lộc", category: "trai-cay", priceVnd: 85000, compareAtVnd: 99000, unit: "túi ~1kg", netGrams: 1000, isWeighed: true, origin: "Cái Bè, Tiền Giang", shelfLife: "5 ngày", storage: "Để nhiệt độ phòng cho chín, chín rồi cất ngăn mát", stock: 35, description: "Xoài cát Hòa Lộc thơm đậm, thịt mịn không xơ.", cutout: true },
  { slug: "thanh-long-ruot-do", name: "Thanh long ruột đỏ", category: "trai-cay", priceVnd: 45000, unit: "túi ~1kg", netGrams: 1000, isWeighed: true, origin: "Hàm Thuận Nam, Bình Thuận", shelfLife: "7 ngày", storage: FRIDGE, stock: 40, description: "Thanh long ruột đỏ ngọt đậm, ướp lạnh ăn rất mát." },
  { slug: "cam-sanh", name: "Cam sành", category: "trai-cay", priceVnd: 39000, unit: "túi ~1kg", netGrams: 1000, isWeighed: true, origin: "Tam Bình, Vĩnh Long", shelfLife: "10 ngày", storage: FRIDGE, stock: 60, description: "Cam sành mọng nước, chua ngọt, chuyên vắt nước.", cutout: true },
  { slug: "tao-envy", name: "Táo Envy", category: "trai-cay", priceVnd: 159000, unit: "túi ~1kg", netGrams: 1000, isWeighed: true, origin: "Nhập khẩu New Zealand", shelfLife: "21 ngày", storage: FRIDGE, stock: 0, description: "Táo Envy giòn ngọt, thịt trắng lâu thâm." },
  { slug: "nho-xanh-ninh-thuan", name: "Nho xanh Ninh Thuận", category: "trai-cay", priceVnd: 89000, unit: "hộp 500g", netGrams: 500, isWeighed: false, origin: "Ninh Thuận", shelfLife: "5 ngày", storage: FRIDGE, stock: 3, description: "Nho xanh giòn, chua nhẹ, rửa ngay trước khi ăn." },
  { slug: "chuoi-gia", name: "Chuối già Nam Mỹ", category: "trai-cay", priceVnd: 32000, unit: "nải ~1kg", netGrams: 1000, isWeighed: true, origin: "Đồng Nai", shelfLife: "5 ngày", storage: "Nhiệt độ phòng, treo nơi thoáng", stock: 45, description: "Chuối già vỏ vàng đều, ngọt mềm, ăn sáng tiện lợi.", cutout: true },
  { slug: "bo-034", name: "Bơ 034", category: "trai-cay", priceVnd: 69000, unit: "túi ~1kg", netGrams: 1000, isWeighed: true, origin: "Krông Pắc, Đắk Lắk", shelfLife: "5 ngày", storage: "Để nhiệt độ phòng đến khi chín, chín rồi cất ngăn mát", stock: 30, description: "Bơ 034 trái dài, cơm vàng dẻo, béo ngậy.", cutout: true },
  // Thịt cá
  { slug: "ba-roi-heo", name: "Ba rọi heo", category: "thit-ca", priceVnd: 79000, unit: "khay ~500g", netGrams: 500, isWeighed: true, origin: "Đồng Nai", shelfLife: "2 ngày (ngăn mát)", storage: MEAT, stock: 30, description: "Ba rọi nạc mỡ xen kẽ, hợp kho tộ, luộc hoặc nướng." },
  { slug: "than-bo-noi", name: "Thăn bò nội", category: "thit-ca", priceVnd: 145000, unit: "khay ~300g", netGrams: 300, isWeighed: true, origin: "Tây Ninh", shelfLife: "2 ngày (ngăn mát)", storage: MEAT, stock: 20, description: "Thăn bò mềm, ít gân, hợp xào hoặc áp chảo." },
  { slug: "uc-ga-phi-le", name: "Ức gà phi lê", category: "thit-ca", priceVnd: 49000, unit: "khay ~500g", netGrams: 500, isWeighed: true, origin: "Bình Dương", shelfLife: "2 ngày (ngăn mát)", storage: MEAT, stock: 35, description: "Ức gà phi lê bỏ da, nhiều đạm, ít mỡ." },
  { slug: "ca-hoi-phi-le", name: "Cá hồi phi lê", category: "thit-ca", priceVnd: 159000, compareAtVnd: 179000, unit: "khay ~300g", netGrams: 300, isWeighed: true, origin: "Nhập khẩu Na Uy", shelfLife: "2 ngày (ngăn mát)", storage: "Ngăn mát 0–2°C", stock: 15, description: "Cá hồi phi lê thịt cam đỏ, áp chảo hoặc làm sashimi." },
  { slug: "tom-the", name: "Tôm thẻ", category: "thit-ca", priceVnd: 129000, unit: "khay ~500g", netGrams: 500, isWeighed: true, origin: "Năm Căn, Cà Mau", shelfLife: "2 ngày (ngăn mát)", storage: MEAT, stock: 25, description: "Tôm thẻ size 40–50 con/kg, thịt chắc ngọt." },
  { slug: "ca-basa-cat-khuc", name: "Cá basa cắt khúc", category: "thit-ca", priceVnd: 59000, unit: "khay ~500g", netGrams: 500, isWeighed: true, origin: "Châu Đốc, An Giang", shelfLife: "2 ngày (ngăn mát)", storage: MEAT, stock: 30, description: "Cá basa cắt khúc sẵn, hợp kho tộ hoặc nấu canh chua." },
  // Trứng & sữa
  { slug: "trung-ga-ta", name: "Trứng gà ta", category: "trung-sua", priceVnd: 39000, unit: "hộp 10 quả", isWeighed: false, origin: "Trảng Bom, Đồng Nai", shelfLife: "21 ngày", storage: FRIDGE, stock: 70, description: "Trứng gà ta lòng đỏ đậm, ngày đóng gói in trên hộp.", cutout: true },
  { slug: "trung-vit", name: "Trứng vịt", category: "trung-sua", priceVnd: 35000, unit: "hộp 10 quả", isWeighed: false, origin: "Tháp Mười, Đồng Tháp", shelfLife: "21 ngày", storage: FRIDGE, stock: 50, description: "Trứng vịt tươi, hợp chiên, luộc hoặc làm bánh." },
  { slug: "sua-tuoi-khong-duong", name: "Sữa tươi không đường", category: "trung-sua", priceVnd: 36000, unit: "lốc 4 hộp 180ml", isWeighed: false, origin: "Mộc Châu, Sơn La", shelfLife: "6 tháng", storage: "Nơi khô ráo; sau khi mở cất ngăn mát, dùng trong 24h", stock: 80, description: "Sữa tươi tiệt trùng không đường, vị thanh tự nhiên." },
  { slug: "sua-chua-co-duong", name: "Sữa chua có đường", category: "trung-sua", priceVnd: 28000, unit: "lốc 4 hộp 100g", isWeighed: false, origin: "Ba Vì, Hà Nội", shelfLife: "30 ngày", storage: FRIDGE, stock: 60, description: "Sữa chua mịn, chua dịu, ăn lạnh ngon nhất." },
  { slug: "pho-mai-lat", name: "Phô mai lát", category: "trung-sua", priceVnd: 65000, compareAtVnd: 72000, unit: "gói 200g", netGrams: 200, isWeighed: false, origin: "Nhập khẩu Úc", shelfLife: "6 tháng", storage: FRIDGE, stock: 25, description: "Phô mai cheddar lát mỏng, kẹp bánh mì hoặc làm hamburger.", cutout: true },
  { slug: "dau-hu-non", name: "Đậu hũ non", category: "trung-sua", priceVnd: 12000, unit: "hộp 300g", netGrams: 300, isWeighed: false, origin: "TP.HCM", shelfLife: "3 ngày", storage: FRIDGE, stock: 40, description: "Đậu hũ non mềm mịn, nấu canh hoặc hấp xì dầu." },
  // Bánh mì & đồ khô
  { slug: "banh-mi-sandwich", name: "Bánh mì sandwich", category: "banh-mi-do-kho", priceVnd: 25000, unit: "gói 400g", netGrams: 400, isWeighed: false, origin: "TP.HCM", shelfLife: "5 ngày", storage: DRY, stock: 30, description: "Bánh mì sandwich mềm, nướng sơ ăn sáng cùng trứng.", cutout: true },
  { slug: "gao-st25", name: "Gạo ST25", category: "banh-mi-do-kho", priceVnd: 189000, compareAtVnd: 210000, unit: "túi 5kg", netGrams: 5000, isWeighed: false, origin: "Sóc Trăng", shelfLife: "12 tháng", storage: DRY, stock: 40, description: "Gạo ST25 hạt dài, cơm dẻo thơm, để nguội vẫn mềm.", cutout: true },
  { slug: "mi-trung", name: "Mì trứng", category: "banh-mi-do-kho", priceVnd: 18000, unit: "gói 500g", netGrams: 500, isWeighed: false, origin: "Bình Dương", shelfLife: "12 tháng", storage: DRY, stock: 60, description: "Mì trứng sợi nhỏ, trụng nhanh, hợp mì xào hoặc mì nước." },
  { slug: "yen-mach-can-det", name: "Yến mạch cán dẹt", category: "banh-mi-do-kho", priceVnd: 79000, unit: "túi 1kg", netGrams: 1000, isWeighed: false, origin: "Nhập khẩu Úc", shelfLife: "12 tháng", storage: DRY, stock: 35, description: "Yến mạch cán dẹt nguyên hạt, nấu cháo hoặc ngâm qua đêm." },
  { slug: "hat-dieu-rang-muoi", name: "Hạt điều rang muối", category: "banh-mi-do-kho", priceVnd: 149000, unit: "hũ 500g", netGrams: 500, isWeighed: false, origin: "Bình Phước", shelfLife: "6 tháng", storage: DRY, stock: 20, description: "Hạt điều nguyên hạt rang muối, giòn béo." },
  { slug: "banh-trang-trang-bang", name: "Bánh tráng Trảng Bàng", category: "banh-mi-do-kho", priceVnd: 22000, unit: "gói 300g", netGrams: 300, isWeighed: false, origin: "Trảng Bàng, Tây Ninh", shelfLife: "6 tháng", storage: DRY, stock: 45, description: "Bánh tráng phơi sương dẻo mềm, cuốn thịt luộc rau sống." },
  // Gia vị
  { slug: "nuoc-mam-phu-quoc", name: "Nước mắm Phú Quốc 40 độ đạm", category: "gia-vi", priceVnd: 89000, unit: "chai 500ml", isWeighed: false, origin: "Phú Quốc, Kiên Giang", shelfLife: "24 tháng", storage: DRY, stock: 40, description: "Nước mắm cá cơm 40 độ đạm, màu cánh gián, mặn hậu ngọt." },
  { slug: "dau-an-dau-nanh", name: "Dầu ăn đậu nành", category: "gia-vi", priceVnd: 59000, unit: "chai 1L", isWeighed: false, origin: "Việt Nam", shelfLife: "18 tháng", storage: DRY, stock: 50, description: "Dầu đậu nành tinh luyện, chiên xào không khói.", cutout: true },
  { slug: "duong-mia", name: "Đường mía", category: "gia-vi", priceVnd: 28000, unit: "túi 1kg", netGrams: 1000, isWeighed: false, origin: "Tân Châu, Tây Ninh", shelfLife: "24 tháng", storage: DRY, stock: 60, description: "Đường mía trắng tinh luyện, hạt đều.", cutout: true },
  { slug: "muoi-tom-tay-ninh", name: "Muối tôm Tây Ninh", category: "gia-vi", priceVnd: 35000, unit: "hũ 200g", netGrams: 200, isWeighed: false, origin: "Tây Ninh", shelfLife: "12 tháng", storage: DRY, stock: 40, description: "Muối tôm cay mặn, chấm trái cây xanh." },
  { slug: "toi-ly-son", name: "Tỏi Lý Sơn", category: "gia-vi", priceVnd: 45000, unit: "túi 200g", netGrams: 200, isWeighed: false, origin: "Lý Sơn, Quảng Ngãi", shelfLife: "3 tháng", storage: DRY, stock: 35, description: "Tỏi cô đơn Lý Sơn tép nhỏ, thơm cay đậm.", cutout: true },
  { slug: "ot-hiem", name: "Ớt hiểm", category: "gia-vi", priceVnd: 12000, unit: "túi 100g", netGrams: 100, isWeighed: false, origin: "Chợ Gạo, Tiền Giang", shelfLife: "7 ngày", storage: FRIDGE, stock: 50, description: "Ớt hiểm trái nhỏ, cay nồng, dùng làm nước chấm.", cutout: true },
];

export const giftBase: CatalogProduct = {
  slug: "gio-may-qua-bieu",
  name: "Giỏ mây quà biếu",
  category: "trai-cay",
  priceVnd: 120000,
  unit: "cái",
  isWeighed: false,
  origin: "Phú Vinh, Hà Nội",
  shelfLife: "Không áp dụng",
  storage: DRY,
  stock: 20,
  description: "Giỏ mây đan tay, dùng để xếp giỏ quà biếu.",
  isGiftBase: true,
};
