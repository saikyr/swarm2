const env = (import.meta as unknown as { env?: Record<string, string | undefined> }).env ?? {};

function enabled(name: string, fallback = false): boolean {
  const raw = env[name];
  if (raw == null) return fallback;
  return raw === '1' || raw.toLowerCase() === 'true' || raw.toLowerCase() === 'yes';
}

function intEnv(name: string, fallback: number): number {
  const raw = env[name];
  if (!raw) return fallback;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.floor(parsed);
}

export const NET_DEBUG_ENABLED = enabled('VITE_NET_DEBUG_ENABLED', false);
export const NET_DEBUG_SAMPLING_HZ = intEnv('VITE_NET_DEBUG_SAMPLING_HZ', 10);

export type DirectionClass = 'idle' | 'cardinal' | 'diagonal';
export type ReconcileAction = 'none' | 'blend' | 'bounded' | 'snap' | 'ignore_deadzone';
export type PredictionSource = 'immediate' | 'replay' | 'blend';

interface BaseEvent {
  kind: string;
  ts: number;
}

export interface InputSampleEvent extends BaseEvent {
  kind: 'input_sample';
  dt: number;
  moveX: number;
  moveY: number;
  buttons: number;
  direction: DirectionClass;
}

export interface InputSentEvent extends BaseEvent {
  kind: 'input_sent';
  seq: number;
  clientTick: number;
  moveX: number;
  moveY: number;
  buttons: number;
}

export interface SnapshotReceivedEvent extends BaseEvent {
  kind: 'snapshot_received';
  serverTick: number;
  baselineTick: number | null;
  full: boolean;
  ackSeq: number;
  queueDepth: number;
}

export interface SnapshotAppliedEvent extends BaseEvent {
  kind: 'snapshot_applied';
  applyMs: number;
  entityCount: number;
  removedCount: number;
}

export interface ReplicaMergeEvent extends BaseEvent {
  kind: 'replica_merge';
  full: boolean;
  players: number;
  enemies: number;
  projectiles: number;
  pickups: number;
  weapons: number;
  effects: number;
}

export interface ReconcileEvent extends BaseEvent {
  kind: 'reconcile';
  ackSeq: number;
  pendingCount: number;
  preError: number;
  postError: number;
  action: ReconcileAction;
  authSampleAgeMs?: number;
}

export interface ReconcileTickAppliedEvent extends BaseEvent {
  kind: 'reconcile_tick_applied';
  ackSeq: number;
  pendingCount: number;
  errorBefore: number;
  errorAfter: number;
  corrDelta: number;
  mode: 'none' | 'bounded' | 'snap';
  authSampleAgeMs: number;
}

export interface PredictionStepEvent extends BaseEvent {
  kind: 'prediction_step';
  source: PredictionSource;
  dt: number;
  dx: number;
  dy: number;
}

export interface CameraStepEvent extends BaseEvent {
  kind: 'camera_step';
  dt: number;
  delta: number;
  targetDelta: number;
}

export interface HudCooldownStepEvent extends BaseEvent {
  kind: 'hud_cooldown_step';
  dt: number;
  dashDisplayed: number;
  dashAuthoritative: number;
  weaponDisplayedAvg: number;
  weaponAuthoritativeAvg: number;
}

export interface NetMetricsEvent extends BaseEvent {
  kind: 'metrics';
  role: 'solo' | 'host' | 'client';
  tick: number;
  entityCount: number;
  hostSnapshotP95Ms: number;
  hostPayloadP95Bytes: number;
  clientApplyP95Ms: number;
  rttMs: number;
  jitterP95Ms: number;
}

export interface HostInputAppliedEvent extends BaseEvent {
  kind: 'host_input_applied';
  playerId: number;
  seq: number;
  clientTick: number;
  moveX: number;
  moveY: number;
  buttons: number;
}

export interface HostPlayerStateEvent extends BaseEvent {
  kind: 'host_player_state';
  playerId: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  isDashing: boolean;
  speed: number;
  speedMultiplier: number;
}

export interface SnapshotBuiltEvent extends BaseEvent {
  kind: 'snapshot_built';
  targetPlayerId: number;
  full: boolean;
  lanes: {
    players: number;
    enemies: number;
    projectiles: number;
    pickups: number;
    weapons: number;
    effects: number;
  };
  bytes: number;
  buildMs: number;
}

export interface AckStateEvent extends BaseEvent {
  kind: 'ack_state';
  values: Array<{ playerId: number; lastSeq: number }>;
}

export type NetDebugEvent =
  | InputSampleEvent
  | InputSentEvent
  | SnapshotReceivedEvent
  | SnapshotAppliedEvent
  | ReplicaMergeEvent
  | ReconcileEvent
  | ReconcileTickAppliedEvent
  | PredictionStepEvent
  | CameraStepEvent
  | HudCooldownStepEvent
  | NetMetricsEvent
  | HostInputAppliedEvent
  | HostPlayerStateEvent
  | SnapshotBuiltEvent
  | AckStateEvent;

export interface NetDebugSessionMeta {
  role: 'solo' | 'host' | 'client' | 'server';
  roomCode: string;
  playerId: number;
  build: string;
  startedAt: number;
  timezone: string;
}

export interface NetDebugSummary {
  eventCount: number;
  reconcileErrorP95: number;
  reconcilePerSec: number;
  avgApplyMs: number;
}

class NetDebugClientLogger {
  readonly enabled = NET_DEBUG_ENABLED;
  private readonly events: NetDebugEvent[] = [];
  private readonly sampleState = new Map<string, number>();
  private readonly maxEvents = 120000;
  private shortcutInstalled = false;
  private meta: NetDebugSessionMeta = {
    role: 'solo',
    roomCode: 'none',
    playerId: -1,
    build: env.VITE_APP_BUILD ?? env.MODE ?? 'dev',
    startedAt: Date.now(),
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'unknown',
  };

  setSession(update: Partial<NetDebugSessionMeta>): void {
    if (!this.enabled) return;
    this.meta = { ...this.meta, ...update };
    this.installWindowBindings();
  }

  getSession(): NetDebugSessionMeta {
    return { ...this.meta };
  }

  log(event: NetDebugEvent): void {
    if (!this.enabled) return;
    this.events.push(event);
    if (this.events.length > this.maxEvents) {
      this.events.splice(0, this.events.length - this.maxEvents);
    }
  }

  logSample(sampleKey: string, event: NetDebugEvent): void {
    if (!this.enabled) return;
    const now = event.ts;
    const minGapMs = 1000 / Math.max(1, NET_DEBUG_SAMPLING_HZ);
    const last = this.sampleState.get(sampleKey) ?? -Infinity;
    if (now - last < minGapMs) return;
    this.sampleState.set(sampleKey, now);
    this.log(event);
  }

  dump(): string | null {
    if (!this.enabled) return null;
    if (typeof window === 'undefined' || typeof document === 'undefined') return null;
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `client-${this.meta.roomCode}-p${this.meta.playerId}-${timestamp}.ndjson`;
    const lines: string[] = [];
    lines.push(JSON.stringify({ kind: 'session_meta', ...this.meta }));
    for (const event of this.events) {
      lines.push(JSON.stringify(event));
    }
    const blob = new Blob([lines.join('\n') + '\n'], { type: 'application/x-ndjson' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    return filename;
  }

  summary(): NetDebugSummary {
    const reconcile = this.events.filter((e): e is ReconcileEvent => e.kind === 'reconcile');
    const snapshotApplied = this.events.filter((e): e is SnapshotAppliedEvent => e.kind === 'snapshot_applied');
    const started = this.meta.startedAt;
    const elapsedSec = Math.max(1, (Date.now() - started) / 1000);
    return {
      eventCount: this.events.length,
      reconcileErrorP95: p95(reconcile.map((e) => e.preError)),
      reconcilePerSec: reconcile.length / elapsedSec,
      avgApplyMs: avg(snapshotApplied.map((e) => e.applyMs)),
    };
  }

  private installWindowBindings(): void {
    if (!this.enabled) return;
    if (typeof window === 'undefined') return;
    const w = window as typeof window & { __netDebug?: { dump: () => string | null; summary: () => NetDebugSummary } };
    w.__netDebug = {
      dump: () => this.dump(),
      summary: () => this.summary(),
    };
    if (this.shortcutInstalled) return;
    this.shortcutInstalled = true;
    window.addEventListener('keydown', (e) => {
      if (e.ctrlKey && e.altKey && e.code === 'KeyL') {
        this.dump();
      }
    });
  }
}

function avg(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function p95(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95));
  return sorted[idx] ?? 0;
}

export function directionClass(moveX: number, moveY: number): DirectionClass {
  const x = Math.abs(moveX) > 1e-4;
  const y = Math.abs(moveY) > 1e-4;
  if (!x && !y) return 'idle';
  if (x && y) return 'diagonal';
  return 'cardinal';
}

export const netDebug = new NetDebugClientLogger();
