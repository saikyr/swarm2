import { TRANSFORM, VELOCITY, PLAYER, HEALTH, TRAIL } from '../components';
import type { Transform, Velocity, Player, Health, Trail } from '../components';
import type { World } from '../ecs/ecs';
import type { SnapshotData } from './snapshot';
import { WORLD_WIDTH, WORLD_HEIGHT, PLAYER_RADIUS } from '../constants';
import { getKeyboardInput } from '../systems/InputSystem';

const SNAP_THRESHOLD_SQ = 200 * 200;
const BLEND_TOWARD_SERVER = 0.35;

export class ClientPredictor {
  private localPlayerId = 0;
  private localEntity: number | null = null;

  setLocalPlayerId(id: number): void {
    this.localPlayerId = id;
  }

  getLocalEntity(): number | null {
    return this.localEntity;
  }

  /** Find and cache the local player entity from the world */
  detectLocalEntity(world: World): number | null {
    if (this.localEntity !== null && world.hasEntity(this.localEntity)) {
      return this.localEntity;
    }
    for (const entity of world.query(PLAYER, TRANSFORM)) {
      const p = world.getComponent<Player>(entity, PLAYER)!;
      if (p.playerId === this.localPlayerId) {
        this.localEntity = entity;
        return entity;
      }
    }
    this.localEntity = null;
    return null;
  }

  /** On new snapshot (~30Hz): blend local player toward server position */
  applyServerCorrection(world: World, rawSnapshot: SnapshotData): void {
    const entity = this.localEntity;
    if (entity === null) return;

    const t = world.getComponent<Transform>(entity, TRANSFORM);
    if (!t) return;

    // Find server position in raw snapshot
    const serverEntity = rawSnapshot.entities.find(e => e.id === entity);
    if (!serverEntity?.components?.transform) return;
    const serverPos = serverEntity.components.transform.pos;

    const errX = t.pos.x - serverPos.x;
    const errY = t.pos.y - serverPos.y;

    if (errX * errX + errY * errY > SNAP_THRESHOLD_SQ) {
      t.pos.x = serverPos.x;
      t.pos.y = serverPos.y;
      return;
    }

    t.pos.x += (serverPos.x - t.pos.x) * BLEND_TOWARD_SERVER;
    t.pos.y += (serverPos.y - t.pos.y) * BLEND_TOWARD_SERVER;
  }

  /** Sync non-position components (health, xp, speed, etc.) from raw snapshot */
  syncComponents(world: World, rawSnapshot: SnapshotData): void {
    const entity = this.localEntity;
    if (entity === null) return;

    const serverEntity = rawSnapshot.entities.find(e => e.id === entity);
    if (!serverEntity) return;

    // Sync player stats (xp, level, speed, etc.)
    const serverPlayer = serverEntity.components?.player;
    if (serverPlayer) {
      const localPlayer = world.getComponent<Player>(entity, PLAYER);
      if (localPlayer) {
        // Copy all fields except position-related ones that prediction handles
        localPlayer.xp = serverPlayer.xp;
        localPlayer.xpToNext = serverPlayer.xpToNext;
        localPlayer.level = serverPlayer.level;
        localPlayer.kills = serverPlayer.kills;
        localPlayer.downed = serverPlayer.downed;
        localPlayer.damageMultiplier = serverPlayer.damageMultiplier;
        localPlayer.speedMultiplier = serverPlayer.speedMultiplier;
        localPlayer.pickupRadiusMultiplier = serverPlayer.pickupRadiusMultiplier;
        localPlayer.isDashing = serverPlayer.isDashing;
        localPlayer.chilledTimer = serverPlayer.chilledTimer;
        localPlayer.speed = serverPlayer.speed;
        localPlayer.damageDealt = serverPlayer.damageDealt;
      }
    }

    // Sync health
    const serverHealth = serverEntity.components?.health;
    if (serverHealth) {
      const localHealth = world.getComponent<Health>(entity, HEALTH);
      if (localHealth) {
        localHealth.current = serverHealth.current;
        localHealth.max = serverHealth.max;
        localHealth.iframes = serverHealth.iframes;
      }
    }
  }

  /** Apply local input to move the player immediately (every frame) */
  predict(world: World, dt: number): void {
    const entity = this.localEntity;
    if (entity === null) return;

    const player = world.getComponent<Player>(entity, PLAYER);
    const t = world.getComponent<Transform>(entity, TRANSFORM);
    if (!player || !t) return;

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

    t.pos.x = Math.max(PLAYER_RADIUS, Math.min(WORLD_WIDTH - PLAYER_RADIUS, t.pos.x));
    t.pos.y = Math.max(PLAYER_RADIUS, Math.min(WORLD_HEIGHT - PLAYER_RADIUS, t.pos.y));
  }

  /** Update trail positions for local player (CleanupSystem only runs on host) */
  updateTrail(world: World): void {
    const entity = this.localEntity;
    if (entity === null) return;
    const trail = world.getComponent<Trail>(entity, TRAIL);
    const t = world.getComponent<Transform>(entity, TRANSFORM);
    if (!trail || !t) return;
    trail.positions.push({ x: t.pos.x, y: t.pos.y });
    if (trail.positions.length > trail.maxLength) {
      trail.positions.shift();
    }
  }
}
