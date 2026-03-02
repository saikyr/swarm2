import assert from 'node:assert/strict';
import { World } from '../src/ecs/ecs';
import { PlayerMovementSystem } from '../src/systems/PlayerMovementSystem';
import { INPUT, PLAYER, TRANSFORM, VELOCITY, type InputState, type Player, type Transform, type Velocity } from '../src/components';
import { applyNormalPlayerVelocity, integratePlayerVelocity } from '../src/sim-core/local-move';
import { ClassType } from '../src/constants';

function main(): void {
  const dt = 1 / 60;
  const world = new World();
  world.registerComponent(PLAYER);
  world.registerComponent(INPUT);
  world.registerComponent(TRANSFORM);
  world.registerComponent(VELOCITY);

  const entity = world.createEntity();
  world.addComponent<Player>(entity, PLAYER, makePlayer());
  world.addComponent<InputState>(entity, INPUT, { moveX: 0, moveY: 0, dash: false, ability: false });
  world.addComponent<Transform>(entity, TRANSFORM, {
    pos: { x: 250, y: 250 },
    prevPos: { x: 250, y: 250 },
    rotation: 0,
  });
  world.addComponent<Velocity>(entity, VELOCITY, { x: 0, y: 0 });

  const clientPlayer = makePlayer();
  const clientTransform: Transform = {
    pos: { x: 250, y: 250 },
    prevPos: { x: 250, y: 250 },
    rotation: 0,
  };
  const clientVelocity: Velocity = { x: 0, y: 0 };

  for (let i = 0; i < 240; i++) {
    const move = movementPattern(i);
    const input = world.getComponent<InputState>(entity, INPUT)!;
    input.moveX = move.x;
    input.moveY = move.y;
    input.dash = false;
    input.ability = false;

    PlayerMovementSystem.update(world, dt);

    applyNormalPlayerVelocity(clientPlayer, clientVelocity, move.x, move.y, dt);
    integratePlayerVelocity(clientTransform, clientVelocity, dt);

    const hostTransform = world.getComponent<Transform>(entity, TRANSFORM)!;
    const hostVelocity = world.getComponent<Velocity>(entity, VELOCITY)!;
    assert.ok(Math.abs(hostTransform.pos.x - clientTransform.pos.x) < 1e-9, `x mismatch at tick ${i}`);
    assert.ok(Math.abs(hostTransform.pos.y - clientTransform.pos.y) < 1e-9, `y mismatch at tick ${i}`);
    assert.ok(Math.abs(hostVelocity.x - clientVelocity.x) < 1e-9, `vx mismatch at tick ${i}`);
    assert.ok(Math.abs(hostVelocity.y - clientVelocity.y) < 1e-9, `vy mismatch at tick ${i}`);
    assert.ok(Math.abs(world.getComponent<Player>(entity, PLAYER)!.chilledTimer - clientPlayer.chilledTimer) < 1e-9, `chill mismatch at tick ${i}`);
  }

  console.log('net-v2-movement-model-parity: OK');
}

function makePlayer(): Player {
  return {
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
    speedMultiplier: 1.2,
    pickupRadiusMultiplier: 1,
    chilledTimer: 1.5,
    damageDealt: 0,
  };
}

function movementPattern(i: number): { x: number; y: number } {
  const diag = 1 / Math.SQRT2;
  switch (i % 4) {
    case 0: return { x: 1, y: 0 };
    case 1: return { x: diag, y: -diag };
    case 2: return { x: 0, y: 1 };
    default: return { x: -diag, y: diag };
  }
}

main();
