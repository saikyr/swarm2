import type { Vec2 } from '../utils/math';
import type { ClassType, EnemyType, EliteAffix, TargetingType, AttackPattern, Rarity } from '../constants';

// Component store names
export const TRANSFORM = 'transform';
export const VELOCITY = 'velocity';
export const HEALTH = 'health';
export const COLLIDER = 'collider';
export const RENDERABLE = 'renderable';
export const PLAYER = 'player';
export const ENEMY = 'enemy';
export const WEAPON = 'weapon';
export const WEAPON_OWNER = 'weaponOwner';
export const PROJECTILE = 'projectile';
export const PARTICLE = 'particle';
export const INPUT = 'input';
export const DAMAGE_FLASH = 'damageFlash';
export const TRAIL = 'trail';
export const LIFETIME = 'lifetime';
export const XP_ORB = 'xpOrb';
export const PICKUP = 'pickup';
export const DAMAGE_NUMBER = 'damageNumber';
export const SWEEP_ATTACK = 'sweepAttack';
export const NOVA_ATTACK = 'novaAttack';
export const ORBITAL = 'orbital';
export const BEAM_ATTACK = 'beamAttack';
export const BOOMERANG = 'boomerang';
export const GROUND_ZONE = 'groundZone';
export const RUNE_CHARGE = 'runeCharge';
export const REVIVE_ZONE = 'reviveZone';

// Targeting result
export interface TargetResult {
  entity: number;
  x: number;
  y: number;
  distSq: number;
}

// Component data interfaces
export interface Transform {
  pos: Vec2;
  prevPos: Vec2;
  rotation: number;
}

export interface Velocity {
  x: number;
  y: number;
}

export interface Health {
  current: number;
  max: number;
  iframes: number;
}

export interface Collider {
  radius: number;
  layer: CollisionLayer;
  mask: CollisionLayer[];
}

export enum CollisionLayer {
  Player = 'player',
  PlayerProjectile = 'player_projectile',
  Enemy = 'enemy',
  EnemyProjectile = 'enemy_projectile',
  Pickup = 'pickup',
}

export interface Renderable {
  shape: 'circle' | 'diamond' | 'triangle' | 'square' | 'ring';
  radius: number;
  color: string;
  glowColor: string;
  glowSize: number;
  alpha: number;
  zIndex: number;
  rotationSpeed?: number;
}

export interface Player {
  playerId: number;
  classType: ClassType;
  speed: number;
  dashSpeed: number;
  dashDuration: number;
  dashCooldown: number;
  dashTimer: number;
  dashCooldownTimer: number;
  isDashing: boolean;
  level: number;
  xp: number;
  xpToNext: number;
  kills: number;
  downed: boolean;
  damageMultiplier: number;
  speedMultiplier: number;
  pickupRadiusMultiplier: number;
}

export interface Enemy {
  type: EnemyType;
  speed: number;
  damage: number;
  xpValue: number;
  isElite: boolean;
  affixes: EliteAffix[];
  attackCooldown: number;
  attackTimer: number;
  eliteName: string;
}

export interface Weapon {
  id: string;
  name: string;
  level: number;
  overclocks: string[];
  tags: string[];
  target: TargetResult | null;
  locked: boolean;
  targeting: TargetingType;
  pattern: AttackPattern;
  damage: number;
  cooldown: number;
  cooldownTimer: number;
  range: number;
  projectileSpeed: number;
  projectileLifetime: number;
  projectileRadius: number;
  projectileColor: string;
  count: number;
  spread: number;
  piercing: number;
}

export interface WeaponOwner {
  owner: number;
  slotIndex: number;
}

export interface Projectile {
  damage: number;
  owner: number;
  piercing: number;
  hitEntities: Set<number>;
  chainCount?: number;
  chainRange?: number;
}

export interface Particle {
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  startSize: number;
  color: string;
  friction: number;
}

export interface InputState {
  moveX: number;
  moveY: number;
  dash: boolean;
  ability: boolean;
}

export interface DamageFlash {
  timer: number;
  duration: number;
}

export interface Trail {
  positions: Vec2[];
  maxLength: number;
  width: number;
  color: string;
}

export interface Lifetime {
  remaining: number;
}

export interface XpOrb {
  value: number;
}

export interface Pickup {
  type: 'xp' | 'health' | 'currency';
  value: number;
  magnetRadius: number;
  pickupRadius: number;
  attracted: boolean;
}

export interface DamageNumberData {
  value: number;
  timer: number;
  duration: number;
  startY: number;
  color: string;
  isCrit: boolean;
  fontSize: number;
}

export interface SweepAttack {
  angle: number;
  arc: number;
  range: number;
  damage: number;
  timer: number;
  duration: number;
  owner: number;
  hitEntities: Set<number>;
}

export interface NovaAttack {
  radius: number;
  maxRadius: number;
  damage: number;
  timer: number;
  duration: number;
  owner: number;
  hitEntities: Set<number>;
  color: string;
}

export interface OrbitalProjectile {
  owner: number;
  angle: number;
  angularSpeed: number;
  orbitRadius: number;
}

export interface BeamAttack {
  owner: number;
  targetX: number;
  targetY: number;
  damage: number;
  width: number;
  duration: number;
  timer: number;
  color: string;
}

export interface BoomerangProjectile {
  owner: number;
  returning: boolean;
  elapsed: number;
  maxOutTime: number;
  returnSpeed: number;
}

export interface GroundZone {
  owner: number;
  radius: number;
  damage: number;
  tickInterval: number;
  tickTimer: number;
  color: string;
}

export interface RuneCharge {
  owner: number;
  damage: number;
  blastRadius: number;
  chargeTime: number;
  timer: number;
  detonated: boolean;
  color: string;
}

export interface ReviveZone {
  targetEntity: number;
  radius: number;
  progress: number;
  reviveTime: number;
  reviverInZone: boolean;
}
