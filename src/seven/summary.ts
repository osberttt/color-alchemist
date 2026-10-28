// The finished craft: "is your life full of colors?" answered. The craft evolves
// through every rank it passed, lands on its final form, and the run is shared
// as a 7-square row.

import { currentPalette, onKeys, show } from '../app';
import { centerOf, fx, shake } from '../ui/fx';
import { addToBoard, getSettings, getStats, recordRun, renameBoardEntry, updateSettings, type BoardKind } from '../meta/storage';
import { emojiFor, share } from '../meta/share';
import { h, fmt, toast, reducedMotion } from '../ui/dom';
import { swatch } from '../ui/components';
import { CRAFT_BLURBS, craftSvg } from '../ui/craft';
import { goBoard, goTitle, sevenAgain } from '../flow';
import { sfx } from '../audio/sfx';
import { SEVEN } from '../data/tuning';
import { craftTierFor } from '../scoring/extract';
import { OPERATIONS, sevenResult, type SevenRun } from './run';

export function sevenShareText(r: SevenRun, total: number, craft: string): string {
  const counts = new Map<string, number>();
  for (const s of r.sections) counts.set(s.tier, (counts.get(s.tier) ?? 0) + 1);
  const order = [...SEVEN.colorTiers.map((t) => t.name), 'Empty'];
  const lines = [
    `Color Alchemist · Seven Colors${r.mode === 'camera' ? '' : ' (practice)'}`,
    `is your life full of colors?  ${craft.toUpperCase()}  ${fmt(total)}`,
    r.sections.map((s) => emojiFor(s.hex)).join(''),
    order
      .filter((t) => counts.has(t))
      .map((t) => `${t} ×${counts.get(t)}`)
      .join(' · '),
  ];
  if (/^https?:/.test(location.href)) lines.push(location.origin + location.pathname);
  return lines.join('\n');
}

export function sevenSummaryScreen(r: SevenRun): void {
  const res = sevenResult(r);
  const record = r.mode !== 'photo';
  const kind: BoardKind = r.mode === 'camera' ? 'seven' : 'seven-practice';
  const settings = getSettings();
  const entryId = `${Date.now().toString(36)}-${r.seed.toString(36)}`;
  const prevBest = getStats().bestRun;
  const rank = record
    ? addToBoard(kind, { id: entryId, name: settings.name || 'Alchemist', score: res.total, band: res.craft, date: new Date().toISOString(), swatches: res.found })
    : null;
  if (record) recordRun(res.total, [res.found[0], res.found[res.found.length - 1]]);
  if (r.mode === 'camera' && r.tutorial) updateSettings({ tutorialDone: true });

  show(
    (screen) => {
      const flood = h('div', { class: 'flood', 'aria-hidden': 'true' });
      const spots = [
        [14, 16],
        [84, 12],
        [50, 34],
        [10, 62],
        [88, 58],
        [30, 92],
        [74, 94],
      ];
      flood.style.background = res.found.map((c, i) => `radial-gradient(circle at ${spots[i][0]}% ${spots[i][1]}%, ${c} 0, ${c}00 42%)`).join(', ');
      const nameInput = h('input', { type: 'text', maxlength: '18', value: settings.name, placeholder: 'Alchemist', 'aria-label': 'Your name for the leaderboard' }) as HTMLInputElement;
      nameInput.addEventListener('change', () => {
        const name = nameInput.value.trim().slice(0, 18);
        updateSettings({ name });
        renameBoardEntry(kind, entryId, name || 'Alchemist');
        toast('Signed.');
      });
      const final = craftTierFor(res.total);
      const hero = h('div', { class: 'craft-stage hero' });
      hero.innerHTML = craftSvg(0);
      const craftTitle = h('h2', { class: 'band' }, SEVEN.craftTiers[0].name);
      const blurb = h('p', { class: 'opus' }, CRAFT_BLURBS[0]);
      const totalEl = h('p', { class: 'total mono' }, '0');

      screen.append(
        flood,
        h(
          'div',
          { class: 'summary' },
          h('p', { class: 'eyebrow' }, r.mode === 'camera' ? 'Your craft' : r.mode === 'practice' ? 'Practice craft' : 'Test-photo craft (not recorded)'),
          h('p', { class: 'tagline' }, 'is your life full of colors?'),
          hero,
          craftTitle,
          blurb,
          totalEl,
          h('div', { class: 'found-strip seven-strip pop-in' }, ...res.found.map((c) => swatch(c))),
          h(
            'ol',
            { class: 'potions stagger' },
            ...r.sections.map((s, i) =>
              h(
                'li',
                { style: { '--i': String(i) } },
                h('span', { class: 'p-sw' }, swatch(s.def.target, 'target'), swatch(s.hex, 'extracted')),
                h('span', { class: 'p-name' }, s.def.name, h('span', { class: 'muted small' }, s.empty ? ` · time ran out · ${OPERATIONS[s.index]}` : ` · ${s.tier} · ΔE ${s.dE.toFixed(1)} · ${OPERATIONS[s.index]}`)),
                h('span', { class: 'mono' }, `+${s.score}`),
              ),
            ),
          ),
          h(
            'p',
            { class: 'rankline' },
            record && res.total > prevBest && prevBest > 0 ? 'New personal best! ' : '',
            record ? (rank ? `#${rank} on this device's board.` : 'Not in your top 20 this time.') : '',
            final.next ? ` ${fmt(final.next.min - res.total)} more for ${final.next.name}.` : '',
          ),
          record ? h('label', { class: 'sign' }, h('span', null, 'Sign the ledger'), nameInput) : null,
          h(
            'div',
            { class: 'row' },
            h(
              'button',
              {
                class: 'btn',
                type: 'button',
                onclick: async () => {
                  const out = await share(sevenShareText(r, res.total, res.craft));
                  toast(out === 'copied' ? 'Copied! Paste it anywhere.' : out === 'shared' ? 'Shared.' : 'Could not share on this browser.');
                },
              },
              'Share',
            ),
            h('button', { class: 'btn primary', type: 'button', onclick: () => sevenAgain() }, 'Craft again ▶'),
          ),
          h(
            'div',
            { class: 'row' },
            h('button', { class: 'btn ghost small', type: 'button', onclick: () => goBoard(kind) }, 'Leaderboard'),
            h('button', { class: 'btn ghost small', type: 'button', onclick: () => goTitle() }, 'Title'),
          ),
        ),
      );

      // The reveal: swatches pop, the total rolls up, then the craft evolves rank by rank.
      const timers: number[] = [];
      const at = (ms: number, fn: () => void) => timers.push(window.setTimeout(fn, reducedMotion() ? Math.min(ms, 100) : ms));
      const swatches = [...screen.querySelectorAll('.seven-strip .swatch')] as HTMLElement[];
      swatches.forEach((s, i) => s.style.setProperty('--i', String(i)));
      swatches.forEach((s, i) =>
        at(450 + i * 150, () => {
          const c = centerOf(s);
          fx.burst(c.x, c.y, [res.found[i]], { count: 12, speed: 200, size: 6 });
          sfx.pop(i);
        }),
      );
      at(450, () => countUp(totalEl, res.total, 1050));
      const evolveStart = 1600;
      const stepMs = 480;
      for (let t = 1; t <= final.index; t++) {
        at(evolveStart + (t - 1) * stepMs, () => {
          hero.classList.remove('craft-promote');
          void hero.offsetWidth;
          hero.innerHTML = craftSvg(t);
          hero.classList.add('craft-promote');
          craftTitle.textContent = SEVEN.craftTiers[t].name;
          blurb.textContent = CRAFT_BLURBS[t];
          const c = centerOf(hero);
          fx.burst(c.x, c.y, currentPalette()?.accents ?? res.found, { count: 14 + t * 4, speed: 220, shapes: ['star', 'circle'] });
          sfx.pop(t + 2);
        });
      }
      at(evolveStart + Math.max(0, final.index - 1) * stepMs + 450, () => {
        screen.classList.add('flooded');
        craftTitle.classList.add('final');
        sfx.fanfare();
        if (final.index >= 4) sfx.choir();
        const pal = currentPalette();
        fx.confetti([...res.found, ...(pal?.accents ?? [])], 50 + final.index * 30);
        const b = centerOf(craftTitle);
        fx.burst(b.x, b.y, pal?.accents ?? res.found, { count: 20 + final.index * 8, speed: 380, shapes: ['star', 'circle', 'square'] });
        if (final.index >= 4) shake(screen, final.index === 5 ? 'hard' : 'soft');
      });
      const offKeys = onKeys((e) => {
        if (e.key === 'Enter') sevenAgain();
        else if (e.key === 'Escape') goTitle();
      });
      return () => {
        timers.forEach(clearTimeout);
        offKeys();
      };
    },
    'summary',
    'summary-screen',
  );
}

function countUp(el: HTMLElement, to: number, ms: number): void {
  const t0 = performance.now();
  const step = (now: number) => {
    const t = Math.min(1, (now - t0) / ms);
    el.textContent = fmt(to * (1 - Math.pow(1 - t, 3)));
    if (t < 1 && el.isConnected) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}
