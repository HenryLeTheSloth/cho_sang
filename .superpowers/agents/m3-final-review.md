# M3 final review (milestone gate): checkout + orders + OTP auth

Reviewer: Consultant. Range: a522a78..b329efd (pre-packaged diff, ≈200KB). There is no git, so I did not use worktrees.

I did the review myself in four passes: (1) auth, session, security and env; (2) the order core (placeOrder, cancel, payment, delivery); (3) the routes (checkout, pay, order, orders, login, logout, root, cart); (4) the tests, e2e, test-DB plumbing and the evidence (task reports, DoD screenshots, Lighthouse JSON). I read every non-generated source file in the range from the working tree at HEAD.

**Verification I ran myself:**
- `npm test`: 20 files, 191/191 passed.
- `npx playwright test e2e/checkout.spec.ts` on the production build: 7/7 passed (10.5s). Port 3100 was free afterwards and test-results/ was removed.
- Lighthouse 13.5.0 mobile, 3 runs each, on the production build against `chosang_test`. I also ran an A/B build in the scratchpad (see the LCP section). Every server I started was stopped by PID. I wrote nothing to the dev DB.

## Strengths

- **Order core is right where it matters.**
  - One transaction does it all. The order is created first, so a duplicate `checkoutKey` blocks on the unique index before any Product row is locked.
  - Stock is taken with a conditional `updateMany … stock >= q`, sorted by id so two orders cannot deadlock.
  - The total is recomputed inside the transaction from DB prices with `stock: 1` on every line, then compared to `expectedTotalVnd`. The customer is never charged a number they did not see.
  - Cancel is `updateMany WHERE status='pending'`, then restock, so two concurrent cancels restock once.
  - All of the above is tested against a real Postgres, including the concurrency races (last-item race, double key, reverse-order deadlock, double cancel).
- **The auth surface is careful.**
  - The OTP is an HMAC of phone + code + expiry using the server secret. The cookie never holds the code.
  - The admin passcode is compared with a constant-time HMAC compare that does not depend on input length.
  - The admin is never on the OTP path, even when the User row is missing (ADMIN_PHONE check). `signIn(…, false)` refuses admin accounts.
  - There is a server-side lockout because the cookie `tries` counter can be replayed.
  - Both flags fail closed and have tests. Production refuses the sample SESSION_SECRET, a short secret, and a weak ADMIN_PASSCODE.
- **Trust-boundary helpers are small and central.**
  - `readForm` checks Origin / Sec-Fetch-Site and streams the body with a byte cap, so a chunked body without Content-Length is still capped. Every action uses it (the Task 8 grep and my own read agree).
  - `safeRedirect` uses the WHATWG parser and then re-checks for `//` after normalisation. It catches `/.//`, `/..//` and `/\` and never throws.
- **IDOR is handled consistently.**
  - `canViewOrder` guards the order loader and every non-lookup intent.
  - `/checkout/pay/:code` redirects.
  - "No access" and "does not exist" render the same screen.
  - A wrong phone and a wrong code give the same message.
- **Test infrastructure is safe by construction.**
  - `chosang_test` is derived from the dev URL.
  - TRUNCATE runs only after `current_database()` confirms the test DB.
  - The e2e probe does not touch the DB.
  - `reuseExistingServer: false`.
  - The mutation checks from Task 7 prove that the e2e suite pins `flushSync` and `routeDiscovery`.
- **Every M2 carry-over to M3 is delivered:** Playwright port, empty-drawer suggestions, `__session` on the same secret, Origin + body cap, out-of-stock lines, `isWeighed`, test DB, JS re-measured (125,490 B gzip, cap 133,120 B).

## Issues

### Critical (must fix)

None.

### Important (should fix)

**I1. The double-submit guarantee breaks when the first order fills or closes its delivery slot.** (`app/routes/checkout.tsx:53-54`; compare `app/lib/orders.server.ts:67-68`)
- **What's wrong:** The action re-validates the form, including slot capacity and "past" (`parseCheckoutForm(form, deliveryDays(now, await takenSlots(now)))`), *before* `placeOrder` looks up `checkoutKey`. Take a repeat POST with the same key: a double tap, a network retry, or Back + resubmit. If the first request took the slot's 20th seat, or the clock crossed the 60-minute lead boundary in between, the repeat gets a **400 "Khung giờ này vừa kín hoặc đã qua"** even though the order already exists.
- **Why it gets worse:** `shouldRevalidate` re-runs the loader on 400, which issues a **new** key. If the first response was aborted (RR interrupts the earlier navigation, so its cart-clearing Set-Cookie may never land), the cart is still full. The customer picks another slot and places a **second order**, and stock is decremented twice.
- **Why it matters:** This is exactly the roadmap Review Focus 4 contract ("bấm Đặt hàng hai lần … chỉ tạo một đơn"). The comment on `placeOrder` claims the key lookup runs "TRƯỚC mọi kiểm tra khác", but at the action level it does not. The window is narrow, but it is real, and the fix is a few lines.
- **Fix:**
  1. At the top of the action, after `readForm`, look up the order by `form.get("key")` (export a small `orderCodeForKey(key)` from orders.server, or reuse the existing `findUnique`). If one exists, take the existing success path: `addGuestOrder`, clear `l`, redirect. Validation only runs for keys that are still new.
  2. Add a regression test in `checkout.test.ts`: seed 19 orders in a slot, place the 20th with key K, POST K again, and expect a 302 to the same code with no new order.

### Minor (nice to have)

**N1. A stale `userId` makes checkout return 500.** (`app/routes/checkout.tsx:60`)
- The action passes `session.get("userId")` straight into `Order.userId` (an FK to User). If that user row no longer exists, `order.create` throws P2003 and the customer sees "Có lỗi xảy ra" on "Đặt hàng".
- Only `/login` cleans a stale id. This is unreachable in M3, but it becomes reachable after M7 `demo:reset` if the owner picks the "no RESTART IDENTITY" option of plan transfer (d).
- Fix (one line): `userId: (await getUser(session))?.id ?? null`.

**N2. The reorder error breaks the global inline-error rule.** (`app/routes/order.tsx:267-271`) It uses `text-danger` without the CircleAlert icon. The ledger already routes this to the gate fix wave.

**N3. Slot capacity is checked outside the transaction, so it is a soft cap.** (`app/lib/orders.server.ts:193-200` together with `checkout.tsx:53`) N concurrent orders can over-admit by up to N−1, not by "1" as the plan's M7 transfer (e) says. This is acceptable for the demo. Correct the wording in the M7 transfer note.

**N4. `placeOrder` maps only P2002.** (`app/lib/orders.server.ts:77`)
- P2003 (a deleted GiftBundle in M4, or the stale user in N1) and P2028 (the 5s transaction timeout under lock contention, already in the ledger) surface as 500.
- M4 should map a missing bundle to `changed`. P2028 can wait for M7.

**N5. `loggedIn` reads the raw session.** (`app/routes/order.tsx:104`) `loggedIn: session.has("userId")` is true for a stale id, which hides "Lưu đơn vào tài khoản". This is cosmetic. Fix it together with N1 only if it comes for free.

**N6. Two `__session` cookies can land on one response.** (`app/routes/login.tsx:113-118` together with `app/root.tsx:25-28`) When the login loader clears a stale `userId` and a flash toast is pending, both loaders commit their own copy of the session in the same response, and the last header wins. Both preconditions are rare. Drop it.

**N7. `/collections/all` LCP is 2.64s, over the spec budget of <2.5s, but M3 did not cause it.** See the LCP section below. Carry it to the M7 LCP pass together with the PDP's 2.6s.

## /collections/all LCP: is it an M3 regression?

| Build | Runs (ms) | Median |
|---|---|---|
| HEAD (as shipped) | 2645 / 2714 / 2642 | **2.64s** |
| HEAD with the root loader's `listPromotions(3)` removed (A/B build in the scratchpad) | 2571 / 2643 / 2641 | **2.64s** |
| Home `/` at HEAD | 2156 / 2113 / 2259 | 2.16s |

- **The number is stable, not noise.** Task 8's single 2.6s run reproduces in all three of my runs. FCP is 2.12s in every run.
- **The root loader is not the cause.** The empty-cart suggestions add about 436 B to the transferred document (10,666 vs 10,230 B). Removing them changes LCP by 0ms (the HEAD and A/B medians are identical). TTFB is about 30 ms. The suggestion images sit in a closed `<dialog>` with `loading="lazy"` and are never requested (I confirmed this in the network list).
- **The manifest and JS are not the cause either.** M3 adds about 2.1 KB gzip of shared JS (toast chunk, manifest at 1,489 B, the header link). On a 345 KB page under Lantern's simulated 1.6 Mbps, that is about 0.01–0.02s. The PDP shares the same JS and did not move (2.6 → 2.6).
- **What does drive it:** The LCP element is the first grid image (`rau-muong-320.avif`, fetchpriority=high, discoverable, eager). Its simulated load competes with about 125 KB of JS and the 17 lazy grid images that Chrome starts inside the viewport margin. That is a property of the M2 collection page.
- **Verdict:** There is no material M3 regression. The M2 "2.4s" baseline was most likely a favourable single run or different conditions. The page is nonetheless over the spec budget, so it goes to M7. Options there: fewer images in the initial grid viewport margin (eager image count / `sizes`), or a smaller JS budget. Do not move the drawer suggestions to fix this; the A/B proves they cost nothing.

## Ledger triage (every "minor" line)

| # | Ledger minor | Triage | Note |
|---|---|---|---|
| T1a | test-db `bin()` is cwd-relative | **drop** | Only npm/vitest/playwright invoke it, and they always run from the root |
| T1b | TRUNCATE table list hard-coded | **fold M4/M5** | GiftBundle is already listed. Extend the list whenever a migration adds a table |
| T1c | ADMIN_PASSCODE not trimmed | **later (M7 deploy)** | Fails closed: a trailing space or newline locks the owner out, never lets anyone in. Add `.trim()` or a deploy-checklist line |
| T2a | Empty drawer at 1280 never screenshotted | **drop** | Resolved by dod-drawer-empty-1280.png |
| T2b | ~15px light strip on the drawer at 375 | **drop** | It is the `scrollbar-gutter: stable` gutter (app.css:30) in headless Chrome with classic scrollbars. Real phones use overlay scrollbars, so the strip does not exist there |
| T3a | `$transaction` 5s timeout → P2028 500 | **later (M7)** | Demo concurrency is tiny. Map it or raise `timeout` before real traffic (see N4) |
| T3b | No test pins `stock: 1` | **fold M4** | M4 edits `insertOrder` for bundle lines anyway, so add the pin then: concurrent cancel restocks during an order and the total must still include the line |
| T3c | Deadlock-sort test can't prove it fails | **drop** | The sort is one line plus a comment. Postgres would surface 40P01, not corrupt data |
| T3d | Delivery boundary 07:00/07:01 untested | **fix now** | 2 assertions on a strict-inequality branch in core time logic |
| T3e | Deactivated mid-transaction → "chỉ còn N" | **drop** | Window of milliseconds inside one transaction. The wording is the only consequence |
| T4a | Admin tests share the module-level `adminFailures` map | **fold M5** | Reset the map (or use distinct phones) if M5 adds admin login tests |
| T4b | `unstubAllEnvs` not in afterEach | **drop** | Files are isolated, and leakage only affects a test that already failed |
| T4c | No test that `unset(userId)` keeps otp/guest codes | **drop** | |
| T4d | Toast nonce untested | **drop** | Verified visually. Low risk |
| T5a | 409 names already-struck items as "vừa hết hàng" | **later (M7 polish)** | Agree with the ledger |
| T5b | Subtitle "Giao trong ngày… trả tiền khi nhận hàng" inaccurate after 18:00 or for online payment | **later (M7 copy)** | Agree |
| T5c | Stale 409 alert persists after drawer edits | **later (M7 polish)** | Agree |
| T5d | Prefill test is order-coupled | **drop** | |
| T6a | Reorder error lacks the CircleAlert icon | **fix now** | N2. Global constraint |
| T6b | No test for the cancelled+paid label | **drop** | The logic is a view-only ternary, verified in the t6 screenshots |
| T6c | No route test that pay on a cancelled order is a no-op | **fix now** | Money path. One route test: cancel, then POST `pay` and `cod`, and assert the order is unchanged. Fold T6d into the same test |
| T6d | `cod` intent untested at route level | **fix now** | Same test as T6c: on an unpaid online order, POST `cod` → `paymentMethod` becomes cod |
| T6e | Missing screenshots (failed pay, guest lookup, /orders) | **drop** | Resolved in the DoD set |
| T6f | Phone lookup has no rate limit | **later (M7)** | Agree. Moot while DEMO_OTP=1 (transfer c) |
| T6g | Stale pay double-submit lands without a toast | **later (M7 polish)** | |
| T6h | Phone in the query string | **later (M7)** | The spec mandates `/login?phone=`. Revisit only for real SMS |
| T7a | Admin lockout counts brittle under retries | **drop** | No retries are configured, and the server restarts on every run |
| T7b | Mock-payment e2e skips the COD fallback and the stock assertion after failure | **drop** | Covered by the T6c/T6d route test and the `setOnlinePayment` unit test |
| T7c | Hydration check race; `/checkout/pay` not visited | **fix now** | The console/hydration test never visits `/checkout` (the cart is empty after the order) or `/checkout/pay/:code`, the two most complex M3 pages. Add both and settle with `waitForLoadState("networkidle")` after the last page |
| T7d | Fixed 3000ms sleep | **drop** | It is the deliberate slow-response delay inside the route handler (cart.spec.ts:26), not a wait-for-state |
| T7e | Comment typo | **drop** | Fix it in passing if the file is touched |
| T7f | E2E_ENV doesn't set INSECURE_COOKIES/COOKIE_SECURE explicitly | **drop** | Chrome treats localhost as a secure context, so Secure cookies work either way |
| T7g | Empty-drawer e2e doesn't verify the items are promos | **drop** | |

## Rulings: does any look wrong?

No. Each one, with my reasoning:

- **The `checkoutKey` migration was correct.** It is the only race-safe guard. One open caveat: it is not *sufficient* at the action level, because of I1.
- **Revealing that a phone is the admin's was correct.** The admin phone is discoverable anyway. The lockout griefing is already recorded as M7 (b).
- **The `safeRedirect` try/catch was correct.** It is a trust boundary.
- **The Task 4 fix round was correct.**
- **The Task 5 'gone' → 'changed' source fix was correct.** It is better than the `unit:''` sentinel.
- **The Task 6 cancelled+paid label was correct.**

One wording correction: plan M7 transfer (e) says slot capacity "có thể vượt 1 đơn". It is up to N−1 under N concurrent orders (N3).

One amendment to M7 transfer (d), the stale `userId`: prefer **rotating SESSION_SECRET** in `demo:reset`. It closes both the IDOR-after-reuse and the stale-id cases. If N1 is applied now, either option is then safe.

## Security review (auth + orders surface)

| Area | Verdict |
|---|---|
| CSRF | Every action goes through `readForm` (Origin, else Sec-Fetch-Site). RR 8.4 also checks UI routes. `/cart` and `/logout` have tests returning 403. Logout is POST-only. SameSite=Lax on both cookies |
| Open redirect | `safeRedirect` in the `/login` loader + action and in `/logout`. Its output is re-checked for `//`. The header builds `redirectTo` only from the current path. curl and e2e both confirm |
| Session | Signed cookie, HttpOnly, Lax, Secure in production, 30 days. `userId` is read only from the session, never from a form. **Residual:** the integer `userId` cannot be revoked (M7 d) |
| OTP | HMAC(secret, phone:code:exp), 6 digits from `randomInt`, 5 tries, 5 minutes, bound to the phone. The tries counter and resend live in the cookie, so they are replayable and resend is unlimited. That is harmless while DEMO_OTP shows the code on screen, and it is recorded as a `ponytail:` comment. Must become server-side before real SMS (M7) |
| Admin | Never gets an OTP (role **or** ADMIN_PHONE). Passcode compared in constant time via HMAC. In-memory lockout of 5 tries per 15 minutes per phone (single process, `ponytail:`). Production requires ≥12 characters. `requireAdmin` re-reads the role from the DB on every request, so a demotion takes effect immediately |
| Fail-closed | DEMO_OTP must be exactly "1". An empty ADMIN_PASSCODE means no admin login. Both are tested, and both were curled on the production build (Task 8) |
| IDOR | Order loader, cancel and reorder, pay loader and action are all gated by `canViewOrder`. Lookup needs code + phone, with identical errors and an identical "no access" screen. `/orders` lists only the user's own orders or the codes in the session |
| Money / stock | Prices are re-read in the transaction. The total must equal what the customer saw. Stock never goes negative (conditional UPDATE plus the M0 CHECK). Payment transitions are guarded by the from-state and `status='pending'`, so a cancelled order cannot be marked paid |
| Input | zod at the server boundary (lengths, uuid key, numeric total). Phone is normalised. The 16 KB cap stops body-size abuse. All output is React-escaped. The echoed `:code` is plain text |
| Accepted by spec / plan (not findings) | DEMO_OTP=1 lets anyone log in as any non-admin phone and read its orders (M7 c). Lookup is not rate-limited (M7). Online orders that never pay hold stock with no TTL (`ponytail:`) |

## M4 / M5 foundation

M3 is a sound base for both milestones. The contracts M4 and M5 need exist and are tested:
- `OrderLineInput.bundleId` and `aggregateQty` across bundle lines (there is a test with the same product on several lines).
- `readForm(request, maxBytes)`.
- `requireAdmin`.
- The `*_at` timeline in `toOrderView`.
- `cancelOrder` with a pending guard.

Carry-overs follow.

**M4 (gift bundle through cart → placeOrder → order view):**
1. **The checkout action and loader read only `cart.l`.** M4 must:
   - build the bundle lines (items + base, each with `bundleId`) from `cart.b`;
   - include them in the summary **and** in the hidden `total`. Otherwise every bundle order returns 409 "changed".
2. **Validate bundle ids before `placeOrder`.** Either check that the GiftBundle rows exist or map P2003 to `changed` (N4). The cookie `b` can outlive its bundle.
3. **Checkout clears `l` but keeps `b`** (`checkout.tsx:70`). Clear `b` on success too, or the bundle stays in the cart and gets ordered again.
4. **Keep the gift base orderable.** `insertOrder` filters `isActive` only (not `visible`), which correctly lets a hidden gift-base product be ordered. Keep it that way. `getCartView` skips the gift base, so bundles need their own view and totals.
5. **`conflictMessage` only knows normal cart lines.** Out-of-stock items inside a bundle need wording that names the bundle.
6. **`toOrderView` flattens items.** Group them by `bundleId` and show the preview, behind `canViewOrder`. Render the preview only after the data-URL prefix + length check.
7. **`reorderQuantities` skips bundle lines.** Decide and state the UX.
8. **`/gift` action:** use `readForm(request, <≈100 KB>)` for the ≤60 KB preview plus layout.
9. **Pin the `stock: 1` total test** (T3b) while editing `insertOrder`. Extend the test-db TRUNCATE list for any new table (T1b).

**M5 (admin):**
1. **Gate admin actions as well as loaders.** The `/admin` layout gates loaders, but **every admin action must also call `requireAdmin`** (or use RR middleware), plus `readForm`.
2. **Status changes must be conditional.** Use `updateMany WHERE status = <expected>` and write `preparingAt` / `shippingAt` / `doneAt` monotonically. The customer timeline reads exactly these columns.
3. **`cancelOrder` only cancels `pending`.** Admin cancel of preparing/shipping orders needs a from-set variant with restock. Decide the refund label for paid online orders.
4. **`setOnlinePayment` requires `status='pending'`.** Moving an unpaid online order to preparing removes the customer's pay link. Pick a rule: block it, or convert to COD.
5. **Product "delete" must be soft** (`isActive=false`). `OrderItem.productId` is an FK with RESTRICT, and `cancelOrder` restocks with `product.update`.
6. **The admin upload must not go through the 16 KB `readForm` default.** Pass an explicit cap. `readForm` buffers in memory, which is fine at 5 MB.
7. **Reset `adminFailures` between admin login tests** (T4a). The owner should log in before the pitch (M7 b).

**M7 additions:**
- (d) prefers SESSION_SECRET rotation.
- ADMIN_PASSCODE trim.
- P2028 mapping.
- `/collections/all` LCP of 2.64s (stable) and PDP of 2.6s.
- The polish items from the ledger.

## Fix now (M3 fix wave)

1. **I1:** look up `checkoutKey` before form/slot validation in the checkout action, and add a regression test (19 orders in a slot → 20th with key K → repost K → same order).
2. **N1:** `userId: (await getUser(session))?.id ?? null` in the checkout action.
3. **N2 / T6a:** CircleAlert on the reorder error (`order.tsx:267`).
4. **T6c + T6d:** one route test. A cancelled order ignores `pay` and `cod`. `cod` on an unpaid online order switches the method.
5. **T7c:** add `/checkout` (with a cart) and `/checkout/pay/:code` to the console/hydration e2e and settle after the last page.
6. **T3d:** delivery boundary rows (07:00 → 08:00 slot open, 07:01 → past).

## Declined to judge

- DEMO_OTP account takeover by any phone, and reading that phone's orders: spec-mandated demo behaviour, recorded as M7 (c).
- `/login?phone=` puts the phone number in the URL: the spec requires it.
- Visual and copy quality of the screens: the Designer/Customer gate covers this. I only checked the drawer strip and the global error-icon rule.
- Origin checks behind a TLS proxy: M7 (a). Not testable before deployment exists.
- Admin lockout griefing via the public admin phone: ruled and recorded as M7 (b).
- Rate limits on lookup and OTP resend: ruled for M7, and moot while DEMO_OTP=1.
- Online orders holding stock without a TTL: spec `ponytail:`.
- LCP on a real Android device: the spec places it at M7. I measured Lighthouse simulate only.
- Progress-checkpoint day count (spec §6 M3 checkpoint): the controller owns it. I have no timesheet data.

## Assessment

**Ready to merge?** With fixes.

**Reasoning:** The transaction, stock, money, IDOR, CSRF, open-redirect and fail-closed foundations are correct and tested against a real database, and they give M4 and M5 the contracts they need. The one Important gap (I1) breaks the double-submit guarantee only when the first order fills or closes its slot, and it is a few-line reorder in the action. The other fix-now items are one-liners or single tests. The `/collections/all` LCP of 2.64s is not an M3 regression (the A/B test shows the root-loader addition costs 0ms) and moves to M7.
