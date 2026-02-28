import { TargetingType, AttackPattern } from '../constants';
import type { Renderable } from '../components';

export interface WeaponLevelScaling {
  damageMultiplier: number;    // multiply damage by this per level
  cooldownMultiplier: number;  // multiply cooldown by this per level
  bonusCountAtLevels?: number[]; // levels at which count increases by 1
}

export interface WeaponDef {
  id: string;
  name: string;
  targeting: TargetingType;
  pattern: AttackPattern;
  tags: string[];
  base: {
    damage: number;
    cooldown: number;
    range: number;
    projectileSpeed: number;
    projectileLifetime: number;
    projectileRadius: number;
    projectileColor: string;
    projectileShape?: Renderable['shape'];
    count: number;
    spread: number;
    piercing: number;
  };
  levelScaling: WeaponLevelScaling;
}

export const WEAPON_DEFS: Record<string, WeaponDef> = {
  // === WARRIOR WEAPONS ===
  warrior_cleave: {
    id: 'warrior_cleave',
    name: 'Cleave',
    targeting: TargetingType.Closest,
    pattern: AttackPattern.Sweep,
    tags: ['melee', 'area'],
    base: {
      damage: 22,
      cooldown: 0.7,
      range: 70,
      projectileSpeed: 0,
      projectileLifetime: 0,
      projectileRadius: 0,
      projectileColor: '#e0f0ff',
      count: 1,
      spread: 2.0,
      piercing: 0,
    },
    levelScaling: {
      damageMultiplier: 1.12,
      cooldownMultiplier: 0.97,
      bonusCountAtLevels: [5, 10, 15],
    },
  },
  warrior_axes: {
    id: 'warrior_axes',
    name: 'Throwing Axes',
    targeting: TargetingType.Closest,
    pattern: AttackPattern.Boomerang,
    tags: ['projectile', 'ranged'],
    base: {
      damage: 18,
      cooldown: 1.4,
      range: 250,
      projectileSpeed: 300,
      projectileLifetime: 1.2,
      projectileRadius: 7,
      projectileColor: '#ffd966',
      projectileShape: 'diamond',
      count: 1,
      spread: 0,
      piercing: 999,
    },
    levelScaling: {
      damageMultiplier: 1.1,
      cooldownMultiplier: 0.97,
      bonusCountAtLevels: [4, 8, 14],
    },
  },
  warrior_banner: {
    id: 'warrior_banner',
    name: 'War Banner',
    targeting: TargetingType.Closest,
    pattern: AttackPattern.GroundZone,
    tags: ['area', 'zone'],
    base: {
      damage: 12,
      cooldown: 3.0,
      range: 180,
      projectileSpeed: 0,
      projectileLifetime: 4.0,
      projectileRadius: 60,
      projectileColor: '#ff6633',
      count: 1,
      spread: 0,
      piercing: 0,
    },
    levelScaling: {
      damageMultiplier: 1.12,
      cooldownMultiplier: 0.96,
    },
  },
  warrior_flail: {
    id: 'warrior_flail',
    name: 'Iron Flail',
    targeting: TargetingType.Aoe,
    pattern: AttackPattern.Spread,
    tags: ['projectile', 'area'],
    base: {
      damage: 35,
      cooldown: 2.5,
      range: 200,
      projectileSpeed: 200,
      projectileLifetime: 0.35,
      projectileRadius: 8,
      projectileColor: '#88aacc',
      projectileShape: 'square',
      count: 8,
      spread: Math.PI * 2,
      piercing: 2,
    },
    levelScaling: {
      damageMultiplier: 1.15,
      cooldownMultiplier: 0.96,
      bonusCountAtLevels: [6, 12],
    },
  },

  // === CASTER WEAPONS ===
  caster_bolt: {
    id: 'caster_bolt',
    name: 'Arcane Bolt',
    targeting: TargetingType.Closest,
    pattern: AttackPattern.SingleProjectile,
    tags: ['projectile', 'ranged', 'magic'],
    base: {
      damage: 18,
      cooldown: 0.4,
      range: 300,
      projectileSpeed: 400,
      projectileLifetime: 1.0,
      projectileRadius: 5,
      projectileColor: '#aa44ff',
      projectileShape: 'triangle',
      count: 1,
      spread: 0.3,
      piercing: 0,
    },
    levelScaling: {
      damageMultiplier: 1.12,
      cooldownMultiplier: 0.97,
      bonusCountAtLevels: [5, 10, 16],
    },
  },
  caster_chain: {
    id: 'caster_chain',
    name: 'Chain Lightning',
    targeting: TargetingType.Random,
    pattern: AttackPattern.Chain,
    tags: ['chain', 'magic'],
    base: {
      damage: 18,
      cooldown: 1.6,
      range: 250,
      projectileSpeed: 0,
      projectileLifetime: 0,
      projectileRadius: 4,
      projectileColor: '#ffff44',
      count: 1,
      spread: 0,
      piercing: 0,
    },
    levelScaling: {
      damageMultiplier: 1.1,
      cooldownMultiplier: 0.97,
      bonusCountAtLevels: [6, 12],
    },
  },
  caster_frostorbs: {
    id: 'caster_frostorbs',
    name: 'Frost Orbs',
    targeting: TargetingType.Orbital,
    pattern: AttackPattern.Orbital,
    tags: ['orbital', 'magic'],
    base: {
      damage: 15,
      cooldown: 0,
      range: 85,
      projectileSpeed: 3.5,
      projectileLifetime: 0,
      projectileRadius: 9,
      projectileColor: '#88eeff',
      count: 3,
      spread: 0,
      piercing: 999,
    },
    levelScaling: {
      damageMultiplier: 1.12,
      cooldownMultiplier: 1,
      bonusCountAtLevels: [6, 12],
    },
  },
  caster_runes: {
    id: 'caster_runes',
    name: 'Runic Barrage',
    targeting: TargetingType.Random,
    pattern: AttackPattern.RunicBarrage,
    tags: ['area', 'magic'],
    base: {
      damage: 40,
      cooldown: 3.5,
      range: 200,
      projectileSpeed: 0,
      projectileLifetime: 0,
      projectileRadius: 50,
      projectileColor: '#ff44aa',
      count: 5,
      spread: 0,
      piercing: 0,
    },
    levelScaling: {
      damageMultiplier: 1.15,
      cooldownMultiplier: 0.96,
      bonusCountAtLevels: [6, 12],
    },
  },
};

// Apply level scaling to weapon stats
export function applyLevelScaling(weapon: { damage: number; cooldown: number; count: number; level: number }, def: WeaponDef): void {
  weapon.damage = def.base.damage * Math.pow(def.levelScaling.damageMultiplier, weapon.level - 1);
  weapon.cooldown = def.base.cooldown * Math.pow(def.levelScaling.cooldownMultiplier, weapon.level - 1);
  weapon.count = def.base.count;
  if (def.levelScaling.bonusCountAtLevels) {
    for (const lvl of def.levelScaling.bonusCountAtLevels) {
      if (weapon.level >= lvl) weapon.count++;
    }
  }
}
