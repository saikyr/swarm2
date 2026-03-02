import assert from 'node:assert/strict';
import { buildDeltaSnapshot } from '../src/net-v2/delta';
import type { SnapshotV2 } from '../src/net-v2/protocol';
import { validateInputFrameV2 } from '../src/net-v2/schemas';
import { ReplicaStore } from '../src/client-net-v2/replica-store';

function run(): void {
  testInputValidation();
  testDeltaAndReplicaApply();
  console.log('net-v2-tests: OK');
}

function testInputValidation(): void {
  const ok = validateInputFrameV2({
    playerId: 1,
    seq: 22,
    clientTick: 100,
    moveX: 0.5,
    moveY: -0.5,
    buttons: 3,
  });
  assert.ok(ok, 'valid input frame should pass schema');

  const bad = validateInputFrameV2({
    playerId: 8,
    seq: -1,
    clientTick: 0,
    moveX: 2,
    moveY: 0,
    buttons: -5,
  });
  assert.equal(bad, null, 'invalid frame should be rejected');
}

function testDeltaAndReplicaApply(): void {
  const base: SnapshotV2 = {
    serverTick: 10,
    baselineTick: null,
    elapsedSec: 2,
    full: true,
    ack: [{ playerId: 0, lastSeq: 4 }],
    lanes: {
      players: [{
        id: 101,
        transform: { pos: { x: 10, y: 10 }, prevPos: { x: 9, y: 10 }, rotation: 0 },
        velocity: { x: 1, y: 0 },
        health: { current: 90, max: 100, iframes: 0, lastHitBy: 0 },
        renderable: {
          shape: 'circle', radius: 10, color: '#fff', glowColor: '#fff', glowSize: 4, alpha: 1, zIndex: 2,
        },
        player: {
          playerId: 0,
          classType: 'warrior' as any,
          speed: 200,
          speedMultiplier: 1,
          level: 2,
          xp: 3,
          xpToNext: 10,
          kills: 1,
          downed: false,
          damageDealt: 10,
          dashCooldownTimer: 0,
          isDashing: false,
          damageMultiplier: 1,
          pickupRadiusMultiplier: 1,
          chilledTimer: 0,
        },
      }],
      enemies: [],
      projectiles: [],
      pickups: [],
      weapons: [],
      effects: [],
    },
    removed: { players: [], enemies: [], projectiles: [], pickups: [], weapons: [], effects: [] },
    events: [],
  };

  const next: SnapshotV2 = {
    ...base,
    serverTick: 11,
    elapsedSec: 2.05,
    lanes: {
      ...base.lanes,
      players: [{ ...base.lanes.players[0], transform: { ...base.lanes.players[0].transform, pos: { x: 14, y: 10 } } }],
    },
  };

  const delta = buildDeltaSnapshot(next, base, false);
  assert.equal(delta.full, false);
  assert.equal(delta.baselineTick, 10);
  assert.equal(delta.lanes.players.length, 1);

  const store = new ReplicaStore();
  const snap0 = store.applySnapshot(base, 1000);
  const snap1 = store.applySnapshot(delta, 1050);

  const p0 = snap0.entities.find((e) => e.id === 101);
  const p1 = snap1.entities.find((e) => e.id === 101);
  assert.ok(p0, 'player should exist after full snapshot');
  assert.ok(p1, 'player should exist after delta snapshot');

  const t0 = p0?.components?.transform as any;
  const t1 = p1?.components?.transform as any;
  assert.equal(t0.pos.x, 10);
  assert.equal(t1.pos.x, 14);
}

run();
