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

    const logoEl = logo([accents[1], accents[3]]);
    screen.append(
      h('div', { class: 'topbar' }, h('span'), h('div', { class: 'row tight' }, howToButton(), muteButton())),
      h('div', { class: 'title-hero' }, logoEl, h('p', { class: 'tagline' }, 'is your life full of colors', h('span', { class: 'qmark' }, '?', drop))),
      h(
        'div',
        { class: 'title-actions stagger' },
        h('button', { class: 'btn primary xl glow', type: 'button', onclick: go(() => void beginSeven('camera')) }, 'Begin the hunt'),
        h('button', { class: 'btn tinted', type: 'button', style: tint(2), onclick: go(() => void beginSeven('practice')) }, 'Practice · no camera'),
        import.meta.env.DEV ? h('button', { class: 'btn tinted', type: 'button', style: tint(4), onclick: go(() => void beginSeven('photo')) }, 'Test photos (dev only)') : null,
        import.meta.env.MODE !== 'production' ? h('a', { class: 'btn tinted', href: './tuner.html', style: tint(5) }, 'Scoring tuner (test builds)') : null,
        h('button', { class: 'btn tinted', type: 'button', style: tint(3), onclick: () => goBoard('seven') }, 'Leaderboard'),
        stats.runs > 0 ? h('p', { class: 'muted small center' }, `best run ${fmt(stats.bestRun)} · ${stats.runs} run${stats.runs === 1 ? '' : 's'} brewed`) : null,
      ),
      h('p', { class: 'footnote' }, `Your photos never leave your device.${pal ? ` · today's palette: ${pal.name}` : ''}`),
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
  const step = (n: string, title: string, text: string) =>
    h('li', null, h('span', { class: 'step-n' }, n), h('div', null, h('h3', null, title), h('p', null, text)));
  const overlay = h(
    'div',
    { class: 'overlay', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'How to play' },
    h(
      'div',
      { class: 'dialog howto' },
      h('h2', null, 'The Great Work'),
      h('p', { class: 'muted' }, 'You are an alchemist. Your potions are only as good as your colors, and the colors are out there in your real life.'),
      h(
        'ol',
        { class: 'steps' },
        step('I', 'Five colors', 'A run is five colors, one at a time, 30 seconds each. The whole camera view is the color extracting machine; its square is framed in the color you need.'),
        step('II', 'Feed the machine', 'It extracts the average of everything inside the square. Find the color, zoom, walk closer, shade the light with your hand. No orange? Blend red and yellow in the square.'),
        step('III', 'Extract', 'Only then does the machine blend what it caught into one color. Botched 10 points … Flawless 100. When time runs out, the machine extracts whatever it holds. Every color is a drop in your brew: from Gunk to the Elixir of Life.'),
        step('IV', 'Reactions', 'The qualities of your latest extracts can set off a reaction: extracts are exposed for a few seconds, and you drop ingredients into them to bring them closer to their colors. All five are below.'),
      ),
      h('h2', { class: 'howto-sub' }, 'Reactions'),
      reactionGuide(),
      h('p', { class: 'muted small' }, 'Trust your eyes: compare the frame with what is inside it, then extract.'),
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
        h('h2', null, 'The Alchemist needs eyes.'),
        h('p', null, 'We use your camera to find colors around you. Your photos stay on your device. Nothing is uploaded.'),
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
          'Open the eye',
        ),
        h('button', { class: 'btn ghost', type: 'button', onclick: onPractice }, 'No camera? Try practice'),
        h('button', { class: 'btn ghost', type: 'button', onclick: () => goTitle() }, 'Back'),
      ),
    );
  }, 'prompt');
}

export function cameraErrorScreen(err: CameraError, retry: () => void, onPractice: () => void): void {
  show((screen) => {
    screen.append(
      h(
        'div',
        { class: 'center-col' },
        h('div', { class: 'eye closed', 'aria-hidden': 'true' }, '◌'),
        h('h2', null, 'The eye will not open.'),
        h('p', null, CAMERA_ERROR_TEXT[err]),
        h('button', { class: 'btn primary', type: 'button', onclick: retry }, 'Try again'),
        h('button', { class: 'btn', type: 'button', onclick: onPractice }, 'Play practice instead'),
        h('button', { class: 'btn ghost', type: 'button', onclick: () => goTitle() }, 'Back'),
      ),
    );
  }, 'error');
}
