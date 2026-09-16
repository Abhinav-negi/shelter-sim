/**
 * User-CSV weather upload parsing. T-25 (`LOG.md`, Area C).
 *
 * A field engineer at a real Ladakhi post with a data logger is exactly the
 * person this feature is for -- a generic "invalid CSV" tells them nothing.
 * So a malformed cell is reported by its row number and column name, the
 * offending cell becomes a gap (`NaN`) for `pipeline.ts`'s gap-filler to
 * interpolate rather than aborting the whole file, and the file is rejected
 * outright only when the contract itself cannot be met (a required column is
 * missing entirely).
 *
 * ponytail: a bare `split(',')` parser -- no quoted-field/embedded-comma
 * support. A real data-logger export is unlikely to quote a plain numeric
 * column. Upgrade path if a user ever hits this: swap the two `splitRow`
 * calls below for a proper RFC 4180 tokenizer; nothing else in this file
 * would need to change.
 *
 * No `fetch` here or anywhere in this package (T-26 owns network I/O).
 */

import { EngineError } from '@shelter/engine';
import type { RawWeather } from './pipeline.js';

/**
 * The documented column contract. `T_amb_C`, `GHI`, `v_wind` are mandatory
 * (their absence from the header makes the file unmeetable and it is
 * rejected outright); the rest are optional per-column, matching
 * `WeatherSeries`'s own optional fields (`LOG.md` §7.6).
 */
export const REQUIRED_COLUMNS = ['T_amb_C', 'GHI', 'v_wind'] as const;
export const OPTIONAL_COLUMNS = ['DNI', 'DHI', 'LW_down', 'RH'] as const;

export interface CsvRowError {
  /** 1-indexed DATA row (the header line is not counted; the first data line is row 1). */
  row: number;
  column: string;
  message: string;
}

export interface CsvParseResult {
  /** Always `units: 'C'` (the contract's `T_amb_C` column) and
   *  `sourceElevation: null` (user CSV skips the lapse-rate correction, stage 2). */
  raw: RawWeather;
  /** One entry per malformed cell. The corresponding array value is `NaN` --
   *  the previously-loaded (valid) rows and columns are untouched. */
  rowErrors: CsvRowError[];
}

export interface CsvParseOptions {
  /** Day of year (1-365) of the first data row. Every row is assumed to be exactly
   *  one hour after the previous one -- see the ponytail note on ONE_ROW_IS_ONE_HOUR below. */
  startDayOfYear: number;
  startHour?: number;
}

/** ponytail: one CSV row = one hour, sequential, fixed. A variable-timestep upload is out
 *  of scope for this pass -- `pipeline.ts`'s stage 5 already resamples from an arbitrary
 *  source stepSeconds, so only this constant (and a real timestamp column) would need to
 *  change to lift the restriction. */
const ONE_ROW_IS_ONE_HOUR_SECONDS = 3600;

function splitRow(line: string): string[] {
  return line.split(',').map((cell) => cell.trim());
}

function parseCell(cell: string | undefined, row: number, column: string, errors: CsvRowError[]): number {
  if (cell === undefined || cell === '') {
    errors.push({ row, column, message: `missing value` });
    return NaN;
  }
  const n = Number(cell);
  if (Number.isNaN(n)) {
    errors.push({ row, column, message: `'${cell}' is not a number` });
    return NaN;
  }
  return n;
}

/**
 * Parse a user-uploaded weather CSV. Throws `EngineError('WEATHER_INVALID')`
 * only when the header is missing a required column -- an unmeetable
 * contract. Any other malformed cell is reported per-row in `rowErrors` and
 * replaced with a gap (`NaN`); the rest of the file still loads.
 */
export function parseWeatherCsv(csvText: string, opts: CsvParseOptions): CsvParseResult {
  const lines = csvText.split(/\r\n|\n|\r/).filter((l) => l.trim().length > 0);
  if (lines.length === 0) {
    throw new EngineError('WEATHER_INVALID', 'CSV is empty');
  }

  const header = splitRow(lines[0]!);
  const columnIndex = new Map<string, number>();
  header.forEach((name, idx) => columnIndex.set(name, idx));

  const missingRequired = REQUIRED_COLUMNS.filter((c) => !columnIndex.has(c));
  if (missingRequired.length > 0) {
    throw new EngineError(
      'WEATHER_INVALID',
      `CSV missing required column(s): ${missingRequired.join(', ')}`,
      { missingColumns: missingRequired },
    );
  }

  const presentOptional = OPTIONAL_COLUMNS.filter((c) => columnIndex.has(c));

  const dataLines = lines.slice(1);
  const rowErrors: CsvRowError[] = [];
  const T_amb: number[] = [];
  const GHI: number[] = [];
  const v_wind: number[] = [];
  const optionalArrays: Record<string, number[]> = {};
  for (const c of presentOptional) optionalArrays[c] = [];

  dataLines.forEach((line, i) => {
    const rowNumber = i + 1; // 1-indexed data row, header excluded
    const cells = splitRow(line);
    T_amb.push(parseCell(cells[columnIndex.get('T_amb_C')!], rowNumber, 'T_amb_C', rowErrors));
    GHI.push(parseCell(cells[columnIndex.get('GHI')!], rowNumber, 'GHI', rowErrors));
    v_wind.push(parseCell(cells[columnIndex.get('v_wind')!], rowNumber, 'v_wind', rowErrors));
    for (const c of presentOptional) {
      optionalArrays[c]!.push(parseCell(cells[columnIndex.get(c)!], rowNumber, c, rowErrors));
    }
  });

  const raw: RawWeather = {
    stepSeconds: ONE_ROW_IS_ONE_HOUR_SECONDS,
    startDayOfYear: opts.startDayOfYear,
    startHour: opts.startHour ?? 0,
    units: 'C',
    T_amb,
    GHI,
    v_wind,
    ...(optionalArrays.DNI ? { DNI: optionalArrays.DNI } : {}),
    ...(optionalArrays.DHI ? { DHI: optionalArrays.DHI } : {}),
    ...(optionalArrays.LW_down ? { LW_down: optionalArrays.LW_down } : {}),
    ...(optionalArrays.RH ? { RH: optionalArrays.RH } : {}),
    sourceElevation: null,
  };

  return { raw, rowErrors };
}
