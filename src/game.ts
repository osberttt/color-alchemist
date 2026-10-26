// Run state: 3 brews, dealing, transmute, catalysts, and turning an assay into a brew record.

import { color, type ColorDef } from './data/colors';
import { findFormula } from './data/formulae';
import { TUNING } from './data/tuning';
import { oklabToHex } from './color/oklab';
import type { Crop, Edits } from './color/plate';
import { dealPair, pickCatalyst, transmute, STAGES, type Catalyst } from './meta/deal';
import { mulberry32, randomSeed, type Rng } from './meta/rng';
import { getGrimoire, getSettings, recordColor, recordFormula } from './meta/storage';
import { cropArea, type Assayer, type TargetMatch } from './scoring/assay';
import {
  brewGrade,
  brewScore,
  colorGrade,
  hintsFor,
  isFoolsGold,
  potionName,
  purityOf,
  bandFor,
  type BrewBreakdown,
  type Grade,
  type Band,
} from './scoring/score';

export type Mode = 'camera' | 'practice';

export interface Pair {
  a: ColorDef;
  b: ColorDef;
  transmuted: boolean;
}

export interface ColorResult {
  def: ColorDef;
  match: TargetMatch | null;
  acc: number;
  acc0: number;
  grade: Grade;
  fool: boolean;
  hex: string;
  hints: string[];
  thumb?: string;
  newPage: boolean;
  personalBest: boolean;
}

export interface BrewRecord {
  stage: number;
  pair: Pair;
  catalyst: Catalyst | null;
  a: ColorResult;
  b: ColorResult;
  crop: Crop;
  f: number;
  edits: Edits;
  breakdown: BrewBreakdown;
  grade: Grade;
  potion: string;
  formula?: string;
  newFormula: boolean;
  correctedBy: 'auto' | 'albedo';
}

export interface Run {
  mode: Mode;
  seed: number;
  rng: Rng;
  stage: number;
  brews: BrewRecord[];
  used: Set<string>;
  transmuteLeft: boolean;
  catalyst: Catalyst;
  tutorial: boolean;
  pair: Pair | null;
}

export let run: Run | null = null;

export function newRun(mode: Mode): Run {
  const seed = randomSeed();
  const rng = mulberry32(seed);
  run = {
    mode,
    seed,
    rng,
    stage: 0,
    brews: [],
    used: new Set(),
    transmuteLeft: true,
    catalyst: pickCatalyst(rng),
    // The first-ever camera brew is the tutorial pair: jeans and cardboard (GDD §10.2).
    tutorial: mode === 'camera' && !getSettings().tutorialDone,
    pair: null,
  };
  return run;
}

export function endRun(): void {
  run = null;
}

export function stageName(stage: number): string {
  return STAGES[stage]?.name ?? '';
}

export function currentCatalyst(r: Run): Catalyst | null {
  return r.stage === 2 ? r.catalyst : null;
}

export function dealCurrent(r: Run): Pair {
  let a: ColorDef;
  let b: ColorDef;
  if (r.stage === 0 && r.tutorial) {
    a = color('denim');
    b = color('tan');
  } else {
    const discovered = new Set(Object.keys(getGrimoire()));
    [a, b] = dealPair(r.rng, r.stage, { used: r.used, discovered });
  }
  r.used.add(a.id);
  r.used.add(b.id);
  r.pair = { a, b, transmuted: false };
  return r.pair;
}

/** Swap one target for another of the same tier. Once per run, ×0.85 on this brew. */
export function transmuteTarget(r: Run, which: 'a' | 'b'): Pair | null {
  if (!r.transmuteLeft || !r.pair) return null;
  const keep = which === 'a' ? r.pair.b : r.pair.a;
  const replace = which === 'a' ? r.pair.a : r.pair.b;
  const next = transmute(r.rng, keep, replace, r.used);
  if (!next) return null;
  r.used.add(next.id);
  r.transmuteLeft = false;
  r.pair = which === 'a' ? { a: next, b: keep, transmuted: true } : { a: keep, b: next, transmuted: true };
  return r.pair;
}

export function personalBest(id: string): number | null {
  return getGrimoire()[id]?.bestAcc ?? null;
}

function thumbAround(source: HTMLCanvasElement | null, m: TargetMatch | null): string | undefined {
  if (!source || !m) return undefined;
  try {
    const side = Math.round(Math.min(source.width, source.height) * 0.18);
    const sx = Math.max(0, Math.min(source.width - side, m.cx * source.width - side / 2));
    const sy = Math.max(0, Math.min(source.height - side, m.cy * source.height - side / 2));
    const c = document.createElement('canvas');
    c.width = 48;
    c.height = 48;
    c.getContext('2d')!.drawImage(source, sx, sy, side, side, 0, 0, 48, 48);
    return c.toDataURL('image/jpeg', 0.7);
  } catch {
    return undefined;
  }
}

function colorResult(def: ColorDef, m: TargetMatch | null, m0: TargetMatch | null, purity: number, source: HTMLCanvasElement | null, realWorld: boolean): ColorResult {
  const acc = m ? m.acc : 0;
  const acc0 = m0 ? m0.acc : 0;
  const fool = isFoolsGold(acc, acc0);
  const hex = m ? oklabToHex(m.lab) : '#3a3a40';
  const res: ColorResult = {
    def,
    match: m,
    acc,
    acc0,
    grade: colorGrade(acc, purity),
    fool,
    hex,
    hints: m ? hintsFor(def.lab, m.lab) : ['not found in the crop'],
    thumb: thumbAround(source, m),
    newPage: false,
    personalBest: false,
  };
  // Grimoire: real-world finds at Elixir or better, never Fool's Gold (GDD §8.6, §8.9 Prima Materia).
  if (realWorld && acc >= 60 && !fool) {
    const rec = recordColor(def.id, acc, hex, res.thumb);
    res.newPage = rec.isNew;
    res.personalBest = rec.improved && !rec.isNew;
  }
  return res;
}

export interface FinishInput {
  assayer: Assayer;
  edits: Edits;
  crop: Crop;
  secondsLeft: number;
  source: HTMLCanvasElement | null;
}

export function finishBrew(r: Run, inp: FinishInput): BrewRecord {
  const pair = r.pair!;
  const catalyst = currentCatalyst(r);
  const { purity } = purityOf(inp.edits);
  const mA = inp.assayer.match(pair.a, inp.edits, inp.crop);
  const mB = inp.assayer.match(pair.b, inp.edits, inp.crop);
  const m0A = inp.assayer.matchNoEdits(pair.a, inp.crop);
  const m0B = inp.assayer.matchNoEdits(pair.b, inp.crop);
  const a = colorResult(pair.a, mA, m0A, purity, inp.source, r.mode === 'camera');
  const b = colorResult(pair.b, mB, m0B, purity, inp.source, r.mode === 'camera');
  const f = cropArea(inp.crop);
  const breakdown = brewScore({
    accA: a.acc,
    accB: b.acc,
    tierA: pair.a.tier,
    tierB: pair.b.tier,
    f,
    edits: inp.edits,
    catalystMult: catalyst?.mult ?? 1,
    transmuted: pair.transmuted,
    secondsLeft: r.mode === 'camera' ? inp.secondsLeft : 0,
  });
  const grade = brewGrade(breakdown.match, a.grade, b.grade, purity);
  const formula = findFormula(pair.a.id, pair.b.id)?.name;
  const newFormula = !!formula && breakdown.match >= 60 && recordFormula(formula);
  const record: BrewRecord = {
    stage: r.stage,
    pair,
    catalyst,
    a,
    b,
    crop: inp.crop,
    f,
    edits: inp.edits,
    breakdown,
    grade,
    potion: potionName(grade, pair.a, pair.b),
    formula,
    newFormula,
    correctedBy: inp.assayer.correctedBy,
  };
  r.brews.push(record);
  return record;
}

export interface RunResult {
  total: number;
  stone: boolean;
  band: Band;
  found: string[];
}

export function runResult(r: Run): RunResult {
  const colors = r.brews.flatMap((b) => [b.a, b.b]);
  const stone = colors.length === 6 && colors.every((c) => c.acc >= 80 && !c.fool);
  const total = r.brews.reduce((s, b) => s + b.breakdown.total, 0) + (stone ? TUNING.stonePoints : 0);
  return { total, stone, band: bandFor(total, stone), found: colors.map((c) => c.hex) };
}
