# M4 gift basket (Fabric): UI gate (Designer + Customer council)

DEGRADED: single-context. Both personas ran in one subagent, as in M2 and M3. I wrote the design judgment from the screenshots and the live session. No detector run this time: `/gift` is canvas-heavy and the static scan adds little.

**Yardstick:**
- Spec §3: Giỏ quà Fabric, plus the cart drawer, checkout and order rows that carry a basket.
- Spec §4: palette meanings, magenta ≤10%, Bricolage/Be Vietnam Pro, Lucide only, motion, 375 first, ≥44 px, hover and focus-visible.
- Spec §6, M4 row.
- Plan Decisions 1–19, plus open questions Q3 and Q5 (handed to the Designer by the plan gate).

**Inputs:**
- All 14 `m4-*.png`.
- `t5-gift-*`, `t5-home-375`.
- `cutouts.jpg`, plus the 12 source PNGs in `seed/images/cutouts/` composited on a dark background to look for smudges.
- The M4 ledger.

**Live session:**
- Production build on :3200 against `chosang_test`.
- agent-browser at 375×812 and 1280×800.
- The server was stopped by PID (port confirmed free).
- No `.playwright-cli/` or `.ui-check/` folder was created.
- New screenshots are `ui-*.png` in `.superpowers/sdd/2026-10-15-m4-gift/`. `ui-preview-120char.png` is the stored `/gift/preview/:id` image, decoded.

**Customer path done:**
1. Home, then the "Tự xếp giỏ quà biếu" card, then `/gift`.
2. Tapped 5 items. The canvas shows each one as it lands (Decision 14 works).
3. Dragged the mango; tried the rotate handle.
4. Typed "Chúc bà ngoại sống lâu trăm tuổi, mạnh khoẻ, vui vẻ bên con cháu!" (65 chars), then a 120-char greeting.
5. "Thêm vào giỏ hàng". The drawer opened with "Giỏ quà · 3 món".
6. Removed the basket: toast "Đã xoá giỏ quà 3 món · Hoàn tác". Undo brought it back, and focus went to the drawer heading.
7. Built a second basket. Checkout COD with "0987 654 321". The order page shows 2 basket blocks: preview, greeting, shell + items. The total was correct: 234.000 + 159.000 = **393.000₫**, freeship.
8. "Mua lại đơn này" went to `/checkout` with both baskets and the phone/address prefilled.

**Extra checks:**
- 10-item cap: 11 taps on "Ớt hiểm" give 10/10, all tiles locked, and the line "Giỏ đã đủ 10 món…".
- Empty-basket button state.
- Keyboard-only pass on `/gift`.
- `prefers-reduced-motion` (transitions 0.01 ms, the canvas has no animation).
- No horizontal page scroll at 375. Tiles are 96×146 and remove buttons 44×44.

**Environment notes for the controller (not app defects):**
- `m4-checkout-gift-*.png` shows the drawer still open over `/checkout`. That is a capture timing artifact of the Task 7 script, which takes the screenshot immediately after clicking. Live, I clicked the drawer's "Thanh toán" right after the drawer opened and the dialog was closed on `/checkout` (`open=false` on 3 polls).
- agent-browser `click` on an element below the fold dispatched at off-viewport coordinates without scrolling. One run also restored a scroll offset. Every "dead click" I saw traced to this, never to the app.

---

## Verdict: **PASS WITH FIXES**

The Customer can build a gift basket and buy it.
- Tap, see it land, type a greeting in the normal Vietnamese keyboard, one magenta button with the total, the drawer shows the basket.
- COD checkout, and an order page with the picture, the greeting, every item and the right total.
- Undo and reorder both work.
- The DoD flow is intact, and Fabric stays in its own chunk (ledger T7).

No Critical findings. Two Important defects damage **the picture**, and the picture is the product here: it is what the drawer, checkout, order page and (M5) the packer see.
1. A long greeting is clipped on the canvas and in the stored preview.
2. An item can be dragged under the basket's front panel and vanish from the preview while still being charged.

The other Important items are a missing unit on the tiles (a §4 rule), the seed wording promising a bow and card, and two a11y gaps. All are small.

---

## Decisions (Designer owns these)

### Q3: vector basket shell (Decision 3): **KEEP vector, with a bounded "weave pass" in the fix wave**
Drawing the shell on the canvas is the right call:
- The only shell photo is a full basket.
- A vector path is 0 KB, sharp at every size, and sits correctly behind and in front of the items.
- It keeps the preview small: 17 KB for 3 items plus 120 chars.

What fails today is the **look**. Two flat tan shapes with 3 ruled lines read as a flowerpot or tub, not "giỏ mây". Against photographic cut-outs, it is the one element that breaks §4 "không trộn lẫn phong cách".

The fix stays inside `basketBack()`/`basketFront()` in `app/lib/gift-canvas.client.ts`: no assets, no deps, about 10 lines. See fix F5. Timebox: 1 hour. If it runs over, ship what is done, and the remainder goes to M7.

**Not** in M4: a photographed empty basket. Owner photos are M7.

### Q5: the 12 items: **KEEP the set for M4; swap 2 at M7 with owner photos**
- **Works as a Vietnamese basket:**
  - Xoài cát Hòa Lộc, cam sành, chuối, bơ. Fruit is the core of "giỏ quà biếu".
  - Dầu ăn, đường, gạo ST25. The classic giỏ quà Tết, the kind companies give.
  - Trứng gà ta. A traditional visiting gift (thăm người ốm, thăm bà đẻ).
  - Tỏi Lý Sơn. A named đặc sản, which matches the home card's "đặc sản".
- **Weak:**
  - **Bánh mì sandwich.** Nobody gifts sliced sandwich bread.
  - **Ớt hiểm.** A 12k bag of chillies as a gift reads as a joke.
- **Borderline:** phô mai lát. A modern gift is fine, but the cut-out reads as onion rings or pasta.
- **Why keep all 12 now:**
  - Each swap means another rembg run, and full-frame photos already failed (spike 9).
  - Spec §3 says "khoảng 12".
  - In the pitch, the presenter picks the items.
- **M7, with owner photos on a plain background:**
  - bánh mì sandwich → **Nước mắm Phú Quốc** (the iconic Tết gift; it is already in the catalog).
  - ớt hiểm → **Hạt điều rang muối** (already in the catalog; its current photo failed rembg).
  - Re-shoot phô mai lát as a recognisable pack.

### Cut-out smudges (gao-st25, pho-mai-lat) and gạo as a plate: **carry to M7**
- On a dark background the haze is obvious: top-left of the plate, and left of the cheese.
- On the product's white canvas and white tiles it is invisible at 72–120 px, and in the 480 px preview it is invisible too, because the haze is near-white.
- The plate-vs-"túi 5kg" mismatch is catalog-wide. The PDP photo is a bowl of rice too, and the footer already says "Ảnh sản phẩm là ảnh minh hoạ".
- F3 (the unit on the tile) makes the price honest in the meantime: "189.000₫ · túi 5kg".
- When the owner supplies photos (M7), redo both cut-outs from the new photos. Don't hand-retouch now.

### Seed unit "giỏ kèm nơ và thiệp": **confirm the reword, but use "cái", not "giỏ"**
- With "giỏ", the UI renders "Giỏ mây quà biếu (giỏ)", "Giỏ mây quà biếu × 1 (giỏ)" and "Gồm giỏ mây…". The word stutters.
- The catalog pattern is the counting unit or packaging. "cái" is how a Vietnamese receipt counts one basket: "Giỏ mây quà biếu × 1 (cái)".
- The `description` "Giỏ mây đan tay kèm nơ, …" also promises the bow. Reword it to "Giỏ mây đan tay, dùng để xếp giỏ quà biếu."
- **Seed must carry it:** `prisma/seed.ts` `update` only writes `images/nameSearch/cutoutUrl`, so the dev DB (and any DB that is not reset) keeps the old string. See F4.

---

## Designer findings

| # | Sev | Screen | Defect | Concrete fix |
|---|---|---|---|---|
| D1 | **Important** | `/gift` canvas and the **stored preview** (`ui-gift-msg-375`, `ui-gift-msg120-*`, `ui-preview-120char.png`) | **The greeting is clipped.** The Textbox is centred at `top: 34` (Fabric 7 origin = centre), so every line beyond 2 grows **upwards off the canvas**. At 65 chars (3 lines), the first line is half cut. At 120 chars, the first line "Kính chúc ông bà năm mới an" is gone and the last line ends "…hạnh p": "phúc!!" is cut off as well. This is exactly what is saved in `GiftBundle.preview` and shown in the drawer, checkout and order page, and to the packer in M5. | See F1 |
| D2 | **Important** | `/gift` canvas (`ui-gift-drag-375`) | **An item can be dragged under the basket's front panel (or off the canvas) and disappears.** The mango dragged ~70 px down was fully hidden by `overlayImage`. The preview then shows a basket without the mango, but the order still charges 85.000₫ for it. `layout()` clamps x/y to 0–1, but the canvas lets the object go anywhere. | See F2 |
| D3 | **Important** | `/gift` tiles (`m4-gift-*`, live) | **Price without unit**, against §4 ("Giá luôn … kèm đơn vị bán"). A tile says "Gạo ST25 189.000₫" over a picture of a plate of rice. The unit only appears later in "Trong giỏ quà". | See F3 |
| D4 | **Important** | `/gift` "Trong giỏ quà", checkout, order page | The shell row promises "(giỏ kèm nơ và thiệp)". There is no bow or card in the system (Decision 11). | See F4 |
| D5 | **Important** (identity) | Canvas shell (Q3) | Flat tan tub; reads as a flowerpot, not rattan. It is the largest element on `/gift` and in every preview. | See F5 |
| D6 | **Important** (a11y) | `/gift` keyboard and screen reader | (a) Adding an item gives a screen reader nothing: the "3/10 món" counter is not live, the canvas is `aria-hidden`, and focus stays on the tile. (b) Removing an item from "Trong giỏ quà" drops focus to `<body>`, so a keyboard user starts again from the logo. Otherwise the keyboard pass is clean: logo → search → account → cart → 12 tiles → remove buttons → greeting → CTA → footer, all with the brand `:focus-visible` ring, and Enter adds and removes. | See F6 |
| D7 | Minor | Empty `/gift` (`m4-gift-empty-375`) | The CTA is disabled but still says "Thêm vào giỏ hàng · 120.000₫", and the line under it says "Gồm giỏ mây quà biếu 120.000₫". It reads as "buy an empty basket for 120k", with no reason why the button is locked. | F7 |
| D8 | Minor | Greeting textarea | The placeholder "Chúc mừng năm mới, an khang thịnh vượng!" looks like a pre-filled greeting. The canvas shows nothing, so the customer thinks it is broken, or that it will print. | F8 |
| D9 | Minor | Canvas default placement | The 1st item lands at x=0.26 (left of centre) and y=0.5, perched on the rim, not in the basket. A 1-item order preview is an orange on the left lip of an empty basket (`ui-order-375`, second block). | F9 |
| D10 | Minor | `/gift` ≥768 (`ui-gift-1280`) | The CTA and total are `md:static` at the very bottom of the right column. At 1280×800 with the 4-col grid, they are below the fold until you scroll past the list and greeting. The canvas column is sticky, so the column that holds the action is the one that scrolls away. | F10 |
| D11 | Minor | Home gift card copy | "Giao tận nơi dịp Tết, Trung thu." It is 15/10, Trung thu is over, and it suggests seasonal-only. | F11 |
| D12 | Minor | `/gift` at 10/10 | Every tile gets `opacity-50`, so name and price drop to about 2.3:1. That is fine as "locked", but unreadable. | M7: dim only the image and the `+` (`group-disabled:opacity-50` on those two), keep the text at full ink-muted. |
| D13 | Minor | Drawer and checkout basket row | With no greeting, the sub-line is "Gồm vỏ giỏ và các món đã chọn" (checkout) or nothing (drawer). Two baskets look identical except for a 40–64 px thumbnail. | M7: add `names` (e.g. "Bơ 034, Tỏi Lý Sơn, …") to `CartBundle` in `bundleViews`, and show it as the sub-line when `message` is empty. |
| D14 | Minor | Order page basket preview, 96 px | The greeting in the picture is illegible. There is no way to see the basket you designed at a useful size. | M5 (admin needs it to pack) and M7 (customer): see the carry-overs. |
| D15 | Minor | 375 first view, after the first tap | The sticky CTA bar covers the bottom of the tile row (name and price) at 812 px height. F3 makes the tile 1 line taller. | M7: try `size-16` images and `line-clamp-1` names in the 375 row. Accept a small scroll for M4. |
| D16 | Note | Drawer, empty after removing a basket | "Còn 300.000₫ nữa được freeship" on an empty cart: M3 D16 is still open. | Already on the M7 list from M3. |

**Token audit (`/gift`, drawer, checkout, order):**
- **Magenta (`brand`):**
  - The CTA.
  - The 12 `+` badges on the tiles (add affordance, CTA-family).
  - The canvas selection handles (explicitly allowed by the plan's global constraint).
  - Prices in the drawer and the order total.
- **Magenta coverage at 375:** I estimated it from `ui-gift-5-375` (CTA 328×48, 4 visible `+`, 5 handles) at about 6% of the viewport. Under 10%.
- **`fresh`:** only "Đã được freeship", "Miễn phí" and the past timeline step. The gift icon is ink. Correct per the plan's constraint.
- **`danger`:** only the `/gift` error lines, each with `CircleAlert`.
- **`sun`:** only the freeship basket.
- **Fonts:** Bricolage 800 for the h1, h2s, "Lời chúc" and the CTA total. Be Vietnam Pro for the body and the canvas greeting; diacritics render correctly on the canvas ("khoẻ", "thịnh vượng").
- **Icons:** Lucide only: `Gift`, `Plus`, `Trash2`, `CircleAlert`. No emoji.
- The canvas rattan colours are illustration, not tokens (allowed by the plan).

**Motion:** no animation on the canvas (Decision 15). The drawer and buttons follow the global rules. With reduced motion, transitions are 0.01 ms. Compliant.

**ui-check questions:**
- **Identity:** this is the page that should feel most like Chợ Sáng, and the canvas carries it. The flat shell (D5) and the clipped greeting (D1) are what make it look unfinished.
- **Logic:** 375 order canvas → items → list → greeting → sticky CTA (Decision 14) is right: you see the item land as you tap. At 1280, the CTA hides (D10).
- **Human:** the copy is warm ("Bỏ bớt một món nếu muốn đổi.", "Chưa có món nào. Chạm vào món ở trên để thêm."). The exceptions are the seed unit (D4) and the placeholder (D8).
- **Restraint:** good. One shell, one CTA, no stickers, no confetti.

---

## Customer findings ("buying a basket for bà ngoại on my phone")

**Could I build a gift basket and buy it? Yes, in about 2 minutes.**
- I tapped mango, oranges, eggs, oil and garlic, and each one jumped into the basket right above my thumb.
- I typed my wish with my normal Vietnamese keyboard.
- One pink button with the price, then my basket appeared in the cart with its little picture.
- Checkout was the same as last time.
- The order page shows my basket picture, my wish, and every item with its price.
- "Mua lại đơn này" put the whole basket back.

| # | Sev | Where | What happened | Requirement for the Developer |
|---|---|---|---|---|
| C1 | **Important** | Wish on the basket | I wrote a proper wish for bà (120 letters). On the basket, the start "Kính chúc ông bà năm mới an" is gone and it ends in "hạnh p". That picture is what the shop packs from. I would be embarrassed. | D1 / F1 |
| C2 | **Important** | Dragging an item | I pulled the mango down to put it "in" the basket and it vanished. Is it still in my order? The list says yes and the price says yes, but the picture says no. | D2 / F2 |
| C3 | **Important** | Item tiles | "Gạo ST25 189.000₫" under a little plate of rice. 189k for a plate? Only further down do I learn it is a 5 kg bag. | D3 / F3 |
| C4 | **Important** | Shell row | "giỏ kèm nơ và thiệp": so where do I write the card? There is no card step. | D4 / F4 |
| C5 | Minor | Empty page | The grey button says 120.000₫. Can I buy just the basket? Why won't it press? | D7 / F7 |
| C6 | Minor | Wish box | It already says "Chúc mừng năm mới…", so I thought it was filled in, but nothing was on the basket. | D8 / F8 |
| C7 | Minor | After tapping | I tapped cam sành twice by accident. The tile doesn't show "×2"; I only noticed in the list below. Also, to remove something I had to scroll past all the tiles. | M7: a small "×N" count badge on the tile (ink on surface, not magenta); optionally a delete control on the selected canvas item. |
| C8 | Minor | Home card | "dịp Tết, Trung thu": I want a basket for bà's birthday, today. | D11 / F11 |
| C9 | Minor | Cart | Two baskets without wishes look the same. Which one has the mango? | D13 (M7) |
| C10 | Minor | Item choice | Bánh mì sandwich and ớt hiểm in a gift basket? I'd never send those. Where is nước mắm Phú Quốc or hạt điều? | Q5 (M7 swap) |

**What I liked (keep these):**
- Seeing each item land in the basket as I tap.
- The price on the button, updating live.
- The wish typed in a normal box: my phone keyboard and accents just work.
- Undo when I deleted the basket by mistake.
- The order page groups my basket with its picture and wish, and shows "tạm tính ±10%" on the fruit.
- "Mua lại" brings the same basket back.

---

## Fix wave (must fix in M4)

1. **F1: Greeting never clipped** (`app/lib/gift-canvas.client.ts`, `setMessage`).
   - Create the Textbox with `originY: "top"` and `top: 12`, keeping `originX` centre and `left: SIZE / 2`.
   - Use `fontSize: 20`, and set `objectCaching: false`. It is one text object, so this costs nothing; the right-edge cut "hạnh p" looks like a stale cache canvas after the re-wrap.
   - After `text.set({ text })`, call `text.initDimensions()` before `requestRenderAll()`.
   - **Acceptance:** with the exact string `Kính chúc ông bà năm mới an khang thịnh vượng, vạn sự như ý, sức khoẻ dồi dào, tiền vô như nước, con cháu đề huề, hạnh phúc!!` (120 chars), every word, including "Kính" and "phúc!!", is visible in `canvas.preview()` at 375 and 1280.
   - Add this as an e2e assertion: decode the preview, or check that `text.getBoundingRect()` lies inside 0..400.
2. **F2: Items stay inside the visible area** (`gift-canvas.client.ts`, `createGiftCanvas`).
   - Add one handler:
     `canvas.on("object:moving", ({ target }) => target.set({ left: Math.min(372, Math.max(28, target.left)), top: Math.min(285, Math.max(40, target.top)) }));`
   - Centre y ≤ 285 keeps at least the top third of a 120 px item above the front panel (rim ≈ 250–270). Apply it to items only (`if (target === text) return;`), or use the same bounds for the text.
   - **Acceptance:** dragging the mango to y=390 leaves it visible in `preview()`.
3. **F3: Unit on every tile** (`app/routes/gift.tsx`, the tile `<button>`).
   - Under the price `<span>`, add `<span className="line-clamp-1 text-xs text-ink-muted">{item.unit}</span>`.
   - `listGiftItems()` already selects `unit` (`gift.server.ts:96`), so this is markup only.
4. **F4: Seed wording and propagation.**
   - `prisma/catalog.ts:94`: `unit: "cái"`.
   - `prisma/catalog.ts:100`: `description: "Giỏ mây đan tay, dùng để xếp giỏ quà biếu."`
   - `prisma/seed.ts` `update`: add `...(p.isGiftBase ? { unit: fields.unit, description: fields.description } : {})`, with a `ponytail:` comment that a reseed overwrites admin edits to the shell's unit and description (M5).
   - The controller runs `npx prisma db seed` on the dev DB. Non-destructive: it is an upsert.
   - **Acceptance:** `/gift`, checkout and the order page show "Giỏ mây quà biếu (cái)" / "× 1 (cái)".
5. **F5: Weave pass on the vector shell** (`gift-canvas.client.ts`, `basketBack`/`basketFront`; **timebox 1 h**). Same colours, no assets:
   - Replace the 3 solid horizontal lines with 5 rows, y = 282, 302, 322, 342, 362. Each row is `strokeDashArray: [14, 6]`, and odd rows get `strokeDashOffset: 10`, for an over-under weave.
   - Add 9 vertical stakes from the rim to the base following the taper (x interpolated between the rim 40..360 and the base 70..330), `stroke: RATTAN_DARK`, `strokeWidth: 2`, `opacity: 0.45`.
   - Rim: a 10 px `RATTAN_DARK` band with a 2 px `#D9AE73` highlight stroke on top.
   - Handle: a second 4 px highlight path inside the 16 px arc.
   - `basketBack`: a soft shadow ellipse under the base, `rx 150`, `ry 10`, `fill: "rgba(42,27,61,.08)"`.
   - Re-run the preview size test: it must stay ≤60 KB at 10 items + 120 chars.
   - Retake `m4-gift-full-375` and look at it before calling it done.
6. **F6: a11y feedback** (`app/routes/gift.tsx`).
   - (a) Add `aria-live="polite"` to the `{chosen.length}/{GIFT_MAX_ITEMS} món` `<p>`. Change its text to `Đã chọn {n}/{max} món` so the announcement makes sense.
   - (b) Give the `<h2 id="gift-in">` `tabIndex={-1}`. When `remove` is called from a list button, focus the next row's "Bỏ …" button, or, when there is none, `#gift-in`. A `requestAnimationFrame` after the state update is enough.
7. **F7: Empty CTA explains itself** (`gift.tsx`, the line under the CTA). When `chosen.length === 0` and the shell is in stock, show "Chọn ít nhất 1 món để thêm vào giỏ hàng." instead of "Gồm giỏ mây…".
8. **F8: Placeholder** (`gift.tsx` textarea): `placeholder="Ví dụ: Chúc mừng năm mới, an khang thịnh vượng!"`.
9. **F9: Default placement** (`gift-canvas.client.ts`, `add`).
   - Fill from the centre out: `const X = [0.5, 0.36, 0.64, 0.24, 0.76]` with `left: SIZE * X[n % 5]`.
   - Base `top: SIZE * 0.56` (second row 0.5), so items sit in the basket mouth rather than on the lip.
10. **F10: CTA reachable at ≥768** (`gift.tsx`, the sticky wrapper). Keep it `sticky bottom-0` at all widths. Replace `md:static md:mx-0 md:border-0 md:bg-transparent md:p-0` with `md:mx-0 md:rounded-b-2xl`, keeping the `bg-bg/95` bar.
11. **F11: Home card copy** (`app/routes/home.tsx:68`): "Chọn trái cây, đặc sản, thêm lời chúc. Biếu Tết, mừng thọ, thăm người thân, giao trong ngày."

The ledger's existing M4-fix-wave minors (Task 4 `getOrder` bundle `orderBy`, reorder toast; Task 5 drawer-before-revalidate, cap counting dead ids, **stale server error persisting after edits**) stand. The stale error one is customer-visible: a red line from a failed add stays while the customer fixes the basket. I endorse all of them.

**Retake after the fix wave:**
- `m4-gift-full-375` and `m4-gift-full-1280` (weave shell, units on tiles).
- A new `m4-gift-msg120-375` plus its decoded preview.
- `m4-order-gift-375` (shell row "(cái)").
- The Task 7 script should wait for `#cart-drawer:not([open])` before the checkout shot.

---

## Carry-overs

**M5 (admin):**
- The admin order detail reuses the basket block (Decision 12). For packing, the preview must be ≥240 px (`size-60`) and open full size on tap: wrap it in `<a href={previewUrl(id)} target="_blank">`. 96 px is not enough to pack from.
- The shell's `unit`/`description` become admin-editable. That conflicts with F4's seed overwrite; decide then.

**M6 (hero Three):**
- Use the same rattan colours as the canvas shell (`#B9874B` / `#8A5F2E`, highlight `#D9AE73`) for the Lathe basket's texture, so the hero basket and the gift basket read as the same object.

**M7 (polish / owner photos):**
- Owner photos: redo the gao-st25 cut-out (a 5 kg bag, not a plate) and phô mai lát (a recognisable pack). Both also remove the smudges.
- Q5 swaps: bánh mì sandwich → nước mắm Phú Quốc, and ớt hiểm → hạt điều rang muối, from plain-background photos.
- Basket UI:
  - D12: disabled tile text contrast.
  - D13: basket `names` sub-line in the drawer and checkout.
  - D15: 375 first-view fit.
  - C7: "×N" tile badge, and optionally a delete control on the selected canvas item.
- Order page preview tap-to-enlarge for the customer (same `<a>` as M5).
- The client-side greeting counter counts UTF-16 code units, not NFC graphemes. Use `message.normalize("NFC").length` for the counter and `maxLength`, so an iOS NFD keyboard isn't cut short before 120.
- The Decision 18 a11y item stands (keyboard can't move or rotate items).
- M3 D16: the empty-drawer freeship copy is still open.
- F5 remainder, if its timebox ran out.
