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

// Tame by design (ANALYSIS §4.32): sine waves only, fundamentals at or below ~600 Hz, no
// overtones above ~1 kHz, soft attacks, noise always low-passed. But not below ~150 Hz
// alone: phone speakers barely play it. Compare the options in docs/previews/sfx-options.html.
// Transitions (page wipes, the result sheet, reactions) are silent by the user's choice.
export const sfx = {
  tap() {
    tone(330, 0.06, { gain: 0.07, attack: 0.008 });
  },
  shutter() {
    noise(0.06, { filter: 'lowpass', freq: 700, q: 0.5, gain: 0.25 });
    tone(150, 0.1, { gain: 0.3, slide: 0.7, attack: 0.004 });
  },
  tick(urgent = false) {
    tone(urgent ? 466 : 392, 0.06, { gain: urgent ? 0.09 : 0.05, attack: 0.004 });
  },
  drip() {
    tone(560, 0.11, { gain: 0.12, slide: 0.55, attack: 0.006 });
  },
  bubble(level: number) {
    tone(220 + level * 40, 0.09, { gain: 0.08, slide: 1.3, attack: 0.006 });
  },
  /**
   * Each color's intro: "3 · Soft glass" (the user's pick), a rounded glass note one step higher per
   * color (880–1240 Hz, no overtone). The one deliberate exception to the ≤ 600 Hz rule.
   */
  clink(step = 0) {
    tone(880 + step * 60, 0.4, { gain: 0.07, attack: 0.008 });
  },
  stamp() {
    noise(0.1, { filter: 'lowpass', freq: 350, q: 0.6, gain: 0.45 });
    tone(90, 0.16, { gain: 0.4, slide: 0.7, attack: 0.004 });
  },
  pour() {
    noise(0.6, { filter: 'lowpass', freq: 500, q: 0.7, gain: 0.12, swell: true });
  },
  fanfare() {
    [262, 330, 392, 523].forEach((f, i) => tone(f, 0.5, { gain: 0.09, attack: 0.02, at: i * 0.1 }));
  },
  choir() {
    [220, 277, 330, 440].forEach((f) => tone(f, 1.4, { gain: 0.05, attack: 0.3 }));
  },
  fool() {
    tone(220, 0.1, { gain: 0.08, attack: 0.008 });
    tone(165, 0.22, { gain: 0.1, at: 0.12, slide: 0.8, attack: 0.008 });
  },
  error() {
    tone(196, 0.18, { gain: 0.14, slide: 0.75, attack: 0.01 });
  },
  pop(step = 0) {
    tone(300 + step * 35, 0.08, { gain: 0.11, slide: 1.2, attack: 0.005 });
  },
  sparkle() {
    [392, 494, 587].forEach((f, i) => tone(f, 0.22, { gain: 0.045, attack: 0.01, at: i * 0.07 }));
  },
};

export function vibrate(ms: number | number[]): void {
  try {
    navigator.vibrate?.(ms);
  } catch {
    // Not supported (iOS): the design never relies on haptics.
  }
}
