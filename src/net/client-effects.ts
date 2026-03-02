import type { World } from '../ecs/ecs';
import type { SnapshotData, SnapshotEntity } from './snapshot';
import type { ScreenShake } from '../rendering/effects';
import type { HitPause } from '../rendering/effects';
import { emitParticles } from '../rendering/particles';
import { spawnDamageNumber } from '../rendering/damage-numbers';
import { ENEMY, RENDERABLE, PROJECTILE, HEALTH, DAMAGE_FLASH } from '../components';

export class ClientEffectReactor {
  reactToSnapshot(
    prev: SnapshotData | null,
    current: SnapshotData,
    world: World,
    _screenShake: ScreenShake,
    _hitPause: HitPause,
  ): void {
    if (!prev) return;

    const prevMap = new Map<number, SnapshotEntity>();
    for (const e of prev.entities) prevMap.set(e.id, e);

    const currMap = new Map<number, SnapshotEntity>();
    for (const e of current.entities) currMap.set(e.id, e);

    // Entities that disappeared
    for (const [id, prevEntity] of prevMap) {
      if (currMap.has(id)) continue;

      const comps = prevEntity.components;
      const transform = comps['transform'];
      if (!transform?.pos) continue;
      const x = transform.pos.x;
      const y = transform.pos.y;

      if (comps[ENEMY] && comps[RENDERABLE]) {
        // Enemy died — particle burst
        const color = comps[RENDERABLE].color ?? '#ff4444';
        emitParticles(world, x, y, 12, color, { speed: 120, life: 0.6 });
      } else if (comps[PROJECTILE]) {
        // Projectile vanished — small impact burst
        const color = comps[RENDERABLE]?.color ?? '#ffcc00';
        emitParticles(world, x, y, 4, color, { speed: 60, life: 0.3, size: 2 });
      }
    }

    // Entities in both — check health changes
    for (const [id, currEntity] of currMap) {
      const prevEntity = prevMap.get(id);
      if (!prevEntity) continue;

      const prevHealth = prevEntity.components[HEALTH];
      const currHealth = currEntity.components[HEALTH];
      if (!prevHealth || !currHealth) continue;

      const delta = prevHealth.current - currHealth.current;
      if (delta > 0) {
        const transform = currEntity.components['transform'];
        if (!transform?.pos) continue;
        const collider = currEntity.components['collider'];
        const yOffset = collider?.radius ?? 10;

        spawnDamageNumber(world, transform.pos.x, transform.pos.y - yOffset, delta);

        // Add damage flash locally
        if (world.hasEntity(id)) {
          world.addComponent(id, DAMAGE_FLASH, { timer: 0.08, duration: 0.08 });
        }
      }
    }
  }
}
