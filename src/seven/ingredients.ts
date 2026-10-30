// The ingredient shelf for reactions (ANALYSIS §4.25–4.30): just the ingredients on offer,
// dragged (or tapped) into the exposed extracts. Each is one dose along one axis; opposite
// ingredients cancel; there's no limit. No meters and no undo: think fast and commit; the
// extract's color is the only feedback.

import { sfx, vibrate } from '../audio/sfx';
import { centerOf, fx } from '../ui/fx';
import { h, reducedMotion, toast } from '../ui/dom';
import { INGREDIENTS, type Axis, type Ingredient } from './reaction';

export interface Shelf {
  el: HTMLElement;
  doses: Record<Axis, number>;
  /** No more doses (the reaction is over). */
  lock(): void;
}

/**
 * Drag an ingredient (ids from INGREDIENTS) into `target` (or tap it: it pours itself in).
 * Every dose updates `doses` and calls `onDose` with the ingredient's color.
 */
export function ingredientShelf(ids: string[], target: () => HTMLElement, onDose: (color: string) => void): Shelf {
  const offered = INGREDIENTS.filter((i) => ids.includes(i.id));
  const doses: Record<Axis, number> = { ev: 0, sat: 0, warm: 0, tint: 0 };
  let locked = false;

  const dose = (ing: Ingredient, at: { x: number; y: number }) => {
    if (locked) return;
    doses[ing.axis] += ing.sign;
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

  /** A tap (or Enter): the ingredient flies into the extract by itself. */
  const pour = (ing: Ingredient, btn: HTMLElement) => {
    if (locked) return;
    const to = centerOf(target());
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
      { class: `ing ing-${ing.id}`, type: 'button', 'aria-label': `${ing.name}: drop into the extract` },
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
      if (!start || locked) return;
      if (!ghost && Math.hypot(e.clientX - start.x, e.clientY - start.y) > 8) {
        ghost = ghostOf(ing, e.clientX, e.clientY);
        target().classList.add('drop-ready');
      }
      if (ghost) {
        ghost.style.left = `${e.clientX}px`;
        ghost.style.top = `${e.clientY}px`;
      }
    });
    const end = (e: PointerEvent, cancelled: boolean) => {
      if (!start) return;
      start = null;
      target().classList.remove('drop-ready');
      if (!ghost) {
        if (!cancelled) pour(ing, btn);
        return;
      }
      ghost.remove();
      ghost = null;
      if (!cancelled && inside(target(), e.clientX, e.clientY)) dose(ing, { x: e.clientX, y: e.clientY });
      else if (!locked) toast('Drop it into your extract.');
    };
    btn.addEventListener('pointerup', (e) => end(e, false));
    btn.addEventListener('pointercancel', (e) => end(e, true));
    // Keyboard (Enter/Space on the button) pours; pointer taps are handled above.
    btn.addEventListener('click', (e) => e.detail === 0 && pour(ing, btn));
    return btn;
  };

  const el = h('div', { class: 'rx-shelf' }, ...offered.map(tile));
  return {
    el,
    doses,
    lock: () => {
      locked = true;
      el.classList.add('locked');
      el.querySelectorAll('button').forEach((b) => ((b as HTMLButtonElement).disabled = true));
    },
  };
}
