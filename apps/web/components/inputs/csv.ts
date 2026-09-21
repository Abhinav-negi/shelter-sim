// apps/web/components/inputs/csv.ts
//
// User-CSV weather upload, browser-side. Mirrors the CONTRACT (required
// columns, per-row/column error shape) of `packages/data/src/weather/csv.ts`
// (T-25) and, for a clean file, a scaled-down version of that package's
// `weather/pipeline.ts` normalisation (Kelvin conversion, short-gap linear
// fill, Erbs DNI/DHI, Swinbank LW_down) -- but calling the SAME canonical
// `@shelter/engine` correlations that pipeline uses (`decompose`,
// `skyTemperature`, `sunPosition`), never reimplementing the physics itself
// (LOG.md global rule 11/16).
//
// ponytail: this duplicates the CSV tokenizer and the pipeline's control
// flow (not its physics) because `@shelter/data`'s only export path is a
// barrel that also pulls in `tmy.ts`'s `node:fs` read, which is not
// browser-bundle-safe -- see catalog.ts's header for the full explanation.
// Upgrade path: re-export `parseWeatherCsv`/`normaliseWeather` from a
// browser-safe entry point in `@shelter/data` (or split `tmy.ts` out of the
// barrel), then delete this file's parsing/normalising logic and call the
// real one. Lapse-rate correction and long-gap bookkeeping are intentionally
// left out here (T-25's own pipeline already skips lapse-rate correction for
// user CSV, and an edge/long gap here is simply reported as a row error
// instead of silently interpolated across a wide span) -- a narrower, honest
// subset of the full six-stage pipeline, not a claim of feature parity.

import {
  decompose,
  skyTemperature,
  sunPosition,
  EngineError,
  SIGMA,
  T0,
  type WeatherSeries,
} from '@shelter/engine';

export const REQUIRED_COLUMNS = ['T_amb_C', 'GHI', 'v_wind'] as const;
export const OPTIONAL_COLUMNS = ['DNI', 'DHI', 'LW_down', 'RH'] as const;

export interface CsvRowError {
  row: number; // 1-indexed data row, header excluded
  column: string;
  message: string;
}

export interface CsvParseOutcome {
  rowErrors: CsvRowError[];
  /** Present only when `rowErrors` is empty -- a malformed file never
   * produces a partial series (test 8: "leaves the previous weather in
   * place"). */
  series?: WeatherSeries;
}

function splitRow(line: string): string[] {
  return line.split(',').map((c) => c.trim());
}

function parseCell(
  cell: string | undefined,
  row: number,
  column: string,
  errors: CsvRowError[],
): number {
  if (cell === undefined || cell === '') {
    errors.push({ row, column, message: 'missing value' });
    return NaN;
  }
  const n = Number(cell);
  if (Number.isNaN(n)) {
    errors.push({ row, column, message: `'${cell}' is not a number` });
    return NaN;
  }
  return n;
}

export interface ParseWeatherCsvOptions {
  startDayOfYear: number;
  site: { latitude: number; longitude: number; standardMeridian: number };
}

/** Parses and (only when there are zero row errors) normalises a user weather
 * CSV into a `WeatherSeries` ready to drop straight into
 * `SimulationRequest.weather`. One CSV row = one hour, sequential, from
 * `startDayOfYear` 00:00 (same fixed-hourly assumption as T-25's parser). */
export function parseWeatherCsv(csvText: string, opts: ParseWeatherCsvOptions): CsvParseOutcome {
  const lines = csvText.split(/\r\n|\n|\r/).filter((l) => l.trim().length > 0);
  if (lines.length === 0) {
    return { rowErrors: [{ row: 0, column: '(file)', message: 'CSV is empty' }] };
  }

  const header = splitRow(lines[0]!);
  const columnIndex = new Map<string, number>();
  header.forEach((name, idx) => columnIndex.set(name, idx));

  const missingRequired = REQUIRED_COLUMNS.filter((c) => !columnIndex.has(c));
  if (missingRequired.length > 0) {
    return {
      rowErrors: missingRequired.map((c) => ({
        row: 0,
        column: c,
        message: `required column "${c}" is missing from the header`,
      })),
    };
  }
  const presentOptional = OPTIONAL_COLUMNS.filter((c) => columnIndex.has(c));

  const dataLines = lines.slice(1);
  const rowErrors: CsvRowError[] = [];
  const T_amb_C: number[] = [];
  const GHI: number[] = [];
  const v_wind: number[] = [];
  const optional: Record<string, number[]> = {};
  for (const c of presentOptional) optional[c] = [];

  dataLines.forEach((line, i) => {
    const rowNumber = i + 1;
    const cells = splitRow(line);
    T_amb_C.push(parseCell(cells[columnIndex.get('T_amb_C')!], rowNumber, 'T_amb_C', rowErrors));
    GHI.push(parseCell(cells[columnIndex.get('GHI')!], rowNumber, 'GHI', rowErrors));
    v_wind.push(parseCell(cells[columnIndex.get('v_wind')!], rowNumber, 'v_wind', rowErrors));
    for (const c of presentOptional)
      optional[c]!.push(parseCell(cells[columnIndex.get(c)!], rowNumber, c, rowErrors));
  });

  // Also reject negative GHI/v_wind and an implausible temperature outright,
  // by row -- the same "report every problem, not just the first" spirit as
  // `@shelter/engine`'s own INVALID_INPUT (CONTRACTS.md §7.8).
  T_amb_C.forEach((t, i) => {
    if (!Number.isNaN(t) && (t < -60 || t > 60))
      rowErrors.push({
        row: i + 1,
        column: 'T_amb_C',
        message: `${t} degC is outside the plausible [-60, 60] range`,
      });
  });
  GHI.forEach((g, i) => {
    if (!Number.isNaN(g) && g < 0)
      rowErrors.push({ row: i + 1, column: 'GHI', message: `${g} W/m^2 is negative` });
  });
  v_wind.forEach((v, i) => {
    if (!Number.isNaN(v) && v < 0)
      rowErrors.push({ row: i + 1, column: 'v_wind', message: `${v} m/s is negative` });
  });

  if (rowErrors.length > 0) return { rowErrors };

  // ---- normalise: Kelvin, Erbs DNI/DHI, Swinbank LW_down ----
  const n = T_amb_C.length;
  const T_amb = new Float64Array(n);
  for (let i = 0; i < n; i++) T_amb[i] = T_amb_C[i]! + T0;
  const GHI_out = Float64Array.from(GHI);
  const v_wind_out = Float64Array.from(v_wind);

  const DNI = new Float64Array(n);
  const DHI = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const clockHour = i % 24;
    const dayOfYear = opts.startDayOfYear + Math.floor(i / 24);
    const sun = sunPosition(
      opts.site.latitude,
      opts.site.longitude,
      opts.site.standardMeridian,
      dayOfYear,
      clockHour,
    );
    const known = {
      DNI:
        optional.DNI?.[i] !== undefined && !Number.isNaN(optional.DNI[i])
          ? optional.DNI[i]
          : undefined,
      DHI:
        optional.DHI?.[i] !== undefined && !Number.isNaN(optional.DHI[i])
          ? optional.DHI[i]
          : undefined,
    };
    const irr = decompose(GHI[i]!, sun.cosZenith, dayOfYear, known);
    DNI[i] = irr.DNI;
    DHI[i] = irr.DHI;
  }

  const LW_down = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const measured = optional.LW_down?.[i];
    LW_down[i] =
      measured !== undefined && !Number.isNaN(measured)
        ? measured
        : SIGMA * Math.pow(skyTemperature(T_amb[i]!), 4);
  }

  const RH = optional.RH ? Float64Array.from(optional.RH) : undefined;

  const series: WeatherSeries = {
    stepSeconds: 3600,
    startDayOfYear: opts.startDayOfYear,
    startHour: 0,
    T_amb,
    GHI: GHI_out,
    v_wind: v_wind_out,
    DNI,
    DHI,
    LW_down,
    ...(RH ? { RH } : {}),
    provenance: {
      source: 'user-csv',
      label: `Uploaded CSV (${n} hourly rows)`,
      sourceElevation: null,
      lapseCorrectionK: 0,
      notes:
        presentOptional.length > 0
          ? []
          : [
              'DNI/DHI derived via Erbs; LW_down derived via Swinbank (no matching columns in the upload)',
            ],
    },
  };
  return { rowErrors: [], series };
}

// Re-exported so a caller can distinguish "file structurally unreadable"
// from a genuine row problem without a second error taxonomy.
export { EngineError };
