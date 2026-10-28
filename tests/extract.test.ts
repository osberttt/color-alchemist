import { describe, expect, it } from 'vitest';
import { ciede2000, ciede2000Parts, hexToCielab, linearToCielab } from '../src/color/cielab';
import { hexToLinear } from '../src/color/oklab';
import type { Plate } from '../src/color/plate';
import { COLORS, color } from '../src/data/colors';
import { craftTierFor, distance, extract, judge, machineRect, mosaic, scoreFor, tierFor } from '../src/scoring/extract';

describe('CIELAB', () => {
  it('white is L 100, a = b = 0', () => {
    const w = linearToCielab(1, 1, 1);
    expect(w.L).toBeCloseTo(100, 2);
    expect(w.a).toBeCloseTo(0, 2);
    expect(w.b).toBeCloseTo(0, 2);
  });

  it('sRGB red matches the reference (53.24, 80.09, 67.20)', () => {
    const r = hexToCielab('#ff0000');
    expect(r.L).toBeCloseTo(53.24, 1);
    expect(r.a).toBeCloseTo(80.09, 1);
    expect(r.b).toBeCloseTo(67.2, 1);
  });
});

describe('CIEDE2000 (Sharma, Wu & Dalal 2005 test data)', () => {
  const cases: [number, number, number, number, number, number, number][] = [
    [50, 2.6772, -79.7751, 50, 0, -82.7485, 2.0425],
    [50, 0, 0, 50, -1, 2, 2.3669],
    [50, 2.5, 0, 73, 25, -18, 27.1492],
    [60.2574, -34.0099, 36.2677, 60.4626, -34.1751, 39.4387, 1.2644],
    [50, 2.5, 0, 50, 0, -2.5, 4.3065],
    [22.7233, 20.0904, -46.694, 23.0331, 14.973, -42.5619, 2.0373],
  ];
  it.each(cases)('pair (%f, %f, %f) vs (%f, %f, %f) = %f', (L1, a1, b1, L2, a2, b2, expected) => {
    expect(ciede2000({ L: L1, a: a1, b: b1 }, { L: L2, a: a2, b: b2 })).toBeCloseTo(expected, 3);
  });

  it('is symmetric and zero for identical colors', () => {
    const a = hexToCielab('#029386');
    const b = hexToCielab('#ceb301');
    expect(ciede2000(a, a)).toBe(0);
    expect(ciede2000(a, b)).toBeCloseTo(ciede2000(b, a), 9);
  });

  it('splits into lightness, chroma and hue terms that add in quadrature', () => {
    const a = hexToCielab('#029386');
    const p = ciede2000Parts(a, hexToCielab('#ceb301'));
    expect(p.dE).toBeCloseTo(Math.sqrt(p.l ** 2 + p.c ** 2 + p.h ** 2 + p.cross), 9);
    const darker = ciede2000Parts(a, { ...a, L: a.L - 5 });
    expect(Math.abs(darker.l)).toBeCloseTo(darker.dE, 9);
    expect(darker.c).toBeCloseTo(0, 12);
    expect(darker.h).toBeCloseTo(0, 12);
  });
});

function plate(w: number, h: number, fill: (x: number, y: number) => [number, number, number]): Plate {
  const lin = new Float32Array(w * h * 3);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) lin.set(fill(x, y), (y * w + x) * 3);
  return { w, h, lin };
}

describe('the color extracting machine', () => {
  it('extracts exactly the target and judges it Flawless with 100 points', () => {
    const teal = color('teal');
    const j = judge(teal, extract(plate(360, 480, () => hexToLinear(teal.target))));
    expect(j.dE).toBeLessThan(0.3);
    expect(j.tier).toBe('Flawless');
    expect(j.score).toBeGreaterThanOrEqual(97);
  });

  it('only the machine counts, not the rest of the frame', () => {
    const teal = color('teal');
    const rect = machineRect({ w: 360, h: 480, lin: new Float32Array(0) });
    const inside = (x: number, y: number) => x >= rect.x && x < rect.x + rect.side && y >= rect.y && y < rect.y + rect.side;
    const j = judge(teal, extract(plate(360, 480, (x, y) => (inside(x, y) ? hexToLinear(teal.target) : [0.9, 0.1, 0.1]))));
    expect(j.tier).toBe('Flawless');
  });

  it('blends what is inside: red + yellow halves extract as orange', () => {
    const rect = machineRect({ w: 360, h: 480, lin: new Float32Array(0) });
    const ex = extract(plate(360, 480, (x) => (x < rect.x + rect.side / 2 ? [1, 0, 0] : [1, 1, 0])));
    // Linear-light average of red and yellow = (1, 0.5, 0) → an orange.
    expect(ex.lin[0]).toBeCloseTo(1, 3);
    expect(ex.lin[1]).toBeCloseTo(0.5, 2);
    expect(ex.lin[2]).toBeCloseTo(0, 3);
    expect(judge(color('tangerine'), ex).dE).toBeLessThan(judge(color('cherry-red'), ex).dE);
  });

  it("the blend reveal's last step is exactly the extracted color", () => {
    const p = plate(360, 480, (x, y) => [((x * 7) % 255) / 255, ((y * 3) % 255) / 255, 0.3]);
    const one = mosaic(p, 1);
    const hex = '#' + [one[0], one[1], one[2]].map((v) => v.toString(16).padStart(2, '0')).join('');
    expect(hex).toBe(extract(p).hex);
  });

  it('no leniency: a slightly darker teal is no longer Flawless', () => {
    const teal = color('teal');
    const [r, g, b] = hexToLinear(teal.target);
    const j = judge(teal, extract(plate(360, 480, () => [r * 0.8, g * 0.8, b * 0.8])));
    expect(j.tier).not.toBe('Flawless');
  });
});

describe('ranks', () => {
  it('color tiers by ΔE00', () => {
    expect(tierFor(1).name).toBe('Flawless');
    expect(tierFor(4).name).toBe('Harmonious');
    expect(tierFor(10).name).toBe('Kindred');
    expect(tierFor(20).name).toBe('Wavering');
    expect(tierFor(35).name).toBe('Awry');
    expect(tierFor(41).name).toBe('Botched');
    expect(tierFor(60).name).toBe('Botched');
  });

  it("Krillion's exact points per rank", () => {
    expect([1, 4, 10, 20, 35, 50].map(scoreFor)).toEqual([100, 85, 60, 30, 15, 10]);
  });

  it('craft tiers climb with the running total', () => {
    expect(craftTierFor(70).name).toBe('Prima Materia');
    expect(craftTierFor(100).name).toBe('Trinket');
    expect(craftTierFor(200).name).toBe('Curio');
    expect(craftTierFor(300).name).toBe('Marvel');
    expect(craftTierFor(400).name).toBe('Magnum Opus');
    expect(craftTierFor(500).next).toBeNull();
  });
});

describe('game weighting (kL 0.8, kC 1, kH 2 within 30°)', () => {
  const teal = hexToCielab(color('teal').target);
  const rot = (deg: number) => {
    const C = Math.hypot(teal.a, teal.b);
    const h0 = Math.atan2(teal.b, teal.a) + (deg * Math.PI) / 180;
    return { L: teal.L, a: C * Math.cos(h0), b: C * Math.sin(h0) };
  };

  it('is more forgiving of small hue shifts than standard CIEDE2000', () => {
    const s = rot(20);
    const standard = ciede2000(teal, s);
    const game = distance(color('teal').target, s);
    expect(game).toBeCloseTo(standard / 2, 1);
    // A hue shift that standard CIEDE2000 calls Kindred is Harmonious in the game.
    expect(tierFor(standard).name).toBe('Kindred');
    expect(tierFor(game).name).toBe('Harmonious');
  });

  it('a grey earns Wavering, except on the two near-grey colors', () => {
    // With Wavering up to ΔE 30 a grey scores Wavering (ANALYSIS §4.12): the best grey
    // sits at ΔE 16.8–29.5 for 53 colors.
    for (const c of COLORS) {
      if (c.name === 'Charcoal' || c.name === 'Steel Blue') continue;
      const t = hexToCielab(c.target);
      // The best grey: same lightness, no chroma.
      expect(tierFor(distance(c.target, { L: t.L, a: 0, b: 0 })).name, c.name).toBe('Wavering');
    }
  });

  it('does not forgive a clearly different hue (teal vs. orange)', () => {
    const opposite = rot(160);
    expect(distance(color('teal').target, opposite)).toBeCloseTo(ciede2000(teal, opposite), 6);
    expect(['Awry', 'Botched']).toContain(tierFor(distance(color('teal').target, opposite)).name);
  });

  it('is a little stricter on lighter/darker', () => {
    const darker = { ...teal, L: teal.L - 4 };
    expect(distance(color('teal').target, darker)).toBeGreaterThan(ciede2000(teal, darker));
  });
});
