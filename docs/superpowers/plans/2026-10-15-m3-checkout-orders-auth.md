# M3 Checkout + đơn hàng + đăng nhập: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Load skill `react-router` trước khi đụng route/root; `prisma-client-api` trước khi viết query. **Không** load `prisma-orm-setup`.

**Goal:** Khách vãng lai đặt được đơn trên một trang checkout (COD chọn sẵn, online giả lập có nhãn DEMO), kho không bao giờ âm kể cả khi hai người tranh món cuối, bấm "Đặt hàng" hai lần chỉ ra một đơn. Trang đơn có timeline 4 bước, huỷ khi còn chờ (hoàn kho), "Mua lại đơn này", hotline. Đăng nhập bằng SĐT + OTP giả lập (admin phải có `ADMIN_PASSCODE`, không bao giờ thấy OTP). Có DB test riêng và bộ Playwright chạy trên bản build production.

**Architecture:** `placeOrder()` (`app/lib/orders.server.ts`) chạy MỘT transaction: đọc giá DB → đối chiếu tổng tiền với tổng khách đã thấy trên nút → tạo đơn (giữ `checkoutKey` unique, chống đặt trùng) → trừ kho bằng `UPDATE … WHERE id = ? AND stock >= q` theo id tăng dần → tạo dòng đơn; thiếu kho thì rollback và báo đúng món. Phiên là cookie ký `__session` (`createCookieSessionStorage`): `userId`, `guestOrderCodes`, `otp {phone, hash, exp, tries, admin}`, flash `toast` (chỉ root loader đọc). Quyền xem đơn = chủ tài khoản hoặc mã đơn nằm trong phiên (tra bằng mã + SĐT). Mọi action POST đi qua `readForm()` (chặn khác origin + trần 16KB). vitest và Playwright cùng reset DB `chosang_test` trong globalSetup; không test nào chạm DB dev.

**Tech Stack:** react-router 8.4.0 (`createCookieSessionStorage`, `redirect` với nhiều `Set-Cookie`, `data()`, `<Form>`, `useNavigation`), Prisma 7.10.0 (interactive `$transaction`, `updateMany` có điều kiện, `groupBy`), zod 4.6.7 (`z.flattenError`, `z.uuid`), node:crypto (`createHmac`, `timingSafeEqual`, `randomInt`), pg 8.23.1 (đã có: tạo DB test, truy vấn trong e2e), vitest 5.0.4 (`globalSetup`, `test.env`), **@playwright/test 1.64.0 (cài mới ở Task 7, devDependency, đã có trong bảng stack của spec)**, lucide-react 1.56.0, playwright-cli (global) để chụp ảnh.

**Spec:** [docs/superpowers/specs/2026-10-14-cho-sang-grocery-design.md](../specs/2026-10-14-cho-sang-grocery-design.md): mục 2 (dòng "Auth", "Giỏ hàng", "Hàng cân ký"), mục 3 MVP (Checkout 1 trang, Thanh toán giả lập, Đơn hàng, Đăng nhập OTP), mục 4 (palette, UX không nhượng bộ, nhãn DEMO), mục 5 (data model + quy tắc transaction/huỷ/đơn online thất bại, cookie `__session`, route map `/checkout`, `/checkout/pay/:code`, `/orders`, `/orders/:code`, `/login`, `/logout`, ngân sách JS) và mục 6 (dòng M3 + DoD). Roadmap: [2026-10-14-cho-sang-roadmap.md](2026-10-14-cho-sang-roadmap.md): hợp đồng module (`session.server.ts` + `requireAdmin`, `orders.server.ts` + `placeOrder()`, `env` thêm `DEMO_OTP`, `ADMIN_PASSCODE`), Review Focus 4 và 5, và các mục **"Chuyển sang M3"** trong "Kết quả M0", "Kết quả M1", "Kết quả M2" (bắt buộc, xem bảng phủ ở cuối phần Decision).

## Global Constraints

- Phiên bản ghim exact (`.npmrc: save-exact=true`). **Dependency mới duy nhất: `@playwright/test@1.64.0`** (`npm i -D -E`, Task 7). Không có install script (spike 11). zod chỉ được import từ file `.server.ts`.
- Cấm `@remix-run/*`, better-auth, argon2, Conform, state manager, thư viện component, GSAP/Framer Motion.
- Tiền là `Int` VND, hiển thị qua `formatVnd()`, luôn kèm đơn vị bán. Giá luôn đọc lại từ DB; **tổng tiền của đơn dùng lại `cartTotals()`** (cùng hàm với drawer và nút "Đặt hàng").
- Kho: chỉ trừ bằng câu UPDATE có điều kiện trong transaction; CHECK `stock >= 0` của M0 là lưới an toàn cuối. Huỷ: `UPDATE … WHERE status = 'pending'` rồi mới hoàn kho.
- Cookie `__session`: 30 ngày, httpOnly, sameSite=lax, `secure: env.COOKIE_SECURE`, ký bằng `env.SESSION_SECRET` (cùng secret với `cart`). Production: `SESSION_SECRET` ≥32 ký tự và không bắt đầu bằng `dev-only`. Cookie `cart` vẫn tách riêng: đăng xuất không mất giỏ.
- **Mọi action POST gọi `readForm(request)` ở dòng đầu** (chặn POST khác origin + trần body 16KB). Không còn `request.formData()` trong `app/routes`.
- `redirectTo` chỉ qua `safeRedirect()`. Quyền xem/thao tác đơn chỉ qua `canViewOrder()`.
- OTP giả lập chỉ khi `DEMO_OTP=1` (fail-closed). SĐT admin không bao giờ nhận mã OTP; cần `ADMIN_PASSCODE` (rỗng = admin không vào được). Mọi màn thanh toán giả lập và toast OTP có nhãn **DEMO**.
- Màu: `brand` chỉ cho CTA, giá, badge giỏ, logo, focus ring (trạng thái chọn khung giờ/thanh toán dùng `ink`). `fresh` = bước timeline đã qua. `danger` chỉ cho lỗi form, luôn kèm icon `CircleAlert` + chữ. `sun` không dùng ở M3.
- Tiếng Việt trên mọi chữ hiển thị. 375px làm trước. Vùng chạm ≥44px (`min-h-11`/`size-11`, nút chính `min-h-12`). Có hover + focus-visible. Label luôn hiện, lỗi inline ngay dưới field. Icon Lucide, không emoji. Giờ/ngày hiển thị được tính sẵn ở loader (giờ Việt Nam), không format ở client (tránh lệch hydrate).
- JS route đầu ≤130KB gzip (= **133120 bytes**; M2 đo 123368; bản thử M3 đo 125485).
- DB dev là dữ liệu dùng chung: **không bao giờ** `prisma migrate reset`, `docker compose down -v`, xoá `uploads/`. Đổi schema chỉ qua `prisma migrate diff` + `prisma migrate deploy` (Decision 3). Chỉ DB `chosang_test` được TRUNCATE, và chỉ sau khi Postgres xác nhận `current_database() = 'chosang_test'`. Kiểm tay trên trình duyệt chạy bản build nối DB test, không đặt đơn vào DB dev.
- Không git. Mỗi task kết thúc bằng **Checkpoint**: `npm run typecheck && npm test` (container `db` đang chạy).
- Lệnh `docker compose exec -T db psql …` trong plan cần CLI trỏ đúng engine đang chạy container. Nếu `docker compose ps` báo `db` không chạy mà test vẫn nối được cổng 5432 (đã gặp ngày 15/10: Docker Desktop mở lên và chuyển context của CLI sang `desktop-linux`), chạy `export DOCKER_CONTEXT=default` rồi chạy lại. **Không** `docker compose up`/`down` trên context sai.
- Ảnh chụp lưu vào `.superpowers/sdd/2026-10-15-m3-checkout-orders-auth/`. Sau khi dùng `playwright-cli`, xoá `.playwright-cli/` nếu nó được tạo trong project. Dừng server bằng PID đang nghe cổng, không bao giờ `pkill -f`.

## Quyết định (Decision) ở những chỗ spec để ngỏ

1. **Decision: DB test `chosang_test` = database thứ hai trong cùng container, tạo bằng `pg` từ Node** (`SELECT 1 FROM pg_database` rồi `CREATE DATABASE`, không phá gì), không qua `docker compose exec`. `prisma/test-db.ts` vừa export `TEST_DATABASE_URL` (đổi tên database trong `DATABASE_URL` của `.env`), vừa là `globalSetup` cho **cả vitest lẫn Playwright**: tạo nếu chưa có → `prisma migrate deploy` → `TRUNCATE` (sau khi kiểm `current_database()`) → seed. Chạy mỗi lần (~2,5 giây), nên mọi test có dữ liệu seed sạch và xác định: hết phụ thuộc DB dev (việc chuyển từ M0, M1, M2). Không bao giờ `migrate reset`.
2. **Decision: chống bấm "Đặt hàng" 2 lần bằng khoá trong form + cột unique.** Loader `/checkout` cấp `checkoutKey = crypto.randomUUID()` (input ẩn). Thêm cột `Order.checkoutKey String? @unique` (migration mới, không phá dữ liệu: cột nullable + unique index). `placeOrder` tạo đơn **trước** khi trừ kho: request trùng khoá dừng ở unique index cho tới khi request đầu commit, nhận P2002, rồi tra lại theo khoá và trả **đúng mã đơn đó** (cả hai response đều redirect về cùng trang đơn). Gửi lại form cũ sau đó (Back) cũng về đơn cũ: tra khoá chạy **trước** mọi kiểm tra khác, kể cả kiểm tổng tiền (Decision 20). Đây là migration đầu tiên sau M0; roadmap nói schema đầy đủ được tạo ở M0, nhưng không có cách chống trùng đồng thời nào an toàn mà không cần chỗ lưu khoá trong DB (cookie/phiên không chặn được hai request bay song song). Cổng plan M3: không phản đối; "Kết quả M3" ghi ngoại lệ này (Task 8 Step 7).
3. **Decision: tạo migration bằng `prisma migrate diff` rồi `prisma migrate deploy`**, không dùng `migrate dev`: ở shell không tương tác (agent), `migrate dev` từ chối chạy khi có cảnh báo unique (spike 7). `migrate diff --from-config-datasource --to-schema` sinh đúng 2 câu (ADD COLUMN + CREATE UNIQUE INDEX), không đụng CHECK của M0; `migrate deploy` không bao giờ reset.
4. **Decision: trừ kho bằng `tx.product.updateMany({ where: { id, isActive: true, stock: { gte: q } }, data: { stock: { decrement: q } } })`.** Spike 4: Prisma sinh đúng MỘT câu `UPDATE "Product" SET stock = stock - $1 WHERE id = $2 AND stock >= $3` của spec, trả `{ count }`, có kiểu, không cần `$executeRaw`. Số lượng được gộp theo sản phẩm (`aggregateQty`, sẵn cho dòng giỏ quà M4) và **trừ theo id tăng dần** để hai đơn không bao giờ deadlock.
5. **Decision: một helper `readForm(request, maxBytes = 16KB)` ở dòng đầu mọi action.** RR 8.4 tự kiểm Origin cho route có UI nhưng **không** cho resource route (`/cart`, `/logout`): spike 1 POST khác origin vào resource route vẫn chạy. Helper so **cả origin** (scheme + host + port) với `request.url`; không có `Origin` thì xét `Sec-Fetch-Site`; không có cả hai là client không phải trình duyệt (curl, test) nên cho qua. Body đọc theo luồng và dừng khi vượt trần (body chunked không `Content-Length` cũng bị chặn). Sai thì ném `Response` 403/413.
6. **Decision: OTP = 6 số `randomInt`, cookie chỉ giữ `HMAC-SHA256(SESSION_SECRET, otp:sđt:mã:hạn)`**, không giữ SHA-256 trần (6 số băm trần dò ngược trong tích tắc từ cookie). Mã gắn với SĐT và hạn 5 phút; tối đa 5 lần sai (`tries` trong cookie, đúng spec). `ponytail:` cookie có thể bị phát lại để đưa `tries` về 0; với khách thì vô hại vì ở chế độ DEMO mã đã hiện cho chính người yêu cầu, còn passcode admin có thêm **bộ đếm sai trong RAM theo SĐT** (5 lần sai → khoá 15 phút). Admin = `User.role = admin` **hoặc** đúng `ADMIN_PHONE = "0909000000"` (seed tạo dòng này; số này không bao giờ nhận OTP kể cả khi chưa có dòng User, ví dụ vừa deploy chưa seed hay giữa TRUNCATE và seed). SĐT admin: không tạo OTP, chỉ hỏi `ADMIN_PASSCODE` (so HMAC thời gian hằng). `signIn(phone, viaPasscode)` từ chối mọi tài khoản role admin đi đường OTP (cả admin được nâng quyền sau ở M5), nên từ mã OTP trên màn hình không có đường nào thành admin (cổng M3, thay đổi 4). `ADMIN_PASSCODE` rỗng = admin bị khoá (fail-closed); production bắt buộc ≥12 ký tự và không `dev-only…`. Trang đăng nhập có nói "Số này là tài khoản quản trị" (lộ SĐT nào là admin: chấp nhận cho demo).
7. **Decision: gắn đơn khách cùng SĐT vào tài khoản ở MỌI lần đăng nhập**, không chỉ lần đầu (bao trùm spec; đơn đặt lúc đã đăng xuất cũng về tài khoản).
8. **Decision: khung giờ** = 4 khung trong `config.ts` (`08:00–10:00`, `10:00–12:00`, `14:00–16:00`, `17:00–19:00`), cho hôm nay + ngày mai. Khung hôm nay bị khoá khi còn <60 phút tới giờ bắt đầu ("Đã qua"); khung có ≥`SLOT_CAPACITY` (20) đơn chưa huỷ bị khoá ("Đã kín"). Mặc định là khung mở sớm nhất (21h thì nhảy sang 08:00 ngày mai: roadmap Review Focus 5). Giờ Việt Nam = UTC+7 cố định (không giờ mùa hè), đúng cả khi server chạy UTC. Action kiểm lại khung ở server. `ponytail:` hai đơn đồng thời có thể vượt sức chứa 1 đơn; thêm advisory lock nếu cần.
9. **Decision: dòng hết hàng (stock 0) không vào đơn** (vẫn hiện, gạch, "Tạm hết hàng, không tính vào đơn"), giống drawer M2. Điều này chỉ áp cho dòng **đã** hết hàng lúc trang được tải (đã bị loại khỏi tổng trên nút). Món còn hàng nhưng thiếu (qty > stock) thì **cả đơn bị từ chối**, báo "X chỉ còn N <đơn vị>" kèm nút "Sửa giỏ hàng" mở drawer. Món hết hàng **sau** khi trang được tải thì không được biến mất khỏi đơn một cách im lặng: Decision 20 chặn đơn và nêu tên món. Giỏ toàn món hết hàng thì nút "Đặt hàng" bị khoá.
10. **Decision: toast dùng flash `toast` của `__session`, chỉ root loader đọc** (docs RR "Session Gotchas"); root loader chỉ commit cookie khi có flash. Toast ở đáy màn hình, `role="status"`, tự tắt sau 4 giây. Mã OTP DEMO là toast riêng của trang `/login`, không tự tắt, giữ qua các lần nhập sai.
11. **Decision: quyền xem đơn** = `order.userId === session.userId` hoặc mã đơn trong `session.guestOrderCodes` (tối đa 20, mới nhất trước). Không có quyền và mã không tồn tại trả **cùng một màn** (form nhập SĐT), không lộ đơn nào có thật. Tra cứu: SĐT (chuẩn hoá `0912 345 678`, `+84…`) phải khớp đơn. `ponytail:` tra cứu không giới hạn số lần (phải đoán cả SĐT lẫn 4 ký tự ngẫu nhiên trong ngày).
12. **Decision: đăng xuất tạo phiên mới** (quên `userId`, OTP và mã đơn khách: máy dùng chung), flash "Đã đăng xuất", redirect `safeRedirect(redirectTo)`. `GET /logout` không có loader nên RR trả lỗi (spike 18).
13. **Decision: "Mua lại đơn này"** đặt số lượng tuyệt đối vào cookie giỏ (bỏ món ngừng bán/hết hàng, kẹp theo tồn kho và 99, bỏ dòng giỏ quà), rồi chuyển sang `/checkout`.
14. **Decision: cổng giả lập** = bảng chuyển trạng thái `pay | fail | retry | cod`, mỗi bước là một `updateMany` có điều kiện (`status = pending`, `paymentMethod = online_mock`, `paymentStatus ∈ from`). Đơn online thất bại vẫn giữ kho tới khi huỷ (`ponytail:` không có TTL, thêm job dọn đơn treo nếu chạy thật). Sau khi tạo đơn online, toast là "Đã tạo đơn, mời bạn thanh toán" (không nói "thành công" khi chưa trả).
15. **Decision: giỏ rỗng vào `/checkout` thì redirect `/collections/all`.**
16. **Decision: giỏ trống trong drawer** đúng phạm vi Designer chốt ở cổng M2: `FreeshipBasket` ở 0% thay icon Lucide, "Giỏ hàng đang trống", 3 món `listPromotions(3)` có nút + (`CartControl`), link chữ "Xem tất cả sản phẩm". Câu "Freeship cho đơn từ 300.000₫" bị bỏ vì rổ đã ghi "Còn 300.000₫ nữa được freeship" (không lặp). Root loader chỉ query khuyến mãi khi giỏ rỗng.
17. **Decision: header thêm icon `UserRound`** (44px): đã đăng nhập → `/orders` ("Tài khoản và đơn hàng"), chưa → `/login?redirectTo=<trang hiện tại>`. Để "Tìm món…" vẫn vừa ở 375px: `gap-1.5` (sm: `gap-3`), ô tìm `pl-9 pr-2`, icon kính lúp `left-2.5`.
18. **Decision: e2e chạy trên bản build production, cổng 3100, DB test, `workers: 1`**, `webServer.env` cố định `SESSION_SECRET`/`ADMIN_PASSCODE`/`DEMO_OTP=1`, `reuseExistingServer: false`, đầu dò sẵn sàng là `/favicon.svg` (không chạm DB, nên chạy được cả khi `chosang_test` chưa tồn tại). Spike 11: webServer khởi động **trước** globalSetup; server chỉ nối DB khi có request nên reset sau đó vẫn an toàn.
19. **Decision: `tsconfig.json` thêm `allowImportingTsExtensions`** để `vitest.config.ts`/`playwright.config.ts` import `./prisma/test-db.ts` có đuôi (Vite cảnh báo import không đuôi ở config, spike 9). `noEmit` đã bật nên hợp lệ.
20. **Decision (cổng M3, thay đổi 2 + 3): đơn phải đúng bằng tổng khách đã bấm.** Form có input ẩn `total` (= `totals.totalVnd` của loader), `parseCheckoutForm` kiểm số nguyên ≥0, `placeOrder` nhận `expectedTotalVnd`. Trong transaction, tổng được tính trên **mọi dòng** (`stock: 1`: đơn chỉ commit khi mọi dòng đã trừ kho thành công, không dựa vào số tồn đọc lúc đầu, nếu không một đơn huỷ đồng thời có thể biến một món thành miễn phí), rồi so với `expectedTotalVnd`; lệch thì rollback và trả `{ ok: false, reason: "changed" }` (giỏ rỗng sau khi lọc cũng là `changed`). Kiểm này chạy **sau** bước tra `checkoutKey`, nên gửi lại form khi giỏ đã xoá vẫn về đơn cũ. Action trả 409: món thiếu kho thì nêu tên + số còn; `changed` thì nêu các món đang hết trong giỏ ("X vừa hết hàng. Tổng tiền đã cập nhật…") hoặc "Giá hoặc giỏ hàng vừa thay đổi…". `shouldRevalidate` trả `true` khi `actionStatus === 409` (RR mặc định bỏ revalidate khi ≥400) để tóm tắt và nút cập nhật tổng mới; ô đã nhập không mất (uncontrolled). Nhờ vậy e2e "2 khách tranh món cuối" luôn ra "Nho xanh Ninh Thuận vừa hết hàng" bất kể thứ tự xen kẽ.

**Phủ các mục "Chuyển sang M3" của roadmap:**

| Mục (nguồn) | Task |
|---|---|
| DB test riêng `chosang_test` trước khi viết test đơn/kho (M0) | 1 |
| Test catalog hard-code 24/40 sản phẩm → chạy trên DB test (M1); `fileParallelism: false` giữ nguyên vì chung một DB | 1 |
| Port test bấm nhanh + test offline sang @playwright/test (M2, I1) | 7 |
| Giỏ trống gợi ý 3 món khuyến mãi có nút + (M2, Designer) | 2, 7 |
| `__session` dùng lại `SESSION_SECRET`/`COOKIE_SECURE`; `SESSION_SECRET` ≥32 ở production (M2 ledger #1) | 1, 4 |
| Mọi POST action kiểm Origin + giới hạn body (M2) | 2 (+ mọi action ở 4, 5, 6), 8 |
| Checkout xử lý dòng hết hàng; `CartLine.isWeighed` + nhãn ±10% (M2 N4) | 2, 5 |
| Test `cart.server` hết phụ thuộc seed DB dev (M2 ledger #6) | 1 |
| Đo lại JS route đầu khi thêm route (M2) | 8 |
| `/checkout` 404 hiện "0 món" (M2 D13): M3 có route thật | 5 |
| Dùng lại `cartTotals` cho tổng tiền đơn trong transaction; xoá giỏ bằng `cartCookie.serialize({ ...cart, l: [] })`, giữ `b` (M2 Recommendation 3) | 3, 5 |

## Spike findings (đã chạy thật ngày 15/10/2026, trong scratchpad `m3-spike/`)

Ngoài các spike đơn lẻ dưới đây, **toàn bộ code của plan này đã được dựng thử trong một bản sao project ở scratchpad** (DB riêng `chosang_m3spike`, đã xoá sau đó): `npm run typecheck` sạch, vitest **184/184**, Playwright **13/13** trên bản build production, JS route đầu **125485 bytes**, không lỗi console/hydrate. Code trong các bước là đúng code đã chạy, **kể cả 6 thay đổi bắt buộc của cổng plan M3** (`.superpowers/agents/m3-plan-review.md`), được dựng thử lại theo cùng cách (spike 20).

1. **RR 8.4 tự chặn CSRF cho route có UI** (`throwIfPotentialCSRFAttack` trong `lib/server-runtime/server.js` và `single-fetch.js`, so cả origin): POST document khác origin vào `/go` → 400. **Resource route thì không**: `POST /res` với `Origin: http://evil.test` vẫn chạy action (chỉ đường `/res.data` của fetcher bị chặn). Vì vậy `/cart`, `/logout` cần helper riêng (Decision 5). Lưu ý cho M7: kiểm tra của RR so cả scheme, nên sau proxy TLS (request.url `http://…`, Origin `https://…`) mọi action sẽ 400 nếu không cấu hình `allowedActionOrigins` hoặc `trust proxy`.
2. **`createCookieSessionStorage<Data, Flash>`** (RR 8.4): `getSession(cookieHeader)`, `session.get/set/unset/has/flash`, `commitSession(session)` ra `__session=…; Max-Age=2592000; Path=/; HttpOnly; SameSite=Lax`. `sessionStorage.getSession()` không tham số = phiên rỗng. Sửa payload giữ chữ ký cũ → phiên rỗng. Flash đọc trong root loader + `data(…, { headers: { "Set-Cookie" } })` chạy đúng qua điều hướng client (Playwright: toast hiện sau redirect, reload thì mất).
3. **`redirect(url, { headers })` với `headers.append("Set-Cookie", …)` hai lần** giữ đủ 2 cookie cả ở POST document (302) lẫn single-fetch `/go.data` (202 + payload `redirect`). Trình duyệt nhận cả hai.
4. **Prisma 7.10 + adapter-pg:** `tx.$executeRaw\`UPDATE … WHERE id = … AND stock >= …\`` trong interactive `$transaction` trả `number` (1, rồi 0 khi hết). `updateMany({ where: { id, stock: { gte: q } }, data: { stock: { decrement: q } } })` sinh đúng một câu `UPDATE "public"."Product" SET "stock" = ("stock" - $1) WHERE ("id" = $2 AND "stock" >= $3)` và trả `{ count }`. Hai transaction tranh 1 đơn vị cuối (có `setTimeout` 300ms bên trong để chồng nhau): một thành công, một `count = 0`, kho còn 0.
5. **Unique index chặn đặt trùng:** transaction B chèn cùng khoá trong khi A chưa commit thì **chờ**, A commit xong thì B nhận `23505` (507ms trong spike). Prisma ném `PrismaClientKnownRequestError` code `P2002`; `meta` với adapter có dạng `{ driverAdapterError: { cause: { constraint: { index: "Order_code_key" } } } }` nên code không đọc `meta` mà tra lại theo `checkoutKey`.
6. **`@db.Date`:** ghi `new Date("2026-10-16")` đọc lại `2026-10-16T00:00:00.000Z`.
7. **Migration ở shell không tương tác:** `prisma migrate dev --create-only` báo lỗi "environment is non-interactive" khi có cảnh báo unique. `prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --script -o <dir>/migration.sql` sinh đúng `ALTER TABLE "Order" ADD COLUMN "checkoutKey" TEXT;` + `CREATE UNIQUE INDEX "Order_checkoutKey_key" …` (không đụng CHECK của M0); `migrate deploy` áp dụng; `migrate diff … --exit-code` sau đó trả 0; `migrate status` "up to date".
8. **DB test:** `CREATE DATABASE` qua `pg.Client` từ Node chạy được (lần hai báo "exists"). `prisma migrate deploy` (1,3s) và `tsx prisma/seed.ts` (1,0s) với `DATABASE_URL` ghi đè đều đi vào DB test: `prisma.config.ts` dùng `env()` và `process.loadEnvFile()` không ghi đè biến đã có.
9. **vitest 5.0.4:** `test.globalSetup` nhận file có `export default async function`; `test.env` đặt biến cho worker (loadEnvFile trong `env.server.ts` không ghi đè). Import `./prisma/test-db` không đuôi trong config làm Vite in cảnh báo `configLoader: 'native'` → dùng `./prisma/test-db.ts` + `allowImportingTsExtensions` (tsc sạch).
10. **`execFileSync` mặc định in stderr của tiến trình con** ("Loaded Prisma config…") ra màn hình test → `stdio: "pipe"` (lỗi thì stderr nằm trong `Error.message`).
11. **@playwright/test 1.64.0** (`latest` đã là 1.64.1, không dùng): 3 gói, **không có install script**; chromium revision 1248 **đã có sẵn** trong `~/.cache/ms-playwright`. Thứ tự: **webServer khởi động trước globalSetup** (log thời gian). `webServer.env` được trộn lên `process.env` (biến `HOME` vẫn còn). `browser.newContext()` trong test nhận `use.baseURL`.
12. **`readForm`:** `for await` trên `ReadableStream` không có kiểu trong lib DOM của TS 5.9 → dùng vòng `getReader()`. Mảng chunk phải là `Uint8Array<ArrayBuffer>[]` để `new Blob(chunks)` qua typecheck. Body chunked 40KB không `Content-Length` → 413; body rác multipart → `FormData` rỗng; urlencoded giữ dấu tiếng Việt.
13. **`safeRedirect` dùng `new URL(to, "http://n")`:** `//evil.test`, `/\evil.test`, `/<tab>/evil.test`, `/<xuống dòng>/evil.test`, `https://…`, `javascript:…` đều về `/`; `/orders/DH…?x=1#a` giữ nguyên. **Cổng M3 bắt thêm:** `/.//evil.test`, `/..//evil.test`, `/%2e//evil.test`, `/x/../\evil.test` qua được kiểm origin nhưng chuẩn hoá thành `//evil.test` (RR coi là URL ngoài) → kết quả phải bị kiểm thêm `!path.startsWith("//")`. Đã xác nhận 4 ca này đỏ với code cũ, xanh với code mới.
14. **`Intl.DateTimeFormat("vi-VN", { hour, minute, day, month })` ra "09:30 15-10"** (gạch nối lạ, và ICU giữa Node/trình duyệt có thể khác) → giờ VN được tính tay (`vnDateTimeLabel`) ở loader. Ngày giao dùng `Intl` `weekday: "long"` với `timeZone: "UTC"` ra "Thứ Sáu, 16/10", cũng chỉ ở loader.
15. **zod 4.6.7:** `z.flattenError(error).fieldErrors`, `z.uuid(msg)`, `z.enum([...], msg)`, `.transform().pipe(z.string().regex(...))` đều chạy; form thiếu field vẫn ra lời nhắn tiếng Việt khi đưa vào chuỗi rỗng thay vì `undefined`.
16. **Kiểm đột biến (test có đỏ được không):** bỏ `flushSync` hoặc bỏ `routeDiscovery: "initial"` → test bấm nhanh e2e đỏ; bỏ nhánh "trùng khoá trả lại đơn cũ" → test đặt trùng vitest đỏ và e2e đỏ (một response thành 500).
17. **`playwright-cli run-code`** chạy hàm trong sandbox không có `process` → đường dẫn ảnh phải viết thẳng vào chuỗi; lệnh tạo `.playwright-cli/` ở thư mục hiện tại.
18. **`GET /logout`** (resource route chỉ có action) trả 400: không đăng xuất được bằng link/ảnh.
19. **Lucide 1.56.0** có `UserRound`, `CircleAlert`, `Banknote`, `CreditCard`, `Clock`, `CircleX`, `RotateCcw`, `LogOut`, `ChevronRight`, `Phone`, `Check`, `ShieldCheck`.
20. **Dựng thử lại sau cổng plan M3:** vitest 184 (thêm 4 safeRedirect, 1 orders, 3 checkout, 2 auth); Playwright 13 chạy được trên **máy sạch** (đã xoá DB test trước khi chạy: đầu dò `/favicon.svg` không chạm DB, globalSetup tạo lại DB); test "2 khách tranh món cuối" chạy `--repeat-each=5` đều xanh; bỏ kiểm `//` trong `safeRedirect` thì e2e open redirect đỏ; `build/client` không chứa `SESSION_SECRET`, `ADMIN_PASSCODE`, `dev-only`, `e2e-ma-quan-tri`. Kiểu `ShouldRevalidateFunction` có trong export của `react-router` 8.4.

## Review Focus

Năm tình huống người dùng (hoặc kẻ xấu) sẽ gặp mà DoD không nêu thẳng, xếp theo khả năng xảy ra. Mỗi dòng có test ở task sở hữu code:

1. **Bấm "Đặt hàng" hai lần trên mạng chậm** (double tap, hoặc Back rồi gửi lại form) → chỉ một đơn, kho trừ một lần, cả hai lần bấm đều về cùng trang đơn (roadmap Review Focus 4). Test: Task 3 (`placeOrder` cùng `checkoutKey` song song + gửi lại sau đó), Task 5 (action song song cùng khoá → cùng `Location`), Task 7 (hai `fetch` POST song song đều là redirect + `dblclick`, DB có đúng 1 đơn).
2. **Kho âm hoặc tiền sai khi nhiều người cùng mua món cuối, món hết/đổi giá ngay sau khi khách xem trang, hoặc đơn có một món thiếu** → đúng một đơn thành công, đơn kia báo hết đúng món đó; đơn thiếu một món thì không trừ món nào; khách không bao giờ bị tính khác tổng đã thấy trên nút; huỷ hai lần chỉ hoàn kho một lần. Test: Task 3 (tranh món cuối, rollback cả đơn, tổng lệch, huỷ song song), Task 5 (giá đổi / món vừa hết giữa loader và action → 409), Task 7 (hai trình duyệt bấm cùng lúc).
3. **Người lạ mở link `/orders/DH…` hay `/checkout/pay/DH…` của người khác (IDOR)**, đoán mã, hoặc thử huỷ đơn người khác → chỉ thấy form nhập SĐT, không lộ tên/SĐT/địa chỉ, mã không tồn tại trông y hệt, POST huỷ trả 404, cổng thanh toán chuyển về trang đơn. Test: Task 6 (`order.test.ts`, khối `/checkout/pay/:code`), Task 7 (e2e IDOR).
4. **Dò OTP / passcode quản trị** (sai liên tục, phát lại cookie cũ để `tries` về 0, dùng mã của số này cho số khác, nhập đúng sau khi đã sai 5 lần, xin OTP cho SĐT admin lúc dòng admin chưa tồn tại) → bị chặn; admin không bao giờ thấy OTP; tài khoản admin không vào được bằng OTP; thiếu `ADMIN_PASSCODE` thì admin không vào được. Test: Task 4 (`auth.server.test.ts`), Task 1 (env fail-closed), Task 7 (e2e admin), Task 8 (server không đặt `DEMO_OTP`/`ADMIN_PASSCODE`).
5. **Link đăng nhập bị chèn `redirectTo` ra ngoài (open redirect)** như `//evil.test`, `/\evil.test`, `/%09/evil.test`, và dạng dấu chấm `/.//evil.test` (người đã đăng nhập bị chuyển đi ngay, không cần bấm gì) → về trang chủ của shop. Test: Task 2 (`safeRedirect` 14 ca), Task 7 (e2e `/login?redirectTo=//evil.test` khi chưa đăng nhập và `/login?redirectTo=/.//evil.test` khi đã đăng nhập).

## File Structure

| File | Trách nhiệm |
|---|---|
| `prisma/test-db.ts` | `TEST_DATABASE_URL` + globalSetup tạo/migrate/xoá sạch/seed `chosang_test` (vitest + Playwright) |
| `vitest.config.ts`, `tsconfig.json` | globalSetup + `test.env`; `allowImportingTsExtensions` |
| `.env.example`, `.env`, `.gitignore` | `DEMO_OTP`, `ADMIN_PASSCODE`; bỏ qua `test-results/`, `playwright-report/` |
| `app/lib/env.server.ts` (+test) | `env.DEMO_OTP`, `env.ADMIN_PASSCODE`, chặn secret <32 và passcode yếu ở production |
| `app/lib/config.ts` | `DELIVERY_SLOTS`, `SLOT_CAPACITY`, `ADMIN_PHONE` |
| `prisma/seed.ts` | Upsert tài khoản admin demo |
| `app/lib/security.server.ts` (+test) | `readForm()` (Origin + trần body), `safeRedirect()` |
| `app/lib/cart.ts`, `cart.server.ts` (+tests), `app/routes/cart.ts` (+test) | `CartLine.isWeighed`; `/cart` đi qua `readForm` |
| `app/root.tsx` | Root loader: giỏ, gợi ý khi giỏ trống, user, flash toast; `<FlashToast />` |
| `app/components/cart-drawer.tsx` | Giỏ trống: rổ 0% + 3 món khuyến mãi có + |
| `prisma/schema.prisma`, `prisma/migrations/20261015120000_order_checkout_key/` | Cột `Order.checkoutKey` unique |
| `app/lib/delivery.ts` (+test) | Giờ VN, khung giờ giao (đã qua/đã kín), nhãn giờ |
| `app/lib/orders.server.ts` (+test) | `placeOrder`, `cancelOrder`, `setOnlinePayment`, `takenSlots`, `checkoutPrefill`, `getOrder`, `findOrderForPhone`, `reorderQuantities`, `toOrderView`, `listOrders` |
| `app/lib/session.server.ts` | Cookie `__session`, `addGuestOrder`, `canViewOrder`, `getUser`, `requireAdmin` |
| `app/lib/auth.server.ts` (+test) | OTP (HMAC), passcode admin + khoá theo SĐT, `signIn` (tạo user + gắn đơn) |
| `app/lib/forms.server.ts` (+test) | zod: `parsePhone`, `parseCheckoutForm` |
| `app/components/field.tsx`, `toast.tsx` | Field có label + lỗi inline; toast (DEMO) + `FlashToast` |
| `app/components/site-header.tsx` | Icon tài khoản/đăng nhập |
| `app/routes/login.tsx`, `logout.ts` | OTP 2 bước / passcode admin; đăng xuất POST |
| `app/routes/checkout.tsx` (+test) | Trang checkout 1 trang + action đặt hàng |
| `app/routes/checkout-pay.tsx` | Cổng thanh toán giả lập |
| `app/routes/order.tsx`, `orders.tsx` (+`order.test.ts`) | Trang đơn (timeline, huỷ, mua lại, hotline, lưu vào tài khoản), danh sách + tra cứu |
| `app/routes.ts` | 6 route mới |
| `playwright.config.ts`, `e2e/helpers.ts`, `e2e/{checkout,auth,cart}.spec.ts` | E2E trên bản build production + DB test |

---

### Task 1: DB test `chosang_test`, biến môi trường M3, tài khoản admin demo

**Files:**
- Create: `prisma/test-db.ts`
- Modify: `app/lib/env.server.ts`, `app/lib/env.server.test.ts`, `app/lib/config.ts`, `prisma/seed.ts`, `vitest.config.ts`, `tsconfig.json`, `.env.example`, `.env`

**Interfaces:**
- Consumes: `required()`, `env.SESSION_SECRET`, `env.COOKIE_SECURE` (M0/M2); `pg` (đã cài)
- Produces:
  - `env.DEMO_OTP: boolean` (`process.env.DEMO_OTP === "1"`), `env.ADMIN_PASSCODE: string` (rỗng = admin bị khoá)
  - `config.ts`: `DELIVERY_SLOTS: string[]`, `SLOT_CAPACITY = 20`, `ADMIN_PHONE = "0909000000"`
  - `prisma/test-db.ts`: `export const TEST_DATABASE_URL: string`; `export default async function resetTestDb(): Promise<void>` (globalSetup)
  - DB test có seed + `User { phone: "0909000000", role: "admin" }`; vitest chạy với `DATABASE_URL = TEST_DATABASE_URL`, `DEMO_OTP = "1"`, `ADMIN_PASSCODE = "test-ma-quan-tri-2026"`

- [ ] **Step 1: Viết test fail cho env**

Thay **toàn bộ** `app/lib/env.server.test.ts` bằng (test "cookie Secure" đổi sang secret ≥32 ký tự vì production giờ chặn secret ngắn):
```ts
import { afterEach, expect, test, vi } from "vitest";
import { env, required } from "~/lib/env.server";

const saved = { DEMO_OTP: process.env.DEMO_OTP, ADMIN_PASSCODE: process.env.ADMIN_PASSCODE };

const reload = () => {
  vi.resetModules();
  return import("~/lib/env.server");
};

afterEach(() => {
  process.env.SESSION_SECRET = env.SESSION_SECRET;
  process.env.NODE_ENV = "test";
  delete process.env.INSECURE_COOKIES;
  // gán undefined sẽ thành chuỗi "undefined" (spike M2, mục 7): biến không có thì xoá
  for (const [key, value] of Object.entries(saved)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  vi.resetModules();
});

test("required báo lỗi tiếng Việt khi thiếu biến", () => {
  expect(() => required("__CHO_SANG_KHONG_CO__")).toThrow(
    "__CHO_SANG_KHONG_CO__ chưa được đặt, hãy copy .env.example thành .env",
  );
});

test("required trả giá trị khi có", () => {
  process.env.__CHO_SANG_CO__ = "x";
  expect(required("__CHO_SANG_CO__")).toBe("x");
});

test("thiếu SESSION_SECRET thì báo đúng lỗi tiếng Việt của required()", async () => {
  process.env.SESSION_SECRET = ""; // rỗng: loadEnvFile không ghi đè biến đã có
  await expect(reload()).rejects.toThrow("SESSION_SECRET chưa được đặt, hãy copy .env.example thành .env");
});

test("production không nhận secret mẫu dev-only", async () => {
  process.env.NODE_ENV = "production";
  process.env.SESSION_SECRET = "dev-only-doi-chuoi-nay-khi-deploy";
  await expect(reload()).rejects.toThrow("SESSION_SECRET đang là giá trị mẫu");
});

test("cookie Secure ở production, chỉ tắt được bằng INSECURE_COOKIES=1 (demo http trong LAN)", async () => {
  process.env.NODE_ENV = "production";
  process.env.SESSION_SECRET = "chuoi-ngau-nhien-that-dai-hon-32-ky-tu";
  expect((await reload()).env.COOKIE_SECURE).toBe(true);
  process.env.INSECURE_COOKIES = "1";
  expect((await reload()).env.COOKIE_SECURE).toBe(false);
});

test("production: SESSION_SECRET ngắn hơn 32 ký tự bị từ chối", async () => {
  process.env.NODE_ENV = "production";
  process.env.SESSION_SECRET = "a".repeat(31);
  await expect(reload()).rejects.toThrow("SESSION_SECRET phải dài ít nhất 32 ký tự");
  process.env.SESSION_SECRET = "a".repeat(32);
  await expect(reload()).resolves.toBeDefined();
});

test("production: ADMIN_PASSCODE mẫu dev-only hoặc ngắn hơn 12 ký tự bị từ chối", async () => {
  process.env.NODE_ENV = "production";
  process.env.SESSION_SECRET = "b".repeat(32);
  process.env.ADMIN_PASSCODE = "dev-only-ma-quan-tri";
  await expect(reload()).rejects.toThrow("ADMIN_PASSCODE phải dài ít nhất 12 ký tự");
  process.env.ADMIN_PASSCODE = "ngan-qua";
  await expect(reload()).rejects.toThrow("ADMIN_PASSCODE phải dài ít nhất 12 ký tự");
  process.env.ADMIN_PASSCODE = ""; // không đặt: admin bị khoá (fail-closed), app vẫn chạy
  expect((await reload()).env.ADMIN_PASSCODE).toBe("");
});

test("DEMO_OTP chỉ bật khi đúng bằng \"1\" (fail-closed)", async () => {
  for (const [value, on] of [["1", true], ["true", false], ["0", false], ["", false]] as const) {
    process.env.DEMO_OTP = value;
    expect((await reload()).env.DEMO_OTP).toBe(on);
  }
});
```

Run: `npx vitest run app/lib/env.server.test.ts`. Expected: FAIL 3 test mới ("promise resolved … instead of rejecting" ở 2 test production, `DEMO_OTP` là `undefined`); 5 test cũ PASS.

- [ ] **Step 2: `env.server.ts` + `.env.example` + `.env`**

Thay **toàn bộ** `app/lib/env.server.ts` bằng:
```ts
// Dev: đọc .env (biến đã có trong môi trường được giữ nguyên). Production truyền env thật.
try {
  process.loadEnvFile();
} catch {}

export function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} chưa được đặt, hãy copy .env.example thành .env`);
  return value;
}

export const env = {
  DATABASE_URL: required("DATABASE_URL"),
  UPLOAD_DIR: process.env.UPLOAD_DIR || "uploads",
  SESSION_SECRET: required("SESSION_SECRET"), // ký cookie `cart` (M2) và `__session` (M3)
  // Secure ở production (spec). INSECURE_COOKIES=1 chỉ cho demo bản build qua http:// trong LAN:
  // điện thoại không lưu cookie Secure từ http, giỏ sẽ "tự quay về" sau mỗi lần bấm mà không báo lỗi gì.
  COOKIE_SECURE: process.env.NODE_ENV === "production" && process.env.INSECURE_COOKIES !== "1",
  // OTP giả lập (mã hiện trên màn hình, nhãn DEMO). Chỉ bật khi đúng "1"; thiếu hay giá trị khác là tắt (fail-closed)
  DEMO_OTP: process.env.DEMO_OTP === "1",
  // Mã cho SĐT admin. Rỗng = không admin nào đăng nhập được (fail-closed)
  ADMIN_PASSCODE: process.env.ADMIN_PASSCODE ?? "",
};

if (process.env.NODE_ENV === "production") {
  // Giá trị mẫu trong .env.example ai cũng đọc được: chạy production với nó là giả được cookie (kể cả phiên admin)
  if (env.SESSION_SECRET.startsWith("dev-only")) {
    throw new Error("SESSION_SECRET đang là giá trị mẫu, hãy đặt chuỗi ngẫu nhiên (openssl rand -hex 32)");
  }
  if (env.SESSION_SECRET.length < 32) {
    throw new Error("SESSION_SECRET phải dài ít nhất 32 ký tự (openssl rand -hex 32)");
  }
  if (env.ADMIN_PASSCODE && (env.ADMIN_PASSCODE.length < 12 || env.ADMIN_PASSCODE.startsWith("dev-only"))) {
    throw new Error("ADMIN_PASSCODE phải dài ít nhất 12 ký tự và không phải giá trị mẫu dev-only");
  }
}
```

Thêm vào cuối `.env.example`:
```
# Đăng nhập khách bằng OTP giả lập: mã hiện trên màn hình kèm nhãn DEMO, không gửi SMS. Không đặt = tắt (fail-closed)
DEMO_OTP=1
# Mã quản trị cho SĐT admin (seed: 0909000000). Không đặt = admin không đăng nhập được. Production: ≥12 ký tự, không dùng giá trị dev-only
ADMIN_PASSCODE=dev-only-ma-quan-tri
```

Thêm vào `.env` local (không đụng dòng khác; passcode ngẫu nhiên, đọc lại trong `.env` khi cần đăng nhập admin bằng tay):
```bash
[ -z "$(tail -c1 .env)" ] || echo >> .env   # bảo đảm .env kết thúc bằng xuống dòng
grep -q '^DEMO_OTP=' .env || echo 'DEMO_OTP=1' >> .env
grep -q '^ADMIN_PASSCODE=' .env || echo "ADMIN_PASSCODE=$(openssl rand -hex 8)" >> .env
grep -cE '^(DEMO_OTP|ADMIN_PASSCODE)=' .env
```
Expected: `2`.

Run: `npx vitest run app/lib/env.server.test.ts`. Expected: PASS (8 tests).

- [ ] **Step 3: Hằng số + tài khoản admin trong seed**

Thêm vào cuối `app/lib/config.ts`:
```ts

// Khung giờ giao (giờ Việt Nam). Mỗi khung nhận tối đa SLOT_CAPACITY đơn chưa huỷ (spec mục 5).
export const DELIVERY_SLOTS = ["08:00–10:00", "10:00–12:00", "14:00–16:00", "17:00–19:00"];
export const SLOT_CAPACITY = 20;
// SĐT quản trị demo (seed tạo User role admin). Đăng nhập bằng ADMIN_PASSCODE, không bao giờ qua OTP (spec mục 2).
export const ADMIN_PHONE = "0909000000";
```

Trong `prisma/seed.ts`, thêm import (ngay trên dòng `import { env } from "~/lib/env.server";`):
```ts
import { ADMIN_PHONE } from "~/lib/config";
```
và thay dòng `console.log` "Seed xong: …" ở cuối file bằng:
```ts
// Tài khoản quản trị demo: chỉ đăng nhập được bằng ADMIN_PASSCODE, không bao giờ qua OTP (spec mục 2)
await db.user.upsert({
  where: { phone: ADMIN_PHONE },
  update: { role: "admin" },
  create: { phone: ADMIN_PHONE, role: "admin", name: "Chủ shop (demo)" },
});

console.log(`Seed xong: ${categories.length} danh mục, ${products.length + 1} sản phẩm, 1 tài khoản quản trị.`);
```
(Đây không phải field lấy từ catalog nên không liên quan object `update` của sản phẩm.)

Chạy seed trên DB dev (upsert, không phá dữ liệu):
```bash
npx prisma db seed 2>&1 | grep 'Seed xong'
docker compose exec -T db psql -U chosang -d chosang -tAc "select phone || ' ' || role from \"User\" where role = 'admin'"
```
Expected: `Seed xong: 6 danh mục, 41 sản phẩm, 1 tài khoản quản trị.`; `0909000000 admin`.

- [ ] **Step 4: DB test + vitest dùng DB test**

`prisma/test-db.ts`:
```ts
import { execFileSync } from "node:child_process";
import pg from "pg";

/**
 * DB riêng cho vitest + Playwright: database thứ hai `chosang_test` trong CÙNG container Postgres.
 * Đơn và kho của test không bao giờ chạm DB dev (đơn test không hiện trong admin lúc pitch).
 */
const TEST_DB = "chosang_test";

try {
  process.loadEnvFile(); // DATABASE_URL của dev: chỉ để lấy host/user/mật khẩu
} catch {}
const devUrl = new URL(process.env.DATABASE_URL ?? "postgresql://chosang:chosang@localhost:5432/chosang");
const testUrl = new URL(devUrl);
testUrl.pathname = `/${TEST_DB}`;
export const TEST_DATABASE_URL = testUrl.href;

const bin = (name: string) => `node_modules/.bin/${name}`;

/**
 * globalSetup của vitest và Playwright: tạo DB nếu chưa có → migrate deploy → xoá sạch → seed.
 * Không dùng lệnh reset của Prisma. Chỉ TRUNCATE sau khi chính Postgres xác nhận đang nối tới chosang_test.
 */
export default async function resetTestDb() {
  const server = new pg.Client({ connectionString: devUrl.href });
  await server.connect();
  try {
    const { rowCount } = await server.query("SELECT 1 FROM pg_database WHERE datname = $1", [TEST_DB]);
    if (!rowCount) await server.query(`CREATE DATABASE "${TEST_DB}"`); // không phá gì: chỉ thêm database
  } finally {
    await server.end();
  }

  const env = { ...process.env, DATABASE_URL: TEST_DATABASE_URL };
  execFileSync(bin("prisma"), ["migrate", "deploy"], { env, stdio: "pipe" }); // im lặng; lỗi thì stderr nằm trong Error

  const db = new pg.Client({ connectionString: TEST_DATABASE_URL });
  await db.connect();
  try {
    const { rows } = await db.query<{ name: string }>("SELECT current_database() AS name");
    if (rows[0].name !== TEST_DB) throw new Error(`Từ chối xoá dữ liệu: đang nối tới "${rows[0].name}", không phải ${TEST_DB}`);
    await db.query('TRUNCATE "OrderItem", "Order", "GiftBundle", "User", "Product", "Category" RESTART IDENTITY CASCADE');
  } finally {
    await db.end();
  }
  execFileSync(bin("tsx"), ["prisma/seed.ts"], { env, stdio: "pipe" });
}
```

Thay **toàn bộ** `vitest.config.ts` bằng:
```ts
import { defineConfig } from "vitest/config";
import { TEST_DATABASE_URL } from "./prisma/test-db.ts";

export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    include: ["app/**/*.test.ts", "prisma/**/*.test.ts"],
    fileParallelism: false, // một DB test chung: test đơn hàng/kho ghi DB, không chạy song song
    globalSetup: "./prisma/test-db.ts", // tạo + migrate + xoá sạch + seed chosang_test trước mỗi lần chạy
    // Không phụ thuộc .env của từng máy: DB test, OTP demo bật, mã quản trị cố định cho test
    env: { DATABASE_URL: TEST_DATABASE_URL, DEMO_OTP: "1", ADMIN_PASSCODE: "test-ma-quan-tri-2026" },
  },
});
```

Trong `tsconfig.json`, thêm ngay dưới dòng `"verbatimModuleSyntax": true,`:
```json
    "allowImportingTsExtensions": true,
```

Ghi lại số đơn/user của DB dev **trước** khi chạy test (để chứng minh test không chạm DB dev):
```bash
for q in 'select count(*) from "Order"' 'select count(*) from "User"' 'select sum(stock) from "Product"'; do
  docker compose exec -T db psql -U chosang -d chosang -tAc "$q"
done | paste -sd' '
```
Ghi dòng kết quả ra (hiện tại `0 1 1653`).

Run: `npm test`. Expected: PASS **91** test (88 cũ + 3 env); không có dòng "Loaded Prisma config" lẫn vào output. Lần đầu globalSetup tạo `chosang_test`.

Kiểm:
```bash
docker compose exec -T db psql -U chosang -d chosang_test -tAc 'select count(*) from "Product"'
docker compose exec -T db psql -U chosang -d chosang_test -tAc "select phone || ' ' || role from \"User\""
for q in 'select count(*) from "Order"' 'select count(*) from "User"' 'select sum(stock) from "Product"'; do
  docker compose exec -T db psql -U chosang -d chosang -tAc "$q"
done | paste -sd' '
npm test 2>&1 | grep -E "Tests "
```
Expected: `41`; `0909000000 admin`; dòng thứ ba **giống hệt** con số đã ghi; lần chạy thứ hai vẫn `91 passed` (nhánh "DB đã có").

- [ ] **Step 5: Checkpoint**: `npm run typecheck && npm test`. Expected: sạch, **91** test.

---

### Task 2: Cổng an toàn cho POST (`readForm`, `safeRedirect`), `isWeighed`, giỏ trống gợi ý 3 món

**Files:**
- Create: `app/lib/security.server.ts`, `app/lib/security.server.test.ts`
- Modify: `app/routes/cart.ts`, `app/routes/cart.test.ts`, `app/lib/cart.ts`, `app/lib/cart.test.ts`, `app/lib/cart.server.ts`, `app/lib/cart.server.test.ts`, `app/root.tsx` (chỉ loader + import), `app/components/cart-drawer.tsx`

**Interfaces:**
- Consumes: `parseCartForm`, `getCartView`, `readCart` (M2), `listPromotions(limit)` + `ProductCardData` (M1), `FreeshipBasket`, `CartControl`, `ProductImage` (M2)
- Produces:
  - `MAX_FORM_BYTES = 16 * 1024`
  - `readForm(request: Request, maxBytes?: number): Promise<FormData>` (ném `Response` 403 khi khác origin, 413 khi vượt trần)
  - `safeRedirect(to: FormDataEntryValue | null | undefined, fallback?: string): string`
  - `CartLine.isWeighed: boolean` (`getCartView` trả thêm field này)
  - root loader → `{ cart: { lines: CartLine[] }, suggestions: ProductCardData[] }` (Task 4 thêm `user`, `toast`)

- [ ] **Step 1: Viết test fail cho `readForm` / `safeRedirect`**

`app/lib/security.server.test.ts`:
```ts
import { describe, expect, test } from "vitest";
import { readForm, safeRedirect } from "~/lib/security.server";

const post = (body: BodyInit | null, headers: Record<string, string> = {}) =>
  new Request("http://localhost:5173/checkout", { method: "POST", body, headers, duplex: "half" } as RequestInit);
const statusOf = (p: Promise<unknown>) => p.then(() => "ok", (e: Response) => e.status);

describe("readForm", () => {
  test("cùng origin: đọc được form, giữ dấu tiếng Việt", async () => {
    const form = await readForm(post(new URLSearchParams({ name: "Lê Thị Đào" }), { Origin: "http://localhost:5173" }));
    expect(form.get("name")).toBe("Lê Thị Đào");
  });
  test("Origin trang khác bị chặn 403 (kể cả khi cùng host khác cổng)", async () => {
    expect(await statusOf(readForm(post("a=1", { Origin: "http://evil.test" })))).toBe(403);
    expect(await statusOf(readForm(post("a=1", { Origin: "http://localhost:3000" })))).toBe(403);
  });
  test("không có Origin: Sec-Fetch-Site cross-site/same-site bị chặn, same-origin/none cho qua", async () => {
    expect(await statusOf(readForm(post("a=1", { "Sec-Fetch-Site": "cross-site" })))).toBe(403);
    expect(await statusOf(readForm(post("a=1", { "Sec-Fetch-Site": "same-site" })))).toBe(403);
    expect(await statusOf(readForm(post("a=1", { "Sec-Fetch-Site": "same-origin" })))).toBe("ok");
    expect(await statusOf(readForm(post("a=1", { "Sec-Fetch-Site": "none" })))).toBe("ok");
  });
  test("client không phải trình duyệt (không Origin, không Sec-Fetch-Site) cho qua", async () => {
    const form = await readForm(post("a=1", { "Content-Type": "application/x-www-form-urlencoded" }));
    expect(form.get("a")).toBe("1");
  });
  test("body vượt 16KB bị chặn 413, kể cả gửi chunked không có Content-Length", async () => {
    expect(await statusOf(readForm(post(`a=${"x".repeat(17 * 1024)}`)))).toBe(413);
    const stream = new ReadableStream({
      start(c) {
        for (let i = 0; i < 40; i++) c.enqueue(new TextEncoder().encode("x".repeat(1000)));
        c.close();
      },
    });
    expect(await statusOf(readForm(post(stream)))).toBe(413);
    expect(await statusOf(readForm(post(`a=${"x".repeat(30 * 1024)}`), 64 * 1024))).toBe("ok"); // trần riêng (M4)
  });
  test("body rác hoặc rỗng thành form rỗng, không ném lỗi", async () => {
    expect([...(await readForm(post("rác", { "Content-Type": "multipart/form-data; boundary=zz" })))]).toEqual([]);
    expect([...(await readForm(post(null)))]).toEqual([]);
  });
});

describe("safeRedirect (chống open redirect)", () => {
  test.each([
    ["/orders/DH261015ABCD?x=1#a", "/orders/DH261015ABCD?x=1#a"],
    ["//evil.test", "/"],
    ["/\\evil.test", "/"],
    ["/\t/evil.test", "/"],
    ["/\n/evil.test", "/"],
    ["https://evil.test/", "/"],
    ["javascript:alert(1)", "/"],
    ["orders", "/"],
    ["", "/"],
    ["/.//evil.test", "/"], // chuẩn hoá dấu chấm ra "//evil.test" (cổng M3)
    ["/..//evil.test", "/"],
    ["/%2e//evil.test", "/"],
    ["/x/../\\evil.test", "/"],
  ])("%j → %j", (input, expected) => {
    expect(safeRedirect(input)).toBe(expected);
  });
  test("null/không có thì về fallback", () => {
    expect(safeRedirect(null, "/orders")).toBe("/orders");
  });
});
```

Run: `npx vitest run app/lib/security.server.test.ts`. Expected: FAIL (module `~/lib/security.server` chưa có).

- [ ] **Step 2: `app/lib/security.server.ts`**

```ts
/** Trần body của một form POST. M4 (/gift, ảnh preview ≤60KB) truyền trần lớn hơn qua tham số. */
export const MAX_FORM_BYTES = 16 * 1024;

/**
 * Cổng vào của MỌI action POST (spec: kiểm Origin + giới hạn body).
 * 1. Chặn request từ trang khác (CSRF). RR 8.4 tự kiểm Origin cho route có UI nhưng KHÔNG kiểm resource route
 *    như /cart, /logout (spike M3). Không có cả Origin lẫn Sec-Fetch-Site = không phải trình duyệt (curl, test): cho qua.
 * 2. Đọc body theo luồng và dừng ngay khi vượt trần, nên body chunked không có Content-Length cũng bị chặn.
 * Sai thì ném Response 403/413 (RR đưa lên ErrorBoundary; chỉ kẻ tấn công mới gặp).
 */
export async function readForm(request: Request, maxBytes = MAX_FORM_BYTES): Promise<FormData> {
  const origin = request.headers.get("Origin");
  const site = request.headers.get("Sec-Fetch-Site");
  const crossSite = origin
    ? origin !== new URL(request.url).origin
    : site !== null && site !== "same-origin" && site !== "none";
  if (crossSite) throw new Response("Yêu cầu từ trang khác bị chặn.", { status: 403 });

  const reader = request.body?.getReader();
  const chunks: Uint8Array<ArrayBuffer>[] = [];
  let size = 0;
  while (reader) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > maxBytes) {
      void reader.cancel();
      throw new Response("Dữ liệu gửi lên quá lớn.", { status: 413 });
    }
    chunks.push(value);
  }
  const type = request.headers.get("Content-Type") ?? "";
  return new Response(new Blob(chunks), { headers: { "Content-Type": type } }).formData().catch(() => new FormData());
}

/**
 * `redirectTo` chỉ nhận đường dẫn nội bộ. Dùng chính bộ phân tích URL của trình duyệt nên "//host", "/\host",
 * "/<tab>/host" (trình duyệt bỏ tab rồi hiểu thành "//host") đều về `fallback` (chống open redirect).
 * Kết quả còn bị kiểm lần nữa: "/.//host", "/..//host", "/%2e//host" chuẩn hoá xong thành "//host" (cổng M3).
 */
export function safeRedirect(to: FormDataEntryValue | null | undefined, fallback = "/"): string {
  if (typeof to !== "string" || !to.startsWith("/")) return fallback;
  const url = new URL(to, "http://n");
  const path = url.pathname + url.search + url.hash;
  return url.origin === "http://n" && !path.startsWith("//") ? path : fallback;
}
```

Run: `npx vitest run app/lib/security.server.test.ts`. Expected: PASS (20 tests: readForm 6, safeRedirect 13 + 1). Bốn ca dấu chấm (`/.//evil.test`, …) là của cổng plan M3: bản không có `!path.startsWith("//")` để lọt chúng.

- [ ] **Step 3: `/cart` đi qua `readForm` (resource route: RR không tự kiểm Origin)**

Thêm vào cuối `app/routes/cart.test.ts`:
```ts

test("POST từ trang khác bị chặn 403, cookie không đổi (CSRF trên resource route)", async () => {
  const res = await action({
    request: new Request("http://localhost/cart", {
      method: "POST",
      body: new URLSearchParams([["intent", "set"], ["pid", "7"], ["qty", "3"]]),
      headers: { Origin: "http://evil.test" },
    }),
  } as Parameters<typeof action>[0]).catch((e: Response) => e);
  expect(res).toBeInstanceOf(Response);
  expect((res as Response).status).toBe(403);
});
```
Run: `npx vitest run app/routes/cart.test.ts`. Expected: FAIL ("expected { data: { error: null }, … } to be an instance of Response").

Trong `app/routes/cart.ts`: thêm import (dưới dòng `import { CART_MAX_LINES } from "~/lib/config";`):
```ts
import { readForm } from "~/lib/security.server";
```
và đổi dòng
```ts
  const changes = parseCartForm(await request.formData().catch(() => new FormData()));
```
thành
```ts
  const changes = parseCartForm(await readForm(request)); // chặn POST từ trang khác + giới hạn body
```
Run: `npx vitest run app/routes/cart.test.ts`. Expected: PASS (6 tests).

- [ ] **Step 4: `CartLine.isWeighed` (nhãn "Giá tạm tính, cân thực tế ±10%" ở checkout)**

`app/lib/cart.ts`, trong `type CartLine`, thêm ngay dưới `stock: number;`:
```ts
  isWeighed: boolean; // hàng cân ký: checkout ghi "Giá tạm tính, cân thực tế ±10%"
```

`app/lib/cart.test.ts`, trong helper `line(...)`, thêm ngay dưới dòng `  stock,`:
```ts
  isWeighed: false,
```

`app/lib/cart.server.test.ts`, đổi dòng
```ts
    expect(lines[1]).toMatchObject({ priceVnd: 15000, unit: "bó ~300g", image: "products/rau-muong" });
```
thành
```ts
    expect(lines[1]).toMatchObject({ priceVnd: 15000, unit: "bó ~300g", isWeighed: true, image: "products/rau-muong" });
```
Run: `npx vitest run app/lib/cart.server.test.ts`. Expected: FAIL ở test `getCartView` (thiếu `isWeighed`).

`app/lib/cart.server.ts`, trong `getCartView`: đổi `select` thành
```ts
    select: { id: true, slug: true, name: true, unit: true, priceVnd: true, stock: true, isWeighed: true, images: true },
```
và thay khối
```ts
      return p
        ? [{ id: p.id, slug: p.slug, name: p.name, unit: p.unit, priceVnd: p.priceVnd, stock: p.stock, image: p.images[0], qty }]
        : [];
```
bằng
```ts
      if (!p) return [];
      const { images, ...fields } = p;
      return [{ ...fields, image: images[0], qty }];
```
Run: `npx vitest run app/lib/cart.server.test.ts app/lib/cart.test.ts`. Expected: PASS.

- [ ] **Step 5: Giỏ trống: rổ 0% + 3 món khuyến mãi có nút + (quyết định Designer ở cổng M2)**

Trong `app/root.tsx`: thêm import (dưới dòng `import { getCartView, readCart } from "./lib/cart.server";`):
```ts
import { listPromotions } from "./lib/catalog.server";
```
và thay khối loader (cả dòng chú thích phía trên) bằng:
```ts
// Giỏ (đã ghép giá DB) cho header, thẻ và drawer: SSR có sẵn, drawer mở tức thì. Revalidate sau mỗi action /cart.
// Giỏ trống thì kèm 3 món khuyến mãi cho drawer (quyết định Designer ở cổng M2); giỏ có hàng thì không tốn query.
export async function loader({ request }: Route.LoaderArgs) {
  const cart = await getCartView(await readCart(request));
  return { cart, suggestions: cart.lines.length === 0 ? await listPromotions(3) : [] };
}
```

Thay **toàn bộ** `app/components/cart-drawer.tsx` bằng (chỉ khối giỏ trống và phần import thay đổi so với M2):
```tsx
import { Trash2, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link, useLocation, useRouteLoaderData } from "react-router";
import type { CartLine } from "~/lib/cart";
import { FREESHIP_FROM_VND } from "~/lib/config";
import { formatVnd } from "~/lib/format";
import { useCart } from "~/lib/use-cart";
import type { loader as rootLoader } from "~/root";
import { CartControl } from "./cart-control";
import { FreeshipBasket } from "./freeship-basket";
import { ProductImage } from "./product-image";

const UNDO_MS = 5000;

/** Drawer giỏ: <dialog> gốc, showModal() cho sẵn focus trap + Esc. Mở từ nút #cart-button ở header. */
export function CartDrawer() {
  const ref = useRef<HTMLDialogElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const { lines, count, totals, error, setQty } = useCart();
  const suggestions = useRouteLoaderData<typeof rootLoader>("root")?.suggestions ?? []; // chỉ có khi giỏ trống
  const [undo, setUndo] = useState<{ id: number; name: string; qty: number } | null>(null);
  const location = useLocation();
  const free = lines.length > 0 && totals.toFreeshipVnd === 0;
  const close = () => ref.current?.close();

  // Bấm link trong drawer (tên món, "Xem sản phẩm", "Thanh toán") thì đóng khi trang mới về
  useEffect(() => {
    ref.current?.close();
  }, [location.key]);

  useEffect(() => {
    if (!undo) return;
    const timer = setTimeout(() => setUndo(null), UNDO_MS);
    return () => clearTimeout(timer);
  }, [undo]);

  const remove = (line: CartLine) => {
    setUndo({ id: line.id, name: line.name, qty: line.qty });
    void setQty(line.id, 0);
  };

  return (
    <dialog
      ref={ref}
      id="cart-drawer"
      aria-labelledby="cart-drawer-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) close(); // bấm vào nền mờ
      }}
      className="fixed inset-y-0 right-0 left-auto m-0 h-dvh max-h-none w-full max-w-md translate-x-full overflow-hidden bg-surface p-0 text-ink transition-[translate,overlay,display] duration-150 ease-snappy transition-discrete backdrop:bg-ink/40 open:translate-x-0 open:duration-200 starting:open:translate-x-full"
    >
      <div className="relative flex h-full flex-col">
        <div className="flex items-center justify-between border-b border-line py-1 pr-2 pl-4">
          <h2 id="cart-drawer-title" ref={titleRef} tabIndex={-1} className="text-xl focus-visible:outline-offset-[-2px]">
            Giỏ hàng{count > 0 && ` (${count})`}
          </h2>
          <button
            type="button"
            onClick={close}
            aria-label="Đóng giỏ hàng"
            className="inline-flex size-11 items-center justify-center rounded-full transition-colors duration-150 ease-snappy hover:bg-ink/5 focus-visible:outline-offset-[-2px]"
          >
            <X aria-hidden className="size-6" />
          </button>
        </div>

        {error && (
          <p role="alert" className="mx-4 mt-3 rounded-xl bg-ink/5 px-3 py-2 text-sm">
            {error}
          </p>
        )}

        {lines.length === 0 ? (
          // Giỏ trống: rổ thương hiệu ở 0% + 3 món khuyến mãi có nút + (quyết định Designer ở cổng M2)
          <div className="flex flex-1 flex-col overflow-y-auto">
            <FreeshipBasket subtotalVnd={0} toFreeshipVnd={FREESHIP_FROM_VND} />
            <h3 className="px-4 pt-4 text-lg">Giỏ hàng đang trống</h3>
            {suggestions.length > 0 && (
              <>
                <p className="px-4 text-sm text-ink-muted">Khuyến mãi hôm nay, bấm + để thêm ngay:</p>
                <ul className="divide-y divide-line px-4">
                  {suggestions.map((p) => (
                    <li key={p.id} className="flex items-center gap-3 py-3">
                      <div className="w-16 shrink-0 overflow-hidden rounded-xl border border-line">
                        <ProductImage image={p.images[0]} alt="" sizes="64px" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <Link to={`/products/${p.slug}`} className="line-clamp-2 text-sm hover:underline">
                          {p.name}
                        </Link>
                        <p className="text-xs text-ink-muted">
                          {p.unit} · <span className="font-display font-extrabold text-brand tabular-nums">{formatVnd(p.priceVnd)}</span>
                        </p>
                      </div>
                      <CartControl product={p} />
                    </li>
                  ))}
                </ul>
              </>
            )}
            <Link
              to="/collections/all"
              className="mx-auto my-4 inline-flex min-h-11 items-center text-sm underline underline-offset-4 transition-colors duration-150 ease-snappy hover:text-brand"
            >
              Xem tất cả sản phẩm
            </Link>
          </div>
        ) : (
          <>
            <FreeshipBasket subtotalVnd={totals.subtotalVnd} toFreeshipVnd={totals.toFreeshipVnd} />
            <ul className="flex-1 divide-y divide-line overflow-y-auto px-4">
              {lines.map((line) => (
                <li key={line.id} className="flex gap-3 py-3">
                  <div className={`w-16 shrink-0 self-start overflow-hidden rounded-xl border border-line ${line.stock === 0 ? "opacity-60 grayscale" : ""}`}>
                    <ProductImage image={line.image} alt="" sizes="64px" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <Link to={`/products/${line.slug}`} className="line-clamp-2 text-sm hover:underline">
                      {line.name}
                    </Link>
                    <p className="text-xs text-ink-muted tabular-nums">
                      {line.unit} · {formatVnd(line.priceVnd)}
                    </p>
                    {line.stock === 0 && <p className="text-xs text-ink-muted">Tạm hết hàng, không tính vào tổng</p>}
                    {/* flex-wrap: ở 375px stepper (≈128px) + tiền dòng ≥ "1.000.000₫" không vừa ≈211px */}
                    <div className="mt-1 flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
                      <CartControl product={line} min={1} />
                      <p className={`font-display font-extrabold tabular-nums ${line.stock === 0 ? "text-ink-muted line-through" : "text-brand"}`}>{formatVnd(line.priceVnd * line.qty)}</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => remove(line)}
                    aria-label={`Xoá ${line.name} khỏi giỏ`}
                    className="inline-flex size-11 shrink-0 items-center justify-center rounded-full text-ink-muted transition-colors duration-150 ease-snappy hover:bg-ink/5 hover:text-ink"
                  >
                    <Trash2 aria-hidden className="size-5" />
                  </button>
                </li>
              ))}
            </ul>
            <div className="order-2 space-y-1 border-t border-line p-4 text-sm">
              <p className="flex justify-between">
                <span>Tạm tính</span>
                <span className="tabular-nums">{formatVnd(totals.subtotalVnd)}</span>
              </p>
              <p className="flex justify-between">
                <span>Phí giao hàng</span>
                <span className={`tabular-nums ${free ? "font-display font-extrabold text-fresh" : ""}`}>{totals.shippingVnd === 0 ? "Miễn phí" : formatVnd(totals.shippingVnd)}</span>
              </p>
              {/* /checkout do M3 làm: trong M2 link này ra trang 404 (đã chấp nhận) */}
              <Link
                to="/checkout"
                className="mt-3 flex min-h-12 items-center justify-center rounded-full bg-brand px-6 text-base font-display font-extrabold text-surface transition-colors duration-150 ease-snappy hover:bg-brand-press"
              >
                Thanh toán · <span className="ml-1 tabular-nums">{formatVnd(totals.totalVnd)}</span>
              </Link>
            </div>
          </>
        )}
        {/* Luôn mount (role=status). order-1 chen giữa danh sách và khối tổng tiền (order-2): trong tầm ngón cái, không che dòng freeship */}
        <div role="status" className="pointer-events-none relative z-10 order-1">
          {undo && (
            <p className="pointer-events-auto absolute inset-x-4 bottom-2 flex items-center justify-between gap-2 rounded-full bg-ink py-0.5 pr-1 pl-4 text-sm text-surface shadow-lg">
              <span className="min-w-0 truncate">Đã xoá {undo.name}</span>
              <button
                type="button"
                autoFocus
                onClick={() => {
                  void setQty(undo.id, undo.qty);
                  setUndo(null);
                  titleRef.current?.focus(); // nút Hoàn tác biến mất: đưa focus về tiêu đề drawer
                }}
                className="min-h-11 shrink-0 rounded-full px-3 font-display font-extrabold underline underline-offset-2 transition-colors duration-150 ease-snappy hover:bg-surface/10"
              >
                Hoàn tác
              </button>
            </p>
          )}
        </div>
      </div>
    </dialog>
  );
}
```

Run: `npm run typecheck`. Expected: sạch.

- [ ] **Step 6: Checkpoint**: `npm run typecheck && npm test`. Expected: **112** test (91 + 20 security + 1 cart).

- [ ] **Step 7: Kiểm trên trình duyệt (dev server chỉ đọc DB dev, không ghi gì ngoài cookie giỏ)**

`npm run dev -- --port 5173 &`, `sleep 5`:
```bash
OUT=$PWD/.superpowers/sdd/2026-10-15-m3-checkout-orders-auth
mkdir -p "$OUT"
playwright-cli -s=m3 open http://localhost:5173/
playwright-cli -s=m3 resize 375 812
playwright-cli -s=m3 cookie-clear
playwright-cli -s=m3 reload
playwright-cli -s=m3 eval "async () => {
  const w = (ms) => new Promise((r) => setTimeout(r, ms));
  document.querySelector('#cart-button').click(); await w(400);
  const d = document.querySelector('#cart-drawer');
  return JSON.stringify({ text: d.innerText.replace(/\s+/g, ' ').slice(0, 160), adds: d.querySelectorAll('button[aria-label^=\"Thêm \"]').length });
}"
playwright-cli -s=m3 screenshot --filename="$OUT/task-2-drawer-empty-375.png"
playwright-cli -s=m3 eval "async () => {
  const d = document.querySelector('#cart-drawer');
  d.querySelector('button[aria-label^=\"Thêm \"]').click();
  await new Promise((r) => setTimeout(r, 1500));
  return d.querySelector('h2').textContent;
}"
playwright-cli -s=m3 resize 1280 800
playwright-cli -s=m3 screenshot --filename="$OUT/task-2-drawer-1280.png"
playwright-cli -s=m3 close
curl -s -o /dev/null -w '%{http_code}\n' -X POST -H 'Origin: http://evil.test' -d 'intent=set&pid=1&qty=1' localhost:5173/cart
```
Expected: `text` bắt đầu bằng `Giỏ hàng Còn 300.000₫ nữa được freeship Giỏ hàng đang trống Khuyến mãi hôm nay, bấm + để thêm ngay:`, `adds: 3`; sau khi bấm + thì `Giỏ hàng (1)`; curl trả `403`. Dừng dev server (PID cổng 5173), xoá `.playwright-cli/`.

---

### Task 3: Lõi đơn hàng: `checkoutKey`, khung giờ giao, `placeOrder` trong một transaction, huỷ, thanh toán giả lập

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/20261015120000_order_checkout_key/migration.sql` (sinh bằng `prisma migrate diff`)
- Create: `app/lib/delivery.ts`, `app/lib/delivery.test.ts`, `app/lib/orders.server.ts`, `app/lib/orders.server.test.ts`

**Interfaces:**
- Consumes: `cartTotals` (M2), `visible` (M2), `CART_MAX_QTY`, `DELIVERY_SLOTS`, `SLOT_CAPACITY` (Task 1), `db`, `Prisma`, enums `OrderStatus`, `PaymentMethod`, `PaymentStatus`
- Produces (hợp đồng cho Task 5, 6 và M4, M5):
  - `delivery.ts`: `vnDate(now: Date, addDays?: number): string` ("YYYY-MM-DD" giờ VN); `vnDateTimeLabel(d: Date): string` ("09:05 15/10"); `type SlotOption = { value: string; slot: string; disabled: boolean; reason: "past" | "full" | null }`; `type DeliveryDay = { date: string; label: string; slots: SlotOption[] }`; `deliveryDays(now: Date, taken: Record<string, number>): DeliveryDay[]`; `firstOpenSlot(days: DeliveryDay[]): string | null` (value dạng `"2026-10-16|08:00–10:00"`)
  - `orders.server.ts`:
    - `type OrderLineInput = { productId: number; qty: number; bundleId?: string | null }`
    - `type PlaceOrderInput = { checkoutKey: string; userId: number | null; customerName: string; phone: string; address: string; note: string; callOnSubstitute: boolean; deliveryDate: string; deliverySlot: string; paymentMethod: PaymentMethod; lines: OrderLineInput[]; expectedTotalVnd: number }` (`expectedTotalVnd` = tổng trên nút khách đã bấm)
    - `type OutOfStock = { productId: number; name: string; unit: string; available: number }`
    - `type PlaceOrderResult = { ok: true; code: string } | { ok: false; reason: "out-of-stock"; outOfStock: OutOfStock[] } | { ok: false; reason: "changed" }`
    - `placeOrder(input: PlaceOrderInput, now?: Date): Promise<PlaceOrderResult>` (thứ tự: tra `checkoutKey` → giỏ rỗng = `changed` → transaction: tổng trên MỌI dòng ≠ `expectedTotalVnd` = `changed` → tạo đơn → trừ kho → dòng đơn)
    - `newOrderCode(now: Date): string`, `aggregateQty(lines: { productId: number; qty: number }[]): Map<number, number>`
    - `cancelOrder(orderId: number, now?: Date): Promise<boolean>`
    - `type PaymentStep = "pay" | "fail" | "retry" | "cod"`, `isPaymentStep(v: unknown): v is PaymentStep`, `setOnlinePayment(orderId: number, step: PaymentStep): Promise<boolean>`
    - `takenSlots(now: Date): Promise<Record<string, number>>`
    - `checkoutPrefill(userId: number | undefined): Promise<{ name: string; phone: string; address: string } | null>`
    - `getOrder(code: string)` (đơn + items), `type OrderWithItems`
    - `findOrderForPhone(code: string, phone: string): Promise<{ code: string } | null>`
    - `reorderQuantities(orderId: number): Promise<Array<[number, number]>>`
    - `toOrderView(order: OrderWithItems)` → `{ code, status, statusLabel, createdAt, cancelledAt, timeline: { label: string; at: string | null }[] (4 bước), customerName, phone, address, note, callOnSubstitute, delivery, paymentMethod, paymentStatus, paymentLabel, items: { id, name, unit, priceVnd, qty }[], subtotalVnd, shippingVnd, totalVnd }`, `type OrderView`
    - `listOrders(where: { userId: number } | { codes: string[] }): Promise<{ code: string; createdAt: string; totalVnd: number; statusLabel: string; itemCount: number }[]>`

- [ ] **Step 1: Cột `checkoutKey` + migration (không phá dữ liệu, không `migrate dev`)**

Trong `prisma/schema.prisma`, model `Order`, thêm ngay dưới dòng `  code             String        @unique`:
```prisma
  checkoutKey      String?       @unique // khoá chống đặt trùng: một lần mở trang checkout = tối đa một đơn
```

Sinh SQL từ DB dev (chỉ đọc), xem lại, rồi áp dụng (Decision 3):
```bash
D=prisma/migrations/20261015120000_order_checkout_key
mkdir -p $D
npx prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --script -o $D/migration.sql
cat $D/migration.sql
```
Expected: **đúng** nội dung dưới đây (không có `DROP`, không đụng CHECK của M0). Nếu khác: dừng, xoá thư mục `$D`, báo lại; **không** tự sửa DB.
```sql
-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "checkoutKey" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Order_checkoutKey_key" ON "Order"("checkoutKey");
```
```bash
npx prisma migrate deploy 2>&1 | tail -1
npx prisma generate 2>&1 | tail -1
npx prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --exit-code > /dev/null; echo "diff exit: $?"
```
Expected: `All migrations have been successfully applied.`; generate thành công; `diff exit: 0`. (DB test nhận migration ở lần `npm test` tới, qua globalSetup.)

- [ ] **Step 2: Viết test fail cho khung giờ giao**

`app/lib/delivery.test.ts`:
```ts
import { describe, expect, test } from "vitest";
import { deliveryDays, firstOpenSlot, vnDate, vnDateTimeLabel } from "~/lib/delivery";

const at = (iso: string) => new Date(iso);
const open = (now: Date, taken = {}) =>
  deliveryDays(now, taken).map((d) => [d.label, d.slots.filter((s) => !s.disabled).map((s) => s.slot)]);

describe("deliveryDays", () => {
  test("6:00 sáng: mọi khung hôm nay còn mở, mặc định 08:00–10:00 hôm nay", () => {
    const now = at("2026-10-14T23:00:00Z"); // 06:00 ngày 15/10 giờ VN
    expect(open(now)[0]).toEqual(["Hôm nay 15/10", ["08:00–10:00", "10:00–12:00", "14:00–16:00", "17:00–19:00"]]);
    expect(firstOpenSlot(deliveryDays(now, {}))).toBe("2026-10-15|08:00–10:00");
  });
  test("7:30 sáng: khung 8h còn chưa tới 1 giờ nên bị khoá, ghi lý do 'past'", () => {
    const days = deliveryDays(at("2026-10-15T00:30:00Z"), {});
    expect(days[0].slots[0]).toMatchObject({ slot: "08:00–10:00", disabled: true, reason: "past" });
    expect(firstOpenSlot(days)).toBe("2026-10-15|10:00–12:00");
  });
  test("21h: hết khung hôm nay, mặc định nhảy sang 08:00 ngày mai (roadmap Review Focus 5)", () => {
    const days = deliveryDays(at("2026-10-15T14:00:00Z"), {});
    expect(days[0].slots.every((s) => s.reason === "past")).toBe(true);
    expect(days[1].label).toBe("Ngày mai 16/10");
    expect(firstOpenSlot(days)).toBe("2026-10-16|08:00–10:00");
  });
  test("khung đủ 20 đơn bị khoá với lý do 'full'; 19 đơn vẫn mở", () => {
    const now = at("2026-10-14T23:00:00Z");
    const days = deliveryDays(now, { "2026-10-15|08:00–10:00": 20, "2026-10-15|10:00–12:00": 19 });
    expect(days[0].slots[0]).toMatchObject({ disabled: true, reason: "full" });
    expect(days[0].slots[1].disabled).toBe(false);
  });
  test("không còn khung nào thì firstOpenSlot trả null", () => {
    const now = at("2026-10-15T14:00:00Z");
    const full = Object.fromEntries(["08:00–10:00", "10:00–12:00", "14:00–16:00", "17:00–19:00"].map((s) => [`2026-10-16|${s}`, 20]));
    expect(firstOpenSlot(deliveryDays(now, full))).toBeNull();
  });
});

test("ngày/giờ luôn theo giờ Việt Nam dù server chạy UTC", () => {
  expect(vnDate(at("2026-10-14T17:30:00Z"))).toBe("2026-10-15"); // 00:30 sáng 15/10 ở VN
  expect(vnDate(at("2026-10-14T16:59:00Z"))).toBe("2026-10-14");
  expect(vnDate(at("2026-10-14T17:30:00Z"), 1)).toBe("2026-10-16");
  expect(vnDateTimeLabel(at("2026-10-15T02:05:00Z"))).toBe("09:05 15/10");
});
```

Run: `npx vitest run app/lib/delivery.test.ts`. Expected: FAIL (module `~/lib/delivery` chưa có).

- [ ] **Step 3: `app/lib/delivery.ts`**

```ts
import { DELIVERY_SLOTS, SLOT_CAPACITY } from "./config";

const VN_OFFSET_MS = 7 * 60 * 60 * 1000; // Việt Nam UTC+7, không có giờ mùa hè; server có thể chạy UTC
const LEAD_MINUTES = 60; // cần ít nhất 1 giờ soạn hàng trước giờ bắt đầu khung

const pad = (n: number) => String(n).padStart(2, "0");
const inVn = (d: Date) => new Date(d.getTime() + VN_OFFSET_MS);

/** Ngày theo giờ Việt Nam, dạng "2026-10-15" (cộng thêm `addDays` ngày). */
export const vnDate = (now: Date, addDays = 0) => inVn(new Date(now.getTime() + addDays * 86_400_000)).toISOString().slice(0, 10);

/** "09:30 15/10" theo giờ Việt Nam. Chỉ gọi ở loader (chuỗi gửi xuống client, không lệch khi hydrate). */
export function vnDateTimeLabel(d: Date): string {
  const v = inVn(d);
  return `${pad(v.getUTCHours())}:${pad(v.getUTCMinutes())} ${pad(v.getUTCDate())}/${pad(v.getUTCMonth() + 1)}`;
}

export type SlotOption = { value: string; slot: string; disabled: boolean; reason: "past" | "full" | null };
export type DeliveryDay = { date: string; label: string; slots: SlotOption[] };

/**
 * Khung giờ giao hôm nay + ngày mai. Khung đã qua (hoặc bắt đầu trong <1 giờ) và khung đã đủ đơn bị khoá.
 * `taken`: số đơn chưa huỷ theo khoá "YYYY-MM-DD|khung". `value` của radio cũng là khoá đó.
 */
export function deliveryDays(now: Date, taken: Record<string, number>): DeliveryDay[] {
  const vn = inVn(now);
  const minutesNow = vn.getUTCHours() * 60 + vn.getUTCMinutes();
  return [0, 1].map((add) => {
    const date = vnDate(now, add);
    const [, month, day] = date.split("-");
    return {
      date,
      label: `${add === 0 ? "Hôm nay" : "Ngày mai"} ${day}/${month}`,
      slots: DELIVERY_SLOTS.map((slot) => {
        const value = `${date}|${slot}`;
        const start = Number(slot.slice(0, 2)) * 60 + Number(slot.slice(3, 5));
        const reason =
          add === 0 && minutesNow + LEAD_MINUTES > start ? "past" : (taken[value] ?? 0) >= SLOT_CAPACITY ? "full" : null;
        return { value, slot, disabled: reason !== null, reason };
      }),
    };
  });
}

/** Khung mặc định: khung còn mở sớm nhất (đặt lúc 21h thì nhảy sang sáng mai). null = không còn khung nào. */
export const firstOpenSlot = (days: DeliveryDay[]) => days.flatMap((d) => d.slots).find((s) => !s.disabled)?.value ?? null;
```

Run: `npx vitest run app/lib/delivery.test.ts`. Expected: PASS (6 tests).

- [ ] **Step 4: Viết test fail cho đơn hàng (DB test, dữ liệu riêng của file)**

`app/lib/orders.server.test.ts`:
```ts
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, beforeEach, describe, expect, test } from "vitest";
import { cartTotals } from "~/lib/cart";
import { db } from "~/lib/db.server";
import {
  aggregateQty,
  cancelOrder,
  newOrderCode,
  type PlaceOrderInput,
  placeOrder,
  reorderQuantities,
  setOnlinePayment,
  takenSlots,
} from "~/lib/orders.server";

// Dữ liệu riêng của file này (DB test chosang_test), không dựa vào số tồn kho của seed
const SLUG = "__m3-orders__";
const PHONE = "0900000099";
let A: number; // giá 50.000₫
let B: number; // giá 120.000₫
let OFF: number; // ngừng bán
const PRICE = new Map<number, number>(); // id → giá, để tính tổng khách "đã thấy" như nút Đặt hàng

const stock = async (id: number) => (await db.product.findUniqueOrThrow({ where: { id } })).stock;
const setStock = (id: number, value: number) => db.product.update({ where: { id }, data: { stock: value } });
const totalOf = (lines: PlaceOrderInput["lines"]) =>
  cartTotals(lines.map((l) => ({ priceVnd: PRICE.get(l.productId)!, qty: l.qty, stock: 1 }))).totalVnd;
const order = (lines: PlaceOrderInput["lines"], extra: Partial<PlaceOrderInput> = {}): PlaceOrderInput => ({
  checkoutKey: randomUUID(),
  userId: null,
  customerName: "Chị Lan",
  phone: PHONE,
  address: "12 Lê Lợi, Quận 1",
  note: "",
  callOnSubstitute: true,
  deliveryDate: "2026-10-16",
  deliverySlot: "08:00–10:00",
  paymentMethod: "cod",
  lines,
  expectedTotalVnd: totalOf(lines),
  ...extra,
});
const ordersOf = (productId: number) => db.orderItem.count({ where: { productId, order: { phone: PHONE } } });

const cleanup = async () => {
  await db.order.deleteMany({ where: { phone: PHONE } }); // OrderItem xoá theo cascade
  await db.product.deleteMany({ where: { slug: { startsWith: SLUG } } });
  await db.category.deleteMany({ where: { slug: SLUG } });
};

beforeAll(async () => {
  await cleanup();
  const { id: categoryId } = await db.category.create({ data: { slug: SLUG, name: "test", image: "x" } });
  const make = (suffix: string, priceVnd: number, isActive = true) =>
    db.product.create({
      data: {
        slug: `${SLUG}${suffix}`, name: `Món ${suffix}`, nameSearch: suffix, description: "", categoryId, priceVnd,
        unit: "gói", origin: "x", shelfLife: "x", storage: "x", stock: 10, isActive,
      },
    });
  const made = await Promise.all([make("a", 50000), make("b", 120000), make("off", 10000, false)]);
  for (const p of made) PRICE.set(p.id, p.priceVnd);
  [A, B, OFF] = made.map((p) => p.id);
});

beforeEach(async () => {
  await Promise.all([setStock(A, 10), setStock(B, 10), setStock(OFF, 10)]);
});

afterAll(async () => {
  await cleanup();
  await db.$disconnect();
});

describe("thuần", () => {
  test("aggregateQty gộp cùng sản phẩm (dòng thường + món trong giỏ quà) và sắp id tăng dần", () => {
    const lines = [{ productId: 9, qty: 1 }, { productId: 3, qty: 2 }, { productId: 9, qty: 4 }];
    expect([...aggregateQty(lines)]).toEqual([[3, 2], [9, 5]]);
  });
  test('mã đơn = "DH" + ngày giờ VN (yymmdd) + 4 ký tự không gây nhầm', () => {
    expect(newOrderCode(new Date("2026-10-14T20:00:00Z"))).toMatch(/^DH261015[A-HJ-NP-Z2-9]{4}$/); // 03:00 sáng 15/10 ở VN
  });
});

describe("placeOrder", () => {
  test("trừ kho, chụp tên/đơn vị/giá, tổng tiền giống giỏ (dưới 300.000₫ thì cộng ship)", async () => {
    const result = await placeOrder(order([{ productId: A, qty: 2 }, { productId: B, qty: 1 }]));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const saved = await db.order.findUniqueOrThrow({ where: { code: result.code }, include: { items: { orderBy: { id: "asc" } } } });
    expect(saved).toMatchObject({ subtotalVnd: 220000, shippingVnd: 20000, totalVnd: 240000, status: "pending", paymentStatus: "unpaid" });
    expect(saved.deliveryDate.toISOString()).toBe("2026-10-16T00:00:00.000Z");
    expect(saved.items.map((i) => [i.nameSnapshot, i.unitSnapshot, i.priceSnapshotVnd, i.qty])).toEqual([
      ["Món a", "gói", 50000, 2],
      ["Món b", "gói", 120000, 1],
    ]);
    expect([await stock(A), await stock(B)]).toEqual([8, 9]);
  });

  test("cùng sản phẩm ở nhiều dòng (giỏ quà M4) bị trừ kho theo tổng", async () => {
    await setStock(A, 3);
    const result = await placeOrder(order([{ productId: A, qty: 2 }, { productId: A, qty: 2 }]));
    expect(result).toEqual({ ok: false, reason: "out-of-stock", outOfStock: [{ productId: A, name: "Món a", unit: "gói", available: 3 }] });
    expect(await stock(A)).toBe(3);
  });

  test("2 đơn tranh món cuối cùng lúc: đúng 1 đơn thành công, đơn kia báo hết đúng món đó (DoD M3)", async () => {
    await setStock(A, 1);
    const before = await ordersOf(A);
    const results = await Promise.all([placeOrder(order([{ productId: A, qty: 1 }])), placeOrder(order([{ productId: A, qty: 1 }]))]);
    expect(results.filter((r) => r.ok)).toHaveLength(1);
    expect(results.find((r) => !r.ok)).toEqual({
      ok: false,
      reason: "out-of-stock",
      outOfStock: [{ productId: A, name: "Món a", unit: "gói", available: 0 }],
    });
    expect(await stock(A)).toBe(0);
    expect(await ordersOf(A)).toBe(before + 1);
  });

  test("một món thiếu kho thì huỷ cả đơn: món còn lại không bị trừ, không có đơn nào được tạo", async () => {
    await setStock(B, 1);
    const before = await db.order.count({ where: { phone: PHONE } });
    const result = await placeOrder(order([{ productId: A, qty: 2 }, { productId: B, qty: 3 }]));
    expect(result).toEqual({ ok: false, reason: "out-of-stock", outOfStock: [{ productId: B, name: "Món b", unit: "gói", available: 1 }] });
    expect([await stock(A), await stock(B)]).toEqual([10, 1]);
    expect(await db.order.count({ where: { phone: PHONE } })).toBe(before);
  });

  test("bấm Đặt hàng 2 lần (cùng checkoutKey, đồng thời): 1 đơn, kho trừ 1 lần, cả hai nhận cùng mã (Review Focus 4)", async () => {
    const input = order([{ productId: A, qty: 2 }]);
    const [first, second] = await Promise.all([placeOrder(input), placeOrder(input)]);
    expect(first.ok && second.ok && first.code === second.code).toBe(true);
    expect(await db.order.count({ where: { checkoutKey: input.checkoutKey } })).toBe(1);
    expect(await stock(A)).toBe(8);
    expect(await placeOrder(input)).toEqual(first); // gửi lại sau đó (Back rồi gửi lại form) cũng không tạo đơn mới
  });

  test("hai đơn khoá sản phẩm theo thứ tự ngược nhau vẫn chạy xong (không deadlock)", async () => {
    const results = await Promise.all([
      placeOrder(order([{ productId: A, qty: 1 }, { productId: B, qty: 1 }])),
      placeOrder(order([{ productId: B, qty: 1 }, { productId: A, qty: 1 }])),
    ]);
    expect(results.every((r) => r.ok)).toBe(true);
    expect([await stock(A), await stock(B)]).toEqual([8, 8]);
  });

  test("món ngừng bán bị từ chối, không trừ kho", async () => {
    const result = await placeOrder(order([{ productId: OFF, qty: 1 }]));
    expect(result.ok).toBe(false);
    expect(await stock(OFF)).toBe(10);
  });

  test("giỏ không còn dòng nào còn hàng thì không tạo đơn (báo 'giỏ đã thay đổi')", async () => {
    expect(await placeOrder(order([]))).toEqual({ ok: false, reason: "changed" });
  });

  test("tổng tiền khác số khách đã thấy (giá vừa đổi): không tạo đơn, không trừ kho (cổng M3)", async () => {
    const before = await db.order.count({ where: { phone: PHONE } });
    const lines = [{ productId: A, qty: 2 }];
    expect(await placeOrder(order(lines, { expectedTotalVnd: totalOf(lines) - 1000 }))).toEqual({ ok: false, reason: "changed" });
    expect(await stock(A)).toBe(10);
    expect(await db.order.count({ where: { phone: PHONE } })).toBe(before);
  });
});

describe("sau khi đặt", () => {
  test("huỷ đơn pending hoàn kho; huỷ 2 lần cùng lúc chỉ hoàn 1 lần (DoD M3)", async () => {
    const placed = await placeOrder(order([{ productId: A, qty: 3 }, { productId: B, qty: 1 }]));
    if (!placed.ok) throw new Error("đặt hàng thất bại");
    const { id } = await db.order.findUniqueOrThrow({ where: { code: placed.code } });
    expect([await stock(A), await stock(B)]).toEqual([7, 9]);
    expect((await Promise.all([cancelOrder(id), cancelOrder(id)])).sort()).toEqual([false, true]);
    expect([await stock(A), await stock(B)]).toEqual([10, 10]);
    expect(await db.order.findUniqueOrThrow({ where: { id } })).toMatchObject({ status: "cancelled", cancelledAt: expect.any(Date) });
  });

  test("đơn đã qua pending (admin đang chuẩn bị) thì không huỷ được, kho giữ nguyên", async () => {
    const placed = await placeOrder(order([{ productId: A, qty: 1 }]));
    if (!placed.ok) throw new Error("đặt hàng thất bại");
    const { id } = await db.order.update({ where: { code: placed.code }, data: { status: "preparing", preparingAt: new Date() } });
    expect(await cancelOrder(id)).toBe(false);
    expect(await stock(A)).toBe(9);
  });

  test("thanh toán giả lập: chờ → thất bại → thử lại → thành công; không trả lại được; COD chỉ khi chưa trả", async () => {
    const placed = await placeOrder(order([{ productId: A, qty: 1 }], { paymentMethod: "online_mock" }));
    if (!placed.ok) throw new Error("đặt hàng thất bại");
    const { id } = await db.order.findUniqueOrThrow({ where: { code: placed.code } });
    const status = async () => (await db.order.findUniqueOrThrow({ where: { id } })).paymentStatus;
    expect(await setOnlinePayment(id, "retry")).toBe(false); // chưa thất bại thì chưa có "thử lại"
    expect(await setOnlinePayment(id, "fail")).toBe(true);
    expect(await status()).toBe("failed");
    expect(await stock(A)).toBe(9); // thất bại vẫn giữ kho tới khi huỷ (spec)
    expect(await setOnlinePayment(id, "retry")).toBe(true);
    expect(await setOnlinePayment(id, "pay")).toBe(true);
    expect(await status()).toBe("paid");
    expect(await setOnlinePayment(id, "pay")).toBe(false);
    expect(await setOnlinePayment(id, "cod")).toBe(false); // đã trả rồi thì không đổi sang COD
  });

  test("chuyển sang COD từ trạng thái thất bại; đơn COD không đi được vào cổng giả lập", async () => {
    const placed = await placeOrder(order([{ productId: A, qty: 1 }], { paymentMethod: "online_mock" }));
    if (!placed.ok) throw new Error("đặt hàng thất bại");
    const { id } = await db.order.findUniqueOrThrow({ where: { code: placed.code } });
    await setOnlinePayment(id, "fail");
    expect(await setOnlinePayment(id, "cod")).toBe(true);
    expect(await db.order.findUniqueOrThrow({ where: { id } })).toMatchObject({ paymentMethod: "cod", paymentStatus: "unpaid" });
    expect(await setOnlinePayment(id, "pay")).toBe(false);
  });

  test("takenSlots đếm đơn chưa huỷ theo ngày + khung", async () => {
    const day = { deliveryDate: "2031-01-02", deliverySlot: "14:00–16:00" };
    const a = await placeOrder(order([{ productId: A, qty: 1 }], day));
    await placeOrder(order([{ productId: A, qty: 1 }], day));
    if (!a.ok) throw new Error("đặt hàng thất bại");
    await cancelOrder((await db.order.findUniqueOrThrow({ where: { code: a.code } })).id);
    expect((await takenSlots(new Date("2031-01-01T17:30:00Z")))["2031-01-02|14:00–16:00"]).toBe(1);
  });

  test("Mua lại: kẹp theo tồn kho, bỏ món đã hết hàng", async () => {
    const placed = await placeOrder(order([{ productId: A, qty: 5 }, { productId: B, qty: 2 }]));
    if (!placed.ok) throw new Error("đặt hàng thất bại");
    const { id } = await db.order.findUniqueOrThrow({ where: { code: placed.code } });
    await Promise.all([setStock(A, 3), setStock(B, 0)]);
    expect(await reorderQuantities(id)).toEqual([[A, 3]]);
  });
});
```

Run: `npx vitest run app/lib/orders.server.test.ts`. Expected: FAIL (module `~/lib/orders.server` chưa có).

- [ ] **Step 5: `app/lib/orders.server.ts`**

```ts
import { randomInt } from "node:crypto";
import { type OrderStatus, type PaymentMethod, type PaymentStatus, Prisma } from "~/generated/prisma/client";
import { cartTotals } from "./cart";
import { visible } from "./catalog.server";
import { CART_MAX_QTY } from "./config";
import { db } from "./db.server";
import { vnDate, vnDateTimeLabel } from "./delivery";

/** Một dòng đặt hàng. M4: món trong giỏ quà và vỏ giỏ là các dòng có `bundleId`, cùng sản phẩm có thể lặp lại. */
export type OrderLineInput = { productId: number; qty: number; bundleId?: string | null };

export type PlaceOrderInput = {
  checkoutKey: string; // uuid do loader /checkout cấp; bấm "Đặt hàng" 2 lần gửi cùng khoá → chỉ 1 đơn
  userId: number | null;
  customerName: string;
  phone: string;
  address: string;
  note: string;
  callOnSubstitute: boolean;
  deliveryDate: string; // "YYYY-MM-DD" giờ VN
  deliverySlot: string;
  paymentMethod: PaymentMethod;
  lines: OrderLineInput[];
  expectedTotalVnd: number; // tổng khách đã thấy trên nút "Đặt hàng · …"; khác đi là không đặt
};

export type OutOfStock = { productId: number; name: string; unit: string; available: number };
export type PlaceOrderResult =
  | { ok: true; code: string }
  | { ok: false; reason: "out-of-stock"; outOfStock: OutOfStock[] }
  | { ok: false; reason: "changed" }; // giá hoặc giỏ đổi sau khi khách xem tổng tiền

class OutOfStockError extends Error {
  constructor(readonly items: OutOfStock[]) {
    super("Hết hàng");
  }
}
class TotalChangedError extends Error {}

const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // bỏ I, O, 0, 1 cho khỏi đọc nhầm qua điện thoại

/** "DH" + ngày VN (yymmdd) + 4 ký tự ngẫu nhiên, vd. "DH261015K7QX" (spec mục 5). */
export function newOrderCode(now: Date): string {
  const random = Array.from({ length: 4 }, () => CODE_CHARS[randomInt(CODE_CHARS.length)]).join("");
  return `DH${vnDate(now).slice(2).replaceAll("-", "")}${random}`;
}

/**
 * Gộp số lượng theo sản phẩm (dòng thường + món trong giỏ quà + vỏ giỏ), sắp theo id tăng dần:
 * hai đơn đồng thời luôn khoá các dòng Product theo cùng một thứ tự, nên không thể deadlock.
 */
export function aggregateQty(lines: { productId: number; qty: number }[]): Map<number, number> {
  const total = new Map<number, number>();
  for (const l of lines) total.set(l.productId, (total.get(l.productId) ?? 0) + l.qty);
  return new Map([...total].sort(([a], [b]) => a - b));
}

/**
 * Đặt hàng trong MỘT transaction (spec mục 5): chụp tên/đơn vị/giá → tạo đơn (giữ `checkoutKey`) → trừ kho
 * từng sản phẩm bằng `UPDATE … SET stock = stock - q WHERE id = ? AND stock >= q` → tạo dòng đơn.
 * Một sản phẩm không đủ kho thì huỷ cả đơn và báo đúng món đó. Tổng tiền khác `expectedTotalVnd` (giá đổi,
 * món vừa hết bị bỏ khỏi giỏ) thì không đặt: khách chỉ bị tính đúng số tiền đã thấy trên nút.
 * Hai request cùng `checkoutKey` (bấm 2 lần): request sau chờ ở unique index tới khi request đầu commit,
 * rồi nhận lại đúng mã đơn đó. Tra khoá chạy TRƯỚC mọi kiểm tra khác, nên gửi lại form khi giỏ đã xoá vẫn về đơn cũ.
 */
export async function placeOrder(input: PlaceOrderInput, now = new Date()): Promise<PlaceOrderResult> {
  const existing = await db.order.findUnique({ where: { checkoutKey: input.checkoutKey }, select: { code: true } });
  if (existing) return { ok: true, code: existing.code };
  if (input.lines.length === 0) return { ok: false, reason: "changed" };

  for (let attempt = 1; ; attempt++) {
    try {
      return { ok: true, code: await db.$transaction((tx) => insertOrder(tx, input, now)) };
    } catch (error) {
      if (error instanceof OutOfStockError) return { ok: false, reason: "out-of-stock", outOfStock: error.items };
      if (error instanceof TotalChangedError) return { ok: false, reason: "changed" };
      if (!(error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002")) throw error;
      // Trùng unique: hoặc request kia (cùng checkoutKey) vừa tạo đơn, hoặc trùng mã đơn ngẫu nhiên (thử lại)
      const duplicate = await db.order.findUnique({ where: { checkoutKey: input.checkoutKey }, select: { code: true } });
      if (duplicate) return { ok: true, code: duplicate.code };
      if (attempt === 3) throw error;
    }
  }
}

async function insertOrder(tx: Prisma.TransactionClient, input: PlaceOrderInput, now: Date): Promise<string> {
  const quantities = aggregateQty(input.lines);
  const products = await tx.product.findMany({
    where: { id: { in: [...quantities.keys()] }, isActive: true },
    select: { id: true, name: true, unit: true, priceVnd: true },
  });
  const byId = new Map(products.map((p) => [p.id, p]));
  const gone = [...quantities.keys()].filter((id) => !byId.has(id));
  if (gone.length) throw new OutOfStockError(gone.map((id) => ({ productId: id, name: "Một món đã ngừng bán", unit: "", available: 0 })));

  const items = input.lines.map((l) => {
    const p = byId.get(l.productId)!;
    return {
      productId: p.id,
      bundleId: l.bundleId ?? null,
      nameSnapshot: p.name,
      unitSnapshot: p.unit,
      priceSnapshotVnd: p.priceVnd,
      qty: l.qty,
    };
  });
  // Cùng hàm tính tiền với drawer và nút "Đặt hàng", giá đọc lại từ DB ngay trong transaction.
  // stock: 1 = mọi dòng đều tính tiền: đơn chỉ commit khi MỌI dòng đã trừ kho thành công (không dựa vào số
  // tồn đọc lúc đầu, vì một đơn huỷ đồng thời có thể hoàn kho ngay sau đó → món miễn phí; cổng M3).
  const { subtotalVnd, shippingVnd, totalVnd } = cartTotals(items.map((i) => ({ priceVnd: i.priceSnapshotVnd, qty: i.qty, stock: 1 })));
  if (totalVnd !== input.expectedTotalVnd) throw new TotalChangedError();

  // Tạo đơn TRƯỚC khi trừ kho: request trùng checkoutKey dừng ngay ở đây, không khoá dòng Product nào
  const order = await tx.order.create({
    data: {
      code: newOrderCode(now),
      checkoutKey: input.checkoutKey,
      userId: input.userId,
      customerName: input.customerName,
      phone: input.phone,
      address: input.address,
      note: input.note,
      callOnSubstitute: input.callOnSubstitute,
      deliveryDate: new Date(input.deliveryDate),
      deliverySlot: input.deliverySlot,
      subtotalVnd,
      shippingVnd,
      totalVnd,
      paymentMethod: input.paymentMethod,
    },
    select: { id: true, code: true },
  });

  const short: OutOfStock[] = [];
  for (const [productId, qty] of quantities) {
    // Một câu UPDATE có điều kiện (spike M3: updateMany sinh đúng câu này): Postgres khoá dòng, đơn sau
    // chờ đơn trước commit rồi kiểm lại `stock >= q` trên giá trị mới → kho không bao giờ âm.
    const { count } = await tx.product.updateMany({
      where: { id: productId, isActive: true, stock: { gte: qty } },
      data: { stock: { decrement: qty } },
    });
    if (count === 0) {
      const p = byId.get(productId)!;
      const current = await tx.product.findUnique({ where: { id: productId }, select: { stock: true } });
      short.push({ productId, name: p.name, unit: p.unit, available: current?.stock ?? 0 });
    }
  }
  if (short.length) throw new OutOfStockError(short); // rollback: đơn vừa tạo và kho đã trừ đều quay lại

  await tx.orderItem.createMany({ data: items.map((i) => ({ ...i, orderId: order.id })) });
  return order.code;
}

/** Huỷ khi còn `pending` và hoàn kho, trong một transaction. Huỷ 2 lần cùng lúc chỉ hoàn kho 1 lần. */
export async function cancelOrder(orderId: number, now = new Date()): Promise<boolean> {
  return db.$transaction(async (tx) => {
    const { count } = await tx.order.updateMany({
      where: { id: orderId, status: "pending" },
      data: { status: "cancelled", cancelledAt: now },
    });
    if (count === 0) return false; // đã xử lý/đã huỷ: không hoàn kho thêm lần nữa
    const items = await tx.orderItem.findMany({ where: { orderId }, select: { productId: true, qty: true } });
    for (const [productId, qty] of aggregateQty(items)) {
      await tx.product.update({ where: { id: productId }, data: { stock: { increment: qty } } });
    }
    return true;
  });
}

const PAYMENT_STEPS = {
  pay: { from: ["unpaid"], data: { paymentStatus: "paid" } },
  fail: { from: ["unpaid"], data: { paymentStatus: "failed" } },
  retry: { from: ["failed"], data: { paymentStatus: "unpaid" } },
  cod: { from: ["unpaid", "failed"], data: { paymentMethod: "cod", paymentStatus: "unpaid" } },
} satisfies Record<string, { from: PaymentStatus[]; data: Prisma.OrderUpdateManyMutationInput }>;
export type PaymentStep = keyof typeof PAYMENT_STEPS;
export const isPaymentStep = (v: unknown): v is PaymentStep => typeof v === "string" && Object.hasOwn(PAYMENT_STEPS, v);

/**
 * Cổng thanh toán giả lập: chờ → thành công | thất bại → thử lại | chuyển COD. Chỉ áp cho đơn online còn `pending`.
 * ponytail: đơn online thất bại vẫn giữ kho tới khi khách/admin huỷ (spec), không có TTL; thêm job dọn đơn treo nếu chạy thật.
 */
export async function setOnlinePayment(orderId: number, step: PaymentStep): Promise<boolean> {
  const { from, data } = PAYMENT_STEPS[step];
  const { count } = await db.order.updateMany({
    where: { id: orderId, status: "pending", paymentMethod: "online_mock", paymentStatus: { in: from } },
    data,
  });
  return count === 1;
}

/** Số đơn chưa huỷ theo "YYYY-MM-DD|khung", từ hôm nay (giờ VN), để khoá khung đã đủ SLOT_CAPACITY. */
export async function takenSlots(now: Date): Promise<Record<string, number>> {
  const rows = await db.order.groupBy({
    by: ["deliveryDate", "deliverySlot"],
    where: { deliveryDate: { gte: new Date(vnDate(now)) }, status: { not: "cancelled" } },
    _count: { _all: true },
  });
  return Object.fromEntries(rows.map((r) => [`${r.deliveryDate.toISOString().slice(0, 10)}|${r.deliverySlot}`, r._count._all]));
}

/** Điền sẵn checkout từ đơn gần nhất của user; chưa có đơn thì chỉ có SĐT của tài khoản. */
export async function checkoutPrefill(userId: number | undefined) {
  if (!userId) return null;
  const last = await db.order.findFirst({
    where: { userId },
    orderBy: { createdAt: "desc" },
    select: { customerName: true, phone: true, address: true },
  });
  if (last) return { name: last.customerName, phone: last.phone, address: last.address };
  const user = await db.user.findUnique({ where: { id: userId }, select: { name: true, phone: true } });
  return user && { name: user.name ?? "", phone: user.phone, address: "" };
}

export const getOrder = (code: string) =>
  db.order.findUnique({ where: { code }, include: { items: { orderBy: { id: "asc" } } } });

export type OrderWithItems = NonNullable<Awaited<ReturnType<typeof getOrder>>>;

/**
 * Tra đơn bằng mã + SĐT (khách vãng lai). Sai mã hay sai SĐT đều trả null như nhau (không lộ đơn nào tồn tại).
 * ponytail: không giới hạn số lần tra (phải đoán đúng cả SĐT lẫn 4 ký tự ngẫu nhiên trong ngày); thêm bộ đếm như admin nếu chạy thật.
 */
export const findOrderForPhone = (code: string, phone: string) =>
  db.order.findFirst({ where: { code: code.trim().toUpperCase(), phone }, select: { code: true } });

/** "Mua lại đơn này": số lượng tuyệt đối cho cookie giỏ, bỏ món ngừng bán/hết hàng, kẹp theo tồn kho. */
export async function reorderQuantities(orderId: number): Promise<Array<[number, number]>> {
  const items = await db.orderItem.findMany({ where: { orderId, bundleId: null }, select: { productId: true, qty: true } });
  const wanted = aggregateQty(items);
  const products = await db.product.findMany({
    where: { ...visible, id: { in: [...wanted.keys()] }, stock: { gt: 0 } },
    select: { id: true, stock: true },
  });
  return products.map((p) => [p.id, Math.min(wanted.get(p.id)!, p.stock, CART_MAX_QTY)]);
}

const STATUS_LABEL: Record<OrderStatus, string> = {
  pending: "Đã đặt, chờ chuẩn bị",
  preparing: "Đang chuẩn bị",
  shipping: "Đang giao",
  done: "Đã giao",
  cancelled: "Đã huỷ",
};
const PAYMENT_LABEL: Record<PaymentStatus, string> = { unpaid: "Chưa thanh toán", paid: "Đã thanh toán", failed: "Thanh toán thất bại" };
const DAY = new Intl.DateTimeFormat("vi-VN", { timeZone: "UTC", weekday: "long", day: "2-digit", month: "2-digit" });

/** Đơn → dữ liệu hiển thị (nhãn và giờ VN tính sẵn ở server). Timeline 4 bước đọc từ các cột `*_at` (M5 ghi). */
export function toOrderView(order: OrderWithItems) {
  const at = (d: Date | null) => (d ? vnDateTimeLabel(d) : null);
  return {
    code: order.code,
    status: order.status,
    statusLabel: STATUS_LABEL[order.status],
    createdAt: vnDateTimeLabel(order.createdAt),
    cancelledAt: at(order.cancelledAt),
    timeline: [
      { label: "Đã đặt hàng", at: at(order.createdAt) },
      { label: "Đang chuẩn bị", at: at(order.preparingAt) },
      { label: "Đang giao", at: at(order.shippingAt) },
      { label: "Đã giao", at: at(order.doneAt) },
    ],
    customerName: order.customerName,
    phone: order.phone,
    address: order.address,
    note: order.note,
    callOnSubstitute: order.callOnSubstitute,
    delivery: `${order.deliverySlot}, ${DAY.format(order.deliveryDate)}`,
    paymentMethod: order.paymentMethod,
    paymentStatus: order.paymentStatus,
    paymentLabel: PAYMENT_LABEL[order.paymentStatus],
    items: order.items.map((i) => ({ id: i.id, name: i.nameSnapshot, unit: i.unitSnapshot, priceVnd: i.priceSnapshotVnd, qty: i.qty })),
    subtotalVnd: order.subtotalVnd,
    shippingVnd: order.shippingVnd,
    totalVnd: order.totalVnd,
  };
}

export type OrderView = ReturnType<typeof toOrderView>;

/** Danh sách cho /orders: theo tài khoản, hoặc theo các mã đơn khách có trong phiên. */
export async function listOrders(where: { userId: number } | { codes: string[] }) {
  const rows = await db.order.findMany({
    where: "userId" in where ? { userId: where.userId } : { code: { in: where.codes } },
    orderBy: { createdAt: "desc" },
    take: 50,
    select: { code: true, createdAt: true, totalVnd: true, status: true, _count: { select: { items: true } } },
  });
  return rows.map((o) => ({
    code: o.code,
    createdAt: vnDateTimeLabel(o.createdAt),
    totalVnd: o.totalVnd,
    statusLabel: STATUS_LABEL[o.status],
    itemCount: o._count.items,
  }));
}
```

Run: `npx vitest run app/lib/orders.server.test.ts`. Expected: PASS (17 tests). Chạy thêm 2 lần nữa (các test đồng thời phải ổn định): `for i in 1 2; do npx vitest run app/lib/orders.server.test.ts 2>&1 | grep "Tests "; done` → cả hai `17 passed`.

Kiểm test đặt trùng đỏ được (bắt buộc, rồi hoàn lại): tạm comment dòng `if (duplicate) return { ok: true, code: duplicate.code };` → `npx vitest run app/lib/orders.server.test.ts -t "cùng checkoutKey"` phải FAIL (P2002 lọt ra ngoài) → bỏ comment → PASS.

- [ ] **Step 6: Checkpoint**: `npm run typecheck && npm test`. Expected: **135** test (112 + 6 delivery + 17 orders).

---

### Task 4: Phiên `__session`, OTP giả lập + passcode admin, `/login`, `/logout`, toast, icon tài khoản

**Files:**
- Create: `app/lib/session.server.ts`, `app/lib/auth.server.ts`, `app/lib/auth.server.test.ts`, `app/lib/forms.server.ts`, `app/lib/forms.server.test.ts`, `app/components/field.tsx`, `app/components/toast.tsx`, `app/routes/login.tsx`, `app/routes/logout.ts`
- Modify: `app/root.tsx`, `app/components/site-header.tsx`, `app/routes.ts`

**Interfaces:**
- Consumes: `env.SESSION_SECRET`, `env.COOKIE_SECURE`, `env.DEMO_OTP`, `env.ADMIN_PASSCODE`, `ADMIN_PHONE` (Task 1); `readForm`, `safeRedirect`, `listPromotions` (Task 2); `type DeliveryDay` (Task 3); `db`
- Produces (hợp đồng cho Task 5, 6 và M5):
  - `session.server.ts`: `type OtpState = { phone: string; hash: string; exp: number; tries: number; admin: boolean }`; `type AppSession`; `sessionStorage`; `getSession(request: Request): Promise<AppSession>`; `commitSession(session: AppSession): Promise<string>`; `addGuestOrder(session: AppSession, code: string): void`; `canViewOrder(session: AppSession, order: { code: string; userId: number | null }): boolean`; `getUser(session: AppSession): Promise<{ id: number; phone: string; name: string | null; role: Role } | null>`; `requireAdmin(request: Request)` (chưa đăng nhập → redirect `/login?redirectTo=…`, customer → `Response` 403, admin → user)
  - `auth.server.ts`: `OTP_TTL_MS`, `OTP_MAX_TRIES`; `startLogin(phone: string, now?: number): Promise<{ ok: true; otp: OtpState; demoCode: string | null } | { ok: false; error: string }>`; `verifyLogin(otp: OtpState | undefined, input: string, now?: number): { ok: true; phone: string; viaPasscode: boolean } | { ok: false; error: string; otp: OtpState | null }`; `signIn(phone: string, viaPasscode: boolean): Promise<number | null>` (userId; `null` = tài khoản admin đi đường OTP, bị từ chối). `startLogin` coi `phone === ADMIN_PHONE` là admin kể cả khi chưa có dòng User.
  - `forms.server.ts`: `phoneSchema`; `parsePhone(value: FormDataEntryValue | null): string | null`; `type CheckoutErrors = Partial<Record<"name" | "phone" | "address" | "slot" | "note" | "paymentMethod" | "form", string[]>>`; `type CheckoutFields` (gồm `checkoutKey` và `expectedTotalVnd` từ input ẩn `key`, `total`); `parseCheckoutForm(form: FormData, days: DeliveryDay[]): { ok: true; data: CheckoutFields } | { ok: false; errors: CheckoutErrors }`
  - `field.tsx`: `Field` (props: `name`, `label`, `error?: string[]`, `hint?`, `multiline?` + thuộc tính input/textarea), `inputClass`
  - `toast.tsx`: `Toast({ children, demo? })`, `toastDock` (class), `FlashToast()`
  - root loader → `{ cart, suggestions, user: { phone: string } | null, toast: string | null }` (+ `Set-Cookie` khi có flash)
  - Route `/login` (intent `send` | `verify` | `restart`), `/logout` (chỉ POST, field `redirectTo`)

- [ ] **Step 1: Viết test fail cho validate (SĐT + form checkout)**

`app/lib/forms.server.test.ts`:
```ts
import { describe, expect, test } from "vitest";
import { deliveryDays } from "~/lib/delivery";
import { parseCheckoutForm, parsePhone } from "~/lib/forms.server";

const days = deliveryDays(new Date("2026-10-15T14:00:00Z"), { "2026-10-16|10:00–12:00": 20 }); // 21h: chỉ còn ngày mai
const KEY = "0b7c1f2e-8d4a-4c3b-9e6f-1a2b3c4d5e6f";
const form = (fields: Record<string, string>) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(fields)) f.set(k, v);
  return f;
};
const valid = {
  name: "  Lê Thị Đào ",
  phone: "0912 345 678",
  address: "12 Lê Lợi, P. Bến Nghé, Q.1",
  slot: "2026-10-16|08:00–10:00",
  note: "",
  callOnSubstitute: "on",
  paymentMethod: "cod",
  key: KEY,
  total: "50000",
};

describe("parsePhone", () => {
  test.each([
    ["0912345678", "0912345678"],
    ["0912 345 678", "0912345678"],
    ["0912.345.678", "0912345678"],
    ["+84 912 345 678", "0912345678"],
    ["84912345678", "0912345678"],
    ["912345678", null],
    ["09123456789", null],
    ["abc", null],
  ])("%j → %j", (input, expected) => {
    expect(parsePhone(input)).toBe(expected);
  });
});

describe("parseCheckoutForm", () => {
  test("form hợp lệ: tên đã trim, SĐT chuẩn hoá, khung giờ tách thành ngày + khung", () => {
    expect(parseCheckoutForm(form(valid), days)).toEqual({
      ok: true,
      data: {
        customerName: "Lê Thị Đào",
        phone: "0912345678",
        address: "12 Lê Lợi, P. Bến Nghé, Q.1",
        note: "",
        callOnSubstitute: true,
        paymentMethod: "cod",
        deliveryDate: "2026-10-16",
        deliverySlot: "08:00–10:00",
        checkoutKey: KEY,
        expectedTotalVnd: 50000,
      },
    });
  });
  test("thiếu tên, SĐT sai, địa chỉ quá ngắn: lỗi tiếng Việt theo từng field", () => {
    const result = parseCheckoutForm(form({ ...valid, name: " ", phone: "12345", address: "Q1" }), days);
    expect(result).toEqual({
      ok: false,
      errors: {
        name: ["Bạn nhập họ tên người nhận giúp mình nhé."],
        phone: ["Số điện thoại cần 10 số, bắt đầu bằng 0."],
        address: ["Địa chỉ cần có số nhà, đường, phường/xã."],
      },
    });
  });
  test("form trống hoàn toàn vẫn ra lỗi tiếng Việt (không có 'Invalid input')", () => {
    const result = parseCheckoutForm(new FormData(), days);
    expect(JSON.stringify(result)).not.toMatch(/Invalid|expected/);
    expect(result.ok || Object.keys(result.errors).sort()).toEqual(["address", "form", "name", "paymentMethod", "phone", "slot"]);
  });
  test("khung đã qua (hôm nay lúc 21h), khung đã kín, khung bịa: báo chọn khung khác", () => {
    for (const slot of ["2026-10-15|17:00–19:00", "2026-10-16|10:00–12:00", "2030-01-01|08:00–10:00"]) {
      expect(parseCheckoutForm(form({ ...valid, slot }), days)).toEqual({
        ok: false,
        errors: { slot: ["Khung giờ này vừa kín hoặc đã qua, bạn chọn khung khác nhé."] },
      });
    }
  });
  test("không tick 'Gọi hỏi nếu hết hàng' là false; cách thanh toán lạ bị từ chối", () => {
    const off = parseCheckoutForm(form({ ...valid, callOnSubstitute: "", paymentMethod: "online_mock" }), days);
    expect(off.ok && off.data).toMatchObject({ callOnSubstitute: false, paymentMethod: "online_mock" });
    expect(parseCheckoutForm(form({ ...valid, paymentMethod: "momo" }), days)).toMatchObject({ ok: false, errors: { paymentMethod: expect.any(Array) } });
  });
  test("khoá đặt hàng không phải uuid, hoặc tổng tiền ẩn không phải số nguyên ≥0: lỗi chung của form", () => {
    for (const bad of [{ key: "x" }, { total: "" }, { total: "-1" }, { total: "1.5" }]) {
      expect(parseCheckoutForm(form({ ...valid, ...bad }), days)).toEqual({
        ok: false,
        errors: { form: ["Phiên đặt hàng đã cũ, bạn tải lại trang giúp mình nhé."] },
      });
    }
  });
});
```

Run: `npx vitest run app/lib/forms.server.test.ts`. Expected: FAIL (module `~/lib/forms.server` chưa có).

- [ ] **Step 2: `app/lib/forms.server.ts`**

```ts
import { z } from "zod";
import type { PaymentMethod } from "~/generated/prisma/client";
import type { DeliveryDay } from "./delivery";

/** "0912 345 678", "0912.345.678", "+84 912 345 678" → "0912345678". */
const normalizePhone = (s: string) => s.replace(/[\s.\-()]/g, "").replace(/^\+?84(?=\d{9}$)/, "0");
export const phoneSchema = z
  .string()
  .transform(normalizePhone)
  .pipe(z.string().regex(/^0\d{9}$/, "Số điện thoại cần 10 số, bắt đầu bằng 0."));

/** SĐT chuẩn hoá, hoặc null nếu sai dạng. */
export const parsePhone = (value: FormDataEntryValue | null) => {
  const parsed = phoneSchema.safeParse(typeof value === "string" ? value : "");
  return parsed.success ? parsed.data : null;
};

const STALE = "Phiên đặt hàng đã cũ, bạn tải lại trang giúp mình nhé.";
const checkoutSchema = z.object({
  name: z.string().trim().min(2, "Bạn nhập họ tên người nhận giúp mình nhé.").max(60, "Họ tên tối đa 60 ký tự."),
  phone: phoneSchema,
  address: z.string().trim().min(10, "Địa chỉ cần có số nhà, đường, phường/xã.").max(300, "Địa chỉ tối đa 300 ký tự."),
  slot: z.string().min(1, "Bạn chọn khung giờ giao giúp mình nhé."),
  note: z.string().trim().max(300, "Ghi chú tối đa 300 ký tự."),
  callOnSubstitute: z.string().transform((v) => v === "on"),
  paymentMethod: z.enum(["cod", "online_mock"], "Bạn chọn cách thanh toán giúp mình nhé."),
  key: z.uuid(STALE),
  // Tổng tiền khách đã thấy trên nút "Đặt hàng · …" (input ẩn); placeOrder đối chiếu trong transaction
  total: z.string().regex(/^\d{1,9}$/, STALE).transform(Number),
});

export type CheckoutField = "name" | "phone" | "address" | "slot" | "note" | "paymentMethod" | "form";
export type CheckoutErrors = Partial<Record<CheckoutField, string[]>>;
export type CheckoutFields = {
  customerName: string;
  phone: string;
  address: string;
  note: string;
  callOnSubstitute: boolean;
  deliveryDate: string;
  deliverySlot: string;
  paymentMethod: PaymentMethod;
  checkoutKey: string;
  expectedTotalVnd: number;
};

/** Validate form checkout ở server (zod). Khung giờ phải là khung đang mở trong `days` (không tin giá trị client gửi). */
export function parseCheckoutForm(
  form: FormData,
  days: DeliveryDay[],
): { ok: true; data: CheckoutFields } | { ok: false; errors: CheckoutErrors } {
  const text = (key: string) => {
    const v = form.get(key);
    return typeof v === "string" ? v : "";
  };
  const parsed = checkoutSchema.safeParse({
    name: text("name"),
    phone: text("phone"),
    address: text("address"),
    slot: text("slot"),
    note: text("note"),
    callOnSubstitute: text("callOnSubstitute"),
    paymentMethod: text("paymentMethod"),
    key: text("key"),
    total: text("total"),
  });
  const { key, total, ...fieldErrors } = parsed.success ? {} : z.flattenError(parsed.error).fieldErrors;
  const stale = key ?? total; // input ẩn sai: lỗi chung của form, không gắn vào field nào
  const errors: CheckoutErrors = { ...fieldErrors, ...(stale && { form: stale }) };
  const open = days.flatMap((d) => d.slots).find((s) => s.value === text("slot") && !s.disabled);
  if (text("slot") && !open) errors.slot = ["Khung giờ này vừa kín hoặc đã qua, bạn chọn khung khác nhé."];
  if (!parsed.success || !open) return { ok: false, errors };
  const { name, slot: _slot, key: checkoutKey, total: expectedTotalVnd, ...rest } = parsed.data;
  const [deliveryDate, deliverySlot] = open.value.split("|");
  return { ok: true, data: { ...rest, customerName: name, deliveryDate, deliverySlot, checkoutKey, expectedTotalVnd } };
}
```

Run: `npx vitest run app/lib/forms.server.test.ts`. Expected: PASS (14 tests: parsePhone 8, parseCheckoutForm 6).

- [ ] **Step 3: Viết test fail cho phiên + đăng nhập**

`app/lib/auth.server.test.ts`:
```ts
import { afterAll, describe, expect, test } from "vitest";
import { OTP_TTL_MS, signIn, startLogin, verifyLogin } from "~/lib/auth.server";
import { ADMIN_PHONE } from "~/lib/config";
import { db } from "~/lib/db.server";
import { addGuestOrder, canViewOrder, commitSession, getSession, requireAdmin, sessionStorage } from "~/lib/session.server";

// vitest.config.ts đặt DEMO_OTP=1 và ADMIN_PASSCODE=test-ma-quan-tri-2026; seed DB test có User admin ADMIN_PHONE
const PASSCODE = "test-ma-quan-tri-2026";
const PHONE = "0900000077";
const NOW = 1_800_000_000_000;

afterAll(async () => {
  await db.order.deleteMany({ where: { phone: PHONE } });
  await db.user.deleteMany({ where: { phone: PHONE } });
  await db.$disconnect();
});

const started = async (phone: string, now = NOW) => {
  const result = await startLogin(phone, now);
  if (!result.ok) throw new Error(result.error);
  return result;
};

describe("OTP khách (DEMO_OTP=1)", () => {
  test("mã 6 số chỉ trả về để hiện toast DEMO; cookie chỉ giữ HMAC, không giữ mã", async () => {
    const { otp, demoCode } = await started(PHONE);
    expect(demoCode).toMatch(/^\d{6}$/);
    expect(otp).toMatchObject({ phone: PHONE, tries: 0, admin: false, exp: NOW + OTP_TTL_MS });
    expect(otp.hash).toMatch(/^[0-9a-f]{64}$/);
    expect(JSON.stringify(otp)).not.toContain(demoCode!);
  });
  test("đúng mã thì đăng nhập; sai thì đếm lùi; sai lần thứ 5 phải gửi lại mã", async () => {
    const { otp, demoCode } = await started(PHONE);
    expect(verifyLogin(otp, demoCode!, NOW + 1000)).toEqual({ ok: true, phone: PHONE, viaPasscode: false });
    const wrong = demoCode === "000000" ? "111111" : "000000";
    let state = otp;
    for (let left = 4; left >= 1; left--) {
      const r = verifyLogin(state, wrong, NOW);
      expect(r).toEqual({ ok: false, error: `Mã OTP chưa đúng, còn ${left} lần thử.`, otp: { ...state, tries: 5 - left } });
      if (!r.ok && r.otp) state = r.otp;
    }
    expect(verifyLogin(state, wrong, NOW)).toEqual({ ok: false, error: "Bạn đã nhập sai 5 lần, bấm “Gửi lại mã” nhé.", otp: null });
    expect(verifyLogin({ ...state, tries: 5 }, demoCode!, NOW)).toMatchObject({ ok: false, otp: null }); // đúng mã cũng không qua
  });
  test("quá 5 phút thì mã hết hạn, kể cả nhập đúng", async () => {
    const { otp, demoCode } = await started(PHONE);
    expect(verifyLogin(otp, demoCode!, NOW + OTP_TTL_MS + 1)).toEqual({
      ok: false,
      error: "Mã đã hết hạn, bạn bấm “Gửi lại mã” nhé.",
      otp: null,
    });
  });
  test("mã của SĐT này không dùng được cho SĐT khác (hash gắn với SĐT)", async () => {
    const { otp, demoCode } = await started(PHONE);
    expect(verifyLogin({ ...otp, phone: "0900000078" }, demoCode!, NOW).ok).toBe(false);
  });
});

describe("Admin (spec: không bao giờ thấy OTP trên màn hình)", () => {
  test("SĐT admin không có mã OTP nào được tạo hay trả về", async () => {
    const { otp, demoCode } = await started(ADMIN_PHONE);
    expect(demoCode).toBeNull();
    expect(otp).toMatchObject({ admin: true, hash: "" });
  });
  test("thiếu passcode, passcode rỗng hay sai thì không vào được; đúng passcode thì vào (DoD M3)", async () => {
    const { otp } = await started(ADMIN_PHONE, NOW);
    expect(verifyLogin(otp, "", NOW).ok).toBe(false);
    expect(verifyLogin(otp, "123456", NOW).ok).toBe(false);
    expect(verifyLogin(otp, PASSCODE, NOW)).toEqual({ ok: true, phone: ADMIN_PHONE, viaPasscode: true });
  });
  test("ADMIN_PHONE chưa có dòng User (vừa deploy, giữa TRUNCATE và seed): vẫn không nhận OTP (cổng M3)", async () => {
    const admin = await db.user.findUniqueOrThrow({ where: { phone: ADMIN_PHONE } });
    await db.user.delete({ where: { id: admin.id } });
    try {
      const { otp, demoCode } = await started(ADMIN_PHONE);
      expect(demoCode).toBeNull();
      expect(otp.admin).toBe(true);
    } finally {
      await db.user.upsert({ where: { phone: ADMIN_PHONE }, update: { role: "admin" }, create: { phone: ADMIN_PHONE, role: "admin" } });
    }
  });
  test("tài khoản role admin không vào được bằng đường OTP, chỉ bằng passcode", async () => {
    expect(await signIn(ADMIN_PHONE, false)).toBeNull();
    const admin = await db.user.findUniqueOrThrow({ where: { phone: ADMIN_PHONE } });
    expect(await signIn(ADMIN_PHONE, true)).toBe(admin.id);
  });
  test("phát lại cookie cũ (tries=0) không giúp dò passcode: sai 5 lần là khoá 15 phút ở server", async () => {
    const { otp } = await started(ADMIN_PHONE, NOW + 1);
    for (let i = 0; i < 5; i++) verifyLogin(otp, `doan-${i}`, NOW + 1); // luôn gửi lại đúng trạng thái tries=0
    expect(verifyLogin(otp, PASSCODE, NOW + 2)).toEqual({
      ok: false,
      error: "Sai mã quản trị quá 5 lần, thử lại sau 15 phút.",
      otp: null,
    });
    const later = await started(ADMIN_PHONE, NOW + 16 * 60 * 1000);
    expect(verifyLogin(later.otp, PASSCODE, NOW + 16 * 60 * 1000).ok).toBe(true);
  });
});

describe("phiên + tài khoản", () => {
  test("đăng nhập lần đầu tự tạo tài khoản và gắn đơn khách vãng lai cùng SĐT", async () => {
    await db.order.create({
      data: {
        code: "DH000000TEST", phone: PHONE, customerName: "Khách", address: "x", deliveryDate: new Date("2026-10-16"),
        deliverySlot: "08:00–10:00", subtotalVnd: 1, shippingVnd: 0, totalVnd: 1, paymentMethod: "cod",
      },
    });
    const userId = await signIn(PHONE, false);
    expect(await signIn(PHONE, false)).toBe(userId); // lần sau không tạo thêm
    expect((await db.order.findUniqueOrThrow({ where: { code: "DH000000TEST" } })).userId).toBe(userId);
  });
  test("canViewOrder: chủ tài khoản hoặc mã trong phiên; người lạ thì không (chống IDOR)", async () => {
    const session = await sessionStorage.getSession();
    const order = { code: "DH261015ABCD", userId: 42 };
    expect(canViewOrder(session, order)).toBe(false);
    addGuestOrder(session, "DH261015ABCD");
    expect(canViewOrder(session, order)).toBe(true);
    const owner = await sessionStorage.getSession();
    owner.set("userId", 42);
    expect(canViewOrder(owner, order)).toBe(true);
    expect(canViewOrder(owner, { ...order, userId: null })).toBe(false);
  });
  test("phiên giữ tối đa 20 mã đơn khách, mới nhất đứng đầu, không trùng", async () => {
    const session = await sessionStorage.getSession();
    for (let i = 0; i < 25; i++) addGuestOrder(session, `DH${i}`);
    addGuestOrder(session, "DH24");
    expect(session.get("guestOrderCodes")).toHaveLength(20);
    expect(session.get("guestOrderCodes")?.[0]).toBe("DH24");
  });
  test("cookie __session: 30 ngày, HttpOnly, SameSite=Lax, có ký (sửa tay là mất phiên)", async () => {
    const session = await sessionStorage.getSession();
    session.set("userId", 1);
    const header = await commitSession(session);
    expect(header).toMatch(/^__session=.+; Max-Age=2592000; Path=\/; HttpOnly; SameSite=Lax$/);
    const valid = header.split(";")[0];
    const read = (cookie: string) => getSession(new Request("http://localhost/", { headers: { Cookie: cookie } }));
    expect((await read(valid)).get("userId")).toBe(1);
    // đổi userId nhưng giữ chữ ký cũ: phiên rỗng, không thành người khác được
    const forged = `__session=${encodeURIComponent(btoa(JSON.stringify({ userId: 2 })))}${valid.slice(valid.indexOf("."))}`;
    expect((await read(forged)).get("userId")).toBeUndefined();
  });
  test("requireAdmin: chưa đăng nhập → /login; customer → 403; admin → qua", async () => {
    const asUser = async (userId?: number) => {
      const s = await sessionStorage.getSession();
      if (userId) s.set("userId", userId);
      const cookie = (await commitSession(s)).split(";")[0];
      return requireAdmin(new Request("http://localhost/admin/orders?x=1", { headers: { Cookie: cookie } })).catch((e: Response) => e);
    };
    const guest = (await asUser()) as Response;
    expect([guest.status, guest.headers.get("Location")]).toEqual([302, "/login?redirectTo=%2Fadmin%2Forders%3Fx%3D1"]);
    const customer = await db.user.findUniqueOrThrow({ where: { phone: PHONE } });
    expect(((await asUser(customer.id)) as Response).status).toBe(403);
    const admin = await db.user.findUniqueOrThrow({ where: { phone: ADMIN_PHONE } });
    expect(await asUser(admin.id)).toMatchObject({ phone: ADMIN_PHONE, role: "admin" });
  });
});
```

Run: `npx vitest run app/lib/auth.server.test.ts`. Expected: FAIL (module `~/lib/auth.server` chưa có).

- [ ] **Step 4: `session.server.ts` + `auth.server.ts`**

`app/lib/session.server.ts`:
```ts
import { createCookieSessionStorage, redirect, type Session } from "react-router";
import { db } from "./db.server";
import { env } from "./env.server";

/** OTP đang chờ nhập. `hash` = HMAC(SESSION_SECRET) của sđt + mã + hạn, nên đọc được cookie cũng không dò ra mã. */
export type OtpState = { phone: string; hash: string; exp: number; tries: number; admin: boolean };
type SessionData = { userId: number; guestOrderCodes: string[]; otp: OtpState };
type FlashData = { toast: string };
export type AppSession = Session<SessionData, FlashData>;

/** Cookie `__session` (spec mục 5): 30 ngày, httpOnly, lax, Secure ở production, ký bằng cùng SESSION_SECRET với `cart`. */
export const sessionStorage = createCookieSessionStorage<SessionData, FlashData>({
  cookie: {
    name: "__session",
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    secure: env.COOKIE_SECURE,
    maxAge: 60 * 60 * 24 * 30,
    secrets: [env.SESSION_SECRET],
  },
});

export const getSession = (request: Request) => sessionStorage.getSession(request.headers.get("Cookie"));
export const commitSession = (session: AppSession) => sessionStorage.commitSession(session);

const MAX_GUEST_CODES = 20; // cookie ≤4KB: 20 mã × 12 ký tự là đủ cho khách vãng lai

/** Khách vãng lai xem lại được đơn của mình nhờ mã đơn nằm trong phiên (mới nhất đứng đầu). */
export function addGuestOrder(session: AppSession, code: string) {
  const codes = session.get("guestOrderCodes") ?? [];
  session.set("guestOrderCodes", [code, ...codes.filter((c) => c !== code)].slice(0, MAX_GUEST_CODES));
}

/** Chống IDOR: chỉ chủ tài khoản của đơn, hoặc phiên đã đặt/đã tra đúng mã + SĐT, mới xem/thao tác được đơn. */
export function canViewOrder(session: AppSession, order: { code: string; userId: number | null }): boolean {
  const userId = session.get("userId");
  return (userId !== undefined && order.userId === userId) || (session.get("guestOrderCodes") ?? []).includes(order.code);
}

/** User đang đăng nhập; userId trỏ tới tài khoản đã bị xoá thì coi như chưa đăng nhập. */
export async function getUser(session: AppSession) {
  const id = session.get("userId");
  return id === undefined ? null : db.user.findUnique({ where: { id }, select: { id: true, phone: true, name: true, role: true } });
}

/** Cho layout /admin của M5: chưa đăng nhập → /login; customer → 403. */
export async function requireAdmin(request: Request) {
  const user = await getUser(await getSession(request));
  if (!user) {
    const url = new URL(request.url);
    throw redirect(`/login?redirectTo=${encodeURIComponent(url.pathname + url.search)}`);
  }
  if (user.role !== "admin") throw new Response("Bạn không có quyền vào trang quản trị.", { status: 403 });
  return user;
}
```

`app/lib/auth.server.ts`:
```ts
import { createHmac, randomInt, timingSafeEqual } from "node:crypto";
import { ADMIN_PHONE } from "./config";
import { db } from "./db.server";
import { env } from "./env.server";
import type { OtpState } from "./session.server";

export const OTP_TTL_MS = 5 * 60 * 1000;
export const OTP_MAX_TRIES = 5;
const ADMIN_LOCK_MS = 15 * 60 * 1000;

const hmac = (value: string) => createHmac("sha256", env.SESSION_SECRET).update(value).digest();
const sameHmac = (a: string, b: string) => timingSafeEqual(hmac(a), hmac(b)); // so sánh thời gian hằng
const otpHash = (phone: string, code: string, exp: number) => hmac(`otp:${phone}:${code}:${exp}`).toString("hex");

/**
 * ponytail: bộ đếm sai mã quản trị nằm trong RAM của MỘT tiến trình, mất khi khởi động lại. Nó là chốt chặn thật
 * cho ADMIN_PASSCODE vì `tries` trong cookie có thể bị phát lại (gửi lại cookie cũ là về 0 lần sai).
 * Chuyển sang bảng DB nếu chạy nhiều instance.
 */
const adminFailures = new Map<string, { count: number; until: number }>();
const adminLocked = (phone: string, now: number) => {
  const f = adminFailures.get(phone);
  return f !== undefined && f.count >= OTP_MAX_TRIES && now < f.until;
};
function recordAdminFailure(phone: string, now: number) {
  const f = adminFailures.get(phone);
  const fresh = !f || now >= f.until;
  adminFailures.set(phone, { count: fresh ? 1 : f.count + 1, until: fresh ? now + ADMIN_LOCK_MS : f.until });
}

export type StartLogin = { ok: true; otp: OtpState; demoCode: string | null } | { ok: false; error: string };

/**
 * Bước 1. SĐT admin (role admin trong DB, HOẶC đúng ADMIN_PHONE kể cả khi chưa có dòng User: ví dụ lúc vừa deploy
 * chưa seed, hay giữa TRUNCATE và seed của demo:reset): không tạo OTP, không bao giờ hiện mã, chờ ADMIN_PASSCODE.
 * SĐT khác: chỉ khi DEMO_OTP=1 mới tạo mã 6 số và trả `demoCode` để hiện trong toast DEMO. Tắt cờ là fail-closed.
 */
export async function startLogin(phone: string, now = Date.now()): Promise<StartLogin> {
  const user = await db.user.findUnique({ where: { phone }, select: { role: true } });
  const exp = now + OTP_TTL_MS;
  if (user?.role === "admin" || phone === ADMIN_PHONE) {
    if (!env.ADMIN_PASSCODE) return { ok: false, error: "Tài khoản quản trị chưa được bật trên bản này." };
    return { ok: true, otp: { phone, hash: "", exp, tries: 0, admin: true }, demoCode: null };
  }
  if (!env.DEMO_OTP) return { ok: false, error: "Đăng nhập bằng mã OTP đang tắt trên bản này." };
  const code = String(randomInt(1_000_000)).padStart(6, "0");
  return { ok: true, otp: { phone, hash: otpHash(phone, code, exp), exp, tries: 0, admin: false }, demoCode: code };
}

export type VerifyLogin = { ok: true; phone: string; viaPasscode: boolean } | { ok: false; error: string; otp: OtpState | null };

/** Bước 2: tối đa 5 lần sai, hết hạn sau 5 phút. Trả `otp` mới (đã tăng `tries`) hoặc null nếu phải gửi lại mã. */
export function verifyLogin(otp: OtpState | undefined, input: string, now = Date.now()): VerifyLogin {
  if (!otp || now > otp.exp) return { ok: false, error: "Mã đã hết hạn, bạn bấm “Gửi lại mã” nhé.", otp: null };
  if (otp.tries >= OTP_MAX_TRIES) return { ok: false, error: "Bạn đã nhập sai 5 lần, bấm “Gửi lại mã” nhé.", otp: null };
  if (otp.admin && adminLocked(otp.phone, now)) {
    return { ok: false, error: "Sai mã quản trị quá 5 lần, thử lại sau 15 phút.", otp: null };
  }
  const ok = otp.admin
    ? env.ADMIN_PASSCODE !== "" && sameHmac(input, env.ADMIN_PASSCODE)
    : env.DEMO_OTP && sameHmac(otpHash(otp.phone, input.trim(), otp.exp), otp.hash);
  if (ok) {
    adminFailures.delete(otp.phone);
    return { ok: true, phone: otp.phone, viaPasscode: otp.admin };
  }
  if (otp.admin) recordAdminFailure(otp.phone, now);
  const tries = otp.tries + 1;
  if (tries >= OTP_MAX_TRIES) return { ok: false, error: "Bạn đã nhập sai 5 lần, bấm “Gửi lại mã” nhé.", otp: null };
  const what = otp.admin ? "Mã quản trị" : "Mã OTP";
  return { ok: false, error: `${what} chưa đúng, còn ${OTP_MAX_TRIES - tries} lần thử.`, otp: { ...otp, tries } };
}

/**
 * Đăng nhập thành công: lần đầu thì tự tạo tài khoản; mỗi lần đăng nhập gắn các đơn khách vãng lai cùng SĐT
 * vào tài khoản (spec mục 2 — làm mỗi lần thay vì chỉ lần đầu để đơn đặt lúc đã đăng xuất cũng về tài khoản).
 * Tài khoản admin CHỈ vào bằng passcode: đi đường OTP thì trả null (kể cả admin được nâng quyền sau, ở M5).
 */
export async function signIn(phone: string, viaPasscode: boolean): Promise<number | null> {
  const user = await db.user.upsert({
    where: { phone },
    update: {},
    create: { phone, role: viaPasscode ? "admin" : "customer" }, // passcode đúng = chủ shop, kể cả khi chưa seed
    select: { id: true, role: true },
  });
  if (user.role === "admin" && !viaPasscode) return null;
  await db.order.updateMany({ where: { phone, userId: null }, data: { userId: user.id } });
  return user.id;
}
```

Run: `npx vitest run app/lib/auth.server.test.ts`. Expected: PASS (14 tests; 2 test "ADMIN_PHONE chưa có dòng User" và "role admin không vào được bằng OTP" là của cổng plan M3). Lưu ý: dòng `if (otp.tries >= OTP_MAX_TRIES)` ở đầu `verifyLogin` là bắt buộc. Bản thử thiếu dòng này để lọt "đúng mã sau khi đã sai 5 lần" và test thứ hai bắt được.

- [ ] **Step 5: `Field`, `Toast`, root loader + `FlashToast`, icon tài khoản ở header**

`app/components/field.tsx`:
```tsx
import { CircleAlert } from "lucide-react";
import type { InputHTMLAttributes, TextareaHTMLAttributes } from "react";

export const inputClass =
  "w-full rounded-xl border border-line bg-surface px-3 py-2.5 text-base transition-colors duration-150 ease-snappy placeholder:text-ink-muted hover:border-ink-muted aria-invalid:border-danger";

type Common = { name: string; label: string; error?: string[]; hint?: string };
type Props =
  | (Common & { multiline?: false } & Omit<InputHTMLAttributes<HTMLInputElement>, "name">)
  | (Common & { multiline: true } & Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "name">);

/** Label luôn hiện + lỗi inline ngay dưới field (icon + chữ, màu danger), nối bằng aria-describedby (spec mục 4). */
export function Field({ name, label, error, hint, ...props }: Props) {
  const id = `f-${name}`;
  const describedBy = [hint && `${id}-hint`, error?.length && `${id}-error`].filter(Boolean).join(" ") || undefined;
  const shared = { id, name, "aria-invalid": error?.length ? true : undefined, "aria-describedby": describedBy, className: inputClass };
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-sm">
        {label}
      </label>
      {props.multiline ? (
        <textarea {...shared} {...withoutMultiline(props)} />
      ) : (
        <input {...shared} {...withoutMultiline(props)} className={`${inputClass} min-h-11`} />
      )}
      {hint && (
        <p id={`${id}-hint`} className="mt-1 text-sm text-ink-muted">
          {hint}
        </p>
      )}
      {error?.length ? (
        <p id={`${id}-error`} className="mt-1 flex items-start gap-1.5 text-sm text-danger">
          <CircleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
          {error[0]}
        </p>
      ) : null}
    </div>
  );
}

function withoutMultiline<T extends { multiline?: boolean }>({ multiline: _, ...rest }: T) {
  return rest;
}
```

`app/components/toast.tsx`:
```tsx
import { useEffect, useState } from "react";
import { useRouteLoaderData } from "react-router";
import type { loader as rootLoader } from "~/root";

/** Viên toast ở đáy màn hình. `demo` thêm nhãn DEMO (mã OTP giả lập, spec mục 2). */
export function Toast({ children, demo = false }: { children: React.ReactNode; demo?: boolean }) {
  return (
    <p className="pointer-events-auto flex max-w-md items-center gap-2 rounded-2xl bg-ink px-4 py-2.5 text-sm text-surface shadow-lg">
      {demo && (
        <span className="shrink-0 rounded-full border border-surface/60 px-2 text-xs font-display font-extrabold tracking-wide">DEMO</span>
      )}
      <span>{children}</span>
    </p>
  );
}

export const toastDock = "pointer-events-none fixed inset-x-0 bottom-4 z-40 flex justify-center px-4";

/** Thông báo một lần sau action (đặt hàng, đăng nhập, đăng xuất, huỷ…): root loader đọc flash `toast` của phiên. */
export function FlashToast() {
  const toast = useRouteLoaderData<typeof rootLoader>("root")?.toast ?? null;
  const [shown, setShown] = useState(toast);
  useEffect(() => {
    setShown(toast);
    if (!toast) return;
    const timer = setTimeout(() => setShown(null), 4000);
    return () => clearTimeout(timer);
  }, [toast]);
  return (
    <div role="status" className={toastDock}>
      {shown && <Toast>{shown}</Toast>}
    </div>
  );
}
```

Thay **toàn bộ** `app/root.tsx` bằng:
```tsx
import { data, isRouteErrorResponse, Links, Meta, Outlet, Scripts, ScrollRestoration } from "react-router";
import type { Route } from "./+types/root";
import { CartDrawer } from "./components/cart-drawer";
import { PendingBar } from "./components/pending-bar";
import { SiteFooter } from "./components/site-footer";
import { SiteHeader } from "./components/site-header";
import { FlashToast } from "./components/toast";
import { getCartView, readCart } from "./lib/cart.server";
import { listPromotions } from "./lib/catalog.server";
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
  const [suggestions, user] = await Promise.all([cart.lines.length === 0 ? listPromotions(3) : [], getUser(session)]);
  const toast = session.get("toast") ?? null;
  return data(
    { cart, suggestions, user: user && { phone: user.phone }, toast },
    toast ? { headers: { "Set-Cookie": await commitSession(session) } } : undefined, // xoá flash đã đọc
  );
}

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="theme-color" content="#FAFAF5" />
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
```

Thay **toàn bộ** `app/components/site-header.tsx` bằng (thêm link tài khoản 44px; `gap-1.5`, `pl-9 pr-2`, kính lúp `left-2.5` để "Tìm món…" vẫn vừa ở 375px: Decision 17):
```tsx
import { Search, ShoppingBasket, UserRound } from "lucide-react";
import { useEffect, useRef } from "react";
import { Form, Link, useLocation, useRouteLoaderData, useSearchParams } from "react-router";
import { useCart } from "~/lib/use-cart";
import type { loader as rootLoader } from "~/root";

export function SiteHeader() {
  const [params] = useSearchParams();
  const q = params.get("q") ?? "";
  const { count, error } = useCart();
  const user = useRouteLoaderData<typeof rootLoader>("root")?.user ?? null;
  const { pathname, search } = useLocation();
  const badgeRef = useRef<HTMLSpanElement>(null);
  const prevCount = useRef(count);

  // Badge nảy mỗi khi số món tăng (cùng ảnh bay là khoảnh khắc đặc trưng duy nhất, spec mục 4)
  useEffect(() => {
    const badge = badgeRef.current;
    if (badge && count > prevCount.current) {
      badge.classList.remove("cart-bump");
      void badge.offsetWidth; // ép reflow để animation CSS chạy lại
      badge.classList.add("cart-bump");
    }
    prevCount.current = count;
  }, [count]);

  return (
    <header className="sticky top-0 z-30 border-b border-line bg-bg/95 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center gap-1.5 sm:gap-3 px-4 py-2">
        <Link
          to="/"
          className="inline-flex min-h-11 items-center font-display text-xl sm:text-2xl leading-tight font-extrabold text-brand transition-colors duration-150 ease-snappy hover:text-brand-press"
        >
          Chợ Sáng
        </Link>
        <Form method="get" action="/collections/all" role="search" className="relative min-w-0 flex-1">
          <label htmlFor="site-search" className="sr-only">
            Tìm sản phẩm
          </label>
          <Search
            aria-hidden
            className="pointer-events-none absolute top-1/2 left-2.5 size-5 -translate-y-1/2 text-ink-muted"
          />
          <input
            key={q}
            id="site-search"
            name="q"
            type="search"
            defaultValue={q}
            placeholder="Tìm món…"
            autoComplete="off"
            enterKeyHint="search"
            className="h-11 w-full rounded-full border border-line bg-surface pr-2 pl-9 text-base transition-colors duration-150 ease-snappy placeholder:text-ink-muted hover:border-ink-muted"
          />
        </Form>
        <Link
          to={user ? "/orders" : `/login?redirectTo=${encodeURIComponent(pathname + search)}`}
          aria-label={user ? "Tài khoản và đơn hàng" : "Đăng nhập"}
          className="inline-flex size-11 shrink-0 items-center justify-center rounded-full transition-colors duration-150 ease-snappy hover:bg-ink/5"
        >
          <UserRound aria-hidden className="size-6" />
        </Link>
        <button
          id="cart-button"
          type="button"
          onClick={() => document.querySelector<HTMLDialogElement>("#cart-drawer")?.showModal()}
          aria-label={`Giỏ hàng, ${count} món`}
          className="relative inline-flex size-11 shrink-0 items-center justify-center rounded-full transition-colors duration-150 ease-snappy hover:bg-ink/5"
        >
          <ShoppingBasket aria-hidden className="size-6" />
          {count > 0 && (
            <span
              ref={badgeRef}
              className="absolute -top-0.5 -right-0.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-brand px-1 text-xs font-display font-extrabold text-surface tabular-nums"
            >
              {count > 99 ? "99+" : count}
            </span>
          )}
        </button>
      </div>
      {/* Lỗi thao tác giỏ (mất mạng, quá 50 món): thấy được cả khi drawer đóng; mất ở lần gửi thành công kế tiếp */}
      {error && (
        <p role="alert" className="border-t border-line bg-surface px-4 py-2 text-center text-sm">
          {error}
        </p>
      )}
    </header>
  );
}
```

- [ ] **Step 6: `/login`, `/logout`, đăng ký route**

`app/routes/login.tsx`:
```tsx
import { ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";
import { data, Form, redirect, useNavigation } from "react-router";
import { Field } from "~/components/field";
import { Toast, toastDock } from "~/components/toast";
import { signIn, startLogin, verifyLogin } from "~/lib/auth.server";
import { env } from "~/lib/env.server";
import { parsePhone } from "~/lib/forms.server";
import { readForm, safeRedirect } from "~/lib/security.server";
import { commitSession, getSession } from "~/lib/session.server";
import type { Route } from "./+types/login";

type Step = "phone" | "code" | "passcode";

export async function loader({ request }: Route.LoaderArgs) {
  const url = new URL(request.url);
  const redirectTo = safeRedirect(url.searchParams.get("redirectTo"));
  const session = await getSession(request);
  if (session.has("userId")) throw redirect(redirectTo);
  const otp = session.get("otp");
  const active = otp && Date.now() <= otp.exp ? otp : null;
  const step: Step = !active ? "phone" : active.admin ? "passcode" : "code";
  return { step, phone: active?.phone ?? url.searchParams.get("phone") ?? "", redirectTo, demoOtp: env.DEMO_OTP };
}

/** intent: `send` (gửi/gửi lại mã), `verify` (nhập mã hoặc passcode quản trị), `restart` (đổi số). */
export async function action({ request }: Route.ActionArgs) {
  const form = await readForm(request);
  const session = await getSession(request);
  const redirectTo = safeRedirect(form.get("redirectTo"));
  const reply = async (body: { step: Step; phone: string; error?: string; demoCode?: string }, status = 200) =>
    data(body, { status, headers: { "Set-Cookie": await commitSession(session) } });

  const intent = form.get("intent");
  if (intent === "restart") {
    session.unset("otp");
    return reply({ step: "phone", phone: "" });
  }
  if (intent === "send") {
    const phone = parsePhone(form.get("phone"));
    if (!phone) return reply({ step: "phone", phone: String(form.get("phone") ?? ""), error: "Số điện thoại cần 10 số, bắt đầu bằng 0." }, 400);
    const started = await startLogin(phone);
    if (!started.ok) return reply({ step: "phone", phone, error: started.error }, 400);
    session.set("otp", started.otp);
    return reply({ step: started.otp.admin ? "passcode" : "code", phone, demoCode: started.demoCode ?? undefined });
  }
  if (intent === "verify") {
    const otp = session.get("otp");
    const result = verifyLogin(otp, String(form.get("code") ?? ""));
    if (!result.ok) {
      if (result.otp) session.set("otp", result.otp);
      else session.unset("otp");
      const step: Step = !result.otp ? "phone" : result.otp.admin ? "passcode" : "code";
      return reply({ step, phone: otp?.phone ?? "", error: result.error }, 400);
    }
    session.unset("otp");
    const userId = await signIn(result.phone, result.viaPasscode);
    if (userId === null) return reply({ step: "phone", phone: "", error: "Không đăng nhập được bằng số này." }, 400);
    session.set("userId", userId);
    session.flash("toast", "Đã đăng nhập");
    return redirect(redirectTo, { headers: { "Set-Cookie": await commitSession(session) } });
  }
  return reply({ step: "phone", phone: "", error: "Yêu cầu không hợp lệ." }, 400);
}

const primary =
  "inline-flex min-h-12 w-full items-center justify-center rounded-full bg-brand px-6 font-display font-extrabold text-surface transition-colors duration-150 ease-snappy hover:bg-brand-press disabled:opacity-60";
const link = "inline-flex min-h-11 items-center px-2 text-sm underline underline-offset-4 hover:text-brand";

export default function Login({ loaderData, actionData }: Route.ComponentProps) {
  const step = actionData?.step ?? loaderData.step;
  const phone = actionData?.phone ?? loaderData.phone;
  const busy = useNavigation().state === "submitting";
  // Giữ mã DEMO trên màn hình qua các lần nhập sai (server chỉ giữ HMAC, không gửi lại được mã)
  const [demoCode, setDemoCode] = useState<string | null>(actionData?.demoCode ?? null); // có cả khi không JS (SSR)
  useEffect(() => {
    if (actionData?.demoCode) setDemoCode(actionData.demoCode);
  }, [actionData]);
  const hidden = <input type="hidden" name="redirectTo" value={loaderData.redirectTo} />;

  return (
    <main className="mx-auto max-w-md px-4 py-8">
      <title>Đăng nhập · Chợ Sáng</title>
      <h1 className="text-3xl">Đăng nhập</h1>
      <p className="mt-2 text-ink-muted">Bằng số điện thoại, không cần mật khẩu. Đơn bạn đã đặt bằng số này sẽ tự về tài khoản.</p>

      {actionData?.error && (
        <p role="alert" className="mt-4 rounded-xl border border-danger/30 bg-surface px-3 py-2 text-sm text-danger">
          {actionData.error}
        </p>
      )}

      {step === "phone" ? (
        <Form method="post" noValidate className="mt-6 space-y-4">
          {hidden}
          <Field
            name="phone"
            label="Số điện thoại"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            defaultValue={phone}
            hint={loaderData.demoOtp ? "Bản demo: mã OTP hiện ngay trên màn hình, không gửi SMS." : undefined}
          />
          <button name="intent" value="send" disabled={busy} className={primary}>
            {busy ? "Đang gửi…" : "Gửi mã"}
          </button>
        </Form>
      ) : (
        <Form method="post" noValidate className="mt-6 space-y-4">
          {hidden}
          <input type="hidden" name="phone" value={phone} />
          {step === "passcode" ? (
            <>
              <p className="flex items-start gap-2 text-sm">
                <ShieldCheck aria-hidden className="mt-0.5 size-5 shrink-0" />
                Số {phone} là tài khoản quản trị. Nhập mã quản trị để tiếp tục.
              </p>
              <Field name="code" label="Mã quản trị" type="password" autoComplete="current-password" />
            </>
          ) : (
            <Field
              name="code"
              label={`Mã 6 số gửi tới ${phone}`}
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              pattern="[0-9]*"
            />
          )}
          <button name="intent" value="verify" disabled={busy} className={primary}>
            {busy ? "Đang kiểm tra…" : "Đăng nhập"}
          </button>
          <div className="flex flex-wrap justify-between">
            {step === "code" && (
              <button name="intent" value="send" className={link}>
                Gửi lại mã
              </button>
            )}
            <button name="intent" value="restart" className={link}>
              Đổi số điện thoại
            </button>
          </div>
        </Form>
      )}

      {/* Mã OTP giả lập chỉ hiện ở đây, có nhãn DEMO; SĐT admin không bao giờ nhận demoCode */}
      <div role="status" className={toastDock}>
        {demoCode && step === "code" && (
          <Toast demo>
            Mã OTP của bạn: <b className="font-display font-extrabold tracking-widest tabular-nums">{demoCode}</b>
          </Toast>
        )}
      </div>
    </main>
  );
}
```

`app/routes/logout.ts`:
```ts
import { redirect } from "react-router";
import { readForm, safeRedirect } from "~/lib/security.server";
import { commitSession, sessionStorage } from "~/lib/session.server";
import type { Route } from "./+types/logout";

// Chỉ có action POST (GET không có loader nên RR trả lỗi): đăng xuất bằng link/ảnh từ trang khác là không được.
export async function action({ request }: Route.ActionArgs) {
  const form = await readForm(request);
  // Phiên mới: quên userId, OTP và mã đơn khách (máy dùng chung). Cookie `cart` riêng nên giỏ vẫn còn.
  const fresh = await sessionStorage.getSession();
  fresh.flash("toast", "Đã đăng xuất");
  return redirect(safeRedirect(form.get("redirectTo")), { headers: { "Set-Cookie": await commitSession(fresh) } });
}
```

Trong `app/routes.ts`, thêm (ngay dưới `route("cart", "routes/cart.ts"),`):
```ts
  route("login", "routes/login.tsx"),
  route("logout", "routes/logout.ts"),
```

Run: `npm run typecheck`. Expected: sạch.

- [ ] **Step 7: Checkpoint**: `npm run typecheck && npm test`. Expected: **163** test (135 + 14 forms + 14 auth).

- [ ] **Step 8: Kiểm bằng curl trên bản build production nối DB test (không tạo user trong DB dev)**

```bash
npm run build
TEST_URL=$(node -e 'process.loadEnvFile(); const u = new URL(process.env.DATABASE_URL); u.pathname = "/chosang_test"; console.log(u.href)')
PORT=3100 NODE_ENV=production DATABASE_URL=$TEST_URL SESSION_SECRET=e2e-chi-dung-cho-playwright-0123456789abcdef DEMO_OTP=1 ADMIN_PASSCODE=e2e-ma-quan-tri-2026 npm start &
sleep 3
curl -s -o /dev/null -w '%{http_code}\n' localhost:3100/login
curl -s -X POST -d 'intent=send&phone=0909000000' localhost:3100/login | grep -o 'là tài khoản quản trị\|Mã OTP của bạn' | sort -u
curl -s -X POST -d 'intent=send&phone=0912345678' localhost:3100/login | grep -o 'Mã OTP của bạn' | head -1
curl -s -o /dev/null -w '%{http_code}\n' localhost:3100/logout
curl -s -o /dev/null -w '%{http_code}\n' -X POST -H 'Origin: http://evil.test' -d 'redirectTo=/' localhost:3100/logout
curl -s -o /dev/null -w '%{http_code} %{redirect_url}\n' -X POST -d 'redirectTo=//evil.test' localhost:3100/logout
```
Expected (theo thứ tự): `200`; chỉ `là tài khoản quản trị` (không có `Mã OTP của bạn`); `Mã OTP của bạn`; `400` (GET /logout); `403`; `302 http://localhost:3100/`. Dừng server (PID cổng 3100).

---

### Task 5: Trang `/checkout` (khách vãng lai, một trang) + action đặt hàng

**Files:**
- Create: `app/routes/checkout.tsx`, `app/routes/checkout.test.ts`
- Modify: `app/routes.ts`

**Interfaces:**
- Consumes: `readCart`, `getCartView`, `cartCookie` (M2), `cartTotals`; `readForm` (Task 2); `deliveryDays`, `firstOpenSlot`, `placeOrder`, `takenSlots`, `checkoutPrefill`, `type OutOfStock` (Task 3); `parseCheckoutForm`, `type CheckoutErrors`, `getSession`, `commitSession`, `addGuestOrder`, `Field` (Task 4)
- Produces:
  - `GET /checkout` → giỏ rỗng: 302 `/collections/all`; có hàng: `{ lines: CartLine[]; totals: CartTotals; days: DeliveryDay[]; defaultSlot: string | null; prefill: { name; phone; address } | null; checkoutKey: string }`
  - `POST /checkout` (field: `name`, `phone`, `address`, `slot` = `"YYYY-MM-DD|khung"`, `note`, `callOnSubstitute` = `"on"`, `paymentMethod` = `cod | online_mock`, ẩn: `key`, `total`) → 302 `/orders/:code` (COD) hoặc `/checkout/pay/:code` (online) với **2 Set-Cookie** (`__session` có mã đơn + flash, `cart` có `l: []`); 400 `{ errors: CheckoutErrors }`; 409 `{ errors: { form: [lời nhắn] } }` khi thiếu kho, món vừa hết hoặc giá/giỏ đổi so với `total` (route có `shouldRevalidate` để tải lại tóm tắt sau 409); 403/413 từ `readForm`

- [ ] **Step 1: Viết test fail (DB test đã seed)**

`app/routes/checkout.test.ts`:
```ts
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { cartCookie, readCart } from "~/lib/cart.server";
import { db } from "~/lib/db.server";
import { deliveryDays, firstOpenSlot } from "~/lib/delivery";
import { commitSession, getSession, sessionStorage } from "~/lib/session.server";
import { action, loader } from "~/routes/checkout";

// DB test đã seed (chosang_test): rau-muong 15.000₫ còn 60, tao-envy hết hàng, nho-xanh-ninh-thuan còn 3
const PHONE = "0900000088";
const id: Record<string, number> = {};

beforeAll(async () => {
  const rows = await db.product.findMany({ where: { slug: { in: ["rau-muong", "tao-envy", "nho-xanh-ninh-thuan"] } } });
  for (const r of rows) id[r.slug] = r.id;
});
afterAll(async () => {
  await db.order.deleteMany({ where: { phone: PHONE } });
  await db.user.deleteMany({ where: { phone: { in: [PHONE, "0900000087"] } } });
  await db.$disconnect();
});

const cartOf = async (lines: [number, number][]) => (await cartCookie.serialize({ l: lines, b: [] })).split(";")[0];
const fields = (extra: Record<string, string> = {}) =>
  new URLSearchParams({
    name: "Chị Lan",
    phone: PHONE,
    address: "12 Lê Lợi, P. Bến Nghé, Q.1",
    slot: firstOpenSlot(deliveryDays(new Date(), {}))!,
    note: "",
    callOnSubstitute: "on",
    paymentMethod: "cod",
    key: crypto.randomUUID(),
    ...extra,
  });
const post = (body: URLSearchParams, cookie: string, headers: Record<string, string> = {}) =>
  action({
    request: new Request("http://localhost/checkout", { method: "POST", body, headers: { Cookie: cookie, ...headers } }),
    params: {},
  } as Parameters<typeof action>[0]).catch((e: unknown) => e);
const cookiesOf = (res: Response) => res.headers.getSetCookie().map((c) => c.split(";")[0]).join("; ");
const load = (cookie: string) =>
  loader({ request: new Request("http://localhost/checkout", { headers: { Cookie: cookie } }), params: {} } as Parameters<typeof loader>[0]);
/** Như trình duyệt: tải trang checkout (lấy tổng tiền đang hiện trên nút) rồi mới gửi form. */
const formFor = async (cart: string, extra: Record<string, string> = {}) =>
  fields({ total: String((await load(cart)).totals.totalVnd), ...extra });
const send = async (cart: string, extra: Record<string, string> = {}, headers: Record<string, string> = {}) =>
  post(await formFor(cart, extra), cart, headers);

describe("/checkout loader", () => {
  test("giỏ rỗng thì chuyển sang trang sản phẩm", async () => {
    const res = await loader({ request: new Request("http://localhost/checkout"), params: {} } as Parameters<typeof loader>[0]).catch((e) => e);
    expect([res.status, res.headers.get("Location")]).toEqual([302, "/collections/all"]);
  });
  test("có khoá đặt hàng mới mỗi lần tải; dòng hết hàng có trong danh sách nhưng không tính tiền", async () => {
    const cookie = await cartOf([[id["rau-muong"], 2], [id["tao-envy"], 1]]);
    const [a, b] = await Promise.all([load(cookie), load(cookie)]);
    expect(a.checkoutKey).not.toBe(b.checkoutKey);
    expect(a.lines.map((l) => [l.slug, l.isWeighed])).toEqual([["rau-muong", true], ["tao-envy", true]]);
    expect(a.totals).toMatchObject({ subtotalVnd: 30000, shippingVnd: 20000, totalVnd: 50000 });
  });
});

describe("/checkout action", () => {
  test("COD: 1 đơn (bỏ dòng hết hàng), về trang đơn, phiên nhớ mã đơn + toast, giỏ được xoá — 2 Set-Cookie", async () => {
    const res = (await send(await cartOf([[id["rau-muong"], 2], [id["tao-envy"], 1]]))) as Response;
    expect(res.status).toBe(302);
    const code = res.headers.get("Location")!.replace("/orders/", "");
    expect(code).toMatch(/^DH\d{6}[A-Z0-9]{4}$/);
    const order = await db.order.findUniqueOrThrow({ where: { code }, include: { items: true } });
    expect(order).toMatchObject({ totalVnd: 50000, paymentMethod: "cod", userId: null, callOnSubstitute: true });
    expect(order.items.map((i) => [i.nameSnapshot, i.qty])).toEqual([["Rau muống", 2]]);
    const next = new Request("http://localhost/", { headers: { Cookie: cookiesOf(res) } });
    expect((await getSession(next)).get("guestOrderCodes")).toEqual([code]);
    expect((await getSession(next)).get("toast")).toBe("Đặt hàng thành công");
    expect((await readCart(next)).l).toEqual([]);
  });
  test("online giả lập: chuyển tới cổng /checkout/pay/:code", async () => {
    const res = (await send(await cartOf([[id["rau-muong"], 1]]), { paymentMethod: "online_mock" })) as Response;
    expect(res.headers.get("Location")).toMatch(/^\/checkout\/pay\/DH/);
  });
  test("form sai: 400 kèm lỗi theo field, không tạo đơn", async () => {
    const before = await db.order.count({ where: { phone: PHONE } });
    const res = await send(await cartOf([[id["rau-muong"], 1]]), { name: "", address: "Q1" });
    expect(res).toMatchObject({ init: { status: 400 }, data: { errors: { name: expect.any(Array), address: expect.any(Array) } } });
    expect(await db.order.count({ where: { phone: PHONE } })).toBe(before);
  });
  test("gửi lại cùng form (cùng khoá) thì về đúng đơn cũ, không tạo đơn thứ hai", async () => {
    const cart = await cartOf([[id["rau-muong"], 1]]);
    const body = await formFor(cart);
    const [a, b] = (await Promise.all([post(body, cart), post(body, cart)])) as Response[];
    expect(a.headers.get("Location")).toBe(b.headers.get("Location"));
    expect(await db.order.count({ where: { checkoutKey: body.get("key") } })).toBe(1);
  });
  test("vượt tồn kho: 409, báo đúng tên món và số còn lại", async () => {
    const res = await send(await cartOf([[id["nho-xanh-ninh-thuan"], 5]]));
    expect(res).toMatchObject({
      init: { status: 409 },
      data: { errors: { form: ["Nho xanh Ninh Thuận chỉ còn 3 hộp 500g. Bạn sửa giỏ hàng rồi đặt lại nhé."] } },
    });
  });
  test("giá đổi sau khi khách xem trang: 409, không tạo đơn (chỉ trả đúng tổng đã thấy trên nút)", async () => {
    const cart = await cartOf([[id["rau-muong"], 1]]);
    const body = await formFor(cart);
    const before = await db.order.count({ where: { phone: PHONE } });
    await db.product.update({ where: { id: id["rau-muong"] }, data: { priceVnd: 16000 } });
    try {
      expect(await post(body, cart)).toMatchObject({
        init: { status: 409 },
        data: { errors: { form: ["Giá hoặc giỏ hàng vừa thay đổi, bạn xem lại tổng tiền rồi đặt lại nhé."] } },
      });
      expect(await db.order.count({ where: { phone: PHONE } })).toBe(before);
    } finally {
      await db.product.update({ where: { id: id["rau-muong"] }, data: { priceVnd: 15000 } });
    }
  });
  test("món duy nhất vừa hết sau khi khách xem trang: 409 nêu đúng tên món, không phải 'giỏ trống'", async () => {
    const cart = await cartOf([[id["nho-xanh-ninh-thuan"], 1]]);
    const body = await formFor(cart);
    const { stock } = await db.product.findUniqueOrThrow({ where: { id: id["nho-xanh-ninh-thuan"] } });
    await db.product.update({ where: { id: id["nho-xanh-ninh-thuan"] }, data: { stock: 0 } });
    try {
      expect(await post(body, cart)).toMatchObject({
        init: { status: 409 },
        data: { errors: { form: ["Nho xanh Ninh Thuận vừa hết hàng. Tổng tiền đã cập nhật, bạn xem lại rồi đặt lại nhé."] } },
      });
    } finally {
      await db.product.update({ where: { id: id["nho-xanh-ninh-thuan"] }, data: { stock } });
    }
  });
  test("gửi lại form sau khi đơn đã tạo (giỏ đã xoá, ví dụ bấm Back rồi gửi lại): về đúng đơn cũ", async () => {
    const cart = await cartOf([[id["rau-muong"], 1]]);
    const body = await formFor(cart);
    const first = (await post(body, cart)) as Response;
    const again = (await post(body, cookiesOf(first))) as Response; // cookie mới: giỏ rỗng + phiên có mã đơn
    expect(again.headers.get("Location")).toBe(first.headers.get("Location"));
    expect(await db.order.count({ where: { checkoutKey: body.get("key") } })).toBe(1);
  });
  test("đã đăng nhập: điền sẵn từ đơn gần nhất; chưa có đơn thì chỉ có SĐT tài khoản", async () => {
    const user = await db.user.upsert({ where: { phone: PHONE }, update: {}, create: { phone: PHONE } });
    await db.order.updateMany({ where: { phone: PHONE }, data: { userId: user.id } });
    const fresh = await db.user.create({ data: { phone: "0900000087" } });
    const prefillFor = async (userId: number) => {
      const s = await sessionStorage.getSession();
      s.set("userId", userId);
      const cookie = `${(await commitSession(s)).split(";")[0]}; ${await cartOf([[id["rau-muong"], 1]])}`;
      return (await load(cookie)).prefill;
    };
    expect(await prefillFor(user.id)).toEqual({ name: "Chị Lan", phone: PHONE, address: "12 Lê Lợi, P. Bến Nghé, Q.1" });
    expect(await prefillFor(fresh.id)).toEqual({ name: "", phone: "0900000087", address: "" });
  });
  test("POST từ trang khác bị chặn 403", async () => {
    const res = (await send(await cartOf([[id["rau-muong"], 1]]), {}, { Origin: "http://evil.test" })) as Response;
    expect(res.status).toBe(403);
  });
});
```

Thêm route trong `app/routes.ts` (ngay dưới `route("cart", "routes/cart.ts"),`):
```ts
  route("checkout", "routes/checkout.tsx"),
```

Run: `npx vitest run app/routes/checkout.test.ts`. Expected: FAIL (module `~/routes/checkout` chưa có).

- [ ] **Step 2: `app/routes/checkout.tsx`**

```tsx
import { Banknote, CircleAlert, CreditCard } from "lucide-react";
import { useEffect } from "react";
import { data, Form, redirect, type ShouldRevalidateFunction, useNavigation } from "react-router";
import { Field } from "~/components/field";
import { cartTotals } from "~/lib/cart";
import type { CartLine } from "~/lib/cart";
import { cartCookie, getCartView, readCart } from "~/lib/cart.server";
import { deliveryDays, firstOpenSlot } from "~/lib/delivery";
import { type CheckoutErrors, parseCheckoutForm } from "~/lib/forms.server";
import { formatVnd } from "~/lib/format";
import { checkoutPrefill, type PlaceOrderResult, placeOrder, takenSlots } from "~/lib/orders.server";
import { readForm } from "~/lib/security.server";
import { addGuestOrder, commitSession, getSession } from "~/lib/session.server";
import type { Route } from "./+types/checkout";

export async function loader({ request }: Route.LoaderArgs) {
  const [cart, session] = await Promise.all([readCart(request), getSession(request)]);
  const { lines } = await getCartView(cart);
  if (lines.length === 0) throw redirect("/collections/all"); // spec: giỏ rỗng thì redirect
  const now = new Date();
  const [taken, prefill] = await Promise.all([takenSlots(now), checkoutPrefill(session.get("userId"))]);
  const days = deliveryDays(now, taken);
  return {
    lines,
    totals: cartTotals(lines),
    days,
    defaultSlot: firstOpenSlot(days),
    prefill,
    // Khoá chống đặt trùng: mỗi lần trang được tải là một khoá; gửi form 2 lần với cùng khoá chỉ ra 1 đơn
    checkoutKey: crypto.randomUUID(),
  };
}

/** Lời nhắn 409: món thiếu kho (tên + số còn), món vừa hết trong giỏ, hoặc giá/giỏ vừa đổi so với tổng đã thấy. */
function conflictMessage(result: Exclude<PlaceOrderResult, { ok: true }>, lines: CartLine[]): string {
  if (result.reason === "out-of-stock") {
    return (
      result.outOfStock
        .map((i) => (i.available > 0 ? `${i.name} chỉ còn ${i.available} ${i.unit}.` : `${i.name} vừa hết hàng.`))
        .join(" ") + " Bạn sửa giỏ hàng rồi đặt lại nhé."
    );
  }
  const soldOut = lines.filter((l) => l.stock === 0).map((l) => `${l.name} vừa hết hàng.`);
  return soldOut.length
    ? `${soldOut.join(" ")} Tổng tiền đã cập nhật, bạn xem lại rồi đặt lại nhé.`
    : "Giá hoặc giỏ hàng vừa thay đổi, bạn xem lại tổng tiền rồi đặt lại nhé.";
}

export async function action({ request }: Route.ActionArgs) {
  const form = await readForm(request);
  const [cart, session] = await Promise.all([readCart(request), getSession(request)]);
  const now = new Date();
  const parsed = parseCheckoutForm(form, deliveryDays(now, await takenSlots(now)));
  if (!parsed.ok) return data({ errors: parsed.errors }, { status: 400 });

  // Dòng hết hàng (stock 0) không vào đơn và không tính tiền, giống drawer (M2 Decision 6)
  const { lines } = await getCartView(cart);
  const result = await placeOrder({
    ...parsed.data,
    userId: session.get("userId") ?? null,
    lines: lines.filter((l) => l.stock > 0).map((l) => ({ productId: l.id, qty: l.qty })),
  });
  if (!result.ok) return data({ errors: { form: [conflictMessage(result, lines)] } satisfies CheckoutErrors }, { status: 409 });

  addGuestOrder(session, result.code);
  const online = parsed.data.paymentMethod === "online_mock";
  session.flash("toast", online ? "Đã tạo đơn, mời bạn thanh toán" : "Đặt hàng thành công");
  const headers = new Headers();
  headers.append("Set-Cookie", await commitSession(session));
  headers.append("Set-Cookie", await cartCookie.serialize({ ...cart, l: [] })); // giữ `b` (giỏ quà) cho M4 quyết
  return redirect(online ? `/checkout/pay/${result.code}` : `/orders/${result.code}`, { headers });
}

// RR bỏ revalidate khi action trả ≥400. Riêng 409 (giỏ/giá vừa đổi) thì tải lại tóm tắt + nút tổng tiền mới;
// các ô đã nhập không mất vì input không điều khiển (uncontrolled).
export const shouldRevalidate: ShouldRevalidateFunction = ({ actionStatus, defaultShouldRevalidate }) =>
  actionStatus === 409 || defaultShouldRevalidate;

const chip =
  "flex min-h-11 flex-wrap cursor-pointer items-center gap-2 rounded-xl border border-line bg-surface px-3 py-2 text-sm transition-colors duration-150 ease-snappy hover:border-ink-muted has-checked:border-ink has-checked:bg-ink/5 has-disabled:cursor-not-allowed has-disabled:opacity-50 has-disabled:hover:border-line has-focus-visible:outline-2 has-focus-visible:outline-brand";

export default function Checkout({ loaderData, actionData }: Route.ComponentProps) {
  const { lines, totals, days, defaultSlot, prefill, checkoutKey } = loaderData;
  const errors: CheckoutErrors = actionData?.errors ?? {};
  const submitting = useNavigation().state === "submitting";
  const orderable = lines.filter((l) => l.stock > 0);
  const weighed = orderable.some((l) => l.isWeighed);
  const openDrawer = () => document.querySelector<HTMLDialogElement>("#cart-drawer")?.showModal();

  // Bấm nút dính đáy mà lỗi nằm ở đầu trang (375px): cuộn tới lỗi đầu tiên và đặt focus vào field đó
  useEffect(() => {
    if (!actionData?.errors) return;
    const first = document.querySelector<HTMLElement>("main [role=alert], main [aria-invalid=true]");
    first?.scrollIntoView({ block: "center" });
    if (first instanceof HTMLInputElement || first instanceof HTMLTextAreaElement) first.focus();
  }, [actionData]);

  return (
    <main className="mx-auto max-w-5xl px-4 py-6">
      <title>Thanh toán · Chợ Sáng</title>
      <h1 className="text-3xl">Thanh toán</h1>
      <p className="mt-1 text-ink-muted">Không cần tài khoản. Giao trong ngày, trả tiền khi nhận hàng.</p>

      {errors.form && (
        <div role="alert" className="mt-4 flex items-start gap-2 rounded-xl border border-danger/30 bg-surface p-3 text-sm text-danger">
          <CircleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
          <div>
            <p>{errors.form[0]}</p>
            <button type="button" onClick={openDrawer} className="mt-1 inline-flex min-h-11 items-center text-ink underline underline-offset-4 hover:text-brand">
              Sửa giỏ hàng
            </button>
          </div>
        </div>
      )}

      <Form method="post" noValidate className="mt-6 grid gap-8 md:grid-cols-[1fr_22rem] md:items-start">
        <input type="hidden" name="key" value={checkoutKey} />
        {/* Tổng khách đang thấy trên nút: server chỉ đặt đơn nếu tổng tính lại trong transaction bằng đúng số này */}
        <input type="hidden" name="total" value={totals.totalVnd} />
        <div className="space-y-8">
          <fieldset className="space-y-4">
            <legend className="mb-3 font-display text-xl font-extrabold">Người nhận</legend>
            <Field name="name" label="Họ tên" autoComplete="name" required defaultValue={prefill?.name} error={errors.name} />
            <Field name="phone" label="Số điện thoại" type="tel" inputMode="tel" autoComplete="tel" required defaultValue={prefill?.phone} error={errors.phone} />
            <Field
              multiline
              name="address"
              label="Địa chỉ giao hàng"
              rows={3}
              autoComplete="street-address"
              required
              defaultValue={prefill?.address}
              hint="Số nhà, đường, phường/xã, quận/huyện"
              error={errors.address}
            />
          </fieldset>

          <fieldset aria-describedby={errors.slot ? "slot-error" : undefined}>
            <legend className="mb-3 font-display text-xl font-extrabold">Giờ giao</legend>
            <div className="space-y-4">
              {days.map((day) => (
                <div key={day.date}>
                  <p className="mb-2 text-sm text-ink-muted">{day.label}</p>
                  <div className="grid grid-cols-2 gap-2">
                    {day.slots.map((s) => (
                      <label key={s.value} className={chip}>
                        <input type="radio" name="slot" value={s.value} disabled={s.disabled} defaultChecked={s.value === defaultSlot} className="size-4 accent-ink" />
                        <span className="whitespace-nowrap tabular-nums">{s.slot}</span>
                        {s.reason && <span className="w-full pl-6 text-xs text-ink-muted">{s.reason === "past" ? "Đã qua" : "Đã kín"}</span>}
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            {!defaultSlot && <p className="mt-2 text-sm">Hôm nay và ngày mai đã kín lịch giao. Bạn gọi hotline để hẹn giờ nhé.</p>}
            {errors.slot && (
              <p id="slot-error" className="mt-2 flex items-start gap-1.5 text-sm text-danger">
                <CircleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
                {errors.slot[0]}
              </p>
            )}
          </fieldset>

          <div className="space-y-4">
            <Field multiline name="note" label="Ghi chú cho shipper (không bắt buộc)" rows={2} maxLength={300} error={errors.note} />
            <label className="flex min-h-11 cursor-pointer items-center gap-3">
              <input type="checkbox" name="callOnSubstitute" defaultChecked className="size-5 accent-ink" />
              Gọi hỏi tôi nếu có món hết hàng
            </label>
          </div>

          <fieldset>
            <legend className="mb-3 font-display text-xl font-extrabold">Thanh toán</legend>
            <div className="grid gap-2">
              <label className={chip}>
                <input type="radio" name="paymentMethod" value="cod" defaultChecked className="size-4 accent-ink" />
                <Banknote aria-hidden className="size-5" />
                Tiền mặt khi nhận hàng (COD)
              </label>
              <label className={chip}>
                <input type="radio" name="paymentMethod" value="online_mock" className="size-4 accent-ink" />
                <CreditCard aria-hidden className="size-5" />
                Thanh toán online
                <span className="ml-auto rounded-full border border-ink px-2 text-xs font-display font-extrabold">DEMO</span>
              </label>
            </div>
          </fieldset>
        </div>

        {/* Điện thoại: `contents` để nút dính đáy suốt cả form. Máy tính: tóm tắt + nút dính cột phải */}
        <div className="contents md:sticky md:top-20 md:block md:space-y-4">
          <aside aria-labelledby="checkout-summary" className="rounded-2xl border border-line bg-surface p-4">
            <h2 id="checkout-summary" className="text-xl">
              Đơn hàng ({orderable.reduce((n, l) => n + l.qty, 0)} món)
            </h2>
            <ul className="mt-3 divide-y divide-line text-sm">
              {lines.map((l) => (
                <li key={l.id} className="flex justify-between gap-3 py-2">
                  <div className="min-w-0">
                    <p className={l.stock === 0 ? "text-ink-muted line-through" : ""}>
                      {l.name} × {l.qty}
                    </p>
                    <p className="text-xs text-ink-muted">
                      {l.stock === 0 ? "Tạm hết hàng, không tính vào đơn" : `${l.unit}${l.isWeighed ? " · tạm tính ±10%" : ""}`}
                    </p>
                  </div>
                  <p className={`shrink-0 tabular-nums ${l.stock === 0 ? "text-ink-muted line-through" : ""}`}>{formatVnd(l.priceVnd * l.qty)}</p>
                </li>
              ))}
            </ul>
            <dl className="mt-3 space-y-1 border-t border-line pt-3 text-sm">
              <div className="flex justify-between">
                <dt>Tạm tính</dt>
                <dd className="tabular-nums">{formatVnd(totals.subtotalVnd)}</dd>
              </div>
              <div className="flex justify-between">
                <dt>Phí giao hàng</dt>
                <dd className="tabular-nums">{totals.shippingVnd === 0 ? "Miễn phí" : formatVnd(totals.shippingVnd)}</dd>
              </div>
              <div className="flex justify-between text-base">
                <dt className="font-display font-extrabold">Tổng</dt>
                <dd className="font-display font-extrabold text-brand tabular-nums">{formatVnd(totals.totalVnd)}</dd>
              </div>
            </dl>
            {weighed && <p className="mt-2 text-xs text-ink-muted">Giá tạm tính, cân thực tế ±10%. Shop báo lại số tiền chính xác khi soạn hàng.</p>}
          </aside>

          {/* Nút đặt hàng dính đáy trên điện thoại: luôn thấy tổng tiền */}
          <div className="sticky bottom-0 -mx-4 border-t border-line bg-bg/95 px-4 py-3 backdrop-blur md:static md:mx-0 md:border-0 md:bg-transparent md:p-0">
            <button
              type="submit"
              disabled={submitting || orderable.length === 0 || !defaultSlot}
              className="flex min-h-12 w-full items-center justify-center rounded-full bg-brand px-6 font-display text-lg font-extrabold text-surface transition-colors duration-150 ease-snappy hover:bg-brand-press disabled:bg-line disabled:text-ink-muted"
            >
              {submitting ? "Đang đặt hàng…" : <>Đặt hàng · <span className="ml-1 tabular-nums">{formatVnd(totals.totalVnd)}</span></>}
            </button>
          </div>
        </div>
      </Form>
    </main>
  );
}
```

Ghi chú: `total` ẩn + `expectedTotalVnd` bảo đảm khách chỉ bị tính đúng tổng đã thấy (Decision 20); `shouldRevalidate` bật lại revalidate cho riêng 409. Bố cục: ở điện thoại, khối bao tóm tắt + nút là `contents` nên nút `sticky bottom-0` dính đáy suốt cả form (luôn thấy "Đặt hàng · tổng"); ở `md` khối đó thành cột phải `sticky top-20`, nút nằm ngay dưới tóm tắt. Bấm nút khi lỗi nằm ở đầu trang thì `useEffect` cuộn tới lỗi đầu tiên và focus field đó.

Run: `npx react-router typegen && npx vitest run app/routes/checkout.test.ts`. Expected: PASS (12 tests: loader 2, action 10). Ba test "giá đổi sau khi khách xem trang", "món duy nhất vừa hết…" và "gửi lại form sau khi đơn đã tạo" là của cổng plan M3 (Decision 20).

- [ ] **Step 3: Checkpoint**: `npm run typecheck && npm test`. Expected: **175** test (163 + 12).

- [ ] **Step 4: Kiểm nhanh trên bản build production nối DB test**

```bash
npm run build
TEST_URL=$(node -e 'process.loadEnvFile(); const u = new URL(process.env.DATABASE_URL); u.pathname = "/chosang_test"; console.log(u.href)')
PORT=3100 NODE_ENV=production DATABASE_URL=$TEST_URL SESSION_SECRET=e2e-chi-dung-cho-playwright-0123456789abcdef DEMO_OTP=1 ADMIN_PASSCODE=e2e-ma-quan-tri-2026 npm start &
sleep 3
PID=$(docker compose exec -T db psql -U chosang -d chosang_test -tAc "select id from \"Product\" where slug='rau-muong'")
JAR=$(mktemp)
curl -s -o /dev/null -w '%{http_code} %{redirect_url}\n' localhost:3100/checkout
curl -s -c "$JAR" -X POST -d "intent=set&pid=$PID&qty=2" localhost:3100/cart > /dev/null
curl -s -b "$JAR" localhost:3100/checkout > "$JAR.html"
grep -o 'Đặt hàng · [^/]*' "$JAR.html" | head -1
grep -c 'Giá tạm tính, cân thực tế ±10%' "$JAR.html"
grep -o 'name="key" value="[0-9a-f-]*"' "$JAR.html"
rm -f "$JAR" "$JAR.html"
```
Expected: `302 http://localhost:3100/collections/all`; `Đặt hàng · <span class="ml-1 tabular-nums">50.000₫<` (2 × 15.000₫ + ship 20.000₫); `1`; `name="key" value="<uuid>"`. Dừng server (PID cổng 3100). Toàn bộ luồng trên trình duyệt (đặt COD, đặt trùng, tranh món cuối) được kiểm ở Task 7.

---

### Task 6: Cổng thanh toán giả lập, trang đơn (timeline, huỷ, mua lại, hotline), `/orders` + tra cứu

**Files:**
- Create: `app/routes/checkout-pay.tsx`, `app/routes/order.tsx`, `app/routes/orders.tsx`, `app/routes/order.test.ts`
- Modify: `app/routes/checkout.test.ts` (thêm khối `/checkout/pay/:code`), `app/routes.ts`

**Interfaces:**
- Consumes: `getOrder`, `isPaymentStep`, `setOnlinePayment`, `cancelOrder`, `findOrderForPhone`, `reorderQuantities`, `toOrderView`, `listOrders` (Task 3); `getSession`, `commitSession`, `addGuestOrder`, `canViewOrder`, `getUser`, `parsePhone`, `Field` (Task 4); `readCart`, `setQuantities`, `cartCookie` (M2); `readForm` (Task 2); `HOTLINE_DISPLAY`, `HOTLINE_TEL`, `CART_MAX_LINES`
- Produces:
  - `GET /checkout/pay/:code` → `{ code, totalVnd, failed: boolean }`, hoặc 302 `/orders/:code` nếu không có quyền / không phải đơn online còn chờ trả. `POST` intent `pay | fail | retry | cod`.
  - `GET /orders/:code` → `{ code, order: OrderView | null, loggedIn: boolean }` (`order: null` cho cả "không có quyền" lẫn "không tồn tại"). `POST` intent `lookup` (field `phone`) | `cancel` | `reorder` (redirect `/checkout`, hoặc thẳng `/collections/all` khi mọi món đã hết để toast không bị nuốt bởi redirect thứ hai: gợi ý tuỳ chọn 3 của cổng plan).
  - `GET /orders` → `{ orders: { code, createdAt, totalVnd, statusLabel, itemCount }[], phone: string | null }`. `POST` (field `code`, `phone`) tra cứu.

- [ ] **Step 1: Viết test fail cho trang đơn + danh sách**

`app/routes/order.test.ts`:
```ts
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { readCart } from "~/lib/cart.server";
import { db } from "~/lib/db.server";
import { placeOrder } from "~/lib/orders.server";
import { commitSession, getSession, sessionStorage } from "~/lib/session.server";
import { action, loader } from "~/routes/order";
import { action as ordersAction, loader as ordersLoader } from "~/routes/orders";

// DB test đã seed. Đơn tạo thẳng bằng placeOrder để test quyền xem/huỷ/mua lại của trang đơn.
const PHONE = "0900000066";
let code = "";
let rauMuong = 0;

beforeAll(async () => {
  rauMuong = (await db.product.findUniqueOrThrow({ where: { slug: "rau-muong" } })).id;
  const placed = await placeOrder({
    checkoutKey: crypto.randomUUID(), userId: null, customerName: "Chị Mai", phone: PHONE, address: "34 Hai Bà Trưng, Q.3",
    note: "", callOnSubstitute: false, deliveryDate: "2026-10-16", deliverySlot: "08:00–10:00", paymentMethod: "cod",
    lines: [{ productId: rauMuong, qty: 3 }],
    expectedTotalVnd: 65000, // 3 × 15.000₫ + ship 20.000₫
  });
  if (!placed.ok) throw new Error("không tạo được đơn test");
  code = placed.code;
});
afterAll(async () => {
  await db.order.deleteMany({ where: { phone: PHONE } });
  await db.$disconnect();
});

const req = (cookie = "", body?: Record<string, string>) =>
  new Request(`http://localhost/orders/${code}`, body ? { method: "POST", body: new URLSearchParams(body), headers: { Cookie: cookie } } : { headers: { Cookie: cookie } });
const view = (cookie = "") => loader({ request: req(cookie), params: { code } } as Parameters<typeof loader>[0]);
const act = (cookie: string, body: Record<string, string>) =>
  action({ request: req(cookie, body), params: { code } } as Parameters<typeof action>[0]).catch((e: unknown) => e);
const cookiesOf = (res: Response) => res.headers.getSetCookie().map((c) => c.split(";")[0]).join("; ");
const ownerCookie = async () => {
  const s = await sessionStorage.getSession();
  s.set("guestOrderCodes", [code]);
  return (await commitSession(s)).split(";")[0];
};

describe("/orders/:code (chống IDOR)", () => {
  test("người lạ chỉ thấy form nhập SĐT: không lộ tên, SĐT, địa chỉ; mã không tồn tại trả cùng một màn", async () => {
    const stranger = await view();
    expect(stranger).toEqual({ code, order: null, loggedIn: false });
    expect(JSON.stringify(stranger)).not.toContain("Hai Bà Trưng");
    const missing = await loader({ request: new Request("http://localhost/orders/DH000000ZZZZ"), params: { code: "DH000000ZZZZ" } } as Parameters<typeof loader>[0]);
    expect(missing).toEqual({ code: "DH000000ZZZZ", order: null, loggedIn: false });
  });
  test("tra sai SĐT: 400, không ghi phiên; đúng SĐT (khác định dạng): phiên nhớ mã và xem được đơn", async () => {
    expect(await act("", { intent: "lookup", phone: "0900000000" })).toMatchObject({ init: { status: 400 }, data: { error: "Số điện thoại không khớp với mã đơn này." } });
    const res = (await act("", { intent: "lookup", phone: "0900 000 066" })) as Response;
    expect(res.headers.get("Location")).toBe(`/orders/${code}`);
    const seen = await view(cookiesOf(res));
    expect(seen.order).toMatchObject({ code, address: "34 Hai Bà Trưng, Q.3", status: "pending" });
    expect(seen.order?.timeline.map((s) => s.at !== null)).toEqual([true, false, false, false]);
  });
  test("người lạ không huỷ được đơn của người khác (404), kho giữ nguyên", async () => {
    const before = (await db.product.findUniqueOrThrow({ where: { id: rauMuong } })).stock;
    const res = (await act("", { intent: "cancel" })) as Response;
    expect(res.status).toBe(404);
    expect((await db.order.findUniqueOrThrow({ where: { code } })).status).toBe("pending");
    expect((await db.product.findUniqueOrThrow({ where: { id: rauMuong } })).stock).toBe(before);
  });
  test("Mua lại: giỏ có lại các món của đơn, chuyển sang /checkout kèm toast", async () => {
    const res = (await act(await ownerCookie(), { intent: "reorder" })) as Response;
    expect(res.headers.get("Location")).toBe("/checkout");
    const next = new Request("http://localhost/", { headers: { Cookie: cookiesOf(res) } });
    expect((await readCart(next)).l).toEqual([[rauMuong, 3]]);
    expect((await getSession(next)).get("toast")).toBe("Đã thêm lại các món vào giỏ");
  });
  test("chủ đơn huỷ khi còn pending: hoàn kho; huỷ lần nữa báo không huỷ được", async () => {
    const cookie = await ownerCookie();
    const before = (await db.product.findUniqueOrThrow({ where: { id: rauMuong } })).stock;
    await act(cookie, { intent: "cancel" });
    expect((await db.order.findUniqueOrThrow({ where: { code } })).status).toBe("cancelled");
    expect((await db.product.findUniqueOrThrow({ where: { id: rauMuong } })).stock).toBe(before + 3);
    const again = (await act(cookie, { intent: "cancel" })) as Response;
    expect((await getSession(new Request("http://localhost/", { headers: { Cookie: cookiesOf(again) } }))).get("toast")).toMatch(/không huỷ được/);
  });
});

describe("/orders", () => {
  test("khách: chỉ liệt kê đơn có mã trong phiên", async () => {
    expect((await ordersLoader({ request: new Request("http://localhost/orders") } as Parameters<typeof ordersLoader>[0])).orders).toEqual([]);
    const mine = await ordersLoader({ request: new Request("http://localhost/orders", { headers: { Cookie: await ownerCookie() } }) } as Parameters<typeof ordersLoader>[0]);
    expect(mine.orders.map((o) => o.code)).toEqual([code]);
  });
  test("tra cứu mã + SĐT: đúng thì về trang đơn, sai mã hay sai SĐT cùng một lời nhắn", async () => {
    const lookup = (body: Record<string, string>) =>
      ordersAction({
        request: new Request("http://localhost/orders", { method: "POST", body: new URLSearchParams(body) }),
      } as Parameters<typeof ordersAction>[0]);
    const ok = (await lookup({ code: code.toLowerCase(), phone: PHONE })) as Response;
    expect(ok.headers.get("Location")).toBe(`/orders/${code}`);
    const wrongPhone = await lookup({ code, phone: "0911111111" });
    const wrongCode = await lookup({ code: "DH000000ZZZZ", phone: PHONE });
    expect(wrongPhone).toEqual(wrongCode);
  });
});
```

Thêm vào cuối `app/routes/checkout.test.ts`:
```ts

describe("/checkout/pay/:code", () => {
  const placeOnline = async () => {
    const res = (await send(await cartOf([[id["rau-muong"], 1]]), { paymentMethod: "online_mock" })) as Response;
    const code = res.headers.get("Location")!.split("/").at(-1)!;
    return { code, cookie: cookiesOf(res) };
  };
  const pay = (code: string, cookie: string, intent: string) =>
    payAction({
      request: new Request(`http://localhost/checkout/pay/${code}`, { method: "POST", body: new URLSearchParams({ intent }), headers: { Cookie: cookie } }),
      params: { code },
    } as Parameters<typeof payAction>[0]).catch((e: unknown) => e) as Promise<Response>;

  test("người lạ (không có mã trong phiên) bị đưa về trang đơn, không thấy số tiền", async () => {
    const { code } = await placeOnline();
    const res = await payLoader({ request: new Request(`http://localhost/checkout/pay/${code}`), params: { code } } as Parameters<typeof payLoader>[0]).catch((e) => e);
    expect([res.status, res.headers.get("Location")]).toEqual([302, `/orders/${code}`]);
    expect((await pay(code, "", "pay")).headers.get("Location")).toBe(`/orders/${code}`);
    expect((await db.order.findUniqueOrThrow({ where: { code } })).paymentStatus).toBe("unpaid");
  });
  test("thất bại → ở lại cổng; thử lại; thành công → về trang đơn, đã thanh toán", async () => {
    const { code, cookie } = await placeOnline();
    expect((await pay(code, cookie, "fail")).headers.get("Location")).toBe(`/checkout/pay/${code}`);
    const failed = await payLoader({ request: new Request(`http://localhost/checkout/pay/${code}`, { headers: { Cookie: cookie } }), params: { code } } as Parameters<typeof payLoader>[0]);
    expect(failed).toMatchObject({ code, failed: true });
    await pay(code, cookie, "retry");
    expect((await pay(code, cookie, "pay")).headers.get("Location")).toBe(`/orders/${code}`);
    expect((await db.order.findUniqueOrThrow({ where: { code } })).paymentStatus).toBe("paid");
  });
});
```
và thêm import, ngay **trên** dòng `import { action, loader } from "~/routes/checkout";`:
```ts
import { action as payAction, loader as payLoader } from "~/routes/checkout-pay";
```

Thêm route trong `app/routes.ts` (ngay dưới `route("checkout", "routes/checkout.tsx"),`):
```ts
  route("checkout/pay/:code", "routes/checkout-pay.tsx"),
  route("orders", "routes/orders.tsx"),
  route("orders/:code", "routes/order.tsx"),
```

Run: `npx vitest run app/routes/order.test.ts app/routes/checkout.test.ts`. Expected: FAIL (các module route chưa có).

- [ ] **Step 2: `app/routes/checkout-pay.tsx`**

```tsx
import { CircleX, Clock } from "lucide-react";
import { Form, redirect, useNavigation } from "react-router";
import { formatVnd } from "~/lib/format";
import { getOrder, isPaymentStep, setOnlinePayment } from "~/lib/orders.server";
import { readForm } from "~/lib/security.server";
import { canViewOrder, commitSession, getSession } from "~/lib/session.server";
import type { Route } from "./+types/checkout-pay";

/** Đơn online còn chờ trả và người xem có quyền; mọi trường hợp khác về trang đơn (trang đó tự hỏi SĐT nếu cần). */
async function payableOrder(request: Request, code: string) {
  const [order, session] = await Promise.all([getOrder(code), getSession(request)]);
  const payable =
    order && canViewOrder(session, order) && order.status === "pending" && order.paymentMethod === "online_mock" && order.paymentStatus !== "paid";
  if (!payable) throw redirect(`/orders/${encodeURIComponent(code)}`);
  return { order, session };
}

export async function loader({ request, params }: Route.LoaderArgs) {
  const { order } = await payableOrder(request, params.code);
  return { code: order.code, totalVnd: order.totalVnd, failed: order.paymentStatus === "failed" };
}

/** intent: pay (thành công) | fail (giả lập thất bại) | retry (thử lại) | cod (chuyển sang trả tiền mặt). */
export async function action({ request, params }: Route.ActionArgs) {
  const form = await readForm(request);
  const { order, session } = await payableOrder(request, params.code);
  const step = form.get("intent");
  if (!isPaymentStep(step)) throw new Response("Yêu cầu không hợp lệ.", { status: 400 });
  const changed = await setOnlinePayment(order.id, step);
  if (changed && (step === "fail" || step === "retry")) return redirect(`/checkout/pay/${order.code}`);
  if (changed) session.flash("toast", step === "pay" ? "Thanh toán thành công (DEMO)" : "Đã chuyển sang trả tiền mặt khi nhận hàng");
  return redirect(`/orders/${order.code}`, { headers: { "Set-Cookie": await commitSession(session) } });
}

const primary =
  "inline-flex min-h-12 w-full items-center justify-center rounded-full bg-brand px-6 font-display font-extrabold text-surface transition-colors duration-150 ease-snappy hover:bg-brand-press disabled:opacity-60";
const secondary =
  "inline-flex min-h-12 w-full items-center justify-center rounded-full border border-ink px-6 transition-colors duration-150 ease-snappy hover:bg-ink/5 disabled:opacity-60";

export default function Pay({ loaderData }: Route.ComponentProps) {
  const { code, totalVnd, failed } = loaderData;
  const busy = useNavigation().state === "submitting";
  return (
    <main className="mx-auto max-w-md px-4 py-6">
      <title>Thanh toán online (DEMO) · Chợ Sáng</title>
      {/* Spec: mọi màn thanh toán giả lập có nhãn DEMO */}
      <p role="note" className="rounded-xl border-2 border-dashed border-ink px-4 py-3 text-center font-display font-extrabold">
        DEMO, không trừ tiền thật
      </p>
      <h1 className="mt-6 text-2xl">Thanh toán đơn {code}</h1>
      <p className="mt-2 font-display text-4xl font-extrabold text-brand tabular-nums">{formatVnd(totalVnd)}</p>

      <Form method="post" className="mt-6 space-y-3">
        {failed ? (
          <>
            <p role="alert" className="flex items-start gap-2">
              <CircleX aria-hidden className="mt-0.5 size-5 shrink-0" />
              Thanh toán chưa thành công. Đơn và hàng vẫn được giữ cho bạn.
            </p>
            <button name="intent" value="retry" disabled={busy} className={primary}>
              Thử lại
            </button>
            <button name="intent" value="cod" disabled={busy} className={secondary}>
              Chuyển sang trả tiền mặt (COD)
            </button>
          </>
        ) : (
          <>
            <p className="flex items-center gap-2 text-ink-muted">
              <Clock aria-hidden className="size-5" />
              {busy ? "Đang xử lý thanh toán…" : "Đang chờ bạn xác nhận thanh toán"}
            </p>
            <button name="intent" value="pay" disabled={busy} className={primary}>
              Thanh toán {formatVnd(totalVnd)}
            </button>
            <button name="intent" value="fail" disabled={busy} className={secondary}>
              Giả lập thanh toán thất bại
            </button>
            <button name="intent" value="cod" disabled={busy} className="inline-flex min-h-11 w-full items-center justify-center text-sm underline underline-offset-4 hover:text-brand">
              Đổi sang trả tiền mặt khi nhận hàng
            </button>
          </>
        )}
      </Form>
    </main>
  );
}
```

- [ ] **Step 3: `app/routes/order.tsx`**

```tsx
import { Check, CircleX, Phone, RotateCcw } from "lucide-react";
import { data, Form, Link, redirect, useNavigation } from "react-router";
import { Field } from "~/components/field";
import { cartCookie, readCart, setQuantities } from "~/lib/cart.server";
import { CART_MAX_LINES, HOTLINE_DISPLAY, HOTLINE_TEL } from "~/lib/config";
import { formatVnd } from "~/lib/format";
import { parsePhone } from "~/lib/forms.server";
import { cancelOrder, findOrderForPhone, getOrder, reorderQuantities, toOrderView } from "~/lib/orders.server";
import { readForm } from "~/lib/security.server";
import { addGuestOrder, canViewOrder, commitSession, getSession } from "~/lib/session.server";
import type { Route } from "./+types/order";

export async function loader({ request, params }: Route.LoaderArgs) {
  const [order, session] = await Promise.all([getOrder(params.code), getSession(request)]);
  // Không có quyền và không tồn tại trả CÙNG một màn (form nhập SĐT): không lộ mã nào là đơn thật (chống IDOR)
  const visible = order && canViewOrder(session, order) ? toOrderView(order) : null;
  return { code: params.code, order: visible, loggedIn: session.has("userId") };
}

const NO_MATCH = "Số điện thoại không khớp với mã đơn này.";

/** intent: lookup (khách nhập SĐT để xem), cancel (huỷ khi còn pending, hoàn kho), reorder ("Mua lại đơn này"). */
export async function action({ request, params }: Route.ActionArgs) {
  const form = await readForm(request);
  const session = await getSession(request);
  const intent = form.get("intent");

  if (intent === "lookup") {
    const phone = parsePhone(form.get("phone"));
    const found = phone && (await findOrderForPhone(params.code, phone));
    if (!found) return data({ error: NO_MATCH }, { status: 400 });
    addGuestOrder(session, found.code);
    return redirect(`/orders/${found.code}`, { headers: { "Set-Cookie": await commitSession(session) } });
  }

  const order = await getOrder(params.code);
  if (!order || !canViewOrder(session, order)) throw new Response("Không tìm thấy đơn hàng.", { status: 404 });

  if (intent === "cancel") {
    const cancelled = await cancelOrder(order.id);
    session.flash("toast", cancelled ? "Đã huỷ đơn" : "Đơn đã được xử lý nên không huỷ được nữa, bạn gọi hotline giúp mình nhé.");
    return redirect(`/orders/${order.code}`, { headers: { "Set-Cookie": await commitSession(session) } });
  }
  if (intent === "reorder") {
    const changes = await reorderQuantities(order.id);
    const cart = setQuantities(await readCart(request), changes);
    if (!cart) return data({ error: `Giỏ hàng chỉ chứa tối đa ${CART_MAX_LINES} món khác nhau.` }, { status: 400 });
    session.flash("toast", changes.length ? "Đã thêm lại các món vào giỏ" : "Các món trong đơn này đều đã hết hàng");
    const headers = new Headers();
    headers.append("Set-Cookie", await commitSession(session));
    headers.append("Set-Cookie", await cartCookie.serialize(cart));
    // Mọi món đã hết: đi thẳng tới trang sản phẩm (qua /checkout sẽ bị redirect lần nữa và mất toast)
    return redirect(changes.length ? "/checkout" : "/collections/all", { headers });
  }
  return data({ error: "Yêu cầu không hợp lệ." }, { status: 400 });
}

const secondary =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-ink px-5 transition-colors duration-150 ease-snappy hover:bg-ink/5";

export default function Order({ loaderData, actionData }: Route.ComponentProps) {
  const { code, order, loggedIn } = loaderData;
  const busy = useNavigation().state === "submitting";

  if (!order) {
    return (
      <main className="mx-auto max-w-md px-4 py-8">
        <title>Tra cứu đơn · Chợ Sáng</title>
        <h1 className="text-2xl">Đơn {code}</h1>
        <p className="mt-2 text-ink-muted">Nhập số điện thoại đã dùng khi đặt để xem đơn này.</p>
        <Form method="post" noValidate className="mt-4 space-y-3">
          <Field name="phone" label="Số điện thoại đặt hàng" type="tel" inputMode="tel" autoComplete="tel" error={actionData?.error ? [actionData.error] : undefined} />
          <button name="intent" value="lookup" disabled={busy} className="inline-flex min-h-12 w-full items-center justify-center rounded-full bg-brand px-6 font-display font-extrabold text-surface transition-colors duration-150 ease-snappy hover:bg-brand-press">
            Xem đơn
          </button>
        </Form>
      </main>
    );
  }

  const step = order.timeline.filter((s) => s.at).length; // số bước đã qua
  return (
    <main className="mx-auto max-w-2xl px-4 py-6">
      <title>{`Đơn ${order.code} · Chợ Sáng`}</title>
      <p className="text-sm text-ink-muted">Đơn hàng · đặt lúc {order.createdAt}</p>
      <h1 className="text-3xl tabular-nums">{order.code}</h1>
      <p className="mt-1">{order.statusLabel}</p>

      {!loggedIn && (
        <div className="mt-4 rounded-2xl border border-line bg-surface p-4">
          <p className="text-sm">Lưu đơn vào tài khoản để xem lại trên máy khác. Chỉ cần số điện thoại.</p>
          <Link
            to={`/login?phone=${encodeURIComponent(order.phone)}&redirectTo=${encodeURIComponent(`/orders/${order.code}`)}`}
            className={`${secondary} mt-3`}
          >
            Lưu đơn vào tài khoản
          </Link>
        </div>
      )}

      {order.status === "cancelled" ? (
        <p className="mt-6 flex items-center gap-2 rounded-2xl border border-line bg-surface p-4">
          <CircleX aria-hidden className="size-5 shrink-0" />
          Đơn đã huỷ lúc {order.cancelledAt}. Hàng đã được trả lại kho.
        </p>
      ) : (
        <ol aria-label="Tiến trình đơn hàng" className="mt-6 space-y-0">
          {order.timeline.map((s, i) => (
            <li key={s.label} aria-current={i === step - 1 ? "step" : undefined} className="relative flex gap-3 pb-5 last:pb-0">
              {i < order.timeline.length - 1 && (
                <span aria-hidden className={`absolute top-8 bottom-0 left-[0.9375rem] w-0.5 ${s.at && order.timeline[i + 1].at ? "bg-fresh" : "bg-line"}`} />
              )}
              <span
                aria-hidden
                className={`relative flex size-8 shrink-0 items-center justify-center rounded-full ${s.at ? "bg-fresh text-surface" : "border-2 border-line bg-surface"}`}
              >
                {s.at && <Check className="size-4" />}
              </span>
              <div className="pt-1">
                <p className={s.at ? "" : "text-ink-muted"}>{s.label}</p>
                <p className="text-sm text-ink-muted tabular-nums">{s.at ?? "Chưa tới"}</p>
              </div>
            </li>
          ))}
        </ol>
      )}

      {order.paymentMethod === "online_mock" && (
        <p className="mt-6 text-sm">
          Thanh toán online (DEMO): {order.paymentLabel}.{" "}
          {order.status === "pending" && order.paymentStatus !== "paid" && (
            <Link to={`/checkout/pay/${order.code}`} className="underline underline-offset-4 hover:text-brand">
              Tiếp tục thanh toán
            </Link>
          )}
        </p>
      )}

      <section aria-labelledby="order-delivery" className="mt-6 rounded-2xl border border-line bg-surface p-4 text-sm">
        <h2 id="order-delivery" className="text-lg">Giao hàng</h2>
        <p className="mt-2">{order.delivery}</p>
        <p>
          {order.customerName} · {order.phone}
        </p>
        <p>{order.address}</p>
        {order.note && <p className="text-ink-muted">Ghi chú: {order.note}</p>}
        <p className="text-ink-muted">{order.callOnSubstitute ? "Shop sẽ gọi hỏi nếu có món hết hàng." : "Món hết hàng sẽ được bỏ ra, không gọi hỏi."}</p>
        <p className="text-ink-muted">{order.paymentMethod === "cod" ? "Trả tiền mặt khi nhận hàng" : "Thanh toán online (DEMO)"}</p>
      </section>

      <section aria-labelledby="order-items" className="mt-4 rounded-2xl border border-line bg-surface p-4 text-sm">
        <h2 id="order-items" className="text-lg">Các món</h2>
        <ul className="mt-2 divide-y divide-line">
          {order.items.map((i) => (
            <li key={i.id} className="flex justify-between gap-3 py-2">
              <span>
                {i.name} × {i.qty} <span className="text-ink-muted">({i.unit})</span>
              </span>
              <span className="tabular-nums">{formatVnd(i.priceVnd * i.qty)}</span>
            </li>
          ))}
        </ul>
        <dl className="mt-2 space-y-1 border-t border-line pt-2">
          <div className="flex justify-between">
            <dt>Tạm tính</dt>
            <dd className="tabular-nums">{formatVnd(order.subtotalVnd)}</dd>
          </div>
          <div className="flex justify-between">
            <dt>Phí giao hàng</dt>
            <dd className="tabular-nums">{order.shippingVnd === 0 ? "Miễn phí" : formatVnd(order.shippingVnd)}</dd>
          </div>
          <div className="flex justify-between text-base">
            <dt className="font-display font-extrabold">Tổng</dt>
            <dd className="font-display font-extrabold text-brand tabular-nums">{formatVnd(order.totalVnd)}</dd>
          </div>
        </dl>
      </section>

      {actionData?.error && (
        <p role="alert" className="mt-4 text-sm text-danger">
          {actionData.error}
        </p>
      )}

      <div className="mt-6 flex flex-wrap gap-3">
        <Form method="post">
          <button name="intent" value="reorder" disabled={busy} className="inline-flex min-h-11 items-center gap-2 rounded-full bg-brand px-5 font-display font-extrabold text-surface transition-colors duration-150 ease-snappy hover:bg-brand-press">
            <RotateCcw aria-hidden className="size-5" />
            Mua lại đơn này
          </button>
        </Form>
        {order.status === "pending" && (
          <Form
            method="post"
            onSubmit={(e) => {
              if (!confirm("Huỷ đơn này? Hàng sẽ được trả lại kho.")) e.preventDefault();
            }}
          >
            <button name="intent" value="cancel" disabled={busy} className={secondary}>
              Huỷ đơn
            </button>
          </Form>
        )}
        <a href={`tel:${HOTLINE_TEL}`} className={secondary}>
          <Phone aria-hidden className="size-5" />
          Hotline {HOTLINE_DISPLAY}
        </a>
      </div>
    </main>
  );
}
```

- [ ] **Step 4: `app/routes/orders.tsx`**

```tsx
import { ChevronRight, LogOut } from "lucide-react";
import { data, Form, Link, redirect } from "react-router";
import { Field } from "~/components/field";
import { formatVnd } from "~/lib/format";
import { parsePhone } from "~/lib/forms.server";
import { findOrderForPhone, listOrders } from "~/lib/orders.server";
import { readForm } from "~/lib/security.server";
import { addGuestOrder, commitSession, getSession, getUser } from "~/lib/session.server";
import type { Route } from "./+types/orders";

export async function loader({ request }: Route.LoaderArgs) {
  const session = await getSession(request);
  const user = await getUser(session);
  const orders = user ? await listOrders({ userId: user.id }) : await listOrders({ codes: session.get("guestOrderCodes") ?? [] });
  return { orders, phone: user?.phone ?? null };
}

/** Tra đơn bằng mã + SĐT. Sai mã hay sai SĐT cùng một lời nhắn. */
export async function action({ request }: Route.ActionArgs) {
  const form = await readForm(request);
  const phone = parsePhone(form.get("phone"));
  const code = String(form.get("code") ?? "");
  const found = phone && code && (await findOrderForPhone(code, phone));
  if (!found) return data({ error: "Không tìm thấy đơn với mã và số điện thoại này." }, { status: 400 });
  const session = await getSession(request);
  addGuestOrder(session, found.code);
  return redirect(`/orders/${found.code}`, { headers: { "Set-Cookie": await commitSession(session) } });
}

export default function Orders({ loaderData, actionData }: Route.ComponentProps) {
  const { orders, phone } = loaderData;
  return (
    <main className="mx-auto max-w-2xl px-4 py-6">
      <title>Đơn hàng · Chợ Sáng</title>
      <h1 className="text-3xl">Đơn hàng của bạn</h1>
      {phone ? (
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
          <p className="text-ink-muted">Đang đăng nhập bằng {phone}</p>
          <Form method="post" action="/logout">
            <input type="hidden" name="redirectTo" value="/" />
            <button className="inline-flex min-h-11 items-center gap-2 rounded-full px-3 text-sm transition-colors duration-150 ease-snappy hover:bg-ink/5">
              <LogOut aria-hidden className="size-4" />
              Đăng xuất
            </button>
          </Form>
        </div>
      ) : (
        <p className="mt-2 text-ink-muted">
          Đơn đặt trên máy này hiện ở đây.{" "}
          <Link to="/login?redirectTo=%2Forders" className="underline underline-offset-4 hover:text-brand">
            Đăng nhập
          </Link>{" "}
          để xem mọi đơn của số điện thoại bạn.
        </p>
      )}

      {orders.length === 0 ? (
        <p className="mt-6 rounded-2xl border border-line bg-surface p-4">Chưa có đơn nào.</p>
      ) : (
        <ul className="mt-6 space-y-3">
          {orders.map((o) => (
            <li key={o.code}>
              <Link
                to={`/orders/${o.code}`}
                className="flex min-h-11 items-center gap-3 rounded-2xl border border-line bg-surface p-4 transition-colors duration-150 ease-snappy hover:border-ink-muted"
              >
                <div className="min-w-0 flex-1">
                  <p className="font-display font-extrabold tabular-nums">{o.code}</p>
                  <p className="text-sm text-ink-muted">
                    {o.createdAt} · {o.itemCount} món · {o.statusLabel}
                  </p>
                </div>
                <p className="font-display font-extrabold text-brand tabular-nums">{formatVnd(o.totalVnd)}</p>
                <ChevronRight aria-hidden className="size-5 text-ink-muted" />
              </Link>
            </li>
          ))}
        </ul>
      )}

      {!phone && (
        <section aria-labelledby="lookup-title" className="mt-8 rounded-2xl border border-line bg-surface p-4">
          <h2 id="lookup-title" className="text-xl">Tra cứu đơn</h2>
          <Form method="post" noValidate className="mt-3 space-y-3">
            <Field name="code" label="Mã đơn" placeholder="VD: DH261015ABCD" autoCapitalize="characters" autoComplete="off" />
            <Field name="phone" label="Số điện thoại đặt hàng" type="tel" inputMode="tel" autoComplete="tel" error={actionData?.error ? [actionData.error] : undefined} />
            <button className="inline-flex min-h-11 items-center rounded-full border border-ink px-5 transition-colors duration-150 ease-snappy hover:bg-ink/5">Tra cứu</button>
          </Form>
        </section>
      )}
    </main>
  );
}
```

Run: `npx react-router typegen && npx vitest run app/routes/order.test.ts app/routes/checkout.test.ts`. Expected: PASS (order 7 + checkout 14).

- [ ] **Step 5: Checkpoint**: `npm run typecheck && npm test`. Expected: **184** test (175 + 7 order + 2 pay).

- [ ] **Step 6: Kiểm nhanh IDOR bằng curl trên bản build production nối DB test**

```bash
npm run build
TEST_URL=$(node -e 'process.loadEnvFile(); const u = new URL(process.env.DATABASE_URL); u.pathname = "/chosang_test"; console.log(u.href)')
PORT=3100 NODE_ENV=production DATABASE_URL=$TEST_URL SESSION_SECRET=e2e-chi-dung-cho-playwright-0123456789abcdef DEMO_OTP=1 ADMIN_PASSCODE=e2e-ma-quan-tri-2026 npm start &
sleep 3
for u in /orders /orders/DH000000ZZZZ /checkout/pay/DH000000ZZZZ; do curl -s -o /dev/null -w "$u %{http_code} %{redirect_url}\n" localhost:3100$u; done
curl -s localhost:3100/orders/DH000000ZZZZ | grep -o 'Nhập số điện thoại đã dùng khi đặt để xem đơn này.'
curl -s -o /dev/null -w '%{http_code}\n' -X POST -d 'intent=cancel' localhost:3100/orders/DH000000ZZZZ
```
Expected: `/orders 200`; `/orders/DH000000ZZZZ 200` (màn tra cứu, không phải 404: không lộ mã nào có thật); `/checkout/pay/DH000000ZZZZ 302 http://localhost:3100/orders/DH000000ZZZZ`; dòng lời nhắn tra cứu; `404`. Dừng server (PID cổng 3100).

---

### Task 7: @playwright/test trên bản build production: DoD M3 + test port từ M2

**Files:**
- Modify: `package.json` (qua npm + script `test:e2e`), `.gitignore`
- Create: `playwright.config.ts`, `e2e/helpers.ts`, `e2e/checkout.spec.ts`, `e2e/auth.spec.ts`, `e2e/cart.spec.ts`

**Interfaces:**
- Consumes: `TEST_DATABASE_URL` + globalSetup `prisma/test-db.ts` (Task 1); mọi route của Task 2–6; nhãn aria của M2 (`Thêm <tên> vào giỏ`, `Thêm 1 <tên>`, `Bớt 1 <tên>`, `output[aria-label="Số lượng <tên>"]`, `#cart-button` "Giỏ hàng, N món", `#cart-drawer`)
- Produces: `npm run test:e2e` (13 test). `e2e/helpers.ts`: `E2E_PORT`, `E2E_ADMIN_PASSCODE`, `E2E_ENV`, `sql<T>(text, params?)`, `product(slug)`, `ordersByPhone(phone)`, `waitForHydration(page)`, `addToCart(page, slug, qty?)`, `fillCheckout(page, phone)`, `placeCodOrder(page, phone, slug?)`. M4/M5 thêm spec vào `e2e/` và dùng lại các helper này.

- [ ] **Step 1: Cài @playwright/test (ghim exact) + script**

```bash
npm i -D -E @playwright/test@1.64.0
grep '"@playwright/test"' package.json
npx playwright --version
npx playwright install chromium
```
Expected: `"@playwright/test": "1.64.0",` trong `devDependencies`; `Version 1.64.0`. Gói không có install script, nên npm 12 **không** hỏi approve; nếu có lời nhắc `allowScripts` thì dừng lại và báo, không tự approve. `playwright install chromium` không tải gì (revision 1248 đã có trong `~/.cache/ms-playwright`) hoặc tải đúng bản 1248.

Trong `package.json`, thêm vào `scripts` (ngay dưới dòng `"test": "vitest run",`):
```json
    "test:e2e": "playwright test",
```

Thêm vào cuối `.gitignore`:
```
/test-results/
/playwright-report/
```

- [ ] **Step 2: Cấu hình + helper**

`playwright.config.ts`:
```ts
import { defineConfig } from "@playwright/test";
import { E2E_ENV, E2E_PORT } from "./e2e/helpers.ts";

/**
 * E2E chạy trên BẢN BUILD PRODUCTION nối DB test `chosang_test` (không bao giờ DB dev).
 * Thứ tự (spike M3): webServer khởi động trước, rồi globalSetup reset DB test; server chỉ nối DB khi có request.
 */
export default defineConfig({
  testDir: "e2e",
  workers: 1, // các test dùng chung DB test và tồn kho
  reporter: "list",
  globalSetup: "./prisma/test-db.ts",
  use: {
    baseURL: `http://localhost:${E2E_PORT}`,
    viewport: { width: 375, height: 812 },
    locale: "vi-VN",
  },
  webServer: {
    command: "npm run build && npm start",
    // Đầu dò sẵn sàng KHÔNG chạm DB: webServer chạy trước globalSetup, máy mới chưa có chosang_test (cổng M3)
    url: `http://localhost:${E2E_PORT}/favicon.svg`,
    reuseExistingServer: false, // luôn là server nối DB test, không bao giờ dùng nhầm server dev đang chạy
    timeout: 180_000,
    env: E2E_ENV,
  },
});
```

`e2e/helpers.ts`:
```ts
import { expect, type Page } from "@playwright/test";
import pg from "pg";
import { TEST_DATABASE_URL } from "../prisma/test-db.ts";

export const E2E_PORT = 3100;
export const E2E_ADMIN_PASSCODE = "e2e-ma-quan-tri-2026";
export const E2E_ENV = {
  NODE_ENV: "production",
  PORT: String(E2E_PORT),
  DATABASE_URL: TEST_DATABASE_URL,
  SESSION_SECRET: "e2e-chi-dung-cho-playwright-0123456789abcdef", // ≥32 ký tự (production)
  DEMO_OTP: "1",
  ADMIN_PASSCODE: E2E_ADMIN_PASSCODE,
};

/** Truy vấn thẳng DB test để kiểm kho/đơn (hoặc đặt kho cho ca tranh món cuối). */
export async function sql<T>(text: string, params: unknown[] = []): Promise<T[]> {
  const client = new pg.Client({ connectionString: TEST_DATABASE_URL });
  await client.connect();
  try {
    return (await client.query(text, params)).rows as T[];
  } finally {
    await client.end();
  }
}

export const product = async (slug: string) =>
  (await sql<{ id: number; stock: number }>('SELECT id, stock FROM "Product" WHERE slug = $1', [slug]))[0];
export const ordersByPhone = async (phone: string) =>
  (await sql<{ n: string }>('SELECT count(*) AS n FROM "Order" WHERE phone = $1', [phone]))[0].n;

/** Nút + chỉ chạy sau khi React hydrate xong: đợi tới khi nút giỏ có props React. */
export const waitForHydration = (page: Page) =>
  page.waitForFunction(() => Object.keys(document.querySelector("#cart-button") ?? {}).some((k) => k.startsWith("__reactProps")));

/** Bỏ thẳng món vào giỏ qua /cart (cùng cookie với trang), nhanh hơn bấm qua UI khi test không nhắm vào giỏ. */
export async function addToCart(page: Page, slug: string, qty = 1) {
  const { id } = await product(slug);
  const res = await page.request.post("/cart", { form: { intent: "set", pid: String(id), qty: String(qty) } });
  expect(res.ok()).toBe(true);
}

export async function fillCheckout(page: Page, phone: string) {
  await page.getByLabel("Họ tên").fill("Chị Lan");
  await page.getByLabel("Số điện thoại").fill(phone);
  await page.getByLabel("Địa chỉ giao hàng").fill("12 Lê Lợi, P. Bến Nghé, Q.1");
}

/** Đặt một đơn COD qua UI, trả mã đơn. */
export async function placeCodOrder(page: Page, phone: string, slug = "rau-muong") {
  await addToCart(page, slug);
  await page.goto("/checkout");
  await waitForHydration(page);
  await fillCheckout(page, phone);
  await page.getByRole("button", { name: /^Đặt hàng/ }).click();
  await expect(page).toHaveURL(/\/orders\/DH\d{6}[A-Z0-9]{4}$/);
  return page.url().split("/").at(-1)!;
}
```

- [ ] **Step 3: Spec giỏ hàng (port từ M2) + giỏ trống**

`e2e/cart.spec.ts`:
```ts
import { expect, test } from "@playwright/test";
import { waitForHydration } from "./helpers";

// Port từ kiểm tra tay của M2 (gate M2, I1): giữ flushSync + routeDiscovery "initial". Bỏ một trong hai là test này đỏ.
test("bấm nhanh liên tục, response đầu về trễ: UI = server, không mất dòng, không gọi /__manifest", async ({ page }) => {
  let manifestRequests = 0;
  page.on("request", (r) => {
    if (r.url().includes("/__manifest")) manifestRequests++;
  });
  let n = 0;
  await page.route("**/cart.data*", async (route) => {
    const delay = n++ === 0 ? 800 : 100; // response đầu về sau cùng
    const response = await route.fetch().catch(() => null);
    await new Promise((r) => setTimeout(r, delay));
    if (response) await route.fulfill({ response }).catch(() => {});
    else await route.abort().catch(() => {});
  });
  await page.goto("/collections/all?page=2");
  await waitForHydration(page);
  const result = await page.evaluate(async () => {
    const $ = (s: string) => document.querySelector<HTMLElement>(s)!;
    $('[aria-label="Thêm Rau muống vào giỏ"]').click(); // không chờ giữa các lần bấm
    for (let i = 0; i < 7; i++) $('[aria-label="Thêm 1 Rau muống"]').click();
    $('[aria-label="Bớt 1 Rau muống"]').click();
    $('[aria-label="Thêm Trứng gà ta vào giỏ"]').click();
    await new Promise((r) => setTimeout(r, 3000));
    const server = (await (await fetch("/cart")).json()) as { lines: { slug: string; qty: number }[] };
    return {
      ui: $('output[aria-label="Số lượng Rau muống"]').textContent,
      badge: $("#cart-button").getAttribute("aria-label"),
      server: server.lines.map((l) => [l.slug, l.qty]),
    };
  });
  expect(result).toEqual({ ui: "7", badge: "Giỏ hàng, 8 món", server: [["rau-muong", 7], ["trung-ga-ta", 1]] });
  expect(manifestRequests).toBe(0);
});

test("mất mạng khi bấm +: trang còn nguyên, số lượng quay về, có lời nhắn; có mạng lại thì chạy", async ({ page }) => {
  await page.goto("/collections/all");
  await waitForHydration(page);
  await page.route("**/cart.data*", (route) => route.abort("internetdisconnected"));
  await page.getByRole("button", { name: "Thêm Rau muống vào giỏ" }).click();
  await expect(page.locator("header [role=alert]")).toHaveText("Mất kết nối, bạn thử lại giúp mình nhé.");
  await expect(page.locator("main h1")).toHaveText("Tất cả sản phẩm");
  await expect(page.locator('output[aria-label="Số lượng Rau muống"]')).toHaveCount(0);
  await page.unrouteAll();
  await page.getByRole("button", { name: "Thêm Rau muống vào giỏ" }).click();
  await expect(page.locator('output[aria-label="Số lượng Rau muống"]')).toHaveText("1");
  await expect(page.locator("header [role=alert]")).toHaveCount(0);
});

test("giỏ trống: rổ 0% + 3 món khuyến mãi có nút +; bấm + thì drawer thành giỏ có hàng", async ({ page }) => {
  await page.goto("/");
  await waitForHydration(page);
  await page.locator("#cart-button").click();
  const drawer = page.locator("#cart-drawer");
  await expect(drawer.getByText("Giỏ hàng đang trống")).toBeVisible();
  await expect(drawer.getByText("Còn 300.000₫ nữa được freeship")).toBeVisible();
  const adds = drawer.getByRole("button", { name: /^Thêm .+ vào giỏ$/ });
  await expect(adds).toHaveCount(3);
  await adds.first().click();
  await expect(drawer.getByRole("heading", { name: "Giỏ hàng (1)" })).toBeVisible();
  await expect(drawer.getByRole("link", { name: /^Thanh toán · / })).toBeVisible();
});
```

- [ ] **Step 4: Spec checkout/đơn (DoD M3)**

`e2e/checkout.spec.ts`:
```ts
import { expect, test } from "@playwright/test";
import { addToCart, fillCheckout, ordersByPhone, placeCodOrder, product, sql, waitForHydration } from "./helpers";

test("DoD M3: thêm vào giỏ → COD → thấy đơn", async ({ page }) => {
  const before = (await product("rau-muong")).stock;
  await page.goto("/collections/all");
  await waitForHydration(page);
  await page.getByRole("button", { name: "Thêm Rau muống vào giỏ" }).click();
  await expect(page.locator("#cart-button")).toHaveAccessibleName("Giỏ hàng, 1 món");
  await page.locator("#cart-button").click();
  await page.getByRole("link", { name: "Thanh toán · 35.000₫" }).click();

  await expect(page).toHaveURL(/\/checkout$/);
  await expect(page.getByText("Giá tạm tính, cân thực tế ±10%")).toBeVisible(); // rau muống là hàng cân ký
  await fillCheckout(page, "0911000001");
  await page.getByRole("button", { name: "Đặt hàng · 35.000₫" }).click();

  await expect(page).toHaveURL(/\/orders\/DH\d{6}[A-Z0-9]{4}$/);
  await expect(page.getByRole("status").filter({ hasText: "Đặt hàng thành công" })).toBeVisible();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(page.url().split("/").at(-1)!);
  await expect(page.getByText("Rau muống × 1")).toBeVisible();
  await expect(page.getByRole("list", { name: "Tiến trình đơn hàng" }).getByText("Đã đặt hàng")).toBeVisible();
  await expect(page.locator("#cart-button")).toHaveAccessibleName("Giỏ hàng, 0 món");
  expect((await product("rau-muong")).stock).toBe(before - 1);
});

test("bấm Đặt hàng 2 lần (double tap, gửi trùng) chỉ tạo 1 đơn và trừ kho 1 lần", async ({ page }) => {
  const phone = "0911000002";
  const before = (await product("rau-muong")).stock;
  await addToCart(page, "rau-muong", 2);
  await page.goto("/checkout");
  await waitForHydration(page);
  await fillCheckout(page, phone);
  // Hai POST cùng nội dung (cùng khoá đặt hàng) bay song song, như double tap trên mạng chậm
  const responses = await page.evaluate(async () => {
    const body = new URLSearchParams(new FormData(document.querySelector<HTMLFormElement>("main form")!) as never);
    const send = () => fetch("/checkout", { method: "POST", body, redirect: "manual" });
    return (await Promise.all([send(), send()])).map((r) => r.type); // "opaqueredirect" = 302 về trang đơn, không phải lỗi 500
  });
  expect(responses).toEqual(["opaqueredirect", "opaqueredirect"]);
  await page.getByRole("button", { name: /^Đặt hàng/ }).dblclick(); // lần thứ ba, bằng UI, vẫn cùng khoá
  await expect(page).toHaveURL(/\/orders\/DH/);
  expect(await ordersByPhone(phone)).toBe("1");
  expect((await product("rau-muong")).stock).toBe(before - 2);
});

test("2 khách tranh món cuối cùng lúc: đúng 1 người đặt được, người kia được báo hết hàng", async ({ browser }) => {
  const nho = await product("nho-xanh-ninh-thuan");
  await sql('UPDATE "Product" SET stock = 1 WHERE id = $1', [nho.id]);
  const pages = await Promise.all(
    ["0911000003", "0911000004"].map(async (phone) => {
      const page = await (await browser.newContext()).newPage();
      await addToCart(page, "nho-xanh-ninh-thuan");
      await page.goto("/checkout");
      await waitForHydration(page);
      await fillCheckout(page, phone);
      return page;
    }),
  );
  await Promise.all(pages.map((p) => p.getByRole("button", { name: /^Đặt hàng/ }).click()));
  const outcome = await Promise.all(
    pages.map((p) =>
      Promise.race([
        p.waitForURL(/\/orders\/DH/).then(() => "đặt được"),
        p.getByRole("alert").filter({ hasText: "Nho xanh Ninh Thuận vừa hết hàng" }).waitFor().then(() => "hết hàng"),
      ]),
    ),
  );
  expect(outcome.sort()).toEqual(["hết hàng", "đặt được"].sort());
  expect((await product("nho-xanh-ninh-thuan")).stock).toBe(0);
  await Promise.all(pages.map((p) => p.context().close()));
});

test("huỷ đơn còn chờ thì hoàn kho", async ({ page }) => {
  const before = (await product("rau-muong")).stock;
  await placeCodOrder(page, "0911000005");
  expect((await product("rau-muong")).stock).toBe(before - 1);
  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "Huỷ đơn" }).click();
  await expect(page.getByText(/Đơn đã huỷ lúc/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Huỷ đơn" })).toHaveCount(0);
  expect((await product("rau-muong")).stock).toBe(before);
});

test("cổng thanh toán giả lập: DEMO, thất bại → thử lại → thành công", async ({ page }) => {
  await addToCart(page, "rau-muong");
  await page.goto("/checkout");
  await waitForHydration(page);
  await fillCheckout(page, "0911000006");
  await page.getByLabel(/Thanh toán online/).check();
  await page.getByRole("button", { name: /^Đặt hàng/ }).click();

  await expect(page).toHaveURL(/\/checkout\/pay\/DH/);
  await expect(page.getByText("DEMO, không trừ tiền thật")).toBeVisible();
  await page.getByRole("button", { name: "Giả lập thanh toán thất bại" }).click();
  await expect(page.getByRole("alert")).toContainText("Thanh toán chưa thành công");
  await expect(page.getByRole("button", { name: "Chuyển sang trả tiền mặt (COD)" })).toBeVisible();
  await page.getByRole("button", { name: "Thử lại" }).click();
  await page.getByRole("button", { name: /^Thanh toán \d/ }).click();
  await expect(page).toHaveURL(/\/orders\/DH/);
  await expect(page.getByText("Thanh toán online (DEMO): Đã thanh toán.")).toBeVisible();
});

test("người lạ mở link đơn của người khác chỉ thấy form nhập SĐT (IDOR)", async ({ page, browser }) => {
  const code = await placeCodOrder(page, "0911000007");
  const stranger = await (await browser.newContext()).newPage();
  await stranger.goto(`/orders/${code}`);
  await expect(stranger.getByText("Nhập số điện thoại đã dùng khi đặt để xem đơn này.")).toBeVisible();
  await expect(stranger.getByText("12 Lê Lợi")).toHaveCount(0);
  await stranger.goto(`/checkout/pay/${code}`);
  await expect(stranger).toHaveURL(new RegExp(`/orders/${code}$`));
  await waitForHydration(stranger);
  await stranger.getByLabel("Số điện thoại đặt hàng").fill("0911999999");
  await stranger.getByRole("button", { name: "Xem đơn" }).click();
  await expect(stranger.getByText("Số điện thoại không khớp với mã đơn này.")).toBeVisible();
  await stranger.getByLabel("Số điện thoại đặt hàng").fill("0911 000 007");
  await stranger.getByRole("button", { name: "Xem đơn" }).click();
  await expect(stranger.getByText("12 Lê Lợi, P. Bến Nghé, Q.1")).toBeVisible();
  await stranger.context().close();
});

test("các trang M3 không có lỗi console hay lỗi hydrate (giờ VN tính sẵn ở server)", async ({ page }) => {
  const problems: string[] = [];
  page.on("console", (m) => {
    if (m.type() === "error" || m.type() === "warning") problems.push(m.text());
  });
  page.on("pageerror", (e) => problems.push(String(e)));
  const code = await placeCodOrder(page, "0911000008");
  for (const path of ["/", "/orders", `/orders/${code}`, "/login", "/collections/all"]) {
    await page.goto(path);
    await waitForHydration(page);
  }
  expect(problems).toEqual([]);
});
```

- [ ] **Step 5: Spec đăng nhập**

`e2e/auth.spec.ts`:
```ts
import { expect, type Page, test } from "@playwright/test";
import { E2E_ADMIN_PASSCODE, placeCodOrder, waitForHydration } from "./helpers";

const ADMIN_PHONE = "0909000000"; // seed: User role admin

async function sendCode(page: Page, phone?: string) {
  await waitForHydration(page);
  if (phone) await page.getByLabel("Số điện thoại").fill(phone);
  await page.getByRole("button", { name: "Gửi mã" }).click();
}

test("admin không đăng nhập được nếu thiếu/sai passcode và không bao giờ thấy OTP (DoD M3)", async ({ page }) => {
  await page.goto("/login");
  await sendCode(page, ADMIN_PHONE);
  await expect(page.getByText(`Số ${ADMIN_PHONE} là tài khoản quản trị`)).toBeVisible();
  await expect(page.getByText("Mã OTP của bạn")).toHaveCount(0); // không có toast DEMO nào cho admin

  await page.getByRole("button", { name: "Đăng nhập", exact: true }).click(); // passcode trống
  await expect(page.getByRole("alert")).toHaveText("Mã quản trị chưa đúng, còn 4 lần thử.");
  await page.getByLabel("Mã quản trị").fill("123456");
  await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
  await expect(page.getByRole("alert")).toHaveText("Mã quản trị chưa đúng, còn 3 lần thử.");
  await page.goto("/orders");
  await expect(page.getByRole("link", { name: "Đăng nhập" }).first()).toBeVisible(); // vẫn là khách

  await page.goto("/login");
  await page.getByLabel("Mã quản trị").fill(E2E_ADMIN_PASSCODE);
  await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
  await expect(page.getByRole("status").filter({ hasText: "Đã đăng nhập" })).toBeVisible();
  await page.goto("/orders");
  await expect(page.getByText(`Đang đăng nhập bằng ${ADMIN_PHONE}`)).toBeVisible();
});

test("khách: 'Lưu đơn vào tài khoản' → OTP DEMO → đơn về tài khoản, quay lại đúng trang; đăng xuất giữ giỏ", async ({ page }) => {
  const phone = "0911000010";
  const code = await placeCodOrder(page, phone);
  await page.getByRole("link", { name: "Lưu đơn vào tài khoản" }).click();
  await expect(page.getByLabel("Số điện thoại")).toHaveValue(phone);
  await sendCode(page);

  const toast = page.getByRole("status").filter({ hasText: "Mã OTP của bạn" });
  await expect(toast).toContainText("DEMO");
  const otp = (await toast.locator("b").textContent())!;
  await page.getByLabel(/Mã 6 số/).fill(otp === "000000" ? "111111" : "000000"); // sai 1 lần: mã DEMO vẫn còn trên màn hình
  await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
  await expect(page.getByRole("alert")).toHaveText("Mã OTP chưa đúng, còn 4 lần thử.");
  await expect(toast).toContainText(otp);
  await page.getByLabel(/Mã 6 số/).fill(otp);
  await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();

  await expect(page).toHaveURL(new RegExp(`/orders/${code}$`));
  await expect(page.getByRole("link", { name: "Lưu đơn vào tài khoản" })).toHaveCount(0);
  await page.getByRole("link", { name: "Tài khoản và đơn hàng" }).click();
  await expect(page.getByRole("link", { name: new RegExp(code) })).toBeVisible();

  await page.goto("/collections/all");
  await waitForHydration(page);
  await page.getByRole("button", { name: "Thêm Rau muống vào giỏ" }).click();
  await expect(page.locator("#cart-button")).toHaveAccessibleName("Giỏ hàng, 1 món");
  await page.goto("/orders");
  await page.getByRole("button", { name: "Đăng xuất" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Đã đăng xuất" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Đăng nhập" }).first()).toBeVisible();
  await expect(page.locator("#cart-button")).toHaveAccessibleName("Giỏ hàng, 1 món"); // giỏ ở cookie riêng
});

test("redirectTo trỏ ra ngoài (//evil.test, /.//evil.test) bị bỏ qua: về trang chủ của shop (open redirect)", async ({ page }) => {
  await page.goto("/login?redirectTo=%2F%2Fevil.test");
  await sendCode(page, "0911000011");
  const otp = (await page.getByRole("status").filter({ hasText: "Mã OTP của bạn" }).locator("b").textContent())!;
  await page.getByLabel(/Mã 6 số/).fill(otp);
  await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
  await expect(page).toHaveURL("/");
  // Đã đăng nhập: loader /login chuyển hướng ngay, không cần bấm gì. "/./" chuẩn hoá ra "//evil.test" (cổng M3)
  await page.goto("/login?redirectTo=%2F.%2F%2Fevil.test");
  await expect(page).toHaveURL("/");
});
```

- [ ] **Step 6: Chạy bộ e2e**

Không có dev server nào đang chiếm cổng 3100. Run: `npm run typecheck && npm run test:e2e`. Expected: build production chạy trong webServer, rồi **13 passed** (auth 3, cart 3, checkout 7), không test nào cần retry. E2E chạy được trên máy sạch mà không cần chạy vitest trước: đầu dò sẵn sàng là `/favicon.svg` (không chạm DB), rồi globalSetup tạo `chosang_test` (cổng plan M3, thay đổi 5). Chạy thêm `npx playwright test e2e/checkout.spec.ts -g "tranh món cuối" --repeat-each=5` → `5 passed` (Decision 20 làm test này không phụ thuộc thứ tự xen kẽ).

Kiểm test bấm nhanh đỏ được (bắt buộc, rồi hoàn lại): tạm xoá `, flushSync: true` trong `app/lib/use-cart.ts` → `npx playwright test e2e/cart.spec.ts -g "bấm nhanh"` phải FAIL → hoàn lại → PASS. Làm tương tự với dòng `routeDiscovery: { mode: "initial" },` trong `react-router.config.ts` (FAIL vì mất dòng hoặc có request `/__manifest`). Ghi kết quả vào báo cáo.

Kiểm DB dev không bị chạm (so với con số đã ghi ở Task 1 Step 4):
```bash
for q in 'select count(*) from "Order"' 'select count(*) from "User"' 'select sum(stock) from "Product"'; do
  docker compose exec -T db psql -U chosang -d chosang -tAc "$q"
done | paste -sd' '
```
Expected: giống hệt dòng đã ghi ở Task 1 Step 4.

- [ ] **Step 7: Checkpoint**: `npm run typecheck && npm test`. Expected: **184** test. Xoá `test-results/` nếu còn.

---

### Task 8: Rà soát cuối M3 (Definition of Done, ngân sách, ảnh chụp, bảo mật, bàn giao)

**Files:** không tạo mới. Chỉ sửa code khi một kiểm tra fail, và phải báo lại.

- [ ] **Step 1: Toàn bộ test**

Run: `npm run typecheck && npm test && npm run test:e2e`. Expected: sạch; vitest **184** (88 cũ + env 3 + security 20 + cart 1 + delivery 6 + orders 17 + forms 14 + auth 14 + checkout 14 + order 7); Playwright **13**. Phần DoD:
- "Playwright: thêm vào giỏ → COD → thấy đơn": `e2e/checkout.spec.ts` "DoD M3".
- "2 đơn tranh món cuối thì 1 đơn bị từ chối": `orders.server.test.ts` + e2e "2 khách tranh món cuối".
- "Huỷ đơn hoàn kho": `orders.server.test.ts`, `order.test.ts`, e2e "huỷ đơn".
- "Admin không đăng nhập được nếu thiếu passcode": `auth.server.test.ts` + e2e admin + Step 4 dưới đây.

- [ ] **Step 2: Bản build production: zod không lọt vào client, JS route đầu trong ngân sách**

```bash
npm run build
grep -l 'ZodError\|\$ZodType' build/client/assets/*.js && echo "VI PHẠM: zod lọt vào client" || echo "ok: zod chỉ ở server"
grep -l 'createHmac\|timingSafeEqual\|randomInt' build/client/assets/*.js && echo "VI PHẠM: crypto server lọt vào client" || echo "ok: crypto chỉ ở server"
grep -l 'SESSION_SECRET\|ADMIN_PASSCODE\|dev-only\|e2e-ma-quan-tri' build/client/assets/*.js && echo "VI PHẠM: bí mật lọt vào client" || echo "ok: không có bí mật trong client"
TEST_URL=$(node -e 'process.loadEnvFile(); const u = new URL(process.env.DATABASE_URL); u.pathname = "/chosang_test"; console.log(u.href)')
PORT=3100 NODE_ENV=production DATABASE_URL=$TEST_URL SESSION_SECRET=e2e-chi-dung-cho-playwright-0123456789abcdef DEMO_OTP=1 ADMIN_PASSCODE=e2e-ma-quan-tri-2026 npm start &
sleep 3
curl -s localhost:3100/ | grep -oE '/assets/[^"]+\.js' | sort -u | while read f; do gzip -c "build/client$f" | wc -c; done | awk '{t+=$1} END {print "JS route đầu (gzip bytes):", t}'
```
Expected: `ok: zod chỉ ở server`; `ok: crypto chỉ ở server`; `ok: không có bí mật trong client`; JS route đầu ≤ **133120** bytes (M2: 123368; bản thử M3: 125485). Ghi con số trước/sau vào báo cáo. Nếu vượt trần: liệt kê file và kích thước, rồi **dừng ở DONE_WITH_CONCERNS**, không tự tối ưu. Giữ server chạy cho Step 3 và 5.

- [ ] **Step 3: Lighthouse mobile một lần trên 3 trang chính**

```bash
OUT=.superpowers/sdd/2026-10-15-m3-checkout-orders-auth
mkdir -p $OUT
for page in home:/ all:/collections/all pdp:/products/xoai-cat-hoa-loc; do
  CHROME_PATH=/usr/bin/google-chrome npx -y lighthouse@13.5.0 "http://localhost:3100${page#*:}" --only-categories=performance --chrome-flags="--headless=new" --output=json --output-path="$OUT/lh-${page%%:*}.json" --quiet
  node -e "const r=require('./$OUT/lh-${page%%:*}.json'),a=r.audits;console.log('${page%%:*}','LCP',a['largest-contentful-paint'].displayValue,'CLS',a['cumulative-layout-shift'].displayValue,'score',r.categories.performance.score)"
done
```
Expected: ghi lại LCP/CLS ba trang. Mốc so sánh (sau cổng M2): `/` 2.0s, `/collections/all` 2.4s, trang sản phẩm 2.6s (lệch đã chấp nhận, chuyển M7). M3 không được làm tệ hơn quá ~0.2s (root loader chỉ thêm 1 query khuyến mãi khi giỏ trống; ảnh gợi ý trong `<dialog>` đóng là `loading="lazy"` nên không tải). CLS < 0.1. Nếu tệ hơn: báo phần tử LCP (`audits['largest-contentful-paint-element']`), không tự tối ưu.

- [ ] **Step 4: Fail-closed: thiếu `DEMO_OTP` / `ADMIN_PASSCODE` thì không ai đăng nhập được**

Biến rỗng (không phải không có) để `process.loadEnvFile()` không lấy giá trị từ `.env`:
```bash
PORT=3101 NODE_ENV=production DATABASE_URL=$TEST_URL SESSION_SECRET=e2e-chi-dung-cho-playwright-0123456789abcdef DEMO_OTP= ADMIN_PASSCODE= npm start &
sleep 3
curl -s -X POST -d 'intent=send&phone=0912345678' localhost:3101/login | grep -o 'Đăng nhập bằng mã OTP đang tắt trên bản này.\|Mã OTP của bạn' | sort -u
curl -s -X POST -d 'intent=send&phone=0909000000' localhost:3101/login | grep -o 'Tài khoản quản trị chưa được bật trên bản này.' | head -1
```
Expected: chỉ `Đăng nhập bằng mã OTP đang tắt trên bản này.` (không có mã nào); `Tài khoản quản trị chưa được bật trên bản này.`. Dừng server cổng 3101 (PID).

- [ ] **Step 5: Bộ ảnh chụp cho Designer/Customer (375×812 và 1280×800)**

Server cổng 3100 (DB test) từ Step 2 vẫn chạy. Script viết ra file tạm ngoài project (heredoc không có dấu nháy: `\`` và `\${` là cố ý):
```bash
OUT=$PWD/.superpowers/sdd/2026-10-15-m3-checkout-orders-auth
SCRIPT=$(mktemp --suffix=.js)
cat > "$SCRIPT" <<EOF
async (page) => {
  const OUT = "$OUT";
  const BASE = "http://localhost:3100";
  const hydrated = () => page.waitForFunction(() => Object.keys(document.querySelector("#cart-button") ?? {}).some((k) => k.startsWith("__reactProps")));
  const fill = async () => {
    await page.getByLabel("Họ tên").fill("Chị Lan");
    await page.getByLabel("Số điện thoại").fill("0912345678");
    await page.getByLabel("Địa chỉ giao hàng").fill("12 Lê Lợi, P. Bến Nghé, Q.1");
  };
  for (const [w, h] of [[375, 812], [1280, 800]]) {
    const shot = (name, fullPage = false) => page.screenshot({ path: \`\${OUT}/dod-\${name}-\${w}.png\`, fullPage });
    await page.context().clearCookies();
    await page.setViewportSize({ width: w, height: h });
    await page.goto(BASE + "/"); await hydrated();
    await page.locator("#cart-button").click(); await page.waitForTimeout(400);
    await shot("drawer-empty");
    await page.keyboard.press("Escape");
    await page.goto(BASE + "/collections/all?page=2"); await hydrated();
    for (const name of ["Rau muống", "Cá hồi phi lê"]) {
      await page.getByRole("button", { name: \`Thêm \${name} vào giỏ\` }).click(); await page.waitForTimeout(600);
    }
    // Táo Envy đã hết hàng (nút + bị khoá): bỏ thẳng vào cookie giỏ để chụp dòng "Tạm hết hàng" ở checkout
    const envy = await page.locator("article", { hasText: "Táo Envy" }).locator("[data-product-image]").getAttribute("data-product-image");
    await page.request.post(BASE + "/cart", { form: { intent: "set", pid: envy, qty: "1" } });
    await page.goto(BASE + "/checkout"); await hydrated();
    await shot("checkout", true);
    await page.getByRole("button", { name: /^Đặt hàng/ }).click(); await page.waitForTimeout(600);
    await shot("checkout-errors");
    await fill(); await page.getByLabel(/Thanh toán online/).check();
    await page.getByRole("button", { name: /^Đặt hàng/ }).click(); await page.waitForURL(/\/checkout\/pay\//);
    await shot("pay");
    await page.getByRole("button", { name: "Giả lập thanh toán thất bại" }).click(); await page.waitForTimeout(600);
    await shot("pay-failed");
    await page.getByRole("button", { name: "Thử lại" }).click(); await page.waitForTimeout(600);
    await page.getByRole("button", { name: /^Thanh toán \d/ }).click(); await page.waitForURL(/\/orders\/DH/);
    await shot("order", true);
    await page.goto(BASE + "/orders"); await shot("orders", true);
    await page.goto(BASE + "/login"); await hydrated();
    await page.getByLabel("Số điện thoại").fill("0912345678"); await page.getByRole("button", { name: "Gửi mã" }).click(); await page.waitForTimeout(600);
    await shot("login-otp");
  }
  return "ok";
}
EOF
playwright-cli -s=m3 open about:blank
playwright-cli -s=m3 run-code "$(cat "$SCRIPT")"
playwright-cli -s=m3 close
rm -f "$SCRIPT"; rm -rf .playwright-cli
ls "$OUT"/dod-*.png | wc -l
```
Expected: `run-code` trả `"ok"`; **16** ảnh `dod-{drawer-empty,checkout,checkout-errors,pay,pay-failed,order,orders,login-otp}-{375,1280}.png`. Kiểm bằng mắt:
- Checkout 375: nút "Đặt hàng · tổng" dính đáy; khung giờ đã qua ghi "Đã qua" xuống dòng dưới giờ; "Tạm hết hàng" gạch ngang; ghi chú ±10%. Checkout 1280: nút nằm ngay dưới tóm tắt ở cột phải.
- Lỗi form: viền + chữ màu danger có icon, ngay dưới từng field.
- Pay: khung DEMO nét đứt ở đầu; thất bại có "Thử lại" và "Chuyển sang trả tiền mặt (COD)".
- Trang đơn: timeline bước 1 màu fresh có dấu check, 3 bước "Chưa tới"; "Lưu đơn vào tài khoản"; "Mua lại đơn này", "Huỷ đơn" (đơn còn pending), hotline.
- Login: toast DEMO có mã 6 số ở đáy.
- Drawer trống: rổ 0%, 3 món có nút +, "Xem tất cả sản phẩm".
- Header 375: "Tìm món…" không bị cắt chữ (Decision 17).

Dừng server cổng 3100 (PID).

- [ ] **Step 6: Rà soát bảo mật (tư duy `security-review`) + ràng buộc toàn cục**

```bash
grep -L "readForm(request" $(grep -l "export async function action" app/routes/*.ts*) && echo "VI PHẠM: action thiếu readForm" || echo "ok: mọi action gọi readForm"
grep -rn "request.formData()" app/routes && echo "VI PHẠM" || echo "ok: không còn request.formData()"
grep -rn "redirect(" app/routes/login.tsx app/routes/logout.ts | grep -v "safeRedirect\|redirect(redirectTo" && echo "KIỂM LẠI" || echo "ok: redirect đăng nhập/đăng xuất chỉ qua safeRedirect"
grep -rln "canViewOrder" app/routes | sort | tr '\n' ' '; echo
grep -rn "@remix-run" app prisma e2e && echo "VI PHẠM" || echo "ok"
grep -rln "from \"zod\"" app | grep -v '\.server\.ts$' && echo "VI PHẠM: zod ngoài .server" || echo "ok"
grep -n '"@playwright/test"\|"zod"' package.json
grep -rn "migrate reset\|down -v" package.json prisma e2e vitest.config.ts playwright.config.ts && echo "VI PHẠM" || echo "ok"
```
Expected: `ok: mọi action gọi readForm`; `ok: không còn request.formData()`; `ok: redirect …`; `app/routes/checkout-pay.tsx app/routes/order.tsx`; `ok`; `ok`; `"zod": "4.6.7",` và `"@playwright/test": "1.64.0",`; `ok`.

Đọc lại theo danh sách và ghi kết quả vào báo cáo (mỗi dòng: chỗ code + test chứng minh):
- OTP: HMAC có secret, gắn SĐT + hạn, 5 lần, 5 phút; admin không có OTP; khoá passcode theo SĐT; so sánh thời gian hằng (`auth.server.ts`, `auth.server.test.ts`).
- Open redirect: `safeRedirect` ở loader + action `/login` và `/logout` (kể cả dạng dấu chấm `/.//host`); header chỉ tạo `redirectTo` từ path hiện tại. Chạy lại bằng curl trên server cổng 3100: `curl -s -o /dev/null -w '%{redirect_url}\n' -X POST -d 'redirectTo=/.//evil.test' localhost:3100/logout` → `http://localhost:3100/`.
- IDOR: `canViewOrder` ở loader và mọi intent trừ `lookup`; không lộ dữ liệu khi `order: null`; `/checkout/pay/:code` chuyển hướng.
- Kho + tiền: chỉ `updateMany` có điều kiện trong transaction; tổng tính trên mọi dòng và phải bằng `expectedTotalVnd`; huỷ có `status = 'pending'`; CHECK `stock >= 0` còn nguyên (`\d "Product"` trên DB dev).
- Admin: `ADMIN_PHONE` không bao giờ nhận OTP kể cả khi chưa có dòng User; `signIn(…, false)` từ chối tài khoản role admin.
- Phiên: `__session` httpOnly/lax/Secure ở production, ký; `SESSION_SECRET` ≥32; `userId` chỉ đọc từ phiên, không từ form.
- CSRF/body: mọi action qua `readForm`; RR tự kiểm route UI; resource route `/cart`, `/logout` có test 403.

- [ ] **Step 7: Bàn giao**

Báo cho controller: số test (vitest + e2e), JS route đầu, LCP ba trang, danh sách ảnh, các Decision ở đầu plan và câu hỏi mở. Controller viết mục **"Kết quả M3"** vào roadmap, gồm:
- **Hợp đồng module thêm mới:** `app/lib/session.server.ts` (`sessionStorage`, `getSession`, `commitSession`, `addGuestOrder`, `canViewOrder`, `getUser`, `requireAdmin`); `app/lib/orders.server.ts` (`placeOrder`, `aggregateQty`, `cancelOrder`, `setOnlinePayment`, `takenSlots`, `checkoutPrefill`, `getOrder`, `findOrderForPhone`, `reorderQuantities`, `toOrderView`, `listOrders`); `app/lib/auth.server.ts`; `app/lib/forms.server.ts`; `app/lib/security.server.ts` (`readForm`, `safeRedirect`); `app/lib/delivery.ts`; components `field.tsx`, `toast.tsx`; `prisma/test-db.ts`; `e2e/helpers.ts`; `env.DEMO_OTP`, `env.ADMIN_PASSCODE`; `config.ts` `DELIVERY_SLOTS`, `SLOT_CAPACITY`, `ADMIN_PHONE`; cột `Order.checkoutKey`.
- **Chuyển sang M4:** dòng giỏ quà đi vào `placeOrder` như các `OrderLineInput` có `bundleId` (món trong giỏ + vỏ giỏ), `aggregateQty` đã gộp theo sản phẩm; checkout hiện đang xoá `l` và giữ `b` của cookie giỏ, M4 quyết vòng đời `b`; `reorderQuantities` bỏ dòng giỏ quà; `/gift` action gọi `readForm(request, <trần lớn hơn cho preview ≤60KB>)`.
- **Chuyển sang M5:** layout `/admin` gọi `requireAdmin(request)`; đổi trạng thái ghi `preparingAt`/`shippingAt`/`doneAt` (timeline khách đọc các cột này qua `toOrderView`); huỷ từ admin dùng lại `cancelOrder` để hoàn kho; action admin cũng đi qua `readForm`.
- **Chuyển sang M7 (cổng plan M3, thay đổi 6):**
  - (a) Sau proxy TLS, `request.url` phải mang đúng scheme + host công khai (server tin `X-Forwarded-Proto`/`X-Forwarded-Host` của proxy). Chỉ khi đó cả kiểm Origin của RR **lẫn** `readForm` (tự so `Origin` với `new URL(request.url).origin`) mới qua; chỉ đặt `allowedActionOrigins` của RR thì `readForm` vẫn trả 403 cho mọi POST. Nếu không sửa được `request.url`, `readForm` cần cùng danh sách origin cho phép.
  - (b) Bộ khoá passcode tính theo SĐT, mà trang đăng nhập nêu SĐT admin: ai cũng có thể giữ admin bị khoá (5 lần sai mỗi 15 phút). Chủ shop phải đăng nhập admin **trước** buổi pitch (phiên sống 30 ngày).
  - (c) Với `DEMO_OTP=1`, ai cũng đăng nhập được bằng bất kỳ SĐT không phải admin và đọc đơn của số đó (tên, địa chỉ). Đúng spec, nhưng không được để khách thật nhập dữ liệu thật trên link công khai.
  - (d) Phiên lưu `userId` số nguyên và không thu hồi được phía server: `demo:reset` không được `RESTART IDENTITY` bảng `User`, hoặc phải đổi `SESSION_SECRET`; nếu không, cookie 30 ngày cũ trỏ sang tài khoản mới dùng lại id đó (IDOR qua các lần reset).
  - (e) Giữ nguyên: `ADMIN_PASSCODE` production ≥12 ký tự; `demo:reset` xoá đơn/user rồi seed lại admin; các `ponytail:` (khoá passcode trong RAM, tra cứu đơn không giới hạn, đơn online thất bại không có TTL, sức chứa khung giờ có thể vượt 1 đơn khi đặt đồng thời).
- **Ghi chú cho M4/M5 planner:** quy tắc "schema đầy đủ được tạo một lần ở M0" nay có ngoại lệ `Order.checkoutKey` (migration `20261015120000_order_checkout_key`, tạo bằng `migrate diff` + `migrate deploy`); đừng giả định schema đóng băng.
- **Checkpoint tiến độ (spec mục 6, dòng M3):** controller so ngày công thực tế với kế hoạch (M0–M3 = 11 ngày); trễ hơn 1.5 ngày thì áp dụng thứ tự cắt ở spec mục 3 cho M4–M7.
- **Ghi chú cho Designer/Customer:** toast OTP DEMO không tự tắt; icon tài khoản mới ở header làm ô tìm kiếm hẹp lại, đã chỉnh khoảng cách để "Tìm món…" vừa 375px.
