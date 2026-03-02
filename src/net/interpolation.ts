import type { SnapshotData, SnapshotEntity } from './snapshot';

interface TimedSnapshot {
  snapshot: SnapshotData;
  tick: number;
  receiveTime: number;
}

export class Interpolator {
  private buffer: TimedSnapshot[] = [];
  private interpolationDelay = 0.07; // 70ms interpolation buffer (2 snapshots at 30Hz)
  private currentTime = 0;
  private hasNew = false;
  private excludedIds = new Set<number>();

  excludeEntity(id: number): void {
    this.excludedIds.add(id);
  }

  /** Returns true once per new pushSnapshot call, then resets */
  consumeNewSnapshot(): boolean {
    const v = this.hasNew;
    this.hasNew = false;
    return v;
  }

  /** Returns the most recent raw (un-interpolated) snapshot */
  getLatestRawSnapshot(): SnapshotData | null {
    return this.buffer.length > 0 ? this.buffer[this.buffer.length - 1].snapshot : null;
  }

  pushSnapshot(snapshot: SnapshotData, tick: number): void {
    const now = this.currentTime;
    this.buffer.push({ snapshot, tick, receiveTime: now });
    this.hasNew = true;

    // Keep buffer bounded - only need a few snapshots for interpolation
    if (this.buffer.length > 10) {
      this.buffer.shift();
    }
  }

  update(dt: number): void {
    this.currentTime += dt;
  }

  getInterpolated(): SnapshotData | null {
    if (this.buffer.length === 0) return null;

    // If only one snapshot, return it directly
    if (this.buffer.length === 1) return this.buffer[0].snapshot;

    const renderTime = this.currentTime - this.interpolationDelay;

    // Find two snapshots to interpolate between
    let from: TimedSnapshot | null = null;
    let to: TimedSnapshot | null = null;

    for (let i = 0; i < this.buffer.length - 1; i++) {
      if (this.buffer[i].receiveTime <= renderTime && this.buffer[i + 1].receiveTime >= renderTime) {
        from = this.buffer[i];
        to = this.buffer[i + 1];
        break;
      }
    }

    // If we can't find a bracket, use the latest snapshot
    if (!from || !to) {
      return this.buffer[this.buffer.length - 1].snapshot;
    }

    // Compute interpolation factor
    const range = to.receiveTime - from.receiveTime;
    const t = range > 0 ? (renderTime - from.receiveTime) / range : 1;

    const result = interpolateSnapshots(from.snapshot, to.snapshot, t);
    if (this.excludedIds.size > 0) {
      return { entities: result.entities.filter(e => !this.excludedIds.has(e.id)) };
    }
    return result;
  }
}

function interpolateSnapshots(from: SnapshotData, to: SnapshotData, t: number): SnapshotData {
  // Build map of "to" entities for lookup
  const toMap = new Map<number, SnapshotEntity>();
  for (const e of to.entities) {
    toMap.set(e.id, e);
  }

  const entities: SnapshotEntity[] = [];

  // Interpolate entities present in both snapshots
  for (const fromEntity of from.entities) {
    const toEntity = toMap.get(fromEntity.id);
    if (toEntity) {
      entities.push(interpolateEntity(fromEntity, toEntity, t));
      toMap.delete(fromEntity.id);
    }
    // Entities only in "from" are being destroyed - skip them at t > 0.5
  }

  // Add new entities from "to" that weren't in "from"
  for (const [, toEntity] of toMap) {
    entities.push(toEntity);
  }

  return { entities };
}

function interpolateEntity(from: SnapshotEntity, to: SnapshotEntity, t: number): SnapshotEntity {
  const components: Record<string, any> = {};

  // Copy all components from "to" as baseline
  for (const [name, data] of Object.entries(to.components)) {
    components[name] = data;
  }

  // Interpolate transform positions
  const fromTransform = from.components['transform'];
  const toTransform = to.components['transform'];
  if (fromTransform && toTransform) {
    components['transform'] = {
      ...toTransform,
      pos: {
        x: fromTransform.pos.x + (toTransform.pos.x - fromTransform.pos.x) * t,
        y: fromTransform.pos.y + (toTransform.pos.y - fromTransform.pos.y) * t,
      },
      prevPos: {
        x: fromTransform.prevPos.x + (toTransform.prevPos.x - fromTransform.prevPos.x) * t,
        y: fromTransform.prevPos.y + (toTransform.prevPos.y - fromTransform.prevPos.y) * t,
      },
    };
  }

  // Interpolate health (smooth HP bar changes)
  const fromHealth = from.components['health'];
  const toHealth = to.components['health'];
  if (fromHealth && toHealth) {
    components['health'] = {
      ...toHealth,
      current: fromHealth.current + (toHealth.current - fromHealth.current) * t,
    };
  }

  return { id: to.id, components };
}
