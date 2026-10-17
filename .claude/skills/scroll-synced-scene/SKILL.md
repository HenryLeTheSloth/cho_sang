---
name: scroll-synced-scene
description: Build or fix scroll-driven storytelling pages where a 3D/canvas/SVG scene (Three.js, react-three-fiber, canvas, SVG.js, Lottie, GSAP-style timelines) has to stay in step with page sections. Use it whenever someone wants an animation that "follows the scroll", a hero object that travels through chapters, or one effect (filling, pouring, morphing, counting) that has to keep pace with another. Also use it for complaints that the scene lags or drifts from the sections, breaks when scrolling back up, or takes too much scrolling to play, even if the user never says "scroll-synced".
---

# Scroll-synced scenes

A page made of sections, with a fixed canvas behind them whose content changes as you move through the sections. The hard part is keeping the scene glued to the page in **both** scroll directions without making people scroll forever.

A working reference implementation lives in this repo: `app/lib/scroll.ts` (state + playhead), `app/components/three/BeanJourney.tsx` (scene), `app/routes/home.tsx` (sections). `references/journey.ts` is a framework-free copy of the core module.

## The core idea: two tracks

Every animated property belongs to exactly one of two tracks. Mixing them up causes most of the "it doesn't match" bugs.

| Track | Driven by | Use it for | Why |
| --- | --- | --- | --- |
| **Page** (`scroll`) | Scroll position in sections: `i` when section *i* fills the screen, fractional between | *Where* things are: an object gliding between spots, camera moves, anything that should move while the sections move | It is exact and reversible for free. Scrolling up undoes it at the same pace the page moves. |
| **Playhead** (`stage`) | A clock that plays toward a target in real time | *What happens* inside a section: transformations, state changes, drawing an SVG, pouring, counting | Section *i* plays when you reach it, so sections can be one screen tall instead of 2–3 screens of scrubbing. |

Pure scroll-scrubbing makes people scroll a lot to see one effect. Pure time-based animation lags behind the page, and on the way back up it plays the whole effect in reverse before anything moves. Two tracks avoid both problems.

### Page track

```ts
// i when section i's top is at the top of the viewport; clamped to the last section
function scrollPosition(rects: { top: number; height: number }[]) {
  let pos = 0;
  rects.forEach((r, i) => { if (r.top <= 0) pos = i + clamp01(-r.top / r.height); });
  return Math.min(pos, rects.length - 1);
}
```

- To move between spots, glide `frames[i] → frames[i + 1]` with `smoothstep(0.1, 0.9, pos - i)`. The object travels while both sections share the screen and rests while one section fills it.
- In the render loop, damp toward the value: `damp(current, target, ~14, delta)`. This hides mouse-wheel steps without visible lag. Skip the damping under `prefers-reduced-motion`.
- Use **one anchor** for the whole journey. Successive objects (bean → cloud of grounds → cup) all sit on the same anchor, so handing over from one to the next never jumps.

### Playhead track

- The **active** section is the one covering the middle of the screen. Use the same rule for the page colours so they switch together.
- `target = active + 1`, so section *i* owns stage `i..i+1`.
- Each frame, `stage` moves toward `target` at a speed that depends on the gap:
  - `1 / SECONDS_PER_SECTION` (about 1.6 s) for the current section;
  - `× (1 + CATCH_UP × (|gap| − 1))` for every extra section of backlog, so jumping five sections finishes in about 3 s instead of 8;
  - `× REWIND` (about 2.5) when going backwards, so scrolling up undoes things before the previous section has finished sliding in.
- Never overshoot. Clamp the step to the remaining gap so you land exactly on the target, then stop the rAF loop.
- Advance with **wall-clock** `dt`, capped around 0.25 s. A per-frame cap like 0.05 s makes slow devices play in slow motion and breaks timing tests.
- Under reduced motion, set `stage = target` immediately.
- Expose the state for tests and debugging: `data-journey="running|idle"` and `data-playhead="4.00"` on `<html>`.

## Authoring a section's effects

Write every effect as a **pure function of `stage` (and `pos`)**: `smoothstep(a, b, stage)` ranges inside `[i, i + 1]`. Pure functions run backwards correctly with no extra code. Keep accumulated state (like an idle spin) for things that don't need reversing.

- Leave the first ~5% of a section quiet, and keep per-item stagger small (≤ 0.15 of a section) so the effect finishes inside its own range.
- **Derive consequences from their causes.** Don't give dependent effects their own timers. If grounds pour into a cup, the liquid level is the share of grounds that have landed, not a separate `smoothstep`:

  ```ts
  let landed = 0;
  for (const p of particles) { const g = smoothstep(4.05 + p.delay, 4.45 + p.delay, stage); landed += g; /* move p by g */ }
  const fill = landed / particles.length;         // rises exactly as they arrive, drains when rewound
  grounds.opacity = 1 - smoothstep(0.85, 1, fill); // later effects key off fill too
  steam.opacity = smoothstep(0.7, 1, fill);
  ```

  Two timers that are supposed to agree will drift apart as soon as someone tunes one of them. This was the fix for "the cup fills slower than the grounds go in".
- Elements outside the scene (SVG.js instruments, DOM counters) subscribe to a tiny listener set that the playhead notifies each tick. They map `t = clamp01((stage - i - 0.05) / 0.9)` and update without React renders.

## Layout and page chrome

- Make each section one viewport tall (`min-h-svh`) and drop sticky pinning. The playhead gives each section its moment.
- The canvas switches between wide and narrow layouts at **the same pixel breakpoint as the CSS** (e.g. `size.width >= 1024` with Tailwind `lg`), not at an aspect ratio. Otherwise tablets get two-column text with a phone-layout scene on top of it.
- Size and place keyframes so the object never crosses the copy. Check each section at 390, 768, 1366 and 1920 px.
- For page colours, set `--page-bg` and `--page-ink` on `<html>` from the active section and let CSS transitions do the fade. Derive the chrome from them with `color-mix()`: a header one step darker, a decorative pattern a few percent off the background.
- Give only `<html>` a background. A `body` background paints over fixed `z-index: -1` decoration layers.

## Verifying it

Do these checks every time, and look at frames: a scene can pass every assertion and still look wrong.

1. **Unit tests** for the pure parts: `step` never overshoots; one section takes ~1.6 s; a 0→6 jump takes < 4 s; rewinding a section takes less than half the forward time; `scrollPosition` at 0, half and the end of the page, plus a last section taller than the screen.
2. **E2E**: after `scrollTo`, call `window.dispatchEvent(new Event("scroll"))` in the same evaluate. A busy headless browser may not fire the handler before your next assertion. Then wait for `data-journey === "idle"`. Assert:
   - skipping far ahead goes idle quickly (fast-forward works);
   - scrolling back one section lands on `data-playhead === "<i+1>.00"` in under ~1.5 s;
   - at every section and viewport the copy fits on screen and nothing scrolls sideways.
3. **Filmstrips**: run `scripts/filmstrip.mjs` from the project root against the running dev server.
   - `--mode scroll` steps through the boundary between two sections, in either direction, and checks that motion follows the page.
   - `--mode time` slows the page clock (default 2%) while one section plays, and checks that effects that should agree stay together.

   It writes the frames plus a `sheet.png` contact sheet to read in one go. Headless WebGL is software-rendered and each screenshot can take a second or more, which is why time mode slows the clock. Playwright's fake clock doesn't help here: frozen rAF also freezes screenshots.

## Pitfalls seen in practice

- Positions driven by the playhead → lag on the way down, and on the way up the object stays put until the reversed effect finishes. Move positions to the page track.
- A per-frame `dt` cap that's too small → timing depends on frame rate.
- The Vite dev server finds dependencies late (lazy-imported Three.js, `three/examples/jsm/...`), then reloads the page mid-test. Set `optimizeDeps.entries: ["app/**/*.tsx"]` and list the heavy deps in `optimizeDeps.include`.
- An absolutely positioned `sr-only` element inside an `overflow-x-auto` table wrapper without `position: relative` escapes the wrapper and causes sideways scroll on phones.
- `mix-blend-mode` on a child of a fixed header blends with nothing: the fixed element is its own stacking context. Put the blend on the fixed element, or better, give the header a real background.
