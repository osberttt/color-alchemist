// The Assayer: finds the closest drop to each target inside a crop, on the raw
// and light-corrected plates, after the player's edits (GDD §8.2–8.5).
// The Brew preview, the Assay, the live meters and practice plates all use this.

import { accuracy, deltaECA, type Lab } from '../color/oklab';
import {
  autoWhiteBalanceGains,
  applyGains,
  buildDrops,
  dropCenter,
  dropRange,
  dropSize,
  evaluateDrops,
  NO_EDITS,
  type Crop,
  type DropGrid,
  type DropLabs,
  type Edits,
  type Gains,
  type Plate,
} from '../color/plate';
import type { ColorDef } from '../data/colors';
import { TUNING } from '../data/tuning';

export type Variant = 'raw' | 'corrected';

export interface TargetMatch {
  acc: number;
  d: number;
  lab: Lab;
  drop: number;
  variant: Variant;
  /** Normalized center of the winning drop in plate space. */
  cx: number;
  cy: number;
}

export class Assayer {
  readonly plate: Plate;
  readonly raw: DropGrid;
  readonly autoGains: Gains;
  private corrected: DropGrid;
  private autoCorrected: DropGrid;
  correctedBy: 'auto' | 'albedo' = 'auto';
  albedo: Gains | null = null;
  private cache = new Map<string, { raw: DropLabs; corrected: DropLabs }>();

  constructor(plate: Plate, minDrop = 3) {
    this.plate = plate;
    const size = dropSize(plate, minDrop);
    this.raw = buildDrops(plate, size);
    this.autoGains = autoWhiteBalanceGains(plate);
    this.autoCorrected = buildDrops(applyGains(plate, this.autoGains), size);
    this.corrected = this.autoCorrected;
  }

  /** The Albedo tap's correction replaces the automatic one; null restores auto. */
  setAlbedo(gains: Gains | null): void {
    this.albedo = gains;
    this.corrected = gains ? buildDrops(applyGains(this.plate, gains), this.raw.size) : this.autoCorrected;
    this.correctedBy = gains ? 'albedo' : 'auto';
    this.cache.clear();
  }

  correctedPlate(): Plate {
    return this.corrected.plate;
  }

  private labs(edits: Edits): { raw: DropLabs; corrected: DropLabs } {
    const key = `${edits.ev.toFixed(3)}|${edits.sat.toFixed(3)}`;
    let v = this.cache.get(key);
    if (!v) {
      v = { raw: evaluateDrops(this.raw, edits), corrected: evaluateDrops(this.corrected, edits) };
      if (this.cache.size > 24) this.cache.clear();
      this.cache.set(key, v);
    }
    return v;
  }

  match(target: ColorDef, edits: Edits, crop: Crop): TargetMatch | null {
    const labs = this.labs(edits);
    let best: TargetMatch | null = null;
    const variants: [Variant, DropGrid, DropLabs][] = [
      ['raw', this.raw, labs.raw],
      ['corrected', this.corrected, labs.corrected],
    ];
    for (const [variant, grid, l] of variants) {
      const { c0, c1, r0, r1 } = dropRange(grid, crop);
      for (let r = r0; r <= r1; r++) {
        for (let c = c0; c <= c1; c++) {
          const d = r * grid.cols + c;
          if (!l.valid[d]) continue;
          const lab = { L: l.L[d], a: l.a[d], b: l.b[d] };
          const dist = deltaECA(target.lab, lab) / target.tol;
          if (!best || dist < best.d) {
            const ctr = dropCenter(grid, d);
            best = { acc: 0, d: dist, lab, drop: d, variant, cx: ctr.x, cy: ctr.y };
          }
        }
      }
    }
    if (best) best.acc = Math.max(TUNING.accFloor, accuracy(best.d));
    return best;
  }

  matchNoEdits(target: ColorDef, crop: Crop): TargetMatch | null {
    return this.match(target, NO_EDITS, crop);
  }
}

export function cropArea(c: Crop): number {
  return c.w * c.h;
}

/** Enforce the crop floor: area ≥ 1 % and each side ≥ 5 % of the short side (GDD §5). */
export function cropIsLegal(c: Crop, plateW: number, plateH: number): boolean {
  const short = Math.min(plateW, plateH);
  const minSide = TUNING.cropMinSide * short;
  return c.w * plateW >= minSide - 0.5 && c.h * plateH >= minSide - 0.5 && cropArea(c) >= TUNING.cropMinArea - 1e-6;
}
