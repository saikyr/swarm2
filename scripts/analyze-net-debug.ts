import { mkdirSync, readFileSync, writeFileSync } from 'fs';
import { dirname, resolve } from 'path';

type AnyEvent = Record<string, unknown>;

type Bucket =
  | 'prediction_model_mismatch'
  | 'ack_cadence_mismatch'
  | 'snapshot_overwrite_artifact'
  | 'camera_render_coupling'
  | 'hud_source_stepping';

interface ScoreCard {
  bucket: Bucket;
  score: number;
  evidence: string[];
  recommendation: string;
}

interface AnalysisResult {
  primaryBucket: Bucket;
  confidence: number;
  scores: ScoreCard[];
  metrics: {
    reconcilePreErrorP95: number;
    correctionsPerSec: number;
    avgRTT: number;
    avgJitter: number;
    snapshotCouplingRatio: number;
    pendingStdDev: number;
    cameraDeltaP95: number;
    hudDashDiffP95: number;
    hudWeaponDiffP95: number;
    diagonalInputRatio: number;
    authSampleAgeMsP95: number;
  };
}

function main(): void {
  const args = parseArgs(process.argv.slice(2));
  if (args.clientFiles.length === 0) {
    throw new Error('Usage: npx tsx scripts/analyze-net-debug.ts --client=<file> [--client=<file2>] [--host=<file>] [--out=<file>]');
  }

  const hostEvents = args.hostFile ? loadNdjson(args.hostFile) : [];
  const clientEvents = args.clientFiles.flatMap((file) => loadNdjson(file));
  const analysis = analyzeDebugData(hostEvents, clientEvents);
  const markdown = renderReport(analysis, args.hostFile, args.clientFiles);
  const outPath = args.outFile ?? defaultOutPath();
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, markdown, 'utf8');
  console.log(markdown);
  console.log(`\nWrote report: ${outPath}`);
}

function parseArgs(argv: string[]): { hostFile: string | null; clientFiles: string[]; outFile: string | null } {
  let hostFile: string | null = null;
  const clientFiles: string[] = [];
  let outFile: string | null = null;

  for (const arg of argv) {
    if (arg.startsWith('--host=')) {
      hostFile = resolve(arg.slice('--host='.length));
    } else if (arg.startsWith('--client=')) {
      clientFiles.push(resolve(arg.slice('--client='.length)));
    } else if (arg.startsWith('--out=')) {
      outFile = resolve(arg.slice('--out='.length));
    }
  }

  return { hostFile, clientFiles, outFile };
}

function defaultOutPath(): string {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  return resolve(`logs/net-debug/reports/analysis-${stamp}.md`);
}

function loadNdjson(path: string): AnyEvent[] {
  const out: AnyEvent[] = [];
  const text = readFileSync(path, 'utf8');
  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      out.push(JSON.parse(trimmed) as AnyEvent);
    } catch {
      // ignore malformed line
    }
  }
  return out;
}

interface ReconcileSample {
  ts: number;
  preError: number;
  pendingCount: number;
  isCorrection: boolean;
  authSampleAgeMs: number;
}

function toReconcileSeries(events: AnyEvent[]): ReconcileSample[] {
  const tickDriven = events.filter((e) => e.kind === 'reconcile_tick_applied');
  if (tickDriven.length > 0) {
    return tickDriven.map((e) => ({
      ts: num(e.ts),
      preError: num(e.errorBefore),
      pendingCount: num(e.pendingCount),
      isCorrection: e.mode === 'bounded' || e.mode === 'snap',
      authSampleAgeMs: num(e.authSampleAgeMs),
    }));
  }

  const legacy = events.filter((e) => e.kind === 'reconcile');
  return legacy.map((e) => {
    const action = typeof e.action === 'string' ? e.action : 'none';
    return {
      ts: num(e.ts),
      preError: num(e.preError),
      pendingCount: num(e.pendingCount),
      isCorrection: action === 'blend' || action === 'bounded' || action === 'snap',
      authSampleAgeMs: num(e.authSampleAgeMs),
    };
  });
}

export function analyzeDebugData(hostEvents: AnyEvent[], clientEvents: AnyEvent[]): AnalysisResult {
  const reconcile = toReconcileSeries(clientEvents);
  const snapshots = clientEvents.filter((e) => e.kind === 'snapshot_applied');
  const metrics = clientEvents.filter((e) => e.kind === 'metrics');
  const camera = clientEvents.filter((e) => e.kind === 'camera_step');
  const hud = clientEvents.filter((e) => e.kind === 'hud_cooldown_step');
  const input = clientEvents.filter((e) => e.kind === 'input_sample');

  const recPre = reconcile.map((e) => e.preError);
  const pending = reconcile.map((e) => e.pendingCount);
  const snapshotTs = snapshots.map((e) => num(e.ts));
  const recTs = reconcile.filter((e) => e.isCorrection).map((e) => e.ts);
  const rtts = metrics.map((e) => num(e.rttMs));
  const jitters = metrics.map((e) => num(e.jitterP95Ms));
  const cameraDeltas = camera.map((e) => num(e.delta));
  const dashDiff = hud.map((e) => Math.abs(num(e.dashDisplayed) - num(e.dashAuthoritative)));
  const weaponDiff = hud.map((e) => Math.abs(num(e.weaponDisplayedAvg) - num(e.weaponAuthoritativeAvg)));
  const diagonal = input.filter((e) => e.direction === 'diagonal').length;
  const authSampleAges = reconcile.map((e) => e.authSampleAgeMs);

  const durationSec = estimateDurationSec(clientEvents);
  const reconcilePreErrorP95 = p95(recPre);
  const correctionsPerSec = reconcile.filter((e) => e.isCorrection).length / Math.max(1, durationSec);
  const avgRTT = avg(rtts);
  const avgJitter = avg(jitters);
  const snapshotCouplingRatio = couplingRatio(recTs, snapshotTs, 60);
  const pendingStdDev = stddev(pending);
  const cameraDeltaP95 = p95(cameraDeltas);
  const hudDashDiffP95 = p95(dashDiff);
  const hudWeaponDiffP95 = p95(weaponDiff);
  const diagonalInputRatio = diagonal / Math.max(1, input.length);
  const authSampleAgeMsP95 = p95(authSampleAges);

  const scored = scoreBuckets({
    reconcilePreErrorP95,
    correctionsPerSec,
    avgRTT,
    avgJitter,
    snapshotCouplingRatio,
    pendingStdDev,
    cameraDeltaP95,
    hudDashDiffP95,
    hudWeaponDiffP95,
    diagonalInputRatio,
    hostEvents,
  });
  scored.sort((a, b) => b.score - a.score);
  const primary = scored[0];
  const confidence = primary ? clamp(primary.score / 8, 0.2, 0.98) : 0.2;

  return {
    primaryBucket: primary?.bucket ?? 'prediction_model_mismatch',
    confidence,
    scores: scored,
    metrics: {
      reconcilePreErrorP95,
      correctionsPerSec,
      avgRTT,
      avgJitter,
      snapshotCouplingRatio,
      pendingStdDev,
      cameraDeltaP95,
      hudDashDiffP95,
      hudWeaponDiffP95,
      diagonalInputRatio,
      authSampleAgeMsP95,
    },
  };
}

function scoreBuckets(metrics: AnalysisResult['metrics'] & { hostEvents: AnyEvent[] }): ScoreCard[] {
  const cards: ScoreCard[] = [];

  const predEvidence: string[] = [];
  let predScore = 0;
  if (metrics.reconcilePreErrorP95 > 2.5) { predScore += 3; predEvidence.push(`reconcile p95=${round2(metrics.reconcilePreErrorP95)}`); }
  if (metrics.correctionsPerSec > 3) { predScore += 2; predEvidence.push(`corrections/sec=${round2(metrics.correctionsPerSec)}`); }
  if (metrics.avgRTT < 20 && metrics.avgJitter < 5) { predScore += 2; predEvidence.push(`low RTT/jitter (${round2(metrics.avgRTT)}/${round2(metrics.avgJitter)}ms)`); }
  if (metrics.diagonalInputRatio > 0.2) { predScore += 1; predEvidence.push(`diagonal input ratio=${round2(metrics.diagonalInputRatio)}`); }
  if (metrics.authSampleAgeMsP95 > 70) { predScore += 2; predEvidence.push(`auth sample age p95=${round2(metrics.authSampleAgeMsP95)}ms`); }
  cards.push({
    bucket: 'prediction_model_mismatch',
    score: predScore,
    evidence: predEvidence,
    recommendation: 'Path A: fixed-step 60Hz canonical input frames + replay same integrator/timestep.',
  });

  const ackEvidence: string[] = [];
  let ackScore = 0;
  if (metrics.pendingStdDev > 5) { ackScore += 4; ackEvidence.push(`pending stddev=${round2(metrics.pendingStdDev)}`); }
  if (metrics.correctionsPerSec > 3 && metrics.snapshotCouplingRatio > 0.35) { ackScore += 2; ackEvidence.push(`corrections coupled to snapshot windows`); }
  if (hostHasSparseAck(metrics.hostEvents)) { ackScore += 1; ackEvidence.push('host ack stream appears bursty'); }
  cards.push({
    bucket: 'ack_cadence_mismatch',
    score: ackScore,
    evidence: ackEvidence,
    recommendation: 'Path B: increase ack cadence granularity and cap replay queue soft-clamp.',
  });

  const snapshotEvidence: string[] = [];
  let snapshotScore = 0;
  if (metrics.snapshotCouplingRatio > 0.6) { snapshotScore += 4; snapshotEvidence.push(`snapshot coupling ratio=${round2(metrics.snapshotCouplingRatio)}`); }
  if (metrics.reconcilePreErrorP95 > 2.5) { snapshotScore += 2; snapshotEvidence.push(`high pre-error before reconcile`); }
  if (metrics.authSampleAgeMsP95 > 70) { snapshotScore += 2; snapshotEvidence.push(`auth sample age p95=${round2(metrics.authSampleAgeMsP95)}ms`); }
  cards.push({
    bucket: 'snapshot_overwrite_artifact',
    score: snapshotScore,
    evidence: snapshotEvidence,
    recommendation: 'Path C: isolate local player replica from snapshot transform overwrite.',
  });

  const camEvidence: string[] = [];
  let camScore = 0;
  if (metrics.cameraDeltaP95 > 10 && metrics.reconcilePreErrorP95 < 2.5) { camScore += 5; camEvidence.push(`camera jitter p95=${round2(metrics.cameraDeltaP95)} with low reconcile error`); }
  if (metrics.avgJitter < 5) { camScore += 1; camEvidence.push(`network jitter low`); }
  cards.push({
    bucket: 'camera_render_coupling',
    score: camScore,
    evidence: camEvidence,
    recommendation: 'Path D: fully decouple local camera from snapshot interpolation clocks.',
  });

  const hudEvidence: string[] = [];
  let hudScore = 0;
  if (metrics.hudDashDiffP95 > 0.08) { hudScore += 3; hudEvidence.push(`dash cooldown diff p95=${round2(metrics.hudDashDiffP95)}`); }
  if (metrics.hudWeaponDiffP95 > 0.08) { hudScore += 3; hudEvidence.push(`weapon cooldown diff p95=${round2(metrics.hudWeaponDiffP95)}`); }
  if (metrics.reconcilePreErrorP95 < 2.5) { hudScore += 1; hudEvidence.push(`movement corrections low while HUD diff high`); }
  cards.push({
    bucket: 'hud_source_stepping',
    score: hudScore,
    evidence: hudEvidence,
    recommendation: 'Path E: drive local HUD cooldown bars from predicted-smoothed state with authoritative clamp.',
  });

  return cards;
}

function renderReport(analysis: AnalysisResult, hostFile: string | null, clientFiles: string[]): string {
  const m = analysis.metrics;
  const lines: string[] = [];
  lines.push('# Net Debug Analysis Report');
  lines.push('');
  lines.push('## Inputs');
  lines.push(`- Host file: ${hostFile ?? 'none'}`);
  for (const c of clientFiles) lines.push(`- Client file: ${c}`);
  lines.push('');
  lines.push('## Primary Classification');
  lines.push(`- Bucket: \`${analysis.primaryBucket}\``);
  lines.push(`- Confidence: \`${round2(analysis.confidence)}\``);
  lines.push('');
  lines.push('## Metrics');
  lines.push(`- reconcile_error_p95: \`${round2(m.reconcilePreErrorP95)}\``);
  lines.push(`- corrections_per_sec: \`${round2(m.correctionsPerSec)}\``);
  lines.push(`- avg_rtt_ms: \`${round2(m.avgRTT)}\``);
  lines.push(`- avg_jitter_ms: \`${round2(m.avgJitter)}\``);
  lines.push(`- snapshot_coupling_ratio: \`${round2(m.snapshotCouplingRatio)}\``);
  lines.push(`- pending_stddev: \`${round2(m.pendingStdDev)}\``);
  lines.push(`- camera_delta_p95: \`${round2(m.cameraDeltaP95)}\``);
  lines.push(`- hud_dash_diff_p95: \`${round2(m.hudDashDiffP95)}\``);
  lines.push(`- hud_weapon_diff_p95: \`${round2(m.hudWeaponDiffP95)}\``);
  lines.push(`- diagonal_input_ratio: \`${round2(m.diagonalInputRatio)}\``);
  lines.push(`- auth_sample_age_ms_p95: \`${round2(m.authSampleAgeMsP95)}\``);
  lines.push('');
  lines.push('## Tick-Reconcile Gates');
  lines.push(`- reconcile_error_p95 <= 2.0: \`${m.reconcilePreErrorP95 <= 2.0 ? 'pass' : 'fail'}\``);
  lines.push(`- corrections_per_sec <= 3.0: \`${m.correctionsPerSec <= 3.0 ? 'pass' : 'fail'}\``);
  lines.push(`- snapshot_coupling_ratio <= 0.35: \`${m.snapshotCouplingRatio <= 0.35 ? 'pass' : 'fail'}\``);
  lines.push('');
  lines.push('## Bucket Scores');
  for (const card of analysis.scores) {
    lines.push(`### ${card.bucket}`);
    lines.push(`- score: \`${round2(card.score)}\``);
    lines.push(`- recommendation: ${card.recommendation}`);
    if (card.evidence.length === 0) {
      lines.push('- evidence: none');
    } else {
      for (const ev of card.evidence) lines.push(`- evidence: ${ev}`);
    }
    lines.push('');
  }
  return lines.join('\n');
}

function estimateDurationSec(events: AnyEvent[]): number {
  const ts = events.map((e) => num(e.ts)).filter((n) => n > 0);
  if (ts.length < 2) return 1;
  return (Math.max(...ts) - Math.min(...ts)) / 1000;
}

function couplingRatio(a: number[], b: number[], windowMs: number): number {
  if (a.length === 0 || b.length === 0) return 0;
  let coupled = 0;
  for (const v of a) {
    if (nearestWithin(v, b, windowMs)) coupled++;
  }
  return coupled / a.length;
}

function nearestWithin(v: number, values: number[], windowMs: number): boolean {
  for (const n of values) {
    if (Math.abs(v - n) <= windowMs) return true;
  }
  return false;
}

function hostHasSparseAck(hostEvents: AnyEvent[]): boolean {
  const ack = hostEvents.filter((e) => e.kind === 'ack_state');
  if (ack.length < 3) return true;
  const ts = ack.map((e) => num(e.ts)).sort((a, b) => a - b);
  const gaps: number[] = [];
  for (let i = 1; i < ts.length; i++) gaps.push(ts[i] - ts[i - 1]);
  return p95(gaps) > 200;
}

function num(v: unknown): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : 0;
}

function p95(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95));
  return sorted[idx] ?? 0;
}

function avg(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function stddev(values: number[]): number {
  if (values.length === 0) return 0;
  const mean = avg(values);
  const variance = avg(values.map((v) => (v - mean) ** 2));
  return Math.sqrt(variance);
}

function round2(v: number): number {
  return Math.round(v * 100) / 100;
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
