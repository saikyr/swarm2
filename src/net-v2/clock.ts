export class NetClock {
  private lastSnapshotAt = 0;
  private intervals: number[] = [];
  private rttMs = 0;

  markSnapshotReceive(nowMs: number): void {
    if (this.lastSnapshotAt > 0) {
      const interval = nowMs - this.lastSnapshotAt;
      this.intervals.push(interval);
      if (this.intervals.length > 64) this.intervals.shift();
    }
    this.lastSnapshotAt = nowMs;
  }

  markPong(sentAtMs: number, nowMs: number): void {
    const sample = Math.max(0, nowMs - sentAtMs);
    // EWMA smoothing
    this.rttMs = this.rttMs <= 0 ? sample : this.rttMs * 0.85 + sample * 0.15;
  }

  getRTTMs(): number {
    return this.rttMs;
  }

  getJitterP95Ms(): number {
    if (this.intervals.length < 4) return 0;
    const diffs: number[] = [];
    for (let i = 1; i < this.intervals.length; i++) {
      diffs.push(Math.abs(this.intervals[i] - this.intervals[i - 1]));
    }
    diffs.sort((a, b) => a - b);
    const idx = Math.min(diffs.length - 1, Math.floor(diffs.length * 0.95));
    return diffs[idx] ?? 0;
  }

  getInterpolationDelayMs(): number {
    const jitter = this.getJitterP95Ms();
    const delay = 80 + jitter;
    return Math.max(80, Math.min(140, delay));
  }

  getLastSnapshotAt(): number {
    return this.lastSnapshotAt;
  }
}
