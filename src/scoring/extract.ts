// The color extracting machine (ANALYSIS §4.6): what the camera captured inside
// the machine, averaged in linear light, IS the color. No correction, no leniency.
// Blending is allowed: red and yellow objects side by side extract as orange.

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

export function tierFor(dE: number): { name: string; index: number } {
  const i = SEVEN.colorTiers.findIndex((t) => dE <= t.maxDE);
  const index = i < 0 ? SEVEN.colorTiers.length - 1 : i;
  return { name: SEVEN.colorTiers[index].name, index };
}

export function scoreFor(dE: number): number {
  return Math.round(100 * Math.exp(-dE / SEVEN.scoreScale));
}

export function judge(target: ColorDef, extracted: Extraction): Judgement {
  const dE = ciede2000(hexToCielab(target.target), extracted.lab);
  const t = tierFor(dE);
  return { dE, score: scoreFor(dE), tier: t.name, tierIndex: t.index };
}

export function craftTierFor(total: number): { name: string; index: number; next: { name: string; min: number } | null } {
  let index = 0;
  SEVEN.craftTiers.forEach((t, i) => {
    if (total >= t.min) index = i;
  });
  const next = SEVEN.craftTiers[index + 1] ?? null;
  return { name: SEVEN.craftTiers[index].name, index, next: next ? { name: next.name, min: next.min } : null };
}
