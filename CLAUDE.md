# Color Alchemist: notes for Claude

A mobile-first browser arcade game for the **Digit7 Jam** (HTML arcade game tournament). Tagline: **"is your life full of colors?"**

**Current design: "Seven Colors"** (very close to Krillion's structure, kept deliberately simple). A run is 7 colors, one at a time, 60 s each. The live camera shows a square at the center, framed in the target color, and a live "in the square" swatch. The player fills the square with that color (zoom in, walk closer, shade the light with a hand) and snaps. The **whole square** is scored (mean accuracy of its cells). There is **no editing** (no brightness/saturation/contrast), no Grimoire and no rerolls. See `docs/ANALYSIS.md` §4.1–4.2.

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
  seven/run.ts                 Seven Colors run state, dealing, per-section scoring
  seven/screen.ts              the whole run on one screen: intro → hunt → snap → result ×7
  seven/summary.ts             band, 7-square share text, offline leaderboard entry
  camera/camera.ts             getUserMedia wrapper (one stream per session, 1080p ideal)
  camera/source.ts             frame sources (camera / painted practice scene / dev test photo), grab, capture
  camera/viewfinder.ts         WebGL viewfinder: digital zoom, pan, mirror
  color/oklab.ts               ★ color math: sRGB↔linear, OKLab, ΔE_CA, accuracy curve
  color/plate.ts               plates (linear RGB), auto white balance, drop/cell grids
  scoring/square.ts            ★ Seven Colors whole-square scoring
  scoring/score.ts             grades, hints, quicksilver, shared helpers
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

- One module owns the color math (`src/color`, `src/scoring`). The GLSL in `camera/*.ts` mirrors it; change both together. Never compute distances in raw sRGB.
- ΔE_CA (GDD §8.4) plus a **greyish penalty** (`dullRelK`): without it a grey wall scored ~60 on Teal.
- Seven Colors score per color: `round(10 · acc · tierMult) + quicksilver` (camera mode only). acc = mean cell accuracy over the square, best of raw vs auto-white-balanced (`SEVEN.autoLight`).
- All numbers live in `src/data/tuning.ts` (`SEVEN` for this mode). Bands will need retuning from real playtests.

## Commands

- `npm run dev` (localhost; desktop webcam works). `npm run dev:phone` serves HTTPS on the LAN for phones (self-signed; accept the warning).
- `npm test` (Vitest), `npm run typecheck`, `npm run build` (→ `dist/`, the jam build), `npm run preview`.
- **Mobile test deploy:** pushing to `main` runs `.github/workflows/pages.yml` (npm ci → tests → `npm run build:pages` → GitHub Pages) at https://osberttt.github.io/color-alchemist/. `build:pages` = the normal build plus a `noindex` meta tag. Pages must be set to "Source: GitHub Actions" in the repo settings.
- Smoke test: start `npx vite --port 5199 --strictPort`, then `$env:PLAYWRIGHT_BROWSERS_PATH='0'; node scripts/smoke.mjs http://localhost:5199/ <outDir>` (screenshots at 360×640 and 1280×720, fake camera, fails on page errors and horizontal overflow).
- Title screen shows **"Test photos (dev only)"** in dev builds: plays with the photos in `test-photos/` (drag to aim, Next, Open any image file).

## Conventions

- ESM, 2-space indent, strict TS, small modules, named exports. Comments explain *why*.
- Mobile-first CSS (`dvh`, safe areas, tap targets ≥ 44 px); desktop layout ≥ 900 px wide in landscape.
- **Color everywhere except where you judge color.** Menu pages use palettes from `src/ui/palettes.ts` via `show(render, pageId)` (CSS vars `--bg --text --panel --line --muted --p1..--p5 --pN-ink`). The hunt screen (`show(..., 'night')`) stays neutral grey; its juice uses only the target and found colors. Every palette must pass the contrast test in `tests/palettes.test.ts`.
- Juice goes through `src/ui/fx.ts` (one particle canvas, `paintWipe`, `floatText`, `shake`). Keep transitions short and never block input.
- Respect `prefers-reduced-motion`. Wrap all storage access in try/catch.
- Test on real devices: iPhone Safari, an Android on Chrome, a desktop webcam.
