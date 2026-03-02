import type { System } from '../ecs/system';
import type { World } from '../ecs/ecs';
import {
  TRANSFORM, WEAPON, WEAPON_OWNER, PROJECTILE, VELOCITY, COLLIDER, RENDERABLE,
  LIFETIME, SWEEP_ATTACK, TRAIL, NOVA_ATTACK, ORBITAL, HEALTH, ENEMY, DAMAGE_FLASH,
  BOOMERANG, GROUND_ZONE, RUNE_CHARGE, PLAYER, SPIRAL_PROJECTILE,
} from '../components';
import type {
  Transform, Weapon, WeaponOwner, Projectile, Velocity, Collider, Renderable,
  Lifetime, SweepAttack, Trail, NovaAttack, OrbitalProjectile, Health, Enemy, Player,
  BoomerangProjectile, GroundZone, RuneCharge, SpiralProjectile,
} from '../components';
import { CollisionLayer } from '../components';
import { vec2Normalize, vec2Sub, vec2Angle, vec2DistSq } from '../utils/math';
import { AttackPattern } from '../constants';
import { playSound } from '../audio/audio';
import { WEAPON_DEFS } from '../data/weapons';
import { spawnDamageNumber } from '../rendering/damage-numbers';
import { spawnBeamFx } from '../rendering/particles';
import type { GameEvent } from '../net/messages';

// Track spawned orbitals per weapon entity
const orbitalSpawned = new Set<number>();

// Buffered game events for network broadcast
const pendingGameEvents: GameEvent[] = [];

export function drainGameEvents(): GameEvent[] {
  if (pendingGameEvents.length === 0) return pendingGameEvents;
  return pendingGameEvents.splice(0, pendingGameEvents.length);
}

export function clearOrbitalTracking(): void {
  orbitalSpawned.clear();
}

export const WeaponSystem: System = {
  name: 'WeaponSystem',
  update(world: World, dt: number) {
    for (const weaponEntity of world.query(WEAPON, WEAPON_OWNER)) {
      const weapon = world.getComponent<Weapon>(weaponEntity, WEAPON)!;
      const wo = world.getComponent<WeaponOwner>(weaponEntity, WEAPON_OWNER)!;
      const ownerTransform = world.getComponent<Transform>(wo.owner, TRANSFORM);
      if (!ownerTransform) continue;
      if (weapon.locked) continue;

      // Don't fire weapons for downed players
      const ownerPlayer = world.getComponent<any>(wo.owner, PLAYER);
      if (ownerPlayer?.downed) continue;

      // Orbital weapons spawn once and persist
      if (weapon.pattern === AttackPattern.Orbital) {
        if (!orbitalSpawned.has(weaponEntity)) {
          fireOrbital(world, wo.owner, ownerTransform, weapon);
          orbitalSpawned.add(weaponEntity);
        }
        continue;
      }

      weapon.cooldownTimer -= dt;
      if (weapon.cooldownTimer > 0) continue;
      if (!weapon.target) continue;

      weapon.cooldownTimer = weapon.cooldown;

      const isCaster = weapon.id.startsWith('caster_');
      const px = ownerTransform.pos.x, py = ownerTransform.pos.y;
      switch (weapon.pattern) {
        case AttackPattern.SingleProjectile:
          fireProjectile(world, wo.owner, ownerTransform, weapon);
          playSound('fire_projectile', px, py, isCaster);
          break;
        case AttackPattern.Spread:
          fireSpread(world, wo.owner, ownerTransform, weapon);
          playSound('fire_spread', px, py, isCaster);
          break;
        case AttackPattern.Sweep:
          fireSweep(world, wo.owner, ownerTransform, weapon);
          playSound('fire_sweep', px, py);
          break;
        case AttackPattern.Nova:
          fireNova(world, wo.owner, ownerTransform, weapon);
          playSound('fire_nova', px, py, isCaster);
          break;
        case AttackPattern.Chain:
          fireChain(world, wo.owner, ownerTransform, weapon);
          playSound('fire_chain', px, py);
          break;
        case AttackPattern.Boomerang:
          fireBoomerang(world, wo.owner, ownerTransform, weapon);
          playSound('fire_boomerang', px, py);
          break;
        case AttackPattern.GroundZone:
          fireGroundZone(world, wo.owner, ownerTransform, weapon);
          playSound('fire_ground_zone', px, py);
          break;
        case AttackPattern.RunicBarrage:
          fireRunicBarrage(world, wo.owner, ownerTransform, weapon);
          playSound('fire_runic', px, py);
          break;
        case AttackPattern.Beam:
          fireBeam(world, wo.owner, ownerTransform, weapon);
          playSound('fire_beam', px, py);
          break;
        case AttackPattern.Spiral:
          fireSpiral(world, wo.owner, ownerTransform, weapon);
          playSound('fire_spiral', px, py);
          break;
      }
    }
  },
};

function getProjectileShape(weapon: Weapon): Renderable['shape'] {
  const def = WEAPON_DEFS[weapon.id];
  return def?.base.projectileShape || 'circle';
}

function fireProjectile(world: World, owner: number, transform: Transform, weapon: Weapon): void {
  if (!weapon.target) return;
  const baseDir = vec2Normalize(vec2Sub({ x: weapon.target.x, y: weapon.target.y }, transform.pos));
  const shape = getProjectileShape(weapon);
  const count = weapon.count || 1;
  const baseAngle = vec2Angle(baseDir);
  const totalSpread = count > 1 ? 0.3 + (count - 2) * 0.1 : 0;

  for (let i = 0; i < count; i++) {
    const angle = count <= 1 ? baseAngle : baseAngle - totalSpread / 2 + totalSpread * i / (count - 1);
    const dir = { x: Math.cos(angle), y: Math.sin(angle) };

    const e = world.createEntity();
    world.addComponent<Transform>(e, TRANSFORM, {
      pos: { x: transform.pos.x, y: transform.pos.y },
      prevPos: { x: transform.pos.x, y: transform.pos.y },
      rotation: angle,
    });
    world.addComponent<Velocity>(e, VELOCITY, {
      x: dir.x * weapon.projectileSpeed,
      y: dir.y * weapon.projectileSpeed,
    });
    world.addComponent<Projectile>(e, PROJECTILE, {
      damage: weapon.damage,
      owner,
      piercing: weapon.piercing,
      hitEntities: new Set(),
    });
    world.addComponent<Collider>(e, COLLIDER, {
      radius: weapon.projectileRadius,
      layer: CollisionLayer.PlayerProjectile,
      mask: [CollisionLayer.Enemy],
    });
    world.addComponent<Renderable>(e, RENDERABLE, {
      shape,
      radius: weapon.projectileRadius,
      color: weapon.projectileColor,
      glowColor: weapon.projectileColor,
      glowSize: 10,
      alpha: 1,
      zIndex: 3,
    });
    world.addComponent<Lifetime>(e, LIFETIME, { remaining: weapon.projectileLifetime });
    world.addComponent<Trail>(e, TRAIL, {
      positions: [],
      maxLength: 10,
      width: weapon.projectileRadius * 0.8,
      color: weapon.projectileColor,
    });
  }
}

function fireSpread(world: World, owner: number, transform: Transform, weapon: Weapon): void {
  if (!weapon.target) return;
  const baseAngle = vec2Angle(vec2Normalize(vec2Sub({ x: weapon.target.x, y: weapon.target.y }, transform.pos)));
  const shape = getProjectileShape(weapon);

  const count = weapon.count || 3;
  const totalSpread = weapon.spread || 0.4;
  // For 360° spread, distribute evenly
  const is360 = totalSpread >= Math.PI * 1.9;
  const angleStep = is360 ? totalSpread / count : (count > 1 ? totalSpread / (count - 1) : 0);
  const startAngle = is360 ? baseAngle : baseAngle - totalSpread / 2;

  for (let i = 0; i < count; i++) {
    const angle = startAngle + angleStep * i;
    const dir = { x: Math.cos(angle), y: Math.sin(angle) };

    const e = world.createEntity();
    world.addComponent<Transform>(e, TRANSFORM, {
      pos: { x: transform.pos.x, y: transform.pos.y },
      prevPos: { x: transform.pos.x, y: transform.pos.y },
      rotation: angle,
    });
    world.addComponent<Velocity>(e, VELOCITY, {
      x: dir.x * weapon.projectileSpeed,
      y: dir.y * weapon.projectileSpeed,
    });
    world.addComponent<Projectile>(e, PROJECTILE, {
      damage: weapon.damage,
      owner,
      piercing: weapon.piercing,
      hitEntities: new Set(),
    });
    world.addComponent<Collider>(e, COLLIDER, {
      radius: weapon.projectileRadius,
      layer: CollisionLayer.PlayerProjectile,
      mask: [CollisionLayer.Enemy],
    });
    world.addComponent<Renderable>(e, RENDERABLE, {
      shape,
      radius: weapon.projectileRadius,
      color: weapon.projectileColor,
      glowColor: weapon.projectileColor,
      glowSize: 10,
      alpha: 1,
      zIndex: 3,
      rotationSpeed: shape === 'diamond' ? 12 : undefined,
    });
    world.addComponent<Lifetime>(e, LIFETIME, { remaining: weapon.projectileLifetime });
    world.addComponent<Trail>(e, TRAIL, {
      positions: [],
      maxLength: 4,
      width: weapon.projectileRadius * 1.0,
      color: weapon.projectileColor,
    });
  }
}

function fireSweep(world: World, owner: number, transform: Transform, weapon: Weapon): void {
  if (!weapon.target) return;
  const dir = vec2Normalize(vec2Sub({ x: weapon.target.x, y: weapon.target.y }, transform.pos));
  const angle = vec2Angle(dir);

  const e = world.createEntity();
  world.addComponent<Transform>(e, TRANSFORM, {
    pos: { x: transform.pos.x, y: transform.pos.y },
    prevPos: { x: transform.pos.x, y: transform.pos.y },
    rotation: angle,
  });
  world.addComponent<SweepAttack>(e, SWEEP_ATTACK, {
    angle,
    arc: weapon.spread || 1.2,
    range: weapon.range,
    damage: weapon.damage,
    timer: 0,
    duration: 0.2,
    owner,
    hitEntities: new Set(),
  });
  world.addComponent<Lifetime>(e, LIFETIME, { remaining: 0.2 });
}

function fireNova(world: World, owner: number, transform: Transform, weapon: Weapon): void {
  const e = world.createEntity();
  world.addComponent<Transform>(e, TRANSFORM, {
    pos: { ...transform.pos },
    prevPos: { ...transform.pos },
    rotation: 0,
  });
  world.addComponent<NovaAttack>(e, NOVA_ATTACK, {
    radius: 0,
    maxRadius: weapon.range,
    damage: weapon.damage,
    timer: 0,
    duration: 0.4,
    owner,
    hitEntities: new Set(),
    color: weapon.projectileColor,
  });
  world.addComponent<Lifetime>(e, LIFETIME, { remaining: 0.4 });
}

function fireChain(world: World, owner: number, transform: Transform, weapon: Weapon): void {
  if (!weapon.target) return;

  // Instant chain lightning — no projectile, just damage + beam FX
  const enemies = world.query(ENEMY, TRANSFORM, HEALTH);
  const chainCount = 3 + Math.floor(weapon.count / 2);
  const chainRange = weapon.range * 0.6;
  const chainRangeSq = chainRange * chainRange;
  const hitSet = new Set<number>();

  // Get player damage multiplier from weapon owner
  let dmgMult = 1;
  const ownerPlayer = world.getComponent<any>(owner, PLAYER);
  if (ownerPlayer) dmgMult = ownerPlayer.damageMultiplier;

  // Start from the targeted enemy
  let currentPos = { x: transform.pos.x, y: transform.pos.y };
  let firstTarget = weapon.target.entity;

  for (let bounce = 0; bounce < chainCount; bounce++) {
    let targetEntity: number;
    let targetPos: { x: number; y: number };

    if (bounce === 0 && firstTarget !== -1) {
      targetEntity = firstTarget;
      const et = world.getComponent<Transform>(firstTarget, TRANSFORM);
      if (!et) break;
      targetPos = { x: et.pos.x, y: et.pos.y };
    } else {
      // Find nearest un-hit enemy
      let bestDist = Infinity;
      let bestEnemy: number | null = null;
      let bestPos = { x: 0, y: 0 };
      for (const enemy of enemies) {
        if (hitSet.has(enemy)) continue;
        const et = world.getComponent<Transform>(enemy, TRANSFORM)!;
        const dSq = vec2DistSq(currentPos, et.pos);
        if (dSq < bestDist && dSq <= chainRangeSq) {
          bestDist = dSq;
          bestEnemy = enemy;
          bestPos = { x: et.pos.x, y: et.pos.y };
        }
      }
      if (bestEnemy === null) break;
      targetEntity = bestEnemy;
      targetPos = bestPos;
    }

    hitSet.add(targetEntity);

    // Deal damage
    const health = world.getComponent<Health>(targetEntity, HEALTH);
    if (health) {
      const dmg = weapon.damage * dmgMult * Math.pow(0.7, bounce);
      health.current -= dmg;
      health.lastHitBy = owner;
      const op = world.getComponent<Player>(owner, PLAYER);
      if (op) op.damageDealt += dmg;
      world.addComponent(targetEntity, DAMAGE_FLASH, { timer: 0.08, duration: 0.08 });
      const tc = world.getComponent<Collider>(targetEntity, COLLIDER);
      spawnDamageNumber(world, targetPos.x, targetPos.y - (tc?.radius ?? 10), dmg);
    }

    // Spawn beam FX
    spawnBeamFx(currentPos.x, currentPos.y, targetPos.x, targetPos.y, 0.15);
    pendingGameEvents.push({ type: 'beam', x0: currentPos.x, y0: currentPos.y, x1: targetPos.x, y1: targetPos.y });

    currentPos = targetPos;
  }
}

function fireBoomerang(world: World, owner: number, transform: Transform, weapon: Weapon): void {
  if (!weapon.target) return;
  const dir = vec2Normalize(vec2Sub({ x: weapon.target.x, y: weapon.target.y }, transform.pos));

  const count = weapon.count || 1;
  const spreadAngle = count > 1 ? 0.3 : 0;
  const baseAngle = vec2Angle(dir);

  for (let i = 0; i < count; i++) {
    const angleOffset = count > 1 ? (i - (count - 1) / 2) * spreadAngle : 0;
    const angle = baseAngle + angleOffset;
    const d = { x: Math.cos(angle), y: Math.sin(angle) };

    const e = world.createEntity();
    world.addComponent<Transform>(e, TRANSFORM, {
      pos: { x: transform.pos.x, y: transform.pos.y },
      prevPos: { x: transform.pos.x, y: transform.pos.y },
      rotation: angle,
    });
    world.addComponent<Velocity>(e, VELOCITY, {
      x: d.x * weapon.projectileSpeed,
      y: d.y * weapon.projectileSpeed,
    });
    world.addComponent<Projectile>(e, PROJECTILE, {
      damage: weapon.damage,
      owner,
      piercing: weapon.piercing,
      hitEntities: new Set(),
    });
    world.addComponent<BoomerangProjectile>(e, BOOMERANG, {
      owner,
      returning: false,
      elapsed: 0,
      maxOutTime: weapon.projectileLifetime / 2,
      returnSpeed: weapon.projectileSpeed * 1.3,
    });
    world.addComponent<Collider>(e, COLLIDER, {
      radius: weapon.projectileRadius,
      layer: CollisionLayer.PlayerProjectile,
      mask: [CollisionLayer.Enemy],
    });
    world.addComponent<Renderable>(e, RENDERABLE, {
      shape: 'diamond',
      radius: weapon.projectileRadius,
      color: weapon.projectileColor,
      glowColor: weapon.projectileColor,
      glowSize: 10,
      alpha: 1,
      zIndex: 3,
      rotationSpeed: 15,
    });
    world.addComponent<Lifetime>(e, LIFETIME, { remaining: weapon.projectileLifetime * 2 });
    world.addComponent<Trail>(e, TRAIL, {
      positions: [],
      maxLength: 4,
      width: weapon.projectileRadius * 1.2,
      color: weapon.projectileColor,
    });
  }
}

function fireGroundZone(world: World, owner: number, transform: Transform, weapon: Weapon): void {
  if (!weapon.target) return;

  // Trap weapons place zone at player position instead of target
  const isTrap = weapon.tags.includes('trap');
  const px = isTrap ? transform.pos.x : weapon.target.x;
  const py = isTrap ? transform.pos.y : weapon.target.y;

  const e = world.createEntity();
  world.addComponent<Transform>(e, TRANSFORM, {
    pos: { x: px, y: py },
    prevPos: { x: px, y: py },
    rotation: 0,
  });
  world.addComponent<GroundZone>(e, GROUND_ZONE, {
    owner,
    radius: weapon.projectileRadius,
    damage: weapon.damage,
    tickInterval: 0.5,
    tickTimer: 0,
    color: weapon.projectileColor,
  });
  world.addComponent<Lifetime>(e, LIFETIME, { remaining: weapon.projectileLifetime });
}

function fireRunicBarrage(world: World, owner: number, transform: Transform, weapon: Weapon): void {
  if (!weapon.target) return;
  const count = weapon.count || 5;

  for (let i = 0; i < count; i++) {
    // Random position within range of target
    const angle = Math.random() * Math.PI * 2;
    const dist = Math.random() * weapon.projectileRadius * 0.8;
    const x = weapon.target.x + Math.cos(angle) * dist;
    const y = weapon.target.y + Math.sin(angle) * dist;

    const e = world.createEntity();
    world.addComponent<Transform>(e, TRANSFORM, {
      pos: { x, y },
      prevPos: { x, y },
      rotation: 0,
    });
    world.addComponent<RuneCharge>(e, RUNE_CHARGE, {
      owner,
      damage: weapon.damage,
      blastRadius: weapon.projectileRadius * 0.6,
      chargeTime: 0.4 + i * 0.08,
      timer: 0,
      detonated: false,
      color: weapon.projectileColor,
    });
    world.addComponent<Renderable>(e, RENDERABLE, {
      shape: 'diamond',
      radius: 6,
      color: weapon.projectileColor,
      glowColor: weapon.projectileColor,
      glowSize: 8,
      alpha: 0.7,
      zIndex: 2,
      rotationSpeed: 3,
    });
    world.addComponent<Lifetime>(e, LIFETIME, { remaining: 0.4 + i * 0.08 + 0.5 });
  }
}

function fireOrbital(world: World, owner: number, transform: Transform, weapon: Weapon): void {
  const count = weapon.count || 2;
  const angleStep = (Math.PI * 2) / count;

  for (let i = 0; i < count; i++) {
    const angle = angleStep * i;
    const ox = transform.pos.x + Math.cos(angle) * weapon.range;
    const oy = transform.pos.y + Math.sin(angle) * weapon.range;

    const e = world.createEntity();
    world.addComponent<Transform>(e, TRANSFORM, {
      pos: { x: ox, y: oy },
      prevPos: { x: ox, y: oy },
      rotation: 0,
    });
    world.addComponent<OrbitalProjectile>(e, ORBITAL, {
      owner,
      angle,
      angularSpeed: weapon.projectileSpeed,
      orbitRadius: weapon.range,
    });
    world.addComponent<Collider>(e, COLLIDER, {
      radius: weapon.projectileRadius,
      layer: CollisionLayer.PlayerProjectile,
      mask: [CollisionLayer.Enemy],
    });
    world.addComponent<Renderable>(e, RENDERABLE, {
      shape: 'circle',
      radius: weapon.projectileRadius,
      color: weapon.projectileColor,
      glowColor: weapon.projectileColor,
      glowSize: 12,
      alpha: 0.9,
      zIndex: 4,
    });
    world.addComponent<Projectile>(e, PROJECTILE, {
      damage: weapon.damage,
      owner,
      piercing: weapon.piercing,
      hitEntities: new Set(),
    });
    world.addComponent<Trail>(e, TRAIL, {
      positions: [],
      maxLength: 10,
      width: weapon.projectileRadius * 0.5,
      color: weapon.projectileColor,
    });
  }
}

function fireBeam(world: World, owner: number, transform: Transform, weapon: Weapon): void {
  if (!weapon.target) return;

  const enemies = world.query(ENEMY, TRANSFORM, HEALTH);
  const rangeSq = weapon.range * weapon.range;

  // Get player damage multiplier
  let dmgMult = 1;
  const ownerPlayer = world.getComponent<any>(owner, PLAYER);
  if (ownerPlayer) dmgMult = ownerPlayer.damageMultiplier;

  // Find up to count targets (closest first)
  const targets: { entity: number; pos: { x: number; y: number }; distSq: number }[] = [];
  for (const enemy of enemies) {
    const et = world.getComponent<Transform>(enemy, TRANSFORM)!;
    const dSq = vec2DistSq(transform.pos, et.pos);
    if (dSq <= rangeSq) {
      targets.push({ entity: enemy, pos: { x: et.pos.x, y: et.pos.y }, distSq: dSq });
    }
  }
  targets.sort((a, b) => a.distSq - b.distSq);
  const hitCount = Math.min(weapon.count, targets.length);

  for (let i = 0; i < hitCount; i++) {
    const t = targets[i];
    const health = world.getComponent<Health>(t.entity, HEALTH);
    if (health) {
      const dmg = weapon.damage * dmgMult;
      health.current -= dmg;
      health.lastHitBy = owner;
      const op = world.getComponent<Player>(owner, PLAYER);
      if (op) op.damageDealt += dmg;
      world.addComponent(t.entity, DAMAGE_FLASH, { timer: 0.08, duration: 0.08 });
      const tc = world.getComponent<Collider>(t.entity, COLLIDER);
      spawnDamageNumber(world, t.pos.x, t.pos.y - (tc?.radius ?? 10), dmg);
    }
    spawnBeamFx(transform.pos.x, transform.pos.y, t.pos.x, t.pos.y, 0.12);
    pendingGameEvents.push({ type: 'beam', x0: transform.pos.x, y0: transform.pos.y, x1: t.pos.x, y1: t.pos.y });
  }
}

function fireSpiral(world: World, owner: number, transform: Transform, weapon: Weapon): void {
  const count = weapon.count || 4;
  const angleStep = (Math.PI * 2) / count;
  const shape = getProjectileShape(weapon);

  for (let i = 0; i < count; i++) {
    const angle = angleStep * i;
    const startRadius = 15;
    const ox = transform.pos.x + Math.cos(angle) * startRadius;
    const oy = transform.pos.y + Math.sin(angle) * startRadius;

    const e = world.createEntity();
    world.addComponent<Transform>(e, TRANSFORM, {
      pos: { x: ox, y: oy },
      prevPos: { x: ox, y: oy },
      rotation: angle,
    });
    world.addComponent<SpiralProjectile>(e, SPIRAL_PROJECTILE, {
      owner,
      angle,
      angularSpeed: 4.0,
      radialSpeed: weapon.projectileSpeed,
      currentRadius: startRadius,
    });
    world.addComponent<Projectile>(e, PROJECTILE, {
      damage: weapon.damage,
      owner,
      piercing: weapon.piercing,
      hitEntities: new Set(),
    });
    world.addComponent<Collider>(e, COLLIDER, {
      radius: weapon.projectileRadius,
      layer: CollisionLayer.PlayerProjectile,
      mask: [CollisionLayer.Enemy],
    });
    world.addComponent<Renderable>(e, RENDERABLE, {
      shape,
      radius: weapon.projectileRadius,
      color: weapon.projectileColor,
      glowColor: weapon.projectileColor,
      glowSize: 10,
      alpha: 0.9,
      zIndex: 3,
      rotationSpeed: 10,
    });
    world.addComponent<Lifetime>(e, LIFETIME, { remaining: weapon.projectileLifetime });
    world.addComponent<Trail>(e, TRAIL, {
      positions: [],
      maxLength: 8,
      width: weapon.projectileRadius * 0.7,
      color: weapon.projectileColor,
    });
  }
}
