# M2 Cart: milestone gate (Consultant, whole-milestone review)

Range: 4353b34..3a66842 (8 commits, 25 files, +941/−52). I read the whole diff (`.superpowers/sdd/2026-10-15-m2-cart/review-4353b34..3a66842.diff`) in two passes: server/lib first, then UI. I checked it against the plan, the plan-gate review (`m2-plan-review.md`), spec §3–§6, the roadmap's M1 carry-overs, the ledger, all eight task reports, and the DoD screenshots. I re-ran the checkpoint myself: `npm run typecheck` is clean and `npm test` passes 12 files / 88 tests. I measured the freeship basket fill in the screenshots: at 76% it fills 12 px rows, at 100% it fills 16.

## Verdict: READY WITH FIXES (small fix wave, no Critical findings)

M2 meets its DoD and is a sound foundation for M3. The cart state model is correct: the cookie is the only state, every submit carries every pending pair, `flushSync` is on, and route discovery is `initial`. The rapid-tap test was rewritten to be able to fail (fresh page, no awaits, out-of-order responses), and it passes. All seven required changes from the plan gate are in the code. The fix wave below is six small UI/a11y edits, each one to three lines. None of them blocks M3 planning.

## Strengths

- **The race design holds.** `app/lib/use-cart.ts:22-23` submits `new Map(pending).set(id, qty)` on the shared key `"cart"` with `flushSync: true`. `react-router.config.ts` sets `routeDiscovery: { mode: "initial" }`, and the code comments explain why both are required. The evidence is real: the 800 ms delayed-first-response run gave UI = server, no lost lines, and 0 `/__manifest` requests (Task 5 and Task 8 reports).
- **The trust boundary is tight.** The cookie is signed. zod re-validates it on every read (int4 pid bound, duplicate refine, 50 lines, qty 1–99, cuid bundles), and every failure becomes `EMPTY_CART`, never a 500. Prices are always re-read from the DB through the shared `visible` filter. The 400s write no cookie and don't revalidate, so the optimistic UI rolls back cleanly. zod stays server-only (the Task 8 grep confirms it).
- **Error handling.** The `clientAction` (`app/routes/cart.ts:26-31`) turns a network failure into an inline `role="alert"` instead of a blank ErrorBoundary page. The offline run (page.route abort) shows the page stays up, the qty rolls back, the alert appears and then clears.
- **Production safety for M3.** There is one `SESSION_SECRET`, `dev-only*` is refused in production, and `COOKIE_SECURE` fails closed with an explicit `INSECURE_COOKIES=1` opt-out. Each has a test.
- **Small and native.** `<dialog>`/`showModal()` handles the focus trap and Esc. Motion is pure CSS (`starting:`, `transition-discrete`), the freeship basket is SVG plus `clip-path`, and the only new dependency is zod. First-route JS is 123,368 B against a 133,120 B budget.
- **Tests target real behavior.** Forged, re-signed and out-of-range cookies, the 51st line, Undo ordering, Max-Age/HttpOnly/SameSite, and the totals and freeship boundaries (299k, 300k, sold-out line) are all covered.
- **M1 carry-overs are all closed:** the card `after:` overlay restructure, the global pending bar, a sticky buy bar that covers nothing, `compareAtVnd != null`, the `text-ink` sold-out pill, even card heights with unit/origin no longer truncated, and desktop screenshots.

## Plan alignment

Every task in the plan was implemented. The plan-gate changes map to the code as follows:
1. `flushSync`: `use-cart.ts:23`.
2. `routeDiscovery`: `react-router.config.ts`.
3. Rapid-tap test that can fail: T5 and T8 reports.
4. `clientAction` plus the offline test: `routes/cart.ts`, T7 report.
5. `COOKIE_SECURE` plus its test and `.env.example` line.
6. No-truncation card: `product-card.tsx`, `noClipped` check in the T5 report.
7. 404 documentation: global-constraints D13.

All deviations were justified and ruled on: the inset focus rings, the "Tìm món…" placeholder, and the offline test using `page.route` instead of `network-state-set`.

**One open process item:** Task 8 Step 8 (handoff) was "skipped per controller". The roadmap still has no "Kết quả M2" section. See Recommendation 1. It must exist before M3 is planned.

## Issues

### Critical (Must Fix)

None.

### Important (Should Fix)

**I1. The no-lost-line guarantee has no automated regression guard.** The guarantee rests on `use-cart.ts:23` (`flushSync: true`) and `react-router.config.ts` (`routeDiscovery: initial`). Both are one-token settings, and nothing in `npm test` fails if either is removed or "cleaned up". The only proof is ad-hoc `playwright-cli eval` runs recorded in reports. M3's DoD brings in `@playwright/test`. Port the T8 rapid-tap scenario into the suite at that point: fresh context, `page.route` delaying the first `/cart.data` by 800 ms, taps with no awaits across two cards, then assert UI = `GET /cart`, badge = sum of quantities, and 0 `/__manifest` requests. Port the T7 offline scenario too.
- **Triage:** fold into M3, as a required plan item rather than optional. Nothing to fix now, because there is no Playwright harness to put it in yet.

### Minor (Nice to Have)

New findings from this review:

- **N1. Focus is lost after a trash-button removal** (`app/components/cart-drawer.tsx:33-36`, undo button at :66-77). With `flushSync`, the `<li>` that holds the focused trash button is removed synchronously, so focus falls to `<body>` inside the modal and keyboard and screen-reader users lose their place (WCAG 2.4.3). The plan gate raised this as optional suggestion 2, and it was not adopted.
  - **Fix:** add `autoFocus` to the "Hoàn tác" button. It mounts in the same commit.
  - **Triage:** fix now.
- **N2. A sold-out line's total is shown in brand magenta, as if it counted** (`cart-drawer.tsx:119`). The row says "không tính vào tổng", but its price looks like a counted price, so the lines visibly don't add up to "Tạm tính". This is the ledger's "out-of-stock line not visually distinct" item, sharpened.
  - **Fix:** when `line.stock === 0`, render the line total `text-ink-muted line-through` instead of `text-brand`.
  - **Triage:** fix now.
- **N3. The header error alert outlives the problem** (`app/components/site-header.tsx:69-73`). A keyed fetcher keeps its `data` across navigations, so "Mất kết nối…" stays on every page until the next successful cart tap, even after the network is back.
  - **Triage:** later (M7). Merge it with the ledger's "no dismiss/icon" item; a dismiss × plus the icon solves both.
- **N4. `CartLine` has no `isWeighed`** (`app/lib/cart.ts:4-13`, the select in `cart.server.ts`). The drawer and M3's checkout total include weighed items (rau muống), and the spec puts "Giá tạm tính, cân thực tế ±10%" on them.
  - **Triage:** fold into M3. Add the field to the select and show the note at checkout.
- **N5. The basket fill difference is very small.** At 76% and 100% the fill differs by 4 px rows (measured on `dod-drawer-375.png` and `dod-drawer-freeship-375.png`), because the basket is `h-10` and the fill only covers the trapezoid. The number carries the meaning, so the function is fine.
  - **Triage:** Designer gate, then later (M7) if they want it bigger.
- **N6. Buttons lose focus at the stepper limits** (`cart-control.tsx:46-49, 61`). When `disabled` flips on (− at qty 1 in the drawer, + at the stock cap), Chrome blurs the focused button.
  - **Triage:** later (M7 a11y). `aria-disabled` plus a guard is the usual fix.
- **N7. `clientAction` reports every failure as a network loss** (`routes/cart.ts:29-30`). A server 500 also reads "Mất kết nối". It is still far better than a blank page.
  - **Triage:** drop.
- **N8. Two plan-gate optional suggestions were not adopted:** `shouldRevalidate` on page routes for `/cart` actions, and `active:` states (spec §4 lists active among the required states).
  - **Triage:** later (M7). Measure INP on a real phone first, since every card re-renders synchronously under `flushSync`.

### Triage of every "minor (deferred)" line in the ledger

| # | Task | Item | Triage | Reason / fix |
|---|---|---|---|---|
| 1 | T1 | SESSION_SECRET prod guard only rejects the `dev-only` prefix, with no minimum length | **fold into M3** | It matters when `__session` and the admin cookie arrive. Add one line to `env.server.ts:22`: `|| env.SESSION_SECRET.length < 32`. |
| 2 | T1 | `pendingQuantities` has no NaN/mismatch handling | **drop** | Its only input is our own `cartFormData`, and the server 400s anything malformed. |
| 3 | T2 | The qty array has no `.max()` | **drop** | pid ≤50 plus the length-equality check bounds it. Request body size is the real limit, and that is an M3 security-review item (see Declined to judge). |
| 4 | T2 | `qty=''` coerces to 0 and removes the line | **drop** | Safe and unreachable from the UI. |
| 5 | T2 | `EMPTY_CART` is a shared mutable object | **drop** | `setQuantities` never mutates, and a test asserts it ("không sửa giỏ gốc"). |
| 6 | T2 | The cart.server test depends on seed data | **fold into M3** | Rides on the existing M0/M1 carry-over to a separate `chosang_test` DB. |
| 7 | T4 | The pending bar's transform snaps on collapse | **fix now** | `app.css:63`: change the base transition to `opacity 150ms var(--ease-snappy), transform 0s linear 150ms`, so the bar resets only after it has faded. |
| 8 | T4 | The header error line has no dismiss or icon | **later (M7)** | Merge with N3. |
| 9 | T5 | Dead click strip left of the +/stepper | **fix now** | `product-card.tsx:64`: change `className="mt-2 justify-end"` to `"mt-2 self-end"`. The wrapper then shrinks to its buttons and the rest of the row navigates again. |
| 10 | T5 | `min-h` reserves leave whitespace under one-line names | **drop** | Deliberate, for the even-height M1 carry-over. |
| 11 | T5 | Sold-out is stated three times on the card | **later (M7)** | Copy polish; the Designer may prune it at the gate. |
| 12 | T5 | No hint when + is disabled at the stock cap | **later (M7)** | Goes with N6 (`aria-disabled` plus a "Chỉ còn N" hint). |
| 13 | T5 | The inset ring may be under 3:1 on purple photos | **later (M7)** | a11y contrast pass. |
| 14 | T6 | The buy bar has no safe-area-inset-bottom padding | **drop** | The viewport meta (`root.tsx:33`) has no `viewport-fit=cover`, so `env(safe-area-inset-bottom)` is 0 and Safari already keeps content clear of the home indicator. Revisit only if M7 adds `viewport-fit=cover`. |
| 15 | T7 | The close button shows a focus ring on every open | **drop** | Focusing the first control is correct `showModal()`/WAI behavior. The ring appears under keyboard or scripted modality, which is how the screenshot was taken, not on a real tap. The Designer can override. |
| 16 | T7 | The empty state has only a link, no suggestions | **drop** | It already has an icon, text, the freeship threshold and a CTA, which meets the spec's empty state. |
| 17 | T7 | The checkout bar has no safe-area padding | **drop** | Same reason as #14. |
| 18 | T7 | The scroll lock without `scrollbar-gutter` shifts the page on desktop | **fix now** | `app.css` base layer: add `html { scrollbar-gutter: stable; }`. One line, and visible to anyone reviewing on a laptop. |
| 19 | T7 | The undo toast covers the basket row | **fix now** | `cart-drawer.tsx:63` (`top-16`) puts the toast over "Còn X nữa được freeship" for 5 s, exactly when that number changes. Move it below the basket row (about `top-32`) or anchor it above the totals block. Keep the `role="status"` container always mounted. |
| 20 | T7 | The out-of-stock line is not visually distinct | **fix now** | See N2: muted, struck-through line total. Optionally add `grayscale opacity-60` to the thumbnail, as on the card. |

### Rulings check

I found no wrong rulings. Notes:
- **T5 and T7 inset focus rings.** Correct calls: the `overflow-hidden` clipping was real.
- **"Flight 400ms + font decision deferred to Designer at M2 milestone review."** Correct, but the Designer gate is now the last place the font decision can happen before M6. PDP LCP measured 2.7 s (M1 was 2.6 s; this is one run, likely noise), and `/collections/all` measured 2.6 s. That is still over the 2.5 s spec ceiling, so the gate must actually decide; it should not defer again.
- **Ledger #15 (close-button ring) was deferred to the Designer gate.** That is fine as a ruling, but I triage it as drop (reason above).

## Declined to judge (outside M2 plan/spec; executor rules on each)

1. **Cross-site POST overwriting a visitor's cart (no Origin check), and no request body size limit on `/cart`.** Owned by M3's `security-review`, which should cover all POST actions at once (plan-gate suggestion 6).
2. **Real stock enforcement and what checkout does with stock-0 lines.** M3's transaction. It must decide to skip or block those lines, because the badge counts them (D6).
3. **Bundle intents `add-bundle`/`remove-bundle`.** M4.
4. **Manifest growth from `routeDiscovery: initial`.** Headroom is about 9.7 KB, and M3–M5 add routes. Re-measure first-route JS at the end of M3 and M5. That is a measurement only, with no code change now.
5. **The cart needing JS (no-JS POST returns JSON)** and taps before hydration doing nothing. Accepted by D9.
6. **The `/checkout` 404 showing "0 món".** Accepted by D13.
7. **The two offline `ponytail:` cases** (chunk not yet loaded; revalidate failing after a successful action). Accepted by ruling.
8. **`compareAtVnd = 0` now renders a struck "0₫"** instead of a bare "0". It is unreachable with the seed data, and the existing M5 carry-over (zod `compareAt > price`) owns it.
9. **The flight starting off-screen** when the product image has been scrolled away on the product page. This is cosmetic, and at 375 px the image and the bar are both visible at load. Designer's call.
10. **INP under `flushSync` with 72 cards re-rendering synchronously.** Lighthouse TBT is 0, but INP was not measured. Measure in M7 on a real Android, per the spec's budget.

## Recommendations

1. **Before M3 planning, the controller writes "Kết quả M2" into the roadmap**, because Task 8 Step 8 was skipped. It should record:
   - the module contract additions: `cart.server.ts` exports `cartCookie`, `readCart`, `getCartView`, `setQuantities`, `parseCartForm` and `EMPTY_CART`, and `env.COOKIE_SECURE` is to be reused for `__session`;
   - the M7 carry-over "pitch topology: HTTPS or `INSECURE_COOKIES=1` for a LAN http demo";
   - the M3 carry-overs: I1, N4, ledger #1, ledger #6, Declined items 1, 2 and 4;
   - the note for the Designer and Customer that the `/checkout` 404 shows "0 món" by design.
2. **Fix wave (M2):** ledger #7, #9, #18, #19 and #20/N2, plus N1. That is about 8 lines across 4 files. Afterwards, re-run the checkpoint and retake `dod-collection-375` and `dod-drawer-375` (with the toast showing).
3. **M3 must reuse `cartTotals` for the order totals** inside the transaction, with fresh prices, so the drawer, checkout button and order can never disagree. Clearing the cart after an order is `cartCookie.serialize({ ...cart, l: [] })`. Keep `b` until M4 defines the bundle lifecycle.

## Assessment

**Ready to merge?** With fixes.

**Reasoning:** The cart's state model, trust boundary and error path are correct and proven by tests that can fail. M3 can build on `readCart`/`getCartView`/`cartTotals`/`COOKIE_SECURE` as they are. The remaining items are small UI and a11y polish (six fix-now items) plus one test-harness gap that belongs in M3, where Playwright arrives.
