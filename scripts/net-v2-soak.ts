import { performance } from 'node:perf_hooks';
import { World } from '../src/ecs/ecs';
import { createViewerSnapshotV2 } from '../src/net-v2/serialize';
import { buildDeltaSnapshot } from '../src/net-v2/delta';
import {
  COLLIDER,
  ENEMY,
  HEALTH,
  INPUT,
  PICKUP,
  PLAYER,
  PROJECTILE,
  RENDERABLE,
  TRANSFORM,
  VELOCITY,
  WEAPON,
  WEAPON_OWNER,
  type Enemy,
  type Health,
  type InputState,
  type Pickup,
  type Player,
  type Projectile,
  type Renderable,
  type Transform,
  type Velocity,
  type Weapon,
  type WeaponOwner,
} from '../src/components';
import { ClassType, EnemyType, TargetingType, AttackPattern } from '../src/constants';
import type { SnapshotV2 } from '../src/net-v2/protocol';

interface SoakOptions {
  minutes: number;
  strict: boolean;
}

function main(): void {
  const opts = parseArgs();
  const world = buildWorld();

  const tickRate = 60;
  const snapshotRate = 20;
  const totalTicks = Math.floor(opts.minutes * 60 * tickRate);
  const snapshotEveryTicks = Math.floor(tickRate / snapshotRate);

  const snapshotMs: number[] = [];
  const payloadBytes: number[] = [];

  const prevByViewer = new Map<number, SnapshotV2>();

  for (let tick = 1; tick <= totalTicks; tick++) {
    animateWorld(world, tick);

    if (tick % snapshotEveryTicks !== 0) continue;

    for (let viewerPlayerId = 1; viewerPlayerId <= 3; viewerPlayerId++) {
      const t0 = performance.now();
      const full = createViewerSnapshotV2(world, {
        serverTick: tick,
        elapsedSec: tick / tickRate,
        viewerPlayerId,
        ack: [{ playerId: viewerPlayerId, lastSeq: tick }],
        events: [],
      });
      const prev = prevByViewer.get(viewerPlayerId) ?? null;
      const out = buildDeltaSnapshot(full, prev, (tick % tickRate) === 0);
      prevByViewer.set(viewerPlayerId, full);
      const json = JSON.stringify(out);
      const t1 = performance.now();

      snapshotMs.push(t1 - t0);
      payloadBytes.push(Buffer.byteLength(json));
    }
  }

  const snapP95 = p95(snapshotMs);
  const payloadP95 = p95(payloadBytes);

  console.log(JSON.stringify({
    minutes: opts.minutes,
    snapshots: snapshotMs.length,
    snapshotP95Ms: round2(snapP95),
    payloadP95Bytes: Math.round(payloadP95),
  }, null, 2));

  if (opts.strict) {
    if (snapP95 > 3) {
      throw new Error(`snapshot build p95 too high: ${round2(snapP95)}ms > 3ms`);
    }
    if (payloadP95 > 32768) {
      throw new Error(`payload p95 too high: ${Math.round(payloadP95)} bytes > 32768`);
    }
  }
}

function buildWorld(): World {
  const world = new World();
  for (const c of [
    TRANSFORM, VELOCITY, HEALTH, COLLIDER, RENDERABLE, PLAYER, ENEMY,
    PROJECTILE, PICKUP, WEAPON, WEAPON_OWNER, INPUT,
  ]) {
    world.registerComponent(c);
  }

  // 4 players
  for (let i = 0; i < 4; i++) {
    const e = world.createEntity();
    world.addComponent<Transform>(e, TRANSFORM, {
      pos: { x: 300 + i * 80, y: 300 + i * 60 },
      prevPos: { x: 300 + i * 80, y: 300 + i * 60 },
      rotation: 0,
    });
    world.addComponent<Velocity>(e, VELOCITY, { x: 0, y: 0 });
    world.addComponent<Health>(e, HEALTH, { current: 100, max: 100, iframes: 0, lastHitBy: 0 });
    world.addComponent<Renderable>(e, RENDERABLE, {
      shape: 'circle', radius: 12, color: '#7cf', glowColor: '#7cf', glowSize: 6, alpha: 1, zIndex: 2,
    });
    world.addComponent<Player>(e, PLAYER, {
      playerId: i,
      classType: i % 2 === 0 ? ClassType.Warrior : ClassType.Caster,
      speed: 220,
      dashSpeed: 900,
      dashDuration: 0.15,
      dashCooldown: 3,
      dashTimer: 0,
      dashCooldownTimer: 0,
      isDashing: false,
      level: 5,
      xp: 20,
      xpToNext: 40,
      kills: 0,
      downed: false,
      damageMultiplier: 1,
      speedMultiplier: 1,
      pickupRadiusMultiplier: 1,
      chilledTimer: 0,
      damageDealt: 0,
    });
    world.addComponent<InputState>(e, INPUT, { moveX: 0, moveY: 0, dash: false, ability: false });

    for (let s = 0; s < 3; s++) {
      const w = world.createEntity();
      world.addComponent<Weapon>(w, WEAPON, {
        id: `w_${i}_${s}`,
        name: `Weapon ${s}`,
        level: 3,
        overclocks: [],
        tags: ['projectile'],
        target: null,
        locked: false,
        targeting: TargetingType.Closest,
        pattern: AttackPattern.SingleProjectile,
        damage: 20,
        cooldown: 0.5,
        cooldownTimer: 0,
        range: 600,
        projectileSpeed: 500,
        projectileLifetime: 1.2,
        projectileRadius: 5,
        projectileColor: '#9ef',
        count: 1,
        spread: 0,
        piercing: 0,
      });
      world.addComponent<WeaponOwner>(w, WEAPON_OWNER, { owner: e, slotIndex: s });
    }
  }

  // Enemies
  for (let i = 0; i < 480; i++) {
    const e = world.createEntity();
    const x = 200 + (i % 24) * 70;
    const y = 200 + Math.floor(i / 24) * 48;
    world.addComponent<Transform>(e, TRANSFORM, { pos: { x, y }, prevPos: { x, y }, rotation: 0 });
    world.addComponent<Velocity>(e, VELOCITY, { x: 0.5, y: -0.5 });
    world.addComponent<Health>(e, HEALTH, { current: 30, max: 30, iframes: 0, lastHitBy: 0 });
    world.addComponent<Renderable>(e, RENDERABLE, {
      shape: 'circle', radius: 8, color: '#f66', glowColor: '#f66', glowSize: 4, alpha: 1, zIndex: 2,
    });
    world.addComponent<Enemy>(e, ENEMY, {
      type: EnemyType.Swarm,
      speed: 80,
      damage: 8,
      xpValue: 1,
      isElite: false,
      affixes: [],
      attackCooldown: 0,
      attackTimer: 0,
      eliteName: '',
      aiState: 0 as any,
      aiStateTimer: 0,
      preferredRange: 0,
      projectileSpeed: 0,
      projectileDamage: 0,
      spawnOwner: 0,
    });
  }

  // Projectiles
  for (let i = 0; i < 900; i++) {
    const e = world.createEntity();
    const x = 500 + (i % 60) * 16;
    const y = 500 + Math.floor(i / 60) * 14;
    world.addComponent<Transform>(e, TRANSFORM, { pos: { x, y }, prevPos: { x, y }, rotation: 0 });
    world.addComponent<Velocity>(e, VELOCITY, { x: 2, y: 0 });
    world.addComponent<Renderable>(e, RENDERABLE, {
      shape: 'diamond', radius: 4, color: '#6ff', glowColor: '#6ff', glowSize: 4, alpha: 1, zIndex: 3,
    });
    world.addComponent<Projectile>(e, PROJECTILE, {
      damage: 8,
      owner: 1,
      piercing: 0,
      hitEntities: new Set(),
      chainCount: 0,
      chainRange: 0,
    });
  }

  // Pickups
  for (let i = 0; i < 320; i++) {
    const e = world.createEntity();
    const x = 250 + (i % 32) * 24;
    const y = 650 + Math.floor(i / 32) * 24;
    world.addComponent<Transform>(e, TRANSFORM, { pos: { x, y }, prevPos: { x, y }, rotation: 0 });
    world.addComponent<Renderable>(e, RENDERABLE, {
      shape: 'circle', radius: 4, color: '#4f8', glowColor: '#4f8', glowSize: 3, alpha: 1, zIndex: 1,
    });
    world.addComponent<Pickup>(e, PICKUP, {
      type: 'xp',
      value: 1,
      magnetRadius: 40,
      pickupRadius: 6,
      attracted: false,
    });
  }

  return world;
}

function animateWorld(world: World, tick: number): void {
  const wave = Math.sin(tick * 0.03) * 0.8;

  for (const e of world.query(TRANSFORM, VELOCITY)) {
    const t = world.getComponent<Transform>(e, TRANSFORM)!;
    const v = world.getComponent<Velocity>(e, VELOCITY)!;

    t.prevPos.x = t.pos.x;
    t.prevPos.y = t.pos.y;

    t.pos.x += v.x * 0.7 + wave;
    t.pos.y += v.y * 0.7;
  }
}

function parseArgs(): SoakOptions {
  const options: SoakOptions = {
    minutes: 3,
    strict: false,
  };

  for (const arg of process.argv.slice(2)) {
    if (arg.startsWith('--minutes=')) {
      options.minutes = Number(arg.split('=')[1]) || options.minutes;
    }
    if (arg === '--strict') {
      options.strict = true;
    }
  }

  return options;
}

function p95(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95));
  return sorted[idx] ?? 0;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

main();
