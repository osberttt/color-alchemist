// The scoring tuner (dev and test builds only). Pick a target, move the rank
// thresholds, and see the worst color that still earns each rank, in six
// directions, side by side with the target. Uses the game's real scoring code.

import '@fontsource-variable/inter/wght.css';
import '@fontsource/jetbrains-mono/400.css';
import './tuner.css';
import { COLORS, TIER_LABEL } from '../data/colors';
import { SEVEN, SEVEN_DEFAULTS, applyTunables, clearTunables, currentTunables, saveTunables, type SevenTunables } from '../data/tuning';
import { ciede2000, cielabToLinear, fromLCh, hexToCielab, linearToCielab, toLCh, type LCh76, type Lab76 } from '../color/cielab';
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

type DirId = 'lighter' | 'darker' | 'duller' | 'vivid' | 'hue+' | 'hue-';
const DIRS: { id: DirId; label: string }[] = [
  { id: 'lighter', label: 'lighter' },
  { id: 'darker', label: 'darker' },
  { id: 'duller', label: 'duller' },
  { id: 'vivid', label: 'more vivid' },
  { id: 'hue+', label: 'hue →' },
  { id: 'hue-', label: 'hue ←' },
];

const CRAFT_NAMES = SEVEN.craftTiers.map((t) => t.name);
const TIER_NAMES = SEVEN.colorTiers.map((t) => t.name);
const fmt1 = (n: number) => (Number.isFinite(n) ? n.toFixed(n < 10 ? 2 : 1) : '∞');

// --- state -------------------------------------------------------------------------
let t: SevenTunables = currentTunables();
let index = COLORS.findIndex((c) => c.id === 'teal');
let custom: Target | null = null;
let place: 'edge' | 'middle' = 'edge';
let bg: 'grey' | 'dark' | 'light' = 'grey';

const target = (): Target => {
  if (custom) return custom;
  const c = COLORS[index];
  return { name: c.name, hex: c.target, meta: `${c.element} · ${TIER_LABEL[c.tier]}` };
};

function save(): void {
  applyTunables(t);
  saveTunables(t);
}

// --- color examples -----------------------------------------------------------------
function move(base: LCh76, dir: DirId, amount: number): LCh76 {
  switch (dir) {
    case 'lighter':
      return { ...base, L: base.L + amount };
    case 'darker':
      return { ...base, L: base.L - amount };
    case 'duller':
      return { ...base, C: base.C - amount };
    case 'vivid':
      return { ...base, C: base.C + amount };
    case 'hue+':
      return { ...base, h: base.h + amount };
    default:
      return { ...base, h: base.h - amount };
  }
}

function maxAmount(base: LCh76, dir: DirId): number {
  if (dir === 'lighter') return 100 - base.L;
  if (dir === 'darker') return base.L;
  if (dir === 'duller') return base.C;
  if (dir === 'vivid') return 160;
  return 180;
}

interface Example {
  hex: string;
  dE: number;
  status: 'ok' | 'unreachable' | 'gamut';
}

/** The color `d` ΔE00 away from the target in one direction (bisection). */
function exampleAt(targetLab: Lab76, dir: DirId, d: number): Example {
  const base = toLCh(targetLab);
  const max = maxAmount(base, dir);
  const dist = (a: number) => ciede2000(targetLab, fromLCh(move(base, dir, a)), t.weights);
  if (max <= 0 || dist(max) < d) return { hex: '#000000', dE: d, status: 'unreachable' };
  let lo = 0;
  let hi = max;
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    if (dist(mid) < d) lo = mid;
    else hi = mid;
  }
  const lab = fromLCh(move(base, dir, hi));
  const [r, g, b] = cielabToLinear(lab);
  const inGamut = [r, g, b].every((v) => v >= -0.002 && v <= 1.002);
  return { hex: linearToHex(r, g, b), dE: ciede2000(targetLab, lab, t.weights), status: inGamut ? 'ok' : 'gamut' };
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
  numberField(`${CRAFT_NAMES[i + 1]} ≥`, 5, 5, 700, (v) => {
    t.craftMins[i] = v;
    for (let k = i + 1; k < t.craftMins.length; k++) if (t.craftMins[k] <= t.craftMins[k - 1]) t.craftMins[k] = t.craftMins[k - 1] + 5;
    for (let k = i - 1; k >= 0; k--) if (t.craftMins[k] >= t.craftMins[k + 1]) t.craftMins[k] = Math.max(5, t.craftMins[k + 1] - 5);
    changed();
  }),
);

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
const toggles = h('div', { class: 'row' });

const craftGallery = h('div', { class: 'craft-gallery' });
const cameraBox = h('div', { class: 'cam-box' });
const camSquare = h('span', { class: 'cam-square' });
const camReadout = h('div', { class: 'cam-readout' });
const camLog = h('ol', { class: 'cam-log' });

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
        h('h3', null, 'Craft ranks (running total of 7 colors, max 700)'),
        ...craftFields.map((f) => f.el),
      ),
    ),
    h(
      'div',
      null,
      h(
        'section',
        { class: 'panel' },
        h('h3', null, 'Examples per rank'),
        h('p', { class: 'muted small' }, 'Left half: the target. Right half: a color at that distance. ⚠ = no screen or camera can produce it exactly. Hatched = impossible in that direction.'),
        toggles,
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
        h('p', { class: 'muted small' }, 'Every render picks a random palette and new random shapes.'),
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
  document.body.dataset.bg = bg;
  targetSw.style.background = tg.hex;
  targetName.textContent = tg.name;
  targetMeta.textContent = `${tg.hex} · ${tg.meta}`;
  targetLabText.textContent = `CIELAB  L ${tLab.L.toFixed(1)} · a ${tLab.a.toFixed(1)} · b ${tLab.b.toFixed(1)}`;
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
    f.hint.textContent = `× 7 colors = ${t.tierPoints[i] * SEVEN.sections}`;
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

  toggles.replaceChildren(
    ...(['edge', 'middle'] as const).map((p) => h('button', { class: `btn ${place === p ? 'on' : ''}`, type: 'button', onclick: () => ((place = p), refresh()) }, p === 'edge' ? 'Worst that still counts' : 'Middle of the rank')),
    ...(['grey', 'dark', 'light'] as const).map((k) => h('button', { class: `btn ${bg === k ? 'on' : ''}`, type: 'button', onclick: () => ((bg = k), refresh()) }, `${k} background`)),
  );

  examplesBody.replaceChildren(
    ...bands().map((b) => {
      const d = sampleDistance(b);
      const chips = DIRS.map((dir) => {
        const ex = exampleAt(tLab, dir.id, d);
        return h(
          'figure',
          { class: `chip ${ex.status}` },
          h('span', { class: 'pair' }, h('i', { style: { background: tg.hex } }), h('i', { style: { background: ex.status === 'unreachable' ? 'transparent' : ex.hex } })),
          h('figcaption', null, dir.label, h('br'), ex.status === 'unreachable' ? 'not possible' : `ΔE ${ex.dE.toFixed(2)}${ex.status === 'gamut' ? ' ⚠' : ''}`),
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
  updateCamera();
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
let lastSample: { hex: string; dE: number } | null = null;

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
  const lab = linearToCielab(m[0], m[1], m[2]);
  const dE = ciede2000(hexToCielab(tg.hex), lab, t.weights);
  const hex = linearToHex(m[0], m[1], m[2]);
  lastSample = { hex, dE };
  camReadout.replaceChildren(
    h('span', { class: 'pair big' }, h('i', { style: { background: tg.hex } }), h('i', { style: { background: hex } })),
    h('div', null, h('strong', null, tierFor(dE).name), h('p', { class: 'mono' }, `ΔE ${dE.toFixed(2)} · score ${scoreFor(dE)}`), h('p', { class: 'mono muted small' }, hex)),
  );
}

function logSample(): void {
  if (!lastSample) return;
  const tg = target();
  camLog.prepend(
    h(
      'li',
      null,
      h('span', { class: 'pair' }, h('i', { style: { background: tg.hex } }), h('i', { style: { background: lastSample.hex } })),
      h('span', { class: 'mono small' }, `${tg.name}: ΔE ${lastSample.dE.toFixed(2)} → ${tierFor(lastSample.dE).name} (${scoreFor(lastSample.dE)})`),
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
