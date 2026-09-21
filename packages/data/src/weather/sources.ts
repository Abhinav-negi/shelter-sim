/**
 * NASA POWER and Open-Meteo request builders and response parsers. T-26
 * (`LOG.md`, Area C).
 *
 * Pure functions only: no `fetch`, no `await` on I/O, no side effects.
 * `packages/data` never touches the network (T-25's header comment, D-10) --
 * the one place that actually calls `fetch` is T-37's API route, which
 * imports the builders/parsers from here.
 *
 * `RawWeather` is defined locally here (the ledger's rule: a task needing a
 * type not in `log/CONTRACTS.md` defines it locally in its own module), but
 * is kept structurally IDENTICAL to `pipeline.ts`'s own `RawWeather` so
 * `normaliseWeather()` can consume either parser's output directly with no
 * adaptation layer (acceptance test 12).
 */

import { EngineError } from '@shelter/engine';

const SECONDS_PER_HOUR = 3600;

export interface WeatherQuery {
  latitude: number;
  longitude: number;
  /** ISO 'YYYY-MM-DD', inclusive. */
  startDate: string;
  /** ISO 'YYYY-MM-DD', inclusive. */
  endDate: string;
}

export interface RawWeather {
  stepSeconds: number;
  startDayOfYear: number;
  startHour: number;
  units: 'C' | 'K';
  T_amb: number[];
  GHI: number[];
  v_wind: number[];
  DNI?: number[];
  DHI?: number[];
  LW_down?: number[];
  RH?: number[];
  sourceElevation: number | null;
}

function dayOfYearUTC(year: number, month: number, day: number): number {
  const startOfYear = Date.UTC(year, 0, 1);
  const d = Date.UTC(year, month - 1, day);
  return Math.round((d - startOfYear) / 86_400_000) + 1;
}

// ============================== NASA POWER ==============================

const NASA_POWER_DEFAULT_BASE_URL = 'https://power.larc.nasa.gov/api/temporal/hourly/point';

/** Exactly the 8 parameters `TECH.md` §9.2 names, no more, no fewer. */
const NASA_POWER_PARAMETERS = [
  'T2M',
  'ALLSKY_SFC_SW_DWN',
  'ALLSKY_SFC_SW_DNI',
  'ALLSKY_SFC_SW_DIFF',
  'ALLSKY_SFC_LW_DWN',
  'WS2M',
  'RH2M',
  'PS',
] as const;

export function nasaPowerUrl(
  q: WeatherQuery,
  baseUrl: string = NASA_POWER_DEFAULT_BASE_URL,
): string {
  const params = new URLSearchParams({
    parameters: NASA_POWER_PARAMETERS.join(','),
    community: 'RE',
    longitude: String(q.longitude),
    latitude: String(q.latitude),
    start: q.startDate.replace(/-/g, ''),
    end: q.endDate.replace(/-/g, ''),
    format: 'JSON',
  });
  return `${baseUrl}?${params.toString()}`;
}

function nasaField(
  parameter: Record<string, Record<string, number>>,
  name: string,
): Record<string, number> {
  const field = parameter[name];
  if (!field) {
    throw new EngineError('WEATHER_INVALID', `NASA POWER response is missing parameter "${name}"`, {
      field: name,
    });
  }
  return field;
}

/**
 * `key` is `YYYYMMDDHH` (fixed-width, `time_standard: "LST"` per the fixture
 * header) -- lexical sort order is chronological order for a fixed-width
 * numeric string, so `Object.keys(field).sort()` is enough.
 */
function parseNasaTimestamp(key: string): {
  year: number;
  month: number;
  day: number;
  hour: number;
} {
  return {
    year: Number(key.slice(0, 4)),
    month: Number(key.slice(4, 6)),
    day: Number(key.slice(6, 8)),
    hour: Number(key.slice(8, 10)),
  };
}

export function parseNasaPower(json: unknown, _q: WeatherQuery): RawWeather {
  const root = json as {
    properties?: { parameter?: Record<string, Record<string, number>> };
    geometry?: { coordinates?: number[] };
    header?: { fill_value?: number };
  };
  const parameter = root?.properties?.parameter;
  if (!parameter) {
    throw new EngineError(
      'WEATHER_INVALID',
      'NASA POWER response is missing properties.parameter',
      {
        field: 'properties.parameter',
      },
    );
  }

  const t2m = nasaField(parameter, 'T2M');
  const ghi = nasaField(parameter, 'ALLSKY_SFC_SW_DWN');
  const dni = nasaField(parameter, 'ALLSKY_SFC_SW_DNI');
  const dhi = nasaField(parameter, 'ALLSKY_SFC_SW_DIFF');
  const lwDown = nasaField(parameter, 'ALLSKY_SFC_LW_DWN');
  const wind = nasaField(parameter, 'WS2M');
  const rh = nasaField(parameter, 'RH2M');

  const keys = Object.keys(t2m).sort();
  const n = keys.length;
  const fillValue = root.header?.fill_value ?? -999;
  const isFill = (v: number): boolean => v === fillValue;
  const toArray = (field: Record<string, number>, name: string): number[] => {
    const fieldKeys = Object.keys(field);
    if (fieldKeys.length !== n) {
      throw new EngineError(
        'WEATHER_INVALID',
        `${name} has length ${fieldKeys.length}, expected ${n} (array-length mismatch)`,
        { field: name },
      );
    }
    return keys.map((k) => {
      const v = field[k];
      if (v === undefined) {
        throw new EngineError('WEATHER_INVALID', `${name} is missing timestamp ${k}`, {
          field: name,
        });
      }
      return isFill(v) ? NaN : v;
    });
  };

  const T_amb = toArray(t2m, 'T2M');
  const GHI = toArray(ghi, 'ALLSKY_SFC_SW_DWN');
  const DNI = toArray(dni, 'ALLSKY_SFC_SW_DNI');
  const DHI = toArray(dhi, 'ALLSKY_SFC_SW_DIFF');
  const LW_down = toArray(lwDown, 'ALLSKY_SFC_LW_DWN');
  const v_wind = toArray(wind, 'WS2M');
  const RH = toArray(rh, 'RH2M');

  const first = parseNasaTimestamp(keys[0]!);
  const coords = root.geometry?.coordinates;
  const sourceElevation = coords && coords.length >= 3 ? coords[2]! : null;

  return {
    stepSeconds: SECONDS_PER_HOUR,
    startDayOfYear: dayOfYearUTC(first.year, first.month, first.day),
    startHour: first.hour,
    units: 'C',
    T_amb,
    GHI,
    v_wind,
    DNI,
    DHI,
    LW_down,
    RH,
    sourceElevation,
  };
}

// ============================== OPEN-METEO ==============================

const OPEN_METEO_DEFAULT_BASE_URL = 'https://archive-api.open-meteo.com/v1/archive';

const OPEN_METEO_HOURLY_VARIABLES = [
  'temperature_2m',
  'relativehumidity_2m',
  'windspeed_10m',
  'shortwave_radiation',
  'direct_radiation',
  'diffuse_radiation',
  'direct_normal_irradiance',
] as const;

export function openMeteoUrl(
  q: WeatherQuery,
  baseUrl: string = OPEN_METEO_DEFAULT_BASE_URL,
): string {
  const params = new URLSearchParams({
    latitude: String(q.latitude),
    longitude: String(q.longitude),
    start_date: q.startDate,
    end_date: q.endDate,
    hourly: OPEN_METEO_HOURLY_VARIABLES.join(','),
  });
  return `${baseUrl}?${params.toString()}`;
}

function openMeteoField(hourly: Record<string, unknown>, name: string, n: number): number[] {
  const field = hourly[name];
  if (!Array.isArray(field)) {
    throw new EngineError('WEATHER_INVALID', `Open-Meteo response is missing hourly.${name}`, {
      field: name,
    });
  }
  if (field.length !== n) {
    throw new EngineError(
      'WEATHER_INVALID',
      `${name} has length ${field.length}, expected ${n} (array-length mismatch)`,
      { field: name },
    );
  }
  // Open-Meteo uses `null` for a missing hourly sample; NASA's -999 convention
  // does not apply here, but the gap contract is the same either way: never a
  // literal sentinel, always NaN for T-25's gap-filler to pick up.
  return field.map((v) => (v === null ? NaN : (v as number)));
}

function parseOpenMeteoTimestamp(iso: string): {
  year: number;
  month: number;
  day: number;
  hour: number;
} {
  const [datePart, timePart] = iso.split('T');
  const [year, month, day] = datePart!.split('-').map(Number) as [number, number, number];
  const hour = Number(timePart!.slice(0, 2));
  return { year, month, day, hour };
}

export function parseOpenMeteo(json: unknown, _q: WeatherQuery): RawWeather {
  const root = json as {
    hourly?: Record<string, unknown>;
    hourly_units?: Record<string, string>;
    elevation?: number;
  };
  const hourly = root?.hourly;
  if (!hourly) {
    throw new EngineError('WEATHER_INVALID', 'Open-Meteo response is missing hourly', {
      field: 'hourly',
    });
  }
  const time = hourly.time;
  if (!Array.isArray(time)) {
    throw new EngineError('WEATHER_INVALID', 'Open-Meteo response is missing hourly.time', {
      field: 'time',
    });
  }
  const n = time.length;

  const T_amb = openMeteoField(hourly, 'temperature_2m', n);
  const RH = openMeteoField(hourly, 'relativehumidity_2m', n);
  const windRaw = openMeteoField(hourly, 'windspeed_10m', n);
  const GHI = openMeteoField(hourly, 'shortwave_radiation', n);
  const DHI = openMeteoField(hourly, 'diffuse_radiation', n);
  const DNI = openMeteoField(hourly, 'direct_normal_irradiance', n);

  // windspeed_10m defaults to km/h (no `windspeed_unit=ms` requested by the
  // URL builder above); convert using whatever unit the response itself
  // reports, so this is correct regardless of what a caller's URL asked for.
  const windUnit = root.hourly_units?.windspeed_10m;
  const v_wind = windUnit === 'm/s' ? windRaw : windRaw.map((v) => v / 3.6);

  const first = parseOpenMeteoTimestamp(time[0] as string);

  return {
    stepSeconds: SECONDS_PER_HOUR,
    startDayOfYear: dayOfYearUTC(first.year, first.month, first.day),
    startHour: first.hour,
    units: 'C',
    T_amb,
    GHI,
    v_wind,
    DNI,
    DHI,
    RH,
    // Open-Meteo's archive API offers no downward-longwave variable in this
    // set; LW_down stays absent and T-25's normaliseWeather derives it via
    // Swinbank, by design (see the T-26 task brief).
    sourceElevation: root.elevation ?? null,
  };
}
