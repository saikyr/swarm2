import { PLAYER_RADIUS, WORLD_HEIGHT, WORLD_WIDTH } from '../constants';
import type { Player, Transform, Velocity } from '../components';

export function applyNormalPlayerVelocity(
  player: Pick<Player, 'speed' | 'speedMultiplier' | 'chilledTimer'>,
  velocity: Pick<Velocity, 'x' | 'y'>,
  moveX: number,
  moveY: number,
  dt: number,
): void {
  let speedMult = Math.max(0.2, Math.min(player.speedMultiplier, 1.5));
  if (player.chilledTimer > 0) {
    player.chilledTimer = Math.max(0, player.chilledTimer - dt);
    speedMult *= 0.5;
  }

  velocity.x = moveX * player.speed * speedMult;
  velocity.y = moveY * player.speed * speedMult;
}

export function integratePlayerVelocity(
  transform: Pick<Transform, 'pos' | 'prevPos'>,
  velocity: Pick<Velocity, 'x' | 'y'>,
  dt: number,
): void {
  const beforeX = transform.pos.x;
  const beforeY = transform.pos.y;

  transform.prevPos.x = transform.pos.x;
  transform.prevPos.y = transform.pos.y;
  transform.pos.x += velocity.x * dt;
  transform.pos.y += velocity.y * dt;

  transform.pos.x = Math.max(PLAYER_RADIUS, Math.min(WORLD_WIDTH - PLAYER_RADIUS, transform.pos.x));
  transform.pos.y = Math.max(PLAYER_RADIUS, Math.min(WORLD_HEIGHT - PLAYER_RADIUS, transform.pos.y));

  if (!Number.isFinite(transform.pos.x) || !Number.isFinite(transform.pos.y)) {
    transform.pos.x = beforeX;
    transform.pos.y = beforeY;
    transform.prevPos.x = beforeX;
    transform.prevPos.y = beforeY;
  }
}
