// apps/web/lib/pool.ts
//
// T-40 (log/AREA-E-server-tier.md). plan.md Part 2b: @shelter/engine's simulate()
// is a tight arithmetic loop -- no I/O, nothing to overlap. The usual Node
// concurrency trick (start a job, do something else while it waits) buys
// nothing here because the job never waits, it just computes flat out and
// blocks everyone behind it on the event loop. The only way a second user
// gets an instant response during a heavy sweep is real OS threads on real
// cores, so this pool runs `worker_threads`, one per core minus one, leaving
// a core free for the main thread (the event loop, and every other request).
//
// Workers speak the LOG.md sec 7.14 protocol (`WorkerRequest`/`WorkerResponse`,
// imported from @shelter/engine -- never redefined here) so this pool and the
// future browser Web Worker (T-43) are interchangeable from a caller's point
// of view. Every request/result crosses the postMessage boundary through
// T-06's requestToJson/resultFromJson: worker_threads structured clone can
// carry a Float64Array, but not every runtime this protocol targets can (the
// browser worker included), so the wire form is always plain JSON, in one
// place, on both ends.

import os from 'node:os';
import { Worker } from 'node:worker_threads';
import { randomUUID } from 'node:crypto';
import {
  EngineError,
  requestToJson,
  resultFromJson,
  type SimulationRequest,
  type SimulationResult,
  type WorkerRequest,
  type WorkerResponse,
} from '@shelter/engine';

const WORKER_URL = new URL('../workers/sim.node.worker.mjs', import.meta.url);

export interface Pool {
  run(req: SimulationRequest, signal?: AbortSignal): Promise<SimulationResult>;
  runMany(
    reqs: SimulationRequest[],
    onProgress: (done: number, total: number) => void,
    signal?: AbortSignal,
  ): Promise<SimulationResult[]>;
  readonly size: number;
  readonly active: number;
  destroy(): Promise<void>;
}

/**
 * Extra, test-facing surface beyond the sec 7.14 `Pool` contract above.
 * `workersCreated` is how the acceptance tests assert "reused, not spawned
 * per variant" without reaching into private fields. `crashBusyWorkerForTest`
 * exercises the crash-and-replace path (acceptance test 9) the same way a
 * real OOM'd worker would: `Worker.terminate()` on a slot that is mid-task.
 */
export interface PoolWithDebug extends Pool {
  readonly workersCreated: number;
  crashBusyWorkerForTest(): boolean;
}

/** A worker died (crashed, was OOM-killed, or was force-terminated) while holding a task. */
export class PoolWorkerCrashError extends Error {
  constructor(message: string, cause?: unknown) {
    super(message, { cause });
    this.name = 'PoolWorkerCrashError';
  }
}

interface Task {
  id: string;
  req: SimulationRequest;
  resolve: (r: SimulationResult) => void;
  reject: (e: unknown) => void;
  signal: AbortSignal | undefined;
}

interface Slot {
  worker: Worker;
  busy: boolean;
  task: Task | null;
}

function abortError(signal: AbortSignal | undefined): unknown {
  return signal?.reason ?? new DOMException('aborted', 'AbortError');
}

class WorkerPool implements PoolWithDebug {
  readonly size: number;
  private slots: Slot[] = [];
  private queue: Task[] = [];
  private created = 0;
  private destroyed = false;

  constructor(size: number) {
    this.size = size;
    for (let i = 0; i < size; i++) this.slots.push(this.spawn());
  }

  get workersCreated(): number {
    return this.created;
  }

  get active(): number {
    return this.slots.reduce((n, s) => n + (s.busy ? 1 : 0), 0);
  }

  private spawn(): Slot {
    this.created++;
    const worker = new Worker(WORKER_URL);
    const slot: Slot = { worker, busy: false, task: null };
    worker.on('message', (msg: WorkerResponse) => this.onMessage(slot, msg));
    worker.on('error', (err) => this.onCrash(slot, err));
    // Deliberately not gated on a nonzero exit code: `Worker.terminate()` on a
    // busy worker (mid synchronous simulate()) has been observed to report
    // exit code 0 here, same as a clean shutdown -- the exit code alone
    // cannot distinguish "crashed" from "asked to stop". This pool only ever
    // lets a worker exit via destroy() (guarded by `this.destroyed` inside
    // onCrash) or a crash/forced kill, so ANY exit while the pool is still
    // alive means "replace it", regardless of code.
    worker.on('exit', () => this.onCrash(slot, new Error('worker exited unexpectedly')));
    return slot;
  }

  private onMessage(slot: Slot, msg: WorkerResponse): void {
    const task = slot.task;
    // A response for anything other than the task this slot is currently
    // holding is stale (e.g. arriving after the slot was already reused by a
    // crash-replacement race) and must never reach a caller -- LOG.md sec 7.14:
    // "No stale result may ever reach the store."
    if (!task || msg.id !== task.id) return;
    if (msg.kind === 'result') {
      this.settle(slot, () => task.resolve(resultFromJson(msg.payload)));
    } else if (msg.kind === 'error') {
      this.settle(slot, () => task.reject(new EngineError(msg.code, msg.message)));
    }
    // 'progress'/'sweepResult' are sec 7.14 protocol members this worker never
    // sends -- sim.node.worker.mjs only ever answers a 'simulate' request.
  }

  private settle(slot: Slot, deliver: () => void): void {
    slot.busy = false;
    slot.task = null;
    deliver();
    this.pump();
  }

  private onCrash(slot: Slot, cause: unknown): void {
    if (this.destroyed) return;
    const idx = this.slots.indexOf(slot);
    if (idx === -1) return; // already handled (both 'error' and 'exit' can fire for one crash)
    this.slots.splice(idx, 1);
    const task = slot.task;
    slot.task = null;
    try {
      slot.worker.terminate();
    } catch {
      // already dead
    }
    if (task)
      task.reject(new PoolWorkerCrashError('worker crashed mid-run; the pool replaced it', cause));
    this.slots.push(this.spawn());
    this.pump();
  }

  private nextTask(): Task | undefined {
    while (this.queue.length > 0) {
      const task = this.queue.shift()!;
      if (task.signal?.aborted) {
        task.reject(abortError(task.signal));
        continue;
      }
      return task;
    }
    return undefined;
  }

  private dispatch(slot: Slot, task: Task): void {
    slot.busy = true;
    slot.task = task;
    const req: WorkerRequest = {
      id: task.id,
      kind: 'simulate',
      payload: requestToJson(task.req) as SimulationRequest,
    };
    slot.worker.postMessage(req);
  }

  private pump(): void {
    for (const slot of this.slots) {
      if (slot.busy) continue;
      const task = this.nextTask();
      if (!task) break;
      this.dispatch(slot, task);
    }
  }

  run(req: SimulationRequest, signal?: AbortSignal): Promise<SimulationResult> {
    if (this.destroyed) return Promise.reject(new Error('pool destroyed'));
    if (signal?.aborted) return Promise.reject(abortError(signal));
    return new Promise((resolve, reject) => {
      this.queue.push({ id: randomUUID(), req, resolve, reject, signal });
      this.pump();
    });
  }

  async runMany(
    reqs: SimulationRequest[],
    onProgress: (done: number, total: number) => void,
    signal?: AbortSignal,
  ): Promise<SimulationResult[]> {
    const total = reqs.length;
    let done = 0;
    const results = new Array<SimulationResult>(total);
    await Promise.all(
      reqs.map(async (req, i) => {
        const r = await this.run(req, signal);
        results[i] = r;
        done++;
        onProgress(done, total);
      }),
    );
    return results;
  }

  /** Test-only: forces a currently-busy worker to crash (acceptance test 9). */
  crashBusyWorkerForTest(): boolean {
    const slot = this.slots.find((s) => s.busy);
    if (!slot) return false;
    void slot.worker.terminate();
    return true;
  }

  async destroy(): Promise<void> {
    this.destroyed = true;
    for (const task of this.queue.splice(0)) task.reject(new Error('pool destroyed'));
    for (const slot of this.slots) {
      if (slot.task) slot.task.reject(new Error('pool destroyed'));
    }
    await Promise.all(this.slots.map((s) => s.worker.terminate()));
    this.slots = [];
  }
}

function defaultSize(): number {
  return Math.max(1, os.cpus().length - 1);
}

/** A fresh, independent pool -- mainly for tests. `getPool()` is what the app uses. */
export function createPool(size: number = defaultSize()): PoolWithDebug {
  return new WorkerPool(size);
}

declare global {
  // eslint-disable-next-line no-var -- required shape for globalThis augmentation.
  var __sheltersimPool: WorkerPool | undefined;
}

// Module-scope fallback for production, where the process is not hot-reloaded
// and a plain module-scope singleton is enough on its own (same split as
// lib/db.ts's memoizedClient()).
let prodPool: WorkerPool | undefined;

/**
 * The process-wide pool. Memoised on `globalThis` in development so Next.js
 * hot reload re-evaluating this module does not leak a fresh pool of threads
 * per edit -- same pattern as lib/db.ts's PrismaClient stash.
 */
export function getPool(): Pool {
  if (process.env.NODE_ENV === 'production') {
    if (!prodPool) prodPool = new WorkerPool(defaultSize());
    return prodPool;
  }
  if (!globalThis.__sheltersimPool) {
    globalThis.__sheltersimPool = new WorkerPool(defaultSize());
  }
  return globalThis.__sheltersimPool;
}
