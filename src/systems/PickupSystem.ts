import type { System } from '../ecs/system';
import type { World } from '../ecs/ecs';
import { PICKUP, TRANSFORM, PLAYER, COLLIDER, HEALTH } from '../components';
import type { Pickup, Transform, Player, Health } from '../components';
import { vec2Dist, vec2Normalize, vec2Sub, vec2DistSq } from '../utils/math';

export const PickupSystem: System = {
  name: 'PickupSystem',
  update(world: World, dt: number) {
    const players = world.query(PLAYER, TRANSFORM);
    if (players.length === 0) return;

    for (const entity of world.query(PICKUP, TRANSFORM)) {
      const pickup = world.getComponent<Pickup>(entity, PICKUP)!;
      const transform = world.getComponent<Transform>(entity, TRANSFORM)!;

      // Find nearest player
      let bestDistSq = Infinity;
      let bestEntity = players[0];
      for (const pe of players) {
        const h = world.getComponent<Health>(pe, HEALTH);
        if (h && h.current <= 0) continue; // skip dead players
        const t = world.getComponent<Transform>(pe, TRANSFORM)!;
        const dSq = vec2DistSq(t.pos, transform.pos);
        if (dSq < bestDistSq) {
          bestDistSq = dSq;
          bestEntity = pe;
        }
      }

      // Skip if no living player found (bestEntity is still default dead player)
      const bestH = world.getComponent<Health>(bestEntity, HEALTH);
      if (bestH && bestH.current <= 0) continue;

      const playerT = world.getComponent<Transform>(bestEntity, TRANSFORM)!;
      const player = world.getComponent<Player>(bestEntity, PLAYER)!;
      const playerH = bestH;

      const dist = Math.sqrt(bestDistSq);
      const magnetR = pickup.magnetRadius * player.pickupRadiusMultiplier;

      // Magnet attraction
      if (dist < magnetR) {
        pickup.attracted = true;
      }

      if (pickup.attracted) {
        const dir = vec2Normalize(vec2Sub(playerT.pos, transform.pos));
        // Ease in: slow start, accelerates as orb gets closer
        const t = 1 - Math.min(1, dist / magnetR);
        const speed = 80 + t * t * 400;
        transform.pos.x += dir.x * speed * dt;
        transform.pos.y += dir.y * speed * dt;
      }

      // Pickup
      if (dist < pickup.pickupRadius) {
        if (pickup.type === 'xp') {
          player.xp += pickup.value;
        } else if (pickup.type === 'health' && playerH) {
          playerH.current = Math.min(playerH.max, playerH.current + pickup.value);
        }
        world.destroyEntity(entity);
      }
    }
  },
};
