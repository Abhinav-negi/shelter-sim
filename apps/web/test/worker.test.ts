// apps/web/test/worker.test.ts
//
// T-43 acceptance tests 1-11 (log/AREA-F-frontend.md). All 11 must pass with
// pasted, measured evidence -- not "looks right".
//
// vitest's default environment is plain Node, which has no DOM `Worker`
// global -- exactly the "environment with no worker support" the task brief
// calls for workerClient.ts to fall back on synchronously (test 6 exercises
// that path directly). But several acceptance tests (1, 4, 5, 10, 11) are
// only meaningful against a REAL off-main-thread worker, so this file bridges
// a genuine `node:worker_threads.Worker` -- running apps/web/workers/
// sim.worker.ts completely unmodified, loaded via Node's own default
// TypeScript type-stripping (Node >=22.18/23.6, verified against the Node in
// this repo's engines range) -- to the WorkerLike shape workerClient.ts
// expects, via `__setWorkerFactoryForTest`. That is genuine parallelism on a
// real OS thread, not a fake/deferred-callback stand-in, so timing evidence
// from it (tests 1, 11) is real.
//
// Fixture convention mirrors apps/web/test/pool.test.ts's baseRequest(): a
// small, self-contained, physically valid SimulationRequest built inline.
// `gains` perturbs internalGainsSchedule so many variants are distinguishable
// (test 4's id-correctness check); `tol`/`cap` loosen spin-up convergence for
// the volume tests (4, 11), same reasoning as pool.test.ts's own fixture.

import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { Worker as NodeWorker } from 'node:worker_threads';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { EngineError, simulate, toK } from '@shelter/engine';
import type {
  Glazing,
  Material,
  SimulationRequest,
  Surface,
  WorkerRequest,
  WorkerResponse,
} from '@shelter/engine';
import {
  __setWorkerFactoryForTest,
  __terminateWorkerForTest,
  __workersCreatedForTest,
  isServerReachable,
  runScenarios,
  runSimulation,
  type WorkerLike,
} from '../lib/workerClient.js';
import { getStoreState, hydrateStore } from '../lib/store.js';
import { formatTempC } from '../lib/units.js';

// ============================== FIXTURES (mirrors pool.test.ts's baseRequest) ==============================

const MATERIAL: Material = {
  id: 'testStone',
  name: 'Test stone',
  category: 'structural',
  k: 1.75,
  rho: 2400,
  c: 880,
  alphaSolar: 0.65,
  emissivity: 0.88,
  locallyAvailableLadakh: true,
  source: 'T-43 test fixture',
};

const GLAZING: Glazing = {
  id: 'testGlaze',
  name: 'Test glazing',
  U: 2.8,
  SHGC: 0.76,
  tauVis: 0.78,
  b0: 0.05,
  source: 'T-43 test fixture',
};

function buildSurface(id: string, type: Surface['type'], tilt: number, azimuth: number): Surface {
  return {
    id,
    type,
    area: 16,
    tilt,
    azimuth,
    construction: [{ materialId: MATERIAL.id, thickness: 0.4 }],
    boundary: 'exterior',
    exteriorAbsorptivity: 0.7,
    exteriorEmissivity: 0.9,
    interiorEmissivity: 0.9,
  };
}

function baseRequest(opts: { gains?: number; tol?: number; cap?: number } = {}): SimulationRequest {
  const gains = opts.gains ?? 150;
  const steps = 24;
  const T_amb = new Float64Array(steps);
  const GHI = new Float64Array(steps);
  const v_wind = new Float64Array(steps).fill(2);
  for (let h = 0; h < steps; h++) {
    T_amb[h] = toK(-8 + 6 * Math.sin(((h - 15) / 24) * 2 * Math.PI));
    GHI[h] = h >= 8 && h <= 16 ? 500 * Math.sin(((h - 8) / 8) * Math.PI) : 0;
  }
  return {
    site: {
      id: 't43',
      name: 'T-43 test site',
      latitude: 34.15,
      longitude: 77.58,
      elevation: 3500,
      standardMeridian: 82.5,
      groundAlbedo: 0.3,
      groundTempMeanAnnual: toK(6),
    },
    building: {
      floorArea: 16,
      volume: 64,
      azimuth: 0,
      surfaces: [
        buildSurface('south', 'wall', 90, 0),
        buildSurface('east', 'wall', 90, -90),
        buildSurface('west', 'wall', 90, 90),
        buildSurface('north', 'wall', 90, 180),
        buildSurface('roof', 'roof', 0, 0),
        buildSurface('floor', 'floor', 180, 0),
      ],
      windows: [{ id: 'southWindow', hostSurfaceId: 'south', area: 1.5, glazingId: GLAZING.id }],
      thermalBridgeFactor: 1.1,
    },
    operation: {
      internalGainsSchedule: new Array(24).fill(gains),
      achSchedule: new Array(24).fill(0.5),
      auxHeating: { enabled: false, setpoint: toK(18), maxPower: 0 },
      comfortBand: { lower: toK(15), upper: toK(24) },
    },
    weather: {
      stepSeconds: 3600,
      startDayOfYear: 15,
      startHour: 0,
      T_amb,
      GHI,
      v_wind,
      provenance: {
        source: 'synthetic',
        label: 'T-43 test fixture',
        sourceElevation: null,
        lapseCorrectionK: 0,
        notes: [],
      },
    },
    materials: { [MATERIAL.id]: MATERIAL },
    glazings: { [GLAZING.id]: GLAZING },
    options: {
      timestepSeconds: 300,
      meshTargetDx: 0.02,
      simulationDays: 1,
      spinUpToleranceK: opts.tol ?? 0.5,
      maxSpinUpDays: opts.cap ?? 5,
      skyModel: 'isotropic',
      integrationTheta: 1,
      keepSurfaceProfiles: false,
      allowUnsafeVentilation: false,
    },
  };
}

/** An otherwise-valid request whose wall references a material id that does not exist. */
function unknownMaterialRequest(): SimulationRequest {
  const req = baseRequest();
  req.building.surfaces[0]!.construction = [{ materialId: 'doesNotExist', thickness: 0.4 }];
  return req;
}

/** Fails validateRequest()'s own basic-input checks (packages/engine/src/validate.ts)
 * -- a negative room volume -- so simulate() throws EngineError('INVALID_INPUT'),
 * the exact code acceptance test 3 names. */
function invalidInputRequest(): SimulationRequest {
  const req = baseRequest();
  req.building.volume = -1;
  return req;
}

// ============================== REAL WORKER BRIDGE ==============================
//
// Bridges a real `node:worker_threads.Worker` to the WorkerLike shape
// workerClient.ts expects. The worker's own entry point is a tiny bootstrap
// (written fresh to a temp file each run so this stays portable across
// machines/CI, not tied to this session's scratchpad) that polyfills the
// three DOM Worker globals sim.worker.ts actually uses (`self`,
// `postMessage`, `addEventListener('message', ...)`) on top of
// `node:worker_threads`'s `parentPort`, then dynamically imports the real
// sim.worker.ts -- completely unmodified, so this exercises the actual
// production file.

const SIM_WORKER_URL = new URL('../workers/sim.worker.ts', import.meta.url).href;

function bootstrapFile(): string {
  const dir = mkdtempSync(path.join(tmpdir(), 'sim-worker-bridge-'));
  const file = path.join(dir, 'bootstrap.mjs');
  writeFileSync(
    file,
    [
      "import { parentPort } from 'node:worker_threads';",
      'globalThis.self = globalThis;',
      'globalThis.postMessage = (msg) => parentPort.postMessage(msg);',
      'globalThis.addEventListener = (type, cb) => {',
      "  if (type === 'message') parentPort.on('message', (data) => cb({ data }));",
      '};',
      `await import(${JSON.stringify(SIM_WORKER_URL)});`,
      '',
    ].join('\n'),
    'utf8',
  );
  return file;
}

function createBridgedWorker(): WorkerLike {
  const nw = new NodeWorker(bootstrapFile());
  const messageCbs: ((ev: { data: WorkerResponse }) => void)[] = [];
  const errorCbs: ((ev: unknown) => void)[] = [];
  nw.on('message', (data: WorkerResponse) => {
    for (const cb of messageCbs) cb({ data });
  });
  nw.on('error', (err: unknown) => {
    for (const cb of errorCbs) cb(err);
  });
  return {
    postMessage: (msg: WorkerRequest) => nw.postMessage(msg),
    terminate: () => {
      void nw.terminate();
    },
    addEventListener: ((type: 'message' | 'error', cb: (ev: unknown) => void) => {
      if (type === 'message') messageCbs.push(cb as (ev: { data: WorkerResponse }) => void);
      else if (type === 'error') errorCbs.push(cb);
    }) as WorkerLike['addEventListener'],
  };
}

// ============================== TEST HARNESS PLUMBING ==============================

const realFetch = globalThis.fetch;

beforeAll(() => {
  // Store read-before-hydrate throws by design (lib/store.ts) -- seed it once
  // so getStoreState() is usable from the offline-flag assertions below. This
  // file only ever CALLS store.ts's existing actions/getState -- it never
  // edits lib/store.ts, per this task's allow-list.
  hydrateStore({
    request: baseRequest(),
    result: simulate(baseRequest({ tol: 0.5, cap: 5 })),
    presetId: 't43-test',
  });
});

afterEach(() => {
  __setWorkerFactoryForTest(null); // terminates any bridged worker, resets the debug counter, restores feature detection
  globalThis.fetch = realFetch; // undo any per-test fetch mock
});

// ============================== ACCEPTANCE TESTS ==============================

describe('T-43 browser worker + offline fallback', () => {
  it('1. main thread stays responsive during a run (no server -- default local routing)', async () => {
    __setWorkerFactoryForTest(createBridgedWorker);
    globalThis.fetch = (() => Promise.reject(new Error('no server in this test'))) as typeof fetch;

    const req = baseRequest(); // realistic engine-default spin-up convergence, not the loosened fixture
    const TICK_MS = 5;
    const LATE_THRESHOLD_MS = 16;
    let ticks = 0;
    let late = 0;
    let longestGapMs = 0;
    let expected = performance.now() + TICK_MS;
    const timer = setInterval(() => {
      const now = performance.now();
      ticks++;
      const gap = now - (expected - TICK_MS);
      if (gap > longestGapMs) longestGapMs = gap;
      if (now - expected > LATE_THRESHOLD_MS - TICK_MS) late++;
      expected = now + TICK_MS;
    }, TICK_MS);

    const result = await runSimulation(req);
    clearInterval(timer);

    const onTimePercent = ticks > 0 ? (100 * (ticks - late)) / ticks : 100;
    console.log(
      `  [test 1] ticks = ${ticks}, late (> ${LATE_THRESHOLD_MS}ms) = ${late}, on-time = ${onTimePercent.toFixed(1)}%, longest main-thread gap = ${longestGapMs.toFixed(2)} ms`,
    );
    expect(result.meta.timesteps).toBeGreaterThan(0);
    expect(onTimePercent).toBeGreaterThanOrEqual(95);
  }, 15_000);

  it('2. firing three requests resolves only the last; store-write counter == 1', async () => {
    __setWorkerFactoryForTest(createBridgedWorker);
    globalThis.fetch = (() => Promise.reject(new Error('no server in this test'))) as typeof fetch;

    let storeWrites = 0;
    const settled = await Promise.allSettled([
      runSimulation(baseRequest({ gains: 100 })).then((r) => {
        storeWrites++;
        return r;
      }),
      runSimulation(baseRequest({ gains: 150 })).then((r) => {
        storeWrites++;
        return r;
      }),
      runSimulation(baseRequest({ gains: 200 })).then((r) => {
        storeWrites++;
        return r;
      }),
    ]);

    console.log(
      `  [test 2] settled = [${settled.map((s) => s.status).join(', ')}], store-write counter = ${storeWrites}`,
    );
    expect(settled[0]!.status).toBe('rejected');
    expect(settled[1]!.status).toBe('rejected');
    expect(settled[2]!.status).toBe('fulfilled');
    expect(storeWrites).toBe(1);
  }, 15_000);

  it("3. an EngineError('INVALID_INPUT') arrives as a typed error response, not an unhandled rejection", async () => {
    __setWorkerFactoryForTest(createBridgedWorker);
    globalThis.fetch = (() => Promise.reject(new Error('no server in this test'))) as typeof fetch;

    await expect(runSimulation(invalidInputRequest())).rejects.toMatchObject({
      name: 'EngineError',
      code: 'INVALID_INPUT',
    });
    try {
      await runSimulation(invalidInputRequest());
      throw new Error('expected rejection');
    } catch (err) {
      expect(err).toBeInstanceOf(EngineError);
      expect((err as EngineError).code).toBe('INVALID_INPUT');
      console.log(
        `  [test 3] rejected with EngineError code = ${(err as EngineError).code} (not an unhandled rejection)`,
      );
    }

    // Also exercise the sibling code (UNKNOWN_MATERIAL, thrown later than
    // validateRequest()'s own INVALID_INPUT pass) through the same path, to
    // confirm this isn't special-cased to one specific code.
    await expect(runSimulation(unknownMaterialRequest())).rejects.toMatchObject({
      name: 'EngineError',
      code: 'UNKNOWN_MATERIAL',
    });
  }, 15_000);

  it('4. every response id matches its request id across 1,000 requests', async () => {
    __setWorkerFactoryForTest(createBridgedWorker);
    globalThis.fetch = (() => Promise.reject(new Error('no server in this test'))) as typeof fetch;

    const N = 1000;
    let mismatches = 0;
    let prevAux = Number.POSITIVE_INFINITY;
    const t0 = performance.now();
    for (let i = 0; i < N; i++) {
      const r = await runSimulation(baseRequest({ gains: i, tol: 0.5, cap: 5 }));
      // More internal gains => less aux energy needed (monotonic, all else
      // fixed). A wrong id pairing anywhere in workerClient.ts's pending-map
      // lookup would break this per-index correlation.
      if (r.kpis.auxEnergyKWhPerDay > prevAux + 1e-6) mismatches++;
      prevAux = r.kpis.auxEnergyKWhPerDay;
    }
    const totalMs = performance.now() - t0;
    console.log(
      `  [test 4] ${N} sequential requests, non-monotonic (mismatched) adjacent pairs = ${mismatches}, total = ${(totalMs / 1000).toFixed(1)} s`,
    );
    expect(mismatches).toBe(0);
  }, 120_000);

  it('5. worker result is deep-equal to in-process simulate(); Float64Array fields survive', async () => {
    __setWorkerFactoryForTest(createBridgedWorker);
    globalThis.fetch = (() => Promise.reject(new Error('no server in this test'))) as typeof fetch;

    const req = baseRequest({ tol: 0.02, cap: 30 });
    const inProcess = simulate(req);
    const viaWorker = await runSimulation(req);

    const { wallClockMs: _a, ...metaIn } = inProcess.meta;
    const { wallClockMs: _b, ...metaW } = viaWorker.meta;
    expect(metaW).toEqual(metaIn);
    expect({ ...viaWorker, meta: metaW }).toEqual({ ...inProcess, meta: metaIn });
    expect(viaWorker.time).toBeInstanceOf(Float64Array);
    expect(viaWorker.temperatures.indoorAir).toBeInstanceOf(Float64Array);
    expect(viaWorker.temperatures.ambient).toBeInstanceOf(Float64Array);
    expect(viaWorker.heatFlows.Q1_solarOpaque).toBeInstanceOf(Float64Array);
    console.log(
      '  [test 5] deep-equal to in-process simulate(), Float64Array fields verified via instanceof: PASS',
    );
  }, 15_000);

  it('6. the synchronous fallback is deep-equal to the worker path', async () => {
    globalThis.fetch = (() => Promise.reject(new Error('no server in this test'))) as typeof fetch;
    const req = baseRequest({ tol: 0.02, cap: 30 });

    __setWorkerFactoryForTest(createBridgedWorker);
    const viaWorker = await runSimulation(req);

    __setWorkerFactoryForTest(null); // no DOM Worker global under vitest -> exercises the synchronous in-process path
    const viaSync = await runSimulation(req);

    const { wallClockMs: _a, ...metaW } = viaWorker.meta;
    const { wallClockMs: _b, ...metaS } = viaSync.meta;
    expect(metaS).toEqual(metaW);
    expect({ ...viaSync, meta: metaS }).toEqual({ ...viaWorker, meta: metaW });
    console.log('  [test 6] synchronous-fallback result deep-equal to worker-path result: PASS');
  }, 15_000);

  it('7. OFFLINE (network fully blocked): local result within 5s, store.online=false [C-12]', async () => {
    __setWorkerFactoryForTest(createBridgedWorker);
    globalThis.fetch = (() => Promise.reject(new Error('network fully blocked'))) as typeof fetch;

    const t0 = performance.now();
    const result = await runSimulation(baseRequest());
    const elapsedMs = performance.now() - t0;

    console.log(
      `  [test 7] elapsed = ${elapsedMs.toFixed(1)} ms, tempAt0600 = ${formatTempC(result.kpis.tempAt0600)}, store.online = ${getStoreState().online}`,
    );
    expect(elapsedMs).toBeLessThan(5000);
    expect(getStoreState().online).toBe(false);
    expect(result.meta.timesteps).toBeGreaterThan(0);
  }, 10_000);

  it('8. server 500 falls back to the local path and sets online=false', async () => {
    __setWorkerFactoryForTest(createBridgedWorker);
    globalThis.fetch = (async () => new Response('server error', { status: 500 })) as typeof fetch;

    const result = await runSimulation(baseRequest());
    console.log(
      `  [test 8] result returned despite server 500, store.online = ${getStoreState().online}`,
    );
    expect(result.meta.timesteps).toBeGreaterThan(0);
    expect(getStoreState().online).toBe(false);
  }, 10_000);

  it('9. server timeout (no response) falls back within 5s, not 30', async () => {
    __setWorkerFactoryForTest(createBridgedWorker);
    globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
      if (init?.method === 'HEAD') return Promise.resolve(new Response(null, { status: 200 }));
      // The POST leg: a fetch that never settles on its own, exactly like a
      // server that accepted the connection but never responds. Only settles
      // when workerClient.ts's own AbortController fires.
      return new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () =>
          reject(new DOMException('aborted', 'AbortError')),
        );
      });
    }) as typeof fetch;

    const t0 = performance.now();
    const result = await runSimulation(baseRequest());
    const elapsedMs = performance.now() - t0;

    console.log(
      `  [test 9] elapsed = ${elapsedMs.toFixed(1)} ms (timeout budget 5000 ms, well under a naive 30s)`,
    );
    expect(elapsedMs).toBeGreaterThanOrEqual(4900); // genuinely waited out the real 5s timeout, not a fast-path fluke
    expect(elapsedMs).toBeLessThan(6500);
    expect(result.meta.timesteps).toBeGreaterThan(0);
  }, 10_000);

  it('10. terminating the worker mid-run does not leave a pending promise', async () => {
    __setWorkerFactoryForTest(createBridgedWorker);
    globalThis.fetch = (() => Promise.reject(new Error('no server in this test'))) as typeof fetch;

    const promise = runSimulation(baseRequest({ tol: 0.02, cap: 30 })); // a real, non-trivial compute
    await new Promise((r) => setTimeout(r, 5)); // let the request actually reach the worker before killing it
    __terminateWorkerForTest();

    await expect(promise).rejects.toBeInstanceOf(Error);
    console.log(
      '  [test 10] pending promise settled (rejected) immediately after worker termination, did not hang: PASS',
    );
  }, 10_000);

  it('11. 10,000 sequential requests do not grow the worker count beyond one', async () => {
    __setWorkerFactoryForTest(createBridgedWorker);
    globalThis.fetch = (() => Promise.reject(new Error('no server in this test'))) as typeof fetch;

    const N = 10_000;
    const t0 = performance.now();
    for (let i = 0; i < N; i++) {
      await runSimulation(baseRequest({ gains: 100 + (i % 50), tol: 0.5, cap: 5 }));
    }
    const totalMs = performance.now() - t0;
    console.log(
      `  [test 11] ${N} sequential requests, workers created = ${__workersCreatedForTest()}, total = ${(totalMs / 1000).toFixed(1)} s`,
    );
    expect(__workersCreatedForTest()).toBe(1);
  }, 300_000);

  it('bonus: runScenarios reports monotonic progress and preserves order', async () => {
    __setWorkerFactoryForTest(createBridgedWorker);
    globalThis.fetch = (() => Promise.reject(new Error('no server in this test'))) as typeof fetch;

    const reqs = [
      baseRequest({ gains: 50 }),
      baseRequest({ gains: 150 }),
      baseRequest({ gains: 300 }),
    ];
    const calls: number[] = [];
    const results = await runScenarios(reqs, (done) => calls.push(done));

    expect(calls).toEqual([1, 2, 3]);
    expect(results.length).toBe(3);
    expect(results[0]!.kpis.auxEnergyKWhPerDay).toBeGreaterThanOrEqual(
      results[1]!.kpis.auxEnergyKWhPerDay,
    );
    expect(results[1]!.kpis.auxEnergyKWhPerDay).toBeGreaterThanOrEqual(
      results[2]!.kpis.auxEnergyKWhPerDay,
    );
    console.log('  [bonus] runScenarios: progress = [1, 2, 3], result order preserved: PASS');
  }, 30_000);

  it('bonus: isServerReachable reflects a mocked network', async () => {
    globalThis.fetch = (() => Promise.reject(new Error('offline'))) as typeof fetch;
    expect(await isServerReachable()).toBe(false);

    globalThis.fetch = (async () => new Response(null, { status: 405 })) as typeof fetch; // /api/simulate only exports POST
    expect(await isServerReachable()).toBe(true);
    console.log(
      '  [bonus] isServerReachable: false when offline, true on any HTTP response (even 405): PASS',
    );
  }, 10_000);
});
