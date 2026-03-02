import { TRANSFORM, VELOCITY, PLAYER } from '../components';
import type { Transform, Velocity, Player } from '../components';
import type { World } from '../ecs/ecs';
import { WORLD_WIDTH, WORLD_HEIGHT, PLAYER_RADIUS } from '../constants';
import { getKeyboardInput } from '../systems/InputSystem';

const SNAP_THRESHOLD_SQ = 200 * 200;
const BLEND_TOWARD_SERVER = 0.15; // each snapshot, blend 15% toward server position

export class ClientPredictor {
  private localPlayerId = 0;

  setLocalPlayerId(id: number): void {
    this.localPlayerId = id;
  }

  /** Save predicted position BEFORE snapshot overwrites it */
  beforeSnapshot(world: World): { x: number; y: number } | null {
    const entity = this.findLocal(world);
    if (entity === null) return null;
    const t = world.getComponent<Transform>(entity, TRANSFORM)!;
    return { x: t.pos.x, y: t.pos.y };
  }

  /** After snapshot: restore predicted position, blend slightly toward server */
  afterSnapshot(world: World, predicted: { x: number; y: number } | null): void {
    const entity = this.findLocal(world);
    if (entity === null || !predicted) return;

    const t = world.getComponent<Transform>(entity, TRANSFORM)!;
    const serverX = t.pos.x;
    const serverY = t.pos.y;

    const errX = predicted.x - serverX;
    const errY = predicted.y - serverY;

    if (errX * errX + errY * errY > SNAP_THRESHOLD_SQ) {
      // Large error (teleport/respawn) — keep server position
      return;
    }

    // Restore predicted position but blend toward server to correct drift
    t.pos.x = predicted.x + (serverX - predicted.x) * BLEND_TOWARD_SERVER;
    t.pos.y = predicted.y + (serverY - predicted.y) * BLEND_TOWARD_SERVER;
  }

  /** Apply local input to move the player immediately */
  predict(world: World, dt: number): void {
    const entity = this.findLocal(world);
    if (entity === null) return;

    const player = world.getComponent<Player>(entity, PLAYER)!;
    const t = world.getComponent<Transform>(entity, TRANSFORM)!;

    if (player.downed) return;

    const input = getKeyboardInput();
    let vx: number, vy: number;

    if (player.isDashing) {
      const vel = world.getComponent<Velocity>(entity, VELOCITY);
      vx = vel ? vel.x : 0;
      vy = vel ? vel.y : 0;
    } else {
      let speedMult = Math.max(0.2, Math.min(player.speedMultiplier, 1.5));
      if (player.chilledTimer > 0) speedMult *= 0.5;
      vx = input.moveX * player.speed * speedMult;
      vy = input.moveY * player.speed * speedMult;
    }

    t.prevPos.x = t.pos.x;
    t.prevPos.y = t.pos.y;
    t.pos.x += vx * dt;
    t.pos.y += vy * dt;

    // World bounds
    t.pos.x = Math.max(PLAYER_RADIUS, Math.min(WORLD_WIDTH - PLAYER_RADIUS, t.pos.x));
    t.pos.y = Math.max(PLAYER_RADIUS, Math.min(WORLD_HEIGHT - PLAYER_RADIUS, t.pos.y));
  }

  private findLocal(world: World): number | null {
    for (const entity of world.query(PLAYER, TRANSFORM)) {
      const p = world.getComponent<Player>(entity, PLAYER)!;
      if (p.playerId === this.localPlayerId) return entity;
    }
    return null;
  }
}
