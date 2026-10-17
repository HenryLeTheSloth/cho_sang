# M2 Cart: plan gate review (Consultant)

Plan: `docs/superpowers/plans/2026-10-15-m2-cart.md`. Reviewed against spec §2–§6 (the M2 row), the roadmap module contract, Review Focus, every "Kết quả Mx" carry-over, the current code (`root.tsx`, `product-card.tsx`, `product.tsx`, `catalog.server.ts`, `env.server.ts`, `config.ts`, `app.css`), and the installed react-router 8.4.0 sources.

## Verdict: APPROVE WITH CHANGES

The plan is solid. It covers the spec and the M1 carry-overs, the code matches the real exports, the tests are well targeted, and it builds nothing the pitch doesn't need. Two of its own claims do not hold in RR 8.4, though, and both hit the M2 DoD directly ("bấm nhanh liên tục thì giá trị cuối khớp server", no lost lines). The planner's tests run on localhost with 30–60ms gaps, so they cannot catch either one. Fix those two, close the gaps below, and the plan can go to execution without coming back to this gate. Required changes 1–3 belong together. The other changes are small.

### Spec and carry-over coverage

| Requirement | Task | Status |
|---|---|---|
| Signed `cart` cookie, 30 days, httpOnly, lax, secure in prod, `{l,b}`, zod (≤50 lines, qty 1–99), prices re-read from DB | 1, 2 | OK (secure: see change 5) |
| `/cart` resource route: loader plus `set`/`remove` actions; "Hoàn tác" = `set` again | 3 | OK (bundle intents go to M4, correctly) |
| `<dialog>` drawer: focus trap, Esc, 44px close, sticky "Thanh toán · tổng", ship fee and threshold visible | 7 | OK |
| + turns into a stepper on the card; sold-out badge and locked button | 5 | OK |
| Remove with a 5s "Hoàn tác" toast | 7 | OK |
| SVG + `clip-path` freeship basket with the amount still needed | 7 | OK |
| Badge bump plus CSS image flight; reduced motion | 4, 5 | OK (duration: ruling Q3) |
| Error state (spec §4: "đủ trạng thái … error") | none | **GAP**: a network failure on a tap replaces the whole page with the root ErrorBoundary (change 4) |
| Card shows "giá + đơn vị + giá/kg + nguồn gốc" (spec §3) | 5 | **GAP**: the new card `truncate`s `unit · origin`. "túi ~1kg · Hàm Thuận Nam, Bình Thuận" is about 230px on a 141px line, so the origin is cut off (change 6) |
| DoD: rapid taps end in agreement with the server | 3, 5, 8 | **AT RISK**: changes 1–3 |
| DoD: closing and reopening the tab keeps the cart | 3, 8 | OK (unit test on Max-Age plus `expires` check) |
| DoD: forged cookie rejected | 2, 3, 8 | OK |
| DoD: totals and freeship tests | 1 | OK |
| Roadmap Review Focus 3 (stale, hidden or gift-base pid) | 2 | OK |
| M1 carry-overs: card refactor (`after:` overlay), global `useNavigation` indicator, sticky buy bar with price/unit that doesn't cover the policy card, `compareAtVnd != null` (card and product), sold-out pill `text-ink`, even card heights, desktop screenshots | 4, 5, 6 | OK, except that the card-height fix creates the truncation gap above |
| M1 ruling: Designer decides fonts at the M2 review | 8 step 8 | OK (reminder only; see ruling Q4) |
| Module contract: `cart.server.ts`, `env.SESSION_SECRET`, cart button in the header | 2, 1, 4 | OK |

## Required changes

1. **Use `flushSync` for cart submits** (`app/lib/use-cart.ts`). Change the call to `fetcher.submit(cartFormData(...), { method: "post", action: "/cart", flushSync: true })`.
   Why: RR's `RouterProvider` applies router state updates inside `React.startTransition` unless `flushSync` is passed (`node_modules/react-router/dist/development/lib/components.js:145-150`). Until that transition commits, the next tap's handler still holds the old `pending` and `qty`. Rendering 24–72 cards that each call `useCart()` on a mid-range Android can take tens of milliseconds, which is long enough. Two failures follow: a second + on the same item resends the old qty, so a tap is lost, and a tap on a second card sends a map without the first card's change and aborts the request that carried it, so a whole line is lost. That is the exact failure Decision 2 exists to prevent. The router sets the submitting state synchronously before its first `await` (`lib/router/router.js:812`), so with `flushSync` each later tap sees the fresh `fetcher.formData`. Record this as Spike finding 10.

2. **Close the route-discovery hole on the first cart submit.** Add `routeDiscovery: { mode: "initial" }` to `react-router.config.ts`, then re-measure the first-route JS in Task 8 Step 5. The ceiling is still 133120 bytes.
   Why: lazy route discovery is on by default, and `/cart` is never a `<Link>`, so the first submit after a page load has to fetch `/__manifest` first. In `handleFetcherAction` (`router.js:813-835`) the `AbortController` is only registered in `fetchControllers` **after** that discovery `await`. A second tap made during discovery (one mobile round trip) therefore cannot abort the first request. Both actions run, and if the first response lands last, its smaller cookie overwrites the second one and a line is lost. This is exactly the opening move of the pitch: page load, then quick + on two cards. The spike missed it because discovery on localhost finishes inside its 40ms gap.
   If the planner prefers to keep lazy discovery, they must instead prove with the test in change 3 (with `/__manifest` delayed by 500ms) that no line is lost.

3. **Rewrite the rapid-tap checks so they can fail** (Task 5 Step 5 first eval, Task 8 Step 2). Each check must:
   - (a) run on a **fresh page load** where nothing has been submitted to `/cart` yet (`cookie-clear`, then `goto`, not just `reload` after earlier taps);
   - (b) click with **no await between clicks** inside one `eval`, for both the cross-card sequence and the 7× + / 1× − sequence;
   - (c) force out-of-order completion first. Before the clicks, use `playwright-cli run-code` with `page.route('**/cart.data*', ...)` to delay the first action response by about 800ms and each later one by about 100ms, and with change 2 also assert that no `/__manifest` request was made (`requests`). Remove the route afterwards (`unroute`).
   Expected values stay as written: UI = server, every line present, `badge` = sum of quantities. Without changes 1 and 2, (b) fails on the spot, because the stepper selector does not exist yet, and (c) can lose a line. That is what makes the test meaningful.

4. **Soften network errors on a cart tap (ruling Q2).**
   - Spike in ≤30 minutes: a `clientAction` in `app/routes/cart.ts` that wraps `serverAction()` in try/catch and on failure returns `data({ error: "Mất kết nối, bạn thử lại giúp mình nhé." }, { status: 503 })`. The status ≥400 is there so RR skips revalidation, because the offline revalidation would hit the root boundary too. Verify in the spike that RR 8.4 honors `clientAction` on a module with no default export and that the 503 suppresses revalidation. Then show `useCart().error` in a `role="alert"` element that is visible while the drawer is **closed** (cards and product page). Change the existing in-drawer error `<p>` to `role="alert"` as well. The message clears on the next successful submit; no timer is needed.
   - Add to Task 7 Step 5 (or Task 8): `network-state-set offline`, tap + on a card. Expected: the page `h1` is still present (no "Có lỗi xảy ra"), the qty falls back to the server value, and the alert text is visible. Then `network-state-set online`, tap + again: it works and the alert is gone.
   - Task 8 Step 5's zod-in-client grep must still pass, because the route module now ships to the client.
   - If neither `clientAction` nor a same-size alternative works within the spike budget, stop and escalate to the controller. Do not ship the page-blanking behavior silently. Remove the network-error half of Decision 14's `ponytail:` note.

5. **Make `secure` overridable, fail-closed (ruling Q1).**
   - In `app/lib/env.server.ts`, export `COOKIE_SECURE: process.env.NODE_ENV === "production" && process.env.INSECURE_COOKIES !== "1"` inside `env`. `cartCookie` uses `secure: env.COOKIE_SECURE`, and M3's `__session` must reuse it.
   - Add a commented line to `.env.example`: `# INSECURE_COOKIES=1  # chỉ khi demo bản build production qua http:// trong LAN (trình duyệt không lưu cookie Secure từ http)`.
   - Add one test in `env.server.test.ts` using the existing `reload()` pattern: production defaults to `COOKIE_SECURE === true`, and `INSECURE_COOKIES=1` makes it `false`. The total becomes 88 tests; update the counts.
   - In Task 8 Step 8, hand off a carry-over to M7: "pitch topology: HTTPS, or `INSECURE_COOKIES=1` for a LAN http demo".
   Why: `react-router-serve` runs with `NODE_ENV=production`. A phone hitting `http://192.168.x.x:3000` will refuse every `Secure` Set-Cookie (only localhost is exempt), so each tap reverts after revalidation with no visible error. That would kill the pitch and is very hard to diagnose live.

6. **Don't hide spec-mandated card info** (Task 5 Step 3).
   - Make the `unit · origin` line `line-clamp-2 min-h-[2lh]` (heights stay even because the space is reserved). Do not use `truncate`.
   - Take `truncate` off the compare-at/price-per-kg line as well. If it does not fit in one line, let it take a reserved second line (`min-h-[2lh]`) instead of cutting it.
   - Extend the `evenRows` eval in Task 5 Step 5 at 375px on `/collections/all?page=2` with `noClipped: [...document.querySelectorAll('main article p')].every(p => p.scrollWidth <= p.clientWidth && p.scrollHeight <= p.clientHeight)`. Expected: `true`, alongside `evenRows: true`.

7. **Document what the M2 `/checkout` 404 looks like** (Decision 13, doc only). For an unmatched URL RR does not run the root loader, so on that 404 page the header badge reads "0 món" and the drawer is empty. Add one sentence saying this is expected and the cookie is intact (`/cart` still returns it). Tell the Designer and Customer reviewers in the Task 8 handoff, so they don't log it as "cart lost".

## Rulings on decisions and open questions

| # | Ruling | Reason |
|---|---|---|
| D1 root loader returns joined lines | **Approve** | One PK query per page, SSR-correct steppers, no hydration mismatch; the `/cart` loader stays per the spec route map. |
| D2 one shared fetcher key, cumulative pending | **Approve, amended** by changes 1–3 | The idea is right; the cookie as the only state makes server order irrelevant. Two RR 8.4 details break it as written. |
| D3 single `SESSION_SECRET`, reject `dev-only*` in prod | **Approve** | It is cheap and closes the M3 forged-admin hole. |
| D4 `b` = ≤10 cuids, preserved | **Approve** | It matches `GiftBundle.id @default(cuid())`; the M4 intents are deferred correctly. |
| D5 badge = total quantity | **Approve** | Every + gets visible feedback. |
| D6 sold-out line kept, excluded from total; client-only stock cap | **Approve** | It is honest to the user, and M3's transaction is the real guard. Note that the badge still counts that line, which is acceptable. |
| D7 400 instead of clamping | **Approve** | The UI already caps, so a 400 means tampering; no revalidation means a clean optimistic rollback. |
| D8 / Q3 400ms flight | **Provisionally approve; Designer decides at the M2 review** | Spec §4's 200/150ms values are enter/exit/feedback timings. A cross-screen flight at 200ms can't be read. Keep it one value in `.fly-to-cart`, and keep the cleanup timeout ≥ duration + 200ms (note that in a CSS comment). |
| D9 cart needs JS | **Approve** | Spec only requires no-JS for "Xem thêm"; a no-JS POST would return JSON, which is worse. |
| D10 drawer − locked at 1, trash + undo; card − to 0 removes | **Approve** | The spec's undo applies to drawer removal; the card's + is its own undo. |
| D11 `sticky bottom-0` at the end of `<main>` | **Approve** | It meets the carry-over with no JS, and the test checks it. |
| D12 busy bar in `ink`, 150ms delay | **Approve** | It respects the magenta restriction and avoids flicker. |
| D13 `/checkout` 404 in M2 | **Approve** with change 7 | M3 follows next. |
| D14 stale lines keep a slot (`ponytail:`) | **Approve** the stale-line half; **overrule** the network-error half (change 4) | 50 slots against a 40-SKU catalog is a non-issue; a blank page mid-pitch is not. |
| Q1 `secure` vs LAN HTTP | Keep secure-by-default in prod (spec); add the `INSECURE_COOKIES=1` opt-out now | Change 5. One line, fail-closed, reused by M3; deferring it risks a silent cart failure on the real phone at M7. |
| Q2 soften network errors | **Yes, in M2**, bounded spike and an offline test | Change 4. Spec §4 requires error states; the pitch runs on venue wifi. |
| Q3 400ms vs 200/150ms | Left to the Designer, provisional approve | See D8. |
| Q4 font | **Not decided here.** Reserved for the Designer at the M2 review (M1 ruling) | Task 8 Step 8's reminder stays. See optional suggestion 7 for giving them data. |

## Correctness notes checked and found OK (no action)

- **Cookie tampering and size.** Signed (HMAC) plus zod with int4 bounds, duplicate refine, cuid. `parse()` returns null on garbage (spike 1). The worst case of 50 lines with int4 pids plus 10 cuids is about 1.6KB base64, well under 4KB.
- **Aborted responses.** Cookies from aborted requests are dropped because the abort precedes the next send, so server processing order does not matter: the cookie is the only state. Server-side 400s don't revalidate (spike 5).
- **zod stays out of the client.** It is imported only by `.server.ts` files. `cart.ts` is pure, and the root/route type imports are `import type`.
- **Layout.** Using `useFetcher`/`useRouteLoaderData` in Layout is safe in error states (`?? []`).
- **Dialog.** `showModal()` provides inert + Esc + focus return. The backdrop close via `e.target === e.currentTarget` works because the inner div fills the dialog. The `html:has(dialog[open])` scroll lock is fine on iOS 16+.
- **Reduced motion.** The JS skips the flight, and the global media block zeroes the bump, drawer and bar.
- **Test counts.** 44+2+9+27+5 = 87, which becomes 88 with change 5.
- **Seed values.** The values used in the expectations match: 15.000 + 85.000 + ship = 120.000, and 213.000 → 233.000.
- **Executability.** Exact `npm i -E zod@4.6.7` (no install scripts, so `allowScripts` is untouched), no git, no reset or `down -v`, the `.env` append is idempotent, and `.env` ends with a newline.

## Optional suggestions

1. **Skip needless revalidation per tap.** Add `shouldRevalidate` to `collection.tsx`, `home.tsx` and `product.tsx` that returns `false` when `formAction === "/cart"` (the root still revalidates). On `?page=3`, every tap currently re-queries 72 cards plus a count, and the busy bar stays up until that finishes.
2. **Accessibility (M7 owns this, but it is cheap now):**
   - Add an always-mounted `sr-only aria-live="polite"` span in the header announcing "Giỏ hàng có N món". The `<output aria-live>` mounts only at qty>0, so the first add is never announced.
   - Drop `aria-label` from `<output>`: a label can override the live content in some screen readers. If you do, update the test selectors.
   - After the trash button removes a line, move focus to "Hoàn tác". Otherwise focus falls to `<body>` inside the modal.
3. **Drawer row at 375px.** Content width is about 211px; stepper (128px) + gap + a line total ≥ "1.000.000₫" overflows. Add `flex-wrap` to the stepper/price row.
4. **Spec §4 states.** It lists `active:` states, and the new buttons have none; `active:bg-brand-press` / `active:scale-95` (with reduced motion handled globally) would cover it.
5. **Busy bar finish.** When `.is-busy` is removed, the bar snaps to `scaleX(0)` while it fades out. Have the Designer check this in the screenshots.
6. **Cross-site POSTs.** A top-level POST from another site can overwrite a visitor's cart: Lax stops the cookie from being sent but not the Set-Cookie from being stored. The impact is low for a demo. M3's `security-review` should consider an `Origin` check on all POST actions at once.
7. **Font decision data.** In Task 8, run one Lighthouse mobile pass on `/collections/all` and record LCP, so the Designer's font decision at the M2 review starts from current numbers rather than M1's.
