# Color Alchemist: Market, Design and Tech Analysis

2026-10-26 · pre-production · companion to [`GDD.md`](./GDD.md)

Sources are linked inline and collected at the end. Third-party figures (pricing, traction) can change, so re-check anything you rely on.

---

## 0. TL;DR

- **Market:** There are a handful of camera color-hunt apps (ChromaWalk, PatchWalk, Match City: Color Hunt, ColorHunt, Spectra), and all of them are small native apps with almost no visible traction. None of them is an **instant-play, score-attack, daily-seeded browser game**. Nearby formats clearly work: the TikTok "color walk" trend, viral color-perception browser games like Dialed, Wordle-style daily color puzzles, Krillion's daily format, and Google's browser-camera Emoji Scavenger Hunt. The gap is real. It exists partly because camera games carry friction (permissions, getting up and moving), so friction is your main enemy, not appeal.
- **Design:** It can work and can be fun, but the raw concept has four problems: (1) no feedback until after you shoot, (2) a crop/edit system that's exploitable unless capped, (3) lighting that makes results feel unfair, and (4) an editing step that slows down an arcade game. Fixes: a live "Lens" color-splash preview, perceptual scoring with forgiving "name zones", a logarithmic capped crop bonus with a floor, sliders that can't change hue, a live score while editing, a daily seed and a Grimoire collection.
- **Tech:** Use **Vite + TypeScript with a plain DOM/CSS UI, Canvas2D and a small WebGL shader. Not Phaser.** Score in **OKLab** with a weighted distance, sample **patches, not pixels**, apply a partial **Shades-of-Gray** auto white balance plus an optional **"tap something white"** calibration, and **don't depend on camera controls** (iOS doesn't support them). For the leaderboard, use **Cloudflare Workers + D1** (free, no pausing, can recompute scores server-side) or **LootLocker** if you want zero backend (note its 2025 pricing change). Avoid dreamlo: HTTPS on dreamlo needs a paid upgrade, and itch.io is HTTPS.

---

## 1. Market analysis

### 1.1 The inspiration: Krillion (and Noilirk)

- **Krillion** ([krillion.io](https://krillion.io)) is a daily browser word game, "the daily word game where the obvious answer loses". Everyone gets the same **7 prompts**, with about **25 s** per prompt. It resets at 00 UTC and a run takes about 4 minutes. Answers are scored by rarity tier: **Plankton 10 · Too Clever 15 · Schooler 30 · Rare 60 · Deep Cut 85 · One in a Krillion 100**. Points convert to dive depth, and the final depth falls into one of five bands: **Shallows, Schooler, Thermocline, Deep Cut, Trench**. There's an emoji share at the end, plus Unlimited/Infinite, Archive, Themed Packs and "Puffer Party" modes ([SimilarLabs listing](https://similarlabs.com/p/krillion), [aiidelist guide](https://aiidelist.com/blog/krillion-game-guide-how-to-play-rare-answers)). The sources disagree on some details (1 point = 4 m vs 10 m of depth; the developer's name), so treat specifics as approximate.
- **"Schooler" and "Deep Cut"** are Krillion's **rarity tier names** (and band names). The GDD's equivalents are the per-color grades (*Sludge → Quintessence*), the run bands (*Grayscale → Technicolor*) and the *Fool's Gold* label (our *Too Clever*).
- **Noilirk**: **I couldn't find it** in several searches. It's "krillion" spelled backwards, so it may be a companion, an inverted mode, or something unindexed. Nothing in the docs assumes anything about it.

### 1.2 Direct comparables (camera + real-world color hunting)

| Product | Platform | Loop | Competitive? | Traction signal | Takeaway |
|---|---|---|---|---|---|
| **ChromaWalk** ([Hunted.space](https://www.hunted.space/product/chromawalk)) | iOS app | Daily target color, find the closest real-world match with the camera, XP, seasonal palettes, weekly "bounties" | Light (bounties) | Product Hunt: 3 upvotes, 1 comment, #160 of the day | Closest concept to yours. Framed as mindful "noticing", not an arcade game |
| **PatchWalk** ([Product Hunt](https://www.producthunt.com/products/patchwalk)) | iOS / Android | Pick a color and a grid (3×3, 4×4), fill it with live photos, share the collage; group quests; **no gallery imports**; photos stay on device | No | 1 follower, 1 upvote | "Live camera only" and on-device privacy are already market norms. The collage is the shareable artifact |
| **Match City: Color Hunt** ([App Store](https://apps.apple.com/za/app/match-city-color-hunt/id6757496097)) | iOS | Find 9 items matching a hue; group hunts up to 10 | Group | Small | A party/social framing |
| **ColorHunt** ([Madison Public Library review](https://www.madisonpubliclibrary.org/kids/apps/colorhunt)) | App | Group color scavenger hunt | Group | Kids/library | The reviewer flags it as **poor for color-blind users**, so accessibility matters |
| **CosmoCamp: Color Hunt** | App | Toddler AR color naming | No | n/a | Shows the "name the color" framing works for learning |
| **Spectra – Camera Painting** ([MacTrast](https://www.mactrast.com/?p=136316)) | iPhone | Camera color-matching puzzle | Puzzle | Small | Precedent for camera color matching as a *puzzle* |

**Read:** All of these are **native apps** (install friction) and mostly **non-competitive** or wellness-flavored. None has a skill-scored **score attack** with named grades, a daily shared seed and leaderboards in the browser. That's your gap. The low traction is a warning, though: "find colors with your camera" alone doesn't spread. The hook has to be the game layer and the shareable result.

### 1.3 Adjacent evidence that people like this kind of thing

- **Color walks** went viral on TikTok in the first half of 2025: pick a color, walk, and photograph everything in that color (#colorwalk, #ColorHunt), framed as mindfulness ([Alo Moves](https://blog.alomoves.com/movement/color-walk), [Picsart](https://picsart.com/blog/color-hunting-city-challenge-trend/), [Sonntagsblatt](https://www.sonntagsblatt.de/artikel/medien/trend-color-walk-auf-instagram-tiktok-warum-der-farbspaziergang-gerade-viele)). **Your premise is literally a gamified color walk.** Your tagline even sounds like a trend caption.
- **Dialed** ([dialed.gg](https://dialed.gg)) is a browser game that shows a color for a few seconds, then has you rebuild it from memory with sliders. It went viral and got press coverage ([Fast Company](https://www.fastcompany.com/91541596/dialed-color-matching-game), [TidBITS discussion](https://talk.tidbits.com/t/dialed-game-tests-your-color-memory/32935)). Coverage reports tens of millions of plays across its creators' small mini-games. That figure is from a secondary summary because the article blocked automated fetching, so re-check it before quoting. **Color-perception skill games scored on "how close" travel well in browsers.**
- **Daily color puzzles in the Wordle mold**: Hued ([Product Hunt](https://www.producthunt.com/p/hued)), Hexcodle ([App Store](https://apps.apple.com/us/app/id6736827064)), HUEMAN ([Hunted.space](https://hunted.space/product/how-hueman-are-you)). The daily, shared, streak-driven format is proven for retention.
- **Browser camera scavenger hunts have a big precedent**: Google's **Emoji Scavenger Hunt** (2018). You're shown an emoji and have a few seconds to find the real object and point your phone at it. Finding it extends the timer. It ran entirely in the browser with getUserMedia and TensorFlow.js ([Google Experiments](https://experiments.withgoogle.com/emoji-scavenger), [TensorFlow blog](https://blog.tensorflow.org/2018/10/how-we-built-emoji-scavenger-hunt-using-tensorflow-js.html)). **Real-world hunt + timer + browser camera is a proven, fun loop.**
- **Photo-scoring as a game**: *Pokémon Snap* and *New Pokémon Snap* score photos with an algorithm on size, pose, placement and so on, with bronze-to-diamond tiers ([TASVideos analysis](https://tasvideos.org/Forum/Topics/26103), [iMore guide](https://www.imore.com/new-pokemon-snap-photo-guide)). Players happily optimize a crop or composition when the judge explains itself.
- **Color names people actually use**: the xkcd color survey had about 222 000 participants and produced 954 named colors, released CC0 ([xkcd blog](https://blog.xkcd.com/2010/05/03/color-survey-results/), [rgb.txt](https://xkcd.com/color/rgb.txt)). That's a great, defensible source for "real" color names, and the GDD's Codex is anchored to it.

### 1.4 Opportunity and positioning

> *"A daily color walk, scored like an arcade game, playable in one tap from any browser."*

Your differentiators are: instant browser play (no install), a daily shared seed with an emoji share, skill expression (crop vs. accuracy vs. purity trade-offs), named grades and potions (personality), a collection of **your own** colors (personal meaning), and the tagline as a social hook ("is your life full of colors? Mine's VIVID").

### 1.5 Market risks

1. **Camera permission friction.** Every camera prompt loses players, and iOS adds quirks (§3.4). Mitigations: a pre-permission explainer, asking at the moment of need, and a **no-camera Practice Plates** mode.
2. **Context gate.** You need light, colors around you and the willingness to move. You can't play in bed in the dark, so retention will be lumpier than for a pure-screen game.
3. **Judges play on desktops.** Webcams are worse than phone cameras, the light is often warm and dim at night, and the range of reachable colors is limited. Design the first brew around desk-friendly colors.
4. **Embed/host restrictions.** Camera access inside an iframe only works if the host's iframe lists `camera` in its `allow` attribute ([addpipe explainer](https://blog.addpipe.com/camera-and-microphone-access-in-cross-oirigin-iframes-with-feature-policy/), [MDN getUserMedia](https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia)). An observed itch.io HTML5 embed **does** include `camera` and `microphone` in its allow list ([example embed](https://gotm.itch.io/embedding)), and itch admins have updated that list before ([itch forum](https://itch.io/post/2986302)). **Verify on a real phone on day 1.** If the jam requires a specific **portal**, confirm its iframe allows the camera. I found no documentation either way for Poki/CrazyGames-style portals.
5. **Privacy perception.** Photos of people's homes. Keep everything on-device by default and *say so*.

---

## 2. Game design analysis

### 2.1 Verdict

**Yes, it can work, and it can be genuinely fun.** The core fantasy (the real world is the level, and your stuff is the content) is fresh in a jam, it suits mobile, and it has a built-in viral sentence. As literally specified, though, it's at risk of feeling **slow, arbitrary and exploitable**. Each of those is fixable.

### 2.2 What's strong

- **Discovery joy**: "my sock is mustard!" The everyday world briefly becomes a treasure map.
- **Clear, legible goal**: two named colors, 60 s. Anyone gets it in one sentence.
- **Trade-off design**: the crop bonus vs. losing your best patch, and edits vs. purity. Those are real decisions, like *Balatro*-style multiplier thinking, if the game shows the math live.
- **Natural daily hook**: a shared seed gives you "what did you find for teal today?" conversations.
- **Theme fit**: alchemy (turning base matter into gold) maps neatly to turning a mundane room into a palette. Its classic stages Nigredo, Albedo and Rubedo are *literally color stages*.

### 2.3 Caveats, with fixes

| # | Problem | Why it matters | Fix (in GDD) |
|---|---|---|---|
| 1 | **Blind hunting.** You only learn your score after shooting and editing | Misses feel arbitrary, and searching an empty room is dead time | **Alchemist's Lens**: the live grayscale preview where matching pixels bloom in color, plus coarse 5-step meters. This turns searching into hot/cold dowsing and is also the signature visual. The *Eclipse* catalyst removes it for a challenge |
| 2 | **"Crop to 1 pixel" degenerate strategy** | If smaller always pays, everyone crops to nothing | Crop floor (1 % of area, 5 % of each side); a **logarithmic, capped** bonus (×1.0 to ×1.5); both colors must be *inside* the crop; the **geometric mean** makes losing one color catastrophic. The only way to max it is to photograph the two colors **touching**, which is a skill, not an exploit |
| 3 | **Edits as a cheat to hit any color** | Saturation and brightness could push a near-color onto the target | Sliders **can't change hue**. Saturation is a **multiplier** (grey stays grey). A **Purity** cost up to −50 %, and **Fool's Gold** labels big edit gains (no top grade, no Philosopher's Stone) |
| 4 | **Lighting unfairness** | "It IS teal, why 60?!" kills trust | A perceptual metric with a forgiving core zone, half-weighted lightness and lenient chroma; free auto white balance (best of raw and corrected); a free "tap something white" calibration; hints saying *how* you missed; targets tuned to photographed objects (§3) |
| 5 | **The editing step slows the arcade pace** | Crop + 2 sliders × 3 brews can feel like homework | A **live score preview** while editing, loupe markers showing where the game found each color, sliders that snap to 0, Pure Draw as a valid one-tap path. The Brew should take 10–20 s |
| 6 | **Repetition across 3 brews** | The same action three times | A difficulty ladder (Lead → Silver → Gold), a **Catalyst** on brew 3, stage-themed music layers and assay theater. Keep the run at about 4–5 min |
| 7 | **Stuck indoors with limited colors** | "I own nothing maroon" leads to quitting | Nigredo deals only common household colors; **Transmute** (one reroll, ×0.85); the Daily avoids two dark colors in a pair; Free Brew steers toward colors you can find |
| 8 | **Judges' environment** (desktop, webcam, night) | First impressions decide jam votes | Fixed tutorial pair **Denim + Tan** (jeans plus cardboard or wood); "hold it up to the camera" copy; keyboard controls; Practice Plates if there's no camera |
| 9 | **"Crayon box / paint chips" strategy** | One multi-color object answers everything | Accept it: it's in the spirit of the game, and accuracy still decides. A future "variety" bonus could reward distinct photos |
| 10 | **Photographing a screen showing the target** | Trivial cheat for the leaderboard | You can't fully prevent it. Show names and painterly swatches (not hex codes), show found swatches on the leaderboard, keep photos opt-in, recompute scores server-side, and accept jam-level imperfection |
| 11 | **Device inequality on leaderboards** | A flagship iPhone vs a budget Android camera | Forgiving zones + auto WB narrow the gap. Daily boards are for fun, so say so in the UI |
| 12 | **Color-blind players** | The core verb is color perception | Names always shown, Lens patterns (hatching vs dots), text meters, directional hints, an optional dowsing tone. The camera judges, so CVD players can still win |

### 2.4 Will it be fun? Will it be boring?

- **The fun peaks** are the Lens bloom ("it lit up!"), the snap under time pressure, and the **assay reveal** (stamp, receipt, potion name). Invest juice there.
- **Boredom risks** are the search when nothing in view matches (the Lens fixes this), the edit step (the live preview fixes this), and run three of the same day (Catalysts, and the Daily is one ranked attempt plus optional practice).
- **The first satisfying moment** has to land within about 30 s of opening the page. That means one tap to start, a single permission pre-prompt, and a tutorial pair that can almost certainly be found at a desk.

### 2.5 Arcade-jam retention plan

The jam rewards retention, so design for three time scales (GDD §13):

1. **Within a session**: one-tap *Brew again* with the camera kept warm, near-miss messages ("3 points from Essence"), per-color personal bests, skippable theater.
2. **Day to day**: a shared **Daily Rite** (00 UTC reset, like Krillion), a countdown, a **tomorrow teaser**, the **streak**, a daily top 50 + percentile.
3. **Long term**: the **Grimoire**, 55 flasks that fill with **your own photographed colors** plus 12 Famous Formula pages. It's personal, visual and completionist.
4. **Spread**: a Wordle-style **emoji share** (the squares show the colors you *found*) and an image card. The tagline doubles as the share caption.

**Optional arcade twist (COULD):** *Quicksilver Rush*. 90 s, one target at a time, catch it live with the Lens (no photo, no edit), and each catch adds time. It's a fast-retry pure-arcade mode in the spirit of Emoji Scavenger Hunt, and it reuses the Lens code.

### 2.6 Scoring philosophy, briefly

- Find **both** colors: a geometric mean, not an average.
- Score **how close the hue is**, forgive light: weighted OKLab distance (§3.3).
- **"1 pixel is enough"** becomes "1 **drop** is enough". A drop is a small uniform patch, which defeats sensor noise and fake edge colors.
- Show the math. A receipt-style breakdown builds trust and teaches optimization.

---

## 3. Tech analysis

### 3.1 The lighting problem, in depth

Humans have **color constancy**: we discount the light source, so a teal mug looks teal under a warm lamp and in shade. Cameras have to *guess*. What actually happens between the mug and your pixels:

1. **The illuminant.** Tungsten or warm LED (about 2700 K) tints everything amber, shade and overcast sky tint everything blue, and fluorescents and cheap LEDs have spiky spectra that cause **metamerism** (two objects that match in daylight stop matching under LED).
2. **Auto white balance (AWB)** on the phone guesses the light from the scene. If the frame is **dominated by one color**, AWB "corrects" it toward neutral. A frame full of teal wall gets pushed toward grey/red. ([Color constancy overview](https://en.wikipedia.org/wiki/Color_constancy))
3. **Auto exposure (AE)** pulls the average toward middle grey. A frame-filling navy sweater gets **brightened** (it reads as denim), and a white page gets **darkened**.
4. **Tone mapping, HDR and "beautification"** in the phone's camera pipeline boost local contrast and saturation in ways you can't control from the web.
5. **Sensor noise** in low light gives speckled chroma noise, worst in dark colors.
6. **Video compression and denoising**: the getUserMedia stream is a processed video frame, so chroma is subsampled and smeared at edges.
7. **Edges blend colors**: red next to blue gives purple-ish pixels at the boundary. A "nearest pixel" search would happily match "Violet" there.
8. **Specular highlights** on glossy objects are clipped white or color-shifted.
9. **Out-of-gamut and fluorescent colors** (neon pink, highlighter yellow) clip in sRGB. Many camera sensors also render **violet** bluer than people perceive it (commonly noticed with purple flowers). That's widely reported; verify it in your own tests.
10. **Screens are emissive.** Photographing a screen gives moiré and refresh banding, and is a cheating vector.

**A key insight that ties back to your design:** **shoot wide, crop later** fixes several of these at once. A wide frame with some neutral context gives AWB and AE (and *our* white-balance estimate) something sane to work with. Then **the crop mechanic** isolates the colors. The crop rule is good physics, not just a scoring rule.

### 3.2 The toolbox (what each option buys you)

| Technique | What it fixes | Cost | Verdict |
|---|---|---|---|
| **Perceptual color space (OKLab/OKLCh)** instead of RGB distance | RGB distance badly disagrees with perception | Trivial math | **MUST**. OKLab conversion: [Ottosson](https://bottosson.github.io/posts/oklab/) |
| **Weighted distance** (lightness ½, hue full, lenient duller chroma), like CMC l:c = 2:1 ([color difference overview](https://en.wikipedia.org/wiki/Color_difference)) | AE and lighting shift lightness and chroma far more than hue | Trivial | **MUST** |
| **Forgiving "name zone"** (a core radius with full marks, then a smooth falloff) | "If it's teal it should score max" | Tuning | **MUST** |
| **Patch sampling (drops)** + uniformity check + clipped/dark rejection | Noise, edge blends, highlights | Low | **MUST** |
| **Temporal averaging** (average 4 frames at capture) | Sensor and video noise | Low | **MUST** |
| **Gray World / White Patch / Shades-of-Gray** auto white balance (Retinex family; Shades-of-Gray with p ≈ 6 is a robust middle ground) | Global color casts | Low (one pass over the frame) | **MUST**, applied **partially** (about 60 %) and clamped, with best of raw and corrected |
| **Chromatic adaptation** (von Kries / Bradford / CAT16) to apply the correction properly ([Lindbloom on chromatic adaptation](http://www.brucelindbloom.com/index.html?Eqn_ChromAdapt.html)) | Makes the correction physically sensible | Low | **SHOULD** (a diagonal gain in linear RGB is an acceptable jam version) |
| **"Tap something white" calibration** (white-patch reference) | Strong casts, weird LEDs: your "noise cancellation for light" | Low + UI | **SHOULD**. Guard rails: the patch must be near-neutral and the gains are clamped |
| **Camera constraints** (`whiteBalanceMode`, `exposureMode`, `colorTemperature`, `pointsOfInterest`, torch) via the Image Capture spec | Lock WB/AE for consistency | Medium | **COULD, Android/desktop Chrome only.** The W3C implementation status lists **iOS as unsupported** ([status](https://github.com/w3c/mediacapture-image/blob/main/implementation-status.md), [MDN getCapabilities](https://developer.mozilla.org/en-US/docs/Web/API/MediaStreamTrack/getCapabilities)). Never depend on it |
| **Learned color constancy (CNNs)** | State-of-the-art illuminant estimation | High (model size, time) | **WON'T** for a jam |
| **Reference card** (the player holds white paper in the frame) | Accurate WB | Friction | Optional tip, not required |

### 3.3 Recommended pipeline (jam-friendly, specified in GDD §8)

```
getUserMedia stream (rear, ~1280×720)
  └─ on shutter: grab 4 frames → average in LINEAR RGB → plate (short side 480 px)
       ├─ estimate illuminant on FULL plate (Shades-of-Gray p=6, skip clipped/dark)
       │     → corrected plate = 60 % adaptation, gains clamped   (or Albedo tap)
       ├─ apply player edits (EV in linear RGB; chroma × (1+s) in OKLCh)
       ├─ crop → drops (1.5 % of short side), reject clipped/dark/non-uniform
       ├─ for each target: min ΔE_CA over drops, on raw AND corrected → best
       └─ acc curve → grades → brew score (geometric mean × factors + bonuses)
```

- **Why OKLab over CIEDE2000?** CIEDE2000 is the industry standard for **small** differences. It's more complex (piecewise terms, a blue-region rotation fix) and is defined on CIELAB. Our tolerances are **naming-level**, which is large, and OKLab has good hue uniformity, cheap math, and is great for blending (the potion swirl). Use OKLab + ΔE_CA in the game, and cross-check in tests with **culori**, which provides `differenceCiede2000`, `differenceCmc` and `differenceEuclidean` ([culori API](https://culorijs.org/api/)).
- **Performance:** at 480 px the analysis covers about 170 k pixels, a few to tens of milliseconds in JS, which is fine on capture and fine debounced during Brew. Use a 4096-entry LUT for sRGB→linear and `Math.cbrt`. Create the 2D context with `{ willReadFrequently: true, colorSpace: 'srgb' }` ([MDN getContext](https://developer.mozilla.org/en-US/docs/Web/API/HTMLCanvasElement/getContext)).
- **The live Lens** needs per-pixel distance at 20–30 fps, so do it in a **WebGL fragment shader** (sRGB→OKLab→ΔE_CA→mix with grayscale). Fall back to a low-res Canvas2D version at about 10 fps, or just show the meters.

### 3.4 Web camera platform notes

- **Secure context required**: HTTPS or `localhost` only ([MDN](https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia)). For **testing on a phone** from your PC, plain `http://192.168.x.x` won't work. Use `vite --host` with a self-signed HTTPS plugin (e.g. `@vitejs/plugin-basic-ssl`) or a tunnel (cloudflared / ngrok) that gives you a real HTTPS URL.
- **iOS Safari:**
  - The `<video>` needs `playsinline`, `muted` and `autoplay`, or it goes fullscreen or doesn't play.
  - All iOS browsers use WebKit, so the same limits apply.
  - **No Image Capture controls** (WB, exposure, torch, focus points) per the W3C status page.
  - **Re-prompting:** developers report repeated camera permission prompts in web apps, especially **home-screen (standalone) apps on route or hash changes** ([Apple forums](https://developer.apple.com/forums/thread/788518), [WebKit bug 215884](https://bugs.webkit.org/show_bug.cgi?id=215884)). So: **one page, no route changes during play, keep a single stream alive through a run**, and don't push "Add to Home Screen" on iOS.
  - **No Vibration API** in Safari, so haptics are Android-only.
- **Android Chrome:** the best support. Image Capture constraints exist (WB and exposure modes), so locking WB after a moment is a possible COULD.
- **Desktop webcams:** often 720p, poor AWB, fixed focus and dim rooms. The relative drop size and lenient zones help. Change the copy to "hold it up". Support keyboard input.
- **Constraints to request:** `{ video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false }`. Always read the actual `videoWidth`/`videoHeight` and handle rotation.
- **Iframes:** the host iframe must allow `camera`. The itch.io embed observed above does. itch also offers click-to-play and maximized/fullscreen launch modes and a "mobile friendly" flag, and orientation follows your viewport dimensions ([itch update: embed options](https://itch.io/updates/more-embed-options-for-html5-games), [itch update: mobile](https://itch.io/updates/better-support-for-mobile-html-games-more)). Keep a **direct-URL build** as a fallback.

### 3.5 Engine choice: Phaser vs DOM

| | Phaser (v4.x is stable as of April 2026, [phaser.io](https://phaser.io/download/stable)) | Plain DOM/CSS + Canvas2D + a small WebGL shader |
|---|---|---|
| What the game mostly is | — | **UI**: camera view, crop handles, sliders, receipts, lists, share cards, leaderboard, a grid collection |
| Text, layout, responsive portrait/landscape | Manual or DOM overlay | Native (flex/grid, `dvh`, safe-area insets) |
| Sliders, crop handles, accessibility, focus | You build them | Native `<input type=range>` + pointer events + ARIA |
| Camera preview | Possible (Video game object) | `<video>` directly, or a WebGL texture for the Lens |
| Pixel analysis | Canvas anyway | Canvas |
| Juice (particles, tweens) | Excellent built in | CSS animations + a small canvas particle helper (or a tiny tween lib) |
| Download size / time-to-play | Adds a sizable engine bundle | Minimal, fast first load (matters for mobile retention) |

**Recommendation: don't use Phaser here.** Use **Vite + TypeScript + plain DOM/CSS** (add Preact only if you want components), with **Canvas2D** for capture and analysis and **one small WebGL shader** for the Lens. Phaser shines for sprite-and-physics games, and this game is a camera plus a UI plus image math. If you're far faster in Phaser, a hybrid with Phaser only for the Assay scene is *possible*, but not worth the complexity for a jam.

### 3.6 Build, hosting, deploy

- **Vite** (TS strict) with `base: './'` so the build works from itch's sub-path. Ship as a zip to itch.io (HTML5, tick "mobile friendly", portrait viewport).
- **Fallback/direct host**: Cloudflare Pages (or Netlify / GitHub Pages). HTTPS is automatic.
- Use **asset budgets**: subset or self-host the fonts (Fraunces, Inter, JetBrains Mono, all on Google Fonts), use compressed audio (OGG plus an M4A fallback for older Safari), and inline the SVG icons.

### 3.7 Data and persistence

- **localStorage** for the Grimoire (55 entries, each with a tiny 32×32 JPEG data URL of about 1–2 KB), bests, streak, settings, device id and the last ranked day.
- The **daily seed** is a hash of the `YYYY-MM-DD` UTC date fed into a small seeded PRNG (mulberry32 or sfc32). It must be the **same code on client and server**.

### 3.8 Leaderboards: LootLocker and the alternatives

| Option | Free? | Browser fit | Effort | Gotchas |
|---|---|---|---|---|
| **LootLocker** | Since **May 2025**: a free **30-day trial** for new projects (1 000 MAU), then free *only* with an approved **non-commercial license** (apply in the console). Commercial projects stay on trial-tier features ([LootLocker pricing update](https://lootlocker.com/blog/were-updating-our-pricing), [pricing](https://lootlocker.com/pricing)). Leaderboards support **scheduled resets** (good for daily boards) | REST from JS (guest session, then submit or fetch) | Low (you know it) | Trial expiry or approval timing during judging; client-side scores |
| **Cloudflare Workers + D1** | Free plan: **100 000 requests/day**, D1 **5 M rows read / 100 k written per day**, 5 GB ([Workers limits](https://developers.cloudflare.com/workers/platform/limits), [pricing](https://developers.cloudflare.com/workers/platform/pricing/)) | Perfect (`fetch`) | Low–medium (about 60–100 lines of TS) | You write it. Upside: **import the same scoring module to recompute scores server-side**, rate-limit, daily boards keyed by seed, no pausing; also host the game on Pages |
| **Supabase** | Free: 2 projects, 500 MB DB, 50 k MAU; **projects pause after about 1 week of inactivity** (third-party summary: [Jet Admin](https://www.jetadmin.io/blog/supabase-pricing-2026-guide-to-plans-limits-and-real-world-costs/); confirm on supabase.com/pricing) | Good (supabase-js; RPC function for submit) | Low–medium | **The pause could kill the board during a quiet judging week** unless you add a keep-alive ping |
| **Firebase (Spark)** | Free Firestore quotas (daily reads/writes caps) ([pricing](https://firebase.google.com/pricing)) | Good | Medium | Security rules for score validation are awkward; SDK weight |
| **dreamlo** | Free, but **HTTPS needs a paid upgrade (donation)**, and free boards are capped ([dreamlo.js notes](https://github.com/JMHeartley/dreamlo.js/), [itch thread](https://itch.io/post/2582469)) | **Bad**: plain HTTP from an HTTPS page is blocked as mixed content | Low | Not viable for free on itch.io |
| **PlayFab** | Development Mode replaced by "Foundation Mode" (March 2026); about 1 000-user dev limit per current docs ([Microsoft Learn](https://learn.microsoft.com/en-us/gaming/playfab/features/pricing/development-mode)) | Heavy SDK | High | Overkill |
| **Talo** | Open source (MIT), self-hostable, free tier, leaderboards ([AlternativeTo](https://alternativeto.net/software/talo-game-services/about), [itch thread](https://itch.io/t/4469163/talo-an-open-source-backend-for-managing-players-leaderboards-stats-more)) | REST | Medium | Smaller ecosystem; confirm free-tier caps |

**Recommendation:**

1. **Cloudflare Worker + D1** if you're OK with about 100 lines of backend. You get daily boards, server-side **recomputation from submitted evidence**, no expiry, no pausing, and the same host for the game.
2. **LootLocker** if you want zero backend. Apply for the non-commercial license **now** so approval doesn't land mid-jam, and use a scheduled-reset leaderboard for the Daily.
3. Avoid dreamlo (HTTPS) and PlayFab (overkill). Supabase is fine **with** a keep-alive.

**Submission payload (any backend):** `{ day, deviceId, name, evidence: [{ targetIds, foundOklab[2], f, ev, sat, tRemaining, transmuted, catalyst }], clientScore }`. The server recomputes, rejects mismatches, and allows one ranked entry per device per day. Never upload photos by default.

### 3.9 Testing plan

- **Unit tests (Vitest)**: sRGB↔OKLab round-trips; ΔE_CA vs hand-computed values; the accuracy curve; scoring examples from GDD §8.11; seeded dealing (same seed gives the same pairs; rules hold for 10 000 seeds); culori as the oracle for conversions.
- **Fixture photos**: the calibration shoot (55 colors × 2 lights) becomes golden tests. "Teal mug, lamp light → acc ≥ 85 unedited."
- **Device matrix every milestone**: iPhone Safari, Android Chrome (one budget phone), desktop Chrome with a webcam, desktop Safari/Firefox. Test inside the **itch embed**, not just localhost.
- **Debug overlay** (dev builds only): show drops, rejected drops, best matches, the illuminant estimate and raw vs corrected values.

---

## Sources

**Krillion / inspiration:** [krillion.io](https://krillion.io) · [SimilarLabs: Krillion](https://similarlabs.com/p/krillion) · [aiidelist Krillion guide](https://aiidelist.com/blog/krillion-game-guide-how-to-play-rare-answers)

**Comparables:** [ChromaWalk](https://www.hunted.space/product/chromawalk) · [PatchWalk](https://www.producthunt.com/products/patchwalk) · [Match City: Color Hunt](https://apps.apple.com/za/app/match-city-color-hunt/id6757496097) · [ColorHunt review](https://www.madisonpubliclibrary.org/kids/apps/colorhunt) · [Spectra – Camera Painting](https://www.mactrast.com/?p=136316) · [Emoji Scavenger Hunt](https://experiments.withgoogle.com/emoji-scavenger) · [TensorFlow blog on Emoji Scavenger Hunt](https://blog.tensorflow.org/2018/10/how-we-built-emoji-scavenger-hunt-using-tensorflow-js.html)

**Adjacent market:** [Fast Company on Dialed](https://www.fastcompany.com/91541596/dialed-color-matching-game) · [TidBITS on Dialed](https://talk.tidbits.com/t/dialed-game-tests-your-color-memory/32935) · [Hued](https://www.producthunt.com/p/hued) · [Hexcodle](https://apps.apple.com/us/app/id6736827064) · [HUEMAN](https://hunted.space/product/how-hueman-are-you) · [Alo Moves: color walk](https://blog.alomoves.com/movement/color-walk) · [Picsart: color hunting trend](https://picsart.com/blog/color-hunting-city-challenge-trend/) · [Sonntagsblatt: color walk](https://www.sonntagsblatt.de/artikel/medien/trend-color-walk-auf-instagram-tiktok-warum-der-farbspaziergang-gerade-viele) · [TASVideos: Pokémon Snap scoring](https://tasvideos.org/Forum/Topics/26103) · [iMore: New Pokémon Snap photo guide](https://www.imore.com/new-pokemon-snap-photo-guide) · [xkcd color survey results](https://blog.xkcd.com/2010/05/03/color-survey-results/) · [xkcd rgb.txt](https://xkcd.com/color/rgb.txt)

**Color science:** [Oklab (Björn Ottosson)](https://bottosson.github.io/posts/oklab/) · [Color difference (CIEDE2000, CMC)](https://en.wikipedia.org/wiki/Color_difference) · [Color constancy](https://en.wikipedia.org/wiki/Color_constancy) · [Lindbloom: chromatic adaptation](http://www.brucelindbloom.com/index.html?Eqn_ChromAdapt.html) · [culori API](https://culorijs.org/api/)

**Web platform:** [MDN getUserMedia](https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia) · [MDN getCapabilities](https://developer.mozilla.org/en-US/docs/Web/API/MediaStreamTrack/getCapabilities) · [W3C Image Capture implementation status](https://github.com/w3c/mediacapture-image/blob/main/implementation-status.md) · [MDN canvas getContext](https://developer.mozilla.org/en-US/docs/Web/API/HTMLCanvasElement/getContext) · [Apple forums: repeated camera prompts](https://developer.apple.com/forums/thread/788518) · [WebKit bug 215884](https://bugs.webkit.org/show_bug.cgi?id=215884) · [addpipe: camera in cross-origin iframes](https://blog.addpipe.com/camera-and-microphone-access-in-cross-oirigin-iframes-with-feature-policy/) · [itch embed example (allow list)](https://gotm.itch.io/embedding) · [itch forum: allow list updated](https://itch.io/post/2986302) · [itch: more embed options](https://itch.io/updates/more-embed-options-for-html5-games) · [itch: mobile HTML games](https://itch.io/updates/better-support-for-mobile-html-games-more) · [Phaser stable](https://phaser.io/download/stable)

**Leaderboards:** [LootLocker pricing update (May 2025)](https://lootlocker.com/blog/were-updating-our-pricing) · [LootLocker pricing](https://lootlocker.com/pricing) · [Cloudflare Workers limits](https://developers.cloudflare.com/workers/platform/limits) · [Cloudflare Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/) · [Supabase pricing summary (third-party)](https://www.jetadmin.io/blog/supabase-pricing-2026-guide-to-plans-limits-and-real-world-costs/) · [Firebase pricing](https://firebase.google.com/pricing) · [dreamlo.js](https://github.com/JMHeartley/dreamlo.js/) · [itch: dreamlo SSL thread](https://itch.io/post/2582469) · [PlayFab development mode](https://learn.microsoft.com/en-us/gaming/playfab/features/pricing/development-mode) · [Talo (AlternativeTo)](https://alternativeto.net/software/talo-game-services/about) · [Talo itch thread](https://itch.io/t/4469163/talo-an-open-source-backend-for-managing-players-leaderboards-stats-more)

---

## 4. Change analyses

Every design change gets a short analysis against the market, the game design and the Digit7 Jam (see `CLAUDE.md`). Newest first.

### 4.6 Precise CIEDE2000 judging, the color extracting machine, ranks and the craft (2026-10-28)

**The change.**
- **No leniency.** The camera's color is the color. Light correction, per-color tolerance and "teal registers as teal" are all gone.
- **The square becomes the *color extracting machine*.** It extracts the average of everything inside it (linear-light mean), so **blending is allowed**: red and yellow objects side by side extract as orange. The live "extracted" swatch is exactly what gets scored.
- **Judging is CIEDE2000** (the CIE standard for perceived color difference). Score = round(100 · e^(−ΔE00/10)).
- **Per-color ranks:** Botched (> 20), Awry (≤ 20), Wavering (≤ 10), Kindred (≤ 5), Harmonious (≤ 2.5), Flawless (≤ 1, an invisible difference).
- **The run builds one craft**, ranked by the running total (max 700): Gunk (< 100), Trinket, Curio (200), Marvel (300), Quintessence (420), Magnum Opus (550, about ΔE 2.5 on every color). The craft is shown after every color, like Krillion's depth.
- **The craft's art** is generated abstract shapes that become more ordered and radiant per rank, recolored from a random palette on every render.
- **Quicksilver (time bonus), tier multipliers and the Philosopher's Stone are removed.** The score is purely closeness.
- **Transitions are slower and layered:** three paint rings, a result sheet that slides up, and the extracted color condensing into a drop that falls into the craft.

**Market**
- This is Krillion's structure almost one to one: 7 prompts, rarity-style ranks, and a cumulative meter (depth there, craft quality here). It's a proven loop with a fresh, physical input.
- "Flawless" is our "One in a Krillion": rare, lucky, worth a screenshot. The craft names (Gunk → Magnum Opus) and the generated art give every run a shareable result that's different each time.
- Blending is an emergent "aha" ("I made orange from a lemon and a tomato") that players tell each other about. It's free word of mouth.

**Game design**
- **Honest, readable and hard.** The extracted swatch is literally the score input, so there are no surprises. Players judge by eye and the game only measures. Flawless needs real luck plus control (angle, shading, distance), which is the intended "krillion" feeling.
- **Risk: too harsh.** Phone cameras shift colors by several ΔE units under ordinary light, so most players will see Wavering and Awry. The continuous score (37 points at ΔE 10, 14 at ΔE 20) keeps small improvements rewarding, and the craft climbs anyway (Gunk → Trinket → Curio → Marvel for a decent run). Tune `scoreScale` and the craft thresholds after real playtests, not before.
- **Why the average color, not cells:** the user wants blending, and averaging in linear light is how colors physically mix at a distance (optical mixing). It also removes the old mismatch between the shown swatch and the score.
- **Why CIEDE2000:** it's the standard for small, precise differences, which is exactly the Flawless and Harmonious range that now matters most. For large misses it's less exact, but it never reverses an order. It's verified against the published reference pairs in `tests/extract.test.ts`.
- **Removed time bonus:** pressure now comes only from the clock, so the score means "how close". Krillion works the same way.
- **The hunt stays neutral grey.** The craft and the colorful result live on a separate sheet, so they never sit next to the color being judged.

**Digit7 Jam**
- **Judging:** "originality" and "art & polish" gain the most, from the generated craft art, the machine metaphor and the slower transitions. "Retention" benefits from a visible goal (reach Marvel, then Magnum Opus) and per-run variety.
- **Technical:** the scoring is simpler than before (one average, one formula), with no new assets and no network. SVG animations are lightweight. Watch the frame rate of the Magnum Opus sprite on a budget Android.
- **Schedule:** 3 days left. This should be the last design change. Freeze the design after one real-device playtest, then do the submission paperwork.

### 4.5 A color ramp instead of hint words (2026-10-26)

**The change.** The result no longer says "too yellow, too light". It shows **target → yours as a color ramp**: 1 step between the two for Quintessence, 2 Essence, 3 Elixir, 4 Tincture, 5 Murk, 6 Sludge. The steps are interpolated in OKLab, so they look evenly spaced.

- **Market:** it says everything in color, no words, which suits the brand and travels across languages (Myanmar and English players alike). Results screenshot well.
- **Game design:** the ramp *shows* the direction of the miss (redder? darker? greyer?) without telling the player what to do, which respects "judge it yourself". The length of the walk is an instantly readable distance. One caveat: the step count follows the grade, not the raw distance, so two Elixirs look equally long even if one was 79 and one 61. That's fine because the number is printed right below.
- **Jam:** zero-text feedback helps judges skimming, and it's a distinctive "special feature" for the demo video and screenshots.

### 4.4 Colorful menus (20 palettes) and lots of juice (2026-10-26)

**The change.** Every page outside the hunt gets its own palette, drawn from 21 hand-made palettes (pastel, neon, bright, dull, earthy, dark). It changes every refresh for now; one switch (`PALETTE_ROTATION`) makes it daily. Juice:
- paint-wipe transitions between screens
- drifting color blobs and ambient bubbles
- letter-by-letter logo with paint splashes
- particle bursts on every button
- target-color splash on each intro, a shutter shake
- grade-scaled bursts on results (confetti and a screen shake for Quintessence), floating "+points", a popping spectrum bar
- one-by-one swatch pops, a count-up and confetti on the summary
- star bursts for the leaderboard's top 3

**Market**
- It's on-brand: the tagline asks "is your life full of colors?" and the game now answers with every screen. Colorful thumbnails and screenshots stand out in a jam gallery.
- A daily palette is a light daily hook ("today's palette: Disco") that costs no design work, and it's ready for the post-jam daily mode.

**Game design**
- **The hunt stays neutral on purpose.** Colors around a sample change how we perceive it (simultaneous contrast): a hot-pink frame would make the square's teal look different. So the camera screen keeps its grey chrome. Its juice uses only *earned* colors: the target's splash and particles in the target and found colors.
- This replaces the old "color is earned" rule (grayscale UI everywhere) with "color everywhere except where you judge color".
- **Juice must not slow the loop.** Transitions are about 0.6 s, results still wait for the player, and nothing blocks input.
- **Readability:** every palette sets its own text color. A unit test enforces WCAG 4.5:1 for body text and for primary-button labels on all 21 palettes. It caught one failing palette (Candy Shop), which is now fixed.

**Digit7 Jam**
- **Art & polish** and **overall player experience** are judged directly, and this is the cheapest big upgrade to both.
- **Technical performance:** there's one shared particle canvas with a 450-particle cap, the loop sleeps when idle, and everything scales down under `prefers-reduced-motion`. Watch frame rate on a low-end Android.
- **No assets were added** (everything is CSS, canvas and synthesized audio), so there's nothing new to credit or license.

### 4.3 The player decides when the next color starts (2026-10-26)

**The change.** The result after each color no longer auto-advances. It waits for the player's tap ("Next color ▶", tap anywhere, Space/Enter). The rest between colors is untimed. The next color's 60 s clock starts after its short intro. Taps within 0.6 s of the result appearing are ignored, so a double-tap on the shutter can't skip it.

- **Market:** it matches Krillion and Wordle-style pacing: you read your result, then move on when ready. It also gives a natural moment to screenshot a result, which is free word of mouth.
- **Game design:** a camera game needs physical resets (put the object down, walk to another room, find a light). An untimed rest makes the timed part feel fair and keeps the pressure inside the 60 s, where it belongs. The risk is a run dragging out, but each player controls their own pace, and nothing about scoring rewards stalling: the next color is unknown until you tap, and its clock starts when it appears.
- **Jam:** judges can stop mid-run without losing anything to a timer, which helps people evaluating many games. It's simpler to demo in the required video too (pause, explain, continue).

### 4.2 Krillion-simple: no editing, no Grimoire, no swaps (2026-10-26)

**The change.** Seven Colors loses everything that isn't the core verb: no brightness or saturation sliders, no Grimoire collection, no color swaps (Transmute), no "your best" lines. What's left: 7 colors × 60 s, the center square framed in the target color, a live "in the square" swatch, zoom, snap, a short result beat, the run band, a 7-square share row and an offline leaderboard. Lighting is part of the challenge: shade the object with your hand, tilt it, move to a window.

**Market**
- It's very close to Krillion's structure (7 prompts, one answer each, named tiers, an emoji row), so players and judges "get it" instantly. That's an advantage in a jam where judges play dozens of games.
- **Retention now rests on fewer legs.** Krillion keeps players with a *daily* shared puzzle. We dropped the daily for the jam and now the collection too, so retention comes from score-chasing (local leaderboard, bands, "2 231 more for SEPIA"), instant restart and sharing. That's fine for a judging window. A daily mode is the obvious post-jam addition.
- **Physical light control is a genuinely novel mechanic** ("cover the light with your hand"). No color-hunt app we found makes the light itself a skill. Mention it in the pitch.

**Game design**
- **Honest and readable.** With no edits, what you see in the square is exactly what gets scored. The comparison frame shows the target and the camera's rendering side by side, so a low score always "looks right" to the player. That's the best possible defence against "it IS teal!" frustration.
- **Harder, and that's OK.** Whole-square accuracy without edits will often land in Tincture/Elixir indoors. Watch for runs where *every* color scores near 0: that reads as broken, not hard. If playtests show it, widen the accuracy curve (`accSigma` 0.07 → 0.09) or lower the band thresholds, which are both single constants. Don't bring the sliders back.
- **No swaps means an unavailable color is just a bad section.** With 7 sections, one miss isn't fatal (the Krillion feel). Keep the first three colors Lead (common household) as now.
- **Auto light correction (kept, invisible).** Scoring still takes the better of the raw square and an automatic white-balance correction estimated from the whole frame. It never lowers a score and it makes cheap indoor bulbs less punishing. If you want pure what-you-see-is-what-you-get, it's one switch in `src/scoring/square.ts`.

**Exposure and contrast: recommendation, don't add them for the jam.**
- **Real camera controls** (`exposureCompensation`, `exposureMode`, `contrast`, `whiteBalanceMode` via `MediaStreamTrack.applyConstraints`) only work in Chrome on Android and some desktop webcams. They don't work in Safari (iOS or macOS) or Firefox ([W3C implementation status](https://github.com/w3c/mediacapture-image/blob/main/implementation-status.md)). The jam's technical guide (§7.2) tells entrants to avoid browser-specific features without a fallback, and an unfair advantage for Android players also hurts the leaderboard.
- **Software exposure/contrast** works everywhere but is just color grading under another name. It reopens the "slide until it matches" problem you just removed.
- **Physical light play is better for this game**: it's tactile, universal, readable, and it's the thing no other color game does.
- **Revisit after the jam:** an Android-only "exposure lock" (keep auto-exposure from fighting you when the square is full of one color) is the one camera feature worth testing, and only if it can be fair across devices.

**Digit7 Jam**
- Less UI means fewer bugs and more polish time in the last 5 days. Judges see the core loop in seconds.
- It works the same in Chrome, Edge, Firefox and Safari, on desktop and mobile. Nothing depends on platform-only camera APIs.
- Retention is optional in technical screening (guide §7.12) but listed in judging. Instant restart, local leaderboard and the share row cover it.
- The Classic pair mode and the Grimoire are removed from the UI. Their code remains in `src/screens/` and `src/game.ts` until the team decides to delete it.

### 4.1 "Seven Colors": one color at a time, live square, no edit screen (2026-10-26)

**The change.** A run becomes **7 sections** (like Krillion's 7 prompts). Each section deals **one** color. The hunt shows the normal color camera with a **square marked at the center**; only that square is scored, and **the whole square** counts (the mean accuracy of all its cells), not the single closest drop. The target color is always on screen, so players judge the match by eye while hunting. There is **no separate Brew screen**: zoom replaces cropping, and brightness and saturation are adjusted live while photographing, all inside the timer.

**Market**
- It moves the game **closer to proven formats**. Krillion's rhythm is 7 short prompts, one answer each, named tiers and an emoji row. Seven one-color answers give a natural **7-square share row**, the most recognisable shape in daily-puzzle sharing.
- The live side-by-side comparison feels like **Dialed / Hexcodle** ("how close can you get?"), which players already understand. It's more accessible than Dialed because you don't need color memory.
- **Differentiation drops a little**: ChromaWalk is also "one target color, find the closest match with the camera". What still sets us apart is the arcade timer, 7-color runs, named grades and potions, the whole-square fill rule and the in-browser instant play. Lean on the arcade identity in the pitch.

**Game design**
- **Much easier to learn.** One color, one square, one timer. There's no crop UI to teach and no second screen. First fun arrives in about 15 seconds instead of about 60, which matters for judges and for retention.
- **Feedback is now the player's own eyes**, which is honest and fair: the target color and the camera's rendering of the object sit on the same screen, and that camera rendering is exactly what gets scored. The square's frame is painted in the target color so the comparison happens right where you're looking.
- **Whole-square scoring is harder and more lighting-sensitive.** A real teal cup under a lamp will often land at Elixir, not Quintessence. The free automatic light correction still applies, and the live brightness and saturation sliders let skilled players rescue a shot at a Purity cost. Expect lower raw accuracy, so retune the bands from playtests.
- **Skill moves** from "find a drop and crop the seam" to "find it, fill the square (zoom/walk closer), fix the exposure, snap fast". That's a cleaner arcade verb. The cost is that the crop-size trade-off disappears; that's acceptable because it was the hardest thing to explain.
- **The Alchemist's Lens no longer fits.** A grey camera view would stop players from comparing colors by eye. It's dropped in this mode (it could return later as a hint power-up).
- **Run length is the main risk.** 7 × 60 s plus transitions is up to about 8 minutes, twice Krillion's roughly 4 minutes. The Quicksilver time bonus pushes good players to finish early, but **test 30–40 s per color**. The per-color time is a single tuning constant.
- **"I don't own this color" happens more often** with 7 colors per run. Recommendation: **2 Transmutes per run** (implemented, tunable) and a tier ladder of Lead ×3 → Silver ×3 → Gold ×1.
- **Repetition**: the same action seven times. It's mitigated by the tier ladder, punchy intro and result beats (about 1.5 s each), a Gold "boss" color at the end and the 7-swatch strip filling up.
- **Exploit check**: with a live comparison, players can point at any similar hue and slide brightness and saturation until it matches. Sliders still can't change hue, edits cost Purity, and big gains get the Fool's Gold label. Fine for a jam.

**Digit7 Jam**
- **Judging** (retention potential, gameplay and fun, technical performance, art and polish, originality, product fit, execution): the simpler loop helps *fun*, *execution* and *technical performance*, because there are fewer screens and fewer failure points. Short rounds plus restart-any-time help *retention*.
- **Technical screening** needs Chrome, Edge, Firefox and Safari on desktop and mobile, at 360×640 and 1280×720. The redesign uses fewer screens and the same camera stack. Zoom is **digital** (works everywhere); hardware zoom through `applyConstraints` is Android-Chrome-only, so it is not used.
- **Desktop judges with webcams**: hold an object close and zoom in to fill the square. That's easier than the pair mode, where two colors had to share a frame.
- **Originality**: the 7-round structure is a format convention, not copied content. Our stages (the seven alchemical operations), colors, art and scoring are our own.
- **Schedule**: about 5 days remain (deadline **31 Oct 2026, 23:59:59 Myanmar time**). The change reuses the color/scoring core and camera code. The pair mode stays in the build as "Classic" until playtests pick a winner, so nothing is lost.
