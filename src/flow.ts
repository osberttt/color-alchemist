// Navigation between screens. The only place that decides "what comes next".
// Two modes share the shell: Seven Colors (default) and Classic (2 colors + crop).

import { camera } from './camera/camera';
import { newRun, run, dealCurrent, endRun, type BrewRecord } from './game';
import { getSettings } from './meta/storage';
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

async function openCameraThen(next: () => void, practice: () => void): Promise<void> {
  const err = await camera.start();
  if (err) {
    cameraErrorScreen(err, () => void openCameraThen(next, practice), practice);
    return;
  }
  next();
}

async function withCamera(next: () => void, practice: () => void): Promise<void> {
  if (camera.active) {
    next();
    return;
  }
  if (!getSettings().seenCameraPrompt) {
    cameraPromptScreen(() => void openCameraThen(next, practice), practice);
    return;
  }
  await openCameraThen(next, practice);
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
  if (await confirmDialog('Abandon this run? Your colors so far will be lost.', 'Abandon', 'Keep hunting')) goTitle();
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
