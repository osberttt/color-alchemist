// Deal (meet your two colors) and Hunt (60 s live camera with the Lens).

import { muteButton, onKeys, show, spectrumBar } from '../app';
import { camera } from '../camera/camera';
import { Lens } from '../camera/lens';
import { renderPlate, NO_EDITS, FULL_CROP, type Plate } from '../color/plate';
import { TUNING } from '../data/tuning';
import { currentCatalyst, personalBest, stageName, transmuteTarget, type Run } from '../game';
import { STAGES } from '../meta/deal';
import { getSettings, updateSettings } from '../meta/storage';
import { mulberry32 } from '../meta/rng';
import { paintPracticePlate } from '../practice/plates';
import { Assayer } from '../scoring/assay';
import { h, toast, wait } from '../ui/dom';
import { meter, meterLevel, targetCard } from '../ui/components';
import { goBrew, goHunt, quitRun } from '../flow';
import { sfx, unlockAudio, vibrate } from '../audio/sfx';

const TIPS = [
  'Shoot wide, crop later.',
  'Daylight is the purest reagent.',
  'Tilt shiny things to kill the glare.',
  "Don't fill the frame with one color: the camera will fight you.",
  'Put the two colors next to each other, then crop the seam.',
  'Too dark? Turn on a light or step near a window.',
];

function foundSoFar(r: Run): string[] {
  return r.brews.flatMap((b) => [b.a.hex, b.b.hex]);
}

export function dealScreen(r: Run): void {
  show((screen) => {
    const pair = r.pair!;
    const cat = currentCatalyst(r);
    const practice = r.mode === 'practice';
    const go = async () => {
      unlockAudio();
      sfx.tap();
      if (!practice) {
        goHunt();
        return;
      }
      btn.disabled = true;
      btn.textContent = 'Painting the plate…';
      await wait(30);
      const rng = mulberry32((r.seed ^ (r.stage * 2654435761)) >>> 0);
      const scene = paintPracticePlate(rng, [pair.a, pair.b]);
      const assayer = new Assayer(scene.plate);
      goBrew(scene.plate, assayer, 0, scene.light);
    };
    const btn = h('button', { class: 'btn primary xl', type: 'button', onclick: () => void go() }, practice ? 'Paint the plate' : 'Uncork');
    const tutorial = r.stage === 0 && r.tutorial;
    screen.append(
      spectrumBar(foundSoFar(r)),
      h(
        'div',
        { class: 'topbar' },
        h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Quit run', onclick: () => void quitRun() }, '✕'),
        h('span', { class: 'stage-label' }, `${practice ? 'Practice · ' : ''}${r.stage + 1} / 3`),
        muteButton(),
      ),
      h(
        'div',
        { class: 'deal' },
        h('p', { class: 'stage-name' }, stageName(r.stage)),
        h('p', { class: 'stage-meaning' }, STAGES[r.stage].meaning),
        h('p', { class: 'deal-ask' }, practice ? 'Find these two colors in the still life:' : 'Find these two colors in your world:'),
        h(
          'div',
          { class: 'deal-cards' },
          targetCard(pair.a, 'A', { big: true, best: personalBest(pair.a.id) }),
          h('span', { class: 'amp' }, '&'),
          targetCard(pair.b, 'B', { big: true, best: personalBest(pair.b.id) }),
        ),
        tutorial ? h('p', { class: 'hint-box' }, 'First brew: your jeans are probably Denim, and a cardboard box or wooden table is Tan. Get both in one photo.') : null,
        cat ? h('div', { class: 'catalyst' }, h('strong', null, `Catalyst: ${cat.name}`), ` ${cat.rule} Score ×${cat.mult.toFixed(2)}.`) : null,
        practice ? h('p', { class: 'muted small' }, 'Practice plates are painted still lifes. No camera needed; scores go to the practice board.') : null,
      ),
      h('div', { class: 'bottom-actions' }, btn, practice ? null : h('p', { class: 'muted small center' }, `${cat?.id === 'haste' ? TUNING.hasteSeconds : TUNING.huntSeconds} seconds start when you uncork · Space`)),
    );
    screen.querySelectorAll('.target-card').forEach((c, i) => ((c as HTMLElement).style.animationDelay = `${i * 140}ms`));
    return onKeys((e) => {
      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        void go();
      } else if (e.key === 'Escape') void quitRun();
    });
  });
}

function fit(el: HTMLElement, box: HTMLElement, aspect: number): void {
  const bw = box.clientWidth;
  const bh = box.clientHeight;
  if (!bw || !bh) return;
  let w = bw;
  let hh = bw / aspect;
  if (hh > bh) {
    hh = bh;
    w = bh * aspect;
  }
  el.style.width = `${Math.floor(w)}px`;
  el.style.height = `${Math.floor(hh)}px`;
}

export function huntScreen(r: Run): void {
  show((screen) => {
    let pair = r.pair!;
    const cat = currentCatalyst(r);
    const eclipse = cat?.id === 'eclipse';
    const duration = cat?.id === 'haste' ? TUNING.hasteSeconds : TUNING.huntSeconds;
    let remaining: number = duration;
    let lastT = performance.now();
    let hidden = false;
    let raf = 0;
    let lastMeter = 0;
    let lastTickSecond = Math.ceil(remaining);
    let frozen: { plate: Plate; secondsLeft: number; assayer: Assayer | null } | null = null;
    let capturing = false;
    let done = false;
    let tipIndex = Math.floor(Math.random() * TIPS.length);

    const meterA = meter();
    const meterB = meter();
    const cardsEl = h('div', { class: 'hunt-cards' });
    const paintCards = () => {
      cardsEl.replaceChildren(
        targetCard(pair.a, 'A', { meter: eclipse ? undefined : meterA }),
        targetCard(pair.b, 'B', { meter: eclipse ? undefined : meterB }),
      );
    };
    paintCards();

    const timerEl = h('span', { class: 'timer', 'aria-live': 'off' }, '1:00');
    const lensCanvas = h('canvas', { class: 'lens-canvas', 'aria-label': 'Camera view' });
    const freezeCanvas = h('canvas', { class: 'freeze-canvas' });
    const warn = h('div', { class: 'scene-warning', hidden: true }, 'Too dark for alchemy. Turn on a light.');
    const viewport = h('div', { class: 'viewport' }, camera.video, lensCanvas, freezeCanvas, warn);
    const stageWrap = h('div', { class: 'stage-wrap' }, viewport);
    const lens = new Lens(lensCanvas);
    lens.on = !eclipse;
    lens.patterns = getSettings().lensPatterns;
    if (!lens.ok) viewport.classList.add('no-lens');
    if (camera.mirrored) viewport.classList.add('mirrored');
    lens.setTargets(pair.a.lab, pair.a.tol, pair.b.lab, pair.b.tol);

    const shutter = h('button', { class: 'shutter', type: 'button', 'aria-label': 'Take photo (Space)', onclick: () => void snap() }, h('span'));
    const keepBtn = h('button', { class: 'btn primary', type: 'button', onclick: () => keep() }, 'Brew this ▶');
    const retakeBtn = h('button', { class: 'btn', type: 'button', onclick: () => retake() }, 'Retake');
    const freezeBar = h('div', { class: 'freeze-bar', hidden: true }, retakeBtn, keepBtn);
    const transmuteBtn = h(
      'button',
      { class: 'btn ghost small', type: 'button', onclick: () => openTransmute(), disabled: !r.transmuteLeft, title: 'Swap one color (once per run, ×0.85)' },
      '⟲ Transmute',
    );
    const flipBtn = h(
      'button',
      {
        class: 'btn ghost small',
        type: 'button',
        hidden: camera.deviceCount < 2,
        onclick: async () => {
          const err = await camera.flip();
          if (err) toast('Could not switch camera.');
          viewport.classList.toggle('mirrored', camera.mirrored);
          onResize();
        },
      },
      '⇆ Flip',
    );
    const lensToggle = h(
      'button',
      {
        class: 'btn ghost small',
        type: 'button',
        hidden: eclipse || !lens.ok,
        title: 'Toggle hatching/dot patterns on matching colors',
        onclick: () => {
          lens.patterns = !lens.patterns;
          updateSettings({ lensPatterns: lens.patterns });
          toast(lens.patterns ? 'Lens patterns on (A hatching, B dots)' : 'Lens patterns off');
        },
      },
      '▦ Patterns',
    );
    const tipEl = h('p', { class: 'tip' }, `tip: ${TIPS[tipIndex]}`);
    const controls = h('div', { class: 'hunt-controls' }, h('div', { class: 'side' }, transmuteBtn), shutter, h('div', { class: 'side right' }, flipBtn, lensToggle));

    screen.classList.add('hunt');
    screen.append(
      spectrumBar(foundSoFar(r)),
      h(
        'div',
        { class: 'topbar' },
        h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Quit run', onclick: () => void quitRun() }, '✕'),
        h('span', { class: 'stage-label' }, `${stageName(r.stage)} ${r.stage + 1}/3${cat ? ` · ${cat.name}` : ''}`),
        h('div', { class: 'row tight' }, timerEl, muteButton()),
      ),
      h('div', { class: 'hunt-layout' }, h('div', { class: 'hunt-side' }, cardsEl, h('p', { class: 'desk-only muted small' }, 'Hold things up to the camera. Space: snap · R: transmute · Esc: quit')), h('div', { class: 'hunt-main' }, stageWrap, freezeBar, controls, tipEl)),
    );

    const onResize = () => {
      const vw = camera.video.videoWidth || 3;
      const vh = camera.video.videoHeight || 4;
      fit(viewport, stageWrap, vw / vh);
    };
    const ro = new ResizeObserver(onResize);
    ro.observe(stageWrap);
    camera.video.addEventListener('loadedmetadata', onResize);
    onResize();
    void camera.video.play().catch(() => undefined);

    const tipTimer = window.setInterval(() => {
      tipIndex = (tipIndex + 1) % TIPS.length;
      tipEl.textContent = `tip: ${TIPS[tipIndex]}`;
    }, 6000);

    const fmtTime = (s: number) => {
      const t = Math.max(0, Math.ceil(s));
      return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;
    };

    const updateMeters = () => {
      if (eclipse || frozen) return;
      const plate = camera.sample(160);
      if (!plate) return;
      const a = new Assayer(plate, 3);
      lens.setGains(a.autoGains);
      const mA = a.match(pair.a, NO_EDITS, FULL_CROP);
      const mB = a.match(pair.b, NO_EDITS, FULL_CROP);
      const prevA = meterA.el.dataset.level;
      meterA.set(mA ? meterLevel(mA.acc) : 0);
      meterB.set(mB ? meterLevel(mB.acc) : 0);
      if (meterA.el.dataset.level !== prevA && Number(meterA.el.dataset.level) >= 3) sfx.bubble(Number(meterA.el.dataset.level));
      // Dark-scene warning
      let y = 0;
      for (let i = 0; i < plate.lin.length; i += 3 * 7) y += 0.2126 * plate.lin[i] + 0.7152 * plate.lin[i + 1] + 0.0722 * plate.lin[i + 2];
      y /= plate.lin.length / (3 * 7);
      warn.hidden = y > 0.025;
    };

    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      const dt = (now - lastT) / 1000;
      lastT = now;
      if (!hidden && !done) remaining -= dt;
      timerEl.textContent = fmtTime(remaining);
      timerEl.classList.toggle('urgent', remaining <= 10);
      const sec = Math.ceil(remaining);
      if (sec !== lastTickSecond && sec <= 10 && sec > 0) {
        sfx.tick(sec <= 5);
        lastTickSecond = sec;
      }
      if (!frozen) {
        if (lens.ok) lens.render(camera.video, camera.mirrored, now / 1000);
        if (now - lastMeter > 250) {
          lastMeter = now;
          updateMeters();
        }
      }
      if (remaining <= 0 && !done) {
        void timeUp();
      }
    };
    raf = requestAnimationFrame(loop);

    const onVis = () => {
      hidden = document.hidden;
      lastT = performance.now();
    };
    document.addEventListener('visibilitychange', onVis);

    async function snap(): Promise<void> {
      if (capturing || done) return;
      if (frozen) {
        keep();
        return;
      }
      if (!camera.ready) {
        void camera.video.play().catch(() => undefined);
        toast('The camera is still waking up…');
        return;
      }
      capturing = true;
      sfx.shutter();
      vibrate(20);
      viewport.classList.add('flash');
      const secondsLeft = Math.max(0, remaining);
      const plate = await camera.capture();
      viewport.classList.remove('flash');
      capturing = false;
      if (!plate) {
        toast('Capture failed. Try again.');
        return;
      }
      frozen = { plate, secondsLeft, assayer: null };
      showFrozen(plate);
      shutter.hidden = true;
      freezeBar.hidden = false;
      keepBtn.focus();
      // Build the full-resolution assay while the player looks at the shot.
      await wait(30);
      if (!frozen || frozen.plate !== plate) return;
      frozen.assayer = new Assayer(plate);
      if (!eclipse) {
        const mA = frozen.assayer.match(pair.a, NO_EDITS, FULL_CROP);
        const mB = frozen.assayer.match(pair.b, NO_EDITS, FULL_CROP);
        meterA.set(mA ? meterLevel(mA.acc) : 0);
        meterB.set(mB ? meterLevel(mB.acc) : 0);
      }
    }

    function showFrozen(plate: Plate): void {
      freezeCanvas.width = plate.w;
      freezeCanvas.height = plate.h;
      const ctx = freezeCanvas.getContext('2d')!;
      const img = ctx.createImageData(plate.w, plate.h);
      renderPlate(plate, NO_EDITS, img.data);
      ctx.putImageData(img, 0, 0);
      viewport.classList.add('frozen');
    }

    function retake(): void {
      if (done) return;
      sfx.tap();
      frozen = null;
      viewport.classList.remove('frozen');
      shutter.hidden = false;
      freezeBar.hidden = true;
    }

    function keep(): void {
      if (!frozen || done) return;
      done = true;
      const f = frozen;
      sfx.pour();
      goBrew(f.plate, f.assayer ?? new Assayer(f.plate), f.secondsLeft);
    }

    async function timeUp(): Promise<void> {
      if (done) return;
      if (frozen) {
        keep();
        return;
      }
      done = true;
      toast('The flask seals itself.');
      const plate = await camera.capture();
      if (plate) goBrew(plate, new Assayer(plate), 0);
      else {
        done = false;
        remaining = 5;
        toast('Capture failed. 5 more seconds!');
      }
    }

    function openTransmute(): void {
      if (!r.transmuteLeft || frozen) return;
      const close = () => overlay.remove();
      const pick = (which: 'a' | 'b') => {
        const next = transmuteTarget(r, which);
        close();
        if (!next) {
          toast('No legal transmutation for that color.');
          return;
        }
        pair = next;
        lens.setTargets(pair.a.lab, pair.a.tol, pair.b.lab, pair.b.tol);
        paintCards();
        transmuteBtn.disabled = true;
        sfx.clink(2);
        toast(`Transmuted into ${which === 'a' ? pair.a.name : pair.b.name} · ×${TUNING.transmuteMult} on this brew`);
      };
      const overlay = h(
        'div',
        { class: 'overlay', role: 'dialog', 'aria-modal': 'true' },
        h(
          'div',
          { class: 'dialog' },
          h('h3', null, 'Transmute'),
          h('p', { class: 'muted' }, `Swap one color for another of the same tier. Once per run, and this brew scores ×${TUNING.transmuteMult}.`),
          h(
            'div',
            { class: 'col' },
            h('button', { class: 'btn', type: 'button', onclick: () => pick('a') }, `Swap ${pair.a.name}`),
            h('button', { class: 'btn', type: 'button', onclick: () => pick('b') }, `Swap ${pair.b.name}`),
            h('button', { class: 'btn ghost', type: 'button', onclick: close }, 'Cancel'),
          ),
        ),
      );
      document.body.append(overlay);
    }

    const offKeys = onKeys((e) => {
      if (document.querySelector('.overlay')) return;
      if (e.key === ' ') {
        e.preventDefault();
        void snap();
      } else if (e.key === 'Enter' && frozen) {
        e.preventDefault();
        keep();
      } else if (e.key === 'Escape') {
        if (frozen) retake();
        else void quitRun();
      } else if ((e.key === 'r' || e.key === 'R') && !frozen) openTransmute();
      else if (e.key === 'f' || e.key === 'F') flipBtn.click();
    });

    return () => {
      cancelAnimationFrame(raf);
      clearInterval(tipTimer);
      ro.disconnect();
      camera.video.removeEventListener('loadedmetadata', onResize);
      document.removeEventListener('visibilitychange', onVis);
      offKeys();
      lens.destroy();
      document.querySelectorAll('.overlay').forEach((o) => o.remove());
    };
  });
}
