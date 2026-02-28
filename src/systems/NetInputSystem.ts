import type { System } from '../ecs/system';
import type { World } from '../ecs/ecs';

// This is a no-op system placeholder.
// Remote player inputs are applied directly in Game.onNetInput() when messages arrive.
// The system exists so the registration order is clear in the game loop.

export const NetInputSystem: System = {
  name: 'NetInputSystem',
  update(_world: World, _dt: number) {
    // Remote inputs are written to INPUT components by the Game class network handler
  },
};
