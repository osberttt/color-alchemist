// Renders the pitch deck to a PDF (16:9, one slide per page) and its first slide to the cover image.
// The deck is served by the dev server so it can use the game's fonts from node_modules.
// Usage: npx vite --port 5199, then
//   $env:PLAYWRIGHT_BROWSERS_PATH='0'; node scripts/render-deck.mjs http://localhost:5199/
import { chromium } from 'playwright';

const base = process.argv[2] ?? 'http://localhost:5199/';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('requestfailed', (r) => errors.push(`failed: ${r.url()}`));
await page.goto(`${base}submission/deck/deck.html`);
await page.evaluate(() => document.fonts.ready);
await page.waitForTimeout(800);
await page.locator('#cover').screenshot({ path: 'submission/osbert_Colorchemy_Cover.png' });
await page.pdf({ path: 'submission/osbert_Colorchemy_PitchDeck.pdf', width: '1920px', height: '1080px', printBackground: true });
// A PNG of every slide too, for checking.
const n = await page.locator('.slide').count();
for (let i = 0; i < n; i++) await page.locator('.slide').nth(i).screenshot({ path: `submission/deck/slide-${i + 1}.png` });
// The store-style thumbnail (itch.io cover proportions 630×500, at 2× for sharpness).
const thumb = await browser.newPage({ viewport: { width: 630, height: 500 }, deviceScaleFactor: 2 });
thumb.on('pageerror', (e) => errors.push(e.message));
await thumb.goto(`${base}submission/deck/thumb.html`);
await thumb.waitForSelector('body[data-ready]');
await thumb.evaluate(() => document.fonts.ready);
await thumb.waitForTimeout(500);
await thumb.locator('#thumb').screenshot({ path: 'submission/osbert_Colorchemy_Thumbnail.png', animations: 'disabled' });
await browser.close();
console.log(errors.length ? errors.join('\n') : `ok: cover + ${n} slides`);
