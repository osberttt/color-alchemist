import { describe, expect, it } from 'vitest';
import { bandFor, brewScore, colorGrade, concentration, hintsFor, purityOf } from '../src/scoring/score';
import { color } from '../src/data/colors';

describe('brew score', () => {
  it('reproduces the GDD §8.11 worked example (1 126)', () => {
    const r = brewScore({
      accA: 92,
      accB: 78,
      tierA: 'silver',
      tierB: 'lead',
      f: 0.06,
      edits: { ev: 0.2, sat: 0.1 },
      catalystMult: 1,
      transmuted: false,
      secondsLeft: 23,
    });
    expect(r.base).toBe(1080);
    expect(r.quicksilver).toBe(46);
    expect(r.bonuses).toHaveLength(0);
    expect(r.total).toBe(1126);
  });

  it('concentration reference values', () => {
    expect(concentration(1)).toBeCloseTo(1, 3);
    expect(concentration(0.25)).toBeCloseTo(1.15, 2);
    expect(concentration(0.1)).toBeCloseTo(1.25, 2);
    expect(concentration(0.01)).toBeCloseTo(1.5, 3);
    expect(concentration(0.0001)).toBeCloseTo(1.5, 3);
  });

  it('pure draw is ×1.10, edits cost purity down to 0.5', () => {
    expect(purityOf({ ev: 0, sat: 0 })).toEqual({ purity: 1.1, pure: true });
    expect(purityOf({ ev: 1, sat: 0.6 }).purity).toBeCloseTo(0.5, 6);
    expect(purityOf({ ev: -1, sat: -0.5 }).purity).toBeCloseTo(1 - 0.25 - (0.25 * 0.5) / 0.6, 6);
    expect(purityOf({ ev: 1, sat: 0.6 }).purity).toBeGreaterThanOrEqual(0.5);
  });

  it('missing one color collapses the geometric mean', () => {
    const r = brewScore({ accA: 100, accB: 5, tierA: 'lead', tierB: 'lead', f: 1, edits: { ev: 0, sat: 0 }, catalystMult: 1, transmuted: false, secondsLeft: 0 });
    expect(r.match).toBeCloseTo(22.36, 1);
  });

  it('awards Pinch and Equilibrium', () => {
    const r = brewScore({ accA: 90, accB: 88, tierA: 'lead', tierB: 'lead', f: 0.03, edits: { ev: 0, sat: 0 }, catalystMult: 1, transmuted: false, secondsLeft: 0 });
    expect(r.bonuses.map((b) => b.name)).toEqual(["Philosopher's Pinch", 'Equilibrium']);
  });
});

describe('grades, bands, hints', () => {
  it('grades', () => {
    expect(colorGrade(96, 1.1)).toBe('Quintessence');
    expect(colorGrade(96, 0.9)).toBe('Essence');
    expect(colorGrade(65, 1)).toBe('Elixir');
    expect(colorGrade(10, 1)).toBe('Sludge');
  });

  it('bands', () => {
    expect(bandFor(1000, false).name).toBe('GRAYSCALE');
    expect(bandFor(3600, false).name).toBe('VIVID');
    expect(bandFor(100, true).name).toBe('FULL SPECTRUM');
  });

  it('hints say how you missed', () => {
    const mustard = color('mustard').lab;
    const dull = { L: mustard.L - 0.12, a: mustard.a * 0.5, b: mustard.b * 0.5 };
    const h = hintsFor(mustard, dull);
    expect(h).toContain('too dull');
    expect(h).toContain('too dark');
  });
});
