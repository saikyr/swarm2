interface MetricWindow {
  tickMs: number[];
  snapshotMs: number[];
  payloadBytes: number[];
  applyMs: number[];
}

export class SessionMetrics {
  private readonly roomCode: string;
  private readonly window: MetricWindow = {
    tickMs: [],
    snapshotMs: [],
    payloadBytes: [],
    applyMs: [],
  };
  private lastLogAt = Date.now();

  constructor(roomCode: string) {
    this.roomCode = roomCode;
  }

  trackTick(ms: number): void {
    push(this.window.tickMs, ms);
  }

  trackSnapshot(ms: number): void {
    push(this.window.snapshotMs, ms);
  }

  trackPayload(bytes: number): void {
    push(this.window.payloadBytes, bytes);
  }

  trackApply(ms: number): void {
    push(this.window.applyMs, ms);
  }

  maybeLog(entityCount: number): void {
    const now = Date.now();
    if (now - this.lastLogAt < 5000) return;
    this.lastLogAt = now;

    const log = {
      room: this.roomCode,
      tickP95: p95(this.window.tickMs),
      snapshotP95: p95(this.window.snapshotMs),
      payloadP95: p95(this.window.payloadBytes),
      applyP95: p95(this.window.applyMs),
      entityCount,
    };

    console.log('[metrics]', JSON.stringify(log));

    this.window.tickMs.length = 0;
    this.window.snapshotMs.length = 0;
    this.window.payloadBytes.length = 0;
    this.window.applyMs.length = 0;
  }
}

function push(arr: number[], value: number): void {
  arr.push(value);
  if (arr.length > 512) arr.shift();
}

function p95(arr: number[]): number {
  if (arr.length === 0) return 0;
  const copy = [...arr].sort((a, b) => a - b);
  const idx = Math.min(copy.length - 1, Math.floor(copy.length * 0.95));
  return round(copy[idx] ?? 0);
}

function round(v: number): number {
  return Math.round(v * 100) / 100;
}
