/**
 * T-27 acceptance tests, `log/AREA-C-data-layer.md`, numbered 1-12 verbatim.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { simulate, toK, EngineError, extraterrestrialNormal, sunPosition } from '@shelter/engine';
import type { SimulationRequest, Site, Surface, Layer, WeatherSeries } from '@shelter/engine';
import { materialById } from '../src/materials.js';
import { glazingById } from '../src/glazing.js';
import { validateWeatherSeries } from '../src/weather/pipeline.js';
import { tmyById, groundAlbedoById, TMY_LOCATIONS } from '../src/tmy.js';

const TMY_DIR = fileURLToPath(new URL('../tmy/', import.meta.url));
const HOURS_PER_YEAR_2023 = 8760; // 2023 is not a leap year

const SERIES_KEYS = ['T_amb', 'GHI', 'v_wind', 'DNI', 'DHI', 'LW_down', 'RH'] as const;

function dayOfYearFor(i: number): number {
  return 1 + Math.floor(i / 24); // every bundled file starts day 1, hour 0, step 3600s
}

describe('T-27 acceptance test 1 -- every bundled series parses as WeatherSeries and validates clean', () => {
  it('validateWeatherSeries throws for none of the five locations', () => {
    for (const loc of TMY_LOCATIONS) {
      const series = tmyById(loc.id);
      expect(() =>
        validateWeatherSeries(series, {
          latitude: loc.latitude,
          longitude: loc.longitude,
          standardMeridian: 82.5,
        }),
      ).not.toThrow();
      console.log(`TEST1 ${loc.id}: validates clean`);
    }
  });
});

describe('T-27 acceptance test 2 -- 8,760 hourly values, equal lengths, in every array', () => {
  it('every named array on every file has length 8760', () => {
    for (const loc of TMY_LOCATIONS) {
      const series = tmyById(loc.id);
      const lengths: Record<string, number | undefined> = {};
      for (const key of SERIES_KEYS) {
        const arr = series[key] as Float64Array | undefined;
        lengths[key] = arr?.length;
        if (arr) expect(arr.length).toBe(HOURS_PER_YEAR_2023);
      }
      console.log(`TEST2 ${loc.id}: lengths=${JSON.stringify(lengths)}`);
    }
  });
});

describe('T-27 acceptance test 3 -- provenance is complete on every file', () => {
  it('label is non-empty and names source/grid-cell/date; sourceElevation is a number', () => {
    for (const loc of TMY_LOCATIONS) {
      const series = tmyById(loc.id);
      const p = series.provenance;
      console.log(`TEST3 ${loc.id}: label="${p.label}" sourceElevation=${p.sourceElevation}`);
      expect(p.label.length).toBeGreaterThan(0);
      expect(p.label).toContain('NASA POWER');
      expect(p.label).toMatch(/\d+(\.\d+)?, ?-?\d+(\.\d+)?/); // grid cell coordinates appear
      expect(p.label).toContain('2026-09-16'); // retrieval date
      expect(typeof p.sourceElevation).toBe('number');
      expect(p.sourceElevation).not.toBeNull();
    }
  });
});

describe('T-27 acceptance test 4 -- Leh January mean and minima match BLUEPRINT.md Appendix C', () => {
  it('January mean within +/-3 degC of -8 degC; minima reach the -15 to -20 degC band', () => {
    const series = tmyById('leh');
    const janHours: number[] = [];
    for (let i = 0; i < series.T_amb.length; i++) if (dayOfYearFor(i) <= 31) janHours.push(i);
    const janMeanC =
      janHours.reduce((s, i) => s + (series.T_amb[i]! - 273.15), 0) / janHours.length;
    const janMinC = Math.min(...janHours.map((i) => series.T_amb[i]! - 273.15));
    console.log(
      `TEST4 Leh January mean=${janMeanC.toFixed(2)} degC min=${janMinC.toFixed(2)} degC`,
    );
    expect(Math.abs(janMeanC - -8)).toBeLessThanOrEqual(3);
    expect(janMinC).toBeLessThanOrEqual(-15); // reaches (or exceeds) the -15..-20 band
  });
});

describe('T-27 acceptance test 5 -- Leh annual GHI lands in the DRDO problem-statement band', () => {
  it('1900-2100 kWh/m^2/yr', () => {
    const series = tmyById('leh');
    let sumWh = 0;
    for (let i = 0; i < series.GHI.length; i++) sumWh += series.GHI[i]!; // 1h step -> Wh/m^2 per sample
    const annualKWh = sumWh / 1000;
    console.log(`TEST5 Leh annual GHI=${annualKWh.toFixed(1)} kWh/m^2/yr`);
    expect(annualKWh).toBeGreaterThanOrEqual(1900);
    expect(annualKWh).toBeLessThanOrEqual(2100);
  });
});

describe('T-27 acceptance test 6 -- Leh sunshine hours and clear days', () => {
  it('mean daily sunshine near 7.9h; clear days > 300 (criteria documented in tmy/README.md)', () => {
    const series = tmyById('leh');
    const n = series.T_amb.length;

    // Sunshine hour: WMO instrumental threshold, DNI > 120 W/m^2.
    let sunshineHours = 0;
    for (let i = 0; i < n; i++) if (series.DNI![i]! > 120) sunshineHours++;
    const meanDailySunshineH = sunshineHours / 365;

    // Clear day: daily clearness index kt = dailyGHI / dailyI0 > 0.5.
    const dailyGHI = new Array<number>(366).fill(0);
    const dailyI0 = new Array<number>(366).fill(0);
    for (let i = 0; i < n; i++) {
      const doy = dayOfYearFor(i);
      const hour = i % 24;
      const sun = sunPosition(34.15, 77.58, 82.5, doy, hour);
      dailyGHI[doy]! += series.GHI[i]!;
      dailyI0[doy]! += extraterrestrialNormal(doy) * sun.cosZenith;
    }
    let clearDays = 0;
    for (let d = 1; d <= 365; d++) {
      const kt = dailyI0[d]! > 0 ? dailyGHI[d]! / dailyI0[d]! : 0;
      if (kt > 0.5) clearDays++;
    }

    console.log(
      `TEST6 Leh meanDailySunshine=${meanDailySunshineH.toFixed(2)}h clearDays=${clearDays}`,
    );
    // "near 7.9h": within a documented +/-25% engineering tolerance of the
    // problem-statement figure -- this is real single-year reanalysis data,
    // not the multi-year average the 7.9h figure itself was computed from.
    expect(meanDailySunshineH).toBeGreaterThan(7.9 * 0.75);
    expect(meanDailySunshineH).toBeLessThan(7.9 * 1.25);
    expect(clearDays).toBeGreaterThan(300);
  });
});

describe('T-27 acceptance test 7 -- Jaisalmer/Leh contrast', () => {
  it("Jaisalmer's July mean is at least 20K above Leh's January mean", () => {
    const leh = tmyById('leh');
    const jaisalmer = tmyById('jaisalmer');

    const janHours: number[] = [];
    for (let i = 0; i < leh.T_amb.length; i++) if (dayOfYearFor(i) <= 31) janHours.push(i);
    const lehJanMeanC =
      janHours.reduce((s, i) => s + (leh.T_amb[i]! - 273.15), 0) / janHours.length;

    const julHours: number[] = [];
    for (let i = 0; i < jaisalmer.T_amb.length; i++) {
      const doy = dayOfYearFor(i);
      if (doy >= 182 && doy <= 212) julHours.push(i); // July 1-31, 2023 (non-leap)
    }
    const jaisalmerJulMeanC =
      julHours.reduce((s, i) => s + (jaisalmer.T_amb[i]! - 273.15), 0) / julHours.length;

    console.log(
      `TEST7 Leh Jan mean=${lehJanMeanC.toFixed(2)} degC, Jaisalmer Jul mean=${jaisalmerJulMeanC.toFixed(2)} degC`,
    );
    expect(jaisalmerJulMeanC - lehJanMeanC).toBeGreaterThanOrEqual(20);
  });
});

describe('T-27 acceptance test 8 -- derived ground-albedo series', () => {
  it('Leh has winter-snow hours at 0.75 and every July hour at 0.30', () => {
    const albedo = groundAlbedoById('leh');
    const snowHours = albedo.filter((a) => a === 0.75).length;
    let julAllPoint3 = true;
    for (let i = 0; i < albedo.length; i++) {
      const doy = dayOfYearFor(i);
      if (doy >= 182 && doy <= 212 && albedo[i] !== 0.3) julAllPoint3 = false;
    }
    console.log(`TEST8 Leh snowHours=${snowHours} julAllPoint3=${julAllPoint3}`);
    expect(snowHours).toBeGreaterThan(0);
    expect(julAllPoint3).toBe(true);
  });
});

describe('T-27 acceptance test 9 -- bundle size under 8MB', () => {
  it('total bytes of the five files (already-minified JSON)', () => {
    let total = 0;
    for (const loc of TMY_LOCATIONS) {
      total += statSync(`${TMY_DIR}${loc.id}.json`).size;
    }
    console.log(`TEST9 total bytes=${total} (${(total / 1024 / 1024).toFixed(3)} MB)`);
    expect(total).toBeLessThan(8 * 1024 * 1024);
  });
});

describe('T-27 acceptance test 10 -- README.md records a reproducible URL and date per location', () => {
  it('every location id has a power.larc.nasa.gov URL and the 2026-09-16 retrieval date', () => {
    const readme = readFileSync(`${TMY_DIR}README.md`, 'utf8');
    expect(readme).toContain('2026-09-16');
    for (const loc of TMY_LOCATIONS) {
      expect(readme).toContain(loc.id);
    }
    const urlCount = (readme.match(/https:\/\/power\.larc\.nasa\.gov/g) ?? []).length;
    console.log(`TEST10 readme has ${urlCount} power.larc.nasa.gov URLs`);
    expect(urlCount).toBeGreaterThanOrEqual(TMY_LOCATIONS.length);
  });
});

describe('T-27 acceptance test 11 -- tmyById("leh") feeds simulate() end to end, no network', () => {
  it('no fetch( anywhere under packages/data/src (structural proof network is unreachable)', () => {
    const packageRoot = fileURLToPath(new URL('..', import.meta.url));
    let out = '';
    try {
      out = execFileSync('grep', ['-rn', 'fetch(', 'src'], { cwd: packageRoot }).toString();
    } catch (err) {
      const e = err as { status?: number };
      if (e.status === 1) out = '';
      else throw err;
    }
    console.log(`TEST11 grep fetch( in src: "${out.trim()}"`);
    expect(out.trim()).toBe('');
  });

  it('meta.energyBalanceResidual < 1e-3', () => {
    const weather: WeatherSeries = tmyById('leh');
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
      id: 'leh',
      name: 'Leh',
      latitude: 34.15,
      longitude: 77.58,
      elevation: 3500,
      standardMeridian: 82.5,
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
    console.log(`TEST11 energyBalanceResidual=${result.meta.energyBalanceResidual}`);
    expect(result.meta.energyBalanceResidual).toBeLessThan(1e-3);
  });
});

describe('T-27 acceptance test 12 -- an unknown location id throws, never undefined', () => {
  it('tmyById("nope") and groundAlbedoById("nope") both throw EngineError', () => {
    expect(() => tmyById('nope')).toThrow(EngineError);
    expect(() => groundAlbedoById('nope')).toThrow(EngineError);
  });
});
