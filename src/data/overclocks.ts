import type { Weapon } from '../components';

export interface OverclockDef {
  id: string;
  name: string;
  description: string;
  tier: 'balanced' | 'unstable';
  tags: string[]; // weapon tags this applies to, or specific weapon IDs
  apply: (weapon: Weapon) => void;
  runtimeTag?: string; // systems check for special behavior
}

export const OVERCLOCK_DEFS: OverclockDef[] = [
  // === BALANCED (level 6/12) ===
  {
    id: 'razor_edge',
    name: 'Razor Edge',
    description: '+40% damage, -20% arc width',
    tier: 'balanced',
    tags: ['melee'],
    apply: (w) => { w.damage *= 1.4; w.spread *= 0.8; },
  },
  {
    id: 'rapid_fire',
    name: 'Rapid Fire',
    description: '+30% attack speed, -15% damage',
    tier: 'balanced',
    tags: ['projectile'],
    apply: (w) => { w.cooldown *= 0.7; w.damage *= 0.85; },
  },
  {
    id: 'extended_orbit',
    name: 'Extended Orbit',
    description: '+50% orbit radius, +1 orb count',
    tier: 'balanced',
    tags: ['orbital'],
    apply: (w) => { w.range *= 1.5; w.count += 1; },
  },
  {
    id: 'frost_shatter',
    name: 'Frost Shatter',
    description: '+25% damage, +30% range',
    tier: 'balanced',
    tags: ['caster_frostorbs'],
    apply: (w) => { w.damage *= 1.25; w.range *= 1.3; },
    runtimeTag: 'frost_shatter',
  },
  {
    id: 'heavy_projectiles',
    name: 'Heavy Projectiles',
    description: '+50% damage, -30% projectile speed',
    tier: 'balanced',
    tags: ['projectile'],
    apply: (w) => { w.damage *= 1.5; w.projectileSpeed *= 0.7; },
  },
  {
    id: 'scatter_shot',
    name: 'Scatter Shot',
    description: '+3 projectiles, -20% damage, +40% spread',
    tier: 'balanced',
    tags: ['projectile', 'ranged'],
    apply: (w) => { w.count += 3; w.damage *= 0.8; w.spread *= 1.4; },
  },
  {
    id: 'chain_mastery',
    name: 'Chain Mastery',
    description: '+2 chain bounces, +15% damage per chain',
    tier: 'balanced',
    tags: ['chain'],
    apply: (w) => { w.count += 2; w.damage *= 1.15; },
  },
  {
    id: 'shield_bash',
    name: 'Shield Bash',
    description: '+60% orbital damage, -1 orbit count',
    tier: 'balanced',
    tags: ['orbital'],
    apply: (w) => { w.damage *= 1.6; w.count = Math.max(1, w.count - 1); },
  },
  {
    id: 'wide_sweep',
    name: 'Wide Sweep',
    description: '+60% arc width, +20% range, -10% damage',
    tier: 'balanced',
    tags: ['melee'],
    apply: (w) => { w.spread *= 1.6; w.range *= 1.2; w.damage *= 0.9; },
  },
  {
    id: 'piercing_bolts',
    name: 'Piercing Bolts',
    description: '+2 piercing, +20% lifetime, -10% speed',
    tier: 'balanced',
    tags: ['magic', 'projectile'],
    apply: (w) => { w.piercing += 2; w.projectileLifetime *= 1.2; w.projectileSpeed *= 0.9; },
  },

  // === UNSTABLE (level 18 only) ===
  {
    id: 'volcanic_strike',
    name: 'Volcanic Strike',
    description: '+200% damage, -50% attack speed. Devastating blows.',
    tier: 'unstable',
    tags: ['warrior_cleave'],
    apply: (w) => { w.damage *= 3; w.cooldown *= 2; },
    runtimeTag: 'volcanic_strike',
  },
  {
    id: 'singularity',
    name: 'Singularity',
    description: '+300% radius, +200% damage, 3x cooldown. Massive nova.',
    tier: 'unstable',
    tags: ['area'],
    apply: (w) => { w.range *= 4; w.damage *= 3; w.cooldown *= 3; },
    runtimeTag: 'singularity',
  },
  {
    id: 'ricochet_storm',
    name: 'Ricochet Storm',
    description: '+5 piercing, +100% lifetime, -40% damage. Endless bouncing.',
    tier: 'unstable',
    tags: ['projectile'],
    apply: (w) => { w.piercing += 5; w.projectileLifetime *= 2; w.damage *= 0.6; },
    runtimeTag: 'ricochet_storm',
  },
  {
    id: 'lightning_god',
    name: 'Lightning God',
    description: 'Chains to 8 enemies, +200% damage, 3x slower firing.',
    tier: 'unstable',
    tags: ['caster_chain'],
    apply: (w) => { w.count = 8; w.damage *= 3; w.cooldown *= 3; },
    runtimeTag: 'lightning_god',
  },
  {
    id: 'orbital_storm',
    name: 'Orbital Storm',
    description: '+5 orbitals, +80% speed, -50% damage. A whirlwind of projectiles.',
    tier: 'unstable',
    tags: ['orbital'],
    apply: (w) => { w.count += 5; w.projectileSpeed *= 1.8; w.damage *= 0.5; },
    runtimeTag: 'orbital_storm',
  },
  {
    id: 'berserker_fury',
    name: 'Berserker Fury',
    description: '+150% damage, +50% attack speed, range halved. Get close.',
    tier: 'unstable',
    tags: ['melee'],
    apply: (w) => { w.damage *= 2.5; w.cooldown *= 0.5; w.range *= 0.5; },
    runtimeTag: 'berserker_fury',
  },

  // === NEW WARRIOR WEAPON OVERCLOCKS ===

  // Earthquake Stomp
  {
    id: 'tremor',
    name: 'Tremor',
    description: '+30% range, +25% damage',
    tier: 'balanced',
    tags: ['warrior_stomp'],
    apply: (w) => { w.range *= 1.3; w.damage *= 1.25; },
  },
  {
    id: 'aftershock',
    name: 'Aftershock',
    description: '+2 shockwave count',
    tier: 'balanced',
    tags: ['warrior_stomp'],
    apply: (w) => { w.count += 2; },
  },
  {
    id: 'seismic_slam',
    name: 'Seismic Slam',
    description: '+200% damage, +80% range, 4x cooldown. Devastating quake.',
    tier: 'unstable',
    tags: ['warrior_stomp'],
    apply: (w) => { w.damage *= 3; w.range *= 1.8; w.cooldown *= 4; },
    runtimeTag: 'seismic_slam',
  },

  // Javelin Throw
  {
    id: 'long_shaft',
    name: 'Long Shaft',
    description: '+40% range, +25% speed',
    tier: 'balanced',
    tags: ['warrior_javelin'],
    apply: (w) => { w.range *= 1.4; w.projectileSpeed *= 1.25; },
  },
  {
    id: 'barbed_tips',
    name: 'Barbed Tips',
    description: '+3 piercing, +20% damage',
    tier: 'balanced',
    tags: ['warrior_javelin'],
    apply: (w) => { w.piercing += 3; w.damage *= 1.2; },
  },
  {
    id: 'impaler',
    name: 'Impaler',
    description: '+300% damage, piercing set to 1. One devastating strike.',
    tier: 'unstable',
    tags: ['warrior_javelin'],
    apply: (w) => { w.damage *= 4; w.piercing = 1; },
    runtimeTag: 'impaler',
  },

  // Spike Trap
  {
    id: 'wider_spikes',
    name: 'Wider Spikes',
    description: '+40% radius, +30% lifetime',
    tier: 'balanced',
    tags: ['warrior_trap'],
    apply: (w) => { w.projectileRadius *= 1.4; w.projectileLifetime *= 1.3; },
  },
  {
    id: 'poison_tips',
    name: 'Poison Tips',
    description: '+50% damage, +20% lifetime',
    tier: 'balanced',
    tags: ['warrior_trap'],
    apply: (w) => { w.damage *= 1.5; w.projectileLifetime *= 1.2; },
  },
  {
    id: 'minefield',
    name: 'Minefield',
    description: '+4 count, -50% radius, -40% cooldown. Spam tiny traps.',
    tier: 'unstable',
    tags: ['warrior_trap'],
    apply: (w) => { w.count += 4; w.projectileRadius *= 0.5; w.cooldown *= 0.6; },
    runtimeTag: 'minefield',
  },

  // Spiral Blades
  {
    id: 'tight_spiral',
    name: 'Tight Spiral',
    description: '-40% expand speed, +3 piercing, +30% lifetime',
    tier: 'balanced',
    tags: ['warrior_spiral'],
    apply: (w) => { w.projectileSpeed *= 0.6; w.piercing += 3; w.projectileLifetime *= 1.3; },
  },
  {
    id: 'blade_storm',
    name: 'Blade Storm',
    description: '+3 blades',
    tier: 'balanced',
    tags: ['warrior_spiral'],
    apply: (w) => { w.count += 3; },
  },
  {
    id: 'sawmill',
    name: 'Sawmill',
    description: '+200% damage, blades don\'t expand. Melee blender.',
    tier: 'unstable',
    tags: ['warrior_spiral'],
    apply: (w) => { w.damage *= 3; w.projectileSpeed = 0; },
    runtimeTag: 'sawmill',
  },

  // === NEW CASTER WEAPON OVERCLOCKS ===

  // Siphon Beam
  {
    id: 'focused_lens',
    name: 'Focused Lens',
    description: '+60% damage, -30% range',
    tier: 'balanced',
    tags: ['caster_beam'],
    apply: (w) => { w.damage *= 1.6; w.range *= 0.7; },
  },
  {
    id: 'wide_beam',
    name: 'Wide Beam',
    description: '+1 target count',
    tier: 'balanced',
    tags: ['caster_beam'],
    apply: (w) => { w.count += 1; },
  },
  {
    id: 'death_ray',
    name: 'Death Ray',
    description: '+300% damage, -50% range, 2x cooldown. Devastating close beam.',
    tier: 'unstable',
    tags: ['caster_beam'],
    apply: (w) => { w.damage *= 4; w.range *= 0.5; w.cooldown *= 2; },
    runtimeTag: 'death_ray',
  },

  // Frost Nova
  {
    id: 'permafrost',
    name: 'Permafrost',
    description: '+30% range, +25% damage',
    tier: 'balanced',
    tags: ['caster_frostnova'],
    apply: (w) => { w.range *= 1.3; w.damage *= 1.25; },
  },
  {
    id: 'flash_freeze',
    name: 'Flash Freeze',
    description: '-40% cooldown, -25% range',
    tier: 'balanced',
    tags: ['caster_frostnova'],
    apply: (w) => { w.cooldown *= 0.6; w.range *= 0.75; },
  },
  {
    id: 'absolute_zero',
    name: 'Absolute Zero',
    description: '+200% damage, +60% range, 5x cooldown. Frozen apocalypse.',
    tier: 'unstable',
    tags: ['caster_frostnova'],
    apply: (w) => { w.damage *= 3; w.range *= 1.6; w.cooldown *= 5; },
    runtimeTag: 'absolute_zero',
  },

  // Arcane Mines
  {
    id: 'cluster_mines',
    name: 'Cluster Mines',
    description: '+3 count, -30% blast radius',
    tier: 'balanced',
    tags: ['caster_mines'],
    apply: (w) => { w.count += 3; w.projectileRadius *= 0.7; },
  },
  {
    id: 'heavy_ordnance',
    name: 'Heavy Ordnance',
    description: '+50% damage, +25% blast radius',
    tier: 'balanced',
    tags: ['caster_mines'],
    apply: (w) => { w.damage *= 1.5; w.projectileRadius *= 1.25; },
  },
  {
    id: 'carpet_bomber',
    name: 'Carpet Bomber',
    description: '+8 count, -30% cooldown. Explosions everywhere.',
    tier: 'unstable',
    tags: ['caster_mines'],
    apply: (w) => { w.count += 8; w.cooldown *= 0.7; },
    runtimeTag: 'carpet_bomber',
  },

  // Void Vortex
  {
    id: 'event_horizon',
    name: 'Event Horizon',
    description: '+50% lifetime, +20% radius',
    tier: 'balanced',
    tags: ['caster_vortex'],
    apply: (w) => { w.projectileLifetime *= 1.5; w.projectileRadius *= 1.2; },
  },
  {
    id: 'dark_matter',
    name: 'Dark Matter',
    description: '+40% damage, +2 piercing, -2 count',
    tier: 'balanced',
    tags: ['caster_vortex'],
    apply: (w) => { w.damage *= 1.4; w.piercing += 2; w.count = Math.max(2, w.count - 2); },
  },
  {
    id: 'singularity_vortex',
    name: 'Singularity Vortex',
    description: '+5 projectiles, blades don\'t expand. Dense death zone.',
    tier: 'unstable',
    tags: ['caster_vortex'],
    apply: (w) => { w.count += 5; w.projectileSpeed = 0; },
    runtimeTag: 'singularity_vortex',
  },
];

// Find applicable overclocks for a weapon
export function getOverclocksForWeapon(weapon: Weapon, tier: 'balanced' | 'unstable'): OverclockDef[] {
  return OVERCLOCK_DEFS.filter(oc => {
    if (oc.tier !== tier) return false;
    // Check if any overclock tag matches weapon tags or weapon id
    return oc.tags.some(tag => weapon.tags.includes(tag) || weapon.id === tag);
  });
}
