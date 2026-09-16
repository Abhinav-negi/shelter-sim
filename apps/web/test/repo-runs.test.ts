// apps/web/test/repo-runs.test.ts
//
// T-33 acceptance tests 1-13 (see log/AREA-D-database-tier.md).
//
// Mirrors apps/web/test/db.test.ts's DATABASE_URL / globalThis-stash reset
// pattern: lib/db.ts memoises a client on globalThis exactly like Next.js's
// dev hot-reload, so every test that varies DATABASE_URL must clear that
// stash and re-import fresh, the same way a real reload would.

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PrismaClient, Prisma } from '@prisma/client';
import { simulate, toK } from '@shelter/engine';
import type { Material, Glazing, Surface, SimulationRequest, SimulationResult } from '@shelter/engine';
// Same relative-import workaround as lib/repo/runs.ts, and for the same
// reason: canonicalRequestHash is not re-exported from @shelter/engine's
// public barrel. See runs.ts's header comment and T-33's Evidence block for
// the full writeup. Used here only to compute the same hash the repository
// code computes, so the test can seed/inspect rows directly.
import { canonicalRequestHash } from '../../../packages/engine/src/serialise.js';

const BOGUS_DATABASE_URL = 'file:/nonexistent-t33-test-dir-8f1c2/dev.db';
const LIVE_DATABASE_URL = 'file:./dev.db';

function globalStash(): PrismaClient | undefined {
  return (globalThis as unknown as { __sheltersimDb?: PrismaClient }).__sheltersimDb;
}

async function disconnectStash(): Promise<void> {
  const existing = globalStash();
  if (existing) await existing.$disconnect().catch(() => {});
  delete (globalThis as unknown as { __sheltersimDb?: PrismaClient }).__sheltersimDb;
}

/** Fresh import of lib/repo/runs.ts with no leaked client from a previous case. */
async function freshRuns() {
  await disconnectStash();
  vi.resetModules();
  return import('../lib/repo/runs.js');
}

/** A raw PrismaClient against the live local db, for seeding/inspecting rows directly. */
async function liveDb(): Promise<PrismaClient> {
  process.env.DATABASE_URL = LIVE_DATABASE_URL;
  await disconnectStash();
  vi.resetModules();
  const { getDb } = await import('../lib/db.js');
  const db = getDb();
  if (!db) throw new Error('test setup expected a live database (apps/web/prisma/dev.db)');
  return db;
}

beforeEach(async () => {
  delete process.env.DATABASE_URL;
  await disconnectStash();
});

afterEach(async () => {
  await disconnectStash();
  delete process.env.DATABASE_URL;
});

beforeAll(async () => {
  const db = await liveDb();
  await db.simulationRun.deleteMany({});
  await disconnectStash();
  delete process.env.DATABASE_URL;
});

// ============================== fixture ==============================

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
  source: 'T-33 test fixture',
};

const GLAZING: Glazing = {
  id: 'testGlaze',
  name: 'Test glazing',
  U: 2.8,
  SHGC: 0.76,
  tauVis: 0.78,
  b0: 0.05,
  source: 'T-33 test fixture',
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

/** A small, self-contained, physically valid request -- T-33's own fixture (not shared with packages/engine/test). */
function baseRequest(): SimulationRequest {
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
      id: 't33',
      name: 'T-33 test site',
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
      internalGainsSchedule: new Array(24).fill(150),
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
      provenance: { source: 'synthetic', label: 'T-33 test fixture', sourceElevation: null, lapseCorrectionK: 0, notes: [] },
    },
    materials: { [MATERIAL.id]: MATERIAL },
    glazings: { [GLAZING.id]: GLAZING },
    options: {
      timestepSeconds: 300,
      meshTargetDx: 0.02,
      simulationDays: 2,
      spinUpToleranceK: 0.02,
      maxSpinUpDays: 30,
      skyModel: 'isotropic',
      integrationTheta: 1,
      keepSurfaceProfiles: false,
      allowUnsafeVentilation: false,
    },
  };
}

describe('T-33 lib/repo/runs.ts', () => {
  it('1. write then read: KPIs deep-equal, energyBalanceResidual preserved exactly through the cache', async () => {
    process.env.DATABASE_URL = LIVE_DATABASE_URL;
    const { writeRun, readRun } = await freshRuns();
    const req = baseRequest();
    const result = simulate(req);

    await writeRun(req, result, false);
    const cached = await readRun(req);

    expect(cached).not.toBeNull();
    expect(cached!.kpis).toEqual(result.kpis);
    const diff = Math.abs(cached!.meta.energyBalanceResidual - result.meta.energyBalanceResidual);
    expect(diff).toBeLessThan(1e-15);
    console.log(
      `T-33 test 1: original energyBalanceResidual=${result.meta.energyBalanceResidual}, ` +
        `cached=${cached!.meta.energyBalanceResidual}, diff=${diff}`,
    );
  });

  it('2. a request differing in any physical field is a miss', async () => {
    process.env.DATABASE_URL = LIVE_DATABASE_URL;
    const { writeRun, readRun } = await freshRuns();
    const req = baseRequest();
    const result = simulate(req);
    await writeRun(req, result, false);

    const variants: Array<[string, SimulationRequest]> = [
      ['site.elevation', { ...req, site: { ...req.site, elevation: req.site.elevation + 100 } }],
      ['building.volume', { ...req, building: { ...req.building, volume: req.building.volume + 5 } }],
      [
        'operation.achSchedule[3]',
        {
          ...req,
          operation: {
            ...req.operation,
            achSchedule: req.operation.achSchedule.map((v, i) => (i === 3 ? v + 0.1 : v)),
          },
        },
      ],
      ['options.timestepSeconds', { ...req, options: { ...req.options, timestepSeconds: 600 } }],
    ];

    for (const [label, variant] of variants) {
      const miss = await readRun(variant);
      expect(miss, `${label} should be a miss`).toBeNull();
    }
    console.log(`T-33 test 2: all 4 varied fields (${variants.map(([l]) => l).join(', ')}) were misses`);
  });

  it('3. a request differing only in key insertion order is a hit', async () => {
    process.env.DATABASE_URL = LIVE_DATABASE_URL;
    const { writeRun, readRun } = await freshRuns();
    const req = baseRequest();
    const result = simulate(req);
    await writeRun(req, result, false);

    // Same content, top-level keys inserted in reverse order.
    const reordered: SimulationRequest = {
      options: req.options,
      glazings: req.glazings,
      materials: req.materials,
      weather: req.weather,
      operation: req.operation,
      building: req.building,
      site: req.site,
    };
    expect(Object.keys(reordered)).not.toEqual(Object.keys(req));

    const hit = await readRun(reordered);
    expect(hit).not.toBeNull();
    expect(hit!.kpis).toEqual(result.kpis);
    console.log('T-33 test 3: key-order-reordered request was a hit');
  });

  it('4. version gating: a row written under a different engineVersion is a miss', async () => {
    process.env.DATABASE_URL = LIVE_DATABASE_URL;
    const { ENGINE_VERSION } = await freshRuns();
    const db = await liveDb();

    const req = { ...baseRequest(), site: { ...baseRequest().site, elevation: 4001 } };
    const result = simulate(req);
    const requestHash = canonicalRequestHash(req);
    await db.simulationRun.create({
      data: {
        requestHash,
        kpis: result.kpis as unknown as Prisma.InputJsonValue,
        meta: result.meta as unknown as Prisma.InputJsonValue,
        engineVersion: '0.0.1',
      },
    });
    await disconnectStash();

    process.env.DATABASE_URL = LIVE_DATABASE_URL;
    const { readRun } = await freshRuns();
    const miss = await readRun(req);
    expect(miss).toBeNull();
    console.log(`T-33 test 4: row engineVersion='0.0.1', running engine ENGINE_VERSION='${ENGINE_VERSION}' -> miss`);

    // Clean up: this row's stale engineVersion would otherwise inflate test
    // 5's purgeRunsForOtherVersions() count, since both tests share the same
    // dev.db within a single run.
    await (await liveDb()).simulationRun.delete({ where: { requestHash } });
  });

  it('5. purgeRunsForOtherVersions removes exactly the stale-version rows and returns their count', async () => {
    process.env.DATABASE_URL = LIVE_DATABASE_URL;
    const db = await liveDb();

    const reqA = { ...baseRequest(), site: { ...baseRequest().site, elevation: 4101 } };
    const reqB = { ...baseRequest(), site: { ...baseRequest().site, elevation: 4102 } };
    const reqC = { ...baseRequest(), site: { ...baseRequest().site, elevation: 4103 } };
    const [hashA, hashB, hashC] = [reqA, reqB, reqC].map((r) => canonicalRequestHash(r));
    const kpis = simulate(reqA).kpis as unknown as Prisma.InputJsonValue;
    const meta = simulate(reqA).meta as unknown as Prisma.InputJsonValue;

    await db.simulationRun.create({ data: { requestHash: hashA, kpis, meta, engineVersion: '0.0.1' } });
    await db.simulationRun.create({ data: { requestHash: hashB, kpis, meta, engineVersion: '0.0.2' } });
    await disconnectStash();

    process.env.DATABASE_URL = LIVE_DATABASE_URL;
    const { writeRun, purgeRunsForOtherVersions } = await freshRuns();
    const resultC = simulate(reqC);
    await writeRun(reqC, resultC, false); // written under the real running ENGINE_VERSION

    const removed = await purgeRunsForOtherVersions();
    expect(removed).toBe(2);

    const remaining = await liveDb();
    const stillA = await remaining.simulationRun.findUnique({ where: { requestHash: hashA } });
    const stillB = await remaining.simulationRun.findUnique({ where: { requestHash: hashB } });
    const stillC = await remaining.simulationRun.findUnique({ where: { requestHash: hashC } });
    expect(stillA).toBeNull();
    expect(stillB).toBeNull();
    expect(stillC).not.toBeNull();
    console.log(`T-33 test 5: purgeRunsForOtherVersions() removed=${removed} (expected 2), version-matched row kept`);
  });

  it('6. readFullRun after writeRun(storeFull: true) round-trips the full SimulationResult', async () => {
    process.env.DATABASE_URL = LIVE_DATABASE_URL;
    const { writeRun, readFullRun } = await freshRuns();
    const req = { ...baseRequest(), site: { ...baseRequest().site, elevation: 4201 } };
    const result = simulate(req);
    await writeRun(req, result, true);

    const full = await readFullRun(req);
    expect(full).not.toBeNull();
    expect(full!.time).toBeInstanceOf(Float64Array);
    expect(full!.temperatures.indoorAir).toBeInstanceOf(Float64Array);
    expect(full!.heatFlows.Qaux).toBeInstanceOf(Float64Array);
    expect(Array.from(full!.time)).toEqual(Array.from(result.time));
    expect(Array.from(full!.temperatures.indoorAir)).toEqual(Array.from(result.temperatures.indoorAir));
    expect(full!.kpis).toEqual(result.kpis);
    console.log(`T-33 test 6: readFullRun round-tripped ${full!.time.length} timesteps, Float64Array instanceof confirmed`);
  });

  it('7. readFullRun after writeRun(storeFull: false) returns null, not a partial object', async () => {
    process.env.DATABASE_URL = LIVE_DATABASE_URL;
    const { writeRun, readFullRun } = await freshRuns();
    const req = { ...baseRequest(), site: { ...baseRequest().site, elevation: 4301 } };
    const result = simulate(req);
    await writeRun(req, result, false);

    const full = await readFullRun(req);
    expect(full).toBeNull();
    console.log('T-33 test 7: readFullRun after storeFull=false -> null');
  });

  it("8. a cache hit adds 'served from cache' to meta.warnings; a fresh run does not", async () => {
    process.env.DATABASE_URL = LIVE_DATABASE_URL;
    const { writeRun, readRun } = await freshRuns();
    const req = { ...baseRequest(), site: { ...baseRequest().site, elevation: 4401 } };
    const result = simulate(req);
    expect(result.meta.warnings).not.toContain('served from cache');

    await writeRun(req, result, false);
    const cached = await readRun(req);
    expect(cached!.meta.warnings).toContain('served from cache');
    console.log(`T-33 test 8: fresh warnings=${JSON.stringify(result.meta.warnings)}, cached warnings=${JSON.stringify(cached!.meta.warnings)}`);
  });

  it('9. the cache never changes an answer: cached KPIs equal a second live run field-by-field', async () => {
    process.env.DATABASE_URL = LIVE_DATABASE_URL;
    const { writeRun, readRun } = await freshRuns();
    const req = { ...baseRequest(), site: { ...baseRequest().site, elevation: 4501 } };
    const first = simulate(req);
    await writeRun(req, first, false);
    const second = simulate(req);

    const cached = await readRun(req);
    expect(cached).not.toBeNull();

    const mismatches: string[] = [];
    for (const key of Object.keys(second.kpis) as Array<keyof SimulationResult['kpis']>) {
      if (!Object.is(cached!.kpis[key], second.kpis[key])) mismatches.push(String(key));
    }
    expect(mismatches).toEqual([]);
    console.log(`T-33 test 9: compared ${Object.keys(second.kpis).length} kpis fields, mismatches=${JSON.stringify(mismatches)}`);
  });

  it(
    '10. DB OFF: readRun null, writeRun silent, and the 18-scenario grid still computes live',
    async () => {
      delete process.env.DATABASE_URL;
      const { readRun, writeRun } = await freshRuns();
      const req = baseRequest();

      const readResult = await readRun(req);
      expect(readResult).toBeNull();
      await expect(writeRun(req, simulate(req), false)).resolves.toBeUndefined();

      const start = Date.now();
      for (let i = 0; i < 18; i++) {
        const variant = { ...req, site: { ...req.site, elevation: req.site.elevation + i } };
        simulate(variant);
      }
      const elapsedMs = Date.now() - start;
      console.log(`T-33 test 10: DB-off, readRun=null, writeRun resolved silently, 18 live simulate() calls took ${elapsedMs}ms`);
      expect(elapsedMs).toBeLessThan(5000);
    },
    10000,
  );

  it(
    '11. DB UNREACHABLE: readRun null, writeRun silent, within 5s each',
    async () => {
      process.env.DATABASE_URL = BOGUS_DATABASE_URL;
      const { readRun, writeRun } = await freshRuns();
      const req = baseRequest();
      const result = simulate(req);

      let start = Date.now();
      const readResult = await readRun(req);
      const readMs = Date.now() - start;
      expect(readResult).toBeNull();
      expect(readMs).toBeLessThan(5000);

      start = Date.now();
      await writeRun(req, result, false);
      const writeMs = Date.now() - start;
      expect(writeMs).toBeLessThan(5000);

      console.log(`T-33 test 11: DB-unreachable, readRun ${readMs}ms -> null, writeRun ${writeMs}ms -> resolved silently`);
    },
    12000,
  );

  it('12. concurrent write: ten simultaneous writeRun calls with the same request leave exactly one row', async () => {
    process.env.DATABASE_URL = LIVE_DATABASE_URL;
    const { writeRun } = await freshRuns();
    const req = { ...baseRequest(), site: { ...baseRequest().site, elevation: 4601 } };
    const result = simulate(req);

    const outcomes = await Promise.allSettled(Array.from({ length: 10 }, () => writeRun(req, result, false)));
    const rejected = outcomes.filter((o) => o.status === 'rejected');
    expect(rejected).toEqual([]);

    const db = await liveDb();
    const requestHash = canonicalRequestHash(req);
    const count = await db.simulationRun.count({ where: { requestHash } });
    expect(count).toBe(1);
    console.log(`T-33 test 12: 10 concurrent writeRun calls, rejected=${rejected.length}, resulting row count=${count}`);
  });

  it('13. stored row size with and without storeFull, in bytes', async () => {
    process.env.DATABASE_URL = LIVE_DATABASE_URL;
    const { writeRun } = await freshRuns();

    const reqSmall = { ...baseRequest(), site: { ...baseRequest().site, elevation: 4701 } };
    const reqFull = { ...baseRequest(), site: { ...baseRequest().site, elevation: 4702 } };
    const resultSmall = simulate(reqSmall);
    const resultFull = simulate(reqFull);
    await writeRun(reqSmall, resultSmall, false);
    await writeRun(reqFull, resultFull, true);

    const db = await liveDb();
    const rowSmall = await db.simulationRun.findUnique({ where: { requestHash: canonicalRequestHash(reqSmall) } });
    const rowFull = await db.simulationRun.findUnique({ where: { requestHash: canonicalRequestHash(reqFull) } });
    expect(rowSmall).not.toBeNull();
    expect(rowFull).not.toBeNull();

    const bytesSmall = Buffer.byteLength(JSON.stringify(rowSmall!.kpis) + JSON.stringify(rowSmall!.meta), 'utf8');
    const bytesFull =
      Buffer.byteLength(JSON.stringify(rowFull!.kpis) + JSON.stringify(rowFull!.meta), 'utf8') +
      Buffer.byteLength(JSON.stringify(rowFull!.fullResult), 'utf8');

    expect(bytesFull).toBeGreaterThan(bytesSmall);
    console.log(`T-33 test 13: stored row bytes without storeFull=${bytesSmall}, with storeFull=${bytesFull}`);
  });
});
