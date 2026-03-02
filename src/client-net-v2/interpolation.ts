import { NetClock } from '../net-v2/clock';

export class InterpolationController {
  private clock: NetClock;

  constructor(clock: NetClock) {
    this.clock = clock;
  }

  getRenderAlpha(nowMs: number, lastSnapshotAtMs: number, snapshotIntervalMs: number): number {
    const delayMs = this.clock.getInterpolationDelayMs();
    const adjustedElapsed = nowMs - lastSnapshotAtMs - delayMs;
    const t = adjustedElapsed / Math.max(1, snapshotIntervalMs);
    return Math.max(0, Math.min(1, t));
  }
}
