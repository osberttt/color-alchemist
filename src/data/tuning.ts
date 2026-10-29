// Every tunable number lives here (GDD §8.12). No magic numbers elsewhere.

export const TUNING = {
  huntSeconds: 60,
  hasteSeconds: 30,
  framesAveraged: 4,
  plateShortSide: 480,

  // Drops (GDD §8.3)
  dropFraction: 0.015,
  dropMaxClippedShare: 0.25,
  dropMinL: 0.06,
  dropMaxNonUniformity: 0.04,
  clipLevel: 0.98,

  // ΔE_CA weights (GDD §8.4)
  wL: 0.5,
  wCDuller: 0.75,
  wCVivid: 1.0,
  // Losing most of the chroma (going greyish) is punished: the duller term is
  // multiplied by 1 + k·(1 − C₂/C₁). Without this a grey wall scores ~60 on Teal.
  dullRelK: 1.5,

  // Accuracy curve (GDD §8.5)
  accCore: 0.03,
  accSigma: 0.07,
  accFloor: 5,

  // Auto white balance (GDD §8.2)
  wbP: 6,
  wbStrength: 0.6,
  wbGainMin: 0.7,
  wbGainMax: 1.4,
  wbDarkL: 0.08,

  // Albedo tap (GDD §5)
  albedoMinL: 0.45,
  albedoMaxC: 0.08,
  albedoGainMin: 0.6,
  albedoGainMax: 1.6,

  // Crop (GDD §5, §8.7)
  cropMinArea: 0.01,
  cropMinSide: 0.05,
  concentrationMax: 1.5,

  // Edits
  evRange: 1.0,
  satMin: -0.5,
  satMax: 0.6,
  sliderSnap: 0.03,
  puritySlope: 0.25,
  purityFloor: 0.5,
  pureDraw: 1.1,

  tierMult: { lead: 1.0, silver: 1.15, gold: 1.3 } as Record<string, number>,
  quicksilverPerSecond: 2,
  quicksilverMax: 120,
  foolsGoldThreshold: 20,
  transmuteMult: 0.85,

  // Bonuses (GDD §8.9)
  pinchMaxF: 0.04,
  pinchPoints: 50,
  equilibriumGap: 5,
  equilibriumMin: 80,
  equilibriumPoints: 25,
  stonePoints: 300,

  // Lens (GDD §8.12)
  lensFaint: 50,
  lensFull: 85,

  // Bands (GDD §8.10)
  bands: [
    { name: 'GRAYSCALE', min: 0 },
    { name: 'SEPIA', min: 1500 },
    { name: 'PASTEL', min: 2500 },
    { name: 'VIVID', min: 3500 },
    { name: 'TECHNICOLOR', min: 4500 },
  ],

  // Pair dealing (GDD §10.2)
  pairMinDelta: 0.15,
  darkL: 0.36,
  formulaWeight: 3,
  undiscoveredWeight: 2,
} as const;

// "Seven Colors" mode: one color per section, the color extracting machine (ANALYSIS §4.1–4.6).
export const SEVEN = {
  sections: 5,
  /** Seconds per color. */
  seconds: 30,
  /**
   * The machine's side bars nudge what the camera sees (ANALYSIS §4.17, widened in §4.20):
   * brightness ±evMax stops in linear light (0.75 ≈ −41 % … +68 % light), saturation
   * ±satMax of OKLab chroma. Hue can't change, and a grey stays grey.
   */
  adjust: { evMax: 0.75, satMax: 0.4 },
  /** The color extracting machine: a centered square, as a fraction of the view's short side. */
  squareFraction: 0.3,
  /** Short side of the captured view, in px. */
  viewShortSide: 360,
  zoomMin: 1,
  zoomMax: 4,
  tiers: ['lead', 'lead', 'silver', 'silver', 'gold'] as const,
  maxDarkPerRun: 2,
  /**
   * Per-color rank by plain OKLab distance ×100 (≤ maxDE), best first, with Krillion's
   * exact points: One in a Krillion 100, Deep Cut 85, Rare 60, Schooler 30, Too Clever 15,
   * Plankton 10. The limits are the typical OKLab size of the old CIEDE2000 ranks, so the
   * overall difficulty is unchanged but now even across colors (ANALYSIS §4.21).
   */
  colorTiers: [
    { name: 'Flawless', maxDE: 2, points: 100 },
    { name: 'Harmonious', maxDE: 6, points: 85 },
    { name: 'Kindred', maxDE: 12, points: 60 },
    { name: 'Wavering', maxDE: 20, points: 30 },
    { name: 'Awry', maxDE: 27, points: 15 },
    { name: 'Botched', maxDE: Infinity, points: 10 },
  ],
  /** Points when nothing could be extracted (the timed-out capture failed). When time runs out the machine normally extracts on its own. */
  emptyPoints: 0,
  /**
   * The potion the run brews, ranked by the running total of points (max 500: 5 colors
   * × 100). (Called "craft" in code.) Krillion doesn't publish its depth-zone thresholds;
   * these are ours: an even 100 per rank. Averages per color: Stimulant 20, Antidote 40,
   * Panacea 60 (Kindred), Elixir of Life 80.
   */
  craftTiers: [
    { name: 'Gunk', min: 0 },
    { name: 'Stimulant', min: 100 },
    { name: 'Antidote', min: 200 },
    { name: 'Panacea', min: 300 },
    { name: 'Elixir of Life', min: 400 },
  ],
  /** The result waits for the player's tap; taps earlier than this are ignored (double-tap guard). */
  resultGuardMs: 900,
  introMs: 1700,
} as const;

// --- Tuner overrides ----------------------------------------------------------------
// tuner.html saves the scoring values to localStorage so they can be played on the
// same device right away. Only dev and test (GitHub Pages) builds read them; the jam
// build (`npm run build`, mode "production") always uses the values above.

export const TUNING_OVERRIDE_KEY = 'color-alchemist:tuning-override';

export interface SevenTunables {
  /** maxDE for Flawless, Harmonious, Kindred, Wavering, Awry (Botched is the rest). */
  colorTierMax: number[];
  /** Points for Flawless … Botched (same order as colorTiers). */
  tierPoints: number[];
  /** min total for Stimulant, Antidote, Panacea, Elixir of Life (Gunk starts at 0). */
  craftMins: number[];
}

export function currentTunables(): SevenTunables {
  return {
    colorTierMax: SEVEN.colorTiers.slice(0, -1).map((t) => t.maxDE),
    tierPoints: SEVEN.colorTiers.map((t) => t.points),
    craftMins: SEVEN.craftTiers.slice(1).map((t) => t.min),
  };
}

export const SEVEN_DEFAULTS: SevenTunables = currentTunables();

const ascending = (a: unknown, n: number) =>
  Array.isArray(a) && a.length === n && a.every((x, i) => typeof x === 'number' && x > 0 && (i === 0 || x > a[i - 1]));

export function validTunables(t: unknown): t is SevenTunables {
  const v = t as SevenTunables;
  return (
    !!v &&
    ascending(v.colorTierMax, SEVEN.colorTiers.length - 1) &&
    Array.isArray(v.tierPoints) &&
    v.tierPoints.length === SEVEN.colorTiers.length &&
    v.tierPoints.every((p) => typeof p === 'number' && p >= 0) &&
    ascending(v.craftMins, SEVEN.craftTiers.length - 1)
  );
}

export function applyTunables(t: SevenTunables): void {
  if (!validTunables(t)) return;
  const s = SEVEN as unknown as {
    colorTiers: { name: string; maxDE: number; points: number }[];
    craftTiers: { name: string; min: number }[];
  };
  s.colorTiers = s.colorTiers.map((tier, i) => ({ name: tier.name, maxDE: i < t.colorTierMax.length ? t.colorTierMax[i] : Infinity, points: t.tierPoints[i] }));
  s.craftTiers = s.craftTiers.map((tier, i) => ({ name: tier.name, min: i === 0 ? 0 : t.craftMins[i - 1] }));
}

export function tuningOverridesAllowed(): boolean {
  return import.meta.env.MODE !== 'production';
}

/**
 * Saved overrides remember the defaults they were tuned against. When the defaults in
 * this file change (a new version is deployed), stale overrides are ignored instead of
 * silently hiding the new values.
 */
const DEFAULTS_SIGNATURE = JSON.stringify(SEVEN_DEFAULTS);

export function saveTunables(t: SevenTunables): void {
  try {
    localStorage.setItem(TUNING_OVERRIDE_KEY, JSON.stringify({ base: DEFAULTS_SIGNATURE, values: t }));
  } catch {
    // Storage blocked: the values still apply to this page.
  }
}

export function clearTunables(): void {
  try {
    localStorage.removeItem(TUNING_OVERRIDE_KEY);
  } catch {
    // ignore
  }
}

if (tuningOverridesAllowed()) {
  try {
    const raw = localStorage.getItem(TUNING_OVERRIDE_KEY);
    const saved = raw ? (JSON.parse(raw) as { base?: string; values?: SevenTunables }) : null;
    if (saved?.base === DEFAULTS_SIGNATURE && saved.values) applyTunables(saved.values);
    else if (saved) clearTunables();
  } catch {
    // No storage (tests, private mode): use the defaults.
  }
}
