// Seven Colors run state: 7 sections, one color each, no editing (ANALYSIS §4.1–4.2).
// What the camera sees inside the square is what gets scored. Light is part of the game.

import { COLORS, color, type ColorDef } from '../data/colors';
import { SEVEN, TUNING } from '../data/tuning';
import { oklabToHex, type Lab } from '../color/oklab';
import { mulberry32, pickWeighted, randomSeed, type Rng } from '../meta/rng';
import { getSettings } from '../meta/storage';
import { colorGrade, quicksilver, type Grade } from '../scoring/score';
import type { SquareAssayer } from '../scoring/square';

export type SevenMode = 'camera' | 'practice' | 'photo';

/** The seven operations of the alchemical Great Work. */
export const OPERATIONS = ['Calcination', 'Dissolution', 'Separation', 'Conjunction', 'Fermentation', 'Distillation', 'Coagulation'];

export interface Section {
  index: number;
  def: ColorDef;
  acc: number;
  grade: Grade;
  /** The square's average color (linear-RGB mean → OKLab): the "yours" swatch. */
  mean: Lab;
  hex: string;
  zoom: number;
  base: number;
  quicksilver: number;
  total: number;
  lightCorrected: boolean;
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

export function finishSection(r: SevenRun, assayer: SquareAssayer, secondsLeft: number, zoom: number): Section {
  const def = r.current!;
  const s = assayer.score(def, { ev: 0, sat: 0 });
  const base = Math.round(10 * s.acc * TUNING.tierMult[def.tier]);
  const qs = r.mode === 'camera' ? quicksilver(secondsLeft) : 0;
  const section: Section = {
    index: r.index,
    def,
    acc: s.acc,
    grade: colorGrade(s.acc, 1),
    mean: s.mean,
    hex: oklabToHex(s.mean),
    zoom,
    base,
    quicksilver: qs,
    total: base + qs,
    lightCorrected: s.variant === 'corrected',
  };
  r.sections.push(section);
  return section;
}

export interface SevenResult {
  total: number;
  stone: boolean;
  band: string;
  found: string[];
}

export function sevenResult(r: SevenRun): SevenResult {
  const stone = r.sections.length === SEVEN.sections && r.sections.every((s) => s.acc >= 80);
  const total = r.sections.reduce((t, s) => t + s.total, 0) + (stone ? SEVEN.stonePoints : 0);
  let band: string = SEVEN.bands[0].name;
  for (const b of SEVEN.bands) if (total >= b.min) band = b.name;
  if (stone) band = 'FULL SPECTRUM';
  return { total, stone, band, found: r.sections.map((s) => s.hex) };
}

export function nextSevenBand(total: number): { name: string; at: number } | null {
  for (const b of SEVEN.bands) if (total < b.min) return { name: b.name, at: b.min };
  return null;
}
