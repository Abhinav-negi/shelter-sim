/**
 * The weather pipeline. T-25 (`LOG.md`, Area C).
 *
 * Turns raw upstream/user weather into the canonical `WeatherSeries` of
 * `LOG.md` §7.6, in six strictly-ordered stages:
 *
 *   1. normalise to the WeatherSeries shape, Kelvin at the boundary
 *   2. lapse-rate correction (skipped entirely for user CSV)
 *   3. gap-fill by linear interpolation (<=3h silent, >3h logged)
 *   4. derive missing DNI/DHI (Erbs), LW_down (Swinbank), pressure (barometric)
 *   5. resample to the requested step -- linear for T/wind/RH, energy-
 *      conserving for irradiance
 *   6. validate -- throws EngineError('WEATHER_INVALID') naming the field and
 *      index; the AUDIT.md night-GHI false positive is a WARNING, not a
 *      hard failure
 *
 * Per D-10 (`log/CONTRACTS.md` §9), `@shelter/data` now carries one runtime
 * dependency, `@shelter/engine`, specifically so this stage can import the
 * Erbs, Swinbank and barometric-pressure correlations rather than reimplement
 * them (global rule 11: one canonical implementation per physics function;
 * global rule 16: no parallel implementations that can drift). `EngineError`
 * is imported from `@shelter/engine` directly here rather than the local
 * `@shelter/data/src/errors.ts` mirror -- that mirror exists only because of
 * the zero-runtime-deps rule D-10 just lifted for this package; it is left
 * untouched, out of this task's file allow-list.
 */

import {
  EngineError,
  T0,
  SIGMA,
  LAPSE_RATE,
  decompose,
  skyTemperature,
  pressureAtAltitude,
  sunPosition,
} from '@shelter/engine';
import type { WeatherSeries, WeatherProvenance } from '@shelter/engine';

const HOURS_PER_DAY = 24;
const SECONDS_PER_HOUR = 3600;

/**
 * Environmental lapse rate, K per metre. CALIBRATION KNOB (global rule 14).
 * Defaults to `@shelter/engine`'s `LAPSE_RATE` (6.5e-3 K/m, the ISA standard-
 * atmosphere average -- also `TECH.md` §9.3's worked example). The task text
 * allows a 5-7e-3 range: a real Himalayan valley's environmental lapse rate
 * varies with humidity and season (dry air lapses faster, approaching the
 * 9.8e-3 dry-adiabatic rate; a still winter night can even produce a surface
 * temperature inversion that reverses the sign locally). Change this default
 * only against a MEASURED paired-station comparison -- e.g. a Leh-town logger
 * vs. a ridge-top logger over the same season -- never against a single
 * anecdote or a single day's data.
 */
export const DEFAULT_LAPSE_RATE_K_PER_M = LAPSE_RATE;

/**
 * Below this, an hourly-mean GHI reading outside daylight is treated as a
 * measurement/averaging artefact, not a data error. AUDIT.md: a hard "GHI=0
 * between sunset and sunrise" check false-positives on real hourly-averaged
 * data, where the sunrise/sunset hour legitimately carries non-zero mean
 * irradiance. Only warn when GHI exceeds this AND persists more than 1h
 * outside any daylight window (see `isMoreThanOneHourFromDaylight` below).
 */
export const GHI_NIGHT_WARNING_THRESHOLD_WM2 = 20;

/** Longest gap (hours) that is interpolated silently, no `provenance.notes` entry. */
export const SILENT_GAP_HOURS = 3;

export interface RawWeather {
  /** Seconds between samples in this raw series (the source's native resolution). */
  stepSeconds: number;
  /** Day of year (1-365) of the first sample. */
  startDayOfYear: number;
  /** Local clock hour (0-24, fractional) of the first sample. */
  startHour: number;
  /** Whether `T_amb` below is Celsius or already Kelvin. Upstream sources such as
   *  NASA POWER's T2M report Celsius; bundled/synthetic data may already be Kelvin. */
  units: 'C' | 'K';
  /** May contain `NaN` to mark a missing sample -- e.g. a sentinel fill value
   *  (NASA POWER's -999) already converted to a gap upstream. Converting a
   *  source's own fill-value convention into `NaN` is T-26's job, never this
   *  pipeline's; this pipeline only knows how to gap-fill `NaN`. */
  T_amb: number[];
  GHI: number[];
  v_wind: number[];
  DNI?: number[];
  DHI?: number[];
  LW_down?: number[];
  RH?: number[];
  /** m, the elevation the SOURCE grid cell/station represents. `null` when there is
   *  none to correct against -- always `null` for user CSV (stage 2 is skipped then). */
  sourceElevation: number | null;
}

export interface NormaliseOptions {
  site: { latitude: number; longitude: number; elevation: number; standardMeridian: number };
  /** seconds -- the OUTPUT step. Stage 5 resamples the series to this. */
  targetStepSeconds: number;
  source: WeatherProvenance['source'];
  label: string;
  fetchedAt?: string;
  /** K/m. Defaults to `DEFAULT_LAPSE_RATE_K_PER_M`. See that constant's comment (rule 14). */
  lapseRateKPerM?: number;
}

// ============================== STAGE 1+2: normalise, Kelvin, lapse rate ==============================

function toKelvinArray(values: number[], units: 'C' | 'K'): number[] {
  return units === 'C' ? values.map((v) => (Number.isNaN(v) ? v : v + T0)) : values.slice();
}

// ============================== STAGE 3: gap-fill ==============================

/**
 * Linear-interpolate `NaN` runs. Runs of `SILENT_GAP_HOURS` or less are filled
 * with no comment; longer runs are filled anyway (still the best available
 * estimate) but push a `provenance.notes` entry naming the gap's start index
 * and length, so a longer gap stays visible to the UI. A `NaN` run touching
 * either edge of the series has no bilateral bound to interpolate from and is
 * left as `NaN` -- stage 6 (`validateWeatherSeries`) then rejects it by name
 * and index, which is the correct behaviour: an edge gap cannot be estimated
 * from this data at all.
 */
export function gapFill(
  values: number[],
  stepSeconds: number,
  fieldName: string,
  notes: string[],
): number[] {
  const out = values.slice();
  const n = out.length;
  let i = 0;
  while (i < n) {
    if (!Number.isNaN(out[i])) {
      i++;
      continue;
    }
    const start = i;
    let end = i;
    while (end < n && Number.isNaN(out[end])) end++;
    const leftIdx = start - 1;
    const rightIdx = end;
    if (leftIdx < 0 || rightIdx >= n) {
      // Edge gap: no bound on one side, cannot interpolate. Leave as NaN for
      // stage 6 to reject by name and index.
      i = end;
      continue;
    }
    const leftVal = out[leftIdx]!;
    const rightVal = out[rightIdx]!;
    for (let k = start; k < end; k++) {
      const frac = (k - leftIdx) / (rightIdx - leftIdx);
      out[k] = leftVal + (rightVal - leftVal) * frac;
    }
    const gapHours = ((end - start) * stepSeconds) / SECONDS_PER_HOUR;
    if (gapHours > SILENT_GAP_HOURS) {
      notes.push(
        `${fieldName}: gap of ${gapHours}h (indices ${start}-${end - 1}) interpolated (> ${SILENT_GAP_HOURS}h silent threshold)`,
      );
    }
    i = end;
  }
  return out;
}

// ============================== STAGE 4: derive missing fields ==============================

function timeAtIndex(
  startDayOfYear: number,
  startHour: number,
  stepSeconds: number,
  i: number,
): { dayOfYear: number; clockHour: number } {
  const totalHours = startHour + (i * stepSeconds) / SECONDS_PER_HOUR;
  const dayOffset = Math.floor(totalHours / HOURS_PER_DAY);
  const clockHour = totalHours - dayOffset * HOURS_PER_DAY;
  return { dayOfYear: startDayOfYear + dayOffset, clockHour };
}

// ============================== STAGE 5: resample ==============================

/** Linear interpolation onto a new, uniform time grid. For T_amb, v_wind, RH. */
export function resampleLinear(
  values: number[],
  srcStepSeconds: number,
  dstStepSeconds: number,
  outputCount: number,
): Float64Array {
  const n = values.length;
  const out = new Float64Array(outputCount);
  for (let j = 0; j < outputCount; j++) {
    const t = j * dstStepSeconds;
    const idxF = t / srcStepSeconds;
    const idx0 = Math.min(n - 1, Math.floor(idxF));
    const idx1 = Math.min(n - 1, idx0 + 1);
    const frac = idxF - idx0;
    out[j] = values[idx0]! + (values[idx1]! - values[idx0]!) * frac;
  }
  return out;
}

/**
 * Energy-conserving resample: `values[i]` is treated as the MEAN value held
 * constant over the source step `[i*srcStepSeconds, (i+1)*srcStepSeconds)`
 * (the natural reading of "hourly-mean irradiance"). Each output sample is
 * the exact average of that step function over its own output interval, so
 * `sum(out) * dstStepSeconds === sum(values) * srcStepSeconds` to floating-
 * point precision -- `integral(GHI dt)` is preserved by construction, not
 * approximately. A plain linear interpolation of GHI does NOT have this
 * property (it treats hourly means as instantaneous point samples), which is
 * exactly the bug this function exists to avoid -- see acceptance test 3.
 */
export function resampleConserving(
  values: number[],
  srcStepSeconds: number,
  dstStepSeconds: number,
  outputCount: number,
): Float64Array {
  const n = values.length;
  const totalDuration = n * srcStepSeconds;
  const out = new Float64Array(outputCount);
  for (let j = 0; j < outputCount; j++) {
    const tStart = j * dstStepSeconds;
    const tEnd = Math.min(tStart + dstStepSeconds, totalDuration);
    if (tEnd <= tStart) {
      out[j] = 0;
      continue;
    }
    let sum = 0;
    let t = tStart;
    while (t < tEnd) {
      const idx = Math.min(n - 1, Math.floor(t / srcStepSeconds));
      const segEnd = Math.min(tEnd, (idx + 1) * srcStepSeconds);
      sum += values[idx]! * (segEnd - t);
      t = segEnd;
    }
    out[j] = sum / (tEnd - tStart);
  }
  return out;
}

// ============================== STAGE 6: validate ==============================

const T_MIN_PLAUSIBLE_WEATHER = 180; // K -- task-specified plausibility band, not the solver guard
const T_MAX_PLAUSIBLE_WEATHER = 330; // K

/**
 * `altitude(clockHour) <= 0` at the sample hour AND at both neighbouring
 * hours means the sample sits in the middle of the night, not merely in the
 * sunrise/sunset hour where a real hourly average legitimately carries a
 * little light. This is deliberately a 1-hour buffer either side, matching
 * the acceptance test's "more than 1h outside daylight" wording exactly.
 */
function isMoreThanOneHourFromDaylight(
  site: { latitude: number; longitude: number; standardMeridian: number },
  dayOfYear: number,
  clockHour: number,
): boolean {
  const altitudeAt = (h: number): number => {
    const wrapped = ((h % HOURS_PER_DAY) + HOURS_PER_DAY) % HOURS_PER_DAY;
    return sunPosition(site.latitude, site.longitude, site.standardMeridian, dayOfYear, wrapped)
      .altitude;
  };
  return (
    altitudeAt(clockHour) <= 0 && altitudeAt(clockHour - 1) <= 0 && altitudeAt(clockHour + 1) <= 0
  );
}

/**
 * Stage 6. Throws `EngineError('WEATHER_INVALID')` naming the field and index
 * on any hard failure (NaN, negative GHI, implausible temperature, mismatched
 * array lengths). Returns non-fatal warning strings -- the AUDIT.md night-GHI
 * false-positive case is one of these, never a thrown error. Exported (not
 * just used internally by `normaliseWeather`) so it is directly testable
 * against hand-built series without needing full pipeline options.
 */
export function validateWeatherSeries(
  series: WeatherSeries,
  site?: { latitude: number; longitude: number; standardMeridian: number },
): string[] {
  const n = series.T_amb.length;
  const namedArrays: [string, Float64Array | undefined][] = [
    ['T_amb', series.T_amb],
    ['GHI', series.GHI],
    ['v_wind', series.v_wind],
    ['DNI', series.DNI],
    ['DHI', series.DHI],
    ['LW_down', series.LW_down],
    ['RH', series.RH],
  ];

  for (const [name, arr] of namedArrays) {
    if (arr && arr.length !== n) {
      throw new EngineError(
        'WEATHER_INVALID',
        `${name} has length ${arr.length}, expected ${n} (array-length mismatch)`,
      );
    }
  }

  for (const [name, arr] of namedArrays) {
    if (!arr) continue;
    for (let i = 0; i < arr.length; i++) {
      if (Number.isNaN(arr[i])) {
        throw new EngineError('WEATHER_INVALID', `${name}[${i}] is NaN`, { field: name, index: i });
      }
    }
  }

  for (let i = 0; i < n; i++) {
    const ghi = series.GHI[i]!;
    if (ghi < 0) {
      throw new EngineError('WEATHER_INVALID', `GHI[${i}] = ${ghi} is negative`, {
        field: 'GHI',
        index: i,
      });
    }
    const t = series.T_amb[i]!;
    if (t < T_MIN_PLAUSIBLE_WEATHER || t > T_MAX_PLAUSIBLE_WEATHER) {
      throw new EngineError(
        'WEATHER_INVALID',
        `T_amb[${i}] = ${t} K is outside the plausible range [${T_MIN_PLAUSIBLE_WEATHER}, ${T_MAX_PLAUSIBLE_WEATHER}] K`,
        { field: 'T_amb', index: i },
      );
    }
  }

  const warnings: string[] = [];
  if (site) {
    for (let i = 0; i < n; i++) {
      const ghi = series.GHI[i]!;
      if (ghi <= GHI_NIGHT_WARNING_THRESHOLD_WM2) continue;
      const { dayOfYear, clockHour } = timeAtIndex(
        series.startDayOfYear,
        series.startHour,
        series.stepSeconds,
        i,
      );
      if (isMoreThanOneHourFromDaylight(site, dayOfYear, clockHour)) {
        warnings.push(
          `GHI[${i}] = ${ghi} W/m^2 more than 1h outside any daylight window (day ${dayOfYear}, hour ${clockHour.toFixed(2)})`,
        );
      }
    }
  }
  return warnings;
}

// ============================== THE PIPELINE ==============================

export function normaliseWeather(raw: RawWeather, opts: NormaliseOptions): WeatherSeries {
  const notes: string[] = [];
  const isUserCsv = opts.source === 'user-csv';

  // ---- Stage 1: normalise to Kelvin ----
  let T_amb = toKelvinArray(raw.T_amb, raw.units);
  let GHI = raw.GHI.slice();
  let v_wind = raw.v_wind.slice();
  let DNI = raw.DNI ? raw.DNI.slice() : undefined;
  let DHI = raw.DHI ? raw.DHI.slice() : undefined;
  let LW_down = raw.LW_down ? raw.LW_down.slice() : undefined;
  let RH = raw.RH ? raw.RH.slice() : undefined;
  const dniWasMissing = raw.DNI === undefined || raw.DHI === undefined;

  // ---- Stage 2: lapse-rate correction (skipped for user CSV) ----
  let lapseCorrectionK = 0;
  let sourceElevation: number | null = null;
  if (!isUserCsv && raw.sourceElevation !== null) {
    const gamma = opts.lapseRateKPerM ?? DEFAULT_LAPSE_RATE_K_PER_M;
    // T_corrected = T_source + Gamma * (h_source - h_site). Gamma is K/m on
    // disk (LAPSE_RATE, constants.ts) -- TECH.md §9.3's worked example uses
    // K/km, hence the /1000 in that document's phrasing; here Gamma is
    // already K/m so no extra division is needed.
    lapseCorrectionK = gamma * (raw.sourceElevation - opts.site.elevation);
    T_amb = T_amb.map((t) => t + lapseCorrectionK);
    sourceElevation = raw.sourceElevation;
  }

  // ---- Stage 3: gap-fill (<=3h silent, >3h logged) ----
  T_amb = gapFill(T_amb, raw.stepSeconds, 'T_amb', notes);
  GHI = gapFill(GHI, raw.stepSeconds, 'GHI', notes);
  v_wind = gapFill(v_wind, raw.stepSeconds, 'v_wind', notes);
  if (DNI) DNI = gapFill(DNI, raw.stepSeconds, 'DNI', notes);
  if (DHI) DHI = gapFill(DHI, raw.stepSeconds, 'DHI', notes);
  if (LW_down) LW_down = gapFill(LW_down, raw.stepSeconds, 'LW_down', notes);
  if (RH) RH = gapFill(RH, raw.stepSeconds, 'RH', notes);

  // ---- Stage 4: derive missing fields, imported from @shelter/engine ----
  // DNI/DHI: decompose() itself only recomputes via Erbs when either is
  // missing, and passes known values through unchanged when both are given
  // (solar/decomposition.ts) -- so it is safe, and simplest, to always run it
  // per-sample and let the engine's own function decide, rather than
  // reimplementing that branch here (global rule 11).
  const derivedDNI = new Array<number>(T_amb.length);
  const derivedDHI = new Array<number>(T_amb.length);
  for (let i = 0; i < T_amb.length; i++) {
    const { dayOfYear, clockHour } = timeAtIndex(
      raw.startDayOfYear,
      raw.startHour,
      raw.stepSeconds,
      i,
    );
    const sun = sunPosition(
      opts.site.latitude,
      opts.site.longitude,
      opts.site.standardMeridian,
      dayOfYear,
      clockHour,
    );
    const irr = decompose(GHI[i]!, sun.cosZenith, dayOfYear, { DNI: DNI?.[i], DHI: DHI?.[i] });
    derivedDNI[i] = irr.DNI;
    derivedDHI[i] = irr.DHI;
  }
  DNI = derivedDNI;
  DHI = derivedDHI;
  if (dniWasMissing) {
    notes.push(
      'DNI/DHI derived via the Erbs correlation from GHI (@shelter/engine solar/decomposition.ts)',
    );
  }

  if (!LW_down) {
    // Swinbank clear-sky estimate: skyTemperature(T_amb) with no measured
    // lwDown always takes the Swinbank branch (surfaces/exterior.ts).
    LW_down = T_amb.map((t) => SIGMA * Math.pow(skyTemperature(t), 4));
    notes.push(
      'LW_down derived via the Swinbank sky-temperature correlation (@shelter/engine surfaces/exterior.ts)',
    );
  }

  // Pressure: WeatherSeries (LOG.md §7.6) has no pressure field to store a
  // per-timestep value in -- ambient pressure at a fixed site elevation is a
  // single scalar, not a time series, and every consumer that needs it
  // (loads/infiltration.ts, air.ts) already derives it from Site.elevation
  // directly. This stage still runs the barometric formula, as the prompt
  // requires, and records the derived value for the UI/audit trail.
  const sitePressurePa = pressureAtAltitude(opts.site.elevation);
  notes.push(
    `pressure derived via the barometric formula at site elevation ${opts.site.elevation} m (@shelter/engine air.ts): ${sitePressurePa.toFixed(0)} Pa`,
  );

  // ---- Stage 5: resample to the requested step ----
  const totalDuration = T_amb.length * raw.stepSeconds;
  const outputCount = Math.round(totalDuration / opts.targetStepSeconds);
  const T_amb_out = resampleLinear(T_amb, raw.stepSeconds, opts.targetStepSeconds, outputCount);
  const v_wind_out = resampleLinear(v_wind, raw.stepSeconds, opts.targetStepSeconds, outputCount);
  const RH_out = RH
    ? resampleLinear(RH, raw.stepSeconds, opts.targetStepSeconds, outputCount)
    : undefined;
  const GHI_out = resampleConserving(GHI, raw.stepSeconds, opts.targetStepSeconds, outputCount);
  const DNI_out = resampleConserving(DNI, raw.stepSeconds, opts.targetStepSeconds, outputCount);
  const DHI_out = resampleConserving(DHI, raw.stepSeconds, opts.targetStepSeconds, outputCount);
  const LW_down_out = resampleConserving(
    LW_down,
    raw.stepSeconds,
    opts.targetStepSeconds,
    outputCount,
  );

  const provenance: WeatherProvenance = {
    source: opts.source,
    label: opts.label,
    sourceElevation,
    lapseCorrectionK,
    ...(opts.fetchedAt !== undefined ? { fetchedAt: opts.fetchedAt } : {}),
    notes,
  };

  const series: WeatherSeries = {
    stepSeconds: opts.targetStepSeconds,
    startDayOfYear: raw.startDayOfYear,
    startHour: raw.startHour,
    T_amb: T_amb_out,
    GHI: GHI_out,
    v_wind: v_wind_out,
    DNI: DNI_out,
    DHI: DHI_out,
    LW_down: LW_down_out,
    ...(RH_out ? { RH: RH_out } : {}),
    provenance,
  };

  // ---- Stage 6: validate ----
  const warnings = validateWeatherSeries(series, opts.site);
  notes.push(...warnings);

  return series;
}
