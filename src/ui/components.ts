// Reusable bits: target cards, meters, grade stamps, logo.

import { ELEMENT_GLYPH, TIER_LABEL, type ColorDef } from '../data/colors';
import { flaskSvg, funnelSvg, h, svg, vialSvg } from './dom';
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

/**
 * COLORCHEMY on one line (ANALYSIS §4.36–4.37): every letter in color, and three of them lab
 * apparatus holding colored liquid: the O's are flasks, the Y a funnel. Every letter bounces in.
 * `fills`: liquid colors for O, O, Y. `letterColors`: colors for the letters, in turn; one
 * too close to the page gets a thin ink outline, so no letter melts into the background.
 */
export function logo(fills: string[], letterColors: { color: string; outline: boolean }[] = []): HTMLElement {
  let n = 0;
  let k = 0;
  const color = (ch: string) => {
    const c = letterColors.length ? letterColors[k++ % letterColors.length] : { color: 'var(--text)', outline: false };
    return h('span', { class: `ll${c.outline ? ' outlined' : ''}`, style: { '--i': String(n++), '--c': c.color } }, ch);
  };
  const apparatus = (markup: string, cls: string) => {
    const el = svg(markup, `logo-o ${cls} ll bubbling`);
    el.style.setProperty('--i', String(n++));
    return el;
  };
  const fill = (i: number) => fills[i % fills.length];
  return h(
    'h1',
    { class: 'logo', 'aria-label': 'Colorchemy' },
    h(
      'span',
      { class: 'logo-line', 'aria-hidden': 'true' },
      color('C'),
      apparatus(flaskSvg(fill(0), { level: 0.62 }), 'logo-flask'),
      color('L'),
      apparatus(flaskSvg(fill(1), { level: 0.62 }), 'logo-flask'),
      color('R'),
      color('C'),
      color('H'),
      color('E'),
      color('M'),
      apparatus(funnelSvg(fill(2)), 'logo-funnel'),
    ),
  );
}

export function swatch(hex: string, label?: string): HTMLElement {
  return h('span', { class: 'swatch', style: { background: hex }, title: label ?? hex, 'aria-label': label ?? '' });
}
