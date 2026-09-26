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
  StorageElement,
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
import type { DesignLocation, ShelterDesign, Shape, Storeys, SurfaceConstruction } from './types.js';

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
  // G2: the intermediate-storey slab (a StorageElement, not a Surface) has
  // its own materialId, which `buildModel` looks up in this same record
  // (packages/engine/src/solve/assemble.ts) -- must be included or a
  // 2-storey request throws UNKNOWN_MATERIAL.
  for (const el of building.storageElements ?? []) ids.add(el.materialId);
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
const ORIENTATIONS: readonly Orientation[] = ['S', 'E', 'W', 'N'];

/** Quadrant of `azimuth` (degrees from south, -180..180), ties at the ±45/±135
 * boundary going to S/N (V2.md G2 condition 7). Every azimuth this file ever
 * produces (box: 0/-90/90/180; cylinder/dome: multiples of 30) is already in
 * (-180,180], so no wraparound normalisation is needed here. */
function orientationForAzimuth(azimuth: number): Orientation {
  if (azimuth >= -45 && azimuth <= 45) return 'S';
  if (azimuth > 45 && azimuth < 135) return 'W';
  if (azimuth <= -135 || azimuth >= 135) return 'N';
  return 'E';
}

/** Generalises the old single-wall `wallForOrientation`: every wall within
 * ±45° of the cardinal direction (box has exactly one per quadrant, so its
 * behaviour is unchanged; cylinder/dome can have several). */
function wallsInQuadrant(building: Building, orientation: Orientation): Surface[] {
  return building.surfaces.filter(
    (s) => s.type === 'wall' && orientationForAzimuth(s.azimuth) === orientation,
  );
}

function currentWwr(building: Building, orientation: Orientation): number {
  const walls = wallsInQuadrant(building, orientation);
  const totalArea = walls.reduce((sum, w) => sum + w.area, 0);
  if (totalArea <= 0) return 0;
  const wallIds = new Set(walls.map((w) => w.id));
  const windowArea = building.windows
    .filter((w) => wallIds.has(w.hostSurfaceId))
    .reduce((sum, w) => sum + w.area, 0);
  return windowArea / totalArea;
}

function setWwr(
  request: SimulationRequest,
  orientation: Orientation,
  wwr: number,
): SimulationRequest {
  const clamped = Math.min(0.9, Math.max(0, wwr));
  const walls = wallsInQuadrant(request.building, orientation);
  if (walls.length === 0) return request;

  const glazingId = currentGlazingId(request.building);
  const hasShutter = nightShuttersEnabled(request.building);
  const wallIds = new Set(walls.map((w) => w.id));
  const others = request.building.windows.filter((w) => !wallIds.has(w.hostSurfaceId));

  // The SAME ratio applied to each wall's own area automatically spreads the
  // quadrant's WWR over its walls in proportion to area (condition 7): for a
  // box (one wall per quadrant) this is byte-identical to the old rule.
  const added: WindowSpec[] = [];
  for (const wall of walls) {
    const areaM2 = clamped * wall.area;
    if (areaM2 <= 0) continue;
    added.push(
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
    );
  }

  const windows: WindowSpec[] = [...others, ...added];
  const building: Building = { ...request.building, windows };
  return { ...request, building, glazings: rebuildGlazingsRecord(building) };
}

// ============================== SIZE (L x W x H) ==============================

interface SizeM {
  lengthM: number;
  widthM: number;
  heightM: number;
}

/** `storeys` (default 1, box path byte-identical when 1) multiplies the wall
 * height used for wall area and volume only -- the footprint (roof/floor
 * area) is unchanged, matching the shared 2-storey rule (condition 6). The
 * intermediate slab itself is added separately by `addIntermediateSlab`. */
function setSize(request: SimulationRequest, size: SizeM, storeys: Storeys = 1): SimulationRequest {
  const { lengthM, widthM } = size;
  const wallHeightM = size.heightM * storeys;
  const floorArea = lengthM * widthM;
  const volume = floorArea * wallHeightM;

  const wwrByOrientation: Record<Orientation, number> = {
    S: currentWwr(request.building, 'S'),
    E: currentWwr(request.building, 'E'),
    W: currentWwr(request.building, 'W'),
    N: currentWwr(request.building, 'N'),
  };

  const surfaces: Surface[] = request.building.surfaces.map((s) => {
    if (s.type === 'wall') {
      if (s.azimuth === 0 || s.azimuth === 180) return { ...s, area: lengthM * wallHeightM };
      if (s.azimuth === -90 || s.azimuth === 90) return { ...s, area: widthM * wallHeightM };
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

// ============================== SHAPE (cylinder / dome facets) ==============================
// V2.md §G2 "Key finding": the engine has no notion of "box" -- it only sees
// Building.surfaces. `setSize` above IS the box's only shape-specific code.
// Non-box shapes generate their own facet list here, copying the preset's own
// S wall / roof / floor as TEMPLATES (construction, boundary, absorptivity,
// emissivities) so `wallConstruction`/`roofConstruction`/`floorConstruction`
// overrides -- applied by `withConstructionForType` AFTER this step, to every
// surface of that type -- still apply uniformly no matter how many facets
// there are.

const CYLINDER_SECTORS = 12;
const DOME_BANDS = 3;
const DOME_SECTORS = 12;
/** Facets steeper than this (degrees from horizontal) are walls (can host
 * windows); flatter ones are roof (condition 5). */
const DOME_WALL_TILT_THRESHOLD_DEG = 60;

export interface ShapeTemplates {
  wall: Surface;
  roof: Surface;
  floor: Surface;
}

export interface ShapeGeometry {
  surfaces: Surface[];
  floorArea: number;
  volume: number;
}

/** Every shape's S wall / roof / floor, before any resizing -- the preset's
 * own surfaces (`resolvePreset`'s Building), read at the point in `assemble`
 * where `setSize`/`setShapeFacets` runs, i.e. before any construction
 * override. Every bundled preset has exactly one wall at azimuth 0 (S), one
 * roof, one floor (packages/data/src/presets.ts); a preset missing one is a
 * data bug, not a user input, hence the plain (not EngineError) throw. */
function shapeTemplates(building: Building): ShapeTemplates {
  const wall = building.surfaces.find((s) => s.type === 'wall' && s.azimuth === 0);
  const roof = building.surfaces.find((s) => s.type === 'roof');
  const floor = building.surfaces.find((s) => s.type === 'floor');
  if (!wall || !roof || !floor) {
    throw new Error('Preset is missing a S wall / roof / floor to use as a shape template.');
  }
  return { wall, roof, floor };
}

/**
 * 12 wall facets at 30° spacing, each `pi*D*h/12` (condition 4). `h` already
 * includes `storeys` (see `setSize`'s doc comment for why that's the shared
 * 2-storey rule) -- there is no separate "double after" step for the
 * cylinder, direct and the after-the-fact box doubling are the same number.
 */
export function cylinderGeometry(
  templates: ShapeTemplates,
  diameterM: number,
  heightPerStoreyM: number,
  storeys: Storeys,
): ShapeGeometry {
  const r = diameterM / 2;
  const h = heightPerStoreyM * storeys;
  const floorArea = Math.PI * r * r;
  const wallAreaEach = (Math.PI * diameterM * h) / CYLINDER_SECTORS;

  const surfaces: Surface[] = [];
  for (let k = 0; k < CYLINDER_SECTORS; k++) {
    surfaces.push({ ...templates.wall, id: `wallC${k}`, area: wallAreaEach, azimuth: -150 + k * 30 });
  }
  surfaces.push({ ...templates.roof, id: 'roof', area: floorArea });
  surfaces.push({ ...templates.floor, id: 'floor', area: floorArea });

  return { surfaces, floorArea, volume: floorArea * h };
}

/**
 * Hemisphere as 3 equal-height elevation bands x 12 azimuth sectors
 * (condition 5). A band's total zone area depends only on its height (the
 * "hat-box" spherical-zone identity `2*pi*r*dz`), so all 3 bands have equal
 * area even though they cover different angular spans; band mid-elevation is
 * measured at the band's mid-HEIGHT (not mid-angle), consistent with that
 * same identity. Dome storeys are always 1 (validated at the schema), so
 * there is no `storeys` parameter here.
 */
export function domeGeometry(templates: ShapeTemplates, diameterM: number): ShapeGeometry {
  const r = diameterM / 2;
  const floorArea = Math.PI * r * r;
  const volume = (2 / 3) * Math.PI * r ** 3;
  const dz = r / DOME_BANDS;
  const sectorArea = (2 * Math.PI * r * dz) / DOME_SECTORS;

  const surfaces: Surface[] = [];
  for (let band = 0; band < DOME_BANDS; band++) {
    const zMid = (band + 0.5) * dz;
    const elevationMidDeg = (Math.asin(zMid / r) * 180) / Math.PI;
    const tilt = 90 - elevationMidDeg;
    const isWall = tilt >= DOME_WALL_TILT_THRESHOLD_DEG;
    const template = isWall ? templates.wall : templates.roof;
    const type: Surface['type'] = isWall ? 'wall' : 'roof';
    for (let k = 0; k < DOME_SECTORS; k++) {
      surfaces.push({
        ...template,
        id: `${type}D${band}S${k}`,
        type,
        area: sectorArea,
        tilt,
        azimuth: -150 + k * 30,
      });
    }
  }
  surfaces.push({ ...templates.floor, id: 'floor', area: floorArea });

  return { surfaces, floorArea, volume };
}

/** Replaces `setSize` for shapes the box's simple per-orientation area math
 * can't express. Clears `windows`: the templates' own windows (if any)
 * reference the box's wall ids, which no longer exist as surfaces; `assemble`
 * regenerates every orientation's windows from `design.windowWwr` right
 * after this step regardless (step 5), so the clear is never user-visible. */
function setShapeFacets(
  request: SimulationRequest,
  shape: 'cylinder' | 'dome',
  diameterM: number,
  heightPerStoreyM: number,
  storeys: Storeys,
): SimulationRequest {
  const templates = shapeTemplates(request.building);
  const geometry =
    shape === 'cylinder'
      ? cylinderGeometry(templates, diameterM, heightPerStoreyM, storeys)
      : domeGeometry(templates, diameterM);

  const building: Building = {
    ...request.building,
    floorArea: geometry.floorArea,
    volume: geometry.volume,
    surfaces: geometry.surfaces,
    windows: [],
  };
  return finalizeWithCatalogue({ ...request, building }, building);
}

// ============================== TWO STOREYS (single-zone slab) ==============================
// Single-zone approximation (API.md §3, disclosed there and in the UI, LOG.md
// rule 13 "no hidden approximations"): the intermediate floor between the two
// storeys is modelled as ONE `rock` StorageElement coupled to the single air
// node, not as a second zone. Constants below are this task's own documented
// guesses, not measured -- there is no second-storey slab in any preset to
// read a real thickness/material from.

/** m. A nominal intermediate-storey slab thickness (timber deck / thin
 * rammed-earth floor) -- not user-configurable, and not the ground floor's
 * own (usually much thicker) construction. */
const SLAB_THICKNESS_M = 0.15;
/** W/(m^2*K). A nominal interior convective coefficient, applied to BOTH
 * faces of the slab (top and bottom, hence the `2 *` in `conductanceToRoom`
 * below) since the single-zone approximation puts both faces in the same air
 * node. */
const SLAB_CONVECTIVE_COEFFICIENT = 8;

/**
 * mass = footprint * SLAB_THICKNESS_M * density(floor material); conductance
 * = 2 * footprint * SLAB_CONVECTIVE_COEFFICIENT (condition 6). The floor
 * material is read from the CURRENT floor surface's own construction (its
 * last/innermost layer -- "the floor material" facing the room, not a
 * ground-side fill layer like `EARTH_FLOOR`'s gravel) at the point this runs,
 * i.e. before any `floorConstruction` override (`assemble`'s step order) --
 * "the preset floor material" per V2.md §G2.
 */
function addIntermediateSlab(request: SimulationRequest): SimulationRequest {
  const floorSurface = request.building.surfaces.find((s) => s.type === 'floor');
  if (!floorSurface) return request; // unreachable: every shape generates exactly one floor
  const lastLayer = floorSurface.construction[floorSurface.construction.length - 1]!;
  const material = materialById(lastLayer.materialId);
  const footprint = request.building.floorArea;

  const slab: StorageElement = {
    id: 'intermediateSlab',
    kind: 'rock',
    materialId: lastLayer.materialId,
    massKg: footprint * SLAB_THICKNESS_M * material.rho,
    surfaceAreaToRoom: 2 * footprint,
    conductanceToRoom: 2 * footprint * SLAB_CONVECTIVE_COEFFICIENT,
  };

  const building: Building = {
    ...request.building,
    storageElements: [...(request.building.storageElements ?? []), slab],
  };
  return finalizeWithCatalogue({ ...request, building }, building);
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

  // Step 3 (G2, V2.md §G2): shape/storeys are optional -- absent means
  // box/1, so this is byte-identical to before G2 for every existing design.
  const shape: Shape = design.shape ?? 'box';
  const storeys: Storeys = design.storeys ?? 1;
  request =
    shape === 'box'
      ? setSize(request, { lengthM: design.lengthM, widthM: design.widthM, heightM: design.heightM }, storeys)
      : setShapeFacets(request, shape, design.lengthM, design.heightM, storeys);
  // Two storeys: single-zone approximation, one intermediate slab
  // StorageElement (API.md §3). Schema rejects dome + storeys 2, so this is
  // unreachable for dome.
  if (storeys === 2) request = addIntermediateSlab(request);

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
