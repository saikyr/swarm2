import type { System } from '../ecs/system';
import type { World } from '../ecs/ecs';
import { PROJECTILE, TRANSFORM, LIFETIME } from '../components';
import type { Transform, Lifetime } from '../components';
import { WORLD_WIDTH, WORLD_HEIGHT } from '../constants';

export const ProjectileSystem: System = {
  name: 'ProjectileSystem',
  update(world: World, _dt: number) {
    for (const entity of world.query(PROJECTILE, TRANSFORM)) {
      const transform = world.getComponent<Transform>(entity, TRANSFORM)!;

      // Destroy if out of world bounds
      if (
        transform.pos.x < -50 || transform.pos.x > WORLD_WIDTH + 50 ||
        transform.pos.y < -50 || transform.pos.y > WORLD_HEIGHT + 50
      ) {
        world.destroyEntity(entity);
      }
    }
  },
};
