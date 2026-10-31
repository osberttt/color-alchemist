// Records the jam demo video: a captioned "Practice · practice scenes" run at phone size.
// It plays like a careful player: it reads the painted scene, aims where the square's
// average color best matches the target, zooms to fill it, and in reactions keeps only
// ingredients that bring the extract closer.
// Usage: serve the build (`npx vite preview --port 5300`), then
//   $env:PLAYWRIGHT_BROWSERS_PATH='0'; node scripts/record-demo.mjs http://localhost:5300/ submission
// Output: <outDir>/Digit7Jam_osbert_Colorchemy_Demo.webm (convert to MP4 with ffmpeg).
import { chromium } from 'playwright';
import { mkdirSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const base = process.argv[2] ?? 'http://localhost:5300/';
const outDir = process.argv[3] ?? 'submission';
const tmp = join(outDir, '.video-tmp');
mkdirSync(tmp, { recursive: true });

// Playwright records video in CSS pixels, so the viewport is the video size (device scale 1).
// 720×1280 is still the phone layout (narrower than the 900 px desktop breakpoint).
// --shots: screenshots only, at a real phone's size (iPhone 12-like 390×844 at 3×), no video kept.
const SHOTS_ONLY = process.argv.includes('--shots');
const W = SHOTS_ONLY ? 390 : 720;
const H = SHOTS_ONLY ? 844 : 1280;
const shotsDir = join(outDir, 'screenshots');
mkdirSync(shotsDir, { recursive: true });
const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: W, height: H },
  deviceScaleFactor: SHOTS_ONLY ? 3 : 1,
  hasTouch: SHOTS_ONLY,
  ...(SHOTS_ONLY ? {} : { recordVideo: { dir: tmp, size: { width: W, height: H } } }),
});
const page = await context.newPage();
page.on('pageerror', (e) => console.log('pageerror:', e.message));
const wait = (ms) => page.waitForTimeout(ms);

// Screenshots for the submission, taken at key moments without the caption.
// A screenshot without the caption, as a buffer (reaction shots are kept from the reaction with
// the most mixing, decided at the end).
async function shotBuffer() {
  await page.evaluate(() => {
    const el = document.getElementById('demo-caption');
    if (el) el.style.visibility = 'hidden';
  });
  const buf = await page.screenshot();
  await page.evaluate(() => {
    const el = document.getElementById('demo-caption');
    if (el) el.style.visibility = '';
  });
  return buf;
}
let bestReactionShots = { doses: -1, bufs: [] };

// Numbered by role (01 title … 09 summary list), not by when they happen.
async function shot(n) {
  await page.evaluate(() => {
    const el = document.getElementById('demo-caption');
    if (el) el.style.visibility = 'hidden';
  });
  await page.screenshot({ path: join(shotsDir, `osbert_Colorchemy_Screenshot${String(n).padStart(2, '0')}.png`) });
  await page.evaluate(() => {
    const el = document.getElementById('demo-caption');
    if (el) el.style.visibility = '';
  });
}

// Captions drawn over the game (they never take input).
async function caption(text) {
  await page.evaluate((t) => {
    let el = document.getElementById('demo-caption');
    if (!el) {
      el = document.createElement('div');
      el.id = 'demo-caption';
      el.style.cssText =
        'position:fixed;left:50%;bottom:16px;transform:translateX(-50%);z-index:9999;max-width:90%;padding:12px 20px;border-radius:16px;' +
        'background:rgba(0,0,0,.8);color:#fff;font:600 26px/1.3 system-ui,sans-serif;text-align:center;pointer-events:none;transition:opacity .25s';
      document.body.append(el);
    }
    el.textContent = t;
    el.style.opacity = t ? '1' : '0';
  }, text);
}

// Where to aim: the window (the square's size at a given zoom) whose average color, mixed in
// linear light like the machine, is closest to the target in OKLab.
async function findAim() {
  return page.evaluate(() => {
    const lin = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
    const oklab = (r, g, b) => {
      const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
      const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
      const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
      return [0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s, 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s, 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s];
    };
    const rgb = (css) => css.match(/\d+(\.\d+)?/g).slice(0, 3).map((v) => lin(Number(v) / 255));
    const target = oklab(...rgb(getComputedStyle(document.querySelector('.big-sw.target')).backgroundColor));
    const cv = document.querySelector('.seven-vp canvas.src-el');
    const w = cv.width;
    const h = cv.height;
    const data = cv.getContext('2d').getImageData(0, 0, w, h).data;
    // Integral images of linear R, G, B for fast window means.
    const I = [new Float64Array((w + 1) * (h + 1)), new Float64Array((w + 1) * (h + 1)), new Float64Array((w + 1) * (h + 1))];
    for (let y = 1; y <= h; y++) {
      for (let x = 1; x <= w; x++) {
        const p = ((y - 1) * w + (x - 1)) * 4;
        for (let c = 0; c < 3; c++) I[c][y * (w + 1) + x] = lin(data[p + c] / 255) + I[c][(y - 1) * (w + 1) + x] + I[c][y * (w + 1) + x - 1] - I[c][(y - 1) * (w + 1) + x - 1];
      }
    }
    const mean = (x0, y0, s) => I.map((A) => (A[(y0 + s) * (w + 1) + x0 + s] - A[y0 * (w + 1) + x0 + s] - A[(y0 + s) * (w + 1) + x0] + A[y0 * (w + 1) + x0]) / (s * s));
    let best = null;
    for (const zoom of [1.6, 2.2, 3, 4]) {
      const s = Math.max(4, Math.round((0.3 * Math.min(w, h)) / zoom));
      const step = Math.max(2, Math.round(s / 6));
      for (let y0 = 0; y0 + s <= h; y0 += step) {
        for (let x0 = 0; x0 + s <= w; x0 += step) {
          const lab = oklab(...mean(x0, y0, s));
          const d = Math.hypot(lab[0] - target[0], lab[1] - target[1], lab[2] - target[2]) * 100 + zoom * 0.15;
          if (!best || d < best.d) best = { d, u: (x0 + s / 2) / w, v: (y0 + s / 2) / h, zoom };
        }
      }
    }
    return best;
  });
}

async function aimAndZoom() {
  const aim = await findAim();
  const vp = await page.locator('.seven-vp').boundingBox();
  const cx = vp.x + vp.width / 2;
  const cy = vp.y + vp.height / 2;
  // Drag the scene so the chosen spot comes to the center (at zoom 1, one viewport = the whole scene).
  await page.mouse.move(cx, cy);
  await page.mouse.down();
  await page.mouse.move(cx + (0.5 - aim.u) * vp.width, cy + (0.5 - aim.v) * vp.height, { steps: 18 });
  await page.mouse.up();
  await wait(300);
  const presses = Math.ceil(Math.log(aim.zoom) / Math.log(1.1));
  for (let i = 0; i < presses; i++) {
    await page.keyboard.press('+');
    await wait(70);
  }
  return aim;
}

// The best next ingredient: one dose of each is applied to every exposed extract with the
// game's own formula (exposure and white balance as per-channel gains clipped at white, then
// OKLab chroma), and the one that brings them closest to their targets wins (summed, OKLab ×100).
// Returns the ingredient and how much it would help.
const bestIngredient = (ids) =>
  page.evaluate((ids) => {
    const lin = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
    const toLin = (css) => css.match(/\d+(\.\d+)?/g).slice(0, 3).map((v) => lin(Number(v) / 255));
    const oklab = ([r, g, b]) => {
      const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
      const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
      const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
      return [0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s, 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s, 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s];
    };
    const fromLab = ([L, A, B]) => {
      const l = (L + 0.3963377774 * A + 0.2158037573 * B) ** 3;
      const m = (L - 0.1055613458 * A - 0.0638541728 * B) ** 3;
      const s = (L - 0.0894841775 * A - 1.291485548 * B) ** 3;
      return [4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s, -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s, -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s].map((v) => Math.min(1, Math.max(0, v)));
    };
    // One dose (SEVEN.reaction): Sunlight/Darkness ±0.3 stops, Pigment/Ash chroma ×1.45 or ÷1.45,
    // Cinnamon/Cobalt warmth ±0.5 stops, Moss/Rose tint ±0.55 stops.
    const DOSE = { sunlight: ['ev', 0.3], darkness: ['ev', -0.3], pigment: ['sat', 1.45], ash: ['sat', 1 / 1.45], cinnamon: ['warm', 0.5], cobalt: ['warm', -0.5], moss: ['tint', 0.55], rose: ['tint', -0.55] };
    const apply = (rgb, id) => {
      const [kind, v] = DOSE[id];
      let g = [1, 1, 1];
      if (kind === 'ev') g = [2 ** v, 2 ** v, 2 ** v];
      if (kind === 'warm' || kind === 'tint') {
        const r = kind === 'warm' ? 2 ** v : 1;
        const gg = kind === 'tint' ? 2 ** v : 1;
        const b = kind === 'warm' ? 2 ** -v : 1;
        const y = 0.2126 * r + 0.7152 * gg + 0.0722 * b;
        g = [r / y, gg / y, b / y];
      }
      let out = rgb.map((c, i) => Math.min(1, c * g[i]));
      if (kind === 'sat') {
        const [L, A, B] = oklab(out);
        out = fromLab([L, A * v, B * v]);
      }
      return out;
    };
    const rows = [...document.querySelectorAll('.reaction .rx-compare')].map((row) => ({
      t: oklab(toLin(getComputedStyle(row.querySelector('.rx-half.target')).backgroundColor)),
      y: toLin(getComputedStyle(row.querySelector('.rx-half.yours')).backgroundColor),
    }));
    const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]) * 100;
    const now = rows.reduce((t, r) => t + dist(oklab(r.y), r.t), 0);
    let best = { id: null, gain: 0 };
    for (const id of ids) {
      const after = rows.reduce((t, r) => t + dist(oklab(apply(r.y, id)), r.t), 0);
      if (now - after > best.gain) best = { id, gain: now - after };
    }
    return best;
  }, ids);

async function playReaction(first) {
  await caption(first ? 'Rising or falling qualities cause a reaction!' : 'Another reaction!');
  await wait(1200);
  const bufs = [await shotBuffer()];
  let doses = 0;
  await wait(2200);
  await page.locator('.rx-start').click();
  await caption('Drop ingredients in to bring the extract closer to its color');
  await wait(900);
  const ids = await page.locator('.reaction .rx-shelf button.ing').evaluateAll((els) => els.map((e) => [...e.classList].find((c) => c.startsWith('ing-')).slice(4)));
  for (let step = 0; step < 10; step++) {
    // Add the ingredient that helps most; stop when nothing helps any more.
    const { id, gain } = await bestIngredient(ids);
    if (!id || gain < 0.3) break;
    // Drag the jar onto the extract (the first two times, to show it), then tap.
    const tile = page.locator(`.reaction button.ing-${id}`);
    if (step < 2) {
      const from = await tile.boundingBox();
      const to = await page.locator('.rx-stack').boundingBox();
      await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
      await page.mouse.down();
      await page.mouse.move(to.x + to.width * 0.75, to.y + to.height / 2, { steps: 14 });
      await page.mouse.up();
    } else await tile.click();
    await wait(700);
    doses++;
    if (doses === 2) bufs[1] = await shotBuffer();
  }
  if (!bufs[1]) bufs[1] = await shotBuffer();
  await page.locator('.rx-done').click();
  await caption('Judged again: the potion moves up or down');
  await wait(2000);
  bufs[2] = await shotBuffer();
  if (doses > bestReactionShots.doses) bestReactionShots = { doses, bufs };
  await wait(1600);
  await page.locator('.rx-done').click();
  await page.locator('.reaction').waitFor({ state: 'detached' });
}

// --- the video ------------------------------------------------------------------------
await page.goto(base);
await page.waitForSelector('.logo');
await caption('Colorchemy');
await wait(2200);
await page.getByRole('button', { name: 'Understood' }).waitFor();
await caption('Brew medicine with colors in the real world');
await wait(2600);
// Scroll the guide to show the reactions.
await page.evaluate(() => document.querySelector('.overlay')?.scrollBy({ top: 520, behavior: 'smooth' }));
await caption('The guide explains every reaction');
await wait(1400);
await shot(2);
await wait(1200);
await page.getByRole('button', { name: 'Understood' }).click();
await wait(700);
await shot(1);
await caption('Brew uses your camera. Here: practice with painted scenes');
await wait(2600);
// Move the pointer off the title buttons first: a hovered button keeps animating and never counts as stable.
await page.mouse.move(4, 4);
await page.getByRole('button', { name: 'Practice · practice scenes' }).click();

// The hunt is ready when no intro, result sheet or reaction is showing.
const huntReady = () =>
  page.waitForFunction(
    () => document.querySelector('.vf-overlay.intro')?.hidden && document.querySelector('.sheet')?.hidden && !document.querySelector('.reaction'),
    null,
    { timeout: 15000 },
  );

let reactions = 0;
let resultShot = false;
// The tincture: a dose of Sunlight and one of Pigment, then the run starts.
await page.waitForSelector('.tinc', { timeout: 10000 });
await caption('First, mix a tincture: it tunes the machine to your light');
await wait(1200);
await page.locator('.tinc button.ing-sunlight').click();
await wait(700);
await page.locator('.tinc button.ing-pigment').click();
await wait(1400);
await page.locator('.tinc-start').click();
await page.waitForSelector('.vf-overlay.intro:not([hidden])', { timeout: 10000 });
await caption('7 colors, 30 seconds each');
for (let i = 0; i < 7; i++) {
  await huntReady();
  if (i === 0) await caption('Find the color, then fill the square with it');
  else if (i === 1) await caption('Aim and zoom like a camera');
  else await caption('');
  await wait(500);
  await aimAndZoom();
  await wait(700);
  if (i === 0) await shot(3);
  if (i === 0) await caption('Extract! The machine blends the square into one color');
  await page.keyboard.press('Space');
  await page.waitForSelector('.res-next-btn:not([disabled])', { timeout: 10000 });
  const quality = await page.locator('.res-stamp .stamp').innerText();
  console.log(`color ${i + 1}: ${quality}`);
  // The result screenshot: the first Flawless (or the last color if none came).
  if (!resultShot && (quality === 'FLAWLESS' || i === 6)) {
    await wait(900);
    await shot(4);
    resultShot = true;
  }
  if (i === 0) await caption('The closer the color, the better the quality');
  else if (i === 2) await caption('Every color is a drop in your potion');
  await wait(i < 3 ? 2600 : 1400);
  await page.keyboard.press('Space');
  // Next comes a reaction, the next color's intro, or (after the last color) the summary.
  await page.waitForFunction(
    () => document.querySelector('.reaction') || document.querySelector('.summary') || !document.querySelector('.vf-overlay.intro')?.hidden,
    null,
    { timeout: 10000 },
  );
  if (await page.locator('.reaction').count()) {
    await playReaction(reactions === 0);
    reactions++;
  }
  await caption('');
}
await page.waitForSelector('.summary', { timeout: 10000 });
await caption('Your potion: from Gunk to the Elixir of Life');
await wait(5200);
await shot(8);
await page.evaluate(() => window.scrollBy({ top: 520, behavior: 'smooth' }));
await caption('Every color and its quality');
await wait(1500);
await shot(9);
await wait(1500);
await caption('Colorchemy · Does your life have enough colors to heal you?');
await wait(2600);
console.log(`reactions: ${reactions} (screenshots from one with ${bestReactionShots.doses} doses)`);
bestReactionShots.bufs.forEach((buf, k) => writeFileSync(join(shotsDir, `osbert_Colorchemy_Screenshot0${5 + k}.png`), buf));

if (SHOTS_ONLY) {
  await context.close();
  await browser.close();
  rmSync(tmp, { recursive: true, force: true });
  console.log('screenshots saved');
  process.exit(0);
}
const video = page.video();
await context.close();
const recorded = await video.path();
const out = join(outDir, 'Digit7Jam_osbert_Colorchemy_Demo.webm');
rmSync(out, { force: true });
renameSync(recorded, out);
rmSync(tmp, { recursive: true, force: true });
await browser.close();
console.log(`saved ${out}`);
