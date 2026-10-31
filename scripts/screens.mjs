// QA screenshots of every screen, at phone (390×844) and desktop (1280×720) size, into
//   qa/screens/<mobile|desktop>/<NN-area>/<NN-what>.png
// plus qa/screens/REPORT.md (every shot, page errors, horizontal overflow).
// Needs both servers:  npx vite --port 5199  (dev: forced reactions via ?react)
//                      npx vite preview --port 5300  (the jam build)
// Usage: $env:PLAYWRIGHT_BROWSERS_PATH='0'; node scripts/screens.mjs
import { chromium } from 'playwright';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const DEV = 'http://localhost:5199/';
const PROD = 'http://localhost:5300/';
const OUT = 'qa/screens';
const PHOTO = resolve('test-photos/colorful-houses-street.jpg');
rmSync(OUT, { recursive: true, force: true });

const report = [];
const problems = [];
const fakeCam = ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'];
const browser = await chromium.launch({ args: fakeCam });

async function session(name, viewport, mobile) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: 2, isMobile: mobile, hasTouch: mobile, permissions: ['camera'] });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => problems.push(`[${name}] page error: ${e.message}`));
  page.on('console', (m) => m.type() === 'error' && problems.push(`[${name}] console error: ${m.text()}`));
  const wait = (ms) => page.waitForTimeout(ms);

  const shot = async (area, what) => {
    const dir = join(OUT, name, area);
    mkdirSync(dir, { recursive: true });
    const file = join(dir, `${what}.png`);
    // Never mid page-wipe (the colored rings between screens).
    await page.waitForFunction(() => !document.querySelector('.wipe'), null, { timeout: 4000 }).catch(() => {});
    await page.screenshot({ path: file });
    const o = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    report.push(`| ${name} | ${area} | ${what} |${o > 1 ? ` ⚠ ${o}px horizontal overflow` : ' ok'} |`);
    if (o > 1) problems.push(`[${name}] ${area}/${what}: ${o}px horizontal overflow`);
  };
  // One section of the walkthrough: a failure is reported and the rest still runs.
  const step = async (label, fn) => {
    try {
      await fn();
    } catch (e) {
      problems.push(`[${name}] FAILED at "${label}": ${e.message.split('\n')[0]}`);
      report.push(`| ${name} | – | ${label} | ✗ failed |`);
    }
  };
  const huntReady = () =>
    page.waitForFunction(() => document.querySelector('.vf-overlay.intro')?.hidden && document.querySelector('.sheet')?.hidden && !document.querySelector('.reaction'), null, { timeout: 15000 });
  const closeGuideIfOpen = async () => {
    const ok = page.getByRole('button', { name: 'Understood' });
    if (await ok.waitFor({ timeout: 2500 }).then(() => true, () => false)) await ok.click();
    await wait(400);
  };

  // A reaction: briefing, (list), mixing, result. `detail` = screenshots of every page.
  let rxCount = 0;
  const reaction = async (detail) => {
    const rx = page.locator('.reaction');
    if (!(await rx.waitFor({ timeout: 2500 }).then(() => true, () => false))) return false;
    rxCount++;
    const kind = (await page.locator('.rx-name').innerText()).toLowerCase().replace(/[^a-z]+/g, '-');
    const p = `${String(rxCount).padStart(2, '0')}-${kind}`;
    await wait(900);
    if (detail) await shot('06-reaction', `${p}-1-briefing`);
    if (detail && rxCount === 1) {
      await page.getByRole('button', { name: 'All reactions' }).click();
      await wait(500);
      await shot('06-reaction', '00-all-reactions-list');
      await page.keyboard.press('Escape');
      await wait(300);
    }
    await page.locator('.rx-start').click();
    await wait(600);
    const tiles = page.locator('.reaction .rx-shelf button.ing');
    await tiles.first().click();
    await wait(300);
    await tiles.nth(1).click();
    await wait(600);
    if (detail) await shot('06-reaction', `${p}-2-mixing`);
    await page.locator('.rx-done').click();
    await wait(1800);
    if (detail) await shot('06-reaction', `${p}-3-result`);
    await page.locator('.rx-done').click();
    await rx.waitFor({ state: 'detached', timeout: 4000 });
    return true;
  };

  // --- menu and guide (the jam build) ---
  await step('menu and guide', async () => {
    await page.goto(PROD);
    await page.locator('.howto').waitFor({ timeout: 5000 });
    await wait(700);
    await shot('02-guide', '01-guide-top');
    await page.locator('.howto .rg-list').scrollIntoViewIfNeeded();
    await wait(400);
    await shot('02-guide', '02-guide-reactions');
    await page.locator('.howto .btn.primary').scrollIntoViewIfNeeded();
    await wait(400);
    await shot('02-guide', '03-guide-bottom');
    await page.getByRole('button', { name: 'Understood' }).click();
    await wait(1600);
    await shot('01-menu', '01-title');
    await page.getByRole('button', { name: 'How to play' }).click();
    await wait(500);
    await shot('02-guide', '04-guide-from-help-button');
    await page.getByRole('button', { name: 'Understood' }).click();
  });

  await step('empty ledger', async () => {
    await page.getByRole('button', { name: 'Leaderboard' }).click();
    await wait(900);
    await shot('08-ledger', '01-live-potions-empty');
    await page.getByRole('button', { name: 'Gallery potions' }).click();
    await wait(900);
    await shot('08-ledger', '02-gallery-potions-empty');
    await page.getByRole('button', { name: 'Back' }).click();
    await wait(800);
  });

  // --- a full practice-scene run on the dev server, with a reaction after every color ---
  await step('practice run with reactions', async () => {
    await page.goto(`${DEV}?react`);
    await closeGuideIfOpen();
    await page.getByRole('button', { name: 'Practice · practice scenes' }).click();
    await page.waitForSelector('.vf-overlay.intro:not([hidden])', { timeout: 10000 });
    await wait(500);
    await shot('04-hunt', '01-color-intro');
    for (let i = 0; i < 7; i++) {
      await huntReady();
      await wait(400);
      if (i === 0) {
        await shot('04-hunt', '02-hunt-practice-scene');
        await page.keyboard.press('+');
        await page.keyboard.press('+');
        await wait(300);
        await shot('04-hunt', '03-hunt-zoomed');
      }
      if (i === 1) {
        await page.keyboard.press('Escape');
        await wait(500);
        await shot('10-dialogs', '01-quit-run');
        await page.getByRole('button', { name: 'Keep brewing' }).click();
        await wait(300);
      }
      await page.keyboard.press('Space');
      if (i === 0) {
        await wait(500);
        await shot('04-hunt', '04-extract-swirl');
        await wait(900);
        await shot('04-hunt', '05-extract-reveal');
      }
      await page.waitForSelector('.res-next-btn:not([disabled])', { timeout: 10000 });
      await wait(1200);
      if (i === 0) await shot('05-result', '01-result-first-color');
      if (i === 3) await shot('05-result', '02-result-mid-run');
      if (i === 6) await shot('05-result', '03-result-last-color');
      await page.locator('.res-next-btn').click();
      await reaction(true);
    }
    await page.waitForSelector('.summary', { timeout: 10000 });
    await wait(5500);
    await shot('07-summary', '01-practice-summary-top');
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await wait(600);
    await shot('07-summary', '02-practice-summary-bottom');
  });

  // Equilibrium and Sublimation forced on the 3rd color (a true 3-long chain), in case the
  // run above didn't produce them.
  for (const kind of ['equilibrium', 'sublimation']) {
    await step(`forced ${kind}`, async () => {
      await page.goto(`${DEV}?react=${kind}`);
      await closeGuideIfOpen();
      await page.getByRole('button', { name: 'Practice · practice scenes' }).click();
      for (let i = 0; i < 3; i++) {
        await huntReady();
        await page.keyboard.press('Space');
        await page.waitForSelector('.res-next-btn:not([disabled])', { timeout: 10000 });
        await wait(1000);
        await page.locator('.res-next-btn').click();
        if (i === 2) rxCount = kind === 'equilibrium' ? 7 : 8;
        await reaction(i === 2);
      }
    });
  }

  // --- practice from gallery, in the jam build: a full run so the ledger gets an entry ---
  await step('gallery run', async () => {
    await page.goto(PROD);
    await closeGuideIfOpen();
    await page.getByRole('button', { name: 'Practice · from gallery' }).click();
    await page.waitForSelector('.vf-overlay.pick:not([hidden])', { timeout: 10000 });
    await wait(400);
    await shot('09-gallery', '01-pick-a-photo');
    await page.locator('input[type=file]').setInputFiles(PHOTO);
    await page.waitForSelector('.vf-overlay.pick', { state: 'hidden', timeout: 5000 });
    await wait(600);
    await shot('09-gallery', '02-photo-loaded');
    for (let i = 0; i < 7; i++) {
      await huntReady();
      await page.keyboard.press('Space');
      await page.waitForSelector('.res-next-btn:not([disabled])', { timeout: 10000 });
      await wait(900);
      if (i === 0) await shot('09-gallery', '03-gallery-result');
      await page.locator('.res-next-btn').click();
      await reaction(false);
    }
    await page.waitForSelector('.summary', { timeout: 10000 });
    await wait(5500);
    await shot('09-gallery', '04-gallery-summary');
    await page.getByRole('button', { name: 'Leaderboard' }).click();
    await wait(900);
    await shot('08-ledger', '03-gallery-potions-with-entry');
    await page.getByRole('button', { name: 'Back' }).click();
    await wait(600);
  });

  // --- Brew with the (fake) camera, in the jam build ---
  await step('camera', async () => {
    await page.getByRole('button', { name: 'Brew', exact: true }).click();
    const allow = page.getByRole('button', { name: 'Allow the camera' });
    await page.locator('.vf-overlay.intro:not([hidden]), button:has-text("Allow the camera")').first().waitFor({ timeout: 10000 });
    if (await allow.isVisible().catch(() => false)) {
      await wait(500);
      await shot('03-camera', '01-camera-prompt');
      await allow.click();
    }
    await huntReady();
    await wait(1200);
    await shot('03-camera', '02-hunt-live-camera');
    await page.keyboard.press('Space');
    await page.waitForSelector('.res-next-btn:not([disabled])', { timeout: 10000 });
    await wait(1200);
    await shot('03-camera', '03-camera-result');
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'Abandon' }).click();
    await wait(900);
    await shot('01-menu', '02-title-after-a-run');
  });

  await ctx.close();
}

// The camera error screen: a browser that refuses the camera.
async function cameraError(name, viewport, mobile) {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport, deviceScaleFactor: 2, isMobile: mobile, hasTouch: mobile });
  const page = await ctx.newPage();
  try {
    await page.goto(PROD);
    const ok = page.getByRole('button', { name: 'Understood' });
    if (await ok.waitFor({ timeout: 2500 }).then(() => true, () => false)) await ok.click();
    await page.getByRole('button', { name: 'Brew', exact: true }).click();
    const allow = page.getByRole('button', { name: 'Allow the camera' });
    if (await allow.waitFor({ timeout: 5000 }).then(() => true, () => false)) await allow.click();
    await page.getByRole('button', { name: 'Try again' }).waitFor({ timeout: 10000 });
    await page.waitForTimeout(600);
    const dir = join(OUT, name, '03-camera');
    mkdirSync(dir, { recursive: true });
    await page.screenshot({ path: join(dir, '04-camera-blocked-error.png') });
    report.push(`| ${name} | 03-camera | 04-camera-blocked-error | ok |`);
  } catch (e) {
    problems.push(`[${name}] camera error screen not reached: ${e.message.split('\n')[0]}`);
  }
  await b.close();
}

await session('mobile', { width: 390, height: 844 }, true);
await session('desktop', { width: 1280, height: 720 }, false);
await cameraError('mobile', { width: 390, height: 844 }, true);
await cameraError('desktop', { width: 1280, height: 720 }, false);
await browser.close();

writeFileSync(
  join(OUT, 'REPORT.md'),
  `# Screen check (${new Date().toISOString().slice(0, 16).replace('T', ' ')} UTC)\n\n` +
    `Phone: 390×844 (touch) · Desktop: 1280×720. Jam build for menus, gallery and camera (fake camera); dev build with forced reactions for the practice run.\n\n` +
    `## Problems\n\n${problems.length ? problems.map((p) => `- ${p}`).join('\n') : 'None.'}\n\n` +
    `## Screens\n\n| Size | Area | Screen | Check |\n|---|---|---|---|\n${report.join('\n')}\n`,
);
console.log(`${report.length} screens · ${problems.length} problems`);
problems.forEach((p) => console.log(' -', p));
