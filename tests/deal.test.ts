import { describe, expect, it } from 'vitest';
import { COLORS } from '../src/data/colors';
import { FORMULAE } from '../src/data/formulae';
import { dealPair, pairDelta, pairLegal, transmute } from '../src/meta/deal';
import { mulberry32 } from '../src/meta/rng';

describe('codex', () => {
  it('has 55 colors with unique ids (15 lead, 25 silver, 15 gold)', () => {
    expect(COLORS).toHaveLength(55);
    expect(new Set(COLORS.map((c) => c.id)).size).toBe(55);
    expect(COLORS.filter((c) => c.tier === 'lead')).toHaveLength(15);
    expect(COLORS.filter((c) => c.tier === 'silver')).toHaveLength(25);
    expect(COLORS.filter((c) => c.tier === 'gold')).toHaveLength(15);
  });

  it('every famous formula is a legal pair', () => {
    for (const f of FORMULAE) {
      const a = COLORS.find((c) => c.id === f.a)!;
      const b = COLORS.find((c) => c.id === f.b)!;
      expect(a && b, f.name).toBeTruthy();
      expect(pairLegal(a, b), `${f.name} Δ=${pairDelta(a, b).toFixed(3)}`).toBe(true);
    }
  });
});

describe('dealing', () => {
  it('respects the rules for 2 000 seeded runs', () => {
    for (let seed = 1; seed <= 2000; seed++) {
      const rng = mulberry32(seed);
      const used = new Set<string>();
      for (let stage = 0; stage < 3; stage++) {
        const [a, b] = dealPair(rng, stage, { used, discovered: new Set() });
        expect(pairLegal(a, b)).toBe(true);
        expect(used.has(a.id) || used.has(b.id)).toBe(false);
        const tiers = [a.tier, b.tier].sort().join('+');
        if (stage === 0) expect(tiers).toBe('lead+lead');
        if (stage === 1) expect(tiers).toBe('lead+silver');
        if (stage === 2) expect(['silver+silver', 'gold+silver']).toContain(tiers);
        used.add(a.id);
        used.add(b.id);
      }
    }
  });

  it('transmute keeps the tier and stays legal', () => {
    const rng = mulberry32(7);
    const used = new Set<string>();
    const [a, b] = dealPair(rng, 1, { used, discovered: new Set() });
    used.add(a.id).add(b.id);
    const t = transmute(rng, a, b, used)!;
    expect(t.tier).toBe(b.tier);
    expect(pairLegal(a, t)).toBe(true);
  });
});
