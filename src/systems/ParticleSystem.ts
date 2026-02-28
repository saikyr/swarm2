import type { System } from '../ecs/system';
import type { World } from '../ecs/ecs';
import { PARTICLE, TRANSFORM, RENDERABLE } from '../components';
import type { Particle, Transform, Renderable } from '../components';

export const ParticleSystem: System = {
  name: 'ParticleSystem',
  update(world: World, dt: number) {
    for (const entity of world.query(PARTICLE, TRANSFORM)) {
      const particle = world.getComponent<Particle>(entity, PARTICLE)!;
      const transform = world.getComponent<Transform>(entity, TRANSFORM)!;

      // Apply friction
      particle.vx *= 1 - particle.friction * dt;
      particle.vy *= 1 - particle.friction * dt;

      // Move
      transform.pos.x += particle.vx * dt;
      transform.pos.y += particle.vy * dt;

      // Lifetime
      particle.life -= dt;
      const lifeRatio = Math.max(0, particle.life / particle.maxLife);

      // Shrink and fade
      particle.size = particle.startSize * lifeRatio;
      const renderable = world.getComponent<Renderable>(entity, RENDERABLE);
      if (renderable) {
        renderable.alpha = lifeRatio;
        renderable.radius = particle.size;
      }

      if (particle.life <= 0) {
        world.destroyEntity(entity);
      }
    }
  },
};
