import { data, isRouteErrorResponse, Links, Meta, Outlet, Scripts, ScrollRestoration } from "react-router";
import type { Route } from "./+types/root";
import { CartDrawer } from "./components/cart-drawer";
import { PendingBar } from "./components/pending-bar";
import { SiteFooter } from "./components/site-footer";
import { SiteHeader } from "./components/site-header";
import { FlashToast } from "./components/toast";
import { getCartView, readCart } from "./lib/cart.server";
import { listCategories, listPromotions } from "./lib/catalog.server";
import { commitSession, getSession, getUser } from "./lib/session.server";
import "./app.css";

export const links: Route.LinksFunction = () => [
  { rel: "icon", href: "/favicon.svg", type: "image/svg+xml" },
];

// Giỏ (đã ghép giá DB) cho header, thẻ và drawer: SSR có sẵn, drawer mở tức thì. Revalidate sau mỗi action /cart.
// Giỏ trống thì kèm 3 món khuyến mãi cho drawer (quyết định Designer ở cổng M2); giỏ có hàng thì không tốn query.
// Flash `toast` chỉ được đọc ở đây (một loader duy nhất đọc flash, docs RR "Session Gotchas").
export async function loader({ request }: Route.LoaderArgs) {
  const [cart, session] = await Promise.all([readCart(request).then(getCartView), getSession(request)]);
  const [suggestions, user, categories] = await Promise.all([
    cart.lines.length + cart.bundles.length === 0 ? listPromotions(3) : [],
    getUser(session),
    listCategories(), // thanh danh mục ở header (desktop)
  ]);
  const text = session.get("toast");
  const toast = text ? { text, id: crypto.randomUUID() } : null; // id mới mỗi lần để cùng một câu vẫn hiện lại
  return data(
    { cart, suggestions, categories, user: user && { phone: user.phone }, toast },
    toast ? { headers: { "Set-Cookie": await commitSession(session) } } : undefined, // xoá flash đã đọc
  );
}

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="theme-color" content="#FFFFFF" />
        <Meta />
        <Links />
      </head>
      <body>
        <PendingBar />
        <SiteHeader />
        {children}
        <SiteFooter />
        <CartDrawer />
        <FlashToast />
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export default function App() {
  return <Outlet />;
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  const notFound = isRouteErrorResponse(error) && error.status === 404;
  const detail = import.meta.env.DEV && error instanceof Error ? error.stack : undefined;
  return (
    <main className="mx-auto max-w-6xl px-4 py-16">
      <h1 className="text-3xl">{notFound ? "Không tìm thấy trang" : "Có lỗi xảy ra"}</h1>
      <p className="mt-2 text-ink-muted">
        {notFound ? "Trang bạn tìm không tồn tại hoặc đã được chuyển." : "Bạn thử tải lại trang giúp mình nhé."}
      </p>
      {detail && <pre className="mt-6 overflow-x-auto text-xs">{detail}</pre>}
    </main>
  );
}
