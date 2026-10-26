import { describe, expect, it } from 'vitest';
import { accuracy, deltaECA, hexToOklab, linearToOklab, oklabToHex, oklabToLinear } from '../src/color/oklab';
import { buildDrops, evaluateDrops, NO_EDITS, FULL_CROP, type Plate } from '../src/color/plate';
import { Assayer } from '../src/scoring/assay';
import { color } from '../src/data/colors';

describe('OKLab', () => {
  it('maps white to L=1, a=b=0', () => {
    const w = linearToOklab(1, 1, 1);
    expect(w.L).toBeCloseTo(1, 4);
    expect(w.a).toBeCloseTo(0, 4);
    expect(w.b).toBeCloseTo(0, 4);
  });

  it('matches the reference value for sRGB red', () => {
    // Reference: Ottosson, oklab(0.627955 0.224863 0.125846)
    const r = hexToOklab('#ff0000');
    expect(r.L).toBeCloseTo(0.627955, 4);
    expect(r.a).toBeCloseTo(0.224863, 4);
    expect(r.b).toBeCloseTo(0.125846, 4);
  });

  it('round-trips', () => {
    const lab = hexToOklab('#029386');
    const [r, g, b] = oklabToLinear(lab);
    const back = linearToOklab(r, g, b);
    expect(back.L).toBeCloseTo(lab.L, 5);
    expect(back.a).toBeCloseTo(lab.a, 5);
    expect(oklabToHex(lab)).toBe('#029386');
  });
});

describe('ΔE_CA and accuracy', () => {
  it('is zero for identical colors', () => {
    const t = hexToOklab('#029386');
    expect(deltaECA(t, t)).toBe(0);
  });

  it('weights lightness by half', () => {
    const t = { L: 0.6, a: 0, b: 0 };
    expect(deltaECA(t, { L: 0.7, a: 0, b: 0 })).toBeCloseTo(0.05, 6);
  });

  it('forgives slightly duller samples but punishes greyish ones', () => {
    const t = { L: 0.6, a: 0.1, b: 0 };
    expect(deltaECA(t, { L: 0.6, a: 0.09, b: 0 })).toBeCloseTo(0.75 * 0.01 * 1.15, 6);
    expect(deltaECA(t, { L: 0.6, a: 0.11, b: 0 })).toBeCloseTo(0.01, 6);
    expect(deltaECA(t, { L: 0.6, a: 0.06, b: 0 })).toBeCloseTo(0.75 * 0.04 * 1.6, 6);
  });

  it('a grey wall is not teal (or steel blue)', () => {
    const grey = linearToOklab(0.2, 0.2, 0.2);
    expect(accuracy(deltaECA(color('teal').lab, { ...grey, L: color('teal').lab.L }))).toBeLessThan(10);
    expect(accuracy(deltaECA(color('steel-blue').lab, { ...grey, L: color('steel-blue').lab.L }))).toBeLessThan(40);
  });

  it('follows the accuracy table (GDD §8.5)', () => {
    const table: [number, number][] = [
      [0.03, 100], [0.04, 98], [0.05, 92], [0.06, 83], [0.07, 72], [0.08, 60], [0.1, 37], [0.12, 19],
    ];
    for (const [d, acc] of table) expect(Math.round(accuracy(d))).toBe(acc);
  });

  it('teal under moderately warm light scores about 93 (GDD sanity check)', () => {
    const t = color('teal').lab;
    const C = Math.hypot(t.a, t.b);
    const h = Math.atan2(t.b, t.a) + (15 * Math.PI) / 180;
    const c2 = C - 0.02;
    const s = { L: t.L - 0.08, a: c2 * Math.cos(h), b: c2 * Math.sin(h) };
    const d = deltaECA(t, s);
    expect(d).toBeGreaterThan(0.04);
    expect(d).toBeLessThan(0.06);
    expect(accuracy(d)).toBeGreaterThan(85);
  });
});

function solidPlate(w: number, h: number, fill: (x: number, y: number) => [number, number, number]): Plate {
  const lin = new Float32Array(w * h * 3);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) lin.set(fill(x, y), (y * w + x) * 3);
  return { w, h, lin };
}

describe('drops', () => {
  it('rejects edges between two colors and keeps flat patches', () => {
    // Left half red, right half blue, boundary at x = 50 (not aligned to the 7 px grid).
    const p = solidPlate(100, 70, (x) => (x < 50 ? [0.6, 0.05, 0.05] : [0.05, 0.05, 0.6]));
    const grid = buildDrops(p, 7);
    const labs = evaluateDrops(grid, NO_EDITS);
    const straddler = 7; // column 7 covers x 49..55
    expect(labs.valid[straddler]).toBe(0);
    expect(labs.valid[0]).toBe(1);
    expect(labs.valid[13]).toBe(1);
  });

  it('rejects clipped drops', () => {
    const p = solidPlate(70, 70, () => [1, 1, 1]);
    const labs = evaluateDrops(buildDrops(p, 7), NO_EDITS);
    expect(labs.valid.every((v) => v === 0)).toBe(true);
  });

  it('finds an exact teal patch with full marks', () => {
    const teal = color('teal');
    const [r, g, b] = oklabToLinear(teal.lab);
    const p = solidPlate(140, 140, (x, y) => (x > 70 && y > 70 ? [r, g, b] : [0.18, 0.18, 0.18]));
    const a = new Assayer(p);
    const m = a.match(teal, NO_EDITS, FULL_CROP);
    expect(m).not.toBeNull();
    expect(m!.acc).toBe(100);
    expect(m!.cx).toBeGreaterThan(0.5);
  });

  it('the crop decides what counts', () => {
    const teal = color('teal');
    const [r, g, b] = oklabToLinear(teal.lab);
    const p = solidPlate(140, 140, (x, y) => (x > 70 && y > 70 ? [r, g, b] : [0.18, 0.18, 0.18]));
    const a = new Assayer(p);
    const m = a.match(teal, NO_EDITS, { x: 0, y: 0, w: 0.4, h: 0.4 });
    expect(m!.acc).toBeLessThan(20);
  });
});
