import type { System } from '../ecs/system';
import type { World } from '../ecs/ecs';
import { TRANSFORM, WEAPON, WEAPON_OWNER, ENEMY, VELOCITY } from '../components';
import type { Transform, Weapon, WeaponOwner, Velocity } from '../components';
import { vec2DistSq } from '../utils/math';
import { TargetingType, SPATIAL_CELL_SIZE } from '../constants';
import { SpatialHash } from '../spatial/spatial-hash';

const enemyHash = new SpatialHash(SPATIAL_CELL_SIZE);

export const TargetingSystem: System = {
  name: 'TargetingSystem',
  update(world: World, _dt: number) {
    const enemies = world.query(ENEMY, TRANSFORM);
    if (enemies.length === 0) {
      // Clear all weapon targets
      for (const weaponEntity of world.query(WEAPON, WEAPON_OWNER)) {
        const weapon = world.getComponent<Weapon>(weaponEntity, WEAPON)!;
        weapon.target = null;
      }
      return;
    }

    // Build spatial hash of enemy positions for fast range queries
    enemyHash.clear();
    for (const enemy of enemies) {
      const et = world.getComponent<Transform>(enemy, TRANSFORM)!;
      enemyHash.insert(enemy, et.pos, 0);
    }

    for (const weaponEntity of world.query(WEAPON, WEAPON_OWNER)) {
      const weapon = world.getComponent<Weapon>(weaponEntity, WEAPON)!;
      const wo = world.getComponent<WeaponOwner>(weaponEntity, WEAPON_OWNER)!;
      const ownerTransform = world.getComponent<Transform>(wo.owner, TRANSFORM);
      if (!ownerTransform) { weapon.target = null; continue; }

      if (weapon.locked) { weapon.target = null; continue; }

      // Orbital targeting: target is owner position
      if (weapon.targeting === TargetingType.Orbital) {
        weapon.target = {
          entity: wo.owner,
          x: ownerTransform.pos.x,
          y: ownerTransform.pos.y,
          distSq: 0,
        };
        continue;
      }

      const rangeSq = weapon.range * weapon.range;
      weapon.target = null;

      if (weapon.targeting === TargetingType.Directional) {
        // Fire in movement direction; find a target point along velocity vector
        const vel = world.getComponent<Velocity>(wo.owner, VELOCITY);
        let dx = 0, dy = -1; // default: up
        if (vel && (vel.x !== 0 || vel.y !== 0)) {
          const len = Math.sqrt(vel.x * vel.x + vel.y * vel.y);
          dx = vel.x / len;
          dy = vel.y / len;
        } else {
          // Fallback: aim at closest enemy in range
          const nearby = enemyHash.query(ownerTransform.pos, weapon.range);
          let closestDistSq = Infinity;
          for (const enemy of nearby) {
            const et = world.getComponent<Transform>(enemy, TRANSFORM)!;
            const dSq = vec2DistSq(ownerTransform.pos, et.pos);
            if (dSq < closestDistSq && dSq <= rangeSq) {
              closestDistSq = dSq;
              const ex = et.pos.x - ownerTransform.pos.x;
              const ey = et.pos.y - ownerTransform.pos.y;
              const len = Math.sqrt(dSq);
              dx = ex / len;
              dy = ey / len;
              weapon.target = { entity: enemy, x: et.pos.x, y: et.pos.y, distSq: dSq };
            }
          }
          if (!weapon.target) continue;
        }
        // Set target as a point along the direction at weapon range
        if (!weapon.target) {
          weapon.target = {
            entity: -1,
            x: ownerTransform.pos.x + dx * weapon.range,
            y: ownerTransform.pos.y + dy * weapon.range,
            distSq: 0,
          };
        }
        continue;
      }

      // Use spatial hash for range-based queries
      const nearby = enemyHash.query(ownerTransform.pos, weapon.range);

      if (weapon.targeting === TargetingType.Closest || weapon.targeting === TargetingType.Aoe) {
        let closestDistSq = Infinity;
        for (const enemy of nearby) {
          const et = world.getComponent<Transform>(enemy, TRANSFORM)!;
          const dSq = vec2DistSq(ownerTransform.pos, et.pos);
          if (dSq < closestDistSq && dSq <= rangeSq) {
            closestDistSq = dSq;
            weapon.target = { entity: enemy, x: et.pos.x, y: et.pos.y, distSq: dSq };
          }
        }
      } else if (weapon.targeting === TargetingType.Random) {
        // Filter nearby to only those actually in range
        let count = 0;
        let picked = -1;
        for (const enemy of nearby) {
          const et = world.getComponent<Transform>(enemy, TRANSFORM)!;
          if (vec2DistSq(ownerTransform.pos, et.pos) <= rangeSq) {
            // Reservoir sampling: pick uniformly at random without allocating array
            count++;
            if (Math.random() < 1 / count) picked = enemy;
          }
        }
        if (picked >= 0) {
          const et = world.getComponent<Transform>(picked, TRANSFORM)!;
          weapon.target = { entity: picked, x: et.pos.x, y: et.pos.y, distSq: vec2DistSq(ownerTransform.pos, et.pos) };
        }
      }
    }
  },
};
