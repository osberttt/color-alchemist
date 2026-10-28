# Color Alchemist: notes for Claude

A mobile-first browser arcade game for the **Digit7 Jam** (HTML arcade game tournament). Tagline: **"is your life full of colors?"**

**Current design: "Seven Colors"** (very close to Krillion's structure, kept deliberately simple). A run is 7 colors, one at a time, 60 s each, and builds **one craft**. The live camera shows the **color extracting machine** (a centered square framed in the target color) and a live "extracted" swatch. The machine extracts the **average color of everything inside it** (blending is allowed); the color is hidden until a blend animation reveals it after the snap. It's judged with **weighted CIEDE2000** (forgiving on small hue shifts, a bit strict on lightness, no light correction) and scored with **Krillion's exact points** per rank: Botched 10, Awry 15, Wavering 30, Kindred 60, Harmonious 85, Flawless 100; time out = 0. Craft ranks by running total: Gunk, Trinket, Curio, Marvel, Quintessence, Magnum Opus. No editing, no Grimoire, no rerolls, no time bonus. See `docs/GDD.md` §0 and `docs/ANALYSIS.md` §4.

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
  seven/summary.ts             craft reveal, 7-square share text, offline leaderboard entry
  camera/camera.ts             getUserMedia wrapper (one stream per session, 1080p ideal)
  camera/source.ts             frame sources (camera / painted practice scene / dev test photo), grab, capture
  camera/viewfinder.ts         WebGL viewfinder: digital zoom, pan, mirror
  color/oklab.ts               color math: sRGB↔linear, OKLab (UI mixing, ramps), ΔE_CA (Classic only)
  color/cielab.ts              ★ CIELAB (D65) + CIEDE2000: the Seven Colors metric
  color/plate.ts               plates (linear RGB), capture averaging
  scoring/extract.ts           ★ the color extracting machine: extract (mean), judge (ΔE00 → score, rank), craft rank
  scoring/score.ts, assay.ts   Classic-mode scoring (not used by Seven Colors)
  ui/craft.ts                  generated craft art per rank (random palette each render)
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
- Seven Colors: extraction = linear-RGB mean of the machine's pixels. It is **hidden while hunting** ("?") and revealed after the snap by the blend animation (`mosaic()`, whose last step equals the extraction).
- Distance = CIEDE2000 vs the target hex with `SEVEN.deltaWeights` (kL 0.8 stricter lightness; kC 1; kH 2 for hue shifts ≤ 30° easing to 1 by 75°; non-standard `hueLenientTo/hueStrictFrom`). Ranks: Flawless ≤ 1, Harmonious ≤ 2.5, Kindred ≤ 5, Wavering ≤ 8, Awry ≤ 14, else Botched; a test enforces that a grey is Botched for every color except Charcoal.
- Saved tuner values carry a signature of the defaults and are dropped automatically when `tuning.ts` defaults change.
- Points are **Krillion's exact values per rank** (100/85/60/30/15/10), 0 when time runs out. Craft = running total (max 700). Ranks, points and thresholds live in `SEVEN` (`src/data/tuning.ts`).
- **No light correction** (a deliberate user decision, ANALYSIS §4.6–4.7). Plain CIEDE2000 is tested against Sharma 2005 reference pairs; keep those tests passing.
- All numbers live in `src/data/tuning.ts` (`SEVEN` for this mode). Score scale and craft thresholds will need retuning from real playtests.

## Commands

- `npm run dev` (localhost; desktop webcam works). `npm run dev:phone` serves HTTPS on the LAN for phones (self-signed; accept the warning).
- `npm test` (Vitest), `npm run typecheck`, `npm run build` (→ `dist/`, the jam build), `npm run preview`.
- **Mobile test deploy:** pushing to `main` runs `.github/workflows/pages.yml` (npm ci → tests → `npm run build:pages` → GitHub Pages) at https://osberttt.github.io/color-alchemist/. `build:pages` = the normal build plus a `noindex` meta tag. Pages must be set to "Source: GitHub Actions" in the repo settings.
- Smoke test: start `npx vite --port 5199 --strictPort`, then `$env:PLAYWRIGHT_BROWSERS_PATH='0'; node scripts/smoke.mjs http://localhost:5199/ <outDir>` (screenshots at 360×640 and 1280×720, fake camera, fails on page errors and horizontal overflow).
- Title screen shows **"Test photos (dev only)"** in dev builds: plays with the photos in `test-photos/` (drag to aim, Next, Open any image file).
- **Scoring tuner:** `tuner.html` (`/tuner.html` in dev; also in the GitHub Pages build, never in the jam build). It edits rank thresholds, score scale and craft thresholds, shows the worst color that still earns each rank in 6 directions, and has a live camera check. Values save to localStorage (`TUNING_OVERRIDE_KEY`) and the game reads them in dev/test builds only (`tuningOverridesAllowed()`). When the user sends a snippet from "Copy snippet", paste it into `SEVEN` in `src/data/tuning.ts`.

## Conventions

- ESM, 2-space indent, strict TS, small modules, named exports. Comments explain *why*.
- Mobile-first CSS (`dvh`, safe areas, tap targets ≥ 44 px); desktop layout ≥ 900 px wide in landscape.
- **Color everywhere except where you judge color.** Menu pages use palettes from `src/ui/palettes.ts` via `show(render, pageId)` (CSS vars `--bg --text --panel --line --muted --p1..--p5 --pN-ink`). The hunt screen (`show(..., 'night')`) stays neutral grey; its juice uses only the target and found colors. Every palette must pass the contrast test in `tests/palettes.test.ts`.
- Juice goes through `src/ui/fx.ts` (one particle canvas, `paintWipe`, `floatText`, `shake`). Keep transitions short and never block input.
- Respect `prefers-reduced-motion`. Wrap all storage access in try/catch.
- Test on real devices: iPhone Safari, an Android on Chrome, a desktop webcam.
