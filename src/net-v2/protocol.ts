import type {
  Enemy,
  GroundZone,
  Health,
  InputState,
  NovaAttack,
  OrbitalProjectile,
  Pickup,
  Player,
  Projectile,
  Renderable,
  ReviveZone,
  RuneCharge,
  SpiralProjectile,
  SweepAttack,
  Transform,
  Velocity,
  Weapon,
  WeaponOwner,
} from '../components';

export const PROTOCOL_V2 = 2 as const;

export const BUTTON_DASH = 1 << 0;
export const BUTTON_ABILITY = 1 << 1;

export type NetSoundEvent =
  | 'fire_projectile' | 'fire_spread' | 'fire_sweep' | 'fire_nova'
  | 'fire_chain' | 'fire_boomerang' | 'fire_ground_zone' | 'fire_runic'
  | 'fire_beam' | 'fire_spiral'
  | 'hit_projectile' | 'hit_sweep' | 'hit_nova' | 'hit_zone'
  | 'enemy_death' | 'elite_death'
  | 'dash' | 'player_hit' | 'level_up' | 'xp_pickup' | 'health_pickup';

export type V2MessageType =
  | 'c_hello'
  | 's_hello'
  | 'c_input'
  | 's_snapshot'
  | 's_room_state'
  | 's_run_start'
  | 's_run_end'
  | 's_upgrade_options'
  | 'c_upgrade_pick'
  | 's_upgrade_resolved'
  | 'c_ping'
  | 's_pong'
  | 's_error';

export interface EnvelopeV2<TPayload = unknown> {
  v: typeof PROTOCOL_V2;
  t: V2MessageType;
  room: string;
  ts: number;
  payload: TPayload;
  targetPlayerId?: number;
}

export interface InputFrameV2 {
  playerId: number;
  seq: number;
  clientTick: number;
  moveX: number;
  moveY: number;
  buttons: number;
}

export interface UpgradePickV2 {
  playerId: number;
  cardIndex: number;
}

export interface NetRenderable {
  shape: Renderable['shape'];
  radius: number;
  color: string;
  alpha: number;
  zIndex: number;
  glowColor?: string;
  glowSize?: number;
  rotationSpeed?: number;
}

export interface AckState {
  playerId: number;
  lastSeq: number;
}

export interface PlayerLaneEntity {
  id: number;
  transform: Transform;
  velocity: Velocity;
  health: Health;
  renderable: NetRenderable;
  player: Pick<Player,
    'playerId' | 'classType' | 'speed' | 'speedMultiplier' | 'level' | 'xp' | 'xpToNext' |
    'kills' | 'downed' | 'damageDealt' | 'dashCooldownTimer' | 'isDashing' | 'damageMultiplier' |
    'pickupRadiusMultiplier' | 'chilledTimer'
  >;
}

export interface EnemyLaneEntity {
  id: number;
  transform: Transform;
  velocity: Velocity;
  health: Health;
  renderable: NetRenderable;
  enemy: Pick<Enemy,
    'type' | 'speed' | 'damage' | 'xpValue' | 'isElite' | 'affixes' | 'eliteName' |
    'attackCooldown' | 'attackTimer' | 'aiState' | 'aiStateTimer' | 'preferredRange'
  >;
}

export interface ProjectileLaneEntity {
  id: number;
  transform: Transform;
  velocity: Velocity;
  renderable: NetRenderable;
  projectile: Pick<Projectile,
    'damage' | 'owner' | 'piercing' | 'chainCount' | 'chainRange'
  >;
}

export interface PickupLaneEntity {
  id: number;
  transform: Transform;
  renderable: NetRenderable | null;
  pickup: Pickup;
}

export interface WeaponLaneEntity {
  id: number;
  weapon: Pick<Weapon,
    'id' | 'name' | 'level' | 'overclocks' | 'tags' | 'locked' | 'targeting' | 'pattern' |
    'damage' | 'cooldown' | 'cooldownTimer' | 'range' | 'projectileSpeed' |
    'projectileLifetime' | 'projectileRadius' | 'projectileColor' | 'count' | 'spread' | 'piercing'
  >;
  owner: WeaponOwner;
}

export interface EffectLaneEntity {
  id: number;
  transform: Transform;
  renderable: NetRenderable | null;
  sweepAttack?: SweepAttack;
  novaAttack?: NovaAttack;
  orbital?: OrbitalProjectile;
  groundZone?: GroundZone;
  runeCharge?: RuneCharge;
  reviveZone?: ReviveZone;
  spiralProjectile?: SpiralProjectile;
  input?: InputState;
}

export type RunEventBodyV2 =
  | {
    type: 'beam';
    x0: number;
    y0: number;
    x1: number;
    y1: number;
  }
  | {
    type: 'sfx';
    event: NetSoundEvent;
    x: number;
    y: number;
    isCaster?: boolean;
  }
  | {
    type: 'shake';
    amount: number;
  }
  | {
    type: 'hit_pause';
    duration: number;
  };

export type RunEventV2 = { id: number } & RunEventBodyV2;

export interface SnapshotLanesV2 {
  players: PlayerLaneEntity[];
  enemies: EnemyLaneEntity[];
  projectiles: ProjectileLaneEntity[];
  pickups: PickupLaneEntity[];
  weapons: WeaponLaneEntity[];
  effects: EffectLaneEntity[];
}

export interface SnapshotRemovedV2 {
  players: number[];
  enemies: number[];
  projectiles: number[];
  pickups: number[];
  weapons: number[];
  effects: number[];
}

export interface SnapshotV2 {
  serverTick: number;
  baselineTick: number | null;
  elapsedSec: number;
  full: boolean;
  ack: AckState[];
  lanes: SnapshotLanesV2;
  removed: SnapshotRemovedV2;
  events: RunEventV2[];
}

export interface RoomStateV2 {
  roomCode: string;
  state: 'lobby' | 'starting' | 'running' | 'ended';
  players: Array<{ playerId: number; connected: boolean }>;
}

export interface UpgradeDraftV2 {
  playerId: number;
  cards: Array<{
    index: number;
    id: string;
    name: string;
    description: string;
    rarity: string;
    cardType?: string;
    weaponId?: string;
    weaponName?: string;
    overclockTier?: string;
  }>;
}

export interface ErrorPayloadV2 {
  code: string;
  message: string;
}

export function isEnvelopeV2(value: unknown): value is EnvelopeV2 {
  if (!value || typeof value !== 'object') return false;
  const v = value as Partial<EnvelopeV2>;
  return v.v === PROTOCOL_V2
    && typeof v.t === 'string'
    && typeof v.room === 'string'
    && typeof v.ts === 'number'
    && 'payload' in (value as Record<string, unknown>);
}

export function emptyRemoved(): SnapshotRemovedV2 {
  return {
    players: [],
    enemies: [],
    projectiles: [],
    pickups: [],
    weapons: [],
    effects: [],
  };
}

export function emptyLanes(): SnapshotLanesV2 {
  return {
    players: [],
    enemies: [],
    projectiles: [],
    pickups: [],
    weapons: [],
    effects: [],
  };
}
