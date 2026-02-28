import type { World } from '../ecs/ecs';
import { TRANSFORM, DAMAGE_NUMBER, LIFETIME } from '../components';
import type { Transform, DamageNumberData, Lifetime } from '../components';
import { DAMAGE_NUMBER_DURATION } from '../constants';

export function spawnDamageNumber(
  world: World,
  x: number, y: number,
  value: number,
  color = '#ffffff',
  isCrit = false
): void {
  const entity = world.createEntity();
  const offsetX = (Math.random() - 0.5) * 20;
  world.addComponent<Transform>(entity, TRANSFORM, {
    pos: { x: x + offsetX, y },
    prevPos: { x: x + offsetX, y },
    rotation: 0,
  });
  world.addComponent<DamageNumberData>(entity, DAMAGE_NUMBER, {
    value,
    timer: 0,
    duration: DAMAGE_NUMBER_DURATION,
    startY: y,
    color: isCrit ? '#ffd700' : color,
    isCrit,
    fontSize: isCrit ? 18 : 14,
  });
  world.addComponent<Lifetime>(entity, LIFETIME, { remaining: DAMAGE_NUMBER_DURATION });
}
