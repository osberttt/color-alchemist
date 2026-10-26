// Practice Plates: procedurally painted still lifes for players (and judges)
// without a camera. Both targets are always in the scene, under a random light,
// with distractors, shading, highlights and sensor-like noise.

import { COLORS, type ColorDef } from '../data/colors';
import { hexToLinear, linearToHex } from '../color/oklab';
import { pairDelta } from '../meta/deal';
import { plateFromFrames, type Plate } from '../color/plate';
import type { Rng } from '../meta/rng';

interface Light {
  name: string;
  gains: [number, number, number];
}

const LIGHTS: Light[] = [
  { name: 'daylight', gains: [1.0, 1.0, 1.0] },
  { name: 'warm lamp', gains: [1.12, 1.0, 0.8] },
  { name: 'overcast', gains: [0.93, 1.0, 1.1] },
  { name: 'golden hour', gains: [1.08, 1.0, 0.88] },
];

type Shape = 'box' | 'ball' | 'mug' | 'vase' | 'book';

function shade(hexLin: [number, number, number], light: Light, exposure: number, k: number): string {
  return linearToHex(
    hexLin[0] * light.gains[0] * exposure * k,
    hexLin[1] * light.gains[1] * exposure * k,
    hexLin[2] * light.gains[2] * exposure * k,
  );
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  if (typeof ctx.roundRect === 'function') ctx.roundRect(x, y, w, h, r);
  else ctx.rect(x, y, w, h);
}

function drawObject(
  ctx: CanvasRenderingContext2D,
  shape: Shape,
  x: number,
  y: number,
  s: number,
  lin: [number, number, number],
  light: Light,
  exposure: number,
): void {
  const top = shade(lin, light, exposure, 1.04);
  const mid = shade(lin, light, exposure, 0.97);
  const bot = shade(lin, light, exposure, 0.8);
  const grad = ctx.createLinearGradient(x, y - s, x, y + s);
  grad.addColorStop(0, top);
  grad.addColorStop(0.55, mid);
  grad.addColorStop(1, bot);
  ctx.fillStyle = grad;
  ctx.beginPath();
  switch (shape) {
    case 'ball':
      ctx.arc(x, y, s * 0.6, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.beginPath();
      ctx.ellipse(x - s * 0.2, y - s * 0.25, s * 0.09, s * 0.06, -0.6, 0, Math.PI * 2);
      ctx.fill();
      break;
    case 'mug':
      roundRect(ctx, x - s * 0.45, y - s * 0.5, s * 0.9, s, s * 0.08);
      ctx.fill();
      ctx.lineWidth = s * 0.12;
      ctx.strokeStyle = mid;
      ctx.beginPath();
      ctx.arc(x + s * 0.5, y, s * 0.22, -Math.PI / 2, Math.PI / 2);
      ctx.stroke();
      break;
    case 'vase':
      ctx.ellipse(x, y + s * 0.15, s * 0.45, s * 0.55, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillRect(x - s * 0.15, y - s * 0.75, s * 0.3, s * 0.5);
      break;
    case 'book':
      ctx.fillRect(x - s * 0.18, y - s * 0.7, s * 0.36, s * 1.4);
      break;
    default:
      roundRect(ctx, x - s * 0.55, y - s * 0.45, s * 1.1, s * 0.9, s * 0.04);
      ctx.fill();
  }
}

export interface PracticeScene {
  plate: Plate;
  light: string;
}

/** Paint a still life (480×640 units, drawn at `scale`) that contains every target. */
function paintCanvas(rng: Rng, targets: ColorDef[], scale: number): { canvas: HTMLCanvasElement; light: Light } {
  const w = 480;
  const h = 640;
  const canvas = document.createElement('canvas');
  canvas.width = w * scale;
  canvas.height = h * scale;
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  ctx.scale(scale, scale);
  const light = LIGHTS[Math.floor(rng() * LIGHTS.length)];
  const exposure = 0.85 + rng() * 0.25;

  // Wall and table: neutral greys, so the light cast is the only tint.
  const wall = 0.25 + rng() * 0.25;
  const wallGrad = ctx.createLinearGradient(0, 0, 0, h * 0.62);
  wallGrad.addColorStop(0, shade([wall, wall, wall], light, exposure, 1.05));
  wallGrad.addColorStop(1, shade([wall, wall, wall], light, exposure, 0.8));
  ctx.fillStyle = wallGrad;
  ctx.fillRect(0, 0, w, h);
  const table = 0.12 + rng() * 0.12;
  const tableGrad = ctx.createLinearGradient(0, h * 0.62, 0, h);
  tableGrad.addColorStop(0, shade([table, table, table], light, exposure, 1));
  tableGrad.addColorStop(1, shade([table, table, table], light, exposure, 0.7));
  ctx.fillStyle = tableGrad;
  ctx.fillRect(0, h * 0.62, w, h * 0.38);
  // A shelf line.
  ctx.fillStyle = shade([table * 0.8, table * 0.8, table * 0.8], light, exposure, 1);
  ctx.fillRect(0, h * 0.3, w, 10);

  const distractors = COLORS.filter((c) => targets.every((t) => t.id !== c.id && pairDelta(t, c) >= 0.12));
  const items: { c: ColorDef; size: number }[] = targets.map((t) => ({ c: t, size: 80 + rng() * 40 }));
  const nDistract = 6 - targets.length + Math.floor(rng() * 3);
  for (let i = 0; i < nDistract; i++) {
    items.push({ c: distractors[Math.floor(rng() * distractors.length)], size: 55 + rng() * 45 });
  }
  // Shuffle so targets aren't always first.
  for (let i = items.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [items[i], items[j]] = [items[j], items[i]];
  }
  const shapes: Shape[] = ['box', 'ball', 'mug', 'vase', 'book'];
  const shelfSlots = [70, 180, 300, 410];
  const tableSlots = [80, 200, 320, 420];
  items.forEach((it, i) => {
    const onShelf = i < 3;
    const slots = onShelf ? shelfSlots : tableSlots;
    const x = slots[(onShelf ? i : i - 3) % slots.length] + (rng() - 0.5) * 30;
    const y = onShelf ? h * 0.3 - it.size * 0.55 : h * 0.62 + it.size * 0.25 + rng() * 60;
    drawObject(ctx, shapes[Math.floor(rng() * shapes.length)], x, y, it.size, hexToLinear(it.c.target), light, exposure);
  });
  return { canvas, light };
}

/** Seven Colors practice: a big painted scene the player pans and zooms like a camera. */
export function paintPracticeCanvas(rng: Rng, target: ColorDef): { canvas: HTMLCanvasElement; light: string } {
  const { canvas, light } = paintCanvas(rng, [target], 2);
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const n = (rng() + rng() - 1) * 5;
    d[i] += n;
    d[i + 1] += n;
    d[i + 2] += n;
  }
  ctx.putImageData(img, 0, 0);
  return { canvas, light: light.name };
}

/** Paint a 480×640 still life containing both targets. */
export function paintPracticePlate(rng: Rng, targets: [ColorDef, ColorDef]): PracticeScene {
  const w = 480;
  const h = 640;
  const { canvas, light } = paintCanvas(rng, targets, 1);
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  const data = ctx.getImageData(0, 0, w, h).data;
  const plate = plateFromFrames([data], w, h);
  // Gentle sensor noise and vignette, in linear light.
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const dx = x / w - 0.5;
      const dy = y / h - 0.5;
      const v = 1 - 0.25 * (dx * dx + dy * dy);
      const i = (y * w + x) * 3;
      for (let c = 0; c < 3; c++) {
        const n = (rng() + rng() + rng() - 1.5) * 0.006;
        plate.lin[i + c] = Math.min(1, Math.max(0, plate.lin[i + c] * v + n));
      }
    }
  }
  return { plate, light: light.name };
}
