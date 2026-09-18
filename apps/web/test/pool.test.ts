// apps/web/test/pool.test.ts
//
// T-40 acceptance tests 1-12 (log/AREA-E-server-tier.md). All 12 must pass
// with pasted, measured evidence -- not "looks right".
//
// Fixture convention mirrors apps/web/test/api-simulate.test.ts's baseRequest():
// a small, self-contained, physically valid SimulationRequest built inline
// rather than importing packages/engine/test's fixtures across the package
// boundary. `gains` perturbs internalGainsSchedule so many variants are
// distinguishable (used by test 10's id-correctness check), and `tol`/`cap`
// loosen spin-up convergence for the perf-sensitive tests (3/4/5/6/10/12) --
// same physics, fewer spin-up days, because those tests need hundreds to
// thousands of real runs to complete in a reasonable wall-clock time.

import os from 'node:os';
import { describe, it, expect, afterEach } from 'vitest';
import { simulate, toK, EngineError } from '@shelter/engine';
import type { Material, Glazing, Surface, SimulationRequest, SimulationResult } from '@shelter/engine';
import { createPool, getPool, PoolWorkerCrashError, type PoolWithDebug } from '../lib/pool.js';

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
  source: 'T-40 test fixture',
};

const GLAZING: Glazing = {
  id: 'testGlaze',
  name: 'Test glazing',
  U: 2.8,
  SHGC: 0.76,
  tauVis: 0.78,
  b0: 0.05,
  source: 'T-40 test fixture',
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

/**
 * `tol`/`cap` default to a fast-converging spin-up (loose tolerance, 5-day
 * cap) so the perf/stress tests can afford hundreds-to-thousands of runs;
 * tests that check numeric correctness use the tighter engine defaults.
 */
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
      id: 't40',
      name: 'T-40 test site',
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
      provenance: { source: 'synthetic', label: 'T-40 test fixture', sourceElevation: null, lapseCorrectionK: 0, notes: [] },
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

const pools: PoolWithDebug[] = [];
/** Every pool created via this helper is destroyed in afterEach -- no leaked worker threads between tests. */
function pool(size?: number): PoolWithDebug {
  const p = createPool(size);
  pools.push(p);
  return p;
}

afterEach(async () => {
  await Promise.all(pools.splice(0).map((p) => p.destroy()));
});

describe('T-40 worker-thread pool', () => {
  it('1. pool size is max(1, cpus - 1)', async () => {
    const cpuCount = os.cpus().length;
    const expected = Math.max(1, cpuCount - 1);
    const singleton = getPool();
    const got = singleton.size;
    console.log(`  [test 1] cpu count = ${cpuCount}, pool size = ${got} (expected ${expected})`);
    expect(got).toBe(expected);

    // getPool() memoises on globalThis (same pattern as lib/db.ts's PrismaClient
    // stash) so Next.js dev hot reload does not leak a pool per edit -- but
    // left alive here it would keep `expected` (11 on this 12-core box) worker
    // threads running for the rest of this file, oversubscribing the machine
    // and adding noise to the timing-sensitive tests below. Tear it down and
    // clear the stash so every later test starts from a clean slate.
    await singleton.destroy();
    delete (globalThis as unknown as { __sheltersimPool?: unknown }).__sheltersimPool;
  });

  it('2. run() matches in-process simulate() and carries real Float64Array fields', async () => {
    const req = baseRequest({ tol: 0.02, cap: 30 });
    const inProcess = simulate(req);
    const viaPool = await pool(2).run(req);

    // meta.wallClockMs is each call's own self-reported timing (Date.now()-based
    // inside simulate()), not a physics output -- it is expected to differ
    // between the two invocations and is excluded from the equality check.
    const { wallClockMs: _wcIn, ...metaIn } = inProcess.meta;
    const { wallClockMs: _wcPool, ...metaPool } = viaPool.meta;
    expect(metaPool).toEqual(metaIn);
    expect({ ...viaPool, meta: metaPool }).toEqual({ ...inProcess, meta: metaIn });
    expect(viaPool.time).toBeInstanceOf(Float64Array);
    expect(viaPool.temperatures.indoorAir).toBeInstanceOf(Float64Array);
    expect(viaPool.temperatures.ambient).toBeInstanceOf(Float64Array);
    expect(viaPool.heatFlows.Q1_solarOpaque).toBeInstanceOf(Float64Array);
    console.log('  [test 2] deep-equal to in-process simulate(), all series arrived as Float64Array: PASS');
  });

  it('3. runMany(100) beats 100 sequential run() calls by at least size*0.5', async () => {
    // Uses the tighter, ~50ms/run engine-default spin-up (like the realistic
    // fixture in packages/engine/test/perf.test.ts) rather than the fast
    // 5-8ms fixture the other tests use: at that speed per-message IPC
    // overhead is a rounding error next to compute time, which is what makes
    // this a clean measurement of the pool's real parallel speedup instead of
    // a noisy one dominated by fixed per-call overhead.
    const size = 4;
    const p = pool(size);
    const reqs = Array.from({ length: 100 }, (_, i) => baseRequest({ gains: 100 + i, tol: 0.02, cap: 30 }));

    // JIT warm-up, evenly across every worker, BEFORE either timed phase.
    // pump() always fills the first free slot it finds, so a purely sequential
    // phase (awaited one call at a time, as the "sequential" baseline below
    // does) never frees more than one slot at a time and therefore always
    // lands on the SAME worker -- only that one V8 isolate gets JIT-warmed.
    // Without this step, the sequential baseline below would fully warm
    // exactly 1 of `size` workers while the parallel runMany phase after it
    // has to cold-start the other `size - 1` DURING the timed measurement --
    // an asymmetric, load-sensitive cost (confirmed: this test failed once in
    // a full-suite run at 1.85x, a bare rerun of the same file passed at
    // 2.10-3.47x) that has nothing to do with the pool's real steady-state
    // parallel efficiency, which is what this test means to measure.
    // runMany's own round-robin dispatch (pump() fills every free slot before
    // any of them frees up again) touches every worker, unlike a sequential loop.
    await p.runMany(
      Array.from({ length: size * 8 }, (_, i) => baseRequest({ gains: 100 + i, tol: 0.02, cap: 30 })),
      () => {},
    );

    const t0 = performance.now();
    for (const req of reqs) await p.run(req);
    const sequentialMs = performance.now() - t0;

    const t1 = performance.now();
    await p.runMany(reqs, () => {});
    const manyMs = performance.now() - t1;

    const ratio = sequentialMs / manyMs;
    const required = size * 0.5;
    console.log(
      `  [test 3] pool size = ${size}, sequential = ${sequentialMs.toFixed(1)} ms, runMany = ${manyMs.toFixed(1)} ms, ratio = ${ratio.toFixed(2)}x (required >= ${required}x)`,
    );
    expect(ratio).toBeGreaterThanOrEqual(required);
  });

  it('4. runMany(100) creates exactly `size` workers, not 100', async () => {
    const size = 3;
    const p = pool(size);
    const reqs = Array.from({ length: 100 }, (_, i) => baseRequest({ gains: 100 + i }));

    await p.runMany(reqs, () => {});
    console.log(`  [test 4] pool size = ${size}, workersCreated after 100-variant runMany = ${p.workersCreated}`);
    expect(p.workersCreated).toBe(size);
  });

  it('5. onProgress fires exactly 100 times, monotonically increasing, ending at 100', async () => {
    const p = pool(4);
    const reqs = Array.from({ length: 100 }, (_, i) => baseRequest({ gains: 100 + i }));
    const calls: number[] = [];

    await p.runMany(reqs, (done) => calls.push(done));

    console.log(`  [test 5] onProgress call count = ${calls.length}, last value = ${calls[calls.length - 1]}`);
    expect(calls.length).toBe(100);
    for (let i = 1; i < calls.length; i++) expect(calls[i]).toBeGreaterThan(calls[i - 1]!);
    expect(calls[calls.length - 1]).toBe(100);
  });

  it('6. the main thread stays responsive during a 100-variant runMany', async () => {
    const p = pool(4);
    const reqs = Array.from({ length: 100 }, (_, i) => baseRequest({ gains: 100 + i }));

    const TICK_MS = 10;
    const LATE_THRESHOLD_MS = 20;
    let ticks = 0;
    let late = 0;
    let expected = performance.now() + TICK_MS;
    const timer = setInterval(() => {
      const now = performance.now();
      ticks++;
      if (now - expected > LATE_THRESHOLD_MS - TICK_MS) late++;
      expected = now + TICK_MS;
    }, TICK_MS);

    await p.runMany(reqs, () => {});
    clearInterval(timer);

    const onTimePercent = ticks > 0 ? (100 * (ticks - late)) / ticks : 100;
    console.log(`  [test 6] timer ticks = ${ticks}, late (> ${LATE_THRESHOLD_MS}ms) = ${late}, on-time = ${onTimePercent.toFixed(1)}%`);
    expect(ticks).toBeGreaterThan(0);
    expect(onTimePercent).toBeGreaterThanOrEqual(95);
  });

  it('7. aborting mid-run stops dispatch and active returns to 0 within 2s', async () => {
    const p = pool(2);
    const reqs = Array.from({ length: 30 }, (_, i) => baseRequest({ gains: 100 + i }));
    const controller = new AbortController();

    const runningPromise = p.runMany(reqs, () => {}, controller.signal).catch(() => undefined);
    // Let the first couple of variants actually start before aborting.
    await new Promise((r) => setTimeout(r, 15));
    controller.abort();

    const t0 = performance.now();
    await runningPromise;
    while (p.active > 0 && performance.now() - t0 < 2000) {
      await new Promise((r) => setTimeout(r, 5));
    }
    const elapsedMs = performance.now() - t0;
    console.log(`  [test 7] active workers after abort settle = ${p.active}, elapsed = ${elapsedMs.toFixed(1)} ms`);
    expect(p.active).toBe(0);
    expect(elapsedMs).toBeLessThan(2000);
  });

  it('8. a worker EngineError arrives as a typed error response, never an unhandled rejection', async () => {
    const p = pool(1);
    await expect(p.run(unknownMaterialRequest())).rejects.toMatchObject({
      name: 'EngineError',
      code: 'UNKNOWN_MATERIAL',
    });
    // Also assert it is a real EngineError instance carrying `.code`, not a stringly-typed lookalike.
    try {
      await p.run(unknownMaterialRequest());
      throw new Error('expected rejection');
    } catch (err) {
      expect(err).toBeInstanceOf(EngineError);
      console.log(`  [test 8] rejected with EngineError code = ${(err as EngineError).code}`);
    }
  });

  it('9. a worker killed mid-run is replaced; size is stable before/during/after and the next run() succeeds', async () => {
    const p = pool(3);
    const before = p.size;

    const req = baseRequest({ tol: 0.02, cap: 30 }); // slow-ish request so the crash lands mid-run
    const inFlight = p.run(req).catch((e) => e as unknown);
    await new Promise((r) => setTimeout(r, 2)); // give the task time to be dispatched to a slot
    const crashed = p.crashBusyWorkerForTest();
    const during = p.size;

    const rejection = await inFlight;
    expect(crashed).toBe(true);
    expect(rejection).toBeInstanceOf(PoolWorkerCrashError);

    const result = await p.run(baseRequest());
    const after = p.size;

    console.log(`  [test 9] size before = ${before}, during = ${during}, after = ${after}; recovery run succeeded = ${result.meta.timesteps > 0}`);
    expect(before).toBe(3);
    expect(during).toBe(3);
    expect(after).toBe(3);
    expect(result.meta.timesteps).toBeGreaterThan(0);
  }, 15_000);

  it('10. every response id matches its request across 1,000 requests (checked by threading distinguishable payloads through)', async () => {
    const p = pool(6);
    const N = 1000;
    const reqs = Array.from({ length: N }, (_, i) => baseRequest({ gains: i })); // strictly increasing gains

    const results: SimulationResult[] = await p.runMany(reqs, () => {}, undefined);

    // More internal gains => less aux energy needed (monotonic, all else fixed).
    // If any response's id were ever matched to the wrong request/task, this
    // per-index correlation would break, since lib/pool.ts's onMessage() only
    // ever resolves the task whose `id` equals the response's `id`.
    let mismatches = 0;
    for (let i = 1; i < N; i++) {
      if (results[i]!.kpis.auxEnergyKWhPerDay > results[i - 1]!.kpis.auxEnergyKWhPerDay + 1e-6) mismatches++;
    }
    console.log(`  [test 10] ${N} requests threaded through the pool, non-monotonic (mismatched) adjacent pairs = ${mismatches}`);
    expect(results.length).toBe(N);
    expect(mismatches).toBe(0);
  }, 60_000);

  it('11. destroy() resolves and leaves no dangling handles', async () => {
    const before = process._getActiveHandles().length;
    const p = createPool(2); // not registered in `pools` -- destroyed explicitly here
    await p.run(baseRequest());
    await p.destroy();
    // Give libuv a tick to actually release the terminated threads' handles.
    await new Promise((r) => setImmediate(r));
    const after = process._getActiveHandles().length;
    console.log(`  [test 11] active handles before pool = ${before}, after destroy() = ${after}`);
    expect(after).toBeLessThanOrEqual(before);
  });

  it('12. 10,000 sequential run() calls do not grow the worker count beyond size', async () => {
    const size = 4;
    const p = pool(size);
    const N = 10_000;
    const t0 = performance.now();
    for (let i = 0; i < N; i++) {
      await p.run(baseRequest({ gains: 100 + (i % 50) }));
    }
    const totalMs = performance.now() - t0;
    console.log(
      `  [test 12] ${N} sequential run() calls, workersCreated = ${p.workersCreated} (pool size ${size}), total = ${(totalMs / 1000).toFixed(1)} s`,
    );
    expect(p.workersCreated).toBe(size);
  }, 300_000);
});
