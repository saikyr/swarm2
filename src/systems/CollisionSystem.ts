import type { System } from '../ecs/system';
import type { World } from '../ecs/ecs';
import { TRANSFORM, COLLIDER, HEALTH, PROJECTILE, ENEMY, PLAYER, DAMAGE_FLASH, SWEEP_ATTACK, NOVA_ATTACK, ORBITAL, GROUND_ZONE } from '../components';
import type { Transform, Collider, Health, Projectile, Enemy, Player, SweepAttack, NovaAttack, GroundZone } from '../components';
import { CollisionLayer } from '../components';
import { SpatialHash } from '../spatial/spatial-hash';
import { SPATIAL_CELL_SIZE } from '../constants';
import { vec2DistSq, vec2Sub, vec2Angle } from '../utils/math';
import { spawnDamageNumber } from '../rendering/damage-numbers';
import { addScreenShake, type ScreenShake } from '../rendering/effects';

let spatialHash = new SpatialHash(SPATIAL_CELL_SIZE);

export function getSpatialHash(): SpatialHash {
  return spatialHash;
}

export let screenShakeRef: ScreenShake | null = null;
export function setScreenShakeRef(s: ScreenShake): void {
  screenShakeRef = s;
}

export const CollisionSystem: System = {
  name: 'CollisionSystem',
  update(world: World, dt: number) {
    spatialHash.clear();

    // Insert all collidable entities
    for (const entity of world.query(TRANSFORM, COLLIDER)) {
      const t = world.getComponent<Transform>(entity, TRANSFORM)!;
      const c = world.getComponent<Collider>(entity, COLLIDER)!;
      spatialHash.insert(entity, t.pos, c.radius);
    }

    // Helper: get damage multiplier from a projectile's owner player
    function getOwnerDmgMult(ownerEntity: number): number {
      const p = world.getComponent<Player>(ownerEntity, PLAYER);
      return p ? p.damageMultiplier : 1;
    }

    // Check projectile vs enemy
    for (const projEntity of world.query(PROJECTILE, TRANSFORM, COLLIDER)) {
      const proj = world.getComponent<Projectile>(projEntity, PROJECTILE)!;
      const projT = world.getComponent<Transform>(projEntity, TRANSFORM)!;
      const projC = world.getComponent<Collider>(projEntity, COLLIDER)!;
      const dmgMult = getOwnerDmgMult(proj.owner);

      const nearby = spatialHash.query(projT.pos, projC.radius + 32);
      for (const other of nearby) {
        if (other === projEntity) continue;
        if (!world.hasComponent(other, ENEMY)) continue;
        if (proj.hitEntities.has(other)) continue;

        const otherT = world.getComponent<Transform>(other, TRANSFORM)!;
        const otherC = world.getComponent<Collider>(other, COLLIDER)!;

        const distSq = vec2DistSq(projT.pos, otherT.pos);
        const minDist = projC.radius + otherC.radius;
        if (distSq <= minDist * minDist) {
          proj.hitEntities.add(other);

          const health = world.getComponent<Health>(other, HEALTH);
          if (health) {
            const dmg = proj.damage * dmgMult;
            health.current -= dmg;
            world.addComponent(other, DAMAGE_FLASH, { timer: 0.08, duration: 0.08 });
            spawnDamageNumber(world, otherT.pos.x, otherT.pos.y - otherC.radius, dmg);
            if (screenShakeRef) addScreenShake(screenShakeRef, 2);
          }

          proj.piercing--;
          if (proj.piercing < 0) {
            world.destroyEntity(projEntity);
            break;
          }
        }
      }
    }

    // Check sweep attacks vs enemies
    for (const sweepEntity of world.query(SWEEP_ATTACK, TRANSFORM)) {
      const sweep = world.getComponent<SweepAttack>(sweepEntity, SWEEP_ATTACK)!;
      const sweepT = world.getComponent<Transform>(sweepEntity, TRANSFORM)!;
      const sweepDmgMult = getOwnerDmgMult(sweep.owner);

      const nearby = spatialHash.query(sweepT.pos, sweep.range);
      for (const other of nearby) {
        if (!world.hasComponent(other, ENEMY)) continue;
        if (sweep.hitEntities.has(other)) continue;

        const otherT = world.getComponent<Transform>(other, TRANSFORM)!;
        const otherC = world.getComponent<Collider>(other, COLLIDER);

        const distSq = vec2DistSq(sweepT.pos, otherT.pos);
        if (distSq > sweep.range * sweep.range) continue;

        const toEnemy = vec2Angle(vec2Sub(otherT.pos, sweepT.pos));
        let angleDiff = toEnemy - sweep.angle;
        while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
        while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
        if (Math.abs(angleDiff) > sweep.arc / 2) continue;

        sweep.hitEntities.add(other);
        const health = world.getComponent<Health>(other, HEALTH);
        if (health) {
          const dmg = sweep.damage * sweepDmgMult;
          health.current -= dmg;
          world.addComponent(other, DAMAGE_FLASH, { timer: 0.08, duration: 0.08 });
          spawnDamageNumber(world, otherT.pos.x, otherT.pos.y - (otherC?.radius ?? 10), dmg);
          if (screenShakeRef) addScreenShake(screenShakeRef, 3);
        }
      }
    }

    // Check nova attacks vs enemies (or vs players for enemy-owned novas)
    for (const novaEntity of world.query(NOVA_ATTACK, TRANSFORM)) {
      const nova = world.getComponent<NovaAttack>(novaEntity, NOVA_ATTACK)!;
      const novaT = world.getComponent<Transform>(novaEntity, TRANSFORM)!;
      const targetComponent = nova.isEnemyOwned ? PLAYER : ENEMY;

      const nearby = spatialHash.query(novaT.pos, nova.radius);
      for (const other of nearby) {
        if (!world.hasComponent(other, targetComponent)) continue;
        if (nova.hitEntities.has(other)) continue;

        const otherT = world.getComponent<Transform>(other, TRANSFORM)!;
        const otherC = world.getComponent<Collider>(other, COLLIDER);

        const distSq = vec2DistSq(novaT.pos, otherT.pos);
        const r = nova.radius + (otherC?.radius ?? 10);
        if (distSq > r * r) continue;

        nova.hitEntities.add(other);
        const health = world.getComponent<Health>(other, HEALTH);
        if (health) {
          if (nova.isEnemyOwned) {
            // Enemy nova vs player: apply iframes
            if (health.iframes > 0) continue;
            health.current -= nova.damage;
            health.iframes = 0.5;
            world.addComponent(other, DAMAGE_FLASH, { timer: 0.1, duration: 0.1 });
            if (screenShakeRef) addScreenShake(screenShakeRef, 5);
          } else {
            health.current -= nova.damage;
            world.addComponent(other, DAMAGE_FLASH, { timer: 0.08, duration: 0.08 });
            spawnDamageNumber(world, otherT.pos.x, otherT.pos.y - (otherC?.radius ?? 10), nova.damage);
          }
        }
      }
    }

    // Check ground zone damage ticks (vs enemies, or vs players for enemy-owned zones)
    for (const zoneEntity of world.query(GROUND_ZONE, TRANSFORM)) {
      const zone = world.getComponent<GroundZone>(zoneEntity, GROUND_ZONE)!;
      const zoneT = world.getComponent<Transform>(zoneEntity, TRANSFORM)!;
      const zoneDmgMult = zone.isEnemyOwned ? 1 : getOwnerDmgMult(zone.owner);
      const targetComponent = zone.isEnemyOwned ? PLAYER : ENEMY;

      zone.tickTimer -= dt;
      if (zone.tickTimer > 0) continue;
      zone.tickTimer = zone.tickInterval;

      const nearby = spatialHash.query(zoneT.pos, zone.radius);
      for (const other of nearby) {
        if (!world.hasComponent(other, targetComponent)) continue;

        const otherT = world.getComponent<Transform>(other, TRANSFORM)!;
        const otherC = world.getComponent<Collider>(other, COLLIDER);
        const distSq = vec2DistSq(zoneT.pos, otherT.pos);
        const r = zone.radius + (otherC?.radius ?? 10);
        if (distSq > r * r) continue;

        const health = world.getComponent<Health>(other, HEALTH);
        if (health) {
          if (zone.isEnemyOwned) {
            if (health.iframes > 0) continue;
            health.current -= zone.damage;
            health.iframes = 0.3;
            world.addComponent(other, DAMAGE_FLASH, { timer: 0.1, duration: 0.1 });
            if (screenShakeRef) addScreenShake(screenShakeRef, 3);
          } else {
            const dmg = zone.damage * zoneDmgMult;
            health.current -= dmg;
            world.addComponent(other, DAMAGE_FLASH, { timer: 0.08, duration: 0.08 });
            spawnDamageNumber(world, otherT.pos.x, otherT.pos.y - (otherC?.radius ?? 10), dmg);
          }
        }
      }
    }

    // Check orbital projectiles vs enemies (with hit cooldown via hitEntities)
    for (const orbEntity of world.query(ORBITAL, PROJECTILE, TRANSFORM, COLLIDER)) {
      const proj = world.getComponent<Projectile>(orbEntity, PROJECTILE)!;
      const orbT = world.getComponent<Transform>(orbEntity, TRANSFORM)!;
      const orbC = world.getComponent<Collider>(orbEntity, COLLIDER)!;
      const orbDmgMult = getOwnerDmgMult(proj.owner);

      const nearby = spatialHash.query(orbT.pos, orbC.radius + 32);
      for (const other of nearby) {
        if (other === orbEntity) continue;
        if (!world.hasComponent(other, ENEMY)) continue;
        if (proj.hitEntities.has(other)) continue;

        const otherT = world.getComponent<Transform>(other, TRANSFORM)!;
        const otherC = world.getComponent<Collider>(other, COLLIDER)!;

        const distSq = vec2DistSq(orbT.pos, otherT.pos);
        const minDist = orbC.radius + otherC.radius;
        if (distSq <= minDist * minDist) {
          proj.hitEntities.add(other);
          const health = world.getComponent<Health>(other, HEALTH);
          if (health) {
            const dmg = proj.damage * orbDmgMult;
            health.current -= dmg;
            world.addComponent(other, DAMAGE_FLASH, { timer: 0.08, duration: 0.08 });
            spawnDamageNumber(world, otherT.pos.x, otherT.pos.y - otherC.radius, dmg);
            if (screenShakeRef) addScreenShake(screenShakeRef, 2);
          }
        }
      }
    }

    // Check enemy projectiles vs player
    for (const projEntity of world.query(PROJECTILE, TRANSFORM, COLLIDER)) {
      const projC = world.getComponent<Collider>(projEntity, COLLIDER)!;
      if (projC.layer !== CollisionLayer.EnemyProjectile) continue;

      const proj = world.getComponent<Projectile>(projEntity, PROJECTILE)!;
      const projT = world.getComponent<Transform>(projEntity, TRANSFORM)!;

      const nearby = spatialHash.query(projT.pos, projC.radius + 32);
      for (const other of nearby) {
        if (other === projEntity) continue;
        if (!world.hasComponent(other, PLAYER)) continue;
        if (proj.hitEntities.has(other)) continue;

        const otherT = world.getComponent<Transform>(other, TRANSFORM)!;
        const otherC = world.getComponent<Collider>(other, COLLIDER)!;
        const otherH = world.getComponent<Health>(other, HEALTH);
        if (!otherH || otherH.iframes > 0) continue;

        const distSq = vec2DistSq(projT.pos, otherT.pos);
        const minDist = projC.radius + otherC.radius;
        if (distSq <= minDist * minDist) {
          proj.hitEntities.add(other);
          otherH.current -= proj.damage;
          otherH.iframes = 0.5;
          world.addComponent(other, DAMAGE_FLASH, { timer: 0.1, duration: 0.1 });
          if (screenShakeRef) addScreenShake(screenShakeRef, 5);
          world.destroyEntity(projEntity);
          break;
        }
      }
    }

    // Check enemy vs player (contact damage)
    for (const playerEntity of world.query(PLAYER, TRANSFORM, COLLIDER, HEALTH)) {
      const playerT = world.getComponent<Transform>(playerEntity, TRANSFORM)!;
      const playerC = world.getComponent<Collider>(playerEntity, COLLIDER)!;
      const playerH = world.getComponent<Health>(playerEntity, HEALTH)!;

      if (playerH.iframes > 0) continue;

      const nearby = spatialHash.query(playerT.pos, playerC.radius + 32);
      for (const other of nearby) {
        if (!world.hasComponent(other, ENEMY)) continue;

        const otherT = world.getComponent<Transform>(other, TRANSFORM)!;
        const otherC = world.getComponent<Collider>(other, COLLIDER)!;
        const enemy = world.getComponent<Enemy>(other, ENEMY)!;

        const distSq = vec2DistSq(playerT.pos, otherT.pos);
        const minDist = playerC.radius + otherC.radius;
        if (distSq <= minDist * minDist) {
          playerH.current -= enemy.damage;
          playerH.iframes = 0.5;
          world.addComponent(playerEntity, DAMAGE_FLASH, { timer: 0.1, duration: 0.1 });
          if (screenShakeRef) addScreenShake(screenShakeRef, 5);
          break;
        }
      }
    }
  },
};
