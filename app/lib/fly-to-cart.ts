/**
 * Ảnh sản phẩm bay vào nút giỏ (khoảnh khắc đặc trưng duy nhất, spec mục 4).
 * Bay từ đúng ảnh cạnh nút vừa bấm (một món có thể hiện ở bảng giá, kệ hàng và lưới cùng lúc).
 * JS chỉ đo vị trí và gắn class; chuyển động là CSS `.fly-to-cart` trong app.css.
 */
export function flyToCart(img: HTMLImageElement) {
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return; // reduced-motion: không transform
  const target = document.getElementById("cart-button"); // header giữ id này (e2e cũng chờ hydrate qua nó)
  if (!target) return;
  const from = img.getBoundingClientRect();
  if (from.bottom < 0 || from.top > innerHeight) return; // ảnh ngoài màn hình: chỉ badge nảy
  const to = target.getBoundingClientRect();
  const ghost = new Image();
  ghost.src = img.currentSrc || img.src;
  ghost.alt = "";
  ghost.className = "fly-to-cart";
  Object.assign(ghost.style, {
    left: `${from.left}px`,
    top: `${from.top}px`,
    width: `${from.width}px`,
    height: `${from.height}px`,
  });
  ghost.style.setProperty("--fly-x", `${to.left + to.width / 2 - (from.left + from.width / 2)}px`);
  ghost.style.setProperty("--fly-y", `${to.top + to.height / 2 - (from.top + from.height / 2)}px`);
  document.body.append(ghost);
  target.style.setProperty("--bump-delay", "300ms"); // badge nảy khi ảnh chạm giỏ
  setTimeout(() => target.style.removeProperty("--bump-delay"), 450);
  setTimeout(() => ghost.remove(), 450); // không dựa vào animationend: tab ẩn có thể không bắn sự kiện
}
