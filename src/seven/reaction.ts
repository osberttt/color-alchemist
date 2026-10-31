// Reactions (ANALYSIS §4.25–4.28): after each color, the qualities of the latest extracts
// (Flawless … Botched) may set one off. Extracts are then exposed for a few seconds and the
// player drops ingredients into them, trying to bring them closer to their targets. Pure
// rules; the screen is reaction-view.ts.
// Checked on a sliding window after every color; a 3-long sequence beats a 2-long one. One
// random extract of the chain is exposed, always, and ingredients come in opposite pairs so
// every dose can be undone (ANALYSIS §4.45):
//   3 the same      Equilibrium            3 random pairs, 30 s
//   3 rising        Sublimation            2 random pairs, 30 s
//   3 falling       Precipitation          2 random pairs, 30 s
//   2 rising        Semi-Sublimation       1 random pair, 30 s
//   2 falling       Semi-Precipitation     1 random pair, 30 s
// Rising means getting better, one quality at a time (Awry → Wavering → Kindred); a skipped
// quality (Awry → Kindred) breaks the chain.

import { linearToCielab } from '../color/cielab';
import { editColor, type Edits } from '../color/plate';
import { SEVEN } from '../data/tuning';
import { distance } from '../scoring/extract';
import type { Rng } from '../meta/rng';

export type Axis = 'ev' | 'sat' | 'warm' | 'tint';

export interface Ingredient {
  id: string;
  name: string;
  axis: Axis;
  sign: 1 | -1;
  /** Color of its splash. */
  fx: string;
}

/** Shelf order: opposite ingredients side by side, minus first. */
export const INGREDIENTS: Ingredient[] = [
  { id: 'darkness', name: 'Darkness', axis: 'ev', sign: -1, fx: '#2b2d4a' },
  { id: 'sunlight', name: 'Sunlight', axis: 'ev', sign: 1, fx: '#ffd34d' },
  { id: 'ash', name: 'Ash', axis: 'sat', sign: -1, fx: '#9a9a9a' },
  { id: 'pigment', name: 'Pigment', axis: 'sat', sign: 1, fx: '#ff4d6d' },
  { id: 'cobalt', name: 'Cobalt', axis: 'warm', sign: -1, fx: '#2f5fd0' },
  { id: 'cinnamon', name: 'Cinnamon', axis: 'warm', sign: 1, fx: '#b5652b' },
  { id: 'rose', name: 'Rose', axis: 'tint', sign: -1, fx: '#d94f8f' },
  { id: 'moss', name: 'Moss', axis: 'tint', sign: 1, fx: '#5f9a3c' },
];

export type ReactionKind = 'equilibrium' | 'sublimation' | 'precipitation';

export const REACTION_NAMES: Record<ReactionKind, string> = {
  equilibrium: 'Equilibrium',
  sublimation: 'Sublimation',
  precipitation: 'Precipitation',
};

export interface Reaction {
  kind: ReactionKind;
  /** How many colors in a row set it off (2 or 3). */
  length: number;
  /** The sections that set it off, oldest first. */
  window: number[];
  /** The sections whose extracts are exposed; every dose goes into all of them. */
  indices: number[];
  /** Ingredient ids on the shelf, in shelf order. */
  ingredients: string[];
  seconds: number;
  /** The qualities that set it off, oldest first. */
  tiers: string[];
}

/** What a reaction needs to know about each color so far. */
export interface Ranked {
  tier: string;
  /** 0 = Flawless … 5 = Botched. */
  tierIndex: number;
  empty: boolean;
}

export function reactionName(rx: Pick<Reaction, 'kind' | 'length'>): string {
  return `${rx.length < 3 ? 'Semi-' : ''}${REACTION_NAMES[rx.kind]}`;
}

/**
 * How much one dose of each ingredient would help a section's extract: per ingredient id, how
 * much closer to its target it gets (OKLab ×100; negative = further). Semi-reactions use it
 * to favor what the extract needs.
 */
export type NeedsOf = (index: number) => Record<string, number>;

export function ingredientNeeds(lin: readonly [number, number, number], targetHex: string): Record<string, number> {
  const [r, g, b] = lin;
  const now = distance(targetHex, linearToCielab(r, g, b));
  const out: Record<string, number> = {};
  for (const ing of INGREDIENTS) {
    const doses: Record<Axis, number> = { ev: 0, sat: 0, warm: 0, tint: 0 };
    doses[ing.axis] = ing.sign;
    const [r2, g2, b2] = editColor(lin, dosesToEdits(doses));
    out[ing.id] = now - distance(targetHex, linearToCielab(r2, g2, b2));
  }
  return out;
}

/** The reaction the latest colors set off, if any. Colors that extracted nothing never react. */
export function findReaction(sections: readonly Ranked[], rng: Rng, needsOf?: NeedsOf): Reaction | null {
  const n = sections.length;
  for (const length of [3, 2]) {
    if (n < length) continue;
    const w = sections.slice(n - length);
    if (w.some((s) => s.empty)) continue;
    const t = w.map((s) => s.tierIndex);
    let kind: ReactionKind | null = null;
    // Rising and falling go one quality at a time: Awry → Wavering, never Awry → Kindred.
    if (length === 3 && t.every((x) => x === t[0])) kind = 'equilibrium';
    else if (t.every((x, i) => i === 0 || x === t[i - 1] - 1)) kind = 'sublimation';
    else if (t.every((x, i) => i === 0 || x === t[i - 1] + 1)) kind = 'precipitation';
    if (kind) return makeReaction(kind, w.map((_, i) => n - length + i), w.map((s) => s.tier), rng, needsOf);
  }
  return null;
}

/** How many pairs of opposite ingredients a reaction offers (ANALYSIS §4.45). */
export function pairsFor(kind: ReactionKind, length: number): number {
  const { pairs } = SEVEN.reaction;
  return kind === 'equilibrium' ? pairs.equilibrium : length >= 3 ? pairs.three : pairs.two;
}

/** What a reaction of this kind over these sections exposes, with which ingredients, for how long. */
export function makeReaction(kind: ReactionKind, window: number[], tiers: string[], rng: Rng, needsOf?: NeedsOf): Reaction {
  const { seconds, needWeight } = SEVEN.reaction;
  const length = window.length;
  // One random extract of the chain, always (ANALYSIS §4.45: three at once was too hard).
  const indices = [window[Math.floor(rng() * length)]];
  // Whole pairs only, so every dose can be undone by its opposite. The pairs are drawn at
  // random, weighted toward what the exposed extract needs (ANALYSIS §4.39): each starts at
  // weight 1, plus needWeight for every point of distance one dose of its better half would
  // save. Never certain, often helpful.
  const needs = needsOf?.(indices[0]);
  const axes: Axis[] = ['ev', 'sat', 'warm', 'tint'];
  const pool = axes.map((axis) => ({
    axis,
    w: 1 + needWeight * Math.max(0, ...INGREDIENTS.filter((i) => i.axis === axis).map((i) => needs?.[i.id] ?? 0)),
  }));
  const picked = new Set<Axis>();
  const n = pairsFor(kind, length);
  while (picked.size < n && pool.length) {
    let x = rng() * pool.reduce((t, p) => t + p.w, 0);
    let k = 0;
    while (k < pool.length - 1 && (x -= pool[k].w) > 0) k++;
    picked.add(pool.splice(k, 1)[0].axis);
  }
  const ingredients = INGREDIENTS.filter((i) => picked.has(i.axis)).map((i) => i.id);
  return { kind, length, window, indices, ingredients, seconds, tiers };
}

/**
 * Doses per axis (Sunlight +1, Darkness −1, …) as edits. Opposite ingredients cancel.
 * The tincture uses the same coarse doses as reactions (ANALYSIS §4.44): agency, not precision.
 */
export function dosesToEdits(doses: Record<Axis, number>): Edits {
  const { evPerDose, satPerDose, warmPerDose, tintPerDose } = SEVEN.reaction;
  return {
    ev: doses.ev * evPerDose,
    // Compounding, so Ash keeps graying without ever passing grey into inverted colors.
    sat: Math.pow(1 + satPerDose, doses.sat) - 1,
    warm: doses.warm * warmPerDose,
    tint: doses.tint * tintPerDose,
  };
}

/** One line on why the reaction happened. */
export function reactionWhy(rx: Pick<Reaction, 'kind' | 'length'>): string {
  // The user's wording (ANALYSIS §4.38).
  if (rx.kind === 'equilibrium') return `Qualities of your last ${rx.length} extracts stayed the same`;
  return `Qualities of your last ${rx.length} extracts ${rx.kind === 'precipitation' ? 'fell' : 'rose'} in steps`;
}

export interface ReactionEntry {
  name: string;
  text: string;
  /** An example chain of qualities, oldest first, joined by `sep`. */
  example: string[];
  sep: '→' | '=';
}

/**
 * Every reaction with an example, for the guide and the in-game list, in the user's wording
 * (ANALYSIS §4.35), Equilibrium last. Built from the tuning, so the numbers stay true.
 */
export function reactionList(): ReactionEntry[] {
  const { seconds, pairs } = SEVEN.reaction;
  const offer = (n: number) => `${n === 1 ? 'a random pair' : `${n} random pairs`} of opposite ingredients`;
  const semi = (moves: string) =>
    `If the quality of the extracted color ${moves} by one step from the previous one, one of them is exposed for ${seconds} seconds. During the time, you can add ${offer(pairs.two)} to improve it.`;
  const three = (moves: string) =>
    `If the quality of the colors ${moves} one step at a time for 3 consecutive extracts, one of them is exposed for ${seconds} seconds. During the time, you can add ${offer(pairs.three)} to improve it.`;
  return [
    { name: 'Semi-Sublimation', text: semi('rises'), example: ['Awry', 'Wavering'], sep: '→' },
    { name: 'Semi-Precipitation', text: semi('drops'), example: ['Wavering', 'Awry'], sep: '→' },
    { name: 'Sublimation', text: three('rises'), example: ['Awry', 'Wavering', 'Kindred'], sep: '→' },
    { name: 'Precipitation', text: three('drops'), example: ['Kindred', 'Wavering', 'Awry'], sep: '→' },
    {
      name: 'Equilibrium',
      text: `If the quality of the colors remains the same for 3 consecutive extracts, one of them is exposed for ${seconds} seconds. During the time, you can add ${offer(pairs.equilibrium)} to improve it.`,
      example: ['Kindred', 'Kindred', 'Kindred'],
      sep: '=',
    },
  ];
}
