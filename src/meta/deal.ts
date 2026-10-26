// Stages, catalysts and pair dealing (GDD §3, §10.2).

import { COLORS, type ColorDef, type Tier } from '../data/colors';
import { findFormula } from '../data/formulae';
import { TUNING } from '../data/tuning';
import { deltaECA } from '../color/oklab';
import { pickWeighted, type Rng } from './rng';

export interface Stage {
  name: string;
  meaning: string;
}

export const STAGES: Stage[] = [
  { name: 'Nigredo', meaning: 'the blackening' },
  { name: 'Albedo', meaning: 'the whitening' },
  { name: 'Rubedo', meaning: 'the reddening' },
];

export type CatalystId = 'haste' | 'purist' | 'distill' | 'eclipse';

export interface Catalyst {
  id: CatalystId;
  name: string;
  rule: string;
  mult: number;
}

export const CATALYSTS: Catalyst[] = [
  { id: 'haste', name: 'Haste', rule: 'The hunt lasts 30 seconds.', mult: 1.25 },
  { id: 'purist', name: 'Purist', rule: 'Brightness and saturation are locked.', mult: 1.1 },
  { id: 'distill', name: 'Distill', rule: 'Your crop must be 10 % of the photo or less.', mult: 1.2 },
  { id: 'eclipse', name: 'Eclipse', rule: 'The Lens is dark and the meters are hidden.', mult: 1.2 },
];

export function pairDelta(a: ColorDef, b: ColorDef): number {
  return Math.min(deltaECA(a.lab, b.lab), deltaECA(b.lab, a.lab));
}

/** Rules 1–3: far apart, different elements, at most one dark color. */
export function pairLegal(a: ColorDef, b: ColorDef): boolean {
  if (a.id === b.id) return false;
  if (a.element === b.element) return false;
  if (a.dark && b.dark) return false;
  return pairDelta(a, b) >= TUNING.pairMinDelta;
}

function tiersFor(stage: number, rng: Rng): [Tier, Tier] {
  if (stage === 0) return ['lead', 'lead'];
  if (stage === 1) return ['lead', 'silver'];
  return ['silver', rng() < 0.5 ? 'silver' : 'gold'];
}

export interface DealOptions {
  used: Set<string>;
  discovered: Set<string>;
}

export function dealPair(rng: Rng, stage: number, opts: DealOptions): [ColorDef, ColorDef] {
  const [ta, tb] = tiersFor(stage, rng);
  const pool = COLORS.filter((c) => !opts.used.has(c.id));
  const pairs: [ColorDef, ColorDef][] = [];
  for (const a of pool) {
    if (a.tier !== ta) continue;
    for (const b of pool) {
      if (b.tier !== tb) continue;
      if (ta === tb && a.id >= b.id) continue;
      if (pairLegal(a, b)) pairs.push([a, b]);
    }
  }
  const weight = ([a, b]: [ColorDef, ColorDef]) =>
    a.dealWeight *
    b.dealWeight *
    (findFormula(a.id, b.id) ? TUNING.formulaWeight : 1) *
    (opts.discovered.has(a.id) ? 1 : TUNING.undiscoveredWeight) *
    (opts.discovered.has(b.id) ? 1 : TUNING.undiscoveredWeight);
  const pick = pickWeighted(rng, pairs, weight);
  if (!pick) {
    // Should not happen with 55 colors; fall back to any legal pair.
    const all = COLORS.filter((c) => !opts.used.has(c.id));
    for (const a of all) for (const b of all) if (pairLegal(a, b)) return [a, b];
    return [COLORS[0], COLORS[1]];
  }
  return rng() < 0.5 ? pick : [pick[1], pick[0]];
}

/** Transmute: another color of the same tier, legal with the kept one (GDD §3.2). */
export function transmute(rng: Rng, keep: ColorDef, replace: ColorDef, used: Set<string>): ColorDef | null {
  const options = COLORS.filter((c) => c.tier === replace.tier && c.id !== replace.id && !used.has(c.id) && pairLegal(keep, c));
  return pickWeighted(rng, options, (c) => c.dealWeight) ?? null;
}

export function pickCatalyst(rng: Rng): Catalyst {
  return CATALYSTS[Math.floor(rng() * CATALYSTS.length)];
}
