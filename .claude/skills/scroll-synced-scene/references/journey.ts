// Framework-free core of a scroll-synced scene. Copied from app/lib/scroll.ts in the Basalt Roasters repo.
// Adapt: section list, colours (or drop them), SECONDS_PER_SECTION / CATCH_UP / REWIND.

/**
 * State for the home journey, read every frame by Three.js and SVG.js without going through React.
 * Sections: hero, farm, roast, grind, brew, shop.
 *
 * Two tracks, so the scene stays glued to the page in both scroll directions:
 * - `scroll` follows the page exactly: i when section i fills the screen, fractional between.
 *   Where things sit (the bean gliding from one side to the other) is driven by this.
 * - `stage` is a playhead: stage i..i+1 is section i's own animation (roasting, grinding, pouring).
 *   Reaching a section plays it in real time instead of making you scroll through it. Sections you
 *   scrolled past catch up fast, and going back up rewinds quickly.
 */
export const journey = { stage: 0, scroll: 0 };

const SECONDS_PER_SECTION = 1.6;
const CATCH_UP = 3; // extra speed per section of backlog beyond the current one
const REWIND = 2.5; // going back up undoes a section faster than it played

type Listener = (stage: number) => void;
const listeners = new Set<Listener>();

export function onJourney(fn: Listener) {
  listeners.add(fn);
  fn(journey.stage);
  return () => void listeners.delete(fn);
}

export const clamp01 = (n: number) => Math.min(1, Math.max(0, n));
export const smoothstep = (a: number, b: number, n: number) => {
  const t = clamp01((n - a) / (b - a));
  return t * t * (3 - 2 * t);
};

/** Speed of the playhead, in sections per second, for a given distance to the target. */
export const playRate = (gap: number) =>
  ((gap < 0 ? REWIND : 1) * (1 + CATCH_UP * Math.max(0, Math.abs(gap) - 1))) / SECONDS_PER_SECTION;

/** Advances `stage` toward `target` by one frame of `dt` seconds, never overshooting. */
export function step(stage: number, target: number, dt: number) {
  const gap = target - stage;
  return stage + Math.sign(gap) * Math.min(Math.abs(gap), playRate(gap) * dt);
}

/** Page position in sections: i when section i's top is at the top of the screen. */
export function scrollPosition(rects: { top: number; height: number }[]) {
  let pos = 0;
  rects.forEach((r, i) => {
    if (r.top <= 0) pos = i + clamp01(-r.top / r.height);
  });
  return Math.min(pos, rects.length - 1);
}

/** Watches the sections, drives both tracks and the page colours. */
export function trackJourney(sections: HTMLElement[], colors: { bg: string; ink: string }[], reducedMotion: boolean) {
  const root = document.documentElement;
  let target = 0;
  let raf = 0;
  let last = 0;

  const notify = () => listeners.forEach((fn) => fn(journey.stage));
  const settle = () => {
    raf = 0;
    root.dataset.journey = "idle";
    root.dataset.playhead = journey.stage.toFixed(2);
  };
  const tick = (now: number) => {
    // wall-clock time, so slow devices finish on schedule (capped so a background tab doesn't jump;
    // floored at 0 because the first rAF timestamp can predate the performance.now() we started from)
    journey.stage = step(journey.stage, target, Math.min(0.25, Math.max(0, (now - last) / 1000)));
    last = now;
    notify();
    if (journey.stage === target) settle();
    else raf = requestAnimationFrame(tick);
  };

  const update = () => {
    const rects = sections.map((el) => el.getBoundingClientRect());
    journey.scroll = scrollPosition(rects);

    // the section under the middle of the screen owns the colours and the playhead
    const mid = window.innerHeight / 2;
    let active = 0;
    rects.forEach((r, i) => {
      if (r.top <= mid) active = i;
    });
    target = active + 1;
    root.style.setProperty("--page-bg", colors[active].bg);
    root.style.setProperty("--page-ink", colors[active].ink);

    if (journey.stage === target || raf) return;
    if (reducedMotion) {
      journey.stage = target;
      notify();
      settle();
      return;
    }
    root.dataset.journey = "running";
    last = performance.now();
    raf = requestAnimationFrame(tick);
  };

  update();
  window.addEventListener("scroll", update, { passive: true });
  window.addEventListener("resize", update);
  return () => {
    window.removeEventListener("scroll", update);
    window.removeEventListener("resize", update);
    cancelAnimationFrame(raf);
    journey.stage = 0;
    journey.scroll = 0;
    delete root.dataset.journey;
    delete root.dataset.playhead;
    root.style.removeProperty("--page-bg");
    root.style.removeProperty("--page-ink");
  };
}
