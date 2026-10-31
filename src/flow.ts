// Navigation between screens. The only place that decides "what comes next".
// Two modes share the shell: Seven Colors (default) and Classic (2 colors + crop).

import { camera } from './camera/camera';
import { newRun, run, dealCurrent, endRun, type BrewRecord } from './game';
import type { Plate } from './color/plate';
import type { Assayer } from './scoring/assay';
import type { BoardKind } from './meta/storage';
import { titleScreen, cameraPromptScreen, cameraErrorScreen } from './screens/title';
import { dealScreen, huntScreen } from './screens/hunt';
import { brewScreen } from './screens/brew';
import { assayScreen } from './screens/assay';
import { summaryScreen } from './screens/summary';
import { grimoireScreen, boardScreen } from './screens/collection';
import { confirmDialog } from './app';
import { endSeven, newSeven, seven, type SevenMode, type SevenRun } from './seven/run';
import { sevenScreen } from './seven/screen';
import { sevenSummaryScreen } from './seven/summary';

export function goTitle(): void {
  endRun();
  endSeven();
  camera.stop();
  titleScreen();
}

/** Set before reloading to ask for the camera again; read once on the next start. */
const RETRY_CAMERA_KEY = 'colorchemy:retry-camera';

async function openCameraThen(next: () => void, practice: () => void): Promise<void> {
  const err = await camera.start();
  if (err) {
    // A browser that was refused the camera won't ask again on this page, whatever we call.
    // Safari asks again after a reload, so "Try again" reloads and comes back to the camera
    // screen. A browser that keeps blocking (Chrome remembers) gets a hint on the error screen.
    const retried = takeRetryFlag();
    // Always reload: not every browser reports a refusal as "denied" (some say nothing useful),
    // and a fresh page is the only way to get the request shown again.
    const retry = () => {
      try {
        sessionStorage.setItem(RETRY_CAMERA_KEY, '1');
      } catch {
        // No storage: the reload still lands on the title.
      }
      location.reload();
    };
    cameraErrorScreen(err, retry, practice, retried && (err === 'denied' || err === 'unknown'));
    return;
  }
  takeRetryFlag();
  next();
}

let retryPending = false;
function takeRetryFlag(): boolean {
  const was = retryPending;
  retryPending = false;
  return was;
}

/**
 * Brew always shows the camera screen first: the browser is asked only when the player taps
 * "Allow the camera" (the user's call, ANALYSIS §4.43). A camera already open this visit
 * goes straight on.
 */
async function withCamera(next: () => void, practice: () => void): Promise<void> {
  if (camera.active) {
    next();
    return;
  }
  cameraPromptScreen(() => void openCameraThen(next, practice), practice);
}

/** On start: after "Try again" reloaded the page, go straight back to Brew's camera screen. */
export function start(): void {
  let retry = false;
  try {
    retry = sessionStorage.getItem(RETRY_CAMERA_KEY) === '1';
    sessionStorage.removeItem(RETRY_CAMERA_KEY);
  } catch {
    // No storage: start normally.
  }
  if (!retry) {
    goTitle();
    return;
  }
  // Straight to the camera screen (showing the title first would race it).
  retryPending = true;
  void beginSeven('camera');
}

// --- Seven Colors ------------------------------------------------------------------

export async function beginSeven(mode: SevenMode): Promise<void> {
  endRun();
  if (mode !== 'camera') {
    camera.stop();
    sevenScreen(newSeven(mode));
    return;
  }
  await withCamera(
    () => sevenScreen(newSeven('camera')),
    () => void beginSeven('practice'),
  );
}

export function sevenAgain(): void {
  void beginSeven(seven?.mode ?? 'camera');
}

export function goSevenSummary(r: SevenRun): void {
  sevenSummaryScreen(r);
}

export async function quitSeven(): Promise<void> {
  if (await confirmDialog('Abandon this potion? Your colors so far will be lost.', 'Abandon', 'Keep brewing')) goTitle();
}

// --- Classic (2 colors, crop and edit) ------------------------------------------------

export async function beginCameraRun(): Promise<void> {
  endSeven();
  await withCamera(
    () => {
      newRun('camera');
      goDeal();
    },
    () => beginPracticeRun(),
  );
}

export function beginPracticeRun(): void {
  endSeven();
  camera.stop();
  newRun('practice');
  goDeal();
}

export function brewAgain(): void {
  if (!run) return goTitle();
  if (run.mode === 'practice') beginPracticeRun();
  else void beginCameraRun();
}

export function goDeal(): void {
  if (!run) return goTitle();
  dealCurrent(run);
  dealScreen(run);
}

export function goHunt(): void {
  if (!run) return goTitle();
  if (!camera.active) {
    void openCameraThen(
      () => run && huntScreen(run),
      () => beginPracticeRun(),
    );
    return;
  }
  huntScreen(run);
}

export function goBrew(plate: Plate, assayer: Assayer, secondsLeft: number, practiceLight?: string): void {
  if (!run) return goTitle();
  brewScreen(run, plate, assayer, secondsLeft, practiceLight);
}

export function goAssay(record: BrewRecord, photo: HTMLCanvasElement): void {
  if (!run) return goTitle();
  assayScreen(run, record, photo);
}

export function goNext(): void {
  if (!run) return goTitle();
  run.stage++;
  if (run.stage >= 3) summaryScreen(run);
  else goDeal();
}

export async function quitRun(): Promise<void> {
  if (await confirmDialog('Abandon this run? Your brews so far will be lost.', 'Abandon', 'Keep brewing')) goTitle();
}

// --- Collection ------------------------------------------------------------------------

export function goGrimoire(): void {
  grimoireScreen();
}

export function goBoard(kind: BoardKind = 'seven'): void {
  boardScreen(kind);
}
