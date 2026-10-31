// Seven Colors: one screen for the whole run. Each section: intro → hunt (live
// camera, the color extracting machine framed in the target color, zoom, on the
// clock) → snap → extraction → result sheet (precise judgement + the craft grows).
// The whole camera view is the machine: a frame with pipes into the square. After a
// color's result, the last three ranks may set off a reaction (reaction.ts).

import { muteButton, onKeys, show } from '../app';
import { camera } from '../camera/camera';
import { Viewfinder } from '../camera/viewfinder';
import { cameraSource, canvasSource, captureView, imageToCanvas, meanOfRect, squareRect, viewRect, type FrameSource } from '../camera/source';
import { hexToOklab, mixLab, oklabToHex } from '../color/oklab';
import { centerOf, floatText, fx, shake } from '../ui/fx';
import type { ColorDef } from '../data/colors';
import { SEVEN, TUNING } from '../data/tuning';
import { mulberry32 } from '../meta/rng';
import { paintPracticeCanvas } from '../practice/plates';
import { craftTierFor, machineRect, mosaic } from '../scoring/extract';
import { NO_EDITS, type Plate } from '../color/plate';
import { h, toast, fmt, wait, reducedMotion } from '../ui/dom';
import { stamp, swatch } from '../ui/components';
import { POTION_BLURBS, potionSvg } from '../ui/potion';
import { applyPaletteTo, paletteFor } from '../ui/palettes';
import { goSevenSummary, quitSeven } from '../flow';
import { sfx, vibrate } from '../audio/sfx';
import { dealSection, finishSection, OPERATIONS, runTotal, type Section, type SevenRun } from './run';
import { findReaction, ingredientNeeds, makeReaction, REACTION_NAMES, type Reaction, type ReactionKind } from './reaction';
import { reactionView, type ReactionView } from './reaction-view';

const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'];

/**
 * Dev only, to try reactions quickly: `?react` sets one off after every color (each kind in
 * turn when the ranks set nothing off); `?react=equilibrium` (or sublimation, precipitation)
 * always that kind, over the last three colors.
 */
const FORCE_REACTION = import.meta.env.DEV && new URLSearchParams(location.search).has('react');
const FORCE_KIND = FORCE_REACTION ? (new URLSearchParams(location.search).get('react') as ReactionKind | '') : '';

interface PhotoDeck {
  urls: string[];
  index: number;
}

async function loadPhotoDeck(): Promise<PhotoDeck> {
  try {
    const res = await fetch('./test-photos/manifest.json');
    const list = (await res.json()) as { file?: unknown }[];
    // Skip malformed entries: one bad file name would fail to decode and stall the section.
    const urls = list.filter((x) => typeof x.file === 'string').map((x) => `./test-photos/${x.file}`);
    for (let i = urls.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [urls[i], urls[j]] = [urls[j], urls[i]];
    }
    return { urls, index: 0 };
  } catch {
    return { urls: [], index: 0 };
  }
}

export function sevenScreen(r: SevenRun): void {
  show((screen) => {
    let src: FrameSource | null = null;
    let deck: PhotoDeck | null = null;
    let zoom: number = SEVEN.zoomMin;
    let cx = 0.5;
    let cy = 0.5;
    let phase: 'intro' | 'hunt' | 'capturing' | 'result' | 'reaction' | 'done' = 'intro';
    let reacting: ReactionView | null = null;
    let remaining: number = SEVEN.seconds;
    let lastT = performance.now();
    let lastTick = Math.ceil(remaining);
    let lastSwatch = 0;
    let hidden = false;
    let raf = 0;
    let resultAt = 0;
    const timers: number[] = [];
    const later = (ms: number, fn: () => void) => timers.push(window.setTimeout(fn, reducedMotion() ? Math.min(ms, 120) : ms));

    // --- DOM ----------------------------------------------------------------------
    const segments = Array.from({ length: SEVEN.sections }, () => h('span'));
    const spectrum = h('div', { class: 'spectrum', 'aria-hidden': 'true' }, ...segments);
    const stageEl = h('span', { class: 'stage-label' });
    const timerEl = h('span', { class: 'timer' });

    const targetSw = h('span', { class: 'big-sw target' });
    // The extracted color stays a mystery until the machine blends it (after the snap).
    const yoursSw = h('span', { class: 'big-sw yours mystery' }, '?');
    const nameEl = h('span', { class: 'tg-name' });
    const target = h(
      'div',
      { class: 'tg' },
      h('figure', null, targetSw, h('figcaption', null, 'target')),
      h('div', { class: 'tg-body' }, nameEl),
      h('figure', null, yoursSw, h('figcaption', null, 'extracted')),
    );

    const vfCanvas = h('canvas', { class: 'vf-canvas', 'aria-label': 'Camera view' });
    const retFill = h('span', { class: 'ret-in' });
    const reticle = h('div', { class: 'reticle', 'aria-hidden': 'true' }, retFill);
    // The machine's nameplate, on its bottom pipe by the frame (clear of the side bars).
    const nameplate = h('span', { class: 'ret-label', 'aria-hidden': 'true' }, 'color extracting machine');
    const warn = h('div', { class: 'scene-warning', hidden: true }, 'Too dark for alchemy. Find some light.');
    const intro = h('div', { class: 'vf-overlay intro', hidden: true });
    // The frame, pipes and joints of the machine (drawn to size in layout()).
    const machine = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    machine.classList.add('machine');
    machine.setAttribute('aria-hidden', 'true');
    const viewport = h('div', { class: 'viewport seven-vp' }, vfCanvas, reticle, machine, nameplate, warn, intro);
    const stageWrap = h('div', { class: 'stage-wrap' }, viewport);
    const vf = new Viewfinder(vfCanvas);
    if (!vf.ok) viewport.classList.add('no-gl');

    // The result sheet rises over the hunt with its own palette.
    const sheetInner = h('div', { class: 'sheet-inner' });
    const sheet = h('div', { class: 'sheet', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Result', hidden: true }, sheetInner);
    applyPaletteTo(sheet, paletteFor('result'));

    const zoomOut = h('output', null, '1.0×');
    const zoomInput = h('input', { type: 'range', min: String(SEVEN.zoomMin), max: String(SEVEN.zoomMax), step: '0.01', value: '1', 'aria-label': 'Zoom' }) as HTMLInputElement;
    zoomInput.addEventListener('input', () => setZoom(Number(zoomInput.value)));
    const zoomRow = h('label', { class: 'slider zoom' }, h('span', { class: 's-label' }, '⌕ Zoom'), zoomInput, zoomOut);
    const huntHelp =
      r.mode === 'camera' ? 'Hold things up to the camera · Space: extract · +/−: zoom · Esc: quit' : 'Drag or arrows: aim · Space: extract · +/−: zoom · Esc: quit';
    const deskHelp = h('p', { class: 'desk-only muted small' }, huntHelp);

    const shutter = h('button', { class: 'shutter', type: 'button', 'aria-label': 'Extract (Space)', onclick: () => void snap() }, h('span'));
    const flipBtn = h(
      'button',
      {
        class: 'btn ghost small',
        type: 'button',
        hidden: r.mode !== 'camera' || camera.deviceCount < 2,
        onclick: async () => {
          if (await camera.flip()) toast('Couldn’t switch cameras.');
        },
      },
      '⇆ Flip',
    );
    // Practice from your gallery (photo mode): the player picks a photo from their device. The
    // clock waits until there is one (dev builds also start with a test photo, and offer Next).
    const fileInput = h('input', { type: 'file', accept: 'image/*', hidden: true }) as HTMLInputElement;
    const pickBtn = h('button', { class: 'btn ghost small', type: 'button', title: 'Pick a photo from your gallery', onclick: () => fileInput.click() }, 'Pick photo');
    const photoBtns = h(
      'div',
      { class: 'row tight', hidden: r.mode !== 'photo' },
      import.meta.env.DEV ? h('button', { class: 'btn ghost small', type: 'button', title: 'Next test photo (N)', onclick: () => void nextPhoto() }, 'Next ▸') : null,
      pickBtn,
      fileInput,
    );
    const pickPrompt = h(
      'div',
      { class: 'vf-overlay pick', hidden: true },
      h('p', null, 'Pick a photo from your gallery with this color in it.'),
      h('button', { class: 'btn primary', type: 'button', onclick: () => fileInput.click() }, 'Pick a photo'),
      h('p', { class: 'small' }, 'The clock starts when it’s in.'),
    );
    viewport.append(pickPrompt);
    fileInput.addEventListener('change', async () => {
      const f = fileInput.files?.[0];
      fileInput.value = ''; // so the same photo can be picked again later
      if (!f) return;
      const url = URL.createObjectURL(f);
      try {
        setSource(canvasSource(await imageToCanvas(url)));
      } catch {
        toast('Couldn’t open that image. Try another one.');
      } finally {
        URL.revokeObjectURL(url);
      }
    });

    screen.classList.add('hunt', 'seven');
    screen.append(
      spectrum,
      h(
        'div',
        { class: 'topbar' },
        h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Quit run', onclick: () => void quitSeven() }, '✕'),
        stageEl,
        h('div', { class: 'row tight' }, timerEl, muteButton()),
      ),
      h(
        'div',
        { class: 'hunt-layout' },
        h(
          'div',
          { class: 'hunt-side' },
          target,
          zoomRow,
          deskHelp,
        ),
        h(
          'div',
          { class: 'hunt-main' },
          stageWrap,
          h('div', { class: 'hunt-controls' }, h('div', { class: 'side' }, photoBtns), shutter, h('div', { class: 'side right' }, flipBtn)),
        ),
      ),
      sheet,
    );

    // --- helpers -------------------------------------------------------------------
    const view = () => viewRect(zoom, cx, cy);

    function layout(): void {
      const aspect = src && src.width() ? src.width() / src.height() : 3 / 4;
      const bw = stageWrap.clientWidth;
      const bh = stageWrap.clientHeight;
      if (!bw || !bh) return;
      let w = bw;
      let hh = bw / aspect;
      if (hh > bh) {
        hh = bh;
        w = bh * aspect;
      }
      viewport.style.width = `${Math.floor(w)}px`;
      viewport.style.height = `${Math.floor(hh)}px`;
      const side = Math.min(w, hh) * SEVEN.squareFraction;
      reticle.style.width = reticle.style.height = `${Math.round(side)}px`;
      drawMachine(Math.floor(w), Math.floor(hh), Math.round(side));
    }

    /**
     * The whole view as one machine: a frame round the camera in the target color, and
     * pipes from all four sides of the frame into the square (the extracted blob leaves
     * by the top pipe).
     */
    function drawMachine(W: number, H: number, S: number): void {
      const mx = W / 2;
      const my = H / 2;
      const xL = mx - S / 2;
      const xR = mx + S / 2;
      const m = 5; // frame inset
      const pipe = (x1: number, y1: number, x2: number, y2: number) => {
        const d = `M${x1.toFixed(1)},${y1.toFixed(1)}L${x2.toFixed(1)},${y2.toFixed(1)}`;
        return `<path class="pipe-o" d="${d}"/><path class="pipe-i" d="${d}"/>`;
      };
      const joints = [
        [m, my],
        [W - m, my],
        [mx, m],
        [mx, H - m],
        [xL, my],
        [xR, my],
        [mx, my - S / 2],
        [mx, my + S / 2],
      ];
      const L = Math.min(28, W * 0.09);
      const brackets = `M${m},${m + L}V${m}H${m + L}M${W - m - L},${m}H${W - m}V${m + L}M${W - m},${H - m - L}V${H - m}H${W - m - L}M${m + L},${H - m}H${m}V${H - m - L}`;
      machine.setAttribute('viewBox', `0 0 ${W} ${H}`);
      // The view outside the square is dimmed a little, so the eye goes to the square.
      const hole = `M${xL},${my - S / 2}H${xR}V${my + S / 2}H${xL}Z`;
      machine.innerHTML =
        `<path class="shade" fill-rule="evenodd" d="M0,0H${W}V${H}H0Z${hole}"/>` +
        `<rect class="frame-o" x="${m}" y="${m}" width="${W - 2 * m}" height="${H - 2 * m}" rx="14"/>` +
        `<rect class="frame-i" x="${m}" y="${m}" width="${W - 2 * m}" height="${H - 2 * m}" rx="14"/>` +
        pipe(m, my, xL, my) +
        pipe(xR, my, W - m, my) +
        pipe(mx, m, mx, my - S / 2) +
        pipe(mx, my + S / 2, mx, H - m) +
        `<path class="bracket" d="${brackets}"/>` +
        joints.map(([x, y]) => `<circle class="joint" cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="4.5"/>`).join('');
    }

    const ro = new ResizeObserver(layout);
    ro.observe(stageWrap);

    function setSource(next: FrameSource): void {
      // Keep the camera <video> in the DOM (iOS only decodes visible videos).
      viewport.querySelectorAll('.src-el').forEach((e) => e !== next.el && e.remove());
      src = next;
      next.el.classList.add('src-el');
      if (next.el.parentElement !== viewport) viewport.prepend(next.el);
      cx = 0.5;
      cy = 0.5;
      layout();
      updatePickPrompt();
    }

    /** Gallery practice: ask for a photo while hunting without one. */
    function updatePickPrompt(): void {
      pickPrompt.hidden = !(r.mode === 'photo' && !src && phase === 'hunt');
      pickBtn.textContent = src ? 'Change photo' : 'Pick photo';
    }

    function setZoom(z: number): void {
      zoom = Math.min(SEVEN.zoomMax, Math.max(SEVEN.zoomMin, z));
      zoomInput.value = String(zoom);
      zoomOut.textContent = `${zoom.toFixed(1)}×`;
    }

    function clampCenter(): void {
      // Image sources: the machine may reach any part of the image, so the view may pass the edges.
      cx = Math.min(1, Math.max(0, cx));
      cy = Math.min(1, Math.max(0, cy));
    }

    function paintTarget(def: ColorDef): void {
      targetSw.style.background = def.target;
      // The whole machine (frame, pipes, bars, square) is drawn in the target color.
      viewport.style.setProperty('--ing', def.target);
      nameEl.textContent = def.name;    }

    function paintSpectrum(): void {
      segments.forEach((s, i) => {
        s.style.background = r.sections[i]?.hex ?? '';
        s.classList.toggle('current', i === r.index);
      });
    }

    async function prepareSource(def?: ColorDef): Promise<void> {
      if (r.mode === 'camera') {
        if (!src || src.el !== camera.video) setSource(cameraSource());
        void camera.video.play().catch(() => undefined);
      } else if (r.mode === 'practice' && def) {
        const rng = mulberry32((r.seed ^ ((r.index + 1) * 2654435761)) >>> 0);
        setSource(canvasSource(paintPracticeCanvas(rng, def).canvas));
      } else if (!src && import.meta.env.DEV) {
        await nextPhoto();
      }
    }

    /** Dev builds only: the next photo from test-photos/ (never shipped in the jam build). */
    async function nextPhoto(): Promise<void> {
      if (!import.meta.env.DEV) return;
      deck ??= await loadPhotoDeck();
      if (!deck.urls.length) {
        toast('No test photos found. Use Pick photo to load an image.');
        return;
      }
      const url = deck.urls[deck.index++ % deck.urls.length];
      setSource(canvasSource(await imageToCanvas(url)));
    }

    // --- section flow ---------------------------------------------------------------
    async function startSection(): Promise<void> {
      const def = dealSection(r);
      paintTarget(def);
      paintSpectrum();
      setZoom(SEVEN.zoomMin);
      remaining = SEVEN.seconds;
      lastTick = Math.ceil(remaining);
      timerEl.textContent = fmtTime(remaining);
      timerEl.classList.remove('urgent');
      reticle.querySelector('.ret-gather')?.remove();
      reticle.querySelector('.ret-blob')?.remove();
      yoursSw.style.background = '';
      yoursSw.classList.add('mystery');
      yoursSw.textContent = '?';
      stageEl.textContent = `${ROMAN[r.index]} · ${OPERATIONS[r.index]} · ${r.index + 1}/${SEVEN.sections}`;
      await prepareSource(def);
      phase = 'intro';
      intro.replaceChildren(
        h('p', { class: 'eyebrow' }, `${ROMAN[r.index]} · ${OPERATIONS[r.index]}`),
        h('p', { class: 'intro-find' }, 'extract'),
        h('span', { class: 'intro-sw', style: { background: def.target } }),
        h('h2', { class: 'intro-name' }, def.name),
        h('p', { class: 'small' }, r.index === 0 && r.tutorial ? 'Your jeans will do: fill the square with Denim.' : 'Fill the square with it. Blend colors if you must.'),
      );
      intro.hidden = false;
      sfx.clink(r.index);
      // The target color splashes in.
      requestAnimationFrame(() => {
        const sw = intro.querySelector('.intro-sw');
        if (!sw) return;
        const c = centerOf(sw);
        fx.splash(c.x, c.y, def.target, 22);
        fx.burst(c.x, c.y, [def.target], { count: 12, speed: 170, size: 5, gravity: 0 });
      });
      await wait(reducedMotion() ? 400 : SEVEN.introMs);
      if (phase === 'intro') beginHunt();
    }

    function beginHunt(): void {
      intro.hidden = true;
      phase = 'hunt';
      lastT = performance.now();
      updatePickPrompt();
      shutter.disabled = false;
      reticle.classList.remove('ret-go');
      void reticle.offsetWidth;
      reticle.classList.add('ret-go');
    }

    /** `timedOut`: the clock ran out, so the machine extracts on its own, from wherever the player left it. */
    async function snap(timedOut = false): Promise<void> {
      if (phase === 'intro') return beginHunt();
      if (phase === 'result') return advance();
      if (phase !== 'hunt') return;
      if (!src) {
        toast('Pick a photo first.');
        return;
      }
      if (!src.ready()) {
        if (timedOut) return runDry();
        toast('The camera is still waking up…');
        return;
      }
      phase = 'capturing';
      shutter.disabled = true;
      sfx.shutter();
      vibrate(20);
      viewport.classList.add('flash');
      // The camera registering the press: a small dip down and back, not a shake. The class
      // comes off right after, so it never hides the "urgent" pulse of the next color.
      if (!reducedMotion()) {
        viewport.classList.remove('snap-dip');
        void viewport.offsetWidth;
        viewport.classList.add('snap-dip');
        later(320, () => viewport.classList.remove('snap-dip'));
      }
      const plate = await captureView(src, view(), SEVEN.viewShortSide, TUNING.framesAveraged);
      viewport.classList.remove('flash');
      if (!plate) {
        phase = 'hunt';
        if (timedOut) return runDry();
        shutter.disabled = false;
        toast('Capture failed. Try again.');
        return;
      }
      const before = runTotal(r);
      const sec = finishSection(r, plate, zoom);
      blendReveal(plate, sec, before);
    }

    /** Time's up: the machine extracts what's in it right now (aim and zoom as left). */
    function timeUp(): void {
      if (phase !== 'hunt') return;
      timerEl.textContent = '0:00';
      toast('Time’s up! The machine extracts what’s in the square.');
      void snap(true);
    }

    /** Only if the timed-out capture itself fails: nothing extracted, 0 points. */
    function runDry(): void {
      phase = 'capturing';
      shutter.disabled = true;
      sfx.error();
      shake(viewport, 'soft');
      const before = runTotal(r);
      const sec = finishSection(r, null, zoom);
      phase = 'result';
      viewport.classList.remove('urgent');
      later(500, () => showResult(sec, before, centerOf(reticle)));
    }

    /**
     * The reveal: the frame freezes and everything inside the machine comes together at
     * once, swirling into a round blob of the extracted color at the very center, which
     * flies straight into the extracted swatch. Only then does the player see what they
     * caught.
     */
    function blendReveal(plate: Plate, sec: Section, before: number): void {
      phase = 'result';
      viewport.classList.remove('urgent');
      if (reducedMotion()) {
        revealSwatch(sec);
        later(400, () => showResult(sec, before, centerOf(yoursSw)));
        return;
      }
      // 1. Everything in the square comes together at once: the frozen contents swirl and
      //    shrink into a round blob at the very center, melting into the one extracted color.
      const n = machineRect(plate).side;
      const cv = h('canvas', { class: 'ret-gather' });
      cv.width = cv.height = n;
      cv.getContext('2d')!.putImageData(new ImageData(mosaic(plate, n), n, n), 0, 0);
      const blob = h('span', { class: 'ret-blob', style: { background: sec.hex, opacity: '0' } });
      reticle.append(cv, blob);
      const gather = { duration: 760, easing: 'cubic-bezier(.55,0,.35,1)', fill: 'forwards' as FillMode };
      cv.animate(
        [
          { transform: 'scale(1) rotate(0deg)', borderRadius: '2px', opacity: 1 },
          { transform: 'scale(0.6) rotate(70deg)', borderRadius: '30%', opacity: 1, offset: 0.5 },
          { transform: 'scale(0.36) rotate(160deg)', borderRadius: '50%', opacity: 0 },
        ],
        gather,
      );
      blob.animate(
        [
          { transform: 'scale(1)', borderRadius: '2px', opacity: 0 },
          { transform: 'scale(0.6)', borderRadius: '30%', opacity: 0.35, offset: 0.5 },
          { transform: 'scale(0.36)', borderRadius: '50%', opacity: 1 },
        ],
        gather,
      );
      later(gather.duration, () => cv.remove());
      // 2. The blob flies straight into the extracted swatch.
      later(gather.duration + 120, () => {
        const from = centerOf(blob);
        blob.remove();
        dropInto(from, yoursSw, sec.hex, () => {
          revealSwatch(sec);
          later(650, () => showResult(sec, before, centerOf(yoursSw)));
        });
      });
    }

    /** The extracted color, at last, in the panel. */
    function revealSwatch(sec: Section): void {
      yoursSw.classList.remove('mystery');
      yoursSw.textContent = '';
      yoursSw.style.background = sec.hex;
      yoursSw.classList.remove('sw-pop');
      void yoursSw.offsetWidth;
      yoursSw.classList.add('sw-pop');
      sfx.pop(3);
      const c = centerOf(yoursSw);
      fx.burst(c.x, c.y, [sec.hex], { count: 18, speed: 150, size: 6, gravity: 0 });
    }

    function showResult(sec: Section, before: number, dropFrom: { x: number; y: number }): void {
      paintSpectrum();
      resultAt = performance.now();
      const last = r.index + 1 >= SEVEN.sections;
      const power = Math.max(0, SEVEN.colorTiers.length - 1 - sec.tierIndex); // 0 = Botched/Empty … 5 = Flawless
      const scoreEl = h('span', { class: 'res-acc mono' }, '0');
      const stampEl = stamp(sec.tier, 'slam');
      stampEl.hidden = true;
      const prevCraft = craftTierFor(before);
      const craftStage = h('div', { class: 'craft-stage' });
      // The potion is drawn in the result sheet's palette.
      craftStage.innerHTML = potionSvg(prevCraft.index, paletteFor('result'));
      const craftName = h('p', { class: 'craft-name' }, r.index === 0 ? 'your potion begins' : prevCraft.name);
      const craftBlurb = h('p', { class: 'craft-blurb' }, r.index === 0 ? '' : POTION_BLURBS[prevCraft.index]);
      const barFill = h('i');
      const barLabel = h('span', { class: 'bar-label mono' });
      const nextBtn = h('button', { class: 'btn primary xl res-next-btn', type: 'button', disabled: true, onclick: () => advance() }, last ? 'Reveal potion ▶' : 'Next ▶');
      paintBar(before, prevCraft);

      sheetInner.replaceChildren(
        h('p', { class: 'eyebrow' }, `${ROMAN[sec.index]} · ${OPERATIONS[sec.index]}`),
        sec.empty ? emptyMachine(sec) : colorRamp(sec),
        h('h2', { class: 'res-name' }, sec.def.name),
        h('div', { class: 'res-score' }, scoreEl, h('div', { class: 'res-stamp' }, stampEl)),
        h('p', { class: 'res-de mono' }, sec.empty ? 'nothing extracted' : `ΔE ${sec.dE.toFixed(2)}`),
        h(
          'div',
          { class: 'craft-panel' },
          craftStage,
          h('div', { class: 'craft-info' }, craftName, craftBlurb, h('div', { class: 'craft-bar' }, barFill), barLabel),
        ),
        nextBtn,
      );
      sheet.hidden = false;
      sheet.classList.remove('down');
      sheet.scrollTop = 0;
      sheetInner.scrollTop = 0;

      // 1. The score counts up and the rank stamp slams.
      later(450, () => countUp(scoreEl, sec.score, 700));
      later(1150, () => {
        // The quality stamp lands with its (tame, low) thunk; the celebrations stay silent (ANALYSIS §4.33).
        stampEl.hidden = false;
        sfx.stamp();
        const c = centerOf(stampEl);
        fx.burst(c.x, c.y, [sec.def.target, sec.hex], { count: 5 + power * 9, speed: 160 + power * 50, shapes: ['circle', 'star', 'square'] });
        if (power >= 4) shake(sheet, power === 5 ? 'hard' : 'soft');
        // Flawless: a celebration in the color itself and the sheet's palette.
        if (power === 5) fx.celebrate([sec.def.target, sec.hex, '#ffffff', ...paletteFor('result').accents]);
        const seg = segments[sec.index];
        seg.classList.remove('seg-pop');
        void seg.offsetWidth;
        seg.classList.add('seg-pop');
      });
      // 2. The extracted drop falls into the craft, which grows (or transforms).
      //    An empty machine has no drop: the craft just shrugs.
      later(1600, () => {
        if (sec.empty) {
          nudge(craftStage, false);
          craftName.textContent = craftTierFor(sec.total).name;
          craftBlurb.textContent = POTION_BLURBS[craftTierFor(sec.total).index];
          paintBar(sec.total, craftTierFor(sec.total), true);
          return;
        }
        dropInto(dropFrom, craftStage, sec.hex, () => {
          const now = craftTierFor(sec.total);
          const promoted = now.index !== prevCraft.index || r.index === 0;
          // The one sound of the potion: when the drop is in (the flight is silent).
          if (promoted) sfx.fanfare();
          else sfx.pop(3);
          const c = centerOf(craftStage);
          fx.burst(c.x, c.y, [sec.hex], { count: 16, speed: 200, size: 6 });
          floatText(c.x, c.y - 30, `+${sec.score}`, sec.hex);
          // The potion never vanishes: the drop lands with a nudge, and on a rank-up it turns
          // into the new potion in place, with a bigger nudge, when the bar reaches the end of
          // the old rank. Without a rank-up it stays the same potion.
          const filled = fillBar(before, sec.total);
          nudge(craftStage, false);
          later(filled || 320, () => {
            if (promoted) {
              craftStage.innerHTML = potionSvg(now.index, paletteFor('result'));
              nudge(craftStage, true);
            }
            craftName.textContent = now.name;
            craftBlurb.textContent = POTION_BLURBS[now.index];
            if (promoted) {
              craftName.classList.add('promoted');
              const cc = centerOf(craftStage);
              fx.burst(cc.x, cc.y, paletteFor('result').accents, { count: 30 + now.index * 8, speed: 300, shapes: ['star', 'circle'] });
              // The Elixir of Life: the Great Work is done.
              if (now.index === SEVEN.craftTiers.length - 1) fx.celebrate([...paletteFor('result').accents, '#ffffff']);
            }
          });
        });
      });
      later(2300, () => {
        nextBtn.disabled = false;
        nextBtn.focus();
      });

      /**
       * The bar fills toward the new total and never runs backwards: on a rank-up it fills
       * the old rank to the end, starts again from empty and fills the new rank up to the
       * total (60 + 60 with ranks every 100: 60 → 100, then 0 → 20). Returns when the bar
       * reached the new rank (ms), or 0 if the rank didn't change.
       */
      function fillBar(from: number, to: number): number {
        const start = craftTierFor(from).index;
        const end = craftTierFor(to).index;
        if (end === start) {
          paintBar(to, craftTierFor(to), true);
          return 0;
        }
        const step = 450;
        const setFill = (pct: number, ms: number) => {
          barFill.style.transition = ms ? `width ${ms}ms cubic-bezier(.4,0,.8,.6)` : 'none';
          barFill.style.width = `${pct}%`;
        };
        setFill(100, step);
        for (let i = start + 1; i <= end; i++) {
          later((i - start) * step, () => {
            setFill(0, 0);
            void barFill.offsetWidth; // commit the empty bar before filling again
            if (i < end) setFill(100, step);
            else paintBar(to, craftTierFor(to), true);
          });
        }
        return (end - start) * step;
      }

      function paintBar(total: number, tier: ReturnType<typeof craftTierFor>, animate = false): void {
        const lo = SEVEN.craftTiers[tier.index].min;
        const hi = tier.next?.min ?? SEVEN.sections * 100;
        barFill.style.transition = animate ? 'width .9s cubic-bezier(.2,.8,.2,1)' : 'none';
        barFill.style.width = `${Math.max(3, Math.min(100, ((total - lo) / Math.max(1, hi - lo)) * 100))}%`;
        barLabel.textContent = tier.next ? `${fmt(total)} · ${fmt(tier.next.min - total)} to ${tier.next.name}` : `${fmt(total)} · the finest potion`;
      }
    }

    /** A squash-and-wobble on the potion (restarts if it's already moving); `big` for a rank-up. */
    function nudge(el: HTMLElement, big: boolean): void {
      el.classList.remove('craft-nudge', 'craft-nudge-big');
      void el.offsetWidth;
      el.classList.add(big ? 'craft-nudge-big' : 'craft-nudge');
    }

    /** A drop of the extracted color arcs from the machine into the craft. */
    function dropInto(from: { x: number; y: number }, to: HTMLElement, color: string, done: () => void): void {
      const t = centerOf(to);
      if (reducedMotion()) return done();
      const drop = h('span', { class: 'fly-drop', style: { background: color, left: `${from.x}px`, top: `${from.y}px` } });
      document.body.append(drop);
      const dx = t.x - from.x;
      const dy = t.y - from.y;
      const anim = drop.animate(
        [
          { transform: 'translate(-50%, -50%) scale(1)' },
          { transform: `translate(calc(-50% + ${dx * 0.5}px), calc(-50% + ${dy * 0.5 - 90}px)) scale(1.3)`, offset: 0.5 },
          { transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) scale(0.5)` },
        ],
        { duration: 650, easing: 'cubic-bezier(.4,0,.6,1)' },
      );
      // Silent in flight: the sound comes when it lands (the caller's `done`).
      anim.onfinish = () => {
        drop.remove();
        done();
      };
    }

    function countUp(el: HTMLElement, to: number, ms: number): void {
      const t0 = performance.now();
      const step = (now: number) => {
        const t = Math.min(1, (now - t0) / ms);
        el.textContent = String(Math.round(to * (1 - Math.pow(1 - t, 3))));
        if (t < 1 && el.isConnected) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    }

    /**
     * Target → extracted as one continuous spectrum, blended in OKLab so it looks even
     * (CSS gradients would blend in sRGB and go muddy in the middle).
     */
    function colorRamp(sec: Section): HTMLElement {
      const a = hexToOklab(sec.def.target);
      const b = hexToOklab(sec.hex);
      const n = 12;
      const stops = Array.from({ length: n + 1 }, (_, k) => `${oklabToHex(mixLab(a, b, k / n))} ${((k / n) * 100).toFixed(1)}%`);
      return h(
        'div',
        { class: 'res-ramp', 'aria-label': 'A spectrum from the target to your color' },
        h('figure', null, swatch(sec.def.target), h('figcaption', null, 'target')),
        h('span', { class: 'ramp-steps' }, h('span', { class: 'ramp-flow', style: { background: `linear-gradient(to right, ${stops.join(', ')})` } })),
        h('figure', null, swatch(sec.hex), h('figcaption', null, 'extracted')),
      );
    }

    function emptyMachine(sec: Section): HTMLElement {
      return h(
        'div',
        { class: 'res-ramp empty' },
        h('figure', null, swatch(sec.def.target), h('figcaption', null, 'target')),
        h('span', { class: 'ramp-steps dry' }, h('span', { class: 'dry-text' }, 'the machine ran dry')),
        h('figure', null, swatch('transparent'), h('figcaption', null, 'nothing')),
      );
    }

    /** The player moves on when ready; never automatically. */
    function advance(): void {
      if (phase !== 'result') return;
      // Ignore taps in the first moment, so a double-tap on the shutter can't skip the result.
      if (performance.now() - resultAt < SEVEN.resultGuardMs) return;
      phase = 'capturing'; // in transit: ignore input until the next intro
      r.index++;
      sheet.classList.add('down');
      later(450, () => void next());
    }

    /** What each ingredient would do for a section's extract (semi-reactions favor what helps). */
    function needsOf(i: number): Record<string, number> {
      const s = r.sections[i];
      return s?.extracted ? ingredientNeeds(s.extracted.lin, s.def.target) : {};
    }

    /** After a color: a reaction if the latest qualities set one off, then the next color (or the summary). */
    async function next(): Promise<void> {
      sheet.hidden = true;
      const rx = (FORCE_KIND ? forcedReaction() : findReaction(r.sections, r.rng, needsOf)) ?? (FORCE_REACTION ? forcedReaction() : null);
      if (rx) {
        phase = 'reaction';
        reacting = reactionView(screen, r, rx, paintSpectrum);
        await reacting.done;
        reacting = null;
        phase = 'capturing';
      }
      if (r.index >= SEVEN.sections) {
        phase = 'done';
        goSevenSummary(r);
        return;
      }
      void startSection();
    }

    /** Dev `?react`: when the ranks set nothing off, each kind in turn on the latest extracts. */
    function forcedReaction(): Reaction | null {
      const n = r.sections.length;
      const kinds: [ReactionKind, number][] = [
        ['sublimation', 2],
        ['precipitation', 2],
        ['equilibrium', 3],
        ['sublimation', 3],
        ['precipitation', 3],
      ];
      const [kind, length] = FORCE_KIND && FORCE_KIND in REACTION_NAMES ? [FORCE_KIND, 3] : kinds[(n - 1) % kinds.length];
      const window = r.sections.slice(Math.max(0, n - length)).filter((s) => !s.empty);
      if (!window.length) return null;
      return makeReaction(kind, window.map((s) => s.index), window.map((s) => s.tier), r.rng, needsOf);
    }

    // --- loop ---------------------------------------------------------------------------
    const fmtTime = (s: number) => {
      const t = Math.max(0, Math.ceil(s));
      return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;
    };

    const fallbackStyle = () => {
      if (vf.ok || !src) return;
      const mirror = src.mirrored ? ' scaleX(-1)' : '';
      const el = src.el as HTMLElement;
      el.style.transform = `scale(${zoom}) translate(${(0.5 - cx) * 100}%, ${(0.5 - cy) * 100}%)${mirror}`;
    };

    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      const dt = (now - lastT) / 1000;
      lastT = now;
      // After the snap the view freezes (the last frame stays) while the machine blends.
      const live = phase === 'hunt' || phase === 'intro';
      if (src && live) {
        if (vf.ok) vf.render(src, view(), NO_EDITS);
        else fallbackStyle();
        if (src.width() && Math.abs(viewport.clientWidth / Math.max(1, viewport.clientHeight) - src.width() / src.height()) > 0.02) layout();
      }
      // No clock without something to aim at (gallery practice before a photo is picked).
      if (phase === 'hunt' && !hidden && src) {
        remaining -= dt;
        const sec = Math.ceil(remaining);
        if (sec !== lastTick && sec <= 10 && sec > 0) {
          sfx.tick(sec <= 5);
          lastTick = sec;
        }
        timerEl.textContent = fmtTime(remaining);
        timerEl.classList.toggle('urgent', remaining <= 10);
        viewport.classList.toggle('urgent', remaining <= 10);
        if (remaining <= 0) timeUp();
      }
      // The extracted color is never shown while hunting; this only drives the too-dark warning.
      if (src && live && r.mode === 'camera' && now - lastSwatch > 250) {
        lastSwatch = now;
        const m = meanOfRect(src, squareRect(src, view(), SEVEN.squareFraction));
        if (m) {
          warn.hidden = 0.2126 * m[0] + 0.7152 * m[1] + 0.0722 * m[2] > 0.012;
        }
      }
    };
    raf = requestAnimationFrame(loop);

    const onVis = () => {
      hidden = document.hidden;
      lastT = performance.now();
    };
    document.addEventListener('visibilitychange', onVis);

    // --- gestures: pinch to zoom, drag to aim (image sources), wheel ----------------------------
    const pointers = new Map<number, { x: number; y: number }>();
    let pinchStart: { d: number; zoom: number } | null = null;
    viewport.addEventListener('pointerdown', (e) => {
      if (phase === 'intro') return beginHunt();
      if (phase !== 'hunt' || (e.target as HTMLElement).closest('button')) return;
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      viewport.setPointerCapture(e.pointerId);
      if (pointers.size === 2) {
        const [a, b] = [...pointers.values()];
        pinchStart = { d: Math.hypot(a.x - b.x, a.y - b.y), zoom };
      }
    });
    viewport.addEventListener('pointermove', (e) => {
      const prev = pointers.get(e.pointerId);
      if (!prev) return;
      const cur = { x: e.clientX, y: e.clientY };
      pointers.set(e.pointerId, cur);
      if (pointers.size >= 2 && pinchStart) {
        const [a, b] = [...pointers.values()];
        if (pinchStart.d > 0) setZoom(pinchStart.zoom * (Math.hypot(a.x - b.x, a.y - b.y) / pinchStart.d));
      } else if (pointers.size === 1 && src?.pannable) {
        const v = view();
        cx -= ((cur.x - prev.x) / viewport.clientWidth) * v.w;
        cy -= ((cur.y - prev.y) / viewport.clientHeight) * v.h;
        clampCenter();
      }
    });
    const up = (e: PointerEvent) => {
      pointers.delete(e.pointerId);
      if (pointers.size < 2) pinchStart = null;
    };
    viewport.addEventListener('pointerup', up);
    viewport.addEventListener('pointercancel', up);
    viewport.addEventListener(
      'wheel',
      (e) => {
        e.preventDefault();
        setZoom(zoom * (e.deltaY > 0 ? 1 / 1.08 : 1.08));
      },
      { passive: false },
    );

    const offKeys = onKeys((e) => {
      if (document.querySelector('.overlay')) return;
      const k = e.key;
      if (k === ' ' || k === 'Enter') {
        e.preventDefault();
        void snap();
        return;
      }
      if (k === 'Escape') return void quitSeven();
      if ((e.target as HTMLElement)?.tagName === 'INPUT' && k.startsWith('Arrow')) return;
      if (k === '+' || k === '=') setZoom(zoom * 1.1);
      else if (k === '-' || k === '_') setZoom(zoom / 1.1);
      // Dev only: the test photos aren't in the jam build.
      else if (import.meta.env.DEV && (k === 'n' || k === 'N') && r.mode === 'photo') void nextPhoto();
      else if (src?.pannable && k.startsWith('Arrow')) {
        const v = view();
        const step = (e.shiftKey ? 0.2 : 0.05) * v.w;
        if (k === 'ArrowLeft') cx -= step;
        if (k === 'ArrowRight') cx += step;
        if (k === 'ArrowUp') cy -= step;
        if (k === 'ArrowDown') cy += step;
        clampCenter();
      } else return;
      e.preventDefault();
    });

    void startSection();

    return () => {
      reacting?.cancel();
      cancelAnimationFrame(raf);
      timers.forEach(clearTimeout);
      ro.disconnect();
      document.removeEventListener('visibilitychange', onVis);
      offKeys();
      vf.destroy();
      camera.video.style.transform = '';
      camera.video.classList.remove('src-el');
    };
  });
}
