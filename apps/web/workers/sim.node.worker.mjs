// apps/web/workers/sim.node.worker.mjs
//
// T-40. The `worker_thread` entry point spawned by lib/pool.ts, one per pool
// slot, created once and reused for every simulation the pool ever runs.
//
// Speaks the LOG.md sec 7.14 protocol -- WorkerRequest in, WorkerResponse out,
// the caller-generated `id` echoed on every reply -- the same protocol the
// browser Web Worker (T-43) will speak, so the two are interchangeable from a
// caller's point of view. This file only ever answers a 'simulate' request;
// 'sweep' is a pool.runMany() of many 'simulate' requests, dispatched by
// lib/pool.ts, not a message kind this worker itself understands, and
// 'cancel' is handled entirely on the main-thread side (an in-flight
// simulate() cannot be preempted mid-solve, and the pool's contract only
// promises queued work stops dispatching -- see pool.ts's run()/runMany()).
//
// Float64Array is not guaranteed to survive structured clone on every
// runtime this protocol targets (the point of sharing sec 7.14 with the
// browser worker), so every request/result crosses this boundary as plain
// JSON via T-06's requestFromJson/resultToJson -- the one place in the repo
// permitted to do that conversion.

import { parentPort } from 'node:worker_threads';
import { EngineError, requestFromJson, resultToJson, simulate } from '@shelter/engine';

if (!parentPort) {
  throw new Error('sim.node.worker.mjs must be run as a worker_thread, not imported directly.');
}

parentPort.on('message', (msg) => {
  if (msg.kind !== 'simulate') return;

  try {
    const request = requestFromJson(msg.payload);
    const result = simulate(request);
    parentPort.postMessage({ id: msg.id, kind: 'result', payload: resultToJson(result) });
  } catch (err) {
    if (err instanceof EngineError) {
      parentPort.postMessage({ id: msg.id, kind: 'error', code: err.code, message: err.message });
    } else {
      // CONTRACTS.md sec 7.8: the engine only ever throws EngineError, so this
      // branch should be unreachable in practice. Kept as a defensive fallback
      // -- ponytail: SOLVER_DIVERGED is the closest of the eight closed
      // EngineErrorCode values to "something went wrong that isn't a
      // validation problem"; if a real non-EngineError failure mode shows up
      // here, that is itself a bug report against the engine, not this file.
      const message = err instanceof Error ? err.message : String(err);
      parentPort.postMessage({ id: msg.id, kind: 'error', code: 'SOLVER_DIVERGED', message });
    }
  }
});
