import { describe, expect, it } from 'vitest';
import { editColor } from '../src/color/plate';
import { deltaEOK, hexToLinear, linearToOklab } from '../src/color/oklab';
import { COLORS, color } from '../src/data/colors';
import { SEVEN } from '../src/data/tuning';
import { mulberry32 } from '../src/meta/rng';
import { extractionOf, judge, tierFor } from '../src/scoring/extract';
import { dosesToEdits, findReaction, ingredientNeeds, INGREDIENTS, makeReaction, reactionName, type Ranked } from '../src/seven/reaction';
import { reactSections, type Section, type SevenRun } from '../src/seven/run';

const ranked = (...names: string[]): Ranked[] =>
  names.map((name) => ({ tier: name, tierIndex: SEVEN.colorTiers.findIndex((t) => t.name === name), empty: false }));
const rng = mulberry32(7);

describe('which reaction the latest ranks set off', () => {
  const ALL = INGREDIENTS.map((i) => i.id);

  it('needs two colors', () => {
    expect(findReaction(ranked('Kindred'), rng)).toBeNull();
  });

  it('the same rank three times: Equilibrium, all three exposed, every ingredient, 30 s', () => {
    expect(findReaction(ranked('Awry', 'Kindred', 'Kindred', 'Kindred'), rng)).toMatchObject({
      kind: 'equilibrium',
      length: 3,
      indices: [1, 2, 3],
      ingredients: ALL,
      seconds: SEVEN.reaction.equilibriumSeconds,
    });
  });

  it('three falling: Precipitation on one random of the three, every ingredient, 10 s', () => {
    const seen = new Set<number>();
    for (let i = 0; i < 40; i++) {
      const rx = findReaction(ranked('Flawless', 'Kindred', 'Wavering', 'Awry'), rng)!;
      expect(rx).toMatchObject({ kind: 'precipitation', length: 3, ingredients: ALL, seconds: SEVEN.reaction.seconds });
      expect(rx.indices).toHaveLength(1);
      seen.add(rx.indices[0]);
    }
    expect([...seen].sort()).toEqual([1, 2, 3]);
  });

  it('three rising: Sublimation, and three beats two', () => {
    expect(findReaction(ranked('Awry', 'Wavering', 'Kindred'), rng)).toMatchObject({ kind: 'sublimation', length: 3, window: [0, 1, 2] });
  });

  it('rising and falling go one quality at a time: a skipped quality is no reaction', () => {
    expect(findReaction(ranked('Awry', 'Kindred'), rng)).toBeNull();
    expect(findReaction(ranked('Kindred', 'Awry'), rng)).toBeNull();
    expect(findReaction(ranked('Botched', 'Wavering', 'Harmonious'), rng)).toBeNull();
    // A skip earlier in the window still leaves the last two: Botched → Wavering, then Wavering → Kindred.
    expect(findReaction(ranked('Botched', 'Wavering', 'Kindred'), rng)).toMatchObject({ kind: 'sublimation', length: 2, window: [1, 2] });
  });

  it('two rising or falling: a semi-reaction on one of the two, with 4 random ingredients', () => {
    for (let i = 0; i < 20; i++) {
      const rx = findReaction(ranked('Kindred', 'Awry', 'Wavering'), rng)!;
      expect(rx).toMatchObject({ kind: 'sublimation', length: 2, seconds: SEVEN.reaction.seconds });
      expect([1, 2]).toContain(rx.indices[0]);
      expect(rx.ingredients).toHaveLength(SEVEN.reaction.semiIngredients);
      expect(new Set(rx.ingredients).size).toBe(rx.ingredients.length);
      expect(ALL.filter((id) => rx.ingredients.includes(id))).toEqual(rx.ingredients); // shelf order
    }
    expect(findReaction(ranked('Wavering', 'Awry'), rng)).toMatchObject({ kind: 'precipitation', length: 2 });
    expect(reactionName({ kind: 'precipitation', length: 2 })).toBe('Semi-Precipitation');
  });

  it('two the same (without a third) is no reaction', () => {
    expect(findReaction(ranked('Kindred', 'Kindred'), rng)).toBeNull();
    expect(findReaction(ranked('Awry', 'Kindred', 'Kindred'), rng)).toBeNull();
  });

  it('an empty extract never reacts', () => {
    const s = ranked('Kindred', 'Kindred', 'Kindred');
    s[1].empty = true;
    expect(findReaction(s, rng)).toBeNull();
  });
});

describe("a semi-reaction's ingredients lean toward what the extract needs", () => {
  const teal = color('teal');
  const [r, g, b] = hexToLinear(teal.target);
  const tooDark: [number, number, number] = [r * 0.5, g * 0.5, b * 0.5];

  it('knows what helps: Sunlight brings a too-dark extract closer, Darkness takes it further', () => {
    const needs = ingredientNeeds(tooDark, teal.target);
    expect(needs.sunlight).toBeGreaterThan(2);
    expect(needs.darkness).toBeLessThan(0);
  });

  it('offers the helpful ingredient far more often than chance, but not always the same hand', () => {
    const needsOf = () => ingredientNeeds(tooDark, teal.target);
    const draw = mulberry32(3);
    let sunlight = 0;
    let darkness = 0;
    const hands = new Set<string>();
    const n = 400;
    for (let i = 0; i < n; i++) {
      const rx = makeReaction('sublimation', [0, 1], ['Awry', 'Wavering'], draw, needsOf);
      expect(rx.ingredients).toHaveLength(SEVEN.reaction.semiIngredients);
      if (rx.ingredients.includes('sunlight')) sunlight++;
      if (rx.ingredients.includes('darkness')) darkness++;
      hands.add(rx.ingredients.join());
    }
    // Pure chance would be 4 of 8: about half of the hands.
    expect(sunlight / n).toBeGreaterThan(0.8);
    expect(darkness / n).toBeLessThan(0.5);
    expect(hands.size).toBeGreaterThan(5);
  });
});

describe('ingredient strength', () => {
  it('one dose moves a typical color about 4 (OKLab ×100), on every axis', () => {
    const one = { ev: 0, sat: 0, warm: 0, tint: 0 };
    for (const axis of ['ev', 'sat', 'warm', 'tint'] as const) {
      const moves = COLORS.map((c) => {
        const lin = hexToLinear(c.target);
        const out = editColor(lin, dosesToEdits({ ...one, [axis]: 1 }));
        return deltaEOK(linearToOklab(...lin), linearToOklab(...out)) * 100;
      }).sort((a, b) => a - b);
      const median = moves[Math.floor(moves.length / 2)];
      expect(median, axis).toBeGreaterThan(3);
      expect(median, axis).toBeLessThan(5);
    }
  });
});

describe('a reaction re-judges the extract', () => {
  const run = (): SevenRun => {
    const teal = color('teal');
    const [r, g, b] = hexToLinear(teal.target);
    // A teal extract half a stop too dark, then two more colors.
    const sections = [extractionOf([r * 0.7, g * 0.7, b * 0.7]), extractionOf([r, g, b]), extractionOf([r, g, b])].map((ex, index): Section => {
      const j = judge(teal, ex);
      return { index, def: teal, extracted: ex, empty: false, hex: ex.hex, dE: j.dE, score: j.score, tier: j.tier, tierIndex: j.tierIndex, zoom: 1, total: 0, craft: '', craftIndex: 0 };
    });
    return { mode: 'practice', seed: 1, rng, index: 3, sections, used: new Set(), tutorial: false, current: null };
  };

  it('Sunlight on a too-dark extract raises its rank, its points and every later total', () => {
    const r = run();
    const before = r.sections[0].score;
    reactSections(r, [0], dosesToEdits({ ev: 2, sat: 0, warm: 0, tint: 0 }), 'sublimation');
    const s = r.sections[0];
    expect(s.score).toBeGreaterThan(before);
    expect(s.tier).toBe(tierFor(s.dE).name);
    expect(s.reacted).toMatchObject({ kind: 'sublimation', score: before });
    expect(r.sections[2].total).toBe(r.sections.reduce((t, x) => t + x.score, 0));
  });

  it('the wrong ingredient makes it worse', () => {
    const r = run();
    const before = r.sections[0].dE;
    reactSections(r, [0], dosesToEdits({ ev: -2, sat: 0, warm: 0, tint: 0 }), 'sublimation');
    expect(r.sections[0].dE).toBeGreaterThan(before);
  });

  it('Equilibrium: the same doses go into every exposed extract', () => {
    const r = run();
    reactSections(r, [0, 1, 2], dosesToEdits({ ev: 2, sat: 0, warm: 0, tint: 0 }), 'equilibrium');
    expect(r.sections[0].score).toBeGreaterThan(60); // the dark one got better…
    expect(r.sections[1].tier).not.toBe('Flawless'); // …the exact ones got worse
    expect(r.sections.every((s) => s.reacted?.kind === 'equilibrium')).toBe(true);
  });
});
