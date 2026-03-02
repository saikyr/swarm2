import type { RunContext } from '../game/run';

export interface DirectorSnapshot {
  wave: number;
  elapsedSec: number;
}

export function getDirectorSnapshot(run: RunContext): DirectorSnapshot {
  return {
    wave: run.wave,
    elapsedSec: run.timer,
  };
}
