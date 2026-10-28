// The color extracting machine (ANALYSIS §4.6–4.7): what the camera captured inside
// the machine, averaged in linear light, IS the color. No correction.
// Blending is allowed: red and yellow objects side by side extract as orange.
// Judged by CIEDE2000 (hue weighted leniently), scored with Krillion's points.

import { linearToHex } from '../color/oklab';
import { ciede2000, hexToCielab, linearToCielab, type Lab76 } from '../color/cielab';
import type { Plate } from '../color/plate';
import type { ColorDef } from '../data/colors';
import { SEVEN } from '../data/tuning';

export interface Extraction {
  /** Mean linear RGB of every pixel in the machine. */
  lin: [number, number, number];
  lab: Lab76;
  hex: string;
}

export interface Judgement {
  dE: number;
  score: number;
  tier: string;
  /** 0 = best (Flawless) … 5 = worst (Botched). */
  tierIndex: number;
}

/** The machine is the centered square of the captured view. */
export function machineRect(plate: Plate, fraction: number = SEVEN.squareFraction): { x: number; y: number; side: number } {
  const side = Math.max(1, Math.round(Math.min(plate.w, plate.h) * fraction));
  return { x: Math.round((plate.w - side) / 2), y: Math.round((plate.h - side) / 2), side };
}

export function extract(plate: Plate, rect = machineRect(plate)): Extraction {
  let r = 0;
  let g = 0;
  let b = 0;
  for (let y = rect.y; y < rect.y + rect.side; y++) {
    let i = (y * plate.w + rect.x) * 3;
    for (let x = 0; x < rect.side; x++, i += 3) {
      r += plate.lin[i];
      g += plate.lin[i + 1];
      b += plate.lin[i + 2];
    }
  }
  const n = rect.side * rect.side;
  const lin: [number, number, number] = [r / n, g / n, b / n];
  return { lin, lab: linearToCielab(lin[0], lin[1], lin[2]), hex: linearToHex(lin[0], lin[1], lin[2]) };
}

/**
 * The machine's contents averaged into an n×n mosaic (8-bit sRGB RGBA), each cell
 * mixed in linear light like the scorer. n = 1 is exactly the extracted color.
 * Used for the blend-reveal animation.
 */
export function mosaic(plate: Plate, n: number, rect = machineRect(plate)): Uint8ClampedArray<ArrayBuffer> {
  const out = new Uint8ClampedArray(n * n * 4);
  for (let cy = 0; cy < n; cy++) {
    for (let cx = 0; cx < n; cx++) {
      const x0 = rect.x + Math.floor((cx * rect.side) / n);
      const x1 = rect.x + Math.floor(((cx + 1) * rect.side) / n);
      const y0 = rect.y + Math.floor((cy * rect.side) / n);
      const y1 = rect.y + Math.floor(((cy + 1) * rect.side) / n);
      let r = 0;
      let g = 0;
      let b = 0;
      let k = 0;
      for (let y = y0; y < y1; y++) {
        for (let x = x0, i = (y * plate.w + x0) * 3; x < x1; x++, i += 3) {
          r += plate.lin[i];
          g += plate.lin[i + 1];
          b += plate.lin[i + 2];
          k++;
        }
      }
      const hex = linearToHex(r / Math.max(1, k), g / Math.max(1, k), b / Math.max(1, k));
      const j = (cy * n + cx) * 4;
      out[j] = parseInt(hex.slice(1, 3), 16);
      out[j + 1] = parseInt(hex.slice(3, 5), 16);
      out[j + 2] = parseInt(hex.slice(5, 7), 16);
      out[j + 3] = 255;
    }
  }
  return out;
}

/** The game's distance: CIEDE2000 with the tuned weights. */
export function distance(targetHex: string, lab: Lab76): number {
  return ciede2000(hexToCielab(targetHex), lab, SEVEN.deltaWeights);
}

export function tierFor(dE: number): { name: string; index: number; points: number } {
  const i = SEVEN.colorTiers.findIndex((t) => dE <= t.maxDE);
  const index = i < 0 ? SEVEN.colorTiers.length - 1 : i;
  const t = SEVEN.colorTiers[index];
  return { name: t.name, index, points: t.points };
}

/** Krillion-style: the rank decides the points. */
export function scoreFor(dE: number): number {
  return tierFor(dE).points;
}

export function judge(target: ColorDef, extracted: Extraction): Judgement {
  const dE = distance(target.target, extracted.lab);
  const t = tierFor(dE);
  return { dE, score: t.points, tier: t.name, tierIndex: t.index };
}

export function craftTierFor(total: number): { name: string; index: number; next: { name: string; min: number } | null } {
  let index = 0;
  SEVEN.craftTiers.forEach((t, i) => {
    if (total >= t.min) index = i;
  });
  const next = SEVEN.craftTiers[index + 1] ?? null;
  return { name: SEVEN.craftTiers[index].name, index, next: next ? { name: next.name, min: next.min } : null };
}
