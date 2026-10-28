// The potion: what the alchemist brews over a run, Gunk → Elixir of Life. Each rank is a
// different vessel, and the higher the rank, the more colors it holds and the brighter
// they are:
//   Gunk            a cracked clay crock, sludge oozing over the rim; a fly circles
//   Stimulant       a corked round-bottom flask, fizzing; it twitches now and then
//   Antidote        an apothecary bottle: two settled layers, a leaf label, a sprig
//   Panacea         a faceted teardrop bottle, gold collar and stopper; glowing currents
//   Elixir of Life  a heart flask holding every color, a glowing orb stopper; rays and motes
// Drawn in the palette of the page it appears on (random where there is none, like the
// tuner), with fresh bubbles and color order every time. Motion: potion-anim.css.

import { hexToOklab, mixLab, oklabToHex } from '../color/oklab';
import { SEVEN } from '../data/tuning';
import { PALETTES, luminance, type Palette } from './palettes';

export const POTION_BLURBS = ['a starter batch', 'a little pick-me-up', 'cures what ails you', 'a cure for every ill', 'the Great Work: life eternal'];

export function potionName(index: number): string {
  return SEVEN.craftTiers[Math.max(0, Math.min(SEVEN.craftTiers.length - 1, index))].name;
}

type Rng = () => number;

const GOLD = '#f6c945';
const GOLD_D = '#a87a14';
const GOLD_L = '#fff1b0';

const f = (n: number) => n.toFixed(1);

function shuffle<T>(rng: Rng, arr: readonly T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function mix(a: string, b: string, t: number): string {
  return oklabToHex(mixLab(hexToOklab(a), hexToOklab(b), t));
}

function star(n: number, r1: number, r2: number): string {
  return (
    Array.from({ length: n * 2 }, (_, i) => {
      const a = (i / (n * 2)) * Math.PI * 2 - Math.PI / 2;
      const r = i % 2 ? r2 : r1;
      return `${i ? 'L' : 'M'}${f(Math.cos(a) * r)},${f(Math.sin(a) * r)}`;
    }).join(' ') + 'Z'
  );
}

// The color ladder. Gunk is muddy; from Stimulant up each rank uses more of the
// palette's colors, a little brighter (Elixir: the five accents plus blends of neighbors).
const LADDER = [
  { count: 3, mud: true, dL: 0, dC: 1 },
  { count: 2, mud: false, dL: 0, dC: 0.95 },
  { count: 3, mud: false, dL: 0.02, dC: 1 },
  { count: 5, mud: false, dL: 0.05, dC: 1.1 },
  { count: 8, mud: false, dL: 0.07, dC: 1.2 },
];

/** `count` colors from the palette's accents; past five, blends of neighbors slot in between. */
function spread(c: string[], count: number): string[] {
  if (count <= c.length) return c.slice(0, count);
  const out: string[] = [];
  let extra = count - c.length;
  c.forEach((hex, i) => {
    out.push(hex);
    if (extra > 0 && i < c.length - 1) {
      out.push(mix(hex, c[i + 1], 0.5));
      extra--;
    }
  });
  return out;
}

function tones(c: string[], tier: number): string[] {
  const t = LADDER[tier];
  if (t.mud) return c.slice(0, t.count).map((hex) => mix(hex, '#4b4038', 0.55));
  return spread(c, t.count).map((hex) => {
    const lab = hexToOklab(hex);
    return oklabToHex({ L: Math.min(0.93, Math.max(0.2, lab.L + t.dL)), a: lab.a * t.dC, b: lab.b * t.dC });
  });
}

export function randomPalette(): Palette {
  return PALETTES[Math.floor(Math.random() * PALETTES.length)];
}

/** SVG markup for a potion of rank `tier` (0 = Gunk … 4 = Elixir of Life), in `palette`. */
export function potionSvg(tier: number, palette: Palette = randomPalette(), rng: Rng = Math.random): string {
  tier = Math.max(0, Math.min(LADDER.length - 1, tier));
  // Unique ids: several potions can share a page.
  const id = `p${Math.floor(rng() * 1e9).toString(36)}`;
  // On light pages white glass edges vanish, so they take the page's text color.
  const light = luminance(palette.bg) > 0.5;
  const edge = light ? palette.fg : '#ffffff';
  const col = tones(shuffle(rng, palette.accents), tier);
  let defs = '';

  const grad = (name: string, stops: string[], x2 = 0, y2 = 1) => {
    defs += `<linearGradient id="${id}-${name}" x1="0" y1="0" x2="${x2}" y2="${y2}">${stops.map((c, i) => `<stop offset="${(i / Math.max(1, stops.length - 1)).toFixed(3)}" stop-color="${c}"/>`).join('')}</linearGradient>`;
    return `url(#${id}-${name})`;
  };
  const radial = (name: string, c: string, o: number) => {
    defs += `<radialGradient id="${id}-${name}"><stop offset="0" stop-color="${c}" stop-opacity="${o}"/><stop offset="1" stop-color="${c}" stop-opacity="0"/></radialGradient>`;
    return `url(#${id}-${name})`;
  };
  // A liquid surface that rolls sideways forever: a wave with a 30-unit period, shifted by one
  // period (potion-anim.css). It spans −90…60, so even mid-roll it stays inside the drawing
  // while always covering the widest bottle (±58).
  const wave = (y: number, amp: number) => {
    let d = `M-90,${y} Q-82.5,${y - amp} -75,${y}`;
    for (let x = -60; x <= 60; x += 15) d += ` T${x},${y}`;
    return `${d} V95 H-90 Z`;
  };
  const bubbles = (n: number, x0: number, x1: number, yStart: number, yTop: number, size: number, fill: string, dur: number) =>
    Array.from({ length: n }, () => {
      const x = x0 + rng() * (x1 - x0);
      const y = yStart - rng() * 10;
      const d = dur * (0.7 + rng() * 0.6);
      return `<circle class="bubble" cx="${f(x)}" cy="${f(y)}" r="${f(size * (0.5 + rng()))}" fill="${fill}" style="--rise:${f(yTop - y)}px;animation-duration:${f(d)}s;animation-delay:${f(-rng() * d)}s"/>`;
    }).join('');
  const liquid = (shape: string, layers: string) => {
    defs += `<clipPath id="${id}-clip"><path d="${shape}"/></clipPath>`;
    return `<g clip-path="url(#${id}-clip)">${layers}</g>`;
  };
  // Soft glowing currents of color circling inside the liquid (blurred blobs, not strokes).
  const currents = (cols: string[], cx: number, cy: number, r: number) =>
    cols
      .map((c, i) => {
        const a = (i / cols.length) * Math.PI * 2;
        const dur = 6 + i * 2.5;
        return `<g class="swirl${i % 2 ? ' rev' : ''}" style="transform-origin:${cx}px ${cy}px;animation-duration:${dur}s"><ellipse cx="${f(cx + Math.cos(a) * r)}" cy="${f(cy + Math.sin(a) * r * 0.7)}" rx="${f(r * 0.95)}" ry="${f(r * 0.6)}" fill="${radial(`cur${i}`, c, 0.85)}"/></g>`;
      })
      .join('');
  const glassBack = (d: string) => `<path d="${d}" fill="${light ? 'rgba(255,255,255,.4)' : 'rgba(255,255,255,.08)'}"/>`;
  const glassFront = (d: string, stroke = edge) => `<path d="${d}" fill="none" stroke="${stroke}" stroke-opacity="${light ? 0.6 : 0.8}" stroke-width="3.5" stroke-linejoin="round"/>`;
  const shine = (d: string, w = 4, o = 0.5) => `<path d="${d}" fill="none" stroke="#fff" stroke-opacity="${o}" stroke-width="${w}" stroke-linecap="round"/>`;
  const sparkles = (n: number, fills: string[]) =>
    Array.from({ length: n }, (_, i) => {
      const a = rng() * Math.PI * 2;
      const r = 62 + rng() * 34;
      const s = 3 + rng() * 5;
      return `<path class="twinkle" style="animation-delay:${f(-rng() * 3)}s" d="${star(4, s, s * 0.3)}" fill="${fills[i % fills.length]}" transform="translate(${f(Math.cos(a) * r)},${f(Math.sin(a) * r)})"/>`;
    }).join('');
  const shadow = '<ellipse cx="0" cy="86" rx="44" ry="6" fill="rgba(0,0,0,.2)"/>';
  let body = '';

  switch (tier) {
    case 0: {
      // Gunk: a crude clay crock, sludge bubbling over the rim and dripping down; a fly circles.
      const clay = mix(col[2], '#6a5038', 0.6);
      const dark = mix(clay, '#000000', 0.5);
      const sludge = col[0];
      const jar = 'M-34,-14 C-58,-4 -60,56 -40,72 C-28,82 28,82 40,72 C60,56 58,-4 34,-14 Z';
      body =
        shadow +
        `<path d="${jar}" fill="${grad('clay', [mix(clay, '#ffffff', 0.15), clay, mix(clay, '#000000', 0.35)], 1, 0.6)}" stroke="${dark}" stroke-width="2.5"/>` +
        `<path d="M-20,8 L-12,20 L-18,30 L-9,44" fill="none" stroke="${dark}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>` +
        shine('M-40,6 C-44,24 -42,44 -33,58', 4, 0.18) +
        `<rect x="-30" y="-24" width="60" height="12" rx="3" fill="${mix(clay, '#000000', 0.15)}" stroke="${dark}" stroke-width="2.5"/>` +
        `<rect x="-34" y="-31" width="68" height="9" rx="4" fill="${clay}" stroke="${dark}" stroke-width="2.5"/>` +
        `<g class="ooze"><path d="M-30,-29 C-36,-46 -14,-54 -2,-46 C8,-58 34,-52 30,-29 Z" fill="${sludge}"/>` +
        `<circle class="pop" cx="-10" cy="-42" r="4" fill="${col[1]}" style="animation-delay:-.4s"/>` +
        `<circle class="pop" cx="11" cy="-45" r="3" fill="${col[1]}" style="animation-delay:-1.2s"/>` +
        `<circle cx="-15" cy="-40" r="2" fill="#fff" opacity=".25"/></g>` +
        `<path d="M22,-30 C27,-20 29,-8 27,2 Q25,8 21,2 C21,-8 19,-18 16,-29Z" fill="${sludge}"/>` +
        `<ellipse class="drip" cx="24" cy="4" rx="3" ry="4.5" fill="${sludge}"/>` +
        `<g class="fly"><g transform="translate(26,-66)"><ellipse rx="3" ry="2.2" fill="#2b2b2b"/><ellipse class="wing" cx="-1" cy="-2.6" rx="2.6" ry="1.7" fill="#fff" opacity=".8"/></g></g>`;
      break;
    }
    case 1: {
      // Stimulant: a round-bottomed flask, fizzing; it twitches now and then. Corked.
      const flask = 'M-10,-58 L-10,-24 A48,48 0 1 0 10,-24 L10,-58 Z';
      body =
        shadow +
        `<g class="jitter">${glassBack(flask)}` +
        liquid(flask, `<path class="wave back" d="${wave(6, 3)}" fill="${col[1]}" opacity=".6"/><path class="wave" d="${wave(10, 4)}" fill="${grad('liq', [col[0], mix(col[0], col[1], 0.5)])}"/>` + bubbles(16, -36, 36, 66, 8, 2.2, 'rgba(255,255,255,.8)', 1.4)) +
        glassFront(flask) +
        shine('M-31,6 A36,36 0 0 0 -22,52', 4, 0.5) +
        `<rect x="-14" y="-62" width="28" height="6" rx="3" fill="none" stroke="${edge}" stroke-opacity=".7" stroke-width="3"/>` +
        `<rect x="-12" y="-78" width="24" height="18" rx="4" fill="#b98a5a" stroke="#7a5532" stroke-width="2"/>` +
        `<path d="M-6,-74 V-64 M0,-75 V-63 M6,-74 V-64" stroke="#7a5532" stroke-width="1.2" opacity=".6"/></g>` +
        `<path class="zap" d="M-28,-58 l-6,-6 l5,-2 l-6,-7" fill="none" stroke="${col[0]}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>` +
        `<path class="zap" style="animation-delay:-.6s" d="M28,-54 l6,-6 l-5,-2 l6,-7" fill="none" stroke="${col[0]}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>`;
      break;
    }
    case 2: {
      // Antidote: an apothecary bottle with two settled layers, a label with a herb leaf, a
      // sprig tied at the neck and a glass stopper. It sways gently.
      const bottle = 'M-12,-62 L-12,-50 C-12,-42 -40,-42 -40,-28 L-40,68 Q-40,78 -30,78 L30,78 Q40,78 40,68 L40,-28 C40,-42 12,-42 12,-50 L12,-62 Z';
      const stopper = mix(col[1], '#ffffff', 0.55);
      const leaf = mix(col[2], '#000000', 0.15);
      body =
        shadow +
        `<g class="sway">${glassBack(bottle)}` +
        liquid(bottle, `<path class="wave back" d="${wave(-18, 3)}" fill="${col[0]}"/><path class="wave" d="${wave(22, 5)}" fill="${grad('liq', [col[1], mix(col[1], '#000000', 0.25)])}"/>` + bubbles(7, -32, 32, 74, -16, 2.5, 'rgba(255,255,255,.6)', 3)) +
        glassFront(bottle) +
        shine('M-32,-22 V56', 4, 0.45) +
        `<rect x="-28" y="30" width="56" height="36" rx="3" fill="#f3e6c8" stroke="#b39b6b" stroke-width="2"/>` +
        `<g transform="translate(0,48) rotate(-35)"><path d="M0,-13 C9,-7 9,7 0,13 C-9,7 -9,-7 0,-13 Z" fill="${leaf}"/><path d="M0,-11 V15" stroke="#f3e6c8" stroke-width="1.6" stroke-linecap="round"/><path d="M0,-2 L4,-6 M0,4 L-4,0" stroke="#f3e6c8" stroke-width="1.2" stroke-linecap="round"/></g>` +
        `<rect x="-9" y="-69" width="18" height="9" rx="2" fill="${stopper}" stroke="${edge}" stroke-opacity=".6" stroke-width="2"/>` +
        `<circle cx="0" cy="-79" r="11" fill="${stopper}" stroke="${edge}" stroke-opacity=".6" stroke-width="2.5"/>` +
        shine('M-6,-84 A7,7 0 0 1 2,-87', 2.5, 0.75) +
        `<path d="M-13,-52 Q0,-46 13,-52" stroke="#b39b6b" stroke-width="2.5" fill="none"/>` +
        `<g transform="translate(13,-51) rotate(18)"><path d="M0,0 C6,-6 14,-6 18,-2" stroke="${mix(col[2], '#000000', 0.35)}" stroke-width="2" fill="none"/><ellipse cx="8" cy="-6" rx="6" ry="3" fill="${col[2]}" transform="rotate(-25 8 -6)"/><ellipse cx="16" cy="-1" rx="5" ry="2.6" fill="${col[2]}" transform="rotate(20 16 -1)"/></g>` +
        `</g>`;
      break;
    }
    case 3: {
      // Panacea: a faceted teardrop bottle with a gold collar and a rounded gold stopper;
      // glowing currents of color inside; it floats, sparkling.
      const drop = 'M-9,-64 L-9,-54 C-30,-34 -54,-4 -54,26 C-54,60 -28,80 0,80 C28,80 54,60 54,26 C54,-4 30,-34 9,-54 L9,-64 Z';
      body =
        `<circle r="94" fill="${radial('halo', col[1], 0.5)}"/>` +
        shadow +
        `<g class="bob">${glassBack(drop)}` +
        liquid(
          drop,
          `<path class="wave back" d="${wave(-16, 3)}" fill="${col[2]}" opacity=".7"/><path class="wave" d="${wave(-12, 4)}" fill="${grad('liq', [col[0], col[1], col[2]])}"/>` +
            currents([col[3], col[4]], 0, 34, 24) +
            `<circle class="glow" cx="0" cy="34" r="40" fill="${radial('core', '#ffffff', 0.55)}"/>` +
            bubbles(8, -40, 40, 76, -12, 2, 'rgba(255,255,255,.85)', 2.6),
        ) +
        `<path d="M-9,-54 L-34,26 L0,80 L34,26 L9,-54 M-54,26 H54" fill="none" stroke="#fff" stroke-opacity=".22" stroke-width="1.5"/>` +
        glassFront(drop) +
        shine('M-38,0 C-46,20 -44,44 -34,58', 4, 0.5) +
        `<path d="M-11,-66 C-11,-84 11,-84 11,-66 Z" fill="${grad('gold', [GOLD_L, GOLD, GOLD_D])}" stroke="${GOLD_D}" stroke-width="1.5"/>` +
        `<circle cx="0" cy="-84" r="3.5" fill="${GOLD}" stroke="${GOLD_D}" stroke-width="1.2"/>` +
        `<rect x="-14" y="-68" width="28" height="9" rx="3" fill="${GOLD}" stroke="${GOLD_D}" stroke-width="1.5"/>` +
        shine('M-6,-74 C-5,-78 -2,-80 1,-80', 2, 0.6) +
        `</g>` +
        sparkles(6, ['#ffffff', ...col]);
      break;
    }
    default: {
      // Elixir of Life: a heart-shaped flask holding every color of the palette, swirling and
      // glowing, motes of light rising; a glowing glass orb for a stopper; rays behind.
      const heart = 'M-8,-62 L-8,-36 C-20,-52 -52,-48 -55,-14 C-58,20 -26,50 0,78 C26,50 58,20 55,-14 C52,-48 20,-52 8,-36 L8,-62 Z';
      const gold = grad('gold', [GOLD_L, GOLD, GOLD_D], 1, 1);
      const rays = Array.from({ length: 12 }, (_, i) => `<path d="M-6,0 L0,-98 L6,0Z" fill="${GOLD_L}" opacity=".3" transform="rotate(${i * 30})"/>`).join('');
      body =
        `<g class="rays">${rays}</g>` +
        `<circle r="96" fill="${radial('halo', col[0], 0.7)}"/>` +
        shadow +
        `<g class="bob">` +
        glassBack(heart) +
        liquid(
          heart,
          `<path class="wave back" d="${wave(-34, 3)}" fill="${col[6]}" opacity=".7"/><path class="wave" d="${wave(-30, 4)}" fill="${grad('liq', col)}"/>` +
            currents([col[2], col[5], col[7]], 0, 10, 26) +
            `<circle class="glow" cx="0" cy="12" r="46" fill="${radial('core', '#ffffff', 0.75)}"/>` +
            bubbles(10, -40, 40, 70, -30, 1.8, GOLD_L, 2.8),
        ) +
        glassFront(heart, GOLD) +
        shine('M-44,-20 C-48,0 -40,20 -28,34', 4, 0.55) +
        `<rect x="-12" y="-70" width="24" height="9" rx="3" fill="${gold}" stroke="${GOLD_D}" stroke-width="1.5"/>` +
        `<circle class="glow" cx="0" cy="-82" r="16" fill="${radial('orb-glow', col[0], 0.6)}"/>` +
        `<circle cx="0" cy="-82" r="10" fill="${radial('orb', '#ffffff', 0.95)}" stroke="${GOLD}" stroke-width="2.5"/>` +
        `<circle cx="0" cy="-82" r="6" fill="${col[0]}" opacity=".55"/>` +
        shine('M-5,-86 A6,6 0 0 1 1,-89', 2, 0.85) +
        `</g>` +
        sparkles(12, ['#ffffff', ...col]);
    }
  }
  return `<svg viewBox="-100 -100 200 200" aria-hidden="true" class="potion"><defs>${defs}</defs>${body}</svg>`;
}
