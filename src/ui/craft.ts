// The craft: what a run is making. Each rank is a different kind of object, and the
// higher the rank, the more colors it uses and the brighter they are:
//   Prima Materia  dull, round-ish blobs: a starter batch
//   Trinket        polygons (5–8 sides) budding out of a core, always touching it
//   Curio          an artifact: a plate inlaid with rings of shiny, slightly irregular polygons
//   Marvel         a Clifford attractor, drifting like shining gas
//   Magnum Opus    big, full Maurer roses in every color
// Recolored from a random palette every time it's drawn.

import { hexToOklab, hue, mixLab, oklabToHex } from '../color/oklab';
import { SEVEN } from '../data/tuning';
import { PALETTES, type Palette } from './palettes';

export const CRAFT_BLURBS = ['a starter batch', 'a modest bauble', 'a curious contraption', 'a thing of wonder', 'the Great Work, complete'];

export function craftName(index: number): string {
  return SEVEN.craftTiers[Math.max(0, Math.min(SEVEN.craftTiers.length - 1, index))].name;
}

type Rng = () => number;

const RAD = Math.PI / 180;

function shuffle<T>(rng: Rng, arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const f = (n: number) => n.toFixed(1);
const f2 = (n: number) => n.toFixed(2);

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

/** A polygon with jittered corners: n sides, radius r ± jitter. Corners stay in order, so it never crosses itself. */
function irregular(rng: Rng, n: number, r: number, jitter = 0.3): string {
  return (
    Array.from({ length: n }, (_, i) => {
      const a = ((i + (rng() - 0.5) * 0.5) / n) * Math.PI * 2;
      const rr = r * (1 - jitter / 2 + rng() * jitter);
      return `${i ? 'L' : 'M'}${f(Math.cos(a) * rr)},${f(Math.sin(a) * rr)}`;
    }).join(' ') + 'Z'
  );
}

/**
 * One diagonal sheen gradient per color (light → color → shade), for facets that catch
 * the light. Each facet is turned at random, so the sheens glint in different directions.
 */
function sheens(cols: string[], uid: string): string {
  return cols
    .map((c, k) => `<linearGradient id="${uid}-sheen${k}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${mixHex(c, '#ffffff', 0.6)}"/><stop offset=".45" stop-color="${c}"/><stop offset="1" stop-color="${mixHex(c, '#000000', 0.2)}"/></linearGradient>`)
    .join('');
}

function mixHex(a: string, b: string, t: number): string {
  return oklabToHex(mixLab(hexToOklab(a), hexToOklab(b), t));
}

/** Prima Materia's raw, muddy look: the palette color stirred into brown. */
function muddy(hex: string): string {
  return mixHex(hex, '#4b4038', 0.55);
}

function sparkles(rng: Rng, n: number, fills: string[]): string {
  return Array.from({ length: n }, (_, i) => {
    const a = rng() * Math.PI * 2;
    const r = 55 + rng() * 40;
    const s = 3 + rng() * 5;
    return `<path class="twinkle" style="animation-delay:${f(-rng() * 3)}s" d="${star(4, s, s * 0.3)}" fill="${fills[i % fills.length]}" transform="translate(${f(Math.cos(a) * r)},${f(Math.sin(a) * r)})"/>`;
  }).join('');
}

// The color ladder. Lightness and chroma are set per rank, not taken from the palette,
// so a dull palette can't make a high rank look duller than a low one. Prima Materia
// keeps its own muddy look (no ladder colors). Trinket uses the palette's own hues;
// Curio and Marvel fan out from the palette's lead hue and Magnum Opus holds the whole
// spectrum. (Trinket: 3 colors, Curio 4, Marvel 5, Magnum Opus 8.)
const LADDER = [
  { count: 0, L: 0, C: 0, fan: 0 },
  { count: 3, L: 0.64, C: 0.125, fan: 0 },
  { count: 4, L: 0.72, C: 0.13, fan: 150 },
  { count: 5, L: 0.8, C: 0.17, fan: 260 },
  { count: 8, L: 0.8, C: 0.2, fan: 360 },
];

/** The colors a rank may use: more of them, and brighter, the higher the rank. */
function tones(c: string[], tier: number): string[] {
  const { count, L, C, fan } = LADDER[tier];
  const h0 = hue(hexToOklab(c[0]));
  return Array.from({ length: count }, (_, i) => {
    const h = (fan ? h0 + (fan * i) / (fan >= 360 ? count : count - 1) : hue(hexToOklab(c[i]))) * RAD;
    // A little lightness variety within the rank, so neighbors still separate.
    const l = L + ((i % 3) - 1) * 0.035;
    return oklabToHex({ L: l, a: C * Math.cos(h), b: C * Math.sin(h) });
  });
}

function rgb255(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

// Clifford attractor parameters (a, b, c, d) that make open, wispy clouds: each covers
// 22–37% of its square. Nudged a little they can collapse into a few points, so a layer
// that comes out too sparse is drawn from the un-nudged set instead.
const CLIFFORD: [number, number, number, number][] = [
  [-1.4, 1.6, 1.0, 0.7],
  [1.7, 1.7, 0.6, 1.2],
  [1.5, -1.8, 1.6, 0.9],
  [-1.8, -2.0, -0.5, -0.9],
  [-1.3, -1.3, -1.8, -1.9],
  [2.01, -2.53, 1.61, -0.33],
  [-1.85, -2.5, -1.2, 0.5],
];
const MIN_COVER = 0.04;

/** Separable box blur of an RGBA-count buffer (radius r), wrapping nothing: edges fade. */
function boxBlur(src: Float32Array, size: number, r: number): Float32Array {
  const tmp = new Float32Array(src.length);
  const out = new Float32Array(src.length);
  const w = 1 / (2 * r + 1);
  for (const [from, to, horizontal] of [
    [src, tmp, true],
    [tmp, out, false],
  ] as const) {
    for (let line = 0; line < size; line++) {
      for (let ch = 0; ch < 4; ch++) {
        let sum = 0;
        const at = (i: number) => (horizontal ? (line * size + i) * 4 + ch : (i * size + line) * 4 + ch);
        for (let i = -r; i < size + r; i++) {
          if (i + r < size) sum += from[at(i + r)];
          if (i - r - 1 >= 0) sum -= from[at(i - r - 1)];
          if (i >= 0 && i < size) to[at(i)] = sum * w;
        }
      }
    }
  }
  return out;
}

/**
 * One layer of the Quintessence cloud as a PNG data URL: the attractor's points
 * piled into a density image, colored by their direction from the center (a color
 * wheel, so every color shows). Raster,
 * not SVG dots: tens of thousands of points stay cheap to move, and the density
 * is what makes it look like gas.
 */
function attractorLayer(p: [number, number, number, number], cols: string[], size: number): string | null {
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  const [a, b, c, d] = p;
  const N = 50000;
  const xs = new Float32Array(N);
  const ys = new Float32Array(N);
  let x = 0.1;
  let y = 0.1;
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (let i = -100; i < N; i++) {
    const nx = Math.sin(a * y) + c * Math.cos(a * x);
    const ny = Math.sin(b * x) + d * Math.cos(b * y);
    if (i >= 0) {
      xs[i] = nx;
      ys[i] = ny;
      minX = Math.min(minX, nx);
      maxX = Math.max(maxX, nx);
      minY = Math.min(minY, ny);
      maxY = Math.max(maxY, ny);
    }
    x = nx;
    y = ny;
  }
  const scale = (size * 0.92) / Math.max(maxX - minX, maxY - minY, 1e-6);
  const ox = size / 2 - ((minX + maxX) / 2) * scale;
  const oy = size / 2 - ((minY + maxY) / 2) * scale;
  const acc = new Float32Array(size * size * 4);
  const rgb = cols.map(rgb255);
  const half = size / 2;
  let filled = 0;
  for (let i = 0; i < N; i++) {
    const px = Math.floor(xs[i] * scale + ox);
    const py = Math.floor(ys[i] * scale + oy);
    if (px < 0 || py < 0 || px >= size || py >= size) continue;
    const o = (py * size + px) * 4;
    if (!acc[o + 3]) filled++;
    // Smoothly around the wheel: blend the two nearest colors.
    const t = ((Math.atan2(py - half, px - half) / (2 * Math.PI) + 1) % 1) * rgb.length;
    const k = Math.floor(t);
    const u = t - k;
    const p = rgb[k % rgb.length];
    const q = rgb[(k + 1) % rgb.length];
    acc[o] += p[0] + (q[0] - p[0]) * u;
    acc[o + 1] += p[1] + (q[1] - p[1]) * u;
    acc[o + 2] += p[2] + (q[2] - p[2]) * u;
    acc[o + 3] += 1;
  }
  if (filled < size * size * MIN_COVER) return null;
  // A blurred copy of the same piles makes a faint haze around the filaments.
  const haze = boxBlur(acc, size, 3);
  const img = ctx.createImageData(size, size);
  for (let o = 0; o < acc.length; o += 4) {
    const n = acc[o + 3] + haze[o + 3] * 0.3;
    if (n < 1e-3) continue;
    // Shine: the densest filaments burn toward white.
    const w = Math.min(0.6, acc[o + 3] / 18);
    img.data[o] = ((acc[o] + haze[o] * 0.3) / n) * (1 - w) + 255 * w;
    img.data[o + 1] = ((acc[o + 1] + haze[o + 1] * 0.3) / n) * (1 - w) + 255 * w;
    img.data[o + 2] = ((acc[o + 2] + haze[o + 2] * 0.3) / n) * (1 - w) + 255 * w;
    img.data[o + 3] = 255 * (1 - Math.exp(-(acc[o + 3] * 0.8 + haze[o + 3] * 0.5)));
  }
  ctx.putImageData(img, 0, 0);
  return canvas.toDataURL('image/png');
}

// Maurer roses (n, d). d shares no factor with 360, so all 360 chords are distinct. The
// outer rose has an even n (2n petals all the way round), so it's always full and round.
const MAURER_OUTER: [number, number][] = [
  [6, 71],
  [4, 97],
  [8, 73],
  [6, 109],
];
const MAURER_INNER: [number, number][] = [
  [4, 31],
  [3, 47],
  [5, 97],
];

/**
 * A Maurer rose: 360 chords hopping d° at a time along r = R·sin(nθ). Each chord takes
 * the color of the direction it sits in, so the colors go round the rose like a wheel.
 */
function maurer(n: number, d: number, R: number, cols: string[], width: number, turn = 0): string {
  const pts = Array.from({ length: 361 }, (_, k) => {
    const th = k * d * RAD;
    const r = R * Math.sin(n * th);
    return [r * Math.cos(th), r * Math.sin(th)];
  });
  const paths = cols.map(() => '');
  for (let k = 0; k < 360; k++) {
    const [x0, y0] = pts[k];
    const [x1, y1] = pts[k + 1];
    const a = (Math.atan2(y0 + y1, x0 + x1) / (2 * Math.PI) + 1 + turn) % 1;
    paths[Math.floor(a * cols.length) % cols.length] += `M${f(x0)},${f(y0)}L${f(x1)},${f(y1)}`;
  }
  return paths.map((d, i) => (d ? `<path d="${d}" fill="none" stroke="${cols[i]}" stroke-width="${width}" stroke-linecap="round"/>` : '')).join('');
}

function rose(n: number, R: number): string {
  return (
    Array.from({ length: 721 }, (_, i) => {
      const th = i * 0.5 * RAD;
      const r = R * Math.sin(n * th);
      return `${i ? 'L' : 'M'}${f(r * Math.cos(th))},${f(r * Math.sin(th))}`;
    }).join(' ') + 'Z'
  );
}

export function randomPalette(): Palette {
  return PALETTES[Math.floor(Math.random() * PALETTES.length)];
}

/** SVG markup for a craft of rank `tier` (0 = Prima Materia … 4 = Magnum Opus). */
export function craftSvg(tier: number, palette: Palette = randomPalette(), rng: Rng = Math.random): string {
  tier = Math.max(0, Math.min(LADDER.length - 1, tier));
  const c = shuffle(rng, palette.accents);
  const col = tones(c, tier);
  // Unique ids: several crafts can share a page.
  const uid = `c${Math.floor(rng() * 1e9).toString(36)}`;
  let defs = '';
  let body = '';
  let haloOpacity = 0.55;
  switch (tier) {
    case 0: {
      // Prima Materia: raw blobs slumped together, a couple of drips.
      const shadow = '<ellipse cx="0" cy="78" rx="46" ry="7" fill="rgba(0,0,0,.18)"/>';
      const blobs = Array.from({ length: 3 + Math.floor(rng() * 3) }, (_, i) =>
        `<path d="${blob(rng, -30 + rng() * 60, 30 + rng() * 25, 20 + rng() * 18, 0.45)}" fill="${muddy(c[i % 5])}"/>`,
      ).join('');
      const drips = Array.from({ length: 2 }, (_, i) => `<ellipse class="drip" style="animation-delay:${i * 0.9}s" cx="${f(-15 + rng() * 30)}" cy="62" rx="4" ry="6" fill="${muddy(c[i])}"/>`).join('');
      body = `${shadow}<g class="ooze">${blobs}<circle cx="${f(-8 + rng() * 16)}" cy="28" r="4" fill="rgba(255,255,255,.25)"/></g>${drips}`;
      break;
    }
    case 1: {
      // Trinket: polygons only (five to eight sides) around a core that rocks and breathes.
      // Pieces keep budding out of the center, drift a little and fade, one after another.
      // Each sits close enough to overlap the core even at the end of its drift, so
      // nothing ever floats free.
      const sides = () => 5 + Math.floor(rng() * 4);
      const core = 34;
      const period = 2.6;
      const m = 7 + Math.floor(rng() * 3);
      const turn = rng() * Math.PI * 2;
      for (let i = 0; i < m; i++) {
        const a = turn + (i / m) * Math.PI * 2 + (rng() - 0.5) * 0.5;
        const s = 15 + rng() * 10;
        const d = core * 0.65 + s * 0.5;
        const [x, y, dx, dy] = [Math.cos(a) * d, Math.sin(a) * d, Math.cos(a) * 4, Math.sin(a) * 4];
        const delay = -((i * 3) % m) * (period / m) - rng() * 0.15;
        body += `<g class="bud" style="--x:${f(x)}px;--y:${f(y)}px;--dx:${f(dx)}px;--dy:${f(dy)}px;transform:translate(${f(x)}px,${f(y)}px);animation-delay:${f2(delay)}s"><path d="${poly(sides(), s, rng() * 2)}" fill="${col[(i % 2) + 1]}"/><path d="${poly(sides(), s * 0.5, rng() * 2)}" fill="${col[0]}"/></g>`;
      }
      body += `<g class="rock"><g class="pulse"><path d="${poly(sides(), core, rng() * 2)}" fill="${col[0]}"/><path d="${poly(sides(), core * 0.55, rng() * 2)}" fill="${col[1]}"/><path d="${poly(sides(), core * 0.22, rng() * 2)}" fill="${col[2]}"/></g></g>`;
      break;
    }
    case 2: {
      // Curio, the bridge to Marvel: an artifact. A polygonal plate inlaid with two rings
      // of slightly irregular, sheened polygons and crowned with rays. Everything sits on
      // the plate, so nothing floats free. A gentle bulge flows round each ring (each
      // piece breathes a little later than its neighbor) while the rings turn slowly
      // against each other.
      haloOpacity = 0.45;
      defs =
        sheens(col, uid) +
        `<linearGradient id="${uid}-plate" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${mixHex(col[0], '#000000', 0.25)}"/><stop offset="1" stop-color="${mixHex(col[0], '#000000', 0.6)}"/></linearGradient>`;
      const wave = 2.8;
      // One piece of a ring, `j` of `k`, turned to its angle; its breathing is delayed
      // by its place in the ring (`waves` bulges go round at once).
      const piece = (j: number, k: number, waves: number, phase: number, shape: string) =>
        `<g transform="rotate(${f((j / k) * 360)})"><g class="wave" style="animation-delay:${f2(-((((j * waves) / k + phase) % 1) * wave))}s">${shape}</g></g>`;
      const facet = (R: number, s: number, fill: number) =>
        `<path d="${irregular(rng, 5 + Math.floor(rng() * 3), s, 0.25)}" transform="translate(${R},0) rotate(${f(rng() * 360)})" fill="url(#${uid}-sheen${fill})"/>`;
      let rays = '';
      let outer = '';
      let inner = '';
      for (let j = 0; j < 16; j++) {
        const w = 3 + rng() * 2;
        const len = 10 + rng() * 7;
        rays += piece(j + 0.5, 16, 2, 0.5, `<path d="M44,${f(-w)} L${f(46 + len)},${f((rng() - 0.5) * 3)} L44,${f(w)}Z" fill="url(#${uid}-sheen${j % 2 ? 3 : 0})"/>`);
      }
      for (let j = 0; j < 12; j++) outer += piece(j, 12, 2, 0.25, facet(39, 9 + rng() * 2, j % 4));
      for (let j = 0; j < 7; j++) inner += piece(j, 7, 1, 0, facet(22, 9 + rng() * 2, (j % 3) + 1));
      body = `<circle r="74" fill="url(#${uid}-halo)"/>
        <g stroke="#fff" stroke-opacity=".5" stroke-width="0.9" stroke-linejoin="round">
          <g class="spin-slower">${rays}<path d="${irregular(rng, 16, 49, 0.06)}" fill="url(#${uid}-plate)"/></g>
          <g class="spin-rev-slow">${outer}</g>
          <g class="spin-slow">${inner}</g>
          <g class="rock"><g class="pulse"><path d="${irregular(rng, 7, 14, 0.2)}" fill="url(#${uid}-sheen0)"/><path d="${irregular(rng, 5, 6, 0.2)}" fill="url(#${uid}-sheen2)"/></g></g>
        </g>
        ${sparkles(rng, 4, ['#ffffff', ...col])}`;
      break;
    }
    case 3: {
      // Marvel: a Clifford attractor in three slightly different layers that drift and
      // fade out of step, like shining gas.
      haloOpacity = 0.75;
      const base = CLIFFORD[Math.floor(rng() * CLIFFORD.length)];
      const params = [0, 1, 2].map(() => base.map((v) => v + (rng() - 0.5) * 0.08) as [number, number, number, number]);
      const layers = params.map((_, i) => `<g class="gas gas-${i}"><image id="${uid}-gas${i}" class="cloud" x="-95" y="-95" width="190" height="190"/></g>`);
      body = `<circle r="98" fill="url(#${uid}-halo)"/>${layers.join('')}${sparkles(rng, 12, ['#ffffff', ...col])}`;
      // A layer takes ~15–40 ms to draw, too long for the frame that shows the craft. So
      // the layers are drawn just after it's on screen, one per task, and fade in as they're
      // ready: the essence condenses. A layer whose craft was already replaced is skipped.
      if (typeof document !== 'undefined') {
        params.forEach((p, i) =>
          setTimeout(() => {
            const el = document.getElementById(`${uid}-gas${i}`);
            if (!el) return;
            const wheel = [...col.slice(i), ...col.slice(0, i)];
            const url = attractorLayer(p, wheel, 220) ?? attractorLayer(base, wheel, 220);
            if (!url) return;
            el.setAttribute('href', url);
            requestAnimationFrame(() => el.classList.add('on'));
          }, 40 + i * 70),
        );
      }
      break;
    }
    default: {
      // Magnum Opus: two Maurer roses in every color, turning against each other. The
      // outer one always fills the whole circle; a bright halo and sparkles make it shine.
      haloOpacity = 0.85;
      const [n1, d1] = MAURER_OUTER[Math.floor(rng() * MAURER_OUTER.length)];
      const [n2, d2] = MAURER_INNER[Math.floor(rng() * MAURER_INNER.length)];
      body = `<circle r="99" fill="url(#${uid}-halo)"/>
        <g class="spin-slower">${maurer(n1, d1, 96, col, 0.95)}<path d="${rose(n1, 96)}" fill="none" stroke="#fff" stroke-width="1.3" stroke-opacity=".75"/></g>
        <g class="spin-rev-slow">${maurer(n2, d2, 50, col, 0.8, 0.5)}<path d="${rose(n2, 50)}" fill="none" stroke="#fff" stroke-width="1" stroke-opacity=".8"/></g>
        <g class="breathe"><path d="${star(8, 13, 4.5)}" fill="#fff"/></g>
        ${sparkles(rng, 16, ['#ffffff', ...col])}`;
    }
  }
  const halo = col.length ? col[(tier + 1) % col.length] : '#000';
  return `<svg viewBox="-100 -100 200 200" aria-hidden="true" class="craft-svg">
  <defs><radialGradient id="${uid}-halo"><stop offset="0" stop-color="${halo}" stop-opacity="${haloOpacity}"/><stop offset="1" stop-color="${halo}" stop-opacity="0"/></radialGradient>${defs}</defs>
  ${body}
</svg>`;
}

/** A craft element with its own random palette. */
export function craftEl(tier: number, cls = ''): HTMLElement {
  const el = document.createElement('div');
  el.className = `craft tier-${tier} ${cls}`.trim();
  el.innerHTML = craftSvg(tier);
  return el;
}
