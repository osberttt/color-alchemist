// Reactions (ANALYSIS §4.25–4.28): after each color, the qualities of the latest extracts
// (Flawless … Botched) may set one off. Extracts are then exposed for a few seconds and the
// player drops ingredients into them, trying to bring them closer to their targets. Pure
// rules; the screen is reaction-view.ts.
// Checked on a sliding window after every color; a 3-long sequence beats a 2-long one:
//   3 the same      Equilibrium            all 3 exposed (every dose goes into all), all ingredients, 60 s
//   3 rising        Sublimation            1 random of the 3, all ingredients, 30 s
//   3 falling       Precipitation          1 random of the 3, all ingredients, 30 s
//   2 rising        Semi-Sublimation       1 random of the 2, 4 random ingredients, 30 s
//   2 falling       Semi-Precipitation     1 random of the 2, 4 random ingredients, 30 s
// Rising means getting better, one quality at a time (Awry → Wavering → Kindred); a skipped
// quality (Awry → Kindred) breaks the chain.

import type { Edits } from '../color/plate';
import { SEVEN } from '../data/tuning';
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

/** The reaction the latest colors set off, if any. Colors that extracted nothing never react. */
export function findReaction(sections: readonly Ranked[], rng: Rng): Reaction | null {
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
    if (kind) return makeReaction(kind, w.map((_, i) => n - length + i), w.map((s) => s.tier), rng);
  }
  return null;
}

/** What a reaction of this kind over these sections exposes, with which ingredients, for how long. */
export function makeReaction(kind: ReactionKind, window: number[], tiers: string[], rng: Rng): Reaction {
  const { seconds, equilibriumSeconds, semiIngredients } = SEVEN.reaction;
  const all = INGREDIENTS.map((i) => i.id);
  const length = window.length;
  if (kind === 'equilibrium') return { kind, length, window, indices: window, ingredients: all, seconds: equilibriumSeconds, tiers };
  const indices = [window[Math.floor(rng() * length)]];
  if (length >= 3) return { kind, length, window, indices, ingredients: all, seconds, tiers };
  // A semi-reaction: a few random ingredients (kept in shelf order).
  const pool = [...all];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  const picked = new Set(pool.slice(0, semiIngredients));
  return { kind, length, window, indices, ingredients: all.filter((id) => picked.has(id)), seconds, tiers };
}

/** Doses per axis (Sunlight +1, Darkness −1, …) as edits. Opposite ingredients cancel. */
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
  if (rx.kind === 'equilibrium') return 'Three extracts of the same quality in a row.';
  return `Your last ${rx.length === 2 ? 'two' : 'three'} extracts ${rx.kind === 'precipitation' ? 'fell' : 'rose'} in quality, one step at a time.`;
}

export interface ReactionEntry {
  name: string;
  when: string;
  what: string;
  /** An example chain of qualities, oldest first, joined by `sep`. */
  example: string[];
  sep: '→' | '=';
}

/** Every reaction with an example, for the guide and the in-game list (built from the tuning, so it stays true). */
export function reactionList(): ReactionEntry[] {
  const { seconds, equilibriumSeconds, semiIngredients } = SEVEN.reaction;
  const all = `All ${INGREDIENTS.length} ingredients, ${seconds} s.`;
  const semi = `${semiIngredients} random ingredients, ${seconds} s.`;
  return [
    {
      name: 'Equilibrium',
      when: 'Three extracts of the same quality in a row.',
      what: `All three are exposed; every ingredient goes into all of them. All ${INGREDIENTS.length} ingredients, ${equilibriumSeconds} s.`,
      example: ['Kindred', 'Kindred', 'Kindred'],
      sep: '=',
    },
    { name: 'Sublimation', when: 'Three extracts rising in quality.', what: `One of the three is exposed. ${all}`, example: ['Awry', 'Wavering', 'Kindred'], sep: '→' },
    { name: 'Precipitation', when: 'Three extracts falling in quality.', what: `One of the three is exposed. ${all}`, example: ['Kindred', 'Wavering', 'Awry'], sep: '→' },
    { name: 'Semi-Sublimation', when: 'Two extracts rising one quality.', what: `One of the two is exposed. ${semi}`, example: ['Awry', 'Wavering'], sep: '→' },
    { name: 'Semi-Precipitation', when: 'Two extracts falling one quality.', what: `One of the two is exposed. ${semi}`, example: ['Wavering', 'Awry'], sep: '→' },
  ];
}

/** Sequences that set nothing off, as examples for the guide. */
export const NO_REACTION_EXAMPLES: { example: string[]; sep: '→' | '='; why: string }[] = [
  { example: ['Awry', 'Kindred'], sep: '→', why: 'a quality skipped' },
  { example: ['Kindred', 'Kindred'], sep: '=', why: 'only two the same' },
];
