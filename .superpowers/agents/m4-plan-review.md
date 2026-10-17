# M4 Gift basket (Fabric): plan gate review (Consultant)

Plan: `docs/superpowers/plans/2026-10-15-m4-gift.md`, read in full (3,058 lines). I checked it against:
- spec §2 (Fabric, gift data model, Giỏ hàng), §3, §4, §5 (GiftBundle, cookie `b`, route map, checkout rules, budgets) and §6 M4;
- the roadmap module contract, spike 2, the M0 seed ruling, and every "Chuyển sang M4" (Kết quả M3 plus `m3-final-review.md` M4 carry-overs 1–9);
- the M3 gate precedent (`m3-plan-review.md`, `m3-final-review.md`);
- the real code the patches touch: `cart*.ts`, `use-cart.ts`, `routes/cart.ts`, `checkout.tsx`, `order.tsx`, `cart-drawer.tsx`, `orders.server.ts`, `uploads.server.ts`, `security.server.ts`, `forms.server.ts`, `seed.ts`, `schema.prisma` and the init migration (`OrderItem.bundleId … ON DELETE SET NULL`), and `prisma/test-db.ts` (the TRUNCATE already lists `GiftBundle`).

What I ran myself (in the scratchpad, never against the project):
- I extracted all 23 ```diff blocks and ran them against a copy of the post-M3 tree. Every one passes `patch -p1 --dry-run` with exit 0 and applies cleanly. The patches match reality.
- I read RR 8.4 `lib/router/router.js:882`. After a fetcher action resolves, the fetcher moves to `loading` with `formData` **still set** for the whole revalidation (this drives change 1).
- I read Prisma 7.10's bundled `@bugsnag/cuid` v1, which is what `@default(cuid())` uses. An id is built as `c` + ms timestamp + process counter + pid/host fingerprint + 2 × `Math.random()` blocks. That gives about 41 bits from a non-CSPRNG, and everything else can be read off the attacker's own id (change 3).
- I built an 8000×8000 lossless webp with sharp. It is **2,506 bytes, a 3,367-character data URL**, and it passes the plan's prefix, length and `RIFF…WEBP` checks. It decodes to 256 MB RGBA; at 16383² it would be about 1 GB (change 2).
- I checked that `"c" + randomBytes(12).toString("hex")` passes zod 4.6.7 `z.cuid()` and the route regex `^c[a-z0-9]{20,32}$`.
- I re-added the test counts: 199+1+1+3+21+1+2+7+2+5+4+2+8 = 256, and e2e 13+8 = 21. Both match.

## Verdict: APPROVE WITH CHANGES

This is a strong plan, prototyped end to end. The money and stock core is right, and it reuses M3 instead of forking it:
- The bundle is a set of normal `OrderLineInput`s (shell + items) carrying a `bundleId`. As a result, `aggregateQty`, the ascending-id conditional `UPDATE … stock >= q`, the in-transaction `cartTotals(… stock: 1)` and the `expectedTotalVnd` guard all cover gift baskets with no new transaction code.
- The price is recomputed from the DB in three places (`bundleViews`, the checkout loader total, and the transaction).
- `layout` is the single source of truth. `pid` is checked against `visible` + `cutoutUrl` before any write.
- The cookie `b` stays bounded: ≤10 unique cuids, with `setBundles` and `/gift` both capping before a GiftBundle is created.
- Every M3 carry-over is covered and tested, including the `stock: 1` pin with a mutation check.
- Fabric stays behind a `.client.ts` dynamic import, and `canvas` is denied.

The review found one real data-loss bug in the undo path, two security gaps on the only unauthenticated surface M4 adds (the preview bytes and the preview URL), and one small a11y gap. Every fix is a handful of lines plus a test. With them, the plan goes to execution without coming back to this gate.

### Spec and carry-over coverage

| Requirement | Task | Status |
|---|---|---|
| `/gift`: 1 shell, ~12 cut-outs, tap to add, drag/rotate/scale, ≤10 items, greeting ≤120, add to cart (§3) | 1, 5 | OK (Q3/Q5 are for the Designer) |
| Greeting is a text object on the canvas; no card step at checkout (§2) | 5 | OK (see optional 5 on copy) |
| GiftBundle: `layout` single source, items counted by `pid`, shell is an `isGiftBase` product, `preview` ≤60 KB with prefix + length check (§2, §5) | 2 | OK. Byte bound: **change 2**. jpeg: Q1 |
| One "Giỏ quà · N món" line, qty fixed at 1, `<img>` only, no Fabric outside `/gift` (§2, §3 drawer) | 2, 3 | OK. Undo: **change 1** |
| Checkout: aggregate normal + bundle items + shell, conditional decrement, name the short item (§5) | 4 | OK |
| `/cart` intents `add-bundle`/`remove-bundle` (§5 route map) | 3 | OK |
| DoD: 10 items + greeting → COD → order shows preview and the correct total | 6 | OK (e2e also checks DB total and stock) |
| DoD: unknown pid or >10 items rejected | 2, 5, 6 | OK (unit, route and raw-POST e2e) |
| DoD: Fabric in no other route chunk; Fabric chunk ≤130 KB | 5, 6, 7 | OK (88.4 KB). Server build: **change 5** |
| Home has an entry to `/gift` (§3) | 5 | OK |
| M0: `cutoutUrl` in the seed `update` object; spike 2 deny `canvas` | 1, 5 | OK |
| M3: bundle lines in the checkout summary + hidden `total` | 4 | OK |
| M3: missing bundle id dropped from the view, P2003 → `changed` | 2, 4 | OK (mutation-checked) |
| M3: clear `b` on success | 4 | OK (`EMPTY_CART`) |
| M3: `insertOrder` filters `isActive` only | 4, 7 | OK (unchanged, grep) |
| M3: bundle-specific out-of-stock wording | 4 | OK (two route tests) |
| M3: order page grouped by bundle with preview, prefix/size checked, after `canViewOrder` | 2, 4 | OK for the page. The image URL itself: Q2 + **change 3** |
| M3: decide "Mua lại" for bundles | 4 | OK (Decision 10) |
| M3: `/gift` uses `readForm` with ≈100 KB | 5 | OK (100 KB, 413 tested; the urlencoded worst case for a real preview is ≈68 KB) |
| M3: pin `stock: 1` (T3b) | 4 | OK (holding-transaction test + mutation) |
| M3: GiftBundle in the test TRUNCATE (T1b) | n/a | Already present |
| M3: `takenSlots(now)` before `orderForKey(key)` | 4 | OK |
| Roadmap Review Focus 3 (stale `b` ids) | 2 | OK (`bundleViews` drops the line; preview 404) |

## Required changes

1. **Undo of a bundle removal is silently lost during revalidation** (Task 3 `use-cart.ts` `restoreBundle`, plus an e2e test).

   RR keeps `fetcher.formData` through the post-action `loading` phase (`router.js:882`). By then the remove's `Set-Cookie` has already been applied. `removing` still contains X, so `restoreBundle(X)` sends `remove-bundle` **without** X ("cancel the in-flight remove"), and the server reads a cookie that no longer has X. The result: the toast disappears, the bundle never comes back, and the customer has to rebuild it on `/gift`.

   On the pitch's Slow 4G, revalidation takes a full round trip. Tapping "Hoàn tác" 1–2 s after "Xoá" lands in exactly this window. The existing e2e misses it because locally the window is a few ms.
   - **Fix:** take the cancel path only while the remove has not returned yet:
     ```ts
     restoreBundle: (id) => submit(pending, removing.includes(id) && fetcher.state === "submitting"
       ? { intent: "remove-bundle", ids: removing.filter((x) => x !== id) }
       : { intent: "add-bundle", ids: [id] }),
     ```
     In `loading`, every id in `removing` is already gone from the cookie, so `add-bundle [id]` is both correct and idempotent.

     An equivalent alternative is an absolute op `{ remove: string[]; add: string[] }` sent together; the planner may choose it. Either way the test below must pass.
   - **Test (e2e):** in the drawer test, delay only **GET** `**/*.data*` (the revalidation) by about 1.5 s and let the POST `/cart.data` through. Click "Xoá", wait for the POST response, click "Hoàn tác", let things settle, then `fetch("/cart")` must return `bundles.length === 1` and the badge must be "Giỏ hàng, 1 món".
   - **Mutation check:** drop `&& fetcher.state === "submitting"` and the test goes red.
   - Update the e2e count.

2. **Bound the decoded size of the preview (decompression bomb)** (Task 2 `gift.server.ts`, plus a test).

   A webp of a few KB can declare 16383×16383 (verified: 8000² is 3.4 KB as a data URL and passes every current check). It is stored, then decoded by every browser that renders it: the owner's drawer and order page, and from M5 the **admin order detail**. A griefer on the public demo link can therefore freeze or crash the owner's admin tab with one COD order.
   - **Fix:** after the sync checks, read the header with `sharp(bytes).metadata()`. This parses the header only and does not decode. Reject unless `format` equals the prefix type (`webp`/`jpeg`) and `width ≤ 480 && height ≤ 480`, which is the client's maximum. Return the same "Ảnh xem trước không hợp lệ…" message.
   - Make `parseGiftForm` async (an async `refine` + `safeParseAsync`) or add a separate check in the action. This can **replace** the hand-rolled `RIFF`/`FF D8 FF` byte check, leaving one mechanism instead of two.
   - **Test:** `parseGiftForm` with an 8000×8000 lossless webp built by sharp is rejected. A 480×480 webp and a jpeg are accepted.

3. **Make the preview URL a real capability** (Task 2 `createBundle` and `gift-preview.ts`, plus tests).

   `/gift/preview/:id` has no session check, so the id is the only gate on the preview, and the preview contains the greeting text rendered as pixels. Prisma's `cuid()` is cuid v1, not a secret:
   - its timestamp, counter and fingerprint can all be read off a bundle the attacker creates themselves;
   - the remaining ~41 bits come from `Math.random()`, which is not a CSPRNG.

   Online brute force is still impractical, but "unguessable" must not rest on a generator whose authors say it is not secure.
   - (a) In `createBundle`, set `id: \`c${randomBytes(12).toString("hex")}\`` from `node:crypto` (96 bits, CSPRNG), with a comment saying why. It still passes `z.cuid()`, the cookie schema and the route regex (verified). There is no schema change, because `@default(cuid())` is generated by the client, not the DB.
   - (b) Add `X-Content-Type-Options: nosniff` to the preview response. The app serves customer-supplied bytes from its own origin.
   - **Tests:** `createBundle` returns an id matching `/^c[0-9a-f]{24}$/`; the `gift-preview` test asserts the `nosniff` header.

4. **Announce the canvas status to screen readers** (Task 5 `gift.tsx`). "Đang mở khung xếp giỏ…" and "Không tải được khung xếp giỏ…" currently render **inside** the `aria-hidden` host. A screen-reader user therefore finds all 12 "Thêm … vào giỏ quà" buttons disabled with no reason given, and never hears the load error.
   - Move the status `<p>` outside the hidden host, as a sibling overlay. Keep the visual position.
   - Give it `role="status"`, and `role="alert"` with `CircleAlert` for the error (global rule: errors always carry an icon + text).

5. **Prove nothing server-side carries Fabric** (Task 5 Step 5 and Task 7 Step 5, one line each). Add
   ```bash
   grep -rlE 'FabricImage|StaticCanvas|jsdom' build/server && echo "VI PHẠM: fabric/jsdom trong server" || echo "ok"
   ```
   The client grep and the source grep already exist. This closes the server side of the "Fabric only on `/gift`" rule, which the build log only asserts by eye.

6. **Hand-off and spec notes** (Task 7 Step 7, doc only). The controller records the following:
   - **Spec §5 GiftBundle:** `preview` is `data:image/(webp|jpeg);base64,…`, ≤60 KB, prefix + length + header (format, ≤480 px) (Q1).
   - **Spec §5 route map:** a new row `/gift/preview/:id`: resource route, the 96-bit id is the capability, `private, immutable`, `nosniff` (Q2).
   - **M5:**
     - The preview is a customer-supplied illustration. Admin packs from `toOrderView().bundles[].items` (the snapshot lines), never from the image. Label it that way on the packing screen.
     - Render admin previews with `loading="lazy"` and fixed `width`/`height`.
   - **M7:**
     - (a) `/gift` is the first unauthenticated write of up to 60 KB per row. Rate-limit it (or cap bundles per hour) before a public link; `demo:reset` deletes GiftBundle. Add a `ponytail:` comment at `createBundle`.
     - (b) `fabric` pulls `jsdom` and the denied `canvas` into a production `npm ci --omit=dev`. Either move `fabric` to `devDependencies` (it is only needed at build time; the server gets the `.client` stub) or install with `--omit=optional`, then re-check that `canvas` has no build output in the image.
     - (c) Keyboard repositioning (Q4) goes on the a11y list.
     - (d) Test the jpeg path once on a real iPhone (already listed).

## Rulings

### The 18 Decisions

| # | Ruling | One line |
|---|---|---|
| D1 12 cut-out items | **Approve** | Chosen by real rembg results. Excluding the sold-out `tao-envy` is right. The item set belongs to the Designer (Q5) |
| D2 rembg `isnet-general-use`, pinned digest, Docker, one-off | **Approve** | Pinned by sha256, input mounted `:ro`, runs as the caller's uid, never in `package.json`. The OOM finding on the default model is valuable. See optional 7 |
| D3 shell drawn as vector paths (back + overlay) | **Approve** | The only honest way to get an empty basket from the available photo. Look and feel belongs to the Designer (Q3) |
| D4 webp 480/q0.8 with fallback ladder; jpeg on Safari; magic-byte check | **Approve**, amended by change 2 | The prefix/length/byte checks are good, but they bound the encoded size, not the decoded size |
| D5 preview via `/gift/preview/:id` instead of a data URL in loader data | **Approve**, amended by change 3 | Correct call: the root loader re-runs on every navigation and every cart tap, and 10 × 60 KB would ride along each time |
| D6 logical 400² frame, x/y 0–1, s 0.2–5, r ±360, rounded to 3 places | **Approve** | Server-bounded, resolution-independent, and zod strips unknown keys before the layout is stored |
| D7 greeting in an outside `<textarea>`, read-only Textbox on the canvas, NFC before counting | **Approve** | Better for IME, screen readers and mobile than editing on the canvas. The NFD test is right |
| D8 bundle ops share the "cart" fetcher; the in-flight op rides along | **Approve**, amended by change 1 | Right model (M2 D2). The cancel-by-resubmit branch is valid only while `submitting` |
| D9 `CartBundle`; stock 0 = struck and not counted; inactive component = drop the line | **Approve** | Same semantics as normal lines (M2 D6 / M3 D9). The aggregate-across-lines shortage is caught by `placeOrder` and worded as a gift item |
| D10 "Mua lại" re-adds the same GiftBundle | **Approve** | Same layout, image and greeting at today's prices. `setBundles` keeps only existing ids, ≤10 |
| D11 checkout builds bundle lines, clears `l`+`b`, `takenSlots` before `orderForKey`, 409 wording, P2003 → `changed` | **Approve** | Covers carry-overs 1–5 and 9. Optional 3 narrows P2003 |
| D12 order page groups by bundle; `getOrder`/`toOrderView` reused by M5 | **Approve** | Behind `canViewOrder`; the stranger test proves no bundle id leaks. `ON DELETE SET NULL` means a deleted bundle degrades to normal lines, never to vanished lines |
| D13 after add: reset + open drawer; reject at 10 before create; button lock conditions | **Approve** | No orphan from the cap. The double-tap lock with `flushSync` is e2e-proven (1 POST). See optional 4 |
| D14 375 px: square canvas, horizontal item row, sticky CTA; ≥768 two columns | **Approve** | The Designer verifies at the UI gate |
| D15 no canvas animation | **Approve** | Reduced motion is respected by construction, and it matches spec §4 |
| D16 weighed items inside bundles keep "tạm tính ±10%" | **Approve** | Consistent with normal lines |
| D17 neutral home entry card | **Approve** | No magenta surface; the Designer judges it |
| D18 keyboard/SR can run the whole flow except moving items; canvas `aria-hidden` | **Approve** (Q4), amended by change 4 | |

### Open questions

| Q | Ruling | Reason |
|---|---|---|
| Q1 Safari jpeg vs the spec's "webp" | **Approve jpeg as a detected fallback.** Amend the spec text (change 6) | The spec's intent is "a small raster `<img>`, no Fabric outside `/gift`", and jpeg meets it. The fallback is feature-detected (`!url.startsWith("data:image/webp")`), not UA-sniffed, so it stays right if WebKit gains webp encoding. The basket background is white, so losing alpha costs nothing. Change 2 bounds both formats |
| Q2 `/gift/preview/:id` and the spec route map | **Approve as a capability URL**, conditional on change 3; add it to the route map (change 6) | A session check would mean "bundle in my `b` **or** in an order I can view **or** admin", which is three lookups for a ≤60 KB image. The capability model is simpler and standard, but only if the capability is a real secret (CSPRNG id) and the bytes are bounded (change 2) and not sniffable (`nosniff`). `private` caching keeps it out of shared caches. Residual (accepted): anyone who already sees the order page (owner; DEMO_OTP phone takeover per M7 (c)) sees the greeting, which is by spec |
| Q3 vector basket | **Noted for the Designer** (M4 UI gate) | |
| Q4 keyboard cannot move or rotate items | **Approve for MVP.** Record it for M7 a11y (change 6c) | Position is decoration. Every functional step (pick, remove, greeting, add to cart) is a real button or textarea outside the canvas. Arrow-key nudging would be about 20 lines of Fabric focus handling for no business story. Change 4 is the a11y floor that does matter |
| Q5 which 12 items | **Noted for the Designer** (M4 UI gate) | Tỏi, ớt, gạo, dầu ăn and đường read as a Vietnamese Tết basket. The photo-quality call is the Designer's |

### Checked and found OK (no action)

- **Money.**
  - The bundle price is shell + Σ items from the DB in `bundleViews`. `insertOrder` re-reads every price inside the transaction with `stock: 1` and compares against the hidden `total`.
  - The `/gift` price is display-only.
  - Struck bundles are excluded from both the loader total and the action lines.
  - `cancelOrder` restocks bundle items and the shell via `aggregateQty` over every `OrderItem`.
- **Stock.** The shell is a component (`qty 1`), so it is decremented. `insertOrder` filters `isActive` only, so the hidden shell is orderable. When a normal line and a bundle share a product, the combined quantity is checked in one `UPDATE`.
- **Cookie `b`.** ≤10 unique cuids in the schema; `setBundles` and `/gift` cap before writing. The worst-case cookie is ≈1.5 KB. Duplicates are never written by the server.
- **Input.**
  - `layout`: string ≤4,000 characters before `JSON.parse`; ≤10 items; int4 pid; bounded floats; unknown keys stripped.
  - Every pid must be `visible` with a `cutoutUrl` (so the shell itself is refused).
  - Greeting: NFC + trim + ≤120.
  - Body: ≤100 KB with a streamed cap; Origin checked.
  - The preview regex is linear (no ReDoS).
- **XSS.** The greeting is only ever a React text node or canvas pixels; there is no `dangerouslySetInnerHTML`. `svg+xml`, `text/html` and PNG prefixes are rejected, and the served `Content-Type` comes only from the validated prefix.
- **Concurrency.** Remove followed by an immediate `+` carries the op (e2e + mutation). A double tap gives 1 POST and 1 GiftBundle (`flushSync` + disabled). The bundle cap is checked before create, so there is no orphan.
- **Supply chain.** `fabric@7.4.0` is pinned exact; the `canvas` install script is denied (`allowScripts.canvas = false`, `install-scripts ls` clean, no `build/`); `jsdom` is never loaded. Only `gift-canvas.client.ts` imports `fabric`; `gift.tsx` uses `import type` + `import()`. The rembg image is pinned by digest and is not a dependency.
- **Test-DB safety.** Task 1 Step 0 / Task 7 Step 6 record dev-DB counts. The seed is an upsert that only adds `cutoutUrl` + webp files. No `migrate reset`, no schema change.
- **Over-engineering.** None found. Every piece maps to the spec, a carry-over, or a Review Focus item. The preview route, the op carry-along and the Safari ladder each earn their place; the contact-sheet script serves the Designer gate.

## Optional suggestions

1. **`/orders` item count.** `listOrders` reports `_count.items` (OrderItem rows). A one-bundle order with 10 items of 3 kinds shows "4 món", while checkout said 1 line and the order page says "Giỏ quà · 10 món". Count `bundleId: null` rows + distinct bundles, or leave it for the Customer gate.
2. **Cookie race between `/gift` and the cart fetcher.** Both write the whole `{l,b}`. A `/cart` response that lands after the `/gift` response drops the new id (an orphan bundle). This needs a drawer tap while the gift POST is in flight, so it is rare. A `ponytail:` line next to the action is enough.
3. **Narrow the P2003 mapping** to the bundle FK (`error.meta` names the `OrderItem_bundleId_fkey` constraint) so an unrelated FK bug still surfaces as a 500 instead of a misleading "changed".
4. **Lock the picker while `busy`.** Items tapped during the POST are wiped by the success effect. Add `!busy` to `canAdd`.
5. **Checkout copy "Kèm vỏ giỏ, nơ và thiệp".** Nothing models a bow or a card, and the spec says no card step. Don't promise them: use "Kèm vỏ giỏ" or show nothing. This is for the Customer gate.
6. **Greeting control characters.** A NUL makes Postgres reject the insert (a 500); bidi overrides (U+202A–202E, U+2066–2069) can spoof text on the admin screen. Strip C0 except `\n`, and those code points, in the `message` transform. M3's checkout text fields have the same NUL gap, so this could be a single M7 sweep instead.
7. **rembg.** Once the model is cached, rerun with `--network none`, and record the model file's sha256 next to the digest in `CREDITS.md`. That makes "offline, reproducible" literal.
8. **Live feedback for screen readers.** Make the "n/10 món" counter `aria-live="polite"` so a screen-reader user hears that the tap added something.
