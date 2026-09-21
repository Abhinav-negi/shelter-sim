/**
 * Bundled TMY loader. T-27 (`LOG.md`, Area C).
 *
 * The five files under `packages/data/tmy/*.json` are real NASA POWER
 * hourly responses for calendar year 2023 (`parseNasaPower`, T-26) run
 * through `normaliseWeather` (T-25) -- see `tmy/README.md` for the exact
 * URL, grid cell and retrieval date behind every file. Nothing here fetches
 * anything: the files are read from disk, synchronously, once, and the
 * package's zero-network invariant (T-25's own header comment, D-10) holds
 * for this module too -- see acceptance test 11 in `test/tmy.test.ts`,
 * which proves a `tmyById()` -> `simulate()` round trip needs no network.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { EngineError, seriesFromJson } from '@shelter/engine';
import type { WeatherSeries } from '@shelter/engine';

// One level up from `src/` (or from `dist/`, after build -- both sit
// directly under `packages/data/`) to the sibling `tmy/` directory.
const TMY_DIR = fileURLToPath(new URL('../tmy/', import.meta.url));

export interface TmyLocation {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  /** m above sea level -- the real site elevation the lapse-rate correction targets. */
  elevation: number;
}

/**
 * Real, approximate town elevations (see the task brief's Evidence note for
 * sourcing caveats). Distinct from each file's `provenance.sourceElevation`,
 * which is the NASA POWER grid cell's own elevation.
 */
export const TMY_LOCATIONS: readonly TmyLocation[] = [
  { id: 'leh', name: 'Leh', latitude: 34.15, longitude: 77.58, elevation: 3500 },
  { id: 'kargil', name: 'Kargil', latitude: 34.5539, longitude: 76.1349, elevation: 2676 },
  { id: 'drass', name: 'Drass', latitude: 34.4239, longitude: 75.7666, elevation: 3230 },
  {
    id: 'nubra',
    name: 'Nubra Valley (Diskit)',
    latitude: 34.5443,
    longitude: 77.5584,
    elevation: 3144,
  },
  { id: 'jaisalmer', name: 'Jaisalmer', latitude: 26.9157, longitude: 70.9083, elevation: 225 },
] as const;

interface TmyFileShape {
  stepSeconds: number;
  startDayOfYear: number;
  startHour: number;
  T_amb: number[];
  GHI: number[];
  v_wind: number[];
  DNI?: number[];
  DHI?: number[];
  LW_down?: number[];
  RH?: number[];
  provenance: WeatherSeries['provenance'];
  /** Not part of WeatherSeries (LOG.md 7.6 has no snowCover field) -- see groundAlbedoById(). */
  groundAlbedo: number[];
}

const fileCache = new Map<string, TmyFileShape>();

function readTmyFile(id: string): TmyFileShape {
  const known = TMY_LOCATIONS.some((loc) => loc.id === id);
  if (!known) {
    throw new EngineError('INVALID_INPUT', `No bundled TMY for location id "${id}".`, { id });
  }
  const cached = fileCache.get(id);
  if (cached) return cached;
  let text: string;
  try {
    text = readFileSync(`${TMY_DIR}${id}.json`, 'utf8');
  } catch (err) {
    throw new EngineError(
      'INVALID_INPUT',
      `Bundled TMY file for "${id}" could not be read: ${(err as Error).message}`,
      { id },
    );
  }
  const parsed = JSON.parse(text) as TmyFileShape;
  fileCache.set(id, parsed);
  return parsed;
}

/** Deserialises `packages/data/tmy/<id>.json` into a `WeatherSeries` via `seriesFromJson` (T-06). */
export function tmyById(id: string): WeatherSeries {
  const f = readTmyFile(id);
  const series: WeatherSeries = {
    stepSeconds: f.stepSeconds,
    startDayOfYear: f.startDayOfYear,
    startHour: f.startHour,
    T_amb: seriesFromJson(f.T_amb),
    GHI: seriesFromJson(f.GHI),
    v_wind: seriesFromJson(f.v_wind),
    provenance: f.provenance,
  };
  if (f.DNI) series.DNI = seriesFromJson(f.DNI);
  if (f.DHI) series.DHI = seriesFromJson(f.DHI);
  if (f.LW_down) series.LW_down = seriesFromJson(f.LW_down);
  if (f.RH) series.RH = seriesFromJson(f.RH);
  return series;
}

/**
 * The derived ground-albedo series (`tmy/README.md` has the rule), one
 * value per hour, for use as `Site.groundAlbedo` (LOG.md 7.5). Not part of
 * `WeatherSeries` by design (7.6) -- T-28 presets read it from here.
 */
export function groundAlbedoById(id: string): number[] {
  return readTmyFile(id).groundAlbedo.slice();
}
