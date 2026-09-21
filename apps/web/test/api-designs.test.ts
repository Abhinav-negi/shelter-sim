// apps/web/test/api-designs.test.ts
//
// T-41 acceptance tests (log/AREA-E-server-tier.md): POST /api/designs,
// GET /api/designs/[shareId] and GET /api/materials. Route handlers are
// invoked directly with constructed Request/NextRequest objects rather than
// through a running server -- the same "call the exported function" approach
// apps/web/test/repo-designs.test.ts (T-32) and repo-materials.test.ts (T-34)
// already use for their underlying repo functions, and Next's App Router
// route handlers are plain functions over the standard Request/Response API,
// so this needs no test server.
//
// Same DATABASE_URL / globalThis-stash management as repo-designs.test.ts,
// because lib/db.ts memoizes its PrismaClient on globalThis and only
// re-reads DATABASE_URL inside getDb() -- switching URLs between tests
// requires clearing that stash first, exactly like a real process restart
// would (see also vitest.config.ts's header comment on why this whole suite
// must run single-process, serialised).

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { NextRequest } from 'next/server';
import type { PrismaClient } from '@prisma/client';
import { MATERIALS } from '@shelter/data';
import { requestFromJson, requestToJson, type SimulationRequest } from '@shelter/engine';
import { POST as postDesign } from '../app/api/designs/route.js';
import { GET as getDesign } from '../app/api/designs/[shareId]/route.js';
import { GET as getMaterials } from '../app/api/materials/route.js';

const BOGUS_DATABASE_URL = 'file:/nonexistent-t41-test-dir-dbd41f/dev.db';
const LIVE_DATABASE_URL = 'file:./dev.db';
const ORIGIN = 'http://localhost:3000';

function globalStash(): PrismaClient | undefined {
  return (globalThis as unknown as { __sheltersimDb?: PrismaClient }).__sheltersimDb;
}

async function disconnectStash(): Promise<void> {
  const existing = globalStash();
  if (existing) await existing.$disconnect().catch(() => {});
  delete (globalThis as unknown as { __sheltersimDb?: PrismaClient }).__sheltersimDb;
}

/** A structurally complete SimulationRequest -- same fixture shape as
 * repo-designs.test.ts; requestFromJson only checks shape, not physical
 * validity, so this does not need to be a physically sensible shelter. */
function makeFixtureRequest(overrides?: Partial<SimulationRequest>): SimulationRequest {
  return {
    site: {
      id: 'site-1',
      name: 'Test Site',
      latitude: 34.15,
      longitude: 77.58,
      elevation: 3500,
      standardMeridian: 82.5,
      groundAlbedo: 0.3,
      groundTempMeanAnnual: 275,
    },
    building: {
      floorArea: 20,
      volume: 50,
      azimuth: 0,
      surfaces: [
        {
          id: 'wall-s',
          type: 'wall',
          area: 10,
          tilt: 90,
          azimuth: 0,
          construction: [{ materialId: 'mat-1', thickness: 0.3 }],
          boundary: 'exterior',
          exteriorAbsorptivity: 0.6,
          exteriorEmissivity: 0.9,
          interiorEmissivity: 0.9,
        },
      ],
      windows: [],
      thermalBridgeFactor: 1.1,
    },
    operation: {
      internalGainsSchedule: new Array(24).fill(100) as number[],
      achSchedule: new Array(24).fill(0.5) as number[],
      auxHeating: { enabled: true, setpoint: 288, maxPower: 1000 },
      comfortBand: { lower: 285, upper: 295 },
    },
    weather: {
      stepSeconds: 3600,
      startDayOfYear: 1,
      startHour: 0,
      T_amb: Float64Array.from({ length: 24 }, (_, i) => 260 + i),
      GHI: Float64Array.from({ length: 24 }, () => 200),
      v_wind: Float64Array.from({ length: 24 }, () => 2),
      provenance: {
        source: 'synthetic',
        label: 'Test fixture',
        sourceElevation: 3500,
        lapseCorrectionK: 0,
        notes: [],
      },
    },
    materials: {
      'mat-1': {
        id: 'mat-1',
        name: 'Test Material',
        category: 'structural',
        k: 1,
        rho: 2000,
        c: 900,
        alphaSolar: 0.6,
        emissivity: 0.9,
        locallyAvailableLadakh: true,
        source: 'test fixture',
      },
    },
    glazings: {},
    options: {
      timestepSeconds: 300,
      meshTargetDx: 0.02,
      simulationDays: 1,
      spinUpToleranceK: 0.02,
      maxSpinUpDays: 30,
      skyModel: 'hdkr',
      integrationTheta: 1,
      keepSurfaceProfiles: false,
      allowUnsafeVentilation: false,
    },
    ...overrides,
  };
}

function postRequest(body: unknown): NextRequest {
  return new NextRequest(`${ORIGIN}/api/designs`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function getRequest(shareId: string): Promise<Response> {
  return getDesign(new Request(`${ORIGIN}/api/designs/${shareId}`), {
    params: Promise.resolve({ shareId }),
  });
}

beforeEach(async () => {
  delete process.env.DATABASE_URL;
  await disconnectStash();
});

afterEach(async () => {
  await disconnectStash();
  delete process.env.DATABASE_URL;
});

describe('T-41 /api/designs and /api/materials', () => {
  it('1. POST a valid request returns 201 with a valid shareId; GET on it deep-equals the original', async () => {
    process.env.DATABASE_URL = LIVE_DATABASE_URL;
    const req = makeFixtureRequest();
    const res = await postDesign(postRequest({ request: requestToJson(req) }));
    expect(res.status).toBe(201);
    const postBody = (await res.json()) as { shareId: string; url: string };
    expect(postBody.shareId).toMatch(/^[A-Za-z2-9]{10}$/);
    expect(postBody.url).toContain(`/api/designs/${postBody.shareId}`);

    const getRes = await getRequest(postBody.shareId);
    expect(getRes.status).toBe(200);
    const roundTripped = requestFromJson(await getRes.json());
    expect(roundTripped).toEqual(req);
    // eslint-disable-next-line no-console -- test evidence, per LOG.md rule 15.
    console.log(
      `T-41 test 1: POST 201 shareId=${postBody.shareId} url=${postBody.url}; GET 200 deep-equal PASS`,
    );
  });

  it('2. POST {} returns 400 or 422 with a typed code and writes no row', async () => {
    process.env.DATABASE_URL = LIVE_DATABASE_URL;
    const { getDb } = await import('../lib/db.js');
    const db = getDb()!;
    const before = await db.designSnapshot.count();

    const res = await postDesign(postRequest({}));
    const body = (await res.json()) as { code: string; message: string };
    const after = await db.designSnapshot.count();

    expect([400, 422]).toContain(res.status);
    expect(typeof body.code).toBe('string');
    expect(body.code.length).toBeGreaterThan(0);
    expect(after).toBe(before);
    // eslint-disable-next-line no-console -- test evidence, per LOG.md rule 15.
    console.log(
      `T-41 test 2: POST {} -> status=${res.status} code=${body.code}; row count before=${before} after=${after}`,
    );
  });

  it('3. GET /api/designs/zzzzzzzzzz returns 404 NOT_FOUND', async () => {
    process.env.DATABASE_URL = LIVE_DATABASE_URL;
    const res = await getRequest('zzzzzzzzzz');
    const body = (await res.json()) as { code: string };
    expect(res.status).toBe(404);
    expect(body.code).toBe('NOT_FOUND');
    // eslint-disable-next-line no-console -- test evidence, per LOG.md rule 15.
    console.log(`T-41 test 3: GET unknown id -> status=${res.status} code=${body.code}`);
  });

  it('4. GET on an expired id returns 404, indistinguishable from an unknown id', async () => {
    process.env.DATABASE_URL = LIVE_DATABASE_URL;
    const { getDb } = await import('../lib/db.js');
    const { requestToJson } = await import('@shelter/engine');
    const db = getDb()!;
    const shareId = `expired${Date.now().toString(36).slice(-7)}`;
    await db.designSnapshot.create({
      data: {
        shareId,
        request: requestToJson(makeFixtureRequest()) as object,
        expiresAt: new Date(Date.now() - 60_000),
      },
    });

    const expiredRes = await getRequest(shareId);
    const unknownRes = await getRequest('nosuchid01');
    const expiredBody = await expiredRes.json();
    const unknownBody = await unknownRes.json();

    expect(expiredRes.status).toBe(404);
    expect(unknownRes.status).toBe(404);
    expect(expiredBody).toEqual(unknownBody);
    // eslint-disable-next-line no-console -- test evidence, per LOG.md rule 15.
    console.log(
      `T-41 test 4: expired -> status=${expiredRes.status} body=${JSON.stringify(expiredBody)}; ` +
        `unknown -> status=${unknownRes.status} body=${JSON.stringify(unknownBody)}`,
    );
  });

  it('5. DB OFF: POST 503 SHARE_UNAVAILABLE, GET 404, neither throws, both under 5s', async () => {
    // DATABASE_URL unset by beforeEach.
    const req = makeFixtureRequest();

    const postStart = Date.now();
    const postRes = await postDesign(postRequest({ request: requestToJson(req) }));
    const postElapsedMs = Date.now() - postStart;
    const postBody = (await postRes.json()) as { code: string; message: string };

    const getStart = Date.now();
    const getRes = await getRequest('anything');
    const getElapsedMs = Date.now() - getStart;

    expect(postRes.status).toBe(503);
    expect(postBody).toEqual({
      code: 'SHARE_UNAVAILABLE',
      message: 'Sharing needs the server. Download the design as a file instead.',
    });
    expect(postElapsedMs).toBeLessThan(5000);
    expect(getRes.status).toBe(404);
    expect(getElapsedMs).toBeLessThan(5000);
    // eslint-disable-next-line no-console -- test evidence, per LOG.md rule 15.
    console.log(
      `T-41 test 5 (DB OFF): POST status=${postRes.status} in ${postElapsedMs}ms; GET status=${getRes.status} in ${getElapsedMs}ms`,
    );
  });

  it('6. DB UNREACHABLE: same behaviour within 5s', async () => {
    process.env.DATABASE_URL = BOGUS_DATABASE_URL;
    const req = makeFixtureRequest();

    const postStart = Date.now();
    const postRes = await postDesign(postRequest({ request: requestToJson(req) }));
    const postElapsedMs = Date.now() - postStart;
    const postBody = (await postRes.json()) as { code: string };

    const getStart = Date.now();
    const getRes = await getRequest('anything');
    const getElapsedMs = Date.now() - getStart;

    expect(postRes.status).toBe(503);
    expect(postBody.code).toBe('SHARE_UNAVAILABLE');
    expect(postElapsedMs).toBeLessThan(5000);
    expect(getRes.status).toBe(404);
    expect(getElapsedMs).toBeLessThan(5000);
    // eslint-disable-next-line no-console -- test evidence, per LOG.md rule 15.
    console.log(
      `T-41 test 6 (DB UNREACHABLE): POST status=${postRes.status} in ${postElapsedMs}ms; GET status=${getRes.status} in ${getElapsedMs}ms`,
    );
  }, 7000);

  it('7. GET /api/materials with a live database returns servedFrom "database" and the full length', async () => {
    process.env.DATABASE_URL = LIVE_DATABASE_URL;
    const res = await getMaterials();
    const body = (await res.json()) as {
      materials: unknown[];
      servedFrom: string;
      schemaVersion: number;
    };
    expect(res.status).toBe(200);
    expect(body.servedFrom).toBe('database');
    expect(body.materials.length).toBe(MATERIALS.length);
    // eslint-disable-next-line no-console -- test evidence, per LOG.md rule 15.
    console.log(
      `T-41 test 7: servedFrom=${body.servedFrom} materials.length=${body.materials.length}`,
    );
  });

  it('8. DB OFF: GET /api/materials returns 200, servedFrom "code", same length', async () => {
    const res = await getMaterials();
    const body = (await res.json()) as { materials: unknown[]; servedFrom: string };
    expect(res.status).toBe(200);
    expect(body.servedFrom).toBe('code');
    expect(body.materials.length).toBe(MATERIALS.length);
    // eslint-disable-next-line no-console -- test evidence, per LOG.md rule 15.
    console.log(
      `T-41 test 8 (DB OFF): status=${res.status} servedFrom=${body.servedFrom} materials.length=${body.materials.length}`,
    );
  });

  it('9. every returned material has a non-empty source', async () => {
    process.env.DATABASE_URL = LIVE_DATABASE_URL;
    const res = await getMaterials();
    const body = (await res.json()) as { materials: Array<{ source?: string }> };
    expect(body.materials.length).toBeGreaterThan(0);
    for (const m of body.materials) {
      expect(typeof m.source).toBe('string');
      expect((m.source as string).trim().length).toBeGreaterThan(0);
    }
    // eslint-disable-next-line no-console -- test evidence, per LOG.md rule 15.
    console.log(`T-41 test 9: all ${body.materials.length} materials have non-empty source`);
  });

  it('10. GET /api/materials sets Cache-Control with max-age >= 3600', async () => {
    process.env.DATABASE_URL = LIVE_DATABASE_URL;
    const res = await getMaterials();
    const cacheControl = res.headers.get('Cache-Control') ?? '';
    const match = cacheControl.match(/max-age=(\d+)/);
    expect(match).not.toBeNull();
    const maxAge = Number(match![1]);
    expect(maxAge).toBeGreaterThanOrEqual(3600);
    // eslint-disable-next-line no-console -- test evidence, per LOG.md rule 15.
    console.log(`T-41 test 10: Cache-Control="${cacheControl}" max-age=${maxAge}`);
  });

  it('11. 20 concurrent POST /api/designs return 20 distinct share ids, all 201', async () => {
    process.env.DATABASE_URL = LIVE_DATABASE_URL;
    const req = makeFixtureRequest();
    const responses = await Promise.all(
      Array.from({ length: 20 }, () => postDesign(postRequest({ request: requestToJson(req) }))),
    );
    expect(responses.every((r) => r.status === 201)).toBe(true);
    const bodies = (await Promise.all(responses.map((r) => r.json()))) as Array<{
      shareId: string;
    }>;
    const ids = new Set(bodies.map((b) => b.shareId));
    expect(ids.size).toBe(20);
    // eslint-disable-next-line no-console -- test evidence, per LOG.md rule 15.
    console.log(
      `T-41 test 11: 20 concurrent POSTs, statuses all 201, ${ids.size} distinct share ids`,
    );
  });

  it('12. no response in this task is HTML; every response is JSON', async () => {
    process.env.DATABASE_URL = LIVE_DATABASE_URL;
    const req = makeFixtureRequest();
    const postOk = await postDesign(postRequest({ request: requestToJson(req) }));
    const postBad = await postDesign(postRequest({}));
    const shareId = ((await postOk.clone().json()) as { shareId: string }).shareId;

    delete process.env.DATABASE_URL;
    const postDbOff = await postDesign(postRequest({ request: requestToJson(req) }));
    process.env.DATABASE_URL = LIVE_DATABASE_URL;

    const getOk = await getRequest(shareId);
    const getMissing = await getRequest('missingid1');
    const materialsRes = await getMaterials();

    const responses = [postOk, postBad, postDbOff, getOk, getMissing, materialsRes];
    for (const r of responses) {
      expect(r.headers.get('Content-Type')).toContain('application/json');
    }
    // eslint-disable-next-line no-console -- test evidence, per LOG.md rule 15.
    console.log(
      `T-41 test 12: Content-Type for all ${responses.length} checked responses: ` +
        responses.map((r) => r.headers.get('Content-Type')).join(', '),
    );
  });
});
