import type { System } from '../ecs/system';
import type { World } from '../ecs/ecs';
import { TRANSFORM, ORBITAL, PROJECTILE } from '../components';
import type { Transform, OrbitalProjectile, Projectile } from '../components';

export const OrbitalSystem: System = {
  name: 'OrbitalSystem',
  update(world: World, dt: number) {
    for (const entity of world.query(ORBITAL, TRANSFORM)) {
      const orbital = world.getComponent<OrbitalProjectile>(entity, ORBITAL)!;
      const transform = world.getComponent<Transform>(entity, TRANSFORM)!;
      const ownerTransform = world.getComponent<Transform>(orbital.owner, TRANSFORM);

      if (!ownerTransform) {
        world.destroyEntity(entity);
        continue;
      }

      // Increment angle
      orbital.angle += orbital.angularSpeed * dt;

      // Set position relative to owner
      transform.prevPos.x = transform.pos.x;
      transform.prevPos.y = transform.pos.y;
      transform.pos.x = ownerTransform.pos.x + Math.cos(orbital.angle) * orbital.orbitRadius;
      transform.pos.y = ownerTransform.pos.y + Math.sin(orbital.angle) * orbital.orbitRadius;

      // Reset hit entities periodically so orbitals can re-hit enemies
      const proj = world.getComponent<Projectile>(entity, PROJECTILE);
      if (proj && proj.hitEntities.size > 20) {
        proj.hitEntities.clear();
      }
    }
  },
};
