// apps/web/app/api/weather/route.ts
//
// T-37 -- the weather CORS proxy, cached. LOG.md, log/AREA-E-server-tier.md.
//
// THIS IS THE ONLY PLACE IN THE REPOSITORY PERMITTED TO CALL `fetch` FOR
// WEATHER (packages/data never does network I/O -- T-25/T-26's own header
// comments say so explicitly; T-37's own task prompt repeats it).
//
// Live weather is an ENHANCEMENT, never a dependency (LOG.md global rule,
// §7.16): gated behind NEXT_PUBLIC_ENABLE_LIVE_WEATHER, off by default. When
// off, this route returns 501 before touching the body, the cache or the
// network -- no side effect of any kind.
//
// Flow: flag check -> validate body -> readWeatherCache (T-31) -> on a miss,
// build the URL (T-26), fetch with a 10s AbortController timeout, parse
// (T-26), normalise + lapse-correct (T-25's normaliseWeather) ->
// writeWeatherCache (T-31, best-effort: DB down just means "don't cache",
// never a failure -- see lib/db.ts's withDb) -> respond with the series plus
// the lapse-correction numbers shown, never hidden (CONTRACTS.md §7.6 /
// TECH.md §9.3).
//
// Every response goes through NextResponse.json() -- Content-Type:
// application/json always, no HTML error page, no stack trace, ever.

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { EngineError, seriesToJson } from '@shelter/engine';
import type { WeatherProvenance, WeatherSeries } from '@shelter/engine';
// -----------------------------------------------------------------------
// BLOCKED IMPORT -- see log/AREA-E-server-tier.md's T-37 Evidence block.
// `normaliseWeather` (T-25, packages/data/src/weather/pipeline.ts) and
// `nasaPowerUrl`/`parseNasaPower`/`openMeteoUrl`/`parseOpenMeteo` (T-26,
// packages/data/src/weather/sources.ts) are NOT re-exported from
// `@shelter/data`'s public barrel (`packages/data/src/index.ts`), and that
// package's package.json restricts `"exports"` to `"."` only, so Node's own
// ESM resolver refuses this import at runtime with
// ERR_PACKAGE_PATH_NOT_EXPORTED (reproduced and pasted in the Evidence
// block). `packages/**` is outside this task's allow-list, so the one-line
// fix (re-exporting these from the barrel) cannot be made from here. This
// import is written the way the task prompt specifies it should be, so the
// fix is a single barrel edit away from making this file build.
// -----------------------------------------------------------------------
import {
  normaliseWeather,
  nasaPowerUrl,
  parseNasaPower,
  openMeteoUrl,
  parseOpenMeteo,
} from '@shelter/data';
import type { RawWeather, WeatherQuery } from '@shelter/data';
import { readWeatherCache, writeWeatherCache } from '../../../lib/repo/weather';
import type { WeatherKey } from '../../../lib/repo/weather';

export const dynamic = 'force-dynamic';

// The upstream request must never hang the demo. AUDIT.md-class failure mode:
// a rate-limited or half-dead upstream that never closes the connection.
// LOG.md rule 14: named constant, not a magic number.
const UPSTREAM_TIMEOUT_MS = 10_000;

// Neither source needs one (both are keyless, CONTRACTS.md §7.16); these are
// the only two environment-variable reads in this file, plus the feature
// flag below -- acceptance test 11 greps this file for exactly that shape.
const NASA_POWER_BASE_URL = process.env.NASA_POWER_BASE_URL;
const OPEN_METEO_BASE_URL = process.env.OPEN_METEO_BASE_URL;

// Not carried by the request body (only {source, latitude, longitude,
// startDate, endDate, siteElevation} per the task prompt). CALIBRATION
// DEFAULT (LOG.md rule 14): 82.5 deg E is IST's standard meridian and the
// project's own documented Ladakh default (CONTRACTS.md §7.11 Appendix C).
// A future caller that serves a site outside IST should extend the request
// body with an explicit field rather than rely on this default silently.
const DEFAULT_STANDARD_MERIDIAN = 82.5;

// Both upstream sources are queried and normalised at native hourly
// resolution (T-26's RawWeather.stepSeconds is always 3600 for both
// parsers); resampling to a simulation's own timestep is `simulate()`'s
// caller's job, not this proxy's.
const TARGET_STEP_SECONDS = 3600;

type WeatherSource = WeatherProvenance['source'] & ('nasa-power' | 'open-meteo');

interface WeatherRequestBody {
  source: 'nasa-power' | 'open-meteo';
  latitude: number;
  longitude: number;
  startDate: string; // 'YYYY-MM-DD'
  endDate: string; // 'YYYY-MM-DD'
  siteElevation: number;
}

interface FieldProblem {
  path: string;
  message: string;
}

function jsonError(status: number, body: Record<string, unknown>): NextResponse {
  return NextResponse.json(body, { status });
}

function liveWeatherDisabled(): NextResponse {
  return jsonError(501, { code: 'LIVE_WEATHER_DISABLED' });
}

function invalidInput(detail: FieldProblem[]): NextResponse {
  return jsonError(400, { code: 'INVALID_INPUT', detail });
}

function upstreamUnavailable(message: string): NextResponse {
  return jsonError(502, { code: 'UPSTREAM_UNAVAILABLE', message });
}

function weatherInvalid(message: string): NextResponse {
  return jsonError(422, { code: 'WEATHER_INVALID', message });
}

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Validates the whole body and collects every problem at once -- the same
 * "report every problem, not just the first" convention `@shelter/engine`'s
 * own INVALID_INPUT uses (CONTRACTS.md §7.8), so a caller with three bad
 * fields sees three messages, not one followed by three round trips.
 */
function validateBody(body: unknown): { value: WeatherRequestBody } | { problems: FieldProblem[] } {
  const problems: FieldProblem[] = [];
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    return { problems: [{ path: '', message: 'request body must be a JSON object' }] };
  }
  const b = body as Record<string, unknown>;

  const source = b.source;
  if (source !== 'nasa-power' && source !== 'open-meteo') {
    problems.push({ path: 'source', message: "source must be 'nasa-power' or 'open-meteo'" });
  }

  const latitude = b.latitude;
  if (typeof latitude !== 'number' || !Number.isFinite(latitude) || latitude < -90 || latitude > 90) {
    problems.push({ path: 'latitude', message: 'latitude must be a finite number in [-90, 90]' });
  }

  const longitude = b.longitude;
  if (typeof longitude !== 'number' || !Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
    problems.push({ path: 'longitude', message: 'longitude must be a finite number in [-180, 180]' });
  }

  const startDate = b.startDate;
  if (typeof startDate !== 'string' || !ISO_DATE_RE.test(startDate)) {
    problems.push({ path: 'startDate', message: "startDate must be an ISO 'YYYY-MM-DD' string" });
  }

  const endDate = b.endDate;
  if (typeof endDate !== 'string' || !ISO_DATE_RE.test(endDate)) {
    problems.push({ path: 'endDate', message: "endDate must be an ISO 'YYYY-MM-DD' string" });
  }
  if (typeof startDate === 'string' && typeof endDate === 'string' && ISO_DATE_RE.test(startDate) && ISO_DATE_RE.test(endDate) && endDate < startDate) {
    problems.push({ path: 'endDate', message: 'endDate must not be before startDate' });
  }

  const siteElevation = b.siteElevation;
  if (typeof siteElevation !== 'number' || !Number.isFinite(siteElevation)) {
    problems.push({ path: 'siteElevation', message: 'siteElevation must be a finite number, metres' });
  }

  if (problems.length > 0) return { problems };

  return {
    value: {
      source: source as WeatherRequestBody['source'],
      latitude: latitude as number,
      longitude: longitude as number,
      startDate: startDate as string,
      endDate: endDate as string,
      siteElevation: siteElevation as number,
    },
  };
}

// WeatherSeries has no whole-series JSON helper in @shelter/engine's public
// surface -- only the per-array seriesToJson/seriesFromJson (used inline by
// its own requestToJson/requestFromJson for the same fields). Every other
// JSON boundary in this repo (apps/web/lib/repo/weather.ts, T-31) does the
// same field-by-field conversion at its own boundary rather than inventing a
// second whole-series helper; this route follows the same, already-
// established pattern.
const WEATHER_ARRAY_FIELDS = ['T_amb', 'GHI', 'v_wind', 'DNI', 'DHI', 'LW_down', 'RH'] as const;

function weatherSeriesToResponseJson(series: WeatherSeries): Record<string, unknown> {
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
  return out;
}

async function fetchUpstream(url: string): Promise<{ ok: true; json: unknown } | { ok: false; response: NextResponse }> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch(url, { signal: controller.signal });
  } catch (err) {
    const timedOut = err instanceof Error && err.name === 'AbortError';
    return {
      ok: false,
      response: upstreamUnavailable(timedOut ? `upstream request timed out after ${UPSTREAM_TIMEOUT_MS}ms` : `upstream request failed: ${(err as Error).message}`),
    };
  } finally {
    clearTimeout(timeoutId);
  }

  if (!res.ok) {
    return { ok: false, response: upstreamUnavailable(`upstream responded with status ${res.status}`) };
  }

  let json: unknown;
  try {
    json = await res.json();
  } catch {
    return { ok: false, response: weatherInvalid('upstream response was not valid JSON') };
  }
  return { ok: true, json };
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  // Gate FIRST -- unset/'false' short-circuits before the body is even read,
  // so an off flag never causes a fetch or a cache write (acceptance test 1).
  if (process.env.NEXT_PUBLIC_ENABLE_LIVE_WEATHER !== 'true') {
    return liveWeatherDisabled();
  }

  let rawBody: unknown;
  try {
    rawBody = await req.json();
  } catch {
    return invalidInput([{ path: '', message: 'request body must be valid JSON' }]);
  }

  const validated = validateBody(rawBody);
  if ('problems' in validated) return invalidInput(validated.problems);
  const { source, latitude, longitude, startDate, endDate, siteElevation } = validated.value;

  const cacheKey: WeatherKey = { source, latitude, longitude, startDate, endDate };

  let series: WeatherSeries;
  let rawPayload: unknown;
  let sourceElevationForResponse: number | null;

  const cached = await readWeatherCache(cacheKey);
  if (cached) {
    series = cached;
    sourceElevationForResponse = cached.provenance.sourceElevation;
  } else {
    const query: WeatherQuery = { latitude, longitude, startDate, endDate };
    const url =
      source === 'nasa-power'
        ? nasaPowerUrl(query, NASA_POWER_BASE_URL)
        : openMeteoUrl(query, OPEN_METEO_BASE_URL);

    const fetched = await fetchUpstream(url);
    if (!fetched.ok) return fetched.response;
    rawPayload = fetched.json;

    let raw: RawWeather;
    try {
      raw = source === 'nasa-power' ? parseNasaPower(fetched.json, query) : parseOpenMeteo(fetched.json, query);
    } catch (err) {
      if (err instanceof EngineError && err.code === 'WEATHER_INVALID') return weatherInvalid(err.message);
      throw err;
    }

    try {
      series = normaliseWeather(raw, {
        site: { latitude, longitude, elevation: siteElevation, standardMeridian: DEFAULT_STANDARD_MERIDIAN },
        targetStepSeconds: TARGET_STEP_SECONDS,
        source: source as WeatherSource,
        label: `${source === 'nasa-power' ? 'NASA POWER' : 'Open-Meteo'} (${startDate} to ${endDate})`,
        fetchedAt: new Date().toISOString(),
      });
    } catch (err) {
      if (err instanceof EngineError && err.code === 'WEATHER_INVALID') return weatherInvalid(err.message);
      throw err;
    }

    sourceElevationForResponse = raw.sourceElevation;

    // Best-effort: writeWeatherCache never throws, even with the database
    // stopped or unreachable (LOG.md rule 18 / T-31's own contract) -- a
    // failed cache write is not a failure of this request.
    await writeWeatherCache(cacheKey, series, rawPayload, raw.sourceElevation);
  }

  return NextResponse.json(
    {
      series: weatherSeriesToResponseJson(series),
      // Shown, never applied silently (TECH.md §9.3 / CONTRACTS.md §7.6).
      sourceElevation: sourceElevationForResponse,
      siteElevation,
      lapseCorrectionK: series.provenance.lapseCorrectionK,
    },
    { status: 200 },
  );
}
