import { TargetingType, AttackPattern } from '../constants';
import type { Renderable, Weapon } from '../components';
import { OVERCLOCK_DEFS } from './overclocks';

export interface WeaponLevelScaling {
  damageMultiplier: number;    // multiply damage by this per level
  cooldownMultiplier: number;  // multiply cooldown by this per level
  bonusCountAtLevels?: number[]; // levels at which count increases by 1
}

export interface WeaponDef {
  id: string;
  name: string;
  description: string;
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
    description: 'Wide melee sweep that hits all nearby enemies in an arc.',
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
    description: 'Boomerang axes that pierce through enemies and return.',
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
    description: 'Plants a damaging zone on the ground that burns enemies over time.',
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
    description: 'Unleashes a burst of projectiles in all directions.',
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
    description: 'Rapid-fire magic projectiles that target the nearest enemy.',
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
    description: 'Lightning bolt that jumps between nearby enemies.',
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
    description: 'Icy orbs that orbit around you, damaging anything they touch.',
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
    description: 'Rains explosive runes at random enemy locations.',
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
  // === NEW WARRIOR WEAPONS ===
  warrior_stomp: {
    id: 'warrior_stomp',
    name: 'Earthquake Stomp',
    description: 'Shockwave rings radiate from you, with aftershock stacking.',
    targeting: TargetingType.Aoe,
    pattern: AttackPattern.Nova,
    tags: ['melee', 'area'],
    base: {
      damage: 30,
      cooldown: 2.0,
      range: 140,
      projectileSpeed: 0,
      projectileLifetime: 0,
      projectileRadius: 0,
      projectileColor: '#ffaa44',
      count: 1,
      spread: 0,
      piercing: 0,
    },
    levelScaling: {
      damageMultiplier: 1.14,
      cooldownMultiplier: 0.96,
      bonusCountAtLevels: [6, 12],
    },
  },
  warrior_javelin: {
    id: 'warrior_javelin',
    name: 'Javelin Throw',
    description: 'High-pierce skill-shot hurled in your movement direction.',
    targeting: TargetingType.Directional,
    pattern: AttackPattern.SingleProjectile,
    tags: ['projectile', 'ranged'],
    base: {
      damage: 45,
      cooldown: 1.8,
      range: 350,
      projectileSpeed: 500,
      projectileLifetime: 1.0,
      projectileRadius: 6,
      projectileColor: '#ccddaa',
      projectileShape: 'triangle',
      count: 1,
      spread: 0,
      piercing: 5,
    },
    levelScaling: {
      damageMultiplier: 1.14,
      cooldownMultiplier: 0.96,
      bonusCountAtLevels: [8, 16],
    },
  },
  warrior_trap: {
    id: 'warrior_trap',
    name: 'Spike Trap',
    description: 'Drop spike traps behind you as you run.',
    targeting: TargetingType.Aoe,
    pattern: AttackPattern.GroundZone,
    tags: ['area', 'zone', 'trap'],
    base: {
      damage: 20,
      cooldown: 2.5,
      range: 9999,
      projectileSpeed: 0,
      projectileLifetime: 5.0,
      projectileRadius: 45,
      projectileColor: '#aa8866',
      count: 1,
      spread: 0,
      piercing: 0,
    },
    levelScaling: {
      damageMultiplier: 1.12,
      cooldownMultiplier: 0.96,
      bonusCountAtLevels: [6, 12],
    },
  },
  warrior_spiral: {
    id: 'warrior_spiral',
    name: 'Spiral Blades',
    description: 'Spinning blades spiral outward from you.',
    targeting: TargetingType.Aoe,
    pattern: AttackPattern.Spiral,
    tags: ['melee', 'area'],
    base: {
      damage: 25,
      cooldown: 3.0,
      range: 200,
      projectileSpeed: 80,
      projectileLifetime: 2.5,
      projectileRadius: 8,
      projectileColor: '#88ccff',
      projectileShape: 'diamond',
      count: 4,
      spread: 0,
      piercing: 999,
    },
    levelScaling: {
      damageMultiplier: 1.12,
      cooldownMultiplier: 0.96,
      bonusCountAtLevels: [6, 12],
    },
  },

  // === NEW CASTER WEAPONS ===
  caster_beam: {
    id: 'caster_beam',
    name: 'Siphon Beam',
    description: 'Sustained damage beam that ticks rapidly on the closest enemy.',
    targeting: TargetingType.Closest,
    pattern: AttackPattern.Beam,
    tags: ['magic', 'beam'],
    base: {
      damage: 10,
      cooldown: 0.25,
      range: 220,
      projectileSpeed: 0,
      projectileLifetime: 0,
      projectileRadius: 0,
      projectileColor: '#66ffaa',
      count: 1,
      spread: 0,
      piercing: 0,
    },
    levelScaling: {
      damageMultiplier: 1.12,
      cooldownMultiplier: 0.97,
      bonusCountAtLevels: [6, 12],
    },
  },
  caster_frostnova: {
    id: 'caster_frostnova',
    name: 'Frost Nova',
    description: 'Icy shockwave with crystal visuals radiates outward.',
    targeting: TargetingType.Aoe,
    pattern: AttackPattern.Nova,
    tags: ['magic', 'area'],
    base: {
      damage: 35,
      cooldown: 2.5,
      range: 160,
      projectileSpeed: 0,
      projectileLifetime: 0,
      projectileRadius: 0,
      projectileColor: '#aaeeff',
      count: 1,
      spread: 0,
      piercing: 0,
    },
    levelScaling: {
      damageMultiplier: 1.14,
      cooldownMultiplier: 0.96,
      bonusCountAtLevels: [6, 12],
    },
  },
  caster_mines: {
    id: 'caster_mines',
    name: 'Arcane Mines',
    description: 'Fewer, harder-hitting delayed explosions at random locations.',
    targeting: TargetingType.Random,
    pattern: AttackPattern.RunicBarrage,
    tags: ['area', 'magic'],
    base: {
      damage: 65,
      cooldown: 4.0,
      range: 220,
      projectileSpeed: 0,
      projectileLifetime: 0,
      projectileRadius: 65,
      projectileColor: '#ff66dd',
      count: 3,
      spread: 0,
      piercing: 0,
    },
    levelScaling: {
      damageMultiplier: 1.15,
      cooldownMultiplier: 0.96,
      bonusCountAtLevels: [6, 12],
    },
  },
  caster_vortex: {
    id: 'caster_vortex',
    name: 'Void Vortex',
    description: 'Dense slow purple spiral for area denial.',
    targeting: TargetingType.Aoe,
    pattern: AttackPattern.Spiral,
    tags: ['magic', 'area'],
    base: {
      damage: 18,
      cooldown: 3.5,
      range: 180,
      projectileSpeed: 50,
      projectileLifetime: 3.0,
      projectileRadius: 10,
      projectileColor: '#9944ff',
      count: 6,
      spread: 0,
      piercing: 999,
    },
    levelScaling: {
      damageMultiplier: 1.12,
      cooldownMultiplier: 0.96,
      bonusCountAtLevels: [6, 12],
    },
  },
};

// Apply level scaling to weapon stats, then re-apply any overclocks
export function applyLevelScaling(weapon: Weapon, def: WeaponDef): void {
  // Reset all stats from base (overclocks may have mutated them)
  weapon.damage = def.base.damage * Math.pow(def.levelScaling.damageMultiplier, weapon.level - 1);
  weapon.cooldown = def.base.cooldown * Math.pow(def.levelScaling.cooldownMultiplier, weapon.level - 1);
  weapon.count = def.base.count;
  weapon.range = def.base.range;
  weapon.spread = def.base.spread;
  weapon.piercing = def.base.piercing;
  weapon.projectileSpeed = def.base.projectileSpeed;
  weapon.projectileLifetime = def.base.projectileLifetime;
  weapon.projectileRadius = def.base.projectileRadius;

  if (def.levelScaling.bonusCountAtLevels) {
    for (const lvl of def.levelScaling.bonusCountAtLevels) {
      if (weapon.level >= lvl) weapon.count++;
    }
  }

  // Re-apply overclocks on top of fresh base stats
  for (const ocId of weapon.overclocks) {
    const oc = OVERCLOCK_DEFS.find(o => o.id === ocId);
    if (oc) oc.apply(weapon);
  }
}
