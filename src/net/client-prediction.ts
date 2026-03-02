import { TRANSFORM, VELOCITY, PLAYER } from '../components';
import type { Transform, Velocity, Player } from '../components';
import type { World } from '../ecs/ecs';
import type { SnapshotData } from './snapshot';
import { WORLD_WIDTH, WORLD_HEIGHT, PLAYER_RADIUS } from '../constants';
import { getKeyboardInput } from '../systems/InputSystem';

const SNAP_THRESHOLD_SQ = 200 * 200;
const BLEND_TOWARD_SERVER = 0.35; // per new snapshot (~20Hz), blend 35% toward server

export class ClientPredictor {
  private localPlayerId = 0;
  private savedPos: { x: number; y: number } | null = null;

  setLocalPlayerId(id: number): void {
    this.localPlayerId = id;
  }

  /** Save predicted position BEFORE snapshot overwrites it */
  savePosition(world: World): void {
    const entity = this.findLocal(world);
    if (entity === null) { this.savedPos = null; return; }
    const t = world.getComponent<Transform>(entity, TRANSFORM)!;
    this.savedPos = { x: t.pos.x, y: t.pos.y };
  }

  /** After snapshot applied: restore predicted position (snapshot updated all other components) */
  restorePosition(world: World): void {
    if (!this.savedPos) return;
    const entity = this.findLocal(world);
    if (entity === null) return;
    const t = world.getComponent<Transform>(entity, TRANSFORM)!;
    t.pos.x = this.savedPos.x;
    t.pos.y = this.savedPos.y;
  }

  /** Correct predicted position toward server on new snapshot arrival (~20Hz) */
  applyServerCorrection(world: World, rawSnapshot: SnapshotData): void {
    const entity = this.findLocal(world);
    if (entity === null) return;

    const t = world.getComponent<Transform>(entity, TRANSFORM)!;

    // Find this entity's server position in the raw snapshot
    const serverEntity = rawSnapshot.entities.find(e => e.id === entity);
    if (!serverEntity?.components?.transform) return;
    const serverPos = serverEntity.components.transform.pos;

    const errX = t.pos.x - serverPos.x;
    const errY = t.pos.y - serverPos.y;

    if (errX * errX + errY * errY > SNAP_THRESHOLD_SQ) {
      // Large error (teleport/respawn) — snap to server
      t.pos.x = serverPos.x;
      t.pos.y = serverPos.y;
      return;
    }

    // Blend predicted position toward server to correct drift
    t.pos.x += (serverPos.x - t.pos.x) * BLEND_TOWARD_SERVER;
    t.pos.y += (serverPos.y - t.pos.y) * BLEND_TOWARD_SERVER;
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
