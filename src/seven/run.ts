// Seven Colors run state (the mode kept its name): SEVEN.sections sections (now 5), one color each (ANALYSIS §4.1–4.6).
// Each color is judged by CIEDE2000 between the target and what the color
// extracting machine captured. The run builds one craft, ranked by the total.

import { COLORS, color, type ColorDef } from '../data/colors';
import { SEVEN } from '../data/tuning';
import { mulberry32, pickWeighted, randomSeed, type Rng } from '../meta/rng';
import { getSettings } from '../meta/storage';
import { craftTierFor, extract, judge, type Extraction } from '../scoring/extract';
import type { Plate } from '../color/plate';

export type SevenMode = 'camera' | 'practice' | 'photo';

/** Five operations of the alchemical Great Work, one per color, ending in Coagulation. */
export const OPERATIONS = ['Calcination', 'Dissolution', 'Conjunction', 'Distillation', 'Coagulation'];

export interface Section {
  index: number;
  def: ColorDef;
  /** Null when time ran out: nothing was extracted (Krillion's unanswered prompt, 0 points). */
  extracted: Extraction | null;
  empty: boolean;
  hex: string;
  /** CIEDE2000 between target and extracted. */
  dE: number;
  score: number;
  tier: string;
  tierIndex: number;
  zoom: number;
  /** Running total and craft rank after this color. */
  total: number;
  craft: string;
  craftIndex: number;
}

export interface SevenRun {
  mode: SevenMode;
  seed: number;
  rng: Rng;
  index: number;
  sections: Section[];
  used: Set<string>;
  tutorial: boolean;
  current: ColorDef | null;
}

export let seven: SevenRun | null = null;

export function newSeven(mode: SevenMode): SevenRun {
  const seed = randomSeed();
  seven = {
    mode,
    seed,
    rng: mulberry32(seed),
    index: 0,
    sections: [],
    used: new Set(),
    tutorial: mode === 'camera' && !getSettings().tutorialDone,
    current: null,
  };
  return seven;
}

export function endSeven(): void {
  seven = null;
}

export function dealSection(r: SevenRun): ColorDef {
  let def: ColorDef | undefined;
  if (r.index === 0 && r.tutorial) def = color('denim');
  else {
    const prev = r.sections[r.sections.length - 1]?.def;
    const darkCount = r.sections.filter((s) => s.def.dark).length;
    const pool = COLORS.filter(
      (c) => c.tier === SEVEN.tiers[r.index] && !r.used.has(c.id) && c.element !== prev?.element && (!c.dark || darkCount < SEVEN.maxDarkPerRun),
    );
    def = pickWeighted(r.rng, pool, (c) => c.dealWeight) ?? COLORS.find((c) => !r.used.has(c.id))!;
  }
  r.used.add(def.id);
  r.current = def;
  return def;
}

export function runTotal(r: SevenRun): number {
  return r.sections.reduce((t, s) => t + s.score, 0);
}

/** Hex shown for an empty extraction (nothing in the flask). */
export const EMPTY_HEX = '#3a3a40';

/** `view` is null when time ran out: the machine extracted nothing and the color scores 0. */
export function finishSection(r: SevenRun, view: Plate | null, zoom: number): Section {
  const def = r.current!;
  const extracted = view ? extract(view) : null;
  const j = extracted ? judge(def, extracted) : { dE: Infinity, score: SEVEN.emptyPoints, tier: 'Empty', tierIndex: SEVEN.colorTiers.length };
  const total = runTotal(r) + j.score;
  const craft = craftTierFor(total);
  const section: Section = {
    index: r.index,
    def,
    extracted,
    empty: !extracted,
    hex: extracted ? extracted.hex : EMPTY_HEX,
    dE: j.dE,
    score: j.score,
    tier: j.tier,
    tierIndex: j.tierIndex,
    zoom,
    total,
    craft: craft.name,
    craftIndex: craft.index,
  };
  r.sections.push(section);
  return section;
}

export interface SevenResult {
  total: number;
  craft: string;
  craftIndex: number;
  found: string[];
}

export function sevenResult(r: SevenRun): SevenResult {
  const total = runTotal(r);
  const c = craftTierFor(total);
  return { total, craft: c.name, craftIndex: c.index, found: r.sections.map((s) => s.hex) };
}
