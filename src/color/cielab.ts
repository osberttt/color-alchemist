// CIELAB (D65) and CIEDE2000: the scoring metric for Seven Colors.
// CIEDE2000 is the CIE's standard for "how different do two colors look".
// Reference: Sharma, Wu & Dalal (2005), "The CIEDE2000 Color-Difference Formula".

import { hexToLinear } from './oklab';

export interface Lab76 {
  L: number;
  a: number;
  b: number;
}

const XN = 0.95047;
const YN = 1.0;
const ZN = 1.08883;
const EPS = (6 / 29) ** 3;

function f(t: number): number {
  return t > EPS ? Math.cbrt(t) : t / (3 * (6 / 29) ** 2) + 4 / 29;
}

/** Linear sRGB (0..1) → CIELAB, D65 white. */
export function linearToCielab(r: number, g: number, b: number): Lab76 {
  const x = 0.4124564 * r + 0.3575761 * g + 0.1804375 * b;
  const y = 0.2126729 * r + 0.7151522 * g + 0.072175 * b;
  const z = 0.0193339 * r + 0.119192 * g + 0.9503041 * b;
  const fx = f(x / XN);
  const fy = f(y / YN);
  const fz = f(z / ZN);
  return { L: 116 * fy - 16, a: 500 * (fx - fy), b: 200 * (fy - fz) };
}

export function hexToCielab(hex: string): Lab76 {
  const [r, g, b] = hexToLinear(hex);
  return linearToCielab(r, g, b);
}

function fInv(t: number): number {
  return t > 6 / 29 ? t * t * t : 3 * (6 / 29) ** 2 * (t - 4 / 29);
}

/** CIELAB (D65) → linear sRGB. May fall outside 0..1 for colors a screen can't show. */
export function cielabToLinear(lab: Lab76): [number, number, number] {
  const fy = (lab.L + 16) / 116;
  const x = XN * fInv(fy + lab.a / 500);
  const y = YN * fInv(fy);
  const z = ZN * fInv(fy - lab.b / 200);
  return [
    3.2404542 * x - 1.5371385 * y - 0.4985314 * z,
    -0.969266 * x + 1.8760108 * y + 0.041556 * z,
    0.0556434 * x - 0.2040259 * y + 1.0572252 * z,
  ];
}

/** Polar CIELAB: lightness, chroma, hue in degrees. */
export interface LCh76 {
  L: number;
  C: number;
  h: number;
}

export function toLCh(lab: Lab76): LCh76 {
  return { L: lab.L, C: Math.hypot(lab.a, lab.b), h: hueDeg(lab.b, lab.a) };
}

export function fromLCh(c: LCh76): Lab76 {
  return { L: c.L, a: c.C * Math.cos(c.h * RAD), b: c.C * Math.sin(c.h * RAD) };
}

const RAD = Math.PI / 180;
const POW25_7 = 25 ** 7;

function hueDeg(b: number, a: number): number {
  if (a === 0 && b === 0) return 0;
  const h = Math.atan2(b, a) / RAD;
  return h < 0 ? h + 360 : h;
}

/** CIEDE2000's parametric weights. Larger = more forgiving of that kind of difference. */
export interface DeltaWeights {
  kL: number;
  kC: number;
  kH: number;
  /**
   * Optional (non-standard): kH applies fully only to small hue shifts. From
   * `hueLenientTo` to `hueStrictFrom` degrees of hue difference it eases back to 1,
   * so near hues are forgiven but clearly different hues are not.
   */
  hueLenientTo?: number;
  hueStrictFrom?: number;
}

function smoothstep(a: number, b: number, x: number): number {
  if (b <= a) return x >= b ? 1 : 0;
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

const STANDARD: DeltaWeights = { kL: 1, kC: 1, kH: 1 };

/** CIEDE2000 color difference. Standard when weights are omitted (kL = kC = kH = 1). */
export function ciede2000(c1: Lab76, c2: Lab76, k: DeltaWeights = STANDARD): number {
  const C1 = Math.hypot(c1.a, c1.b);
  const C2 = Math.hypot(c2.a, c2.b);
  const Cbar7 = ((C1 + C2) / 2) ** 7;
  // G stretches a* for near-neutral colors, where the eye is pickier.
  const G = 0.5 * (1 - Math.sqrt(Cbar7 / (Cbar7 + POW25_7)));
  const a1p = (1 + G) * c1.a;
  const a2p = (1 + G) * c2.a;
  const C1p = Math.hypot(a1p, c1.b);
  const C2p = Math.hypot(a2p, c2.b);
  const h1p = hueDeg(c1.b, a1p);
  const h2p = hueDeg(c2.b, a2p);

  const dLp = c2.L - c1.L;
  const dCp = C2p - C1p;
  let dhp = 0;
  if (C1p * C2p !== 0) {
    dhp = h2p - h1p;
    if (dhp > 180) dhp -= 360;
    else if (dhp < -180) dhp += 360;
  }
  const dHp = 2 * Math.sqrt(C1p * C2p) * Math.sin((dhp / 2) * RAD);

  const Lbp = (c1.L + c2.L) / 2;
  const Cbp = (C1p + C2p) / 2;
  let hbp: number;
  if (C1p * C2p === 0) hbp = h1p + h2p;
  else if (Math.abs(h1p - h2p) <= 180) hbp = (h1p + h2p) / 2;
  else if (h1p + h2p < 360) hbp = (h1p + h2p + 360) / 2;
  else hbp = (h1p + h2p - 360) / 2;

  const T =
    1 -
    0.17 * Math.cos((hbp - 30) * RAD) +
    0.24 * Math.cos(2 * hbp * RAD) +
    0.32 * Math.cos((3 * hbp + 6) * RAD) -
    0.2 * Math.cos((4 * hbp - 63) * RAD);
  const dTheta = 30 * Math.exp(-(((hbp - 275) / 25) ** 2));
  const Cbp7 = Cbp ** 7;
  const Rc = 2 * Math.sqrt(Cbp7 / (Cbp7 + POW25_7));
  const Sl = 1 + (0.015 * (Lbp - 50) ** 2) / Math.sqrt(20 + (Lbp - 50) ** 2);
  const Sc = 1 + 0.045 * Cbp;
  const Sh = 1 + 0.015 * Cbp * T;
  // The blue-region rotation term: hue and chroma differences interact there.
  const Rt = -Math.sin(2 * dTheta * RAD) * Rc;

  let kH = k.kH;
  if (k.hueLenientTo !== undefined && k.hueStrictFrom !== undefined) {
    kH = kH + (1 - kH) * smoothstep(k.hueLenientTo, k.hueStrictFrom, Math.abs(dhp));
  }
  const l = dLp / (k.kL * Sl);
  const c = dCp / (k.kC * Sc);
  const hh = dHp / (kH * Sh);
  return Math.sqrt(l * l + c * c + hh * hh + Rt * c * hh);
}
