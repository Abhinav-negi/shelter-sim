// apps/web/test/db-off.integration.test.ts
//
// T-35 -- the DB-off integration proof (see log/AREA-D-database-tier.md).
//
// "Why this exists" per the task's own entry: each database task (T-31..T-34)
// proves its OWN function degrades gracefully. None of them proves the
// APPLICATION does. This file runs the entire repository layer plus the
// engine, end to end, in three modes -- live database, DATABASE_URL unset,
// DATABASE_URL pointing at a host that never answers -- and asserts the
// offline promise (LOG.md global rule 18) is a tested fact: no throw, no
// call over 5s, and physics that does not know the database exists.
//
// MODULE-RESET PATTERN: identical to apps/web/test/db.test.ts and
// repo-*.test.ts. lib/db.ts memoises a PrismaClient on globalThis exactly
// like Next.js's dev hot reload, so every mode switch must disconnect and
// drop that stash, then vi.resetModules() before re-importing anything that
// (transitively) calls getDb() -- otherwise a later mode silently reuses an
// earlier mode's client. The root vitest.config.ts already serialises this
// file against every other apps/web/test/*.ts file for exactly this reason
// (see its own header comment) -- do not run this suite with fileParallelism
// re-enabled.
//
// KNOWN DEFECT FOUND WHILE WRITING THIS TEST, REPORTED NOT FIXED (LOG.md
// global rule 16; this task's own PROMPT says the same thing): @shelter/data's
// public package surface -- packages/data/src/index.ts's barrel, and
// package.json's "exports" field, which is only `{ ".": "./dist/index.js" }`
// -- does NOT re-export `tmyById`, `TMY_LOCATIONS`, `presetById`, `PRESETS`,
// `buildScenarios` or `scenarioWeather`. Confirmed directly:
//   node -e "import('@shelter/data').then(m => console.log(Object.keys(m)))"
//     -> MATERIALS, MATERIALS_SCHEMA_VERSION, GLAZING, GLAZING_SCHEMA_VERSION,
//        CONSTRUCTIONS, CONSTRUCTIONS_SCHEMA_VERSION, EngineError,
//        assertSchemaVersion, glazingById, materialById (no tmy/preset/scenario
//        symbols at all)
//   node -e "import('@shelter/data/dist/tmy.js')"
//     -> ERR_PACKAGE_PATH_NOT_EXPORTED
// No task's file allow-list ever closed this: T-24 created the barrel
// (materials/glazing/constructions only); T-27 (tmy.ts), T-28 (presets.ts)
// and T-59 (scenarios.ts) each added a module but were each explicitly
// restricted to their own new files and barred from touching
// packages/data/src/index.ts or packages/data/package.json. This is a
// ledger-level integration gap spanning T-24/T-27/T-28/T-59, not one task's
// bug, and it will block Area E's real /api/scenarios route and Area F's
// frontend the same way it blocks this test, the moment either tries
// `import { tmyById } from '@shelter/data'`. T-35 may not touch anything
// under packages/**, so it cannot close this gap itself (see this task's
// Evidence block in log/AREA-D-database-tier.md for the full writeup and
// recommendation). To still exercise the REAL, already-tested T-27/T-28/T-59
// functions (not reimplementations) this file reaches them the same way
// apps/web/test/repo-runs.test.ts already reaches @shelter/engine's
// canonicalRequestHash: a relative import straight into the package's own
// source, bypassing the incomplete barrel. This does not fix the barrel gap
// and is not the path real application code should copy once that gap is
// closed -- it exists only so this test can still exercise real code today.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PrismaClient } from '@prisma/client';
import { simulate } from '@shelter/engine';
import type { Material, Glazing, SimulationRequest, SimulationKpis, WeatherSeries } from '@shelter/engine';
import { materialById, glazingById } from '@shelter/data';
// See header comment: not on @shelter/data's public barrel today.
import { tmyById } from '../../../packages/data/src/tmy.js';
import { PRESETS } from '../../../packages/data/src/presets.js';
import { buildScenarios, scenarioWeather } from '../../../packages/data/src/scenarios.js';
import type { WeatherKey } from '../lib/repo/weather.js';

const BOGUS_DATABASE_URL = 'file:/nonexistent-t35-test-dir-9c2e7/dev.db';
const LIVE_DATABASE_URL = 'file:./dev.db';
// Acceptance test 4: "no call in modes 2 or 3 exceeds 5 seconds."
const MAX_CALL_MS = 5000;
// Generous vitest-level test timeout: the per-call 5s ceiling is asserted
// explicitly below; this is only a backstop against the whole `it` hanging.
const TEST_TIMEOUT_MS = 20_000;

function globalStash(): PrismaClient | undefined {
  return (globalThis as unknown as { __sheltersimDb?: PrismaClient }).__sheltersimDb;
}

async function disconnectStash(): Promise<void> {
  const existing = globalStash();
  if (existing) await existing.$disconnect().catch(() => {});
  delete (globalThis as unknown as { __sheltersimDb?: PrismaClient }).__sheltersimDb;
}

/** Fresh import of every repository module under test -- one call per mode,
 * per db.test.ts's own pattern, so no mode leaks a memoised client into the
 * next. */
async function freshRepos() {
  await disconnectStash();
  vi.resetModules();
  const materials = await import('../lib/repo/materials.js');
  const weather = await import('../lib/repo/weather.js');
  const designs = await import('../lib/repo/designs.js');
  const runs = await import('../lib/repo/runs.js');
  return { materials, weather, designs, runs };
}

/**
 * Resolves a `Preset.request` (which deliberately omits weather/materials/
 * glazings, CONTRACTS.md 7.11) into a runnable `SimulationRequest`. Verbatim
 * recipe from packages/data/test/presets.test.ts's own `resolve()` -- that is
 * the documented, already-tested way a real caller assembles one; not
 * reimplemented here, copied because it lives in a file this test may not
 * import (test files are not part of any package's public surface either).
 */
function resolveRequest(preset: (typeof PRESETS)[number], weatherOverride?: WeatherSeries): SimulationRequest {
  const materials: Record<string, Material> = {};
  for (const surface of preset.request.building.surfaces) {
    for (const layer of surface.construction) materials[layer.materialId] = materialById(layer.materialId);
  }
  const glazings: Record<string, Glazing> = {};
  for (const win of preset.request.building.windows) glazings[win.glazingId] = glazingById(win.glazingId);
  return {
    ...preset.request,
    weather: weatherOverride ?? tmyById(preset.locationId),
    materials,
    glazings,
  };
}

// Every exercise below runs against the same Leh-based preset -- exercise 2's
// own wording is "tmyById('leh') -> simulate()", and PRESET_TRADITIONAL
// (PRESETS[0]) is the bundled preset for locationId 'leh'
// (packages/data/src/presets.ts).
const LEH_PRESET = PRESETS[0]!;

interface CallTiming {
  name: string;
  ms: number;
}

interface ModeReport {
  mode: string;
  materialsCount: number;
  kpis: SimulationKpis;
  energyBalanceResidual: number;
  callTimings: CallTiming[];
  slowest: CallTiming;
  exceptionCount: number;
  scenarioMatrixMs: number;
  scenarioCount: number;
}

/** Populated as each mode's describe block runs (declaration order = run
 * order: fileParallelism is off repo-wide and vitest runs `it`s within one
 * file sequentially by default), then compared in the final describe block
 * below for acceptance tests 6 and 7 (cross-mode equality). */
const reports: Partial<Record<'live' | 'unset' | 'unreachable', ModeReport>> = {};

/**
 * Runs all six exercises from T-35's PROMPT, in order, timing each and
 * counting exceptions. `hardLimit` is non-null only for the unset/unreachable
 * modes, where acceptance tests 4 and 5 apply.
 */
async function runSixExercises(mode: string, hardLimitMs: number | null): Promise<ModeReport> {
  const { materials, weather, designs, runs } = await freshRepos();
  const callTimings: CallTiming[] = [];
  let exceptionCount = 0;

  async function guarded<T>(name: string, fn: () => Promise<T> | T): Promise<T | undefined> {
    const start = Date.now();
    try {
      const result = await fn();
      callTimings.push({ name, ms: Date.now() - start });
      return result;
    } catch (err) {
      callTimings.push({ name, ms: Date.now() - start });
      exceptionCount++;
      // eslint-disable-next-line no-console -- test evidence, LOG.md rule 15.
      console.error(`T-35 [${mode}] EXCEPTION in ${name}:`, err);
      return undefined;
    }
  }

  // ---- 1. listMaterials() -- must return a non-empty array in all modes.
  const materialsList = await guarded('listMaterials', () => materials.listMaterials());
  expect(materialsList).toBeDefined();
  expect(materialsList!.length).toBeGreaterThan(0);

  // ---- 2. tmyById('leh') -> simulate() -- energyBalanceResidual < 1e-3.
  const lehResult = await guarded('tmyById+simulate', () => {
    const series = tmyById('leh');
    const request = resolveRequest(LEH_PRESET, series);
    return simulate(request);
  });
  expect(lehResult).toBeDefined();
  expect(lehResult!.meta.energyBalanceResidual).toBeLessThan(1e-3);

  // ---- 3. readWeatherCache / writeWeatherCache -- must resolve, never throw.
  const weatherKey: WeatherKey = {
    source: 'nasa-power',
    latitude: 34.1642,
    longitude: 77.5847,
    startDate: '2023-01-01',
    endDate: '2023-12-31',
  };
  await guarded('readWeatherCache(before write)', () => weather.readWeatherCache(weatherKey));
  await guarded('writeWeatherCache', () =>
    weather.writeWeatherCache(weatherKey, tmyById('leh'), { fixture: 'T-35 db-off integration' }, 3500),
  );
  await guarded('readWeatherCache(after write)', () => weather.readWeatherCache(weatherKey));

  // ---- 4. saveDesign / loadDesign -- must resolve (possibly null), never throw.
  const designRequest = resolveRequest(LEH_PRESET);
  const saveResult = await guarded('saveDesign', () => designs.saveDesign(designRequest, `T-35 db-off ${mode}`));
  await guarded('loadDesign', () => designs.loadDesign(saveResult?.shareId ?? 'ZZZZZZZZZZ'));

  // ---- 5. readRun / writeRun -- must resolve, never throw.
  await guarded('writeRun', () => runs.writeRun(designRequest, lehResult!, false));
  await guarded('readRun', () => runs.readRun(designRequest));

  // ---- 6. The eighteen-scenario matrix (T-59, real thing) -- must complete;
  // wall-clock recorded separately from the per-call ceiling above, since it
  // is eighteen simulate() calls, not one.
  const scenarioStart = Date.now();
  let scenarioCount = 0;
  try {
    const lehSeries = tmyById('leh');
    const scenarios = buildScenarios(lehSeries, 'leh');
    expect(scenarios.length).toBe(18);
    for (const scenario of scenarios) {
      const sliced = scenarioWeather(lehSeries, scenario);
      const request = resolveRequest(LEH_PRESET, sliced);
      simulate(request);
      scenarioCount++;
    }
  } catch (err) {
    exceptionCount++;
    // eslint-disable-next-line no-console -- test evidence, LOG.md rule 15.
    console.error(`T-35 [${mode}] EXCEPTION in eighteen-scenario matrix:`, err);
  }
  const scenarioMatrixMs = Date.now() - scenarioStart;
  callTimings.push({ name: 'eighteen-scenario-matrix (18 calls)', ms: scenarioMatrixMs });

  const slowest = callTimings.reduce((a, b) => (b.ms > a.ms ? b : a));

  // Acceptance tests 4 and 5: only binding in unset/unreachable modes.
  if (hardLimitMs !== null) {
    for (const t of callTimings) {
      expect(t.ms).toBeLessThan(hardLimitMs);
    }
    expect(exceptionCount).toBe(0);
  }

  return {
    mode,
    materialsCount: materialsList!.length,
    kpis: lehResult!.kpis,
    energyBalanceResidual: lehResult!.meta.energyBalanceResidual,
    callTimings,
    slowest,
    exceptionCount,
    scenarioMatrixMs,
    scenarioCount,
  };
}

beforeEach(async () => {
  delete process.env.DATABASE_URL;
  await disconnectStash();
});

afterEach(async () => {
  await disconnectStash();
  delete process.env.DATABASE_URL;
});

describe('T-35 DB-off integration -- mode: live database', () => {
  it(
    'acceptance test 1: all six exercises pass with a live database',
    async () => {
      process.env.DATABASE_URL = LIVE_DATABASE_URL;
      const start = Date.now();
      const report = await runSixExercises('live', null);
      const totalMs = Date.now() - start;
      reports.live = report;
      // eslint-disable-next-line no-console -- test evidence, LOG.md rule 15.
      console.log(
        `T-35 test 1 [live] totalMs=${totalMs} materialsCount=${report.materialsCount} ` +
          `slowest=${report.slowest.name}:${report.slowest.ms}ms exceptions=${report.exceptionCount} ` +
          `scenarioMatrixMs=${report.scenarioMatrixMs} scenarioCount=${report.scenarioCount}`,
      );
    },
    TEST_TIMEOUT_MS,
  );
});

describe('T-35 DB-off integration -- mode: unset (DATABASE_URL absent)', () => {
  it(
    'acceptance tests 2, 4, 5: all six exercises pass, no call over 5s, zero exceptions',
    async () => {
      // beforeEach already deletes DATABASE_URL; stated explicitly for clarity.
      delete process.env.DATABASE_URL;
      const start = Date.now();
      const report = await runSixExercises('unset', MAX_CALL_MS);
      const totalMs = Date.now() - start;
      reports.unset = report;
      // eslint-disable-next-line no-console -- test evidence, LOG.md rule 15.
      console.log(
        `T-35 test 2 [unset] totalMs=${totalMs} materialsCount=${report.materialsCount} ` +
          `slowest=${report.slowest.name}:${report.slowest.ms}ms exceptions=${report.exceptionCount} ` +
          `scenarioMatrixMs=${report.scenarioMatrixMs} scenarioCount=${report.scenarioCount}`,
      );
    },
    TEST_TIMEOUT_MS,
  );
});

describe('T-35 DB-off integration -- mode: unreachable (bad DATABASE_URL)', () => {
  it(
    'acceptance tests 3, 4, 5: all six exercises pass, no call over 5s, zero exceptions',
    async () => {
      process.env.DATABASE_URL = BOGUS_DATABASE_URL;
      const start = Date.now();
      const report = await runSixExercises('unreachable', MAX_CALL_MS);
      const totalMs = Date.now() - start;
      reports.unreachable = report;
      // eslint-disable-next-line no-console -- test evidence, LOG.md rule 15.
      console.log(
        `T-35 test 3 [unreachable] totalMs=${totalMs} materialsCount=${report.materialsCount} ` +
          `slowest=${report.slowest.name}:${report.slowest.ms}ms exceptions=${report.exceptionCount} ` +
          `scenarioMatrixMs=${report.scenarioMatrixMs} scenarioCount=${report.scenarioCount}`,
      );
    },
    TEST_TIMEOUT_MS,
  );
});

describe('T-35 acceptance tests 6 and 7 -- cross-mode equality', () => {
  it('test 6: listMaterials() returns the same count in all three modes', () => {
    expect(reports.live).toBeDefined();
    expect(reports.unset).toBeDefined();
    expect(reports.unreachable).toBeDefined();
    // eslint-disable-next-line no-console -- test evidence, LOG.md rule 15.
    console.log(
      `T-35 test 6 materialsCount: live=${reports.live!.materialsCount} ` +
        `unset=${reports.unset!.materialsCount} unreachable=${reports.unreachable!.materialsCount}`,
    );
    expect(reports.unset!.materialsCount).toBe(reports.live!.materialsCount);
    expect(reports.unreachable!.materialsCount).toBe(reports.live!.materialsCount);
  });

  it('test 7: simulate() on the Leh TMY returns field-by-field identical KPIs in all three modes', () => {
    const live = reports.live!.kpis;
    const unset = reports.unset!.kpis;
    const unreachable = reports.unreachable!.kpis;
    const mismatches: string[] = [];
    for (const key of Object.keys(live) as (keyof SimulationKpis)[]) {
      if (!Object.is(live[key], unset[key])) mismatches.push(`${key}: live=${live[key]} unset=${unset[key]}`);
      if (!Object.is(live[key], unreachable[key]))
        mismatches.push(`${key}: live=${live[key]} unreachable=${unreachable[key]}`);
    }
    // eslint-disable-next-line no-console -- test evidence, LOG.md rule 15.
    console.log(`T-35 test 7 mismatches (must be none): ${mismatches.length === 0 ? 'none' : mismatches.join('; ')}`);
    expect(mismatches).toEqual([]);
    expect(unset).toEqual(live);
    expect(unreachable).toEqual(live);
  });

  it('test 8: the eighteen-scenario matrix completes in DB-off mode', () => {
    expect(reports.unset!.scenarioCount).toBe(18);
    // eslint-disable-next-line no-console -- test evidence, LOG.md rule 15.
    console.log(
      `T-35 test 8 [unset] eighteen-scenario matrix: ${reports.unset!.scenarioCount} scenarios in ` +
        `${reports.unset!.scenarioMatrixMs}ms`,
    );
  });

  it('test 4 (evidence): slowest call and duration in unset and unreachable modes', () => {
    // eslint-disable-next-line no-console -- test evidence, LOG.md rule 15.
    console.log(
      `T-35 test 4 slowest call: unset=${reports.unset!.slowest.name}:${reports.unset!.slowest.ms}ms ` +
        `unreachable=${reports.unreachable!.slowest.name}:${reports.unreachable!.slowest.ms}ms (ceiling ${MAX_CALL_MS}ms)`,
    );
    expect(reports.unset!.slowest.ms).toBeLessThan(MAX_CALL_MS);
    expect(reports.unreachable!.slowest.ms).toBeLessThan(MAX_CALL_MS);
  });

  it('test 5 (evidence): zero exceptions caught in unset and unreachable modes', () => {
    // eslint-disable-next-line no-console -- test evidence, LOG.md rule 15.
    console.log(
      `T-35 test 5 exception counts: unset=${reports.unset!.exceptionCount} unreachable=${reports.unreachable!.exceptionCount}`,
    );
    expect(reports.unset!.exceptionCount).toBe(0);
    expect(reports.unreachable!.exceptionCount).toBe(0);
  });
});
