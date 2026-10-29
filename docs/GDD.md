# Colorchemy — Game Design Document

> **is your life full of colors?**

| | |
|---|---|
| Working title | Colorchemy |
| Version | 0.1 (pre-production), 2026-10-26 |
| Genre | Real-world color hunt / photo score-attack, arcade |
| Platform | Mobile web first (portrait), desktop web second |
| Session | One run is about 4–5 minutes (3 brews) |
| Target | Mobile / arcade / browser game jam that rewards retention |
| Companion docs | [`ANALYSIS.md`](./ANALYSIS.md) (market, design and tech analysis with sources), [`../CLAUDE.md`](../CLAUDE.md) |

Status: **jam build in progress** (Digit7 Jam, deadline 31 Oct 2026, 23:59:59 UTC+06:30). Every number is a starting value to tune on real phones.

---

## 0. Current jam design: "Seven Colors" (v0.4, 2026-10-28). This section supersedes the rest

The sections after this one describe the original pair-based design ("Classic"). Where they conflict, **this section wins**. The reasons for each change are in `ANALYSIS.md` §4.1–4.6.

**Loop (Krillion-like, deliberately simple)**
1. A run is **5 sections**, named after five operations of the Great Work: *Calcination, Dissolution, Conjunction, Distillation, Coagulation*. The run makes **one craft**. (The mode keeps its code name "Seven Colors".)
2. Each section deals **one** named color. Tier ladder: Lead, Lead, Silver, Silver, Gold. No two colors in a row share an element, and there are at most 2 dark colors per run. The first-ever camera run opens with **Denim** (jeans).
0. **The tincture (before the first color; no clock; not in Practice)**: the player calibrates the machine for their own light. "Mix your tincture: drop ingredients into the machine until the world inside looks like the world around you." Eight ingredients, dragged (or tapped) into the machine, one dose each, **no limits**; opposite ingredients cancel: **Sunlight / Darkness** (±0.15 stops of light per dose), **Pigment / Ash** (OKLab chroma ×1.07 per dose, compounding, so Ash nears grey but never inverts), **Cinnamon / Cobalt** (warmer / cooler: red up and blue down by 0.06 stops per dose) and **Moss / Rose** (greener / more magenta: green up or down against red and blue by 0.05 stops). Warmth and tint keep brightness: together they are a camera's white balance (Temperature and Tint). Every dose pours as liquid of its color through the pipes into the square, where it pools, sloshes and drains (§4.24). A meter per pair shows the doses (filling softly, never full); "Pour out" resets. The machine is drawn neutral grey here so it doesn't bias the eye. "Start extracting" (or Enter) begins the first color. The tincture then applies, fixed, to the viewfinder and every capture of the run.
3. **Intro beat** (~1.7 s): the operation, "extract", a swatch and the color name.
4. **Hunt (30 s)**: the live camera in full color, seen through the tincture. **The whole camera view is the color extracting machine**: a frame in the target color, with pipes from all four sides of the frame into the centered square (30 % of the short side). A nameplate sits on the bottom pipe. The panel shows the **target** swatch and a hidden **"?"** for the extracted color: players judge by eye. They can **zoom** (digital, 1–4×) and **extract**; nothing else can be adjusted during the 30 s. Time runs out → the machine **extracts on its own**, from wherever the player left it (aim and zoom), and it is judged normally. Only if that capture fails does the color score 0.
   - **No side bars any more:** brightness and saturation moved into the tincture (step 0, ANALYSIS §4.23).
   - **Blend reveal** (after the player's extraction or when time runs out): the frame freezes and everything in the square comes together at once: it swirls and shrinks into a round blob at the very center, melting into the one extracted color, and the blob flies straight into the extracted swatch, which shows the color at last.
5. **No other correction.** Light is part of the game: shade it with a hand, tilt, move to a window. **Blending is allowed**: red and yellow objects side by side in the square extract as orange.
6. **Extraction**: once the swatch shows the color, the **result sheet** slides up (its own palette):
   - target → extracted as a **continuous spectrum** (blended in OKLab), flowing in from the target's side
   - the score, the rank stamp and the exact ΔE00
   - the **potion panel**: the drop falls into the potion, which nudges; on a rank-up it turns into the new potion in place (never vanishing) as the progress bar fills the old rank and starts the next
   It waits for the player's tap; the next clock starts when the next color appears.
7. After 5 colors, the **potion reveal**: the potion evolves rank by rank to its final form. You also get the total, the 5 extracted swatches, the list of colors (rank, ΔE, points), a local leaderboard entry and a share text with a **5-square emoji row**. "Brew again" restarts in one tap.

**Scoring (simple and even)**
- **Extraction** = the mean of every pixel in the square (after the tincture), in linear RGB (4 camera frames averaged).
- **Distance** = the **straight-line distance in OKLab**, ×100: √(ΔL² + Δa² + Δb²). No weights or special cases; OKLab is built so this plain distance tracks how different colors look, so every color is judged the same way. About 2 is just noticeable. (Until §4.21 this was a weighted CIEDE2000, which was about twice as forgiving on vivid blues and pinks as on muted colors.)
- **Per-color rank and points (Krillion's exact values):**

  | Rank | ΔE (OKLab ×100) | Points |
  |---|---|---|
  | Flawless | ≤ 2 | 100 |
  | Harmonious | ≤ 6 | 85 |
  | Kindred | ≤ 12 | 60 |
  | Wavering | ≤ 20 | 30 |
  | Awry | ≤ 27 | 15 |
  | Botched | > 27 | 10 |

  A grey sits exactly the target's saturation away: Kindred on the 21 softest colors (Beige, Baby Blue, Steel Blue…), Wavering on most vivid ones.
  | Empty (the timed-out capture failed) | — | 0 |

  No time bonus, no tier multiplier.
- **The potion.** The alchemist brews the **Elixir of Life**; each extracted color is a drop in the brew. Potion rank by the running total (max 500), one rank per 100 points: **Gunk** ("a starter batch") < 100 ≤ **Stimulant** < 200 ≤ **Antidote** < 300 ≤ **Panacea** < 400 ≤ **Elixir of Life**. Retune after real playtests with the tuner (`tuner.html`).
- **Potion art** (`src/ui/potion.ts`, code-drawn SVG: no image files), in the palette of the page it's on (result sheet, summary). Each rank uses more of the palette's colors, nudged a little: Gunk muddy, Stimulant 2, Antidote 3, Panacea 5 a little brighter, Elixir 8 (the 5 accents plus blends) brighter still. On light pages the glass edge takes the page's text color.
  - **Gunk:** a cracked clay crock; sludge oozes over the rim, bubbles pop, a drip falls, a fly circles.
  - **Stimulant:** a corked round-bottom flask, fizzing; it twitches now and then, with little energy zaps.
  - **Antidote:** an apothecary bottle with two settled layers, a parchment label with a herb leaf, a sprig tied at the neck, a glass stopper; it sways.
  - **Panacea:** a faceted teardrop bottle with a gold collar and rounded gold stopper; glowing currents of color; it floats, with a halo and sparkles.
  - **Elixir of Life:** a heart-shaped flask holding every color, glowing and swirling, motes of light rising, a glowing orb stopper, a halo and turning rays.

**Modes**
- **Begin the hunt**: the camera.
- **Practice · no camera**: a painted still life per color; drag to aim, zoom like a camera. Its own leaderboard.
- **Test photos (dev builds only)**: real photos from `test-photos/` or any image file. Not in the jam build: the game is live-camera only.

**Look and feel**
- **Menus are full of color:** every page outside the hunt (title, how-to, camera prompt/error, leaderboard, summary, dialogs) gets its own palette from 21 (`src/ui/palettes.ts`): pastel, neon, bright, dull, earthy, dark. New palettes every refresh for now (daily later).
- **The hunt screen stays neutral grey**: surrounding colors would bias how players judge the square (simultaneous contrast). Its juice uses only the target and found colors.
- **Juice** (`src/ui/fx.ts`): paint-wipe transitions, particles, confetti, floating points, shakes, staggered entrances, a bouncing logo. Everything respects `prefers-reduced-motion`.

**Out of scope for the jam:** daily seed, online leaderboard, Grimoire, Lens color-splash, catalysts, transmute, editing sliders, light correction, time bonus, Famous Formulae. Their code (Classic mode) is still in the repo but not reachable from the UI.

---

## 1. Pitch

You are an alchemist. Your potions are only as good as your colors, and the colors are out there in the real world. Each run you get three brews. For each brew you're given **two named colors** (say *Teal* and *Mustard*) and **60 seconds** to photograph something that contains both with your phone camera. Then you **brew** the photo: crop it as tight as you dare and, only if you must, nudge brightness and saturation. Finally the **assay** finds the closest match to each color in your photo, judges it, and turns it into a named potion.

At the end the game answers the tagline: *is your life full of colors?* Your run lands on a band from **Grayscale** to **Technicolor**, and your Grimoire, a shelf of 55 empty flasks, slowly fills with colors you actually found in your life.

### 1.1 Inspiration and what we borrow

- **Krillion** ([krillion.io](https://krillion.io)), a daily browser word game where "the obvious answer loses". Everyone gets the same 7 prompts a day, each answer earns a named rarity tier (*Plankton, Too Clever, Schooler, Rare, Deep Cut, One in a Krillion*), points turn into dive depth, and the final depth falls into a named band (*Shallows … Trench*). See ANALYSIS §1.1.
  - We borrow the **daily shared seed**, the **short fixed-length run** (Krillion has 7 rounds, we have 3 brews), **named grades per answer**, **named end-of-run bands**, a **thematic metaphor for score** (depth there, color saturation here) and a **spoiler-free emoji share**.
  - Krillion's *Too Clever* tier (valid, but a predictable "clever" answer) becomes our **Fool's Gold** label: you hit the color, but only because you gilded it with edits.
- **Noilirk**: we could not find this game online. The name is *krillion* reversed. Nothing in this doc assumes anything about it (see Open Questions).

### 1.2 Design pillars

1. **Color is earned.** The interface is grayscale. The only real color on screen is a target you're hunting or a color you've found.
2. **The real world is the level.** Live camera only. No gallery uploads. Your room, your street and your fridge are the content.
3. **Arcade-quick, daily-deep.** You're in the camera within about 10 seconds of opening the page, and a run takes 5 minutes. A daily seed, a collection and streaks bring you back tomorrow.
4. **An honest, forgiving judge.** If it's teal to a human, it should score as teal. The scoring works in perceptual color space, it's lenient about light and strict about hue, and it always shows why you got the score you got.

---

## 2. Core loop

```
 ┌──────────── RUN (3 brews: Nigredo → Albedo → Rubedo) ─────────────┐
 │                                                                    │
 │  DEAL 2 colors ─► HUNT (60 s live camera) ─► BREW (crop + 2 sliders)│
 │        ▲                                          │                 │
 │        │                                          ▼                 │
 │   next brew ◄── POTION (named) ◄── ASSAY (find, judge, score)       │
 │                                                                    │
 └──► SUMMARY: band ("is your life full of colors? → VIVID"),        │
      share card, leaderboard, Grimoire update ──► BREW AGAIN (1 tap) ─┘
```

### 2.1 Timing budget (target)

| Phase | Time | Notes |
|---|---|---|
| Deal / intro | 3 s | Names and swatches slam in, then "3-2-1, Uncork!" |
| Hunt | ≤ 60 s | Hard cap. If time runs out, the current frame is captured automatically |
| Brew | 10–20 s typical | Not timed. Live score preview keeps it snappy |
| Assay | about 6 s | Tap to skip after the first run |
| Potion | 2 s | |
| **Per brew** | **about 80–90 s** | |
| **Run** | **about 4–5 min** | Similar to Krillion's roughly 4-minute daily run |

---

## 3. Run structure

A run has **3 brews**, named after the classic alchemical stages of the Great Work (the three-stage version). Each brew deals **2 colors**. The difficulty ladder is described in §10.3.

| # | Stage | Meaning (flavor) | Deal | Extras |
|---|---|---|---|---|
| 1 | **Nigredo** (blackening) | Raw matter | Lead + Lead (common colors) | Tutorial hints on first ever run |
| 2 | **Albedo** (whitening) | Purification | Lead + Silver | The Albedo calibration tap is introduced here |
| 3 | **Rubedo** (reddening) | The Stone | Silver + (Silver or Gold, 50/50) | One random **Catalyst** modifier |

### 3.1 Catalysts (Rubedo only, one per run, seeded in the Daily)

| Catalyst | Rule | Multiplier |
|---|---|---|
| **Haste** | The hunt is 30 s instead of 60 s | ×1.25 |
| **Purist** | Brightness and saturation sliders are locked at 0 | ×1.10 (stacks with Pure Draw) |
| **Distill** | The crop must be ≤ 10 % of the frame | ×1.20 |
| **Eclipse** | The Alchemist's Lens (color splash) is off and the meters are hidden | ×1.20 |

### 3.2 Transmute (one reroll per run)

During any hunt you can tap a target card and **Transmute** it into another color of the same tier, chosen by the seed so the Daily stays fair. The cost is ×0.85 on that brew's score. This is the safety valve for "I own nothing maroon."

---

## 4. Phase 1: Hunt (60 s)

- **Live camera**, rear-facing by default with a flip button. Desktop uses the webcam, and the hint copy changes to "hold it up to the camera".
- **Target cards** at the top show the name in big type, a painterly swatch, an element icon and a tier sigil (Lead, Silver or Gold).
- **Alchemist's Lens** (SHOULD, high priority): the live preview is shown **desaturated**, and only pixels close to either target **bloom back into color**. Close-ish pixels get a faint tint and near-perfect ones get full color plus shimmer. Each target also gets its own pattern overlay (A is diagonal hatching, B is dots) so color-blind players can tell which is which. This is the signature visual *and* the main feedback loop: sweep a grey world and watch things light up.
- **Divining meters**: two small flasks fill in **5 coarse steps** (cold, cool, warm, hot, boiling) to show the best live match for each target. They never show exact numbers, so judging the shot is still the player's call.
- **Shutter**: a large round button, bottom center, in the thumb zone. On desktop, Space works too. After a shot you see a 1-second freeze with the meters, then **Brew this** or **Retake**. The timer keeps running during retakes, and the last kept shot is used.
- **Auto-capture at 0 s**: "The flask seals itself." You can never end up with nothing.
- **Dark-scene warning**: if the average frame lightness is very low, show "Too dark for alchemy. Turn on a light."
- **Rotating tips**: "Shoot wide, crop later." "Daylight is the purest reagent." "Tilt shiny things to kill the glare." "Don't fill the whole frame with one color: the camera will fight you." The last one is true: auto white balance and auto exposure try to neutralize a frame that's all one color. See ANALYSIS §3.1.

---

## 5. Phase 2: Brew (edit)

Untimed, but designed to take 10–20 seconds.

- **Crop**: drag to move, pinch or drag handles to resize, free aspect ratio, double-tap to reset.
  - **Minimum crop: 1 % of the frame area, and each side at least 5 % of the short side.** You can't crop to a single pixel.
- **Brightness**: exposure from −1.0 to +1.0 EV, applied in linear light.
- **Saturation**: a chroma multiplier ×(1+s) for s from −0.5 to +0.6, applied in OKLCh so hue and lightness are preserved.
  - Neither slider can rotate hue. Brightness and saturation fix exactly what light and exposure ruin (lightness and dullness). The **hue has to come from the real world.**
  - Both sliders **snap to 0** within ±3 % so returning to Pure Draw is easy.
- **Albedo tap (calibrate light)** (SHOULD): "Tap something white or grey." The tapped patch becomes the white reference for a chromatic-adaptation correction. It's **free** (no purity cost) but guarded:
  - The patch must be plausibly neutral (OKLab L ≥ 0.45 and C ≤ 0.08), otherwise you get "That's not white enough."
  - The correction gains are clamped (×0.6 to ×1.6 per channel).
- **Live assay preview**: two **loupe markers** sit on the photo where the game currently finds each color. Each target has an accuracy bar, and you see the live factors (Concentration ×, Purity ×) and an estimated score. Cropping becomes a visible optimization game: a tighter crop raises the multiplier, but crop away the best teal patch and the bar drops.
- **Confirm** moves on to the Assay.

---

## 6. Phase 3: Assay (scoring reveal), about 6 s, skippable

1. The photo drains to grayscale while a scanning beam sweeps it, with a ticking sound.
2. **Loupe A** zooms into the best patch and shows *target* vs *yours* side by side. ΔE counts down, the accuracy bar fills, and the **grade stamp** slams in (with a haptic on Android).
3. Loupe B does the same.
4. A **receipt** tallies line by line, like an apothecary's bill: match → ×rarity → ×concentration → ×purity → ×catalyst → +quicksilver → named bonuses. The numbers roll up.
5. The **flask fills**: the two found colors swirl together (blended in OKLab) and the **potion name** appears.
6. A **hint line** for improvement is generated from the error components (§8.8), for example *"Mustard: too dull. Try daylight."*

---

## 7. Phase 4: Potion and run summary

- **Potion name** = `<Grade> of <Virtue A> & <Virtue B>`, for example **Essence of Tide & Courage** (Teal + Mustard). If the pair is a *Famous Formula* (§11.2), its proper name is used instead: **Essence: Mermaid's Draught**.
- **Run summary** ("The Magnum Opus"):
  - A big question in lowercase: *is your life full of colors?*
  - The band answer slams in: **GRAYSCALE / SEPIA / PASTEL / VIVID / TECHNICOLOR**, or **FULL SPECTRUM** if you earned the Philosopher's Stone.
  - A spectrum strip of the **6 colors you actually found** (not the targets).
  - The 3 potions, the total, the rank and percentile (Daily), new Grimoire pages, and the streak.
  - Buttons: **Share**, **Brew again** (one tap, camera still warm), **Grimoire**, **Leaderboard**.
  - After the Daily, a tomorrow teaser: *"Tomorrow's Nigredo calls for something from the Tide…"*

---

## 8. Scoring specification (single source of truth)

All math lives in one module (see CLAUDE.md). The live Lens, the Brew preview, the Assay, the pair-dealing rules, the server-side leaderboard check and the tests all call **the same functions**.

### 8.1 Capture → "plate"

1. On shutter, grab **4 consecutive video frames** (about 130 ms) and average them **in linear RGB**. This is temporal denoising and is cheap.
2. Downscale to a **working plate** with a short side of 480 px. Keep a display-size copy for the UI.
3. The canvas context is `{ colorSpace: 'srgb', willReadFrequently: true }`.

### 8.2 Free automatic light correction ("Lens of Truth")

- Estimate the illuminant on the **full, uncropped plate** with **Shades-of-Gray** (Minkowski p = 6) in linear RGB.
  - Exclude clipped pixels (any channel ≥ 0.98) and very dark pixels (L < 0.08).
- Convert the estimate into a von Kries / Bradford-style adaptation toward D65 and apply it at **60 % strength** (partial adaptation, like human vision). Clamp the gains to ×0.7 to ×1.4.
- This produces a **corrected plate**. Scoring evaluates **both raw and corrected**, and per color **the better one wins**. The receipt notes "light-corrected" when the corrected plate was used.
- If the player did an Albedo tap, the tap's correction replaces the automatic one.

### 8.3 Drops (the game's "pixel")

- The crop is divided into a grid of **drops**: square cells whose side is **1.5 % of the plate's short side** (about 7 px at 480). The size is relative, so it behaves the same on any camera resolution.
- Drop color = **mean in linear RGB → OKLab**.
- A drop is **rejected** (not a candidate) if:
  - more than 25 % of its pixels are clipped (stops specular highlights and blown-out false colors),
  - its mean L < 0.06 (noise floor), or
  - its **non-uniformity** (√(σ²L + σ²a + σ²b) in OKLab) is > 0.04. Edges between two colors blend into fake in-between colors (red next to blue looks purple), and this rule stops that, along with heavy texture.
- "1 drop of each color is enough" is the player's rule of thumb, matching the original concept.

### 8.4 Distance: ΔE_CA ("Colorchemy distance")

Computed in **OKLCh** (polar OKLab). For target T = (L₁, C₁, h₁) and sample S = (L₂, C₂, h₂):

```
ΔL  = L₂ − L₁
ΔC  = C₂ − C₁
Δh  = shortest angle between h₁ and h₂
ΔH  = 2·√(C₁·C₂)·sin(Δh / 2)
w_C = 0.75 if C₂ < C₁ (sample duller than target) else 1.0

ΔE_CA = √( (0.5·ΔL)² + (w_C·ΔC)² + ΔH² )
```

Why:

- **Lightness counts half.** Auto-exposure shifts lightness constantly, and people still call it "teal". This follows the textile industry's CMC 2:1 acceptability idea.
- **Being duller is forgiven a little.** Cameras and indoor light lose chroma.
- **Hue counts fully.** Hue is the name.
- Near-neutral targets like Charcoal work without special cases, because ΔH shrinks as chroma approaches 0.

Each color may carry a tolerance multiplier `tol` (default 1.0, see §10): `d = ΔE_CA / tol`.

### 8.5 Accuracy curve (0–100)

```
acc(d) = 100                                if d ≤ 0.03   ("core zone": full marks)
       = 100 · exp(−((d − 0.03) / 0.07)²)   otherwise
acc    = max(acc, 5) if at least one valid drop exists
```

| d | 0.03 | 0.04 | 0.05 | 0.06 | 0.07 | 0.08 | 0.10 | 0.12 | 0.15 |
|---|---|---|---|---|---|---|---|---|---|
| acc | 100 | 98 | 92 | 83 | 72 | 60 | 37 | 19 | 5 |

Sanity check (computed): a teal object under moderately warm light (hue +15°, chroma −0.02, L −0.08) lands at d ≈ 0.049, so **acc ≈ 93 with no edits and before auto-correction**. Under strong warm light (hue +30°, chroma −0.04, L −0.12), d ≈ 0.080 and acc ≈ 60; the auto-correction or the Albedo tap should recover most of that. **The teal cup wins, or nearly wins, without touching a slider.**

For each target, pick the valid drop **inside the crop** with the lowest d, evaluated on the raw and corrected plates **after** the player's edits. That gives `accA` and `accB`. Also compute the same values with edits set to zero (`accA₀`, `accB₀`) for the Fool's Gold check.

### 8.6 Per-color grades

| Grade | acc | Krillion analogue |
|---|---|---|
| **Quintessence** | ≥ 95, *and* brew Purity ≥ 0.95 | One in a Krillion |
| **Essence** | 80–94 | Deep Cut |
| **Elixir** | 60–79 | Rare |
| **Tincture** | 40–59 | Schooler |
| **Murk** | 20–39 | Plankton |
| **Sludge** | < 20 | (miss) |
| **Fool's Gold** (label) | edits raised acc by ≥ 20 (acc − acc₀ ≥ 20) | Too Clever |

Fool's Gold doesn't change the points (Purity already charges for edits). It replaces the grade label, can't count toward the Philosopher's Stone, and doesn't save the swatch into your Grimoire.

### 8.7 Brew score

```
match         = √(accA · accB)                     geometric mean: you must find BOTH
rarity        = mean(tierMult(A), tierMult(B))     Lead 1.00 · Silver 1.15 · Gold 1.30
concentration = 1 + 0.5 · clamp( log10(1/f) / 2, 0, 1 )
                f = crop area / plate area, f ≥ 0.01  →  1.00 (full frame) … 1.50 (1 % crop)
purity        = max(0.5, 1 − 0.25·|EV| − 0.25·|s|/0.6)
                = 1.10 exactly when EV = 0 and s = 0   ("Pure Draw")
catalyst      = Catalyst multiplier (Rubedo) or 1
transmute     = 0.85 if a target in this brew was transmuted, else 1

brewScore = round(10 · match · rarity · concentration · purity · catalyst · transmute)
          + quicksilver + namedBonuses
quicksilver = 2 · floor(seconds remaining when the kept shot was taken)   (max 120)
```

Concentration reference values: f = 1 → ×1.00, 0.25 → ×1.15, 0.10 → ×1.25, 0.04 → ×1.35, 0.01 → ×1.50.

**Why the crop can't be degenerate:** the bonus is logarithmic and **capped**, there's a hard floor (1 % of the area, 5 % of each side), and both colors must be found *inside* the crop. The only way to reach ×1.5 is to photograph the two colors **touching** and crop the seam. That's a skill ("put the teal mug on the mustard scarf"), not an exploit. Crop away a color and the geometric mean collapses.

**Why edits can't fake a color:** neither slider can change hue. Saturation is a *multiplier*, so a grey surface stays grey. Each edit costs up to 25 % of the score, and big gains get the Fool's Gold label.

### 8.8 Assay hints (also accessibility)

These come from the error components of the winning drop for each color:

- ΔL > +0.06 → "too light". ΔL < −0.06 → "too dark".
- C₂ < C₁ − 0.03 → "too dull". C₂ > C₁ + 0.04 → "too vivid".
- Δh > 8° → "too <neighbor hue word>". The hue word comes from OKLCh hue sectors: red, orange, yellow, green, cyan, blue, purple, pink.

### 8.9 Named bonuses

| Name | Trigger | Effect |
|---|---|---|
| **Quicksilver** | Always on: seconds remaining at the kept shot | +2 per second (label shown when ≥ 40 s remain) |
| **Pure Draw** | No brightness or saturation change | Purity ×1.10 instead of ×1.00 |
| **Philosopher's Pinch** | Crop f ≤ 0.04 *and* both colors ≥ Elixir | +50 |
| **Equilibrium** | \|accA − accB\| ≤ 5 *and* both ≥ 80 | +25 |
| **Philosopher's Stone** | All 6 colors in a run ≥ Essence (no Fool's Gold) | +300 to the run, gold card frame, band becomes **FULL SPECTRUM** |
| **Prima Materia** | First time a color is ever found at ≥ Elixir on this device | **No points** (keeps the leaderboard fair). Unlocks a Grimoire page with your swatch and plays a fanfare |
| **Ouroboros** | Daily Rite streak of N days | Cosmetic only (a flame on the share card) |
| **Transmutation tax** | Used a reroll in this brew | ×0.85 |

### 8.10 Run total and bands ("is your life full of colors?")

`runTotal = Σ brewScore + PhilosophersStone`

| Band | Run total |
|---|---|
| **GRAYSCALE** | < 1 500 |
| **SEPIA** | 1 500 – 2 499 |
| **PASTEL** | 2 500 – 3 499 |
| **VIVID** | 3 500 – 4 499 |
| **TECHNICOLOR** | ≥ 4 500 |
| **FULL SPECTRUM** | Philosopher's Stone earned (any total) |

The rough ceiling is about 6 800, and a "decent" run is about 3 500. Retune the bands after the first 50 real runs so the distribution peaks around PASTEL/VIVID.

### 8.11 Worked example (Albedo: Teal [Silver] + Banana Yellow [Lead])

- The teal mug gives accTeal = 92 (Essence). The banana gives accBanana = 78 (Elixir).
- match = √(92·78) = **84.7** → brew grade Essence
- rarity = (1.15 + 1.00)/2 = **1.075**
- crop f = 0.06 → concentration = 1 + 0.5·(log10(16.7)/2) = **1.306**
- edits EV +0.2, s +0.1 → purity = 1 − 0.05 − 0.042 = **0.908**
- 10 · 84.7 · 1.075 · 1.306 · 0.908 = **1 080**
- Shot kept with 23 s left → Quicksilver **+46**. No Pinch (f > 0.04), no Equilibrium (gap of 14).
- **Brew score 1 126.** The potion is **"Essence of Tide & Mirth"**.

### 8.12 Tuning constants (all live in one `tuning` file)

| Constant | Start value |
|---|---|
| Hunt length / Haste | 60 s / 30 s |
| Frames averaged at capture | 4 |
| Working plate short side | 480 px |
| Drop size | 1.5 % of short side |
| Drop rejection: clipped share, min L, max non-uniformity | 25 %, 0.06, 0.04 |
| ΔE weights: L, C (duller), C (more vivid), H | 0.5, 0.75, 1.0, 1.0 |
| Accuracy core, sigma, floor | 0.03, 0.07, 5 |
| Auto-WB: p, strength, gain clamp | 6, 0.6, [0.7, 1.4] |
| Albedo tap: L min, C max, gain clamp | 0.45, 0.08, [0.6, 1.6] |
| Crop floor (area, side) | 1 %, 5 % |
| Concentration max | ×1.5 |
| EV range / saturation range | ±1.0 / −0.5…+0.6 |
| Purity slope per slider / floor / Pure Draw | 0.25 / 0.5 / ×1.10 |
| Tier multipliers | 1.00 / 1.15 / 1.30 |
| Quicksilver | 2 pts/s |
| Fool's Gold threshold | +20 acc |
| Lens bloom thresholds (live) | faint ≥ 50, full ≥ 85 acc |

---

## 9. Lighting strategy (player-facing summary)

The technical background is in ANALYSIS §3. What the player experiences:

1. **It mostly just works.** Perceptual scoring with a lenient core zone, lightness weighted at half, and duller colors forgiven means a real teal object scores high without edits.
2. **Free automatic correction** (§8.2), best of raw and corrected. It can only help.
3. **Free manual correction**: the Albedo tap ("tap something white"). This is the "noise cancellation for light" idea, and it's a real, well-studied technique (white-patch chromatic adaptation).
4. **Paid fixes**: the brightness and saturation sliders, for exposure and dullness problems the auto-correction can't fix. They cost Purity.
5. **Feedback that teaches**: the Lens shows what the camera sees as close, the Assay hints say *how* you missed ("too dark", "too yellow"), and the tips teach "shoot wide, crop later."
6. **Fair targets**: target colors are tuned to how real objects photograph (§10.1), not to monitor-perfect hex values.

---

## 10. The Color Codex (55 named colors)

The names come from colors people actually say, anchored to the **xkcd color survey** (about 222 000 participants and 954 named colors, CC0; see ANALYSIS §1.4). The *anchor* hex is xkcd's value for the name. The *target* is a **photo-tamed** starting value: lightness clamped to 0.24–0.92 and chroma capped at 0.20 in OKLCh, then gamut-mapped. Real objects photographed by phones rarely reach monitor-pure extremes like xkcd's lime green #89fe05. **Before launch, photograph 3–5 real objects per color under daylight and indoor light and adjust the targets.**

Tiers: **Lead** (common in most homes), **Silver** (findable with some looking), **Gold** (rare or tricky).
Elements: **Fire, Earth, Sun, Verdance, Tide, Sky, Bloom, Aether**. These are used for UI grouping, pair rules and potion flavor.

| # | Name | Element | Tier | Anchor (xkcd) | Target | OKLCh L / C / h° | Virtue | Notes |
|---|---|---|---|---|---|---|---|---|
| 1 | Cherry Red | Fire | Lead | #f7022a | #e44142 | 0.62 / 0.200 / 25 | Ardor | Tamed target sits near Coral, so never pair them |
| 2 | Brick Red | Fire | Silver | #8f1402 | #8f1402 | 0.42 / 0.159 / 31 | Hearth | |
| 3 | Maroon | Fire | Silver | #650021 | #650021 | 0.32 / 0.129 / 12 | Vintage | dark |
| 4 | Raspberry | Fire | Gold | #b00149 | #b00149 | 0.49 / 0.194 / 8 | Bramble | |
| 5 | Coral | Fire | Silver | #fc5a50 | #fc5a50 | 0.68 / 0.199 / 27 | Reef | |
| 6 | Salmon | Fire | Silver | #ff796c | #ff796c | 0.73 / 0.166 / 27 | Upstream | |
| 7 | Tangerine | Fire | Lead | #ff9408 | #ff9408 | 0.76 / 0.175 / 62 | Zest | Twin of Pumpkin, so never pair them |
| 8 | Pumpkin | Fire | Lead | #e17701 | #e17701 | 0.68 / 0.165 / 56 | Harvest | Seasonal (late October) |
| 9 | Burnt Orange | Fire | Silver | #c04e01 | #c04e01 | 0.57 / 0.162 / 45 | Ember | |
| 10 | Peach | Fire | Silver | #ffb07c | #ffb07c | 0.82 / 0.115 / 54 | Orchard | |
| 11 | Terracotta | Earth | Silver | #ca6641 | #ca6641 | 0.62 / 0.137 / 40 | Clay | Plant pots |
| 12 | Caramel | Earth | Silver | #af6f09 | #af6f09 | 0.60 / 0.127 / 69 | Toffee | |
| 13 | Chocolate | Earth | Lead | #3d1c02 | #3d1c02 | 0.27 / 0.064 / 55 | Comfort | dark, tol ×1.15 |
| 14 | Tan | Earth | Lead | #d1b26f | #d1b26f | 0.78 / 0.093 / 85 | Dune | Cardboard, wood |
| 15 | Beige | Earth | Lead | #e6daa6 | #e6daa6 | 0.89 / 0.069 / 97 | Linen | |
| 16 | Khaki | Earth | Silver | #aaa662 | #aaa662 | 0.71 / 0.090 / 106 | Expedition | |
| 17 | Charcoal | Earth | Lead | #343837 | #343837 | 0.34 / 0.006 / — | Soot | Neutral, dark |
| 18 | Banana Yellow | Sun | Lead | #fafe4b | #ebef35 | 0.92 / 0.189 / 111 | Mirth | |
| 19 | Sunflower Yellow | Sun | Lead | #ffda03 | #ffda03 | 0.89 / 0.184 / 97 | Noon | |
| 20 | Mustard | Sun | Silver | #ceb301 | #ceb301 | 0.77 / 0.158 / 98 | Courage | |
| 21 | Ochre | Sun | Gold | #bf9005 | #bf9005 | 0.68 / 0.138 / 85 | Ancients | |
| 22 | Lime Green | Verdance | Silver | #89fe05 | #9ff865 | 0.89 / 0.200 / 135 | Fizz | Heavily tamed, so verify |
| 23 | Grass Green | Verdance | Lead | #3f9b0b | #3f9b0b | 0.61 / 0.185 / 138 | Meadow | |
| 24 | Forest Green | Verdance | Silver | #06470c | #06470c | 0.35 / 0.108 / 144 | Deepwood | dark |
| 25 | Emerald | Verdance | Silver | #01a049 | #01a049 | 0.62 / 0.170 / 150 | Envy | |
| 26 | Mint | Verdance | Silver | #9ffeb0 | #9ffeb0 | 0.92 / 0.140 / 149 | Breeze | Real mint objects are paler, so verify |
| 27 | Sage | Verdance | Gold | #87ae73 | #87ae73 | 0.71 / 0.093 / 135 | Wisdom | |
| 28 | Olive | Verdance | Silver | #6e750e | #6e750e | 0.54 / 0.116 / 114 | Peace | |
| 29 | Avocado | Verdance | Silver | #90b134 | #90b134 | 0.71 / 0.153 / 123 | Brunch | |
| 30 | Jade | Tide | Gold | #1fa774 | #1fa774 | 0.65 / 0.135 / 162 | Serenity | |
| 31 | Teal | Tide | Silver | #029386 | #029386 | 0.60 / 0.105 / 184 | Tide | The flagship example |
| 32 | Turquoise | Tide | Silver | #06c2ac | #06c2ac | 0.73 / 0.131 / 181 | Lagoon | |
| 33 | Aqua | Tide | Gold | #13eac9 | #13eac9 | 0.84 / 0.153 / 177 | Shallows | |
| 34 | Petrol | Tide | Gold | #005f6a | #005f6a | 0.44 / 0.076 / 208 | Depths | |
| 35 | Sky Blue | Sky | Lead | #75bbfd | #75bbfd | 0.77 / 0.119 / 248 | Daydream | Twin of Baby Blue, so never pair them |
| 36 | Baby Blue | Sky | Lead | #a2cffe | #a2cffe | 0.84 / 0.081 / 250 | Lullaby | |
| 37 | Cerulean | Sky | Silver | #0485d1 | #0485d1 | 0.60 / 0.149 / 245 | Horizon | |
| 38 | Denim | Sky | Lead | #3b638c | #3b638c | 0.49 / 0.080 / 250 | Grit | Jeans: the tutorial color |
| 39 | Cobalt | Sky | Silver | #1e488f | #1e488f | 0.41 / 0.127 / 260 | Resolve | |
| 40 | Royal Blue | Sky | Silver | #0504aa | #051c9c | 0.34 / 0.200 / 265 | Crown | dark |
| 41 | Navy | Sky | Lead | #01153e | #051c46 | 0.24 / 0.084 / 260 | Midnight | dark, tol ×1.15 |
| 42 | Steel Blue | Sky | Gold | #5a7d9a | #5a7d9a | 0.57 / 0.060 / 244 | Mettle | |
| 43 | Hot Pink | Bloom | Silver | #ff028d | #e84b8d | 0.65 / 0.200 / 358 | Neon | Fluorescent objects exceed sRGB |
| 44 | Bubblegum Pink | Bloom | Silver | #fe83cc | #fe83cc | 0.77 / 0.170 / 345 | Mischief | |
| 45 | Baby Pink | Bloom | Lead | #ffb7ce | #ffb7ce | 0.85 / 0.088 / 358 | Blush | |
| 46 | Magenta | Bloom | Silver | #c20078 | #bb2177 | 0.53 / 0.200 / 353 | Fervor | |
| 47 | Mauve | Bloom | Gold | #ae7181 | #ae7181 | 0.62 / 0.080 / 3 | Nostalgia | |
| 48 | Orchid | Bloom | Gold | #c875c4 | #c875c4 | 0.68 / 0.145 / 329 | Allure | |
| 49 | Periwinkle | Aether | Gold | #8e82fe | #8e82fe | 0.67 / 0.178 / 285 | Whimsy | tol ×1.2 (camera violet issue) |
| 50 | Lavender | Aether | Silver | #c79fef | #c79fef | 0.77 / 0.119 / 307 | Calm | |
| 51 | Violet | Aether | Gold | #9a0eea | #8e45ca | 0.55 / 0.200 / 306 | Twilight | tol ×1.3. Keep out of the Daily until tested |
| 52 | Indigo | Aether | Gold | #380282 | #380282 | 0.32 / 0.177 / 290 | Intuition | tol ×1.2, dark |
| 53 | Plum | Aether | Gold | #580f41 | #580f41 | 0.32 / 0.118 / 344 | Dusk | dark |
| 54 | Eggplant | Aether | Gold | #380835 | #380835 | 0.25 / 0.095 / 331 | Gloom | dark, tol ×1.15. Also a real eggplant |
| 55 | Grape | Aether | Gold | #6c3461 | #6c3461 | 0.42 / 0.100 / 335 | Revelry | |

Totals: Lead 15, Silver 25, Gold 15. The following were **cut as near-duplicates** under ΔE_CA (they'd be < 0.035 from a kept color): Tomato, Dusty Rose, Rust, Coffee, Cream, Butter Yellow, Chartreuse, Kelly Green, Cornflower, Slate, Taupe, Moss Green. They're good candidates for a future "synonyms accepted" feature or later content.

### 10.1 Why "photo-tamed" targets

xkcd values are the names people give to **colors on a monitor**. Phone photos of real objects are duller and rarely hit the gamut edges. A target of #89fe05 would make "lime green" nearly unwinnable. Taming plus the per-color `tol` gives the "teal cup scores max" feel. **The calibration pass (photograph real objects) is a MUST.** It also produces the fixture photos for automated tests.

### 10.2 Pair-dealing rules

All pairs are dealt by a seeded RNG (the Daily seed is the UTC date). A pair (A, B) is legal only if:

1. **ΔE_CA(A, B) ≥ 0.15**, so one object can't satisfy both (acc of A's target on B ≤ 5). Computed: 1 147 of the 1 485 possible pairs pass.
2. **Different elements.**
3. **At most one dark color** (target L < 0.36: Maroon, Chocolate, Charcoal, Forest Green, Royal Blue, Navy, Indigo, Plum, Eggplant). Dim rooms kill dark colors.
4. **The tier ladder** for the stage is respected (Nigredo L+L, Albedo L+S, Rubedo S+S or S+G).
5. **No color repeats within a run.** The Daily also avoids colors used in the previous 2 days.
6. **Daily excludes Violet** until device testing says it's fair.
7. **Famous Formulae** (§11.2) get ×3 weight when legal.
8. *(COULD)* Seasonal weight: late October boosts Pumpkin, Charcoal, Plum and Eggplant.

The **first-ever brew** (tutorial) is fixed: **Denim + Tan** (jeans plus cardboard or wood). Nearly every home has both, and it's a Famous Formula.

---

## 11. Potions

### 11.1 Generated names

`<Grade> of <Virtue A> & <Virtue B>` uses the virtues from the Codex. The brew grade is the grade of `match`, and Quintessence requires both colors to be Quintessence.

Examples: *Elixir of Midnight & Courage* (Navy + Mustard), *Tincture of Harvest & Soot* (Pumpkin + Charcoal), *Sludge of Wisdom & Envy* (better luck next time).

### 11.2 Famous Formulae (hand-named pairs, collectible)

| Pair | Name |
|---|---|
| Teal + Coral | Mermaid's Draught |
| Navy + Mustard | Midnight Courage |
| Forest Green + Cherry Red | Hollyberry Cordial |
| Pumpkin + Charcoal | Hallow's Brew |
| Lavender + Mint | Dreamer's Tonic |
| Sky Blue + Banana Yellow | Summer Noon |
| Baby Pink + Sky Blue | Cradle Song |
| Olive + Terracotta | Mediterranean Tincture |
| Denim + Tan | Wanderer's Ration |
| Royal Blue + Sunflower Yellow | Starry Night |
| Eggplant + Lime Green | Witch's Garden |
| Chocolate + Mint | After-Dinner Elixir |

Shown as **"<Grade>: <Formula name>"**. Each formula has a Grimoire page. All 12 pass rules 1–3 with the current targets (the closest is Olive + Terracotta at ΔE_CA 0.158, so recheck after tuning). A formula can only appear in the stage whose tier pattern it fits. Lead+Lead pairs go in Nigredo: Pumpkin+Charcoal, Sky Blue+Banana Yellow, Baby Pink+Sky Blue, Denim+Tan. Lead+Silver pairs go in Albedo: Navy+Mustard, Forest Green+Cherry Red, Royal Blue+Sunflower Yellow, Chocolate+Mint. Silver+Silver and Silver+Gold pairs go in Rubedo: Teal+Coral, Lavender+Mint, Olive+Terracotta, Eggplant+Lime Green. Plum+Sage and Baby Pink+Baby Blue were rejected (Gold+Gold, and ΔE_CA 0.138 < 0.15).

### 11.3 Magnum Opus (run potion)

The run produces one final potion named after the band, for example **"Vivid Panacea"** or **"Grayscale Dregs"**. It appears on the share card.

---

## 12. Modes

| Mode | Priority | Description |
|---|---|---|
| **Daily Rite** | MUST | Same 3 pairs, Catalyst and Transmute alternates for everyone. Resets at 00:00 UTC. The first completed run per day is **ranked**; replays are practice. Numbered (#1, #2…) from launch day. |
| **Free Brew** | MUST | Random seed, unlimited. Deals favor colors you haven't discovered yet (×2 weight). Unranked, or a separate "best ever" board. |
| **Practice Plates** (no-camera) | MUST | For players or judges who deny the camera or have none. Brew and Assay a set of about 12 pre-shot photos, each tagged with pairs known to be present. Unranked. The whole loop minus the hunt. |
| **Quicksilver Rush** | COULD | Pure arcade: 90 s total. Targets appear one at a time, and the live Lens must hit ≥ 80 acc and hold for 0.5 s to "catch" one. Each catch adds 5 s and a new target. No photo, no brew. A spiritual cousin of Google's Emoji Scavenger Hunt. |

---

## 13. Retention design (the jam rewards retention)

**Session level ("one more run")**

1. **10 seconds to camera.** One tap on the title starts the Daily, and the camera pre-prompt appears exactly once.
2. **A run is about 4–5 minutes**, short enough to replay.
3. **Brew Again is one tap.** The camera stream stays warm and a new seed is dealt immediately.
4. **Near-miss messaging**: "Mustard was 3 points from Essence: too dull."
5. **Personal bests per color** ("Your best Teal: 97"), shown on deal: "beat your 81".
6. **Assay theater** is the payoff moment and **skippable** for repeat runs.

**Day level (come back tomorrow)**

7. **Daily Rite**: the same colors for everyone, with a countdown to the next one.
8. **Tomorrow teaser**: reveal tomorrow's Nigredo *element* (not the color).
9. **Ouroboros streak**: consecutive Daily days, shown on the share card.
10. **Daily leaderboard**: top 50, your rank and percentile ("better than 72 % of alchemists today").

**Long level (collection)**

11. **Grimoire**: 55 color flasks plus 12 Famous Formula pages. Each found color stores **your actual swatch** (a 32×32 thumbnail of the best drop's neighborhood, kept locally) and your best accuracy. Undiscovered flasks are glass outlines in grayscale. The shelf **literally fills with the colors of your life.**
12. Completion percent per element. Free Brew steers toward undiscovered colors.

**Social**

13. **Share text** (Wordle-style, spoiler-free). The squares are the nearest of the 9 colored-square emoji to **the color you found**:

```
Colorchemy · Daily Rite #12
is your life full of colors?  VIVID  3 842
🟦🟨 Essence · Elixir
🟩🟥 Elixir · Tincture
🟪🟧 Quintessence · Essence
<url>
```

14. **Share image card** (SHOULD): a portrait PNG made locally on a canvas (title, band, 6 found swatches, potion names), shared through the Web Share API when files are supported, otherwise downloaded. **No photo on the card by default** (privacy).

---

## 14. Fairness, anti-cheat and privacy

| Threat | Stance |
|---|---|
| Gallery upload | Not possible: `getUserMedia` only, with no file input anywhere |
| Huge crop / tiny crop | Handled by the floor, log cap, both-colors-in-crop rule and the geometric mean (§8.7) |
| Editing to fake a color | Handled: no hue control, saturation is a multiplier, Purity cost, Fool's Gold (§8.6) |
| Photographing a screen or printed swatch of the target | **Can't be fully prevented.** Mitigations: show names and painterly swatches (no hex codes in the UI), leaderboard entries show the 6 *found* swatches, and photos are opt-in for top entries (COULD). *(COULD)* A heuristic for moiré or emissive "too perfect" patches that quietly unranks the run. Accept some cheating; it's a jam. |
| Paint-chip books, crayon boxes | In the spirit of the game, so allowed. Accuracy still decides. |
| Virtual webcams (desktop) | Can't prevent, so accept it |
| Client-side score tampering | Submit **evidence** (target ids, found OKLab values, f, EV, s, t_remaining, flags, seed), and the server **recomputes** the score with the same scoring module. Rate-limit, one ranked Daily per device id. |
| Privacy | **Photos never leave the device by default.** Only numbers and found colors are submitted. Say so on the camera pre-prompt: *"Your photos stay on your phone."* |

---

## 15. Accessibility

- **Names are always shown with swatches.** Colors are never identified by color alone.
- **Lens patterns**: target A is hatching, target B is dots, so CVD players can see which target is lit. The meters also have text levels (cold → boiling).
- **Dowsing tone** (SHOULD): an optional rising pitch as the live match improves, for low-vision and CVD players.
- **Directional hints** in words ("too dark", "too yellow").
- Grayscale UI with high contrast (body text ≥ 16 px, tap targets ≥ 48 px). Success and failure are shown with **shape, icon and wording**, never red or green alone. This also follows "color is earned".
- `prefers-reduced-motion`: no shake, crossfades instead of ink-bleed, and the Assay shortened.
- One-handed portrait use: primary actions sit in the bottom third.
- Haptics through `navigator.vibrate` where supported (Android). The design never relies on them.
- Honest note: color-vision deficiency makes *hunting* harder, but the camera does the judging, and the Lens, hints and names make it playable.

---

## 16. Visual direction

### 16.1 Concept: "Ink & Elixir"

A **monochrome alchemist's world**: engraving and woodcut line art, halftone shading, paper grain and graphite. **Nothing in the chrome is chromatic.** Color appears only as:

1. the two **target swatches** (as liquid in small vials),
2. **live blooms** in the Lens,
3. **colors you have found** (flasks, the spectrum strip, the share card).

As a run goes on, a thin **spectrum bar** at the top of the screen gains one band per found color. On the summary screen the whole background **floods** with a soft mesh gradient of your 6 colors. That moment is the tagline made visible. The Grimoire shelf works the same way on the scale of days.

### 16.2 Palette tokens (grayscale + 2 dynamic slots)

```
--ink    #0F0F12   app background (dark lab: hunt/brew/assay)
--soot   #1A1A1F   panels
--ash    #2A2A31   borders, inactive
--smoke  #6E6E78   secondary text
--fog    #A9A9B2   disabled, hairlines
--bone   #EDEAE3   primary text on dark
--paper  #F7F5F0   paper surfaces (Grimoire, share card, landing)
--ing-a  dynamic   current target A (OKLab blended for UI)
--ing-b  dynamic   current target B
```

The hunt, brew and assay use the dark "night lab" theme, so the camera pops and screen glare stays low. The Grimoire, summary and share card use **paper**. There are no brand accent colors: buttons are bone on ink or ink on paper, with thick 2 px outlines.

### 16.3 Typography (Google Fonts)

- **Display: Fraunces** (variable soft serif with "wonky" alternates, so it feels like an old grimoire without being a costume font). Used for the logo, grades, potion names and the tagline (lowercase italic).
- **UI: Inter.** Buttons, labels, body text.
- **Readouts: JetBrains Mono.** ΔE, accuracy and the receipt numbers (tabular figures).
- Grade stamps are Fraunces Black in all caps, letter-spaced and rotated −4°, like a rubber stamp.

### 16.4 Logo and key art

- **COLOR / CHEMY** (two lines), where both **O**s in "COLOR" are round-bottom flasks. On the title screen they're **filled with the last two colors you found** (a living logo). For a first-time player they're empty glass.
- The tagline sits under it: *is your life full of colors?* The question mark's dot is a single drop that cycles through the daily colors.

### 16.5 Motion and juice

- **Screen transitions**: an ink-bleed wipe in grayscale.
- **Color bloom**: when a color is confirmed it radiates out from the loupe as a saturating ripple.
- **Liquids**: flask fill with a wobbling meniscus (CSS or canvas sine wave) and the two colors swirling (a small canvas particle swirl).
- **Stamps**: slam with overshoot, a 4 px screen shake (off under reduced motion) and a haptic tick.
- **Receipt**: numbers roll up, multipliers "chunk" in with a glass clink, and the total gets a heavier thunk.
- **Quintessence**: a brief full-screen color flash of that color, a choir "ahh" and gold dust particles.

### 16.6 Screens (mobile portrait, about 360×780 baseline)

**Title**

```
┌──────────────────────────────┐
│ ☾                     ⚙  ?   │
│                              │
│      C(●)L(●)R               │  ← flask "O"s hold your last 2 colors
│      CHEMY                   │
│   is your life full of       │
│        colors?               │
│                              │
│   DAILY RITE #12  · 14:02:11 │
│   ▢ ▢   ▢ ▢   ▢ ▢   (veiled) │
│ ┌──────────────────────────┐ │
│ │      BEGIN THE RITE      │ │  ← primary, thumb zone
│ └──────────────────────────┘ │
│   free brew  ·  grimoire     │
│   leaderboard ·  streak 4    │
└──────────────────────────────┘
```

**Camera pre-prompt** (shown once, before the browser prompt)

```
┌──────────────────────────────┐
│     (engraved eye + flask)    │
│  The Alchemist needs eyes.   │
│  We use your camera to find  │
│  colors. Photos stay on your │
│  phone. Nothing is uploaded. │
│ ┌──────────────────────────┐ │
│ │      OPEN THE EYE        │ │
│ └──────────────────────────┘ │
│  no camera? try practice     │
│  plates →                    │
└──────────────────────────────┘
```

**Hunt**

```
┌──────────────────────────────┐
│ ▔▔▔▔▔ spectrum bar ▔▔▔▔▔▔▔▔▔▔ │
│ NIGREDO 1/3          ⏱ 0:42  │
│ ┌────────────┐┌────────────┐ │
│ │(vial) TEAL ││(vial)MUSTARD│ │
│ │ Silver ▮▮▮▯▯││ Silver ▮▯▯▯▯│ │  ← coarse divining meters
│ └────────────┘└────────────┘ │
│ ┌──────────────────────────┐ │
│ │                          │ │
│ │  live camera, grayscale  │ │
│ │  teal things bloom in    │ │
│ │  color (+hatching)       │ │
│ │                          │ │
│ └──────────────────────────┘ │
│ ⟲ transmute    (  ◉  )   ⇆  │  ← shutter center, flip right
│ tip: shoot wide, crop later  │
└──────────────────────────────┘
```

**Brew**

```
┌──────────────────────────────┐
│ BREW · NIGREDO      [ASSAY ▶]│
│ ┌──────────────────────────┐ │
│ │ photo   ┌─────────┐      │ │
│ │  ◎A     │  crop   │ ◎B   │ │  ← loupe markers = where it found them
│ │         └─────────┘      │ │
│ └──────────────────────────┘ │
│ TEAL     ▮▮▮▮▯  88  essence  │
│ MUSTARD  ▮▮▮▯▯  71  elixir   │
│ concentration ×1.31          │
│ purity ×1.10  PURE DRAW      │
│ ☀ brightness  ─────●─────    │
│ ◑ saturation  ─────●─────    │
│ [ ◌ tap something white ]    │
│              est. 1 310      │
└──────────────────────────────┘
```

**Assay**

```
┌──────────────────────────────┐
│           A S S A Y          │
│ ┌──────────────────────────┐ │
│ │ (grey photo, 2 loupes)   │ │
│ └──────────────────────────┘ │
│ TEAL    target ■  yours ■    │
│   ΔE 0.048 ······ 94 ESSENCE │
│ MUSTARD target ■  yours ■    │
│   ΔE 0.068 ··· 74 ELIXIR     │
│   "a bit too dull"           │
│ ──────────────────────────── │
│ match                  83.4  │
│ × rarity 1.15  × conc 1.31   │
│ × purity 1.10                │
│ + quicksilver 46             │
│ ════════════════  1 428      │
│            [ESSENCE] (stamp) │
└──────────────────────────────┘
```

**Potion**

```
┌──────────────────────────────┐
│        (big flask, teal      │
│        + mustard swirling)   │
│   ESSENCE OF TIDE & COURAGE  │
│            +1 428            │
│ ┌──────────────────────────┐ │
│ │      NEXT: ALBEDO ▶      │ │
│ └──────────────────────────┘ │
└──────────────────────────────┘
```

**Run summary / share**

```
┌──────────────────────────────┐  (paper theme, background
│  DAILY RITE #12              │   floods with your 6 colors)
│  is your life full of        │
│  colors?                     │
│        V I V I D             │
│          3 842               │
│  ■■  Essence of Tide & ...   │
│  ■■  Elixir: Starry Night    │
│  ■■  Quintessence of ...     │
│  #37 of 412 · top 9 %        │
│  +2 grimoire pages · streak 5│
│ [ SHARE ]   [ BREW AGAIN ]   │
│ tomorrow: something of Tide… │
└──────────────────────────────┘
```

**Grimoire**: a paper bookshelf with 8 element rows. Each flask is either an empty glass outline or filled with *your* swatch. Tap a flask to see your best photo-swatch, best accuracy, date found and "found in" (optional note).

### 16.7 PC layout (≥ 1024 px, landscape)

```
┌────────────────────────────────────────────────────────────┐
│ C(●)L(●)R CHEMY        Daily Rite #12          ⏱ 0:42      │
├──────────────┬─────────────────────────────────────────────┤
│ INGREDIENTS  │                                             │
│ (vial) TEAL  │         webcam preview 16:9 (grayscale,     │
│  ▮▮▮▯▯       │         blooming color)                     │
│ (vial) MUSTARD│                                            │
│  ▮▯▯▯▯       │                                             │
│ hold it up to│                                             │
│ the camera   │                                             │
│ [SPACE] snap │                                             │
│ [R] transmute│                                             │
├──────────────┴─────────────────────────────────────────────┤
│  NIGREDO ●   ALBEDO ○   RUBEDO ○          run score 0      │
└────────────────────────────────────────────────────────────┘
```

Keyboard: Space = shutter, Enter = confirm, arrow keys nudge the crop (Shift for bigger steps), +/− resize the crop, R = transmute, Esc = back. The crop and sliders get mouse-wheel support.

### 16.8 Website and itch page

- **Landing / itch page** (paper theme): a huge lowercase hero *is your life full of colors?* over a **grayscale photo collage** of everyday objects. On hover (desktop) or scroll (mobile), circular patches **bloom into color** around the cursor or along the scroll. A single CTA: **Begin the rite**. Below that, three steps illustrated as engravings (hunt, brew, assay) and a privacy line ("photos never leave your phone").
- The itch theme uses the paper background, ink text and no accent color. Screenshots show the Lens color-splash, which is the most "what is this?" image the game has.
- Favicon and app icon: a flask with a single drop that is the color of the current day.

---

## 17. Audio direction

- **Palette**: glass, liquid, cork, paper and brass. A tactile laboratory.
- **Key SFX**: shutter (a cork-pop and camera-click hybrid), Lens bloom (a soft glass shimmer that rises with the match), meter steps (a bubble pitch ladder), last 10 seconds (pipette drips that speed up), stamp (rubber thunk plus parchment), receipt multipliers (glass clinks rising in pitch), Quintessence (a choir "ahh" and bell), Fool's Gold (a cheeky coin jingle with a dull thud).
- **Music**: a sparse celesta and harpsichord loop that **gains layers per stage**: Nigredo with low drones, Albedo with airy pads, Rubedo with warm plucks and brass. The summary gets a short fanfare whose key differs per band.
- WebAudio unlocks on the first tap. There's a mute toggle on every screen. Audio is mixed for phone speakers (no sub-bass).

---

## 18. Screen flow

```
Title ──► (first time) Camera pre-prompt ──► browser permission
  │                         │ denied / no camera
  │                         └──► Practice Plates (unranked loop)
  ├─► Daily Rite ─┐
  ├─► Free Brew ──┼─► Deal ─► Hunt ─► Brew ─► Assay ─► Potion ─┐
  │               │     ▲                                       │ ×3
  │               │     └───────────────────────────────────────┘
  │               └─► Run Summary ─► Share / Leaderboard / Grimoire
  │                                   └─► Brew Again ─► Deal …
  ├─► Grimoire
  ├─► Leaderboard (Daily top 50, your rank)
  └─► Settings (sound, haptics, reduced motion, Lens patterns, name)
```

The app stays on **one page with no URL or hash route changes** during a run (see ANALYSIS §3.4, iOS camera re-prompt).

---

## 19. Tech summary

Details, alternatives and sources are in ANALYSIS §3 and in CLAUDE.md.

- **Vite + TypeScript, plain DOM/CSS UI.** No Phaser. **Canvas2D** for capture and analysis, and a tiny **WebGL** fragment shader for the live Lens.
- **One color/scoring module** in OKLab, unit-tested against culori as an oracle.
- **getUserMedia** (rear camera, about 1280×720), one stream per session, and a secure context everywhere (HTTPS dev server or a tunnel for phone testing).
- **Hosting**: an itch.io HTML5 embed (its iframe `allow` list includes `camera`, but this must be verified on a real phone), plus a direct-URL fallback (e.g. Cloudflare Pages).
- **Leaderboard**: a Cloudflare Worker + D1 daily board that recomputes scores server-side with the shared scoring module, or LootLocker if a zero-backend option is preferred. See ANALYSIS §3.8.
- **Local persistence**: Grimoire, streak, bests and settings in localStorage, with swatches stored as tiny data URLs.

---

## 20. Jam scope

### MUST (the game exists)

- Camera hunt (60 s, shutter, retake, auto-capture), with the pre-prompt and permission handling
- Brew: crop (with floor) + brightness + saturation + **live score preview** + loupe markers
- Scoring exactly per §8 (plate, auto light correction, drops, ΔE_CA, curve, factors, grades)
- The 55-color Codex with a **photographed calibration pass**, plus the pair-dealing rules
- A 3-brew run, potion names, bands and the summary screen
- Daily Rite (UTC seed) + Free Brew
- Share **text**
- Practice Plates (no-camera fallback)
- Grayscale visual identity, mobile portrait, usable on desktop
- A basic daily leaderboard

### SHOULD (the game is good)

- The **Alchemist's Lens** (WebGL color splash with patterns) and divining meters
- The Albedo calibration tap
- The Grimoire with your swatches, personal bests and streak
- Named bonuses (Quicksilver label, Pinch, Equilibrium, Philosopher's Stone, Fool's Gold)
- Rubedo Catalysts and Transmute
- Assay theater, SFX and music
- Share **image** card
- PC layout and keyboard controls, dowsing tone

### COULD

- Quicksilver Rush mode
- Famous Formulae pages and seasonal weighting
- Opt-in photo thumbnails for top leaderboard entries
- Screen-photo heuristic
- Android exposure and white-balance lock through MediaStreamTrack constraints
- PWA install. Careful on iOS: a home-screen app has had camera re-prompt bugs.

### WON'T (this jam)

Accounts and friends, ML object recognition, gallery import, monetization, localization.

### Rough schedule (assumes a 7-day jam; for 72 h, do MUST only and merge days 1–2, 3–4 and 5–7)

| Day | Focus | Exit check |
|---|---|---|
| 1 | Vite + TS scaffold; camera wrapper tested on **iPhone Safari, Android Chrome and a desktop webcam**; HTTPS dev on phone; color module (OKLab, ΔE_CA) + unit tests | Live preview on 3 devices; color tests green |
| 2 | Plate capture, drops, light correction, scoring functions; debug overlay showing drops and best matches. **Calibration shoot**: photograph real objects for the 55 colors | Teal mug scores ≥ 85 unedited in daylight and lamp light |
| 3 | Run state machine: title → hunt → brew → assay → potion → summary; seeded deal and pair rules; Daily / Free | A full run playable, ugly |
| 4 | Visual identity (tokens, fonts, grayscale, screens), assay animation, potion names, share text, Practice Plates | Looks like the game |
| 5 | Leaderboard (worker + D1 or LootLocker), Lens shader + meters, Grimoire + streak | Daily ranked end to end |
| 6 | Juice + audio, bonuses, Catalysts, Transmute, accessibility pass, PC layout | Feels good |
| 7 | Device matrix test, tuning from real runs, itch page + landing, **submit early**, fix | Shipped |

---

## 21. Risks (top 5)

1. **Camera permission friction or a blocked iframe**: pre-prompt, Practice Plates, direct-URL fallback.
2. **Lighting makes scores feel unfair**: the tolerant metric, auto and manual correction, a calibrated Codex, explanatory hints.
3. **Judges play on desktop at night**: Lead colors in Nigredo, a fixed tutorial pair, "hold it up" copy, keyboard support.
4. **The Brew step drags**: live preview, a snap-to-zero UX, an untimed but tiny UI; Pure Draw and no crop is always a valid quick path.
5. **Repetitive after a few runs**: daily seed, Catalysts, Grimoire, Free Brew steering to undiscovered colors, Rush mode if there's time.

---

## 22. Open questions

1. **Which jam exactly**, how long is it, and **how is retention measured**? (Platform analytics? Judge ratings? Return visits?) Does it require hosting on a specific portal? If so, that portal's iframe must allow `camera`.
2. **Noilirk**: what is it (a link)? Is there anything from it we should borrow?
3. Is a **live Lens** (color splash and meters) OK with your vision, or should the hunt stay "blind until you shoot"? (It's a toggle plus the Eclipse catalyst either way.)
4. Should **only the Daily be ranked**, or do you also want an all-time Free Brew board?
5. Leaderboard: are you OK writing a tiny Cloudflare Worker, or do you prefer LootLocker (apply for their non-commercial license)?
6. **Photos on the leaderboard**: never, or opt-in for the top 10?
7. Crop aspect: **free** (current) or **square only** (consistent share cards, simpler UI)?
8. Should the Brew be **untimed** (current) or soft-timed (e.g. 20 s with a bonus for finishing early)?
9. Team size and art capacity: who draws the engraving-style art (flasks, icons, title)?
10. Color names in **English only** for the jam?
11. Daily reset at **00:00 UTC** (like Krillion), or the players' local midnight?
