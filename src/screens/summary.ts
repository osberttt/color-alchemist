// The Magnum Opus: "is your life full of colors?" answered (GDD §7).

import { onKeys, show } from '../app';
import { runResult, type Run } from '../game';
import { addToBoard, getSettings, getStats, recordRun, renameBoardEntry, updateSettings, type BoardKind } from '../meta/storage';
import { nextBand } from '../scoring/score';
import { share, shareText } from '../meta/share';
import { h, fmt, toast } from '../ui/dom';
import { swatch } from '../ui/components';
import { brewAgain, goBoard, goGrimoire, goTitle } from '../flow';
import { sfx } from '../audio/sfx';
import { TUNING } from '../data/tuning';

export function summaryScreen(r: Run): void {
  const res = runResult(r);
  const kind: BoardKind = r.mode;
  const settings = getSettings();
  const entryId = `${Date.now().toString(36)}-${r.seed.toString(36)}`;
  const rank = addToBoard(kind, {
    id: entryId,
    name: settings.name || 'Alchemist',
    score: res.total,
    band: res.band.name,
    date: new Date().toISOString(),
    swatches: res.found,
  });
  const prevBest = getStats().bestRun;
  recordRun(res.total, [res.found[0], res.found[res.found.length - 1]]);
  if (r.mode === 'camera' && r.tutorial) updateSettings({ tutorialDone: true });

  show(
    (screen) => {
      const flood = h('div', { class: 'flood', 'aria-hidden': 'true' });
      const spots = [
        [18, 20],
        [80, 14],
        [50, 46],
        [12, 78],
        [86, 70],
        [52, 96],
      ];
      flood.style.background = res.found
        .map((c, i) => `radial-gradient(circle at ${spots[i][0]}% ${spots[i][1]}%, ${c} 0, ${c}00 46%)`)
        .join(', ');

      const nameInput = h('input', {
        type: 'text',
        maxlength: '18',
        value: settings.name,
        placeholder: 'Alchemist',
        'aria-label': 'Your name for the leaderboard',
      }) as HTMLInputElement;
      nameInput.addEventListener('change', () => {
        const name = nameInput.value.trim().slice(0, 18);
        updateSettings({ name });
        renameBoardEntry(kind, entryId, name || 'Alchemist');
        toast('Signed.');
      });

      const nb = nextBand(res.total);
      const isBest = res.total > prevBest && prevBest > 0;

      screen.append(
        flood,
        h(
          'div',
          { class: 'summary' },
          h('p', { class: 'eyebrow' }, r.mode === 'camera' ? 'The Magnum Opus' : 'Practice Opus'),
          h('p', { class: 'tagline' }, 'is your life full of colors?'),
          h('h2', { class: `band band-${res.band.name.toLowerCase().replace(/\s/g, '-')}` }, res.band.name),
          h('p', { class: 'total mono' }, fmt(res.total)),
          h('p', { class: 'opus' }, res.band.opus),
          h('div', { class: 'found-strip' }, ...res.found.map((c) => swatch(c))),
          res.stone ? h('p', { class: 'stone' }, `Philosopher's Stone: all six colors at Essence or better. +${TUNING.stonePoints}`) : null,
          h(
            'ol',
            { class: 'potions' },
            ...r.brews.map((b) =>
              h(
                'li',
                null,
                h('span', { class: 'p-sw' }, swatch(b.a.hex), swatch(b.b.hex)),
                h('span', { class: 'p-name' }, b.potion),
                h('span', { class: 'mono' }, `+${fmt(b.breakdown.total)}`),
              ),
            ),
          ),
          h(
            'p',
            { class: 'rankline' },
            isBest ? 'New personal best! ' : '',
            rank ? `#${rank} on this device's ${kind === 'camera' ? 'hunt' : 'practice'} board.` : 'Not in your top 20 this time.',
            nb ? ` ${fmt(nb.at - res.total)} more for ${nb.name}.` : '',
          ),
          h('label', { class: 'sign' }, h('span', null, 'Sign the ledger'), nameInput),
          h(
            'div',
            { class: 'row' },
            h(
              'button',
              {
                class: 'btn',
                type: 'button',
                onclick: async () => {
                  const out = await share(shareText(r.mode, r.brews, res));
                  toast(out === 'copied' ? 'Copied! Paste it anywhere.' : out === 'shared' ? 'Shared.' : 'Could not share on this browser.');
                },
              },
              'Share',
            ),
            h('button', { class: 'btn primary', type: 'button', onclick: () => brewAgain() }, 'Brew again ▶'),
          ),
          h(
            'div',
            { class: 'row' },
            h('button', { class: 'btn ghost small', type: 'button', onclick: () => goGrimoire() }, 'Grimoire'),
            h('button', { class: 'btn ghost small', type: 'button', onclick: () => goBoard(kind) }, 'Leaderboard'),
            h('button', { class: 'btn ghost small', type: 'button', onclick: () => goTitle() }, 'Title'),
          ),
          r.mode === 'practice' ? h('p', { class: 'muted small center' }, 'Ready for the real thing? The hunt uses your camera and your world.') : null,
        ),
      );
      setTimeout(() => {
        screen.classList.add('flooded');
        sfx.fanfare();
      }, 350);
      return onKeys((e) => {
        if (e.key === 'Enter') brewAgain();
        else if (e.key === 'Escape') goTitle();
      });
    },
    'paper',
    'summary-screen',
  );
}
