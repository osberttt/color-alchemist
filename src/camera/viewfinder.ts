// The Seven Colors viewfinder: the source in full color, with digital zoom,
// panning (image sources) and the player's tincture applied exactly like the
// scorer applies it (exposure and warmth as linear gains, saturation as OKLab chroma).

import { editGains, type Edits } from '../color/plate';
import type { FrameSource, Rect } from './source';

const VERT = `
attribute vec2 a_pos;
varying vec2 v_uv;
void main() {
  vec2 uv = a_pos * 0.5 + 0.5;
  v_uv = vec2(uv.x, 1.0 - uv.y);
  gl_Position = vec4(a_pos, 0.0, 1.0);
}`;

const FRAG = `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
uniform sampler2D u_tex;
uniform vec4 u_view;
uniform float u_mirror;
uniform vec3 u_gain;
uniform float u_sat;
varying vec2 v_uv;

vec3 toLin(vec3 c) { return mix(c / 12.92, pow((c + 0.055) / 1.055, vec3(2.4)), step(vec3(0.04045), c)); }
vec3 toSrgb(vec3 l) { return mix(l * 12.92, 1.055 * pow(l, vec3(1.0 / 2.4)) - 0.055, step(vec3(0.0031308), l)); }
vec3 cbrt3(vec3 x) { return sign(x) * pow(abs(x), vec3(1.0 / 3.0)); }
vec3 oklab(vec3 c) {
  vec3 lms = cbrt3(vec3(
    dot(c, vec3(0.4122214708, 0.5363325363, 0.0514459929)),
    dot(c, vec3(0.2119034982, 0.6806995451, 0.1073969566)),
    dot(c, vec3(0.0883024619, 0.2817188376, 0.6299787005))));
  return vec3(
    dot(lms, vec3(0.2104542553, 0.7936177850, -0.0040720468)),
    dot(lms, vec3(1.9779984951, -2.4285922050, 0.4505937099)),
    dot(lms, vec3(0.0259040371, 0.7827717662, -0.8086757660)));
}
vec3 fromOklab(vec3 lab) {
  vec3 lms = vec3(
    lab.x + 0.3963377774 * lab.y + 0.2158037573 * lab.z,
    lab.x - 0.1055613458 * lab.y - 0.0638541728 * lab.z,
    lab.x - 0.0894841775 * lab.y - 1.2914855480 * lab.z);
  lms = lms * lms * lms;
  return vec3(
    dot(lms, vec3(4.0767416621, -3.3077115913, 0.2309699292)),
    dot(lms, vec3(-1.2684380046, 2.6097574011, -0.3413193965)),
    dot(lms, vec3(-0.0041960863, -0.7034186147, 1.7076147010)));
}
void main() {
  vec2 d = v_uv;
  if (u_mirror > 0.5) d.x = 1.0 - d.x;
  vec4 view = u_view;
  if (u_mirror > 0.5) view.x = 1.0 - view.x - view.z;
  vec2 s = view.xy + d * view.zw;
  if (s.x < 0.0 || s.y < 0.0 || s.x > 1.0 || s.y > 1.0) {
    gl_FragColor = vec4(0.06, 0.06, 0.07, 1.0);
    return;
  }
  vec3 lin = min(toLin(texture2D(u_tex, s).rgb) * u_gain, vec3(1.0));
  if (abs(u_sat) > 0.001) {
    vec3 lab = oklab(lin);
    lab.yz *= 1.0 + u_sat;
    lin = clamp(fromOklab(lab), 0.0, 1.0);
  }
  gl_FragColor = vec4(toSrgb(lin), 1.0);
}`;

export class Viewfinder {
  readonly canvas: HTMLCanvasElement;
  readonly ok: boolean;
  private gl: WebGLRenderingContext | null = null;
  private tex: WebGLTexture | null = null;
  private u: Record<string, WebGLUniformLocation | null> = {};
  private uploadedFor: unknown = null;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ok = this.init();
  }

  private init(): boolean {
    try {
      const gl = this.canvas.getContext('webgl', { antialias: false, alpha: false, preserveDrawingBuffer: false });
      if (!gl) return false;
      const compile = (type: number, src: string) => {
        const s = gl.createShader(type)!;
        gl.shaderSource(s, src);
        gl.compileShader(s);
        if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) ?? 'shader');
        return s;
      };
      const prog = gl.createProgram()!;
      gl.attachShader(prog, compile(gl.VERTEX_SHADER, VERT));
      gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, FRAG));
      gl.linkProgram(prog);
      if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog) ?? 'link');
      gl.useProgram(prog);
      const buf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
      const loc = gl.getAttribLocation(prog, 'a_pos');
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
      for (const n of ['u_tex', 'u_view', 'u_mirror', 'u_gain', 'u_sat']) this.u[n] = gl.getUniformLocation(prog, n);
      this.tex = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, this.tex);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.uniform1i(this.u.u_tex, 0);
      this.gl = gl;
      return true;
    } catch (e) {
      console.warn('Viewfinder WebGL unavailable:', e);
      return false;
    }
  }

  render(src: FrameSource, view: Rect, edits: Edits): boolean {
    const gl = this.gl;
    if (!gl || !src.ready()) return false;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const cw = Math.max(1, Math.round(this.canvas.clientWidth * dpr));
    const ch = Math.max(1, Math.round(this.canvas.clientHeight * dpr));
    if (this.canvas.width !== cw || this.canvas.height !== ch) {
      this.canvas.width = cw;
      this.canvas.height = ch;
    }
    gl.viewport(0, 0, cw, ch);
    gl.bindTexture(gl.TEXTURE_2D, this.tex);
    if (src.live || this.uploadedFor !== src.el) {
      try {
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, src.el);
        this.uploadedFor = src.el;
      } catch {
        return false;
      }
    }
    gl.uniform4f(this.u.u_view, view.x, view.y, view.w, view.h);
    gl.uniform1f(this.u.u_mirror, src.mirrored ? 1 : 0);
    gl.uniform3fv(this.u.u_gain, editGains(edits));
    gl.uniform1f(this.u.u_sat, edits.sat);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    return true;
  }

  destroy(): void {
    this.gl?.getExtension('WEBGL_lose_context')?.loseContext();
    this.gl = null;
  }
}
