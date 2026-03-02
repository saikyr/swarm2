import { PLAYER, TRANSFORM, type Player, type Transform, type Velocity } from '../components';
import type { World } from '../ecs/ecs';
import { BUTTON_ABILITY, BUTTON_DASH, type InputFrameV2 } from '../net-v2/protocol';
import { netDebug, type PredictionSource, type ReconcileAction } from '../debug/net-debug';
import { applyNormalPlayerVelocity, integratePlayerVelocity } from '../sim-core/local-move';

interface PendingFrame {
  frame: InputFrameV2;
}

interface AuthoritativeSample {
  x: number;
  y: number;
  ackSeq: number;
  receivedAtMs: number;
}

export class LocalPrediction {
  private pending: PendingFrame[] = [];
  private nextSeq = 1;
  private latestSample: AuthoritativeSample | null = null;
  private targetSample: AuthoritativeSample | null = null;
  private lastAckApplied = 0;

  private readonly deadzone = 1.5;
  private readonly correctionGain = 10;
  private readonly maxCorrectionSpeed = 180;
  private readonly snapThreshold = 40;

  getPendingCount(): number {
    return this.pending.length;
  }

  createInputFrame(playerId: number, clientTick: number, moveX: number, moveY: number, dash: boolean, ability: boolean): InputFrameV2 {
    let buttons = 0;
    if (dash) buttons |= BUTTON_DASH;
    if (ability) buttons |= BUTTON_ABILITY;

    return {
      playerId,
      seq: this.nextSeq++,
      clientTick,
      moveX,
      moveY,
      buttons,
    };
  }

  enqueue(frame: InputFrameV2): void {
    this.pending.push({ frame });
    if (this.pending.length > 120) {
      this.pending.splice(0, this.pending.length - 120);
    }
  }

  ingestAuthoritativeSample(sample: { x: number; y: number; ackSeq: number; receivedAtMs: number }): void {
    if (!Number.isFinite(sample.x) || !Number.isFinite(sample.y)) return;
    if (!Number.isFinite(sample.ackSeq) || sample.ackSeq < 0) return;
    if (this.latestSample && sample.ackSeq < this.latestSample.ackSeq) return;
    this.latestSample = {
      x: sample.x,
      y: sample.y,
      ackSeq: sample.ackSeq,
      receivedAtMs: sample.receivedAtMs,
    };
  }

  applyLivePrediction(world: World, localPlayerId: number, frame: InputFrameV2, dt: number): void {
    const local = findLocal(world, localPlayerId);
    if (!local) return;
    applyFrame(local.transform, local.player, frame, dt, 'immediate');
  }

  tickReconcile(world: World, localPlayerId: number, dt: number, nowMs: number): void {
    const local = findLocal(world, localPlayerId);
    if (!local) return;
    if (!this.latestSample) return;

    if (this.latestSample.ackSeq > this.lastAckApplied) {
      this.pending = this.pending.filter((p) => p.frame.seq > this.latestSample!.ackSeq);
      const replayTransform: Transform = {
        pos: { x: this.latestSample.x, y: this.latestSample.y },
        prevPos: { x: this.latestSample.x, y: this.latestSample.y },
        rotation: local.transform.rotation,
      };
      const replayPlayer = {
        speed: local.player.speed,
        speedMultiplier: local.player.speedMultiplier,
        chilledTimer: local.player.chilledTimer,
      };
      for (const p of this.pending) {
        applyFrame(replayTransform, replayPlayer, p.frame, 1 / 60, 'replay');
      }
      this.targetSample = {
        x: replayTransform.pos.x,
        y: replayTransform.pos.y,
        ackSeq: this.latestSample.ackSeq,
        receivedAtMs: this.latestSample.receivedAtMs,
      };
      this.lastAckApplied = this.latestSample.ackSeq;
    }
    if (!this.targetSample) return;

    const dx = this.targetSample.x - local.transform.pos.x;
    const dy = this.targetSample.y - local.transform.pos.y;
    const errorBefore = Math.hypot(dx, dy);
    const authSampleAgeMs = Math.max(0, nowMs - this.targetSample.receivedAtMs);
    let mode: 'none' | 'bounded' | 'snap' = 'none';
    let correctionDelta = 0;

    if (errorBefore > this.snapThreshold) {
      local.transform.prevPos.x = local.transform.pos.x;
      local.transform.prevPos.y = local.transform.pos.y;
      local.transform.pos.x = this.targetSample.x;
      local.transform.pos.y = this.targetSample.y;
      correctionDelta = errorBefore;
      mode = 'snap';
    } else if (errorBefore >= this.deadzone) {
      const unitX = dx / errorBefore;
      const unitY = dy / errorBefore;
      const correctionSpeed = Math.min(this.maxCorrectionSpeed, errorBefore * this.correctionGain);
      const step = Math.min(errorBefore, correctionSpeed * dt);
      local.transform.prevPos.x = local.transform.pos.x;
      local.transform.prevPos.y = local.transform.pos.y;
      local.transform.pos.x += unitX * step;
      local.transform.pos.y += unitY * step;
      correctionDelta = step;
      mode = 'bounded';
    }

    const postDx = this.targetSample.x - local.transform.pos.x;
    const postDy = this.targetSample.y - local.transform.pos.y;
    const errorAfter = Math.hypot(postDx, postDy);
    const ts = Date.now();

    netDebug.log({
      kind: 'reconcile_tick_applied',
      ts,
      ackSeq: this.targetSample.ackSeq,
      pendingCount: this.pending.length,
      errorBefore,
      errorAfter,
      corrDelta: correctionDelta,
      mode,
      authSampleAgeMs,
    });

    if (mode !== 'none') {
      const action: ReconcileAction = mode === 'snap' ? 'snap' : 'bounded';
      netDebug.log({
        kind: 'reconcile',
        ts,
        ackSeq: this.targetSample.ackSeq,
        pendingCount: this.pending.length,
        preError: errorBefore,
        postError: errorAfter,
        action,
        authSampleAgeMs,
      });
    }
  }
}

function findLocal(world: World, localPlayerId: number): { transform: Transform; player: Player } | null {
  for (const entity of world.query(PLAYER, TRANSFORM)) {
    const player = world.getComponent<Player>(entity, PLAYER);
    if (!player || player.playerId !== localPlayerId) continue;
    const transform = world.getComponent<Transform>(entity, TRANSFORM);
    if (!transform) return null;
    return { transform, player };
  }
  return null;
}

function applyFrame(
  transform: Transform,
  player: Pick<Player, 'speed' | 'speedMultiplier' | 'chilledTimer'>,
  frame: InputFrameV2,
  dt: number,
  source: PredictionSource,
): void {
  const beforeX = transform.pos.x;
  const beforeY = transform.pos.y;
  const localVel: Velocity = { x: 0, y: 0 };
  applyNormalPlayerVelocity(player, localVel, frame.moveX, frame.moveY, dt);
  integratePlayerVelocity(transform, localVel, dt);

  // Dash is host-authoritative; avoid client-side burst offsets here.
  // This prevents invalid local jumps when dash-only fields are stale/missing.
  if (!Number.isFinite(transform.pos.x) || !Number.isFinite(transform.pos.y)) {
    transform.pos.x = transform.prevPos.x;
    transform.pos.y = transform.prevPos.y;
  }
  netDebug.logSample(`prediction_${source}`, {
    kind: 'prediction_step',
    ts: Date.now(),
    source,
    dt,
    dx: transform.pos.x - beforeX,
    dy: transform.pos.y - beforeY,
  });
}
