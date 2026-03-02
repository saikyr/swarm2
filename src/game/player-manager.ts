import type { World } from '../ecs/ecs';
import { CLASS_DEFS } from '../data/classes';
import { WEAPON_DEFS } from '../data/weapons';
import {
  TRANSFORM, VELOCITY, HEALTH, COLLIDER, RENDERABLE, PLAYER, INPUT, TRAIL, WEAPON, WEAPON_OWNER,
  type Transform, type Velocity, type Health, type Collider, type Renderable,
  type Player, type InputState, type Weapon, type WeaponOwner,
  CollisionLayer,
} from '../components';
import { PLAYER_HP, PLAYER_RADIUS, WORLD_WIDTH, WORLD_HEIGHT, type ClassType } from '../constants';
import type { MetaProgression } from './meta-progression';

export const WEAPON_UNLOCK_LEVELS = [1, 4, 8, 14];

export interface PlayerConfig {
  playerId: number;
  classType: ClassType;
}

export interface PlayerData {
  entity: number;
  weaponEntities: number[];
}

// Colors per player slot for differentiation
const PLAYER_SLOT_COLORS: string[] = [
  '', // slot 0 uses class color
  '#ff6699',
  '#66ff66',
  '#ffaa33',
];

/** Spawn positions staggered around world center */
function getSpawnPosition(playerId: number, total: number): { x: number; y: number } {
  if (total <= 1) {
    return { x: WORLD_WIDTH / 2, y: WORLD_HEIGHT / 2 };
  }
  const angle = (Math.PI * 2 * playerId) / total;
  const offset = 60;
  return {
    x: WORLD_WIDTH / 2 + Math.cos(angle) * offset,
    y: WORLD_HEIGHT / 2 + Math.sin(angle) * offset,
  };
}

export function spawnPlayers(
  world: World,
  configs: PlayerConfig[],
  meta: MetaProgression,
): Map<number, PlayerData> {
  const result = new Map<number, PlayerData>();

  for (const config of configs) {
    const classDef = CLASS_DEFS[config.classType];
    const spawn = getSpawnPosition(config.playerId, configs.length);

    const entity = world.createEntity();

    world.addComponent<Transform>(entity, TRANSFORM, {
      pos: { x: spawn.x, y: spawn.y },
      prevPos: { x: spawn.x, y: spawn.y },
      rotation: 0,
    });
    world.addComponent<Velocity>(entity, VELOCITY, { x: 0, y: 0 });
    world.addComponent<Health>(entity, HEALTH, {
      current: PLAYER_HP + meta.permanentBuffs.maxHp,
      max: PLAYER_HP + meta.permanentBuffs.maxHp,
      iframes: 0, lastHitBy: 0,
    });
    world.addComponent<Collider>(entity, COLLIDER, {
      radius: PLAYER_RADIUS,
      layer: CollisionLayer.Player,
      mask: [CollisionLayer.Enemy, CollisionLayer.Pickup],
    });

    // Use slot color for non-host players, class color for host
    const color = config.playerId > 0 && PLAYER_SLOT_COLORS[config.playerId]
      ? PLAYER_SLOT_COLORS[config.playerId]
      : classDef.color;
    const glowColor = config.playerId > 0 && PLAYER_SLOT_COLORS[config.playerId]
      ? PLAYER_SLOT_COLORS[config.playerId]
      : classDef.glowColor;

    world.addComponent<Renderable>(entity, RENDERABLE, {
      shape: classDef.shape,
      radius: PLAYER_RADIUS,
      color,
      glowColor,
      glowSize: 15,
      alpha: 1,
      zIndex: 10,
    });
    world.addComponent<Player>(entity, PLAYER, {
      ...classDef.player,
      playerId: config.playerId,
      kills: 0,
      downed: false,
      level: 1,
      xp: 0,
      xpToNext: 10,
      damageMultiplier: 1 + meta.permanentBuffs.damage,
      speedMultiplier: 1 + meta.permanentBuffs.speed,
      pickupRadiusMultiplier: 1 + meta.permanentBuffs.pickupRadius,
    });
    world.addComponent<InputState>(entity, INPUT, {
      moveX: 0, moveY: 0, dash: false, ability: false,
    });
    world.addComponent(entity, TRAIL, {
      positions: [],
      maxLength: 12,
      width: PLAYER_RADIUS * 0.6,
      color,
    });

    // Spawn weapon entities
    const weaponEntities: number[] = [];
    for (let i = 0; i < classDef.weapons.length; i++) {
      const weaponId = classDef.weapons[i];
      const def = WEAPON_DEFS[weaponId];
      if (!def) continue;

      const we = world.createEntity();
      weaponEntities.push(we);

      const locked = i > 0; // Only the first weapon (slot 0) starts unlocked

      world.addComponent<Weapon>(we, WEAPON, {
        id: def.id,
        name: def.name,
        level: 1,
        overclocks: [],
        tags: [...def.tags],
        target: null,
        locked,
        targeting: def.targeting,
        pattern: def.pattern,
        damage: def.base.damage,
        cooldown: def.base.cooldown,
        cooldownTimer: 0,
        range: def.base.range,
        projectileSpeed: def.base.projectileSpeed,
        projectileLifetime: def.base.projectileLifetime,
        projectileRadius: def.base.projectileRadius,
        projectileColor: def.base.projectileColor,
        count: def.base.count,
        spread: def.base.spread,
        piercing: def.base.piercing,
      });
      world.addComponent<WeaponOwner>(we, WEAPON_OWNER, {
        owner: entity,
        slotIndex: i,
      });
    }

    result.set(config.playerId, { entity, weaponEntities });
  }

  return result;
}
