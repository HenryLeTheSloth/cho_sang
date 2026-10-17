import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  index("routes/home.tsx"),
  route("collections/:slug", "routes/collection.tsx"),
  route("products/:slug", "routes/product.tsx"),
  route("about", "routes/about.tsx"),
  route("contact", "routes/contact.tsx"),
  route("cart", "routes/cart.ts"),
  route("gift", "routes/gift.tsx"),
  route("gift/preview/:id", "routes/gift-preview.ts"),
  route("checkout", "routes/checkout.tsx"),
  route("checkout/pay/:code", "routes/checkout-pay.tsx"),
  route("orders", "routes/orders.tsx"),
  route("orders/:code", "routes/order.tsx"),
  route("login", "routes/login.tsx"),
  route("logout", "routes/logout.ts"),
  route("uploads/*", "routes/uploads.ts"),
] satisfies RouteConfig;
