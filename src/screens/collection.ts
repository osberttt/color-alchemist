// The Grimoire (your colors, collected) and the offline leaderboard.

import { currentPalette, onKeys, show } from '../app';
import { centerOf, fx } from '../ui/fx';
import { sfx } from '../audio/sfx';
import { COLORS, ELEMENTS, ELEMENT_GLYPH, TIER_LABEL, color, type ColorDef } from '../data/colors';
import { FORMULAE } from '../data/formulae';
import { getBoard, getFormulaeFound, getGrimoire, type BoardKind, type GrimoireEntry } from '../meta/storage';
import { h, flaskSvg, svg, fmt } from '../ui/dom';
import { swatch } from '../ui/components';
import { goTitle, goBoard } from '../flow';

export function grimoireScreen(): void {
  show(
    (screen) => {
      const g = getGrimoire();
      const found = Object.keys(g).length;
      const formulae = getFormulaeFound();
      const shelf = h('div', { class: 'shelf' });
      for (const el of ELEMENTS) {
        const cols = COLORS.filter((c) => c.element === el);
        shelf.append(
          h(
            'section',
            { class: 'shelf-row' },
            h('h3', null, `${ELEMENT_GLYPH[el]} ${el}`, h('span', { class: 'muted small' }, ` ${cols.filter((c) => g[c.id]).length}/${cols.length}`)),
            h('div', { class: 'flasks' }, ...cols.map((c) => flaskButton(c, g[c.id]))),
          ),
        );
      }
      screen.append(
        h('div', { class: 'topbar' }, h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Back', onclick: () => goTitle() }, '←'), h('span', { class: 'stage-label' }, 'Grimoire'), h('span')),
        h(
          'div',
          { class: 'page' },
          h('h2', { class: 'page-title' }, 'The Grimoire'),
          h('p', { class: 'muted' }, `${found} of ${COLORS.length} colors found in your life. A flask fills when you find its color at Elixir or better.`),
          h('div', { class: 'progress' }, h('i', { style: { width: `${(found / COLORS.length) * 100}%` } })),
          shelf,
          h('h3', { class: 'formulae-title' }, `Famous Formulae · ${formulae.length}/${FORMULAE.length}`),
          h(
            'ul',
            { class: 'formulae' },
            ...FORMULAE.map((f) => {
              const known = formulae.includes(f.name);
              return h(
                'li',
                { class: known ? 'known' : '' },
                h('span', { class: 'p-sw' }, swatch(color(f.a).target), swatch(color(f.b).target)),
                h('span', null, known ? f.name : '? ? ?'),
                h('span', { class: 'muted small' }, `${color(f.a).name} + ${color(f.b).name}`),
              );
            }),
          ),
        ),
      );
      return onKeys((e) => {
        if (e.key === 'Escape') goTitle();
      });
    },
    'paper',
    'grimoire-screen',
  );
}

function flaskButton(c: ColorDef, entry: GrimoireEntry | undefined): HTMLElement {
  const btn = h(
    'button',
    { class: `flask-btn ${entry ? 'found' : ''}`, type: 'button', 'aria-label': entry ? `${c.name}, best ${entry.bestAcc}` : `${c.name}, not found yet`, onclick: () => flaskDetail(c, entry) },
    svg(flaskSvg(entry ? entry.hex : null, { level: entry ? 0.45 + (entry.bestAcc / 100) * 0.4 : 0 }), 'flask'),
    h('span', { class: 'f-name' }, c.name),
    h('span', { class: 'f-acc mono' }, entry ? String(entry.bestAcc) : '·'),
  );
  return btn;
}

function flaskDetail(c: ColorDef, entry: GrimoireEntry | undefined): void {
  const close = () => {
    overlay.remove();
    window.removeEventListener('keydown', key);
  };
  const key = (e: KeyboardEvent) => e.key === 'Escape' && close();
  window.addEventListener('keydown', key);
  const overlay = h(
    'div',
    { class: 'overlay', role: 'dialog', 'aria-modal': 'true', onclick: (e: Event) => e.target === overlay && close() },
    h(
      'div',
      { class: 'dialog paper-dialog' },
      h('h3', null, c.name),
      h('p', { class: 'muted small' }, `${ELEMENT_GLYPH[c.element]} ${c.element} · ${TIER_LABEL[c.tier]} · virtue: ${c.virtue}`),
      entry?.thumb ? h('img', { class: 'thumb', src: entry.thumb, alt: `Your ${c.name} photo` }) : null,
      h(
        'div',
        { class: 'pair-sw big' },
        h('figure', null, swatch(c.target), h('figcaption', null, 'target')),
        h('figure', null, swatch(entry ? entry.hex : 'transparent'), h('figcaption', null, entry ? 'yours' : 'not found yet')),
      ),
      entry ? h('p', null, `Best accuracy ${entry.bestAcc} · found ${new Date(entry.date).toLocaleDateString()}`) : h('p', { class: 'muted' }, 'Hunt for it in a run. It may come up in any brew of its tier.'),
      h('button', { class: 'btn primary', type: 'button', onclick: close }, 'Close'),
    ),
  );
  document.body.append(overlay);
}

export function boardScreen(kind: BoardKind): void {
  show(
    (screen) => {
      const board = getBoard(kind);
      const tab = (k: BoardKind, label: string) =>
        h('button', { class: `tab ${k === kind ? 'active' : ''}`, type: 'button', 'aria-pressed': String(k === kind), onclick: () => goBoard(k) }, label);
      screen.append(
        h('div', { class: 'topbar' }, h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Back', onclick: () => goTitle() }, '←'), h('span', { class: 'stage-label' }, 'Leaderboard'), h('span')),
        h(
          'div',
          { class: 'page' },
          h('h2', { class: 'page-title' }, 'The Ledger'),
          h('p', { class: 'muted' }, 'Your best potions on this device. Hand the phone to a friend and see who lives the most colorful life.'),
          h('div', { class: 'tabs' }, tab('seven', 'Live potions'), tab('seven-gallery', 'Gallery potions')),
          board.length
            ? h(
                'ol',
                { class: 'board stagger' },
                ...board.map((e, i) =>
                  h(
                    'li',
                    { class: i < 3 ? `top top${i + 1}` : '', style: { '--i': String(i), '--tint': `var(--p${(i % 5) + 1})` } },
                    h('span', { class: 'b-rank mono' }, i === 0 ? '★' : String(i + 1)),
                    h('span', { class: 'b-name' }, e.name, h('span', { class: 'muted small' }, ` ${new Date(e.date).toLocaleDateString()}`)),
                    h('span', { class: 'b-sw' }, ...e.swatches.slice(0, 7).map((s) => swatch(s))),
                    h('span', { class: 'b-band small' }, e.band),
                    h('span', { class: 'b-score mono' }, fmt(e.score)),
                  ),
                ),
              )
            : h('p', { class: 'empty' }, 'The ledger waits for your first Elixir of Life.'),
        ),
      );
      // Pop each of the top three as they land.
      const timers = [...screen.querySelectorAll('.board li.top')].map((li, i) =>
        window.setTimeout(() => {
          const c = centerOf(li.querySelector('.b-rank')!);
          const pal = currentPalette();
          fx.burst(c.x, c.y, pal?.accents ?? ['#ffd700'], { count: 22 - i * 6, speed: 240, shapes: ['star', 'circle'] });
          sfx.pop(4 - i);
        }, 380 + i * 140),
      );
      const offKeys = onKeys((e) => {
        if (e.key === 'Escape') goTitle();
      });
      return () => {
        timers.forEach(clearTimeout);
        offKeys();
      };
    },
    'board',
    'board-screen',
  );
}

