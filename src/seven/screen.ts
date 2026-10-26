// Seven Colors: one screen for the whole run. Each section: intro → hunt (live
// camera, square framed in the target color, zoom, on the clock) → snap → result.
// No editing: light is part of the game (shade it with a hand, change the angle).

import { muteButton, onKeys, show } from '../app';
import { camera } from '../camera/camera';
import { Viewfinder } from '../camera/viewfinder';
import { cameraSource, canvasSource, captureView, imageToCanvas, meanOfRect, squareRect, viewRect, type FrameSource } from '../camera/source';
import { linearToHex, mixLab, oklabToHex } from '../color/oklab';
import { centerOf, floatText, fx, shake } from '../ui/fx';
import { ELEMENT_GLYPH, TIER_LABEL, type ColorDef } from '../data/colors';
import { SEVEN, TUNING } from '../data/tuning';
import { mulberry32 } from '../meta/rng';
import { paintPracticeCanvas } from '../practice/plates';
import { SquareAssayer } from '../scoring/square';
import { h, append, toast, fmt, wait, reducedMotion } from '../ui/dom';
import { stamp, swatch } from '../ui/components';
import { goSevenSummary, quitSeven } from '../flow';
import { sfx, vibrate } from '../audio/sfx';
import { dealSection, finishSection, OPERATIONS, type Section, type SevenRun } from './run';

const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'];

const TIPS = [
  'Fill the square with the color.',
  'Zoom in or walk closer.',
  'Too bright? Shade it with your hand.',
  'Tilt shiny things to kill the glare.',
  'Daylight is the purest reagent.',
  'Faster snaps earn Quicksilver.',
];

interface PhotoDeck {
  urls: string[];
  index: number;
}

async function loadPhotoDeck(): Promise<PhotoDeck> {
  try {
    const res = await fetch('./test-photos/manifest.json');
    const list = (await res.json()) as { file: string }[];
    const urls = list.map((x) => `./test-photos/${x.file}`);
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
    let phase: 'intro' | 'hunt' | 'capturing' | 'result' | 'done' = 'intro';
    let remaining: number = SEVEN.seconds;
    let lastT = performance.now();
    let lastTick = Math.ceil(remaining);
    let lastSwatch = 0;
    let hidden = false;
    let raf = 0;
    let resultAt = 0;
    let tipIndex = Math.floor(Math.random() * TIPS.length);

    // --- DOM ----------------------------------------------------------------------
    const segments = Array.from({ length: SEVEN.sections }, () => h('span'));
    const spectrum = h('div', { class: 'spectrum', 'aria-hidden': 'true' }, ...segments);
    const stageEl = h('span', { class: 'stage-label' });
    const timerEl = h('span', { class: 'timer' }, '1:00');

    const targetSw = h('span', { class: 'big-sw target' });
    const yoursSw = h('span', { class: 'big-sw yours' });
    const nameEl = h('span', { class: 'tg-name' });
    const metaEl = h('span', { class: 'tg-meta' });
    const target = h(
      'div',
      { class: 'tg' },
      h('figure', null, targetSw, h('figcaption', null, 'target')),
      h('div', { class: 'tg-body' }, nameEl, metaEl),
      h('figure', null, yoursSw, h('figcaption', null, 'in the square')),
    );

    const vfCanvas = h('canvas', { class: 'vf-canvas', 'aria-label': 'Camera view' });
    const reticle = h('div', { class: 'reticle', 'aria-hidden': 'true' }, h('span', { class: 'ret-in' }));
    const warn = h('div', { class: 'scene-warning', hidden: true }, 'Too dark for alchemy. Find some light.');
    const intro = h('div', { class: 'vf-overlay intro', hidden: true });
    const result = h('div', { class: 'vf-overlay result', hidden: true });
    const viewport = h('div', { class: 'viewport seven-vp' }, vfCanvas, reticle, warn, intro, result);
    const stageWrap = h('div', { class: 'stage-wrap' }, viewport);
    const vf = new Viewfinder(vfCanvas);
    if (!vf.ok) viewport.classList.add('no-gl');

    const zoomOut = h('output', null, '1.0×');
    const zoomInput = h('input', { type: 'range', min: String(SEVEN.zoomMin), max: String(SEVEN.zoomMax), step: '0.01', value: '1', 'aria-label': 'Zoom' }) as HTMLInputElement;
    zoomInput.addEventListener('input', () => setZoom(Number(zoomInput.value)));
    const zoomRow = h('label', { class: 'slider zoom' }, h('span', { class: 's-label' }, '⌕ Zoom'), zoomInput, zoomOut);
    const tipEl = h('p', { class: 'tip' }, TIPS[tipIndex]);

    const shutter = h('button', { class: 'shutter', type: 'button', 'aria-label': 'Snap (Space)', onclick: () => void snap() }, h('span'));
    const flipBtn = h(
      'button',
      {
        class: 'btn ghost small',
        type: 'button',
        hidden: r.mode !== 'camera' || camera.deviceCount < 2,
        onclick: async () => {
          if (await camera.flip()) toast('Could not switch camera.');
        },
      },
      '⇆ Flip',
    );
    const fileInput = h('input', { type: 'file', accept: 'image/*', hidden: true }) as HTMLInputElement;
    const photoBtns = h(
      'div',
      { class: 'row tight', hidden: r.mode !== 'photo' },
      h('button', { class: 'btn ghost small', type: 'button', title: 'Next test photo (N)', onclick: () => void nextPhoto() }, 'Next ▸'),
      h('button', { class: 'btn ghost small', type: 'button', title: 'Open an image file', onclick: () => fileInput.click() }, 'Open'),
      fileInput,
    );
    fileInput.addEventListener('change', async () => {
      const f = fileInput.files?.[0];
      if (!f) return;
      const url = URL.createObjectURL(f);
      setSource(canvasSource(await imageToCanvas(url)));
      URL.revokeObjectURL(url);
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
          h('p', { class: 'desk-only muted small' }, r.mode === 'camera' ? 'Hold things up to the camera. Space: snap · +/−: zoom · Esc: quit' : 'Drag to aim · Space: snap · +/−: zoom · arrows: aim · Esc: quit'),
        ),
        h(
          'div',
          { class: 'hunt-main' },
          stageWrap,
          h('div', { class: 'hunt-controls' }, h('div', { class: 'side' }, photoBtns), shutter, h('div', { class: 'side right' }, flipBtn)),
          tipEl,
        ),
      ),
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
    }

    function setZoom(z: number): void {
      zoom = Math.min(SEVEN.zoomMax, Math.max(SEVEN.zoomMin, z));
      zoomInput.value = String(zoom);
      zoomOut.textContent = `${zoom.toFixed(1)}×`;
    }

    function clampCenter(): void {
      // Image sources: the square may reach any part of the image, so the view may pass the edges.
      cx = Math.min(1, Math.max(0, cx));
      cy = Math.min(1, Math.max(0, cy));
    }

    function paintTarget(def: ColorDef): void {
      targetSw.style.background = def.target;
      reticle.style.setProperty('--ing', def.target);
      nameEl.textContent = def.name;
      metaEl.textContent = `${ELEMENT_GLYPH[def.element]} ${def.element} · ${TIER_LABEL[def.tier]}`;
    }

    function paintSpectrum(): void {
      segments.forEach((s, i) => {
        s.style.background = r.sections[i]?.hex ?? '';
        s.classList.toggle('current', i === r.index);
      });
    }

    async function prepareSource(def: ColorDef): Promise<void> {
      if (r.mode === 'camera') {
        if (!src || src.el !== camera.video) setSource(cameraSource());
        void camera.video.play().catch(() => undefined);
      } else if (r.mode === 'practice') {
        const rng = mulberry32((r.seed ^ ((r.index + 1) * 2654435761)) >>> 0);
        setSource(canvasSource(paintPracticeCanvas(rng, def).canvas));
      } else if (!src) {
        await nextPhoto();
      }
    }

    async function nextPhoto(): Promise<void> {
      deck ??= await loadPhotoDeck();
      if (!deck.urls.length) {
        toast('No test photos found. Use Open… to load an image.');
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
      stageEl.textContent = `${ROMAN[r.index]} · ${OPERATIONS[r.index]} · ${r.index + 1}/${SEVEN.sections}`;
      await prepareSource(def);
      phase = 'intro';
      result.hidden = true;
      intro.replaceChildren();
      append(intro, [
        h('p', { class: 'eyebrow' }, `${ROMAN[r.index]} · ${OPERATIONS[r.index]}`),
        h('p', { class: 'intro-find' }, 'find'),
        h('span', { class: 'intro-sw', style: { background: def.target } }),
        h('h2', { class: 'intro-name' }, def.name),
        r.index === 0 && r.tutorial ? h('p', { class: 'small' }, 'Your jeans will do. Fill the square with Denim.') : null,
      ]);
      intro.hidden = false;
      sfx.clink(r.index);
      // The target color splashes in.
      requestAnimationFrame(() => {
        const sw = intro.querySelector('.intro-sw');
        if (!sw) return;
        const c = centerOf(sw);
        fx.splash(c.x, c.y, def.target, 18);
        fx.burst(c.x, c.y, [def.target], { count: 10, speed: 160, size: 5, gravity: 0 });
      });
      await wait(reducedMotion() ? 400 : SEVEN.introMs);
      if (phase === 'intro') beginHunt();
    }

    function beginHunt(): void {
      intro.hidden = true;
      phase = 'hunt';
      lastT = performance.now();
      shutter.disabled = false;
      reticle.classList.remove('ret-go');
      void reticle.offsetWidth;
      reticle.classList.add('ret-go');
    }

    async function snap(): Promise<void> {
      if (phase === 'intro') return beginHunt();
      if (phase === 'result') return advance();
      if (phase !== 'hunt' || !src) return;
      if (!src.ready()) {
        toast('The camera is still waking up…');
        return;
      }
      phase = 'capturing';
      shutter.disabled = true;
      sfx.shutter();
      vibrate(20);
      viewport.classList.add('flash');
      shake(viewport, 'soft');
      const secondsLeft = Math.max(0, remaining);
      const plate = await captureView(src, view(), SEVEN.viewShortSide, TUNING.framesAveraged);
      viewport.classList.remove('flash');
      if (!plate) {
        phase = 'hunt';
        shutter.disabled = false;
        toast('Capture failed. Try again.');
        return;
      }
      showResult(finishSection(r, new SquareAssayer(plate), secondsLeft, zoom));
    }

    function showResult(sec: Section): void {
      phase = 'result';
      viewport.classList.remove('urgent');
      paintSpectrum();
      resultAt = performance.now();
      const accEl = h('span', { class: 'res-acc mono' }, '0');
      const last = r.index + 1 >= SEVEN.sections;
      const stampEl = stamp(sec.grade, 'slam');
      const pointsEl = h('p', { class: 'res-points mono' }, `+${fmt(sec.base)}`, sec.quicksilver ? h('span', { class: 'qs' }, ` +${sec.quicksilver} quicksilver`) : null);
      result.replaceChildren(
        colorRamp(sec),
        h('p', { class: 'res-name' }, sec.def.name),
        accEl,
        h('div', { class: 'res-stamp' }, stampEl),
        pointsEl,
        h('button', { class: 'btn primary res-next-btn', type: 'button' }, last ? 'See your Magnum Opus ▶' : `Next color · ${r.index + 2}/${SEVEN.sections} ▶`),
        h('p', { class: 'res-next small' }, last ? '' : 'Take your time. The clock starts with the next color.'),
      );
      result.hidden = false;
      // Juice scales with the grade: a puff for Sludge, fireworks for Quintessence.
      const power = ['Sludge', 'Murk', 'Tincture', 'Elixir', 'Essence', 'Quintessence'].indexOf(sec.grade);
      window.setTimeout(() => {
        if (phase !== 'result') return;
        sfx.stamp();
        const c = centerOf(stampEl);
        fx.burst(c.x, c.y, [sec.def.target, sec.hex], { count: 6 + power * 9, speed: 180 + power * 50, shapes: ['circle', 'star', 'square'] });
        const p = centerOf(pointsEl);
        floatText(p.x, p.y - 10, `+${fmt(sec.total)}`, sec.def.target);
        const seg = segments[sec.index];
        seg.classList.remove('seg-pop');
        void seg.offsetWidth;
        seg.classList.add('seg-pop');
        if (power >= 4) shake(screen, power === 5 ? 'hard' : 'soft');
        if (power === 5) {
          sfx.choir();
          fx.confetti([sec.def.target, sec.hex, '#ffffff'], 120);
        } else if (power >= 3) sfx.sparkle();
      }, 260);
      const t0 = performance.now();
      const step = (now: number) => {
        const t = Math.min(1, (now - t0) / 600);
        accEl.textContent = String(Math.round(sec.acc * (1 - Math.pow(1 - t, 3))));
        if (t < 1 && phase === 'result') requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    }

    /**
     * Target → yours as a walk through color: 1 step in between for Quintessence,
     * up to 6 for Sludge (SEVEN.rampSteps), interpolated in OKLab so it looks even.
     */
    function colorRamp(sec: Section): HTMLElement {
      const n = SEVEN.rampSteps[sec.grade] ?? 3;
      const steps = Array.from({ length: n }, (_, k) => oklabToHex(mixLab(sec.def.lab, sec.mean, (k + 1) / (n + 1))));
      const chip = (hex: string, i: number) => h('span', { class: 'ramp-chip', style: { background: hex, '--i': String(i) } });
      return h(
        'div',
        { class: 'res-ramp', 'aria-label': `${n} steps from the target to your color` },
        h('figure', null, swatch(sec.def.target), h('figcaption', null, 'target')),
        h('span', { class: 'ramp-steps' }, ...steps.map((hex, i) => chip(hex, i))),
        h('figure', null, swatch(sec.hex), h('figcaption', null, 'yours')),
      );
    }

    /** The player moves on when ready; never automatically. */
    function advance(): void {
      if (phase !== 'result') return;
      // Ignore taps in the first moment, so a double-tap on the shutter can't skip the result.
      if (performance.now() - resultAt < SEVEN.resultGuardMs) return;
      r.index++;
      if (r.index >= SEVEN.sections) {
        phase = 'done';
        goSevenSummary(r);
        return;
      }
      void startSection();
    }

    // --- loop ---------------------------------------------------------------------------
    const fmtTime = (s: number) => {
      const t = Math.max(0, Math.ceil(s));
      return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;
    };

    const fallbackStyle = () => {
      if (vf.ok || !src) return;
      const mirror = src.mirrored ? ' scaleX(-1)' : '';
      (src.el as HTMLElement).style.transform = `scale(${zoom}) translate(${(0.5 - cx) * 100}%, ${(0.5 - cy) * 100}%)${mirror}`;
    };

    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      const dt = (now - lastT) / 1000;
      lastT = now;
      if (src) {
        if (vf.ok) vf.render(src, view(), 0, 0);
        else fallbackStyle();
        if (src.width() && Math.abs(viewport.clientWidth / Math.max(1, viewport.clientHeight) - src.width() / src.height()) > 0.02) layout();
      }
      if (phase === 'hunt' && !hidden) {
        remaining -= dt;
        const sec = Math.ceil(remaining);
        if (sec !== lastTick && sec <= 10 && sec > 0) {
          sfx.tick(sec <= 5);
          lastTick = sec;
        }
        timerEl.textContent = fmtTime(remaining);
        timerEl.classList.toggle('urgent', remaining <= 10);
        viewport.classList.toggle('urgent', remaining <= 10);
        if (remaining <= 0) {
          toast('The flask seals itself.');
          void snap();
        }
      }
      if (src && phase !== 'result' && now - lastSwatch > 120) {
        lastSwatch = now;
        const m = meanOfRect(src, squareRect(src, view(), SEVEN.squareFraction));
        if (m) {
          yoursSw.style.background = linearToHex(m[0], m[1], m[2]);
          warn.hidden = r.mode !== 'camera' || 0.2126 * m[0] + 0.7152 * m[1] + 0.0722 * m[2] > 0.012;
        }
      }
    };
    raf = requestAnimationFrame(loop);

    const tipTimer = window.setInterval(() => {
      tipIndex = (tipIndex + 1) % TIPS.length;
      tipEl.textContent = TIPS[tipIndex];
    }, 6000);

    const onVis = () => {
      hidden = document.hidden;
      lastT = performance.now();
    };
    document.addEventListener('visibilitychange', onVis);

    // --- gestures: pinch to zoom, drag to aim (image sources), wheel ----------------------------
    const pointers = new Map<number, { x: number; y: number }>();
    let pinchStart: { d: number; zoom: number } | null = null;
    viewport.addEventListener('pointerdown', (e) => {
      if (phase === 'result') return advance();
      if (phase === 'intro') return beginHunt();
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
      else if ((k === 'n' || k === 'N') && r.mode === 'photo') void nextPhoto();
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
      cancelAnimationFrame(raf);
      clearInterval(tipTimer);
      ro.disconnect();
      document.removeEventListener('visibilitychange', onVis);
      offKeys();
      vf.destroy();
      camera.video.style.transform = '';
      camera.video.classList.remove('src-el');
    };
  });
}
