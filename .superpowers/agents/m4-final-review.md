# M4 final review (milestone gate): Giỏ quà Fabric

Reviewer: Consultant. Range: ce614e0..17158d7 (shadow repo, 9 commits, 50 files, +2004/−102). Plan: `docs/superpowers/plans/2026-10-15-m4-gift.md`. Global constraints: `.superpowers/sdd/2026-10-15-m4-gift/global-constraints.md` (revised Decision 8 wins over the plan text). Ledger: `.superpowers/sdd/2026-10-15-m4-gift/progress.md`.

I did the review myself in four passes:
1. The gift domain and its trust boundary: `gift.ts`, `gift.server.ts`, `gift-preview.ts`, `config.ts`, the seed and the uploads regex.
2. Cart → drawer → checkout → placeOrder → order page → reorder, read as one money/stock path: `cart.ts`, `cart.server.ts`, `routes/cart.ts`, `use-cart.ts`, `cart-drawer.tsx`, `checkout.tsx`, `orders.server.ts`, `order.tsx`, `root.tsx`.
3. The `/gift` page and the Fabric module: `gift.tsx`, `gift-canvas.client.ts`, `home.tsx`.
4. The tests: every M4 unit/route test name, the M4 bodies in `orders.server.test.ts`, and the first half of `e2e/gift.spec.ts`. The interleaving e2e was already reviewed twice in Task 6, so I only spot-read it.

**Verification I ran myself:**
- `npx tsc --noEmit`: clean.
- **I did not run vitest or Playwright.** The Designer+Customer UI gate has a production server on :3200 running against `chosang_test` (PID 488065, env `DATABASE_URL=…/chosang_test`). Both suites' globalSetup TRUNCATEs and reseeds that DB, so a run would have pulled the data out from under the other gate. I rely on the Task 6/7 evidence instead: vitest 263, e2e 24, `--repeat-each=3` 33/33, and mutation checks M1–M3 that go red on their assertions.
- Read-only probes against :3200:
  - `GET /gift/preview/<real id>` → 200, `content-type: image/webp`, `cache-control: private, max-age=31536000, immutable`, `x-content-type-options: nosniff`. The body is a real WebP.
  - A well-formed but unknown id → 404. A traversal-shaped id → 404.
- Read-only SELECTs:
  - `chosang_test` holds GiftBundle rows with previews of about 25.8K characters, which matches spike 7.
  - The dev DB `chosang` has 0 GiftBundle rows, so the dev DB was not touched.

## Strengths

- **There is one money formula end to end.**
  - `/gift` shows base + Σ item prices, for display only (`gift.tsx:46`).
  - `bundleViews` re-reads base + Σ price×count from the DB (`gift.server.ts:177`).
  - The drawer, checkout and the hidden `total` all go through the same `cartTotals([...lines, ...bundles])`.
  - `insertOrder` re-snapshots every component inside the transaction with `stock: 1` and compares the result to `expectedTotalVnd`.
  - The order page sums the snapshots per bundle.
  - Bundle lines are built **server-side** from `cart.b` → DB. The client never sends a `bundleId` or a component list to `/checkout`, so a forged bundle line cannot be ordered.
  - The DoD e2e checks the same 627.000₫ on the `/gift` button, drawer CTA, checkout CTA, order page and `Order.totalVnd`, plus the stock decrement per item and for the base.
- **The stock guard is unchanged from M3 and correctly extended.**
  - `aggregateQty` merges normal lines, bundle items and the base before the id-sorted conditional `updateMany`.
  - The hidden base is still orderable because `insertOrder` filters on `isActive` only, and a test covers this.
  - The 409 message names items inside a bundle ("(có trong giỏ quà)").
  - P2003 is mapped to `changed` only for `OrderItem_bundleId_fkey`. A test proves a stale `userId` FK still throws.
- **The trust boundary on customer bytes is layered and correct.**
  - Received preview bytes pass four checks: prefix regex + ≤60K characters, then a sharp header-only read (format must equal the prefix, both sides ≤480 px, `pages ≤ 1`).
  - The bytes are re-checked (prefix + length) before serving.
  - They are served as bytes from a resource route with a fixed `image/webp|jpeg` type and `nosniff`. Cached previews stay out of every loader payload.
  - The id is 96-bit CSPRNG. The route regex is stricter than `z.cuid()`.
  - Layout is zod-bounded (≤4000 characters, ≤10 items, coordinates clamped).
  - Messages are NFC-normalised before counting and React-escaped everywhere.
- **Cart concurrency is the strongest part of the milestone.**
  - The `{remove, add}` op rides on every submit of the shared fetcher, the server applies removes before adds, and Undo is always an idempotent `add`. This kills both lost-update interleavings found in Task 3.
  - Both interleavings are pinned by e2e with mutation checks. The Task 6 fix round also closed a false-green caused by Playwright storing the cookies of aborted requests. That is a subtle catch.
- **Fabric is isolated as specified.**
  - It is loaded only through a dynamic `import()` in `gift.tsx`, and the module is `.client.ts`.
  - The server build has no fabric or jsdom, and the first-route JS is 127,189 B.
  - The `canvas` install script is denied, and an e2e asserts that no other route requests `gift-canvas`.
  - StrictMode double-effect and late image loads (`wanted`) are handled.
- **Re-seed is safe.** The seed is an upsert by slug, `update` only adds `cutoutUrl`, GiftBundles survive `npm run setup`, and product ids stay stable.

## Issues

### Critical (must fix)

None.

### Important (should fix)

None. Every money/stock path and trust boundary I traced holds. The items below are polish, one race and missing operational guards that matter only once the site is public (M7).

### Minor

**N1. The `/gift` cap counts dead bundle ids** (`app/routes/gift.tsx:25`). This is ledger T5-2; I confirm it and upgrade its priority within the fix wave.
- After a DB reset (volume wiped + `npm run setup`) or a future GC, a cookie can hold dead ids. `bundleViews` hides them, so the drawer shows N live bundles, but `/gift` refuses at 10 ids with "Giỏ hàng chỉ chứa tối đa 10 giỏ quà".
- Nothing prunes the cookie on the normal paths: `setBundles` only queries the DB when `add` is non-empty, and the drawer cannot remove a bundle it does not show. With 10 dead ids, `/gift` stays blocked until a checkout or 30 days pass.
- This is the reset-with-stale-cookies path the brief asked about. If M7 `demo:reset` rotates SESSION_SECRET (my M3 recommendation), the whole cookie dies and this disappears. It is still cheap to make it correct now.
- Fix: count only live ids before the cap, e.g. `db.giftBundle.count({ where: { id: { in: cart.b } } })`, and write the pruned `b` together with the new id.

**N2. The `/gift` POST is a second cookie writer outside the shared "cart" fetcher** (`gift.tsx:104-111`, `gift.tsx:24-28`).
- The `/gift` action reads the whole cart cookie and writes it back. A drawer edit that is still in flight when the customer taps "Thêm vào giỏ hàng" means two requests each serialise a full cart, and the last response wins. Either the drawer edit is undone, or the new bundle is lost and left as an orphan row.
- Decision 8's "every submit carries all pending state" covers only the cart fetcher. The window is the cart POST round-trip, roughly one second on slow mobile, and the drawer's 5 s Undo toast invites exactly this sequence: remove, close, tap add.
- Fix (one line): in `GiftPage`, `const cartBusy = useFetcher({ key: "cart" }).state !== "idle";` and add `cartBusy` to the submit button's `disabled`.
- The reverse order (opening the drawer manually during "Đang thêm…") is rarer. It goes to M7.

**N3. `getOrder` returns bundles in arbitrary order** (`app/lib/orders.server.ts:242`). This is ledger T4-1; I confirm it for the fix wave.
- M5 admin reuses this view, so the owner's packing list would reorder bundle blocks between loads.
- Fix: `ids` is already in item-id order, so return `ids.flatMap((id) => rows.filter((r) => r.id === id))`.

**N4. `/gift` gives screen-reader users no feedback** (`gift.tsx:151-153`).
- Tapping "Thêm Cam sành vào giỏ quà" changes nothing that is announced. The "N/10 món" counter, the list and the price on the button all update silently.
- Fix (one attribute): `aria-live="polite"` on the counter `<p>`.
- Removing a row (`gift.tsx:199-206`) also drops focus to `<body>`. Moving focus to the `#gift-in` heading, as the drawer does with its title, is an M7 a11y item.

**N5. The gift base unit "giỏ kèm nơ và thiệp" will not leave the dev DB through the seed** (`prisma/catalog.ts:94`). This is the ledger's Task 5 ruling; I confirm it and add the missing step.
- The unit is shown live on `/gift` ("Giỏ mây quà biếu (giỏ kèm nơ và thiệp)") and is snapshotted into every bundle order's `unitSnapshot`.
- Changing `catalog.ts` alone does not reach the existing row, because the seed's `update` deliberately omits `unit` (M0 ruling).
- The fix wave must reword the catalog (and `description: "…kèm nơ…"`) **and** either run a one-off targeted `UPDATE "Product" SET unit = 'giỏ' WHERE slug = 'gio-may-qua-bieu'` on dev, or record that the dev DB keeps the old text until M7 `demo:reset`. Controller's call. Do not widen the seed `update` to cover `unit`, because M5 makes `unit` admin-editable.

**N6. Bundle stock is checked per bundle, not across the cart** (`gift.server.ts:171`).
- Take two bundles that each fit the stock alone but not together, or a bundle plus a normal line of the same product. Both show as orderable, the drawer and checkout totals include both, and "Đặt hàng" returns 409 with "X (có trong giỏ quà) chỉ còn N…".
- Money and stock stay correct because the transaction catches it. The only cost is a 409 round-trip, and the customer can fix it only by removing a whole bundle.
- Carry to M7 polish. Fixing it would mean an aggregate pass in `getCartView`, which is not worth it for the demo.

**N7. Fabric's `minScaleLimit` (0.05) and unbounded scale-up drift from the stored layout.** `layout()` clamps `s` to [0.2, 5], so a shrunken or giant item's stored `s` differs from the preview. Nothing re-renders from the layout today; the preview is the source of truth. Drop. Revisit only if spec cut-lever 5 ("render the layout instead of storing the preview") is ever used.

## Focus areas (cross-task seams)

| Area | Finding |
|---|---|
| Gift price `/gift` vs drawer vs checkout vs placeOrder | Consistent. They use one formula; the server re-reads prices at each step and the transaction re-snapshots. The `/gift` price is display-only and is labelled as such in code. Weighed items: the "±10%" note appears on checkout and the order page (Decision 16); `/gift` shows plain prices, which is the Designer gate's call |
| Customer preview bytes → owner's order page | Safe. Decompression bombs, animated WebP, format/prefix mismatch, SVG and PNG are all rejected at write. Bytes are served with `nosniff` and a fixed image type. Residual: the image content is arbitrary user content (≤480 px); see Declined |
| Layout JSON | zod-bounded at write. At read it is cast (`as LayoutItem[]`) but only written by `createBundle`. `itemCount` comes from `layout.length` |
| Bundle ids in cookie | The cookie is signed and httpOnly. `bundleAdd` accepts only ids that exist in the DB (no fabrication); knowing an id lets you order someone's bundle, which is the accepted "URL is the key" model (Q2) |
| `npm run setup` re-seed | Safe. Upsert keeps bundles, prices and stock; ids are stable |
| DB reset / stale cookies | Dead ids are hidden in the drawer, skipped at checkout, and a mid-checkout deletion gives P2003 → `changed`. One gap: the `/gift` cap (N1) |
| GC / deletion semantics | `OrderItem_bundleId_fkey` is **ON DELETE SET NULL**. Any future cleanup that deletes a referenced GiftBundle silently un-groups that order's items **and loses the gift message the owner needs for the card**. The message lives only in GiftBundle, not in a snapshot. See carry-over M7-2 |
| Abuse: GiftBundle row creation | Unbounded. There is no login, no per-IP limit and no GC; each row is ≤60 KB (about 26 KB typical). `readForm` stops cross-site browsers, not scripts. 10k POSTs ≈ 0.3–0.6 GB. **Acceptable for the MVP on LAN/private demo**, and there is a `ponytail:` comment at `gift.server.ts:125`. **It must be closed before a public pitch URL (M7-1).** The same orphan rows also let anyone host arbitrary ≤480 px images on the shop origin |
| a11y basics on `/gift` | Good baseline: canvas `aria-hidden`, a non-canvas list with 44 px remove buttons, a labelled textarea with counter and hint, status and alert outside the hidden frame, an error alert with `CircleAlert`, ≥44 px targets and touch corners of 44. Gaps: no live feedback on add/remove (N4, fold) and focus loss after a row removal (M7 a11y). Keyboard users cannot move items (accepted Q4) |

## Ledger triage (every deferred minor)

| # | Ledger minor | Triage | Note |
|---|---|---|---|
| T1a | gao-st25 / pho-mai-lat cutout smudges | **UI gate / M7 content** | Visual. The Designer rules on it |
| T1b | gao-st25 cutout is a plate, not a 5 kg bag | **UI gate** | A content mismatch the customer sees on the tile. Cheapest fix: drop `cutout` from gao-st25 (11 items, still "khoảng 12") or re-shoot. Designer's call |
| T1c | CREDITS digest abbreviated | **fix wave (in passing)** | Paste the full `sha256:98e72b79…396b`. Provenance should be exact |
| T2 | Truncated JPEG accepted | **drop** | The header-only check is the design. A truncated image renders partially in the browser; there is no security effect |
| T4-1 | `getOrder` bundles unordered | **fix wave** | N3. M5 inherits it |
| T4-2 | `order.tsx` names `lines` / `any` | **fix wave (trivial)** | Rename to `withLines` / `added` while touching the reorder toast |
| T4-3 | Reorder toast "đã thêm lại" even if the bundle is then dropped | **fix wave** | Base `any` on `(await bundleViews(cart.b)).length` (or the live-id count) rather than `order.bundles.length`. That also stops the redirect to `/checkout`, which bounces to `/collections/all` and loses the toast when every bundle is dead |
| T4-4 | `stock: 1` pin test timing (300 ms sleep, fails toward a false pass) | **drop** | The mutation check went red when it was written. Local Postgres reaches the blocked `order.create` in well under 300 ms. Hardening it (polling `pg_locks`) is not worth the code |
| T5-1 | Drawer opens before the root revalidates | **fix wave** | Gate the effect on `fetcher.state === "idle"` so the drawer opens on the new "Giỏ quà · N món" row, not the old cart |
| T5-2 | `/gift` cap counts dead ids | **fix wave (priority)** | N1 |
| T5-3 | Stale server error persists after edits | **fix wave** | Clear it when `chosen`/`message` change, or show `fetcher.data.error` only while it matches the last submit |
| T5-4 | Cap test lacks status / no-Set-Cookie asserts | **fix wave** | Fold into the N1 test: a 400, no `Set-Cookie`, and no GiftBundle row created |
| T5 ruling | Base unit promises a bow and card | **fix wave** | N5. Also handle the dev-DB row and the `description` |
| T7 ruling | LCP 2.7–2.8 s on `/collections/all`, PDP, `/gift` | **M7** | Agree. `/` is within budget at 2.3 s |

## Declined to judge

- The visual and copy quality of `/gift`, the cutouts and the home card: the Designer+Customer UI gate owns these.
- LCP of `/gift`, `/collections/all` and the PDP: the controller already ruled M7.
- Keyboard users cannot move or rotate items: accepted at the plan gate (Q4), on the M7 a11y list.
- The preview URL as a bearer secret (no auth on `/gift/preview/:id`): accepted at the plan gate (Q2).
- Moderation of arbitrary customer-supplied preview content (anyone can POST any ≤480 px WebP or JPEG, and it shows on the owner's page): UGC moderation is outside the MVP spec. Rate limiting and GC (M7-1) bound the volume.
- Admin rendering of bundles: M5 scope. It reuses `getOrder` + `toOrderView` (Decision 12).
- Editing a bundle after creation: explicitly v2 in spec §2.
- The Fabric pinch gesture (Fabric 7 has none; corner controls instead): spike 4, accepted.

## Rulings: does any look wrong?

No.
- **Task 3, widening the op to `{remove, add}` on every submit:** correct, and better than the plan's single intent. The two real interleavings were found and then pinned with mutations.
- **Task 6, the delay-before-forward fix:** correct. The earlier test passed for the wrong reason.
- **Task 7, LCP to M7:** correct. `/gift` uses the same image/JS pattern as the PDP, and Fabric loads after hydration, so it is not on the LCP path.
- **Task 5, the bow/card wording:** correct, but incomplete without the DB step (N5).
- **The Q1 JPEG fallback:** correct. The header check compares format to prefix, so the fallback cannot be used to smuggle another format.

## Fix wave (must land in M4)

1. **N1 / T5-2 + T5-4:** in the `/gift` action, prune dead ids before the cap and write the pruned `b`. Extend the cap test to assert a 400, no `Set-Cookie` and no new GiftBundle row, and add a "10 dead ids → still allowed" case.
2. **N2:** disable "Thêm vào giỏ hàng" while the shared "cart" fetcher is busy (one line in `gift.tsx`).
3. **N3 / T4-1:** order `getOrder().bundles` by first item id.
4. **T4-3 + T4-2:** base the reorder toast and redirect on bundles that are actually live after `setBundles`, and rename `lines` / `any`.
5. **T5-1:** open the drawer only when `fetcher.state === "idle"`.
6. **T5-3:** clear the stale `/gift` server error after edits.
7. **N4:** `aria-live="polite"` on the "N/10 món" counter.
8. **N5 / T5 ruling:** reword the gift base `unit` and `description` (no bow or card). Either apply a one-off targeted UPDATE to the dev row or explicitly defer it to `demo:reset`. Keep the seed `update` unchanged.
9. **T1c:** put the full rembg digest in CREDITS.

Checkpoint after the wave: `npm run typecheck && npm test`, plus `e2e/gift.spec.ts` once the UI gate has released `chosang_test` and :3200.

## Carry-overs

- **M5-1 [M5]:** admin order detail reuses `getOrder` + `toOrderView`. After fix 3 the bundle blocks are stable. Show the gift **message** prominently, because it is what the packer writes on the card.
- **M5-2 [M5]:** product deactivation in admin silently drops every cart bundle that contains the product (Decision 9). That is acceptable, but the admin "Ẩn sản phẩm" confirm could say "cũng bỏ khỏi giỏ quà đang chờ của khách". Optional.
- **M5-3 [M5]:** never hard-delete a GiftBundle from admin (see M7-2).
- **M7-1 [M7, deploy-blocking if the link is public]:** a per-IP rate limit on POST `/gift` (an in-memory window like `adminFailures`, e.g. 20 per 10 min) and a total row/size guard. This replaces the `ponytail:` comment at `gift.server.ts:125`.
- **M7-2 [M7]:** GC of orphan GiftBundles: `DELETE … WHERE "createdAt" < now() - interval '30 days' AND NOT EXISTS (SELECT 1 FROM "OrderItem" WHERE "bundleId" = g.id)`. The FK is **ON DELETE SET NULL**, so deleting a referenced bundle silently un-groups the order and loses its message. Either keep the NOT EXISTS guard or change the FK to RESTRICT in a migration. `demo:reset` must also TRUNCATE GiftBundle with the orders.
- **M7-3 [M7]:** `demo:reset` should rotate SESSION_SECRET (M3 recommendation). It also wipes stale `b` cookies, so N1 becomes moot on the pitch phone.
- **M7-4 [M7 polish]:** aggregate stock across bundles and normal lines in the cart view (N6), so the drawer shows the conflict before the 409.
- **M7-5 [M7 a11y]:** after removing a row on `/gift`, move focus to the "Trong giỏ quà" heading. Keyboard users cannot move items (Q4).
- **M7-6 [M7]:** the reverse N2 race (drawer edit while the `/gift` POST is in flight). Disable the drawer's mutating controls while the gift submit is busy, or have `/gift` route through the cart op.
- **M7-7 [M7 perf]:** LCP of `/gift` (2.7 s), `/collections/all` (2.8 s) and the PDP (2.7 s) (controller ruling).

## Verdict

**Ready with fixes.** There are no Critical or Important findings. Money and stock are correct end to end, the customer-bytes boundary is sound, and the cart concurrency model is the best-tested part of the codebase. The fix wave is nine small items: the queued ledger minors, plus the `/gift` dead-id cap given priority, a one-line cart-busy guard and a live counter. None of them changes the architecture. The public-abuse guards (rate limit + GC with the SET NULL caveat) must land before any public pitch URL (M7-1/M7-2).
