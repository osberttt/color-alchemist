// The scoring tuner (dev and test builds only): pick a target, click around a color
// wheel, and see the rank the game would give the clicked color. Everything uses the
// game's real scoring code and the values in src/data/tuning.ts.

import '@fontsource-variable/inter/wght.css';
import '@fontsource/jetbrains-mono/400.css';
import './tuner.css';
import { COLORS, TIER_LABEL } from '../data/colors';
import { SEVEN, SEVEN_DEFAULTS, applyTunables, clearTunables } from '../data/tuning';
import { hexToCielab, linearToCielab } from '../color/cielab';
import { hexToOklab, hue, linearToHex, linearToSrgb, oklabToLinear, type Lab } from '../color/oklab';
import { distance, distanceParts, tierFor } from '../scoring/extract';
import { h } from '../ui/dom';

// The tuner no longer edits values: show (and let the game play) exactly tuning.ts.
clearTunables();
applyTunables(SEVEN_DEFAULTS);

interface Pick {
  lab: Lab;
  hex: string;
}

const inGamut = (rgb: number[]) => rgb.every((v) => v >= -0.0005 && v <= 1.0005);
const RAD = Math.PI / 180;

let index = COLORS.findIndex((c) => c.id === 'teal');
let customHex: string | null = null;
/** The wheel's lightness (OKLab L, 0–1). */
let wheelL = 0.5;
let picked: Pick | null = null;
const history: { target: string; pick: Pick }[] = [];

const targetHex = () => customHex ?? COLORS[index].target;
const targetName = () => (customHex ? 'Custom' : COLORS[index].name);

/** The most chroma sRGB allows at lightness L and hue h (bisection). */
function maxChroma(L: number, h: number): number {
  let lo = 0;
  let hi = 0.4;
  for (let i = 0; i < 18; i++) {
    const mid = (lo + hi) / 2;
    if (inGamut(oklabToLinear({ L, a: mid * Math.cos(h), b: mid * Math.sin(h) }))) lo = mid;
    else hi = mid;
  }
  return lo;
}

// --- layout ---------------------------------------------------------------------------
const root = document.getElementById('tuner')!;
const targetSw = h('span', { class: 'target-sw' });
const targetTitle = h('h2');
const targetMeta = h('p', { class: 'mono muted small' });
const select = h('select', { 'aria-label': 'Target color' }) as HTMLSelectElement;
for (const tier of ['lead', 'silver', 'gold'] as const) {
  const group = h('optgroup', { label: TIER_LABEL[tier] });
  COLORS.forEach((c, i) => c.tier === tier && group.append(h('option', { value: String(i) }, c.name)));
  select.append(group);
}
select.addEventListener('change', () => setTarget(Number(select.value)));
const picker = h('input', { type: 'color', 'aria-label': 'Custom target' }) as HTMLInputElement;
picker.addEventListener('input', () => {
  customHex = picker.value;
  newTarget();
});

const wheel = h('canvas', { class: 'wheel', 'aria-label': 'Color wheel: click a color to rank it' }) as HTMLCanvasElement;
const marks = h('canvas', { class: 'wheel-marks' }) as HTMLCanvasElement;
const lightRange = h('input', { type: 'range', min: '0', max: '100', step: '0.5', 'aria-label': 'Wheel lightness' }) as HTMLInputElement;
const lightValue = h('span', { class: 'mono small' });
lightRange.addEventListener('input', () => {
  wheelL = Number(lightRange.value) / 100;
  drawWheel();
});

const result = h('div', { class: 'result' });
const historyList = h('div', { class: 'history' });
const limits = h('p', { class: 'mono muted small' });

root.replaceChildren(
  h(
    'header',
    { class: 'top' },
    h('div', null, h('h1', null, 'Tuner'), h('p', { class: 'muted small' }, 'Click (or drag) on the wheel to see the rank of that color for the target. Around = hue, center = grey, edge = the most vivid color a screen can show. One lightness at a time: use the slider.')),
    h('a', { class: 'btn', href: './' }, '▶ Play'),
  ),
  h(
    'section',
    { class: 'panel target-panel' },
    targetSw,
    h('div', null, targetTitle, targetMeta),
    h(
      'div',
      { class: 'row' },
      h('button', { class: 'btn', type: 'button', onclick: () => setTarget(index - 1), 'aria-label': 'Previous color' }, '◀'),
      select,
      h('button', { class: 'btn', type: 'button', onclick: () => setTarget(index + 1), 'aria-label': 'Next color' }, '▶'),
      h('button', { class: 'btn', type: 'button', onclick: () => setTarget(Math.floor(Math.random() * COLORS.length)) }, 'Random'),
      picker,
    ),
  ),
  h(
    'div',
    { class: 'grid' },
    h(
      'section',
      { class: 'panel' },
      h('div', { class: 'wheel-box' }, wheel, marks),
      h(
        'label',
        { class: 'light-row' },
        h('span', { class: 'small' }, 'Lightness'),
        lightRange,
        lightValue,
        h('button', { class: 'btn', type: 'button', onclick: () => ((wheelL = hexToOklab(targetHex()).L), drawWheel()) }, "Target's"),
      ),
    ),
    h('section', { class: 'panel' }, result, h('h3', null, 'Clicked so far'), historyList, limits),
  ),
);

// --- the wheel ------------------------------------------------------------------------
// Angle = OKLab hue; center = grey; the edge = the most vivid color a screen can show at
// that hue and the wheel's lightness. So every point is a real color.
const SIZE = 340;
/** The wheel's radius as a share of half the canvas, leaving room for rings on the edge. */
const R = 0.93;
const HUES = 720;
/** Max in-gamut chroma per half-degree of hue at the wheel's lightness. */
let edge = new Float32Array(HUES);

const edgeAt = (h: number) => edge[((Math.round(h / RAD / 0.5) % HUES) + HUES) % HUES];

/** The color at wheel position (dx, dy), both −1…1 with y up. */
function labAt(dx: number, dy: number): Lab {
  const h0 = Math.atan2(dy, dx);
  const C = Math.min(1, Math.hypot(dx, dy)) * edgeAt(h0);
  return { L: wheelL, a: C * Math.cos(h0), b: C * Math.sin(h0) };
}

/** Where a color sits on the wheel (outside the edge = clamped to it). */
function posOf(lab: Lab): { x: number; y: number; clamped: boolean } {
  const h0 = Math.atan2(lab.b, lab.a);
  const e = edgeAt(h0);
  const r = e > 1e-4 ? Math.hypot(lab.a, lab.b) / e : 0;
  return { x: Math.cos(h0) * Math.min(1, r), y: Math.sin(h0) * Math.min(1, r), clamped: r > 1.02 };
}

function drawWheel(): void {
  lightRange.value = String(+(wheelL * 100).toFixed(1));
  lightValue.textContent = (wheelL * 100).toFixed(1);
  edge = new Float32Array(HUES);
  for (let k = 0; k < HUES; k++) edge[k] = maxChroma(wheelL, k * 0.5 * RAD);

  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const n = Math.round(SIZE * dpr);
  wheel.width = marks.width = wheel.height = marks.height = n;
  const ctx = wheel.getContext('2d');
  if (!ctx) return;
  const img = ctx.createImageData(n, n);
  const half = n / 2;
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const dx = (x + 0.5 - half) / (half * R);
      const dy = (half - y - 0.5) / (half * R);
      if (Math.hypot(dx, dy) > 1) continue;
      const rgb = oklabToLinear(labAt(dx, dy));
      const i = (y * n + x) * 4;
      img.data[i] = linearToSrgb(rgb[0]) * 255;
      img.data[i + 1] = linearToSrgb(rgb[1]) * 255;
      img.data[i + 2] = linearToSrgb(rgb[2]) * 255;
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  drawMarks();
}

/** Rings for the target (where it sits on the wheel) and the clicked color. */
function drawMarks(): void {
  const ctx = marks.getContext('2d');
  if (!ctx) return;
  const n = marks.width;
  const s = n / SIZE;
  ctx.clearRect(0, 0, n, n);
  const ring = (lab: Lab, r: number, dash: boolean) => {
    const p = posOf(lab);
    ctx.setLineDash(dash || p.clamped ? [4 * s, 3 * s] : []);
    ctx.beginPath();
    ctx.arc(n / 2 + (p.x * R * n) / 2, n / 2 - (p.y * R * n) / 2, r * s, 0, Math.PI * 2);
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 4 * s;
    ctx.stroke();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2 * s;
    ctx.stroke();
  };
  // The target, dashed when the wheel isn't at its lightness.
  const t = hexToOklab(targetHex());
  ring(t, 11, Math.abs(t.L - wheelL) > 0.005);
  if (picked && Math.abs(picked.lab.L - wheelL) < 0.0001) ring(picked.lab, 6, false);
}

function pickAt(e: PointerEvent): void {
  const r = wheel.getBoundingClientRect();
  const dx = (((e.clientX - r.left) / r.width) * 2 - 1) / R;
  const dy = (1 - ((e.clientY - r.top) / r.height) * 2) / R;
  if (Math.hypot(dx, dy) > 1.08 && e.type === 'pointerdown') return;
  const lab = labAt(dx, dy);
  const rgb = oklabToLinear(lab);
  picked = { lab, hex: linearToHex(rgb[0], rgb[1], rgb[2]) };
  drawMarks();
  showResult(false);
}

wheel.addEventListener('pointerdown', (e) => {
  wheel.setPointerCapture(e.pointerId);
  pickAt(e);
});
wheel.addEventListener('pointermove', (e) => e.buttons && pickAt(e));
// One history entry per click or drag, at the color it ended on.
wheel.addEventListener('pointerup', () => picked && showResult(true));

// --- the verdict ----------------------------------------------------------------------
function judgePick(target: string, p: Pick) {
  const rgb = oklabToLinear(p.lab);
  const lab = linearToCielab(rgb[0], rgb[1], rgb[2]);
  const dE = distance(target, lab);
  return { dE, tier: tierFor(dE), parts: distanceParts(hexToCielab(target), lab) };
}

function showResult(log: boolean): void {
  const tHex = targetHex();
  if (!picked) {
    result.replaceChildren(h('p', { class: 'muted' }, 'Click a color on the wheel.'));
    return;
  }
  const { dE, tier, parts } = judgePick(tHex, picked);
  const t = hexToOklab(tHex);
  let dh = hue(picked.lab) - hue(t);
  if (dh > 180) dh -= 360;
  else if (dh < -180) dh += 360;
  const say = (v: number, more: string, less: string) => (Math.abs(v) < 0.5 ? null : `${v > 0 ? more : less} by ${Math.abs(v).toFixed(1)}`);
  const notes = [say(parts.l, 'lighter', 'darker'), say(parts.c, 'more vivid', 'duller'), Math.hypot(t.a, t.b) > 0.02 && Math.abs(dh) >= 1 ? `hue turned ${Math.round(Math.abs(dh))}°` : null].filter(Boolean);
  result.replaceChildren(
    h('div', { class: 'pair big' }, h('i', { style: { background: tHex } }), h('i', { style: { background: picked.hex } })),
    h('div', { class: 'verdict' }, h('strong', null, tier.name), h('span', { class: 'mono' }, `${tier.points} points · distance ${dE.toFixed(1)}`)),
    h('p', { class: 'small' }, notes.length ? notes.join(', ') : 'the same color'),
    h('p', { class: 'mono muted small' }, `target ${tHex} · clicked ${picked.hex}`),
  );
  if (log) {
    history.unshift({ target: tHex, pick: picked });
    history.length = Math.min(history.length, 12);
    paintHistory();
  }
}

function paintHistory(): void {
  historyList.replaceChildren(
    ...history.map((e) => {
      const { tier } = judgePick(e.target, e.pick);
      return h(
        'button',
        {
          class: 'hist',
          type: 'button',
          title: `${tier.name} (${tier.points})`,
          onclick: () => {
            wheelL = e.pick.lab.L;
            picked = e.pick;
            drawWheel();
            showResult(false);
          },
        },
        h('span', { class: 'pair' }, h('i', { style: { background: e.target } }), h('i', { style: { background: e.pick.hex } })),
        h('span', { class: 'small' }, tier.name),
      );
    }),
  );
}

// --- target ---------------------------------------------------------------------------
function setTarget(i: number): void {
  customHex = null;
  index = (i + COLORS.length) % COLORS.length;
  newTarget();
}

function newTarget(): void {
  const hex = targetHex();
  targetSw.style.background = hex;
  targetTitle.textContent = targetName();
  targetMeta.textContent = customHex ? hex : `${hex} · ${COLORS[index].element} · ${TIER_LABEL[COLORS[index].tier]}`;
  if (!customHex) select.value = String(index);
  picker.value = hex;
  wheelL = hexToOklab(hex).L;
  picked = null;
  drawWheel();
  showResult(false);
}

limits.textContent =
  'Ranks by distance (plain OKLab ×100; about 2 is just noticeable): ' +
  SEVEN.colorTiers.map((t) => (Number.isFinite(t.maxDE) ? `${t.name} ≤ ${t.maxDE}` : `${t.name} beyond`)).join(' · ') +
  '. Change them in src/data/tuning.ts.';
newTarget();
