import assert from 'node:assert/strict';
import { World } from '../src/ecs/ecs';
import { LocalPrediction } from '../src/client-net-v2/prediction';
import { PLAYER, TRANSFORM, type Player, type Transform } from '../src/components';
import { ClassType } from '../src/constants';

function main(): void {
  const world = new World();
  world.registerComponent(PLAYER);
  world.registerComponent(TRANSFORM);

  const e = world.createEntity();
  world.addComponent<Transform>(e, TRANSFORM, {
    pos: { x: 500, y: 500 },
    prevPos: { x: 500, y: 500 },
    rotation: 0,
  });
  world.addComponent<Player>(e, PLAYER, {
    playerId: 0,
    classType: ClassType.Warrior,
    speed: 300,
    dashSpeed: 900,
    dashDuration: 0.15,
    dashCooldown: 2,
    dashTimer: 0,
    dashCooldownTimer: 0,
    isDashing: false,
    level: 1,
    xp: 0,
    xpToNext: 10,
    kills: 0,
    downed: false,
    damageMultiplier: 1,
    speedMultiplier: 1,
    pickupRadiusMultiplier: 1,
    chilledTimer: 0,
    damageDealt: 0,
  });

  const prediction = new LocalPrediction();

  // 10 client frames moving right
  for (let i = 1; i <= 10; i++) {
    const frame = prediction.createInputFrame(0, i, 1, 0, false, false);
    prediction.enqueue(frame);
    prediction.applyLivePrediction(world, 0, frame, 1 / 30);
  }

  const before = getX(world);
  assert.ok(before > 0, 'prediction should move player forward');

  // Server says at seq 6 player is behind predicted path.
  prediction.ingestAuthoritativeSample({ x: 550, y: 500, ackSeq: 6, receivedAtMs: 1000 });
  // Reconcile should be tick-driven, not snapshot-driven.
  prediction.tickReconcile(world, 0, 1 / 60, 1016);
  for (let i = 0; i < 12; i++) {
    prediction.tickReconcile(world, 0, 1 / 60, 1033 + i * 16);
  }

  const after = getX(world);
  // After replaying pending frames 7..10, client should stay ahead of authoritative x.
  assert.ok(after > 550, `expected corrected+replayed x > 550, got ${after}`);

  console.log('net-v2-reconcile: OK');
}

function getX(world: World): number {
  for (const entity of world.query(PLAYER, TRANSFORM)) {
    const t = world.getComponent<Transform>(entity, TRANSFORM);
    if (t) return t.pos.x;
  }
  return 0;
}

main();
