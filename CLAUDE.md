# Color Alchemist: notes for Claude

A mobile-first browser game for a mobile/arcade/browser game jam that rewards retention. Players get 2 named colors and 60 s to photograph them in real life with the in-game camera. They then crop and adjust the photo (brightness and saturation), and the game scores how close the photo's colors are to the targets. A run is 3 brews. The tagline is **"is your life full of colors?"**

**Status: pre-production.** Only docs exist so far. Read these before doing anything:

- `docs/GDD.md`: the game design, including the **exact scoring spec (§8)**, the 55-color Codex (§10), the visual direction (§16) and jam scope (§20).
- `docs/ANALYSIS.md`: market, design and tech analysis with sources (it may be missing; if so, ask the user).

## Hard rules

- **Stay in this folder.** Only read, search or change files inside the project folder, plus Claude's own folders (`C:\Users\User\.claude\` and Claude temp/scratchpad folders under `C:\Users\User\AppData\`). If something might be elsewhere, ask.
- **No git commands that change anything.** The user runs git. Suggest the command instead. (All `git` is currently denied globally in `~/.claude/settings.json`, including read-only commands.)
- Don't edit global settings (`~/.claude/settings.json`) unless the user asks.
- Don't start coding a feature the user hasn't asked for. When code starts, follow the jam scope order in GDD §20 (MUST, then SHOULD, then COULD).

## Planned stack (decided in docs, not scaffolded yet)

- **Vite + TypeScript (strict)**, with a plain DOM/CSS UI. **No Phaser** (see ANALYSIS §3.5). Preact is OK if the user wants components.
- **Canvas2D** for capture and analysis. Use `getContext('2d', { willReadFrequently: true, colorSpace: 'srgb' })`.
- **WebGL1 fragment shader** for the live "Alchemist's Lens" color splash, with a fallback to meters only.
- **Vitest** for unit tests. **culori** is a dev-only oracle for color conversion tests.
- Leaderboard: **Cloudflare Worker + D1** (preferred) or **LootLocker** behind one `LeaderboardService` interface. This is still an open question for the user.
- Build with `base: './'` so it runs from itch.io's sub-path. Hosting is itch.io HTML5 plus a direct-URL fallback.

Intended layout:

```
index.html
src/
  main.ts                 bootstrap + screen state machine (single page, NO url/hash routing)
  screens/                title, prompt, hunt, brew, assay, potion, summary, grimoire, board, settings
  camera/                 getUserMedia wrapper, frame grab/averaging, lens shader
  color/                  ★ single source of truth: srgb<->linear LUT, OKLab/OKLCh, ΔE_CA,
                          white balance (shades-of-gray, albedo tap), drops/sampling
  scoring/                pure functions: accuracy curve, grades, brew/run score, bonuses, hints
  data/colors.ts          the 55-color Codex (from GDD §10)
  data/formulae.ts        Famous Formulae (GDD §11.2)
  data/tuning.ts          ALL tunable constants (GDD §8.12): no magic numbers elsewhere
  meta/                   daily seed + PRNG, pair dealing, grimoire, streaks, share text/card
  services/leaderboard/   interface + implementation
  ui/                     tokens.css, components, fonts
public/                   fonts, audio, icons, practice-plate photos
tests/                    vitest specs + fixtures/ (calibration photos)
docs/                     GDD.md, ANALYSIS.md
```

## Color and scoring rules (important)

- **One module owns the color math.** The live Lens, the Brew preview, the Assay, pair dealing, the server-side score check and the tests all import from `src/color` and `src/scoring`. Never duplicate formulas. If the leaderboard worker recomputes scores, it imports the same TS.
- Average and blend in **linear RGB**. Compare in **OKLab/OKLCh**. Never compute distances in raw sRGB.
- The distance is **ΔE_CA** (GDD §8.4): lightness weight 0.5, chroma weight 0.75 when the sample is duller, hue weight 1.0.
- Sample **drops** (small uniform patches), not single pixels. Reject clipped, dark and non-uniform drops (GDD §8.3).
- Scoring functions are **pure and deterministic**: same inputs give the same score. Keep the GDD §8.11 worked example as a unit test.
- The daily seed is the UTC date `YYYY-MM-DD` → hash → seeded PRNG. It must be identical on client and server.
- Any tuning change goes in `data/tuning.ts`, and the GDD gets updated when a design number changes.

## Camera rules

- `getUserMedia` needs a **secure context**. `localhost` works on PC. **For a phone, use HTTPS**: `vite --host` with `@vitejs/plugin-basic-ssl`, or a tunnel (cloudflared/ngrok). Plain `http://192.168…` will not get the camera.
- The `<video>` element needs `playsinline muted autoplay` (iOS).
- Request `facingMode: { ideal: 'environment' }` at about 1280×720, then read the real `videoWidth`/`videoHeight`.
- **Keep one stream for the whole run** and don't change the URL or hash during play (iOS has re-prompted for the camera on route changes, especially in home-screen apps).
- Camera controls (WB/exposure/torch through Image Capture) are **Android/desktop Chrome only**. iOS is unsupported. Treat them as optional extras.
- Show the camera pre-prompt before the browser prompt, and always offer **Practice Plates** when the camera is denied or missing.
- **Privacy: photos never leave the device by default.** Only numeric evidence and found colors go to the leaderboard. No gallery or file import anywhere.

## Conventions

- ESM, 2-space indent, `strict` TS, no `any` in `color/` or `scoring/`. Small modules and named exports.
- Mobile-first CSS: portrait first, `dvh` units, safe-area insets, tap targets ≥ 48 px. Desktop layout from 1024 px up with keyboard shortcuts (GDD §16.7).
- **Visual rule: "color is earned".** UI chrome uses only the grayscale tokens in GDD §16.2. Chromatic color appears only for targets, Lens blooms and found colors. Success and failure use shape, icon and wording, never red or green.
- Respect `prefers-reduced-motion`. Every color is always labelled with its name.
- Persist meta (Grimoire, bests, streak, settings) in localStorage. Wrap every access in try/catch and degrade gracefully.

## Testing

- `vitest` unit tests for color conversions (against culori), ΔE_CA, the accuracy curve, scoring examples, seeded dealing (rules hold across 10 000 seeds), and the share text.
- Golden tests from the **calibration photos** in `tests/fixtures/`.
- **Test on real devices at every milestone**: iPhone Safari, a budget Android on Chrome, and a desktop webcam. Test **inside the itch.io embed** as well as on the direct URL.
- A dev-only debug overlay shows drops, rejected drops, best matches, the illuminant estimate, and raw vs corrected values.

## Commands

Not set up yet. Once scaffolded, document `npm run dev`, `dev:phone` (HTTPS), `build`, `test` and `preview` here.
