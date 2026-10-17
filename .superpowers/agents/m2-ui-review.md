# M2 Cart: UI gate (Designer + Customer council)

DEGRADED: single-context. Both personas ran in one subagent, as requested. I wrote the design judgment before running the `impeccable detect` pass, so the detector did not anchor it.

**Inputs:**
- Spec §3 and §4.
- Council rounds 1 and 2 for the Designer and the Customer.
- All `dod-*.png` files, plus task-4-header-360, task-5-focus-link/button-375 and task-6-soldout-375.
- `lh-*.json`.
- The Consultant's `m2-final-review.md`. I agree with it unless a section below says otherwise.

**Live session:** dev server on :5173, agent-browser at 375×812, fresh cookies. I did a real shop:
- Typed "trung" and got Trứng gà ta, Trứng vịt and Mì trứng.
- Added items quickly from the cards.
- Opened the drawer and changed quantities.
- Crossed the freeship line.
- Deleted a line and pressed Hoàn tác (undo).
- Emptied the cart.
- Opened a product page from the drawer.
- Ran a JS stress test: 3 cards plus 4 fast taps. The UI showed 13 and `GET /cart` returned 13, so they matched.
- Aborted `/cart.data` once to check rollback and the error message.

The server is stopped and no `.playwright-cli/` folder was created.

**Detector (375, live):**
- `/products/rau-muong`: 0 findings.
- `/`: 0 findings.
- `/collections/all`: 3 findings.
  - `edge-flush-cards` on the chip row: false positive. The cut-off chip is a deliberate "scroll for more" cue.
  - `text-occlusion` on "−18%": false positive. The overlap is the transparent stretched-link `::after`.
  - `skipped-heading` (h1 straight to card h3): real, Minor (D11).

---

## Verdict: **PASS WITH FIXES**

No Critical findings. The cart does its job: + on the card, an instant badge, a drawer with the freeship gap as a number, absolute quantities that stay correct under fast tapping, undo, and the total printed on the pay button. The Customer would buy here. The Important items are all small (a few lines each). Most of them sit on the two moments this milestone was meant to make memorable, the flight into the cart and reaching freeship, and right now both feel flat or slightly off. Fix them in the M2 fix wave. The empty-state suggestions can ship with M3, because M3 edits the drawer anyway.

---

## Decision 1: fonts. **(d): drop Be Vietnam Pro 600 AND remove the body-font preloads**

**Reasons**
- **Bytes.** The 600 weight is two files, 21.8 + 12.2 ≈ 34 KB. Both requests are discovered from CSS at VeryHigh priority, roughly 95–150 ms into every trace. On `/collections/all` and the PDP, the LCP element is the product `<img>`, so these two files compete directly with it on throttled 4G.
- **The preloads don't help home either.** Home's LCP is the hero `<p>`, which is 400 text with `font-display: swap`. It paints in the fallback font, so the preload buys no LCP there.
- **The earlier experiment** (no preloads) already gave 2.3–2.6 s. Taking 34 KB more off the critical window is the cheapest way to get the last ~100 ms under 2.5 s without touching JS.
- **Less is better for the art direction too.** Today there are three voices: 400, 600 and Bricolage 800. Moving to two gives a sharper system:
  - **Bricolage 800 is the "bảng giá" (handwritten price board) voice:** money, actions, promises.
  - **Be Vietnam Pro 400 is the information voice.**
  - This also fixes something the Customer asked for in round 1: "chữ giá to và đậm hơn tên sản phẩm" (the price larger and bolder than the product name). A 400 product name under an 800 magenta price is the right hierarchy. Today 600 names compete with the price.
- **I measured a bonus in the browser.** Bricolage 800 has real tabular figures: ten 1s and ten 8s are both 125.8 px wide. Be Vietnam Pro 400 does not, and ignores `tabular-nums` (77 px vs 127 px). So numbers that change, like the stepper count and the badge, belong in Bricolage anyway.

**Exact changes**

1. **`app/app.css`**
   - Delete these two lines:
     ```
     @import "@fontsource/be-vietnam-pro/latin-600.css";
     @import "@fontsource/be-vietnam-pro/vietnamese-600.css";
     ```
   - In `@layer base`, change `html { color-scheme: light; }` to `html { color-scheme: light; font-synthesis-weight: none; }`. **This is mandatory.** Without it, every leftover 600/700 request, including the default bold of `<strong>`, gets faux-bolded. Faux bold smears stacked diacritics (ẫ, ặ, ộ), which breaks the Designer's first non-negotiable.
2. **`app/root.tsx`**
   - Delete the two `@fontsource/.../be-vietnam-pro-*-400-normal.woff2?url` imports.
   - Delete the `...[bodyLatin, bodyVietnamese].map(...)` preload entries from `links`. Keep the favicon.
3. **Remap all 31 `font-semibold` uses.** Afterwards, `grep -rn font-semibold app` must return 0.
   - **To Bricolage 800 (`font-display font-extrabold`), 14 uses: actions, money, promises**
     - `routes/home.tsx:28` "Mua ngay"
     - `routes/home.tsx:35` "Giao trong 2h · Freeship từ 300.000₫"
     - `routes/collection.tsx:61`: the empty-filter CTA
     - `routes/collection.tsx:81` "Xem thêm"
     - `routes/contact.tsx:5`: the shared button class
     - `routes/product.tsx:91`: the `<strong>` "Hỏng, héo đổi mới trong 24h."
     - `components/cart-drawer.tsx:73` "Hoàn tác"
     - `components/cart-drawer.tsx:94` "Xem sản phẩm"
     - `components/cart-drawer.tsx:145` "Thanh toán · total"
     - `components/cart-control.tsx:54`: the qty `<output>`
     - `components/cart-control.tsx:65`: the labelled "Thêm vào giỏ" on the PDP bar
     - `components/site-header.tsx:64`: the badge count
     - `components/product-card.tsx:28` "−N%"
     - `components/freeship-basket.tsx:26`: the paragraph becomes 400. Wrap only the amount in `font-display font-extrabold`, as in `Còn <b>72.000₫</b> nữa…`.
   - **To Be Vietnam Pro 400 (delete the class), 17 uses: information.** State is already carried by fill, border or colour, so weight adds nothing.
     - `components/product-card.tsx:35`: the h3. Write `font-normal` here, because the base h3 rule is extrabold.
     - `components/product-card.tsx:23` "Hết hàng" and `components/product-card.tsx:53` "Còn hàng"
     - `components/cart-drawer.tsx:109`: the line name
     - `components/cart-drawer.tsx:115`: the sold-out note; also add `text-ink-muted`
     - `components/cart-drawer.tsx:90` "Giỏ hàng đang trống": change it to an `<h3>`, so it picks up Bricolage from the base rule
     - `components/category-chips.tsx:12`
     - `routes/collection.tsx:37` and `routes/collection.tsx:48`: the in-stock and sort pills
     - `routes/collection.tsx:57`: the empty-filter message; change it to `<h2 class="text-lg">` (Bricolage)
     - `routes/product.tsx:58` and `routes/product.tsx:60`: the stock pills
     - `routes/home.tsx:50`: the tile labels
     - `routes/home.tsx:60` "Xem tất cả": add `underline underline-offset-4`
     - `routes/about.tsx:34`: the `dt`
     - `components/site-header.tsx:73`: the error line
     - `components/cart-control.tsx:33`: the disabled sold-out button
4. **Spec §4 Font:** I will amend it to read "Body: Be Vietnam Pro 400 (latin + vietnamese), không preload; nhấn mạnh bằng Bricolage 800" (no preload; emphasis with Bricolage 800). That leaves 4 files and about 62 KB.

**Acceptance**
- Lighthouse mobile on `/`, `/collections/all` and `/products/xoai-cat-hoa-loc`: LCP ≤ 2.5 s and CLS < 0.1.
- If CLS goes up from the 400 swap, add a metric-matched fallback: about 6 lines of `@font-face { font-family: "Be Vietnam Pro Fallback"; src: local("Arial"); size-adjust/ascent-override… }`. Do not bring the preload back.
- "Bưởi Diễn, Rau muống, Sữa tươi" renders at 400 and at 800 with no faux bold.
- If the PDP is still over 2.5 s after this, the next lever is the LCP image (size, `fetchpriority`), not fonts.

**Due:** in the M2 fix wave. It is a mechanical change, and it lets M6 measure the hero against a settled baseline.

## Decision 2: fly-to-cart. **Tune it: 350 ms flight, the badge reacts on landing, no lingering ghost**

**Reasons**
- The flight stays the one signature motion. That makes it the single documented exception to the 150–200 ms feedback rule, because it covers 400–600 px of travel. For travel that long, 150–200 ms reads as a jump cut.
- But 400 ms with `cubic-bezier(.2,.8,.2,1)` covers about 80% of the distance in the first ~40%. The remaining ~200 ms is a 10%-size thumbnail creeping beside the badge.
- The keyframe also ends at `opacity: .4` with `forwards`. The ghost is removed at 600 ms, so it hangs next to the badge, small and half-transparent, for another 200 ms. I saw it in the live capture.
- Worst of all, the **badge bumps at t = 0**: the `useEffect` fires on the optimistic count. The cause and effect run backwards: the basket reacts before anything arrives.

**Exact changes**
- `app.css`, in `.fly-to-cart`:
  - Set `animation: fly-to-cart 350ms …`.
  - In `@keyframes fly-to-cart { to { … opacity: 0; } }`, end at `opacity: 0`.
- `fly-to-cart.ts`:
  - Remove the ghost after 450 ms instead of 600 (keep the "≥ duration + 100" comment in sync).
  - Skip the flight when the source image is off-screen (`from.bottom < 0 || from.top > innerHeight`). This settles the Consultant's "Declined 9": the badge bump alone is enough there.
- **Badge bump on landing.**
  - When a flight runs, delay the bump by about 300 ms, e.g. `.cart-bump { animation: cart-bump 150ms var(--ease-snappy) var(--bump-delay, 0ms) both; }`.
  - `flyToCart` sets `--bump-delay: 300ms` on `#cart-button` and clears it after 450 ms.
  - Call `flyToCart` **before** `setQty` in `CartControl.change`, so the variable is set before the header effect forces the reflow.
  - Stepper + presses (no flight) still bump immediately.
- Total signature time: about 450 ms (350 ms flight + 150 ms bump, overlapping by 50). Reduced motion stays as it is: no flight, and the count simply changes.
- Spec §4 Motion: add "Ngoại lệ duy nhất: ảnh bay vào giỏ 350ms; badge nảy khi ảnh chạm giỏ" (the only exception: the image flies into the cart in 350 ms; the badge bumps when the image lands).

**Customer check:** the ghost already has `pointer-events: none`, and the flight only runs on 0 → 1. My fast tapping was never blocked, so motion does not get in the way of the purchase.

## Decision 3: the empty cart. **A link is not enough. Show "rổ trống" (empty basket) + 3 món (items), with + on each**

**Reasons**
- The Consultant triaged this as "drop" because the empty state meets the spec. I overrule that as the owner of the art direction. "Rổ trống + 3 món hay mua" (an empty basket plus 3 popular items) was the Designer's round-1 brief for the drawer.
- The empty drawer is the only place in the cart flow that is a dead end. As the Customer: when I delete everything, or open the basket before adding anything, "Xem sản phẩm" takes me out of the drawer and to another page. Three deals with a + right there keep me in the flow.
- It is also the only screen with a stock Lucide basket where the brand basket should be.

**Exact scope** (ponytail-sized: about 25 lines, no new query, no new component)
- **Data.** Reuse the existing "Khuyến mãi hôm nay" catalog query (in stock, `compareAtVnd != null`), `take: 3`. Real "hay mua" (frequently bought) data needs orders, which arrive in M3, so promos are the honest stand-in.
- **When to load it.** Only when the cart is empty: in the root loader, `cart.lines.length === 0 ? promos(3) : []`. Every other request pays nothing.
- **Layout.**
  - The `FreeshipBasket` SVG at 0% replaces the Lucide icon.
  - "Giỏ hàng đang trống" as an h3.
  - "Freeship cho đơn từ 300.000₫."
  - Then 3 compact rows reusing the line layout: 64 px image, name, unit · price, and `<CartControl min={0}>`.
  - Then "Xem tất cả sản phẩm" as a text link, no longer a magenta pill. The + buttons are the primary action now.
- Adding from a suggestion turns the drawer into the normal cart view in place. That is fine and expected.
- **Due:** with M3, which already edits this drawer for checkout. It does not block M2.

---

## Designer findings

| # | Sev | Screen | Defect | Fix |
|---|---|---|---|---|
| D1 | **Important** | Drawer, any delete | The undo toast (`top-16`) sits on the freeship row for 5 s, which is exactly when that number changes (a delete can drop you below 300k). It is also at the top of the screen, out of thumb reach. Seen in `dod-drawer-empty-375` and the live delete. | Anchor the toast at the bottom, directly above the totals block (`absolute inset-x-4 bottom-[calc(100%+8px)]` inside the footer wrapper, or a sticky slot above it). Keep the `role="status"` container always mounted. This overrides the Consultant's "~top-32" alternative: the toast belongs in the thumb zone. |
| D2 | **Important** | Drawer, freeship reached | There is no success state. "Đã được freeship" keeps the same ink and weight as "Còn X nữa". Live: 86% and 100% look identical, and the fill at 76% vs 100% differs by 4 px rows (Consultant N5). The best moment in the cart passes unseen. | When `toFreeshipVnd === 0`: the text turns `text-fresh` with a Lucide `Check` before it ("Đã được freeship"), and "Miễn phí" in the summary turns `text-fresh`. `--fresh` is the spec's success colour, so this needs no new token. Put `aria-live="polite"` on the freeship `<p>` so screen readers hear the crossing. Optionally increase the basket from `h-10 w-12` to `h-12 w-14` so the fill steps can be read. |
| D3 | **Important** | Flight into the cart | The badge bumps before the image lands, and the ghost lingers at 10% size and 40% opacity for 200 ms. | See Decision 2. |
| D4 | **Important** | Drawer, delete | Focus falls to `<body>` after the trash button unmounts (confirmed live: `document.activeElement` = BODY). The spec requires a focus state for every control. | `autoFocus` on "Hoàn tác" (Consultant N1, agreed). After undo, return focus to the restored line's trash button. |
| D5 | Minor | Drawer, sold-out line | The line total is magenta, as if it counted. | Consultant N2, agreed: `text-ink-muted line-through`, thumbnail `grayscale opacity-60`. |
| D6 | Minor | Drawer, qty = 1 | The "−" is a ghost at 40% opacity (looks broken), and it blurs focus when disabled (N6). | At `qty === min`, render the "−" slot as a trash button ("Xoá X khỏi giỏ"), and remove the separate 44 px trash column. That gives one control instead of two and frees the right edge for the line total, so the total aligns flush right. The 5 s undo covers accidental taps. M7. |
| D7 | Minor | Card, sold out | Sold out is said three times: image badge, "Tạm hết, sắp về", and the "Hết hàng" button. | Drop the image badge. Grayscale plus the stock line plus the disabled button is enough. M7. |
| D8 | Minor | Collection chips | "Chỉ hàng còn" reads as unfinished Vietnamese. | "Còn hàng". M1 copy, one string. |
| D9 | Minor | Header badge | The badge uses Be Vietnam Pro at `text-xs`, and "10" crowds the basket glyph. | It moves to Bricolage 800 under Decision 1. Also add `ring-2 ring-bg` to separate it from the icon. |
| D10 | Minor | Chip rows (desktop with classic scrollbars) | A grey scrollbar track appears under both chip rows wherever they overflow (seen in the headless 375 capture). | `scrollbar-width: none` on the two scrollers. The cut-off chip is already the scroll cue. |
| D11 | Minor | Collection | Heading skip: h1, then card h3, with no h2 (detector). | Add an `sr-only` `<h2>Sản phẩm</h2>` before the grid. |

Agreed with the Consultant's fix-now list: ledger #7 (pending bar), #9 (dead tap strip; `self-end`), and #18 (`scrollbar-gutter: stable`). Agreed with dropping #14, #15 and #17: on a touch tap the close-button ring does not show (confirmed live), and safe-area insets are 0 without `viewport-fit=cover`.

**ui-check questions**

- **Identity.** Magenta Bricolage prices, the hand-drawn mango-yellow basket with its freeship number, and "Thanh toán · 248.000₫" belong to Chợ Sáng. The drawer chrome (white sheet, hairlines) is generic, which is fine. The weak spots are the empty state, with its stock icon, and the success moment, which is flat (D2 and Decision 3).
- **Logic.** The drawer reads in task order: what is still missing for freeship, then the lines, then the totals, then pay. Pay is in the thumb zone. Good.
- **Human.** The copy sounds like a person: "Còn 72.000₫ nữa được freeship", "Mất kết nối, bạn thử lại giúp mình nhé", "Đã xoá Trứng gà ta · Hoàn tác". Only "Chỉ hàng còn" lets it down.
- **Restraint.** Nothing is decorative. Three weights is one too many, which Decision 1 removes.

**Nielsen scores (cart flow, Operate mode)**

| # | Heuristic | Score | Note |
|---|---|---|---|
| 1 | Visibility of system status | 3 | Instant badge, pending bar, freeship number. Freeship reached is not signalled (D2). |
| 2 | Match with the real world | 4 | Rổ (basket), "Còn X nữa được freeship", unit on every line. |
| 3 | User control and freedom | 3 | 5 s undo, Esc, backdrop tap. The toast is out of thumb reach (D1), and undo only covers the last delete. |
| 4 | Consistency and standards | 3 | Two different baskets (Lucide vs brand SVG); three font weights. |
| 5 | Error prevention | 3 | Stock caps; the − is disabled at 1. The disabled state looks broken (D6). |
| 6 | Recognition rather than recall | 4 | Thumbnail, unit and unit price on every line. |
| 7 | Flexibility and efficiency | 3 | + on the card and a stepper in place. Cards are tall (about 4 products per 2 screens). |
| 8 | Aesthetic and minimalist design | 3 | Clean. Sold-out is said three times (D7). |
| 9 | Help users recover from errors | 3 | Rollback plus a human message. The message is far from the thumb and doesn't name the item (C4). |
| 10 | Help and documentation | n/a | |

---

## Customer findings ("I'm on 4G at lunch, phone in my right hand")

**Would I buy?** Yes. I typed "trung" without diacritics and the eggs came up first. I tapped + three times on three cards and nothing jumped or reloaded. The basket number went up straight away, the drawer told me "Còn 235.000₫ nữa được freeship", and the pay button shows the full amount. That is what I asked for in round 1. Under 2 minutes for eggs and vegetables.

**Where I hesitated / what annoyed me**

| # | Sev | Where | What happened | Requirement for the Developer |
|---|---|---|---|---|
| C1 | **Important** | Drawer, delete | I deleted cà chua and the "Hoàn tác" popped up at the very top, over the freeship line. My thumb is at the bottom, and I have 5 seconds. I also couldn't see whether I'd just lost freeship. | Same as D1: undo above the totals, in thumb reach, with the freeship line still visible. |
| C2 | **Important** | Drawer, freeship reached | I pushed cà chua up to 9 to get freeship and… the text just changed. I had to read "Phí giao hàng: Miễn phí" to be sure. | Same as D2: green "✓ Đã được freeship" and a green "Miễn phí". I want to *feel* it. |
| C3 | **Important** (due M3) | Empty drawer | I emptied the basket and got a big empty screen with one button that takes me away. | Decision 3: 3 deals with + right in the drawer. |
| C4 | Minor | Card, failed add (simulated network loss) | The + rolled back, but the message showed up in a grey strip under the header. My eyes were on the card. It doesn't say which item didn't go in, and it stays until I tap again (Consultant N3). | M7: name the item ("Chưa thêm được Rau muống, thử lại nhé") and add the dismiss × from N3. |
| C5 | Minor | Drawer, qty = 1 | I pressed − to remove a single bó rau. It's greyed out and nothing happened, so I had to find the bin icon. | D6: at 1, − becomes the bin. |
| C6 | Minor | Drawer, two deletes in a row | Only the last one can be undone. | Drop for MVP. Note only. |
| C7 | Minor | Collection | About 2 products per screen at 375. A lot of thumb scrolling for a 10-item shop. | No action for M2. The photos are worth it. Revisit only if the pitch rehearsal feels slow. |
| C8 | Minor (pre-pitch) | Search "trung" | Trứng vịt is a grey placeholder tile, not a photo. It's the second result for the most common search. | Already an M1 carry-over: the photo must exist before the pitch. |

The flight into the cart did not get in my way: I could tap through it. Keep it, just make it land properly (D3).

---

## Fix-wave summary for the controller

**M2 fix wave, in addition to the Consultant's list (#7, #9, #18, #19/D1, #20/N2/D5, N1/D4):**
- Decision 1 (fonts)
- Decision 2 (flight)
- D2 / C2 (freeship success state)
- D8 ("Còn hàng")
- D11 (sr-only h2)

**Then:**
- Re-run Lighthouse mobile on the 3 pages (LCP ≤ 2.5 s, CLS < 0.1).
- Retake `dod-drawer-375` with the toast showing, `dod-drawer-freeship-375` and `dod-collection-375`.

**Fold into M3:**
- Decision 3 / C3 (empty-cart suggestions)

**M7:**
- D6 / C5 (− becomes the bin at qty 1)
- D7 (sold-out said three times)
- D9 (badge ring)
- D10 (chip scrollbars)
- C4 (name the item in the error)
- C8 (Trứng vịt photo, before the pitch)
