// Juice: one full-screen particle canvas (bursts, confetti, ambient bubbles,
// paint drops), floating score text, screen shake and paint-wipe transitions.
// Everything scales down under prefers-reduced-motion, and the loop sleeps when idle.

import { reducedMotion } from './dom';

type Shape = 'circle' | 'square' | 'drop' | 'star' | 'ribbon';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  size: number;
  color: string;
  shape: Shape;
  rot: number;
  vr: number;
  g: number;
  drag: number;
  fade: boolean;
  ambient?: boolean;
}

const MAX = 450;

class FxEngine {
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private ps: Particle[] = [];
  private raf = 0;
  private last = 0;
  private ambientColors: string[] | null = null;
  private ambientAcc = 0;
  private dpr = 1;

  private ensure(): CanvasRenderingContext2D | null {
    if (this.ctx) return this.ctx;
    const c = document.createElement('canvas');
    c.className = 'fx-canvas';
    c.setAttribute('aria-hidden', 'true');
    document.body.append(c);
    this.canvas = c;
    this.ctx = c.getContext('2d');
    const resize = () => {
      this.dpr = Math.min(window.devicePixelRatio || 1, 2);
      c.width = Math.round(window.innerWidth * this.dpr);
      c.height = Math.round(window.innerHeight * this.dpr);
    };
    resize();
    window.addEventListener('resize', resize);
    return this.ctx;
  }

  private kick(): void {
    if (this.raf) return;
    this.last = performance.now();
    this.raf = requestAnimationFrame((t) => this.frame(t));
  }

  private add(p: Particle): void {
    if (this.ps.length >= MAX) this.ps.splice(0, this.ps.length - MAX + 1);
    this.ps.push(p);
  }

  private scale(n: number): number {
    return reducedMotion() ? Math.ceil(n * 0.2) : n;
  }

  /** A radial burst of particles from a point (client coordinates). */
  burst(x: number, y: number, colors: string[], opts: { count?: number; speed?: number; size?: number; gravity?: number; shapes?: Shape[]; spread?: number; up?: boolean } = {}): void {
    if (!this.ensure() || !colors.length) return;
    const count = this.scale(opts.count ?? 18);
    const speed = opts.speed ?? 260;
    const shapes = opts.shapes ?? ['circle', 'square', 'drop', 'star'];
    for (let i = 0; i < count; i++) {
      const a = opts.up ? -Math.PI / 2 + (Math.random() - 0.5) * (opts.spread ?? Math.PI) : Math.random() * Math.PI * 2;
      const v = speed * (0.35 + Math.random() * 0.75);
      this.add({
        x,
        y,
        vx: Math.cos(a) * v,
        vy: Math.sin(a) * v,
        life: 0,
        max: 0.7 + Math.random() * 0.7,
        size: (opts.size ?? 7) * (0.6 + Math.random() * 0.8),
        color: colors[Math.floor(Math.random() * colors.length)],
        shape: shapes[Math.floor(Math.random() * shapes.length)],
        rot: Math.random() * Math.PI * 2,
        vr: (Math.random() - 0.5) * 12,
        g: opts.gravity ?? 520,
        drag: 1.8,
        fade: true,
      });
    }
    this.kick();
  }

  /** Confetti raining from the top edge. */
  confetti(colors: string[], count = 90): void {
    if (!this.ensure() || !colors.length) return;
    const n = this.scale(count);
    const w = window.innerWidth;
    for (let i = 0; i < n; i++) {
      this.add({
        x: Math.random() * w,
        y: -20 - Math.random() * 200,
        vx: (Math.random() - 0.5) * 80,
        vy: 60 + Math.random() * 160,
        life: 0,
        max: 3 + Math.random() * 1.5,
        size: 6 + Math.random() * 7,
        color: colors[Math.floor(Math.random() * colors.length)],
        shape: Math.random() < 0.6 ? 'ribbon' : Math.random() < 0.5 ? 'square' : 'circle',
        rot: Math.random() * Math.PI * 2,
        vr: (Math.random() - 0.5) * 10,
        g: 160,
        drag: 0.6,
        fade: false,
      });
    }
    this.kick();
  }

  /** Paint drops that splash from a point and fall. */
  splash(x: number, y: number, color: string, count = 14): void {
    this.burst(x, y, [color], { count, speed: 340, size: 8, gravity: 900, shapes: ['drop', 'circle'], up: true, spread: Math.PI * 1.2 });
  }

  /** Slow bubbles drifting up behind menus. null stops them. */
  ambient(colors: string[] | null): void {
    this.ambientColors = reducedMotion() ? null : colors;
    // Let the old ones drift away instead of popping.
    for (const p of this.ps) if (p.ambient) p.max = Math.min(p.max, p.life + 1.2);
    if (colors) {
      this.ensure();
      this.kick();
    }
  }

  private frame(now: number): void {
    const ctx = this.ctx;
    const c = this.canvas;
    if (!ctx || !c) return;
    const dt = Math.min(0.05, (now - this.last) / 1000);
    this.last = now;
    if (this.ambientColors) {
      this.ambientAcc += dt;
      while (this.ambientAcc > 0.22) {
        this.ambientAcc -= 0.22;
        const colors = this.ambientColors;
        this.add({
          x: Math.random() * window.innerWidth,
          y: window.innerHeight + 20,
          vx: (Math.random() - 0.5) * 20,
          vy: -(25 + Math.random() * 45),
          life: 0,
          max: 9 + Math.random() * 6,
          size: 4 + Math.random() * 12,
          color: colors[Math.floor(Math.random() * colors.length)],
          shape: 'circle',
          rot: 0,
          vr: 0,
          g: 0,
          drag: 0,
          fade: true,
          ambient: true,
        });
      }
    }
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, c.width, c.height);
    const h = window.innerHeight;
    this.ps = this.ps.filter((p) => {
      p.life += dt;
      if (p.life > p.max || p.y > h + 60) return false;
      const k = Math.exp(-p.drag * dt);
      p.vx *= k;
      p.vy = p.vy * k + p.g * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.rot += p.vr * dt;
      if (p.ambient) p.x += Math.sin((p.life + p.size) * 1.3) * 0.3;
      const t = p.life / p.max;
      const alpha = p.ambient ? Math.min(1, p.life * 2) * (1 - t) * 0.55 : p.fade ? 1 - t * t : 1;
      ctx.globalAlpha = Math.max(0, alpha);
      ctx.fillStyle = p.color;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      const s = p.size;
      switch (p.shape) {
        case 'square':
          ctx.fillRect(-s / 2, -s / 2, s, s);
          break;
        case 'ribbon':
          ctx.scale(1, Math.abs(Math.cos(p.life * 6 + p.size)));
          ctx.fillRect(-s / 2, -s / 4, s, s / 2);
          break;
        case 'drop':
          ctx.rotate(Math.atan2(p.vy, p.vx) - p.rot - Math.PI / 2);
          ctx.beginPath();
          ctx.arc(0, 0, s / 2, 0, Math.PI);
          ctx.lineTo(0, -s * 1.1);
          ctx.closePath();
          ctx.fill();
          break;
        case 'star':
          ctx.beginPath();
          for (let i = 0; i < 8; i++) {
            const r = i % 2 ? s * 0.22 : s * 0.7;
            const a = (i * Math.PI) / 4;
            ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
          }
          ctx.closePath();
          ctx.fill();
          break;
        default:
          ctx.beginPath();
          ctx.arc(0, 0, s / 2, 0, Math.PI * 2);
          ctx.fill();
      }
      ctx.restore();
      return true;
    });
    ctx.globalAlpha = 1;
    if (this.ps.length || this.ambientColors) this.raf = requestAnimationFrame((t) => this.frame(t));
    else {
      this.raf = 0;
      ctx.clearRect(0, 0, c.width, c.height);
    }
  }
}

export const fx = new FxEngine();

/** Text that pops and floats up ("+342"). */
export function floatText(x: number, y: number, text: string, color = 'currentColor'): void {
  const el = document.createElement('span');
  el.className = 'float-text';
  el.textContent = text;
  el.style.left = `${x}px`;
  el.style.top = `${y}px`;
  el.style.color = color;
  document.body.append(el);
  setTimeout(() => el.remove(), 1300);
}

export function shake(el: HTMLElement, strength: 'soft' | 'hard' = 'soft'): void {
  if (reducedMotion()) return;
  el.classList.remove('shake-soft', 'shake-hard');
  void el.offsetWidth;
  el.classList.add(strength === 'hard' ? 'shake-hard' : 'shake-soft');
  setTimeout(() => el.classList.remove('shake-soft', 'shake-hard'), 450);
}

export function centerOf(el: Element): { x: number; y: number } {
  const r = el.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
}

// --- Paint-wipe transitions ---------------------------------------------------------

let lastPointer = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
window.addEventListener('pointerdown', (e) => (lastPointer = { x: e.clientX, y: e.clientY }), { capture: true });

/**
 * Pour paint over the screen: rings of `colors` grow from the last tap one after
 * another, `swap` runs under the last one, then the rings drain back into the
 * center to reveal the new screen. Slow enough to read as "the page is being
 * remixed", short enough not to block play (~1.2 s total).
 */
export function paintWipe(colors: string[], swap: () => void): void {
  if (reducedMotion() || !colors.length) {
    swap();
    return;
  }
  const { x, y } = lastPointer;
  const r = Math.hypot(Math.max(x, window.innerWidth - x), Math.max(y, window.innerHeight - y)) + 40;
  const layers = colors.slice(0, 3).map((color, i) => {
    const el = document.createElement('div');
    el.className = 'wipe';
    el.style.background = color;
    el.style.zIndex = String(170 + i);
    el.style.clipPath = `circle(0px at ${x}px ${y}px)`;
    document.body.append(el);
    return el;
  });
  const growMs = 460;
  const stagger = 90;
  let swapped = false;
  const doSwap = () => {
    if (swapped) return;
    swapped = true;
    swap();
    const cx = window.innerWidth / 2;
    const cy = window.innerHeight / 2;
    const r2 = Math.hypot(cx, cy) + 40;
    // Drain the top layer first, so the colors peel away in reverse.
    [...layers].reverse().forEach((el, i) => {
      const out = el.animate([{ clipPath: `circle(${r2}px at ${cx}px ${cy}px)` }, { clipPath: `circle(0px at ${cx}px ${cy}px)` }], {
        duration: 520,
        delay: i * 70,
        easing: 'cubic-bezier(.5,0,.2,1)',
        fill: 'forwards',
      });
      out.onfinish = () => el.remove();
      setTimeout(() => el.remove(), 1300);
    });
  };
  layers.forEach((el, i) => {
    const grow = el.animate([{ clipPath: `circle(0px at ${x}px ${y}px)` }, { clipPath: `circle(${r}px at ${x}px ${y}px)` }], {
      duration: growMs,
      delay: i * stagger,
      easing: 'cubic-bezier(.6,0,.3,1)',
      fill: 'forwards',
    });
    if (i === layers.length - 1) grow.onfinish = doSwap;
  });
  // Safety net if animations are throttled (background tab).
  setTimeout(doSwap, growMs + stagger * layers.length + 200);
}
