import { describe, expect, it } from 'vitest';
import { oklabToLinear } from '../src/color/oklab';
import type { Plate } from '../src/color/plate';
import { SquareAssayer, centerSquare } from '../src/scoring/square';
import { color } from '../src/data/colors';

function plate(w: number, h: number, fill: (x: number, y: number) => [number, number, number]): Plate {
  const lin = new Float32Array(w * h * 3);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) lin.set(fill(x, y), (y * w + x) * 3);
  return { w, h, lin };
}

const teal = color('teal');
const tealLin = oklabToLinear(teal.lab);
const grey: [number, number, number] = [0.2, 0.2, 0.2];

describe('Seven Colors square scoring', () => {
  it('centers the square on the view', () => {
    expect(centerSquare({ w: 360, h: 480, lin: new Float32Array(0) })).toEqual({ x: 126, y: 186, side: 108 });
  });

  it('a square full of exact teal scores 100', () => {
    const p = plate(360, 480, () => tealLin);
    expect(new SquareAssayer(p).score(teal, { ev: 0, sat: 0 }).acc).toBeCloseTo(100, 5);
  });

  it('the whole square counts: half teal scores about half', () => {
    const sq = centerSquare({ w: 360, h: 480, lin: new Float32Array(0) });
    const p = plate(360, 480, (x) => (x < sq.x + sq.side / 2 ? tealLin : grey));
    const acc = new SquareAssayer(p).score(teal, { ev: 0, sat: 0 }).acc;
    expect(acc).toBeGreaterThan(40);
    expect(acc).toBeLessThan(60);
  });

  it('teal outside the square does not count', () => {
    const p = plate(360, 480, (_x, y) => (y < 100 ? tealLin : grey));
    expect(new SquareAssayer(p).score(teal, { ev: 0, sat: 0 }).acc).toBeLessThan(10);
  });

  it('brightening a too-dark teal helps, and costs nothing here but Purity', () => {
    const dark = tealLin.map((c) => c * 0.5) as [number, number, number];
    const p = plate(360, 480, () => dark);
    const a = new SquareAssayer(p);
    const before = a.score(teal, { ev: 0, sat: 0 }).acc;
    const after = a.score(teal, { ev: 1, sat: 0 }).acc;
    expect(after).toBeGreaterThan(before);
    expect(after).toBeGreaterThan(95);
  });
});
