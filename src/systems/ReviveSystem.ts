import type { System } from '../ecs/system';
import type { World } from '../ecs/ecs';
import { REVIVE_ZONE, TRANSFORM, PLAYER, HEALTH } from '../components';
import type { ReviveZone, Transform, Player, Health } from '../components';
import { vec2DistSq } from '../utils/math';

export const ReviveSystem: System = {
  name: 'ReviveSystem',
  update(world: World, dt: number) {
    for (const zoneEntity of world.query(REVIVE_ZONE, TRANSFORM)) {
      const zone = world.getComponent<ReviveZone>(zoneEntity, REVIVE_ZONE)!;
      const zoneT = world.getComponent<Transform>(zoneEntity, TRANSFORM)!;

      // Check if target player still exists and is still downed
      const targetPlayer = world.getComponent<Player>(zone.targetEntity, PLAYER);
      const targetHealth = world.getComponent<Health>(zone.targetEntity, HEALTH);
      if (!targetPlayer || !targetHealth || !targetPlayer.downed) {
        world.destroyEntity(zoneEntity);
        continue;
      }

      // Check if any living player is within radius
      let reviverNearby = false;
      const radiusSq = zone.radius * zone.radius;

      for (const pe of world.query(PLAYER, TRANSFORM, HEALTH)) {
        if (pe === zone.targetEntity) continue;
        const p = world.getComponent<Player>(pe, PLAYER)!;
        const h = world.getComponent<Health>(pe, HEALTH)!;
        if (p.downed || h.current <= 0) continue;

        const t = world.getComponent<Transform>(pe, TRANSFORM)!;
        if (vec2DistSq(t.pos, zoneT.pos) <= radiusSq) {
          reviverNearby = true;
          break;
        }
      }

      zone.reviverInZone = reviverNearby;

      if (reviverNearby) {
        zone.progress += dt / zone.reviveTime;
      } else {
        zone.progress = Math.max(0, zone.progress - dt * 0.5);
      }

      if (zone.progress >= 1) {
        // Revive the player
        targetPlayer.downed = false;
        targetHealth.current = Math.floor(targetHealth.max * 0.5);
        targetHealth.iframes = 1.0; // brief invulnerability after revive
        world.destroyEntity(zoneEntity);
      }
    }
  },
};
