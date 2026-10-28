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
  sections: 7,
  /** Seconds per color. Test 30–40 s too: 7 × 60 s is twice Krillion's run length. */
  seconds: 60,
  /** The color extracting machine: a centered square, as a fraction of the view's short side. */
  squareFraction: 0.3,
  /** Short side of the captured view, in px. */
  viewShortSide: 360,
  zoomMin: 1,
  zoomMax: 4,
  tiers: ['lead', 'lead', 'lead', 'silver', 'silver', 'silver', 'gold'] as const,
  maxDarkPerRun: 2,
  /**
   * CIEDE2000's parametric weights (higher = more forgiving, lower = stricter).
   * Small hue shifts (≤ 30°) are 2× more lenient than standard. The leniency fades out
   * by 75°, so a different hue is still wrong. Lightness is a little stricter: lighter/
   * darker differences count 1.25×. Chroma is standard (ANALYSIS §4.7–4.8).
   */
  deltaWeights: { kL: 0.8, kC: 1, kH: 2, hueLenientTo: 30, hueStrictFrom: 75 },
  /**
   * Per-color rank by weighted CIEDE2000 distance (≤ maxDE), best first, with
   * Krillion's exact points: One in a Krillion 100, Deep Cut 85, Rare 60,
   * Schooler 30, Too Clever 15, Plankton 10.
   */
  colorTiers: [
    { name: 'Flawless', maxDE: 1, points: 100 },
    { name: 'Harmonious', maxDE: 2.5, points: 85 },
    { name: 'Kindred', maxDE: 5, points: 60 },
    // Tight enough that a grey is Botched for every color except Charcoal: the best grey
    // sits at ΔE ≥ 14.1 (median 24.9) under these weights (ANALYSIS §4.8).
    { name: 'Wavering', maxDE: 8, points: 30 },
    { name: 'Awry', maxDE: 14, points: 15 },
    { name: 'Botched', maxDE: Infinity, points: 10 },
  ],
  /** Krillion: an unanswered prompt scores 0. Here: time runs out, nothing is extracted. */
  emptyPoints: 0,
  /** Result screen: steps in the target → extracted ramp, per color rank. */
  rampSteps: { Flawless: 1, Harmonious: 2, Kindred: 3, Wavering: 4, Awry: 5, Botched: 6 } as Record<string, number>,
  /**
   * The craft, ranked by the running total of points (max 700, like Krillion's 7 × 100).
   * Krillion doesn't publish its depth-zone thresholds; these are ours.
   */
  craftTiers: [
    { name: 'Gunk', min: 0 },
    { name: 'Trinket', min: 150 },
    { name: 'Curio', min: 250 },
    { name: 'Marvel', min: 380 },
    { name: 'Quintessence', min: 500 },
    { name: 'Magnum Opus', min: 620 },
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
  /** CIEDE2000 weights: kL (lightness), kC (chroma), kH (hue) + the hue-leniency window in degrees. */
  weights: { kL: number; kC: number; kH: number; hueLenientTo: number; hueStrictFrom: number };
  /** maxDE for Flawless, Harmonious, Kindred, Wavering, Awry (Botched is the rest). */
  colorTierMax: number[];
  /** Points for Flawless … Botched (same order as colorTiers). */
  tierPoints: number[];
  /** min total for Trinket, Curio, Marvel, Quintessence, Magnum Opus (Gunk starts at 0). */
  craftMins: number[];
}

export function currentTunables(): SevenTunables {
  return {
    weights: { ...SEVEN.deltaWeights },
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
    !!v.weights &&
    [v.weights.kL, v.weights.kC, v.weights.kH].every((k) => typeof k === 'number' && k > 0) &&
    typeof v.weights.hueLenientTo === 'number' &&
    typeof v.weights.hueStrictFrom === 'number' &&
    v.weights.hueStrictFrom >= v.weights.hueLenientTo &&
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
    deltaWeights: SevenTunables['weights'];
    colorTiers: { name: string; maxDE: number; points: number }[];
    craftTiers: { name: string; min: number }[];
  };
  s.deltaWeights = { ...t.weights };
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
