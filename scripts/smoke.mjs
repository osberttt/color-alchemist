// Smoke test: plays Seven Colors end to end in Chromium at the jam's required
// viewports (360×640 mobile, 1280×720 desktop) and saves screenshots.
// Usage: start `npm run dev -- --port 5199`, then
//   PLAYWRIGHT_BROWSERS_PATH=0 node scripts/smoke.mjs [baseUrl] [outDir]
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

const base = process.argv[2] ?? 'http://localhost:5199/';
const out = process.argv[3] ?? 'smoke-shots';
mkdirSync(out, { recursive: true });

const browser = await chromium.launch({
  args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream', '--autoplay-policy=no-user-gesture-required'],
});

const problems = [];

async function session(name, viewport, mobile) {
  const ctx = await browser.newContext({
    viewport,
    deviceScaleFactor: mobile ? 2 : 1,
    isMobile: mobile,
    hasTouch: mobile,
    permissions: ['camera'],
  });
  const page = await ctx.newPage();
  page.on('console', (m) => {
    if (m.type() === 'error' || m.type() === 'warning') problems.push(`[${name}] console.${m.type()}: ${m.text()}`);
  });
  page.on('pageerror', (e) => problems.push(`[${name}] pageerror: ${e.message}`));
  const shot = (label) => page.screenshot({ path: join(out, `${name}-${label}.png`) });
  // A reaction (the practice run is loaded with the dev-only ?react, so one follows every
  // color): drag the first ingredient into the extract, tap the last, finish, continue.
  let reactions = 0;
  const reaction = async () => {
    const rx = page.locator('.reaction');
    if (!(await rx.waitFor({ timeout: 3000 }).then(() => true, () => false))) return;
    // The briefing: the clock must wait for the player.
    await page.waitForTimeout(1200);
    await shot(`05b-reaction-${reactions + 1}-brief`);
    await overflow(`reaction ${reactions + 1} brief`);
    if (await page.locator('.rx-mix').isVisible()) problems.push(`[${name}] reaction started without the player`);
    if (reactions === 0) {
      await page.getByRole('button', { name: 'All reactions' }).click();
      await page.locator('.overlay.rx-list').waitFor();
      await page.waitForTimeout(400);
      await shot('05b-reaction-list');
      await page.keyboard.press('Escape');
      await page.locator('.overlay.rx-list').waitFor({ state: 'detached' });
      if (!(await rx.isVisible())) problems.push(`[${name}] Escape on the reaction list left the reaction`);
    }
    await page.locator('.rx-start').click();
    await page.waitForTimeout(500);
    const tiles = page.locator('.reaction .ing');
    const from = await tiles.first().boundingBox();
    const to = await page.locator('.rx-stack').boundingBox();
    await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
    await page.mouse.down();
    await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, { steps: 8 });
    await page.mouse.up();
    await tiles.last().click();
    await page.waitForTimeout(400);
    const meters = (await tiles.allInnerTexts()).join(' ');
    await shot(`05c-reaction-${reactions + 1}`);
    await overflow(`reaction ${reactions + 1}`);
    await page.locator('.rx-done').click();
    await page.waitForSelector('.rx-out:not([hidden])', { timeout: 3000 });
    await page.waitForTimeout(800);
    await shot(`05d-reaction-${reactions + 1}-judged`);
    console.log(`[${name}] reaction: ${(await page.locator('.rx-name').innerText())} [${meters}] ${(await page.locator('.rx-out').innerText()).replace(/\s+/g, ' ')}`);
    await page.locator('.rx-done').click();
    await rx.waitFor({ state: 'detached', timeout: 3000 });
    reactions++;
  };
  const overflow = async (label) => {
    const o = await page.evaluate(() => {
      const vw = document.documentElement.clientWidth;
      const bad = [...document.querySelectorAll('.screen *')]
        .filter((el) => {
          const r = el.getBoundingClientRect();
          return r.width > 0 && (r.right > vw + 1 || r.left < -1) && getComputedStyle(el).position !== 'fixed' && !el.closest('.flood, .decor');
        })
        .map((el) => `${el.tagName.toLowerCase()}.${(el.className?.baseVal ?? el.className) || ''}`)
        .slice(0, 5);
      return { sw: document.documentElement.scrollWidth, cw: vw, bad };
    });
    if (o.sw > o.cw + 1 || o.bad.length) problems.push(`[${name}] overflow on ${label}: ${o.sw}/${o.cw} ${o.bad.join(', ')}`);
  };

  await page.goto(`${base}?react`);
  await page.waitForSelector('.title-hero');
  await page.waitForSelector('.howto', { timeout: 5000 });
  await page.waitForTimeout(500);
  await shot('01-howto');
  // The guide lists every reaction with an example.
  if ((await page.locator('.howto .rg-list > li').count()) !== 6) problems.push(`[${name}] the guide doesn't list the 5 reactions + no reaction`);
  await page.locator('.howto .rx-guide').scrollIntoViewIfNeeded();
  await page.waitForTimeout(300);
  await shot('01b-howto-reactions');
  await overflow('howto');
  await page.getByRole('button', { name: 'Understood' }).click();
  await shot('02-title');
  await overflow('title');

  // Practice run: all seven sections.
  await page.getByRole('button', { name: /Practice/ }).click();
  await page.waitForSelector('.vf-overlay.intro:not([hidden])');
  await shot('03-intro');
  await page.waitForSelector('.vf-overlay.intro', { state: 'hidden', timeout: 5000 });
  await page.waitForTimeout(400);
  await shot('04-hunt');
  await overflow('hunt');
  const accs = [];
  for (let i = 0; i < 7; i++) {
    await page.waitForFunction(() => document.querySelector('.vf-overlay.intro')?.hasAttribute('hidden') && document.querySelector('.sheet')?.hasAttribute('hidden'), null, { timeout: 8000 });
    // Aim: zoom in a little so the machine sits inside an object more often.
    if (i % 2 === 1) await page.keyboard.press('+');
    await page.keyboard.press('Space');
    await page.waitForSelector('.sheet:not([hidden])', { timeout: 8000 });
    await page.waitForSelector('.res-next-btn:not([disabled])', { timeout: 8000 });
    await page.waitForTimeout(600);
    accs.push(`${await page.locator('.res-acc').innerText()} ${await page.locator('.res-stamp .stamp').innerText()} (${await page.locator('.craft-name').innerText()})`);
    if (i === 0) {
      await shot('05-result');
      // The result must wait for the player: no auto-advance.
      await page.waitForTimeout(3000);
      if (await page.locator('.sheet').isHidden()) problems.push(`[${name}] result advanced on its own`);
    }
    if (i === 3) await shot('05b-result-later');
    await page.keyboard.press('Space');
    await reaction();
  }
  if (reactions !== 7) problems.push(`FAILED: [${name}] ${reactions} reactions with ?react, expected 7`);
  await page.waitForSelector('.summary', { timeout: 8000 });
  await page.waitForTimeout(5200);
  await shot('06-summary');
  await overflow('summary');
  console.log(`[${name}] practice accuracies: ${accs.join(', ')}`);
  console.log(`[${name}] practice band: ${await page.locator('.band').innerText()} ${await page.locator('.summary .total').innerText()}`);

  // Leaderboard
  await page.getByRole('button', { name: 'Leaderboard' }).click();
  await page.waitForSelector('.board, .empty');
  await shot('07-board');
  await page.getByRole('button', { name: 'Back' }).click();

  // Test photos (dev only)
  await page.getByRole('button', { name: /Test photos/ }).click();
  await page.waitForSelector('.vf-overlay.intro:not([hidden])', { timeout: 8000 });
  await page.waitForSelector('.vf-overlay.intro', { state: 'hidden', timeout: 8000 });
  await page.waitForTimeout(800);
  await shot('08-photo-hunt');
  await page.keyboard.press('+');
  await page.keyboard.press('+');
  await page.keyboard.press('Space');
  await page.waitForSelector('.res-next-btn:not([disabled])', { timeout: 8000 });
  await page.waitForTimeout(600);
  await shot('09-photo-result');
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Abandon' }).click();

  // Camera (Chromium's fake camera: a moving test pattern)
  await page.getByRole('button', { name: 'Begin the hunt' }).click();
  const open = page.getByRole('button', { name: 'Open the eye' });
  // Screens arrive after a paint-wipe transition: wait for the prompt or the hunt.
  await page.locator('.vf-overlay.intro:not([hidden]), button:has-text("Open the eye")').first().waitFor({ timeout: 10000 });
  if (await open.isVisible().catch(() => false)) {
    await page.waitForTimeout(500);
    await shot('10a-camera-prompt');
    await open.click();
  }
  await page.waitForSelector('.vf-overlay.intro:not([hidden])', { timeout: 10000 });
  await page.waitForSelector('.vf-overlay.intro', { state: 'hidden', timeout: 10000 });
  await page.waitForTimeout(1200);
  await shot('10-camera-hunt');
  await page.keyboard.press('Space');
  await page.waitForSelector('.res-next-btn:not([disabled])', { timeout: 8000 });
  await page.waitForTimeout(600);
  await shot('11-camera-result');
  await ctx.close();
}

try {
  await session('mobile', { width: 360, height: 640 }, true);
  await session('desktop', { width: 1280, height: 720 }, false);
} catch (e) {
  problems.push(`FAILED: ${e.message}`);
} finally {
  await browser.close();
}
console.log(problems.length ? `PROBLEMS:\n${problems.join('\n')}` : 'No console errors.');
process.exit(problems.some((p) => p.startsWith('FAILED') || p.includes('pageerror')) ? 1 : 0);
