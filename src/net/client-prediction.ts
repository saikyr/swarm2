import { TRANSFORM, VELOCITY, PLAYER } from '../components';
import type { Transform, Velocity, Player } from '../components';
import type { World } from '../ecs/ecs';
import { WORLD_WIDTH, WORLD_HEIGHT, PLAYER_RADIUS } from '../constants';
import { getKeyboardInput } from '../systems/InputSystem';

const CORRECTION_RATE = 10;        // exponential decay speed — ~90% corrected in 230ms
const SNAP_THRESHOLD_SQ = 200 * 200; // above this distance², snap instantly

export class ClientPredictor {
  private localPlayerId = 0;
  private corrX = 0;
  private corrY = 0;

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

  /** Compute correction offset AFTER snapshot applied */
  afterSnapshot(world: World, predicted: { x: number; y: number } | null): void {
    const entity = this.findLocal(world);
    if (entity === null || !predicted) {
      this.corrX = 0;
      this.corrY = 0;
      return;
    }
    const t = world.getComponent<Transform>(entity, TRANSFORM)!;
    const errX = predicted.x - t.pos.x;
    const errY = predicted.y - t.pos.y;
    if (errX * errX + errY * errY > SNAP_THRESHOLD_SQ) {
      this.corrX = 0;
      this.corrY = 0;
    } else {
      this.corrX += errX;
      this.corrY += errY;
    }
  }

  /** Run local movement prediction + decay correction */
  predict(world: World, dt: number): void {
    const entity = this.findLocal(world);
    if (entity === null) return;

    const player = world.getComponent<Player>(entity, PLAYER)!;
    const t = world.getComponent<Transform>(entity, TRANSFORM)!;

    if (player.downed) {
      this.corrX = 0;
      this.corrY = 0;
      return;
    }

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

    // Decay and apply correction offset
    const decay = Math.min(1, CORRECTION_RATE * dt);
    this.corrX *= 1 - decay;
    this.corrY *= 1 - decay;
    t.pos.x += this.corrX;
    t.pos.y += this.corrY;
  }

  private findLocal(world: World): number | null {
    for (const entity of world.query(PLAYER, TRANSFORM)) {
      const p = world.getComponent<Player>(entity, PLAYER)!;
      if (p.playerId === this.localPlayerId) return entity;
    }
    return null;
  }
}
