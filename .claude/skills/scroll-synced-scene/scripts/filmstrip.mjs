#!/usr/bin/env node
/**
 * Filmstrips for checking a scroll-synced scene. Run from the project root (Playwright is
 * resolved from there) against a running dev server.
 *
 *   node filmstrip.mjs --url http://localhost:5173/ --mode scroll --from 2 --to 3 --out shots/roast-grind
 *   node filmstrip.mjs --url http://localhost:5173/ --mode scroll --from 3 --to 2 --out shots/grind-roast
 *   node filmstrip.mjs --url http://localhost:5173/ --mode time --from 3 --to 4 --out shots/brew
 *
 * scroll: settles on section `from`, then scrolls to `to` in --frames steps, one shot per step.
 * time:   settles on `from`, slows the page clock to --speed, scrolls to `to`, shoots as it plays.
 * Writes <out>-<k>.png and <out>-sheet.png (all frames on one image).
 *
 * Options: --sections "[data-stage]"  --ready "[data-ready]"  --idle "journey=idle"
 *          --frames 7  --speed 0.02  --width 1366  --height 768  --clip x,y,w,h
 */
import { mkdirSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { pathToFileURL } from "node:url";

const args = Object.fromEntries(
  process.argv.slice(2).reduce((acc, a, i, all) => (a.startsWith("--") ? [...acc, [a.slice(2), all[i + 1]]] : acc), []),
);
const opt = {
  url: args.url ?? "http://localhost:5173/",
  mode: args.mode ?? "scroll",
  from: Number(args.from ?? 0),
  to: Number(args.to ?? 1),
  out: args.out ?? "filmstrip/shot",
  sections: args.sections ?? "[data-stage]",
  ready: args.ready ?? "[data-ready]",
  idle: args.idle ?? "journey=idle", // <html data-journey="idle">
  frames: Number(args.frames ?? (args.mode === "time" ? 8 : 7)),
  speed: Number(args.speed ?? 0.02),
  width: Number(args.width ?? 1366),
  height: Number(args.height ?? 768),
  clip: args.clip ? Object.fromEntries(args.clip.split(",").map(Number).map((v, i) => [["x", "y", "width", "height"][i], v])) : undefined,
};

const req = createRequire(join(process.cwd(), "noop.js"));
const pw = await import(pathToFileURL(req.resolve("@playwright/test")).href);
const chromium = pw.chromium ?? pw.default.chromium; // the resolved entry is CommonJS
mkdirSync(dirname(opt.out), { recursive: true });

const browser = await chromium.launch({ args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
const page = await browser.newPage({ viewport: { width: opt.width, height: opt.height } });

// A page clock we can slow down later; rAF callbacks get the slowed timestamp too.
await page.addInitScript(() => {
  const real = performance.now.bind(performance);
  let base = real(), baseReal = base, scale = 1;
  performance.now = () => base + (real() - baseReal) * scale;
  window.__setSpeed = (s) => { base = performance.now(); baseReal = real(); scale = s; };
  const raf = window.requestAnimationFrame.bind(window);
  window.requestAnimationFrame = (cb) => raf(() => cb(performance.now()));
});

const [idleKey, idleValue] = opt.idle.split("=");
const settle = async () => {
  await page.waitForTimeout(100);
  await page.waitForFunction(([k, v]) => document.documentElement.dataset[k] === v, [idleKey, idleValue], { timeout: 60_000 });
};
const sectionTop = (i) =>
  page.evaluate(([sel, i]) => document.querySelectorAll(sel)[i].getBoundingClientRect().top + window.scrollY, [opt.sections, i]);
const scrollTo = (y) =>
  page.evaluate((y) => {
    window.scrollTo(0, y);
    window.dispatchEvent(new Event("scroll")); // run the handler now, not on a busy next frame
  }, y);

await page.goto(opt.url);
await page.locator(opt.ready).first().waitFor({ timeout: 60_000 });
await scrollTo(await sectionTop(opt.from));
await settle();
await page.waitForTimeout(400);

const files = [];
const shoot = async (k) => {
  const path = `${opt.out}-${k}.png`;
  await page.screenshot({ path, clip: opt.clip });
  files.push(path);
};

if (opt.mode === "time") {
  await page.evaluate((s) => window.__setSpeed(s), opt.speed);
  await scrollTo(await sectionTop(opt.to));
  for (let k = 0; k < opt.frames; k++) await shoot(k);
} else {
  const [y0, y1] = [await sectionTop(opt.from), await sectionTop(opt.to)];
  for (let k = 0; k < opt.frames; k++) {
    await scrollTo(y0 + ((y1 - y0) * k) / (opt.frames - 1));
    await page.waitForTimeout(350); // roughly a person's scroll pace
    await shoot(k);
  }
}

// Contact sheet: lay the frames out in a grid and screenshot that.
const cols = Math.min(4, files.length);
const imgs = files
  .map((f, k) => `<figure><img src="data:image/png;base64,${readFileSync(f).toString("base64")}"><figcaption>${k}</figcaption></figure>`)
  .join("");
const sheet = await browser.newPage({ viewport: { width: 1600, height: 400 } });
await sheet.setContent(
  `<style>body{margin:0;background:#fff;font:14px sans-serif}main{display:grid;grid-template-columns:repeat(${cols},1fr);gap:6px;padding:6px}
   figure{margin:0}img{width:100%;display:block}figcaption{padding:2px 0}</style><main>${imgs}</main>`,
);
await sheet.screenshot({ path: `${opt.out}-sheet.png`, fullPage: true });
await browser.close();
console.log([...files, `${opt.out}-sheet.png`].join("\n"));
