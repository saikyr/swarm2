import type { World } from '../ecs/ecs';
import type { UpgradeCard } from '../rendering/ui';
import { PLAYER, WEAPON, WEAPON_OWNER, HEALTH } from '../components';
import type { Player, Weapon, WeaponOwner, Health } from '../components';
import { RARITY_WEIGHTS, type Rarity } from '../constants';
import { WEAPON_DEFS, applyLevelScaling, type WeaponDef } from './weapons';
import { getOverclocksForWeapon } from './overclocks';

interface UpgradeDef {
  id: string;
  name: string;
  description: string;
  rarity: Rarity;
  apply: (world: World, playerEntity?: number) => void;
}

function modPlayerWeapons(world: World, playerEntity: number | undefined, fn: (w: Weapon) => void): void {
  for (const e of world.query(WEAPON, WEAPON_OWNER)) {
    const wo = world.getComponent<WeaponOwner>(e, WEAPON_OWNER);
    if (playerEntity !== undefined && wo && wo.owner !== playerEntity) continue;
    const w = world.getComponent<Weapon>(e, WEAPON);
    if (w && !w.locked) fn(w);
  }
}

function modTaggedPlayerWeapons(world: World, playerEntity: number | undefined, tag: string, fn: (w: Weapon) => void): void {
  for (const e of world.query(WEAPON, WEAPON_OWNER)) {
    const wo = world.getComponent<WeaponOwner>(e, WEAPON_OWNER);
    if (playerEntity !== undefined && wo && wo.owner !== playerEntity) continue;
    const w = world.getComponent<Weapon>(e, WEAPON);
    if (w && !w.locked && w.tags.includes(tag)) fn(w);
  }
}

function modSpecificPlayer(world: World, playerEntity: number | undefined, fn: (p: Player) => void): void {
  if (playerEntity !== undefined) {
    const p = world.getComponent<Player>(playerEntity, PLAYER);
    if (p) fn(p);
  } else {
    for (const e of world.query(PLAYER)) {
      const p = world.getComponent<Player>(e, PLAYER);
      if (p) fn(p);
    }
  }
}

function getPlayerHealth(world: World, playerEntity?: number): Health | undefined {
  if (playerEntity !== undefined) {
    return world.getComponent<Health>(playerEntity, HEALTH);
  }
  for (const e of world.query(PLAYER, HEALTH)) {
    return world.getComponent<Health>(e, HEALTH);
  }
  return undefined;
}

const STAT_UPGRADE_POOL: UpgradeDef[] = [
  // Common
  { id: 'hp_up', name: 'Vitality', description: 'Max HP +20', rarity: 'common', apply: (w, pe) => { const h = getPlayerHealth(w, pe); if (h) { h.max += 20; h.current += 20; } } },
  { id: 'speed_up', name: 'Swift Feet', description: 'Move speed +10%', rarity: 'common', apply: (w, pe) => modSpecificPlayer(w, pe, p => { p.speedMultiplier += 0.1; }) },
  { id: 'dmg_up', name: 'Sharp Edge', description: 'Damage +15%', rarity: 'common', apply: (w, pe) => modSpecificPlayer(w, pe, p => { p.damageMultiplier += 0.15; }) },
  { id: 'pickup_up', name: 'Magnetism', description: 'Pickup radius +25%', rarity: 'common', apply: (w, pe) => modSpecificPlayer(w, pe, p => { p.pickupRadiusMultiplier += 0.25; }) },
  { id: 'atk_speed', name: 'Quick Hands', description: 'All weapons: attack speed +12%', rarity: 'common', apply: (w, pe) => modPlayerWeapons(w, pe, wp => { wp.cooldown *= 0.88; }) },

  // Tag-based (Magic)
  { id: 'proj_mastery', name: 'Projectile Mastery', description: 'Projectile weapons: +1 piercing', rarity: 'magic', apply: (w, pe) => modTaggedPlayerWeapons(w, pe, 'projectile', wp => { wp.piercing += 1; }) },
  { id: 'arcane_power', name: 'Arcane Power', description: 'Magic weapons: +20% damage', rarity: 'magic', apply: (w, pe) => modTaggedPlayerWeapons(w, pe, 'magic', wp => { wp.damage *= 1.2; }) },
  { id: 'melee_fury', name: 'Melee Fury', description: 'Melee weapons: +15% attack speed', rarity: 'magic', apply: (w, pe) => modTaggedPlayerWeapons(w, pe, 'melee', wp => { wp.cooldown *= 0.85; }) },
  { id: 'hp_regen', name: 'Regeneration', description: 'Heal 15 HP now, +10 max HP', rarity: 'magic', apply: (w, pe) => { const h = getPlayerHealth(w, pe); if (h) { h.max += 10; h.current = Math.min(h.max, h.current + 15); } } },
  { id: 'big_dmg', name: 'Power Strike', description: 'Damage +30%', rarity: 'magic', apply: (w, pe) => modSpecificPlayer(w, pe, p => { p.damageMultiplier += 0.3; }) },
  { id: 'range_up', name: 'Long Reach', description: 'All weapons: range +25%', rarity: 'magic', apply: (w, pe) => modPlayerWeapons(w, pe, wp => { wp.range *= 1.25; }) },

  // Rare
  { id: 'proj_speed', name: 'Velocity', description: 'Projectile speed +50%, damage +20%', rarity: 'rare', apply: (w, pe) => modTaggedPlayerWeapons(w, pe, 'projectile', wp => { wp.projectileSpeed *= 1.5; wp.damage *= 1.2; }) },
  { id: 'dash_boost', name: 'Phantom Dash', description: 'Dash cooldown -40%', rarity: 'rare', apply: (w, pe) => modSpecificPlayer(w, pe, p => { p.dashCooldown *= 0.6; }) },
  { id: 'glass_cannon', name: 'Glass Cannon', description: 'Damage +60%, Max HP -25%', rarity: 'rare', apply: (w, pe) => { modSpecificPlayer(w, pe, p => { p.damageMultiplier += 0.6; }); const h = getPlayerHealth(w, pe); if (h) { h.max = Math.floor(h.max * 0.75); h.current = Math.min(h.current, h.max); } } },

  // Legendary
  { id: 'berserker', name: 'Berserker', description: 'Damage +100%, speed +30%, -30% max HP', rarity: 'legendary', apply: (w, pe) => { modSpecificPlayer(w, pe, p => { p.damageMultiplier += 1.0; p.speedMultiplier += 0.3; }); const h = getPlayerHealth(w, pe); if (h) { h.max = Math.floor(h.max * 0.7); h.current = Math.min(h.current, h.max); } } },
];

function rollRarity(): Rarity {
  const r = Math.random();
  let acc = 0;
  for (const [rarity, weight] of Object.entries(RARITY_WEIGHTS)) {
    acc += weight;
    if (r < acc) return rarity as Rarity;
  }
  return 'common';
}

function getPlayerWeapons(world: World, playerEntity?: number): Weapon[] {
  const results: Weapon[] = [];
  for (const e of world.query(WEAPON, WEAPON_OWNER)) {
    const wo = world.getComponent<WeaponOwner>(e, WEAPON_OWNER);
    if (playerEntity !== undefined && wo && wo.owner !== playerEntity) continue;
    const w = world.getComponent<Weapon>(e, WEAPON)!;
    if (!w.locked) results.push(w);
  }
  return results;
}

function buildWeaponLevelupDesc(weapon: Weapon, def: WeaponDef | undefined, nextLevel: number): string {
  const parts: string[] = [];
  parts.push(`Lv.${weapon.level} -> ${nextLevel}`);

  if (def) {
    // Damage increase
    const curDmg = def.base.damage * Math.pow(def.levelScaling.damageMultiplier, weapon.level - 1);
    const nextDmg = def.base.damage * Math.pow(def.levelScaling.damageMultiplier, nextLevel - 1);
    const dmgPct = Math.round((nextDmg / curDmg - 1) * 100);
    if (dmgPct > 0) parts.push(`+${dmgPct}% dmg`);

    // Cooldown decrease
    const curCd = def.base.cooldown * Math.pow(def.levelScaling.cooldownMultiplier, weapon.level - 1);
    const nextCd = def.base.cooldown * Math.pow(def.levelScaling.cooldownMultiplier, nextLevel - 1);
    const cdPct = Math.round((1 - nextCd / curCd) * 100);
    if (cdPct > 0) parts.push(`+${cdPct}% speed`);

    // Bonus count at this level
    if (def.levelScaling.bonusCountAtLevels?.includes(nextLevel)) {
      parts.push('+1 count');
    }

    // Overclock threshold hint
    if ([6, 12, 18].includes(nextLevel)) {
      parts.push(nextLevel === 18 ? 'UNSTABLE overclock!' : 'Overclock!');
    }
  }

  return parts.join(' | ');
}

export function generateUpgradeCards(world: World, count = 3, playerEntity?: number): UpgradeCard[] {
  const cards: UpgradeCard[] = [];
  const usedIds = new Set<string>();
  const playerWeapons = getPlayerWeapons(world, playerEntity);

  // DRG:S-inspired pacing: weapon levelup chance scales with player level.
  // Early game (levels 1-3) favors stat cards so you build a foundation.
  // Mid/late game ramps weapon cards as you unlock more weapons.
  let playerLevel = 1;
  if (playerEntity !== undefined) {
    const p = world.getComponent<Player>(playerEntity, PLAYER);
    if (p) playerLevel = p.level;
  }
  const weaponChance = Math.min(0.55, 0.2 + playerLevel * 0.025);

  for (let i = 0; i < count; i++) {
    const roll = Math.random();

    if (roll < weaponChance && playerWeapons.length > 0) {
      const weapon = playerWeapons[Math.floor(Math.random() * playerWeapons.length)];
      const cardId = `levelup_${weapon.id}_${weapon.level}`;
      if (!usedIds.has(cardId)) {
        usedIds.add(cardId);
        const nextLevel = weapon.level + 1;
        const wRef = weapon;
        const def = WEAPON_DEFS[wRef.id];
        cards.push({
          id: cardId,
          name: wRef.name,
          description: buildWeaponLevelupDesc(wRef, def, nextLevel),
          rarity: nextLevel >= 10 ? 'rare' : nextLevel >= 5 ? 'magic' : 'common',
          type: 'weapon_levelup',
          weaponId: wRef.id,
          weaponName: wRef.name,
          apply: () => {
            wRef.level = nextLevel;
            if (def) applyLevelScaling(wRef, def);
          },
        });
        continue;
      }
    }

    // Stat card
    const rarity = rollRarity();
    let pool = STAT_UPGRADE_POOL.filter(u => u.rarity === rarity && !usedIds.has(u.id));
    if (pool.length === 0) {
      pool = STAT_UPGRADE_POOL.filter(u => !usedIds.has(u.id));
    }
    if (pool.length === 0) continue;

    const def = pool[Math.floor(Math.random() * pool.length)];
    usedIds.add(def.id);
    cards.push({
      id: def.id,
      name: def.name,
      description: def.description,
      rarity: def.rarity,
      type: 'stat',
      apply: () => def.apply(world, playerEntity),
    });
  }

  return cards;
}

export function generateWeaponUnlockCards(world: World, playerEntity: number): UpgradeCard[] {
  const lockedWeapons: { weapon: Weapon; def: WeaponDef }[] = [];
  for (const e of world.query(WEAPON, WEAPON_OWNER)) {
    const wo = world.getComponent<WeaponOwner>(e, WEAPON_OWNER);
    if (!wo || wo.owner !== playerEntity) continue;
    const w = world.getComponent<Weapon>(e, WEAPON);
    if (w && w.locked) {
      const def = WEAPON_DEFS[w.id];
      if (def) lockedWeapons.push({ weapon: w, def });
    }
  }

  return lockedWeapons.map(({ weapon, def }) => ({
    id: `unlock_${weapon.id}`,
    name: def.name,
    description: def.description,
    rarity: 'rare' as Rarity,
    type: 'weapon_unlock' as const,
    weaponId: weapon.id,
    weaponName: def.name,
    apply: () => { weapon.locked = false; },
  }));
}

// Generate overclock cards for a weapon that just hit level 6/12/18
export function generateOverclockCards(weapon: Weapon): UpgradeCard[] {
  const OVERCLOCK_LEVELS = [6, 12, 18];
  if (!OVERCLOCK_LEVELS.includes(weapon.level)) return [];

  const tier = weapon.level === 18 ? 'unstable' : 'balanced';
  const available = getOverclocksForWeapon(weapon, tier)
    .filter(oc => !weapon.overclocks.includes(oc.id));

  if (available.length === 0) return [];

  // Pick 2-3 options
  const count = Math.min(available.length, tier === 'unstable' ? 2 : 3);
  const shuffled = [...available].sort(() => Math.random() - 0.5);
  const choices = shuffled.slice(0, count);

  const wRef = weapon;
  return choices.map(oc => ({
    id: `oc_${oc.id}`,
    name: oc.name,
    description: oc.description,
    rarity: (tier === 'unstable' ? 'legendary' : 'rare') as Rarity,
    type: 'overclock' as const,
    weaponName: wRef.name,
    overclockTier: tier,
    apply: () => {
      oc.apply(wRef);
      wRef.overclocks.push(oc.id);
      if (oc.runtimeTag) {
        wRef.tags.push(oc.runtimeTag);
      }
    },
  }));
}
