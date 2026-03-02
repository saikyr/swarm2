import type { World } from '../ecs/ecs';
import { SimEventQueue } from './events';
import { SeededRng } from './rng';

export interface SimCoreState {
  tick: number;
  elapsedSec: number;
  seed: number;
}

export class SimCore {
  readonly world: World;
  readonly rng: SeededRng;
  readonly events = new SimEventQueue();
  readonly state: SimCoreState;

  constructor(world: World, seed: number) {
    this.world = world;
    this.rng = new SeededRng(seed);
    this.state = {
      tick: 0,
      elapsedSec: 0,
      seed,
    };
  }

  stepFixed(dt: number): void {
    this.world.update(dt);
    this.state.tick += 1;
    this.state.elapsedSec += dt;
  }
}
