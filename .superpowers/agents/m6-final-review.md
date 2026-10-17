# M6 final review (milestone gate): Hero Three.js

Reviewer: Consultant. Range: f2f00dc..45ab7b7 (shadow repo, 7 commits, 21 files, +1025/−14, of which 6 are poster binaries). Plan: `docs/superpowers/plans/2026-10-15-m6-hero.md`. Global constraints: `.superpowers/sdd/2026-10-15-m6-hero/global-constraints.md`. Rulings: `.superpowers/agents/m6-planner-rulings.md`. Ledger: `.superpowers/sdd/2026-10-15-m6-hero/progress.md`.

I did the review myself in four passes:
1. The load gate and lifecycle as one path: `hero-gate.ts` → `hero-basket.tsx` → `hero-scene.client.ts` (mount, build, render loop, context loss, dispose). I traced it against three 0.186's own `compileAsync`, `dispose` and context-loss handlers in `node_modules/three/src/renderers/WebGLRenderer.js`.
2. Data: `hero-items.ts`, `listHeroItems`, `prisma/hero-catalog.ts` + its pin test, `home.tsx` loader, and the M5 plan (`2026-10-15-m5-admin.md`, Decisions 6/10/13) for what admin will be able to change.
3. The poster pipeline: `scripts/hero-poster.ts`, `config.ts`, `public/hero/`, the `preload()`/`<picture>` markup.
4. Tests: all of `e2e/hero.spec.ts` (15 tests), the 9-row mutation table in the Task 5 report, the vitest additions, and the Lighthouse JSONs in the SDD folder (long-task attribution).

**Verification I ran myself:**
- `npx tsc --noEmit`: clean. The shadow `git status` is clean, so the tree is exactly 45ab7b7.
- **I did not run vitest or Playwright.** The UI gate is using `chosang_test` on :3200, and both suites TRUNCATE and reseed it. I rely on the Task 5/6 evidence: vitest 281, e2e 45, hero spec 15/15 with all 9 mutants red on their assertions.
- Read-only probes against :3200:
  - `GET /`: the first `<head>` link is `preload as=image type=image/avif fetchPriority=high imageSrcSet=480/800/1280 imageSizes=…560px…`. The HTML has 0 mentions of `hero-scene` and SSRs `data-hero="poster"`. The loader payload has the expected 8 cutout URLs.
  - `HEAD /hero/poster-800.avif`: 200, `image/avif`, 9250 B, `max-age=0` (Decision 3).
- Read-only SELECT: both `chosang` (dev) and `chosang_test` have 12 active, non-base cutout products. So the owner's dev DB serves the same 8 hero items the committed poster shows. The "dev DB not reseeded after M4" risk in Decision 2 did not happen.
- Lighthouse JSONs (Task 6): under simulate, `max-potential-fid` is 299 ms, and the longest task is `hero-scene.client` at about 5.15 s. Under devtools throttling the longest task is 147 ms (`hero-scene.client`, about 7.5 s) and TBT is 162 ms.

## Strengths

- **The lifecycle is correct at every exit point I could construct.**
  - Each await of the load chain is guarded: `load` (with a `signal` on the listener), `requestIdleCallback`/`setTimeout` (both cancelled on abort), the IntersectionObserver (disconnected), and `import()`, after which an abort check skips the build.
  - An unmount during the build disposes as soon as the build resolves. The first tick cannot run first, because the loop only starts from the IntersectionObserver callback, which is a later task.
  - A throw after the renderer exists disposes it and forces a context loss before the caller sees the error.
  - `dispose()` removes all 8 listeners, both observers and the loop. It frees geometry, material and map, checks `renderer.info.memory`, then calls `renderer.dispose()` + `forceContextLoss()`.
  - `onContextLost` is removed **before** `forceContextLoss()`, so a dispose never calls `onLost`.
  - I checked the one place I suspected a leak, a context loss during `compileAsync`: `renderer.dispose()` calls `properties.dispose()`, so three's 10 ms readiness poll sees `currentProgram === undefined` and resolves. No timer survives.
- **The dispose test checks contexts directly.** The e2e "rời trang chủ… nhiều lần" wraps `getContext` and asserts that every WebGL context ever created is `isContextLost()`, over 3 client-side round trips. Checking `renderer.info` alone would have stayed green without `forceContextLoss()`; mutation M6 proves the wrapper catches that.
- **Every failure falls back to the poster:**
  - no WebGL2: the chunk is never fetched;
  - `getContext` returns null, or the chunk fails to load (for example a stale tab after a redeploy changed the hash): `catch` → `console.warn` → poster;
  - context lost while live: `lost` latches, the loop can never restart (M9), and the poster fades back;
  - one sprite image fails: `allSettled` skips that item.

  No path throws into React, and "Mua ngay" sits above the canvas in every state.
- **The poster cannot silently drift from the seeded scene.** Both paths go through the pure `toHeroItems`. `hero-catalog.test.ts` pins `catalogHeroItems()` to `listHeroItems()` on a freshly seeded DB, and the script refuses to run on a catalog without cutouts. The poster can be rebuilt from the repo alone, with no DB.
- **The budget work is measured, not guessed.**
  - Named imports keep the three chunk at 133,772 B gz against a 174,080 cap.
  - `/` first-route JS is 129,124 B against 133,120.
  - The LCP strategy (React `preload()` ahead of the modulepreloads, `decoding="async"` kept) is backed by A/B tables, and LCP `/` median is 2414 ms with CLS 0.
- **Scope discipline.**
  - three appears in one file only; nothing else imports it except as a type.
  - No R3F, glb or Draco. No `--brand` in the scene.
  - `home.tsx` changed only in the hero block and the loader. The M4 gift card is intact.

## Issues

### Critical (must fix)

None.

### Important (should fix)

None. The items below are one cheap INP hardening, one fallback gap, doc corrections, and data seams that only open once M5 admin exists.

### Minor

**N1. The one-shot init long task is the only real INP exposure. A one-line split is worth landing.** (`app/components/hero-basket.tsx:51-58`)
- The simulate TBT of about 1 s does **not** threaten INP. Lantern multiplies every rotation frame, and those frames are expensive here only because SwiftShader rasterises on the CPU. On a phone with a GPU, a frame is 2–4 ms of main-thread JS (spike 9).
- The real exposure is one task once per home visit:
  - Dynamic `import()` resolves its promise at the end of the module-evaluation task, so the `.then((m) => m.mountHeroScene(...))` reaction runs as a microtask **inside the same task**.
  - Chunk evaluation (45–75 ms at CPU ×4) is therefore glued to `new WebGLRenderer` (context creation), the weave/shadow canvases and the geometry.
  - That is the 147 ms devtools task (299 ms in the Lantern estimate).
- A tap that lands in it gets up to about 150 ms of input delay before its own handler runs. On a phone slower than "desktop ×4", that tail crosses 200 ms. The window is about 1 s, after load + idle, so the risk is a tail, not systemic. It still costs nothing to halve it.
- Fix: yield one macrotask between evaluation and mount, *before* the existing abort check, so an unmount during the yield is still caught:
  `.then((m) => new Promise<typeof m>((r) => setTimeout(r, 0, m)))`
- **Gate on measurement:** one Lighthouse run with `--throttling-method=devtools` on `/`. Keep the change if the longest `hero-scene.client` task drops (expect ≈147 → ≤100 ms); revert it if not. No new test, because the abort e2e (M7 mutation) already covers the chain.

**N2. If every sprite image fails, 3D replaces a full poster with an empty basket** (`app/components/hero-scene.client.ts:316-327`).
- `allSettled` + skip is right for one bad image. With 0 sprites, though, the scene still calls `onReady`, the poster fades out, and the customer sees a bare basket instead of the poster's 8 items.
- Triggers: `uploads/` missing on a fresh deploy (the cutout `.webp` files are generated by seed, not committed), or an M5 data state where every listed cutout file is gone.
- A reasonable person expects the poster to stay.
- Fix: one line after the `forEach`: `if (!sprites.length) throw new Error("Không tải được ảnh món nào")`. `mountHeroScene`'s catch disposes the renderer and the caller keeps the poster.
- Check: copy the "không có WebGL" e2e, route `**/uploads/products/*-cutout.webp` to 404, and assert the warn plus `data-hero="poster"`.

**N3. After M5, poster and scene can drift, and the planned handoff gives the wrong remedy** (plan Task 6 Step 7, the "Chuyển sang M5" line).
- M5 Decision 13 makes "Ngừng bán" available on cutout products. `listHeroItems` filters on `visible`, so hiding one changes the item count. Every sprite angle (`i / items.length`) then moves. Meanwhile the poster (from `catalog.ts`) still shows the hidden product.
- Result: the 1 s "hold on the poster frame" trick turns into a visible jump at the crossfade. Reduced-motion, saveData and low-memory users see the hidden product indefinitely. It is decorative (`alt=""`) and tapping goes to the category, so the impact is cosmetic.
- The handoff says "poster chỉ đổi khi chạy lại `npm run hero:poster`". That is **false by design**: the script reads the repo catalog, not the DB (Decision 2), so re-running it changes nothing. The only re-alignments are "Bán lại", `demo:reset`, or editing `catalog.ts`.
- The plan's own M7 pitch checklist states this correctly; the M5 line contradicts it.
- Fix the text when writing "Kết quả M6" (fix 4). No code change for M6.

**N4. On short portrait screens (aspect > 16:9) the poster is framed tighter than the 3D frame** (`hero-basket.tsx:89-97`).
- Decision 7 says that with a fixed vertical FOV and `object-cover`, poster and scene coincide "ở mọi bề rộng". That holds only while the stage is narrower than 16:9.
- At 375×667 (and 360×640) the mobile stage is about 343×186 (aspect ≈1.84; h1 2 lines × 34.5 px). `object-cover` then crops about 3% top and bottom, while the camera shows full height plus extra width. The result is a small zoom-out at the swap.
- One-class fix if the Designer wants it: size the img by height, `h-full w-auto max-w-none left-1/2 -translate-x-1/2`, instead of `size-full object-cover`. The poster background is white like the stage, so the side bands are invisible, and it matches a fixed-vertical-FOV camera at every aspect.
- **Routed to the UI gate**, not the fix wave.

**N5. The basket keeps spinning behind the modal cart drawer.**
- The drawer is a `showModal()` `<dialog>`. The page behind it is inert but still intersects the viewport, so the IntersectionObserver keeps the loop running.
- The drawer is "chỗ thao tác nhiều nhất" (spec §2, freeship row). Every drawer interaction on `/` shares vsync with a WebGL frame.
- On a GPU phone the cost should be small, so this is a measure-first item → M7-1.

**N6. Auto-rotation has no pause mechanism for users without the OS reduced-motion setting** (WCAG 2.2.2 Pause, Stop, Hide: moving content that starts automatically and runs > 5 s next to other content).
- `aria-hidden` does not exempt it. Dragging only pauses rotation while the finger is down.
- One cheap design: stop the auto-spin after the first full revolution (≈25 s) or on the first pointer interaction. That also removes the continuous-frame source behind the Lighthouse simulate TBT (Decision 14 lever) and saves battery.
- This is the Designer's call → M7-3.

**N7. Drops (noted, no action):**
- The rattan hexes are duplicated in `gift-canvas.client.ts` (upper case) and `hero-scene.client.ts` (lower case). It is 3 constants in 2 files and the values match. Extract them only if a third user appears.
- `data-hero-disposed` is written to the production `<html>`. It is mandated by Decision 10 and exposes nothing.
- A failed single sprite leaves a gap in the ring because angles use `items.length`. This is cosmetic and rare.

## Focus areas (cross-task seams)

| Area | Finding |
|---|---|
| SPA home → other → home, repeated | Correct. Each mount gets a fresh `<canvas>` and renderer. Unmount aborts the chain at whatever await it is in, or disposes after the build. All listeners and observers are removed. Contexts are force-lost, so the ~16-context cap cannot drain. The chunk is evaluated once and stays module-cached; images are re-decoded per visit (HTTP-cached). The e2e covers 3 round trips with a context-level assert. Back → ScrollRestoration leaves the hero offscreen, so 3D waits for scroll-up (by design). Revalidation after a cart add does not rebuild the scene (`latest` ref + `[]` deps, M3 mutation). |
| Interplay with M4 `/gift` Fabric | No overlap and no shared global. Fabric 7 here is pure 2D: `gift-canvas.client.ts` has no WebGL and no filter backend. The two canvases live in different routes. On home → `/gift`, the hero's passive-effect cleanup (dispose + context loss) runs in the same commit, before `/gift`'s effect starts the Fabric import. On `/gift` → home, the hero waits for load + idle + visible anyway. The only global three sets is `window.__THREE__`. |
| Hero items after admin edits (M5) | The loader is live, so the scene follows the DB on the next load. The poster is static from the repo. M5 cannot edit `cutoutUrl` (M5 Decision 10/13), so drift comes only from "Ngừng bán"/"Bán lại" on the 12 cutout products (N3). Stale cutout URLs: uploading a new photo for a cutout product keeps the old cutout in both the hero and `/gift` (known M5 `ponytail:`). A deleted or missing cutout file → that sprite is skipped; all missing → N2. M5's `?v=` versioning goes through `uploadUrl` and affects only the no-cutout fallback branch, which handles it. |
| Error paths never break the page | Holds. Every API that can throw (`matchMedia`, `IntersectionObserver`, `import()`, the WebGL context, `img.decode`, `compileAsync` on a lost context) runs inside the promise chain or the build's try/catch. Context loss latches. Pointer handlers are inert while `live` is false (`pointer-events-none`). The one gap is cosmetic: an empty basket (N2). |
| a11y | Good baseline. The canvas is `aria-hidden` and not focusable. The poster has `alt=""` (the content lives in the h1 and the HTML category tiles right below, which are the keyboard/AT path to every category, including the ones not in the basket). Only one "Mua ngay" is exposed at a time (the other is `display:none`). The CTA is `min-h-11` and sits above the canvas. Reduced-motion → poster only, no transform. Gap: no pause for the auto-spin (N6). |
| INP for a real mid-range phone | Not threatened by the rotation. The simulate TBT is a Lantern/SwiftShader artifact. The real exposure is the one-shot init task (N1, cheap fix in M6). The drawer-over-spinning-hero case should be measured on a real device (N5 → M7-1). |
| Budgets | Three chunk 133,772 / 174,080. `/` JS 129,124 / 133,120, and M5's ≈835 B fits (≈3.2 KB left after it). Posters ≤16.3 KB / 71,680. CLS 0. LCP: see the ruling note below. |

## Ledger triage (every deferred minor)

| # | Ledger minor | Triage | Note |
|---|---|---|---|
| T1 | `readHeroEnv`/`whenVisible`/`afterLoadAndIdle` throw without `matchMedia`/IntersectionObserver | **closed** | Task 3 runs them inside `Promise.resolve().then`, so they land in `catch` and the poster stays. |
| T2 | `onLostDuringBuild` not removed on the build-error path | **drop** | It only retains the build closure (≈2 MB of CPU-side canvases) until the home page unmounts, on a path that is already rare and already shows the poster. Nothing renders, and no timer or GPU resource is held. |
| T3a | `"skip"` string sentinel | **drop** | Local, readable, one producer and one consumer. |
| T3b | Loader awaits `listHeroItems` after `Promise.all` | **M7 (conditional)** | About 1 ms on local Postgres. It is worth parallelising (split the query from `toHeroItems`) only if the M7 deploy DB is remote. |
| T4 | Poster script: no timeout on `onReady`; HOLD_MS assumption; easing | **accept** | Local developer tool. A hang is visible and the developer can Ctrl-C. |
| T5-1 | "chunk three đang tải": the 1.5 s wait starts at `release()`, not when the chunk arrives | **fix wave** | Under machine load the mutant (no abort check) can still be mid-build at 1.5 s, which is a false green. Await `page.waitForEvent("requestfinished", (r) => isThree(r.url()))` after `release()`, then wait. One line. |
| T5-2 | Poster opacity "0" assert with `{ timeout: 600 }` | **drop** | M8 already proves the assert bites. Fade timing is the UI gate's concern, and a 600 ms bound against a 400 ms transition invites flakes. |
| T5-3 | Strict `toBe(0)` rAF count | **accept** | It can only false-red, never false-green. |

## Declined to judge

- The look of the basket, sprite density, the "Mua ngay" overlay position, the sun/colour questions (Q5) and the N4 framing: the Designer+Customer UI gate owns these.
- ≥45 fps on a real Android: controller ruling Q4, the owner measures at the M7 rehearsal.
- Lighthouse simulate TBT and performance score as numbers: Decision 14 accepts them as a simulation artifact. The spec budget is INP, which I judged above.
- `public/hero/` served with `max-age=0` + ETag (one 304 on repeat visits): Decision 3 `ponytail:`.
- Firefox and low-end Android without `deviceMemory`/`saveData` get the 3D: this is the spec's own rule ("hoặc trình duyệt không hỗ trợ").
- Keyboard users cannot rotate the basket or pick sprites: the canvas is decorative, and the HTML category tiles carry the same destinations (global constraint).
- Visual crossfade quality when the poster drifts after M5 hides: cosmetic. N3 covers the data side.

## Rulings: does any look wrong?

No, with one note.
- **Task 3, the `Promise.resolve().then` wrapper:** correct. It is what closes T1.
- **Task 3 → 4, hiding the poster while live:** correct. Without it, a transparent canvas over a static poster ghosts as soon as the basket rotates. The M8 mutation pins it.
- **Task 2, the `lost` latch and the build race:** correct, and I verified the three internals the race relies on.
- **Task 4, the controller's direct try/finally:** fine. It is one line and was re-run.
- **Task 6, LCP judged on the median (2414):** the ruling holds, but the "noise" explanation only fully fits run 2 (FCP 2459). Run 3 is LCP 2575 with FCP 2310, i.e. +46 ms FCP for +160 ms LCP, which is a genuine poster tail. 2 of 5 simulate runs are over 2.5 s, and the median margin is 86 ms. Devtools-throttled LCP is 1485 ms, so field users are fine. Carry the `/` LCP tail into M7 perf (M7-2) rather than calling it noise.

## Fix wave (must land in M6)

1. **N1:** in `hero-basket.tsx`, add a macrotask yield between `import()` and the abort check + `mountHeroScene`. Land it only if one devtools-throttled Lighthouse run on `/` shows the longest `hero-scene.client` task drop below the current 147 ms; otherwise revert it and record the number.
2. **N2:** in `buildScene`, throw when `sprites.length === 0`. Add one e2e: cutout images 404 → warn + `data-hero="poster"`.
3. **T5-1:** in the "chunk three đang tải" e2e, start the fixed wait from the chunk's `requestfinished`.
4. **N3 (text, controller):** in "Kết quả M6":
   - (a) Module contract: `toHeroItems`/`HeroCategory` live in `app/lib/hero-items.ts` (not `catalog.server.ts`), and `catalogHeroItems` lives in `prisma/hero-catalog.ts`.
   - (b) Replace the "Chuyển sang M5" sentence. Re-running `hero:poster` does **not** pick up admin edits. Hiding or re-listing one of the 12 cutout products changes the live basket but not the poster. Re-align with "Bán lại" or `demo:reset`, or edit `catalog.ts` and re-run the script.

Checkpoint after the wave: `npm run typecheck && npm test`, plus `e2e/hero.spec.ts` once the UI gate has released `chosang_test` and :3200.

## Carry-overs

- **M5-1 [M5]:** "Ngừng bán" on a cutout product reshuffles the hero basket and desyncs the poster (N3). This is acceptable because the pitch flow does not hide products. The M5 confirm text for cutout products already mentions gift bundles; adding "và rổ ở trang chủ" is optional.
- **M5-2 [M5]:** a new photo upload for a cutout product keeps the old cutout in the hero **and** `/gift` (M5 Decision 13 `ponytail:`). Make sure the M5 handoff names both places.
- **M5-3 [M5]:** `/` first-route JS headroom is 3,996 B. M5 should add ≤ ~1 KB to the home route (admin code stays in `/admin/*` chunks).
- **M7-1 [M7, owner on real Android]:** at the pitch rehearsal, alongside ≥45 fps, read INP in the DevTools Performance panel (live metrics):
  - (a) tap "Mua ngay" or a category within ~2 s of the basket appearing;
  - (b) +/− in the cart drawer opened over a spinning hero (N5).

  If (b) is over 200 ms, pause the loop while a modal `<dialog>` is open. If (a) is still over 200 ms after fix 1, use Decision 14's "3D only after first interaction".
- **M7-2 [M7 perf]:** the LCP `/` tail (2/5 simulate runs over 2.5 s, median margin 86 ms). Levers: move the poster to `app/assets` (immutable), or trim the competing category images on mobile.
- **M7-3 [M7 a11y, Designer]:** a pause for the auto-spin (N6): stop after one revolution or on first interaction. This also clears the simulate-TBT artifact.
- **M7-4 [M7]:** `npm run size` needs its own 170 KB cap for `hero-scene.client-*.js`, and must count `/` first-route JS as in Task 6.
- **M7-5 [M7]:** after the promised cutout re-shoots (gạo ST25, phô mai lát, …), re-run `npm run hero:poster`. `demo:reset` must leave all 12 cutout products active so the poster and the basket match on the pitch phone.
- **M7-6 [M7, conditional]:** if the deploy DB is remote, run the hero cutout query in parallel with the categories (T3b).

## Verdict

**Ready with fixes.** There are no Critical or Important findings. The lifecycle (abort at every await, dispose to 0/0, context returned, the lost-context latch) is correct across repeated SPA navigations and is pinned by context-level e2e and 9 red-on-assertion mutations. Every failure keeps the poster, and the budgets hold with room for M5. The fix wave is three small code items (an init-task split gated on a measurement, an empty-basket guard, one test-robustness line) plus a correction to the M5 handoff text. None of them changes the architecture.
