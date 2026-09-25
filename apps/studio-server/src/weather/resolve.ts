// apps/studio-server/src/weather/resolve.ts — custom-location weather
// resolution (P3 conditions 2-4). Orchestrates: cache read -> fetch (Open-
// Meteo archive, falling back to NASA POWER) -> @shelter/data's builders/
// parsers -> normaliseWeather -> cache write -> Site. Never invents weather
// values (ledger/tasks/P3.md Rules): if both sources fail, this throws --
// there is no fallback to a preset site.
//
// SEAM: apps/studio-server/src/design/assemble.ts's `weatherFor` hook is
// SYNCHRONOUS (it slices an already-resolved full-year WeatherSeries), but
// fetching is inherently async. So this module's `resolveCustomWeather` is
// the async half of the seam -- app.ts's preview route calls it BEFORE
// `assemble()`, then wraps its result in a plain sync closure and passes
// that as `weatherFor`. This file has no dependency on assemble.ts.

import {
  nasaPowerUrl,
  normaliseWeather,
  openMeteoUrl,
  parseNasaPower,
  parseOpenMeteo,
} from '@shelter/data';
import type { RawWeather, WeatherQuery } from '@shelter/data';
import { asK } from '@shelter/engine';
import type { Site, WeatherSeries } from '@shelter/engine';
import { readWeatherCache, round2, writeWeatherCache } from './cache.js';
import { UpstreamUnavailableError } from './errors.js';
import type { DesignLocation } from '../design/types.js';

export type CustomLocation = Extract<DesignLocation, { kind: 'custom' }>;

/** PLAN.md "Custom location": a full reference year, so the ground-
 * temperature annual mean is meaningful. 2023 matches the bundled TMY /
 * `defaults.date` reference year (API.md §3). */
const REFERENCE_YEAR = 2023;
const TARGET_STEP_SECONDS = 3600;
const GROUND_ALBEDO = 0.2;

export interface WeatherProvenanceSummary {
  source: 'open-meteo' | 'nasa-power';
  year: number;
  notes: string[];
}

export interface CustomWeatherResult {
  weather: WeatherSeries;
  site: Site;
  provenance: WeatherProvenanceSummary;
}

function annualMeanK(t_amb: Float64Array): number {
  let sum = 0;
  for (let i = 0; i < t_amb.length; i++) sum += t_amb[i]!;
  return sum / t_amb.length;
}

async function fetchJson(url: string, fetchImpl: typeof fetch, label: string): Promise<unknown> {
  let res: Response;
  try {
    res = await fetchImpl(url);
  } catch (err) {
    throw new Error(`${label} request failed: ${err instanceof Error ? err.message : String(err)}`);
  }
  if (!res.ok) throw new Error(`${label} responded ${res.status}`);
  return res.json();
}

/** Open-Meteo's builder (packages/data, frozen) issues no `timezone` param,
 * so its archive response is UTC and carries no usable offset. Appending
 * `timezone=auto` ourselves (can't touch the frozen builder) makes Open-
 * Meteo both localise `hourly.time` -- matching RawWeather.startHour's own
 * "local clock hour" contract -- AND return a top-level `utc_offset_seconds`
 * we read directly off the raw JSON (parseOpenMeteo, frozen, doesn't surface
 * it). `standardMeridian = utc_offset_seconds/3600*15` per PLAN.md. */
async function tryOpenMeteo(
  query: WeatherQuery,
  site: { latitude: number; longitude: number; elevation: number },
  fetchImpl: typeof fetch,
): Promise<{ weather: WeatherSeries; standardMeridian: number }> {
  const url = `${openMeteoUrl(query)}&timezone=auto`;
  const json = (await fetchJson(url, fetchImpl, 'Open-Meteo archive')) as {
    utc_offset_seconds?: number;
  };
  const utcOffsetSeconds = typeof json.utc_offset_seconds === 'number' ? json.utc_offset_seconds : 0;
  const standardMeridian = (utcOffsetSeconds / 3600) * 15;
  const raw: RawWeather = parseOpenMeteo(json, query);
  const weather = normaliseWeather(raw, {
    site: { ...site, standardMeridian },
    targetStepSeconds: TARGET_STEP_SECONDS,
    source: 'open-meteo',
    label: 'Open-Meteo archive',
    fetchedAt: new Date().toISOString(),
  });
  return { weather, standardMeridian };
}

/** NASA POWER's hourly endpoint reports `time_standard: "LST"` (Local
 * Standard Time, packages/data/src/weather/sources.ts's header comment) --
 * i.e. the fixed UTC offset of the nearest 15-degree-wide standard time
 * zone for this longitude, not solar time. The standard meridian of that
 * zone is, by definition, the nearest multiple of 15 degrees to the
 * longitude -- there is no separate offset field to read off the response. */
async function tryNasaPower(
  query: WeatherQuery,
  site: { latitude: number; longitude: number; elevation: number },
  fetchImpl: typeof fetch,
): Promise<{ weather: WeatherSeries; standardMeridian: number }> {
  const url = nasaPowerUrl(query);
  const json = await fetchJson(url, fetchImpl, 'NASA POWER');
  const standardMeridian = Math.round(query.longitude / 15) * 15;
  const raw: RawWeather = parseNasaPower(json, query);
  const weather = normaliseWeather(raw, {
    site: { ...site, standardMeridian },
    targetStepSeconds: TARGET_STEP_SECONDS,
    source: 'nasa-power',
    label: 'NASA POWER',
    fetchedAt: new Date().toISOString(),
  });
  return { weather, standardMeridian };
}

function buildSite(location: CustomLocation, standardMeridian: number, weather: WeatherSeries): Site {
  return {
    id: `custom:${round2(location.lat)}:${round2(location.lon)}`,
    name: location.name,
    latitude: location.lat,
    longitude: location.lon,
    elevation: location.elevation,
    standardMeridian,
    groundAlbedo: GROUND_ALBEDO,
    groundTempMeanAnnual: asK(annualMeanK(weather.T_amb)),
  };
}

function buildNotes(source: 'open-meteo' | 'nasa-power', standardMeridian: number): string[] {
  const meridianNote =
    source === 'open-meteo'
      ? `standardMeridian = ${standardMeridian}°, derived from Open-Meteo's utc_offset_seconds`
      : `standardMeridian = ${standardMeridian}°, nearest 15° meridian to longitude (NASA POWER reports Local Standard Time)`;
  return [meridianNote, `groundAlbedo = ${GROUND_ALBEDO} (fixed assumption, not measured)`];
}

export async function resolveCustomWeather(
  location: CustomLocation,
  fetchImpl: typeof fetch = fetch,
): Promise<CustomWeatherResult> {
  const lat = round2(location.lat);
  const lon = round2(location.lon);
  const siteInput = { latitude: location.lat, longitude: location.lon, elevation: location.elevation };
  const query: WeatherQuery = {
    latitude: location.lat,
    longitude: location.lon,
    startDate: `${REFERENCE_YEAR}-01-01`,
    endDate: `${REFERENCE_YEAR}-12-31`,
  };

  for (const source of ['open-meteo', 'nasa-power'] as const) {
    const cached = await readWeatherCache(source, lat, lon, REFERENCE_YEAR);
    if (cached) {
      return {
        weather: cached.weather,
        site: buildSite(location, cached.standardMeridian, cached.weather),
        provenance: {
          source,
          year: REFERENCE_YEAR,
          notes: [...buildNotes(source, cached.standardMeridian), 'served from weatherCache (no network call)'],
        },
      };
    }
  }

  let openMeteoErr: unknown;
  try {
    const { weather, standardMeridian } = await tryOpenMeteo(query, siteInput, fetchImpl);
    await writeWeatherCache('open-meteo', lat, lon, REFERENCE_YEAR, { weather, standardMeridian });
    return {
      weather,
      site: buildSite(location, standardMeridian, weather),
      provenance: { source: 'open-meteo', year: REFERENCE_YEAR, notes: buildNotes('open-meteo', standardMeridian) },
    };
  } catch (err) {
    openMeteoErr = err;
  }

  try {
    const { weather, standardMeridian } = await tryNasaPower(query, siteInput, fetchImpl);
    await writeWeatherCache('nasa-power', lat, lon, REFERENCE_YEAR, { weather, standardMeridian });
    return {
      weather,
      site: buildSite(location, standardMeridian, weather),
      provenance: { source: 'nasa-power', year: REFERENCE_YEAR, notes: buildNotes('nasa-power', standardMeridian) },
    };
  } catch (nasaErr) {
    const openMeteoMsg = openMeteoErr instanceof Error ? openMeteoErr.message : String(openMeteoErr);
    const nasaMsg = nasaErr instanceof Error ? nasaErr.message : String(nasaErr);
    throw new UpstreamUnavailableError(
      `Both weather sources failed for (${location.lat}, ${location.lon}): Open-Meteo: ${openMeteoMsg}; NASA POWER: ${nasaMsg}`,
    );
  }
}
