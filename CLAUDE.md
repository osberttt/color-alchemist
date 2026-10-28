# Color Alchemist: notes for Claude

A mobile-first browser arcade game for the **Digit7 Jam** (HTML arcade game tournament). Tagline: **"is your life full of colors?"**

**Current design: "Seven Colors"** (very close to Krillion's structure, kept deliberately simple). A run is **5 colors** (the code still calls the mode "Seven Colors"), one at a time, **30 s** each, and builds **one craft**. **The whole camera view is the color extracting machine**: a frame in the target color with pipes through two side bars (brightness, saturation: small nudges only) into a centered square. The machine extracts the **average color of everything inside the square**, as adjusted by the bars (blending is allowed); the color is hidden until the reveal: the square blends, gathers into a blob at the center and flies straight into the extracted swatch. The bars' nudge also shows on the machine's frame, pipes and bars (CSS `--adj`), never on the square's frame or the target swatch. It's judged with **weighted CIEDE2000** (forgiving on small hue shifts, a bit strict on lightness, no light correction) and scored with **Krillion's exact points** per rank: Botched 10, Awry 15, Wavering 30, Kindred 60, Harmonious 85, Flawless 100; when time runs out the machine extracts whatever it holds. Craft ranks by running total (max 500, one per 100 points): Prima Materia ("a starter batch", never framed as failure), Trinket, Curio, Marvel, Magnum Opus. No other editing, no Grimoire, no rerolls, no time bonus. See `docs/GDD.md` §0 and `docs/ANALYSIS.md` §4.

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
  ui/craft.ts                  generated craft art per rank, in the page's palette nudged per rank (Marvel's attractor is drawn just after insertion)
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
- Seven Colors: extraction = linear-RGB mean of the square's pixels **after the bars' edits** (`applyEdits` in `color/plate.ts`: exposure ×2^ev in linear light clipped at white, then OKLab chroma ×(1+sat); ranges in `SEVEN.adjust`). The viewfinder's GLSL applies the same per pixel; change `editPixel` and the shader together. The color is **hidden while hunting** ("?") and revealed after the snap by the blend animation (`mosaic()` of the adjusted plate, whose last step equals the extraction).
- Distance = CIEDE2000 vs the target hex with `SEVEN.deltaWeights` (kL 0.8 stricter lightness; kC 1; kH 2 for hue shifts ≤ 30° easing to 1 by 75°; non-standard `hueLenientTo/hueStrictFrom`). Ranks: Flawless ≤ 2, Harmonious ≤ 5, Kindred ≤ 15, Wavering ≤ 30, Awry ≤ 40, else Botched (the user's call, ANALYSIS §4.12); a test checks that a grey is Wavering for every color except Charcoal and Steel Blue.
- Saved tuner values carry a signature of the defaults and are dropped automatically when `tuning.ts` defaults change.
- Points are **Krillion's exact values per rank** (100/85/60/30/15/10). When time runs out the machine extracts on its own with the last aim, zoom and bars (0 only if that capture fails). Craft = running total (max 500). Ranks, points and thresholds live in `SEVEN` (`src/data/tuning.ts`).
- **No light correction** (a deliberate user decision, ANALYSIS §4.6–4.7). Plain CIEDE2000 is tested against Sharma 2005 reference pairs; keep those tests passing.
- All numbers live in `src/data/tuning.ts` (`SEVEN` for this mode). Score scale and craft thresholds will need retuning from real playtests.

## Commands

- `npm run dev` (localhost; desktop webcam works). `npm run dev:phone` serves HTTPS on the LAN for phones (self-signed; accept the warning).
- `npm test` (Vitest), `npm run typecheck`, `npm run build` (→ `dist/`, the jam build), `npm run preview`.
- **Mobile test deploy:** pushing to `main` runs `.github/workflows/pages.yml` (npm ci → tests → `npm run build:pages` → GitHub Pages) at https://osberttt.github.io/color-alchemist/. `build:pages` = the normal build plus a `noindex` meta tag. Pages must be set to "Source: GitHub Actions" in the repo settings.
- Smoke test: start `npx vite --port 5199 --strictPort`, then `$env:PLAYWRIGHT_BROWSERS_PATH='0'; node scripts/smoke.mjs http://localhost:5199/ <outDir>` (screenshots at 360×640 and 1280×720, fake camera, fails on page errors and horizontal overflow).
- **Previews for the user** (art options, layouts) go in `docs/previews/` as a self-contained `.html`, rendered next to it as a `.png` with `$env:PLAYWRIGHT_BROWSERS_PATH='0'; node scripts/render-preview.mjs docs/previews/<name>.html`. Never in the Claude temp folder.
- Title screen shows **"Test photos (dev only)"** in dev builds: plays with the photos in `test-photos/` (drag to aim, Next, Open any image file).
- **Scoring tuner:** `tuner.html` (`/tuner.html` in dev; also in the GitHub Pages build, never in the jam build). It edits weights, rank thresholds, points and craft thresholds. Real misses are combined (darker + duller + hue turned), so it has a **mix explorer** (three offsets at once, with the lightness/saturation/hue parts from `ciede2000Parts`), three **rank maps** (every combination of two offsets), per-rank examples with one, two or three things off, and a live camera check that breaks samples down the same way. Values save to localStorage (`TUNING_OVERRIDE_KEY`) and the game reads them in dev/test builds only (`tuningOverridesAllowed()`). When the user sends a snippet from "Copy snippet", paste it into `SEVEN` in `src/data/tuning.ts`.

## Conventions

- ESM, 2-space indent, strict TS, small modules, named exports. Comments explain *why*.
- Mobile-first CSS (`dvh`, safe areas, tap targets ≥ 44 px); desktop layout ≥ 900 px wide in landscape.
- **Color everywhere except where you judge color.** Menu pages use palettes from `src/ui/palettes.ts` via `show(render, pageId)` (CSS vars `--bg --text --panel --line --muted --p1..--p5 --pN-ink`). The hunt screen (`show(..., 'night')`) stays neutral grey; its juice uses only the target and found colors. Every palette must pass the contrast test in `tests/palettes.test.ts`.
- Juice goes through `src/ui/fx.ts` (one particle canvas, `paintWipe`, `floatText`, `shake`). Keep transitions short and never block input.
- Respect `prefers-reduced-motion`. Wrap all storage access in try/catch.
- Test on real devices: iPhone Safari, an Android on Chrome, a desktop webcam.
