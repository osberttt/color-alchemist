// Frame sources for the viewfinder: the live camera, a painted practice scene,
// or (dev builds only) a test photo. All are drawable into a 2D canvas and
// uploadable as a WebGL texture.

import { camera } from './camera';
import { plateFromFrames, type Plate } from '../color/plate';
import { SRGB_TO_LINEAR } from '../color/oklab';

export interface FrameSource {
  el: HTMLVideoElement | HTMLCanvasElement;
  /** True when frames change over time (video). */
  live: boolean;
  mirrored: boolean;
  /** Image sources can be panned; the camera is aimed by moving the phone. */
  pannable: boolean;
  width(): number;
  height(): number;
  ready(): boolean;
  nextFrame(): Promise<void>;
}

/** A rectangle in source-normalized coordinates (0..1), may extend outside. */
export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export function cameraSource(): FrameSource {
  const v = camera.video as HTMLVideoElement & { requestVideoFrameCallback?: (cb: () => void) => number };
  return {
    el: v,
    live: true,
    get mirrored() {
      return camera.mirrored;
    },
    pannable: false,
    width: () => v.videoWidth,
    height: () => v.videoHeight,
    ready: () => camera.ready,
    nextFrame: () =>
      new Promise((resolve) => {
        let done = false;
        const fin = () => {
          if (!done) {
            done = true;
            resolve();
          }
        };
        v.requestVideoFrameCallback?.(fin);
        setTimeout(fin, 45);
      }),
  };
}

export function canvasSource(c: HTMLCanvasElement): FrameSource {
  return {
    el: c,
    live: false,
    mirrored: false,
    pannable: true,
    width: () => c.width,
    height: () => c.height,
    ready: () => c.width > 0,
    nextFrame: () => Promise.resolve(),
  };
}

export async function imageToCanvas(url: string, maxSide = 1600): Promise<HTMLCanvasElement> {
  const img = new Image();
  img.decoding = 'async';
  img.src = url;
  await img.decode();
  const s = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
  const c = document.createElement('canvas');
  c.width = Math.round(img.naturalWidth * s);
  c.height = Math.round(img.naturalHeight * s);
  c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
  return c;
}

const scratch = document.createElement('canvas');
let scratchCtx: CanvasRenderingContext2D | null = null;

/** Draw a display-space rect of the source into an outW×outH RGBA buffer. Outside the source is black. */
export function grab(src: FrameSource, rect: Rect, outW: number, outH: number): Uint8ClampedArray | null {
  const sw = src.width();
  const sh = src.height();
  if (!sw || !sh) return null;
  if (scratch.width !== outW || scratch.height !== outH || !scratchCtx) {
    scratch.width = outW;
    scratch.height = outH;
    scratchCtx = scratch.getContext('2d', { willReadFrequently: true });
  }
  const ctx = scratchCtx;
  if (!ctx) return null;
  // Display space is mirrored for a front camera: flip the rect into source space.
  const r = src.mirrored ? { ...rect, x: 1 - rect.x - rect.w } : rect;
  ctx.save();
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, outW, outH);
  if (src.mirrored) {
    ctx.translate(outW, 0);
    ctx.scale(-1, 1);
  }
  const ix0 = Math.max(0, r.x);
  const iy0 = Math.max(0, r.y);
  const ix1 = Math.min(1, r.x + r.w);
  const iy1 = Math.min(1, r.y + r.h);
  if (ix1 > ix0 && iy1 > iy0) {
    ctx.drawImage(
      src.el,
      ix0 * sw,
      iy0 * sh,
      (ix1 - ix0) * sw,
      (iy1 - iy0) * sh,
      ((ix0 - r.x) / r.w) * outW,
      ((iy0 - r.y) / r.h) * outH,
      ((ix1 - ix0) / r.w) * outW,
      ((iy1 - iy0) / r.h) * outH,
    );
  }
  ctx.restore();
  return ctx.getImageData(0, 0, outW, outH).data;
}

/** Capture the visible view as a plate, averaging frames for live sources. */
export async function captureView(src: FrameSource, view: Rect, shortSide: number, frames: number): Promise<Plate | null> {
  const aspect = (view.w * src.width()) / (view.h * src.height());
  const w = aspect >= 1 ? Math.round(shortSide * aspect) : shortSide;
  const h = aspect >= 1 ? shortSide : Math.round(shortSide / aspect);
  const n = src.live ? frames : 1;
  const buffers: Uint8ClampedArray[] = [];
  for (let i = 0; i < n; i++) {
    if (i > 0) await src.nextFrame();
    const d = grab(src, view, w, h);
    if (!d) break;
    buffers.push(new Uint8ClampedArray(d));
  }
  return buffers.length ? plateFromFrames(buffers, w, h) : null;
}

/** Mean linear color of a rect (used for the live "in the square" swatch). */
export function meanOfRect(src: FrameSource, rect: Rect, size = 24): [number, number, number] | null {
  const d = grab(src, rect, size, size);
  if (!d) return null;
  let r = 0;
  let g = 0;
  let b = 0;
  for (let i = 0; i < d.length; i += 4) {
    r += SRGB_TO_LINEAR[d[i]];
    g += SRGB_TO_LINEAR[d[i + 1]];
    b += SRGB_TO_LINEAR[d[i + 2]];
  }
  const n = d.length / 4;
  return [r / n, g / n, b / n];
}

/** The view rect for a zoom level and a view center (source-normalized). */
export function viewRect(zoom: number, cx: number, cy: number): Rect {
  const w = 1 / zoom;
  const h = 1 / zoom;
  return { x: cx - w / 2, y: cy - h / 2, w, h };
}

/** The center square of a view, as a rect in source-normalized coordinates. */
export function squareRect(src: FrameSource, view: Rect, fraction: number): Rect {
  const vw = view.w * src.width();
  const vh = view.h * src.height();
  const sidePx = Math.min(vw, vh) * fraction;
  const w = sidePx / src.width();
  const h = sidePx / src.height();
  return { x: view.x + view.w / 2 - w / 2, y: view.y + view.h / 2 - h / 2, w, h };
}
