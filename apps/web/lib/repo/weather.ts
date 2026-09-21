// apps/web/lib/repo/weather.ts
//
// T-31 -- the weather cache repository. NASA POWER and Open-Meteo are slow and
// rate-limited; the eighteen-scenario matrix (T-59) and the design sweep both
// re-ask for the same cell constantly. Never fetch the same cell twice.
//
// DB-OFF CONTRACT (LOG.md global rule 18): every function here goes through
// lib/db.ts's withDb(), so "no database" is a normal miss, never a thrown
// error. See lib/db.ts's header comment for the reasoning.

import type { Prisma } from '@prisma/client';
import { seriesFromJson, seriesToJson } from '@shelter/engine';
import type { WeatherSeries } from '@shelter/engine';
import { withDb } from '../db.js';

export interface WeatherKey {
  source: 'nasa-power' | 'open-meteo';
  latitude: number;
  longitude: number; // ROUNDED before use -- see weatherCellKey
  startDate: string; // 'YYYY-MM-DD'
  endDate: string; // 'YYYY-MM-DD'
}

// A 4-decimal degree is ~11 m at this latitude, far below any weather grid's
// resolution (NASA POWER is ~55 km, Open-Meteo's models are coarser still).
// Un-rounded floats (34.15001 vs 34.15) would make the cache miss forever
// while quietly filling the table with near-duplicate cells.
const WEATHER_KEY_PRECISION = 4;

function roundCoord(n: number): number {
  const factor = 10 ** WEATHER_KEY_PRECISION;
  return Math.round(n * factor) / factor;
}

/** Canonicalises a WeatherKey so two floating-point-adjacent requests hit the same row. */
export function weatherCellKey(k: WeatherKey): WeatherKey {
  return {
    source: k.source,
    latitude: roundCoord(k.latitude),
    longitude: roundCoord(k.longitude),
    startDate: k.startDate,
    endDate: k.endDate,
  };
}

// TTL. Reanalysis data for a past date range does not change, so a historical
// row can live for a long time; a range touching today or the future may
// still be revised upstream (forecast data firms up as the date approaches),
// so it gets a short leash. LOG.md global rule 14: named constants, not magic
// numbers, so a future evidence-backed change has one place to happen.
export const HISTORICAL_TTL_MS = 90 * 24 * 60 * 60 * 1000; // 90 days
export const CURRENT_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

function computeExpiresAt(endDate: string, fetchedAt: Date): Date {
  // ISO 'YYYY-MM-DD' strings sort lexically the same as chronologically, so a
  // plain string compare against today's date (UTC) is enough -- no Date
  // parsing/timezone footgun needed.
  const todayIso = new Date().toISOString().slice(0, 10);
  const ttlMs = endDate < todayIso ? HISTORICAL_TTL_MS : CURRENT_TTL_MS;
  return new Date(fetchedAt.getTime() + ttlMs);
}

// The array fields of WeatherSeries (CONTRACTS.md 7.6). @shelter/engine only
// exports the per-array seriesToJson/seriesFromJson (used inline by its own
// requestFromJson/requestToJson for the same fields) -- there is no
// whole-WeatherSeries helper, so this repository does the same field-by-field
// conversion at its own JSON boundary, through those same two functions.
const WEATHER_ARRAY_FIELDS = ['T_amb', 'GHI', 'v_wind', 'DNI', 'DHI', 'LW_down', 'RH'] as const;

function weatherSeriesToJson(series: WeatherSeries): Prisma.InputJsonValue {
  const out: Record<string, unknown> = {
    stepSeconds: series.stepSeconds,
    startDayOfYear: series.startDayOfYear,
    startHour: series.startHour,
    provenance: series.provenance,
  };
  for (const field of WEATHER_ARRAY_FIELDS) {
    const v = series[field];
    if (v !== undefined) out[field] = seriesToJson(v);
  }
  return out as Prisma.InputJsonValue;
}

function weatherSeriesFromJson(j: unknown): WeatherSeries {
  const src = j as Record<string, unknown>;
  const out: Record<string, unknown> = {
    stepSeconds: src.stepSeconds,
    startDayOfYear: src.startDayOfYear,
    startHour: src.startHour,
    provenance: src.provenance,
  };
  for (const field of WEATHER_ARRAY_FIELDS) {
    const v = src[field];
    if (v !== undefined) out[field] = seriesFromJson(v as number[]);
  }
  return out as unknown as WeatherSeries;
}

function whereKey(key: WeatherKey) {
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

export async function readWeatherCache(k: WeatherKey): Promise<WeatherSeries | null> {
  const key = weatherCellKey(k);
  const row = await withDb((db) => db.weatherCache.findUnique({ where: whereKey(key) }));
  if (!row) return null;
  // An expired row is a miss but is NOT deleted here -- a read must never be a
  // write. purgeExpiredWeather() is the separate, explicitly called cleanup.
  if (row.expiresAt.getTime() <= Date.now()) return null;
  return weatherSeriesFromJson(row.series);
}

// SQLite serialises writers onto a single connection/lock; a same-process
// burst of concurrent upserts against the same key can still surface a
// transient "database is locked" (SQLITE_BUSY) error under contention. That
// is a real race to handle here, not a flaky test to loosen -- retry the
// upsert a few times with a short backoff before giving up.
const UPSERT_MAX_ATTEMPTS = 5;
const UPSERT_RETRY_DELAY_MS = 20;

function isBusyError(err: unknown): boolean {
  return err instanceof Error && /SQLITE_BUSY|database is locked/i.test(err.message);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function writeWeatherCache(
  k: WeatherKey,
  series: WeatherSeries,
  rawPayload: unknown,
  sourceElevation: number | null,
): Promise<void> {
  const key = weatherCellKey(k);
  const fetchedAt = new Date();
  const expiresAt = computeExpiresAt(key.endDate, fetchedAt);
  const data = {
    series: weatherSeriesToJson(series),
    rawPayload: rawPayload as Prisma.InputJsonValue,
    sourceElevation,
    fetchedAt,
    expiresAt,
  };

  await withDb(async (db) => {
    for (let attempt = 1; attempt <= UPSERT_MAX_ATTEMPTS; attempt++) {
      try {
        // Upsert, not create: the unique constraint on (source, latitude,
        // longitude, startDate, endDate) means a duplicate write updates the
        // existing row instead of throwing -- a re-fetch of the same cell is
        // normal, not an error.
        return await db.weatherCache.upsert({
          where: whereKey(key),
          create: { ...key, ...data },
          update: data,
        });
      } catch (err) {
        if (!isBusyError(err) || attempt === UPSERT_MAX_ATTEMPTS) throw err;
        await sleep(UPSERT_RETRY_DELAY_MS * attempt);
      }
    }
    return undefined;
  });
}

export async function purgeExpiredWeather(): Promise<number> {
  const result = await withDb((db) =>
    db.weatherCache.deleteMany({ where: { expiresAt: { lt: new Date() } } }),
  );
  return result?.count ?? 0;
}
