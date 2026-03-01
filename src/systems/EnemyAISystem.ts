import type { System } from '../ecs/system';
import type { World } from '../ecs/ecs';
import {
  TRANSFORM, VELOCITY, ENEMY, PLAYER, HEALTH, RENDERABLE,
  COLLIDER, PROJECTILE, LIFETIME, NOVA_ATTACK, GROUND_ZONE,
} from '../components';
import type {
  Transform, Velocity, Enemy, Player, Health, Renderable,
  Collider, Projectile, Lifetime, NovaAttack, GroundZone,
} from '../components';
import { CollisionLayer } from '../components';
import { vec2Normalize, vec2Sub, vec2DistSq } from '../utils/math';
import { EnemyType, EnemyAIState, EliteAffix } from '../constants';
import { spawnMinionSwarm } from './SpawnerSystem';
import { emitParticles } from '../rendering/particles';

/** Find the nearest alive player position to a given point */
function findNearestPlayer(world: World, x: number, y: number): { pos: { x: number; y: number }; player: Player | null; entity: number } | null {
  const players = world.query(PLAYER, TRANSFORM);
  if (players.length === 0) return null;

  let bestDistSq = Infinity;
  let bestEntity = players[0];
  let bestPos = world.getComponent<Transform>(players[0], TRANSFORM)!.pos;

  for (const pe of players) {
    const h = world.getComponent<Health>(pe, HEALTH);
    if (h && h.current <= 0) continue;
    const t = world.getComponent<Transform>(pe, TRANSFORM)!;
    const distSq = (t.pos.x - x) * (t.pos.x - x) + (t.pos.y - y) * (t.pos.y - y);
    if (distSq < bestDistSq) {
      bestDistSq = distSq;
      bestPos = t.pos;
      bestEntity = pe;
    }
  }

  return { pos: bestPos, player: world.getComponent<Player>(bestEntity, PLAYER) ?? null, entity: bestEntity };
}

interface NearestResult {
  pos: { x: number; y: number };
  player: Player | null;
  entity: number;
}

export const EnemyAISystem: System = {
  name: 'EnemyAISystem',
  update(world: World, dt: number) {
    const players = world.query(PLAYER, TRANSFORM);
    if (players.length === 0) return;

    for (const entity of world.query(ENEMY, TRANSFORM, VELOCITY)) {
      const enemy = world.getComponent<Enemy>(entity, ENEMY)!;
      const transform = world.getComponent<Transform>(entity, TRANSFORM)!;
      const vel = world.getComponent<Velocity>(entity, VELOCITY)!;

      const nearest = findNearestPlayer(world, transform.pos.x, transform.pos.y);
      if (!nearest) continue;

      // Tick state timer
      enemy.aiStateTimer = Math.max(0, enemy.aiStateTimer - dt);

      // Dispatch to type-specific behavior
      switch (enemy.type) {
        case EnemyType.Swarm:
          updateSwarm(enemy, transform, vel, nearest);
          break;
        case EnemyType.Dasher:
          updateDasher(world, entity, enemy, transform, vel, nearest, dt);
          break;
        case EnemyType.Brute:
          updateBrute(world, entity, enemy, transform, vel, nearest, dt);
          break;
        case EnemyType.Spitter:
          updateSpitter(world, entity, enemy, transform, vel, nearest, dt);
          break;
        case EnemyType.Orbiter:
          updateOrbiter(enemy, transform, vel, nearest, dt);
          break;
        case EnemyType.Bomber:
          updateBomber(world, entity, enemy, transform, vel, nearest, dt);
          break;
        case EnemyType.Necromancer:
          updateNecromancer(world, entity, enemy, transform, vel, nearest, dt);
          break;
      }

      // Apply elite affixes on top of base behavior
      applyAffixes(world, entity, enemy, transform, vel, nearest, dt);
    }
  },
};

// --- Swarm: pure chase ---
function updateSwarm(enemy: Enemy, transform: Transform, vel: Velocity, nearest: NearestResult): void {
  const dir = vec2Normalize(vec2Sub(nearest.pos, transform.pos));
  vel.x = dir.x * enemy.speed;
  vel.y = dir.y * enemy.speed;
  transform.rotation = Math.atan2(dir.y, dir.x);
}

// --- Dasher: chase → wind-up → dash ---
function updateDasher(
  world: World, entity: number, enemy: Enemy, transform: Transform,
  vel: Velocity, nearest: NearestResult, dt: number
): void {
  const dx = nearest.pos.x - transform.pos.x;
  const dy = nearest.pos.y - transform.pos.y;
  const distSq = dx * dx + dy * dy;
  const dist = Math.sqrt(distSq);

  switch (enemy.aiState) {
    case EnemyAIState.Chase: {
      const dir = vec2Normalize(vec2Sub(nearest.pos, transform.pos));
      // Move at 60% speed while approaching
      vel.x = dir.x * enemy.speed * 0.6;
      vel.y = dir.y * enemy.speed * 0.6;
      transform.rotation = Math.atan2(dir.y, dir.x);

      // When close enough, start wind-up
      if (dist < 150) {
        enemy.aiState = EnemyAIState.WindUp;
        enemy.aiStateTimer = 0.4;
        // Lock dash direction
        enemy.attackTimer = Math.atan2(dy, dx);
      }
      break;
    }
    case EnemyAIState.WindUp: {
      // Stop and telegraph
      vel.x = 0;
      vel.y = 0;
      // Alpha pulse for visual telegraph
      const renderable = world.getComponent<Renderable>(entity, RENDERABLE);
      if (renderable) {
        renderable.alpha = 0.5 + 0.5 * Math.sin(enemy.aiStateTimer * 20);
      }
      transform.rotation = enemy.attackTimer; // Face dash direction

      if (enemy.aiStateTimer <= 0) {
        enemy.aiState = EnemyAIState.Dash;
        enemy.aiStateTimer = 0.3;
        // Restore alpha
        if (renderable) renderable.alpha = 1;
      }
      break;
    }
    case EnemyAIState.Dash: {
      // Dash at 3x speed in locked direction
      const dashAngle = enemy.attackTimer;
      vel.x = Math.cos(dashAngle) * enemy.speed * 3;
      vel.y = Math.sin(dashAngle) * enemy.speed * 3;
      transform.rotation = dashAngle;

      if (enemy.aiStateTimer <= 0) {
        enemy.aiState = EnemyAIState.Chase;
      }
      break;
    }
    default:
      enemy.aiState = EnemyAIState.Chase;
  }
}

// --- Brute: slow chase → stomp nova ---
function updateBrute(
  world: World, entity: number, enemy: Enemy, transform: Transform,
  vel: Velocity, nearest: NearestResult, dt: number
): void {
  const dx = nearest.pos.x - transform.pos.x;
  const dy = nearest.pos.y - transform.pos.y;
  const dist = Math.sqrt(dx * dx + dy * dy);

  switch (enemy.aiState) {
    case EnemyAIState.Chase: {
      const dir = vec2Normalize(vec2Sub(nearest.pos, transform.pos));
      vel.x = dir.x * enemy.speed;
      vel.y = dir.y * enemy.speed;
      transform.rotation = Math.atan2(dir.y, dir.x);

      // Tick attack cooldown
      enemy.attackTimer -= dt;
      if (dist < 60 && enemy.attackTimer <= 0) {
        enemy.aiState = EnemyAIState.WindUp;
        enemy.aiStateTimer = 0.3;
      }
      break;
    }
    case EnemyAIState.WindUp: {
      vel.x = 0;
      vel.y = 0;

      if (enemy.aiStateTimer <= 0) {
        enemy.aiState = EnemyAIState.Stomp;
        enemy.aiStateTimer = 0.2;

        // Spawn nova attack targeting players
        const novaEntity = world.createEntity();
        world.addComponent<Transform>(novaEntity, TRANSFORM, {
          pos: { ...transform.pos }, prevPos: { ...transform.pos }, rotation: 0,
        });
        world.addComponent<NovaAttack>(novaEntity, NOVA_ATTACK, {
          radius: 0, maxRadius: 50, damage: enemy.damage,
          timer: 0, duration: 0.3, owner: entity,
          hitEntities: new Set(), color: '#aa2222',
          isEnemyOwned: true,
        });
        world.addComponent<Lifetime>(novaEntity, LIFETIME, { remaining: 0.3 });
      }
      break;
    }
    case EnemyAIState.Stomp: {
      vel.x = 0;
      vel.y = 0;

      if (enemy.aiStateTimer <= 0) {
        enemy.aiState = EnemyAIState.Chase;
        enemy.attackTimer = enemy.attackCooldown;
      }
      break;
    }
    default:
      enemy.aiState = EnemyAIState.Chase;
  }
}

// --- Spitter: kite at range, fire projectiles ---
function updateSpitter(
  world: World, entity: number, enemy: Enemy, transform: Transform,
  vel: Velocity, nearest: NearestResult, dt: number
): void {
  const dx = nearest.pos.x - transform.pos.x;
  const dy = nearest.pos.y - transform.pos.y;
  const dist = Math.sqrt(dx * dx + dy * dy);
  const dir = vec2Normalize({ x: dx, y: dy });

  transform.rotation = Math.atan2(dy, dx);

  const tooClose = dist < enemy.preferredRange * 0.6;
  const tooFar = dist > enemy.preferredRange * 1.4;

  if (tooClose) {
    // Retreat
    vel.x = -dir.x * enemy.speed;
    vel.y = -dir.y * enemy.speed;
  } else if (tooFar) {
    // Chase
    vel.x = dir.x * enemy.speed;
    vel.y = dir.y * enemy.speed;
  } else {
    // In range: strafe slowly and shoot
    vel.x = -dir.y * enemy.speed * 0.3;
    vel.y = dir.x * enemy.speed * 0.3;

    enemy.attackTimer -= dt;
    if (enemy.attackTimer <= 0) {
      enemy.attackTimer = enemy.attackCooldown;
      spawnEnemyProjectile(world, transform.pos.x, transform.pos.y, dir.x, dir.y,
        enemy.projectileSpeed, enemy.projectileDamage, entity);
    }
  }
}

// --- Orbiter: orbit around player ---
function updateOrbiter(
  enemy: Enemy, transform: Transform, vel: Velocity,
  nearest: NearestResult, dt: number
): void {
  const dx = nearest.pos.x - transform.pos.x;
  const dy = nearest.pos.y - transform.pos.y;
  const dist = Math.sqrt(dx * dx + dy * dy);
  const orbitRadius = enemy.preferredRange;

  if (dist < 1) {
    vel.x = enemy.speed;
    vel.y = 0;
    return;
  }

  const dirX = dx / dist;
  const dirY = dy / dist;

  // Tangential component (orbit)
  const tangentX = -dirY;
  const tangentY = dirX;

  // Radial correction to maintain orbit distance
  const radialError = dist - orbitRadius;
  const radialStrength = Math.min(Math.abs(radialError) / 50, 1) * Math.sign(radialError);

  vel.x = (tangentX * 0.8 + dirX * radialStrength * 0.5) * enemy.speed;
  vel.y = (tangentY * 0.8 + dirY * radialStrength * 0.5) * enemy.speed;

  transform.rotation = Math.atan2(vel.y, vel.x);
}

// --- Bomber: approach → drop zone → retreat ---
function updateBomber(
  world: World, entity: number, enemy: Enemy, transform: Transform,
  vel: Velocity, nearest: NearestResult, dt: number
): void {
  const dx = nearest.pos.x - transform.pos.x;
  const dy = nearest.pos.y - transform.pos.y;
  const dist = Math.sqrt(dx * dx + dy * dy);
  const dir = vec2Normalize({ x: dx, y: dy });

  transform.rotation = Math.atan2(dy, dx);

  switch (enemy.aiState) {
    case EnemyAIState.Chase: {
      vel.x = dir.x * enemy.speed;
      vel.y = dir.y * enemy.speed;

      if (dist < 180) {
        enemy.aiState = EnemyAIState.Drop;
        enemy.aiStateTimer = 0.6;
      }
      break;
    }
    case EnemyAIState.Drop: {
      vel.x = 0;
      vel.y = 0;

      if (enemy.aiStateTimer <= 0) {
        // Spawn ground zone targeting players
        const zoneEntity = world.createEntity();
        world.addComponent<Transform>(zoneEntity, TRANSFORM, {
          pos: { ...transform.pos }, prevPos: { ...transform.pos }, rotation: 0,
        });
        world.addComponent<GroundZone>(zoneEntity, GROUND_ZONE, {
          owner: entity, radius: 40, damage: enemy.damage,
          tickInterval: 0.5, tickTimer: 0, color: '#ffaa00',
          isEnemyOwned: true,
        });
        world.addComponent<Renderable>(zoneEntity, RENDERABLE, {
          shape: 'circle', radius: 40, color: 'rgba(255, 170, 0, 0.3)',
          glowColor: '#ffaa00', glowSize: 10, alpha: 0.5, zIndex: 1,
        });
        world.addComponent<Lifetime>(zoneEntity, LIFETIME, { remaining: 4 });

        enemy.aiState = EnemyAIState.Retreat;
        enemy.aiStateTimer = 1.5;
      }
      break;
    }
    case EnemyAIState.Retreat: {
      vel.x = -dir.x * enemy.speed;
      vel.y = -dir.y * enemy.speed;

      if (enemy.aiStateTimer <= 0) {
        enemy.aiState = EnemyAIState.Chase;
        enemy.attackTimer = enemy.attackCooldown;
      }
      break;
    }
    default:
      enemy.aiState = EnemyAIState.Chase;
  }
}

// --- Necromancer: kite far away, summon minions ---
const NECRO_MAX_MINIONS = 6;

function updateNecromancer(
  world: World, entity: number, enemy: Enemy, transform: Transform,
  vel: Velocity, nearest: NearestResult, dt: number
): void {
  const dx = nearest.pos.x - transform.pos.x;
  const dy = nearest.pos.y - transform.pos.y;
  const dist = Math.sqrt(dx * dx + dy * dy);
  const dir = vec2Normalize({ x: dx, y: dy });

  transform.rotation = Math.atan2(dy, dx) + Math.PI; // Face away (inverted triangle)

  const tooClose = dist < enemy.preferredRange * 0.5;
  const tooFar = dist > enemy.preferredRange * 1.3;

  if (tooClose) {
    vel.x = -dir.x * enemy.speed * 1.2;
    vel.y = -dir.y * enemy.speed * 1.2;
  } else if (tooFar) {
    vel.x = dir.x * enemy.speed * 0.5;
    vel.y = dir.y * enemy.speed * 0.5;
  } else {
    // Strafe slowly
    vel.x = -dir.y * enemy.speed * 0.2;
    vel.y = dir.x * enemy.speed * 0.2;
  }

  // Summon timer
  enemy.attackTimer -= dt;
  if (enemy.attackTimer <= 0) {
    enemy.attackTimer = enemy.attackCooldown;

    // Count existing minions
    let minionCount = 0;
    for (const e of world.query(ENEMY)) {
      const en = world.getComponent<Enemy>(e, ENEMY);
      if (en && en.spawnOwner === entity) minionCount++;
    }

    if (minionCount < NECRO_MAX_MINIONS) {
      const count = 2 + Math.floor(Math.random() * 2); // 2-3 minions
      for (let i = 0; i < count && minionCount + i < NECRO_MAX_MINIONS; i++) {
        spawnMinionSwarm(world, transform.pos.x, transform.pos.y, entity);
      }
      // Summon particles
      emitParticles(world, transform.pos.x, transform.pos.y, 8, '#44ffaa', {
        speed: 80, speedVar: 40, life: 0.3, lifeVar: 0.1, size: 3,
      });
    }
  }
}

// --- Elite affix behaviors (applied on top of base type) ---
function applyAffixes(
  world: World, entity: number, enemy: Enemy, transform: Transform,
  vel: Velocity, nearest: NearestResult, dt: number
): void {
  if (!enemy.isElite || enemy.affixes.length === 0) return;

  // Teleporter: blink toward player periodically
  if (enemy.affixes.includes(EliteAffix.Teleporter)) {
    // Use a separate timer check via a simple trick:
    // only teleporters that are in Chase/Orbit state will blink
    if (enemy.aiState === EnemyAIState.Chase || enemy.aiState === EnemyAIState.Orbit) {
      // Reuse attackTimer for non-Dasher/Brute (they use it for dash direction/cooldown)
      // Use a frame-based random chance instead for safety
      if (Math.random() < 0.005) { // ~0.5% per frame = avg every ~3.3s at 60fps
        const dx = nearest.pos.x - transform.pos.x;
        const dy = nearest.pos.y - transform.pos.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > 100) {
          const dir = vec2Normalize({ x: dx, y: dy });
          const blinkDist = Math.min(dist * 0.5, 150);
          transform.pos.x += dir.x * blinkDist;
          transform.pos.y += dir.y * blinkDist;
        }
      }
    }
  }

  // Shielded: regenerate 5% max HP per second
  if (enemy.affixes.includes(EliteAffix.Shielded)) {
    const health = world.getComponent<Health>(entity, HEALTH);
    if (health && health.current < health.max) {
      health.current = Math.min(health.max, health.current + health.max * 0.05 * dt);
    }
  }

  // Chilling: slow nearest player within 80px
  if (enemy.affixes.includes(EliteAffix.Chilling) && nearest.player) {
    const distSq = vec2DistSq(transform.pos, nearest.pos);
    if (distSq < 80 * 80) {
      (nearest.player as any)._chilled = 0.5;
    }
  }
}

// --- Helper: spawn enemy projectile ---
function spawnEnemyProjectile(
  world: World, x: number, y: number,
  dirX: number, dirY: number,
  speed: number, damage: number, owner: number
): void {
  const entity = world.createEntity();
  world.addComponent<Transform>(entity, TRANSFORM, {
    pos: { x, y }, prevPos: { x, y }, rotation: Math.atan2(dirY, dirX),
  });
  world.addComponent<Velocity>(entity, VELOCITY, {
    x: dirX * speed, y: dirY * speed,
  });
  world.addComponent<Collider>(entity, COLLIDER, {
    radius: 5,
    layer: CollisionLayer.EnemyProjectile,
    mask: [CollisionLayer.Player],
  });
  world.addComponent<Renderable>(entity, RENDERABLE, {
    shape: 'circle', radius: 5, color: '#ff44aa',
    glowColor: '#ff44aa', glowSize: 8, alpha: 1, zIndex: 3,
  });
  world.addComponent<Projectile>(entity, PROJECTILE, {
    damage, owner, piercing: 0, hitEntities: new Set(),
  });
  world.addComponent<Lifetime>(entity, LIFETIME, { remaining: 3 });
}
