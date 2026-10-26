// Whole-square scoring for Seven Colors (ANALYSIS §4.1).
// The center square is split into n×n cells; every cell is scored against the
// target and the square's accuracy is the mean. Fill the square with the color.
// Free light correction still applies: raw vs auto-white-balanced, best wins.

import { accuracy, deltaECA, linearToOklab, type Lab } from '../color/oklab';
import { applyGains, autoWhiteBalanceGains, buildDrops, evaluateDrops, NO_EDITS, type DropGrid, type Edits, type Gains, type Plate } from '../color/plate';
import type { ColorDef } from '../data/colors';
import { SEVEN } from '../data/tuning';

export interface SquareRect {
  x: number;
  y: number;
  side: number;
}

export interface SquareScore {
  acc: number;
  mean: Lab;
  variant: 'raw' | 'corrected';
}

/** Cut a square out of a plate (pixel coordinates). */
export function cropPlate(plate: Plate, r: SquareRect): Plate {
  const side = Math.max(1, Math.min(r.side, plate.w - r.x, plate.h - r.y));
  const lin = new Float32Array(side * side * 3);
  for (let y = 0; y < side; y++) {
    const src = ((r.y + y) * plate.w + r.x) * 3;
    lin.set(plate.lin.subarray(src, src + side * 3), y * side * 3);
  }
  return { w: side, h: side, lin };
}

/** The centered square of a view plate. */
export function centerSquare(plate: Plate, fraction = SEVEN.squareFraction): SquareRect {
  const side = Math.round(Math.min(plate.w, plate.h) * fraction);
  return { x: Math.round((plate.w - side) / 2), y: Math.round((plate.h - side) / 2), side };
}

function meanLinear(p: Plate): [number, number, number] {
  let r = 0;
  let g = 0;
  let b = 0;
  const n = p.w * p.h;
  for (let i = 0; i < p.lin.length; i += 3) {
    r += p.lin[i];
    g += p.lin[i + 1];
    b += p.lin[i + 2];
  }
  return [r / n, g / n, b / n];
}

export class SquareAssayer {
  readonly view: Plate;
  readonly square: Plate;
  readonly gains: Gains;
  private raw: DropGrid;
  private corrected: DropGrid;

  constructor(view: Plate, rect: SquareRect = centerSquare(view), cells: number = SEVEN.squareCells) {
    this.view = view;
    this.square = cropPlate(view, rect);
    // The illuminant is estimated on the whole visible frame, not just the square.
    this.gains = autoWhiteBalanceGains(view);
    const size = Math.max(1, Math.floor(this.square.w / cells));
    this.raw = buildDrops(this.square, size);
    this.corrected = buildDrops(applyGains(this.square, this.gains), size);
  }

  private scoreGrid(grid: DropGrid, target: ColorDef, edits: Edits): number {
    const labs = evaluateDrops(grid, edits);
    const count = grid.cols * grid.rows;
    let sum = 0;
    for (let d = 0; d < count; d++) {
      if (labs.clipped[d]) continue; // blown-out cells score 0
      sum += accuracy(deltaECA(target.lab, { L: labs.L[d], a: labs.a[d], b: labs.b[d] }) / target.tol);
    }
    return count ? sum / count : 0;
  }

  /** The square's average color after edits (what the player sees in the frame). */
  meanColor(edits: Edits, variant: 'raw' | 'corrected' = 'raw'): Lab {
    const [r, g, b] = meanLinear(variant === 'raw' ? this.square : applyGains(this.square, this.gains));
    const k = Math.pow(2, edits.ev);
    const lab = linearToOklab(Math.min(1, r * k), Math.min(1, g * k), Math.min(1, b * k));
    return { L: lab.L, a: lab.a * (1 + edits.sat), b: lab.b * (1 + edits.sat) };
  }

  score(target: ColorDef, edits: Edits): SquareScore {
    const raw = this.scoreGrid(this.raw, target, edits);
    const corr = SEVEN.autoLight ? this.scoreGrid(this.corrected, target, edits) : -1;
    const variant = corr > raw ? 'corrected' : 'raw';
    return { acc: Math.max(raw, corr), mean: this.meanColor(edits, variant), variant };
  }

  scoreNoEdits(target: ColorDef): SquareScore {
    return this.score(target, NO_EDITS);
  }
}
