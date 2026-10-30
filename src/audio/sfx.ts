// Synthesized SFX with WebAudio: glass, liquid, cork, paper. No audio files,
// so there is nothing to license and nothing to download.

import { getSettings } from '../meta/storage';

let ctx: AudioContext | null = null;
let master: GainNode | null = null;

function ac(): AudioContext | null {
  if (getSettings().muted) return null;
  if (!ctx) {
    try {
      const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.5;
      master.connect(ctx.destination);
    } catch {
      return null;
    }
  }
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

/** Call from the first user gesture (iOS needs it). */
export function unlockAudio(): void {
  ac();
}

function tone(freq: number, dur: number, opts: { type?: OscillatorType; gain?: number; at?: number; slide?: number; attack?: number } = {}): void {
  const c = ac();
  if (!c || !master) return;
  const t0 = c.currentTime + (opts.at ?? 0);
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = opts.type ?? 'sine';
  o.frequency.setValueAtTime(freq, t0);
  if (opts.slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq * opts.slide), t0 + dur);
  const peak = opts.gain ?? 0.3;
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(peak, t0 + (opts.attack ?? 0.005));
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g).connect(master);
  o.start(t0);
  o.stop(t0 + dur + 0.02);
}

function noise(dur: number, opts: { gain?: number; at?: number; freq?: number; q?: number; filter?: BiquadFilterType; swell?: boolean } = {}): void {
  const c = ac();
  if (!c || !master) return;
  const t0 = c.currentTime + (opts.at ?? 0);
  const len = Math.max(1, Math.floor(c.sampleRate * dur));
  const buf = c.createBuffer(1, len, c.sampleRate);
  const d = buf.getChannelData(0);
  // Default: a hit that decays. `swell`: rises and falls smoothly (no click at the start).
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (opts.swell ? Math.sin((Math.PI * i) / len) ** 2 : 1 - i / len);
  const src = c.createBufferSource();
  src.buffer = buf;
  const f = c.createBiquadFilter();
  f.type = opts.filter ?? 'bandpass';
  f.frequency.value = opts.freq ?? 2000;
  f.Q.value = opts.q ?? 1;
  const g = c.createGain();
  g.gain.value = opts.gain ?? 0.3;
  src.connect(f).connect(g).connect(master);
  src.start(t0);
}

export const sfx = {
  tap() {
    tone(880, 0.06, { type: 'triangle', gain: 0.12 });
  },
  shutter() {
    noise(0.05, { freq: 3500, q: 0.7, gain: 0.5 });
    tone(140, 0.12, { type: 'sine', gain: 0.5, slide: 0.5 });
    tone(620, 0.08, { type: 'triangle', gain: 0.18, at: 0.03 });
  },
  tick(urgent = false) {
    tone(urgent ? 1320 : 990, 0.05, { type: 'sine', gain: urgent ? 0.18 : 0.08 });
  },
  drip() {
    tone(1400, 0.12, { type: 'sine', gain: 0.2, slide: 0.45 });
  },
  bubble(level: number) {
    tone(300 + level * 120, 0.09, { type: 'sine', gain: 0.12, slide: 1.6 });
  },
  clink(step = 0) {
    const f = 1800 + step * 220;
    tone(f, 0.35, { type: 'sine', gain: 0.18 });
    tone(f * 2.76, 0.2, { type: 'sine', gain: 0.06 });
  },
  stamp() {
    noise(0.12, { freq: 300, q: 0.8, gain: 0.7 });
    tone(90, 0.18, { type: 'sine', gain: 0.6, slide: 0.6 });
  },
  pour() {
    noise(0.6, { freq: 900, q: 3, gain: 0.15 });
  },
  fanfare() {
    [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.5, { type: 'triangle', gain: 0.16, at: i * 0.09 }));
  },
  choir() {
    [440, 554, 659, 880].forEach((f) => tone(f, 1.4, { type: 'sine', gain: 0.07, attack: 0.25 }));
  },
  fool() {
    tone(1200, 0.08, { type: 'square', gain: 0.06 });
    tone(1500, 0.08, { type: 'square', gain: 0.06, at: 0.08 });
    tone(110, 0.25, { type: 'sine', gain: 0.4, at: 0.18, slide: 0.7 });
  },
  error() {
    tone(220, 0.18, { type: 'triangle', gain: 0.2, slide: 0.7 });
  },
  /** Transitions: a soft, low swell of air with a warm tone under it, gently settling. */
  whoosh() {
    noise(0.6, { filter: 'lowpass', freq: 420, q: 0.4, gain: 0.16, swell: true });
    tone(147, 0.7, { type: 'sine', gain: 0.07, attack: 0.22, slide: 0.88 });
    tone(220, 0.6, { type: 'sine', gain: 0.025, attack: 0.25, at: 0.05, slide: 0.88 });
  },
  pop(step = 0) {
    tone(520 + step * 90, 0.08, { type: 'sine', gain: 0.18, slide: 1.8 });
  },
  sparkle() {
    [2093, 2637, 3136].forEach((f, i) => tone(f, 0.18, { type: 'sine', gain: 0.05, at: i * 0.05 }));
  },
};

export function vibrate(ms: number | number[]): void {
  try {
    navigator.vibrate?.(ms);
  } catch {
    // Not supported (iOS): the design never relies on haptics.
  }
}
