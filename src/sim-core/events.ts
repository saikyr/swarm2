import type { RunEventBodyV2, RunEventV2 } from '../net-v2/protocol';

const MAX_PENDING_RUN_EVENTS = 2048;

let nextId = 1;
let pending: RunEventV2[] = [];
let broadcastEnabled = false;

export function setRunEventBroadcastEnabled(enabled: boolean): void {
  broadcastEnabled = enabled;
  if (!enabled) {
    pending = [];
  }
}

export function clearRunEvents(): void {
  pending = [];
  nextId = 1;
}

export function emitRunEvent(event: RunEventBodyV2): void {
  if (!broadcastEnabled) return;
  pending.push({ id: nextId++, ...event });
  if (pending.length > MAX_PENDING_RUN_EVENTS) {
    pending.splice(0, pending.length - MAX_PENDING_RUN_EVENTS);
  }
}

export function drainRunEvents(maxEvents = 256): RunEventV2[] {
  if (maxEvents <= 0 || pending.length === 0) return [];
  if (pending.length <= maxEvents) {
    const out = pending;
    pending = [];
    return out;
  }
  const out = pending.slice(0, maxEvents);
  pending = pending.slice(maxEvents);
  return out;
}

export class SimEventQueue {
  private nextId = 1;
  private pending: RunEventV2[] = [];

  pushBeam(x0: number, y0: number, x1: number, y1: number): void {
    this.pending.push({ id: this.nextId++, type: 'beam', x0, y0, x1, y1 });
  }

  drain(): RunEventV2[] {
    if (this.pending.length === 0) return [];
    const out = this.pending;
    this.pending = [];
    return out;
  }
}
