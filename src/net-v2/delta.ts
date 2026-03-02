import { emptyLanes, emptyRemoved, type SnapshotLanesV2, type SnapshotRemovedV2, type SnapshotV2 } from './protocol';

export function buildDeltaSnapshot(current: SnapshotV2, previous: SnapshotV2 | null, forceFull: boolean): SnapshotV2 {
  if (!previous || forceFull) {
    return {
      ...current,
      full: true,
      baselineTick: null,
      removed: emptyRemoved(),
    };
  }

  const lanes: SnapshotLanesV2 = emptyLanes();
  const removed: SnapshotRemovedV2 = emptyRemoved();

  diffLane(current.lanes.players, previous.lanes.players, lanes.players, removed.players);
  diffLane(current.lanes.enemies, previous.lanes.enemies, lanes.enemies, removed.enemies);
  diffLane(current.lanes.projectiles, previous.lanes.projectiles, lanes.projectiles, removed.projectiles);
  diffLane(current.lanes.pickups, previous.lanes.pickups, lanes.pickups, removed.pickups);
  diffLane(current.lanes.weapons, previous.lanes.weapons, lanes.weapons, removed.weapons);
  diffLane(current.lanes.effects, previous.lanes.effects, lanes.effects, removed.effects);

  return {
    ...current,
    full: false,
    baselineTick: previous.serverTick,
    lanes,
    removed,
  };
}

function diffLane<T extends { id: number }>(
  current: T[],
  prev: T[],
  changedOut: T[],
  removedOut: number[],
): void {
  const currMap = new Map<number, T>();
  const prevMap = new Map<number, T>();

  for (const c of current) currMap.set(c.id, c);
  for (const p of prev) prevMap.set(p.id, p);

  for (const [id, curr] of currMap) {
    const prevEntity = prevMap.get(id);
    if (!prevEntity) {
      changedOut.push(curr);
      continue;
    }
    if (!deepEqual(curr, prevEntity)) {
      changedOut.push(curr);
    }
  }

  for (const id of prevMap.keys()) {
    if (!currMap.has(id)) removedOut.push(id);
  }
}

function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== typeof b) return false;
  if (!a || !b) return false;

  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      if (!deepEqual(a[i], b[i])) return false;
    }
    return true;
  }

  if (typeof a === 'object' && typeof b === 'object') {
    const aObj = a as Record<string, unknown>;
    const bObj = b as Record<string, unknown>;
    const aKeys = Object.keys(aObj);
    const bKeys = Object.keys(bObj);
    if (aKeys.length !== bKeys.length) return false;
    for (const key of aKeys) {
      if (!deepEqual(aObj[key], bObj[key])) return false;
    }
    return true;
  }

  return false;
}
