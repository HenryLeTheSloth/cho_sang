# SDD ledger — plan: docs/superpowers/plans/2026-10-15-m3-checkout-orders-auth.md

Plan by Developer-planner (fully prototyped: vitest 184, e2e 13), gated by Consultant (APPROVE WITH CHANGES; 6 changes applied incl. an open-redirect exploit fix). Review: .superpowers/agents/m3-plan-review.md. M3 base a522a78.

## Setup rulings
- Ruling: accept Order.checkoutKey migration (only safe concurrent double-submit guard; non-destructive) — exception to "full schema at M0" recorded for Kết quả M3 — cost if wrong: one extra column.
- Ruling: login page may reveal "Số này là tài khoản quản trị" (Consultant Q2) — admin phone discoverable anyway — cost if wrong: aids lockout griefing (M7 note).
- Ruling: Docker CLI context switched to desktop-linux (user opened Docker Desktop); project DB lives on context "default". Do NOT change the user's global docker context; agents use DOCKER_CONTEXT=default; tell the user at the end — cost if wrong: user's own `npm run setup` may try to start the DB on Docker Desktop (port 5432 conflict).

## Progress
Task 1: ⚠️ resolved: .env has DEMO_OTP=1 and ADMIN_PASSCODE set; dev DB Product 41, Order 0
Task 1: minor (deferred): test-db bin() cwd-relative; TRUNCATE table list hard-coded (M4 GiftBundle? — covered via CASCADE from Order/Product refs; extend when new tables); ADMIN_PASSCODE not trimmed
Task 1: complete (commits a522a78..be1b5cd, review clean; 91 tests)
Task 2: Ruling: safeRedirect throws TypeError on malformed '//a b' targets → 500 from a crafted link; reviewer rated Minor but it is a trust-boundary input → fix now: try/catch returning fallback + test row
Task 2: minor (deferred): empty drawer at 1280 never screenshotted; ~15px light strip on right of drawer at 375 (scrollbar-gutter?) — check at M3 UI gate
Task 2: fix round 1/5 (1 addressed — safeRedirect try/catch + 2 rows; commits aa8ddd0..2243b0a)
Task 2: complete (commits be1b5cd..2243b0a, review clean after 1 fix round; 114 tests)
Task 3: carry to Task 5: action must re-validate deliveryDate/slot + capacity server-side; qty from signed cart (1..99 by cart zod); checkoutKey z.uuid; 'Một món đã ngừng bán' has unit '' — message must handle
Task 3: carry to Task 6: cancelled order may have paymentStatus paid — view must not show 'Đã thanh toán' without context
Task 3: minor (deferred): $transaction default timeout 5s → second click could 500 (P2028) under contention; no test pins stock:1 nor proves deadlock-sort test can fail; delivery boundary 07:00/07:01 untested; deactivated-mid-tx reported as 'chỉ còn N'
Task 3: complete (commits 2243b0a..131c93c, review clean; 137 tests; migration verified on both DBs)
Task 4: Ruling: fix round includes I1 (stale userId bounce at login.tsx:800) + minors 1 (ponytail comment: guest tries/replay cookie-only, need server counter before real SMS), 2 (toast repeats same text — real UX bug), 3 (fail-closed tests for DEMO_OTP off / ADMIN_PASSCODE empty) — cheap, security/UX-relevant
Task 4: minor (deferred): admin tests share module-level adminFailures map (order-dependent)
Task 4: fix round 1/5 (4 addressed; commits a864f21..962d88a)
Task 4: minor (deferred): unstubAllEnvs not in afterEach; no test that unset(userId) keeps otp/guest codes; toast nonce untested
Task 4: complete (commits 131c93c..962d88a, review clean after 1 fix round; 169 tests)
Task 5: Ruling: accept (d) deviation direction but replace with source fix — placeOrder 'gone' path returns reason 'changed' (drop unit:'' sentinel, conflictMessage branch + export + extra test)
Task 5: Ruling: fix round = I1 (slot error role=alert + revalidate on 400) + minors 2 (shipping line in mobile sticky bar — customer 'phí ship hiện sớm'), 3 (source fix above), 4 (render paymentMethod error; hide 'Sửa giỏ hàng' unless 409), 6 (assert online paymentMethod saved; assert no order on out-of-stock 409; callOnSubstitute unchecked→false)
Task 5: minor (deferred → M7): 409 names already-struck items as 'vừa hết hàng'; subtitle 'Giao trong ngày…' inaccurate after 18:00/online; stale 409 alert persists after drawer edits; prefill test order-coupled
Task 5: fix round 1/5 (5 addressed; commits 0ac1ead..7984bbd)
Task 5: complete (commits 962d88a..7984bbd, review clean after 1 fix round; 182 tests)
Task 6: Ruling: accept cancelled+paid label deviation ('đơn đã huỷ, tiền demo sẽ được hoàn', DEMO-labelled)
Task 6: minor (→ M3 gate fix wave): reorder error uses text-danger without CircleAlert icon (global constraint); no test for cancelled+paid label; no route test that pay on cancelled order is a no-op; cod intent untested at route level; missing screenshots (failed-pay branch, guest lookup, /orders list)
Task 6: minor (→ M7 / pre-production): phone lookup has no rate limit (≈1M codes/day) — must add counter before non-demo; stale pay double-submit lands on order page without toast; phone in query string
Task 6: complete (commits 7984bbd..4883394, review clean; 191 tests; IDOR identical on every verb)
Task 7: minor (→ M3 gate fix wave): admin lockout counts brittle under retries; mock-payment e2e doesn't click COD fallback nor assert stock after failure; hydration check race on last page + /checkout/pay not visited; fixed 3000ms sleep; comment typo; E2E_ENV doesn't set INSECURE_COOKIES/COOKIE_SECURE explicitly; empty-drawer test doesn't verify items are promos
Task 7: complete (commits 4883394..cf3eeb6, review clean; e2e 13, vitest 191; mutations flushSync/routeDiscovery red→restored)
Task 8: complete (verification only; vitest 191, e2e 13; JS 125490; LCP / 2.1 all 2.6 pdp 2.6; fail-closed + security sweep ok)
Gate: Consultant M3 = With fixes (I1 stale checkoutKey after slot re-validation → duplicate order risk; fix-now 1–6). LCP /collections/all 2.64s stable — NOT caused by M3 (A/B), M2 grid; → M7
Gate: Designer+Customer M3 = PASS WITH FIXES (Customer would buy; Important D1–D7, C3a, C4)
Ruling: parallel agents must not share chosang_test — M4 planner scratch told to use its own DB (chosang_m4spike); reset at ~11:27 was a cross-agent interference, not an app bug
Ruling: ONE M3 fix wave = Consultant fix-now 1–6 + UI Important D1–D7, C3a, C4 + UI minors marked 'fold into this wave'; M7 minors stay deferred
Fix wave: all Consultant fix-now + UI Important + folded minors addressed (re-review clean; commits b329efd..f427da7); vitest 199, e2e 13, JS 125531
Ruling: residual I1 micro-race (takenSlots before orderForKey swap) → M4 plan (M4 edits checkout action anyway); paymentFailed derivation → M5; key-to-session binding → M7
Ruling: no cut-order applied at the M3 progress checkpoint — agent pipeline, not 1-dev days
