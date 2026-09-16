/**
 * The eighteen-scenario matrix, built from real recorded history. T-59,
 * `log/AREA-H-scenarios.md`, Area H.
 *
 * "We do not ask 'how does this design do on a typical day?' We ask 'how
 * does this design do on every day that matters?'" Every scenario below is
 * looked up in the bundled annual weather record (`packages/data/tmy/*.json`,
 * T-26/T-27 -- a real NASA POWER hourly year at the site's grid cell), never
 * invented. `buildScenarios` selects the eighteen windows; `scenarioWeather`
 * slices the annual series into any one of them.
 *
 * DEVIATION from the PROMPT's `Scenario.kind` union as written (which lists
 * six literals covering only seventeen of the eighteen scenarios -- the
 * twelve monthly days plus coldest/hottest/designWinter/sunlessStreak/
 * clearColdNight): scenario 18, the annual-mean reference day, is built by
 * the same representativeness method as a monthly day but over the whole
 * year, and tagging it `'monthly'` would make a `kind === 'monthly'` filter
 * return 13 results instead of 12 (acceptance test 2 expects exactly the
 * twelve calendar months). `'annualMean'` is added as a seventh literal.
 * This file is the only place `Scenario` is declared, so the change is
 * additive and does not touch any other task's contract.
 */
import type { WeatherSeries, WeatherProvenance } from '@shelter/engine';
import { EngineError, sunPosition, decompose } from '@shelter/engine';
import { TMY_LOCATIONS } from './tmy.js';

export interface Scenario {
  id: string;
  name: string;
  nameHi?: string;
  /** Plain English, shown in the survival grid. */
  description: string;
  kind:
    | 'monthly'
    | 'coldest'
    | 'hottest'
    | 'designWinter'
    | 'sunlessStreak'
    | 'clearColdNight'
    | 'annualMean';
  startDayOfYear: number;
  /** > 1 only for the sunless streak (scenario 16). */
  days: number;
  /** Names how this scenario was selected and from what record (global rule 11/14). */
  sourceNote: string;
}

// ============================== CALIBRATION KNOBS (LOG.md global rule 14) ==============================
// Every one of these is empirical, not derived. Change it only with a stated reason.

/**
 * A day's total horizontal insolation below this is classified "overcast" for
 * the purposes of scenario 16, the longest sunless streak. Chosen against the
 * Leh 2023 record itself: at 2.5 kWh/m^2/day the classification separates
 * genuinely low-clearness-index (cloudy, daytime k_t typically < 0.4) days
 * from low-sun-angle winter days that are still cloudless (k_t 0.5-0.8) but
 * simply short and low-elevation -- a purely seasonal effect that an absolute
 * threshold set much higher (e.g. 4000 Wh/m^2) would wrongly count as
 * "sunless" for weeks at a time. Raise it if a longer, still-genuinely-cloudy
 * run should be found in a different record; lower it if a marginal day is
 * being misclassified as overcast.
 */
export const OVERCAST_GHI_THRESHOLD_WHM2 = 2500;

/**
 * A day's mean daytime clearness index (k_t, Erbs decomposition,
 * `@shelter/engine` `decompose()`, CONTRACTS.md 7.10 "Irradiance
 * decomposition") above this counts as "clear" for scenario 17, the clear
 * cold night. 0.6 sits in the middle of a wide plateau in the Leh 2023
 * record (0.55-0.65 all select the same night) so the pick is not sensitive
 * to its exact value; push it toward 0.8 (Ladakh's genuinely cloudless days)
 * if a future, longer record makes the plateau narrower.
 */
export const CLEAR_SKY_KT_THRESHOLD = 0.6;

/**
 * The design winter day (scenario 15) is the day at this percentile of the
 * ascending-sorted daily mean temperature -- nearest-rank method,
 * `rank = ceil(p * N)`, 1-indexed. 0.01 (the "1-in-100" design day) is
 * standard professional practice for a cold-but-not-freak design condition;
 * raise it toward the coldest day itself (rank 1) only if the brief's design
 * philosophy changes from "conventional cold snap" to "worst case".
 */
export const DESIGN_WINTER_PERCENTILE = 0.01;

// Not one of the three headline thresholds above (so not required to be
// exported by name), but still an empirical choice, so still commented per
// rule 14: the "night" half of a day-window, for scenario 17's overnight
// mean and for comparing sky temperature at 03:00 (acceptance test 7).
// Pre-dawn hours only (00:00-05:59) -- hour 6 itself is `kpis.tempAt0600`,
// a distinct, already-named number, so it is excluded here to avoid double
// counting the same instant under two different labels.
const NIGHT_END_HOUR = 6;

// Above ~5 degrees solar altitude corrections get numerically unstable and
// irradiance is negligible; below it a day does not count as "daytime" for
// the purposes of a daytime-k_t average. Mirrors decompose()'s own internal
// COS_Z_FLOOR (`packages/engine/src/solar/decomposition.ts`), restated here
// because that constant is not exported.
const COS_Z_FLOOR = 0.0872; // cos(85 deg)

const MONTH_CUM_DAYS = [31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334, 365] as const;
const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
] as const;

/** Calendar month (0-11) for a day-of-year on the non-leap 365-day calendar
 * every bundled TMY file uses (`packages/data/src/tmy.ts` header comment;
 * `dayOfYearFor` in `test/tmy.test.ts`: day 1 = Jan 1). */
function monthOfDayOfYear(dayOfYear: number): number {
  const doy = ((dayOfYear - 1) % 365) + 1;
  for (let m = 0; m < 12; m++) {
    if (doy <= MONTH_CUM_DAYS[m]!) return m;
  }
  return 11;
}

function populationStdev(values: number[]): number {
  const n = values.length;
  const mean = values.reduce((a, b) => a + b, 0) / n;
  const variance = values.reduce((a, b) => a + (b - mean) ** 2, 0) / n;
  return Math.sqrt(variance);
}

interface DailyStats {
  /** Index into the per-day arrays, 0 = the series' first calendar day. */
  dayIndex: number;
  dayOfYear: number;
  meanTempK: number;
  ghiTotalWhM2: number;
  /** Mean k_t over hours the sun is above `COS_Z_FLOOR`; 0 if never up. */
  daytimeKt: number;
  /** Mean T_amb over hours [0, NIGHT_END_HOUR) of this same calendar day. */
  nightMeanTempK: number;
}

interface SiteAngle {
  latitude: number;
  longitude: number;
  standardMeridian: number;
}

/** One stat row per full calendar day in `series`. `site` drives the solar
 * position behind the daytime clearness index (CONTRACTS.md 7.10). */
function computeDailyStats(series: WeatherSeries, site: SiteAngle): DailyStats[] {
  const samplesPerDay = Math.round(86400 / series.stepSeconds);
  const totalDays = Math.floor(series.T_amb.length / samplesPerDay);
  const stats: DailyStats[] = [];

  for (let d = 0; d < totalDays; d++) {
    const dayOfYear = series.startDayOfYear + d;
    const base = d * samplesPerDay;
    let sumT = 0;
    let sumGhiWh = 0;
    let ktSum = 0;
    let ktCount = 0;
    let nightSumT = 0;
    let nightCount = 0;

    for (let h = 0; h < samplesPerDay; h++) {
      const idx = base + h;
      const T_amb = series.T_amb[idx]!;
      const GHI = series.GHI[idx]!;
      // Clock hour at the START of this sample's step -- the same convention
      // `packages/engine/src/solve/integrator.ts` uses for `sunPosition`.
      const clockHour = (series.startHour + (h * series.stepSeconds) / 3600) % 24;

      sumT += T_amb;
      sumGhiWh += GHI * (series.stepSeconds / 3600);

      const sun = sunPosition(site.latitude, site.longitude, site.standardMeridian, dayOfYear, clockHour);
      if (sun.cosZenith > COS_Z_FLOOR) {
        const irr = decompose(GHI, sun.cosZenith, dayOfYear, {
          DNI: series.DNI?.[idx],
          DHI: series.DHI?.[idx],
        });
        ktSum += irr.kt;
        ktCount++;
      }
      if (clockHour < NIGHT_END_HOUR) {
        nightSumT += T_amb;
        nightCount++;
      }
    }

    stats.push({
      dayIndex: d,
      dayOfYear,
      meanTempK: sumT / samplesPerDay,
      ghiTotalWhM2: sumGhiWh,
      daytimeKt: ktCount > 0 ? ktSum / ktCount : 0,
      nightMeanTempK: nightCount > 0 ? nightSumT / nightCount : sumT / samplesPerDay,
    });
  }
  return stats;
}

/** Pick the day in `pool` whose (meanTempK, ghiTotalWhM2) is jointly closest
 * to the pool's own mean, each axis normalised by the pool's own population
 * stdev so a ~30 K temperature spread and a ~5000 Wh/m^2 GHI spread
 * contribute comparably to one combined score. Used for the twelve monthly
 * days (pool = one calendar month) and the annual-mean day (pool = the
 * whole year). */
function pickRepresentativeDay(pool: DailyStats[]): { day: DailyStats; meanTempK: number; meanGhi: number } {
  const meanTempK = pool.reduce((a, s) => a + s.meanTempK, 0) / pool.length;
  const meanGhi = pool.reduce((a, s) => a + s.ghiTotalWhM2, 0) / pool.length;
  const stdT = populationStdev(pool.map((s) => s.meanTempK)) || 1;
  const stdG = populationStdev(pool.map((s) => s.ghiTotalWhM2)) || 1;

  let best = pool[0]!;
  let bestScore = Infinity;
  for (const s of pool) {
    const score = Math.abs(s.meanTempK - meanTempK) / stdT + Math.abs(s.ghiTotalWhM2 - meanGhi) / stdG;
    if (score < bestScore) {
      bestScore = score;
      best = s;
    }
  }
  return { day: best, meanTempK, meanGhi };
}

function celsius(k: number): string {
  return (k - 273.15).toFixed(1);
}

/**
 * Builds the eighteen scenarios from `series`, the bundled annual record for
 * `locationId`. Real, recorded history only -- see each `sourceNote`.
 */
export function buildScenarios(series: WeatherSeries, locationId: string): Scenario[] {
  const site: SiteAngle = siteAngleFor(locationId);
  const stats = computeDailyStats(series, site);
  if (stats.length === 0) {
    throw new EngineError('WEATHER_INVALID', 'buildScenarios: series has no full calendar day to build scenarios from.');
  }
  const record = series.provenance.label;
  const scenarios: Scenario[] = [];

  // 1-12: one representative day per month.
  for (let m = 0; m < 12; m++) {
    const pool = stats.filter((s) => monthOfDayOfYear(s.dayOfYear) === m);
    if (pool.length === 0) continue;
    const { day, meanTempK, meanGhi } = pickRepresentativeDay(pool);
    scenarios.push({
      id: `month-${String(m + 1).padStart(2, '0')}`,
      name: MONTH_NAMES[m]!,
      description: `Representative day for ${MONTH_NAMES[m]}: closest to that month's mean daily temperature (${celsius(meanTempK)} deg C) and mean daily solar input (${meanGhi.toFixed(0)} Wh/m^2) in the ${locationId} record.`,
      kind: 'monthly',
      startDayOfYear: day.dayOfYear,
      days: 1,
      sourceNote: `Day closest (jointly, on normalised temperature and GHI) to the mean of all days in ${MONTH_NAMES[m]} ${series.provenance.source}, "${record}".`,
    });
  }

  // 13: coldest 24 h window.
  const coldest = stats.reduce((a, b) => (b.meanTempK < a.meanTempK ? b : a));
  scenarios.push({
    id: 'coldest-day',
    name: 'Coldest day on record',
    description: `The 24 h window with the lowest mean temperature in the record: ${celsius(coldest.meanTempK)} deg C.`,
    kind: 'coldest',
    startDayOfYear: coldest.dayOfYear,
    days: 1,
    sourceNote: `Lowest mean-temperature 24 h window, exhaustively over every calendar day in the ${series.provenance.source} record, "${record}".`,
  });

  // 14: hottest 24 h window.
  const hottest = stats.reduce((a, b) => (b.meanTempK > a.meanTempK ? b : a));
  scenarios.push({
    id: 'hottest-day',
    name: 'Hottest day on record',
    description: `The 24 h window with the highest mean temperature in the record: ${celsius(hottest.meanTempK)} deg C. A shelter optimised only for winter can bake in summer.`,
    kind: 'hottest',
    startDayOfYear: hottest.dayOfYear,
    days: 1,
    sourceNote: `Highest mean-temperature 24 h window, exhaustively over every calendar day in the ${series.provenance.source} record, "${record}".`,
  });

  // 15: 1-in-100 design winter day -- 1st percentile of daily mean temp.
  const byTempAsc = [...stats].sort((a, b) => a.meanTempK - b.meanTempK);
  const rank = Math.max(1, Math.ceil(DESIGN_WINTER_PERCENTILE * byTempAsc.length));
  const designWinter = byTempAsc[rank - 1]!;
  scenarios.push({
    id: 'design-winter-day',
    name: '1-in-100 design winter day',
    description: `The cold-but-not-freak day engineers conventionally design to: ${celsius(designWinter.meanTempK)} deg C, warmer than the single coldest day on record (${celsius(coldest.meanTempK)} deg C).`,
    kind: 'designWinter',
    startDayOfYear: designWinter.dayOfYear,
    days: 1,
    sourceNote: `1st percentile of daily mean temperature (nearest-rank: rank = ceil(${DESIGN_WINTER_PERCENTILE} * ${byTempAsc.length}) = ${rank}, 1-indexed ascending) over the ${series.provenance.source} record, "${record}".`,
  });

  // 16: longest sunless streak.
  let bestStreak = { start: -1, len: 0 };
  let curStart = -1;
  let curLen = 0;
  for (let i = 0; i < stats.length; i++) {
    if (stats[i]!.ghiTotalWhM2 < OVERCAST_GHI_THRESHOLD_WHM2) {
      if (curLen === 0) curStart = i;
      curLen++;
      if (curLen > bestStreak.len) bestStreak = { start: curStart, len: curLen };
    } else {
      curLen = 0;
    }
  }
  if (bestStreak.len === 0) {
    throw new EngineError('WEATHER_INVALID', `No day in the record falls below the overcast threshold (${OVERCAST_GHI_THRESHOLD_WHM2} Wh/m^2/day); cannot build the sunless-streak scenario.`);
  }
  const streakDays = stats.slice(bestStreak.start, bestStreak.start + bestStreak.len);
  const streakMeanGhi = streakDays.reduce((a, s) => a + s.ghiTotalWhM2, 0) / streakDays.length;
  scenarios.push({
    id: 'sunless-streak',
    name: 'Longest sunless streak',
    description: `${bestStreak.len} consecutive days with daily solar input below ${OVERCAST_GHI_THRESHOLD_WHM2} Wh/m^2 (mean ${streakMeanGhi.toFixed(0)} Wh/m^2 over the streak) -- run end to end, not repeated. The real test of thermal storage.`,
    kind: 'sunlessStreak',
    startDayOfYear: streakDays[0]!.dayOfYear,
    days: bestStreak.len,
    sourceNote: `Longest run of consecutive days with daily GHI total < ${OVERCAST_GHI_THRESHOLD_WHM2} Wh/m^2 (the documented overcast threshold), exhaustively over every run in the ${series.provenance.source} record, "${record}".`,
  });

  // 17: clear cold night -- coldest overnight mean among clear-daytime days,
  // excluding the overall coldest day itself (scenario 13): the whole point
  // of this scenario is that it is a DIFFERENT night, colder in radiative/
  // sky terms despite not being the coldest night by air temperature alone.
  const clearCandidates = stats.filter((s) => s.dayIndex !== coldest.dayIndex && s.daytimeKt > CLEAR_SKY_KT_THRESHOLD);
  if (clearCandidates.length === 0) {
    throw new EngineError('WEATHER_INVALID', `No day (other than the coldest day) has daytime k_t above ${CLEAR_SKY_KT_THRESHOLD}; cannot build the clear-cold-night scenario.`);
  }
  const clearColdNight = clearCandidates.reduce((a, b) => (b.nightMeanTempK < a.nightMeanTempK ? b : a));
  scenarios.push({
    id: 'clear-cold-night',
    name: 'Clear cold night',
    description: `The coldest night (overnight mean ${celsius(clearColdNight.nightMeanTempK)} deg C) whose daytime clearness index exceeded ${CLEAR_SKY_KT_THRESHOLD} (k_t = ${clearColdNight.daytimeKt.toFixed(3)}). Clear skies radiate more heat away than clouds trap -- Ladakh's true worst case.`,
    kind: 'clearColdNight',
    startDayOfYear: clearColdNight.dayOfYear,
    days: 1,
    sourceNote: `Lowest overnight (00:00-${String(NIGHT_END_HOUR).padStart(2, '0')}:00) mean temperature among days with daytime k_t > ${CLEAR_SKY_KT_THRESHOLD} (Erbs clearness index, CONTRACTS.md 7.10), excluding the coldest day itself, over the ${series.provenance.source} record, "${record}".`,
  });

  // 18: annual-mean day, the reference the other seventeen are read against.
  const annual = pickRepresentativeDay(stats);
  scenarios.push({
    id: 'annual-mean-day',
    name: 'Annual-mean day',
    description: `The reference day: closest to the whole year's mean daily temperature (${celsius(annual.meanTempK)} deg C) and mean daily solar input (${annual.meanGhi.toFixed(0)} Wh/m^2).`,
    kind: 'annualMean',
    startDayOfYear: annual.day.dayOfYear,
    days: 1,
    sourceNote: `Day closest (jointly, on normalised temperature and GHI) to the mean of every day in the ${series.provenance.source} record, "${record}".`,
  });

  return scenarios;
}

/** `buildScenarios` needs a site latitude/longitude/standard-meridian to
 * compute the daytime clearness index (`sunPosition`, CONTRACTS.md 7.10).
 * `WeatherSeries` itself carries none of that (7.6) -- it is resolved the
 * same way `packages/data/src/presets.ts` resolves it elsewhere in this
 * package: `TMY_LOCATIONS` for a known bundled id, `82.5` (IST) as the
 * standard meridian shared by every bundled location. A caller passing a
 * `locationId` this package does not recognise, with a series that did not
 * come from `tmyById`, gets a clear error rather than a silently wrong sun
 * position. */
function siteAngleFor(locationId: string): SiteAngle {
  const loc = TMY_LOCATIONS.find((l) => l.id === locationId);
  if (!loc) {
    throw new EngineError('INVALID_INPUT', `buildScenarios: no known site coordinates for location id "${locationId}".`, { locationId });
  }
  return { latitude: loc.latitude, longitude: loc.longitude, standardMeridian: 82.5 };
}

/**
 * Slices `series` into the window described by `s`, preserving `provenance`
 * and appending a note naming the scenario (CONTRACTS.md 7.6). For the
 * sunless streak this returns the full multi-day window, not one day
 * repeated (`s.days` samples' worth, verbatim from the record).
 */
export function scenarioWeather(series: WeatherSeries, s: Scenario): WeatherSeries {
  const samplesPerDay = Math.round(86400 / series.stepSeconds);
  const dayOffset = s.startDayOfYear - series.startDayOfYear;
  const startIdx = dayOffset * samplesPerDay;
  const count = s.days * samplesPerDay;
  const endIdx = startIdx + count;

  if (startIdx < 0 || endIdx > series.T_amb.length) {
    throw new EngineError(
      'WEATHER_INVALID',
      `scenarioWeather: scenario "${s.id}" needs samples [${startIdx}, ${endIdx}) but the series only has ${series.T_amb.length}.`,
      { scenarioId: s.id, startIdx, endIdx, seriesLength: series.T_amb.length },
    );
  }

  const slice = (arr: Float64Array | undefined): Float64Array | undefined => arr?.slice(startIdx, endIdx);

  const provenance: WeatherProvenance = {
    ...series.provenance,
    notes: [...series.provenance.notes, `Scenario slice: "${s.name}" (${s.sourceNote})`],
  };

  const out: WeatherSeries = {
    stepSeconds: series.stepSeconds,
    startDayOfYear: s.startDayOfYear,
    startHour: series.startHour,
    T_amb: series.T_amb.slice(startIdx, endIdx),
    GHI: series.GHI.slice(startIdx, endIdx),
    v_wind: series.v_wind.slice(startIdx, endIdx),
    provenance,
  };
  const dni = slice(series.DNI);
  const dhi = slice(series.DHI);
  const lw = slice(series.LW_down);
  const rh = slice(series.RH);
  if (dni) out.DNI = dni;
  if (dhi) out.DHI = dhi;
  if (lw) out.LW_down = lw;
  if (rh) out.RH = rh;
  return out;
}
