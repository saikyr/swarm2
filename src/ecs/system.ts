import type { World } from './ecs';

export interface System {
  name: string;
  update(world: World, dt: number): void;
}
