// Assay: the scoring reveal, then the potion (GDD §6, §7). Tap to skip the theater.

import { onKeys, show, spectrumBar } from '../app';
import { mixLab, oklabToHex } from '../color/oklab';
import { stageName, type BrewRecord, type ColorResult, type Run } from '../game';
import { gradeRank } from '../scoring/score';
import { h, append, flaskSvg, svg, fmt, reducedMotion, wait } from '../ui/dom';
import { stamp, swatch } from '../ui/components';
import { goNext } from '../flow';
import { sfx, vibrate } from '../audio/sfx';

export function assayScreen(r: Run, rec: BrewRecord, photo: HTMLCanvasElement): void {
  show((screen) => {
    let skip = reducedMotion();
    let finished = false;
    const pause = async (ms: number) => {
      if (!skip) await wait(ms);
    };

    // Cropped photo, drained to grey, with the two loupes.
    const crop = rec.crop;
    const thumb = h('canvas', { class: 'assay-photo' });
    const sw = Math.max(1, Math.round(crop.w * photo.width));
    const sh = Math.max(1, Math.round(crop.h * photo.height));
    thumb.width = sw;
    thumb.height = sh;
    thumb.getContext('2d')!.drawImage(photo, crop.x * photo.width, crop.y * photo.height, sw, sh, 0, 0, sw, sh);
    const loupe = (c: ColorResult, label: string) => {
      const el = h('span', { class: `loupe ${label.toLowerCase()}`, hidden: true }, label);
      if (c.match) {
        el.style.left = `${((c.match.cx - crop.x) / crop.w) * 100}%`;
        el.style.top = `${((c.match.cy - crop.y) / crop.h) * 100}%`;
        el.style.setProperty('--found', c.hex);
      }
      return el;
    };
    const loupeA = loupe(rec.a, 'A');
    const loupeB = loupe(rec.b, 'B');
    const beam = h('span', { class: 'beam' });
    const photoBox = h('div', { class: 'assay-photo-box' }, thumb, loupeA, loupeB, beam);
    photoBox.style.aspectRatio = `${sw} / ${sh}`;

    const colorRow = (c: ColorResult, label: string) => {
      const accEl = h('span', { class: 'acc' }, '0');
      const bar = h('i');
      const stampSlot = h('span', { class: 'stamp-slot' });
      const hint = h('p', { class: 'hint' }, '');
      const el = h(
        'div',
        { class: 'assay-row', hidden: true },
        h(
          'div',
          { class: 'ar-top' },
          h('span', { class: 'r-name' }, h('b', null, label), ' ', c.def.name),
          h('span', { class: 'pair-sw' }, swatch(c.def.target, 'target'), h('span', { class: 'arrow' }, '→'), swatch(c.match ? c.hex : 'transparent', 'yours')),
        ),
        h('div', { class: 'ar-mid' }, h('span', { class: 'bar' }, bar), accEl, stampSlot),
        hint,
      );
      return { el, accEl, bar, stampSlot, hint };
    };
    const rowA = colorRow(rec.a, 'A');
    const rowB = colorRow(rec.b, 'B');

    const receipt = h('div', { class: 'receipt', hidden: true });
    const totalEl = h('div', { class: 'receipt-total', hidden: true });
    const potionEl = h('div', { class: 'potion', hidden: true });
    const nextBtn = h(
      'button',
      { class: 'btn primary xl', type: 'button', hidden: true, onclick: () => next() },
      r.stage >= 2 ? 'See your Magnum Opus ▶' : `Next: ${stageName(r.stage + 1)} ▶`,
    );
    const skipBtn = h('button', { class: 'btn ghost small skip', type: 'button', onclick: () => (skip = true) }, 'Skip ▸▸');

    screen.classList.add('assay');
    screen.append(
      spectrumBar(r.brews.flatMap((b) => [b.a.hex, b.b.hex])),
      h('div', { class: 'topbar' }, h('span'), h('span', { class: 'stage-label' }, `Assay · ${stageName(r.stage)}`), skipBtn),
      h(
        'div',
        { class: 'assay-layout' },
        h('div', { class: 'assay-left' }, photoBox, potionEl),
        h('div', { class: 'assay-right' }, rowA.el, rowB.el, receipt, totalEl),
      ),
      h('div', { class: 'bottom-actions' }, nextBtn),
    );
    screen.addEventListener('click', (e) => {
      if (!(e.target as HTMLElement).closest('button')) skip = true;
    });

    const countUp = async (el: HTMLElement, to: number, ms: number, decimals = 0) => {
      if (skip) {
        el.textContent = decimals ? to.toFixed(decimals) : fmt(to);
        return;
      }
      const t0 = performance.now();
      await new Promise<void>((resolve) => {
        const step = (now: number) => {
          const t = Math.min(1, (now - t0) / ms);
          const v = to * (1 - Math.pow(1 - t, 3));
          el.textContent = decimals ? v.toFixed(decimals) : fmt(v);
          if (t < 1 && !skip) requestAnimationFrame(step);
          else {
            el.textContent = decimals ? to.toFixed(decimals) : fmt(to);
            resolve();
          }
        };
        requestAnimationFrame(step);
      });
    };

    const revealColor = async (row: ReturnType<typeof colorRow>, c: ColorResult, loupeEl: HTMLElement) => {
      row.el.hidden = false;
      loupeEl.hidden = !c.match;
      loupeEl.classList.add('pop');
      row.bar.style.width = '0%';
      await pause(150);
      row.bar.style.width = `${Math.max(2, c.acc)}%`;
      await countUp(row.accEl, Math.round(c.acc), 700);
      const label = c.fool ? "Fool's Gold" : c.grade;
      row.stampSlot.replaceChildren(stamp(label, 'slam'));
      if (c.fool) sfx.fool();
      else sfx.stamp();
      if (gradeRank(c.grade) >= 4 && !c.fool) vibrate(30);
      const notes: string[] = [];
      if (c.newPage) notes.push('new Grimoire page!');
      else if (c.personalBest) notes.push('personal best!');
      const hints = c.acc >= 95 ? ['perfect drop'] : c.hints;
      row.hint.textContent = [hints.join(', '), ...notes].filter(Boolean).join(' · ');
      await pause(450);
    };

    const line = (label: string, value: string, cls = '') => h('div', { class: `rline ${cls}` }, h('span', null, label), h('span', { class: 'mono' }, value));

    const run = async () => {
      await pause(500);
      photoBox.classList.add('scanned');
      await revealColor(rowA, rec.a, loupeA);
      await revealColor(rowB, rec.b, loupeB);
      const bd = rec.breakdown;
      receipt.hidden = false;
      const lines: HTMLElement[] = [
        line('match √(A·B)', bd.match.toFixed(1)),
        line('× rarity', `×${bd.rarity.toFixed(3)}`),
        line('× concentration', `×${bd.concentration.toFixed(2)}${rec.f < 0.999 ? ` (${Math.round(rec.f * 100)} % crop)` : ''}`),
        line(`× purity${bd.pure ? ' · pure draw' : ''}`, `×${bd.purity.toFixed(2)}`),
      ];
      if (rec.catalyst) lines.push(line(`× ${rec.catalyst.name}`, `×${bd.catalyst.toFixed(2)}`));
      if (bd.transmute !== 1) lines.push(line('× transmutation tax', `×${bd.transmute.toFixed(2)}`));
      lines.push(line('= base', fmt(bd.base), 'sub'));
      if (r.mode === 'camera') lines.push(line(`+ quicksilver${bd.quicksilver >= 80 ? ' ⚡' : ''}`, `+${bd.quicksilver}`));
      for (const b of bd.bonuses) lines.push(line(`+ ${b.name}`, `+${b.points}`, 'bonus'));
      if (rec.correctedBy === 'albedo' || rec.a.match?.variant === 'corrected' || rec.b.match?.variant === 'corrected') {
        lines.push(h('div', { class: 'rnote' }, rec.correctedBy === 'albedo' ? 'light calibrated with your white tap' : 'light-corrected automatically'));
      }
      for (let i = 0; i < lines.length; i++) {
        receipt.append(lines[i]);
        if (!skip) sfx.clink(i);
        await pause(170);
      }
      totalEl.hidden = false;
      const num = h('span', { class: 'mono big' }, '0');
      totalEl.replaceChildren(h('span', null, 'brew score'), num);
      await countUp(num, bd.total, 600);
      sfx.stamp();
      await pause(250);

      // The potion: the two found colors swirl together.
      const mid = rec.a.match && rec.b.match ? oklabToHex(mixLab(rec.a.match.lab, rec.b.match.lab, 0.5)) : '#55555c';
      const flask = svg(flaskSvg(mid, { level: 0.7 }), 'potion-flask');
      flask.style.setProperty('--ca', rec.a.hex);
      flask.style.setProperty('--cb', rec.b.hex);
      potionEl.replaceChildren();
      append(potionEl, [
        h('div', { class: 'potion-art' }, h('span', { class: 'swirl', style: { background: `conic-gradient(${rec.a.hex}, ${rec.b.hex}, ${rec.a.hex})` } }), flask),
        h('p', { class: 'potion-name' }, rec.potion),
        stamp(rec.grade, 'slam small'),
        rec.newFormula ? h('p', { class: 'muted small' }, 'Famous Formula discovered!') : null,
      ]);
      potionEl.hidden = false;
      if (rec.grade === 'Quintessence') {
        sfx.choir();
        flash(rec.a.hex);
      } else if (rec.newFormula || rec.a.newPage || rec.b.newPage) sfx.fanfare();
      nextBtn.hidden = false;
      skipBtn.hidden = true;
      finished = true;
      nextBtn.focus();
    };
    void run();

    function flash(color: string): void {
      if (reducedMotion()) return;
      const f = h('div', { class: 'qflash', style: { background: color } });
      document.body.append(f);
      setTimeout(() => f.remove(), 900);
    }

    function next(): void {
      sfx.tap();
      goNext();
    }

    return onKeys((e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        if (finished) next();
        else skip = true;
      }
    });
  });
}
