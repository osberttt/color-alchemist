// Brew: crop + brightness + saturation + Albedo tap, with a live assay preview (GDD §5).

import { onKeys, show, spectrumBar } from '../app';
import { albedoGains, renderPlate, type Crop, type Edits, type Plate } from '../color/plate';
import { TUNING } from '../data/tuning';
import { currentCatalyst, finishBrew, stageName, type Run } from '../game';
import { cropArea, cropIsLegal, type Assayer, type TargetMatch } from '../scoring/assay';
import { brewScore, colorGrade, isFoolsGold, purityOf } from '../scoring/score';
import { oklabToHex } from '../color/oklab';
import { h, append, toast, fmt } from '../ui/dom';
import { swatch } from '../ui/components';
import { goAssay, quitRun } from '../flow';
import { sfx } from '../audio/sfx';
import type { ColorDef } from '../data/colors';

type DragMode = 'move' | 'nw' | 'ne' | 'sw' | 'se' | 'draw';

export function brewScreen(r: Run, plate: Plate, assayer: Assayer, secondsLeft: number, practiceLight?: string): void {
  show((screen) => {
    const pair = r.pair!;
    const cat = currentCatalyst(r);
    const purist = cat?.id === 'purist';
    const distill = cat?.id === 'distill';
    const edits: Edits = { ev: 0, sat: 0 };
    let crop: Crop = distill ? { x: 0.35, y: 0.35, w: 0.3, h: 0.3 } : { x: 0, y: 0, w: 1, h: 1 };
    let albedoMode = false;
    let renderQueued = false;
    let updateQueued = false;

    const canvas = h('canvas', { class: 'brew-canvas' });
    canvas.width = plate.w;
    canvas.height = plate.h;
    const ctx = canvas.getContext('2d')!;
    const img = ctx.createImageData(plate.w, plate.h);

    const handles = (['nw', 'ne', 'sw', 'se'] as const).map((k) => h('span', { class: `handle ${k}`, 'data-mode': k }));
    const cropBox = h('div', { class: 'crop-box', 'data-mode': 'move' }, ...handles);
    const loupeA = h('span', { class: 'loupe a', 'aria-hidden': 'true' }, 'A');
    const loupeB = h('span', { class: 'loupe b', 'aria-hidden': 'true' }, 'B');
    const photo = h('div', { class: 'photo' }, canvas, cropBox, loupeA, loupeB);
    const photoWrap = h('div', { class: 'photo-wrap' }, photo);

    const row = (def: ColorDef, label: string) => {
      const bar = h('i');
      const acc = h('span', { class: 'acc' }, '–');
      const grade = h('span', { class: 'grade-word' }, '');
      const found = swatch('#333', 'found');
      const el = h(
        'div',
        { class: 'readout' },
        swatch(def.target, `${def.name} target`),
        h('span', { class: 'r-name' }, h('b', null, label), ' ', def.name),
        h('span', { class: 'bar' }, bar),
        acc,
        found,
        grade,
      );
      return { el, bar, acc, grade, found };
    };
    const rowA = row(pair.a, 'A');
    const rowB = row(pair.b, 'B');
    const factors = h('p', { class: 'factors' });
    const estimate = h('span', { class: 'estimate' });

    const slider = (label: string, min: number, max: number, get: () => number, set: (v: number) => void, fmtv: (v: number) => string) => {
      const out = h('output', null, fmtv(0));
      const input = h('input', { type: 'range', min: String(min), max: String(max), step: '0.01', value: '0', 'aria-label': label, disabled: purist }) as HTMLInputElement;
      input.addEventListener('input', () => {
        let v = Number(input.value);
        if (Math.abs(v) <= TUNING.sliderSnap) v = 0;
        set(v);
        out.textContent = fmtv(v);
        queueRender();
      });
      input.addEventListener('change', () => {
        input.value = String(get());
      });
      const wrap = h('label', { class: 'slider' }, h('span', { class: 's-label' }, label), input, out);
      return { wrap, input, out };
    };
    const bright = slider('☀ Brightness', -TUNING.evRange, TUNING.evRange, () => edits.ev, (v) => (edits.ev = v), (v) => `${v > 0 ? '+' : ''}${v.toFixed(2)} EV`);
    const sat = slider('◑ Saturation', TUNING.satMin, TUNING.satMax, () => edits.sat, (v) => (edits.sat = v), (v) => `×${(1 + v).toFixed(2)}`);

    const albedoBtn = h('button', { class: 'btn ghost small', type: 'button', onclick: () => toggleAlbedo() }, '◌ Tap something white');
    const resetBtn = h(
      'button',
      {
        class: 'btn ghost small',
        type: 'button',
        onclick: () => {
          crop = distill ? { x: 0.35, y: 0.35, w: 0.3, h: 0.3 } : { x: 0, y: 0, w: 1, h: 1 };
          edits.ev = 0;
          edits.sat = 0;
          bright.input.value = '0';
          sat.input.value = '0';
          bright.out.textContent = '+0.00 EV'.replace('+', '');
          sat.out.textContent = '×1.00';
          queueRender();
        },
      },
      '↺ Reset',
    );
    const assayBtn = h('button', { class: 'btn primary', type: 'button', onclick: () => confirm() }, 'Assay ▶');

    screen.classList.add('brew');
    screen.append(
      spectrumBar(r.brews.flatMap((b) => [b.a.hex, b.b.hex])),
      h(
        'div',
        { class: 'topbar' },
        h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Quit run', onclick: () => void quitRun() }, '✕'),
        h('span', { class: 'stage-label' }, `Brew · ${stageName(r.stage)}${cat ? ` · ${cat.name}` : ''}`),
        assayBtn,
      ),
      h(
        'div',
        { class: 'brew-layout' },
        h('div', { class: 'brew-main' }, photoWrap, h('p', { class: 'muted small center brew-help' }, albedoHelp())),
        h(
          'div',
          { class: 'brew-side' },
          rowA.el,
          rowB.el,
          h('div', { class: 'factors-row' }, factors, estimate),
          purist ? h('p', { class: 'muted small' }, 'Purist: the sliders are locked.') : null,
          bright.wrap,
          sat.wrap,
          h('div', { class: 'row' }, albedoBtn, resetBtn),
          h('p', { class: 'desk-only muted small' }, 'Drag the box to crop · arrows move · +/− resize · Enter: assay'),
        ),
      ),
    );
    if (practiceLight) toast(`Practice plate · lit by ${practiceLight}`);

    function albedoHelp(): string {
      return albedoMode ? 'Tap something white or grey in the photo.' : 'Crop tight around both colors. Smaller crop, bigger multiplier.';
    }

    // --- layout ---------------------------------------------------------------
    const layout = () => {
      const bw = photoWrap.clientWidth;
      const bh = photoWrap.clientHeight;
      if (!bw || !bh) return;
      const aspect = plate.w / plate.h;
      let w = bw;
      let hh = bw / aspect;
      if (hh > bh) {
        hh = bh;
        w = bh * aspect;
      }
      photo.style.width = `${Math.floor(w)}px`;
      photo.style.height = `${Math.floor(hh)}px`;
    };
    const ro = new ResizeObserver(layout);
    ro.observe(photoWrap);

    // --- rendering & live assay ---------------------------------------------------
    const displayPlate = () => (assayer.albedo ? assayer.correctedPlate() : plate);

    function queueRender(): void {
      if (renderQueued) return;
      renderQueued = true;
      requestAnimationFrame(() => {
        renderQueued = false;
        renderPlate(displayPlate(), edits, img.data);
        ctx.putImageData(img, 0, 0);
        update();
      });
    }

    function queueUpdate(): void {
      if (updateQueued) return;
      updateQueued = true;
      requestAnimationFrame(() => {
        updateQueued = false;
        update();
      });
    }

    function placeLoupe(el: HTMLElement, m: TargetMatch | null): void {
      el.hidden = !m;
      if (!m) return;
      el.style.left = `${m.cx * 100}%`;
      el.style.top = `${m.cy * 100}%`;
      el.style.setProperty('--found', oklabToHex(m.lab));
    }

    function paintRow(rw: ReturnType<typeof row>, m: TargetMatch | null, m0: TargetMatch | null, purity: number): number {
      const acc = m ? m.acc : 0;
      rw.bar.style.width = `${Math.max(2, acc)}%`;
      rw.acc.textContent = m ? String(Math.round(acc)) : '—';
      rw.found.style.background = m ? oklabToHex(m.lab) : 'transparent';
      const fool = m && m0 ? isFoolsGold(acc, m0.acc) : false;
      rw.grade.textContent = m ? (fool ? "Fool's Gold" : colorGrade(acc, purity)) : 'not found';
      rw.el.classList.toggle('fool', fool);
      return acc;
    }

    function update(): void {
      const { purity, pure } = purityOf(edits);
      const mA = assayer.match(pair.a, edits, crop);
      const mB = assayer.match(pair.b, edits, crop);
      const m0A = edits.ev || edits.sat ? assayer.matchNoEdits(pair.a, crop) : mA;
      const m0B = edits.ev || edits.sat ? assayer.matchNoEdits(pair.b, crop) : mB;
      const accA = paintRow(rowA, mA, m0A, purity);
      const accB = paintRow(rowB, mB, m0B, purity);
      placeLoupe(loupeA, mA);
      placeLoupe(loupeB, mB);
      const f = cropArea(crop);
      const bd = brewScore({
        accA,
        accB,
        tierA: pair.a.tier,
        tierB: pair.b.tier,
        f,
        edits,
        catalystMult: cat?.mult ?? 1,
        transmuted: pair.transmuted,
        secondsLeft: r.mode === 'camera' ? secondsLeft : 0,
      });
      factors.replaceChildren();
      append(factors, [
        h('span', null, `concentration ×${bd.concentration.toFixed(2)}`),
        h('span', { class: pure ? 'pure' : '' }, `purity ×${purity.toFixed(2)}${pure ? ' · pure draw' : ''}`),
        assayer.correctedBy === 'albedo' ? h('span', null, 'white set') : null,
      ]);
      estimate.textContent = `est. ${fmt(bd.total)}`;
      // crop box
      cropBox.style.left = `${crop.x * 100}%`;
      cropBox.style.top = `${crop.y * 100}%`;
      cropBox.style.width = `${crop.w * 100}%`;
      cropBox.style.height = `${crop.h * 100}%`;
      const distillOk = !distill || f <= 0.1 + 1e-6;
      assayBtn.disabled = !distillOk;
      assayBtn.title = distillOk ? '' : 'Distill: crop to 10 % or less';
      if (!distillOk) factors.append(h('span', { class: 'warn' }, `Distill: crop ${Math.round(f * 100)} % → ≤ 10 %`));
    }

    // --- crop interaction -----------------------------------------------------------
    let drag: { mode: DragMode; startX: number; startY: number; start: Crop; id: number } | null = null;

    const toNorm = (e: PointerEvent) => {
      const rect = photo.getBoundingClientRect();
      return { x: (e.clientX - rect.left) / rect.width, y: (e.clientY - rect.top) / rect.height };
    };

    const clampCrop = (c: Crop): Crop | null => {
      let { x, y, w, h: hh } = c;
      w = Math.min(1, w);
      hh = Math.min(1, hh);
      x = Math.min(1 - w, Math.max(0, x));
      y = Math.min(1 - hh, Math.max(0, y));
      const next = { x, y, w, h: hh };
      return cropIsLegal(next, plate.w, plate.h) ? next : null;
    };

    photo.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return;
      const p = toNorm(e);
      if (albedoMode) {
        tapWhite(p.x, p.y);
        return;
      }
      const target = e.target as HTMLElement;
      let mode = (target.dataset.mode as DragMode | undefined) ?? 'draw';
      const inside = p.x >= crop.x && p.x <= crop.x + crop.w && p.y >= crop.y && p.y <= crop.y + crop.h;
      if (mode === 'draw' && inside) mode = 'move';
      // A full-frame crop can't be moved: dragging draws a new one.
      if (mode === 'move' && crop.w >= 0.999 && crop.h >= 0.999) mode = 'draw';
      drag = { mode, startX: p.x, startY: p.y, start: { ...crop }, id: e.pointerId };
      photo.setPointerCapture(e.pointerId);
      e.preventDefault();
    });

    photo.addEventListener('pointermove', (e) => {
      if (!drag || e.pointerId !== drag.id) return;
      const p = toNorm(e);
      const dx = p.x - drag.startX;
      const dy = p.y - drag.startY;
      const s = drag.start;
      let next: Crop;
      switch (drag.mode) {
        case 'move':
          next = { ...s, x: s.x + dx, y: s.y + dy };
          break;
        case 'nw':
          next = { x: s.x + dx, y: s.y + dy, w: s.w - dx, h: s.h - dy };
          break;
        case 'ne':
          next = { x: s.x, y: s.y + dy, w: s.w + dx, h: s.h - dy };
          break;
        case 'sw':
          next = { x: s.x + dx, y: s.y, w: s.w - dx, h: s.h + dy };
          break;
        case 'se':
          next = { x: s.x, y: s.y, w: s.w + dx, h: s.h + dy };
          break;
        default: {
          const x0 = Math.max(0, Math.min(drag.startX, p.x));
          const y0 = Math.max(0, Math.min(drag.startY, p.y));
          const x1 = Math.min(1, Math.max(drag.startX, p.x));
          const y1 = Math.min(1, Math.max(drag.startY, p.y));
          next = { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
        }
      }
      if (drag.mode !== 'move' && drag.mode !== 'draw') {
        // Keep the opposite edge pinned inside the photo.
        if (next.x < 0) {
          next.w += next.x;
          next.x = 0;
        }
        if (next.y < 0) {
          next.h += next.y;
          next.y = 0;
        }
        next.w = Math.min(next.w, 1 - next.x);
        next.h = Math.min(next.h, 1 - next.y);
      }
      const c = clampCrop(next);
      if (c) {
        crop = c;
        queueUpdate();
      }
    });

    const endDrag = (e: PointerEvent) => {
      if (drag && e.pointerId === drag.id) {
        drag = null;
        sfx.tap();
      }
    };
    photo.addEventListener('pointerup', endDrag);
    photo.addEventListener('pointercancel', endDrag);
    photo.addEventListener('dblclick', () => {
      crop = distill ? { x: 0.35, y: 0.35, w: 0.3, h: 0.3 } : { x: 0, y: 0, w: 1, h: 1 };
      queueUpdate();
    });
    photo.addEventListener(
      'wheel',
      (e) => {
        e.preventDefault();
        resizeCrop(e.deltaY > 0 ? 1.06 : 1 / 1.06);
      },
      { passive: false },
    );

    function resizeCrop(k: number): void {
      const cx = crop.x + crop.w / 2;
      const cy = crop.y + crop.h / 2;
      const w = Math.min(1, crop.w * k);
      const hh = Math.min(1, crop.h * k);
      const c = clampCrop({ x: cx - w / 2, y: cy - hh / 2, w, h: hh });
      if (c) {
        crop = c;
        queueUpdate();
      }
    }

    function moveCrop(dx: number, dy: number): void {
      const c = clampCrop({ ...crop, x: crop.x + dx, y: crop.y + dy });
      if (c) {
        crop = c;
        queueUpdate();
      }
    }

    // --- albedo -----------------------------------------------------------------------
    function toggleAlbedo(): void {
      if (assayer.albedo) {
        assayer.setAlbedo(null);
        albedoBtn.textContent = '◌ Tap something white';
        toast('White reference cleared. Automatic light correction is back.');
        queueRender();
        return;
      }
      albedoMode = !albedoMode;
      photo.classList.toggle('albedo-mode', albedoMode);
      albedoBtn.classList.toggle('active', albedoMode);
      (screen.querySelector('.brew-help') as HTMLElement).textContent = albedoHelp();
    }

    function tapWhite(x: number, y: number): void {
      const res = albedoGains(plate, x * plate.w, y * plate.h, Math.max(4, Math.round(Math.min(plate.w, plate.h) * 0.02)));
      albedoMode = false;
      photo.classList.remove('albedo-mode');
      albedoBtn.classList.remove('active');
      (screen.querySelector('.brew-help') as HTMLElement).textContent = albedoHelp();
      if (!res.ok || !res.gains) {
        sfx.error();
        toast(res.reason ?? 'That is not white enough.');
        return;
      }
      assayer.setAlbedo(res.gains);
      albedoBtn.textContent = '✓ White set · undo';
      sfx.clink(1);
      toast('Light calibrated. Free of charge.');
      queueRender();
    }

    // --- confirm ----------------------------------------------------------------------------
    function confirm(): void {
      if (assayBtn.disabled) {
        sfx.error();
        toast('Distill: crop to 10 % of the photo or less.');
        return;
      }
      sfx.pour();
      const record = finishBrew(r, { assayer, edits: { ...edits }, crop: { ...crop }, secondsLeft, source: canvas });
      goAssay(record, canvas);
    }

    const offKeys = onKeys((e) => {
      if (document.querySelector('.overlay')) return;
      const step = e.shiftKey ? 0.1 : 0.02;
      if (e.key === 'Enter') {
        e.preventDefault();
        confirm();
      } else if (e.key === 'Escape') void quitRun();
      else if ((e.target as HTMLElement)?.tagName === 'INPUT') return;
      else if (e.key === 'ArrowLeft') moveCrop(-step, 0);
      else if (e.key === 'ArrowRight') moveCrop(step, 0);
      else if (e.key === 'ArrowUp') moveCrop(0, -step);
      else if (e.key === 'ArrowDown') moveCrop(0, step);
      else if (e.key === '+' || e.key === '=') resizeCrop(1.08);
      else if (e.key === '-' || e.key === '_') resizeCrop(1 / 1.08);
      else if (e.key === 'w' || e.key === 'W') toggleAlbedo();
      else return;
      e.preventDefault();
    });

    queueRender();
    return () => {
      ro.disconnect();
      offKeys();
    };
  });
}
