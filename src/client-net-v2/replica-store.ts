import {
  ENEMY,
  GROUND_ZONE,
  HEALTH,
  INPUT,
  NOVA_ATTACK,
  ORBITAL,
  PICKUP,
  PLAYER,
  PROJECTILE,
  RENDERABLE,
  REVIVE_ZONE,
  RUNE_CHARGE,
  SPIRAL_PROJECTILE,
  SWEEP_ATTACK,
  TRANSFORM,
  VELOCITY,
  WEAPON,
  WEAPON_OWNER,
} from '../components';
import type {
  EffectLaneEntity,
  EnemyLaneEntity,
  NetRenderable,
  PickupLaneEntity,
  PlayerLaneEntity,
  ProjectileLaneEntity,
  SnapshotV2,
  WeaponLaneEntity,
} from '../net-v2/protocol';
import type { SnapshotData, SnapshotEntity } from '../net/snapshot';
import { netDebug } from '../debug/net-debug';

export class ReplicaStore {
  private players = new Map<number, PlayerLaneEntity>();
  private enemies = new Map<number, EnemyLaneEntity>();
  private projectiles = new Map<number, ProjectileLaneEntity>();
  private pickups = new Map<number, PickupLaneEntity>();
  private weapons = new Map<number, WeaponLaneEntity>();
  private effects = new Map<number, EffectLaneEntity>();

  private prevTransforms = new Map<number, { x: number; y: number }>();

  private lastSnapshotAtMs = 0;
  private avgIntervalMs = 50;
  private lastRemovedCount = 0;
  private localPlayerId: number | null = null;

  setLocalPlayerId(playerId: number): void {
    this.localPlayerId = Number.isFinite(playerId) ? playerId : null;
  }

  applySnapshot(snapshot: SnapshotV2, nowMs: number): SnapshotData {
    if (this.lastSnapshotAtMs > 0) {
      const sample = nowMs - this.lastSnapshotAtMs;
      this.avgIntervalMs = this.avgIntervalMs * 0.85 + sample * 0.15;
    }
    this.lastSnapshotAtMs = nowMs;

    this.capturePrevTransforms();

    if (snapshot.full) {
      this.players.clear();
      this.enemies.clear();
      this.projectiles.clear();
      this.pickups.clear();
      this.weapons.clear();
      this.effects.clear();
    }

    this.mergePlayersLane(snapshot.lanes.players, snapshot.removed.players);
    this.mergeLane(this.enemies, snapshot.lanes.enemies, snapshot.removed.enemies);
    this.mergeLane(this.projectiles, snapshot.lanes.projectiles, snapshot.removed.projectiles);
    this.mergeLane(this.pickups, snapshot.lanes.pickups, snapshot.removed.pickups);
    this.mergeLane(this.weapons, snapshot.lanes.weapons, snapshot.removed.weapons);
    this.mergeLane(this.effects, snapshot.lanes.effects, snapshot.removed.effects);
    this.lastRemovedCount =
      snapshot.removed.players.length +
      snapshot.removed.enemies.length +
      snapshot.removed.projectiles.length +
      snapshot.removed.pickups.length +
      snapshot.removed.weapons.length +
      snapshot.removed.effects.length;
    netDebug.log({
      kind: 'replica_merge',
      ts: Date.now(),
      full: snapshot.full,
      players: this.players.size,
      enemies: this.enemies.size,
      projectiles: this.projectiles.size,
      pickups: this.pickups.size,
      weapons: this.weapons.size,
      effects: this.effects.size,
    });

    return this.toWorldSnapshot();
  }

  getLastRemovedCount(): number {
    return this.lastRemovedCount;
  }

  getRenderAlpha(nowMs: number, _interpolationDelayMs = 0): number {
    if (this.lastSnapshotAtMs <= 0) return 1;
    // We interpolate from the last snapshot to the current one using the observed snapshot cadence.
    // Delay-based interpolation needs a two-snapshot buffer; without that, subtracting delay freezes alpha near 0.
    const t = (nowMs - this.lastSnapshotAtMs) / Math.max(1, this.avgIntervalMs);
    return Math.max(0, Math.min(1, t));
  }

  getAuthoritativePlayerPos(playerId: number): { x: number; y: number } | null {
    for (const p of this.players.values()) {
      if (p.player.playerId === playerId) {
        return { x: p.transform.pos.x, y: p.transform.pos.y };
      }
    }
    return null;
  }

  getAuthoritativePlayerState(playerId: number): { x: number; y: number; vx: number; vy: number } | null {
    for (const p of this.players.values()) {
      if (p.player.playerId === playerId) {
        return {
          x: p.transform.pos.x,
          y: p.transform.pos.y,
          vx: p.velocity.x,
          vy: p.velocity.y,
        };
      }
    }
    return null;
  }

  getAverageSnapshotIntervalMs(): number {
    return this.avgIntervalMs;
  }

  private mergeLane<T extends { id: number }>(target: Map<number, T>, updates: T[], removed: number[]): void {
    for (const entity of updates) target.set(entity.id, entity);
    for (const id of removed) target.delete(id);
  }

  private mergePlayersLane(updates: PlayerLaneEntity[], removed: number[]): void {
    for (const entity of updates) {
      this.players.set(entity.id, entity);
    }
    for (const id of removed) this.players.delete(id);
  }

  private capturePrevTransforms(): void {
    this.prevTransforms.clear();
    const capture = (id: number, x: number, y: number) => {
      this.prevTransforms.set(id, { x, y });
    };

    for (const p of this.players.values()) capture(p.id, p.transform.pos.x, p.transform.pos.y);
    for (const e of this.enemies.values()) capture(e.id, e.transform.pos.x, e.transform.pos.y);
    for (const p of this.projectiles.values()) capture(p.id, p.transform.pos.x, p.transform.pos.y);
    for (const p of this.pickups.values()) capture(p.id, p.transform.pos.x, p.transform.pos.y);
    for (const e of this.effects.values()) capture(e.id, e.transform.pos.x, e.transform.pos.y);
  }

  private toWorldSnapshot(): SnapshotData {
    const entities: SnapshotEntity[] = [];

    for (const p of this.players.values()) {
      const isLocal = this.localPlayerId !== null && p.player.playerId === this.localPlayerId;
      const hasPrev = this.prevTransforms.has(p.id);
      const includeTransform = !isLocal || !hasPrev;

      const components: Record<string, unknown> = {
        [HEALTH]: p.health,
        [RENDERABLE]: toRenderable(p.renderable),
        [PLAYER]: p.player,
        [INPUT]: { moveX: 0, moveY: 0, dash: false, ability: false },
      };
      if (includeTransform) {
        components[TRANSFORM] = withPrevPos(p.id, p.transform, this.prevTransforms);
        components[VELOCITY] = p.velocity;
      }

      entities.push({ id: p.id, components });
    }

    for (const e of this.enemies.values()) {
      entities.push({
        id: e.id,
        components: {
          [TRANSFORM]: withPrevPos(e.id, e.transform, this.prevTransforms),
          [VELOCITY]: e.velocity,
          [HEALTH]: e.health,
          [RENDERABLE]: toRenderable(e.renderable),
          [ENEMY]: e.enemy,
        },
      });
    }

    for (const p of this.projectiles.values()) {
      entities.push({
        id: p.id,
        components: {
          [TRANSFORM]: withPrevPos(p.id, p.transform, this.prevTransforms),
          [VELOCITY]: p.velocity,
          [RENDERABLE]: toRenderable(p.renderable),
          [PROJECTILE]: p.projectile,
        },
      });
    }

    for (const p of this.pickups.values()) {
      const components: Record<string, unknown> = {
        [TRANSFORM]: withPrevPos(p.id, p.transform, this.prevTransforms),
        [PICKUP]: p.pickup,
      };
      if (p.renderable) components[RENDERABLE] = toRenderable(p.renderable);
      entities.push({ id: p.id, components });
    }

    for (const fx of this.effects.values()) {
      const components: Record<string, unknown> = {
        [TRANSFORM]: withPrevPos(fx.id, fx.transform, this.prevTransforms),
      };
      if (fx.renderable) components[RENDERABLE] = toRenderable(fx.renderable);
      if (fx.sweepAttack) components[SWEEP_ATTACK] = fx.sweepAttack;
      if (fx.novaAttack) components[NOVA_ATTACK] = fx.novaAttack;
      if (fx.orbital) components[ORBITAL] = fx.orbital;
      if (fx.groundZone) components[GROUND_ZONE] = fx.groundZone;
      if (fx.runeCharge) components[RUNE_CHARGE] = fx.runeCharge;
      if (fx.reviveZone) components[REVIVE_ZONE] = fx.reviveZone;
      if (fx.spiralProjectile) components[SPIRAL_PROJECTILE] = fx.spiralProjectile;
      if (fx.input) components[INPUT] = fx.input;
      entities.push({ id: fx.id, components });
    }

    for (const w of this.weapons.values()) {
      entities.push({
        id: w.id,
        components: {
          [WEAPON]: w.weapon,
          [WEAPON_OWNER]: w.owner,
        },
      });
    }

    return { entities };
  }
}

function withPrevPos(
  id: number,
  transform: { pos: { x: number; y: number }; prevPos: { x: number; y: number }; rotation: number },
  prev: Map<number, { x: number; y: number }>,
): { pos: { x: number; y: number }; prevPos: { x: number; y: number }; rotation: number } {
  const p = prev.get(id);
  if (!p) {
    return {
      pos: { x: transform.pos.x, y: transform.pos.y },
      prevPos: { x: transform.pos.x, y: transform.pos.y },
      rotation: transform.rotation,
    };
  }

  return {
    pos: { x: transform.pos.x, y: transform.pos.y },
    prevPos: { x: p.x, y: p.y },
    rotation: transform.rotation,
  };
}

function toRenderable(r: NetRenderable): {
  shape: 'circle' | 'diamond' | 'triangle' | 'square' | 'ring';
  radius: number;
  color: string;
  glowColor: string;
  glowSize: number;
  alpha: number;
  zIndex: number;
  rotationSpeed?: number;
} {
  return {
    shape: r.shape,
    radius: r.radius,
    color: r.color,
    glowColor: r.glowColor ?? r.color,
    glowSize: r.glowSize ?? 6,
    alpha: r.alpha,
    zIndex: r.zIndex,
    rotationSpeed: r.rotationSpeed,
  };
}
