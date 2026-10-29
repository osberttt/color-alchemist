// Color math: sRGB <-> linear, linear <-> OKLab (Björn Ottosson), and the
// game's distance ΔE_CA (GDD §8.4). Pure functions only.

import { TUNING } from '../data/tuning';

export interface Lab {
  L: number;
  a: number;
  b: number;
}

/** sRGB 8-bit value -> linear light, as a 256-entry lookup table. */
export const SRGB_TO_LINEAR = new Float32Array(256);
for (let i = 0; i < 256; i++) {
  const c = i / 255;
  SRGB_TO_LINEAR[i] = c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

export function srgbToLinear(c: number): number {
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

export function linearToSrgb(c: number): number {
  if (c <= 0) return 0;
  if (c >= 1) return 1;
  return c <= 0.0031308 ? c * 12.92 : 1.055 * Math.pow(c, 1 / 2.4) - 0.055;
}

export function linearToOklab(r: number, g: number, b: number): Lab {
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return {
    L: 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    a: 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    b: 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  };
}

export function oklabToLinear(lab: Lab): [number, number, number] {
  const l_ = lab.L + 0.3963377774 * lab.a + 0.2158037573 * lab.b;
  const m_ = lab.L - 0.1055613458 * lab.a - 0.0638541728 * lab.b;
  const s_ = lab.L - 0.0894841775 * lab.a - 1.291485548 * lab.b;
  const l = l_ * l_ * l_;
  const m = m_ * m_ * m_;
  const s = s_ * s_ * s_;
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
}

export function hexToLinear(hex: string): [number, number, number] {
  const n = parseInt(hex.replace('#', ''), 16);
  return [
    srgbToLinear(((n >> 16) & 255) / 255),
    srgbToLinear(((n >> 8) & 255) / 255),
    srgbToLinear((n & 255) / 255),
  ];
}

export function hexToOklab(hex: string): Lab {
  const [r, g, b] = hexToLinear(hex);
  return linearToOklab(r, g, b);
}

function toHex2(c: number): string {
  return Math.round(Math.min(1, Math.max(0, c)) * 255)
    .toString(16)
    .padStart(2, '0');
}

export function linearToHex(r: number, g: number, b: number): string {
  return '#' + toHex2(linearToSrgb(r)) + toHex2(linearToSrgb(g)) + toHex2(linearToSrgb(b));
}

/** OKLab -> displayable hex, chroma-reduced until it fits in sRGB. */
export function oklabToHex(lab: Lab): string {
  let k = 1;
  for (let i = 0; i < 12; i++) {
    const [r, g, b] = oklabToLinear({ L: lab.L, a: lab.a * k, b: lab.b * k });
    if (r >= -0.001 && r <= 1.001 && g >= -0.001 && g <= 1.001 && b >= -0.001 && b <= 1.001) {
      return linearToHex(r, g, b);
    }
    k *= 0.85;
  }
  const [r, g, b] = oklabToLinear({ L: lab.L, a: 0, b: 0 });
  return linearToHex(r, g, b);
}

export function chroma(lab: Lab): number {
  return Math.hypot(lab.a, lab.b);
}

/** OKLCh hue in degrees, 0..360. */
export function hue(lab: Lab): number {
  const h = (Math.atan2(lab.b, lab.a) * 180) / Math.PI;
  return h < 0 ? h + 360 : h;
}

/**
 * ΔE_CA, the "Colorchemy distance" (GDD §8.4).
 * Lightness counts half, a slightly duller sample is forgiven, a greyish one is not,
 * hue counts fully.
 * ΔH² is computed as Δa² + Δb² − ΔC², which equals (2·√(C₁C₂)·sin(Δh/2))².
 */
export function deltaECA(target: Lab, sample: Lab): number {
  const dL = sample.L - target.L;
  const c1 = Math.hypot(target.a, target.b);
  const c2 = Math.hypot(sample.a, sample.b);
  const dC = c2 - c1;
  const da = sample.a - target.a;
  const db = sample.b - target.b;
  const dH2 = Math.max(0, da * da + db * db - dC * dC);
  const wC = c2 < c1 ? TUNING.wCDuller * (1 + TUNING.dullRelK * (1 - c2 / c1)) : TUNING.wCVivid;
  const lTerm = TUNING.wL * dL;
  const cTerm = wC * dC;
  return Math.sqrt(lTerm * lTerm + cTerm * cTerm + dH2);
}

/** Accuracy curve 0..100 (GDD §8.5). `d` is ΔE_CA already divided by the color's tolerance. */
export function accuracy(d: number): number {
  if (d <= TUNING.accCore) return 100;
  const x = (d - TUNING.accCore) / TUNING.accSigma;
  return 100 * Math.exp(-x * x);
}

/** Plain euclidean OKLab distance: the game's scoring distance (×100, scoring/extract.ts), emoji and UI. */
export function deltaEOK(p: Lab, q: Lab): number {
  return Math.hypot(p.L - q.L, p.a - q.a, p.b - q.b);
}

/** Mix two OKLab colors (potion swirl). */
export function mixLab(p: Lab, q: Lab, t: number): Lab {
  return { L: p.L + (q.L - p.L) * t, a: p.a + (q.a - p.a) * t, b: p.b + (q.b - p.b) * t };
}
