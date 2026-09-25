// apps/studio-server/src/weather/cache.ts — weatherCache Mongo model
// (condition 3), keyed by {source, lat(2dp), lon(2dp), year}. Uses
// mongoose's default connection (P2 owns src/db.ts / connection setup;
// ledger conflict-avoidance rule -- this file never calls mongoose.connect
// itself). Degrades gracefully when nothing is connected
// (`mongoose.connection.readyState !== 1`): callers get `undefined` back
// from a read and writes are silently skipped, so P1's DB-less tests and
// the preview route keep working with no Mongo running.
//
// `WeatherSeries`'s numeric arrays are `Float64Array` (packages/engine/src/
// types.ts) -- Mongoose/BSON don't round-trip typed arrays as themselves, so
// they're serialised to plain `number[]` going in and reconstructed coming
// out (`serialiseWeather`/`deserialiseWeather`). `standardMeridian` is
// cached alongside the weather series because it's derived from the
// upstream response itself (Open-Meteo's `utc_offset_seconds`, only present
// on the live fetch) -- caching it is what lets a cache hit skip the
// network entirely (condition 3), not just skip re-parsing.

import mongoose from 'mongoose';
import type { WeatherProvenance, WeatherSeries } from '@shelter/engine';

export interface CachedWeather {
  weather: WeatherSeries;
  standardMeridian: number;
}

interface SerialisedWeather {
  stepSeconds: number;
  startDayOfYear: number;
  startHour: number;
  T_amb: number[];
  GHI: number[];
  v_wind: number[];
  DNI?: number[];
  DHI?: number[];
  LW_down?: number[];
  RH?: number[];
  provenance: WeatherProvenance;
}

const weatherCacheSchema = new mongoose.Schema(
  {
    source: { type: String, required: true },
    lat: { type: Number, required: true },
    lon: { type: Number, required: true },
    year: { type: Number, required: true },
    standardMeridian: { type: Number, required: true },
    weather: { type: mongoose.Schema.Types.Mixed, required: true },
  },
  { versionKey: false },
);
weatherCacheSchema.index({ source: 1, lat: 1, lon: 1, year: 1 }, { unique: true });

type WeatherCacheDoc = {
  source: string;
  lat: number;
  lon: number;
  year: number;
  standardMeridian: number;
  weather: SerialisedWeather;
};

// Guard against re-registering the model on a hot-reloaded dev server /
// repeated test-file import (mongoose throws OverwriteModelError otherwise).
export const WeatherCacheModel =
  (mongoose.models['WeatherCache'] as mongoose.Model<WeatherCacheDoc> | undefined) ??
  mongoose.model<WeatherCacheDoc>('WeatherCache', weatherCacheSchema, 'weatherCache');

/** 2 decimal places, ~1.1 km at the equator -- the cache-key rounding condition 3 asks for. */
export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function isConnected(): boolean {
  return mongoose.connection.readyState === 1;
}

function serialiseWeather(weather: WeatherSeries): SerialisedWeather {
  return {
    stepSeconds: weather.stepSeconds,
    startDayOfYear: weather.startDayOfYear,
    startHour: weather.startHour,
    T_amb: Array.from(weather.T_amb),
    GHI: Array.from(weather.GHI),
    v_wind: Array.from(weather.v_wind),
    ...(weather.DNI ? { DNI: Array.from(weather.DNI) } : {}),
    ...(weather.DHI ? { DHI: Array.from(weather.DHI) } : {}),
    ...(weather.LW_down ? { LW_down: Array.from(weather.LW_down) } : {}),
    ...(weather.RH ? { RH: Array.from(weather.RH) } : {}),
    provenance: weather.provenance,
  };
}

function deserialiseWeather(doc: SerialisedWeather): WeatherSeries {
  return {
    stepSeconds: doc.stepSeconds,
    startDayOfYear: doc.startDayOfYear,
    startHour: doc.startHour,
    T_amb: Float64Array.from(doc.T_amb),
    GHI: Float64Array.from(doc.GHI),
    v_wind: Float64Array.from(doc.v_wind),
    ...(doc.DNI ? { DNI: Float64Array.from(doc.DNI) } : {}),
    ...(doc.DHI ? { DHI: Float64Array.from(doc.DHI) } : {}),
    ...(doc.LW_down ? { LW_down: Float64Array.from(doc.LW_down) } : {}),
    ...(doc.RH ? { RH: Float64Array.from(doc.RH) } : {}),
    provenance: doc.provenance,
  };
}

export async function readWeatherCache(
  source: string,
  lat: number,
  lon: number,
  year: number,
): Promise<CachedWeather | undefined> {
  if (!isConnected()) return undefined;
  const doc = await WeatherCacheModel.findOne(
    { source, lat: round2(lat), lon: round2(lon), year },
    null,
    { lean: true },
  ).exec();
  if (!doc) return undefined;
  return { weather: deserialiseWeather(doc.weather), standardMeridian: doc.standardMeridian };
}

export async function writeWeatherCache(
  source: string,
  lat: number,
  lon: number,
  year: number,
  cached: CachedWeather,
): Promise<void> {
  if (!isConnected()) return;
  await WeatherCacheModel.updateOne(
    { source, lat: round2(lat), lon: round2(lon), year },
    {
      $set: {
        standardMeridian: cached.standardMeridian,
        weather: serialiseWeather(cached.weather),
      },
    },
    { upsert: true },
  ).exec();
}
