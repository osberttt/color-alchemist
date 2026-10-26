// The Alchemist's Lens: a WebGL color splash over the live camera (GDD §4).
// The world is grey; pixels close to a target bloom back into color.
// Same ΔE_CA and accuracy curve as src/color, re-written in GLSL.

import type { Lab } from '../color/oklab';
import type { Gains } from '../color/plate';
import { TUNING } from '../data/tuning';

const VERT = `
attribute vec2 a_pos;
uniform float u_mirror;
varying vec2 v_uv;
void main() {
  vec2 uv = a_pos * 0.5 + 0.5;
  v_uv = vec2(u_mirror > 0.5 ? 1.0 - uv.x : uv.x, 1.0 - uv.y);
  gl_Position = vec4(a_pos, 0.0, 1.0);
}`;

const FRAG = `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
uniform sampler2D u_tex;
uniform vec3 u_a;
uniform vec3 u_b;
uniform float u_tolA;
uniform float u_tolB;
uniform vec3 u_gain;
uniform float u_on;
uniform float u_patterns;
uniform float u_time;
uniform float u_px;
varying vec2 v_uv;

vec3 toLin(vec3 c) {
  vec3 lo = c / 12.92;
  vec3 hi = pow((c + 0.055) / 1.055, vec3(2.4));
  return mix(lo, hi, step(vec3(0.04045), c));
}
vec3 cbrt3(vec3 x) { return sign(x) * pow(abs(x), vec3(1.0 / 3.0)); }
vec3 oklab(vec3 c) {
  vec3 lms = vec3(
    dot(c, vec3(0.4122214708, 0.5363325363, 0.0514459929)),
    dot(c, vec3(0.2119034982, 0.6806995451, 0.1073969566)),
    dot(c, vec3(0.0883024619, 0.2817188376, 0.6299787005)));
  lms = cbrt3(lms);
  return vec3(
    dot(lms, vec3(0.2104542553, 0.7936177850, -0.0040720468)),
    dot(lms, vec3(1.9779984951, -2.4285922050, 0.4505937099)),
    dot(lms, vec3(0.0259040371, 0.7827717662, -0.8086757660)));
}
float dE(vec3 t, vec3 s) {
  float dL = s.x - t.x;
  float c1 = length(t.yz);
  float c2 = length(s.yz);
  float dC = c2 - c1;
  vec2 dab = s.yz - t.yz;
  float dH2 = max(0.0, dot(dab, dab) - dC * dC);
  float wC = c2 < c1 ? ${TUNING.wCDuller.toFixed(3)} * (1.0 + ${TUNING.dullRelK.toFixed(3)} * (1.0 - c2 / max(c1, 1e-5))) : ${TUNING.wCVivid.toFixed(3)};
  float lT = ${TUNING.wL.toFixed(3)} * dL;
  return sqrt(lT * lT + wC * wC * dC * dC + dH2);
}
float acc(float d) {
  float x = max(d - ${TUNING.accCore.toFixed(4)}, 0.0) / ${TUNING.accSigma.toFixed(4)};
  return exp(-x * x);
}
void main() {
  vec3 c = texture2D(u_tex, v_uv).rgb;
  vec3 lin = toLin(c);
  vec3 lab = oklab(lin);
  vec3 labC = oklab(min(lin * u_gain, vec3(1.0)));
  float aA = max(acc(dE(u_a, lab) / u_tolA), acc(dE(u_a, labC) / u_tolA));
  float aB = max(acc(dE(u_b, lab) / u_tolB), acc(dE(u_b, labC) / u_tolB));
  float g = dot(c, vec3(0.299, 0.587, 0.114));
  vec3 grey = vec3(g * 0.9 + 0.02);
  float faint = ${(TUNING.lensFaint / 100).toFixed(3)};
  float full = ${(TUNING.lensFull / 100).toFixed(3)};
  float bA = smoothstep(faint, full, aA) * u_on;
  float bB = smoothstep(faint, full, aB) * u_on;
  float bloom = max(bA, bB);
  vec3 col = mix(grey, c, bloom);
  float perfect = max(step(full, aA), step(full, aB)) * u_on;
  col += perfect * 0.10 * (0.5 + 0.5 * sin(u_time * 5.0 + (gl_FragCoord.x - gl_FragCoord.y) * 0.04 / u_px));
  if (u_patterns > 0.5) {
    vec2 p = gl_FragCoord.xy / u_px;
    float hatch = step(0.78, fract((p.x + p.y) / 8.0));
    vec2 q = fract(p / 8.0) - 0.5;
    float dots = 1.0 - step(0.17, length(q));
    col = mix(col, col * 0.45, hatch * bA);
    col = mix(col, col * 0.45, dots * bB);
  }
  gl_FragColor = vec4(col, 1.0);
}`;

export class Lens {
  readonly canvas: HTMLCanvasElement;
  readonly ok: boolean;
  private gl: WebGLRenderingContext | null = null;
  private tex: WebGLTexture | null = null;
  private u: Record<string, WebGLUniformLocation | null> = {};
  private a: Lab = { L: 0, a: 0, b: 0 };
  private b: Lab = { L: 0, a: 0, b: 0 };
  private tolA = 1;
  private tolB = 1;
  private gains: Gains = [1, 1, 1];
  on = true;
  patterns = true;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ok = this.init();
  }

  private init(): boolean {
    try {
      const gl = this.canvas.getContext('webgl', { antialias: false, preserveDrawingBuffer: false, alpha: false });
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
      for (const name of ['u_tex', 'u_a', 'u_b', 'u_tolA', 'u_tolB', 'u_gain', 'u_on', 'u_patterns', 'u_time', 'u_px', 'u_mirror']) {
        this.u[name] = gl.getUniformLocation(prog, name);
      }
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
      console.warn('Lens disabled:', e);
      this.gl = null;
      return false;
    }
  }

  setTargets(a: Lab, tolA: number, b: Lab, tolB: number): void {
    this.a = a;
    this.b = b;
    this.tolA = tolA;
    this.tolB = tolB;
  }

  setGains(g: Gains): void {
    this.gains = g;
  }

  /** Draw one frame. Returns false if the video isn't ready yet. */
  render(video: HTMLVideoElement, mirrored: boolean, time: number): boolean {
    const gl = this.gl;
    if (!gl || !video.videoWidth || video.readyState < 2) return false;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const cw = Math.max(1, Math.round(this.canvas.clientWidth * dpr));
    const ch = Math.max(1, Math.round(this.canvas.clientHeight * dpr));
    if (this.canvas.width !== cw || this.canvas.height !== ch) {
      this.canvas.width = cw;
      this.canvas.height = ch;
    }
    gl.viewport(0, 0, cw, ch);
    gl.bindTexture(gl.TEXTURE_2D, this.tex);
    try {
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, video);
    } catch {
      return false;
    }
    gl.uniform3f(this.u.u_a, this.a.L, this.a.a, this.a.b);
    gl.uniform3f(this.u.u_b, this.b.L, this.b.a, this.b.b);
    gl.uniform1f(this.u.u_tolA, this.tolA);
    gl.uniform1f(this.u.u_tolB, this.tolB);
    gl.uniform3f(this.u.u_gain, this.gains[0], this.gains[1], this.gains[2]);
    gl.uniform1f(this.u.u_on, this.on ? 1 : 0);
    gl.uniform1f(this.u.u_patterns, this.patterns ? 1 : 0);
    gl.uniform1f(this.u.u_time, time);
    gl.uniform1f(this.u.u_px, dpr);
    gl.uniform1f(this.u.u_mirror, mirrored ? 1 : 0);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    return true;
  }

  destroy(): void {
    const ext = this.gl?.getExtension('WEBGL_lose_context');
    ext?.loseContext();
    this.gl = null;
  }
}
