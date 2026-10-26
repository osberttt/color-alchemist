// Wordle-style, spoiler-free share text (GDD §13). Squares show the colors you FOUND.

import { deltaEOK, hexToOklab } from '../color/oklab';
import type { BrewRecord, RunResult } from '../game';
import { fmt } from '../ui/dom';

const EMOJI: [string, string][] = [
  ['🟥', '#dd2e44'],
  ['🟧', '#f4900c'],
  ['🟨', '#fdcb58'],
  ['🟩', '#78b159'],
  ['🟦', '#55acee'],
  ['🟪', '#aa8ed6'],
  ['🟫', '#c1694f'],
  ['⬛', '#31373d'],
  ['⬜', '#e6e7e8'],
];
const EMOJI_LAB = EMOJI.map(([e, hex]) => [e, hexToOklab(hex)] as const);

export function emojiFor(hex: string): string {
  const lab = hexToOklab(hex);
  let best = EMOJI_LAB[0];
  let bestD = Infinity;
  for (const e of EMOJI_LAB) {
    const d = deltaEOK(lab, e[1]);
    if (d < bestD) {
      bestD = d;
      best = e;
    }
  }
  return best[0];
}

export function shareText(mode: 'camera' | 'practice', brews: BrewRecord[], res: RunResult): string {
  const lines = [
    `Color Alchemist · ${mode === 'camera' ? 'Real-world hunt' : 'Practice plates'}`,
    `is your life full of colors?  ${res.band.name}  ${fmt(res.total)}`,
    ...brews.map((b) => `${emojiFor(b.a.hex)}${emojiFor(b.b.hex)} ${b.a.fool ? "Fool's Gold" : b.a.grade} · ${b.b.fool ? "Fool's Gold" : b.b.grade}`),
  ];
  if (/^https?:/.test(location.href)) lines.push(location.origin + location.pathname);
  return lines.join('\n');
}

export async function share(text: string): Promise<'shared' | 'copied' | 'failed'> {
  try {
    if (navigator.share && matchMedia('(pointer: coarse)').matches) {
      await navigator.share({ text });
      return 'shared';
    }
  } catch (e) {
    if ((e as { name?: string })?.name === 'AbortError') return 'failed';
  }
  try {
    await navigator.clipboard.writeText(text);
    return 'copied';
  } catch {
    return 'failed';
  }
}
