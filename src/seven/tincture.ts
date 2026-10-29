// The tincture: before the first color the player calibrates the machine for their own
// light, by dropping ingredients into it until the world inside the machine looks like
// the world around them (ANALYSIS §4.23–4.24). Each ingredient is one dose along one
// axis; opposite ingredients cancel; there's no limit. The result is a fixed edit for
// the whole run.

import type { Edits } from '../color/plate';
import { SEVEN } from '../data/tuning';
import { sfx, vibrate } from '../audio/sfx';
import { centerOf, fx } from '../ui/fx';
import { h, reducedMotion, toast } from '../ui/dom';

type Axis = 'ev' | 'sat' | 'warm' | 'tint';
const AXES: Axis[] = ['ev', 'sat', 'warm', 'tint'];

interface Ingredient {
  id: string;
  name: string;
  axis: Axis;
  sign: 1 | -1;
  /** Color of its splash. */
  fx: string;
}

const INGREDIENTS: Ingredient[] = [
  { id: 'sunlight', name: 'Sunlight', axis: 'ev', sign: 1, fx: '#ffd34d' },
  { id: 'darkness', name: 'Darkness', axis: 'ev', sign: -1, fx: '#2b2d4a' },
  { id: 'pigment', name: 'Pigment', axis: 'sat', sign: 1, fx: '#ff4d6d' },
  { id: 'ash', name: 'Ash', axis: 'sat', sign: -1, fx: '#9a9a9a' },
  { id: 'cinnamon', name: 'Cinnamon', axis: 'warm', sign: 1, fx: '#b5652b' },
  { id: 'cobalt', name: 'Cobalt', axis: 'warm', sign: -1, fx: '#2f5fd0' },
  { id: 'moss', name: 'Moss', axis: 'tint', sign: 1, fx: '#5f9a3c' },
  { id: 'rose', name: 'Rose', axis: 'tint', sign: -1, fx: '#d94f8f' },
];

const AXIS_LABEL: Record<Axis, string> = { ev: 'Light', sat: 'Color', warm: 'Warmth', tint: 'Tint' };
/** Doses at which a meter is half full on its side (it fills softly, never runs out). */
const METER_HALF = 6;

export interface Mixer {
  el: HTMLElement;
  reset(): void;
}

/**
 * The ingredient shelf. Drag an ingredient into `machine` (or tap it: it pours itself in);
 * every dose updates `t` in place (the viewfinder and the capture read it) and calls
 * `onDose` with the ingredient's color, so the machine can show the liquid going in.
 */
export function tinctureMixer(t: Edits, machine: () => HTMLElement, onDose: (color: string) => void): Mixer {
  const { evPerDose, satPerDose, warmPerDose, tintPerDose } = SEVEN.tincture;
  const doses: Record<Axis, number> = { ev: 0, sat: 0, warm: 0, tint: 0 };
  const meters = {} as Record<Axis, { fill: HTMLElement; label: HTMLElement }>;

  const apply = () => {
    t.ev = doses.ev * evPerDose;
    // Compounding, so Ash keeps graying without ever passing grey into inverted colors.
    t.sat = Math.pow(1 + satPerDose, doses.sat) - 1;
    t.warm = doses.warm * warmPerDose;
    t.tint = doses.tint * tintPerDose;
    for (const ax of AXES) {
      const v = doses[ax];
      const pct = (Math.abs(v) / (Math.abs(v) + METER_HALF)) * 50;
      meters[ax].fill.style.left = `${v < 0 ? 50 - pct : 50}%`;
      meters[ax].fill.style.width = `${pct}%`;
      meters[ax].fill.dataset.side = v < 0 ? 'minus' : 'plus';
      meters[ax].label.textContent = `${AXIS_LABEL[ax]} ${v > 0 ? `+${v}` : v < 0 ? `−${-v}` : '0'}`;
    }
  };

  const dose = (ing: Ingredient, at: { x: number; y: number }) => {
    doses[ing.axis] += ing.sign;
    apply();
    fx.splash(at.x, at.y, ing.fx, 16);
    onDose(ing.fx);
    sfx.drip();
    vibrate(10);
  };

  const ghostOf = (ing: Ingredient, x: number, y: number) => {
    const g = h('span', { class: `ing-jar ing-ghost ing-${ing.id}`, 'aria-hidden': 'true' });
    g.style.left = `${x}px`;
    g.style.top = `${y}px`;
    document.body.append(g);
    return g;
  };

  const inside = (el: HTMLElement, x: number, y: number) => {
    const r = el.getBoundingClientRect();
    return x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
  };

  /** A tap (or Enter): the ingredient flies into the machine by itself. */
  const pour = (ing: Ingredient, btn: HTMLElement) => {
    const to = centerOf(machine());
    if (reducedMotion()) return dose(ing, to);
    const from = centerOf(btn);
    const g = ghostOf(ing, from.x, from.y);
    const a = g.animate(
      [
        { transform: 'translate(-50%, -50%) scale(1)' },
        { transform: `translate(calc(-50% + ${to.x - from.x}px), calc(-50% + ${to.y - from.y}px)) scale(0.5)`, opacity: 0.85 },
      ],
      { duration: 130, easing: 'cubic-bezier(.5,0,.75,.4)' },
    );
    a.onfinish = () => {
      g.remove();
      dose(ing, to);
    };
  };

  const tile = (ing: Ingredient) => {
    const btn = h(
      'button',
      { class: `ing ing-${ing.id}`, type: 'button', 'aria-label': `${ing.name}: drop into the machine` },
      h('span', { class: `ing-jar ing-${ing.id}`, 'aria-hidden': 'true' }),
      h('span', { class: 'ing-name' }, ing.name),
    );
    let start: { x: number; y: number } | null = null;
    let ghost: HTMLElement | null = null;
    btn.addEventListener('pointerdown', (e) => {
      start = { x: e.clientX, y: e.clientY };
      btn.setPointerCapture(e.pointerId);
    });
    btn.addEventListener('pointermove', (e) => {
      if (!start) return;
      if (!ghost && Math.hypot(e.clientX - start.x, e.clientY - start.y) > 8) {
        ghost = ghostOf(ing, e.clientX, e.clientY);
        machine().classList.add('tc-target');
      }
      if (ghost) {
        ghost.style.left = `${e.clientX}px`;
        ghost.style.top = `${e.clientY}px`;
      }
    });
    const end = (e: PointerEvent, cancelled: boolean) => {
      if (!start) return;
      start = null;
      machine().classList.remove('tc-target');
      if (!ghost) {
        if (!cancelled) pour(ing, btn);
        return;
      }
      ghost.remove();
      ghost = null;
      if (!cancelled && inside(machine(), e.clientX, e.clientY)) dose(ing, { x: e.clientX, y: e.clientY });
      else toast('Drop it into the machine.');
    };
    btn.addEventListener('pointerup', (e) => end(e, false));
    btn.addEventListener('pointercancel', (e) => end(e, true));
    // Keyboard (Enter/Space on the button) pours; pointer taps are handled above.
    btn.addEventListener('click', (e) => e.detail === 0 && pour(ing, btn));
    return btn;
  };

  const pairs = AXES.map((ax) => {
    const fill = h('span', { class: 'tc-fill' });
    const label = h('span', { class: 'tc-axis' });
    meters[ax] = { fill, label };
    const [plus, minus] = [INGREDIENTS.find((i) => i.axis === ax && i.sign > 0)!, INGREDIENTS.find((i) => i.axis === ax && i.sign < 0)!];
    // Minus on the left, plus on the right: the meter fills toward the ingredient added.
    return h('div', { class: `tc-pair tc-${ax}` }, h('div', { class: 'tc-tiles' }, tile(minus), tile(plus)), h('span', { class: 'tc-meter' }, fill, h('span', { class: 'tc-zero' })), label);
  });

  const reset = () => {
    doses.ev = doses.sat = doses.warm = doses.tint = 0;
    apply();
  };

  const el = h(
    'div',
    { class: 'tincture' },
    h(
      'div',
      { class: 'tc-head' },
      h('h2', null, 'Mix your tincture'),
      h(
        'button',
        {
          class: 'btn ghost small',
          type: 'button',
          onclick: () => {
            reset();
            sfx.pour();
          },
        },
        'Pour out',
      ),
    ),
    h('p', { class: 'tc-how' }, 'Drop ingredients into the machine until the world inside looks like the world around you.'),
    h('div', { class: 'tc-shelf' }, ...pairs),
  );
  reset();
  return { el, reset };
}
