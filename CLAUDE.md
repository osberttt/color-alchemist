# Colorchemy: notes for Claude

**Colorchemy**: a mobile-first browser arcade game for the **Digit7 Jam** (HTML arcade game tournament). Tagline: **"is your life full of colors?"**

**Current design: "Seven Colors"** (very close to Krillion's structure, kept deliberately simple). A run is **7 colors** (Calcination, Dissolution, Separation, Conjunction, Fermentation, Distillation, Coagulation; tiers Lead ×3, Silver ×3, Gold), one at a time, **30 s** each, and brews **one potion** (the Elixir of Life is the goal; "craft" in code). **The whole camera view is the color extracting machine**: a frame in the target color with pipes into a centered square; nothing can be adjusted during the 30 s (no tincture any more). The machine extracts the **average color of everything inside the square** (blending is allowed); the color is hidden until the reveal: everything in the square swirls together at once into a blob at the center, which flies straight into the extracted swatch. It's judged with a **deliberately simple distance: straight-line OKLab ×100** (the same for every color, no weights, no light correction) and scored with **Krillion's exact points** per rank: Botched 10, Awry 15, Wavering 30, Kindred 60, Harmonious 85, Flawless 100; when time runs out the machine extracts whatever it holds. Potion ranks by running total (max 700, one per 140 points): Gunk ("a starter batch", never framed as failure), Stimulant, Antidote, Panacea, Elixir of Life. **Reactions** (`seven/reaction.ts`, ANALYSIS §4.25–4.29): after each result, a sliding window over the latest qualities (3-long beats 2-long; "rising" = getting better one quality at a time; a skipped quality like Awry → Kindred sets nothing off): 3 the same → Equilibrium (all 3 exposed, every dose into all, all 8 ingredients, 60 s); 3 rising/falling → Sublimation/Precipitation (1 random of the 3, all ingredients, 30 s); 2 rising/falling → Semi-… (1 random of the 2, 4 random ingredients, 30 s). The shelf shows only the ingredients on offer: no meters, no undo ("think fast and commit"). A reaction opens with a briefing (the chain of extracts with their colors and qualities, what's exposed, the time; which ingredients is a surprise; an "All reactions" list, also in the how-to guide, `seven/reaction-guide.ts`); the clock starts only when the player taps Start. In player-facing text say "quality" (of an extract), not "rank". The reaction screen has no camera: target and extract side by side, ingredients dragged in (Sunlight/Darkness, Pigment/Ash, Cinnamon/Cobalt, Moss/Rose, about 4 OKLab×100 per dose), then re-judged (better or worse). The art is code-drawn SVG (`ui/potion.ts`), no image assets. No other editing, no Grimoire, no rerolls, no time bonus. See `docs/GDD.md` §0 and `docs/ANALYSIS.md` §4.

## How to work with the user

- **Every design change the user suggests gets an analysis** of (1) the market, (2) the game design and (3) this particular jam (its rules and judging), before or alongside implementing it. Append it to `docs/ANALYSIS.md` §4 (newest first) and summarize it in chat.
- Keep it simple. Don't add features (collections, meta systems, editing) unless asked; suggest them in the analysis instead.
- **Don't search the web for the jam.** Everything about it is in `Jam Docs/` (PDFs).

## The jam (from `Jam Docs/`)

- **Deadline: 31 Oct 2026, 23:59:59 Myanmar time (UTC+06:30)**, via the Digit7 Jam Developer Portal. Hosting is provided by Digit7s (HTTPS).
- Must run in current Chrome, Edge, Firefox and Safari, desktop **and** mobile; usable at **360×640** and **1280×720**; no horizontal scroll; loads in ≤ 10 s; no crashes. Avoid browser-specific features without a fallback.
- No online leaderboard required; localStorage is fine. **Any external network request must be declared** (the build currently makes none: fonts are self-hosted).
- Submission needs: playable URL, build ZIP (only runtime files), **private GitHub repo with meaningful commit history**, README (17 listed items), ≥ 3 screenshots, 1–3 min demo video, asset credit list, originality declaration, technical notes, **AI use declaration** (this project uses Claude Code for code and docs).
- Judging: retention potential, gameplay & fun, technical performance, art & polish, originality, product fit, execution.

## Hard rules

- **Stay in this folder.** Only read, search or change files inside the project folder, plus Claude's own folders (`C:\Users\User\.claude\`, Claude temp/scratchpad under `C:\Users\User\AppData\`). Ask if something might be elsewhere.
- **No git commands that change anything.** The user runs git; suggest the commands. (All `git` is denied globally in `~/.claude/settings.json`.)
- **Never edit files with PowerShell `Get-Content`/`Set-Content` without `-Encoding UTF8`.** Windows PowerShell 5.1 reads UTF-8 as ANSI and corrupts characters like × ▶ ✕ →. Use the Edit/Write tools, or Node.
- Don't edit global settings unless asked.

## Stack and layout

Vite 7 + TypeScript (strict), plain DOM/CSS UI, Canvas2D for capture, WebGL1 for the viewfinder. No framework, no engine. Fonts via `@fontsource` (self-hosted). Vitest for unit tests, Playwright (Chromium installed inside `node_modules`) for the smoke test. `base: './'` so the build runs from any sub-path.

```
src/
  main.ts, app.ts, flow.ts     bootstrap, screen shell (no URL routing: iOS re-prompts for camera), navigation
  seven/run.ts                 Seven Colors run state, dealing, per-section judging, running total
  seven/screen.ts              the whole run on one screen: intro → hunt → extract → result sheet (+craft) ×7
  seven/reaction.ts            reaction rules (pure): which ranks set off what, ingredients, doses → edits
  seven/reaction-view.ts       the reaction screen (exposed extracts vs targets, clock, re-judging)
  seven/reaction-guide.ts      the reaction list with example chains (how-to guide and in-game)
  seven/ingredients.ts         the ingredient shelf (drag/tap doses, meters)
  seven/summary.ts             potion reveal, share text (a square per color), offline leaderboard entry
  camera/camera.ts             getUserMedia wrapper (one stream per session, 1080p ideal)
  camera/source.ts             frame sources (camera / painted practice scene / dev test photo), grab, capture
  camera/viewfinder.ts         WebGL viewfinder: digital zoom, pan, mirror
  color/oklab.ts               color math: sRGB↔linear, OKLab (UI mixing, ramps), ΔE_CA (Classic only)
  color/cielab.ts              CIELAB (D65), LCh, CIELAB→OKLab; CIEDE2000 (tested, no longer used for scoring)
  color/plate.ts               plates (linear RGB), capture averaging
  scoring/extract.ts           ★ the color extracting machine: extract (mean), judge (ΔE00 → score, rank), craft rank
  scoring/score.ts, assay.ts   Classic-mode scoring (not used by Seven Colors)
  ui/potion.ts                 the potion art per rank (code-drawn SVG, page palette); motion in ui/potion-anim.css
  data/colors.ts, tuning.ts    55-color Codex; ALL tunable numbers (SEVEN = this mode)
  practice/plates.ts           painted still lifes for the no-camera practice mode
  meta/                        rng, storage (localStorage, try/catch), share text
  screens/title.ts             title, how-to, camera prompt/error
  screens/{hunt,brew,assay,summary,collection}.ts, game.ts   Classic pair mode + Grimoire: no longer in the UI, kept until the user decides
test-photos/                   dev-only Wikimedia photos (see CREDITS.md); served by the dev server, never in the build
scripts/smoke.mjs              Playwright end-to-end smoke test
docs/GDD.md, docs/ANALYSIS.md
```

## Color and scoring rules

- One module owns the color math (`src/color`, `src/scoring`). Never compute distances in raw sRGB.
- Seven Colors: extraction = linear-RGB mean of the square's pixels, unadjusted. A reaction's ingredients apply to that one color (`editColor` in `color/plate.ts`: exposure, warmth and tint as per-channel linear gains (`editGains`, warmth and tint keep luminance) clipped at white, then OKLab chroma ×(1+sat); doses in `SEVEN.reaction`). The viewfinder's GLSL can apply the same edits (now always none); change `editPixel` and the shader together. Dev: `?react` forces a reaction after every color, `?react=equilibrium` (or sublimation/precipitation) that kind. The color is **hidden while hunting** ("?") and revealed after the snap: the square's frozen contents (the plate, drawn with `mosaic()` at full resolution) swirl into a blob of the extracted color.
- Distance = **plain OKLab distance ×100** between the target hex and the extraction (`distance`/`distanceParts` in `scoring/extract.ts`; parts = lightness, chroma, hue, adding in quadrature). No weights: keep it simple (the user's call, ANALYSIS §4.21). Ranks: Flawless ≤ 2, Harmonious ≤ 6 (the user's call, §4.22), Kindred ≤ 12, Wavering ≤ 20, Awry ≤ 27, else Botched. A grey sits exactly the target's OKLab chroma away (Kindred on the 21 softest colors).
- Saved tuner values carry a signature of the defaults and are dropped automatically when `tuning.ts` defaults change.
- Points are **Krillion's exact values per rank** (100/85/60/30/15/10). When time runs out the machine extracts on its own with the last aim and zoom (0 only if that capture fails). Craft = running total (max 700). Ranks, points and thresholds live in `SEVEN` (`src/data/tuning.ts`).
- **No light correction** (a deliberate user decision, ANALYSIS §4.6–4.7). The CIEDE2000 code stays, tested against Sharma 2005 reference pairs, in case it's wanted again.
- All numbers live in `src/data/tuning.ts` (`SEVEN` for this mode). Score scale and craft thresholds will need retuning from real playtests.

## Commands

- `npm run dev` (localhost; desktop webcam works). `npm run dev:phone` serves HTTPS on the LAN for phones (self-signed; accept the warning).
- `npm test` (Vitest), `npm run typecheck`, `npm run build` (→ `dist/`, the jam build), `npm run preview`.
- **Mobile test deploy:** pushing to `main` runs `.github/workflows/pages.yml` (npm ci → tests → `npm run build:pages` → GitHub Pages) at https://osberttt.github.io/colorchemy/. `build:pages` = the normal build plus a `noindex` meta tag. Pages must be set to "Source: GitHub Actions" in the repo settings.
- Smoke test: start `npx vite --port 5199 --strictPort`, then `$env:PLAYWRIGHT_BROWSERS_PATH='0'; node scripts/smoke.mjs http://localhost:5199/ <outDir>` (screenshots at 360×640 and 1280×720, fake camera, fails on page errors and horizontal overflow).
- **Previews for the user** (art options, layouts) go in `docs/previews/` as a self-contained `.html`, rendered next to it as a `.png` with `$env:PLAYWRIGHT_BROWSERS_PATH='0'; node scripts/render-preview.mjs docs/previews/<name>.html`. Never in the Claude temp folder.
- Title screen shows **"Test photos (dev only)"** in dev builds: plays with the photos in `test-photos/` (drag to aim, Next, Open any image file).
- **Scoring tuner:** `tuner.html` (`/tuner.html` in dev; also in the GitHub Pages build, never in the jam build). Deliberately minimal (the user's call, ANALYSIS §4.22): a target and an OKLab **color wheel** (angle = hue, center grey, edge = most vivid in-gamut color, one lightness at a time via a slider). Click or drag to see the rank, points, distance and how it's off; the last 12 picks are kept. It doesn't edit values: the user tells Claude new numbers for `SEVEN` in `src/data/tuning.ts`. It clears any saved overrides on load (the override plumbing in `tuning.ts` is unused for now).

## Conventions

- ESM, 2-space indent, strict TS, small modules, named exports. Comments explain *why*.
- Mobile-first CSS (`dvh`, safe areas, tap targets ≥ 44 px); desktop layout ≥ 900 px wide in landscape.
- **Color everywhere except where you judge color.** Menu pages use palettes from `src/ui/palettes.ts` via `show(render, pageId)` (CSS vars `--bg --text --panel --line --muted --p1..--p5 --pN-ink`). The hunt screen (`show(..., 'night')`) stays neutral grey; its juice uses only the target and found colors. Every palette must pass the contrast test in `tests/palettes.test.ts`.
- Juice goes through `src/ui/fx.ts` (one particle canvas, `paintWipe`, `floatText`, `shake`). Keep transitions short and never block input.
- Respect `prefers-reduced-motion`. Wrap all storage access in try/catch.
- Test on real devices: iPhone Safari, an Android on Chrome, a desktop webcam.
