# M6 hero Three: UI gate (Designer + Customer council)

DEGRADED: single-context. Both personas ran in one subagent, as in M2–M4. The design judgment comes from the screenshots, the live session and one offline render of the scene (composition variants). No detector run: the hero is canvas-heavy.

**Yardstick:**
- Spec §3 Home: "poster hero (LCP) với rổ 3D phủ lên sau … Không carousel".
- Spec §4: palette meanings, magenta ≤10%, Bricolage/Be Vietnam Pro, Lucide only, motion and reduced motion ("hero chỉ hiện poster"; "Hero 3D: DPR ≤1.5, dừng render…"), 375 first, ≥44 px, hover and focus-visible. UX: "3D/canvas không bao giờ chặn nút mua và luôn có fallback tĩnh".
- Spec §6, M6 row.
- Plan Decisions 1–16 (in particular 2 "poster luôn khớp khung đầu", 4, 7, 9), plus Q5 (handed to the Designer by the rulings).

**Inputs:**
- `dod-home-{poster,3d,full}-{375,1280}.png`, `task-3-home-375.png`, `task-4-home-3d-375.png`, `poster-1280.png`.
- `public/hero/poster-{480,800,1280}.{avif,webp}` (AVIF 4.6 / 9.3 / 16.3 KB).
- The M6 ledger and the rulings.

**Live session:**
- Production build on :3200 against `chosang_test` (41 products, 12 cut-outs).
- I used Playwright (the project's own `playwright` package, scripts in my scratchpad) at 375×812 DPR 2 touch, 375×667, and 1280×800. Real touch went through CDP `Input.dispatchTouchEvent`.
- The server was stopped by PID (port 3200 confirmed free).
- No `.playwright-cli/` or `.ui-check/` folder was created.
- I never touched the dev DB.
- New evidence in `.superpowers/sdd/2026-10-15-m6-hero/`:
  - `ui-swap-poster-vs-live-375.png`: left is the poster, right is the live 3D frame 50 ms after the swap.
  - `ui-tap-grid-375.png`: the 35 tap points.
  - `ui-composition-variants.png`: A is today's opening frame, B and D are a wider ring, and C is the chosen opening angle.
  - `ui-home-3d-rotated-375.png`, `ui-home-3d-375x667.png`, `ui-home-reduced-375.png`, `ui-home-hover-1280.png`, `ui-home-focus-cta-375.png`, `ui-home-focus-1280.png`.

**Customer path done:**
1. **First load at 375.** The poster paints. 3D is live 0.57 s later (`data-hero="3d"`, one chunk request). I took frames at +50, 300, 700, 1500 and 3000 ms.
2. **Vertical swipe starting on the basket** (real touch, 225 px): the page scrolled by 210 px, the same as the control swipe on the category grid. The URL did not change. `touch-action: pan-y pinch-zoom`. **Not hijacked.**
3. **Horizontal touch drag** of 160 px: the basket rotates and the page does not navigate.
4. **Tapped a 7×5 grid** over the basket mouth during the opening hold (see D2).
5. **"Mua ngay"** (155×44, over the basket) went to `/collections/all`. A tap in the middle of the 3D canvas never steals it.
6. **`/` → gift card → `/gift` → Back, 5 times:**
   - Every time: `data-hero-disposed=0,0`, scroll is restored to 532 (the gift card), and the hero waits off-screen.
   - Scrolled to top, the 3D is live again in about 280 ms.
   - Still 1 chunk request in total.
7. **`prefers-reduced-motion`:** poster only, 0 chunk requests, poster opacity 1.
8. **Keyboard at 375 and 1280:** logo → search → account → cart → **Mua ngay** → Rau củ → Trái cây…
   - The canvas is skipped (`aria-hidden`), which is correct: the HTML category tiles are the accessible path.
   - The brand focus ring is clearly visible on "Mua ngay", even over the tan basket.
9. **1280 hover:** the cursor becomes a pointer and `title` shows the category name. A mouse drag rotates and does not navigate.

**Environment notes (not app defects):**
- `Input.synthesizeScrollGesture` scrolled 0 px everywhere in headless, the control included. I used `dispatchTouchEvent` instead.
- `page.goto` (a full reload) can't show `data-hero-disposed`. The round trips above use client-side navigation.

---

## Verdict: **PASS WITH FIXES**

The hero does its job:
- The poster is the LCP (ledger: median 2414 ms).
- The 3D overlays it, and only when allowed.
- Scrolling on the basket is never blocked, and "Mua ngay" always works.
- Reduced motion gets only the poster.
- Back/forward is clean (0/0, 1 chunk).
- No carousel, no scroll-driven 3D, no magenta in the scene.

Two Important defects hurt the two promises the hero makes:
1. **The poster is not the opening frame.** The basket visibly jumps back about 14° when the 3D fades in, on every visit to `/`, with a 200 ms double image while it does.
2. **A tap goes to what's under the sprite's square box, not under your finger.** Tapping the white eggs opens "Trái cây", and tapping the empty basket opens a category.

Both are small, bounded fixes.

---

## Decisions (Designer owns these, Q5)

### (a) "Mua ngay" over the bottom-left of the basket on mobile: **KEEP**
- It sits in the thumb zone, it is 44 px tall, and it is identical in the poster and the 3D.
- It is an HTML link layered above the canvas, so no tap on the canvas can steal it or be stolen by it. Checked live: Tab reaches it 5th, with a visible ring.
- At 375×812 it covers only the lower-left wall and shadow. At 375×667 (`ui-home-3d-375x667.png`) it covers about half the lower-left wall, but no item.
- Moving it out of the stage costs about 56 px of a 45svh hero, or pushes it below the fold line of "Danh mục". It's not worth it.
- After F3 (fruit front-centre/right), the bottom-left is plain wall, so the overlap reads as deliberate.
- Spec §4 is met: "3D/canvas không bao giờ chặn nút mua".

### (b) Rau củ and Thịt cá absent from the basket: **ACCEPT for M6, must close in M7**
- Honest assessment as the Customer: "Đi chợ sáng" with oil, sugar, rice, bread and cheese reads closer to a Tết hamper (tạp hoá) than to a morning market. Vegetables and fish *are* "chợ sáng". The 1280 copy even lists "Rau củ, trái cây, thịt cá, trứng sữa".
- The alternatives are worse, though:
  - Mixed round "stamps" next to cut-outs break §4 "không trộn lẫn phong cách" (spike 19).
  - The current full-frame photos failed rembg (M4 spike 9).
- **The M7 fix is zero code.** Add cut-outs for 2 vegetables (e.g. bó rau muống, cà chua) and 1–2 thịt/cá items (a fillet on a plain background) from the owner photos. `toHeroItems` takes categories in `sort` order, so they land in the basket automatically. Then re-run `npm run hero:poster`.
- Until then, F3 puts the fresh fruit front-centre so that the first read is "fresh", not "pantry".

### (c) `HERO_CUTOUTS_PER_CATEGORY = 2`: **KEEP 2**
- 8 items is the right fullness: 1 per category (4 items) looked empty in spike 19. 3 per category would overlap even more in a 1.05-radius ring.
- **The bunching the Consultant saw** has two causes:
  - Every sprite sits on a 1.05 ring, while the rim is 1.76. Billboards nearer the camera hide the ones behind, so the cluster reads "back and up".
  - In today's poster, the flat egg tray takes front-centre, with the two fruits piled on its right.
- I rendered 4 variants offline from the built chunk (`ui-composition-variants.png`):
  - A: today's angle.
  - B: radius 1.2, scale 0.85, angle −1.18.
  - C: radius 1.05, scale 0.95, angle −1.18.
  - D: radius 1.25, scale 0.8, angle −1.18.
  - A wider ring (B and D) makes every item smaller and drops the back row behind the rim, which is worse.
- **Changing only the opening angle (C) fixes it.** Mango and cam sành come front-centre/right, the egg tray moves to the left, sugar and oil sit back-right, and bread, cheese and rice sit back-left. That is balanced left/right, colour at the focal point, and every category visible. See F3.

### Sun on the hero basket (Q5 from the rulings)
Moot. Decision 5 replaced `--sun` with the gift-shell rattan (`#B9874B` / `#8A5F2E` / `#D9AE73`). I confirmed it in `hero-scene.client.ts`: no `--sun` and no `--brand` in the scene. The hero basket and the `/gift` basket read as the same object. Good.

---

## Designer findings

| # | Sev | Screen | Defect | Concrete fix |
|---|---|---|---|---|
| D1 | **Important** | `/` every mount, 375 and 1280 (`ui-swap-poster-vs-live-375.png`) | **The poster is not the opening frame, so the basket jumps when the 3D fades in.** I measured it by grabbing the stage every 165 ms after `data-hero="3d"` and diffing each frame against the poster. During the 1 s hold, the mean pixel diff is 7.6. The best match (2.2) is the frame about 2.0 s after the swap, which is roughly 1 s of rotation (≈0.25 rad, ≈14°) later. Because of that, the 200 ms crossfade (poster `delay-200`) shows the items doubled: the oranges slide over the eggs, and the eggs shift about 30 px left at 1280. It repeats on every return to `/`. **Root cause:** `scripts/hero-poster.ts` waits for `onReady` and then calls `page.locator("canvas").screenshot()`. At 1920×1080 on SwiftShader that lands after `HOLD_MS` has expired. The ledger's accepted Task 4 minor "HOLD_MS assumption" is exactly this, and it is visible. This defeats Decision 2 ("poster luôn khớp khung đầu") and the plan's "canvas mờ dần lên mà không nhảy". | F1 |
| D2 | **Important** | `/` taps (`ui-tap-grid-375.png`), and hover `title` at 1280 | **Taps and hover hit the sprite's full square box, not the visible item.** 35 taps during the hold, 9 of them wrong: <br>• the right column of white eggs → **Trái cây** (the oranges' transparent box overlaps it); <br>• a bread slice → Trứng & sữa; <br>• the empty basket interior below the mango → Trái cây (3 times); <br>• the basket's front wall below the eggs → Trứng & sữa (3 times). <br>The hover at the stage centre at 1280 says "Trái cây" over the eggs. Spike 5 recorded this ("theo khung vuông của sprite, không theo alpha"), but with 8 overlapping cut-outs it now decides where a customer lands. | F2 |
| D3 | Minor | Opening composition (poster, LCP) | The 3×4 egg tray, a flat upright card, is the front-centre focal point. The fruit is piled on its right; gia vị and đồ khô are small at the back. The scene reads "pantry", and it bunches right (the Consultant's note). | F3 |
| D4 | Minor | Basket contents | No Rau củ or Thịt cá (decision b). | M7 carry |
| D5 | Minor | Hero cut-out: phô mai lát | The cheese still reads as onion rings, now in the LCP image (M4 Q5 note). | M7 (already carried from M4: re-shoot as a pack) |
| D6 | Note | 375×667 | The basket is about 185 px wide, so items are 25–40 CSS px: below 44 px as tap targets. That is acceptable only because the canvas is a shortcut and the HTML category tiles sit directly below. It also improves once F2 removes the false hits. | none |
| D7 | Note | Stage, 375 | There is about 40 px of empty white between the h1 and the basket rim. The poster crops at the sides, not the top, at aspect 1.38. A tighter camera would add basket size, but it re-opens LCP and poster sizing. | M7, only if the owner asks |

**Token audit (`/`, hero only):**
- **Magenta:** the "Mua ngay" pill (155×44, about 2.2% of 375×812), the logo, and the focus ring. Nothing in the scene. Under 10%.
- **`sun`:** none in the hero (rattan replaced it, per Decision 5).
- **Fonts:** Bricolage 800 for the h1 and the CTA; Be Vietnam Pro for the 1280 lede.
- **Icons:** Lucide `ArrowRight`, `Truck`. No emoji.
- **Motion:**
  - The canvas fades in over 200 ms `ease-snappy`.
  - Auto-rotation is 0.25 rad/s after a 1 s hold. It is not a carousel, and spec §3's cut order treats "tự xoay" as in scope.
  - There is no scroll-driven 3D.
  - Rendering stops off-screen (an e2e test covers it).
  - Reduced motion shows the poster only. Verified: 0 chunk requests.
- **States:** CTA hover `bg-brand-press`, focus-visible ring checked live, canvas cursor grab, grabbing, then pointer over an item.

**ui-check questions:**
- **Identity:** a rattan basket of real cut-outs on white matches `/gift`, which is the right family. D1 makes it look glitchy at exactly the moment people look.
- **Logic:** the poster is the LCP, the 3D is progressive, the CTA is fixed in the stage, and categories follow. Correct order.
- **Human:** "Đi chợ sáng trong 3 phút" plus a basket is warm. The pantry look is decision (b).
- **Restraint:** good. One object, one CTA, no stickers or particles.

---

## Customer findings ("mid-range Android, 4G, 7 a.m.")

**Does the hero help me shop? Yes, mostly.**
- The picture appears at once.
- The pink "Mua ngay" sits under my thumb and works.
- Swiping up on the basket scrolls the page like anywhere else.
- When I come back from the gift page, the page is where I left it.

| # | Sev | Where | What happened | Requirement for the Developer |
|---|---|---|---|---|
| C1 | **Important** | Tapping an item | I tapped the eggs and got **Trái cây**. I tapped the empty bottom of the basket and got sent to a category anyway. | D2 / F2 |
| C2 | **Important** | Every time I open the home page | The basket twitches backwards just as it starts to move, with a moment where the oranges are doubled. On a phone, it looks like lag. | D1 / F1 |
| C3 | Minor | What's in the basket | "Đi chợ sáng", but I see oil, sugar, rice, bread and cheese. Where are the vegetables and fish? It looks like a Tết gift. | Decision (b): M7 cut-outs |
| C4 | Minor | Data and battery | After the page loads, the basket pulls in about 133 KB of code plus about 190 KB of item pictures. The 8 cut-outs are 13–38 KB each, as 400 px webp drawn into 256 px textures. It keeps spinning while I read the header. It stops when I scroll down (good). | M7: serve the hero sprites at 256 w (`uploadUrl(key, 256, "webp")` instead of `cutoutSrc`), about −40% bytes. Optionally spin only after the first interaction (Decision 14 already lists that lever). |
| C5 | Minor | Item size at 375×667 | On my smaller phone the items are tiny. I'd use the category tiles anyway. | D6 (note) |

**What I liked (keep these):**
- The page doesn't wait for the 3D. It is never in my way, and scrolling works on top of it.
- The button over the basket is always the same, in the picture and in 3D.
- Coming back with Back puts me where I was.
- With "reduce motion" on, it stays a still picture.

---

## Fix wave (must fix in M6)

1. **F1: Poster = the exact opening frame** (`scripts/hero-poster.ts`; scene unchanged).
   - Capture inside `onReady`. It runs synchronously right after the first `renderer.render`, so the drawing buffer is still valid without `preserveDrawingBuffer`:
     ```ts
     const dataUrl = await page.evaluate(async ({ src, items }) => {
       const { mountHeroScene } = await import(src);
       const canvas = document.querySelector("canvas")!;
       return new Promise<string>((resolve, reject) => {
         mountHeroScene(canvas, items, { onReady: () => resolve(canvas.toDataURL("image/png")), onPick() {}, onLost() {} }).catch(reject);
       });
     }, { src: `/assets/${chunk}`, items });
     png = Buffer.from(dataUrl.split(",")[1], "base64");
     ```
   - Change the resize to `sharp(png).flatten({ background: "#ffffff" }).resize(w)`. The canvas is `alpha: true` and the stage is `bg-surface` #fff. Without `flatten`, the shadow comes out black or fringed.
   - Use only arrow functions inside `evaluate` (tsx `__name`, spike 20).
   - I verified this exact capture plus flatten offline (variants A–D): clean white, no fringe.
   - **Re-run `npm run hero:poster`** after F3 (one run covers both).
   - **Acceptance:** at 375 and 1280, the mean pixel diff between the stage screenshot before `data-hero="3d"` and 300 ms after it is ≤ 3 (today 7.6, and 2.2 at the matching frame).
   - Add one e2e to `e2e/hero.spec.ts` that takes the two `stage.screenshot()` buffers, decodes them with sharp `.raw()`, and asserts mean |Δ| ≤ 4. Mutation check: swap in today's poster and it must go red.
2. **F2: Tap and hover hit the visible pixels** (`app/components/hero-scene.client.ts`).
   - In `spriteTexture`, return the alpha too: `return { t, alpha: g.getImageData(0, 0, 256, 256).data }` (same-origin, so no taint). In the `textures.forEach` loop, take `r.value.t` for the map and set `sprite.userData.alpha = r.value.alpha`.
   - In `pick`:
     ```ts
     return raycaster.intersectObjects(sprites, false).find(({ object, uv }) => {
       if (!uv) return true;
       const x = Math.min(255, (uv.x * 256) | 0), y = Math.min(255, ((1 - uv.y) * 256) | 0); // CanvasTexture flipY
       return (object.userData.alpha as Uint8ClampedArray)[(y * 256 + x) * 4 + 3] > 40;
     })?.object;
     ```
   - The memory cost is 8 × 256 KB of `ImageData`, released at dispose (it lives in `userData`).
   - **Acceptance:** re-run the 7×5 tap grid. Taps on the white eggs go to `trung-sua`, taps on the empty interior and the front wall don't navigate, and a 1280 hover over the eggs shows "Trứng & sữa".
   - The existing e2e "chạm vào món…" scans 15 points and accepts any category, so it stays green. Add one e2e assertion: a tap on the basket's front wall (stage x 0.5, y 0.85) leaves the URL at `/`.
3. **F3: Fresh fruit front-centre in the opening frame** (`hero-scene.client.ts`): `let angle = -0.35;` → `let angle = -1.18;`. That is ≈ π/8 − π/2: the midpoint of the Trái cây pair, rotated to face the camera.
   - Keep radius 1.05 and scale 0.95. The wider-ring variants B and D were worse.
   - This changes the scene, so **re-run `npm run hero:poster`**, together with F1.
   - Retake `dod-home-poster-375`, `dod-home-3d-375` and the 1280 pair, and look at them: mango and oranges front-centre/right, eggs left, all 4 categories visible.
   - Re-check `npm run size` (poster AVIF ≤70 KB; it should stay about 9 KB at 800 w) and 5-run median Lighthouse LCP on `/` (≤2.5 s). The poster bytes barely change, so this is a sanity check, not a re-measure.

The ledger's deferred M6 minors stand, and I endorse them:
- The `onLostDuringBuild` listener is not removed on the build error path.
- Task 5 test hardening: wait from `requestfinished` of the chunk, poster opacity with `{ timeout: 600 }`.

**Retake after the fix wave:**
- `dod-home-poster-{375,1280}` and `dod-home-3d-{375,1280}`.
- A new `ui-swap-poster-vs-live-375.png`: the two halves must look identical.
- `ui-tap-grid-375.png`, re-run.

---

## Carry-overs

**M5 (admin):**
- After an admin adds, removes or reorders cut-out products, the live basket (DB) and the committed poster (catalog) drift. Decision 15 already hands over "re-run `hero:poster`". Add that line to the admin product-save success toast or the M5 handover doc, so the owner knows.
- M5 must not make the poster script read the DB.

**M7 (polish / owner photos):**
- **Decision (b):** cut-outs for 2 Rau củ and 1–2 Thịt cá items from owner photos (plain background). No code change; re-run `hero:poster`. Re-check the composition: with 12 items, re-evaluate `HERO_CUTOUTS_PER_CATEGORY` (2 → 12 sprites in a 1.05 ring is probably too dense, so try 1 for the dry categories).
- Phô mai lát re-shoot (already carried from M4), now also because it sits in the LCP image.
- C4: hero sprites at 256 w (`uploadUrl(key, 256, "webp")`), about −40% of 190 KB. Optional "spin only after the first interaction" (Decision 14) if the owner wants a better Lighthouse simulate score or battery.
- Real Android ≥45 fps (ruling Q4), checked at the pitch rehearsal. While there, look for the D1 twitch on the real device after F1.
- D7: a tighter camera on 375 if the owner wants a bigger basket. That needs a poster and LCP re-measure.
