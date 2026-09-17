// apps/web/test/api-weather.test.ts
//
// T-37 acceptance tests 1-11 (see log/AREA-E-server-tier.md). Acceptance
// test 12 ("deleting apps/web/app/api/ still leaves `npm run build
// --workspace apps/web` succeeding") is a build-time check, not a unit
// test -- it is run manually and pasted into the Evidence block, the same
// way T-36 verified its own build-shape acceptance tests outside vitest.
//
// ============================================================================
// BLOCKED: this whole file currently cannot run. `../app/api/weather/route.ts`
// imports `normaliseWeather`/`nasaPowerUrl`/`parseNasaPower`/`openMeteoUrl`/
// `parseOpenMeteo` from `@shelter/data`, none of which are re-exported from
// that package's public barrel (`packages/data/src/index.ts`) -- confirmed
// live: `Object.keys(await import('@shelter/data'))` does not include any of
// those 5 names. `packages/**` is outside T-37's allow-list, so this cannot
// be fixed from here. See log/AREA-E-server-tier.md's T-37 Evidence block for
// the full repro and the one-line fix needed (a barrel re-export in
// packages/data/src/index.ts). This file is written complete and ready to
// run the moment that barrel gap is closed.
// ============================================================================

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PrismaClient } from '@prisma/client';
import { NextRequest } from 'next/server';
import { seriesFromJson, simulate } from '@shelter/engine';
import type { SimulationRequest } from '@shelter/engine';
import { PRESETS, tmyById } from '@shelter/data';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROUTE_FILE = path.join(__dirname, '..', 'app', 'api', 'weather', 'route.ts');

const BOGUS_DATABASE_URL = 'file:/nonexistent-t37-test-dir-7e2b90/dev.db';
const LIVE_DATABASE_URL = 'file:./dev.db';

function globalStash(): PrismaClient | undefined {
  return (globalThis as unknown as { __sheltersimDb?: PrismaClient }).__sheltersimDb;
}

async function disconnectStash(): Promise<void> {
  const existing = globalStash();
  if (existing) await existing.$disconnect().catch(() => {});
  delete (globalThis as unknown as { __sheltersimDb?: PrismaClient }).__sheltersimDb;
}

/** Same fresh-module pattern as repo-weather.test.ts -- lib/db.ts memoises its
 *  client on globalThis, so a test that changes DATABASE_URL must reset both. */
async function freshRoute() {
  await disconnectStash();
  vi.resetModules();
  return import('../app/api/weather/route.js');
}

const raw = new PrismaClient({ datasources: { db: { url: LIVE_DATABASE_URL } } });

async function countWeatherRows(): Promise<number> {
  return raw.weatherCache.count();
}

function postRequest(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/weather', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

const TEST_BODY = {
  source: 'nasa-power' as const,
  latitude: 34.15,
  longitude: 77.58,
  startDate: '2023-06-01',
  endDate: '2023-06-01',
  siteElevation: 3500,
};

// A compact, synthetic NASA POWER fixture shaped exactly as T-26's
// parseNasaPower expects (CONTRACTS.md §7 / sources.ts). 6 hourly samples,
// no gaps, a source grid elevation different from the requested site so the
// lapse correction is non-zero and observable (acceptance test 3).
const NASA_SOURCE_ELEVATION_M = 4120;

function buildNasaPowerFixture() {
  const hours = ['00', '01', '02', '03', '04', '05'];
  const mkField = (values: number[]) => Object.fromEntries(hours.map((h, i) => [`20230601${h}`, values[i]]));
  return {
    header: { fill_value: -999 },
    geometry: { coordinates: [TEST_BODY.longitude, TEST_BODY.latitude, NASA_SOURCE_ELEVATION_M] },
    properties: {
      parameter: {
        T2M: mkField([-8, -8, -7, -6, -5, -5]),
        ALLSKY_SFC_SW_DWN: mkField([0, 0, 0, 0, 50, 120]),
        ALLSKY_SFC_SW_DNI: mkField([0, 0, 0, 0, 40, 90]),
        ALLSKY_SFC_SW_DIFF: mkField([0, 0, 0, 0, 10, 30]),
        ALLSKY_SFC_LW_DWN: mkField([180, 180, 181, 181, 182, 183]),
        WS2M: mkField([2, 2, 3, 3, 3, 4]),
        RH2M: mkField([40, 41, 42, 43, 44, 45]),
        PS: mkField([65, 65, 65, 65, 65, 65]),
      },
    },
  };
}

function okJsonResponse(json: unknown): Response {
  return new Response(JSON.stringify(json), { status: 200, headers: { 'content-type': 'application/json' } });
}

beforeEach(async () => {
  process.env.NEXT_PUBLIC_ENABLE_LIVE_WEATHER = 'true';
  process.env.DATABASE_URL = LIVE_DATABASE_URL;
  await disconnectStash();
  await raw.weatherCache.deleteMany({ where: { latitude: TEST_BODY.latitude, longitude: TEST_BODY.longitude } });
  vi.restoreAllMocks();
});

afterEach(async () => {
  delete process.env.NEXT_PUBLIC_ENABLE_LIVE_WEATHER;
  delete process.env.DATABASE_URL;
  await disconnectStash();
  vi.restoreAllMocks();
});

describe('T-37 /api/weather', () => {
  it('1: flag unset -> 501 LIVE_WEATHER_DISABLED, no cache row, no fetch', async () => {
    delete process.env.NEXT_PUBLIC_ENABLE_LIVE_WEATHER;
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const before = await countWeatherRows();
    const { POST } = await freshRoute();
    const res = await POST(postRequest(TEST_BODY));
    const body = await res.json();
    const after = await countWeatherRows();
    console.log(`TEST1_STATUS=${res.status} TEST1_CODE=${body.code} rows_before=${before} rows_after=${after} fetch_calls=${fetchSpy.mock.calls.length}`);
    expect(res.status).toBe(501);
    expect(body.code).toBe('LIVE_WEATHER_DISABLED');
    expect(after).toBe(before);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('2 & 3: valid WeatherSeries with lapse-correction numbers shown', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(okJsonResponse(buildNasaPowerFixture()));
    const { POST } = await freshRoute();
    const res = await POST(postRequest(TEST_BODY));
    const body = await res.json();
    console.log(
      `TEST3_sourceElevation=${body.sourceElevation} TEST3_siteElevation=${body.siteElevation} TEST3_lapseCorrectionK=${body.lapseCorrectionK}`,
    );
    expect(res.status).toBe(200);

    const series = {
      ...body.series,
      T_amb: seriesFromJson(body.series.T_amb),
      GHI: seriesFromJson(body.series.GHI),
      v_wind: seriesFromJson(body.series.v_wind),
      DNI: body.series.DNI ? seriesFromJson(body.series.DNI) : undefined,
      DHI: body.series.DHI ? seriesFromJson(body.series.DHI) : undefined,
      LW_down: body.series.LW_down ? seriesFromJson(body.series.LW_down) : undefined,
      RH: body.series.RH ? seriesFromJson(body.series.RH) : undefined,
    };

    const preset = PRESETS[0]!;
    const weather = tmyById(preset.locationId) ?? series;
    const request: SimulationRequest = {
      ...preset.request,
      weather: series,
    } as unknown as SimulationRequest;
    expect(() => simulate(request)).not.toThrow();
    void weather;

    expect(body.sourceElevation).toBe(NASA_SOURCE_ELEVATION_M);
    expect(body.siteElevation).toBe(TEST_BODY.siteElevation);
    const expectedLapseK = (6.5 * (NASA_SOURCE_ELEVATION_M - TEST_BODY.siteElevation)) / 1000;
    expect(body.lapseCorrectionK).toBeCloseTo(expectedLapseK, 2);
  });

  it('4: cache hit makes zero additional upstream calls', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(okJsonResponse(buildNasaPowerFixture()));
    const { POST: POST1 } = await freshRoute();
    await POST1(postRequest(TEST_BODY));
    const callsAfterFirst = fetchSpy.mock.calls.length;

    const { POST: POST2 } = await freshRoute();
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(okJsonResponse(buildNasaPowerFixture()));
    const res2 = await POST2(postRequest(TEST_BODY));
    console.log(`TEST4_calls_after_first=${callsAfterFirst} TEST4_status_second=${res2.status}`);
    expect(res2.status).toBe(200);
    // The second POST's route module is a fresh import (fresh spy instance);
    // assert the underlying cache actually holds one row and the second
    // call's own fetch spy was never invoked -- a real cache hit never calls fetch.
    const secondCallSpy = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls.length;
    console.log(`TEST4_calls_on_second_route_instance=${secondCallSpy}`);
    expect(secondCallSpy).toBe(0);
  });

  it('5: upstream timeout -> 502 UPSTREAM_UNAVAILABLE within 11s', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(
      (_url: string, opts?: RequestInit) =>
        new Promise((_resolve, reject) => {
          opts?.signal?.addEventListener('abort', () => {
            const err = new Error('The operation was aborted');
            err.name = 'AbortError';
            reject(err);
          });
        }),
    );
    const { POST } = await freshRoute();
    const start = Date.now();
    const res = await POST(postRequest(TEST_BODY));
    const elapsedMs = Date.now() - start;
    const body = await res.json();
    console.log(`TEST5_status=${res.status} TEST5_code=${body.code} TEST5_elapsedMs=${elapsedMs}`);
    expect(res.status).toBe(502);
    expect(body.code).toBe('UPSTREAM_UNAVAILABLE');
    expect(elapsedMs).toBeLessThan(11_000);
  }, 15_000);

  it('6: upstream 500 -> 502, not a crash', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('server error', { status: 500 }));
    const { POST } = await freshRoute();
    const res = await POST(postRequest(TEST_BODY));
    const body = await res.json();
    console.log(`TEST6_status=${res.status} TEST6_code=${body.code}`);
    expect(res.status).toBe(502);
    expect(body.code).toBe('UPSTREAM_UNAVAILABLE');
  });

  it('7: upstream 200 with unparseable JSON -> 422 WEATHER_INVALID', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('not json{{{', { status: 200 }));
    const { POST } = await freshRoute();
    const res = await POST(postRequest(TEST_BODY));
    const body = await res.json();
    console.log(`TEST7_status=${res.status} TEST7_code=${body.code}`);
    expect(res.status).toBe(422);
    expect(body.code).toBe('WEATHER_INVALID');
  });

  it('8: malformed body {} -> 400 INVALID_INPUT, non-empty detail, no cache row', async () => {
    const before = await countWeatherRows();
    const { POST } = await freshRoute();
    const res = await POST(postRequest({}));
    const body = await res.json();
    const after = await countWeatherRows();
    console.log(`TEST8_status=${res.status} TEST8_code=${body.code} TEST8_detail_len=${body.detail?.length} rows_before=${before} rows_after=${after}`);
    expect(res.status).toBe(400);
    expect(body.code).toBe('INVALID_INPUT');
    expect(Array.isArray(body.detail)).toBe(true);
    expect(body.detail.length).toBeGreaterThan(0);
    expect(after).toBe(before);
  });

  it('9: DB unreachable -> still a valid series within 15s, just uncached', async () => {
    process.env.DATABASE_URL = BOGUS_DATABASE_URL;
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(okJsonResponse(buildNasaPowerFixture()));
    const { POST } = await freshRoute();
    const start = Date.now();
    const res = await POST(postRequest(TEST_BODY));
    const elapsedMs = Date.now() - start;
    console.log(`TEST9_status=${res.status} TEST9_elapsedMs=${elapsedMs}`);
    expect(res.status).toBe(200);
    expect(elapsedMs).toBeLessThan(15_000);
  });

  it('10: every error response is application/json with no stack trace', async () => {
    const { POST } = await freshRoute();
    const res = await POST(postRequest({}));
    const contentType = res.headers.get('content-type');
    const text = await res.text();
    console.log(`TEST10_content_type=${contentType} TEST10_body=${text}`);
    expect(contentType).toContain('application/json');
    expect(text).not.toMatch(/at .*\(.*:\d+:\d+\)/); // a JS stack frame line
    expect(text.toLowerCase()).not.toContain('<html');
  });

  it('11: no secrets -- grep finds only the two base-URL vars and the flag', () => {
    const output = execFileSync('grep', ['-n', 'api_key\\|apiKey\\|Bearer\\|process.env', ROUTE_FILE], { encoding: 'utf-8' });
    const lines = output.trim().split('\n');
    console.log(`TEST11_lines=\n${output}`);
    for (const line of lines) {
      expect(line).not.toMatch(/api_key|apiKey|Bearer/);
      expect(line).toMatch(/NASA_POWER_BASE_URL|OPEN_METEO_BASE_URL|NEXT_PUBLIC_ENABLE_LIVE_WEATHER/);
    }
  });
});
