// Renders a preview page to a PNG (or, with --video <seconds>, records a .webm of it moving).
// The page is a self-contained file (docs/previews/*.html) or a dev-server URL for
// previews that import game code.
// Usage:
//   $env:PLAYWRIGHT_BROWSERS_PATH='0'; node scripts/render-preview.mjs docs/previews/math-crafts.html
//   node scripts/render-preview.mjs http://localhost:5199/docs/previews/crafts.html docs/previews/crafts.png
//   node scripts/render-preview.mjs http://localhost:5199/docs/previews/crafts.html docs/previews/crafts.webm --video 8
import { chromium } from 'playwright';
import { readFileSync, renameSync, rmSync } from 'node:fs';
import { dirname } from 'node:path';

const args = process.argv.slice(2);
const vi = args.indexOf('--video');
const seconds = vi >= 0 ? Number(args.splice(vi, 2)[1]) : 0;
const [src, out = src.replace(/\.html$/, '.png')] = args;
const viewport = { width: 1360, height: seconds ? 720 : 900 };

const browser = await chromium.launch();
const context = await browser.newContext({ viewport, ...(seconds ? { recordVideo: { dir: dirname(out), size: viewport } } : {}) });
const page = await context.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
if (/^https?:/.test(src)) await page.goto(src);
else await page.setContent(readFileSync(src, 'utf8'));
// The previews draw synchronously; the wait covers web fonts, layout and module loading.
await page.waitForTimeout(1500);
if (seconds) {
  await page.waitForTimeout(seconds * 1000);
  const video = page.video();
  await context.close();
  const recorded = await video.path();
  rmSync(out, { force: true });
  renameSync(recorded, out);
} else {
  await page.screenshot({ path: out, fullPage: true });
  await context.close();
}
await browser.close();
console.log(errors.length ? errors.join('\n') : `ok → ${out}`);
if (errors.length) process.exit(1);
