// The craft: what a run is making. Abstract shapes, more ordered and radiant per rank,
// recolored from a random palette every time it's drawn (Gunk → Magnum Opus).

import { hexToOklab, mixLab, oklabToHex } from '../color/oklab';
import { SEVEN } from '../data/tuning';
import { PALETTES, type Palette } from './palettes';

export const CRAFT_BLURBS = [
  'a bubbling failure',
  'a modest bauble',
  'a curious contraption',
  'a thing of wonder',
  'the fifth essence',
  'the Great Work, complete',
];

export function craftName(index: number): string {
  return SEVEN.craftTiers[Math.max(0, Math.min(SEVEN.craftTiers.length - 1, index))].name;
}

type Rng = () => number;

function shuffle<T>(rng: Rng, arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const f = (n: number) => n.toFixed(1);

function blob(rng: Rng, cx: number, cy: number, r: number, wobble: number, n = 9): string {
  const pts = Array.from({ length: n }, (_, i) => {
    const a = (i / n) * Math.PI * 2;
    const rr = r * (1 - wobble / 2 + rng() * wobble);
    return [cx + Math.cos(a) * rr, cy + Math.sin(a) * rr * 0.85];
  });
  const mid = (i: number) => {
    const p = pts[i % n];
    const q = pts[(i + 1) % n];
    return [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2];
  };
  let d = `M${f(mid(0)[0])},${f(mid(0)[1])}`;
  for (let i = 1; i <= n; i++) {
    const p = pts[i % n];
    const m = mid(i);
    d += ` Q${f(p[0])},${f(p[1])} ${f(m[0])},${f(m[1])}`;
  }
  return d + 'Z';
}

function poly(n: number, r: number, rot = 0): string {
  return (
    Array.from({ length: n }, (_, i) => {
      const a = rot + (i / n) * Math.PI * 2 - Math.PI / 2;
      return `${i ? 'L' : 'M'}${f(Math.cos(a) * r)},${f(Math.sin(a) * r)}`;
    }).join(' ') + 'Z'
  );
}

function star(n: number, r1: number, r2: number): string {
  return (
    Array.from({ length: n * 2 }, (_, i) => {
      const a = (i / (n * 2)) * Math.PI * 2 - Math.PI / 2;
      const r = i % 2 ? r2 : r1;
      return `${i ? 'L' : 'M'}${f(Math.cos(a) * r)},${f(Math.sin(a) * r)}`;
    }).join(' ') + 'Z'
  );
}

type PetalKind = 'leaf' | 'diamond' | 'drop' | 'blade';

/** A petal pointing up from the center, from radius `inner` to `inner + len`. */
function petal(kind: PetalKind, inner: number, len: number, w: number): string {
  const y0 = -inner;
  const y1 = -inner - len;
  switch (kind) {
    case 'diamond':
      return `M0,${f(y0)} L${f(w / 2)},${f((y0 + y1) / 2)} L0,${f(y1)} L${f(-w / 2)},${f((y0 + y1) / 2)}Z`;
    case 'drop':
      return `M0,${f(y1)} Q${f(w / 2)},${f(y0 - len * 0.35)} 0,${f(y0)} Q${f(-w / 2)},${f(y0 - len * 0.35)} 0,${f(y1)}Z`;
    case 'blade':
      return `M${f(-w / 4)},${f(y0)} L${f(w / 4)},${f(y0)} L0,${f(y1)}Z`;
    default:
      return `M0,${f(y0)} Q${f(w / 2)},${f((y0 + y1) / 2)} 0,${f(y1)} Q${f(-w / 2)},${f((y0 + y1) / 2)} 0,${f(y0)}Z`;
  }
}

function ring(n: number, inner: number, len: number, w: number, kind: PetalKind, fill: string, offset = 0): string {
  const one = petal(kind, inner, len, w);
  return Array.from({ length: n }, (_, i) => `<path d="${one}" fill="${fill}" transform="rotate(${f(offset + (i * 360) / n)})"/>`).join('');
}

function dots(n: number, r: number, size: number, fill: string): string {
  return Array.from({ length: n }, (_, i) => {
    const a = (i / n) * Math.PI * 2;
    return `<circle cx="${f(Math.cos(a) * r)}" cy="${f(Math.sin(a) * r)}" r="${f(size)}" fill="${fill}"/>`;
  }).join('');
}

function sparkles(rng: Rng, n: number, fill: string): string {
  return Array.from({ length: n }, (_, i) => {
    const a = rng() * Math.PI * 2;
    const r = 55 + rng() * 40;
    const s = 3 + rng() * 5;
    return `<path class="twinkle" style="animation-delay:${f(-rng() * 3)}s" d="${star(4, s, s * 0.3)}" fill="${fill}" transform="translate(${f(Math.cos(a) * r)},${f(Math.sin(a) * r)})" data-i="${i}"/>`;
  }).join('');
}

function muddy(hex: string, t = 0.55): string {
  return oklabToHex(mixLab(hexToOklab(hex), hexToOklab('#4b4038'), t));
}

export function randomPalette(): Palette {
  return PALETTES[Math.floor(Math.random() * PALETTES.length)];
}

/** SVG markup for a craft of rank `tier` (0 = Gunk … 5 = Magnum Opus). */
export function craftSvg(tier: number, palette: Palette = randomPalette(), rng: Rng = Math.random): string {
  const c = shuffle(rng, palette.accents);
  const kinds: PetalKind[] = shuffle(rng, ['leaf', 'diamond', 'drop', 'blade']);
  const shadow = '<ellipse cx="0" cy="78" rx="46" ry="7" fill="rgba(0,0,0,.18)"/>';
  let body = '';
  switch (Math.max(0, Math.min(5, tier))) {
    case 0: {
      // Gunk: murky blobs slumped together, a couple of drips.
      const blobs = Array.from({ length: 3 + Math.floor(rng() * 3) }, (_, i) =>
        `<path d="${blob(rng, -30 + rng() * 60, 30 + rng() * 25, 20 + rng() * 18, 0.45)}" fill="${muddy(c[i % 5])}"/>`,
      ).join('');
      const drips = Array.from({ length: 2 }, (_, i) => `<ellipse class="drip" style="animation-delay:${i * 0.9}s" cx="${f(-15 + rng() * 30)}" cy="62" rx="4" ry="6" fill="${muddy(c[i])}"/>`).join('');
      body = `${shadow}<g class="ooze">${blobs}<circle cx="${f(-8 + rng() * 16)}" cy="28" r="4" fill="rgba(255,255,255,.25)"/></g>${drips}`;
      break;
    }
    case 1: {
      // Trinket: a few simple shapes, loosely stacked, bobbing.
      const shapes = ['circle', 'tri', 'square', 'star'];
      const parts = Array.from({ length: 3 + Math.floor(rng() * 2) }, (_, i) => {
        const s = 16 + rng() * 14;
        const x = -40 + i * 26 + rng() * 10;
        const y = 25 - rng() * 45;
        const kind = shapes[Math.floor(rng() * shapes.length)];
        const d = kind === 'circle' ? `M${f(-s)},0 a${f(s)},${f(s)} 0 1,0 ${f(s * 2)},0 a${f(s)},${f(s)} 0 1,0 ${f(-s * 2)},0Z` : kind === 'tri' ? poly(3, s * 1.2) : kind === 'square' ? poly(4, s * 1.25, Math.PI / 4) : star(5, s * 1.3, s * 0.55);
        return `<g transform="translate(${f(x)},${f(y)}) rotate(${f(rng() * 40 - 20)})"><path class="bob" style="animation-delay:${f(-rng() * 2)}s" d="${d}" fill="${c[i % 5]}"/></g>`;
      }).join('');
      body = `${shadow}${parts}`;
      break;
    }
    case 2: {
      // Curio: a faceted core with satellites on an orbit.
      const n = 5 + Math.floor(rng() * 3);
      const satCount = 3 + Math.floor(rng() * 3);
      const sats = Array.from({ length: satCount }, (_, i) => {
        const a = (i / satCount) * Math.PI * 2;
        const s = 7 + rng() * 6;
        return `<path d="${i % 2 ? poly(4, s, Math.PI / 4) : poly(12, s)}" fill="${c[(i + 2) % 5]}" transform="translate(${f(Math.cos(a) * 62)},${f(Math.sin(a) * 62)})"/>`;
      }).join('');
      body = `<circle r="62" fill="none" stroke="${c[4]}" stroke-width="2" stroke-dasharray="3 6" opacity=".7"/>
        <g class="spin-slow">${sats}</g>
        <g class="breathe"><path d="${poly(n, 38)}" fill="${c[0]}"/><path d="${poly(n, 22, Math.PI / n)}" fill="${c[1]}"/><circle r="8" fill="${c[3]}"/></g>`;
      break;
    }
    case 3: {
      // Marvel: six-fold bloom, a counter-turning star, an orbit of dots.
      const n = 6;
      body = `<g class="spin-rev-slow">${dots(12, 84, 4, c[4])}</g>
        <g class="spin-slow">${ring(n, 18, 52, 30, kinds[0], c[0])}</g>
        <g class="spin-rev">${ring(n, 10, 30, 16, kinds[1], c[1], 30)}</g>
        <g class="breathe"><path d="${star(n, 20, 10)}" fill="${c[2]}"/><circle r="7" fill="${c[3]}"/></g>`;
      break;
    }
    case 4: {
      // Quintessence: a glowing eight-fold mandala with sparkles.
      const n = 8;
      body = `<circle r="96" fill="url(#halo)"/>
        <g class="spin-slow">${ring(n, 22, 64, 26, kinds[0], c[0])}</g>
        <g class="spin-rev">${ring(n, 16, 40, 18, kinds[1], c[1], 22.5)}</g>
        <g class="spin-slow">${ring(n * 2, 12, 16, 6, kinds[2], c[2])}</g>
        <g class="breathe"><path d="${star(n, 18, 8)}" fill="${c[3]}"/><circle r="6" fill="#fff" opacity=".85"/></g>
        ${sparkles(rng, 7, c[4])}`;
      break;
    }
    default: {
      // Magnum Opus: rays, three counter-rotating twelve-fold layers, orbiting dots, halo.
      const n = 12;
      body = `<circle r="99" fill="url(#halo)"/>
        <g class="spin-slower">${ring(24, 60, 38, 6, 'blade', c[4], 7.5)}</g>
        <g class="spin-rev-slow">${dots(16, 90, 3.5, c[3])}</g>
        <g class="spin-slow">${ring(n, 26, 58, 20, kinds[0], c[0])}</g>
        <g class="spin-rev">${ring(n, 18, 40, 15, kinds[1], c[1], 15)}</g>
        <g class="spin-slow">${ring(6, 12, 24, 14, kinds[2], c[2], 30)}</g>
        <g class="breathe"><circle r="14" fill="${c[3]}"/><path d="${star(n, 12, 5)}" fill="#fff" opacity=".9"/><circle r="4" fill="${c[0]}"/></g>
        ${sparkles(rng, 12, '#ffffff')}`;
    }
  }
  const halo = c[(tier + 2) % 5];
  // Unique gradient id: several crafts can share a page.
  const id = `halo${Math.floor(rng() * 1e9).toString(36)}`;
  return `<svg viewBox="-100 -100 200 200" aria-hidden="true" class="craft-svg">
  <defs><radialGradient id="${id}"><stop offset="0" stop-color="${halo}" stop-opacity=".55"/><stop offset="1" stop-color="${halo}" stop-opacity="0"/></radialGradient></defs>
  ${body.replace(/url\(#halo\)/g, `url(#${id})`)}
</svg>`;
}

/** A craft element with its own random palette. */
export function craftEl(tier: number, cls = ''): HTMLElement {
  const el = document.createElement('div');
  el.className = `craft tier-${tier} ${cls}`.trim();
  el.innerHTML = craftSvg(tier);
  return el;
}
