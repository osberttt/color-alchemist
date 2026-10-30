// Plates (captured photos in linear RGB), light correction and drops (GDD §8.1–8.3).

import { TUNING } from '../data/tuning';
import { SRGB_TO_LINEAR, linearToOklab, linearToSrgb, chroma, type Lab } from './oklab';

/** A photo in linear-light RGB, interleaved r,g,b. */
export interface Plate {
  w: number;
  h: number;
  lin: Float32Array;
}

export type Gains = [number, number, number];

export interface Edits {
  /** Exposure in EV, applied in linear light. */
  ev: number;
  /** Chroma multiplier minus one, applied in OKLCh. */
  sat: number;
  /** Warmth in stops: red ×2^warm, blue ×2^−warm, then rescaled to keep luminance (white balance). */
  warm?: number;
  /** Tint in stops: green ×2^tint against red and blue, then rescaled to keep luminance. */
  tint?: number;
}

export const NO_EDITS: Edits = { ev: 0, sat: 0 };

/**
 * Per-channel linear gains for exposure and white balance (warmth, tint), the way a camera
 * applies white balance: one multiplier per channel (the viewfinder uses the same).
 */
export function editGains(edits: Edits): [number, number, number] {
  const k = Math.pow(2, edits.ev);
  const w = edits.warm ?? 0;
  const t = edits.tint ?? 0;
  if (!w && !t) return [k, k, k];
  const r = Math.pow(2, w);
  const g = Math.pow(2, t);
  const b = Math.pow(2, -w);
  const y = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return [(r / y) * k, (g / y) * k, (b / y) * k];
}

/** Normalized crop rectangle, 0..1 in plate space. */
export interface Crop {
  x: number;
  y: number;
  w: number;
  h: number;
}

export const FULL_CROP: Crop = { x: 0, y: 0, w: 1, h: 1 };

/** Average several RGBA frames in linear light (temporal denoise). */
export function plateFromFrames(frames: Uint8ClampedArray[], w: number, h: number): Plate {
  const n = w * h;
  const lin = new Float32Array(n * 3);
  const inv = 1 / frames.length;
  for (const f of frames) {
    for (let i = 0, j = 0; i < n; i++, j += 4) {
      lin[i * 3] += SRGB_TO_LINEAR[f[j]] * inv;
      lin[i * 3 + 1] += SRGB_TO_LINEAR[f[j + 1]] * inv;
      lin[i * 3 + 2] += SRGB_TO_LINEAR[f[j + 2]] * inv;
    }
  }
  return { w, h, lin };
}

function luminance(r: number, g: number, b: number): number {
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function normalizeAndClamp(g: Gains, min: number, max: number): Gains {
  // Keep overall brightness: divide by the gains' luminance.
  const y = luminance(g[0], g[1], g[2]);
  return g.map((v) => Math.min(max, Math.max(min, v / y))) as Gains;
}

/**
 * Shades-of-Gray illuminant estimate (Minkowski p) on the full plate,
 * turned into partial diagonal gains toward neutral (GDD §8.2).
 */
export function autoWhiteBalanceGains(plate: Plate): Gains {
  const { lin } = plate;
  const p = TUNING.wbP;
  const darkY = TUNING.wbDarkL ** 3;
  let sr = 0;
  let sg = 0;
  let sb = 0;
  let count = 0;
  for (let i = 0; i < lin.length; i += 3) {
    const r = lin[i];
    const g = lin[i + 1];
    const b = lin[i + 2];
    if (r >= TUNING.clipLevel || g >= TUNING.clipLevel || b >= TUNING.clipLevel) continue;
    if (luminance(r, g, b) < darkY) continue;
    sr += r ** p;
    sg += g ** p;
    sb += b ** p;
    count++;
  }
  if (count < 100) return [1, 1, 1];
  const er = (sr / count) ** (1 / p);
  const eg = (sg / count) ** (1 / p);
  const eb = (sb / count) ** (1 / p);
  const mean = (er + eg + eb) / 3;
  if (er <= 0 || eg <= 0 || eb <= 0) return [1, 1, 1];
  const full: Gains = [mean / er, mean / eg, mean / eb];
  const partial = full.map((v) => Math.pow(v, TUNING.wbStrength)) as Gains;
  return normalizeAndClamp(partial, TUNING.wbGainMin, TUNING.wbGainMax);
}

export interface AlbedoResult {
  ok: boolean;
  reason?: string;
  gains?: Gains;
}

/** "Tap something white": a white-patch reference around (x, y) in plate pixels (GDD §5). */
export function albedoGains(plate: Plate, x: number, y: number, radius: number): AlbedoResult {
  let r = 0;
  let g = 0;
  let b = 0;
  let n = 0;
  const x0 = Math.max(0, Math.round(x - radius));
  const x1 = Math.min(plate.w - 1, Math.round(x + radius));
  const y0 = Math.max(0, Math.round(y - radius));
  const y1 = Math.min(plate.h - 1, Math.round(y + radius));
  for (let yy = y0; yy <= y1; yy++) {
    for (let xx = x0; xx <= x1; xx++) {
      const i = (yy * plate.w + xx) * 3;
      r += plate.lin[i];
      g += plate.lin[i + 1];
      b += plate.lin[i + 2];
      n++;
    }
  }
  if (n === 0) return { ok: false, reason: 'Tap inside the photo.' };
  r /= n;
  g /= n;
  b /= n;
  const lab = linearToOklab(r, g, b);
  if (lab.L < TUNING.albedoMinL) return { ok: false, reason: "Too dark to be white. Tap something brighter." };
  if (chroma(lab) > TUNING.albedoMaxC) return { ok: false, reason: "That's not white enough. Tap paper, a wall or a white shirt." };
  if (r <= 0 || g <= 0 || b <= 0) return { ok: false, reason: 'Tap something white or grey.' };
  const mean = (r + g + b) / 3;
  return { ok: true, gains: normalizeAndClamp([mean / r, mean / g, mean / b], TUNING.albedoGainMin, TUNING.albedoGainMax) };
}

export function applyGains(plate: Plate, gains: Gains): Plate {
  const out = new Float32Array(plate.lin.length);
  for (let i = 0; i < out.length; i += 3) {
    out[i] = Math.min(1, plate.lin[i] * gains[0]);
    out[i + 1] = Math.min(1, plate.lin[i + 1] * gains[1]);
    out[i + 2] = Math.min(1, plate.lin[i + 2] * gains[2]);
  }
  return { w: plate.w, h: plate.h, lin: out };
}

export function dropSize(plate: Plate, minPx = 3): number {
  return Math.max(minPx, Math.round(Math.min(plate.w, plate.h) * TUNING.dropFraction));
}

/**
 * The drop grid: per-cell statistics computed once per plate, so edits and crops
 * can be re-evaluated cheaply. EV scales OKLab uniformly by cbrt(2^EV), and
 * saturation scales a/b, so both are applied analytically to these stats.
 */
export interface DropGrid {
  plate: Plate;
  size: number;
  cols: number;
  rows: number;
  n: number;
  meanLin: Float32Array;
  sig: Float32Array;
  /** Per drop, the max channel of each pixel, sorted ascending (n per drop). */
  maxSorted: Float32Array;
}

export function buildDrops(plate: Plate, size: number): DropGrid {
  const cols = Math.floor(plate.w / size);
  const rows = Math.floor(plate.h / size);
  const n = size * size;
  const count = cols * rows;
  const meanLin = new Float32Array(count * 3);
  const sig = new Float32Array(count * 3);
  const maxSorted = new Float32Array(count * n);
  const tmp = new Float32Array(n);
  const { lin, w } = plate;
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const d = row * cols + col;
      let sr = 0, sg = 0, sb = 0;
      let sL = 0, sa = 0, sbb = 0, qL = 0, qa = 0, qb = 0;
      let k = 0;
      for (let yy = row * size; yy < (row + 1) * size; yy++) {
        for (let xx = col * size; xx < (col + 1) * size; xx++) {
          const i = (yy * w + xx) * 3;
          const r = lin[i], g = lin[i + 1], b = lin[i + 2];
          sr += r;
          sg += g;
          sb += b;
          const lab = linearToOklab(r, g, b);
          sL += lab.L;
          sa += lab.a;
          sbb += lab.b;
          qL += lab.L * lab.L;
          qa += lab.a * lab.a;
          qb += lab.b * lab.b;
          tmp[k++] = r > g ? (r > b ? r : b) : g > b ? g : b;
        }
      }
      meanLin[d * 3] = sr / n;
      meanLin[d * 3 + 1] = sg / n;
      meanLin[d * 3 + 2] = sb / n;
      const mL = sL / n, ma = sa / n, mb = sbb / n;
      sig[d * 3] = Math.sqrt(Math.max(0, qL / n - mL * mL));
      sig[d * 3 + 1] = Math.sqrt(Math.max(0, qa / n - ma * ma));
      sig[d * 3 + 2] = Math.sqrt(Math.max(0, qb / n - mb * mb));
      tmp.sort();
      maxSorted.set(tmp, d * n);
    }
  }
  return { plate, size, cols, rows, n, meanLin, sig, maxSorted };
}

/** Drop colors after edits, plus which drops are valid candidates. */
export interface DropLabs {
  L: Float32Array;
  a: Float32Array;
  b: Float32Array;
  valid: Uint8Array;
  /** 1 when more than the allowed share of the drop's pixels are blown out. */
  clipped: Uint8Array;
}

function countAtLeast(sorted: Float32Array, start: number, n: number, threshold: number): number {
  let lo = 0;
  let hi = n;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (sorted[start + mid] >= threshold) hi = mid;
    else lo = mid + 1;
  }
  return n - lo;
}

export function evaluateDrops(grid: DropGrid, edits: Edits): DropLabs {
  const count = grid.cols * grid.rows;
  const L = new Float32Array(count);
  const a = new Float32Array(count);
  const b = new Float32Array(count);
  const valid = new Uint8Array(count);
  const clippedOut = new Uint8Array(count);
  const k = Math.pow(2, edits.ev);
  const kc = Math.cbrt(k);
  const s = 1 + edits.sat;
  const clipThreshold = TUNING.clipLevel / k;
  const maxClipped = TUNING.dropMaxClippedShare * grid.n;
  for (let d = 0; d < count; d++) {
    const lab = linearToOklab(
      Math.min(1, grid.meanLin[d * 3] * k),
      Math.min(1, grid.meanLin[d * 3 + 1] * k),
      Math.min(1, grid.meanLin[d * 3 + 2] * k),
    );
    L[d] = lab.L;
    a[d] = lab.a * s;
    b[d] = lab.b * s;
    const nL = grid.sig[d * 3] * kc;
    const na = grid.sig[d * 3 + 1] * kc * s;
    const nb = grid.sig[d * 3 + 2] * kc * s;
    const nonUniform = Math.sqrt(nL * nL + na * na + nb * nb);
    const clipped = countAtLeast(grid.maxSorted, d * grid.n, grid.n, clipThreshold);
    clippedOut[d] = clipped > maxClipped ? 1 : 0;
    valid[d] = clipped <= maxClipped && lab.L >= TUNING.dropMinL && nonUniform <= TUNING.dropMaxNonUniformity ? 1 : 0;
  }
  return { L, a, b, valid, clipped: clippedOut };
}

/** Range of drop columns/rows fully inside the crop. */
export function dropRange(grid: DropGrid, crop: Crop): { c0: number; c1: number; r0: number; r1: number } {
  const { w, h } = grid.plate;
  return {
    c0: Math.max(0, Math.ceil((crop.x * w) / grid.size - 1e-6)),
    c1: Math.min(grid.cols - 1, Math.floor(((crop.x + crop.w) * w) / grid.size + 1e-6) - 1),
    r0: Math.max(0, Math.ceil((crop.y * h) / grid.size - 1e-6)),
    r1: Math.min(grid.rows - 1, Math.floor(((crop.y + crop.h) * h) / grid.size + 1e-6) - 1),
  };
}

export function dropCenter(grid: DropGrid, d: number): { x: number; y: number } {
  const col = d % grid.cols;
  const row = Math.floor(d / grid.cols);
  return {
    x: ((col + 0.5) * grid.size) / grid.plate.w,
    y: ((row + 0.5) * grid.size) / grid.plate.h,
  };
}

export function dropLab(labs: DropLabs, d: number): Lab {
  return { L: labs.L[d], a: labs.a[d], b: labs.b[d] };
}

/** Render a plate (with edits) to 8-bit RGBA for display. */
let LINEAR_TO_SRGB8: Uint8ClampedArray | null = null;

export function renderPlate(plate: Plate, edits: Edits, out: Uint8ClampedArray): void {
  const k = editGains(edits);
  const s = 1 + edits.sat;
  if (!LINEAR_TO_SRGB8) {
    LINEAR_TO_SRGB8 = new Uint8ClampedArray(4096);
    for (let i = 0; i < 4096; i++) LINEAR_TO_SRGB8[i] = Math.round(linearToSrgb(i / 4095) * 255);
  }
  const lut = LINEAR_TO_SRGB8;
  const n = plate.w * plate.h;
  const px: [number, number, number] = [0, 0, 0];
  for (let i = 0, j = 0; i < n; i++, j += 4) {
    editPixel(plate.lin, i * 3, k, s, px);
    out[j] = lut[Math.max(0, Math.min(4095, (px[0] * 4095) | 0))];
    out[j + 1] = lut[Math.max(0, Math.min(4095, (px[1] * 4095) | 0))];
    out[j + 2] = lut[Math.max(0, Math.min(4095, (px[2] * 4095) | 0))];
    out[j + 3] = 255;
  }
}

/**
 * One pixel with edits applied: exposure and warmth as per-channel gains k in linear light
 * (clipping at white, like a sensor), then chroma ×s in OKLab. The viewfinder's GLSL does
 * the same; keep them together.
 */
function editPixel(lin: Float32Array, i: number, k: [number, number, number], s: number, out: [number, number, number]): void {
  let r = Math.min(1, lin[i] * k[0]);
  let g = Math.min(1, lin[i + 1] * k[1]);
  let b = Math.min(1, lin[i + 2] * k[2]);
  if (s !== 1) {
    // Scale chroma in OKLab: via cbrt-LMS, cheap enough at plate size.
    const l_ = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
    const m_ = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
    const s_ = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
    const L = 0.2104542553 * l_ + 0.793617785 * m_ - 0.0040720468 * s_;
    const A = (1.9779984951 * l_ - 2.428592205 * m_ + 0.4505937099 * s_) * s;
    const B = (0.0259040371 * l_ + 0.7827717662 * m_ - 0.808675766 * s_) * s;
    const l2 = L + 0.3963377774 * A + 0.2158037573 * B;
    const m2 = L - 0.1055613458 * A - 0.0638541728 * B;
    const s2 = L - 0.0894841775 * A - 1.291485548 * B;
    const l3 = l2 * l2 * l2;
    const m3 = m2 * m2 * m2;
    const s3 = s2 * s2 * s2;
    r = 4.0767416621 * l3 - 3.3077115913 * m3 + 0.2309699292 * s3;
    g = -1.2684380046 * l3 + 2.6097574011 * m3 - 0.3413193965 * s3;
    b = -0.0041960863 * l3 - 0.7034186147 * m3 + 1.707614701 * s3;
  }
  out[0] = Math.min(1, Math.max(0, r));
  out[1] = Math.min(1, Math.max(0, g));
  out[2] = Math.min(1, Math.max(0, b));
}

/** One linear-RGB color with edits applied (a reaction's ingredients on an extract). */
export function editColor(lin: readonly [number, number, number], edits: Edits): [number, number, number] {
  const out: [number, number, number] = [0, 0, 0];
  editPixel(Float32Array.from(lin), 0, editGains(edits), 1 + edits.sat, out);
  return out;
}

/** A plate with edits applied to every pixel, exactly as the viewfinder's shader does. */
export function applyEdits(plate: Plate, edits: Edits): Plate {
  if (!edits.ev && !edits.sat && !edits.warm && !edits.tint) return plate;
  const k = editGains(edits);
  const s = 1 + edits.sat;
  const lin = new Float32Array(plate.lin.length);
  const px: [number, number, number] = [0, 0, 0];
  for (let i = 0; i < lin.length; i += 3) {
    editPixel(plate.lin, i, k, s, px);
    lin[i] = px[0];
    lin[i + 1] = px[1];
    lin[i + 2] = px[2];
  }
  return { w: plate.w, h: plate.h, lin };
}
