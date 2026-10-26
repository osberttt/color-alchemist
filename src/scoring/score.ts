// Pure scoring functions (GDD §8.5–8.10). Numbers in, numbers out.

import { TUNING } from '../data/tuning';
import { chroma, hue, type Lab } from '../color/oklab';
import type { ColorDef, Tier } from '../data/colors';
import type { Edits } from '../color/plate';
import { findFormula } from '../data/formulae';

export type Grade = 'Quintessence' | 'Essence' | 'Elixir' | 'Tincture' | 'Murk' | 'Sludge';

export const GRADE_ORDER: Grade[] = ['Sludge', 'Murk', 'Tincture', 'Elixir', 'Essence', 'Quintessence'];

export function gradeRank(g: Grade): number {
  return GRADE_ORDER.indexOf(g);
}

/** Per-color grade (GDD §8.6). Quintessence also needs a clean brew. */
export function colorGrade(acc: number, purity: number): Grade {
  if (acc >= 95 && purity >= 0.95) return 'Quintessence';
  if (acc >= 80) return 'Essence';
  if (acc >= 60) return 'Elixir';
  if (acc >= 40) return 'Tincture';
  if (acc >= 20) return 'Murk';
  return 'Sludge';
}

export function isFoolsGold(acc: number, accNoEdits: number): boolean {
  return acc - accNoEdits >= TUNING.foolsGoldThreshold;
}

export function purityOf(edits: Edits): { purity: number; pure: boolean } {
  const pure = edits.ev === 0 && edits.sat === 0;
  if (pure) return { purity: TUNING.pureDraw, pure };
  const p = 1 - TUNING.puritySlope * Math.abs(edits.ev) - (TUNING.puritySlope * Math.abs(edits.sat)) / TUNING.satMax;
  return { purity: Math.max(TUNING.purityFloor, p), pure };
}

/** Crop bonus: logarithmic and capped (GDD §8.7). */
export function concentration(f: number): number {
  const ff = Math.max(TUNING.cropMinArea, Math.min(1, f));
  const t = Math.min(1, Math.max(0, Math.log10(1 / ff) / 2));
  return 1 + (TUNING.concentrationMax - 1) * t;
}

export function rarity(a: Tier, b: Tier): number {
  return (TUNING.tierMult[a] + TUNING.tierMult[b]) / 2;
}

export function quicksilver(secondsLeft: number): number {
  return Math.min(TUNING.quicksilverMax, TUNING.quicksilverPerSecond * Math.floor(Math.max(0, secondsLeft)));
}

export interface Bonus {
  name: string;
  points: number;
}

export interface BrewInputs {
  accA: number;
  accB: number;
  tierA: Tier;
  tierB: Tier;
  f: number;
  edits: Edits;
  catalystMult: number;
  transmuted: boolean;
  secondsLeft: number;
}

export interface BrewBreakdown {
  match: number;
  rarity: number;
  concentration: number;
  purity: number;
  pure: boolean;
  catalyst: number;
  transmute: number;
  base: number;
  quicksilver: number;
  bonuses: Bonus[];
  total: number;
}

export function brewScore(inp: BrewInputs): BrewBreakdown {
  const match = Math.sqrt(Math.max(0, inp.accA) * Math.max(0, inp.accB));
  const rar = rarity(inp.tierA, inp.tierB);
  const conc = concentration(inp.f);
  const { purity, pure } = purityOf(inp.edits);
  const transmute = inp.transmuted ? TUNING.transmuteMult : 1;
  const base = Math.round(10 * match * rar * conc * purity * inp.catalystMult * transmute);
  const qs = quicksilver(inp.secondsLeft);
  const bonuses: Bonus[] = [];
  if (inp.f <= TUNING.pinchMaxF && inp.accA >= 60 && inp.accB >= 60) {
    bonuses.push({ name: "Philosopher's Pinch", points: TUNING.pinchPoints });
  }
  if (Math.abs(inp.accA - inp.accB) <= TUNING.equilibriumGap && inp.accA >= TUNING.equilibriumMin && inp.accB >= TUNING.equilibriumMin) {
    bonuses.push({ name: 'Equilibrium', points: TUNING.equilibriumPoints });
  }
  const total = base + qs + bonuses.reduce((s, b) => s + b.points, 0);
  return { match, rarity: rar, concentration: conc, purity, pure, catalyst: inp.catalystMult, transmute, base, quicksilver: qs, bonuses, total };
}

/** The brew's grade is the grade of `match`; Quintessence needs both colors Quintessence. */
export function brewGrade(match: number, gradeA: Grade, gradeB: Grade, purity: number): Grade {
  const g = colorGrade(match, purity);
  if (g === 'Quintessence' && (gradeA !== 'Quintessence' || gradeB !== 'Quintessence')) return 'Essence';
  return g;
}

export function potionName(grade: Grade, a: ColorDef, b: ColorDef): string {
  const f = findFormula(a.id, b.id);
  if (f) return `${grade}: ${f.name}`;
  return `${grade} of ${a.virtue} & ${b.virtue}`;
}

export interface Band {
  name: string;
  opus: string;
}

const OPUS: Record<string, string> = {
  GRAYSCALE: 'Grayscale Dregs',
  SEPIA: 'Sepia Tonic',
  PASTEL: 'Pastel Philter',
  VIVID: 'Vivid Panacea',
  TECHNICOLOR: 'Technicolor Ambrosia',
  'FULL SPECTRUM': "Philosopher's Panacea",
};

export function bandFor(total: number, stone: boolean): Band {
  let name = TUNING.bands[0].name as string;
  for (const b of TUNING.bands) if (total >= b.min) name = b.name;
  if (stone) name = 'FULL SPECTRUM';
  return { name, opus: OPUS[name] };
}

export function nextBand(total: number): { name: string; at: number } | null {
  for (const b of TUNING.bands) if (total < b.min) return { name: b.name, at: b.min };
  return null;
}

// --- Hints (GDD §8.8) ---------------------------------------------------------

const HUE_WORDS: [string, number][] = [
  ['red', 25],
  ['orange', 55],
  ['yellow', 100],
  ['green', 140],
  ['cyan', 195],
  ['blue', 255],
  ['purple', 300],
  ['pink', 350],
];

function angleDiff(a: number, b: number): number {
  let d = b - a;
  while (d > 180) d -= 360;
  while (d < -180) d += 360;
  return d;
}

function hueWord(h: number): string {
  let best = HUE_WORDS[0][0];
  let bestD = 999;
  for (const [w, c] of HUE_WORDS) {
    const d = Math.abs(angleDiff(h, c));
    if (d < bestD) {
      bestD = d;
      best = w;
    }
  }
  return best;
}

/** Up to two plain-language reasons why a sample missed its target. */
export function hintsFor(target: Lab, sample: Lab): string[] {
  const issues: { text: string; weight: number }[] = [];
  const dL = sample.L - target.L;
  if (dL > 0.06) issues.push({ text: 'too light', weight: Math.abs(dL) * TUNING.wL });
  if (dL < -0.06) issues.push({ text: 'too dark', weight: Math.abs(dL) * TUNING.wL });
  const c1 = chroma(target);
  const c2 = chroma(sample);
  if (c2 < c1 - 0.03) issues.push({ text: 'too dull', weight: (c1 - c2) * TUNING.wCDuller });
  if (c2 > c1 + 0.04) issues.push({ text: 'too vivid', weight: c2 - c1 });
  if (c1 > 0.04 && c2 > 0.04) {
    const h1 = hue(target);
    const h2 = hue(sample);
    const dh = angleDiff(h1, h2);
    if (Math.abs(dh) > 8) {
      const ts = hueWord(h1);
      let word = hueWord(h2);
      if (word === ts) word = hueWord(h1 + Math.sign(dh) * 60);
      const dH = 2 * Math.sqrt(c1 * c2) * Math.sin((Math.abs(dh) * Math.PI) / 360);
      issues.push({ text: `too ${word}`, weight: dH });
    }
  }
  return issues
    .sort((x, y) => y.weight - x.weight)
    .slice(0, 2)
    .map((i) => i.text);
}
