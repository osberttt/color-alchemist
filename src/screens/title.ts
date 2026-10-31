// Title, how-to, camera pre-prompt and camera error screens.

import { currentPalette, muteButton, paletteOverlay, show } from '../app';
import { COLORS } from '../data/colors';
import { getSettings, getStats, updateSettings } from '../meta/storage';
import { h, fmt } from '../ui/dom';
import { logo } from '../ui/components';
import { centerOf, fx } from '../ui/fx';
import { beginSeven, goBoard, goTitle } from '../flow';
import { CAMERA_ERROR_TEXT, type CameraError } from '../camera/camera';
import { sfx, unlockAudio } from '../audio/sfx';
import { reactionGuide } from '../seven/reaction-guide';
import { contrast } from '../ui/palettes';

/** WCAG contrast a logo letter needs against the page (3 is the bar for large text). */
const LOGO_MIN_CONTRAST = 3;

export function titleScreen(): void {
  show((screen) => {
    const stats = getStats();
    const pal = currentPalette();
    const accents = pal?.accents ?? COLORS.slice(0, 5).map((c) => c.target);
    const drop = h('span', { class: 'qdrop', 'aria-hidden': 'true' });
    let i = Math.floor(Math.random() * COLORS.length);
    const cycle = () => {
      drop.style.background = COLORS[i % COLORS.length].target;
      i += 7;
    };
    cycle();
    const timer = window.setInterval(cycle, 1400);
    const go = (fn: () => void) => () => {
      unlockAudio();
      sfx.tap();
      fn();
    };
    const tint = (n: number) => ({ '--tint': `var(--p${n})` });

    // The logo's letters take the three accents that stand out most from the page, in turn;
    // one still below 3:1 keeps its color with a thin ink outline, so it stays readable.
    const ranked = pal ? [...pal.accents].sort((a, b) => contrast(b, pal.bg) - contrast(a, pal.bg)).slice(0, 3) : [];
    const logoEl = logo(
      [accents[1], accents[3], accents[0]],
      ranked.map((c) => ({ color: c, outline: contrast(c, pal!.bg) < LOGO_MIN_CONTRAST })),
    );
    screen.append(
      h('div', { class: 'topbar' }, h('span'), h('div', { class: 'row tight' }, howToButton(), muteButton())),
      h(
        'div',
        { class: 'title-hero' },
        logoEl,
        // Under the logo, only the small invitation (the user's call, ANALYSIS §4.35).
        h('p', { class: 'tagline small-tag' }, 'Does your life have enough colors to heal you', h('span', { class: 'qmark' }, '?', drop), h('br'), 'Test it out to brew the Elixir of Life.'),
      ),
      h(
        'div',
        { class: 'title-actions stagger' },
        h('button', { class: 'btn primary xl glow', type: 'button', onclick: go(() => void beginSeven('camera')) }, 'Brew'),
        h('button', { class: 'btn tinted', type: 'button', style: tint(2), onclick: go(() => void beginSeven('photo')) }, 'Practice · from gallery'),
        h('button', { class: 'btn tinted', type: 'button', style: tint(4), onclick: go(() => void beginSeven('practice')) }, 'Practice · practice scenes'),
        h('button', { class: 'btn tinted', type: 'button', style: tint(3), onclick: () => goBoard('seven') }, 'Leaderboard'),
        stats.runs > 0 ? h('p', { class: 'muted small center' }, `best run ${fmt(stats.bestRun)} · ${stats.runs} run${stats.runs === 1 ? '' : 's'} brewed`) : null,
      ),
    );
    // The logo pops in letter by letter with a splash of color under each flask.
    const splashes = window.setTimeout(() => {
      logoEl.querySelectorAll('.logo-o').forEach((o, k) => {
        const c = centerOf(o);
        fx.splash(c.x, c.y, accents[(k * 2 + 1) % accents.length], 16);
      });
      sfx.sparkle();
    }, 650);
    // Tap the logo for more paint.
    logoEl.addEventListener('pointerdown', (e) => {
      fx.burst(e.clientX, e.clientY, accents, { count: 26, speed: 320 });
      sfx.pop(Math.floor(Math.random() * 5));
    });
    if (!getSettings().seenHowTo) setTimeout(() => howTo(), 900);
    return () => {
      clearInterval(timer);
      clearTimeout(splashes);
    };
  }, 'title');
}

function howToButton(): HTMLButtonElement {
  return h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'How to play', onclick: () => howTo() }, '?');
}

export function howTo(onDone?: () => void): void {
  updateSettings({ seenHowTo: true });
  const close = () => {
    overlay.remove();
    window.removeEventListener('keydown', key);
    onDone?.();
  };
  const key = (e: KeyboardEvent) => {
    if (e.key === 'Escape' || e.key === 'Enter') close();
  };
  window.addEventListener('keydown', key);
  // The user's wording (ANALYSIS §4.35): nothing more.
  const overlay = h(
    'div',
    { class: 'overlay', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'How to play' },
    h(
      'div',
      { class: 'dialog howto' },
      h('h2', null, 'Colorchemy'),
      h('p', { class: 'howto-intro' }, 'Brew medicine with colors in the real world. The closer the colors are to those in the recipe, the better the quality.'),
      h('h2', { class: 'howto-sub' }, 'How to play'),
      h('p', null, 'Allow access to the camera on your phone (or PC). Take photos to match the colors in the recipe.'),
      h('h2', { class: 'howto-sub' }, 'Reactions'),
      h('p', null, 'The change in quality of the colors extracted may cause chemical reactions.'),
      reactionGuide(),
      h('button', { class: 'btn primary', type: 'button', onclick: close }, 'Understood'),
    ),
  );
  paletteOverlay(overlay, 'howto');
  document.body.append(overlay);
}

export function cameraPromptScreen(onOpen: () => void, onPractice: () => void): void {
  show((screen) => {
    screen.append(
      h(
        'div',
        { class: 'center-col' },
        h('div', { class: 'eye', 'aria-hidden': 'true' }, '◉'),
        h('h2', null, 'The color extracting machine needs a camera to capture the colors around you.'),
        h('p', null, 'Photos stay on your device and nothing is uploaded to the cloud.'),
        h(
          'button',
          {
            class: 'btn primary xl',
            type: 'button',
            onclick: () => {
              updateSettings({ seenCameraPrompt: true });
              onOpen();
            },
          },
          'Allow the camera',
        ),
        h('button', { class: 'btn ghost', type: 'button', onclick: onPractice }, 'No camera? Practice instead'),
        h('button', { class: 'btn ghost', type: 'button', onclick: () => goTitle() }, 'Back'),
      ),
    );
  }, 'prompt');
}

/**
 * `stillBlocked`: the camera was refused again right after "Try again", so the browser is
 * remembering the refusal and won't ask: say where to allow it.
 */
export function cameraErrorScreen(err: CameraError, retry: () => void, onPractice: () => void, stillBlocked = false): void {
  // One plain line for every cause (the user's wording); the cause is still logged for testers.
  console.info(`camera unavailable: ${err} (${CAMERA_ERROR_TEXT[err]})`);
  show((screen) => {
    screen.append(
      h(
        'div',
        { class: 'center-col' },
        h('div', { class: 'eye closed', 'aria-hidden': 'true' }, '◌'),
        h('h2', null, 'The color extracting machine couldn’t access the camera.'),
        stillBlocked ? h('p', null, 'Your browser is blocking the camera. Allow it in the site settings (next to the address bar), then try again.') : null,
        h('button', { class: 'btn primary', type: 'button', onclick: retry }, 'Try again'),
        h('button', { class: 'btn', type: 'button', onclick: onPractice }, 'Practice instead'),
        h('button', { class: 'btn ghost', type: 'button', onclick: () => goTitle() }, 'Back'),
      ),
    );
  }, 'error');
}
