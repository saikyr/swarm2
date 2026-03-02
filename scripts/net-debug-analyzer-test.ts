import assert from 'node:assert/strict';
import { analyzeDebugData } from './analyze-net-debug';

function main(): void {
  testPredictionMismatchClassification();
  testHudSteppingClassification();
  console.log('net-debug-analyzer: OK');
}

function testPredictionMismatchClassification(): void {
  const now = Date.now();
  const clientEvents: Array<Record<string, unknown>> = [];
  for (let i = 0; i < 120; i++) {
    clientEvents.push({
      kind: 'input_sample',
      ts: now + i * 16,
      moveX: 0.7,
      moveY: 0.7,
      direction: 'diagonal',
    });
  }
  for (let i = 0; i < 90; i++) {
    clientEvents.push({
      kind: 'reconcile',
      ts: now + i * 22,
      preError: 6 + (i % 3),
      postError: 2,
      pendingCount: 14 + (i % 5),
      ackSeq: i,
      action: 'blend',
    });
  }
  for (let i = 0; i < 6; i++) {
    clientEvents.push({
      kind: 'metrics',
      ts: now + i * 5000,
      rttMs: 4,
      jitterP95Ms: 2,
    });
  }
  const result = analyzeDebugData([], clientEvents);
  assert.equal(result.primaryBucket, 'prediction_model_mismatch');
  assert.ok(result.confidence >= 0.4);
}

function testHudSteppingClassification(): void {
  const now = Date.now();
  const clientEvents: Array<Record<string, unknown>> = [];
  for (let i = 0; i < 120; i++) {
    clientEvents.push({
      kind: 'hud_cooldown_step',
      ts: now + i * 16,
      dashDisplayed: 0.9 - i * 0.002,
      dashAuthoritative: 0.9 - i * 0.002 - 0.2,
      weaponDisplayedAvg: 0.6,
      weaponAuthoritativeAvg: 0.35,
    });
    clientEvents.push({
      kind: 'reconcile',
      ts: now + i * 16,
      preError: 0.6,
      postError: 0.2,
      pendingCount: 1,
      ackSeq: i,
      action: 'none',
    });
  }
  const result = analyzeDebugData([], clientEvents);
  assert.equal(result.primaryBucket, 'hud_source_stepping');
}

main();
