import type { World } from '../ecs/ecs';
import {
  BOOMERANG,
  ENEMY,
  GROUND_ZONE,
  HEALTH,
  INPUT,
  LIFETIME,
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
  type BoomerangProjectile,
  type Enemy,
  type GroundZone,
  type Health,
  type InputState,
  type Lifetime,
  type NovaAttack,
  type OrbitalProjectile,
  type Pickup,
  type Player,
  type Projectile,
  type Renderable,
  type ReviveZone,
  type RuneCharge,
  type SpiralProjectile,
  type SweepAttack,
  type Transform,
  type Velocity,
  type Weapon,
  type WeaponOwner,
} from '../components';
import {
  type AckState,
  type EffectLaneEntity,
  type EnemyLaneEntity,
  emptyRemoved,
  type PickupLaneEntity,
  type PlayerLaneEntity,
  type ProjectileLaneEntity,
  type RunEventV2,
  type SnapshotV2,
  type WeaponLaneEntity,
  type NetRenderable,
} from './protocol';
import {
  buildViewerContext,
  filterEffectsForViewer,
  filterEnemiesForViewer,
  filterPickupsForViewer,
  filterProjectilesForViewer,
  filterWeaponsForViewer,
} from './relevancy';

interface BuildSnapshotOptions {
  serverTick: number;
  elapsedSec: number;
  viewerPlayerId: number;
  ack: AckState[];
  events: RunEventV2[];
}

export function createViewerSnapshotV2(world: World, options: BuildSnapshotOptions): SnapshotV2 {
  const players = collectPlayers(world, options.viewerPlayerId);
  const enemies = collectEnemies(world);
  const projectiles = collectProjectiles(world);
  const pickups = collectPickups(world);
  const weapons = collectWeapons(world);
  const effects = collectEffects(world);

  const viewer = buildViewerContext(players, options.viewerPlayerId);

  return {
    serverTick: options.serverTick,
    baselineTick: null,
    elapsedSec: options.elapsedSec,
    full: true,
    ack: options.ack,
    lanes: {
      players,
      enemies: filterEnemiesForViewer(enemies, viewer.viewerPos),
      projectiles: filterProjectilesForViewer(projectiles, viewer.viewerPos),
      pickups: filterPickupsForViewer(pickups, viewer.viewerPos),
      weapons: filterWeaponsForViewer(weapons, viewer.viewerEntityId),
      effects: filterEffectsForViewer(effects, viewer.viewerPos),
    },
    removed: emptyRemoved(),
    events: options.events,
  };
}

function collectPlayers(world: World, viewerPlayerId: number): PlayerLaneEntity[] {
  const out: PlayerLaneEntity[] = [];
  for (const entity of world.query(PLAYER, TRANSFORM, VELOCITY, HEALTH, RENDERABLE)) {
    const transform = world.getComponent<Transform>(entity, TRANSFORM);
    const velocity = world.getComponent<Velocity>(entity, VELOCITY);
    const health = world.getComponent<Health>(entity, HEALTH);
    const renderable = world.getComponent<Renderable>(entity, RENDERABLE);
    const player = world.getComponent<Player>(entity, PLAYER);
    if (!transform || !velocity || !health || !renderable || !player) continue;
    const isViewerLocal = player.playerId === viewerPlayerId;

    out.push({
      id: entity,
      transform: isViewerLocal ? quantizeTransformFine(transform) : quantizeTransform(transform),
      velocity: isViewerLocal ? quantizeVelocityFine(velocity) : quantizeVelocity(velocity),
      health: clonePlain(health),
      renderable: toNetRenderable(renderable),
      player: {
        playerId: player.playerId,
        classType: player.classType,
        speed: q(player.speed),
        speedMultiplier: q(player.speedMultiplier),
        level: player.level,
        xp: q(player.xp),
        xpToNext: q(player.xpToNext),
        kills: player.kills,
        downed: player.downed,
        damageDealt: q(player.damageDealt),
        dashCooldownTimer: q(player.dashCooldownTimer),
        isDashing: player.isDashing,
        damageMultiplier: q(player.damageMultiplier),
        pickupRadiusMultiplier: q(player.pickupRadiusMultiplier),
        chilledTimer: q(player.chilledTimer),
      },
    });
  }
  return out;
}

function collectEnemies(world: World): EnemyLaneEntity[] {
  const out: EnemyLaneEntity[] = [];
  for (const entity of world.query(ENEMY, TRANSFORM, VELOCITY, HEALTH, RENDERABLE)) {
    const transform = world.getComponent<Transform>(entity, TRANSFORM);
    const velocity = world.getComponent<Velocity>(entity, VELOCITY);
    const health = world.getComponent<Health>(entity, HEALTH);
    const renderable = world.getComponent<Renderable>(entity, RENDERABLE);
    const enemy = world.getComponent<Enemy>(entity, ENEMY);
    if (!transform || !velocity || !health || !renderable || !enemy) continue;

    out.push({
      id: entity,
      transform: quantizeTransform(transform),
      velocity: quantizeVelocity(velocity),
      health: clonePlain(health),
      renderable: toNetRenderable(renderable),
      enemy: {
        type: enemy.type,
        speed: q(enemy.speed),
        damage: q(enemy.damage),
        xpValue: q(enemy.xpValue),
        isElite: enemy.isElite,
        affixes: clonePlain(enemy.affixes),
        eliteName: enemy.eliteName,
        attackCooldown: q(enemy.attackCooldown),
        attackTimer: q(enemy.attackTimer),
        aiState: enemy.aiState,
        aiStateTimer: q(enemy.aiStateTimer),
        preferredRange: q(enemy.preferredRange),
      },
    });
  }
  return out;
}

function collectProjectiles(world: World): ProjectileLaneEntity[] {
  const out: ProjectileLaneEntity[] = [];
  for (const entity of world.query(PROJECTILE, TRANSFORM, VELOCITY, RENDERABLE)) {
    const transform = world.getComponent<Transform>(entity, TRANSFORM);
    const velocity = world.getComponent<Velocity>(entity, VELOCITY);
    const renderable = world.getComponent<Renderable>(entity, RENDERABLE);
    const projectile = world.getComponent<Projectile>(entity, PROJECTILE);
    if (!transform || !velocity || !renderable || !projectile) continue;

    out.push({
      id: entity,
      transform: quantizeTransform(transform),
      velocity: quantizeVelocity(velocity),
      renderable: toNetRenderable(renderable),
      projectile: {
        damage: q(projectile.damage),
        owner: projectile.owner,
        piercing: projectile.piercing,
        chainCount: projectile.chainCount,
        chainRange: projectile.chainRange,
      },
    });
  }
  return out;
}

function collectPickups(world: World): PickupLaneEntity[] {
  const out: PickupLaneEntity[] = [];
  for (const entity of world.query(PICKUP, TRANSFORM)) {
    const transform = world.getComponent<Transform>(entity, TRANSFORM);
    const pickup = world.getComponent<Pickup>(entity, PICKUP);
    if (!transform || !pickup) continue;
    const renderable = world.getComponent<Renderable>(entity, RENDERABLE);

    out.push({
      id: entity,
      transform: quantizeTransform(transform),
      renderable: renderable ? toNetRenderable(renderable) : null,
      pickup: clonePlain(pickup),
    });
  }
  return out;
}

function collectWeapons(world: World): WeaponLaneEntity[] {
  const out: WeaponLaneEntity[] = [];
  for (const entity of world.query(WEAPON, WEAPON_OWNER)) {
    const weapon = world.getComponent<Weapon>(entity, WEAPON);
    const owner = world.getComponent<WeaponOwner>(entity, WEAPON_OWNER);
    if (!weapon || !owner) continue;
    out.push({
      id: entity,
      weapon: {
        id: weapon.id,
        name: weapon.name,
        level: weapon.level,
        overclocks: [...weapon.overclocks],
        tags: [...weapon.tags],
        locked: weapon.locked,
        targeting: weapon.targeting,
        pattern: weapon.pattern,
        damage: q(weapon.damage),
        cooldown: q(weapon.cooldown),
        cooldownTimer: q(weapon.cooldownTimer),
        range: q(weapon.range),
        projectileSpeed: q(weapon.projectileSpeed),
        projectileLifetime: q(weapon.projectileLifetime),
        projectileRadius: q(weapon.projectileRadius),
        projectileColor: weapon.projectileColor,
        count: weapon.count,
        spread: q(weapon.spread),
        piercing: weapon.piercing,
      },
      owner: clonePlain(owner),
    });
  }
  return out;
}

function collectEffects(world: World): EffectLaneEntity[] {
  const out: EffectLaneEntity[] = [];

  const pushEntity = (entity: number) => {
    const transform = world.getComponent<Transform>(entity, TRANSFORM);
    if (!transform) return;
    const renderable = world.getComponent<Renderable>(entity, RENDERABLE);

    const sweep = world.getComponent<SweepAttack>(entity, SWEEP_ATTACK);
    const nova = world.getComponent<NovaAttack>(entity, NOVA_ATTACK);
    const orbital = world.getComponent<OrbitalProjectile>(entity, ORBITAL);
    const zone = world.getComponent<GroundZone>(entity, GROUND_ZONE);
    const rune = world.getComponent<RuneCharge>(entity, RUNE_CHARGE);
    const revive = world.getComponent<ReviveZone>(entity, REVIVE_ZONE);
    const spiral = world.getComponent<SpiralProjectile>(entity, SPIRAL_PROJECTILE);
    const input = world.getComponent<InputState>(entity, INPUT);
    const boomerang = world.getComponent<BoomerangProjectile>(entity, BOOMERANG);
    const lifetime = world.getComponent<Lifetime>(entity, LIFETIME);

    if (!sweep && !nova && !orbital && !zone && !rune && !revive && !spiral && !input && !boomerang && !lifetime) return;

    out.push({
      id: entity,
      transform: quantizeTransform(transform),
      renderable: renderable ? toNetRenderable(renderable) : null,
      sweepAttack: sweep ? clonePlain(sweep) : undefined,
      novaAttack: nova ? clonePlain(nova) : undefined,
      orbital: orbital ? clonePlain(orbital) : undefined,
      groundZone: zone ? clonePlain(zone) : undefined,
      runeCharge: rune ? clonePlain(rune) : undefined,
      reviveZone: revive ? clonePlain(revive) : undefined,
      spiralProjectile: spiral ? clonePlain(spiral) : undefined,
      input: input ? clonePlain(input) : undefined,
    });
  };

  for (const entity of world.query(SWEEP_ATTACK, TRANSFORM)) pushEntity(entity);
  for (const entity of world.query(NOVA_ATTACK, TRANSFORM)) pushEntity(entity);
  for (const entity of world.query(ORBITAL, TRANSFORM)) pushEntity(entity);
  for (const entity of world.query(GROUND_ZONE, TRANSFORM)) pushEntity(entity);
  for (const entity of world.query(RUNE_CHARGE, TRANSFORM)) pushEntity(entity);
  for (const entity of world.query(REVIVE_ZONE, TRANSFORM)) pushEntity(entity);
  for (const entity of world.query(SPIRAL_PROJECTILE, TRANSFORM)) pushEntity(entity);

  return dedupeById(out);
}

function dedupeById<T extends { id: number }>(input: T[]): T[] {
  const map = new Map<number, T>();
  for (const item of input) map.set(item.id, item);
  return [...map.values()];
}

function quantizeTransform(t: Transform): Transform {
  return {
    pos: {
      x: q(t.pos.x),
      y: q(t.pos.y),
    },
    prevPos: {
      x: q(t.prevPos.x),
      y: q(t.prevPos.y),
    },
    rotation: qa(t.rotation),
  };
}

function quantizeVelocity(v: Velocity): Velocity {
  return {
    x: q(v.x),
    y: q(v.y),
  };
}

function quantizeTransformFine(t: Transform): Transform {
  return {
    pos: {
      x: qf(t.pos.x),
      y: qf(t.pos.y),
    },
    prevPos: {
      x: qf(t.prevPos.x),
      y: qf(t.prevPos.y),
    },
    rotation: qa(t.rotation),
  };
}

function quantizeVelocityFine(v: Velocity): Velocity {
  return {
    x: qf(v.x),
    y: qf(v.y),
  };
}

function clonePlain<T>(value: T): T {
  if (value instanceof Set) {
    return [...value] as T;
  }
  if (Array.isArray(value)) {
    return value.map((v) => clonePlain(v)) as T;
  }
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = clonePlain(v);
    }
    return out as T;
  }
  return value;
}

function q(v: number): number {
  return Math.round(v * 10) / 10;
}

function qf(v: number): number {
  return Math.round(v * 100) / 100;
}

function qa(v: number): number {
  return Math.round(v * 100) / 100;
}

function toNetRenderable(r: Renderable): NetRenderable {
  return {
    shape: r.shape,
    radius: q(r.radius),
    color: r.color,
    alpha: q(r.alpha),
    zIndex: r.zIndex,
    glowColor: r.glowColor,
    glowSize: q(r.glowSize),
    rotationSpeed: r.rotationSpeed != null ? qa(r.rotationSpeed) : undefined,
  };
}
