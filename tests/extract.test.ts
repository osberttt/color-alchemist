import { describe, expect, it } from 'vitest';
import { ciede2000, ciede2000Parts, hexToCielab, linearToCielab, toLCh } from '../src/color/cielab';
import { applyEdits, NO_EDITS } from '../src/color/plate';
import { deltaEOK, hexToLinear, hexToOklab, linearToOklab, oklabToLinear } from '../src/color/oklab';
import type { Plate } from '../src/color/plate';
import { COLORS, color } from '../src/data/colors';
import { SEVEN } from '../src/data/tuning';
import { craftTierFor, distance, distanceParts, extract, judge, machineRect, mosaic, scoreFor, tierFor } from '../src/scoring/extract';
import { dosesToEdits } from '../src/seven/reaction';

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

describe('ingredients (edits: light, color, warmth, tint)', () => {
  const orange = plate(4, 4, () => [0.6, 0.2, 0.04]);

  it('no adjustment changes nothing', () => {
    expect(applyEdits(orange, NO_EDITS)).toBe(orange);
  });

  it('brightness scales linear light and clips at white, like the viewfinder', () => {
    const q = applyEdits(orange, { ev: 0.5, sat: 0 });
    expect(q.lin[1]).toBeCloseTo(0.2 * Math.SQRT2, 6);
    expect(q.lin[0]).toBeCloseTo(Math.min(1, 0.6 * Math.SQRT2), 6);
    expect(applyEdits(plate(1, 1, () => [0.9, 0.9, 0.9]), { ev: 0.5, sat: 0 }).lin[0]).toBe(1);
  });

  it('saturation changes chroma but not hue, and a grey stays grey', () => {
    const grey = applyEdits(plate(1, 1, () => [0.3, 0.3, 0.3]), { ev: 0, sat: 0.25 });
    for (const v of grey.lin) expect(v).toBeCloseTo(0.3, 4);
    const before = toLCh(extract(orange).lab);
    const after = toLCh(extract(applyEdits(orange, { ev: 0, sat: 0.25 })).lab);
    expect(after.C).toBeGreaterThan(before.C * 1.1);
    expect(Math.abs(after.h - before.h)).toBeLessThan(3);
  });

  it('cinnamon warms a grey (red up, blue down) without changing its brightness; cobalt cools it', () => {
    const grey = plate(1, 1, () => [0.2, 0.2, 0.2]);
    const lum = (p: Plate) => 0.2126 * p.lin[0] + 0.7152 * p.lin[1] + 0.0722 * p.lin[2];
    const warm = applyEdits(grey, { ev: 0, sat: 0, warm: 0.3 });
    expect(warm.lin[0]).toBeGreaterThan(warm.lin[1]);
    expect(warm.lin[1]).toBeGreaterThan(warm.lin[2]);
    expect(lum(warm)).toBeCloseTo(lum(grey), 6);
    const cool = applyEdits(grey, { ev: 0, sat: 0, warm: -0.3 });
    expect(cool.lin[2]).toBeGreaterThan(cool.lin[0]);
    expect(lum(cool)).toBeCloseTo(lum(grey), 6);
  });

  it('moss greens a grey and rose turns it magenta, without changing its brightness', () => {
    const grey = plate(1, 1, () => [0.2, 0.2, 0.2]);
    const lum = (p: Plate) => 0.2126 * p.lin[0] + 0.7152 * p.lin[1] + 0.0722 * p.lin[2];
    const moss = applyEdits(grey, { ev: 0, sat: 0, tint: 0.2 });
    expect(moss.lin[1]).toBeGreaterThan(moss.lin[0]);
    expect(moss.lin[0]).toBeCloseTo(moss.lin[2], 9);
    expect(linearToOklab(moss.lin[0], moss.lin[1], moss.lin[2]).a).toBeLessThan(-0.01); // green side
    expect(lum(moss)).toBeCloseTo(lum(grey), 6);
    const rose = applyEdits(grey, { ev: 0, sat: 0, tint: -0.2 });
    expect(linearToOklab(rose.lin[0], rose.lin[1], rose.lin[2]).a).toBeGreaterThan(0.01); // magenta side
    expect(lum(rose)).toBeCloseTo(lum(grey), 6);
  });

  it('no limits, but Ash never pushes a color past grey', () => {
    // Saturation compounds per dose, so even 100 doses of Ash leave a dull orange, not its opposite.
    const sat = dosesToEdits({ ev: 0, sat: -100, warm: 0, tint: 0 }).sat; // as a reaction computes it
    expect(sat).toBeGreaterThan(-1);
    const out = applyEdits(plate(1, 1, () => [0.6, 0.2, 0.04]), { ev: 0, sat });
    const ok = linearToOklab(out.lin[0], out.lin[1], out.lin[2]);
    expect(Math.hypot(ok.a, ok.b)).toBeLessThan(0.01);
    expect(ok.a).toBeGreaterThanOrEqual(0);
  });
});

describe('ranks', () => {
  it('color tiers by OKLab distance ×100', () => {
    expect(tierFor(1).name).toBe('Flawless');
    expect(tierFor(4).name).toBe('Harmonious');
    expect(tierFor(10).name).toBe('Kindred');
    expect(tierFor(15).name).toBe('Wavering');
    expect(tierFor(25).name).toBe('Awry');
    expect(tierFor(28).name).toBe('Botched');
    expect(tierFor(60).name).toBe('Botched');
  });

  it("Krillion's exact points per rank", () => {
    expect([1, 4, 10, 15, 25, 40].map(scoreFor)).toEqual([100, 85, 60, 30, 15, 10]);
  });

  it('craft tiers climb with the running total', () => {
    expect(craftTierFor(70).name).toBe('Gunk');
    expect(craftTierFor(100).name).toBe('Stimulant');
    expect(craftTierFor(200).name).toBe('Antidote');
    expect(craftTierFor(300).name).toBe('Panacea');
    expect(craftTierFor(400).name).toBe('Elixir of Life');
    expect(craftTierFor(500).next).toBeNull();
  });
});

describe("the game's distance: plain OKLab ×100", () => {
  // An OKLab color as CIELAB (the extraction's format), via linear light.
  const fromOk = (ok: { L: number; a: number; b: number }) => {
    const [r, g, b] = oklabToLinear(ok);
    return linearToCielab(r, g, b);
  };

  it('is the straight-line OKLab distance, ×100', () => {
    const a = '#029386';
    const b = '#ceb301';
    expect(distance(a, hexToCielab(b))).toBeCloseTo(deltaEOK(hexToOklab(a), hexToOklab(b)) * 100, 6);
    expect(distance(a, hexToCielab(a))).toBeCloseTo(0, 9);
  });

  it('treats every color alike: the same OKLab step is the same distance', () => {
    for (const c of COLORS) {
      const ok = hexToOklab(c.target);
      expect(distance(c.target, fromOk({ ...ok, L: ok.L - 0.05 })), c.name).toBeCloseTo(5, 4);
      expect(distance(c.target, fromOk({ ...ok, a: ok.a + 0.03, b: ok.b - 0.04 })), c.name).toBeCloseTo(5, 4);
    }
  });

  it('splits into lightness, chroma and hue that add in quadrature', () => {
    const t = hexToCielab(color('teal').target);
    const p = distanceParts(t, hexToCielab('#ceb301'));
    expect(p.dE).toBeCloseTo(Math.hypot(p.l, p.c, p.h), 9);
    const ok = hexToOklab(color('teal').target);
    const darker = distanceParts(t, fromOk({ ...ok, L: ok.L - 0.04 }));
    expect(darker.l).toBeCloseTo(-4, 6);
    expect(darker.c).toBeCloseTo(0, 6);
    expect(darker.h).toBeCloseTo(0, 3);
  });

  it('does not forgive a clearly different hue (teal vs. orange)', () => {
    const ok = hexToOklab(color('teal').target);
    const C = Math.hypot(ok.a, ok.b);
    const h = Math.atan2(ok.b, ok.a) + Math.PI * (160 / 180);
    expect(['Awry', 'Botched']).toContain(tierFor(distance(color('teal').target, fromOk({ L: ok.L, a: C * Math.cos(h), b: C * Math.sin(h) }))).name);
  });

  it('a grey is as far as the target is saturated', () => {
    // The best grey (same lightness, no chroma) sits exactly the target's OKLab chroma away:
    // close to soft colors, far from vivid ones (ANALYSIS §4.21).
    for (const c of COLORS) {
      const ok = hexToOklab(c.target);
      const d = distance(c.target, fromOk({ L: ok.L, a: 0, b: 0 }));
      expect(d, c.name).toBeCloseTo(Math.hypot(ok.a, ok.b) * 100, 4);
      if (Math.hypot(ok.a, ok.b) * 100 > SEVEN.colorTiers[2].maxDE) expect(scoreFor(d), c.name).toBeLessThanOrEqual(30);
    }
  });
});
