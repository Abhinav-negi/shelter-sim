// apps/web/workers/sim.worker.ts
//
// T-43 (log/AREA-F-frontend.md). The browser-side half of the LOG.md sec 7.14
// protocol -- the Node worker_threads half is lib/pool.ts / sim.node.worker.mjs
// (T-40). Both speak the same WorkerRequest/WorkerResponse shapes, imported
// from @shelter/engine, never redefined here, so the two stay interchangeable
// from a caller's point of view (workerClient.ts is the caller for this one).
//
// This is the OFFLINE STORY (plan.md Part 4): when the server is unreachable,
// workerClient.ts routes here instead, and the user still gets a temperature
// curve computed entirely client-side, because @shelter/engine is a pure,
// zero-dependency package that runs identically in a browser tab.
//
// Only ONE always-on worker (not a pool -- T-40 owns the server-side pool;
// deliberately no sweep-worker-pool here, per this task's own prompt).
// 'sweep' is therefore not implemented: a browser sweep is workerClient.ts
// calling runSimulation() (i.e. this same 'simulate' message) once per
// variant, same as lib/pool.ts's runMany() does server-side.
//
// Like sim.node.worker.mjs, every request/result crosses postMessage as plain
// JSON via T-06's requestFromJson/resultToJson -- not because structured clone
// cannot carry a Float64Array in a browser (it can), but because this wire
// protocol is shared with the HTTP /api/simulate boundary, which cannot, and
// lib/pool.ts already established "always JSON, in one place, on both ends"
// as the rule for this protocol. workerClient.ts mirrors the same convention
// on its side (requestToJson before postMessage, resultFromJson after).
//
// A thrown EngineError becomes a typed `{ id, kind: 'error', code, message }`
// response; nothing may throw out of the message handler and become an
// unhandled exception inside the worker (CONTRACTS.md sec 7.8: the engine
// never throws a bare Error, but this handler guards the non-EngineError case
// too, same defensive fallback sim.node.worker.mjs uses).
//
// Isomorphic entry point: a real browser (or bundled module) Worker exposes
// `self`/`postMessage`/`addEventListener('message', ...)`. This file uses
// ONLY that DOM Worker surface -- it never touches `node:worker_threads`
// directly. For the test suite (vitest runs under plain Node, which has no
// `self`/`postMessage`), apps/web/test/worker.test.ts bridges a real
// `node:worker_threads.Worker` to that same DOM surface via a small
// self-contained bootstrap (see that file), so this exact file is what runs
// in both a real browser and under test -- no test-only branch lives here.

import { EngineError, requestFromJson, resultToJson, simulate } from '@shelter/engine';
import type { WorkerRequest, WorkerResponse, SimulationResult } from '@shelter/engine';

declare const self: {
  postMessage(msg: WorkerResponse): void;
  addEventListener(type: 'message', cb: (ev: { data: WorkerRequest }) => void): void;
};

function respond(msg: WorkerResponse): void {
  self.postMessage(msg);
}

self.addEventListener('message', (ev) => {
  const msg = ev.data;

  if (msg.kind === 'cancel') {
    // JS is single-threaded and simulate() is synchronous / cannot be
    // preempted mid-solve (same note as lib/pool.ts's onCrash/dispatch
    // comments) -- an already-started 'simulate' cannot be stopped from here.
    // Accepted for protocol completeness; suppressing a superseded RESULT is
    // workerClient.ts's job (it tracks the latest request id and discards
    // anything else), so this is a deliberate no-op.
    return;
  }

  if (msg.kind !== 'simulate') return; // 'sweep' is not built here -- see header.

  try {
    const request = requestFromJson(msg.payload);
    const result = simulate(request);
    respond({ id: msg.id, kind: 'result', payload: resultToJson(result) as unknown as SimulationResult });
  } catch (err) {
    if (err instanceof EngineError) {
      respond({ id: msg.id, kind: 'error', code: err.code, message: err.message });
    } else {
      // Defensive fallback only -- CONTRACTS.md sec 7.8 says the engine only
      // ever throws EngineError, so this branch should be unreachable.
      // ponytail: SOLVER_DIVERGED is the closest of the closed
      // EngineErrorCode values to "something went wrong that isn't a
      // validation problem"; a real non-EngineError failure here is itself a
      // bug report against the engine, not this file. Same choice
      // sim.node.worker.mjs made.
      const message = err instanceof Error ? err.message : String(err);
      respond({ id: msg.id, kind: 'error', code: 'SOLVER_DIVERGED', message });
    }
  }
});
