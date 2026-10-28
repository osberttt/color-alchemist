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

### 4.19 Brewing the Elixir of Life: potions replace the math crafts (2026-10-28)

**The change (the user's call).**
- The alchemist brews the **Elixir of Life**. The run's object is now a **potion**, ranked **Gunk → Stimulant → Antidote → Panacea → Elixir of Life** (still one rank per 100 points). The abstract math art (budding polygons, artifact, attractor, Maurer roses) is gone.
- **Potion art** is code-drawn SVG in `src/ui/potion.ts`, in the page's palette:
  - Gunk: a cracked clay crock oozing sludge, with a fly.
  - Stimulant: a fizzing corked flask that twitches.
  - Antidote: an apothecary bottle with a leaf label and a sprig.
  - Panacea: a faceted teardrop with a gold stopper and glowing currents.
  - Elixir of Life: a heart flask holding every color, with an orb stopper, halo and rays.
- **User revisions:** no plus sign on the Antidote (a leaf instead), no diamond on the Panacea, no crown or wings on the Elixir.
- **Text:** "Your potion", "your brew begins", "Brew again", and the how-to "every color is a drop in your brew".

**Market**
- "Brew the Elixir of Life" says what the game is in one line. Potion bottles are a well-loved, readable casual-game visual. The whole fantasy is now coherent: alchemist, machine, extracted drops, the brew.

**Game design**
- **The drop already falls into the craft on the result sheet;** now it falls into a bottle, which reads naturally.
- **The ranks tell a story** (sludge → remedy → cure-all → immortality) and the vessel improves as visibly as the liquid. Gunk stays positive ("a starter batch") and comical (the fly), not a failure.

**Digit7 Jam**
- **Art & polish / product fit** improve.
- **No image files:** nothing to credit or declare as an asset, no load cost, and drawing a potion costs about as much as the old crafts (Marvel's deferred canvas work is gone).
- **Reduced motion** shows still bottles.
- **Also fixed:** the dev-only test-photo manifest had a malformed entry (one wrapped group of 9 photos), which sometimes stalled the photo mode and the smoke test. It now lists all 24 photos.

### 4.18 When time runs out, the machine extracts (2026-10-28)

**The change (the user's call).** At 0:00 the machine extracts on its own with the last aim, zoom and bar settings, then plays the normal blob reveal and judging. This replaces Krillion's "unanswered = 0" (§4.7). A 0 now only happens if that capture fails.

- **Market:** no run ends in a dead "nothing" screen, which is friendlier for casual players and short sessions.
- **Game design:** with 30 s (§4.17), a hard 0 would punish slow but careful players too much. Now the clock still matters, because you get whatever is in the square, but aiming well until the last second pays. The tip text says "Keep it aimed."
- **Jam:** retention and fun gain (fewer zero runs). No new assets or tech.
- **Same day (user):**
  - The blob now flies straight from the center into the extracted swatch, with no rise up the pipe. That's a shorter, clearer reveal.
  - The bars' nudge also shows on the machine itself (frame, pipes, joints, nameplate, bar tracks), so brightness and saturation changes are easy to see.
  - The square's frame and the target swatch keep the true target color, so the inside-vs-frame comparison stays honest, and the final color is still hidden.

### 4.17 The whole view is the machine: adjustment bars, the blob reveal, 30 s (2026-10-28)

**The change (the user's call).**
- **The machine is the whole camera view:** a frame in the target color, with pipes from the frame through two side bars into the square, and up and down from the square to the frame. Corner brackets, joints, and a nameplate on the bottom pipe.
- **Two small adjustment bars:**
  - Left is brightness: ±0.5 stops in linear light, about −29 % … +41 % light.
  - Right is saturation: ±25 % OKLab chroma.
  - The viewfinder shows the nudge, and the capture applies it to every pixel (`applyEdits`, the same math as the shader), so the extraction is exactly what the player saw.
  - The bars reset for every color.
- **Reveal:** the square blends (mosaic), gathers into a round blob at the very center, rises up the top pipe, and flies into the extracted swatch, which pops to show the color.
- **Timer: 30 s** per color (was 60).
- This partly reverses §4.2's "no editing". The range is deliberately small: it can't change hue or turn a grey into a color, so the grey-wall case (§4.12) doesn't get stronger.

**Market**
- A machine you operate is more toy-like and more memorable than a bare camera reticle, and it reads at a glance in screenshots and the demo video.
- Small "dials" are a familiar camera-app gesture (exposure slider), so they need no teaching.
- 30 s per color makes a full run about 2.5 minutes of hunting: arcade pacing, good for a jam judge's first session.

**Game design**
- **Agency without a solver:** with the color hidden (§4.7), players had no way to respond to their camera's bias. Now they can correct a "too dark" or "too dull" read by eye, within limits. Skill is still finding the right object and light.
- **Readable cause and effect:** the bars sit on pipes that feed the square, so the player sees what they're adjusting.
- **The reveal tells the story:** the blend gathers into a blob, which travels up the machine into the swatch. The extracted color comes out of the machine, not from nowhere.
- **Risk:** 30 s is tight for real-world camera hunting, especially the first color. Watch playtests. The between-color pause is unlimited, so players can plan.
- **Suggested, not added:** showing the bar settings on the result sheet; a "steady hands" bonus for leaving the bars at zero.

**Digit7 Jam**
- **Performance:** the machine is one SVG redrawn only on resize, and the bars are DOM elements. The capture adds one pass over the 360-px plate (about 170 k pixels), negligible.
- **Accessibility:** the bars are focusable sliders (ARIA role, arrow keys, Home resets) with 44-px touch targets, and have keyboard shortcuts (W/S, E/D). With reduced motion, the reveal skips straight to the swatch.
- **Browsers:** WebGL shows the exact nudge. Without WebGL, CSS filters approximate it, and the capture stays exact.

### 4.16 The craft uses the page's palette (2026-10-28)

**The change (the user's call).**
- The craft is drawn in the palette of the page it appears on: the result sheet's palette during the run, the summary page's at the end. Only the tuner and previews, which have no palette, pick one at random.
- Each rank nudges those colors a little:
  - Trinket: 3 colors, chroma ×0.85.
  - Curio: 4 colors, as they are.
  - Marvel: 5 colors, +0.04 lightness, chroma ×1.1.
  - Magnum Opus: the 5 accents plus 3 blends of neighbors, +0.06 lightness, chroma ×1.2.
- Prima Materia stays muddy.
- On light pages, highlights (edges, sparkles, rose outlines) take the page's text color, and the attractor doesn't burn to white, which would vanish.

- **Market:** each page reads as one designed image, with the craft matching its frame. That's better for screenshots and the demo video.
- **Game design:** the climb still shows (more colors, slightly brighter), but it's subtler than before. A dull palette gives a muted Magnum Opus, and the shape and motion carry the rank. That supersedes §4.9's fixed brightness ladder at the user's request.
- **Jam:** no cost. All palettes still pass the contrast tests.

### 4.15 Prima Materia returns; a rank every 100 points (2026-10-28)

**The change (the user's call).**
- **Five craft ranks again:** Prima Materia 0, Trinket 100, Curio 200, Marvel 300, Magnum Opus 400 (max 500).
- **Prima Materia** has its original muddy blobs and drips, "a starter batch".
- **Trinket** is more saturated (OKLab chroma 0.09 → 0.125).

- **Market:** "100 points per rank" is instantly understood and easy to share ("I got 320, a Marvel"). A humble first rank gives every run a visible climb.
- **Game design:**
  - The ladder reads dull → colored → shiny → glowing → radiant, so every rank-up is visible.
  - With the §4.12 limits a typical color scores Kindred (60), so an average run (~300) lands on Marvel. Magnum Opus needs an average of 80, about Harmonious on most colors.
  - **The grey-wall exploit (5 × Wavering = 150) now only reaches Trinket.**
  - In the smoke test, random aiming in practice mode scored 65–90, which is Prima Materia, as it should.
- **Digit7 Jam:** no new assets. Retention benefits from a clear next goal: the result sheet already shows "N more for <next rank>".

### 4.14 Trinket takes Curio's art; a new Curio bridges to Marvel (2026-10-28)

**The change.**
- **Trinket** now uses the budding polygons, the old Curio art.
- **The new Curio is ripples:** rings of slightly irregular polygons spread from a glinting core, alternate rings turning opposite ways. Each facet has a diagonal sheen and a light edge, with a few sparkles.
- **Colors per rank:** 3 (Trinket), 4 (Curio, hues fanned 150°), 5 (Marvel), 8 (Magnum Opus).
- **Revised the same day (user):** the ripples only moved outward, and the facets floated apart. Curio is now an **artifact**, smaller (radius ~65 vs. 92): a polygonal plate inlaid with two rings of irregular, sheened polygons, crowned with rays, so everything is connected. The motion flows: a bulge travels round each ring (each piece breathes a little after its neighbor) while plate, outer ring and inner ring turn slowly in alternating directions.

- **Market:** a smooth visual ladder makes each rank-up feel earned and readable in a screenshot. Simple shapes become shiny shapes, then light (gas), then a perfect figure (rose).
- **Game design:** the jump from solid polygons to a glowing attractor was too big. Curio now borrows motion (ripples) and shine from Marvel while keeping Trinket's polygon language.
- **Jam:** the art is pure SVG and CSS, about 50 small paths, so it's cheap on phones. With reduced motion, the rings rest as concentric circles.

### 4.13 More varied menu palettes (2026-10-28)

**The change.**
- 13 of 21 palettes had near-white backgrounds. Seven now use saturated backgrounds: Candy Shop pink, Terracotta Sun rust, Matcha Latte green, Citrus Pop yellow, Dusty Rose mauve, and Ocean Blue (formerly Ocean Pastel).
- Four new palettes: Tomato Soup (red), Mint Julep (teal), Grape Soda (purple) and Cobalt Night (navy).
- 25 palettes in total: 7 light, 10 colored, 8 dark. All pass the WCAG 4.5:1 test for body text and button labels.

- **Market:** bold, saturated pages read as "full of colors" at a glance in screenshots and store-style thumbnails. Pale cream pages look like every other web game.
- **Game design:** every page visit now feels different, which supports the tagline. The hunt screen stays neutral grey, so judging color is unaffected.
- **Jam:** helps art & polish. No assets, and nothing to download.

### 4.12 Even wider ranks: 2 / 5 / 15 / 30 / 40 (2026-10-28)

**The change (the user's call).** Flawless ≤ 2, Harmonious ≤ 5, Kindred ≤ 15, Wavering ≤ 30, Awry ≤ 40, Botched beyond.

**Measured:** the best grey (ΔE 16.8–29.5) now scores **Wavering, 30 points**, on 53 of 55 colors. On Steel Blue it's Kindred (60), and on Charcoal Harmonious (85). Botched now needs a clearly opposite color (teal vs. orange is about ΔE 48).

- **Market:** generous scoring suits casual players and first-session judges. Krillion's Plankton is common, though; here the bottom two ranks will be rare.
- **Game design:**
  - **Risk: "point the camera at any grey wall" earns 30 × 5 = 150 points, which is Curio.** If playtests show players doing that, pull Wavering back to ≤ 16, which makes greys Awry. Another option is to raise the Curio threshold above 150.
  - **Upside:** Flawless ≤ 2 makes the top rank reachable with care, not luck.
  - **Craft thresholds** (150 / 275 / 400) will be easier to reach. Retune after playtests.
- **Digit7 Jam:** retention and fun benefit from frequent good results. Originality and skill expression suffer if the color hunt stops mattering, so watch the grey case.

### 4.11 Five colors, four crafts, wide ranks (2026-10-28)

**The change (the user's calls).**
- **Rank limits:** Flawless ≤ 1, Harmonious ≤ 3, Kindred ≤ 10, Wavering ≤ 15, Awry ≤ 30, Botched beyond.
- **5 colors per run** instead of 7. The operations are Calcination, Dissolution, Conjunction, Distillation and Coagulation; the tiers are Lead, Lead, Silver, Silver, Gold. Max total is 500.
- **4 craft ranks:** Trinket (0), Curio (150), Marvel (275), Magnum Opus (400). Prima Materia and Quintessence are gone.
- **Craft art:**
  - Trinket is unchanged.
  - Curio's polygons bud out of the core quickly, drift a little and fade, always overlapping the core.
  - Marvel is the Clifford attractor (formerly Quintessence), faster and shinier: the densest filaments burn toward white, with a stronger halo and more sparkles.
  - Magnum Opus uses curated, always-full Maurer roses (even n, so 2n petals all round), drawn bigger and brighter.
  - Colors climb from 2 to 3 to 5 to 8 per rank.

**What the new limits mean (measured).**
- The best grey is now **Awry (15 points) for 53 of 55 colors**, Wavering for Steel Blue and Harmonious for Charcoal. Under §4.8 a grey was Botched (10). The gap is only 5 points, so "any grey" stays a poor answer, but Botched now means a clearly wrong color.
- Kindred ≤ 10 covers the typical combined phone miss from §4.10 (ΔE 5.5), so a careful read now earns 60, not 30.

**Market**
- **Krillion** has 7 rounds. A 5-color run is shorter (about 5 minutes with reading time), which suits a jam judge's first session and a coffee-break daily.
- Four craft ranks are easier to remember and share than six, and each one looks clearly different.

**Game design**
- **Wider middle ranks** fit the hidden color (§4.7): players get rewarded for a good read instead of punished for camera drift. Flawless stays at ≤ 1, so the "once in a krillion" moment is still rare.
- **Craft thresholds** sit at average Wavering / Kindred / Harmonious per color. With the wider ranks, scores will rise, so check them in playtests: if most runs reach Marvel, raise them.
- Fewer, bigger art steps make each promotion feel like an event.

**Digit7 Jam**
- **Art & polish:** the attractor and the roses are the strongest visuals for screenshots and the demo video.
- **Technical performance:** Marvel's attractor is drawn just after it appears, one layer per task (no long tasks measured on desktop), and fades in. Magnum Opus is ~1 ms.
- Saved tuner values from older defaults are dropped automatically, because their signature no longer matches.

### 4.10 Retuning for the hidden color: the tuner shows combined misses (2026-10-28)

**The change.**
- Since §4.7 the extracted color is hidden until after the snap, so players can't fine-tune against a live swatch. Their misses are bigger, and the tuning needs to be redone.
- A real capture is rarely off in one way only. It's usually a bit darker **and** duller **and** turned in hue. The old tuner showed one direction at a time, so its examples looked more generous than real play.
- The tuner now has:
  - a **mix explorer**: lightness, saturation and hue offsets set together, with the rank, the points and how the three parts add up;
  - three **rank maps**: real colors for every combination of two offsets, with rank letters and rank borders;
  - **"Two things off" / "All three off"** in the per-rank examples;
  - a breakdown of **live camera samples**, which can be loaded into the mix.

**What it shows (current values: kL 0.8, kC 1, kH 2; Kindred ≤ 5, Wavering ≤ 8, Awry ≤ 14).**
- Parts add in quadrature: three parts of 4.90 + 2.04 + 1.57 count as ΔE 5.53, not 8.5. Combined misses are *less* harsh than adding them up, but they still add.
- Teal shot 4 L* darker, 14% duller and 8° toward blue (a typical indoor phone capture) is **Wavering, 30 points**. Lightness alone is 4.90 of it, because kL 0.8 is strict.
- At the Kindred edge (ΔE 5), "all three off" means only about L ±3.8, C ±3.8, hue ±6°. With the color hidden, few players will be that close on purpose.

**Market**
- Krillion's sweet spot: most answers are mid-tier, top tiers are rare but reachable. If typical captures are Wavering/Awry, the game reads as "you're always wrong", which hurts sharing and day-2 return.

**Game design**
- Hiding the color moved skill from "adjust until the number is right" to "read the scene and commit". The scale should reward a good read, so the middle ranks need to be wider than when players could watch the swatch.
- **Candidates to try in the tuner (not applied):**
  - kL 0.8 → 1, so lightness is no stricter than standard. The miss above becomes ΔE 4.69, Kindred.
  - Kindred ≤ 5 → 6 and Wavering ≤ 8 → 10.
  - Keep Awry ≤ 14, so a grey stays Botched. A grey's distance comes from chroma and hue, so changing kL doesn't affect it.
- **Suggested, not added:** a "combination" knob, a Minkowski exponent instead of the fixed square root. Higher is gentler on misses spread over several parts, lower is harsher. Also an expected-score simulation from a typical camera error model. Both wait for the user.

**Digit7 Jam**
- **Retention and fun** are judged, and both depend on players feeling their good reads pay off. Tune with the live camera on real phones before the deadline.
- The tuner stays out of the jam build. No new runtime code in the game except the parts function in `cielab.ts` (`ciede2000` returns exactly what it did, and the Sharma tests still pass).

### 4.9 "Prima Materia" instead of Gunk; mathematical crafts (options) (2026-10-28)

**The change.**
- **The lowest craft rank is no longer a failure.** "Gunk" ("a bubbling failure") is now **Prima Materia**, "a starter batch". In alchemy, the prima materia is the raw first matter that every Great Work starts from, so it pairs with Magnum Opus at the top.
- **Proposed, not built yet: crafts drawn from mathematical curves** instead of hand-placed shapes. Each rank uses a richer formula. Candidates, previewed with the game's palettes:

| Family | Formula | Fit |
|---|---|---|
| Lissajous | x = sin(at + δ), y = sin(bt) | Simple ratios give simple loops: a good first rank. |
| Rose (rhodonea) | r = cos(kθ) | k sets the petal count; integer k gives clean flowers. |
| Spirograph (hypotrochoid) | a circle rolling inside a circle | Instantly familiar and loved. Parameters give endless variety. |
| Maurer rose | chords across a rose at d° steps | Dense and lacy. Looks "advanced". |
| Superformula (Gielis) | one formula for stars, flowers, shells | Filled, bold shapes that read well when small. |
| Phyllotaxis (Vogel) | seeds at the golden angle, 137.5° | A sunflower head. Good as a glowing core. |
| Harmonograph | damped pendulums | Beautiful but hard to keep pretty with random parameters. |
| Chladni figure | nodal lines of a vibrating plate | Striking, but needs a field evaluated per pixel. |
| Clifford attractor | iterated map, ~100k points | Gorgeous, but canvas-only and unpredictable with random parameters. |
| Modular times table | connect k → 2k mod N | A cardioid. Similar in feel to the Maurer rose. |
| Koch snowflake | fractal edges | Static. Reads as a snowflake more than a craft. |
| Golden spiral | r = φ^(2θ/π) | Elegant but thin when small. Best as an accent. |

**Recommended progression** (one more layer per rank, so a better run visibly holds more mathematics):
Prima Materia = one Lissajous loop → Trinket = a 3-petal rose → Curio = a spirograph → Marvel = a Maurer rose → Quintessence = a superformula bloom around golden-angle seeds → Magnum Opus = a spirograph halo, a Maurer rose and a sunflower core.
Each render picks random parameters within its rank's range (petal counts, ratios, d°) plus a random palette, so no two crafts are alike. The curves can **draw themselves in** (SVG stroke animation) when the craft is revealed or promoted.

**Market**
- "Generative math art" is a proven aesthetic: spirograph toys, Maurer roses and phyllotaxis posts do well on social media, and they screenshot well. That suits the share-and-show loop of a daily color game.
- Removing "failure" from the bottom rank follows the cozy-game trend: low results are framed as a beginning, not a loss. Krillion does the same with its humorous lowest depth.

**Game design**
- **Complexity tracks skill.** Abstract shapes said "better" through count and symmetry. Curves say it through *structure*, which reads faster: one line → a flower → a lace mandala.
- **Reward without punishment:** a bad run still produces a pretty object, a single clean curve. That keeps players who score low coming back, and it matches "is your life full of colors?".
- **Suggested, not added:** paint the final craft with the 7 colors the player actually extracted instead of a random palette. The craft would become a personal record of the run. That's a feature, so it waits for the user's call.

**Digit7 Jam**
- **Art & polish / originality:** procedural math art gives polished, unique visuals with no asset files and no credits to declare.
- **Performance:** keep to SVG paths and circles (a spirograph is ~2,000 points; a Maurer rose 361 chords; phyllotaxis ~400 dots). These are cheap on phones and animate with CSS. Skip the attractor and the Chladni figure: they need canvas and many points, and random parameters can make them ugly.
- **Risk:** low, because the change is confined to `src/ui/craft.ts`. Reduced motion shows the finished curves without the draw-in.

### 4.8 Hue weight 2, tighter Wavering/Awry so greys are Botched (2026-10-28)

**The change.**
- kH 4 → **2** (still only for hue shifts ≤ 30°, easing to standard by 75°). kC stays 1 (standard).
- **Wavering ≤ 10 → ≤ 8, Awry ≤ 20 → ≤ 14.**
- Before, a grey object earned Awry (15 points) on many colors, so "any grey" was a safe fallback and Botched almost never happened.

**Measured:** under these weights, the closest possible grey (same lightness, zero chroma) is at ΔE 14.1–29.5 from every color except Charcoal, with a median of 24.9 and 17.6+ for 9 colors in 10. With Awry ≤ 14, **a grey is Botched for every color except Charcoal**. A test enforces this for all 55 colors.

- **Market:** the Krillion tiers only feel meaningful if the bottom tier happens. Plankton is Krillion's "obvious answer"; our "obvious answer" is grey, and now it lands there.
- **Game design:** the ladder is denser at the top: Flawless 1, Harmonious 2.5, Kindred 5, Wavering 8, Awry 14. A miss in the right color family still earns 15–30, but a colorless capture earns 10. The weakest colors (Steel Blue, Denim, Beige, Baby Blue, Navy, Chocolate, Petrol) are close to grey by nature; their grey margin is small, so watch them in playtests.
- **Jam:** no change to assets or tech. Saved tuner values are now ignored automatically when the defaults in `tuning.ts` change, so phones that tuned before see the new defaults after deploying.

### 4.7 Generous on hue, stricter on lightness, Krillion's exact points, hidden extraction (2026-10-28)

**The change.**
- **Hue is much more generous**, but only for *small* shifts. CIEDE2000's hue weight kH = 4 applies to hue differences up to 30°, then eases back to standard by 75°.
  - A hue shift that standard CIEDE2000 rates Wavering (ΔE ≈ 10) is now Harmonious (≈ 2.5).
  - A clearly different hue (teal vs. orange) is still Awry or Botched.
  - A plain kH = 4 was tried first. The tuner showed it made *every* hue at most Wavering, so a near-miss and a wrong color scored the same.
- **Lightness is a little stricter**: kL = 0.8, so lighter/darker differences count 1.25×.
- **Krillion's exact scoring.** Per color: Flawless 100, Harmonious 85, Kindred 60, Wavering 30, Awry 15, Botched 10 (One in a Krillion, Deep Cut, Rare, Schooler, Too Clever, Plankton). Running out of time scores **0**, like Krillion's unanswered prompt: the machine "runs dry". The run total, max 700, drives the craft, like Krillion's total drives depth.
  - Craft thresholds are now 150 / 250 / 380 / 500 / 620. Krillion doesn't publish its depth-zone thresholds, so these are ours.
  - Sources: [aiidelist guide](https://aiidelist.com/blog/krillion-game-guide-how-to-play-rare-answers), [SimilarLabs](https://similarlabs.com/p/krillion).
- **The extracted color is hidden while hunting** (a "?" swatch). After the snap the frame freezes and the machine *blends*: its contents become a mosaic of shrinking resolution (mixed in linear light, like the scorer) down to one cell, the exact extracted color. Only then does the player see it.

**Market**
- Krillion's discrete tiers make results instantly comparable and shareable ("I got 2 Harmonious and a Flawless"). The exact point values make the Krillion lineage obvious to anyone who plays it.
- The blend reveal is a strong "moment" for screenshots and the demo video: a frozen photo dissolving into one color.

**Game design**
- **Hue leniency fits the fantasy**: "teal-ish blue-green" feels like teal to a person, so small hue errors shouldn't cost much. Lightness is the dimension players *can* control physically (shade, angle, distance), so it's fair to be stricter there.
- **Discrete points make every rank feel distinct**, and the gaps reward pushing one rank higher (30 → 60 for Wavering → Kindred). The continuous ΔE is still shown for players who want precision.
- **Hiding the live color restores judgement and suspense.** The player must read the scene with their own eyes and commit, then watch the verdict form. It's harder, which matches the "once in a krillion" goal, and the reveal itself becomes a payoff.
- **The 0 on timeout makes the clock real.** Before, time running out still extracted something worth 10+.

**Digit7 Jam**
- No new assets or network. The tuner remains a test-build-only tool; the jam build uses `tuning.ts`.
- **Retune after real playtests:** the craft thresholds assume typical Kindred/Wavering results. Use the tuner's live camera check on a phone before freezing them.

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
