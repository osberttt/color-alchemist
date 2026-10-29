// Reusable bits: target cards, meters, grade stamps, logo.

import { ELEMENT_GLYPH, TIER_LABEL, type ColorDef } from '../data/colors';
import { flaskSvg, h, svg, vialSvg } from './dom';
import type { Grade } from '../scoring/score';

export const METER_WORDS = ['cold', 'cool', 'warm', 'hot', 'boiling'];

export function meterLevel(acc: number): number {
  if (acc >= 85) return 4;
  if (acc >= 70) return 3;
  if (acc >= 50) return 2;
  if (acc >= 30) return 1;
  return 0;
}

export interface Meter {
  el: HTMLElement;
  set(level: number | null): void;
}

export function meter(): Meter {
  const pips = Array.from({ length: 5 }, () => h('i'));
  const word = h('span', { class: 'meter-word' }, '—');
  const el = h('div', { class: 'meter', 'aria-live': 'off' }, h('span', { class: 'pips' }, ...pips), word);
  return {
    el,
    set(level) {
      pips.forEach((p, i) => p.classList.toggle('on', level !== null && i <= level));
      word.textContent = level === null ? '—' : METER_WORDS[level];
      el.dataset.level = level === null ? '' : String(level);
    },
  };
}

export function targetCard(def: ColorDef, label: 'A' | 'B', opts: { best?: number | null; meter?: Meter; big?: boolean } = {}): HTMLElement {
  return h(
    'div',
    { class: `target-card ${opts.big ? 'big' : ''} target-${label.toLowerCase()}`, style: { '--ing': def.target } },
    svg(vialSvg(def.target), 'vial'),
    h(
      'div',
      { class: 'tc-body' },
      h('div', { class: 'tc-name' }, def.name),
      h(
        'div',
        { class: 'tc-meta' },
        h('span', { class: 'tc-pattern', title: label === 'A' ? 'Lens pattern: hatching' : 'Lens pattern: dots', 'aria-label': `target ${label}` }),
        `${ELEMENT_GLYPH[def.element]} ${def.element} · ${TIER_LABEL[def.tier]}`,
      ),
      opts.best != null ? h('div', { class: 'tc-best' }, `your best ${opts.best}`) : null,
      opts.meter ? opts.meter.el : null,
    ),
  );
}

export function stamp(grade: Grade | string, extra = ''): HTMLElement {
  return h('span', { class: `stamp grade-${String(grade).toLowerCase().replace(/[^a-z]/g, '')} ${extra}`.trim() }, String(grade));
}

/** COLOR / CHEMY: the O's are flasks of color, every letter bounces in with its own accent. */
export function logo(colors: string[]): HTMLElement {
  let n = 0;
  const letter = (ch: string) => h('span', { class: 'll', style: { '--i': String(n++), '--c': `var(--p${(n % 5) + 1}, currentColor)` } }, ch);
  const flask = (fill: string) => {
    const el = svg(flaskSvg(fill, { level: 0.62 }), 'logo-o ll bubbling');
    el.style.setProperty('--i', String(n++));
    return el;
  };
  return h(
    'h1',
    { class: 'logo', 'aria-label': 'Colorchemy' },
    h('span', { class: 'logo-top', 'aria-hidden': 'true' }, letter('C'), flask(colors[0]), letter('L'), flask(colors[1]), letter('R')),
    h('span', { class: 'logo-bottom', 'aria-hidden': 'true' }, ...'CHEMY'.split('').map(letter)),
  );
}

export function swatch(hex: string, label?: string): HTMLElement {
  return h('span', { class: 'swatch', style: { background: hex }, title: label ?? hex, 'aria-label': label ?? '' });
}
