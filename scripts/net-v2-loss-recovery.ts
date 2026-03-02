import assert from 'node:assert/strict';
import { buildDeltaSnapshot } from '../src/net-v2/delta';
import { ReplicaStore } from '../src/client-net-v2/replica-store';
import type { SnapshotV2 } from '../src/net-v2/protocol';

function main(): void {
  const store = new ReplicaStore();

  let prevFull: SnapshotV2 | null = null;
  let lastAppliedTick = -1;

  for (let tick = 1; tick <= 240; tick++) {
    const full = makeFullSnapshot(tick);
    const outgoing = buildDeltaSnapshot(full, prevFull, tick % 20 === 0 || prevFull == null);
    prevFull = full;

    // deterministic ~5.9% packet drop pattern for test stability
    if (!outgoing.full && (outgoing.serverTick % 17 === 0)) continue;

    // client-side gate equivalent
    if (outgoing.serverTick <= lastAppliedTick) continue;
    if (!outgoing.full && lastAppliedTick >= 0 && outgoing.baselineTick !== lastAppliedTick) continue;

    store.applySnapshot(outgoing, tick * 50);
    lastAppliedTick = outgoing.serverTick;
  }

  const pos = store.getAuthoritativePlayerPos(0);
  assert.ok(pos, 'player should still exist after loss/recovery');

  // Ground truth at tick 240 from generator.
  const expectedX = 240 * 1.5;
  const expectedY = 100 + Math.sin(240 * 0.05) * 20;

  assert.ok(Math.abs((pos?.x ?? 0) - expectedX) < 0.11, `x mismatch: got ${pos?.x} expected ${expectedX}`);
  assert.ok(Math.abs((pos?.y ?? 0) - expectedY) < 0.2, `y mismatch: got ${pos?.y} expected ${expectedY}`);

  console.log('net-v2-loss-recovery: OK');
}

function makeFullSnapshot(tick: number): SnapshotV2 {
  const x = tick * 1.5;
  const y = 100 + Math.sin(tick * 0.05) * 20;

  return {
    serverTick: tick,
    baselineTick: null,
    elapsedSec: tick / 60,
    full: true,
    ack: [{ playerId: 0, lastSeq: tick }],
    lanes: {
      players: [{
        id: 1,
        transform: { pos: { x, y }, prevPos: { x: x - 1.5, y }, rotation: 0 },
        velocity: { x: 1.5, y: 0 },
        health: { current: 100, max: 100, iframes: 0, lastHitBy: 0 },
        renderable: { shape: 'circle', radius: 12, color: '#fff', alpha: 1, zIndex: 2, glowColor: '#fff', glowSize: 5 },
        player: {
          playerId: 0,
          classType: 'warrior' as any,
          speed: 200,
          speedMultiplier: 1,
          level: 1,
          xp: 0,
          xpToNext: 10,
          kills: 0,
          downed: false,
          damageDealt: 0,
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
}

main();
