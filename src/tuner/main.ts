// The scoring tuner (dev and test builds only). Pick a target and move the values.
// A real capture is rarely off in just one way: it's a bit darker AND duller AND
// turned in hue at once. So besides one-direction examples, the tuner has a mix
// explorer (three offsets together, and how they add up) and rank maps that paint
// every combination of two offsets. Everything uses the game's real scoring code.

import '@fontsource-variable/inter/wght.css';
import '@fontsource/jetbrains-mono/400.css';
import './tuner.css';
import { COLORS, TIER_LABEL } from '../data/colors';
import { SEVEN, SEVEN_DEFAULTS, applyTunables, clearTunables, currentTunables, saveTunables, type SevenTunables } from '../data/tuning';
import { ciede2000, ciede2000Parts, cielabToLinear, fromLCh, hexToCielab, linearToCielab, toLCh, type DeltaParts, type LCh76, type Lab76 } from '../color/cielab';
import { linearToHex } from '../color/oklab';
import { camera, CAMERA_ERROR_TEXT } from '../camera/camera';
import { cameraSource, meanOfRect, squareRect, viewRect } from '../camera/source';
import { scoreFor, tierFor } from '../scoring/extract';
import { h } from '../ui/dom';
import { CRAFT_BLURBS, craftSvg } from '../ui/craft';
import '../ui/craft-anim.css';

interface Target {
  name: string;
  hex: string;
  meta: string;
}

const CRAFT_NAMES = SEVEN.craftTiers.map((t) => t.name);
const TIER_NAMES = SEVEN.colorTiers.map((t) => t.name);
const fmt1 = (n: number) => (Number.isFinite(n) ? n.toFixed(n < 10 ? 2 : 1) : '∞');
const RAD = Math.PI / 180;

// --- misses: how a color can be off ---------------------------------------------------
/** A miss as people describe it: lighter/darker (L*), more vivid/duller (chroma C*), hue turned (°). */
interface Offset {
  dL: number;
  dC: number;
  dh: number;
}
type Axis = keyof Offset;

const ZERO: Offset = { dL: 0, dC: 0, dh: 0 };

interface Shifted {
  lab: Lab76;
  hex: string;
  /** False when the miss asks for lightness outside 0–100 or negative chroma. */
  possible: boolean;
  /** False when no screen or camera (sRGB) can produce it exactly. */
  inGamut: boolean;
}

function shifted(base: LCh76, o: Offset): Shifted {
  const L = base.L + o.dL;
  const C = base.C + o.dC;
  const lab = fromLCh({ L: Math.min(100, Math.max(0, L)), C: Math.max(0, C), h: base.h + o.dh });
  const rgb = cielabToLinear(lab);
  return {
    lab,
    hex: linearToHex(...rgb),
    possible: L >= 0 && L <= 100 && C >= -1e-9,
    inGamut: rgb.every((v) => v >= -0.002 && v <= 1.002),
  };
}

/** How `lab` differs from the target, in the same terms as the mix. */
function offsetOf(base: LCh76, lab: Lab76): Offset {
  const s = toLCh(lab);
  let dh = s.h - base.h;
  if (dh > 180) dh -= 360;
  else if (dh < -180) dh += 360;
  return { dL: s.L - base.L, dC: s.C - base.C, dh };
}

// Approximate CIELAB hue angles of familiar names, to say which way a hue turns.
const HUE_NAMES: [number, string][] = [
  [0, 'pink'],
  [40, 'red'],
  [72, 'orange'],
  [100, 'yellow'],
  [136, 'green'],
  [190, 'cyan'],
  [240, 'sky blue'],
  [290, 'blue'],
  [325, 'purple'],
];

function hueName(h: number): string {
  let best = HUE_NAMES[0][1];
  let bestD = Infinity;
  for (const [a, name] of HUE_NAMES) {
    const d = Math.abs((((h - a) % 360) + 540) % 360 - 180);
    if (d < bestD) {
      bestD = d;
      best = name;
    }
  }
  return best;
}

/** The next named hue when turning from `h` in direction `sign`. */
function towards(h: number, sign: number): string {
  const here = hueName(h);
  for (let step = 10; step <= 180; step += 5) {
    const name = hueName(h + sign * step);
    if (name !== here) return name;
  }
  return here;
}

const sgn = (v: number) => (v < 0 ? '−' : '+');
const round = (v: number, step: number) => Math.round(v / step) * step;

function words(o: Offset, base: LCh76): string {
  const parts: string[] = [];
  if (Math.abs(o.dL) >= 0.05) parts.push(`${o.dL > 0 ? 'lighter' : 'darker'} by ${Math.abs(o.dL).toFixed(1)}`);
  if (Math.abs(o.dC) >= 0.05) {
    const pct = base.C > 2 ? ` (${Math.round((Math.abs(o.dC) / base.C) * 100)}%)` : '';
    parts.push(`${o.dC > 0 ? 'more vivid' : 'duller'} by ${Math.abs(o.dC).toFixed(1)}${pct}`);
  }
  if (Math.abs(o.dh) >= 0.5) parts.push(`hue ${Math.round(Math.abs(o.dh))}° toward ${towards(base.h, Math.sign(o.dh))}`);
  return parts.length ? parts.join(', ') : 'exactly the target';
}

function short(o: Offset): string {
  return `L${sgn(o.dL)}${Math.abs(o.dL).toFixed(1)} C${sgn(o.dC)}${Math.abs(o.dC).toFixed(1)} h${sgn(o.dh)}${Math.round(Math.abs(o.dh))}°`;
}

// --- state -------------------------------------------------------------------------
let t: SevenTunables = currentTunables();
let index = COLORS.findIndex((c) => c.id === 'teal');
let custom: Target | null = null;
let place: 'edge' | 'middle' = 'edge';
let bg: 'grey' | 'dark' | 'light' = 'grey';
/** How many kinds of miss the per-rank examples combine. */
let combo: 1 | 2 | 3 = 1;
let zoom: 'close' | 'wide' = 'wide';
/** The mix explorer's miss. Kept when the target changes, so one miss can be tried on many colors. */
let mix: Offset = { ...ZERO };

const target = (): Target => {
  if (custom) return custom;
  const c = COLORS[index];
  return { name: c.name, hex: c.target, meta: `${c.element} · ${TIER_LABEL[c.tier]}` };
};

function save(): void {
  applyTunables(t);
  saveTunables(t);
}

// --- examples per rank ----------------------------------------------------------------
/** A direction of miss: each part −1, 0 or +1 (lightness, chroma, hue). */
interface Dir {
  L: number;
  C: number;
  H: number;
}

function dirs(n: 1 | 2 | 3): Dir[] {
  const out: Dir[] = [];
  for (const L of [1, -1, 0]) for (const C of [0, -1, 1]) for (const H of [0, 1, -1]) if ([L, C, H].filter(Boolean).length === n) out.push({ L, C, H });
  return out;
}

function dirLabel(d: Dir, base: LCh76): string {
  return [d.L > 0 ? 'lighter' : d.L < 0 ? 'darker' : '', d.C < 0 ? 'duller' : d.C > 0 ? 'vivid' : '', d.H ? `→ ${towards(base.h, d.H)}` : ''].filter(Boolean).join(' · ');
}

/** `s` CIELAB units along a direction: every active part moves by s (hue by an arc of length s). */
function along(base: LCh76, d: Dir, s: number): Offset {
  return { dL: d.L * s, dC: d.C * s, dh: (d.H * s) / Math.max(base.C, 5) / RAD };
}

function maxAlong(base: LCh76, d: Dir): number {
  return Math.min(
    d.L > 0 ? 100 - base.L : d.L < 0 ? base.L : Infinity,
    d.C < 0 ? base.C : d.C > 0 ? 160 : Infinity,
    d.H ? Math.PI * Math.max(base.C, 5) : Infinity,
  );
}

interface Example {
  offset: Offset;
  hex: string;
  dE: number;
  status: 'ok' | 'unreachable' | 'gamut';
}

/** The color `dE` away from the target along a direction (bisection). */
function exampleAt(tLab: Lab76, d: Dir, dE: number): Example {
  const base = toLCh(tLab);
  const max = maxAlong(base, d);
  const at = (s: number) => shifted(base, along(base, d, s));
  const dist = (s: number) => ciede2000(tLab, at(s).lab, t.weights);
  if (max <= 0 || dist(max) < dE) return { offset: along(base, d, Math.max(0, max)), hex: '#000000', dE, status: 'unreachable' };
  let lo = 0;
  let hi = max;
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    if (dist(mid) < dE) lo = mid;
    else hi = mid;
  }
  const s = at(hi);
  return { offset: along(base, d, hi), hex: s.hex, dE: dist(hi), status: s.inGamut ? 'ok' : 'gamut' };
}

function bands(): { name: string; lo: number; hi: number }[] {
  return TIER_NAMES.map((name, i) => ({ name, lo: i === 0 ? 0 : t.colorTierMax[i - 1], hi: i < t.colorTierMax.length ? t.colorTierMax[i] : Infinity }));
}

function sampleDistance(b: { lo: number; hi: number }): number {
  if (!Number.isFinite(b.hi)) return place === 'edge' ? b.lo * 1.5 : b.lo * 2.2;
  return place === 'edge' ? b.hi : (b.lo + b.hi) / 2;
}

// --- fields (built once, updated in place so dragging a slider never breaks) -----------
interface Field {
  el: HTMLElement;
  hint: HTMLElement;
  setValue(v: number): void;
}

function numberField(label: string, step: number, min: number, max: number, onInput: (v: number) => void): Field {
  const range = h('input', { type: 'range', min: String(min), max: String(max), step: String(step) }) as HTMLInputElement;
  const num = h('input', { type: 'number', min: String(min), max: String(max), step: String(step) }) as HTMLInputElement;
  const hint = h('span', { class: 'hint mono' });
  range.addEventListener('input', () => onInput(Number(range.value)));
  num.addEventListener('change', () => Number.isFinite(Number(num.value)) && onInput(Number(num.value)));
  return {
    el: h('label', { class: 'field' }, h('span', { class: 'f-label' }, label), range, num, hint),
    hint,
    setValue(v: number) {
      if (document.activeElement !== range) range.value = String(v);
      if (document.activeElement !== num) num.value = String(v);
    },
  };
}

const tierFields = t.colorTierMax.map((_, i) =>
  numberField(`${TIER_NAMES[i]} ≤ ΔE`, 0.1, 0.1, 60, (v) => {
    t.colorTierMax[i] = v;
    // Keep the ladder ascending: push neighbours out of the way.
    for (let k = i + 1; k < t.colorTierMax.length; k++) if (t.colorTierMax[k] <= t.colorTierMax[k - 1]) t.colorTierMax[k] = +(t.colorTierMax[k - 1] + 0.1).toFixed(2);
    for (let k = i - 1; k >= 0; k--) if (t.colorTierMax[k] >= t.colorTierMax[k + 1]) t.colorTierMax[k] = Math.max(0.05, +(t.colorTierMax[k + 1] - 0.1).toFixed(2));
    changed();
  }),
);
const weightFields = (['kL', 'kC', 'kH'] as const).map((k) =>
  numberField({ kL: 'Lightness weight kL', kC: 'Chroma weight kC', kH: 'Hue weight kH' }[k], 0.05, 0.25, 8, (v) => {
    t.weights[k] = v;
    changed();
  }),
);
const hueWindowFields = (['hueLenientTo', 'hueStrictFrom'] as const).map((k) =>
  numberField(k === 'hueLenientTo' ? 'Hue leniency up to °' : 'Hue strict again from °', 1, 0, 180, (v) => {
    t.weights[k] = v;
    if (t.weights.hueStrictFrom < t.weights.hueLenientTo) {
      if (k === 'hueLenientTo') t.weights.hueStrictFrom = v;
      else t.weights.hueLenientTo = v;
    }
    changed();
  }),
);
const pointFields = TIER_NAMES.map((name, i) =>
  numberField(`${name} points`, 1, 0, 100, (v) => {
    t.tierPoints[i] = v;
    changed();
  }),
);
const craftFields = t.craftMins.map((_, i) =>
  numberField(`${CRAFT_NAMES[i + 1]} ≥`, 5, 5, SEVEN.sections * 100, (v) => {
    t.craftMins[i] = v;
    for (let k = i + 1; k < t.craftMins.length; k++) if (t.craftMins[k] <= t.craftMins[k - 1]) t.craftMins[k] = t.craftMins[k - 1] + 5;
    for (let k = i - 1; k >= 0; k--) if (t.craftMins[k] >= t.craftMins[k + 1]) t.craftMins[k] = Math.max(5, t.craftMins[k + 1] - 5);
    changed();
  }),
);

function setMix(o: Partial<Offset>): void {
  mix = { ...mix, ...o };
  refreshMix();
}

const mixFields: Record<Axis, Field> = {
  dL: numberField('Lightness (L*) ±', 0.5, -40, 40, (v) => setMix({ dL: v })),
  dC: numberField('Saturation (C*) ±', 0.5, -60, 60, (v) => setMix({ dC: v })),
  dh: numberField('Hue (°) ±', 1, -180, 180, (v) => setMix({ dh: v })),
};

// --- rank maps -------------------------------------------------------------------------
const AXIS: Record<Axis, { name: string; step: number }> = {
  dL: { name: 'lightness', step: 5 },
  dC: { name: 'saturation', step: 6 },
  dh: { name: 'hue', step: 12 },
};
const ZOOM = { close: 0.4, wide: 1 };
const MAP_HALF = 7; // 15 × 15 cells
const CELL = 18;

interface MapView {
  x: Axis;
  y: Axis;
  canvas: HTMLCanvasElement;
  caption: HTMLElement;
  top: HTMLElement;
  bottom: HTMLElement;
  left: HTMLElement;
  right: HTMLElement;
}

const stepOf = (a: Axis) => AXIS[a].step * ZOOM[zoom];

function makeMap(x: Axis, y: Axis): MapView {
  const m: MapView = {
    x,
    y,
    canvas: h('canvas', { 'aria-label': `Ranks for ${AXIS[x].name} × ${AXIS[y].name}` }),
    caption: h('span', { class: 'muted small' }),
    top: h('span'),
    bottom: h('span'),
    left: h('span'),
    right: h('span'),
  };
  const pick = (e: PointerEvent) => {
    const r = m.canvas.getBoundingClientRect();
    const n = MAP_HALF * 2 + 1;
    const i = Math.min(n - 1, Math.max(0, Math.floor(((e.clientX - r.left) / r.width) * n)));
    const j = Math.min(n - 1, Math.max(0, Math.floor(((e.clientY - r.top) / r.height) * n)));
    setMix({ [x]: +((i - MAP_HALF) * stepOf(x)).toFixed(2), [y]: +((MAP_HALF - j) * stepOf(y)).toFixed(2) });
  };
  m.canvas.addEventListener('pointerdown', (e) => {
    m.canvas.setPointerCapture(e.pointerId);
    pick(e);
  });
  m.canvas.addEventListener('pointermove', (e) => e.buttons && pick(e));
  return m;
}

const maps = [makeMap('dh', 'dL'), makeMap('dC', 'dL'), makeMap('dh', 'dC')];

function axisEnd(a: Axis, sign: number, base: LCh76): string {
  const v = MAP_HALF * stepOf(a);
  const amount = `${sgn(sign)}${a === 'dh' ? `${Math.round(v)}°` : v.toFixed(0)}`;
  if (a === 'dL') return `${sign > 0 ? 'lighter' : 'darker'} ${amount}`;
  if (a === 'dC') return `${sign > 0 ? 'more vivid' : 'duller'} ${amount}`;
  return `${towards(base.h, sign)} ${amount}`;
}

function drawMap(m: MapView, base: LCh76, tLab: Lab76): void {
  const n = MAP_HALF * 2 + 1;
  const size = n * CELL;
  const dpr = Math.min(3, window.devicePixelRatio || 1);
  if (m.canvas.width !== Math.round(size * dpr)) m.canvas.width = m.canvas.height = Math.round(size * dpr);
  const ctx = m.canvas.getContext('2d');
  if (!ctx) return;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, size, size);
  ctx.font = "600 10px 'JetBrains Mono', ui-monospace, monospace";
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const sx = stepOf(m.x);
  const sy = stepOf(m.y);
  const rank: number[] = [];
  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      const o: Offset = { ...mix, [m.x]: (i - MAP_HALF) * sx, [m.y]: (MAP_HALF - j) * sy };
      const s = shifted(base, o);
      const x0 = i * CELL;
      const y0 = j * CELL;
      if (!s.possible) {
        rank.push(-1);
        ctx.strokeStyle = 'rgba(0,0,0,.25)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x0 + 3, y0 + CELL - 3);
        ctx.lineTo(x0 + CELL - 3, y0 + 3);
        ctx.stroke();
        continue;
      }
      const r = tierFor(ciede2000(tLab, s.lab, t.weights)).index;
      rank.push(r);
      ctx.fillStyle = s.hex;
      ctx.fillRect(x0, y0, CELL, CELL);
      const ink = s.lab.L > 62 ? 'rgba(0,0,0,.6)' : 'rgba(255,255,255,.8)';
      ctx.fillStyle = ink;
      ctx.fillText(TIER_NAMES[r][0], x0 + CELL / 2, y0 + CELL / 2 + 0.5);
      if (!s.inGamut) {
        // Corner notch: no screen or camera can make this color exactly.
        ctx.beginPath();
        ctx.moveTo(x0 + CELL - 6, y0);
        ctx.lineTo(x0 + CELL, y0);
        ctx.lineTo(x0 + CELL, y0 + 6);
        ctx.fill();
      }
    }
  }
  // Rank borders: a dark line with a light core, readable on any color.
  const borders = new Path2D();
  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      const r = rank[j * n + i];
      if (i + 1 < n && rank[j * n + i + 1] !== r) {
        borders.moveTo((i + 1) * CELL, j * CELL);
        borders.lineTo((i + 1) * CELL, (j + 1) * CELL);
      }
      if (j + 1 < n && rank[(j + 1) * n + i] !== r) {
        borders.moveTo(i * CELL, (j + 1) * CELL);
        borders.lineTo((i + 1) * CELL, (j + 1) * CELL);
      }
    }
  }
  ctx.lineCap = 'square';
  ctx.strokeStyle = 'rgba(0,0,0,.85)';
  ctx.lineWidth = 2.5;
  ctx.stroke(borders);
  ctx.strokeStyle = 'rgba(255,255,255,.9)';
  ctx.lineWidth = 1;
  ctx.stroke(borders);
  // The mix's position in this slice.
  const px = (mix[m.x] / sx + MAP_HALF + 0.5) * CELL;
  const py = (MAP_HALF - mix[m.y] / sy + 0.5) * CELL;
  if (px >= 0 && px <= size && py >= 0 && py <= size) {
    ctx.beginPath();
    ctx.arc(px, py, CELL * 0.55, 0, Math.PI * 2);
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 3.5;
    ctx.stroke();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }

  const third = (['dL', 'dC', 'dh'] as const).find((a) => a !== m.x && a !== m.y)!;
  const tv = mix[third];
  m.caption.textContent = `${AXIS[third].name} ${Math.abs(tv) < 0.05 ? 'as the target' : `${sgn(tv)}${third === 'dh' ? `${Math.round(Math.abs(tv))}°` : Math.abs(tv).toFixed(1)}`}`;
  m.top.textContent = `↑ ${axisEnd(m.y, 1, base)}`;
  m.bottom.textContent = `↓ ${axisEnd(m.y, -1, base)}`;
  m.left.textContent = `← ${axisEnd(m.x, -1, base)}`;
  m.right.textContent = `${axisEnd(m.x, 1, base)} →`;
}

/** The rank ladder with the total, then each part on the same scale. */
function breakdownSvg(p: DeltaParts): string {
  const W = 420;
  const left = 92;
  const right = 44;
  const rowH = 18;
  const max = t.colorTierMax[t.colorTierMax.length - 1] * 1.4;
  const X = (v: number) => left + (Math.min(Math.abs(v), max) / max) * (W - left - right);
  const edges = [0, ...t.colorTierMax, max];
  let s = '';
  TIER_NAMES.forEach((name, i) => {
    const a = X(edges[i]);
    const b = X(Math.min(edges[i + 1], max));
    if (b > a + 0.5) s += `<rect x="${a.toFixed(1)}" y="0" width="${(b - a).toFixed(1)}" height="${rowH}" class="seg${i % 2}"/><text x="${((a + b) / 2).toFixed(1)}" y="12.5" class="sl">${name[0]}</text>`;
  });
  s += `<text x="${left - 6}" y="12.5" class="bl">all together</text>`;
  s += `<line x1="${X(p.dE).toFixed(1)}" x2="${X(p.dE).toFixed(1)}" y1="-3" y2="${rowH + 3}" class="mk"/>`;
  s += `<text x="${W - right + 6}" y="12.5" class="bv">${p.dE.toFixed(2)}</text>`;
  let y = rowH + 8;
  for (const [name, v] of [
    ['lightness', p.l],
    ['saturation', p.c],
    ['hue', p.h],
  ] as const) {
    s += `<text x="${left - 6}" y="${y + 12}" class="bl">${name}</text><rect x="${left}" y="${y + 4}" width="${(X(v) - left).toFixed(1)}" height="${rowH - 8}" class="bar"/><text x="${W - right + 6}" y="${y + 12}" class="bv">${Math.abs(v).toFixed(2)}</text>`;
    y += rowH;
  }
  return `<svg viewBox="0 -4 ${W} ${y + 6}" width="100%">${s}</svg>`;
}

// --- static layout ----------------------------------------------------------------------
const root = document.getElementById('tuner')!;
const targetSw = h('span', { class: 'target-sw' });
const targetName = h('h2');
const targetMeta = h('p', { class: 'mono muted' });
const targetLabText = h('p', { class: 'mono muted small' });
const select = h('select', { 'aria-label': 'Target color' }) as HTMLSelectElement;
for (const tier of ['lead', 'silver', 'gold'] as const) {
  const group = h('optgroup', { label: TIER_LABEL[tier] });
  COLORS.forEach((c, i) => c.tier === tier && group.append(h('option', { value: String(i) }, c.name)));
  select.append(group);
}
select.addEventListener('change', () => {
  custom = null;
  index = Number(select.value);
  refresh();
});
const picker = h('input', { type: 'color', 'aria-label': 'Custom target' }) as HTMLInputElement;
picker.addEventListener('input', () => {
  custom = { name: 'Custom', hex: picker.value, meta: 'custom hex' };
  refresh();
});
const stepTarget = (d: number) => () => {
  custom = null;
  index = (index + d + COLORS.length) % COLORS.length;
  refresh();
};
const curveBox = h('div', { class: 'curve' });
const lastTierNote = h('p', { class: 'muted small' });
const examplesBody = h('div');
const exampleToggles = h('div', { class: 'row' });

const mixPanel = h('section', { class: 'panel' });
const mixPair = h('span', { class: 'pair big' });
const mixVerdict = h('div');
const mixWords = h('p', { class: 'small' });
const mixBreak = h('div', { class: 'breakdown' });
const mixFormula = h('p', { class: 'mono muted small' });
const mapToggles = h('div', { class: 'row' });

const craftGallery = h('div', { class: 'craft-gallery' });
const cameraBox = h('div', { class: 'cam-box' });
const camSquare = h('span', { class: 'cam-square' });
const camReadout = h('div', { class: 'cam-readout' });
const camLog = h('ol', { class: 'cam-log' });

function randomMiss(): void {
  const r = (lo: number, hi: number, step: number) => round(lo + Math.random() * (hi - lo), step);
  setMix({ dL: r(-8, 8, 0.5), dC: r(-10, 6, 0.5), dh: r(-15, 15, 1) });
}

mixPanel.append(
  h('h3', null, 'Mix: off in several ways at once'),
  h('p', { class: 'muted small' }, 'A real capture is usually a bit darker, duller and turned in hue at the same time. Set a miss here, or click a map cell, an example or a camera log entry.'),
  h(
    'div',
    { class: 'mix-grid' },
    h(
      'div',
      null,
      ...(['dL', 'dC', 'dh'] as const).map((a) => mixFields[a].el),
      h(
        'div',
        { class: 'row' },
        h('button', { class: 'btn', type: 'button', onclick: () => setMix(ZERO) }, 'Back to the target'),
        h('button', { class: 'btn', type: 'button', onclick: randomMiss }, 'Random miss'),
        h('button', { class: 'btn', type: 'button', onclick: useCameraSample }, 'Use camera sample'),
      ),
    ),
    h('div', { class: 'mix-out' }, h('div', { class: 'mix-verdict' }, mixPair, mixVerdict), mixWords, mixBreak, mixFormula),
  ),
  h('h3', null, 'Rank maps'),
  h(
    'p',
    { class: 'muted small' },
    'Every cell is a real color: two kinds of miss combined, the third held at the mix’s value. Letters are ranks (F H K W A B), lines are rank borders, the ring is the mix. A notched corner = no screen can show it exactly. Click or drag to move the mix.',
  ),
  mapToggles,
  h(
    'div',
    { class: 'maps' },
    ...maps.map((m) =>
      h(
        'figure',
        { class: 'map' },
        h('figcaption', null, h('strong', null, `${AXIS[m.x].name} × ${AXIS[m.y].name}`), ' ', m.caption),
        h('div', { class: 'ax' }, m.top),
        m.canvas,
        h('div', { class: 'ax' }, m.bottom),
        h('div', { class: 'ax lr' }, m.left, m.right),
      ),
    ),
  ),
);

root.replaceChildren(
  h(
    'header',
    { class: 'top' },
    h('div', null, h('h1', null, 'Tuner'), h('p', { class: 'muted' }, 'Values apply to the game on this device right away (dev and test builds). The jam build uses src/data/tuning.ts.')),
    h(
      'div',
      { class: 'row' },
      h('a', { class: 'btn', href: './' }, '▶ Play with these values'),
      h('button', { class: 'btn', type: 'button', onclick: () => void copySnippet() }, 'Copy snippet'),
      h('button', { class: 'btn', type: 'button', onclick: reset }, 'Reset to defaults'),
    ),
  ),
  h(
    'div',
    { class: 'grid' },
    h(
      'div',
      null,
      h(
        'section',
        { class: 'panel target-panel' },
        targetSw,
        h('div', { class: 'target-info' }, targetName, targetMeta, targetLabText),
        h(
          'div',
          { class: 'row' },
          h('button', { class: 'btn', type: 'button', onclick: stepTarget(-1), 'aria-label': 'Previous color' }, '◀'),
          select,
          h('button', { class: 'btn', type: 'button', onclick: stepTarget(1), 'aria-label': 'Next color' }, '▶'),
          h('button', { class: 'btn', type: 'button', onclick: () => ((custom = null), (index = Math.floor(Math.random() * COLORS.length)), refresh()) }, 'Random'),
          picker,
        ),
      ),
      h(
        'section',
        { class: 'panel' },
        h('h3', null, 'Distance weights (CIEDE2000)'),
        h('p', { class: 'muted small' }, 'Higher = more forgiving of that kind of difference. Standard CIEDE2000 is 1 / 1 / 1.'),
        ...weightFields.map((f) => f.el),
        ...hueWindowFields.map((f) => f.el),
        h('h3', null, 'Per-color ranks'),
        ...tierFields.map((f) => f.el),
        lastTierNote,
        curveBox,
        h('h3', null, 'Points per rank (Krillion: 100 / 85 / 60 / 30 / 15 / 10)'),
        ...pointFields.map((f) => f.el),
        h('p', { class: 'muted small' }, `Time runs out: ${SEVEN.emptyPoints} points (Krillion's unanswered prompt).`),
        h('h3', null, `Craft ranks (running total of ${SEVEN.sections} colors, max ${SEVEN.sections * 100})`),
        ...craftFields.map((f) => f.el),
      ),
    ),
    h(
      'div',
      null,
      mixPanel,
      h(
        'section',
        { class: 'panel' },
        h('h3', null, 'Examples per rank'),
        h(
          'p',
          { class: 'muted small' },
          'Left half: the target. Right half: a color at that distance. Combined misses move every part by the same amount. ⚠ = no screen or camera can produce it exactly. Hatched = impossible in that direction. Click one to load it into the mix.',
        ),
        exampleToggles,
        examplesBody,
      ),
      h(
        'section',
        { class: 'panel' },
        h('h3', null, 'Live camera check'),
        h('p', { class: 'muted small' }, 'Hold real objects up to the camera. This is exactly what the color extracting machine scores.'),
        h(
          'div',
          { class: 'row' },
          h('button', { class: 'btn', type: 'button', onclick: () => void toggleCamera() }, 'Start / stop camera'),
          h('button', { class: 'btn', type: 'button', onclick: logSample }, 'Log sample'),
          h('button', { class: 'btn', type: 'button', onclick: () => void camera.flip() }, 'Flip'),
        ),
        cameraBox,
        camReadout,
        camLog,
      ),
      h(
        'section',
        { class: 'panel' },
        h('h3', null, 'Craft art'),
        h('p', { class: 'muted small' }, 'In the game a craft uses the palette of its page; here every render picks a random palette and new random shapes.'),
        h('button', { class: 'btn', type: 'button', onclick: () => paintCrafts() }, 'Re-roll'),
        craftGallery,
      ),
    ),
  ),
);

function paintCrafts(): void {
  craftGallery.replaceChildren(
    ...CRAFT_NAMES.map((name, i) => {
      const stage = h('div', { class: 'craft-stage' });
      stage.innerHTML = craftSvg(i);
      return h('figure', { class: 'craft-cell' }, stage, h('figcaption', null, h('strong', null, name), h('br'), h('span', { class: 'muted small' }, CRAFT_BLURBS[i])));
    }),
  );
}
paintCrafts();

// --- refresh: everything that depends on the target or the values ----------------------------
function changed(): void {
  save();
  refresh();
}

function refresh(): void {
  const tg = target();
  const tLab = hexToCielab(tg.hex);
  const base = toLCh(tLab);
  document.body.dataset.bg = bg;
  targetSw.style.background = tg.hex;
  targetName.textContent = tg.name;
  targetMeta.textContent = `${tg.hex} · ${tg.meta}`;
  targetLabText.textContent = `L* ${base.L.toFixed(1)} · C* ${base.C.toFixed(1)} · h ${base.h.toFixed(0)}° (${hueName(base.h)})`;
  if (!custom) select.value = String(index);
  picker.value = tg.hex;

  const weightHints = {
    kL: 'lighter / darker',
    kC: 'duller / more vivid',
    kH: 'hue shifts',
  };
  (['kL', 'kC', 'kH'] as const).forEach((k, i) => {
    weightFields[i].setValue(t.weights[k]);
    const w = t.weights[k];
    weightFields[i].hint.textContent = `${weightHints[k]} count ${(1 / w).toFixed(2)}× (${w > 1 ? 'more forgiving' : w < 1 ? 'stricter' : 'standard'})${k === 'kH' ? ' for small hue shifts' : ''}`;
  });
  hueWindowFields[0].setValue(t.weights.hueLenientTo);
  hueWindowFields[0].hint.textContent = `hue differences up to ${t.weights.hueLenientTo}° get the full kH leniency`;
  hueWindowFields[1].setValue(t.weights.hueStrictFrom);
  hueWindowFields[1].hint.textContent = `from ${t.weights.hueStrictFrom}° a hue difference counts fully (standard)`;
  tierFields.forEach((f, i) => {
    f.setValue(t.colorTierMax[i]);
    f.hint.textContent = `${t.tierPoints[i]} points`;
  });
  lastTierNote.textContent = `${TIER_NAMES[TIER_NAMES.length - 1]}: anything beyond ΔE ${fmt1(t.colorTierMax[t.colorTierMax.length - 1])} · ${t.tierPoints[TIER_NAMES.length - 1]} points.`;
  pointFields.forEach((f, i) => {
    f.setValue(t.tierPoints[i]);
    f.hint.textContent = `× ${SEVEN.sections} colors = ${t.tierPoints[i] * SEVEN.sections}`;
  });
  craftFields.forEach((f, i) => {
    const v = t.craftMins[i];
    const avg = v / SEVEN.sections;
    // The lowest rank that, earned on every color, reaches this craft.
    let needed = 'unreachable';
    for (let k = TIER_NAMES.length - 1; k >= 0; k--) {
      if (t.tierPoints[k] >= avg) {
        needed = TIER_NAMES[k];
        break;
      }
    }
    f.setValue(v);
    f.hint.textContent = `avg ${avg.toFixed(0)}/color ≈ ${needed} on every color`;
  });
  curveBox.innerHTML = curveSvg();

  const toggle = (on: boolean, label: string, onclick: () => void) => h('button', { class: `btn ${on ? 'on' : ''}`, type: 'button', onclick }, label);
  exampleToggles.replaceChildren(
    ...([1, 2, 3] as const).map((n) => toggle(combo === n, ['One thing off', 'Two things off', 'All three off'][n - 1], () => ((combo = n), refresh()))),
    ...(['edge', 'middle'] as const).map((p) => toggle(place === p, p === 'edge' ? 'Worst that still counts' : 'Middle of the rank', () => ((place = p), refresh()))),
    ...(['grey', 'dark', 'light'] as const).map((k) => toggle(bg === k, `${k} background`, () => ((bg = k), refresh()))),
  );

  const dirList = dirs(combo);
  examplesBody.style.setProperty('--cols', String(combo === 3 ? 8 : 6));
  examplesBody.style.setProperty('--cols-m', String(combo === 3 ? 4 : 3));
  examplesBody.replaceChildren(
    ...bands().map((b) => {
      const d = sampleDistance(b);
      const chips = dirList.map((dir) => {
        const ex = exampleAt(tLab, dir, d);
        const off = ex.status === 'unreachable';
        return h(
          'figure',
          { class: `chip ${ex.status}`, title: off ? '' : words(ex.offset, base), onclick: () => !off && loadMix(ex.offset) },
          h('span', { class: 'pair' }, h('i', { style: { background: tg.hex } }), h('i', { style: { background: off ? 'transparent' : ex.hex } })),
          h('figcaption', null, dirLabel(dir, base), h('br'), off ? 'not possible' : `ΔE ${ex.dE.toFixed(2)}${ex.status === 'gamut' ? ' ⚠' : ''}`, off ? null : h('span', { class: 'off' }, short(ex.offset))),
        );
      });
      return h(
        'div',
        { class: 'tier-row' },
        h('div', { class: 'tier-head' }, h('strong', null, b.name), h('span', { class: 'mono muted small' }, `ΔE ${fmt1(b.lo)}–${fmt1(b.hi)}`), h('span', { class: 'mono muted small' }, `${scoreFor(Math.min(d, b.hi))} points`), h('span', { class: 'mono small' }, `shown at ΔE ${fmt1(d)}`)),
        h('div', { class: 'chips' }, ...chips),
      );
    }),
  );
  refreshMix();
  updateCamera();
}

function loadMix(o: Offset): void {
  setMix({ dL: +o.dL.toFixed(2), dC: +o.dC.toFixed(2), dh: +o.dh.toFixed(1) });
  mixPanel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

/** The mix readout and the rank maps (cheap: redrawn on every slider move or map drag). */
function refreshMix(): void {
  const tg = target();
  const tLab = hexToCielab(tg.hex);
  const base = toLCh(tLab);
  (['dL', 'dC', 'dh'] as const).forEach((a) => mixFields[a].setValue(mix[a]));
  mixFields.dL.hint.textContent = Math.abs(mix.dL) < 0.05 ? 'same lightness' : `${mix.dL > 0 ? 'lighter' : 'darker'} by ${Math.abs(mix.dL).toFixed(1)} L*`;
  mixFields.dC.hint.textContent =
    Math.abs(mix.dC) < 0.05 ? 'same saturation' : `${mix.dC > 0 ? 'more vivid' : 'duller'} by ${Math.abs(mix.dC).toFixed(1)} C*${base.C > 2 ? ` (${Math.round((Math.abs(mix.dC) / base.C) * 100)}% of the target's)` : ''}`;
  mixFields.dh.hint.textContent = Math.abs(mix.dh) < 0.5 ? 'same hue' : `turned ${Math.round(Math.abs(mix.dh))}° toward ${towards(base.h, Math.sign(mix.dh))}`;

  const s = shifted(base, mix);
  const p = ciede2000Parts(tLab, s.lab, t.weights);
  const tier = tierFor(p.dE);
  mixPair.replaceChildren(h('i', { style: { background: tg.hex } }), h('i', { style: { background: s.possible ? s.hex : 'transparent' } }));
  mixVerdict.replaceChildren(
    h('strong', null, s.possible ? tier.name : 'Not possible'),
    h('p', { class: 'mono' }, `ΔE ${p.dE.toFixed(2)} · ${tier.points} points`),
    h('p', { class: 'mono muted small' }, `${s.hex}${s.inGamut ? '' : ' ⚠ outside sRGB'}`),
  );
  mixWords.textContent = words(mix, base);
  mixBreak.innerHTML = breakdownSvg(p);
  const sq = (v: number) => `${Math.abs(v).toFixed(2)}²`;
  const sum = Math.abs(p.l) + Math.abs(p.c) + Math.abs(p.h);
  mixFormula.textContent =
    `ΔE = √(${sq(p.l)} + ${sq(p.c)} + ${sq(p.h)}${Math.abs(p.cross) >= 0.005 ? ` ${sgn(p.cross)} ${Math.abs(p.cross).toFixed(2)} blue term` : ''}) = ${p.dE.toFixed(2)}` +
    (sum > p.dE + 0.05 ? `. The parts add up to ${sum.toFixed(2)}, but together they count as ${p.dE.toFixed(2)}.` : '');

  mapToggles.replaceChildren(
    ...(['close', 'wide'] as const).map((z) => h('button', { class: `btn ${zoom === z ? 'on' : ''}`, type: 'button', onclick: () => ((zoom = z), refreshMix()) }, z === 'close' ? 'Close-up' : 'Wide')),
  );
  maps.forEach((m) => drawMap(m, base, tLab));
}

/** Score vs ΔE with the rank boundaries. */
function curveSvg(): string {
  const W = 320;
  const H = 120;
  const maxDE = 40;
  const x = (d: number) => (d / maxDE) * W;
  const y = (s: number) => H - (s / 100) * H;
  let path = '';
  for (let d = 0; d <= maxDE; d += 0.5) path += `${d === 0 ? 'M' : 'L'}${x(d).toFixed(1)},${y(scoreFor(d)).toFixed(1)} `;
  const lines = t.colorTierMax
    .map((v, i) => `<line x1="${x(v)}" x2="${x(v)}" y1="0" y2="${H}" class="tl"/><text x="${x(v) + 2}" y="${10 + (i % 3) * 10}" class="tt">${TIER_NAMES[i].slice(0, 4)}</text>`)
    .join('');
  return `<svg viewBox="0 0 ${W} ${H + 14}" width="100%"><rect width="${W}" height="${H}" class="bgc"/>${lines}<path d="${path}" class="cp"/><text x="0" y="${H + 12}" class="tt">ΔE 0</text><text x="${W - 34}" y="${H + 12}" class="tt">ΔE ${maxDE}</text></svg>`;
}

// --- live camera check ------------------------------------------------------------------
let camOn = false;
let camTimer = 0;
let lastSample: { hex: string; dE: number; lab: Lab76 } | null = null;

async function toggleCamera(): Promise<void> {
  if (camOn) {
    camera.stop();
    camOn = false;
    clearInterval(camTimer);
    cameraBox.replaceChildren();
    camReadout.replaceChildren();
    return;
  }
  const err = await camera.start();
  if (err) {
    camReadout.textContent = CAMERA_ERROR_TEXT[err];
    return;
  }
  camOn = true;
  camera.video.classList.add('cam-video');
  camera.video.style.transform = camera.mirrored ? 'scaleX(-1)' : '';
  cameraBox.replaceChildren(camera.video, camSquare);
  camTimer = window.setInterval(updateCamera, 150);
}

function updateCamera(): void {
  if (!camOn) return;
  const src = cameraSource();
  if (!src.ready()) return;
  const vw = camera.video.videoWidth;
  const vh = camera.video.videoHeight;
  // Keep the square visually square on the non-square video box.
  const side = Math.min(vw, vh) * SEVEN.squareFraction;
  camSquare.style.width = `${(side / vw) * 100}%`;
  camSquare.style.height = `${(side / vh) * 100}%`;
  cameraBox.style.aspectRatio = `${vw} / ${vh}`;
  const m = meanOfRect(src, squareRect(src, viewRect(1, 0.5, 0.5), SEVEN.squareFraction));
  if (!m) return;
  const tg = target();
  const tLab = hexToCielab(tg.hex);
  const lab = linearToCielab(m[0], m[1], m[2]);
  const p = ciede2000Parts(tLab, lab, t.weights);
  const hex = linearToHex(m[0], m[1], m[2]);
  lastSample = { hex, dE: p.dE, lab };
  camReadout.replaceChildren(
    h('span', { class: 'pair big' }, h('i', { style: { background: tg.hex } }), h('i', { style: { background: hex } })),
    h(
      'div',
      null,
      h('strong', null, tierFor(p.dE).name),
      h('p', { class: 'mono' }, `ΔE ${p.dE.toFixed(2)} · score ${scoreFor(p.dE)}`),
      h('p', { class: 'small' }, words(offsetOf(toLCh(tLab), lab), toLCh(tLab))),
      h('p', { class: 'mono muted small' }, `${hex} · lightness ${Math.abs(p.l).toFixed(1)} · saturation ${Math.abs(p.c).toFixed(1)} · hue ${Math.abs(p.h).toFixed(1)}`),
    ),
  );
}

function useCameraSample(): void {
  if (!lastSample) {
    alert('Start the camera (Live camera check, below) first.');
    return;
  }
  loadMix(offsetOf(toLCh(hexToCielab(target().hex)), lastSample.lab));
}

function logSample(): void {
  if (!lastSample) return;
  const tg = target();
  const off = offsetOf(toLCh(hexToCielab(tg.hex)), lastSample.lab);
  camLog.prepend(
    h(
      'li',
      { title: 'Load this miss into the mix', onclick: () => loadMix(off) },
      h('span', { class: 'pair' }, h('i', { style: { background: tg.hex } }), h('i', { style: { background: lastSample.hex } })),
      h('span', { class: 'mono small' }, `${tg.name}: ΔE ${lastSample.dE.toFixed(2)} → ${tierFor(lastSample.dE).name} (${scoreFor(lastSample.dE)}) · ${short(off)}`),
    ),
  );
}

// --- export -------------------------------------------------------------------------------
function snippet(): string {
  const tiers = TIER_NAMES.map((name, i) => `    { name: '${name}', maxDE: ${i < t.colorTierMax.length ? t.colorTierMax[i] : 'Infinity'}, points: ${t.tierPoints[i]} },`).join('\n');
  const crafts = CRAFT_NAMES.map((name, i) => `    { name: '${name}', min: ${i === 0 ? 0 : t.craftMins[i - 1]} },`).join('\n');
  const w = t.weights;
  return `  deltaWeights: { kL: ${w.kL}, kC: ${w.kC}, kH: ${w.kH}, hueLenientTo: ${w.hueLenientTo}, hueStrictFrom: ${w.hueStrictFrom} },\n  colorTiers: [\n${tiers}\n  ],\n  craftTiers: [\n${crafts}\n  ],`;
}

async function copySnippet(): Promise<void> {
  const text = snippet();
  try {
    await navigator.clipboard.writeText(text);
    alert('Copied. Paste it to Claude, or into SEVEN in src/data/tuning.ts.');
  } catch {
    prompt('Copy this:', text);
  }
}

function reset(): void {
  t = JSON.parse(JSON.stringify(SEVEN_DEFAULTS));
  clearTunables();
  applyTunables(t);
  refresh();
}

refresh();
