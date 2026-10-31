# Colorchemy

> Does your life have enough colors to heal you? Test it out to brew the Elixir of Life.

**Build version: 1.0.0** (git tag `v1.0.0`) · Digit7 Jam 2026 · HTML arcade game

## 1. Game title
Colorchemy

## 2. Team name
osbert

## 3. Main contact person
Min Htet Naing (osbert) · minhtetnaing25mhn@gmail.com · +66 61 283 5475 · Telegram @minhtetnaing111

## 4. Short game description
Does your life have enough colors to heal you? Colorchemy is a real-world color hunt. You brew medicine with the colors around you, so the closer your colors are to those in the recipe, the better the quality.

- **The machine:** each run is 7 colors, the seven stages of alchemy from Calcination to Coagulation. For each color you get 30 seconds to fill the square of the color extracting machine (your camera view) with something of that color, then extract it.
- **Scoring:** the machine averages everything in the square and judges how close it is. The quality runs Flawless, Harmonious, Kindred, Wavering, Awry, Botched, worth 100 down to 10 points. Every color is a drop in your potion: Gunk, Stimulant, Antidote, Panacea, and finally the Elixir of Life.
- **Reactions:** extract qualities that rise or fall in steps set off reactions. One or more extracts are exposed, and you have 30–60 seconds to drop ingredients into them (Sunlight, Darkness, Pigment, Ash, Cinnamon, Cobalt, Rose, Moss) and bring them closer to their colors.

## 5. How to open and play
- Open the playable URL in a current browser. Nothing needs to be installed.
- **Brew** uses the camera; allow camera access when asked.
- No camera? Play **Practice · practice scenes** (painted still lifes) or **Practice · from gallery** (pick any photo on your device).
- To run the build ZIP locally, serve the folder over `http://localhost` or HTTPS; browsers only allow the camera on secure origins. For example: `npx vite preview` from the repository, or any static file server.

## 6. Supported browsers
Current stable Chrome, Edge, Firefox and Safari, on desktop and mobile. Minimum: Chrome/Edge 107+, Firefox 104+, Safari 16+ (iOS 16+).

## 7. Supported devices
- Android 10+ and iOS 16+ phones and tablets with a camera.
- Windows 10/11 and macOS computers, with a webcam for Brew. The practice modes need no camera.

## 8. Controls and gameplay instructions
| | Phone / tablet | Desktop |
|---|---|---|
| Aim | Point the camera | Webcam; in practice modes drag or use the arrow keys |
| Zoom | Pinch or the zoom slider | `+` / `−`, mouse wheel or the slider |
| Extract | Tap the round shutter button | `Space` or `Enter` |
| Add an ingredient (reactions) | Drag it onto the extract, or tap it | Drag with the mouse, or click |
| Quit a run | ✕ | `Esc` |

1. Each color shows a target swatch, and the camera view is framed in that color.
2. Fill the square with something of that color, then extract. You can blend: red and yellow together extract as orange. When time runs out, the machine extracts whatever is in the square.
3. The extracted color is revealed and judged, and its points go into your potion.
4. If a reaction happens, read the briefing, tap **Start**, then add ingredients before the clock ends. Watch the extract's color change.
5. After 7 colors, your potion is revealed and saved to the ledger (Live potions and Gallery potions boards).

The **?** button on the title screen opens the guide, which lists all reactions with examples.

## 9. Known bugs or limitations
- **Camera access:** Brew needs a camera, permission to use it, and an HTTPS page. If the camera is blocked or missing, the game says why and offers practice instead.
- **Lighting:** colors depend on the room's light and on the camera's automatic exposure and white balance. This is part of the challenge; there is no light correction.
- **Gallery runs:** any image can be used, so they have their own board, separate from live (camera) potions.
- **Local leaderboard:** the ledger is stored only in this browser (localStorage); clearing site data erases it.
- **Sound:** it starts after the first tap, because of browsers' autoplay rules.
- **No WebGL:** without WebGL, the camera preview uses a simpler fallback. Scoring is unaffected.

## 10. Third-party tools or libraries used
- **At runtime:** no game engine or framework, only plain TypeScript, DOM/CSS, Canvas 2D, WebGL 1 and Web Audio. The only third-party runtime files are three fonts (see 11).
- **Build and test:** Vite 7 (MIT), TypeScript 5 (Apache-2.0), Vitest 5 (MIT), Playwright 1.64 (Apache-2.0), @vitejs/plugin-basic-ssl (MIT, dev server only).

## 11. Asset credit summary
- **Fonts:** Fraunces, Inter, JetBrains Mono, all under the SIL Open Font License 1.1, self-hosted via Fontsource.
- **Color names:** the xkcd color survey (CC0).
- **Art:** all original and drawn in code (SVG/CSS); there are no image files.
- **Sound:** all synthesized in code with the Web Audio API; there are no audio files and no music.
- **Repository only:** dev-only test photos from Wikimedia Commons are in the repository for testing and are never in the build. See `test-photos/CREDITS.md`.

Full list: `submission/ASSET_CREDITS.md`.

## 12. Special testing instructions
- **No webcam:** use **Practice · practice scenes**, or **Practice · from gallery** with any photo.
- **Reactions:** they appear after two or more colors whose qualities rise or fall one step at a time (for example Awry → Wavering), or after three equal qualities in a row.
- **Phones:** test the camera mode in portrait.

## 13. Recommended orientation, resolution and aspect ratio
- **Phones:** portrait, 360×640 and up (9:16 to 9:21).
- **Desktop:** landscape, 1280×720 and up (16:9).

The layout adapts in between, with no horizontal scrolling.

## 14. Internet connection, external API or third-party service requirements
None. After loading, the game makes no network requests: no analytics, no ads, no external APIs, and the fonts are self-hosted. Photos never leave the device; nothing is uploaded or stored except the local leaderboard and settings in localStorage.

## 15. AI tools used, their purpose, and the affected code or assets
Claude Code (Anthropic) was used to write most of the code (TypeScript, CSS, the code-drawn art and the synthesized sounds), the tests and the documentation, under the developer's direction. The developer made the design decisions, playtested, and reviewed every change. No AI-generated images, music or voice are used. Full declaration: `submission/AI_USE_DECLARATION.md`.

## 16. Private repository access and submission commit/tag
- **Repository:** https://github.com/osberttt/colorchemy (private). Reviewer access is granted to the account announced by Digit7s.
- **Submission tag:** `v1.0.0`.
- **Build from source:**
  ```
  npm ci
  npm test          # unit tests
  npm run build     # → dist/  (the playable build)
  npx vite preview  # serve dist/ locally
  ```
- **Development:** `npm run dev` (desktop webcam works on localhost), or `npm run dev:phone` (HTTPS on the local network for phones).

## 17. Build version or release identifier
**1.0.0**, the same in `package.json`, in `<meta name="version">` in the built `index.html`, and in git tag `v1.0.0`.
