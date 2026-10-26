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

// "Seven Colors" mode: one color per section, live center square (ANALYSIS §4.1).
export const SEVEN = {
  sections: 7,
  /** Seconds per color. Test 30–40 s too: 7 × 60 s is twice Krillion's run length. */
  seconds: 60,
  /** Square side as a fraction of the visible frame's short side. */
  squareFraction: 0.3,
  /** The square is scored as an n×n grid of cells; the score is the mean cell accuracy. */
  squareCells: 10,
  /** Short side of the captured view, in px. */
  viewShortSide: 360,
  zoomMin: 1,
  zoomMax: 4,
  /** Free, invisible help: score the better of the raw square and an auto-white-balanced one. */
  autoLight: true,
  stonePoints: 500,
  tiers: ['lead', 'lead', 'lead', 'silver', 'silver', 'silver', 'gold'] as const,
  maxDarkPerRun: 2,
  /** The result waits for the player's tap; taps earlier than this are ignored (double-tap guard). */
  resultGuardMs: 600,
  /** Result screen: steps in the target → yours color ramp. The further off, the longer the walk. */
  rampSteps: { Quintessence: 1, Essence: 2, Elixir: 3, Tincture: 4, Murk: 5, Sludge: 6 } as Record<string, number>,
  introMs: 1300,
  bands: [
    { name: 'GRAYSCALE', min: 0 },
    { name: 'SEPIA', min: 2500 },
    { name: 'PASTEL', min: 4000 },
    { name: 'VIVID', min: 5500 },
    { name: 'TECHNICOLOR', min: 7000 },
  ],
} as const;
