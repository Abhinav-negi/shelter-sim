// apps/web/test/api-simulate.test.ts
//
// T-38 acceptance tests 1-12 (see log/AREA-E-server-tier.md).
//
// Same DATABASE_URL / globalThis-stash reset pattern as apps/web/test/db.test.ts
// and repo-runs.test.ts (T-33): lib/db.ts memoises a PrismaClient on globalThis
// exactly like Next.js's dev hot reload, so every mode switch disconnects and
// drops that stash, then vi.resetModules() before re-importing the route.

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PrismaClient } from '@prisma/client';
import { simulate, toK, requestToJson, resultFromJson } from '@shelter/engine';
import type {
  Material,
  Glazing,
  Surface,
  SimulationRequest,
  SimulationResult,
} from '@shelter/engine';
// Same relative-import workaround as apps/web/lib/repo/runs.ts and
// apps/web/test/repo-runs.test.ts: canonicalRequestHash is not re-exported
// from @shelter/engine's public barrel. Used here only to look up the row a
// given request would produce, so the concurrency test (12) can count it.
import { canonicalRequestHash } from '../../../packages/engine/src/serialise.js';

const BOGUS_DATABASE_URL = 'file:/nonexistent-t38-test-dir-4e91a/dev.db';
const LIVE_DATABASE_URL = 'file:./dev.db';
const ROUTE_URL = 'http://localhost/api/simulate';

function globalStash(): PrismaClient | undefined {
  return (globalThis as unknown as { __sheltersimDb?: PrismaClient }).__sheltersimDb;
}

async function disconnectStash(): Promise<void> {
  const existing = globalStash();
  if (existing) await existing.$disconnect().catch(() => {});
  delete (globalThis as unknown as { __sheltersimDb?: PrismaClient }).__sheltersimDb;
}

/** Fresh import of the route module, with no leaked db client from a previous case. */
async function freshRoute(): Promise<typeof import('../app/api/simulate/route.js')> {
  await disconnectStash();
  vi.resetModules();
  return import('../app/api/simulate/route.js');
}

/** A raw PrismaClient against the live local db, for cleaning/inspecting rows directly. */
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

// ============================== fixture (mirrors T-33's repo-runs.test.ts) ==============================

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
  source: 'T-38 test fixture',
};

const GLAZING: Glazing = {
  id: 'testGlaze',
  name: 'Test glazing',
  U: 2.8,
  SHGC: 0.76,
  tauVis: 0.78,
  b0: 0.05,
  source: 'T-38 test fixture',
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

/** A small, self-contained, physically valid request. `tag` perturbs the site id so different tests hash differently. */
function baseRequest(tag = 'base'): SimulationRequest {
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
      id: `t38-${tag}`,
      name: 'T-38 test site',
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
      provenance: {
        source: 'synthetic',
        label: 'T-38 test fixture',
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
      spinUpToleranceK: 0.02,
      maxSpinUpDays: 30,
      skyModel: 'isotropic',
      integrationTheta: 1,
      keepSurfaceProfiles: false,
      allowUnsafeVentilation: false,
    },
  };
}

function postJson(POST: (req: Request) => Promise<Response>, body: unknown): Promise<Response> {
  return POST(new Request(ROUTE_URL, { method: 'POST', body: JSON.stringify(body) }));
}

function stripWallClock(result: SimulationResult): SimulationResult {
  return { ...result, meta: { ...result.meta, wallClockMs: 0 } };
}

describe('T-38 POST /api/simulate', () => {
  it('1. equivalence: response deep-equals the in-process simulate() result, excluding meta.wallClockMs', async () => {
    process.env.DATABASE_URL = LIVE_DATABASE_URL;
    const { POST } = await freshRoute();
    const req = baseRequest('equiv');
    const inProcess = simulate(req);

    const res = await postJson(POST, requestToJson(req));
    expect(res.status).toBe(200);
    const json = await res.json();
    const fromApi = resultFromJson(json);

    expect(stripWallClock(fromApi)).toEqual(stripWallClock(inProcess));
    console.log(
      `T-38 test 1: status=${res.status}, fields deep-equal (excluding meta.wallClockMs): true`,
    );
  });

  it('2. meta.energyBalanceResidual < 1e-3 on the returned result', async () => {
    process.env.DATABASE_URL = LIVE_DATABASE_URL;
    const { POST } = await freshRoute();
    const req = baseRequest('residual');

    const res = await postJson(POST, requestToJson(req));
    const json = (await res.json()) as { meta: { energyBalanceResidual: number } };
    expect(json.meta.energyBalanceResidual).toBeLessThan(1e-3);
    console.log(`T-38 test 2: energyBalanceResidual=${json.meta.energyBalanceResidual}`);
  });

  it('3. malformed body {} returns 400 INVALID_INPUT with a detail array, and writes no SimulationRun row', async () => {
    process.env.DATABASE_URL = LIVE_DATABASE_URL;
    const db = await liveDb();
    const before = await db.simulationRun.count();
    await disconnectStash();

    process.env.DATABASE_URL = LIVE_DATABASE_URL;
    const { POST } = await freshRoute();
    const res = await postJson(POST, {});
    const json = (await res.json()) as { code: string; detail: unknown[] };

    expect(res.status).toBe(400);
    expect(json.code).toBe('INVALID_INPUT');
    expect(Array.isArray(json.detail)).toBe(true);
    expect(json.detail.length).toBeGreaterThan(0);

    const dbAfter = await liveDb();
    const after = await dbAfter.simulationRun.count();
    expect(after).toBe(before);
    console.log(
      `T-38 test 3: status=${res.status}, code=${json.code}, detail=${JSON.stringify(json.detail)}, rows before=${before} after=${after}`,
    );
  });

  it('4. three simultaneously invalid fields produce one response with three detail entries', async () => {
    process.env.DATABASE_URL = LIVE_DATABASE_URL;
    const { POST } = await freshRoute();
    const req = baseRequest('three-bad');
    req.site.latitude = 999; // out of [-90, 90]
    req.building.volume = -5; // must be positive
    req.operation.achSchedule = new Array(23).fill(0.5); // must have exactly 24 values

    const res = await postJson(POST, requestToJson(req));
    const json = (await res.json()) as {
      code: string;
      detail: Array<{ path: string; message: string }>;
    };

    expect(res.status).toBe(400);
    expect(json.code).toBe('INVALID_INPUT');
    expect(json.detail.length).toBe(3);
    console.log(
      `T-38 test 4: status=${res.status}, detail count=${json.detail.length}, paths=${json.detail.map((d) => d.path).join(', ')}`,
    );
  });

  it('5. a window larger than its host surface returns 400 GEOMETRY_INCONSISTENT', async () => {
    process.env.DATABASE_URL = LIVE_DATABASE_URL;
    const { POST } = await freshRoute();
    const req = baseRequest('big-window');
    req.building.windows = [
      { id: 'southWindow', hostSurfaceId: 'south', area: 20, glazingId: GLAZING.id },
    ]; // host 'south' is 16 m^2

    const res = await postJson(POST, requestToJson(req));
    const json = (await res.json()) as { code: string };
    expect(res.status).toBe(400);
    expect(json.code).toBe('GEOMETRY_INCONSISTENT');
    console.log(`T-38 test 5: status=${res.status}, code=${json.code}`);
  });

  it('6. an unknown materialId returns 422 UNKNOWN_MATERIAL', async () => {
    process.env.DATABASE_URL = LIVE_DATABASE_URL;
    const { POST } = await freshRoute();
    const req = baseRequest('bad-material');
    req.building.surfaces = req.building.surfaces.map((s) =>
      s.id === 'south'
        ? { ...s, construction: [{ materialId: 'doesNotExist', thickness: 0.4 }] }
        : s,
    );

    const res = await postJson(POST, requestToJson(req));
    const json = (await res.json()) as { code: string };
    expect(res.status).toBe(422);
    expect(json.code).toBe('UNKNOWN_MATERIAL');
    console.log(`T-38 test 6: status=${res.status}, code=${json.code}`);
  });

  it('7. a request engineered to diverge returns 500 SOLVER_DIVERGED', async () => {
    process.env.DATABASE_URL = LIVE_DATABASE_URL;
    const { POST } = await freshRoute();
    const req = baseRequest('diverge');
    req.operation.internalGainsSchedule = new Array(24).fill(1e15); // physically absurd, forces the air node past T_MAX_PLAUSIBLE on step 1

    const res = await postJson(POST, requestToJson(req));
    const json = (await res.json()) as { code: string };
    expect(res.status).toBe(500);
    expect(json.code).toBe('SOLVER_DIVERGED');
    console.log(`T-38 test 7: status=${res.status}, code=${json.code}`);
  });

  it('8. a 6 MB body returns 413 PAYLOAD_TOO_LARGE', async () => {
    process.env.DATABASE_URL = LIVE_DATABASE_URL;
    const { POST } = await freshRoute();
    const bigBody = JSON.stringify({ padding: 'x'.repeat(6 * 1024 * 1024) });
    expect(Buffer.byteLength(bigBody, 'utf8')).toBeGreaterThan(5 * 1024 * 1024);

    const res = await POST(new Request(ROUTE_URL, { method: 'POST', body: bigBody }));
    const json = (await res.json()) as { code: string };
    expect(res.status).toBe(413);
    expect(json.code).toBe('PAYLOAD_TOO_LARGE');
    console.log(
      `T-38 test 8: bodyBytes=${Buffer.byteLength(bigBody, 'utf8')}, status=${res.status}, code=${json.code}`,
    );
  });

  it("9. cache hit: second identical POST returns the same KPIs with 'served from cache' in meta.warnings, and is measurably faster", async () => {
    process.env.DATABASE_URL = LIVE_DATABASE_URL;
    const { POST } = await freshRoute();
    const req = baseRequest('cache-hit');
    const body = requestToJson(req);

    const t0 = performance.now();
    const res1 = await postJson(POST, body);
    const t1 = performance.now();
    const json1 = (await res1.json()) as { kpis: unknown; meta: { warnings: string[] } };
    const firstMs = t1 - t0;

    const t2 = performance.now();
    const res2 = await postJson(POST, body);
    const t3 = performance.now();
    const json2 = (await res2.json()) as { kpis: unknown; meta: { warnings: string[] } };
    const secondMs = t3 - t2;

    expect(res1.status).toBe(200);
    expect(res2.status).toBe(200);
    expect(json1.meta.warnings).not.toContain('served from cache');
    expect(json2.meta.warnings).toContain('served from cache');
    expect(json2.kpis).toEqual(json1.kpis);
    expect(secondMs).toBeLessThan(firstMs);
    console.log(
      `T-38 test 9: first (miss) ${firstMs.toFixed(2)}ms, second (hit) ${secondMs.toFixed(2)}ms`,
    );
  });

  it('10. DB unreachable: route still returns a correct result within 5s, only caching is lost', async () => {
    process.env.DATABASE_URL = BOGUS_DATABASE_URL;
    const { POST } = await freshRoute();
    const req = baseRequest('db-unreachable');

    const start = performance.now();
    const res = await postJson(POST, requestToJson(req));
    const elapsed = performance.now() - start;
    const json = (await res.json()) as { kpis: { auxEnergyKWhPerDay: number } };

    expect(res.status).toBe(200);
    expect(elapsed).toBeLessThan(5000);
    expect(json.kpis).toBeDefined();
    console.log(
      `T-38 test 10: DB unreachable -> status=${res.status}, elapsed=${elapsed.toFixed(1)}ms`,
    );
  });

  it('11. every error response is Content-Type: application/json with no HTML and no stack trace', async () => {
    process.env.DATABASE_URL = LIVE_DATABASE_URL;
    const { POST } = await freshRoute();
    const res = await postJson(POST, {});
    const text = await res.text();

    expect(res.headers.get('content-type')).toMatch(/application\/json/);
    expect(text).not.toMatch(/<html/i);
    expect(text).not.toMatch(/at\s+\S+\s+\(.*:\d+:\d+\)/); // a stack-trace frame shape
    console.log(`T-38 test 11: content-type=${res.headers.get('content-type')}`);
  });

  it('12. ten concurrent identical POSTs all return 200 and leave exactly one cache row', async () => {
    process.env.DATABASE_URL = LIVE_DATABASE_URL;
    const { POST } = await freshRoute();
    const req = baseRequest('concurrent');
    const body = JSON.stringify(requestToJson(req));

    const responses = await Promise.all(
      Array.from({ length: 10 }, () => POST(new Request(ROUTE_URL, { method: 'POST', body }))),
    );
    expect(responses.every((r) => r.status === 200)).toBe(true);

    const hash = canonicalRequestHash(req);
    const db = await liveDb();
    const rows = await db.simulationRun.count({ where: { requestHash: hash } });
    expect(rows).toBe(1);
    console.log(
      `T-38 test 12: statuses=${responses.map((r) => r.status).join(',')}, rows for hash=${rows}`,
    );
  });
});
