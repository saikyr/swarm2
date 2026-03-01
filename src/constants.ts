// Physics / Loop
export const TICK_RATE = 60;
export const TICK_DT = 1 / TICK_RATE;
export const MAX_FRAME_SKIP = 5;

// World
export const WORLD_WIDTH = 4000;
export const WORLD_HEIGHT = 4000;

// Player
export const PLAYER_SPEED = 200;
export const PLAYER_RADIUS = 14;
export const PLAYER_HP = 100;
export const PLAYER_DASH_SPEED = 600;
export const PLAYER_DASH_DURATION = 0.15;
export const PLAYER_DASH_COOLDOWN = 1.5;
export const PLAYER_IFRAMES = 0.2;

// Enemies
export const ENEMY_SPAWN_DISTANCE_MIN = 600;
export const ENEMY_SPAWN_DISTANCE_MAX = 900;

// XP
export const XP_BASE_PER_LEVEL = 10;
export const XP_LEVEL_SCALE = 1.2;
export const XP_PICKUP_RADIUS = 60;
export const XP_MAGNET_RADIUS = 120;

// Spatial hash
export const SPATIAL_CELL_SIZE = 64;

// Rendering
export const BG_COLOR = '#0a0a12';
export const GRID_COLOR = '#1a1a2e';
export const GRID_SIZE = 64;

// Camera
export const CAMERA_LERP_SPEED = 5;

// Particles
export const PARTICLE_DEATH_COUNT_MIN = 8;
export const PARTICLE_DEATH_COUNT_MAX = 15;

// Damage numbers
export const DAMAGE_NUMBER_DURATION = 0.8;
export const DAMAGE_NUMBER_RISE_SPEED = 60;

// Game feel
export const SCREEN_SHAKE_DECAY = 10;
export const HIT_PAUSE_DURATION = 0.03;

// Waves
export const WAVE_INITIAL_SPAWN_RATE = 1.0;
export const WAVE_SPAWN_RATE_INCREASE = 0.05;

// Rarity weights
export const RARITY_WEIGHTS = {
  common: 0.60,
  magic: 0.25,
  rare: 0.12,
  legendary: 0.03,
};

// Rarity colors
export const RARITY_COLORS = {
  common: '#ffffff',
  magic: '#4488ff',
  rare: '#ffcc00',
  legendary: '#ff8800',
};

export type Rarity = keyof typeof RARITY_WEIGHTS;

// Class types
export enum ClassType {
  Warrior = 'warrior',
  Caster = 'caster',
}

// Targeting types
export enum TargetingType {
  Closest = 'closest',
  Aoe = 'aoe',
  Directional = 'directional',
  Orbital = 'orbital',
  Random = 'random',
}

// Attack patterns
export enum AttackPattern {
  SingleProjectile = 'single_projectile',
  Spread = 'spread',
  Sweep = 'sweep',
  Nova = 'nova',
  Orbital = 'orbital',
  Beam = 'beam',
  Chain = 'chain',
  Boomerang = 'boomerang',
  GroundZone = 'ground_zone',
  RunicBarrage = 'runic_barrage',
  Spiral = 'spiral',
}

// Elite affixes
export enum EliteAffix {
  Fast = 'fast',
  Tough = 'tough',
  Splitting = 'splitting',
  Teleporter = 'teleporter',
  Shielded = 'shielded',
  Explosive = 'explosive',
  Chilling = 'chilling',
}

// Game states
export enum GameState {
  Menu = 'menu',
  Lobby = 'lobby',
  ClassSelect = 'class_select',
  WaitingForPlayers = 'waiting_for_players',
  Playing = 'playing',
  Upgrading = 'upgrading',
  Paused = 'paused',
  GameOver = 'game_over',
}

// Enemy types
export enum EnemyType {
  Swarm = 'swarm',
  Dasher = 'dasher',
  Brute = 'brute',
  Spitter = 'spitter',
  Orbiter = 'orbiter',
  Bomber = 'bomber',
  Necromancer = 'necromancer',
}

// Enemy AI states
export enum EnemyAIState {
  Chase = 'chase',
  Orbit = 'orbit',
  Dash = 'dash',
  WindUp = 'wind_up',
  Retreat = 'retreat',
  Shoot = 'shoot',
  Stomp = 'stomp',
  Drop = 'drop',
  Summon = 'summon',
}
