import assert from 'node:assert/strict';
import { directionClass, netDebug, type NetDebugEvent } from '../src/debug/net-debug';

function main(): void {
  assert.equal(directionClass(0, 0), 'idle');
  assert.equal(directionClass(1, 0), 'cardinal');
  assert.equal(directionClass(0.5, -0.5), 'diagonal');

  const sample: NetDebugEvent = {
    kind: 'input_sample',
    ts: Date.now(),
    dt: 1 / 60,
    moveX: 1,
    moveY: 0,
    buttons: 0,
    direction: 'cardinal',
  };
  netDebug.log(sample);
  const summary = netDebug.summary();
  assert.ok(Number.isFinite(summary.eventCount), 'summary must return finite eventCount');

  console.log('net-debug-schema: OK');
}

main();
