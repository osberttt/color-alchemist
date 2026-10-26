// Tiny DOM helpers. No framework: the game is a handful of screens.

type Child = Node | string | number | null | undefined | false;
type Props = Record<string, unknown> & { class?: string; style?: string | Record<string, string> };

export function h<K extends keyof HTMLElementTagNameMap>(tag: K, props: Props | null = null, ...children: Child[]): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  if (props) {
    for (const [k, v] of Object.entries(props)) {
      if (v === undefined || v === null || v === false) continue;
      if (k === 'class') el.className = String(v);
      else if (k === 'style' && typeof v === 'object') {
        for (const [sk, sv] of Object.entries(v as Record<string, string>)) {
          if (sk.startsWith('--')) el.style.setProperty(sk, sv);
          else el.style.setProperty(sk.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`), sv);
        }
      }
      else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v as EventListener);
      else if (k === 'html') el.innerHTML = String(v);
      else if (v === true) el.setAttribute(k, '');
      else el.setAttribute(k, String(v));
    }
  }
  append(el, children);
  return el;
}

export function append(el: Element, children: Child[]): void {
  for (const c of children) {
    if (c === null || c === undefined || c === false) continue;
    el.append(typeof c === 'string' || typeof c === 'number' ? document.createTextNode(String(c)) : c);
  }
}

export function svg(markup: string, cls = ''): HTMLElement {
  const span = document.createElement('span');
  span.className = `svg ${cls}`.trim();
  span.innerHTML = markup;
  return span;
}

let toastTimer = 0;
export function toast(text: string, ms = 2200): void {
  let el = document.getElementById('toast');
  if (!el) {
    el = h('div', { id: 'toast', role: 'status', 'aria-live': 'polite' });
    document.body.append(el);
  }
  el.textContent = text;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => el!.classList.remove('show'), ms);
}

export const reducedMotion = (): boolean => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

export function wait(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/** Round-bottom flask, optionally filled with a liquid color. */
export function flaskSvg(fill: string | null, opts: { level?: number; id?: string; stroke?: string } = {}): string {
  const level = opts.level ?? 0.62;
  const id = opts.id ?? `f${Math.random().toString(36).slice(2, 8)}`;
  const stroke = opts.stroke ?? 'currentColor';
  const y = 18 + (1 - level) * 26;
  return `<svg viewBox="0 0 40 48" aria-hidden="true">
  <defs><clipPath id="${id}"><path d="M15 4h10v12.5a14 14 0 1 1-10 0z"/></clipPath></defs>
  ${fill ? `<g clip-path="url(#${id})"><rect x="0" y="${y}" width="40" height="48" fill="${fill}"/><path d="M0 ${y} q5 -2 10 0 t10 0 t10 0 t10 0 v3 h-40z" fill="${fill}" opacity=".6" class="meniscus"/></g>` : ''}
  <path d="M15 4h10v12.5a14 14 0 1 1-10 0z" fill="none" stroke="${stroke}" stroke-width="2.2" stroke-linejoin="round"/>
  <path d="M13 4h14" stroke="${stroke}" stroke-width="2.6" stroke-linecap="round"/>
  <path d="M12.5 29a8 8 0 0 0 4 7" fill="none" stroke="${stroke}" stroke-width="1.4" stroke-linecap="round" opacity=".5"/>
</svg>`;
}

/** A slim vial for target cards. */
export function vialSvg(fill: string): string {
  const id = `v${Math.random().toString(36).slice(2, 8)}`;
  return `<svg viewBox="0 0 20 48" aria-hidden="true">
  <defs><clipPath id="${id}"><path d="M5 6h10v34a5 5 0 0 1-10 0z"/></clipPath></defs>
  <g clip-path="url(#${id})"><rect x="0" y="14" width="20" height="40" fill="${fill}"/></g>
  <path d="M5 6h10v34a5 5 0 0 1-10 0z" fill="none" stroke="currentColor" stroke-width="1.8"/>
  <rect x="4" y="2" width="12" height="5" rx="1.5" fill="currentColor"/>
</svg>`;
}

export function fmt(n: number): string {
  return Math.round(n).toLocaleString('en-US').replace(/,/g, ' ');
}
