// Local persistence: settings, Grimoire, offline leaderboard, stats.
// Every access is wrapped: private windows and blocked storage must not break the game.

const PREFIX = 'colorchemy:v1:';

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    if (!raw) return fallback;
    return { ...fallback, ...JSON.parse(raw) } as T;
  } catch {
    return fallback;
  }
}

function readArray<T>(key: string): T[] {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    const v = raw ? JSON.parse(raw) : [];
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

function write(key: string, value: unknown): void {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value));
  } catch {
    // Storage full or blocked: the game still works, it just forgets.
  }
}

// --- Settings ----------------------------------------------------------------

export interface Settings {
  muted: boolean;
  name: string;
  lensPatterns: boolean;
  seenCameraPrompt: boolean;
  tutorialDone: boolean;
  seenHowTo: boolean;
}

const DEFAULT_SETTINGS: Settings = {
  muted: false,
  name: '',
  lensPatterns: true,
  seenCameraPrompt: false,
  tutorialDone: false,
  seenHowTo: false,
};

export function getSettings(): Settings {
  return read('settings', DEFAULT_SETTINGS);
}

export function updateSettings(patch: Partial<Settings>): Settings {
  const s = { ...getSettings(), ...patch };
  write('settings', s);
  return s;
}

// --- Grimoire ------------------------------------------------------------------

export interface GrimoireEntry {
  bestAcc: number;
  hex: string;
  thumb?: string;
  date: string;
}

export function getGrimoire(): Record<string, GrimoireEntry> {
  return read<Record<string, GrimoireEntry>>('grimoire', {});
}

/** Returns true when this is a brand-new page (Prima Materia). */
export function recordColor(id: string, acc: number, hex: string, thumb?: string): { isNew: boolean; improved: boolean } {
  const g = getGrimoire();
  const prev = g[id];
  const isNew = !prev;
  const improved = !prev || acc > prev.bestAcc;
  if (improved) {
    g[id] = { bestAcc: Math.round(acc), hex, thumb: thumb ?? prev?.thumb, date: new Date().toISOString() };
    write('grimoire', g);
  }
  return { isNew, improved };
}

export function getFormulaeFound(): string[] {
  return readArray<string>('formulae');
}

export function recordFormula(name: string): boolean {
  const f = getFormulaeFound();
  if (f.includes(name)) return false;
  f.push(name);
  write('formulae', f);
  return true;
}

// --- Offline leaderboard -------------------------------------------------------

/**
 * Seven Colors boards: 'seven' (Brew, the camera) and 'seven-gallery' (practice from the
 * gallery). 'seven-practice' held painted-scene runs, which are no longer recorded (ANALYSIS
 * §4.39). 'camera' and 'practice' are the Classic pair-mode boards.
 */
export type BoardKind = 'seven' | 'seven-gallery' | 'seven-practice' | 'camera' | 'practice';

export interface BoardEntry {
  id: string;
  name: string;
  score: number;
  band: string;
  date: string;
  swatches: string[];
}

const BOARD_SIZE = 20;

export function getBoard(kind: BoardKind): BoardEntry[] {
  return readArray<BoardEntry>(`board-${kind}`)
    .filter((e) => typeof e?.score === 'number')
    .sort((a, b) => b.score - a.score);
}

/** Adds a run, returns its 1-based rank (or null if it didn't make the board). */
export function addToBoard(kind: BoardKind, entry: BoardEntry): number | null {
  const board = getBoard(kind);
  board.push(entry);
  board.sort((a, b) => b.score - a.score);
  const kept = board.slice(0, BOARD_SIZE);
  write(`board-${kind}`, kept);
  const idx = kept.findIndex((e) => e.id === entry.id);
  return idx >= 0 ? idx + 1 : null;
}

export function renameBoardEntry(kind: BoardKind, id: string, name: string): void {
  const board = getBoard(kind);
  const e = board.find((x) => x.id === id);
  if (e) {
    e.name = name;
    write(`board-${kind}`, board);
  }
}

// --- Stats -----------------------------------------------------------------------

export interface Stats {
  runs: number;
  bestRun: number;
  lastColors: string[];
}

export function getStats(): Stats {
  return read<Stats>('stats', { runs: 0, bestRun: 0, lastColors: [] });
}

export function recordRun(total: number, lastColors: string[]): Stats {
  const s = getStats();
  const next = { runs: s.runs + 1, bestRun: Math.max(s.bestRun, total), lastColors };
  write('stats', next);
  return next;
}
