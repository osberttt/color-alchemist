// Seven Colors run state (the mode kept its name): SEVEN.sections sections (now 5), one color each (ANALYSIS §4.1–4.6).
// Each color is judged by CIEDE2000 between the target and what the color
// extracting machine captured. The run builds one craft, ranked by the total.

import { COLORS, color, type ColorDef } from '../data/colors';
import { SEVEN } from '../data/tuning';
import { mulberry32, pickWeighted, randomSeed, type Rng } from '../meta/rng';
import { getSettings } from '../meta/storage';
import { craftTierFor, extract, extractionOf, judge, type Extraction } from '../scoring/extract';
import { editColor, type Edits, type Plate } from '../color/plate';
import type { ReactionKind } from './reaction';

export type SevenMode = 'camera' | 'practice' | 'photo';

/** Five operations of the alchemical Great Work, one per color, ending in Coagulation. */
export const OPERATIONS = ['Calcination', 'Dissolution', 'Conjunction', 'Distillation', 'Coagulation'];

export interface Section {
  index: number;
  def: ColorDef;
  /** Null only if the timed-out capture failed: nothing was extracted (0 points). */
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
  /** Set when a reaction changed this extract: what it was before. */
  reacted?: { kind: ReactionKind; hex: string; tier: string; score: number; dE: number };
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

/**
 * `view` is null only if the capture failed when time ran out (normally the machine
 * extracts on its own then): nothing extracted, the color scores 0.
 */
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

/**
 * A reaction's ingredients go into each of these sections' extracts (the same doses into
 * all): each is judged again (it can get better or worse), and the running totals are
 * recomputed.
 */
export function reactSections(r: SevenRun, indices: number[], edits: Edits, kind: ReactionKind): void {
  for (const index of indices) {
    const s = r.sections[index];
    if (!s.extracted) continue;
    const was = { kind, hex: s.hex, tier: s.tier, score: s.score, dE: s.dE };
    const extracted = extractionOf(editColor(s.extracted.lin, edits));
    const j = judge(s.def, extracted);
    Object.assign(s, { extracted, hex: extracted.hex, dE: j.dE, score: j.score, tier: j.tier, tierIndex: j.tierIndex, reacted: was });
  }
  let total = 0;
  for (const t of r.sections) {
    total += t.score;
    const craft = craftTierFor(total);
    Object.assign(t, { total, craft: craft.name, craftIndex: craft.index });
  }
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
