// App shell: one page, no URL routing (iOS re-prompts for the camera on route changes).
// Menu pages get their own palette and a paint-wipe transition; the hunt stays neutral.

import { h } from './ui/dom';
import { getSettings, updateSettings } from './meta/storage';
import { sfx, unlockAudio } from './audio/sfx';
import { applyPaletteTo, clearPalette, paletteFor, primaryAccent, type PageId, type Palette } from './ui/palettes';
import { fx, paintWipe } from './ui/fx';

/** 'night' = neutral dark (hunt), 'paper' = neutral light (Classic screens), or a palette page. */
export type Theme = 'night' | 'paper' | PageId;
type Cleanup = () => void;

let cleanup: Cleanup | null = null;
let first = true;
let current: Palette | null = null;

const PAGE_IDS = new Set<string>(['title', 'howto', 'prompt', 'error', 'board', 'summary', 'dialog']);

/** The palette of the page on screen (null on neutral screens). */
export function currentPalette(): Palette | null {
  return current;
}

export function show(render: (screen: HTMLElement) => Cleanup | void, theme: Theme = 'night', cls = ''): void {
  const palette = PAGE_IDS.has(theme) ? paletteFor(theme as PageId) : null;
  const swap = () => {
    try {
      cleanup?.();
    } catch (e) {
      console.warn(e);
    }
    cleanup = null;
    current = palette;
    const root = document.documentElement;
    if (palette) {
      applyPaletteTo(root, palette);
      document.body.dataset.theme = 'palette';
    } else {
      clearPalette(root);
      document.body.dataset.theme = theme;
    }
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', palette ? palette.bg : theme === 'paper' ? '#f7f5f0' : '#0f0f12');
    fx.ambient(palette ? palette.accents : null);
    const app = document.getElementById('app')!;
    const screen = h('main', { class: `screen ${cls}`.trim() });
    if (palette) screen.append(decor());
    app.replaceChildren(screen);
    window.scrollTo(0, 0);
    cleanup = render(screen) || null;
    requestAnimationFrame(() => screen.classList.add('in'));
  };
  if (first) {
    first = false;
    swap();
    return;
  }
  sfx.whoosh();
  paintWipe(palette ? primaryAccent(palette) : current ? primaryAccent(current) : '#1a1a1f', swap);
}

/** Big soft drifting blobs in the page's accents. */
function decor(): HTMLElement {
  return h('div', { class: 'decor', 'aria-hidden': 'true' }, h('i', { class: 'b1' }), h('i', { class: 'b2' }), h('i', { class: 'b3' }), h('i', { class: 'b4' }), h('i', { class: 'b5' }));
}

/** Give an overlay (dialog) its own palette. */
export function paletteOverlay(el: HTMLElement, page: PageId): void {
  applyPaletteTo(el, paletteFor(page));
  el.classList.add('palette-overlay');
}

// Every tap on a button on a colorful page throws a little burst of its colors.
document.addEventListener('click', (e) => {
  const t = (e.target as HTMLElement | null)?.closest('.btn, .icon-btn, .tab');
  if (!t || (e.clientX === 0 && e.clientY === 0)) return;
  const overlay = t.closest('.palette-overlay') as HTMLElement | null;
  const colors = overlay ? overlayAccents(overlay) : current?.accents;
  if (colors?.length) fx.burst(e.clientX, e.clientY, colors, { count: 14, speed: 220, size: 6, gravity: 380 });
});

function overlayAccents(o: HTMLElement): string[] {
  return ['--p1', '--p2', '--p3', '--p4', '--p5'].map((v) => o.style.getPropertyValue(v).trim()).filter(Boolean);
}

/** Register a keydown handler that is removed with the screen. */
export function onKeys(handler: (e: KeyboardEvent) => void): Cleanup {
  const fn = (e: KeyboardEvent) => {
    const t = e.target as HTMLElement | null;
    if (t && t.tagName === 'INPUT' && (t as HTMLInputElement).type === 'text') return;
    handler(e);
  };
  window.addEventListener('keydown', fn);
  return () => window.removeEventListener('keydown', fn);
}

export function muteButton(): HTMLButtonElement {
  const btn = h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Sound' });
  const paint = () => {
    const muted = getSettings().muted;
    btn.textContent = muted ? '♪̸' : '♪';
    btn.setAttribute('aria-pressed', String(!muted));
    btn.title = muted ? 'Sound off' : 'Sound on';
  };
  paint();
  btn.addEventListener('click', () => {
    updateSettings({ muted: !getSettings().muted });
    paint();
    unlockAudio();
    sfx.tap();
  });
  return btn;
}

/** The thin bar at the top that gains one band per color found this run. */
export function spectrumBar(found: string[], total = 6): HTMLElement {
  const bar = h('div', { class: 'spectrum', 'aria-hidden': 'true' });
  for (let i = 0; i < total; i++) {
    bar.append(h('span', { style: found[i] ? { background: found[i] } : {} }));
  }
  return bar;
}

export function confirmDialog(text: string, yes: string, no: string): Promise<boolean> {
  return new Promise((resolve) => {
    const close = (v: boolean) => {
      overlay.remove();
      resolve(v);
    };
    const overlay = h(
      'div',
      { class: 'overlay', role: 'dialog', 'aria-modal': 'true' },
      h(
        'div',
        { class: 'dialog' },
        h('p', null, text),
        h(
          'div',
          { class: 'row' },
          h('button', { class: 'btn', type: 'button', onclick: () => close(false) }, no),
          h('button', { class: 'btn primary', type: 'button', onclick: () => close(true) }, yes),
        ),
      ),
    );
    paletteOverlay(overlay, 'dialog');
    document.body.append(overlay);
    (overlay.querySelector('.btn.primary') as HTMLElement)?.focus();
  });
}
