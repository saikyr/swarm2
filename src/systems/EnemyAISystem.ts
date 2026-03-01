import type { System } from '../ecs/system';
import type { World } from '../ecs/ecs';
import { TRANSFORM, VELOCITY, ENEMY, PLAYER, HEALTH } from '../components';
import type { Transform, Velocity, Enemy, Player, Health } from '../components';
import { vec2Normalize, vec2Sub, vec2DistSq } from '../utils/math';
import { EliteAffix } from '../constants';

/** Find the nearest player position to a given point */
function findNearestPlayer(world: World, x: number, y: number): { pos: { x: number; y: number }; player: Player | null; entity: number } | null {
  const players = world.query(PLAYER, TRANSFORM);
  if (players.length === 0) return null;

  let bestDistSq = Infinity;
  let bestEntity = players[0];
  let bestPos = world.getComponent<Transform>(players[0], TRANSFORM)!.pos;

  for (const pe of players) {
    const h = world.getComponent<Health>(pe, HEALTH);
    if (h && h.current <= 0) continue; // skip dead players
    const t = world.getComponent<Transform>(pe, TRANSFORM)!;
    const distSq = (t.pos.x - x) * (t.pos.x - x) + (t.pos.y - y) * (t.pos.y - y);
    if (distSq < bestDistSq) {
      bestDistSq = distSq;
      bestPos = t.pos;
      bestEntity = pe;
    }
  }

  return { pos: bestPos, player: world.getComponent<Player>(bestEntity, PLAYER) ?? null, entity: bestEntity };
}

export const EnemyAISystem: System = {
  name: 'EnemyAISystem',
  update(world: World, dt: number) {
    const players = world.query(PLAYER, TRANSFORM);
    if (players.length === 0) return;

    for (const entity of world.query(ENEMY, TRANSFORM, VELOCITY)) {
      const enemy = world.getComponent<Enemy>(entity, ENEMY)!;
      const transform = world.getComponent<Transform>(entity, TRANSFORM)!;
      const vel = world.getComponent<Velocity>(entity, VELOCITY)!;

      const nearest = findNearestPlayer(world, transform.pos.x, transform.pos.y);
      if (!nearest) continue;
      const playerPos = nearest.pos;

      const dir = vec2Normalize(vec2Sub(playerPos, transform.pos));
      let speed = enemy.speed;

      // Teleporter affix: occasional blink toward player
      if (enemy.affixes.includes(EliteAffix.Teleporter)) {
        enemy.attackTimer -= dt;
        if (enemy.attackTimer <= 0) {
          enemy.attackTimer = 3 + Math.random() * 2;
          const dx = playerPos.x - transform.pos.x;
          const dy = playerPos.y - transform.pos.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist > 100) {
            transform.pos.x += dir.x * Math.min(dist * 0.5, 150);
            transform.pos.y += dir.y * Math.min(dist * 0.5, 150);
          }
        }
      }

      // Shielded affix: regenerate 5% max HP per second
      if (enemy.affixes.includes(EliteAffix.Shielded)) {
        const health = world.getComponent<Health>(entity, HEALTH);
        if (health && health.current < health.max) {
          health.current = Math.min(health.max, health.current + health.max * 0.05 * dt);
        }
      }

      // Chilling affix: slow nearest player within 80px (applied as a temporary debuff)
      if (enemy.affixes.includes(EliteAffix.Chilling) && nearest.player) {
        const distSq = vec2DistSq(transform.pos, playerPos);
        if (distSq < 80 * 80) {
          (nearest.player as any)._chilled = 0.5; // seconds of chill remaining
        }
      }

      vel.x = dir.x * speed;
      vel.y = dir.y * speed;

      transform.rotation = Math.atan2(dir.y, dir.x);
    }
  },
};
