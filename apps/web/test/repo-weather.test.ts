// apps/web/test/repo-weather.test.ts
//
// T-31 acceptance tests 1-11 (see log/AREA-D-database-tier.md).
//
// Same fresh-module pattern as T-30's db.test.ts: lib/db.ts memoises its
// PrismaClient on globalThis exactly like Next.js's dev hot-reload, so any
// test that changes DATABASE_URL must clear that stash and vi.resetModules()
// before re-importing, or it would silently reuse a client built for a
// different URL. weatherCellKey/HISTORICAL_TTL_MS/CURRENT_TTL_MS are pure
// (no I/O), but are pulled from the same fresh import for consistency.
//
// A second, independent PrismaClient ("raw") is used only to verify what
// actually landed in the table -- row counts, expiresAt, rawPayload bytes --
// bypassing the repository under test.

import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest';
import { PrismaClient } from '@prisma/client';
import type { WeatherSeries } from '@shelter/engine';
import type { WeatherKey } from '../lib/repo/weather.js';

// Same rationale as T-30's BOGUS_DATABASE_URL: a directory that cannot exist
// fails SQLite fast and deterministically, no network involved.
const BOGUS_DATABASE_URL = 'file:/nonexistent-t31-test-dir-7e2b90/dev.db';
const LIVE_DATABASE_URL = 'file:./dev.db';

function globalStash(): PrismaClient | undefined {
  return (globalThis as unknown as { __sheltersimDb?: PrismaClient }).__sheltersimDb;
}

async function disconnectStash(): Promise<void> {
  const existing = globalStash();
  if (existing) await existing.$disconnect().catch(() => {});
  delete (globalThis as unknown as { __sheltersimDb?: PrismaClient }).__sheltersimDb;
}

async function freshWeatherRepo() {
  await disconnectStash();
  const { vi } = await import('vitest');
  vi.resetModules();
  return import('../lib/repo/weather.js');
}

// Independent of the repository's memoised client -- always points at the
// live file regardless of what process.env.DATABASE_URL is doing in a given
// test, so verification queries are never affected by the DB-off/unreachable
// scenarios under test.
const raw = new PrismaClient({ datasources: { db: { url: LIVE_DATABASE_URL } } });

/** For findUnique/findUniqueOrThrow/update, whose `where` needs the compound unique field. */
function rawWhere(key: WeatherKey) {
  return {
    weather_cell_key: {
      source: key.source,
      latitude: key.latitude,
      longitude: key.longitude,
      startDate: key.startDate,
      endDate: key.endDate,
    },
  };
}

/** For count/deleteMany, whose `where` is a plain filter (no compound unique field). */
function rawFilter(key: WeatherKey) {
  return {
    source: key.source,
    latitude: key.latitude,
    longitude: key.longitude,
    startDate: key.startDate,
    endDate: key.endDate,
  };
}

function makeSeries(n = 24): WeatherSeries {
  return {
    stepSeconds: 3600,
    startDayOfYear: 12,
    startHour: 0,
    T_amb: new Float64Array(Array.from({ length: n }, (_, i) => 250 + i)),
    GHI: new Float64Array(Array.from({ length: n }, (_, i) => i * 10)),
    v_wind: new Float64Array(Array.from({ length: n }, () => 3.5)),
    provenance: {
      source: 'nasa-power',
      label: 'NASA POWER test fixture',
      sourceElevation: 3500,
      lapseCorrectionK: 0.6,
      notes: [],
    },
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

afterAll(async () => {
  await raw.$disconnect();
});

describe('T-31 weather.ts', () => {
  it('1. write then read returns a deep-equal WeatherSeries, T_amb is Float64Array', async () => {
    process.env.DATABASE_URL = LIVE_DATABASE_URL;
    const { writeWeatherCache, readWeatherCache } = await freshWeatherRepo();
    const key: WeatherKey = {
      source: 'nasa-power',
      latitude: 34.1601,
      longitude: 70.01,
      startDate: '2020-06-01',
      endDate: '2020-06-02',
    };
    const series = makeSeries();
    await writeWeatherCache(key, series, { fixture: 1 }, 3500);
    const got = await readWeatherCache(key);
    expect(got).not.toBeNull();
    expect(got!.T_amb).toBeInstanceOf(Float64Array);
    expect(got).toEqual(series);
  });

  it('2. weatherCellKey rounds adjacent floats to the same cell; a write under one hits under the other', async () => {
    const { weatherCellKey, writeWeatherCache, readWeatherCache } = await freshWeatherRepo();
    const k1 = weatherCellKey({
      source: 'nasa-power',
      latitude: 34.150014,
      longitude: 1,
      startDate: 'a',
      endDate: 'b',
    });
    const k2 = weatherCellKey({
      source: 'nasa-power',
      latitude: 34.149996,
      longitude: 1,
      startDate: 'a',
      endDate: 'b',
    });
    expect(k1.latitude).toBe(k2.latitude);
    expect(k1.latitude).toBe(34.15);

    process.env.DATABASE_URL = LIVE_DATABASE_URL;
    const keyWrite: WeatherKey = {
      source: 'nasa-power',
      latitude: 34.150014,
      longitude: 70.02,
      startDate: '2020-06-01',
      endDate: '2020-06-02',
    };
    const keyRead: WeatherKey = { ...keyWrite, latitude: 34.149996 };
    await writeWeatherCache(keyWrite, makeSeries(), {}, null);
    const got = await readWeatherCache(keyRead);
    expect(got).not.toBeNull();
  });

  it('3. a different source or a different date range is a miss', async () => {
    process.env.DATABASE_URL = LIVE_DATABASE_URL;
    const { writeWeatherCache, readWeatherCache } = await freshWeatherRepo();
    const key: WeatherKey = {
      source: 'nasa-power',
      latitude: 12.34,
      longitude: 70.03,
      startDate: '2020-06-01',
      endDate: '2020-06-02',
    };
    await writeWeatherCache(key, makeSeries(), {}, null);
    expect(await readWeatherCache({ ...key, source: 'open-meteo' })).toBeNull();
    expect(await readWeatherCache({ ...key, endDate: '2020-06-03' })).toBeNull();
  });

  it('4. duplicate writes upsert to one row and the second call does not throw', async () => {
    process.env.DATABASE_URL = LIVE_DATABASE_URL;
    const { writeWeatherCache, weatherCellKey } = await freshWeatherRepo();
    const key: WeatherKey = {
      source: 'nasa-power',
      latitude: 12.34,
      longitude: 70.04,
      startDate: '2020-06-01',
      endDate: '2020-06-02',
    };
    await writeWeatherCache(key, makeSeries(), { v: 1 }, 10);
    await expect(writeWeatherCache(key, makeSeries(), { v: 2 }, 20)).resolves.toBeUndefined();
    const count = await raw.weatherCache.count({ where: rawFilter(weatherCellKey(key)) });
    // eslint-disable-next-line no-console -- test evidence, per LOG.md rule 15.
    console.log(`T-31 test 4: row count after duplicate write = ${count}`);
    expect(count).toBe(1);
  });

  it('5. an expired row reads as a miss and is still present afterwards', async () => {
    process.env.DATABASE_URL = LIVE_DATABASE_URL;
    const { writeWeatherCache, readWeatherCache, weatherCellKey } = await freshWeatherRepo();
    const key: WeatherKey = {
      source: 'nasa-power',
      latitude: 12.34,
      longitude: 70.05,
      startDate: '2020-06-01',
      endDate: '2020-06-02',
    };
    await writeWeatherCache(key, makeSeries(), {}, null);
    await raw.weatherCache.update({
      where: rawWhere(weatherCellKey(key)),
      data: { expiresAt: new Date(Date.now() - 1000) },
    });
    const before = await raw.weatherCache.count({ where: rawFilter(weatherCellKey(key)) });
    const got = await readWeatherCache(key);
    const after = await raw.weatherCache.count({ where: rawFilter(weatherCellKey(key)) });
    // eslint-disable-next-line no-console -- test evidence, per LOG.md rule 15.
    console.log(`T-31 test 5: row count before read = ${before}, after read = ${after}`);
    expect(got).toBeNull();
    expect(before).toBe(1);
    expect(after).toBe(1);
  });

  it('6. purgeExpiredWeather removes exactly the expired rows and returns their count', async () => {
    process.env.DATABASE_URL = LIVE_DATABASE_URL;
    const { writeWeatherCache, purgeExpiredWeather, weatherCellKey } = await freshWeatherRepo();
    const expiredKeys: WeatherKey[] = [1, 2].map((i) => ({
      source: 'nasa-power',
      latitude: 12.34 + i,
      longitude: 70.06,
      startDate: '2020-06-01',
      endDate: '2020-06-02',
    }));
    const freshKey: WeatherKey = {
      source: 'nasa-power',
      latitude: 12.34 + 3,
      longitude: 70.06,
      startDate: '2020-06-01',
      endDate: '2020-06-02',
    };
    for (const k of [...expiredKeys, freshKey]) await writeWeatherCache(k, makeSeries(), {}, null);
    for (const k of expiredKeys) {
      await raw.weatherCache.update({
        where: rawWhere(weatherCellKey(k)),
        data: { expiresAt: new Date(Date.now() - 1000) },
      });
    }

    const expiredBefore = await raw.weatherCache.count({
      where: { expiresAt: { lt: new Date() } },
    });
    const removed = await purgeExpiredWeather();
    const expiredAfter = await raw.weatherCache.count({ where: { expiresAt: { lt: new Date() } } });
    const freshStillThere = await raw.weatherCache.count({
      where: rawFilter(weatherCellKey(freshKey)),
    });
    // eslint-disable-next-line no-console -- test evidence, per LOG.md rule 15.
    console.log(
      `T-31 test 6: expired rows before purge = ${expiredBefore}, purgeExpiredWeather() removed = ${removed}, expired rows after = ${expiredAfter}`,
    );
    expect(removed).toBe(expiredBefore);
    expect(expiredAfter).toBe(0);
    expect(freshStillThere).toBe(1);
  });

  it('7. TTL is 90 days for a past range and 24 hours for a current one', async () => {
    process.env.DATABASE_URL = LIVE_DATABASE_URL;
    const { writeWeatherCache, weatherCellKey, HISTORICAL_TTL_MS, CURRENT_TTL_MS } =
      await freshWeatherRepo();
    const todayIso = new Date().toISOString().slice(0, 10);
    const pastKey: WeatherKey = {
      source: 'nasa-power',
      latitude: 12.34,
      longitude: 70.07,
      startDate: '2019-01-01',
      endDate: '2019-01-02',
    };
    const currentKey: WeatherKey = {
      source: 'nasa-power',
      latitude: 12.35,
      longitude: 70.07,
      startDate: todayIso,
      endDate: todayIso,
    };
    await writeWeatherCache(pastKey, makeSeries(), {}, null);
    await writeWeatherCache(currentKey, makeSeries(), {}, null);
    const pastRow = await raw.weatherCache.findUniqueOrThrow({
      where: rawWhere(weatherCellKey(pastKey)),
    });
    const currentRow = await raw.weatherCache.findUniqueOrThrow({
      where: rawWhere(weatherCellKey(currentKey)),
    });
    const pastTtlMs = pastRow.expiresAt.getTime() - pastRow.fetchedAt.getTime();
    const currentTtlMs = currentRow.expiresAt.getTime() - currentRow.fetchedAt.getTime();
    // eslint-disable-next-line no-console -- test evidence, per LOG.md rule 15.
    console.log(
      `T-31 test 7: past-range TTL = ${pastTtlMs}ms (HISTORICAL_TTL_MS=${HISTORICAL_TTL_MS}), current-range TTL = ${currentTtlMs}ms (CURRENT_TTL_MS=${CURRENT_TTL_MS})`,
    );
    expect(pastTtlMs).toBe(HISTORICAL_TTL_MS);
    expect(currentTtlMs).toBe(CURRENT_TTL_MS);
    expect(HISTORICAL_TTL_MS).toBe(90 * 24 * 60 * 60 * 1000);
    expect(CURRENT_TTL_MS).toBe(24 * 60 * 60 * 1000);
  });

  it('8. DB OFF: read resolves null, write resolves without throwing, purge returns 0', async () => {
    // DATABASE_URL already unset by beforeEach.
    const { readWeatherCache, writeWeatherCache, purgeExpiredWeather } = await freshWeatherRepo();
    const key: WeatherKey = {
      source: 'nasa-power',
      latitude: 1,
      longitude: 70.08,
      startDate: 'x',
      endDate: 'y',
    };
    const readResult = await readWeatherCache(key);
    let writeThrew = false;
    try {
      await writeWeatherCache(key, makeSeries(), {}, null);
    } catch {
      writeThrew = true;
    }
    const purged = await purgeExpiredWeather();
    // eslint-disable-next-line no-console -- test evidence, per LOG.md rule 15.
    console.log(
      `T-31 test 8 (DB OFF): read=${readResult}, write threw=${writeThrew}, purge=${purged}`,
    );
    expect(readResult).toBeNull();
    expect(writeThrew).toBe(false);
    expect(purged).toBe(0);
  });

  it('9. DB UNREACHABLE: same three behaviours within 5s each', async () => {
    process.env.DATABASE_URL = BOGUS_DATABASE_URL;
    const { readWeatherCache, writeWeatherCache, purgeExpiredWeather } = await freshWeatherRepo();
    const key: WeatherKey = {
      source: 'nasa-power',
      latitude: 1,
      longitude: 70.09,
      startDate: 'x',
      endDate: 'y',
    };

    let start = Date.now();
    const readResult = await readWeatherCache(key);
    const readMs = Date.now() - start;

    start = Date.now();
    let writeThrew = false;
    try {
      await writeWeatherCache(key, makeSeries(), {}, null);
    } catch {
      writeThrew = true;
    }
    const writeMs = Date.now() - start;

    start = Date.now();
    const purged = await purgeExpiredWeather();
    const purgeMs = Date.now() - start;

    // eslint-disable-next-line no-console -- test evidence, per LOG.md rule 15.
    console.log(
      `T-31 test 9 (DB UNREACHABLE): read=${readResult} in ${readMs}ms, write threw=${writeThrew} in ${writeMs}ms, purge=${purged} in ${purgeMs}ms`,
    );
    expect(readResult).toBeNull();
    expect(writeThrew).toBe(false);
    expect(purged).toBe(0);
    expect(readMs).toBeLessThan(5000);
    expect(writeMs).toBeLessThan(5000);
    expect(purgeMs).toBeLessThan(5000);
  }, 20000);

  it('10. ten concurrent writes to the same key leave exactly one row and none reject', async () => {
    process.env.DATABASE_URL = LIVE_DATABASE_URL;
    const { writeWeatherCache, weatherCellKey } = await freshWeatherRepo();
    const key: WeatherKey = {
      source: 'nasa-power',
      latitude: 12.34,
      longitude: 70.1,
      startDate: '2020-06-01',
      endDate: '2020-06-02',
    };
    const results = await Promise.allSettled(
      Array.from({ length: 10 }, (_, i) => writeWeatherCache(key, makeSeries(), { i }, i)),
    );
    const rejections = results.filter((r) => r.status === 'rejected').length;
    const count = await raw.weatherCache.count({ where: rawFilter(weatherCellKey(key)) });
    // eslint-disable-next-line no-console -- test evidence, per LOG.md rule 15.
    console.log(`T-31 test 10: row count = ${count}, rejections = ${rejections}`);
    expect(rejections).toBe(0);
    expect(count).toBe(1);
  });

  it('11. rawPayload round-trips byte-identically through a write and a direct database read', async () => {
    process.env.DATABASE_URL = LIVE_DATABASE_URL;
    const { writeWeatherCache, weatherCellKey } = await freshWeatherRepo();
    const key: WeatherKey = {
      source: 'nasa-power',
      latitude: 12.34,
      longitude: 70.11,
      startDate: '2020-06-01',
      endDate: '2020-06-02',
    };
    const rawPayload = {
      nested: { arr: [1, 2, 3], note: 'unicode Ümläut ✈', nullish: null },
      list: [true, false, 'x'],
      float: 12.345678,
    };
    await writeWeatherCache(key, makeSeries(), rawPayload, null);
    const row = await raw.weatherCache.findUniqueOrThrow({ where: rawWhere(weatherCellKey(key)) });
    // eslint-disable-next-line no-console -- test evidence, per LOG.md rule 15.
    console.log(`T-31 test 11: stored rawPayload = ${JSON.stringify(row.rawPayload)}`);
    expect(row.rawPayload).toEqual(rawPayload);
  });
});
