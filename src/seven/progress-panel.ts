// The potion's progress panel after a reaction (ANALYSIS §4.34): the potion and its bar at
// the total before the reaction, then the bar moves to the new total, up or down. On a change
// of potion the bar runs to the end of the old rank (or back to its start), the potion turns
// into the new one in place, and the bar carries on in the new rank.

import { sfx } from '../audio/sfx';
import { SEVEN } from '../data/tuning';
import { craftTierFor } from '../scoring/extract';
import { h, fmt, reducedMotion } from '../ui/dom';
import { applyPaletteTo, paletteFor } from '../ui/palettes';
import { POTION_BLURBS, potionSvg } from '../ui/potion';

export interface ProgressPanel {
  el: HTMLElement;
  /** Animates from the starting total to `to`. */
  moveTo(to: number): void;
}

export function progressPanel(from: number): ProgressPanel {
  const pal = paletteFor('result');
  const stage = h('div', { class: 'craft-stage' });
  const name = h('p', { class: 'craft-name' });
  const blurb = h('p', { class: 'craft-blurb' });
  const fill = h('i');
  const label = h('span', { class: 'bar-label mono' });
  const el = h('div', { class: 'craft-panel rx-craft' }, stage, h('div', { class: 'craft-info' }, name, blurb, h('div', { class: 'craft-bar' }, fill), label));
  // The panel shows the potion in the result sheet's palette, as on the sheet.
  applyPaletteTo(el, pal);

  const pct = (total: number) => {
    const tier = craftTierFor(total);
    const lo = SEVEN.craftTiers[tier.index].min;
    const hi = tier.next?.min ?? SEVEN.sections * 100;
    return Math.max(3, Math.min(100, ((total - lo) / Math.max(1, hi - lo)) * 100));
  };
  const setFill = (width: number, ms: number) => {
    fill.style.transition = ms ? `width ${ms}ms cubic-bezier(.2,.8,.2,1)` : 'none';
    fill.style.width = `${width}%`;
  };
  const showPotion = (total: number) => {
    const tier = craftTierFor(total);
    stage.innerHTML = potionSvg(tier.index, pal);
    name.textContent = tier.name;
    blurb.textContent = POTION_BLURBS[tier.index];
  };
  const nudge = (big: boolean) => {
    stage.classList.remove('craft-nudge', 'craft-nudge-big');
    void stage.offsetWidth;
    stage.classList.add(big ? 'craft-nudge-big' : 'craft-nudge');
  };
  const paintLabel = (total: number, delta: number) => {
    const tier = craftTierFor(total);
    const change = delta > 0 ? ` (+${delta})` : delta < 0 ? ` (−${-delta})` : '';
    label.textContent = tier.next ? `${fmt(total)}${change} · ${fmt(tier.next.min - total)} to ${tier.next.name}` : `${fmt(total)}${change} · the finest potion`;
  };

  showPotion(from);
  setFill(pct(from), 0);
  paintLabel(from, 0);

  return {
    el,
    moveTo(to: number) {
      const a = craftTierFor(from).index;
      const b = craftTierFor(to).index;
      paintLabel(to, to - from);
      if (reducedMotion() || a === b) {
        if (a !== b) showPotion(to);
        setFill(pct(to), reducedMotion() ? 0 : 900);
        if (to !== from) nudge(false);
        return;
      }
      // A change of potion: to the end of the old rank (up) or its start (down), swap, carry on.
      const up = b > a;
      setFill(up ? 100 : 0, 450);
      window.setTimeout(() => {
        showPotion(to);
        nudge(up);
        if (up) {
          name.classList.add('promoted');
          sfx.fanfare();
        }
        setFill(up ? 0 : 100, 0);
        void fill.offsetWidth; // commit the jump before moving again
        setFill(pct(to), 700);
      }, 470);
    },
  };
}
