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
  const dt = 1 / 60;
  const steps = 240;
  const mx = 1 / Math.SQRT2;
  const my = -1 / Math.SQRT2;
  let hostX = 500;
  let hostY = 500;

  for (let i = 1; i <= steps; i++) {
    const frame = prediction.createInputFrame(0, i, mx, my, false, false);
    prediction.enqueue(frame);
    prediction.applyLivePrediction(world, 0, frame, dt);
    hostX += mx * 300 * dt;
    hostY += my * 300 * dt;

    if (i % 20 === 0) {
      prediction.ingestAuthoritativeSample({ x: hostX, y: hostY, ackSeq: i, receivedAtMs: 1000 + i * 16 });
    }
    prediction.tickReconcile(world, 0, dt, 1000 + i * 16);
  }

  const t = world.getComponent<Transform>(e, TRANSFORM)!;
  const dx = Math.abs(t.pos.x - hostX);
  const dy = Math.abs(t.pos.y - hostY);
  assert.ok(dx < 1.5, `x drift too high: ${dx}`);
  assert.ok(dy < 1.5, `y drift too high: ${dy}`);

  console.log('net-v2-prediction-diagonal: OK');
}

main();
