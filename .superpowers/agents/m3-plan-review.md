# M3 Checkout + orders + auth: plan gate review (Consultant)

Plan: `docs/superpowers/plans/2026-10-15-m3-checkout-orders-auth.md`, read in full. I checked it against:
- spec §2 (Auth, Giỏ hàng, Hàng cân ký), §3 MVP, §5 (data model, rules, cookies, route map) and §6 (the M3 row);
- the roadmap module contract, Review Focus 4–5, and every "Chuyển sang M3" in Kết quả M0/M1/M2;
- the M2 gate precedent (`m2-plan-review.md`, `m2-final-review.md`);
- the current code: `root.tsx`, `routes/cart.ts`, `lib/cart*.ts`, `cart-drawer.tsx`, `site-header.tsx`, `env.server.ts`, `config.ts`, `schema.prisma` + init migration (CHECK constraints), `seed.ts`, `vitest.config.ts`, `package.json`, `tsconfig.json`, `react-router.config.ts`, `prisma.config.ts`;
- RR 8.4 sources: `ABSOLUTE_URL_REGEX`, revalidation skip on `actionStatus >= 400`, and `react-router-serve` NODE_ENV.

I ran three checks myself: `safeRedirect` against dot-segment inputs (change 1), the patched version against all 16 cases, and Node 22.22 `process.loadEnvFile()` with an empty preset variable (it keeps `""`, so Task 8 Step 4 is valid).

## Verdict: APPROVE WITH CHANGES

This is a strong plan. It covers the spec and every carry-over, it was prototyped end to end, and the core money/stock design is right:
- one transaction;
- a conditional `UPDATE … stock >= q` taken in ascending id order;
- `cancel` guarded by `status = 'pending'`;
- a unique `checkoutKey` that makes the duplicate request wait and then return the same order.

The security model is mostly right too: HMAC'd OTP, an in-RAM passcode counter that makes cookie replay useless, `canViewOrder` on every order path, `readForm` on every action, and fail-closed env.

The review found one real exploit and three money/correctness gaps.
- **Exploit:** `safeRedirect` is an open redirect via dot segments. For a logged-in user, `GET /login?redirectTo=/.//evil.test` bounces them off-site with zero interaction.
- **Money/correctness:**
  - a free-item race in the in-transaction totals;
  - the order can silently differ from the total the customer confirmed (this also makes one DoD e2e order-dependent);
  - admin protection depends on the DB row existing at OTP time.

All the fixes are small (≈1–10 lines each, plus tests). With them, the plan goes to execution without coming back to this gate.

### Spec and carry-over coverage

| Requirement | Task | Status |
|---|---|---|
| Checkout, one page, guest: name, phone, address textarea, slot (full = disabled), note, "Gọi hỏi nếu hết hàng", COD preselected, online mock, button "Đặt hàng · tổng" | 5 | OK (the total shown must equal the order total: **change 3**) |
| `/checkout`: empty cart → redirect; prefill from the last order; zod + transaction | 3, 5 | OK |
| `/checkout/pay/:code`: DEMO banner; pending/paid/failed/retry/COD branches | 3, 6 | OK |
| `/orders/:code`: 4-step timeline, cancel while pending (restock), "Mua lại", hotline; view = owner or code in session, else phone form; `lookup`/`cancel`/`reorder` | 3, 6 | OK |
| `/orders` list + lookup by code + phone | 6 | OK |
| OTP login (`DEMO_OTP=1`, DEMO toast, 5 tries, 5 min, hash in a signed cookie), logout POST, toast, return to the previous page, "Lưu đơn vào tài khoản" → `/login?phone=` | 4, 6 | OK (redirect target: **change 1**) |
| Admin never sees an OTP; `ADMIN_PASSCODE` required | 4 | **GAP**: holds only while the admin `User` row exists (**change 4**) |
| First login creates the account and attaches guest orders with the same phone | 4 | OK (Decision 7 extends it to every login) |
| `__session`: userId, guestOrderCodes, otp; 30 days, httpOnly, lax, secure in production, signed | 4 | OK |
| Stock rule: aggregate per product, `UPDATE … WHERE stock >= q`, name the short item | 3 | OK; totals race: **change 2** |
| Weighed goods: "Giá tạm tính, cân thực tế ±10%" at checkout | 2, 5 | OK |
| DoD: Playwright cart → COD → see the order; two orders race for the last unit (one rejected); cancel restocks; admin blocked without passcode; progress checkpoint | 3, 7, 8 | OK; the race e2e is order-dependent: **change 3** |
| Review Focus 4 (double tap) and 5 (21:00 → tomorrow 08:00) | 3, 5, 7 | OK |
| Module contract: `session.server.ts` + `requireAdmin`, `orders.server.ts` + `placeOrder`, `env.DEMO_OTP`, `env.ADMIN_PASSCODE` | 1, 3, 4 | OK |
| M0: separate `chosang_test` DB | 1 | OK |
| M1: catalog tests with hard-coded 24/40 now run on the test DB | 1 | OK |
| M2 I1: port the rapid-tap and offline tests to @playwright/test, with mutation checks | 7 | OK |
| M2: empty cart shows 3 promotions with a + button | 2, 7 | OK |
| M2: `__session` reuses `SESSION_SECRET`/`COOKIE_SECURE`; `SESSION_SECRET` ≥32 in production | 1, 4 | OK |
| M2: every POST checks Origin and caps the body | 2, 4–6, 8 | OK (M7 proxy caveat: **change 6**) |
| M2: stock-0 lines at checkout; `CartLine.isWeighed` | 2, 5 | OK (lines that sell out *after* render: **change 3**) |
| M2 ledger #6: `cart.server` tests no longer depend on the dev DB seed | 1 | OK (deterministic fresh seed) |
| M2: re-measure first-route JS; `/checkout` 404 becomes a real route | 8, 5 | OK |
| M2 Rec. 3: reuse `cartTotals` in the transaction; clear `l`, keep `b` | 3, 5 | OK |
| Spec §6 M3 review: Developer review + `security-review` | 8 Step 6 | OK as a checklist. The skill needs git, which the project doesn't have yet; the final gate re-runs the checklist on the shadow-repo diff |

## Required changes

1. **Close the open redirect in `safeRedirect`** (Task 2 Step 2, plus tests).

   The WHATWG parser normalizes dot segments **after** the origin check sees a same-origin path. Verified with Node 22.22: `/.//evil.test`, `/..//evil.test`, `/a/..//evil.test`, `/%2e//evil.test`, `/./\evil.test` and `/x/../\evil.test` all return `"//evil.test"`. RR's `ABSOLUTE_URL_REGEX` (`/^(?:[a-z][a-z0-9+.-]*:|[\\/]{2})/i`) then treats that value as external.

   Worst case: the `/login` loader redirects an already-logged-in user straight to `redirectTo`, so one link (`/login?redirectTo=%2F.%2F%2Fevil.test`) sends any logged-in customer or admin off-site with no click. The same input works through `/logout` and after an OTP login.

   Fix (verified against all 16 cases, including the plan's 10):
   ```ts
   export function safeRedirect(to: FormDataEntryValue | null | undefined, fallback = "/"): string {
     if (typeof to !== "string" || !to.startsWith("/")) return fallback;
     const url = new URL(to, "http://n");
     const path = url.pathname + url.search + url.hash;
     return url.origin === "http://n" && !path.startsWith("//") ? path : fallback; // "/.//host" normalizes to "//host"
   }
   ```
   - Add `/.//evil.test`, `/..//evil.test`, `/%2e//evil.test` and `/x/../\\evil.test` → `"/"` to the `test.each`. All four fail on the current code.
   - In `e2e/auth.spec.ts`, extend the open-redirect test: after logging in, `page.goto("/login?redirectTo=%2F.%2F%2Fevil.test")` must land on `/`.
   - Add the dot-segment form to Review Focus 5.
   - Update the test counts.

2. **Count every line in the in-transaction totals** (Task 3 Step 5, `insertOrder`).

   `cartTotals(...)` currently uses the `stock` read by the opening `findMany` and drops any line that read 0. Under READ COMMITTED, a concurrent `cancelOrder` can restock that product between the `findMany` and its `updateMany`. The `updateMany` then succeeds, so the order commits with that item in `OrderItem` but missing from `subtotalVnd`/`totalVnd`: a free item.

   A committed order means every line was decremented, so every line must be charged. Compute the totals with every line counted, either after the decrement loop or by passing `stock: 1`, with the comment "mọi dòng đều đã trừ kho thành công nên đều tính tiền". This is a one-line change, and change 3's guard depends on it.

3. **The order must equal what the customer confirmed** (Tasks 3 and 5).

   Problem: the action re-reads the cart (`getCartView`), drops lines that are now stock 0 or deactivated, and charges the current price. The customer pressed "Đặt hàng · 312.000₫" but can get "Đặt hàng thành công" for fewer items or a different total. This becomes reachable in the pitch once M5 lets the admin edit prices.

   The same gap makes the DoD e2e "2 khách tranh món cuối" order-dependent. If B's `getCartView` runs after A commits, B's line list is empty and B gets "Giỏ hàng không còn món nào còn hàng.". The test then times out waiting for "Nho xanh Ninh Thuận vừa hết hàng". Two Playwright clicks on two pages are tens of milliseconds apart, while A's whole action is a dozen local queries, so this interleaving is plausible.

   Required:
   - **Form and validation.** Add a hidden `total` input with `totals.totalVnd` and validate it in `parseCheckoutForm` (int ≥0).
   - **Guard inside the transaction.** Add `PlaceOrderInput.expectedTotalVnd`. In `insertOrder`, after the change-2 totals, a mismatch rolls back with a distinct "changed" result. The guard must run **after** the `checkoutKey` lookup, so a resubmission with the already-cleared cart still lands on the existing order (Review Focus 4 and the e2e `dblclick`).
   - **Action message.** For every not-ok result without named items, name the fresh view's stock-0 lines ("X vừa hết hàng."); otherwise say "Giá hoặc giỏ hàng vừa thay đổi, bạn xem lại tổng tiền rồi đặt lại nhé." Return status 409.
   - **Revalidation.** RR skips revalidation when `actionStatus >= 400` (`router.js:1964`), so add to `checkout.tsx`:
     ```ts
     export const shouldRevalidate: ShouldRevalidateFunction = ({ actionStatus, defaultShouldRevalidate }) =>
       actionStatus === 409 || defaultShouldRevalidate;
     ```
     This updates the summary and the button. The inputs are uncontrolled, so what the customer typed survives, and the never-used key is replaced harmlessly.
   - **Tests:**
     - `orders.server.test`: a mismatched `expectedTotalVnd` → not ok, no order, stock unchanged.
     - `checkout.test` (i): a price changed between loader and action → 409, no order.
     - `checkout.test` (ii): the only line's stock set to 0 between loader and action → 409 containing "Nho xanh Ninh Thuận vừa hết hàng".
     - `checkout.test` (iii): resubmit the same body with the first response's cookies (cart cleared) → the same `Location`.
   - Update the test counts.

4. **No path from an on-screen OTP to admin** (Task 4 Step 4, plus tests).

   `startLogin` decides "admin" only from `User.role` at the time the OTP is issued. If the admin row is absent (fresh deploy before seed, or the TRUNCATE→seed window of M7's `demo:reset`), anyone can request a DEMO OTP for `0909000000`. `signIn` then creates a *customer* row for that phone. The seed's upsert (`update: { role: "admin" }`) later promotes that same row, and since `getUser` re-reads the role, the visitor's existing 30-day cookie becomes an admin session. Spec §2 says this must be impossible.

   Fix:
   - (a) In `startLogin`, use `if (user?.role === "admin" || phone === ADMIN_PHONE)` so the seeded admin phone never gets an OTP, row or no row.
   - (b) `signIn(phone, viaPasscode: boolean)` refuses (throw, or return null → "Không đăng nhập được") when the stored role is `admin` and `viaPasscode` is false. This covers admins promoted later (M5).
   - Tests: with the admin row temporarily deleted (restore it in `finally`), `startLogin(ADMIN_PHONE)` → `admin: true`, `demoCode: null`; and `signIn(ADMIN_PHONE, false)` is refused.

5. **Make the Playwright readiness probe DB-free** (Task 7 Step 2).

   Playwright starts `webServer` **before** `globalSetup` (spike 11), and treats a 500 from `webServer.url` as "not ready". `GET /` runs the root and home loaders against `chosang_test`. On a fresh clone where `npm test` has never run, that DB does not exist, so the probe gets 500s for 180 s, the run fails, and the `globalSetup` that would have created the DB never runs. The same happens after any future migration that the test DB hasn't received yet.

   Use `url: \`http://localhost:${E2E_PORT}/favicon.svg\`` (served from `build/client`, no DB). Add one line to the Task 7 Step 6 notes: "e2e works on a clean machine without running vitest first".

6. **Correct and extend the M7 hand-off** (Task 8 Step 7, doc only). The plan says the M7 fix is RR's `allowedActionOrigins` or `trust proxy`. That is incomplete: `readForm` compares `Origin` with `new URL(request.url).origin` itself, so `allowedActionOrigins` alone would still 403 every POST behind TLS. Record these M7 items:
   - (a) Behind a TLS proxy, make `request.url` carry the public scheme and host (trust `X-Forwarded-Proto`/`Host` in the server). Only then do both checks pass. Otherwise `readForm` needs the same allowlist.
   - (b) The admin lockout is keyed by phone, and the login page names the admin phone. Anyone can therefore keep the admin locked out (5 wrong guesses every 15 min). The owner must log in as admin **before** the pitch; the session lasts 30 days.
   - (c) With `DEMO_OTP=1`, any visitor can sign in as any non-admin phone and read its orders (name, address). This is by spec, but visitors must not enter real customer data on a public link.
   - (d) Sessions store an integer `userId` and cannot be revoked server-side. `demo:reset` must not `RESTART IDENTITY` on `User`, or must rotate `SESSION_SECRET`. Otherwise old 30-day cookies map onto the new accounts that reuse those ids (an IDOR across resets).
   - (e) Keep the existing items: `ADMIN_PASSCODE` ≥12; `demo:reset` clears orders/users and reseeds the admin; the four `ponytail:` notes.

## Rulings on decisions and open questions

| # | Ruling | Reason |
|---|---|---|
| D1 test DB as a second database, created from Node; `globalSetup` for both runners | **Approve**, plus change 5 | Non-destructive (`CREATE DATABASE` only, `migrate deploy` never resets), and `TRUNCATE` runs only after `current_database() = 'chosang_test'` on the same connection. The seed only adds missing image variants to the shared `uploads/`, never deletes. |
| D2 `checkoutKey` unique column, order created before the stock decrement | **Approve** | The only race-safe dedupe; the duplicate waits on the index while holding no Product locks. |
| D3 `migrate diff` + `migrate deploy` | **Approve** | No reset path, no shadow DB, and a stop-on-mismatch rule. |
| D4 `updateMany` with `stock gte` in ascending id order | **Approve**, amended by change 2 | One conditional UPDATE, re-checked by Postgres after the lock. Place and cancel both lock Product rows in ascending id order, so no deadlock cycle. |
| D5 `readForm` on every action (Origin + streamed 16 KB cap) | **Approve**, M7 caveat (change 6a) | RR doesn't guard resource routes; `Origin: null` and same-site subdomains are rejected; chunked bodies are capped. |
| D6 OTP = HMAC(secret) in the cookie; admin passcode with an in-RAM counter | **Approve**, plus change 4 | A bare SHA-256 of 6 digits would be reversible from the cookie, so HMAC is right. The RAM counter is the real guard because cookie `tries` replays. Losing it on restart is acceptable for a single-process demo (an attacker can't force restarts, and the passcode is ≥12 characters, generated as 16 hex). |
| D7 attach guest orders on every login | **Approve** | A superset of the spec. |
| D8 4 slots, 60-min lead, VN = UTC+7, capacity 20 | **Approve** | The capacity overshoot of one order is a fair `ponytail:`. |
| D9 stock-0 lines left out, short lines reject the whole order | **Approve**, amended by change 3 | That applies to lines that were stock 0 *when rendered*. A line that changes between render and submit must block, not vanish. |
| D10 flash toast read only by the root loader | **Approve** | Matches the RR docs. See optional 3 for the double-redirect edge. |
| D11 view = owner or code in session; same screen for a missing order | **Approve** | No status or content oracle; `cancel` returns 404 for both. |
| D12 logout = fresh session, POST only | **Approve** | Clears userId, otp and guest codes; keeps `cart`. |
| D13 "Mua lại" sets absolute quantities, clamped | **Approve** | |
| D14 payment state table of conditional `updateMany` | **Approve** | Compact and replay-safe. |
| D15 empty cart → `/collections/all` | **Approve** | |
| D16 empty drawer: basket at 0% + 3 promotions | **Approve** | Exactly the Designer's M2 ruling. |
| D17 `UserRound` icon; header spacing tightened | **Approve** | The 375 px fit is the Designer's call (Q3). |
| D18 e2e on the production build, port 3100, test DB, `workers: 1` | **Approve**, plus change 5 | |
| D19 `allowImportingTsExtensions` | **Approve** | `noEmit` is already on. |
| Q1 `checkoutKey` migration (already accepted) | **No objection.** Risks noted only | (a) The diff runs against the live dev DB; the plan's "exact output or stop" rule is the right guard. (b) Record in Kết quả M3 that "schema complete at M0" now has this exception, so M4/M5 planners don't assume a frozen schema. (c) A replayed key returns that order to whoever sends it; the 122-bit key only lives in the buyer's own page, so this is acceptable (optional 1 hardens it). |
| Q2 "Số này là tài khoản quản trị" on the login page | **Approve** | The admin phone is discoverable anyway: the passcode step differs from the OTP step (no toast, a password field), and `ADMIN_PHONE` is in the source. The real cost is the lockout DoS, handled operationally (change 6b). |
| Q3 placeholder fit at 375 px | **Noted** for the Designer | Task 8 Step 5 already captures the header at 375 px. |
| Q4 M7 carry-overs | **Confirmed, with additions** | Change 6. |

## Checked and found OK (no action)

- **OTP brute force and replay.** Each code is bound to phone + expiry by HMAC and compared in constant time; `tries >= 5` is checked first; expiry is enforced. For guests, replaying `tries` is moot because DEMO shows the code to the requester. For the admin, replay is defeated by the RAM counter, which is checked before verification and cleared on success. The map is bounded because only signed `admin: true` states reach it.
- **Session fixation.** Not applicable to `createCookieSessionStorage`: there is no server-side session id to fix, the state is signed (a forged cookie becomes an empty session, and there's a test for it), and login CSRF is blocked by RR plus `readForm`. Logout issues a fresh session.
- **IDOR.** `canViewOrder` gates the `/orders/:code` loader, `cancel`, `reorder`, and the `/checkout/pay/:code` loader and action. `userId` comes only from the session, never from a form. The stranger and missing-order responses are byte-identical.
- **CSRF on logout.** POST only (`GET` → 400); `readForm` returns 403 on a foreign Origin. Lax wouldn't stop the response's `Set-Cookie`, so the Origin check is the real guard, and it is tested (curl + unit).
- **Fail-closed.** `DEMO_OTP === "1"` exactly. An empty `ADMIN_PASSCODE` blocks admin both at `startLogin` and in `verifyLogin`. In production, a short or `dev-only` passcode or secret stops the boot. Empty preset variables survive `loadEnvFile` (verified).
- **No secrets or crypto in the client bundle.** `env`, zod and `node:crypto` are only in `.server.ts` files and in loader/action code. The login loader returns only a `demoOtp` boolean. The Task 8 greps check zod and HMAC in `build/client`.
- **Cancel restocks exactly once.** `updateMany … status = 'pending'` in the same transaction; the second concurrent cancel re-evaluates after the lock and gets `count = 0` (tested in parallel).
- **Idempotency race.** Duplicate → waits on the unique index → P2002 → re-read by key → same code. A first attempt that rolls back frees the key. An order-code collision retries ×3. Both responses redirect to the same order (tested in vitest and e2e).
- **Snapshots.** Name, unit and price are read inside the transaction; `cartTotals` is shared with the drawer and button.
- **Test-DB safety.** No `migrate reset`, no `down -v` (Task 8 grep). Dev-DB counts are recorded before the work and re-checked after e2e. Every manual production-build check points at `chosang_test`. vitest workers get `DATABASE_URL` from `test.env`, and the Playwright `webServer.env` overrides what the config process loaded from `.env`.
- **Over-engineering.** None found. Each piece maps to the spec or a carry-over. `readForm`'s `maxBytes` and `OrderLineInput.bundleId` are one-token hooks M4 needs.
- **Test arithmetic.** 88+3+16+1+6+16+14+12+9+7+2 = 174; e2e 3+3+7 = 13. Re-count after changes 1–4.

## Optional suggestions

1. **Bind the replay to the submitter.** On the duplicate-key path, return the existing code only if its `phone` matches the submitted phone, so a leaked key can never hand one customer's order to another session. One `select` field plus a comparison.
2. **Don't wipe a changed cart on a stale-key duplicate.** If the first response was lost and the customer edits the cart and resubmits, they land on the first order (correct) but their new cart is cleared. Return a `duplicate` flag and skip the cart `Set-Cookie` in that case. The concurrent double tap is unaffected, because the first response already clears the cart.
3. **"Mua lại" with everything sold out** goes `/orders/:code` → `/checkout` (loader redirect) → `/collections/all`. The flash is read and cleared by the root loader of the redirected `/checkout` request, so the toast may never show. Redirect straight to `/collections/all` when `changes.length === 0`.
4. **Rate-limit lookups cheaply.** Reuse the RAM-counter pattern keyed by order code (5 wrong phones → 15 min). It's about 3 lines, and it removes one of the four `ponytail:` items.
5. **Bundle grep.** Also grep `build/client` for `SESSION_SECRET`, `ADMIN_PASSCODE`, `dev-only` and `e2e-ma-quan-tri` (cheap insurance against an accidental `import.meta.env`/define leak).
6. **Paid, then cancelled.** A cancelled `online_mock` order still reads "Đã thanh toán" with no refund line. Flag it for the Customer gate (one copy line such as "DEMO: tiền được hoàn thủ công"), not code.
7. **Final gate.** Since `security-review` needs git, the Consultant's M3 final review should run Task 8 Step 6's checklist on the shadow-repo diff and re-run the change-1 inputs against the built server with curl.
