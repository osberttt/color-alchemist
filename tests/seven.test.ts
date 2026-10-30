import { describe, expect, it } from 'vitest';
import { SEVEN } from '../src/data/tuning';
import { dealSection, newSeven, OPERATIONS } from '../src/seven/run';

describe('a Seven Colors run', () => {
  it('has one operation per color', () => {
    expect(OPERATIONS).toHaveLength(SEVEN.sections);
    expect(SEVEN.tiers).toHaveLength(SEVEN.sections);
  });

  it('deals distinct colors along the tier ladder, never the same element twice in a row', () => {
    for (let run = 0; run < 300; run++) {
      const r = newSeven('practice');
      const dealt = [];
      for (let i = 0; i < SEVEN.sections; i++) {
        r.index = i;
        const def = dealSection(r);
        // Stand-in for a finished section, so the next deal sees this one.
        r.sections.push({ def } as (typeof r.sections)[number]);
        dealt.push(def);
      }
      expect(new Set(dealt.map((d) => d.id)).size).toBe(SEVEN.sections);
      expect(dealt.map((d) => d.tier)).toEqual([...SEVEN.tiers]);
      for (let i = 1; i < dealt.length; i++) expect(dealt[i].element).not.toBe(dealt[i - 1].element);
      expect(dealt.filter((d) => d.dark).length).toBeLessThanOrEqual(SEVEN.maxDarkPerRun);
    }
  });
});
