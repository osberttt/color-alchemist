// The reaction screen (ANALYSIS §4.25–4.26): no camera, just each exposed extract next to
// its target, a clock and the ingredients the reaction offers. Every dose goes into all the
// exposed extracts at once. When the clock runs out (or the player is done) they are judged
// again.

import { onKeys, paletteOverlay } from '../app';
import { sfx } from '../audio/sfx';
import { editColor } from '../color/plate';
import { linearToHex } from '../color/oklab';
import { stamp } from '../ui/components';
import { h, reducedMotion } from '../ui/dom';
import { centerOf, fx, shake } from '../ui/fx';
import { ingredientShelf } from './ingredients';
import { dosesToEdits, INGREDIENTS, reactionName, reactionWhy, type Reaction } from './reaction';
import { reactionGuide } from './reaction-guide';
import { progressPanel } from './progress-panel';
import { OPERATIONS, reactSections, runTotal, type SevenRun } from './run';

export interface ReactionView {
  /** Resolves when the player continues. */
  done: Promise<void>;
  /** The run was left mid-reaction: stop the clock and listeners. */
  cancel(): void;
}

/** `onChange` runs once the extracts have been judged again (to repaint the run's spectrum). */
export function reactionView(host: HTMLElement, r: SevenRun, rx: Reaction, onChange: () => void): ReactionView {
  const secs = rx.indices.map((i) => r.sections[i]);
  const bases = secs.map((s) => s.extracted!.lin);
  const many = secs.length > 1;
  // The clock only starts when the player has read what happened and taps Start.
  let phase: 'brief' | 'mix' | 'judged' | 'gone' = 'brief';
  let remaining = rx.seconds;
  let lastT = performance.now();
  let lastTick = Math.ceil(remaining);
  let judgedAt = 0;
  let raf = 0;
  let resolve!: () => void;
  const done = new Promise<void>((res) => (resolve = res));

  // One row per exposed extract: target | extract, touching, so the eye compares them directly.
  const halves = secs.map((s) => h('span', { class: 'rx-half yours', style: { background: s.hex } }));
  const stack = h(
    'div',
    { class: `rx-stack${many ? ' many' : ''}`, 'aria-label': 'Your extracts: drop ingredients here' },
    ...secs.map((s, i) => h('div', { class: 'rx-compare' }, h('span', { class: 'rx-half target', style: { background: s.def.target } }, many ? h('span', { class: 'rx-tag' }, s.def.name) : null), halves[i])),
  );
  const timeFill = h('i');
  const timeNum = h('span', { class: 'rx-num mono' }, String(remaining));
  const time = h('div', { class: 'rx-time' }, h('span', { class: 'rx-bar' }, timeFill), timeNum);
  const shelf = ingredientShelf(rx.ingredients, () => stack, () => preview());
  const doneBtn = h('button', { class: 'btn primary rx-btn rx-done', type: 'button', onclick: () => finish() }, 'Done ▶');
  const out = h('div', { class: 'rx-out', hidden: true });
  const how = h(
    'p',
    { class: 'rx-how' },
    many ? 'Every ingredient goes into all 3.' : `Drop ingredients into your extract to bring it closer to ${secs[0].def.name}.`,
  );
  // --- the briefing: what set it off (the extracts and their qualities), what's exposed, the time.
  // The ingredients on offer stay a surprise until Start.
  const chain = h(
    'div',
    { class: 'rx-chain', 'aria-label': 'The extracts that set it off' },
    ...rx.window.flatMap((i, k) => {
      const s = r.sections[i];
      const picked = rx.indices.includes(i);
      const link = h(
        'div',
        { class: `rx-link${picked ? ' picked' : ''}` },
        h('span', { class: 'rx-mini', title: `${s.def.name}: target, then your extract` }, h('span', { style: { background: s.def.target } }), h('span', { style: { background: s.hex } })),
        stamp(s.tier, 'small'),
        h('span', { class: 'rx-link-name' }, s.def.name),
        h('span', { class: 'rx-link-tag' }, picked ? 'exposed' : OPERATIONS[i]),
      );
      return k === 0 ? [link] : [h('span', { class: 'rx-sep', 'aria-hidden': 'true' }, rx.kind === 'equilibrium' ? '=' : '→'), link];
    }),
  );
  const offered = INGREDIENTS.filter((i) => rx.ingredients.includes(i.id));
  const startBtn = h('button', { class: 'btn primary rx-btn rx-start', type: 'button', onclick: () => start() }, 'Start ▶');
  // Names the page: the briefing, then mixing, then the result (the user's wording, ANALYSIS §4.38).
  const eyebrow = h('p', { class: 'eyebrow' }, 'You caused a reaction!');
  const brief = h(
    'div',
    { class: 'rx-brief' },
    h('p', { class: 'rx-why' }, reactionWhy(rx)),
    chain,
    h('p', { class: 'rx-what' }, many ? 'All 3 extracts are exposed. Every ingredient goes into all of them.' : `Your ${secs[0].def.name} extract is exposed.`),
    h(
      'p',
      { class: 'rx-offer' },
      `You have ${rx.seconds} seconds and ${offered.length === INGREDIENTS.length ? 'every ingredient' : `${offered.length} ingredients`} to bring ${many ? 'them' : 'it'} closer to ${many ? 'their colors' : secs[0].def.name}.`,
    ),
    h(
      'div',
      { class: 'rx-actions' },
      h('button', { class: 'btn ghost small', type: 'button', onclick: () => showReactionList() }, 'All reactions'),
      startBtn,
    ),
  );

  // --- the mix: the clock runs ------------------------------------------------------------------
  const mix = h(
    'div',
    { class: 'rx-mix', hidden: true },
    stack,
    // With three rows, each target half carries its name instead (phones are short).
    many ? null : h('div', { class: 'rx-labels' }, h('span', null, secs[0].def.name), h('span', null, 'your extract')),
    time,
    how,
    shelf.el,
    out,
    h('div', { class: 'rx-actions' }, doneBtn),
  );

  const el = h(
    'div',
    { class: `reaction rx-${rx.kind}`, role: 'dialog', 'aria-modal': 'true', 'aria-label': `Reaction: ${reactionName(rx)}` },
    h('div', { class: 'rx-inner' }, eyebrow, h('h2', { class: 'rx-name' }, reactionName(rx)), brief, mix),
  );
  host.append(el);
  requestAnimationFrame(() => {
    const c = centerOf(chain);
    fx.burst(c.x, c.y, rx.window.map((i) => r.sections[i].hex), { count: 18, speed: 200, size: 6, gravity: 0 });
    startBtn.focus();
  });

  function start(): void {
    if (phase !== 'brief') return;
    phase = 'mix';
    eyebrow.textContent = 'Mixing with ingredients';
    lastT = performance.now();
    brief.hidden = true;
    mix.hidden = false;
    sfx.clink(2);
    requestAnimationFrame(() => {
      const c = centerOf(stack);
      fx.burst(c.x, c.y, secs.flatMap((s) => [s.def.target, s.hex]), { count: 18, speed: 200, size: 6, gravity: 0 });
    });
  }

  function preview(): void {
    const edits = dosesToEdits(shelf.doses);
    halves.forEach((half, i) => (half.style.background = linearToHex(...editColor(bases[i], edits))));
  }

  function finish(): void {
    if (phase !== 'mix') return;
    phase = 'judged';
    eyebrow.textContent = 'Reaction result';
    judgedAt = performance.now();
    shelf.lock();
    const before = secs.map((s) => ({ tier: s.tier, score: s.score, dE: s.dE }));
    const touched = Object.values(shelf.doses).some((d) => d !== 0);
    const totalBefore = runTotal(r);
    if (touched) reactSections(r, rx.indices, dosesToEdits(shelf.doses), rx.kind);
    halves.forEach((half, i) => (half.style.background = secs[i].hex));
    onChange();

    const gain = secs.reduce((t, s, i) => t + s.score - before[i].score, 0);
    const signed = (n: number) => (n > 0 ? `+${n}` : n < 0 ? `−${-n}` : '±0');
    const rows = secs.map((s, i) =>
      h(
        'div',
        { class: 'rx-row' },
        stamp(s.tier, many ? 'small' : 'slam'),
        h(
          'div',
          { class: 'rx-delta' },
          h('p', { class: 'rx-change' }, many ? `${s.def.name} · ` : '', !touched ? 'untouched' : before[i].tier === s.tier ? `still ${s.tier}` : `${before[i].tier} → ${s.tier}`),
          h('p', { class: 'mono small' }, touched ? `ΔE ${before[i].dE.toFixed(1)} → ${s.dE.toFixed(1)}` : `ΔE ${s.dE.toFixed(1)}`),
        ),
        h('span', { class: `rx-points mono ${s.score > before[i].score ? 'up' : s.score < before[i].score ? 'down' : ''}` }, signed(s.score - before[i].score)),
      ),
    );
    // The potion's progress again: its bar moves from the total before the reaction to the new one.
    const progress = progressPanel(totalBefore);
    out.replaceChildren(...rows, many ? h('p', { class: 'rx-sum mono' }, `Total ${signed(gain)}`) : '', progress.el);
    // The outcome takes the place of the clock and the shelf (they no longer matter, and phones are short).
    // With three extracts the rows name each color, so the swatches make room for the potion too.
    how.hidden = time.hidden = shelf.el.hidden = true;
    stack.hidden = many;
    out.hidden = false;
    doneBtn.textContent = 'Continue ▶';
    doneBtn.onclick = () => close();
    sfx.stamp();
    const c = centerOf(out);
    if (gain > 0) fx.burst(c.x, c.y, secs.flatMap((s) => [s.def.target, s.hex]), { count: 20 + Math.round(gain / 2), speed: 260, shapes: ['star', 'circle'] });
    else if (gain < 0) shake(el, 'soft');
    window.setTimeout(() => phase === 'judged' && progress.moveTo(runTotal(r)), reducedMotion() ? 0 : 700);
    doneBtn.focus();
  }

  function close(): void {
    // Ignore taps in the first moment, so a double-tap on Done can't skip the outcome.
    if (phase !== 'judged' || performance.now() - judgedAt < 600) return;
    phase = 'gone';
    stop();
    if (reducedMotion()) {
      el.remove();
      resolve();
      return;
    }
    el.classList.add('down');
    window.setTimeout(() => {
      el.remove();
      resolve();
    }, 350);
  }

  const loop = (now: number) => {
    raf = requestAnimationFrame(loop);
    const dt = (now - lastT) / 1000;
    lastT = now;
    if (phase !== 'mix' || document.hidden) return;
    remaining -= dt;
    const s = Math.ceil(remaining);
    if (s !== lastTick && s > 0 && s <= 3) sfx.tick(true);
    lastTick = s;
    timeNum.textContent = String(Math.max(0, s));
    timeFill.style.width = `${Math.max(0, (remaining / rx.seconds) * 100)}%`;
    el.classList.toggle('urgent', remaining <= 3);
    if (remaining <= 0) finish();
  };
  raf = requestAnimationFrame(loop);

  const offKeys = onKeys((e) => {
    if (e.key !== ' ' && e.key !== 'Enter') return;
    // Enter/Space on a focused button presses it instead; the reaction list has its own keys.
    if ((e.target as HTMLElement)?.closest?.('.rx-shelf, button') || document.querySelector('.overlay')) return;
    e.preventDefault();
    if (phase === 'brief') start();
    else if (phase === 'mix') finish();
    else close();
  });

  function stop(): void {
    cancelAnimationFrame(raf);
    offKeys();
  }

  return {
    done,
    cancel: () => {
      phase = 'gone';
      stop();
      document.querySelector('.overlay.rx-list')?.remove();
    },
  };
}

/** The full list of reactions, as a dialog over the briefing. */
function showReactionList(): void {
  const close = () => {
    overlay.remove();
    window.removeEventListener('keydown', key, true);
  };
  const key = (e: KeyboardEvent) => {
    if (e.key !== 'Escape' && e.key !== 'Enter' && e.key !== ' ') return;
    e.preventDefault();
    e.stopImmediatePropagation();
    close();
  };
  // Capture phase, so Escape closes the list instead of quitting the run.
  window.addEventListener('keydown', key, true);
  const overlay = h(
    'div',
    { class: 'overlay rx-list', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'All reactions', onclick: (e: Event) => e.target === overlay && close() },
    h(
      'div',
      { class: 'dialog howto' },
      h('h2', null, 'Reactions'),
      reactionGuide(),
      h('button', { class: 'btn primary', type: 'button', onclick: close }, 'Got it'),
    ),
  );
  paletteOverlay(overlay, 'howto');
  document.body.append(overlay);
  // Focus without scrolling, so a long list opens at its title on phones.
  (overlay.querySelector('.btn.primary') as HTMLElement).focus({ preventScroll: true });
}
