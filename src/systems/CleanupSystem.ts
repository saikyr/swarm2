import type { System } from '../ecs/system';
import type { World } from '../ecs/ecs';
import { DAMAGE_FLASH, TRAIL, TRANSFORM, DAMAGE_NUMBER, SWEEP_ATTACK, NOVA_ATTACK, BOOMERANG, VELOCITY, RUNE_CHARGE, RENDERABLE, LIFETIME, SPIRAL_PROJECTILE } from '../components';
import type { DamageFlash, Trail, Transform, DamageNumberData, NovaAttack, BoomerangProjectile, Velocity, RuneCharge, Renderable, Lifetime, SpiralProjectile } from '../components';
import { DAMAGE_NUMBER_RISE_SPEED } from '../constants';
import { vec2DistSq, vec2Normalize, vec2Sub } from '../utils/math';

export const CleanupSystem: System = {
  name: 'CleanupSystem',
  update(world: World, dt: number) {
    // Update damage flash timers
    for (const entity of world.query(DAMAGE_FLASH)) {
      const flash = world.getComponent<DamageFlash>(entity, DAMAGE_FLASH)!;
      flash.timer -= dt;
      if (flash.timer <= 0) {
        world.removeComponent(entity, DAMAGE_FLASH);
      }
    }

    // Update trails
    for (const entity of world.query(TRAIL, TRANSFORM)) {
      const trail = world.getComponent<Trail>(entity, TRAIL)!;
      const transform = world.getComponent<Transform>(entity, TRANSFORM)!;

      trail.positions.push({ x: transform.pos.x, y: transform.pos.y });
      if (trail.positions.length > trail.maxLength) {
        trail.positions.shift();
      }
    }

    // Update damage numbers
    for (const entity of world.query(DAMAGE_NUMBER, TRANSFORM)) {
      const dmgNum = world.getComponent<DamageNumberData>(entity, DAMAGE_NUMBER)!;
      const transform = world.getComponent<Transform>(entity, TRANSFORM)!;

      dmgNum.timer += dt;
      transform.pos.y -= DAMAGE_NUMBER_RISE_SPEED * dt;
    }

    // Update nova attack radius
    for (const entity of world.query(NOVA_ATTACK)) {
      const nova = world.getComponent<NovaAttack>(entity, NOVA_ATTACK)!;
      nova.timer += dt;
      const progress = nova.timer / nova.duration;
      nova.radius = nova.maxRadius * progress;
    }

    // Update sweep attack timer
    for (const entity of world.query(SWEEP_ATTACK)) {
      const sweep = world.getComponent(entity, SWEEP_ATTACK) as any;
      if (sweep) sweep.timer += dt;
    }

    // Update boomerang projectiles
    for (const entity of world.query(BOOMERANG, TRANSFORM, VELOCITY)) {
      const boom = world.getComponent<BoomerangProjectile>(entity, BOOMERANG)!;
      const transform = world.getComponent<Transform>(entity, TRANSFORM)!;
      const vel = world.getComponent<Velocity>(entity, VELOCITY)!;

      boom.elapsed += dt;

      if (!boom.returning && boom.elapsed >= boom.maxOutTime) {
        boom.returning = true;
      }

      if (boom.returning) {
        // Get owner position
        const ownerT = world.getComponent<Transform>(boom.owner, TRANSFORM);
        if (ownerT) {
          const dir = vec2Normalize(vec2Sub(ownerT.pos, transform.pos));
          vel.x = dir.x * boom.returnSpeed;
          vel.y = dir.y * boom.returnSpeed;

          // Destroy when close to owner
          const distSq = vec2DistSq(transform.pos, ownerT.pos);
          if (distSq < 20 * 20) {
            world.destroyEntity(entity);
          }
        } else {
          // Owner gone, destroy
          world.destroyEntity(entity);
        }
      }
    }

    // Update spiral projectiles — expand outward while rotating around owner
    for (const entity of world.query(SPIRAL_PROJECTILE, TRANSFORM)) {
      const spiral = world.getComponent<SpiralProjectile>(entity, SPIRAL_PROJECTILE)!;
      const transform = world.getComponent<Transform>(entity, TRANSFORM)!;

      spiral.angle += spiral.angularSpeed * dt;
      spiral.currentRadius += spiral.radialSpeed * dt;

      const ownerT = world.getComponent<Transform>(spiral.owner, TRANSFORM);
      if (ownerT) {
        transform.prevPos.x = transform.pos.x;
        transform.prevPos.y = transform.pos.y;
        transform.pos.x = ownerT.pos.x + Math.cos(spiral.angle) * spiral.currentRadius;
        transform.pos.y = ownerT.pos.y + Math.sin(spiral.angle) * spiral.currentRadius;
      } else {
        world.destroyEntity(entity);
      }
    }

    // Update rune charges — detonate when timer reaches chargeTime
    for (const entity of world.query(RUNE_CHARGE, TRANSFORM)) {
      const rune = world.getComponent<RuneCharge>(entity, RUNE_CHARGE)!;
      rune.timer += dt;

      // Pulse the renderable scale
      const renderable = world.getComponent<Renderable>(entity, RENDERABLE);
      if (renderable) {
        const chargeProgress = Math.min(1, rune.timer / rune.chargeTime);
        renderable.alpha = 0.5 + chargeProgress * 0.5;
        renderable.radius = 6 + chargeProgress * 4;
      }

      if (rune.timer >= rune.chargeTime && !rune.detonated) {
        rune.detonated = true;
        const runeT = world.getComponent<Transform>(entity, TRANSFORM)!;

        // Spawn a nova at this position
        const novaE = world.createEntity();
        world.addComponent<Transform>(novaE, TRANSFORM, {
          pos: { ...runeT.pos },
          prevPos: { ...runeT.pos },
          rotation: 0,
        });
        world.addComponent(novaE, NOVA_ATTACK, {
          radius: 0,
          maxRadius: rune.blastRadius,
          damage: rune.damage,
          timer: 0,
          duration: 0.3,
          owner: rune.owner,
          hitEntities: new Set(),
          color: rune.color,
        } as NovaAttack);
        world.addComponent(novaE, LIFETIME, { remaining: 0.3 } as Lifetime);

        // Hide the rune glyph
        if (renderable) {
          renderable.alpha = 0;
        }
      }
    }
  },
};
