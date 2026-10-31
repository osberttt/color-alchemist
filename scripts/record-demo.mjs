// Records the jam demo video: a captioned "Practice · practice scenes" run at phone size.
// It plays like a careful player: it reads the painted scene, aims where the square's
// average color best matches the target, zooms to fill it, and in reactions keeps only
// ingredients that bring the extract closer.
// Usage: serve the build (`npx vite preview --port 5300`), then
//   $env:PLAYWRIGHT_BROWSERS_PATH='0'; node scripts/record-demo.mjs http://localhost:5300/ submission
// Output: <outDir>/Digit7Jam_osbert_Colorchemy_Demo.webm (convert to MP4 with ffmpeg).
import { chromium } from 'playwright';
import { mkdirSync, renameSync, rmSync } from 'node:fs';
import { join } from 'node:path';

const base = process.argv[2] ?? 'http://localhost:5300/';
const outDir = process.argv[3] ?? 'submission';
const tmp = join(outDir, '.video-tmp');
mkdirSync(tmp, { recursive: true });

const W = 405;
const H = 720;
const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 2, recordVideo: { dir: tmp, size: { width: W * 2, height: H * 2 } } });
const page = await context.newPage();
page.on('pageerror', (e) => console.log('pageerror:', e.message));
const wait = (ms) => page.waitForTimeout(ms);

// Captions drawn over the game (they never take input).
async function caption(text) {
  await page.evaluate((t) => {
    let el = document.getElementById('demo-caption');
    if (!el) {
      el = document.createElement('div');
      el.id = 'demo-caption';
      el.style.cssText =
        'position:fixed;left:50%;bottom:10px;transform:translateX(-50%);z-index:9999;max-width:92%;padding:8px 14px;border-radius:12px;' +
        'background:rgba(0,0,0,.78);color:#fff;font:600 15px/1.3 system-ui,sans-serif;text-align:center;pointer-events:none;transition:opacity .25s';
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

// How far each exposed extract is from its target (sum over the rows, OKLab ×100).
const reactionDistance = () =>
  page.evaluate(() => {
    const lin = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
    const lab = (css) => {
      const [r, g, b] = css.match(/\d+(\.\d+)?/g).slice(0, 3).map((v) => lin(Number(v) / 255));
      const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
      const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
      const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
      return [0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s, 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s, 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s];
    };
    let total = 0;
    for (const row of document.querySelectorAll('.reaction .rx-compare')) {
      const t = lab(getComputedStyle(row.querySelector('.rx-half.target')).backgroundColor);
      const y = lab(getComputedStyle(row.querySelector('.rx-half.yours')).backgroundColor);
      total += Math.hypot(t[0] - y[0], t[1] - y[1], t[2] - y[2]) * 100;
    }
    return total;
  });

const OPPOSITE = { sunlight: 'darkness', darkness: 'sunlight', pigment: 'ash', ash: 'pigment', cinnamon: 'cobalt', cobalt: 'cinnamon', moss: 'rose', rose: 'moss' };

async function playReaction(first) {
  await caption(first ? 'Rising or falling qualities cause a reaction!' : 'Another reaction!');
  await wait(3400);
  await page.locator('.rx-start').click();
  await caption('Drop ingredients in to bring the extract closer to its color');
  await wait(900);
  const ids = await page.locator('.reaction .rx-shelf button.ing').evaluateAll((els) => els.map((e) => [...e.classList].find((c) => c.startsWith('ing-')).slice(4)));
  const bad = new Set();
  let current = null;
  for (let step = 0; step < 9; step++) {
    const order = current ? [current, ...ids.filter((i) => i !== current)] : ids;
    const id = order.find((i) => !bad.has(i));
    if (!id) break;
    const d0 = await reactionDistance();
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
    await wait(650);
    const d1 = await reactionDistance();
    if (d1 < d0 - 0.3) current = id;
    else {
      bad.add(id);
      if (current === id) current = null;
      const opp = OPPOSITE[id];
      if (ids.includes(opp) && !bad.has(opp)) {
        await page.locator(`.reaction button.ing-${opp}`).click(); // cancel the wrong dose
        await wait(500);
      }
    }
  }
  await page.locator('.rx-done').click();
  await caption('Judged again: the potion moves up or down');
  await wait(3600);
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
await wait(2600);
await page.getByRole('button', { name: 'Understood' }).click();
await caption('Brew uses your camera. Here: practice with painted scenes');
await wait(2600);
await page.getByRole('button', { name: 'Practice · practice scenes' }).click();

// The hunt is ready when no intro, result sheet or reaction is showing.
const huntReady = () =>
  page.waitForFunction(
    () => document.querySelector('.vf-overlay.intro')?.hidden && document.querySelector('.sheet')?.hidden && !document.querySelector('.reaction'),
    null,
    { timeout: 15000 },
  );

let reactions = 0;
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
  if (i === 0) await caption('Extract! The machine blends the square into one color');
  await page.keyboard.press('Space');
  await page.waitForSelector('.res-next-btn:not([disabled])', { timeout: 10000 });
  const quality = await page.locator('.res-stamp .stamp').innerText();
  console.log(`color ${i + 1}: ${quality}`);
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
await page.evaluate(() => window.scrollBy({ top: 420, behavior: 'smooth' }));
await caption('Every color and its quality');
await wait(3000);
await caption('Colorchemy · Is your life full of colors?');
await wait(2600);
console.log(`reactions: ${reactions}`);

const video = page.video();
await context.close();
const recorded = await video.path();
const out = join(outDir, 'Digit7Jam_osbert_Colorchemy_Demo.webm');
rmSync(out, { force: true });
renameSync(recorded, out);
rmSync(tmp, { recursive: true, force: true });
await browser.close();
console.log(`saved ${out}`);
