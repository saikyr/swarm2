import assert from 'node:assert/strict';
import { ReplicaStore } from '../src/client-net-v2/replica-store';
import type { SnapshotV2 } from '../src/net-v2/protocol';

function main(): void {
  const store = new ReplicaStore();
  store.setLocalPlayerId(0);

  const full: SnapshotV2 = {
    serverTick: 10,
    baselineTick: null,
    elapsedSec: 2,
    full: true,
    ack: [{ playerId: 0, lastSeq: 4 }],
    lanes: {
      players: [
        makePlayerLane(101, 0, 10, 10, 1, 1),
        makePlayerLane(202, 2, 30, 10, 2, 1),
      ],
      enemies: [],
      projectiles: [],
      pickups: [],
      weapons: [],
      effects: [],
    },
    removed: { players: [], enemies: [], projectiles: [], pickups: [], weapons: [], effects: [] },
    events: [],
  };
  store.applySnapshot(full, 1000);

  const delta: SnapshotV2 = {
    ...full,
    serverTick: 11,
    baselineTick: 10,
    full: false,
    lanes: {
      ...full.lanes,
      players: [
        makePlayerLane(101, 0, 40, 10, 9, 2),
        makePlayerLane(202, 2, 35, 10, 3, 2),
      ],
    },
  };
  const snap = store.applySnapshot(delta, 1050);

  const local = findPlayerById(snap, 0);
  assert.ok(local, 'local player must exist');
  assert.equal(local?.transform, undefined, 'local transform should be omitted from incremental snapshot apply');
  assert.equal(local?.velocity, undefined, 'local velocity should be omitted from incremental snapshot apply');
  assert.equal(local?.player.level, 2, 'local metadata should still update');

  const remote = findPlayerById(snap, 2);
  assert.ok(remote, 'remote player must exist');
  assert.equal(remote?.transform.pos.x, 35, 'remote transform should update normally');

  console.log('net-v2-replica-skip-local-player: OK');
}

function makePlayerLane(id: number, playerId: number, x: number, y: number, vx: number, level: number): SnapshotV2['lanes']['players'][number] {
  return {
    id,
    transform: { pos: { x, y }, prevPos: { x, y }, rotation: 0 },
    velocity: { x: vx, y: 0 },
    health: { current: 100, max: 100, iframes: 0, lastHitBy: 0 },
    renderable: {
      shape: 'circle',
      radius: 10,
      color: '#fff',
      glowColor: '#fff',
      glowSize: 4,
      alpha: 1,
      zIndex: 2,
    },
    player: {
      playerId,
      classType: 'warrior' as any,
      speed: 300,
      speedMultiplier: 1,
      level,
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
  };
}

function findPlayerById(snapshot: { entities: Array<{ components: Record<string, unknown> }> }, playerId: number): any | null {
  for (const entity of snapshot.entities) {
    const player = entity.components.player as { playerId: number } | undefined;
    if (!player || player.playerId !== playerId) continue;
    return {
      transform: entity.components.transform as { pos: { x: number; y: number } } | undefined,
      velocity: entity.components.velocity as { x: number; y: number } | undefined,
      player,
    };
  }
  return null;
}

main();
