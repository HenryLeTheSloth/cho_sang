# M6 Hero Three.js: plan gate review (Consultant)

Plan: `docs/superpowers/plans/2026-10-15-m6-hero.md`, read in full (1,482 lines). I checked it against:
- spec §2 ("Phạm vi Three.js", "Model 3D"), §3 Home, §4 (Motion, reduced-motion), §5 budgets (JS first route ≤130 KB gz, chunk 3D ≤170 KB + load conditions, LCP <2.5 s with poster AVIF ≤70 KB `fetchpriority=high`, CLS/INP), §6 M6 row + DoD;
- the roadmap module contract, spike 7, every "Chuyển sang M6" (Kết quả M1: poster becomes LCP, decide with fonts; Kết quả M4: rattan colours `#B9874B`/`#8A5F2E`/`#D9AE73`), the M2 font decision;
- `.superpowers/agents/m6-planner-rulings.md` (Q1 LCP median-of-5 ≤2.5 s and ≤ text +0.3 s, Q2 `@types/three`, Q4 Android owner check, Q5 → Designer);
- the M5 plan where it touches the same files (`config.ts`, `image-urls.ts`, JS budget);
- the real code: `home.tsx` (post-M4, with the `Gift` card), `catalog.server.ts` + test, `config.ts`, `image-urls.ts` (`cutoutSrc`), `env.server.ts`, `prisma/test-db.ts`, `playwright.config.ts`, `e2e/helpers.ts`, `package.json`.

## What I ran myself (scratchpad `m6-gate/`, own DB `chosang_m6gate` (dropped), port 3700)

- **Dry-run.** I extracted every code block and exact replacement from the plan with a script and applied them to a fresh copy of the real tree. All 11 `old` strings (3 in `catalog.server.ts`, 1 in the test, 5 in `home.tsx`, 1 in `package.json`, plus the file creations) match **exactly once**. `npm run typecheck` is clean.
- **Counts.** Vitest **279/279** (266 + 10 + 3). Playwright `hero.spec.ts` **13/13**, full suite **43 + my 2 = 45/45**. The arithmetic in the plan is right (E₀ = 30 confirmed by `grep -c '^test('`).
- **Budgets.** Three chunk **133,595 B gz** (only `hero-scene.client-*.js` contains `WebGLRenderer`; the server build only has the 0.11 KB `.client` stub). JS first route `/` **129,054 B** (plan: 129,056). With M5's +835 that is ≈129,889, under 133,120. SSR HTML has 0 mentions of `hero-scene`. The `<link rel="preload" as="image" type="image/avif" fetchPriority="high" imageSrcSet=… imageSizes=…>` is the **first** element after the viewport meta in `<head>`.
- **Poster.** `scripts/hero-poster.ts` runs in about 7 s. Output AVIF 480/800/1280 = 4,657/9,279/16,440 B (cap 71,680). I ran it 3 times: the bytes differ, but the mean absolute pixel difference is 0.37/255 (2 of 3.7 M channels are more than 32 off). That is reproducible for our purposes. I checked the PNG by eye: rattan basket, 8 cut-outs, no magenta.
- **Vitals (Playwright, no throttling).** At 375×812@2, 412×823@1.75 and 1280×800@1:
  - the LCP element is `poster-800.avif` in all three, fetched by **one** request;
  - CLS is 0.00001–0.0001 across the canvas swap-in;
  - the longest task is 113–146 ms;
  - the stage is 328×248, 365×289 and 544×352 (all narrower than 16:9, so `object-cover` crop = camera crop, Decision 7 holds).
- **Mutation checks (I re-ran the ones that matter for "not fetched").**
  - Removing the `shouldLoadHero` gate turns reduced-motion, saveData and deviceMemory **red** (they assert on the *request*, not on rendering).
  - Replacing `afterLoadAndIdle` with `Promise.resolve()` turns "máy thường" **red**.
- **Defect found (change 1).** I delayed the chunk response, then clicked "Mua ngay" while it was in flight. The plan's chain still runs `mountHeroScene` on the **detached** canvas on the next page: a WebGL context, 8 image decodes, shader compile and texture uploads, then an immediate dispose. My test went red (`data-hero-disposed="0,0"` appeared on `/collections/all`). The one-line guard below turns it green (3/3 repeats).
- **Test gap found (change 2).** Removing `renderer.forceContextLoss()` leaves every planned test green. My `isContextLost()` assertion turns red under that mutation and green with the code as planned.

## Verdict: APPROVE WITH CHANGES

This is a well-prototyped plan, and I verified it end to end:
- Three is isolated to one named-import module, and only that chunk contains it.
- The loading gate is a pure function and is tested both as a unit and at the network level.
- The poster really is generated from the built scene, and it is the LCP element with no CLS.
- The render loop stops when the hero is off-screen or the tab is hidden.
- Dispose reaches 0/0.
- The revalidation trap (D11) and the Safari rIC fallback are both pinned by tests.

All the budgets have headroom, including the shared ≤133,120 B after M5. The review found one real wasted-work bug on the most likely slow-network path, one test that cannot fail for the defect Review Focus 4 claims it guards, an inaccurate alt text, and a poster script that can silently bake the wrong art. Each fix is a few lines. With them, the plan goes to execution without coming back to this gate.

### Spec and carry-over coverage

| Requirement | Task | Status |
|---|---|---|
| Lathe basket + CanvasTexture + Sprites, no glb/Draco/R3F (§2) | 2, 6 grep | OK |
| Only 1 hero, ≤45vh mobile, search + HTML categories right below (§2) | 3, 5 e2e | OK (365/300 px measured by the planner; my run: stage 248 px inside the section) |
| Poster is the LCP, 3D overlays later (§3) | 3, 4 | OK (verified LCP element). Alt: **change 3** |
| DPR ≤1.5, stop off-screen/hidden, dispose on unmount (§4) | 2, 5 | OK. Context release untested: **change 2** |
| Reduced-motion → poster only (§4) | 1, 5 | OK (request-level, mutation-verified) |
| Chunk ≤170 KB; load after `load`+idle, !saveData, deviceMemory ≥4/absent, !reduced-motion, in viewport (§5) | 1, 3, 5 | OK (133,595 B; all five gates are e2e'd at the request level) |
| JS first route ≤130 KB (§5) | 3, 6 | OK (129,054 B; +M5 ≈129,889) |
| LCP <2.5 s, poster AVIF ≤70 KB `fetchpriority=high` (§5) | 6 | OK under the Q1 ruling (median of 5). AVIF 9.3 KB |
| INP <200 ms (§5) | D12/D14, 6 | OK as a proxy (longest task 113–195 ms). Leave-while-loading: **change 1** |
| DoD: reduced-motion/saveData do not load three | 5 | OK |
| DoD: Android ≥45 fps | 6 proxy, M7 owner | OK (ruling Q4) |
| Roadmap spike 7 (named import, dynamic `import()`) | 2, 3 | OK |
| Kết quả M1 (poster becomes LCP; decide together with fonts) | D1, 6 | OK |
| Kết quả M4 (rattan colours) | D5, 2 | OK (hex values match `gift-canvas.client.ts`) |
| Ruling: run `hero:poster` after M4 seeds | 4 | OK, but the dev DB state is unguarded: **change 4** |
| Lucide only, canvas `aria-hidden`, CTA `min-h-11`, Vietnamese copy | 3 | OK |

## Required changes

1. **Do not build the scene after the user has left** (Task 3 `hero-basket.tsx`, plus an e2e test). `AbortSignal` only stops `afterLoadAndIdle`/`whenVisible`. Once `import()` has started, the chain still calls `mountHeroScene` on the unmounted canvas.

   This is the most likely real-world path: on the pitch's Slow 4G the 133 KB chunk takes 1–2 s, and the customer taps "Mua ngay" or a category in that window. The next page then pays for a WebGL context, 8 image decodes, shader compile and texture uploads (the plan's own long task is 159–195 ms at CPU ×4), right when the customer is tapping on it. That is an INP hit on a page M6 does not own. Verified red, then green with the fix.
   - **Fix** (replace the two `.then` steps after `import()`):
     ```tsx
           .then((m) => {
             if (ac.signal.aborted) return; // rời trang lúc chunk đang tải: không dựng cảnh trên canvas đã gỡ
             return m.mountHeroScene(canvas, latest.current.items, {
               onReady: () => !ac.signal.aborted && setLive(true),
               onPick: (href) => latest.current.navigate(href),
               onLost: () => setLive(false),
             });
           })
           .then((handle) => {
             if (!handle) return;
             dispose = () => {
     ```
     The rest is unchanged. Keep `if (ac.signal.aborted) dispose();`, which still covers leaving *during* `mountHeroScene`.
   - **Test** (add to `e2e/hero.spec.ts`; I ran it, 3/3 stable):
     ```ts
     test("rời trang trong lúc chunk three đang tải: không dựng cảnh trên canvas đã gỡ", async ({ page }) => {
       let release!: () => void;
       const gate = new Promise<void>((r) => (release = r));
       let requested = false;
       await page.route((u) => isThree(u.href), async (route) => {
         requested = true;
         await gate;
         await route.continue();
       });
       await page.goto("/");
       await expect.poll(() => requested).toBe(true);
       await page.getByRole("link", { name: "Mua ngay" }).click();
       await expect(page).toHaveURL(/\/collections\/all$/);
       release();
       await page.waitForTimeout(1500);
       await expect(page.locator("html")).not.toHaveAttribute("data-hero-disposed", /.*/); // cảnh chưa từng được dựng
     });
     ```
     (`page.route` with a predicate receives a `URL`, hence `u.href`; passing `isThree` directly fails `tsc`.)
   - **Mutation row** (Task 5 Step 3): delete the line `if (ac.signal.aborted) return;` → `-g "chunk three đang tải"` must go red.
   - **Review Focus**: add item 6, "Khách bấm 'Mua ngay'/danh mục khi chunk three còn đang tải (4G chậm) → trang sau không phải gánh việc dựng cảnh 3D", with this test.

2. **Prove the WebGL context is released, not only the counters** (Task 5, the "rời trang chủ rồi quay lại nhiều lần" test). Review Focus 4 promises "không cạn ~16 context WebGL", but `renderer.info.memory` = 0/0 says nothing about the context, and 3 rounds never get near 16. Deleting `renderer.forceContextLoss()` passes every planned test; I verified that it turns red with this assertion.
   - Add at the top of that test:
     ```ts
     await page.addInitScript(`{
       window.__gl = [];
       const get = HTMLCanvasElement.prototype.getContext;
       HTMLCanvasElement.prototype.getContext = function (type, ...rest) {
         const c = get.call(this, type, ...rest);
         if (c && /webgl/.test(type)) window.__gl.push(c);
         return c;
       };
     }`);
     ```
   - After each `toHaveAttribute("data-hero-disposed", "0,0")` add:
     ```ts
     expect(await page.evaluate("window.__gl.length > 0 && window.__gl.every((g) => g.isContextLost())")).toBe(true);
     ```
     The string form follows spike 20.
   - Add the mutation row: delete `renderer.forceContextLoss();` → `-g "rời trang chủ"` must go red.

3. **The poster's alt text describes food that is not in the picture** (Task 3 `hero-basket.tsx` + Interfaces line). Decision 4 removes rau củ and thịt cá from the basket (no cut-outs), and my poster confirms it, yet the alt says "…đầy rau củ, trái cây, thịt cá, trứng sữa". The content also changes whenever admin/M5 hides a cut-out product. The canvas is already `aria-hidden`, and the h1, CTA and HTML category grid carry the meaning.
   - Make the poster decorative: `alt=""`, with the comment `{/* trang trí: h1 + ô danh mục HTML mang nội dung; món trong rổ đổi theo dữ liệu */}`.
   - Update the Task 3 "Produces" line to match. The e2e tests use `[data-hero] img`, so nothing else changes.

4. **The poster script must not silently bake the wrong basket** (Task 4 `scripts/hero-poster.ts` + Step 2). It reads the **dev** DB `chosang`. Kết quả M4 records that the dev DB keeps pre-M4 data until the owner reruns `npm run setup`, and agents never write it. If the dev DB has no `cutoutUrl` yet, the script quietly produces the 6-stamp fallback poster. That poster gets committed in `public/hero/`, while the seeded scene (test DB, and the pitch after setup) shows 8 cut-outs, so the canvas visibly "jumps" at fade-in.
   - Separately, `page.evaluate` has no timeout, so a throw inside `mountHeroScene` hangs the script forever.
   - After `const items = …`:
     ```ts
     console.log(`${items.length} món:`, items.map((i) => i.src.split("/").pop()).join(", "));
     if (!items.every((i) => i.cutout)) throw new Error("DB chưa có cut-out M4: chủ shop chạy `npm run setup` rồi chạy lại hero:poster");
     ```
   - In the evaluate: `await new Promise<void>((onReady, reject) => { mountHeroScene(document.querySelector("canvas"), items, { onReady, onPick() {}, onLost() {} }).catch(reject); });`
   - Step 2 Expected: the first line is `8 món: xoai-…-cutout.webp, …` (all cut-outs). If the script throws the "chưa có cut-out" error, stop at **NEEDS_CONTEXT**. Only the controller/owner reruns setup on the dev DB.

5. **Count and doc consistency** (doc only).
   - With change 1, the e2e count is **14** in `hero.spec.ts`. Update File Structure, Task 5 Produces, Step 2 ("14 passed", `--repeat-each=3` "42 passed"), Step 3 ("14 passed"), Step 4 and Task 6 Step 1 (**E₀ + 14 = 44**). Vitest stays N₀ + 13 = 279.
   - Task 6 Step 3's heading says "trang chủ ×3", but the loop and the ruling are ×5: fix the heading.

## Rulings

### The 14 Decisions

| # | Ruling | One line |
|---|---|---|
| D1 poster is LCP, `preload()` to the head | **Approve** (Q1 ruling: median of 5) | Verified: first in `<head>`, one request, LCP = poster at all 3 viewports. Option C's analysis (a lazy poster is still the LCP) is correct and saves a debate |
| D2 poster rendered from the built chunk | **Approve**, amended by change 4 | Reproducible (0.37/255 mean diff over 3 runs) and needs no server. The only weak point is which DB it reads |
| D3 `public/hero/` with `max-age=0` + ETag | **Approve** | It avoids the build ↔ poster cycle. `ponytail:` recorded |
| D4 cut-outs only, ≤2 per category, stamp fallback | **Approve** | Not mixing styles follows spec §4. The fallback stays tested by unit tests |
| D5 rattan colours | **Approve** | Mandatory carry-over. Hex values match `gift-canvas.client.ts` |
| D6 `@types/three` dev dependency | **Approve** (ruling Q2) | 0 runtime bytes, no install scripts |
| D7 layout 45svh, CTA over the stage on mobile | **Approve**; look and feel → Designer (Q5) | The stage aspect is always <16:9, so poster crop = camera crop (measured) |
| D8 load chain with `AbortSignal` | **Approve**, amended by change 1 | The pure gate + request-level e2e is the right shape |
| D9 interaction (spin, drag, tap ≤8 px, `pan-y pinch-zoom`) | **Approve** | Vertical swipes still scroll; a tap is the only way to navigate. See optional 1 (mouse capture) |
| D10 stop/dispose, `forceContextLoss` | **Approve**, amended by change 2 | The code is right; the test now proves it |
| D11 build once per mount (refs, deps `[]`) | **Approve** | Mutation-proven by the planner; the right call for a page where "+" revalidates on every tap |
| D12 `compileAsync` + `initTexture` per task | **Approve** | Keeps the longest task under 200 ms at CPU ×4 (159–195 ms; my unthrottled run: 113–146 ms) |
| D13 fps proxy; real Android = owner at M7 | **Approve** (ruling Q4) | |
| D14 simulate TBT is a Lantern artefact | **Approve** | The spec budget is INP, not TBT. Devtools-throttled TBT is 184–243 ms. "3D after first interaction" stays an M7 lever |

### Open questions

| Q | Ruling |
|---|---|
| Q1, Q2, Q4 | Already ruled by the controller; consistent with this review |
| Q5 ("Mua ngay" over the basket on mobile; rau củ/thịt cá not in the basket; 2 per category) | **Designer at the M6 UI gate.** One input from the poster I rendered: in the opening frame the 8 items bunch toward the back and right of the rim, with the eggs front and centre. Sprite radius/height (`1.05`, `0.95`, `0.3`) is the tuning knob the plan already names |

### Checked and found OK (no action)

- **Not fetched means not fetched.** Reduced motion, saveData, deviceMemory <4 and out-of-viewport are all checked **before** `import()`, and the tests count network requests. A hidden tab is not a spec load condition. Rendering is gated by `document.hidden` regardless. In practice Chrome does not deliver IntersectionObserver callbacks to a hidden tab, so the chunk waits until the tab is visible. I did not emulate this.
- **No WebGL.** The chunk *is* fetched and then falls back to the poster with a `console.warn`. That is acceptable: it only happens after load + idle + in viewport, so LCP is unaffected (see optional 4).
- **Poster delivery.** AVIF/WebP `<picture>`, `sizes` identical in the preload and the sources (no double download), `width`/`height` set, `fetchpriority=high`. The stage has a fixed height on both breakpoints, and the canvas is `absolute` with `opacity` only, so swapping it in causes no CLS (measured ≤0.0001).
- **Cleanup.** `dispose()` stops the loop, disconnects both observers, removes all 5 canvas listeners and the `visibilitychange` listener, disposes geometry, material and `map` for every Mesh and Sprite (Sprite's shared geometry can be re-uploaded on the next mount), checks `renderer.info.memory`, then calls `renderer.dispose()` and `forceContextLoss()`. `renderer.dispose()` also stops three's animation loop, so the stop is belt and braces.
- **Touch and scroll.** `touch-action: pan-y pinch-zoom` applies only while the canvas is live. Before that, `pointer-events-none` passes touches to the poster. A vertical pan fires `pointercancel`, which clears the drag, so it never navigates.
- **A11y.** The canvas is `aria-hidden` and not focusable. Exactly one "Mua ngay" link is in the a11y tree per breakpoint (the other one is `display:none`). The mobile CTA paints above the canvas (later in the DOM, both positioned) and its focus ring fits inside the 12 px inset. Icons are Lucide only.
- **Server and supply chain.** `import type` from `.client.ts` is erased (`verbatimModuleSyntax`), so there is no three in the server or vitest. three and `@types/three` are pinned exact, with no new install scripts.
- **M5 interplay.** M5's `uploadUrl` `?v=` change does not touch `cutoutSrc`, so M6's DB test regex holds. M5 appends to `config.ts` by instruction, not by patch, so there is no conflict. The JS budget after both is ≈129.9 KB. M5's admin e2e files run before `hero.spec.ts` (alphabetical, `workers: 1`). Hiding a cut-out product there leaves ≥1 sprite, and the hero tests tolerate that.
- **Over-engineering.** None found. Every file maps to the spec, a carry-over or a Review Focus item. The one production test hook (`<html data-hero-disposed>`) is two numbers and no data.

## Optional suggestions

1. **Mouse drag released outside the canvas.** `pointerup` is listened for on the canvas only, so the drag is never cleared. The basket then keeps following every later mouse move over the canvas and the auto-spin stops (desktop only; touch has implicit capture). Fix with one line in `onDown`: `canvas.setPointerCapture(e.pointerId);`.
2. **Desktop `sizes`.** The stage is at most ≈560 CSS px (`max-w-6xl`, 2 columns), but `50vw` makes a 1920 px screen fetch `poster-1280`. Use `"(min-width: 1152px) 560px, (min-width: 640px) 50vw, 100vw"`. It is one constant, shared by the preload and the sources, so they stay in sync. Mobile is unchanged.
3. **Drop `decoding="async"` on the LCP `<img>`.** The default lets the browser paint the hero image as soon as it can. This is a small and free change.
4. **Skip the fetch where WebGL2 cannot exist.** three 0.186 is WebGL2-only. Adding `"WebGL2RenderingContext" in window` to `readHeroEnv`/`shouldLoadHero` saves 133 KB on old browsers at no cost. A blocklisted GPU still fetches and then falls back, which the existing e2e covers. Add one vitest row.
5. **Context leak on a mid-build throw.** If anything in `mountHeroScene` throws after `new WebGLRenderer` (for example the context is lost during `compileAsync`), the renderer is never disposed. A `try { … } catch (e) { renderer.dispose(); renderer.forceContextLoss(); throw e; }` around the body after construction closes it.
6. **Hand-off for M5/M7.** Hiding or showing a cut-out product changes the sprite count, so every sprite angle (`i / items.length`) shifts. The poster then no longer matches the first frame, and the fade-in visibly jumps until `npm run hero:poster` is rerun. Put "rerun `hero:poster` after admin product changes" on the M7 pitch checklist next to the existing cut-out redo note.
