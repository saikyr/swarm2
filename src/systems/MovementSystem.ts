import type { System } from '../ecs/system';
import type { World } from '../ecs/ecs';
import { TRANSFORM, VELOCITY, PLAYER } from '../components';
import type { Transform, Velocity } from '../components';

export const MovementSystem: System = {
  name: 'MovementSystem',
  update(world: World, dt: number) {
    // Move all entities with velocity EXCEPT player (handled separately)
    for (const entity of world.query(TRANSFORM, VELOCITY)) {
      if (world.hasComponent(entity, PLAYER)) continue;

      const transform = world.getComponent<Transform>(entity, TRANSFORM)!;
      const vel = world.getComponent<Velocity>(entity, VELOCITY)!;

      transform.prevPos.x = transform.pos.x;
      transform.prevPos.y = transform.pos.y;
      transform.pos.x += vel.x * dt;
      transform.pos.y += vel.y * dt;
    }
  },
};
