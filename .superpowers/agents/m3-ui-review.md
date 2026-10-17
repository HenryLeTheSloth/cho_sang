# M3 checkout, orders and OTP login: UI gate (Designer + Customer council)

DEGRADED: single-context. Both personas ran in one subagent, as in M2. I wrote the design judgment from the screenshots and the live session before I read the detector output.

**Yardstick:** spec §3 (Checkout, Thanh toán giả lập, Đơn hàng, Đăng nhập) and §4. There is no PRODUCT.md or DESIGN.md, so the spec is the written design. The ui-check skill's CLAUDE.md rules (paper/ink/accent, no badges) belong to another project and do not apply here.

**Inputs:**
- All 18 `dod-*.png` files.
- `t6-order-*`.
- The M3 ledger (`progress.md`).
- Council round 2.
- My M2 review.

**Live session:**
- Production build on :3200 against `chosang_test`.
- agent-browser at 375×812, fresh cookies.
- The server was stopped by PID afterwards. No `.playwright-cli/` or `.ui-check/` folder was created.

**Shop path done, as the Customer:**
1. Added Rau muống, Cà chua bi and Bưởi Diễn from the cards.
2. Opened the drawer, then "Thanh toán · 142.000₫".
3. Checked out as a guest with COD. The phone was typed as "0987 654 321" and was accepted. Landed on the order page.
4. Pressed "Huỷ đơn" and got the cancelled view.
5. Pressed "Mua lại đơn này" on the cancelled order. It went to `/checkout` with the 3 items back.
6. Placed an online-mock order. "Giả lập thanh toán thất bại" showed the failed view. Then "Thử lại", then "Thanh toán". Landed on a paid order.
7. "Lưu đơn vào tài khoản" opened `/login?phone=…` with the phone prefilled. "Gửi mã" showed the DEMO toast with the code. A wrong code gave "còn 4 lần thử". The right code bounced back to the order.
8. `/orders` showed the order. In the DB, `userId` = 2, so the order is attached to the account.
9. Added 2 items, then "Đăng xuất". The cart still had 2 items. `/orders` went back to the guest view with an empty list.
10. Emptied the cart. The drawer showed 3 promos with +. Tapping + turned it into the normal cart.
11. Extra: an online order that stays failed, viewed on `/orders/:code` and `/orders`; and a lookup with a phone that doesn't match.

**Environment note for the controller:**
- At 11:27 another process reset `chosang_test`, probably a parallel e2e `globalSetup`. My orders DH261015PUSH and DH2610152WGL disappeared mid-session.
- Because of that, my "fail payment" POST was bounced to the lookup screen.
- This is not an app defect: a missing order and a forbidden order correctly show the same screen. I redid steps 6–8 and they passed.
- Agents running in parallel must not share the test DB.

**Detector (impeccable):**
- `/login`, `/orders` and `/orders/<unknown>` at 375: 0 findings.
- Static scan of `checkout.tsx`, `checkout-pay.tsx`, `order.tsx`, `orders.tsx`, `login.tsx`, `cart-drawer.tsx` and `toast.tsx`: 0 findings.
- Checkout, order and pay could not be scanned by URL, because the detector sends no cookies. My review of those pages comes from the live screenshots.

---

## Verdict: **PASS WITH FIXES**

There are no Critical findings. The Customer completes the purchase: a guest COD order in under a minute, with no login, the shipping fee printed under the sticky "Đặt hàng · 142.000₫", and every payment branch working. The OTP login really does attach the guest order to the account, and the cart survives logout.

The Important items are about what happens after the tap. The order page doesn't say "it worked, it arrives at 17–19h". An order whose online payment failed still says "Đã đặt, chờ chuẩn bị", which is exactly the "đang xử lý forever" fear. Two danger messages are missing their icon. A flash toast swallows taps on the sticky CTA. The OTP step makes you hunt for the code.

Every fix is small: a few lines each, no new data, no new component. Fix them in the M3 fix wave.

---

## Designer findings

| # | Sev | Screen | Defect | Concrete fix |
|---|---|---|---|---|
| D1 | **Important** | `/orders/:code` right after placing (`dod-order-375`, live) | **The confirmation has no hierarchy.** The only "success" is a 4 s toast. The biggest thing on screen is the order code, which nobody reads. The status ("Đã đặt, chờ chuẩn bị") is body-size 400, the same weight as the "đặt lúc" meta line. The "Lưu đơn vào tài khoản" card sits between the status and the timeline. The delivery slot, the one thing the customer wants to know, is below the fold inside "Giao hàng". The payment state is a loose sentence under the timeline. | Restructure the header (`order.tsx` ~95–125). Put a status block first: a Lucide `Check` in `text-fresh` and "Đã nhận đơn" as an `h1` (Bricolage). Under it, one large line: **"Giao 17:00–19:00 · Thứ Năm 15/10"**. Then the code as small `text-ink-muted` meta: "Mã đơn DH261015PUSH · đặt lúc 11:26". Next comes the payment state (see D9), then the timeline. Move the "Lưu đơn vào tài khoản" card **below** the items, before the action row. It is an upsell, not part of the receipt. For `cancelled`, the status block uses `CircleX` in ink with "Đơn đã huỷ" (not danger). |
| D2 | **Important** | Online order, payment failed or unpaid (`/orders/:code`, `/orders`; live DH261015TAS9) | The heading says "Đã đặt, chờ chuẩn bị" and the first timeline step has a green check, but the payment failed. The only clue is a sentence below the timeline, followed by a small underlined "Tiếp tục thanh toán". The `/orders` row shows "Đã đặt, chờ chuẩn bị" with no hint about payment. Is the shop preparing it or not? | Derive the label in `toOrderView`/`toOrderListItem`. When `paymentMethod === "online_mock" && status === "pending" && paymentStatus !== "paid"`, use "Chờ thanh toán" (unpaid) or "Thanh toán chưa thành công" (failed). Put the same string in the list row. On the order page, show a full-width magenta **"Tiếp tục thanh toán · 142.000₫"** `<Link>` directly under the status block (D1). That becomes the page's one primary action. Keep the COD fallback reachable from the pay page, which already has it. |
| D3 | **Important** | Order page action row | **"Mua lại đơn này" is the magenta primary on an order placed 10 seconds ago.** It invites a duplicate order and outranks "Huỷ đơn", the only other relevant action. | Make the reorder button magenta only when `status` is `done` or `cancelled`. Otherwise use the existing `secondary` (outline) class. With D2, there is at most one magenta button per state: pay (unpaid online), reorder (done/cancelled), or none (pending COD). |
| D4 | **Important** | `/login` wrong code; `/orders/:code` reorder error | **The `danger` token is used without an icon,** which breaks the §4 rule "luôn kèm icon + chữ". The places are `login.tsx:94` (a top banner) and `order.tsx:181` (bare red text; this was flagged in the Task 6 ledger for this gate and is still open). The login error is also not inline next to the field, which §4 requires: the code input gets no `aria-invalid`, and the red message sits two blocks above it. | For `login.tsx`, pass `error={actionData?.error ? [actionData.error] : undefined}` to the code `Field` (and to the phone `Field` on step 1). `Field` already renders the `CircleAlert`, `aria-invalid` and the danger border. Delete the top banner. For `order.tsx:181`, use `flex items-start gap-1.5` plus `<CircleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />`, the same markup as `checkout.tsx:160`. |
| D5 | **Important** | `/login` OTP step (`dod-login-otp-375`, live) | After "Gửi mã", focus does not move to the code field (`document.activeElement` = body). The code sits in a toast at the very bottom (y≈775), and the field is at y≈280. On iOS Safari the on-screen keyboard covers `position: fixed; bottom` elements, so **the code disappears the moment you start typing it.** | `autoFocus` on the code `Field` when `step === "code"`. Repeat the code inline as the field hint while the DEMO toast is up: `hint={demoCode ? <>DEMO · mã của bạn: <b>{demoCode}</b></> : undefined}`, with the same DEMO pill. The toast stays, as the spec requires, but no longer has to be the only place. Optional delight, two lines: auto-submit with `form.requestSubmit()` when the 6th digit is entered. |
| D6 | **Important** | Every page with a flash toast over a sticky bar (live: "Đã thêm lại các món vào giỏ" on `/checkout`) | `Toast` has `pointer-events-auto` and the dock sits at `bottom-4`. At 375 that is **on top of the sticky "Đặt hàng · …" button for 4 s**. A tap on the middle of the CTA hits the toast and nothing happens. | Flash toasts hold no controls, so `FlashToast` should render `Toast` with `pointer-events-none` (keep `auto` only for the drawer's undo toast). On `/checkout` mobile, also lift the dock above the bar, e.g. `bottom-24 md:bottom-4` via a prop, so the message stays readable. |
| D7 | **Important** (a11y) | Checkout slot picker | The day headings ("Hôm nay 15/10", "Ngày mai 16/10") are `<p>`, so the radios' accessible names are just "14:00–16:00", twice. A screen-reader user cannot tell today from tomorrow. That means a wrong delivery day. | Wrap each day in a nested `<fieldset>` with `<legend className="mb-2 text-sm text-ink-muted">{day.label}</legend>`. It looks identical and is 2 lines. |
| D8 | Minor | Slot picker | Past slots lead the picker as two 50%-opacity "Đã qua" tiles. After 17:00 that becomes four dead tiles above the first one you can pick. | Do not render `reason === "past"` slots. If every slot today has passed, show one muted line, "Hôm nay đã hết giờ giao", in place of the grid. Keep "Đã kín" tiles: they tell you something. |
| D9 | Minor | Order page payment line | "Thanh toán online (DEMO): Đã thanh toán." is plain 14 px ink. The best moment of the online branch is unmarked. | Show the line with an icon, right under the status block. Paid: `Check text-fresh` + "Đã thanh toán (DEMO)". This is a success, so `fresh` is the correct token. Failed or unpaid: that case is D2. |
| D10 | Minor | Timeline | "Chưa tới" appears three times, which is noise. Nothing marks the next step. | For the first step without `at`, write "Tiếp theo" in `text-ink`. Write nothing under the later steps. `aria-current` already exists. |
| D11 | Minor | `/checkout` copy | Two "Thanh toán" headings on one page: the `h1` and the payment `legend`. The pay page adds a third, "Thanh toán đơn". | Change the `h1` to "Đặt hàng" (it matches the CTA), and keep the legend "Thanh toán". |
| D12 | Minor | Payment choice | "Thanh toán online" plus the DEMO pill says nothing about what happens next. With online selected, the CTA still says "Đặt hàng · …", and the subtitle still promises "trả tiền khi nhận hàng" (deferred M7, ledger T5). | Add a hint under the online option: "Cổng giả lập, không trừ tiền thật". Make the CTA follow the choice: "Đặt hàng và thanh toán · …" when online is checked (a small `useState` on the radio, or CSS `:has()` with two spans). |
| D13 | Minor | Pay page DEMO banner | The dashed 2 px box reads as a wireframe placeholder. It is the only DEMO marker that is not the pill used on checkout, the OTP toast and the footer. | Use a solid `border-line` surface strip with the same DEMO pill followed by "Không trừ tiền thật". Also align the pay CTA to `text-lg`, like the checkout CTA. |
| D14 | Minor | Checkout summary | "Miễn phí" shipping is ink here but `text-fresh` Bricolage in the drawer. | Use the same class as `cart-drawer.tsx:149`. |
| D15 | Minor | `/orders` row | The meta line wraps in the middle of the status ("Đã / đặt, chờ chuẩn bị"). The status has no visual weight of its own. | Put the status on its own line in `text-ink` (and in the D2 wording). Keep the date and item count muted on the line above. |
| D16 | Minor | Empty states | `/orders` empty: "Chưa có đơn nào." in a bare card, a dead end. Lookup no-match: no way forward. Empty drawer: "Còn 300.000₫ nữa được freeship" on an empty basket (Decision 3 asked for "Freeship cho đơn từ 300.000₫"); the rows are labelled "Khuyến mãi" but show no strike-through price or −%. After tapping + in the empty drawer, focus drops to `<body>`, outside the modal. | `/orders`: add "Đi chợ thôi →" linking to `/collections/all`. Lookup: "Không nhớ số đã đặt? Gọi {HOTLINE}". Empty drawer: use the Decision-3 string when `lines.length === 0`; show `compareAtVnd` struck in `text-ink-muted`; after the add, move focus to the new line's stepper "+" (or to the drawer heading). |
| D17 | Minor | Cancelled order | It still offers "Lưu đơn vào tài khoản". The copy "Hàng đã được trả lại kho" talks about the shop's stock, not the customer. | Hide the save card when `cancelled`. Change the copy to "Đơn đã huỷ lúc 11:26. Bạn không phải trả gì." (paid online: "…tiền demo sẽ được hoàn", as now). |
| D18 | Minor | Login links / header | "Gửi lại mã" is indented 8 px from the field edge. The header person icon is the same whether you are logged in or not. | Use `-ml-2` or remove the horizontal padding on the first link. For a logged-in user, show a 6 px `bg-fresh` dot on the account icon (`aria-label` already differs). |
| D19 | Minor (carry from M2) | Collection chips | "Chỉ hàng còn" is still there. M2 D8 ("Còn hàng") did not land. | One string. |
| — | Note | Drawer at 375 (headless) | The ~15 px light strip on the right comes from `scrollbar-gutter: stable` with classic headless scrollbars. Phones use overlay scrollbars, where the gutter is 0. | No action. Closes ledger T2's "check at M3 UI gate". |

**Token audit**
- **Magenta (`brand`):** 5 uses of `text-brand`, all prices; 4 uses of `bg-brand`, all CTAs; plus `hover:text-brand` on links. Clean, apart from D3, which is a hierarchy problem rather than a token misuse.
- **`fresh`:** only the past timeline steps and "Miễn phí" in the drawer. Correct. D9 and D14 add two more correct uses.
- **`danger`:** 7 uses. 5 carry `CircleAlert`; the other 2 are D4.
- The payment failure on the pay page uses ink with `CircleX`, not danger. That is correct: it is a state, not a form error.

**DEMO labelling:** present on every mock surface: the checkout online option (pill), the pay page (banner), the order page ("(DEMO)" text), the OTP toast (pill), the login hint, and the footer. That meets spec §3/§4 "never cut". D13 only unifies the style.

**Vietnamese copy:** it reads like a person, for example:
- "Bạn nhập họ tên người nhận giúp mình nhé."
- "Thanh toán chưa thành công. Đơn và hàng vẫn được giữ cho bạn."
- "Đơn bạn đã đặt bằng số này sẽ tự về tài khoản."

The weak spots are D11, D17 and D19.

**ui-check questions**
- **Identity:** magenta Bricolage totals on the CTA, prices on the pay screen, and the DEMO pill in Bricolage 800. The timeline and forms are generic, which is right for Operate mode. The order confirmation is where the brand should show, and right now it is the plainest screen (D1).
- **Logic:** checkout reads in task order (who → when → note → how to pay → summary), and the CTA with the total is always in the thumb zone. The order page does not: code → upsell → timeline → slot (D1).
- **Human:** the copy is good overall (see above). Exceptions: "Chưa có đơn nào." and "Hàng đã được trả lại kho".
- **Restraint:** "Chưa tới" ×3, past-slot tiles and the save card on a cancelled order are elements that don't earn their place.

**Nielsen (M3 flows, Operate)**

| # | Heuristic | Score | Note |
|---|---|---|---|
| 1 | Visibility of system status | 2 | The success is only in a toast. A failed payment reads as "chờ chuẩn bị" (D1, D2). |
| 2 | Match with the real world | 4 | COD by default, slots, "Gọi hỏi tôi nếu có món hết hàng", hotline. |
| 3 | User control and freedom | 3 | Cancel, retry, switch to COD, reorder. Cancel uses the native `confirm()`. |
| 4 | Consistency and standards | 3 | Two DEMO styles, two "Miễn phí" styles, two danger patterns (D4, D13, D14). |
| 5 | Error prevention | 3 | Server re-validates slot and stock, checkout key, sold-out lines struck. Ambiguous slot names for SR users (D7). |
| 6 | Recognition rather than recall | 3 | Phone prefilled into login. A guest's second checkout is blank (C3). |
| 7 | Flexibility and efficiency | 3 | Autocomplete/inputmode on every field, Enter submits. OTP needs extra taps (D5). |
| 8 | Aesthetic and minimalist design | 3 | Clean. A little noise (D8, D10, D17). |
| 9 | Help users recover from errors | 3 | Inline field errors with icons on checkout; the login error is far from its field (D4). |
| 10 | Help and documentation | 4 | Hotline on the order page and footer, DEMO hints. |

---

## Customer findings ("4G, lunch break, phone in my right hand")

**Would I complete the purchase? Yes.**
- Three taps on cards, then the drawer, then "Thanh toán · 142.000₫". On checkout, my browser could autofill name, phone and address. The fee "Gồm phí giao 20.000₫" sits right under the big button, so nothing is hidden. One tap on "Đặt hàng" and I was done.
- No login anywhere.
- Cancelling worked and put the stock back.
- The fake payment did everything I asked for in round 2: fail, try again, pay, or switch to cash.
- Login was my phone number plus a code, and my order was waiting in "Đơn hàng của bạn".
- Logging out didn't empty my basket.

**Where I hesitated / what annoyed me**

| # | Sev | Where | What happened | Requirement for the Developer |
|---|---|---|---|---|
| C1 | **Important** | Right after "Đặt hàng" | A toast said "Đặt hàng thành công" and vanished. What stayed was a big code, a box asking me to save to an account, and a list of steps. I scrolled to find **when** it arrives. | D1: the page leads with "Đã nhận đơn" and "Giao 17:00–19:00 · Thứ Năm 15/10". The code goes small, the account box goes lower. |
| C2 | **Important** | Online payment failed, then I left the pay page | My order page says "Đã đặt, chờ chuẩn bị" with a green tick, and the list says the same. So… are they preparing it? Do I owe money? This is the "đang xử lý" limbo I hate. | D2: say "Chờ thanh toán" / "Thanh toán chưa thành công" in the heading and the list, with one big "Tiếp tục thanh toán · 142.000₫" button at the top. |
| C3 | **Important** | "Mua lại đơn này", then checkout, as a guest | I typed my name, phone and address two minutes ago on this same phone. Second order: all three fields are empty again. And the "Đã thêm lại…" toast sat on top of the "Đặt hàng" button, so my first tap did nothing. | (a) When there is no `userId`, `checkoutPrefill` falls back to the newest order in `session.guestOrderCodes`. The session can already open that order, so nothing new is exposed. Logout clears the codes, so a shared device is still safe. (b) D6: flash toasts never block taps. |
| C4 | **Important** | Order page "Các món" | At checkout, Bưởi and Rau muống said "tạm tính ±10%", and the total had a note about the shop telling me the exact amount. On the order page, which is the receipt I'll show my mum, the total is just 142.000₫, with no caveat. When the shipper asks for 151.000₫, I'll feel cheated. | Show "· tạm tính ±10%" on weighed lines on `/orders/:code` too, and the footnote "Giá tạm tính, cân thực tế ±10%. Shop báo lại số tiền chính xác khi soạn hàng." under Tổng, as in `checkout.tsx:234`. `toOrderView` needs `isWeighed` per item (snapshot or join). |
| C5 | **Important** | OTP step | I tapped "Gửi mã", then had to tap the empty box, look down at the black toast, remember 6 digits, and look back up. On my iPhone, the keyboard will sit right on top of that toast. | D5: the cursor is already in the box, and the code is shown right under it (it is a demo). Even better, it logs in by itself after the 6th digit. |
| C6 | Minor | "Lưu đơn vào tài khoản" | I tapped "save my order" and landed on a page titled "Đăng nhập". For a second I felt forced into an account. The toast then said "Đã đăng nhập", not that my order was saved. | When `redirectTo` starts with `/orders/`: use the title "Lưu đơn vào tài khoản" and the toast "Đã lưu đơn vào tài khoản". |
| C7 | Minor | "Huỷ đơn" | A grey browser box ("localhost says…") asked me to confirm. It works, but it doesn't look like the shop. | M7. Acceptable for the pitch. |
| C8 | Minor | "Đăng xuất" on `/orders` | I was thrown to the home page. Spec §3 says "quay về trang cũ". | `orders.tsx` hard-codes `redirectTo="/"`. Use `/orders`, which then shows the guest view. |
| C9 | Minor | Pay page, after "Thử lại" | Retry takes me back to the start, so I press "Thanh toán" again. That's two taps to retry. | Acceptable: it is a demo of the branches. No action. |
| C10 | Minor | Checkout after 17:00 | All of today's slots sit there greyed out before tomorrow's. | D8. |

**What I liked (keep these):**
- The total on the button.
- "Gồm phí giao 20.000₫" right under it.
- COD already selected.
- "Gọi hỏi tôi nếu có món hết hàng" already ticked.
- The sold-out apple struck through and "không tính vào đơn".
- My phone number typed with spaces was accepted.
- "Đơn và hàng vẫn được giữ cho bạn" when payment failed.
- The empty basket offering 3 deals with + right there.
- Lookup with the wrong phone says so politely, under the field, with an icon.

---

## Fix-wave summary for the controller

**M3 fix wave (Important, all small):**
- D1 / C1: order page header hierarchy, and move the save card down.
- D2 / C2: unpaid/failed online label in the heading and list, plus a primary "Tiếp tục thanh toán".
- D3: "Mua lại" is magenta only when done or cancelled.
- D4: danger needs an icon (`login.tsx:94`, `order.tsx:181`); login error inline through `Field`.
- D5 / C5: OTP `autoFocus` and an inline DEMO code hint.
- D6 / C3b: flash toast `pointer-events-none`; lift it above the checkout sticky bar.
- D7: nested fieldset/legend per delivery day.
- C3a: guest prefill from the newest session order.
- C4: weighed ±10% caveat on the order page.

**Cheap Minors worth folding into the same wave:** D8, D9, D11, D14, D17, D19, C6, C8.

**M7:** D10, D12, D13, D15, D16, D18, C7.

**Retake after the fix wave:**
- `dod-order-375` (just placed, COD)
- an unpaid-online `dod-order-375`
- `dod-orders-375`
- `dod-login-otp-375`, with the hint and focus visible
- `dod-checkout-375`, after 17:00 or with the past slots hidden

**Process:** give each parallel agent its own test DB, or serialise e2e runs. A reset of `chosang_test` during the gate made one live run look like a bug.
