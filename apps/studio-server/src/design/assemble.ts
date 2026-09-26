// apps/studio-server/src/design/assemble.ts
//
// Copy of apps/server/src/assemble.ts (S1), extended for ShelterDesign
// (P1/PLAN.md §ShelterDesign):
//   - `azimuthDeg` -> `building.azimuth` (the engine applies the rotation
//     itself, packages/engine/src/solve/assemble.ts).
//   - `{materialId, thicknessM}` single-layer constructions now use the
//     GIVEN thickness, not a category-default lookup (old
//     `defaultThicknessM`/`THICKNESS_OVERRIDE_M` table is gone -- the user
//     picks the thickness directly).
//   - `location.kind === 'custom'` weather/site is resolved through an
//     injected `weatherFor` parameter; P1 has no real implementation (P3
//     adds Open-Meteo/NASA POWER fetch + Mongo caching) and throws
//     `CustomLocationUnavailableError` when none is supplied.
// Everything else (preset resolution, weather slicing, WWR/glazing/shutter/
// occupancy setters, the isotropic sky-model override) is unchanged.

import { DEFAULT_SIM_OPTIONS, asK, toK } from '@shelter/engine';
import type {
  Building,
  Glazing,
  Material,
  Operation,
  Preset,
  Site,
  SimulationRequest,
  Surface,
  WeatherSeries,
  WindowSpec,
} from '@shelter/engine';
import {
  glazingById,
  groundAlbedoById,
  materialById,
  presetById,
  TMY_LOCATIONS,
  tmyById,
} from '@shelter/data';
import type { DesignLocation, ShelterDesign, SurfaceConstruction } from './types.js';

// ============================== CUSTOM LOCATION SEAM ==============================

export type CustomLocation = Extract<DesignLocation, { kind: 'custom' }>;

/** P3 implements the real one (fetch + normaliseWeather + Mongo cache, PLAN.md
 * "Custom location"). Returns a FULL YEAR series, same as `tmyById` -- the
 * caller (this file) slices to the chosen day, same as the preset branch. */
export type WeatherFor = (location: CustomLocation) => { weather: WeatherSeries; site: Site };

export class CustomLocationUnavailableError extends Error {
  readonly code = 'CUSTOM_LOCATION_UNAVAILABLE' as const;
  constructor(message = 'Custom location weather is not available yet.') {
    super(message);
    this.name = 'CustomLocationUnavailableError';
  }
}

// ============================== OCCUPANCY PRESETS ==============================
// Reproduced verbatim from apps/web/components/inputs/catalog.ts (via
// apps/server/src/assemble.ts) -- no @shelter/data export exists for this
// table (apps/server/API.md §5 note 3).

export interface OccupancyPreset {
  id: string;
  name: string;
  blurb: string;
  internalGainsSchedule: number[];
  auxHeatingEnabled: boolean;
  auxHeatingSetpointC: number;
  auxHeatingMaxPowerW: number;
  hasUnventedCombustion: boolean;
}

function hourly(base: number, overrides: [number, number, number][]): number[] {
  const gains = new Array(24).fill(base);
  for (const [start, end, value] of overrides) {
    for (let h = start; h < end; h++) gains[h] = value;
  }
  return gains;
}

export const OCCUPANCY_PRESETS: readonly OccupancyPreset[] = [
  {
    id: 'familyLivestock',
    name: 'Family + livestock byre',
    blurb: 'A family of two plus three animals stabled below, no auxiliary heater.',
    internalGainsSchedule: hourly(1640, [
      [6, 9, 1950],
      [18, 21, 1950],
    ]),
    auxHeatingEnabled: false,
    auxHeatingSetpointC: 15,
    auxHeatingMaxPowerW: 0,
    hasUnventedCombustion: true,
  },
  {
    id: 'barrackPersonnel',
    name: 'Barrack, personnel on duty',
    blurb: 'Two personnel on quarters duty, morning muster and evening mess.',
    internalGainsSchedule: hourly(140, [
      [6, 8, 730],
      [18, 22, 730],
    ]),
    auxHeatingEnabled: false,
    auxHeatingSetpointC: 15,
    auxHeatingMaxPowerW: 0,
    hasUnventedCombustion: false,
  },
  {
    id: 'smallHousehold',
    name: 'Small household',
    blurb: 'One person home most of the day, cooking morning and evening, no auxiliary heater.',
    internalGainsSchedule: hourly(70, [
      [7, 9, 520],
      [19, 22, 520],
    ]),
    auxHeatingEnabled: false,
    auxHeatingSetpointC: 15,
    auxHeatingMaxPowerW: 0,
    hasUnventedCombustion: false,
  },
  {
    id: 'heatedOffice',
    name: 'Heated post / office (auxiliary heater on)',
    blurb:
      'Staffed through the day with an electric auxiliary heater keeping the room above 15 degC.',
    internalGainsSchedule: hourly(210, [[9, 18, 350]]),
    auxHeatingEnabled: true,
    auxHeatingSetpointC: 15,
    auxHeatingMaxPowerW: 1500,
    hasUnventedCombustion: false,
  },
] as const;

export function occupancyPresetById(id: string): OccupancyPreset {
  const p = OCCUPANCY_PRESETS.find((x) => x.id === id);
  if (!p) throw new Error(`No occupancy preset for id "${id}"`);
  return p;
}

// ============================== MATERIALS / GLAZINGS RECORDS ==============================

function usedMaterialIds(building: Building): string[] {
  const ids = new Set<string>();
  for (const surface of building.surfaces) {
    for (const layer of surface.construction) ids.add(layer.materialId);
  }
  return [...ids];
}

function usedGlazingIds(building: Building): string[] {
  return [...new Set(building.windows.map((w) => w.glazingId))];
}

function rebuildMaterialsRecord(building: Building): Record<string, Material> {
  const out: Record<string, Material> = {};
  for (const id of usedMaterialIds(building)) out[id] = materialById(id);
  return out;
}

function rebuildGlazingsRecord(building: Building): Record<string, Glazing> {
  const out: Record<string, Glazing> = {};
  for (const id of usedGlazingIds(building)) out[id] = glazingById(id);
  return out;
}

function finalizeWithCatalogue(request: SimulationRequest, building: Building): SimulationRequest {
  return {
    ...request,
    building,
    materials: rebuildMaterialsRecord(building),
    glazings: rebuildGlazingsRecord(building),
  };
}

// ============================== WALL / ROOF / FLOOR MATERIAL ==============================
// Single layer at the GIVEN thickness (ShelterDesign carries thicknessM
// directly; unlike apps/server's DesignInput there is no default-by-category
// lookup here).

function singleLayerConstruction(construction: SurfaceConstruction): Surface['construction'] {
  return [{ materialId: construction.materialId, thickness: construction.thicknessM }];
}

function withConstructionForType(
  building: Building,
  type: Surface['type'],
  construction: Surface['construction'],
): Building {
  return {
    ...building,
    surfaces: building.surfaces.map((s) => (s.type === type ? { ...s, construction } : s)),
  };
}

function setWallMaterial(
  request: SimulationRequest,
  construction: SurfaceConstruction,
): SimulationRequest {
  return finalizeWithCatalogue(
    request,
    withConstructionForType(request.building, 'wall', singleLayerConstruction(construction)),
  );
}
function setRoofMaterial(
  request: SimulationRequest,
  construction: SurfaceConstruction,
): SimulationRequest {
  return finalizeWithCatalogue(
    request,
    withConstructionForType(request.building, 'roof', singleLayerConstruction(construction)),
  );
}
function setFloorMaterial(
  request: SimulationRequest,
  construction: SurfaceConstruction,
): SimulationRequest {
  return finalizeWithCatalogue(
    request,
    withConstructionForType(request.building, 'floor', singleLayerConstruction(construction)),
  );
}

// ============================== GLAZING TYPE + NIGHT SHUTTERS ==============================

function setGlazingType(request: SimulationRequest, glazingId: string): SimulationRequest {
  const windows = request.building.windows.map((w) => ({ ...w, glazingId }));
  const building: Building = { ...request.building, windows };
  return { ...request, building, glazings: rebuildGlazingsRecord(building) };
}

function currentGlazingId(building: Building): string {
  return building.windows[0]?.glazingId ?? 'singleGlazing';
}

function nightShuttersEnabled(building: Building): boolean {
  return (
    building.windows.length > 0 && building.windows.every((w) => w.shutterResistance !== undefined)
  );
}

const NIGHT_SHUTTER_RESISTANCE = 0.4; // m^2*K/W
const NIGHT_SHUTTER_SCHEDULE = Array.from({ length: 24 }, (_, h) => h >= 20 || h < 6);

function setNightShutters(request: SimulationRequest, enabled: boolean): SimulationRequest {
  const windows: WindowSpec[] = request.building.windows.map((w) => {
    if (!enabled) {
      const { shadingSchedule: _s, shutterResistance: _r, ...rest } = w;
      return rest;
    }
    return {
      ...w,
      shadingSchedule: NIGHT_SHUTTER_SCHEDULE,
      shutterResistance: NIGHT_SHUTTER_RESISTANCE,
    };
  });
  return { ...request, building: { ...request.building, windows } };
}

// ============================== WINDOW AMOUNT (WWR PER ORIENTATION) ==============================

type Orientation = 'S' | 'E' | 'W' | 'N';
const ORIENTATION_AZIMUTH: Record<Orientation, number> = { S: 0, E: -90, W: 90, N: 180 };
const ORIENTATIONS: readonly Orientation[] = ['S', 'E', 'W', 'N'];

function wallForOrientation(building: Building, orientation: Orientation): Surface | undefined {
  const az = ORIENTATION_AZIMUTH[orientation];
  return building.surfaces.find((s) => s.type === 'wall' && s.azimuth === az);
}

function currentWwr(building: Building, orientation: Orientation): number {
  const wall = wallForOrientation(building, orientation);
  if (!wall || wall.area <= 0) return 0;
  const area = building.windows
    .filter((w) => w.hostSurfaceId === wall.id)
    .reduce((sum, w) => sum + w.area, 0);
  return area / wall.area;
}

function setWwr(
  request: SimulationRequest,
  orientation: Orientation,
  wwr: number,
): SimulationRequest {
  const clamped = Math.min(0.9, Math.max(0, wwr));
  const wall = wallForOrientation(request.building, orientation);
  if (!wall) return request;

  const glazingId = currentGlazingId(request.building);
  const hasShutter = nightShuttersEnabled(request.building);
  const areaM2 = clamped * wall.area;

  const others = request.building.windows.filter((w) => w.hostSurfaceId !== wall.id);
  const windows: WindowSpec[] =
    areaM2 <= 0
      ? others
      : [
          ...others,
          hasShutter
            ? {
                id: `${wall.id}Window`,
                hostSurfaceId: wall.id,
                area: areaM2,
                glazingId,
                shadingSchedule: NIGHT_SHUTTER_SCHEDULE,
                shutterResistance: NIGHT_SHUTTER_RESISTANCE,
              }
            : { id: `${wall.id}Window`, hostSurfaceId: wall.id, area: areaM2, glazingId },
        ];

  const building: Building = { ...request.building, windows };
  return { ...request, building, glazings: rebuildGlazingsRecord(building) };
}

// ============================== SIZE (L x W x H) ==============================

interface SizeM {
  lengthM: number;
  widthM: number;
  heightM: number;
}

function setSize(request: SimulationRequest, size: SizeM): SimulationRequest {
  const { lengthM, widthM, heightM } = size;
  const floorArea = lengthM * widthM;
  const volume = floorArea * heightM;

  const wwrByOrientation: Record<Orientation, number> = {
    S: currentWwr(request.building, 'S'),
    E: currentWwr(request.building, 'E'),
    W: currentWwr(request.building, 'W'),
    N: currentWwr(request.building, 'N'),
  };

  const surfaces: Surface[] = request.building.surfaces.map((s) => {
    if (s.type === 'wall') {
      if (s.azimuth === 0 || s.azimuth === 180) return { ...s, area: lengthM * heightM };
      if (s.azimuth === -90 || s.azimuth === 90) return { ...s, area: widthM * heightM };
      return s;
    }
    if (s.type === 'roof' || s.type === 'floor') return { ...s, area: floorArea };
    return s;
  });

  let building: Building = { ...request.building, floorArea, volume, surfaces };
  for (const o of ORIENTATIONS) {
    if (wwrByOrientation[o] > 0)
      building = setWwr({ ...request, building }, o, wwrByOrientation[o]).building;
  }
  return { ...request, building, glazings: rebuildGlazingsRecord(building) };
}

// ============================== OCCUPANCY / HEATING PRESET ==============================

function setOccupancyPreset(request: SimulationRequest, occupancyId: string): SimulationRequest {
  const p = occupancyPresetById(occupancyId);
  const operation: Operation = {
    ...request.operation,
    internalGainsSchedule: p.internalGainsSchedule.slice(),
    auxHeating: {
      enabled: p.auxHeatingEnabled,
      setpoint: toK(p.auxHeatingSetpointC),
      maxPower: p.auxHeatingMaxPowerW,
    },
    hasUnventedCombustion: p.hasUnventedCombustion,
  };
  return { ...request, operation };
}

// ============================== LOCATION / DATE (weather re-slicing) ==============================

function sliceWeatherToDay(full: WeatherSeries, dayOfYear: number, daysCount = 1): WeatherSeries {
  const stepsPerHour = 3600 / full.stepSeconds;
  const startIdx = Math.round((dayOfYear - full.startDayOfYear) * 24 * stepsPerHour);
  const lengthIdx = Math.round(daysCount * 24 * stepsPerHour);
  const n = full.T_amb.length;
  const clampedStart = Math.max(0, Math.min(startIdx, Math.max(0, n - lengthIdx)));
  const end = Math.min(n, clampedStart + lengthIdx + 1);

  const out: WeatherSeries = {
    stepSeconds: full.stepSeconds,
    startDayOfYear: dayOfYear,
    startHour: full.startHour,
    T_amb: full.T_amb.slice(clampedStart, end),
    GHI: full.GHI.slice(clampedStart, end),
    v_wind: full.v_wind.slice(clampedStart, end),
    provenance: full.provenance,
  };
  if (full.DNI) out.DNI = full.DNI.slice(clampedStart, end);
  if (full.DHI) out.DHI = full.DHI.slice(clampedStart, end);
  if (full.LW_down) out.LW_down = full.LW_down.slice(clampedStart, end);
  if (full.RH) out.RH = full.RH.slice(clampedStart, end);
  return out;
}

export function isoDateToDayOfYear(iso: string): number {
  const d = new Date(`${iso}T00:00:00Z`);
  const startOfYear = Date.UTC(d.getUTCFullYear(), 0, 1);
  return Math.floor((d.getTime() - startOfYear) / 86_400_000) + 1;
}

// ============================== SITE (weather-driven, per preset locationId) ==============================

function annualMeanK(id: string): number {
  const series = tmyById(id);
  let sum = 0;
  for (let i = 0; i < series.T_amb.length; i++) sum += series.T_amb[i]!;
  return sum / series.T_amb.length;
}

function siteForLocation(locationId: string): Site {
  const loc = TMY_LOCATIONS.find((l) => l.id === locationId);
  if (!loc) throw new Error(`No bundled TMY location "${locationId}".`); // unreachable: schema enum
  const groundTempMeanAnnual = locationId === 'leh' ? toK(6) : asK(annualMeanK(locationId));
  return {
    id: loc.id,
    name: loc.name,
    latitude: loc.latitude,
    longitude: loc.longitude,
    elevation: loc.elevation,
    standardMeridian: 82.5,
    groundAlbedo: groundAlbedoById(locationId),
    groundTempMeanAnnual,
  };
}

// ============================== PRESET RESOLUTION ==============================
// Mirrors apps/web/app/lib/resolveInitialState.ts's resolvePreset, generalised
// to any presetId (not just the default).

function resolvePreset(preset: Preset): SimulationRequest {
  const materials: Record<string, Material> = {};
  for (const surface of preset.request.building.surfaces) {
    for (const layer of surface.construction)
      materials[layer.materialId] = materialById(layer.materialId);
  }
  const glazings: Record<string, Glazing> = {};
  for (const win of preset.request.building.windows)
    glazings[win.glazingId] = glazingById(win.glazingId);
  return { ...preset.request, weather: tmyById(preset.locationId), materials, glazings };
}

// ============================== ASSEMBLE ==============================

export function assemble(design: ShelterDesign, weatherFor?: WeatherFor): SimulationRequest {
  const preset = presetById(design.presetId);
  let request = resolvePreset(preset);

  // Step 2: weather + site from design.location, NOT the preset's own
  // locationId (apps/server's location-never-changes-weather fix, carried
  // forward). Custom locations go through the injected weatherFor seam.
  if (design.location.kind === 'preset') {
    const weatherFull = tmyById(design.location.id);
    request = {
      ...request,
      weather: sliceWeatherToDay(weatherFull, isoDateToDayOfYear(design.date), 1),
      site: siteForLocation(design.location.id),
    };
  } else {
    if (!weatherFor) throw new CustomLocationUnavailableError();
    const { weather: weatherFull, site } = weatherFor(design.location);
    request = {
      ...request,
      weather: sliceWeatherToDay(weatherFull, isoDateToDayOfYear(design.date), 1),
      site,
    };
  }

  // Step 2b (new): whole-building rotation. The engine applies
  // building.azimuth itself (packages/engine/src/solve/assemble.ts:121);
  // per-surface `azimuth` above stays relative to south, unrotated.
  request = { ...request, building: { ...request.building, azimuth: design.azimuthDeg } };

  // Step 3
  request = setSize(request, {
    lengthM: design.lengthM,
    widthM: design.widthM,
    heightM: design.heightM,
  });

  // Step 4 -- only when non-null
  if (design.wallConstruction) request = setWallMaterial(request, design.wallConstruction);
  if (design.roofConstruction) request = setRoofMaterial(request, design.roofConstruction);
  if (design.floorConstruction) request = setFloorMaterial(request, design.floorConstruction);

  // Step 5
  for (const o of ORIENTATIONS) request = setWwr(request, o, design.windowWwr[o]);

  // Steps 6-8
  request = setGlazingType(request, design.glazingId);
  request = setNightShutters(request, design.nightShutters);
  request = setOccupancyPreset(request, design.occupancyPresetId);

  // Step 9 -- isotropic sky model override is load-bearing (apps/server/
  // API.md §4 step 9): presets.ts documents an unclamped-Rb engine bug under
  // the default 'hdkr' model that makes every Ladakh preset diverge.
  return {
    ...request,
    options: { ...DEFAULT_SIM_OPTIONS, simulationDays: 1, skyModel: 'isotropic' },
  };
}
