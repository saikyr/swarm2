import type { System } from '../ecs/system';
import type { World } from '../ecs/ecs';
import { LIFETIME } from '../components';
import type { Lifetime } from '../components';

export const LifetimeSystem: System = {
  name: 'LifetimeSystem',
  update(world: World, dt: number) {
    for (const entity of world.query(LIFETIME)) {
      const lifetime = world.getComponent<Lifetime>(entity, LIFETIME)!;
      lifetime.remaining -= dt;
      if (lifetime.remaining <= 0) {
        world.destroyEntity(entity);
      }
    }
  },
};
