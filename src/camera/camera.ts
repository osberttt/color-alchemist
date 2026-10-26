// getUserMedia wrapper. One stream for the whole session (iOS re-prompts on
// route changes), capture with temporal averaging (GDD §8.1).

import { TUNING } from '../data/tuning';
import { plateFromFrames, type Plate } from '../color/plate';

export type CameraError = 'insecure' | 'unsupported' | 'denied' | 'nocamera' | 'busy' | 'unknown';

export function cameraSupport(): 'ok' | CameraError {
  if (!window.isSecureContext) return 'insecure';
  if (!navigator.mediaDevices?.getUserMedia) return 'unsupported';
  return 'ok';
}

export const CAMERA_ERROR_TEXT: Record<CameraError, string> = {
  insecure: 'The camera only works on a secure (https) page.',
  unsupported: "This browser can't open the camera.",
  denied: 'Camera access was blocked. Allow it in your browser settings, then try again.',
  nocamera: 'No camera was found on this device.',
  busy: 'The camera is busy in another app. Close it and try again.',
  unknown: 'The camera could not start.',
};

function classify(e: unknown): CameraError {
  const name = (e as { name?: string })?.name ?? '';
  if (name === 'NotAllowedError' || name === 'SecurityError') return 'denied';
  if (name === 'NotFoundError' || name === 'OverconstrainedError') return 'nocamera';
  if (name === 'NotReadableError' || name === 'AbortError') return 'busy';
  return 'unknown';
}

class CameraImpl {
  readonly video: HTMLVideoElement;
  stream: MediaStream | null = null;
  facing: 'environment' | 'user' = 'environment';
  mirrored = false;
  deviceCount = 0;
  private canvas = document.createElement('canvas');
  private ctx: CanvasRenderingContext2D | null = null;

  constructor() {
    const v = document.createElement('video');
    v.setAttribute('playsinline', '');
    v.setAttribute('muted', '');
    v.setAttribute('autoplay', '');
    v.muted = true;
    v.playsInline = true;
    v.className = 'camera-video';
    this.video = v;
  }

  get active(): boolean {
    return !!this.stream && this.stream.getVideoTracks().some((t) => t.readyState === 'live');
  }

  get ready(): boolean {
    return this.active && this.video.videoWidth > 0 && this.video.readyState >= 2;
  }

  async start(facing: 'environment' | 'user' = this.facing): Promise<CameraError | null> {
    const support = cameraSupport();
    if (support !== 'ok') return support;
    if (this.active && facing === this.facing) {
      await this.play();
      return null;
    }
    this.stop();
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        // 1080p gives digital zoom (Seven Colors) some headroom.
        video: { facingMode: { ideal: facing }, width: { ideal: 1920 }, height: { ideal: 1080 } },
      });
    } catch (e) {
      // Some desktop browsers reject facingMode constraints; retry with anything.
      if (classify(e) === 'nocamera') {
        try {
          this.stream = await navigator.mediaDevices.getUserMedia({ audio: false, video: true });
        } catch (e2) {
          return classify(e2);
        }
      } else {
        return classify(e);
      }
    }
    this.facing = facing;
    const settings = this.stream.getVideoTracks()[0]?.getSettings?.() ?? {};
    // Desktop webcams often report no facingMode; they face the user.
    this.mirrored = settings.facingMode ? settings.facingMode === 'user' : true;
    this.video.srcObject = this.stream;
    await this.play();
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      this.deviceCount = devices.filter((d) => d.kind === 'videoinput').length;
    } catch {
      this.deviceCount = 1;
    }
    return null;
  }

  private async play(): Promise<void> {
    try {
      await this.video.play();
    } catch {
      // Autoplay can need a gesture; the hunt screen retries on tap.
    }
    if (this.video.videoWidth > 0) return;
    await new Promise<void>((resolve) => {
      const done = () => resolve();
      this.video.addEventListener('loadeddata', done, { once: true });
      setTimeout(done, 3000);
    });
  }

  async flip(): Promise<CameraError | null> {
    return this.start(this.facing === 'environment' ? 'user' : 'environment');
  }

  stop(): void {
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
    this.video.srcObject = null;
  }

  private grab(shortSide: number): { data: Uint8ClampedArray; w: number; h: number } | null {
    const vw = this.video.videoWidth;
    const vh = this.video.videoHeight;
    if (!vw || !vh) return null;
    const scale = Math.min(1, shortSide / Math.min(vw, vh));
    const w = Math.max(1, Math.round(vw * scale));
    const h = Math.max(1, Math.round(vh * scale));
    if (this.canvas.width !== w || this.canvas.height !== h || !this.ctx) {
      this.canvas.width = w;
      this.canvas.height = h;
      this.ctx = this.canvas.getContext('2d', { willReadFrequently: true });
    }
    const ctx = this.ctx;
    if (!ctx) return null;
    ctx.save();
    if (this.mirrored) {
      ctx.translate(w, 0);
      ctx.scale(-1, 1);
    }
    ctx.drawImage(this.video, 0, 0, w, h);
    ctx.restore();
    return { data: ctx.getImageData(0, 0, w, h).data, w, h };
  }

  /** A single small frame for the live meters. */
  sample(shortSide: number): Plate | null {
    const g = this.grab(shortSide);
    return g ? plateFromFrames([g.data], g.w, g.h) : null;
  }

  private nextFrame(): Promise<void> {
    const v = this.video as HTMLVideoElement & { requestVideoFrameCallback?: (cb: () => void) => number };
    return new Promise((resolve) => {
      let settled = false;
      const done = () => {
        if (!settled) {
          settled = true;
          resolve();
        }
      };
      if (v.requestVideoFrameCallback) v.requestVideoFrameCallback(done);
      setTimeout(done, 45);
    });
  }

  /** Capture the working plate: average several consecutive frames in linear light. */
  async capture(): Promise<Plate | null> {
    const frames: Uint8ClampedArray[] = [];
    let w = 0;
    let h = 0;
    for (let i = 0; i < TUNING.framesAveraged; i++) {
      if (i > 0) await this.nextFrame();
      const g = this.grab(TUNING.plateShortSide);
      if (!g) break;
      frames.push(new Uint8ClampedArray(g.data));
      w = g.w;
      h = g.h;
    }
    return frames.length ? plateFromFrames(frames, w, h) : null;
  }
}

export const camera = new CameraImpl();
