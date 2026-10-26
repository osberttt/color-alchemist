import { describe, expect, it } from 'vitest';
import { PALETTES, contrast, inkOn, paletteFor, primaryAccent } from '../src/ui/palettes';

describe('menu palettes', () => {
  it('has around twenty palettes with five accents each', () => {
    expect(PALETTES.length).toBeGreaterThanOrEqual(20);
    for (const p of PALETTES) expect(p.accents).toHaveLength(5);
  });

  it('body text is readable on every palette (WCAG AA 4.5:1)', () => {
    for (const p of PALETTES) expect(contrast(p.fg, p.bg), p.name).toBeGreaterThanOrEqual(4.5);
  });

  it('primary button labels are readable (≥ 4.5:1)', () => {
    for (const p of PALETTES) {
      const a = primaryAccent(p);
      expect(contrast(a, inkOn(a)), p.name).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('gives different pages different palettes', () => {
    const pages = ['title', 'howto', 'prompt', 'error', 'board', 'summary', 'dialog'] as const;
    const names = new Set(pages.map((p) => paletteFor(p).name));
    expect(names.size).toBe(pages.length);
  });
});
