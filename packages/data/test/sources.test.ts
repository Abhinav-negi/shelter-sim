/**
 * T-26 acceptance tests, `log/AREA-C-data-layer.md`, numbered 1-12 verbatim.
 *
 * Fixtures under `./fixtures/` are REAL, unmodified upstream API responses
 * (global rule 9 -- no synthetic/fabricated JSON), captured 2026-09-16 at
 * Leh's coordinates (34.15 N, 77.58 E):
 *
 * - `fixtures/nasa-power-leh-clean.json` -- NASA POWER hourly, 2023-06-01 to
 *   2023-06-02, all 8 parameters, no gaps. Query:
 *   https://power.larc.nasa.gov/api/temporal/hourly/point?parameters=T2M,ALLSKY_SFC_SW_DWN,ALLSKY_SFC_SW_DNI,ALLSKY_SFC_SW_DIFF,ALLSKY_SFC_LW_DWN,WS2M,RH2M,PS&community=RE&longitude=77.58&latitude=34.15&start=20230601&end=20230602&format=JSON
 * - `fixtures/nasa-power-leh-gaps.json` -- NASA POWER hourly, 2026-09-11 to
 *   2026-09-13 (near-real-time range), same query shape with those dates --
 *   the four solar-radiation parameters come back as the real -999 fill
 *   value for all 72 hours (genuine satellite-processing lag), T2M/WS2M/
 *   RH2M/PS are real non-gap values.
 * - `fixtures/open-meteo-leh.json` -- Open-Meteo archive (ERA5), same range
 *   and coordinates as the clean NASA fixture. Query:
 *   https://archive-api.open-meteo.com/v1/archive?latitude=34.15&longitude=77.58&start_date=2023-06-01&end_date=2023-06-02&hourly=temperature_2m,relativehumidity_2m,windspeed_10m,shortwave_radiation,direct_radiation,diffuse_radiation,direct_normal_irradiance
 *   (no downward-longwave variable available in Open-Meteo's archive set --
 *   `parseOpenMeteo` legitimately omits `LW_down`.)
 */
import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';
import { simulate, toK, EngineError } from '@shelter/engine';
import type { SimulationRequest, Site, Surface, Layer } from '@shelter/engine';
import { materialById } from '../src/materials.js';
import { glazingById } from '../src/glazing.js';
import { normaliseWeather, type NormaliseOptions } from '../src/weather/pipeline.js';
import { nasaPowerUrl, parseNasaPower, openMeteoUrl, parseOpenMeteo, type WeatherQuery } from '../src/weather/sources.js';

const LEH_SITE = { latitude: 34.15, longitude: 77.58, elevation: 3500, standardMeridian: 82.5 };

function loadFixture(name: string): unknown {
  return JSON.parse(readFileSync(new URL(`./fixtures/${name}`, import.meta.url), 'utf-8'));
}

/** Inclusive day-count * 24, matching the pipeline's own UTC-day arithmetic. */
function expectedHourCount(q: WeatherQuery): number {
  const [sy, sm, sd] = q.startDate.split('-').map(Number) as [number, number, number];
  const [ey, em, ed] = q.endDate.split('-').map(Number) as [number, number, number];
  const start = Date.UTC(sy, sm - 1, sd);
  const end = Date.UTC(ey, em - 1, ed);
  const days = Math.round((end - start) / 86_400_000) + 1;
  return days * 24;
}

const NASA_CLEAN_QUERY: WeatherQuery = { latitude: 34.15, longitude: 77.58, startDate: '2023-06-01', endDate: '2023-06-02' };
const NASA_GAPS_QUERY: WeatherQuery = { latitude: 34.15, longitude: 77.58, startDate: '2026-09-11', endDate: '2026-09-13' };
const OPEN_METEO_QUERY: WeatherQuery = { latitude: 34.15, longitude: 77.58, startDate: '2023-06-01', endDate: '2023-06-02' };

describe('T-26 acceptance test 1 -- nasaPowerUrl contains all 8 parameters, coordinates, temporal/hourly', () => {
  it('builds the expected public URL', () => {
    const url = nasaPowerUrl(NASA_CLEAN_QUERY);
    console.log(`TEST1 url=${url}`);
    for (const p of ['T2M', 'ALLSKY_SFC_SW_DWN', 'ALLSKY_SFC_SW_DNI', 'ALLSKY_SFC_SW_DIFF', 'ALLSKY_SFC_LW_DWN', 'WS2M', 'RH2M', 'PS']) {
      expect(url).toContain(p);
    }
    expect(url).toContain('34.15');
    expect(url).toContain('77.58');
    expect(url).toContain('temporal/hourly');
  });
});

describe('T-26 acceptance test 2 -- openMeteoUrl contains coordinates and the hourly variable list', () => {
  it('builds the expected public URL', () => {
    const url = openMeteoUrl(OPEN_METEO_QUERY);
    console.log(`TEST2 url=${url}`);
    expect(url).toContain('34.15');
    expect(url).toContain('77.58');
    for (const v of ['temperature_2m', 'windspeed_10m', 'shortwave_radiation', 'direct_normal_irradiance', 'diffuse_radiation']) {
      expect(url).toContain(v);
    }
  });
});

describe('T-26 acceptance test 3 -- an injected baseUrl overrides the public endpoint', () => {
  it('nasaPowerUrl honours baseUrl', () => {
    const url = nasaPowerUrl(NASA_CLEAN_QUERY, 'http://localhost:9999/mock-nasa');
    expect(url.startsWith('http://localhost:9999/mock-nasa')).toBe(true);
    expect(url).not.toContain('power.larc.nasa.gov');
  });
  it('openMeteoUrl honours baseUrl', () => {
    const url = openMeteoUrl(OPEN_METEO_QUERY, 'http://localhost:9999/mock-open-meteo');
    expect(url.startsWith('http://localhost:9999/mock-open-meteo')).toBe(true);
    expect(url).not.toContain('archive-api.open-meteo.com');
  });
});

describe('T-26 acceptance test 4 -- parseNasaPower array length matches the requested hour count', () => {
  it('48 hours for a 2-day range', () => {
    const raw = parseNasaPower(loadFixture('nasa-power-leh-clean.json'), NASA_CLEAN_QUERY);
    const expected = expectedHourCount(NASA_CLEAN_QUERY);
    console.log(`TEST4 length=${raw.T_amb.length} expected=${expected}`);
    expect(raw.T_amb.length).toBe(expected);
    for (const arr of [raw.GHI, raw.v_wind, raw.DNI, raw.DHI, raw.LW_down, raw.RH]) {
      expect(arr?.length).toBe(expected);
    }
  });
});

describe('T-26 acceptance test 5 -- a -999 fill value becomes a gap marker, never a literal temperature', () => {
  it('SW/LW fields become NaN; T_amb stays real and plausible after C->K conversion', () => {
    const raw = parseNasaPower(loadFixture('nasa-power-leh-gaps.json'), NASA_GAPS_QUERY);
    // The fixture's four solar-radiation channels are real -999 fill values
    // for all 72 hours -- confirm every one became NaN, not -999.
    for (const arr of [raw.GHI, raw.DNI!, raw.DHI!, raw.LW_down!]) {
      expect(arr.every((v) => Number.isNaN(v))).toBe(true);
      expect(arr.some((v) => v === -999)).toBe(false);
    }
    // T2M itself carries no fill values in this fixture; converting it to
    // Kelvin must never produce anything near a corrupted -999 sentinel.
    const T_amb_K = raw.T_amb.map((c) => c + 273.15);
    const minK = Math.min(...T_amb_K);
    console.log(`TEST5 minTemperatureK=${minK}`);
    expect(T_amb_K.every((k) => k >= 180)).toBe(true);
  });
});

describe('T-26 acceptance test 6 -- parseNasaPower extracts the source grid-cell elevation', () => {
  it('sourceElevation = 4532.61 m at (77.58, 34.15)', () => {
    const raw = parseNasaPower(loadFixture('nasa-power-leh-clean.json'), NASA_CLEAN_QUERY);
    console.log(`TEST6 sourceElevation=${raw.sourceElevation} gridCell=(77.58, 34.15)`);
    expect(raw.sourceElevation).toBe(4532.61);
  });
});

describe('T-26 acceptance test 7 -- parseOpenMeteo matches length and cross-source day-mean sanity', () => {
  it('48 hours, agrees with NASA POWER within 5 K on mean temperature once both are lapse-corrected to the same site', () => {
    const nasaRaw = parseNasaPower(loadFixture('nasa-power-leh-clean.json'), NASA_CLEAN_QUERY);
    const omRaw = parseOpenMeteo(loadFixture('open-meteo-leh.json'), OPEN_METEO_QUERY);
    const expected = expectedHourCount(OPEN_METEO_QUERY);
    expect(omRaw.T_amb.length).toBe(expected);
    expect(omRaw.T_amb.length).toBe(nasaRaw.T_amb.length);

    // Raw, uncorrected T2M/temperature_2m are NOT expected to agree: NASA
    // POWER's native grid cell here sits at 4532.61 m and Open-Meteo's at
    // 3411 m, a real ~1,100 m difference between two different reanalyses'
    // native resolutions (see the fixture header comment above) -- at the
    // ~6.5 K/km lapse rate that alone is a ~7 K raw gap, which is exactly
    // why T-25's normaliseWeather() applies a per-source lapse correction
    // before anything is compared or fed to the engine. This test runs both
    // fixtures through that same correction (to LEH_SITE's 3500 m) and only
    // then compares -- checking for a unit/offset BLUNDER, not raw agreement.
    const nasaSeries = normaliseWeather(nasaRaw, {
      site: LEH_SITE,
      targetStepSeconds: 3600,
      source: 'nasa-power',
      label: 'T-26 test 7 NASA fixture',
    });
    const omSeries = normaliseWeather(omRaw, {
      site: LEH_SITE,
      targetStepSeconds: 3600,
      source: 'open-meteo',
      label: 'T-26 test 7 Open-Meteo fixture',
    });

    const mean = (xs: Float64Array): number => xs.reduce((a, b) => a + b, 0) / xs.length;
    const nasaMeanK = mean(nasaSeries.T_amb);
    const omMeanK = mean(omSeries.T_amb);
    const diff = Math.abs(nasaMeanK - omMeanK);
    console.log(`TEST7 nasaMeanK=${nasaMeanK} openMeteoMeanK=${omMeanK} diffK=${diff}`);
    expect(diff).toBeLessThan(5);
  });
});

describe('T-26 acceptance test 8 -- both parsers throw EngineError(WEATHER_INVALID) naming a field on {}', () => {
  it('parseNasaPower', () => {
    try {
      parseNasaPower({}, NASA_CLEAN_QUERY);
      expect.unreachable('should have thrown');
    } catch (e) {
      expect(e).toBeInstanceOf(EngineError);
      expect((e as EngineError).code).toBe('WEATHER_INVALID');
      console.log(`TEST8 nasaMessage="${(e as EngineError).message}"`);
      expect((e as EngineError).message).toMatch(/parameter/);
    }
  });
  it('parseOpenMeteo', () => {
    try {
      parseOpenMeteo({}, OPEN_METEO_QUERY);
      expect.unreachable('should have thrown');
    } catch (e) {
      expect(e).toBeInstanceOf(EngineError);
      expect((e as EngineError).code).toBe('WEATHER_INVALID');
      console.log(`TEST8 openMeteoMessage="${(e as EngineError).message}"`);
      expect((e as EngineError).message).toMatch(/hourly/);
    }
  });
});

describe('T-26 acceptance test 9 -- both parsers throw on mismatched array lengths', () => {
  it('parseNasaPower', () => {
    const bad = JSON.parse(JSON.stringify(loadFixture('nasa-power-leh-clean.json'))) as any;
    delete bad.properties.parameter.WS2M['2023060100'];
    expect(() => parseNasaPower(bad, NASA_CLEAN_QUERY)).toThrow(EngineError);
    try {
      parseNasaPower(bad, NASA_CLEAN_QUERY);
    } catch (e) {
      expect((e as EngineError).code).toBe('WEATHER_INVALID');
      console.log(`TEST9 nasaMessage="${(e as EngineError).message}"`);
    }
  });
  it('parseOpenMeteo', () => {
    const bad = JSON.parse(JSON.stringify(loadFixture('open-meteo-leh.json'))) as any;
    bad.hourly.windspeed_10m.pop();
    expect(() => parseOpenMeteo(bad, OPEN_METEO_QUERY)).toThrow(EngineError);
    try {
      parseOpenMeteo(bad, OPEN_METEO_QUERY);
    } catch (e) {
      expect((e as EngineError).code).toBe('WEATHER_INVALID');
      console.log(`TEST9 openMeteoMessage="${(e as EngineError).message}"`);
    }
  });
});

describe('T-26 acceptance test 10 -- no fetch/XMLHttpRequest/axios in packages/data/src', () => {
  it('grep finds no matches', () => {
    const dataDir = fileURLToPath(new URL('../src', import.meta.url));
    let out = '';
    try {
      out = execFileSync('grep', ['-rn', 'fetch(\\|XMLHttpRequest\\|axios', dataDir], { encoding: 'utf-8' });
    } catch (err) {
      const e = err as { status?: number };
      if (e.status !== 1) throw err; // grep exit code 1 = no matches found, the PASS case
      out = '';
    }
    console.log(`TEST10 matches="${out.trim()}"`);
    expect(out.trim()).toBe('');
  });
});

describe('T-26 acceptance test 11 -- no api_key/apiKey/Bearer in packages/data/src', () => {
  it('grep finds no matches', () => {
    const dataDir = fileURLToPath(new URL('../src', import.meta.url));
    let out = '';
    try {
      out = execFileSync('grep', ['-rn', 'api_key\\|apiKey\\|Bearer', dataDir], { encoding: 'utf-8' });
    } catch (err) {
      const e = err as { status?: number };
      if (e.status !== 1) throw err;
      out = '';
    }
    console.log(`TEST11 matches="${out.trim()}"`);
    expect(out.trim()).toBe('');
  });
});

describe('T-26 acceptance test 12 -- either parser feeds normaliseWeather -> simulate() cleanly', () => {
  function buildRequest(weather: ReturnType<typeof normaliseWeather>): SimulationRequest {
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
      id: 'leh-t26',
      name: 'T-26 fixture',
      latitude: LEH_SITE.latitude,
      longitude: LEH_SITE.longitude,
      elevation: LEH_SITE.elevation,
      standardMeridian: LEH_SITE.standardMeridian,
      groundAlbedo: 0.3,
      groundTempMeanAnnual: toK(6),
    };
    return {
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
  }

  it('parseNasaPower output', () => {
    const raw = parseNasaPower(loadFixture('nasa-power-leh-clean.json'), NASA_CLEAN_QUERY);
    const opts: NormaliseOptions = { site: LEH_SITE, targetStepSeconds: 300, source: 'nasa-power', label: 'T-26 test 12 NASA fixture' };
    const weather = normaliseWeather(raw, opts);
    const result = simulate(buildRequest(weather));
    console.log(`TEST12 nasaResidual=${result.meta.energyBalanceResidual}`);
    expect(result.meta.energyBalanceResidual).toBeLessThan(1e-3);
  });

  it('parseOpenMeteo output', () => {
    const raw = parseOpenMeteo(loadFixture('open-meteo-leh.json'), OPEN_METEO_QUERY);
    const opts: NormaliseOptions = { site: LEH_SITE, targetStepSeconds: 300, source: 'open-meteo', label: 'T-26 test 12 Open-Meteo fixture' };
    const weather = normaliseWeather(raw, opts);
    const result = simulate(buildRequest(weather));
    console.log(`TEST12 openMeteoResidual=${result.meta.energyBalanceResidual}`);
    expect(result.meta.energyBalanceResidual).toBeLessThan(1e-3);
  });
});
