# Networking V2 Notes

This file is the working reference for the netcode refactor, local debugging, and movement-stutter triage.

## Current Model

- Transport: WebSocket + JSON
- Authority: host-authoritative
- Sim tick: 60 Hz
- Snapshot send: 20 Hz
- Local client player: prediction + tick-driven reconcile
- Remote entities: snapshot replication/interpolation

## Refactor Work Completed

- Extracted shared movement integration into `src/sim-core/local-move.ts`.
- Updated host movement system to use shared movement integrator.
- Replaced snapshot-triggered local reconcile with 60 Hz tick-driven reconcile.
- Added local authoritative sample ingest path in prediction.
- Added bounded correction controller (`deadzone` + bounded speed + snap threshold).
- Updated replica handling so local transform/velocity are not reapplied each incremental snapshot.
- Added debug event `reconcile_tick_applied` and analyzer support for tick-reconcile metrics.
- Added targeted regression tests for tick-driven reconcile, local replica skip, and host/client movement-model parity.

## Important Runtime Flags

Client (`vite` env):

- `VITE_NETCODE_V2_ENABLED` (default `true`)
- `VITE_NETCODE_V2_PREDICTION_ENABLED` (default `true`)
- `VITE_NETCODE_V2_DELTAS_ENABLED` (default `true`)
- `VITE_NET_RECONCILE_TICK_V2` (default `true`)
- `VITE_NET_DEBUG_ENABLED` (default `false`)
- `VITE_NET_DEBUG_SAMPLING_HZ` (default `10`)

Server (`node` env):

- `NET_DEBUG_ENABLED` (default `false`)
- `NET_DEBUG_DIR` (default `./logs/net-debug`)

## Key Files

- `src/game/game.ts`: snapshot ingest, fixed-step input send, fixed-step reconcile, HUD smoothing.
- `src/client-net-v2/prediction.ts`: input queue, authoritative sample ingest, tick-driven reconcile controller.
- `src/client-net-v2/replica-store.ts`: lane merge and local-player snapshot behavior.
- `src/sim-core/local-move.ts`: shared movement math for host + client prediction.
- `scripts/analyze-net-debug.ts`: NDJSON analysis and root-cause classification.

## Debug Logging Setup

Start server with host logging:

```bash
NET_DEBUG_ENABLED=1 npm run server
```

Start client with browser logging:

```bash
VITE_NET_DEBUG_ENABLED=1 VITE_NET_DEBUG_SAMPLING_HZ=10 npm run dev
```

In browser console:

```js
window.__netDebug.summary()
window.__netDebug.dump()
```

If `window.__netDebug` is `undefined`, restart both processes with the flags above and hard-refresh the page.

## Log Locations

- Host NDJSON: `logs/net-debug/host-<ROOM>-<STAMP>.ndjson`
- Client NDJSON: browser download (`client-<ROOM>-p<PLAYER>-<STAMP>.ndjson`)
- Analyzer reports: `logs/net-debug/reports/*.md`

## Analyzer Command

```bash
npm run analyze:netdebug -- \
  --host=/absolute/path/to/host.ndjson \
  --client=/absolute/path/to/client-host.ndjson \
  --client=/absolute/path/to/client-joiner.ndjson \
  --out=/absolute/path/to/report.md
```

## Test Commands

Core net tests:

```bash
npm run test:netv2
npm run test:netv2:loss
npm run test:netv2:reconcile
```

Stutter-focused tests:

```bash
npm run test:prediction:diagonal
npm run test:reconcile:tick-driven
npm run test:replica:skip-local-player
npm run test:movement-model-parity
```

Debug/analyzer tests:

```bash
npm run test:netdebug:schema
npm run test:netdebug:analyzer
```

Build:

```bash
npm run build
```

## Manual Co-op Validation (Joiner Focus)

Run with 2 clients (host + joiner) and execute 60s each:

1. hold `W`
2. hold `W+A`
3. alternate `W` and `W+A` every ~2s
4. hold `W+A` and tap dash every ~3s

Then dump logs from both clients and run analyzer.

## Current Practical Guidance

- If gameplay feels smooth and no major visual regressions appear, ship this state.
- Keep debug instrumentation in place for future captures.
- Re-open tuning only if live sessions report joiner stutter or cooldown/UI stepping.
