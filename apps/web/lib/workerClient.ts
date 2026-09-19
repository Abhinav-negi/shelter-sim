// apps/web/lib/workerClient.ts
//
// T-43 (log/AREA-F-frontend.md). The browser-side counterpart to lib/pool.ts
// (T-40): a single always-on Web Worker (apps/web/workers/sim.worker.ts,
// LOG.md sec 7.14 protocol) plus the routing/cancellation/offline-fallback
// logic around it. Deliberately NOT a pool -- T-40 owns the server-side pool;
// "Do not build the sweep worker pool" is this task's own prompt. A browser
// sweep is runScenarios() calling runSimulation() once per variant, same
// shape as lib/pool.ts's runMany() server-side.
//
// THE ROUTING RULE (the heart of this task): try the server (POST
// /api/simulate) first when isServerReachable(); on ANY failure -- network
// error, non-2xx, or a timeout -- fall back to the local worker (or, absent
// Worker support, a synchronous in-process simulate()) SILENTLY, and record
// that in the store's `online` flag (already declared by T-36; this file
// only ever calls the existing `actions.setOnline`, never edits store.ts).
// The offline banner (T-52) reads that flag.
//
// CANCELLATION: runSimulation() tracks the id of the most recently dispatched
// request (`currentId`). Firing three requests in quick succession lets all
// three actually run to completion (a synchronous simulate() cannot be
// preempted mid-solve -- same note as lib/pool.ts), but only the response
// whose id still matches `currentId` when it arrives is ever resolved to the
// caller; every earlier one rejects with StaleRequestError instead. That is
// what "no stale result may ever reach the store" (sec 7.14) means in
// practice: the caller (a future store-integration task) only ever sees the
// last request settle successfully.

import {
  EngineError,
  requestToJson,
  resultFromJson,
  simulate,
  type EngineErrorCode,
  type SimulationRequest,
  type SimulationResult,
  type WorkerRequest,
  type WorkerResponse,
} from '@shelter/engine';
import { actions } from './store.js';

// ============================== CONFIG (LOG.md rule 14: named calibration constants) ==============================

/** The actual simulate POST's own timeout. CONTRACTS.md/this task's brief: "timeout of 5 s". */
const SERVER_TIMEOUT_MS = 5000;

/** isServerReachable()'s own probe timeout -- deliberately shorter than
 * SERVER_TIMEOUT_MS so a fully-blocked network still leaves headroom under
 * the overall 5s fallback budget (acceptance tests 7/9) instead of spending
 * the whole budget just finding out the network is down. */
const REACHABILITY_TIMEOUT_MS = 2000;

const SIMULATE_ENDPOINT = '/api/simulate';

// ============================== ERRORS ==============================

/** Thrown into a caller's promise when their request was superseded by a
 * newer runSimulation() call before its result (or error) arrived. */
export class StaleRequestError extends Error {
  constructor(id: string) {
    super(`request ${id} was superseded by a newer request`);
    this.name = 'StaleRequestError';
  }
}

// ============================== WORKER ABSTRACTION ==============================

/**
 * The minimal surface this module needs from a Worker. A real DOM
 * `Worker`/module Worker satisfies this natively. Test-only injection
 * (__setWorkerFactoryForTest) can supply anything else that does --
 * apps/web/test/worker.test.ts bridges a real `node:worker_threads.Worker`
 * running the actual sim.worker.ts to this same shape, so the worker-path
 * tests exercise genuine off-main-thread execution under vitest (which has
 * no DOM Worker global).
 */
export interface WorkerLike {
  postMessage(msg: WorkerRequest): void;
  terminate(): void;
  addEventListener(type: 'message', cb: (ev: { data: WorkerResponse }) => void): void;
  addEventListener(type: 'error', cb: (ev: unknown) => void): void;
}

type WorkerFactory = () => WorkerLike;

function defaultWorkerFactory(): WorkerLike {
  // `new URL(..., import.meta.url)` is the standard Next.js/webpack pattern
  // for a bundled module Worker. Only ever called when `typeof Worker !==
  // 'undefined'` (see hasRealWorkerSupport below), so this line never
  // executes under plain Node (vitest's default environment, no DOM Worker).
  return new Worker(new URL('../workers/sim.worker.ts', import.meta.url), {
    type: 'module',
  }) as unknown as WorkerLike;
}

let workerFactory: WorkerFactory = defaultWorkerFactory;

function hasRealWorkerSupport(): boolean {
  return workerFactory !== defaultWorkerFactory || typeof Worker !== 'undefined';
}

/**
 * Test-only hook, same convention as lib/pool.ts's `*ForTest` /
 * lib/store.ts's `__debug*` exports: lets worker.test.ts inject a
 * Worker-shaped adapter so the real async-worker code path can be exercised
 * under vitest. Not part of the app's real UI surface. Passing `null`
 * restores normal feature detection (real browser Worker, or none).
 */
export function __setWorkerFactoryForTest(factory: WorkerFactory | null): void {
  __terminateWorkerForTest();
  workerFactory = factory ?? defaultWorkerFactory;
  // Swapping the factory is a full reset of the test harness state, so the
  // "workers created under the current regime" counter resets with it --
  // otherwise acceptance test 11 (10,000 sequential calls create exactly one
  // worker) would inherit worker-creation counts left over from earlier,
  // unrelated tests in the same file.
  workersCreated = 0;
}

let workersCreated = 0;

/** Test-only: proves a single always-on worker is reused, never spawned per
 * request (acceptance test 11), same role as lib/pool.ts's `workersCreated`. */
export function __workersCreatedForTest(): number {
  return workersCreated;
}

/**
 * Test-only: terminates the current singleton worker (if any) and rejects
 * every promise still pending on it, exactly as a real crash would (see
 * onWorkerError below) -- a real DOM `Worker.terminate()` fires no event at
 * all, on either side, so without this a request in flight when the worker
 * is torn down would otherwise hang forever (acceptance test 10).
 */
export function __terminateWorkerForTest(): void {
  if (singleton) {
    try {
      singleton.terminate();
    } catch {
      // already gone
    }
    singleton = null;
  }
  rejectAllPending(new Error('worker terminated'));
}

let singleton: WorkerLike | null = null;

function getWorker(): WorkerLike {
  if (singleton) return singleton;
  const w = workerFactory();
  workersCreated++;
  w.addEventListener('message', (ev) => onWorkerMessage(ev.data));
  w.addEventListener('error', (err) => onWorkerError(err));
  singleton = w;
  return w;
}

// ============================== REQUEST TRACKING / CANCELLATION ==============================

let nextId = 0;
function genId(): string {
  nextId++;
  return `sim-${Date.now()}-${nextId}`;
}

/** The id of the most recently dispatched runSimulation() call. Any response
 * (worker or server) whose id no longer matches this is stale. */
let currentId: string | null = null;

const pending = new Map<string, { resolve: (r: SimulationResult) => void; reject: (e: unknown) => void }>();
const abortControllers = new Map<string, AbortController>();

/** Marks `id` as the current one, cancelling whatever was in flight before it:
 * aborts its server fetch (if any) and best-effort tells the worker to drop
 * it (protocol completeness -- see sim.worker.ts's 'cancel' handler for why
 * this cannot actually preempt an already-started simulate()). The real
 * guarantee -- no stale RESULT ever resolves a caller's promise -- comes from
 * the `id !== currentId` checks in onWorkerMessage/callServer below. */
function supersede(newId: string): void {
  const previousId = currentId;
  currentId = newId;
  if (previousId === null || previousId === newId) return;

  abortControllers.get(previousId)?.abort();

  if (singleton) {
    try {
      singleton.postMessage({ id: genId(), kind: 'cancel', targetId: previousId });
    } catch {
      // worker already gone; onWorkerError will have rejected `previousId` already
    }
  }
}

function onWorkerMessage(msg: WorkerResponse): void {
  const task = pending.get(msg.id);
  if (!task) return; // already settled (stale-rejected, or an unknown/duplicate id) -- ignore
  pending.delete(msg.id);

  if (msg.id !== currentId) {
    task.reject(new StaleRequestError(msg.id));
    return;
  }
  if (msg.kind === 'result') {
    task.resolve(resultFromJson(msg.payload));
  } else if (msg.kind === 'error') {
    task.reject(new EngineError(msg.code, msg.message));
  }
  // 'progress'/'sweepResult': sim.worker.ts never sends these (simulate-only,
  // like sim.node.worker.mjs) -- nothing to do.
}

function onWorkerError(err: unknown): void {
  // A crashed worker (an uncaught throw escaping the message handler,
  // OOM-kill, etc). Every promise still pending on it must settle rather than
  // hang. The next call to getWorker() spawns a fresh one.
  rejectAllPending(err instanceof Error ? err : new Error(String(err)));
  singleton = null;
}

function rejectAllPending(err: unknown): void {
  for (const [, task] of pending) task.reject(err);
  pending.clear();
}

// ============================== LOCAL EXECUTION (worker, or sync fallback) ==============================

function runOnWorker(req: SimulationRequest, id: string): Promise<SimulationResult> {
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    const worker = getWorker();
    const wireRequest: WorkerRequest = { id, kind: 'simulate', payload: requestToJson(req) as SimulationRequest };
    worker.postMessage(wireRequest);
  });
}

/** No Worker support (old browser, or a plain-Node test/SSR context): run
 * in-process, synchronously, so a result still comes back. Deep-equal to the
 * worker path (acceptance test 6) because both ultimately call the same
 * @shelter/engine simulate() on the same request. */
function runSynchronously(req: SimulationRequest, id: string): Promise<SimulationResult> {
  return new Promise((resolve, reject) => {
    let result: SimulationResult;
    try {
      result = simulate(req);
    } catch (err) {
      reject(err instanceof EngineError ? err : new EngineError('SOLVER_DIVERGED', err instanceof Error ? err.message : String(err)));
      return;
    }
    if (id !== currentId) {
      reject(new StaleRequestError(id));
      return;
    }
    resolve(result);
  });
}

function runLocal(req: SimulationRequest, id: string): Promise<SimulationResult> {
  return hasRealWorkerSupport() ? runOnWorker(req, id) : runSynchronously(req, id);
}

// ============================== SERVER PATH ==============================

class ServerUnavailableError extends Error {}

async function callServer(req: SimulationRequest, id: string): Promise<SimulationResult> {
  const controller = new AbortController();
  abortControllers.set(id, controller);
  const timer = setTimeout(() => controller.abort(), SERVER_TIMEOUT_MS);
  try {
    const res = await fetch(SIMULATE_ENDPOINT, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(requestToJson(req)),
      signal: controller.signal,
    });
    if (!res.ok) throw new ServerUnavailableError(`server responded ${res.status}`);
    const json: unknown = await res.json();
    return resultFromJson(json);
  } finally {
    clearTimeout(timer);
    abortControllers.delete(id);
  }
}

/**
 * A cheap reachability probe, independent of any particular simulation
 * request. Any HTTP response (even a 4xx/5xx -- /api/simulate only exports
 * POST, so a HEAD legitimately 405s) proves the network path to the server
 * works; a thrown error (offline, DNS failure, timeout) means it does not.
 * Side-effect-free: does not touch the store, so a banner or poller elsewhere
 * can call it freely without racing runSimulation()'s own online/offline
 * bookkeeping.
 */
export async function isServerReachable(): Promise<boolean> {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return false;
  if (typeof fetch === 'undefined') return false;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REACHABILITY_TIMEOUT_MS);
  try {
    await fetch(SIMULATE_ENDPOINT, { method: 'HEAD', signal: controller.signal });
    return true;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

// ============================== PUBLIC API ==============================

/**
 * Runs one simulation. Tries the server first (when isServerReachable());
 * on any failure -- unreachable, non-2xx, or a 5s timeout -- falls back
 * silently to the local worker (or the synchronous in-process path) and
 * marks the store offline. Automatically cancels/supersedes whatever
 * runSimulation() call was previously in flight (see `supersede` above).
 */
export async function runSimulation(req: SimulationRequest): Promise<SimulationResult> {
  const id = genId();
  supersede(id);

  if (await isServerReachable()) {
    try {
      const result = await callServer(req, id);
      if (id !== currentId) throw new StaleRequestError(id);
      actions.setOnline(true);
      return result;
    } catch (err) {
      if (err instanceof StaleRequestError) throw err;
      // network error / non-2xx / timeout -- fall through to the local path.
    }
  }

  actions.setOnline(false);
  return runLocal(req, id);
}

/**
 * Runs a batch of scenarios sequentially, each through runSimulation() (so
 * each one independently tries the server and falls back offline the same
 * way), reporting progress after every one settles. This IS the "browser
 * sweep reuses this client" path the task brief calls for -- no separate
 * worker pool is built here (T-40 owns that, server-side).
 */
export async function runScenarios(
  reqs: SimulationRequest[],
  onProgress: (done: number, total: number) => void,
): Promise<SimulationResult[]> {
  const total = reqs.length;
  const results: SimulationResult[] = new Array(total);
  let done = 0;
  for (let i = 0; i < total; i++) {
    results[i] = await runSimulation(reqs[i]!);
    done++;
    onProgress(done, total);
  }
  return results;
}

export type { EngineErrorCode };
