import type { System } from '../ecs/system';
import type { World } from '../ecs/ecs';
import { TRANSFORM, VELOCITY, HEALTH, COLLIDER, RENDERABLE, ENEMY, PLAYER } from '../components';
import type { Transform, Velocity, Health, Collider, Renderable, Enemy } from '../components';
import { CollisionLayer } from '../components';
import { EnemyType, EnemyAIState, EliteAffix, ENEMY_SPAWN_DISTANCE_MIN, ENEMY_SPAWN_DISTANCE_MAX } from '../constants';
import { randomRange, TAU } from '../utils/math';
import type { RunContext } from '../game/run';

export let runRef: RunContext | null = null;
export function setRunRef(r: RunContext): void { runRef = r; }

// Elite spawn cooldown — prevents clustering of multiple elites at once
let eliteSpawnCooldown = 0;

// Type-aware elite names
const ELITE_NAMES_BY_TYPE: Record<EnemyType, string[]> = {
  [EnemyType.Swarm]:       ['Plague Rat', 'Swarmlord', 'Hive Drone', 'Festering Mass'],
  [EnemyType.Dasher]:      ['Blade Dancer', 'Swift Fang', 'Shadow Lancer', 'Viper Strike'],
  [EnemyType.Brute]:       ['Iron Golem', 'Siege Breaker', 'War Titan', 'Stone Crusher'],
  [EnemyType.Spitter]:     ['Venom Sniper', 'Bile Caster', 'Thorn Spewer', 'Acid Mage'],
  [EnemyType.Orbiter]:     ['Void Sentinel', 'Ring Wraith', 'Phantom Orbit', 'Eclipse Walker'],
  [EnemyType.Bomber]:      ['Blight Sower', 'Plague Bearer', 'Toxin Dropper', 'Ruin Seeder'],
  [EnemyType.Necromancer]: ['Bone Lord', 'Death Caller', 'Lich Priest', 'Soul Harvester'],
};

function generateEliteName(type: EnemyType): string {
  const names = ELITE_NAMES_BY_TYPE[type];
  return names[Math.floor(Math.random() * names.length)];
}

interface EnemyDef {
  type: EnemyType;
  shape: 'circle' | 'triangle' | 'square' | 'diamond' | 'ring';
  color: string;
  radius: number;
  speed: number;
  hp: number;
  damage: number;
  xpValue: number;
  preferredRange: number;
  projectileSpeed: number;
  projectileDamage: number;
  attackCooldown: number;
  rotation?: number;
}

const ENEMY_DEFS: Record<EnemyType, EnemyDef> = {
  [EnemyType.Swarm]:       { type: EnemyType.Swarm,       shape: 'circle',   color: '#ff4444', radius: 8,  speed: 75,  hp: 25,  damage: 8,  xpValue: 1, preferredRange: 0,   projectileSpeed: 0,   projectileDamage: 0,  attackCooldown: 0 },
  [EnemyType.Dasher]:      { type: EnemyType.Dasher,      shape: 'triangle', color: '#ff8844', radius: 10, speed: 60,  hp: 20,  damage: 15, xpValue: 2, preferredRange: 0,   projectileSpeed: 0,   projectileDamage: 0,  attackCooldown: 3 },
  [EnemyType.Brute]:       { type: EnemyType.Brute,       shape: 'square',   color: '#aa2222', radius: 18, speed: 35,  hp: 120, damage: 12, xpValue: 3, preferredRange: 0,   projectileSpeed: 0,   projectileDamage: 0,  attackCooldown: 4 },
  [EnemyType.Spitter]:     { type: EnemyType.Spitter,     shape: 'diamond',  color: '#ff44aa', radius: 9,  speed: 50,  hp: 18,  damage: 6,  xpValue: 2, preferredRange: 200, projectileSpeed: 180, projectileDamage: 12, attackCooldown: 2 },
  [EnemyType.Orbiter]:     { type: EnemyType.Orbiter,     shape: 'ring',     color: '#aa44ff', radius: 10, speed: 90,  hp: 30,  damage: 10, xpValue: 2, preferredRange: 120, projectileSpeed: 0,   projectileDamage: 0,  attackCooldown: 0 },
  [EnemyType.Bomber]:      { type: EnemyType.Bomber,      shape: 'diamond',  color: '#ffaa00', radius: 12, speed: 55,  hp: 40,  damage: 8,  xpValue: 3, preferredRange: 0,   projectileSpeed: 0,   projectileDamage: 0,  attackCooldown: 5 },
  [EnemyType.Necromancer]: { type: EnemyType.Necromancer, shape: 'triangle', color: '#44ffaa', radius: 11, speed: 40,  hp: 35,  damage: 5,  xpValue: 5, preferredRange: 350, projectileSpeed: 0,   projectileDamage: 0,  attackCooldown: 6, rotation: Math.PI },
};

export const SpawnerSystem: System = {
  name: 'SpawnerSystem',
  update(world: World, dt: number) {
    if (!runRef) return;

    const players = world.query(PLAYER, TRANSFORM);
    if (players.length === 0) return;

    const playerCount = players.length;

    // Pick a random player to spawn around
    const randomPlayer = players[Math.floor(Math.random() * playerCount)];
    const playerT = world.getComponent<Transform>(randomPlayer, TRANSFORM)!;

    runRef.timer += dt;
    runRef.spawnTimer -= dt;
    eliteSpawnCooldown = Math.max(0, eliteSpawnCooldown - dt);

    // Update wave based on time
    const minutes = runRef.timer / 60;
    if (minutes < 1) runRef.wave = 1;
    else if (minutes < 3) runRef.wave = 2;
    else if (minutes < 5) runRef.wave = 3;
    else if (minutes < 8) runRef.wave = 4;
    else if (minutes < 12) runRef.wave = 5;
    else runRef.wave = 6;

    if (runRef.spawnTimer > 0) return;

    // Multiplayer scaling formulas
    const spawnRateMult = 1 + (playerCount - 1) * 0.4;
    const maxEnemiesMult = 1 + (playerCount - 1) * 0.3;
    const hpMult = 1 + (playerCount - 1) * 0.5;
    const batchMult = 1 + (playerCount - 1) * 0.25;

    // Spawn rate: slow ramp early, accelerates mid-game, floors at 0.25s
    const baseRate = Math.max(0.25, 0.8 * Math.pow(0.92, minutes));
    runRef.spawnTimer = baseRate / spawnRateMult;

    // Batch size: gentle start, ramps up exponentially
    const batchSize = Math.floor(Math.max(2, 2 * Math.pow(1.08, minutes)) * batchMult);
    const currentEnemyCount = world.query(ENEMY).length;
    // Enemy cap: logarithmic early growth, then steady climb
    const maxEnemies = Math.floor((200 + 80 * Math.pow(minutes, 0.8)) * maxEnemiesMult);
    if (currentEnemyCount >= maxEnemies) return;

    let eliteSpawnedThisBatch = false;
    for (let i = 0; i < batchSize && currentEnemyCount + i < maxEnemies; i++) {
      const type = pickEnemyType(minutes);
      // At most one elite per spawn batch, and respect the cooldown timer
      const canSpawnElite = !eliteSpawnedThisBatch && eliteSpawnCooldown <= 0;
      const isChampion = canSpawnElite && minutes >= 3 && Math.random() < 0.01;
      const isElite = isChampion || (canSpawnElite && shouldSpawnElite(minutes));
      const affixes = isElite ? pickAffixes(minutes) : [];

      if (isElite) {
        eliteSpawnedThisBatch = true;
        // Cooldown scales down as game progresses: 12s early, down to 5s by late game
        eliteSpawnCooldown = Math.max(5, 12 - minutes * 0.8);
      }

      spawnEnemy(world, playerT.pos.x, playerT.pos.y, type, isElite, affixes, isChampion, hpMult);
    }
  },
};

function pickEnemyType(minutes: number): EnemyType {
  const r = Math.random();
  if (minutes < 1) return EnemyType.Swarm;
  if (minutes < 2) return r < 0.7 ? EnemyType.Swarm : EnemyType.Dasher;
  if (minutes < 4) {
    if (r < 0.45) return EnemyType.Swarm;
    if (r < 0.70) return EnemyType.Dasher;
    if (r < 0.90) return EnemyType.Brute;
    return EnemyType.Spitter;
  }
  if (minutes < 6) {
    if (r < 0.30) return EnemyType.Swarm;
    if (r < 0.50) return EnemyType.Dasher;
    if (r < 0.65) return EnemyType.Brute;
    if (r < 0.80) return EnemyType.Spitter;
    if (r < 0.90) return EnemyType.Orbiter;
    return EnemyType.Bomber;
  }
  // 6+ minutes: full roster
  if (r < 0.25) return EnemyType.Swarm;
  if (r < 0.40) return EnemyType.Dasher;
  if (r < 0.55) return EnemyType.Brute;
  if (r < 0.65) return EnemyType.Spitter;
  if (r < 0.75) return EnemyType.Orbiter;
  if (r < 0.90) return EnemyType.Bomber;
  return EnemyType.Necromancer;
}

function shouldSpawnElite(minutes: number): boolean {
  // Logarithmic curve: quick early introduction, then gradual plateau at ~12%
  const chance = Math.min(0.12, 0.01 + 0.06 * (1 - Math.exp(-minutes * 0.25)));
  return Math.random() < chance;
}

function pickAffixes(minutes: number): EliteAffix[] {
  const allAffixes = Object.values(EliteAffix);
  const maxCount = minutes < 5 ? 1 : minutes < 8 ? 2 : 3;
  const count = 1 + Math.floor(Math.random() * maxCount);
  const chosen: EliteAffix[] = [];
  const available = [...allAffixes];
  for (let i = 0; i < count && available.length > 0; i++) {
    const idx = Math.floor(Math.random() * available.length);
    chosen.push(available[idx]);
    available.splice(idx, 1);
  }
  return chosen;
}

function spawnEnemy(
  world: World, playerX: number, playerY: number,
  type: EnemyType, isElite: boolean, affixes: EliteAffix[], isChampion = false,
  hpMultiplier = 1
): void {
  const def = ENEMY_DEFS[type];
  const angle = Math.random() * TAU;
  const dist = randomRange(ENEMY_SPAWN_DISTANCE_MIN, ENEMY_SPAWN_DISTANCE_MAX);
  const x = playerX + Math.cos(angle) * dist;
  const y = playerY + Math.sin(angle) * dist;

  let hp = def.hp;
  let speed = def.speed;
  let damage = def.damage;
  let radius = def.radius;
  let color = def.color;

  // Wave scaling
  const waveScale = runRef ? 1 + (runRef.wave - 1) * 0.15 : 1;
  hp *= waveScale;

  // Multiplayer HP scaling
  hp *= hpMultiplier;

  if (isElite) {
    if (isChampion) {
      hp *= 10;
      damage *= 2;
      radius *= 1.6;
      color = '#ff6600';
    } else {
      hp *= 3;
      damage *= 1.5;
      radius *= 1.3;
      color = '#ffcc44';
    }

    for (const affix of affixes) {
      if (affix === EliteAffix.Fast) speed *= 1.5;
      if (affix === EliteAffix.Tough) hp *= 2;
    }
  }

  const entity = world.createEntity();
  world.addComponent<Transform>(entity, TRANSFORM, {
    pos: { x, y }, prevPos: { x, y }, rotation: def.rotation ?? 0,
  });
  world.addComponent<Velocity>(entity, VELOCITY, { x: 0, y: 0 });
  world.addComponent<Health>(entity, HEALTH, {
    current: hp, max: hp, iframes: 0,
  });
  world.addComponent<Collider>(entity, COLLIDER, {
    radius, layer: CollisionLayer.Enemy, mask: [CollisionLayer.PlayerProjectile],
  });
  world.addComponent<Renderable>(entity, RENDERABLE, {
    shape: def.shape, radius, color,
    glowColor: isElite ? '#ffcc44' : color,
    glowSize: isElite ? 15 : 6,
    alpha: 1, zIndex: 2,
  });
  world.addComponent<Enemy>(entity, ENEMY, {
    type, speed, damage,
    xpValue: def.xpValue * (isChampion ? 10 : isElite ? 5 : 1),
    isElite, affixes,
    attackCooldown: def.attackCooldown || 1,
    attackTimer: 0,
    eliteName: isElite ? generateEliteName(type) : '',
    aiState: EnemyAIState.Chase,
    aiStateTimer: 0,
    preferredRange: def.preferredRange,
    projectileSpeed: def.projectileSpeed,
    projectileDamage: def.projectileDamage * (isElite ? (isChampion ? 2 : 1.5) : 1),
    spawnOwner: 0,
  });
}

// Exported for Necromancer minion spawning from EnemyAISystem
export function spawnMinionSwarm(
  world: World, x: number, y: number, ownerEntity: number, hpScale = 1
): void {
  const def = ENEMY_DEFS[EnemyType.Swarm];
  const offsetX = (Math.random() - 0.5) * 30;
  const offsetY = (Math.random() - 0.5) * 30;

  let hp = def.hp * hpScale;
  const waveScale = runRef ? 1 + (runRef.wave - 1) * 0.15 : 1;
  hp *= waveScale;

  const entity = world.createEntity();
  world.addComponent<Transform>(entity, TRANSFORM, {
    pos: { x: x + offsetX, y: y + offsetY },
    prevPos: { x: x + offsetX, y: y + offsetY },
    rotation: 0,
  });
  world.addComponent<Velocity>(entity, VELOCITY, { x: 0, y: 0 });
  world.addComponent<Health>(entity, HEALTH, { current: hp, max: hp, iframes: 0 });
  world.addComponent<Collider>(entity, COLLIDER, {
    radius: def.radius, layer: CollisionLayer.Enemy, mask: [CollisionLayer.PlayerProjectile],
  });
  world.addComponent<Renderable>(entity, RENDERABLE, {
    shape: def.shape, radius: def.radius, color: def.color,
    glowColor: def.color, glowSize: 6, alpha: 1, zIndex: 2,
  });
  world.addComponent<Enemy>(entity, ENEMY, {
    type: EnemyType.Swarm, speed: def.speed, damage: def.damage,
    xpValue: 1, isElite: false, affixes: [],
    attackCooldown: 0, attackTimer: 0, eliteName: '',
    aiState: EnemyAIState.Chase, aiStateTimer: 0,
    preferredRange: 0, projectileSpeed: 0, projectileDamage: 0,
    spawnOwner: ownerEntity,
  });
}
