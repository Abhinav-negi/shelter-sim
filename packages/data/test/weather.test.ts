/**
 * T-25 acceptance tests, `log/AREA-C-data-layer.md`, numbered 1-13 verbatim.
 */
import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {
  simulate,
  toK,
  EngineError,
  sunPosition,
  extraterrestrialNormal,
  SIGMA,
  skyTemperature,
} from '@shelter/engine';
import type { SimulationRequest, Site, Surface, Layer, WeatherSeries } from '@shelter/engine';
import { materialById } from '../src/materials.js';
import { glazingById } from '../src/glazing.js';
import {
  normaliseWeather,
  gapFill,
  resampleLinear,
  resampleConserving,
  validateWeatherSeries,
  type RawWeather,
  type NormaliseOptions,
} from '../src/weather/pipeline.js';
import { parseWeatherCsv } from '../src/weather/csv.js';

const LEH_SITE = { latitude: 34.15, longitude: 77.58, elevation: 3500, standardMeridian: 82.5 };

function hourlyRaw(overrides: Partial<RawWeather>, n: number): RawWeather {
  return {
    stepSeconds: 3600,
    startDayOfYear: 15,
    startHour: 0,
    units: 'K',
    T_amb: new Array(n).fill(260),
    GHI: new Array(n).fill(0),
    v_wind: new Array(n).fill(2),
    sourceElevation: 4000,
    ...overrides,
  };
}

function buildSeriesForValidate(GHI: number[], dayOfYear: number, tAmbK = 250): WeatherSeries {
  const n = GHI.length;
  return {
    stepSeconds: 3600,
    startDayOfYear: dayOfYear,
    startHour: 0,
    T_amb: new Float64Array(n).fill(tAmbK),
    GHI: new Float64Array(GHI),
    v_wind: new Float64Array(n).fill(2),
    provenance: {
      source: 'synthetic',
      label: 'validate test',
      sourceElevation: null,
      lapseCorrectionK: 0,
      notes: [],
    },
  };
}

describe('T-25 acceptance test 1 -- TECH.md 9.3 worked example, lapse-rate correction', () => {
  it('a source at 4120 m used for a 3500 m site raises every T by 6.5 * 0.62 = 4.03 K', () => {
    const n = 4;
    const raw = hourlyRaw({ sourceElevation: 4120, T_amb: new Array(n).fill(260) }, n);
    const opts: NormaliseOptions = {
      site: LEH_SITE,
      targetStepSeconds: 3600,
      source: 'nasa-power',
      label: 'test1',
    };
    const series = normaliseWeather(raw, opts);
    const expectedOffset = 6.5 * 0.62; // 4.03 K, TECH.md 9.3
    // eslint-disable-next-line no-console
    console.log(
      `TEST1 lapseCorrectionK measured=${series.provenance.lapseCorrectionK} expected=${expectedOffset}`,
    );
    expect(series.provenance.lapseCorrectionK).toBeCloseTo(expectedOffset, 2);
    for (let i = 0; i < n; i++) {
      expect(series.T_amb[i]).toBeCloseTo(260 + expectedOffset, 2);
    }
  });
});

describe('T-25 acceptance test 2 -- user CSV skips the lapse-rate correction entirely', () => {
  it('lapseCorrectionK=0, sourceElevation=null, T identical to input to 1e-12', () => {
    const n = 4;
    const T_amb = [260.1, 261.2, 262.3, 263.4];
    // sourceElevation deliberately non-null here: the isUserCsv branch must
    // override it regardless of what the raw record carries.
    const raw = hourlyRaw({ sourceElevation: 4120, T_amb }, n);
    const opts: NormaliseOptions = {
      site: LEH_SITE,
      targetStepSeconds: 3600,
      source: 'user-csv',
      label: 'csv upload',
    };
    const series = normaliseWeather(raw, opts);
    console.log(
      `TEST2 lapseCorrectionK=${series.provenance.lapseCorrectionK} sourceElevation=${series.provenance.sourceElevation}`,
    );
    expect(series.provenance.lapseCorrectionK).toBe(0);
    expect(series.provenance.sourceElevation).toBeNull();
    for (let i = 0; i < n; i++) {
      expect(Math.abs(series.T_amb[i]! - T_amb[i]!)).toBeLessThan(1e-12);
    }
  });
});

describe('T-25 acceptance test 3 -- energy-conserving resample preserves integral(GHI dt)', () => {
  it('conserving resample preserves the integral to <0.1%; plain linear resample changes it by more than 0.1%', () => {
    const srcStep = 3600;
    const dstStep = 300;
    const n = 24;
    // resampleLinear's total-integral error vs the rectangle/conserving total
    // works out to exactly dstStep-independent `srcStep * (values[0] -
    // values[n-1]) / 2` (the interior trapezoid terms all carry full weight,
    // same as the rectangle rule -- only the two domain EDGES differ, one
    // half-weighted by trapezoidal integration, the other extrapolated flat
    // by resampleLinear's clamp). So the profile must have values[0] !=
    // values[n-1] to expose any difference at all -- a symmetric day (GHI=0
    // at both midnight endpoints) would trivially show 0% for both, which is
    // not itself a bug but proves nothing. Asymmetric edges here (nonzero at
    // hour 0, zero at hour 23) exercise the failure mode acceptance test 3
    // exists to catch.
    const values = Array.from({ length: n }, (_, h) => (h < 12 ? 800 : 0));
    const outputCount = Math.round((n * srcStep) / dstStep);

    const conserved = resampleConserving(values, srcStep, dstStep, outputCount);
    const linear = resampleLinear(values, srcStep, dstStep, outputCount);

    const srcIntegral = values.reduce((s, v) => s + v, 0) * srcStep;
    let conservedSum = 0;
    for (let i = 0; i < conserved.length; i++) conservedSum += conserved[i]!;
    let linearSum = 0;
    for (let i = 0; i < linear.length; i++) linearSum += linear[i]!;
    const conservedIntegral = conservedSum * dstStep;
    const linearIntegral = linearSum * dstStep;

    const conservedDeviation = Math.abs(conservedIntegral - srcIntegral) / srcIntegral;
    const linearDeviation = Math.abs(linearIntegral - srcIntegral) / srcIntegral;

    console.log(
      `TEST3 srcIntegral=${srcIntegral} conservedIntegral=${conservedIntegral} conservedDeviation=${(conservedDeviation * 100).toFixed(6)}% ` +
        `linearIntegral=${linearIntegral} linearDeviation=${(linearDeviation * 100).toFixed(4)}%`,
    );

    expect(conservedDeviation).toBeLessThan(0.001);
    expect(linearDeviation).toBeGreaterThan(0.001);
  });
});

describe('T-25 acceptance test 4 -- gap-fill note threshold', () => {
  it('a 2h gap is interpolated with no note; a 5h gap is interpolated and produces a note naming it', () => {
    const stepSeconds = 3600;

    const notes2h: string[] = [];
    const twoHourGap = [10, 11, NaN, NaN, 14, 15];
    const filled2h = gapFill(twoHourGap, stepSeconds, 'T_amb', notes2h);
    console.log(`TEST4 2h gap filled=${JSON.stringify(filled2h)} notes=${JSON.stringify(notes2h)}`);
    expect(notes2h.length).toBe(0);
    expect(filled2h.every((v) => !Number.isNaN(v))).toBe(true);

    const notes5h: string[] = [];
    const fiveHourGap = [10, NaN, NaN, NaN, NaN, NaN, 16];
    const filled5h = gapFill(fiveHourGap, stepSeconds, 'T_amb', notes5h);
    console.log(`TEST4 5h gap filled=${JSON.stringify(filled5h)} notes=${JSON.stringify(notes5h)}`);
    expect(notes5h.length).toBe(1);
    expect(notes5h[0]).toContain('T_amb');
    expect(notes5h[0]).toContain('5h');
    expect(filled5h.every((v) => !Number.isNaN(v))).toBe(true);
  });
});

describe('T-25 acceptance test 5 -- Erbs closure identity when DNI/DHI are derived', () => {
  it('DNI*cos(zenith) + DHI = GHI to 1e-9 at every hour with zenith < 87 deg', () => {
    const n = 24;
    const dayOfYear = 15;
    // A physically self-consistent clear-sky profile (GHI = kt * I0n * cosZenith,
    // constant kt=0.75) so decompose()'s own documented DNI cap -- "no
    // atmosphere can amplify sunlight" (solar/decomposition.ts) -- never
    // triggers. An arbitrary sine-shaped GHI can demand a kt that pushes the
    // implied DNI past the extraterrestrial value near sunrise/sunset, which
    // legitimately clips DNI and breaks the closure identity for THAT input
    // -- that is decompose()'s own correct behaviour on implausible data, not
    // a pipeline defect, so the test fixture must stay physically plausible.
    const GHI = Array.from({ length: n }, (_, h) => {
      const sun = sunPosition(
        LEH_SITE.latitude,
        LEH_SITE.longitude,
        LEH_SITE.standardMeridian,
        dayOfYear,
        h,
      );
      return sun.cosZenith > 0 ? 0.75 * extraterrestrialNormal(dayOfYear) * sun.cosZenith : 0;
    });
    const raw = hourlyRaw(
      { GHI, T_amb: new Array(n).fill(260), sourceElevation: null, startDayOfYear: dayOfYear },
      n,
    );
    const opts: NormaliseOptions = {
      site: LEH_SITE,
      targetStepSeconds: raw.stepSeconds,
      source: 'synthetic',
      label: 'closure',
    };
    const series = normaliseWeather(raw, opts);

    let maxErr = 0;
    let checked = 0;
    for (let i = 0; i < n; i++) {
      const sun = sunPosition(
        LEH_SITE.latitude,
        LEH_SITE.longitude,
        LEH_SITE.standardMeridian,
        raw.startDayOfYear,
        i,
      );
      if (sun.zenith >= 87) continue;
      checked++;
      const closure = series.DNI![i]! * sun.cosZenith + series.DHI![i]!;
      maxErr = Math.max(maxErr, Math.abs(closure - series.GHI![i]!));
    }
    console.log(`TEST5 checked=${checked} hours, maxClosureErr=${maxErr}`);
    expect(checked).toBeGreaterThan(0);
    expect(maxErr).toBeLessThan(1e-9);
  });
});

describe('T-25 acceptance test 6 -- LW_down: Swinbank fallback vs the measured path', () => {
  it('derives Swinbank when LW_down is absent; passes a measured value through unchanged; the two differ', () => {
    const n = 4;
    const T_amb = [250, 255, 260, 265];
    const rawNoLw = hourlyRaw({ T_amb, sourceElevation: null }, n);
    const measuredLw = [180, 185, 190, 195]; // deliberately offset from the Swinbank estimate
    const rawWithLw = hourlyRaw({ T_amb, LW_down: measuredLw, sourceElevation: null }, n);
    const opts: NormaliseOptions = {
      site: LEH_SITE,
      targetStepSeconds: 3600,
      source: 'synthetic',
      label: 'lw test',
    };

    const seriesNoLw = normaliseWeather(rawNoLw, opts);
    const seriesWithLw = normaliseWeather(rawWithLw, opts);

    const expectedSwinbank = SIGMA * Math.pow(skyTemperature(T_amb[0]!), 4);
    console.log(
      `TEST6 sample pair at i=0: Swinbank-derived=${seriesNoLw.LW_down![0]} (expected ${expectedSwinbank}), ` +
        `measured-path=${seriesWithLw.LW_down![0]} (input ${measuredLw[0]})`,
    );

    expect(seriesNoLw.LW_down![0]).toBeCloseTo(expectedSwinbank, 6);
    expect(seriesWithLw.LW_down![0]).toBeCloseTo(measuredLw[0]!, 6);
    expect(Math.abs(seriesNoLw.LW_down![0]! - seriesWithLw.LW_down![0]!)).toBeGreaterThan(1);
    expect(seriesNoLw.provenance.notes.some((n2) => n2.includes('Swinbank'))).toBe(true);
    expect(seriesWithLw.provenance.notes.some((n2) => n2.includes('Swinbank'))).toBe(false);
  });
});

describe('T-25 acceptance test 7 -- the AUDIT.md night-GHI false positive is a warning, not a crash', () => {
  it('GHI near the sunrise hour does not warn; GHI in the middle of the night does', () => {
    const dayOfYear = 15; // mid-January, short Leh winter day
    let sunriseHour = -1;
    for (let h = 0; h < 24; h++) {
      const alt = sunPosition(
        LEH_SITE.latitude,
        LEH_SITE.longitude,
        LEH_SITE.standardMeridian,
        dayOfYear,
        h,
      ).altitude;
      if (alt > 0) {
        sunriseHour = h;
        break;
      }
    }
    expect(sunriseHour).toBeGreaterThan(0);
    const preSunriseHour = sunriseHour - 1; // still below the horizon, but 1h from daylight

    const GHI1 = new Array(24).fill(0);
    GHI1[preSunriseHour] = 40;
    const warningsPreSunrise = validateWeatherSeries(
      buildSeriesForValidate(GHI1, dayOfYear),
      LEH_SITE,
    );
    console.log(
      `TEST7 sunriseHour=${sunriseHour} preSunriseHour=${preSunriseHour} GHI=40 warnings=${JSON.stringify(warningsPreSunrise)}`,
    );
    expect(warningsPreSunrise.length).toBe(0);

    const GHI2 = new Array(24).fill(0);
    GHI2[2] = 300; // 02:00, deep winter night
    const warningsDeepNight = validateWeatherSeries(
      buildSeriesForValidate(GHI2, dayOfYear),
      LEH_SITE,
    );
    console.log(`TEST7 02:00 GHI=300 warnings=${JSON.stringify(warningsDeepNight)}`);
    expect(warningsDeepNight.length).toBe(1);
    expect(warningsDeepNight[0]).toContain('GHI[2]');
  });
});

describe('T-25 acceptance test 8 -- a NaN throws WEATHER_INVALID naming the field and index', () => {
  it('throws with the field and index in the message', () => {
    const series = buildSeriesForValidate(new Array(6).fill(0), 15);
    series.GHI[3] = NaN;
    let caught: EngineError | undefined;
    try {
      validateWeatherSeries(series);
    } catch (e) {
      caught = e as EngineError;
    }
    console.log(`TEST8 caught code=${caught?.code} message=${caught?.message}`);
    expect(caught).toBeInstanceOf(EngineError);
    expect(caught?.code).toBe('WEATHER_INVALID');
    expect(caught?.message).toContain('GHI[3]');
  });
});

describe('T-25 acceptance test 9 -- implausible temperature throws; plausible does not', () => {
  it('400 K throws WEATHER_INVALID; 250 K does not throw', () => {
    const bad = buildSeriesForValidate(new Array(4).fill(0), 15, 400);
    let caught: EngineError | undefined;
    try {
      validateWeatherSeries(bad);
    } catch (e) {
      caught = e as EngineError;
    }
    console.log(`TEST9 400K caught code=${caught?.code} message=${caught?.message}`);
    expect(caught).toBeInstanceOf(EngineError);
    expect(caught?.code).toBe('WEATHER_INVALID');

    const good = buildSeriesForValidate(new Array(4).fill(0), 15, 250);
    expect(() => validateWeatherSeries(good)).not.toThrow();
  });
});

describe('T-25 acceptance test 10 -- mismatched array lengths throw WEATHER_INVALID', () => {
  it('throws when an optional array length disagrees with T_amb', () => {
    const series = buildSeriesForValidate(new Array(6).fill(0), 15);
    (series as { v_wind: Float64Array }).v_wind = new Float64Array(3);
    let caught: EngineError | undefined;
    try {
      validateWeatherSeries(series);
    } catch (e) {
      caught = e as EngineError;
    }
    console.log(`TEST10 caught code=${caught?.code} message=${caught?.message}`);
    expect(caught).toBeInstanceOf(EngineError);
    expect(caught?.code).toBe('WEATHER_INVALID');
  });
});

describe('T-25 acceptance test 11 -- a bad CSV row reports its row number and column; the rest of the file still loads', () => {
  it('row 47 is reported by row+column; rows before/after and other columns stay untouched', () => {
    const rows: string[] = ['T_amb_C,GHI,v_wind'];
    const N = 50;
    for (let r = 1; r <= N; r++) {
      if (r === 47) rows.push(`5.0,100,NOT_A_NUMBER`);
      else rows.push(`${(5 + r * 0.1).toFixed(2)},${100 + r},2.0`);
    }
    const csvText = rows.join('\n');
    const { raw, rowErrors } = parseWeatherCsv(csvText, { startDayOfYear: 15 });

    console.log(`TEST11 rowErrors=${JSON.stringify(rowErrors)}`);
    expect(rowErrors.length).toBe(1);
    expect(rowErrors[0]!.row).toBe(47);
    expect(rowErrors[0]!.column).toBe('v_wind');

    // row 47 (0-indexed 46): T_amb_C and GHI still parsed correctly, only v_wind is a gap
    expect(raw.T_amb[46]).toBeCloseTo(5.0, 6);
    expect(raw.GHI[46]).toBeCloseTo(100, 6);
    expect(Number.isNaN(raw.v_wind[46])).toBe(true);

    // every other row untouched
    expect(raw.v_wind[0]).toBeCloseTo(2.0, 6);
    expect(raw.v_wind[49]).toBeCloseTo(2.0, 6);
    expect(raw.T_amb.length).toBe(N);
    expect(raw.v_wind.filter((v) => Number.isNaN(v)).length).toBe(1);
  });
});

describe('T-25 acceptance test 12 -- no fetch anywhere in this package', () => {
  it('grep -rn "fetch(" packages/data/src has no matches', () => {
    const testDir = fileURLToPath(new URL('.', import.meta.url)); // .../packages/data/test/
    const packageRoot = fileURLToPath(new URL('..', import.meta.url)); // .../packages/data/
    let out = '';
    try {
      out = execFileSync('grep', ['-rn', 'fetch(', 'src'], { cwd: packageRoot }).toString();
    } catch (err) {
      const e = err as { status?: number; stdout?: Buffer };
      if (e.status === 1) {
        out = ''; // grep exit code 1 = no matches found, which is the pass case
      } else {
        throw err;
      }
    }
    console.log(`TEST12 (ran from ${testDir}/..) grep output: "${out.trim()}"`);
    expect(out.trim()).toBe('');
  });
});

describe('T-25 acceptance test 13 -- normaliseWeather output feeds straight into simulate()', () => {
  it('meta.energyBalanceResidual < 1e-3', () => {
    const n = 24;
    const T_amb_C = Array.from(
      { length: n },
      (_, h) => -8 + 6 * Math.sin(((h - 15) / 24) * 2 * Math.PI),
    );
    const GHI = Array.from({ length: n }, (_, h) =>
      h >= 8 && h <= 16 ? 500 * Math.sin(((h - 8) / 8) * Math.PI) : 0,
    );
    const v_wind = new Array(n).fill(2);
    const raw: RawWeather = {
      stepSeconds: 3600,
      startDayOfYear: 15,
      startHour: 0,
      units: 'C',
      T_amb: T_amb_C,
      GHI,
      v_wind,
      sourceElevation: LEH_SITE.elevation, // same as the site -> zero lapse offset, keeps the fixture simple
    };
    const opts: NormaliseOptions = {
      site: LEH_SITE,
      targetStepSeconds: 300,
      source: 'nasa-power',
      label: 'T-25 acceptance test 13 fixture',
    };
    const weather = normaliseWeather(raw, opts);

    const material = materialById('rammedEarth');
    const glazing = glazingById('singleGlazing');
    const side = 4;
    const area = side * side;
    const construction: Layer[] = [{ materialId: material.id, thickness: 0.3 }];
    const opaque = (id: string, type: Surface['type'], tilt: number, azimuth: number): Surface => ({
      id,
      type,
      area,
      tilt,
      azimuth,
      construction,
      boundary: 'exterior',
      exteriorAbsorptivity: 0.7,
      exteriorEmissivity: 0.9,
      interiorEmissivity: 0.9,
    });
    const site: Site = {
      id: 'leh-t25',
      name: 'T-25 fixture',
      latitude: LEH_SITE.latitude,
      longitude: LEH_SITE.longitude,
      elevation: LEH_SITE.elevation,
      standardMeridian: LEH_SITE.standardMeridian,
      groundAlbedo: 0.3,
      groundTempMeanAnnual: toK(6),
    };
    const request: SimulationRequest = {
      site,
      building: {
        floorArea: area,
        volume: area * side,
        azimuth: 0,
        surfaces: [
          opaque('south', 'wall', 90, 0),
          opaque('east', 'wall', 90, -90),
          opaque('west', 'wall', 90, 90),
          opaque('north', 'wall', 90, 180),
          opaque('roof', 'roof', 0, 0),
          opaque('floor', 'floor', 180, 0),
        ],
        windows: [{ id: 'southWindow', hostSurfaceId: 'south', area: 1.5, glazingId: glazing.id }],
        thermalBridgeFactor: 1.1,
      },
      operation: {
        internalGainsSchedule: new Array(24).fill(150),
        achSchedule: new Array(24).fill(0.5),
        auxHeating: { enabled: false, setpoint: toK(18), maxPower: 0 },
        comfortBand: { lower: toK(15), upper: toK(24) },
      },
      weather,
      materials: { [material.id]: material },
      glazings: { [glazing.id]: glazing },
      options: {
        timestepSeconds: 300,
        meshTargetDx: 0.02,
        simulationDays: 1,
        spinUpToleranceK: 0.02,
        maxSpinUpDays: 30,
        skyModel: 'isotropic',
        integrationTheta: 1,
        keepSurfaceProfiles: false,
        allowUnsafeVentilation: false,
      },
    };

    const result = simulate(request);
    console.log(`TEST13 energyBalanceResidual=${result.meta.energyBalanceResidual}`);
    expect(result.meta.energyBalanceResidual).toBeLessThan(1e-3);
  });
});
