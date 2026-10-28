// Menu palettes: "is your life full of colors?" Every page outside the hunt gets
// its own palette. A new set every refresh for now; switch PALETTE_ROTATION to
// 'daily' for one set per day. The hunt screen stays neutral on purpose:
// surrounding colors change how players perceive the color in the square.

import { deltaEOK, hexToLinear, hexToOklab, mixLab, oklabToHex } from '../color/oklab';
import { mulberry32, randomSeed } from '../meta/rng';

export const PALETTE_ROTATION = 'refresh' as 'refresh' | 'daily';

export interface Palette {
  name: string;
  /** pastel, neon, bright, dull, earthy, dark… for variety, not logic. */
  mood: string;
  bg: string;
  fg: string;
  accents: [string, string, string, string, string];
}

export const PALETTES: Palette[] = [
  { name: 'Sherbet', mood: 'pastel', bg: '#fff4e8', fg: '#2b2140', accents: ['#ff8fab', '#ffc46b', '#9be7c4', '#8ecae6', '#cdb4db'] },
  { name: 'Neon Arcade', mood: 'neon', bg: '#0b0221', fg: '#f8f7ff', accents: ['#ff2bd6', '#00f0ff', '#f9f871', '#7cff4f', '#ff6b1a'] },
  { name: 'Riso Print', mood: 'bright', bg: '#f6f1e6', fg: '#1b1b3a', accents: ['#ff48b0', '#0078bf', '#ffe800', '#00a95c', '#ff6c2f'] },
  { name: 'Candy Shop', mood: 'bright', bg: '#ffe3f1', fg: '#3a0c3a', accents: ['#ff5fa2', '#ffc93c', '#2ec4b6', '#5548e0', '#ff8a5b'] },
  { name: 'Deep Sea', mood: 'dark', bg: '#04293a', fg: '#ecf9ff', accents: ['#00c2cb', '#64f4ac', '#ffd23f', '#ee4266', '#9ad1ff'] },
  { name: 'Terracotta Sun', mood: 'earthy', bg: '#f2e3d5', fg: '#3b2418', accents: ['#c8553d', '#f28f3b', '#e9b44c', '#588b8b', '#2d3047'] },
  { name: 'Matcha Latte', mood: 'dull', bg: '#e9edc9', fg: '#2f3e1f', accents: ['#588157', '#a3b18a', '#dda15e', '#bc6c25', '#6b705c'] },
  { name: 'Synthwave', mood: 'neon', bg: '#1a0933', fg: '#ffe8ff', accents: ['#ff00a0', '#ff8a00', '#ffe600', '#00e1ff', '#b26cff'] },
  { name: 'Bauhaus', mood: 'bright', bg: '#f4efe1', fg: '#111111', accents: ['#e63946', '#1d3557', '#f1c40f', '#2a9d8f', '#f77f00'] },
  { name: 'Lavender Fog', mood: 'pastel', bg: '#ede7f6', fg: '#2e2347', accents: ['#9575cd', '#f48fb1', '#80deea', '#fff176', '#aed581'] },
  { name: 'Citrus Pop', mood: 'bright', bg: '#fff8dc', fg: '#2a2a00', accents: ['#ff7a00', '#ffd000', '#8ac926', '#00c49a', '#ff3d7f'] },
  { name: 'Midnight Garden', mood: 'dark', bg: '#0f1a14', fg: '#eaf4e4', accents: ['#7bd389', '#f7b2bd', '#f6e27f', '#a0c4ff', '#ff8c61'] },
  { name: 'Dusty Rose', mood: 'dull', bg: '#efe1df', fg: '#3d2b2b', accents: ['#c08497', '#9a8c98', '#7fb0a4', '#d4a373', '#6d7fa3'] },
  { name: 'Toxic', mood: 'neon', bg: '#111111', fg: '#f2ffe6', accents: ['#b6ff00', '#00ffb3', '#ff00f5', '#ffe100', '#00b3ff'] },
  { name: 'Ocean Pastel', mood: 'pastel', bg: '#e6f7ff', fg: '#12304a', accents: ['#5ab9f2', '#7ee0d1', '#ffa8c5', '#ffd77a', '#a8a4ff'] },
  { name: 'Autumn Market', mood: 'earthy', bg: '#2b1b12', fg: '#fff1e0', accents: ['#e85d04', '#faa307', '#d62828', '#8ab17d', '#ffba08'] },
  { name: 'Disco', mood: 'bright', bg: '#3a0ca3', fg: '#ffffff', accents: ['#f72585', '#4cc9f0', '#ffd60a', '#06d6a0', '#ff9e00'] },
  { name: 'Vintage Postcard', mood: 'dull', bg: '#e8dcc4', fg: '#2f2a24', accents: ['#d17a22', '#5e8c61', '#8e3b46', '#4a6c8c', '#e3b505'] },
  { name: 'Ice Cream', mood: 'pastel', bg: '#fffdf7', fg: '#3b2c35', accents: ['#ff7b8a', '#ffb085', '#f7d488', '#9ad89b', '#8fc9f2'] },
  { name: 'Tropical', mood: 'bright', bg: '#ffe66d', fg: '#1a1a2e', accents: ['#ff6b6b', '#1a9e97', '#1a535c', '#ff9f1c', '#c44dff'] },
  { name: 'Slate & Coral', mood: 'dull', bg: '#2f3640', fg: '#f5f6fa', accents: ['#ff7f6b', '#ffd479', '#7ed6df', '#c7ecee', '#e056fd'] },
];

export type PageId = 'title' | 'howto' | 'prompt' | 'error' | 'board' | 'summary' | 'dialog' | 'result';
const PAGES: PageId[] = ['title', 'howto', 'prompt', 'error', 'board', 'summary', 'dialog', 'result'];

/** Relative luminance (WCAG). */
export function luminance(hex: string): number {
  const [r, g, b] = hexToLinear(hex);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrast(a: string, b: string): number {
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

function mix(a: string, b: string, t: number): string {
  return oklabToHex(mixLab(hexToOklab(a), hexToOklab(b), t));
}

/** The accent that stands out most from the background: the primary button. */
export function primaryAccent(p: Palette): string {
  let best = p.accents[0];
  let bestD = -1;
  for (const a of p.accents) {
    const d = deltaEOK(hexToOklab(a), hexToOklab(p.bg));
    if (d > bestD) {
      bestD = d;
      best = a;
    }
  }
  return best;
}

/** Text color for a filled accent: whichever of black/white reads better. */
export function inkOn(bg: string): string {
  return contrast(bg, '#111111') >= contrast(bg, '#ffffff') ? '#111111' : '#ffffff';
}

function daySeed(): number {
  const d = new Date();
  return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
}

const seed = PALETTE_ROTATION === 'daily' ? daySeed() : randomSeed();
const assignment: Record<string, Palette> = (() => {
  const rng = mulberry32(seed);
  const order = [...PALETTES];
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  return Object.fromEntries(PAGES.map((p, i) => [p, order[i % order.length]]));
})();

export function paletteFor(page: PageId): Palette {
  return assignment[page];
}

/** CSS custom properties for a palette. */
export function paletteVars(p: Palette): Record<string, string> {
  const primary = primaryAccent(p);
  const dark = luminance(p.bg) < 0.2;
  return {
    '--bg': p.bg,
    '--text': p.fg,
    '--panel': mix(p.bg, p.fg, 0.07),
    '--line': mix(p.bg, p.fg, 0.28),
    '--muted': mix(p.bg, p.fg, 0.68),
    '--btn-bg': 'transparent',
    '--btn-fg': p.fg,
    '--primary-bg': primary,
    '--primary-fg': inkOn(primary),
    '--p1': p.accents[0],
    '--p2': p.accents[1],
    '--p3': p.accents[2],
    '--p4': p.accents[3],
    '--p5': p.accents[4],
    // Readable text on each accent when it is used as a fill.
    '--p1-ink': inkOn(p.accents[0]),
    '--p2-ink': inkOn(p.accents[1]),
    '--p3-ink': inkOn(p.accents[2]),
    '--p4-ink': inkOn(p.accents[3]),
    '--p5-ink': inkOn(p.accents[4]),
    'color-scheme': dark ? 'dark' : 'light',
  };
}

export function applyPaletteTo(el: HTMLElement, p: Palette): void {
  for (const [k, v] of Object.entries(paletteVars(p))) el.style.setProperty(k, v);
}

export function clearPalette(el: HTMLElement): void {
  for (const k of Object.keys(paletteVars(PALETTES[0]))) el.style.removeProperty(k);
}
