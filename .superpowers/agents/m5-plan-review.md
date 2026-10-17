# M5 Admin: plan gate review (Consultant)

Plan: `docs/superpowers/plans/2026-10-15-m5-admin.md`, read in full (2,848 lines). I checked it against:
- spec §1 (pitch), §2 (Auth, Hàng cân ký), §3 Admin + "Nếu kịp", §4, §5 (Product/Order/GiftBundle, `/admin/*` route map, image sizes, budgets) and §6 M5;
- the roadmap module contract and every "Chuyển sang M5" (Kết quả M0, M1, M3, M4), `m3-final-review.md` §M5 1–3 + T4a, `m4-final-review.md` M5-1..3, and `m5-planner-rulings.md`;
- the M4 gate precedent (`m4-plan-review.md`);
- the real post-M4 code the patches touch: `orders.server.ts`, `session.server.ts`, `security.server.ts` (`readForm`), `auth.server.ts`, `login.tsx`, `checkout-pay.tsx`, `images.server.ts`, `image-urls.ts`, `uploads.ts`, `root.tsx`, `site-header.tsx`, `order.tsx`, `seed.ts`, `schema.prisma`, `prisma/test-db.ts`, `e2e/helpers.ts`;
- the M6 plan (`2026-10-15-m6-hero.md`, the 12:41 version on disk, before its re-sync) for file overlap.

## What I ran myself

Everything ran in `scratchpad/m5-gate/` against my own DB `chosang_m5gate`, which I dropped at the end. I never touched `chosang` or `chosang_test`, and I wrote nothing into the project except this file.

**Patches and new files**
- I extracted all 19 ```diff blocks plus the 12 new files, and appended the `config.ts` lines.
- Every patch passes `patch -p1 --dry-run` against a copy of the real post-M4 tree and applies with no offset or fuzz.
- The migration came out of `migrate diff` as exactly one line, `ALTER TABLE "Product" ALTER COLUMN "images" SET DEFAULT ARRAY[]::TEXT[];`. After `deploy`, `diff --exit-code` returns 0.

**Typecheck and tests**
- Typecheck is clean. Vitest gives **328/328**, and the per-file counts match the plan: images 6, image-urls 3, uploads 2, auth 16, admin-orders 10, products 32, admin-products 7.
- Playwright gives **33/33** on the production build.
- I reran two of the plan's mutation checks, and both go red as claimed:
  - dropping the `paymentStatus` guard on the COD switch;
  - reading the body before `requireAdmin`.

**Production build (curl and Playwright)**
- JS route đầu `/` = **128,042 B** gzip, the same as the plan.
- No sharp or zod in the client build. `/uploads` sends `nosniff`.
- A customer cookie on GET `/admin/orders.data` and on multipart POST `/admin/products/new.data` gets a 403 `ErrorResponse`, and nothing is created. A guest POST is redirected to `/login`.
- **A guest opens `/admin`, logs in as admin, and lands on `/admin` with an empty `<main>`** (admin header and tabs, no h1). This is a real bug (change 1). With the one-line fix I rebuilt and reran: the same flow lands on `/admin/orders`, "Đơn hàng".

**sharp 0.35.5**
- The plan's `base` buffer (`.toBuffer()` with no format) comes out as **JPEG q80**. Every JPEG upload therefore goes through a lossy intermediate.
- A **2.3 KB PNG of 10×30000 px** (0.3 MP, so it passes every `checkImage` check) made the plan's `saveSquareImage` run for **>120 s at 8.7 GB RSS** before `timeout` killed it. `fit: cover` upscales it to 1080 × 3.24 M px *before* the attention crop.
- With the crop done at native resolution first and a raw intermediate (change 3), the same file takes 385 ms. A 5 MB photo takes 5.9 s, and 4-channel PNGs keep alpha.

## Verdict: APPROVE WITH CHANGES

The plan is strong and was prototyped end to end. The money and stock core is right, and it reuses M3/M4 instead of forking them:
- **Status changes.** Every status change is one `updateMany` keyed on the status the admin saw, and the target is always `NEXT_STATUS[from]`. No back-jumps, no skipped steps, and each `*_at` column is written once.
- **Cancel.** It reuses `cancelOrder` with a `from` parameter, so the restock-once transaction is the same code the customer path already proves.
- **COD switch.** It cannot erase a payment. I ran its mutation check, and the test goes red.
- **Gate.** Middleware is backed by a `requireAdmin` call in every loader and action, before `readForm`. The proof is a body stream that is never pulled, and I confirmed it over HTTP on `.data` URLs.
- **Image checks.** They run in the right order: size, then magic bytes, then `metadata()` under a pixel limit. The slug is enforced in zod **and** inside `saveSquareImage`, and no files are written until all six variants encode.
- **Hard deletes.** GiftBundle is never hard-deleted. The only `product.delete` removes a row created a moment earlier in the same request.

Four required fixes are real defects or plan errors I reproduced, and a fifth is a one-constant fix for a likely owner failure. Each is a few lines plus a test, so the plan goes to execution without coming back to this gate.

### Spec and carry-over coverage

| Requirement | Task | Status |
|---|---|---|
| Order list changes status on the row, writes `*_at`, groups items by gift bundle (§3, §6) | 2, 3 | OK |
| CRUD products + sharp upload, 320/640/1080 × AVIF+WebP (§3, §5) | 1, 4, 5 | OK. Upscale bomb and lossy intermediate: **change 3**. Cache-busting order: **change 2** |
| `/admin/*` layout + middleware `requireAdmin` (§5) | 3 | OK. `/admin` after login: **change 1** |
| DoD: admin changes status → customer timeline updates | 2, 6 | OK. Proven by e2e (separate admin context, customer tab revalidates on `visibilitychange`, mutation-checked) plus a unit test reading `toOrderView().timeline` |
| DoD: 5 MB upload → 6 variants | 1, 4, 6 | OK. Unit test (6 files, square, formats) and e2e (6 files read by sharp; the shop page renders the new `?v=` URL with `naturalWidth > 0`) |
| DoD: non-image rejected | 4, 5, 6 | OK (text, SVG, HTML, PDF, >cap, 16000² bomb; route 400; e2e) |
| DoD: `/admin` blocks customers | 3, 5, 6 | OK (`expectAdminOnly` on every loader and action; e2e 403 page and raw POST 403; HTTP probe) |
| M0: `images @default([])` by a non-destructive migration; slug-validate the name; keep key `products/<slug>`; test all 6 variants | 1, 4 | OK (verified migration SQL) |
| M1: `?v=` cache-busting; zod `compareAt > price` | 1, 4 | OK. Ordering bug: **change 2** |
| M3: `requireAdmin` + `readForm` in every action, separate upload cap | 3, 5 | OK (Task 7 grep) |
| M3: conditional status change, `*_at` in order | 2 | OK |
| M3: admin cancel preparing/shipping with restock + refund label | 2 | OK (Decision 4) |
| M3: unpaid online order → block or COD | 2 | OK (Decision 3: COD, race-proof) |
| M3: soft delete | 4, 5 | OK |
| M3: `paymentFailed = awaitingPayment && failed` | 2 | OK |
| M3 T4a: reset admin lockout between tests | 2 | OK |
| M4: pack from `bundles[].items`; preview ≥240 px, lazy, fixed size, tap to open; message prominent | 3 | OK (Decision 20) |
| M4: never hard-delete GiftBundle | 7 | OK (grep) |
| M4 F4: gift-base `unit`/`description` vs seed | 1 | OK (Decision 24; old string matches M0 catalog verbatim) |
| M4 optional: deactivation confirm mentions gift bundles | 5 | OK |
| M2: re-measure first-route JS | 7 | OK. Baseline after M6: **change 4** |

## Required changes

1. **`/admin` after login renders an empty admin shell** (Task 3 `admin.tsx` loader, plus tests). This is reproduced on the production build.

   **Why it happens:**
   - The layout loader redirects only when `pathname === "/admin"`. RR 8 passes `.data` URLs through (spike 3), so a client-side navigation to `/admin` arrives as `/admin.data` and returns 200 with no child route.
   - The most natural owner path is exactly this. The owner types `/admin` while logged out, the middleware sends them to `/login?redirectTo=%2Fadmin`, they enter the passcode, and the login action redirects client-side to `/admin`. The result is a header, two tabs and a blank page in the pitch.

   **Fix (verified):**
   ```ts
   if (new URL(request.url).pathname.replace(/(\.data|\/+)$/, "") === "/admin") throw redirect("/admin/orders");
   ```

   **Tests:**
   - In `admin-orders.test.ts` "/admin chuyển tới /admin/orders", add that `call(layout.loader, get("/admin.data", ADMIN))` returns 302 with `Location: /admin/orders`.
   - Change e2e `loginAdmin` to start the real way: `page.goto("/admin")`, expect `/login?redirectTo=%2Fadmin`, log in, then expect `/admin\/orders$`. Test counts stay the same.
   - **Mutation check:** drop `\.data|` and the e2e goes red.
   - Add this case to Review Focus (it outranks item 2 on likelihood).

2. **Replacing an image can cache the *old* photo under the *new* `?v=` URL for 7 days** (Task 4 `updateProduct`, Decision 11).

   **Why it happens:**
   - The plan writes `images[0] = products/<slug>?v=NEW` **before** `saveSquareImage`, and encoding takes 2–6 s (AVIF).
   - Any shop page rendered in that window emits `…-640.webp?v=NEW`. `/uploads` reads the file on disk, which is still the old photo, and serves it as `public, max-age=604800`.
   - That breaks exactly what Decision 6 exists to guarantee.

   **Fix:** split `updateProduct`:
   ```ts
   const { count } = await db.product.updateMany({ where: { id, stock: stockWas }, data: fieldsData(data) }); // no images here
   if (count === 0) { …409 as now… }
   if (image) {
     try { await saveSquareImage(image, OUT_DIR(), current.slug); } catch { return { ok: false, errors: { image: [IMAGE_BROKEN] } }; }
     await db.product.update({ where: { id }, data: { images: [versioned(current.slug), ...current.images.slice(1)] } }); // URL changes only after the bytes are on disk
   }
   ```
   With this order, a broken image leaves the old URL, which still points at the intact old files. Update the Decision 11 wording to match.

   **Test:** in the "sửa:" test, call `updateProduct(id, <current stock>, fields(), PHOTO_5MB.subarray(0, 200_000))`. It must return `{ ok: false, errors: { image: ["Ảnh bị hỏng, không đọc được."] } }` and leave `images[0]` **unchanged**.

   **Mutation check:** move the version bump back before `saveSquareImage` and the test goes red.

3. **`saveSquareImage`: crop at native resolution before upscaling, with a raw intermediate** (Task 1 `images.server.ts`, plus a test; this also resolves the lossy intermediate).

   **Why it happens:**
   - `resize(1080, 1080, { fit: "cover", position: attention })` upscales the short side to 1080 first. A thin image (10×30000, 2.3 KB) becomes 1080 × 3.24 M px, and that ran for >120 s at 8.7 GB RSS in my test.
   - `limitInputPixels` cannot see this, because the input is only 0.3 MP. The admin is trusted, but this is the shared hardening point for every caller.
   - Separately, `.toBuffer()` with no format re-encodes the base as JPEG q80 for JPEG inputs, so every variant is a second-generation lossy copy. The 5.8 s → 3.9 s "decode once" gain in spike 7 comes from that lossy intermediate (it smooths the noise image), not from decoding once.

   **Fix** (verified: 10×30000 in 385 ms; a 5 MB photo in 5.9 s, close to the original 5.8 s, so the speed claim goes away; RGBA keeps alpha; output for a given base is byte-identical to a direct encode):
   ```ts
   const { width = 0, height = 0 } = await sharp(input, { limitInputPixels: MAX_INPUT_PIXELS }).metadata();
   const side = Math.min(width, height); // the short side does not change under EXIF rotation
   const sq = await sharp(input, { limitInputPixels: MAX_INPUT_PIXELS })
     .rotate()
     .resize(side, side, { fit: "cover", position: sharp.strategy.attention }) // crop at native resolution: never upscales before the crop
     .raw()
     .toBuffer({ resolveWithObject: true });
   const base = await sharp(sq.data, { raw: sq.info }).resize(1080, 1080).raw().toBuffer({ resolveWithObject: true });
   // variants: sharp(base.data, { raw: base.info }).resize(w, w).toFormat(...)
   ```
   - Keep the name guard first and the encode-all-then-write order.
   - Correct Decision 7 and spike 7: the claim becomes "a raw intermediate, never upscaled before the crop".

   **Test** (`images.server.test.ts`): a 10×30000 PNG writes all 6 variants at the right sizes in under 5 s (`expect(Date.now() - t).toBeLessThan(5000)`).
   - **Do not** run the old pipeline on this input as a mutation check: it takes 8.7 GB and can OOM the machine.
   - Add one line to Task 7 Step 4 "Ảnh": "thin or long images do not upscale before the crop".
   - Update the counts (+1).

4. **Baselines assume M4, but M6 runs first** (every Checkpoint, Task 6 Step 3, Task 7 Steps 1 and 4).
   - The fixed numbers (269 / 279 / 289 / 321 / 328, e2e 33 = 30 + 3) will all be wrong after M6, which adds vitest and e2e tests of its own (the old M6 plan: +13 / +13).
   - **Fix:** in Task 1 Step 0, record `BASE_V` and `BASE_E` (the vitest and Playwright totals on the real tree before M5). Write every Expected as a delta: Task 1 `BASE_V+3` (+4 with change 3), Task 2 `+10`, Task 3 `+10`, Task 4 `+32`, Task 5 `+7`, Task 6 e2e `BASE_E+3`.
   - Task 7 Step 4: "danh sách gói đúng bằng sau **M6**" (M6 adds `three` and `@types/three`), not "sau M4".
   - The JS line is already written relative to M6. Keep it: my measurement of 128,042 pre-M6 confirms the +835 B delta.

5. **Raise the upload cap to 10 MB** (Decision 8; `config.ts`, `products.server.ts`, `admin-product.tsx`, tests).

   **Why:**
   - The roadmap says `trung-vit` must have a real photo, and the cheapest path is the owner's phone. That is exactly the flow this admin enables.
   - A 24 MP iPhone or a 50 MP-mode Android photo, converted to JPEG on upload, is commonly 5–10 MB. At 5 MB the owner is told to "chọn ảnh nhỏ hơn" and has no way to do that on the phone.
   - The DoD tests that a 5 MB image works. It does not set the cap.
   - Decode stays bounded by `MAX_INPUT_PIXELS`, and a 10 MB body in RAM is fine for one admin.

   **Fix:**
   - Constants: `MAX_IMAGE_BYTES = 10 * 1024 * 1024`, `PRODUCT_FORM_BYTES = 11 * 1024 * 1024`.
   - Messages and hint "tối đa 10MB" (`checkImage`, `TOO_BIG`, `f-image-hint`).
   - Tests: the e2e client-side block uses `Buffer.alloc(10.5 * 1024 * 1024)`, and the route 413 test uses an 11.5 MB `File`. The DoD tests stay at about 5 MB.
   - Add "ảnh điện thoại 5–10 MB" to the parenthetical under Review Focus.
   - Update the `ponytail:` RAM note.

## Rulings

### Decisions

| # | Ruling | Note |
|---|---|---|
| D1 two-layer gate | **Approve** | Spike 1 shows why the layout loader alone fails. Proven by the unpulled-stream test and over HTTP |
| D2 one-step button, `from` only | **Approve** | Server-derived target; a stale request returns 200 so the list revalidates |
| D3 unpaid online → COD on "Soạn hàng" | **Approve** | It cannot erase a payment (the `paymentStatus IN` guard; mutation-checked). It unblocks the pitch's failed-payment branch, with an explicit confirm |
| D4 admin cancel pending/preparing/shipping, labels derived | **Approve** | No enum or column; restock goes through the proven transaction |
| D5 `/admin/orders/:code`, `products/:id` + `new` | **Approve** | Record it in spec §5 (Task 7 already lists it) |
| D6 `?v=` in key, `nosniff` | **Approve**, amended by change 2 | |
| D7 hardened `saveSquareImage` | **Approve**, amended by change 3 | Name guard + pixel limit + write-after-encode are right. The single-pipeline cover resize and lossy base are not |
| D8 upload via `readForm`, client pre-check | **Approve**, amended by change 5 | No new dependency; `Response.formData()` is enough |
| D9 JPEG/PNG/WebP, magic bytes before sharp | **Approve** | SVG never reaches sharp; only re-encoded variants are served |
| D10 zod whitelist, slug rules | **Approve** | The `-cutout` refusal is stricter than needed (the cut-out file `<slug>-cutout.webp` cannot collide with `N-<w>.<fmt>`), but it is harmless and makes the rule easy to read |
| D11 DB first, then image | **Approve for create**; **amended by change 2 for update** | |
| D12 conditional stock edit (`stockWas`, 409 + revalidate) | **Approve** | |
| D13 "Xoá" = deactivate; none for the gift base | **Approve** | See optional 2 for the server-side mirror |
| D14 separate admin chrome; header link for the admin | **Approve** | Same-browser pitch flow works: login keeps `guestOrderCodes`, so the customer tab still sees the order |
| D15 403 at root boundary | **Approve** | |
| D16 strip `.data`/`_routes` from `redirectTo` | **Approve**. Change 1 is the same bug class in the layout loader | |
| D17 ink status buttons | Designer (controller ruling stands) | |
| D18 revalidate on `visibilitychange`/`focus` | **Approve** | No polling. The e2e mutation proves the listener is load-bearing |
| D19 two filters, 100 rows | **Approve** | |
| D20 packer block, own markup | **Approve** (see Q1) | |
| D21 no "Nếu kịp" 4 | **Approve** (controller ruling stands) | |
| D22 `resetAdminLockout` | **Approve** | A test-only export with no route caller |
| D23 migration | **Approve** | Verified: one `SET DEFAULT`, nullability unchanged |
| D24 seed rewrites the gift-base wording only while the old string is present | **Approve** | The string matches the M0 catalog verbatim (`m0-foundation.md:869`). Seed keeps `?v=` keys |

### Open questions

| Q | Ruling | Reason |
|---|---|---|
| Q1 shared bundle component vs own markup | **Own markup now; extract in M7 only if the customer-side enlarged preview is built** | The packer and the customer need different emphasis (bold quantity and a large message vs per-line price). The data (`toOrderView().bundles`) is already the shared contract. Extracting ~30 lines for one future consumer is speculative |
| Q2 Decision 24 on the dev DB | **Approve as written. No agent action on `chosang`** | The old wording leaves on the owner's next `npm run setup`, and an admin edit made before that is respected. That is the intended order |

### M6 overlap (spot-check of the planner's claim)

The claim "only `app/lib/config.ts` is shared, append-only" **holds for patched code**. M6 creates its own files and modifies `package.json`, `config.ts`, `catalog.server.ts`, `home.tsx` and `image-urls.ts` (only if `cutoutSrc` is missing, which it is not after M4). M5 patches none of `catalog.server.ts`, `home.tsx` or `package.json`. M6 consumes `uploadUrl`, and M5's `?v=`-aware version is backward compatible. M6 does not touch `root.tsx`, `site-header.tsx` or `e2e/helpers.ts`.

The claim **does not hold** for the plan's *expectations*: the test baselines and the package list (change 4).

The M6 plan on disk is the pre-re-sync version. The plan's "dry-run fails → NEEDS_CONTEXT" rule covers any drift.

JS headroom is fine: M4's 127,207, plus M6's ~1.9 KB (from its spike), plus M5's 835 B, comes to about 129.9 KB, under the 133,120 cap. That leaves about 3 KB for M7.

### Review Focus

The five items are real and each has a test, but the ranking misses the two likeliest owner failures: opening `/admin` (change 1) and a phone photo over 5 MB (change 5). Item 2 (a payment landing in the same instant as the click) is rare, but it is money, so keep it.

### Checked and found OK (no action)

- **Races.**
  - Customer cancel vs admin advance or cancel: one `updateMany` wins under READ COMMITTED re-check, and the loser gets count 0, so there is no second restock.
  - Advance vs advance: `["advanced", "stale"]`.
  - Pay vs COD switch: the second statement requires `paymentStatus IN (unpaid, failed)`.
  - `setOnlinePayment` requires `pending` + `online_mock`, so the mock gateway closes after a switch.
- **Timestamps.** Each step writes only its own column, behind the previous status, so `preparingAt ≤ shippingAt ≤ doneAt` by construction. `doneAt` is never overwritten (tested).
- **CSRF.**
  - `readForm` checks Origin and Sec-Fetch-Site on every admin POST, and RR 8.4 rejects cross-origin POSTs to UI routes.
  - The cookie is SameSite=Lax, so cross-site POSTs carry no session at all.
  - No admin GET mutates.
- **Lockout.** No change. Correct passcode clears the counter. `loginAdmin` and the auth e2e share one server process and still pass 33/33.
- **Mass assignment and IDOR.** Explicit zod keys, `data` built field by field, no `userId` from forms. `isGiftBase` posted with the form is ignored (route test).
- **Path traversal.** `IMAGE_NAME` in zod and in the shared function, the `/uploads` regex is unchanged, and `?v=` lives only in the query.
- **Soft delete.** The one `product.delete` targets a row this request just created; GiftBundle is never deleted.
- **Test-DB safety.** Step 0 and Step 5 compare the dev DB counts. Test uploads use the prefixes `m5-test-`, `m5-route-`, `e2e-` and are cleaned (0 left in my run). No `migrate reset` or `down -v`.
- **Over-engineering.** None of note. `expectAdminOnly` replaces about 10 copies of the gate assertions, and every file maps to a spec line or a carry-over.

## Optional suggestions

1. **Create inactive, then activate.** `createProduct` could insert `isActive: false` and flip it on after the images are written. The new product would then never appear in the shop with 404 images during the 2–6 s encode. Nobody could add it to a cart before the "ảnh hỏng" delete, so that delete could never hit an `OrderItem` FK (P2003 → 500).
2. **Server-side mirror of Decision 13.** Use `setProductActive` with `where: { id, isGiftBase: false }`. One token, and a stray POST can no longer empty every customer's gift bundles.
3. **Stale-click wording.** "Đơn vừa được cập nhật ở nơi khác" also shows after the owner's own double-tap. "Đơn vừa được cập nhật (có thể bạn vừa bấm hai lần hoặc máy khác vừa đổi)." is clearer.
4. **Admin list freshness.** Reuse the same `visibilitychange`/`focus` revalidate on `/admin/orders`. The owner comes back from a phone call and sees new orders without F5.
5. **Atomic variant writes.** Write to a temporary file and `rename()` in `saveSquareImage` (a `ponytail:` note is fine). A request that races a rewrite then never reads a half-written file.
6. **Customer overtaken by the COD switch.** They press "Thanh toán" and land on the order page with no toast. Flash "Đơn đã được chuyển sang trả tiền mặt khi nhận hàng." when `setOnlinePayment` returns false and the order is now COD. Or leave it for the Customer gate.
