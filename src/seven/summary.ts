// Seven Colors Magnum Opus: "is your life full of colors?" answered, with a 7-square share row.

import { currentPalette, onKeys, show } from '../app';
import { centerOf, fx } from '../ui/fx';
import { addToBoard, getSettings, getStats, recordRun, renameBoardEntry, updateSettings, type BoardKind } from '../meta/storage';
import { emojiFor, share } from '../meta/share';
import { h, fmt, toast } from '../ui/dom';
import { swatch } from '../ui/components';
import { goBoard, goTitle, sevenAgain } from '../flow';
import { sfx } from '../audio/sfx';
import { SEVEN } from '../data/tuning';
import { nextSevenBand, OPERATIONS, sevenResult, type SevenRun } from './run';

const OPUS: Record<string, string> = {
  GRAYSCALE: 'Grayscale Dregs',
  SEPIA: 'Sepia Tonic',
  PASTEL: 'Pastel Philter',
  VIVID: 'Vivid Panacea',
  TECHNICOLOR: 'Technicolor Ambrosia',
  'FULL SPECTRUM': "Philosopher's Panacea",
};

export function sevenShareText(r: SevenRun, total: number, band: string): string {
  const counts = new Map<string, number>();
  for (const s of r.sections) counts.set(s.grade, (counts.get(s.grade) ?? 0) + 1);
  const lines = [
    `Color Alchemist · Seven Colors${r.mode === 'camera' ? '' : ' (practice)'}`,
    `is your life full of colors?  ${band}  ${fmt(total)}`,
    r.sections.map((s) => emojiFor(s.hex)).join(''),
    [...counts.entries()].map(([g, n]) => `${g} ×${n}`).join(' · '),
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
    ? addToBoard(kind, { id: entryId, name: settings.name || 'Alchemist', score: res.total, band: res.band, date: new Date().toISOString(), swatches: res.found })
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
      const nb = nextSevenBand(res.total);
      screen.append(
        flood,
        h(
          'div',
          { class: 'summary' },
          h('p', { class: 'eyebrow' }, r.mode === 'camera' ? 'The Magnum Opus' : r.mode === 'practice' ? 'Practice Opus' : 'Test-photo Opus (not recorded)'),
          h('p', { class: 'tagline' }, 'is your life full of colors?'),
          h('h2', { class: 'band' }, res.band),
          h('p', { class: 'total mono' }, fmt(res.total)),
          h('p', { class: 'opus' }, OPUS[res.band]),
          h('div', { class: 'found-strip seven-strip pop-in' }, ...res.found.map((c) => swatch(c))),
          res.stone ? h('p', { class: 'stone' }, `Philosopher's Stone: all seven at Essence or better. +${SEVEN.stonePoints}`) : null,
          h(
            'ol',
            { class: 'potions stagger' },
            ...r.sections.map((s) =>
              h(
                'li',
                null,
                h('span', { class: 'p-sw' }, swatch(s.def.target, 'target'), swatch(s.hex, 'yours')),
                h('span', { class: 'p-name' }, `${s.grade} of ${s.def.virtue}`, h('span', { class: 'muted small' }, ` · ${s.def.name} · ${OPERATIONS[s.index]}`)),
                h('span', { class: 'mono' }, `+${fmt(s.total)}`),
              ),
            ),
          ),
          h(
            'p',
            { class: 'rankline' },
            record && res.total > prevBest && prevBest > 0 ? 'New personal best! ' : '',
            record ? (rank ? `#${rank} on this device's board.` : 'Not in your top 20 this time.') : '',
            nb ? ` ${fmt(nb.at - res.total)} more for ${nb.name}.` : '',
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
                  const out = await share(sevenShareText(r, res.total, res.band));
                  toast(out === 'copied' ? 'Copied! Paste it anywhere.' : out === 'shared' ? 'Shared.' : 'Could not share on this browser.');
                },
              },
              'Share',
            ),
            h('button', { class: 'btn primary', type: 'button', onclick: () => sevenAgain() }, 'Brew again ▶'),
          ),
          h(
            'div',
            { class: 'row' },
            h('button', { class: 'btn ghost small', type: 'button', onclick: () => goBoard(kind) }, 'Leaderboard'),
            h('button', { class: 'btn ghost small', type: 'button', onclick: () => goTitle() }, 'Title'),
          ),
        ),
      );
      // The reveal: swatches pop one by one, the total rolls up, the band slams, confetti.
      const timers: number[] = [];
      const at = (ms: number, fn: () => void) => timers.push(window.setTimeout(fn, ms));
      const totalEl = screen.querySelector('.total') as HTMLElement;
      const swatches = [...screen.querySelectorAll('.seven-strip .swatch')] as HTMLElement[];
      swatches.forEach((s, i) => s.style.setProperty('--i', String(i)));
      screen.querySelectorAll('.potions li').forEach((li, i) => (li as HTMLElement).style.setProperty('--i', String(i)));
      totalEl.textContent = '0';
      swatches.forEach((s, i) =>
        at(450 + i * 150, () => {
          const c = centerOf(s);
          fx.burst(c.x, c.y, [res.found[i]], { count: 12, speed: 200, size: 6 });
          sfx.pop(i);
        }),
      );
      at(450, () => countUp(totalEl, res.total, 1050));
      at(1550, () => {
        screen.classList.add('flooded');
        sfx.fanfare();
        const pal = currentPalette();
        fx.confetti([...res.found, ...(pal?.accents ?? [])], res.stone ? 180 : 110);
        const b = centerOf(screen.querySelector('.band')!);
        fx.burst(b.x, b.y, pal?.accents ?? res.found, { count: 36, speed: 380, shapes: ['star', 'circle', 'square'] });
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
