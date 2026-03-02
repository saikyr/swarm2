import type { SimCore } from './state';

export interface TickResult {
  steps: number;
  remainingAccumulator: number;
}

export function stepFixedAccumulator(
  sim: SimCore,
  accumulator: number,
  dt: number,
  maxSteps: number,
): TickResult {
  let steps = 0;
  let acc = accumulator;

  while (acc >= dt && steps < maxSteps) {
    sim.stepFixed(dt);
    acc -= dt;
    steps += 1;
  }

  return {
    steps,
    remainingAccumulator: acc,
  };
}
