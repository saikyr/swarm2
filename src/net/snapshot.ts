import type { World } from '../ecs/ecs';
import {
  TRANSFORM, VELOCITY, HEALTH, RENDERABLE, PLAYER, ENEMY, WEAPON, WEAPON_OWNER,
  COLLIDER, PROJECTILE, TRAIL, INPUT, PICKUP, SWEEP_ATTACK, NOVA_ATTACK,
  ORBITAL, BEAM_ATTACK, BOOMERANG, GROUND_ZONE, LIFETIME, RUNE_CHARGE, PARTICLE, DAMAGE_NUMBER, REVIVE_ZONE, SPIRAL_PROJECTILE,
  type Transform, type Velocity, type Health, type Renderable, type Player,
} from '../components';

export interface SnapshotData {
  entities: SnapshotEntity[];
}

export interface SnapshotEntity {
  id: number;
  components: Record<string, any>;
}

const SNAPSHOT_COMPONENTS = [
  TRANSFORM, VELOCITY, HEALTH, RENDERABLE, PLAYER, ENEMY,
  COLLIDER, PROJECTILE, TRAIL, INPUT, PICKUP,
  SWEEP_ATTACK, NOVA_ATTACK, ORBITAL, BEAM_ATTACK, BOOMERANG, GROUND_ZONE,
  LIFETIME, RUNE_CHARGE, REVIVE_ZONE, SPIRAL_PROJECTILE,
  WEAPON, WEAPON_OWNER,
];

export class SnapshotManager {
  private world: World;

  constructor(world: World) {
    this.world = world;
  }

  createSnapshot(): SnapshotData {
    const entities: SnapshotEntity[] = [];
    // Get all entities that have at least a TRANSFORM (renderable game objects)
    const allEntities = this.world.query(TRANSFORM);

    for (const entity of allEntities) {
      const components: Record<string, any> = {};

      for (const compName of SNAPSHOT_COMPONENTS) {
        const comp = this.world.getComponent(entity, compName);
        if (comp !== undefined) {
          components[compName] = this.serializeComponent(compName, comp);
        }
      }

      entities.push({ id: entity, components });
    }

    // Also include non-transform entities (weapons)
    for (const entity of this.world.query(WEAPON)) {
      if (this.world.hasComponent(entity, TRANSFORM)) continue;
      const components: Record<string, any> = {};
      const weapon = this.world.getComponent(entity, WEAPON);
      if (weapon) components[WEAPON] = this.serializeComponent(WEAPON, weapon);
      const wo = this.world.getComponent(entity, WEAPON_OWNER);
      if (wo) components[WEAPON_OWNER] = this.serializeComponent(WEAPON_OWNER, wo);
      entities.push({ id: entity, components });
    }

    return { entities };
  }

  applySnapshot(snapshot: SnapshotData): void {
    const existingEntities = new Set<number>();

    // Track which entities are in the snapshot
    const snapshotEntityIds = new Set(snapshot.entities.map(e => e.id));

    // Update or create entities from snapshot
    for (const se of snapshot.entities) {
      existingEntities.add(se.id);

      // Ensure entity exists
      if (!this.world.hasEntity(se.id)) {
        this.world.createEntityWithId(se.id);
      }

      // Apply each component
      for (const [compName, data] of Object.entries(se.components)) {
        const deserialized = this.deserializeComponent(compName, data);
        this.world.addComponent(se.id, compName, deserialized);
      }
    }

    // Remove entities not in snapshot (except local-only entities like particles)
    for (const entity of this.world.query(TRANSFORM)) {
      if (!snapshotEntityIds.has(entity)) {
        // Don't destroy local-only particle/damage-number entities
        if (this.world.hasComponent(entity, PARTICLE)) continue;
        if (this.world.hasComponent(entity, DAMAGE_NUMBER)) continue;
        this.world.destroyEntity(entity);
      }
    }
  }

  private serializeComponent(name: string, data: any): any {
    // Handle Set serialization (hitEntities in Projectile, SweepAttack, etc.)
    if (data && typeof data === 'object') {
      const result: any = {};
      for (const [key, value] of Object.entries(data)) {
        if (value instanceof Set) {
          result[key] = [...value];
        } else if (key === 'positions' && Array.isArray(value)) {
          // Trail positions - shallow copy
          result[key] = value.map((p: any) => ({ x: p.x, y: p.y }));
        } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
          result[key] = { ...value };
        } else {
          result[key] = value;
        }
      }
      return result;
    }
    return data;
  }

  private deserializeComponent(name: string, data: any): any {
    if (data && typeof data === 'object') {
      const result: any = { ...data };
      // Restore Sets from arrays
      if ('hitEntities' in result && Array.isArray(result.hitEntities)) {
        result.hitEntities = new Set(result.hitEntities);
      }
      // Restore pos/prevPos as mutable
      if ('pos' in result && result.pos) {
        result.pos = { ...result.pos };
      }
      if ('prevPos' in result && result.prevPos) {
        result.prevPos = { ...result.prevPos };
      }
      return result;
    }
    return data;
  }
}
