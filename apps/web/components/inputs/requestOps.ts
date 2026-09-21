// apps/web/components/inputs/requestOps.ts
//
// Pure functions that turn one basic-panel control's change into a new
// `SimulationRequest`. Kept free of React and of the store so every one of
// them is a plain, directly-testable function (LOG.md global rule 5: Kelvin
// everywhere inside a request; `toK`/`toC` come from `@shelter/engine`
// directly, never a hardcoded Kelvin-Celsius offset constant -- see the grep
// acceptance test 9).
//
// None of this imports `@shelter/data` (see catalog.ts's header) -- only
// `@shelter/engine` (zero runtime deps, browser-safe, CONTRACTS.md §7.13)
// and the local `catalog.ts` static tables.

import { toK } from '@shelter/engine';
import type {
  Building,
  Glazing,
  Material,
  Operation,
  SimulationRequest,
  Surface,
  WeatherSeries,
  WindowSpec,
} from '@shelter/engine';
import {
  GLAZINGS,
  NIGHT_SHUTTER_RESISTANCE,
  defaultThicknessM,
  defaultWindowSpecFor,
  glazingSummaryById,
  occupancyPresetById,
  presetSummaryById,
  type PresetSummary,
} from './catalog';

// ============================== MATERIALS / GLAZINGS RECORDS ==============================

/** Every `materialId` actually referenced anywhere in `building`, deduped. */
export function usedMaterialIds(building: Building): string[] {
  const ids = new Set<string>();
  for (const surface of building.surfaces) {
    for (const layer of surface.construction) ids.add(layer.materialId);
  }
  return [...ids];
}

export function usedGlazingIds(building: Building): string[] {
  return [...new Set(building.windows.map((w) => w.glazingId))];
}

/** Rebuilds `request.materials` from scratch as the union of every layer's
 * materialId, looked up in the fetched catalogue. A materialId with no
 * catalogue row is skipped (not thrown): the caller has already applied the
 * mutation that introduced it, and a missing id can only mean the catalogue
 * has not loaded yet -- `validateRequest` will report it clearly if it is
 * still missing by dispatch time, which is more honest than a UI-level throw. */
export function rebuildMaterialsRecord(
  building: Building,
  catalogue: Material[],
): Record<string, Material> {
  const out: Record<string, Material> = {};
  for (const id of usedMaterialIds(building)) {
    const m = catalogue.find((x) => x.id === id);
    if (m) out[id] = m;
  }
  return out;
}

function toEngineGlazing(id: string): Glazing {
  const g = glazingSummaryById(id);
  return {
    id: g.id,
    name: g.name,
    U: g.U,
    SHGC: g.SHGC,
    tauVis: g.tauVis,
    b0: g.b0,
    source: g.source,
    blurb: g.blurb,
  };
}

export function rebuildGlazingsRecord(building: Building): Record<string, Glazing> {
  const out: Record<string, Glazing> = {};
  for (const id of usedGlazingIds(building)) out[id] = toEngineGlazing(id);
  return out;
}

/** Every material-changing mutation in this file funnels through here so
 * `request.materials`/`request.glazings` are NEVER forgotten for a
 * newly-referenced id. Needs the FULL fetched catalogue (not just what is
 * already in `request.materials`), since a newly-picked material may not be
 * in there yet. */
function finalizeWithCatalogue(
  request: SimulationRequest,
  building: Building,
  catalogue: Material[],
): SimulationRequest {
  return {
    ...request,
    building,
    materials: rebuildMaterialsRecord(building, catalogue),
    glazings: rebuildGlazingsRecord(building),
  };
}

// ============================== WALL / ROOF / FLOOR MATERIAL ==============================

function singleLayerConstruction(
  materialId: string,
  catalogue: Material[],
): Surface['construction'] {
  const m = catalogue.find((x) => x.id === materialId);
  const thickness = defaultThicknessM(materialId, m?.category ?? 'structural');
  return [{ materialId, thickness }];
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

export function setWallMaterial(
  request: SimulationRequest,
  materialId: string,
  catalogue: Material[],
): SimulationRequest {
  const building = withConstructionForType(
    request.building,
    'wall',
    singleLayerConstruction(materialId, catalogue),
  );
  return finalizeWithCatalogue(request, building, catalogue);
}

export function setRoofMaterial(
  request: SimulationRequest,
  materialId: string,
  catalogue: Material[],
): SimulationRequest {
  const building = withConstructionForType(
    request.building,
    'roof',
    singleLayerConstruction(materialId, catalogue),
  );
  return finalizeWithCatalogue(request, building, catalogue);
}

export function setFloorMaterial(
  request: SimulationRequest,
  materialId: string,
  catalogue: Material[],
): SimulationRequest {
  const building = withConstructionForType(
    request.building,
    'floor',
    singleLayerConstruction(materialId, catalogue),
  );
  return finalizeWithCatalogue(request, building, catalogue);
}

/** The wall material shown in the dropdown: the first wall surface's first
 * (there is normally exactly one) construction layer. Falls back to `''`
 * (no selection) for a building with no wall surfaces at all. */
export function currentWallMaterialId(building: Building): string {
  const wall = building.surfaces.find((s) => s.type === 'wall');
  return wall?.construction[0]?.materialId ?? '';
}
export function currentRoofMaterialId(building: Building): string {
  const roof = building.surfaces.find((s) => s.type === 'roof');
  return roof?.construction[0]?.materialId ?? '';
}
export function currentFloorMaterialId(building: Building): string {
  const floor = building.surfaces.find((s) => s.type === 'floor');
  return floor?.construction[0]?.materialId ?? '';
}

// ============================== MATERIAL-STACK EDITOR (one surface) ==============================

/** Sets ONE surface's ONE layer's thickness (the stack editor's slider), by
 * surface id + layer index, leaving every other surface and layer untouched. */
export function setLayerThickness(
  request: SimulationRequest,
  surfaceId: string,
  layerIndex: number,
  thicknessM: number,
  catalogue: Material[],
): SimulationRequest {
  const building: Building = {
    ...request.building,
    surfaces: request.building.surfaces.map((s) => {
      if (s.id !== surfaceId) return s;
      const construction = s.construction.map((layer, i) =>
        i === layerIndex ? { ...layer, thickness: thicknessM } : layer,
      );
      return { ...s, construction };
    }),
  };
  return finalizeWithCatalogue(request, building, catalogue);
}

// ============================== GLAZING TYPE + NIGHT SHUTTERS ==============================

export function setGlazingType(request: SimulationRequest, glazingId: string): SimulationRequest {
  const windows = request.building.windows.map((w) => ({ ...w, glazingId }));
  const building: Building = { ...request.building, windows };
  return { ...request, building, glazings: rebuildGlazingsRecord(building) };
}

export function currentGlazingId(building: Building): string {
  return building.windows[0]?.glazingId ?? GLAZINGS[0]!.id;
}

export function nightShuttersEnabled(building: Building): boolean {
  return (
    building.windows.length > 0 && building.windows.every((w) => w.shutterResistance !== undefined)
  );
}

const NIGHT_SHUTTER_SCHEDULE = Array.from({ length: 24 }, (_, h) => h >= 20 || h < 6);

export function setNightShutters(request: SimulationRequest, enabled: boolean): SimulationRequest {
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

export type Orientation = 'S' | 'E' | 'W' | 'N';
/** Azimuth-from-south convention, CONTRACTS.md §7.5: 0 = S, -90 = E, 90 = W, 180 = N. */
const ORIENTATION_AZIMUTH: Record<Orientation, number> = { S: 0, E: -90, W: 90, N: 180 };
export const ORIENTATIONS: readonly Orientation[] = ['S', 'E', 'W', 'N'];

function wallForOrientation(building: Building, orientation: Orientation): Surface | undefined {
  const az = ORIENTATION_AZIMUTH[orientation];
  return building.surfaces.find((s) => s.type === 'wall' && s.azimuth === az);
}

/** Current window-to-wall ratio for one orientation, 0 when there is no
 * window (or no wall) on that face. */
export function currentWwr(building: Building, orientation: Orientation): number {
  const wall = wallForOrientation(building, orientation);
  if (!wall || wall.area <= 0) return 0;
  const area = building.windows
    .filter((w) => w.hostSurfaceId === wall.id)
    .reduce((sum, w) => sum + w.area, 0);
  return area / wall.area;
}

/** Sets one orientation's WWR (0-0.9, clamped): resizes its existing window
 * or creates/removes one, keeping the currently-selected glazing type and
 * night-shutter state. At most one window per orientation on this basic
 * panel -- the stack editor is not needed to see the effect of this slider. */
export function setWwr(
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

/** South/north walls run the "length" (E-W) dimension; east/west walls run
 * the "width" (N-S) dimension -- an arbitrary but fixed labelling convention
 * for a rectangular box, consistent across every setter here. Window areas
 * scale with their host wall via `setWwr` re-application so a resize never
 * silently leaves a window bigger than its new wall (which `validateRequest`
 * would reject as GEOMETRY_INCONSISTENT). */
export interface SizeM {
  lengthM: number;
  widthM: number;
  heightM: number;
}

export function currentSize(building: Building): SizeM {
  const south = building.surfaces.find((s) => s.type === 'wall' && s.azimuth === 0);
  const east = building.surfaces.find((s) => s.type === 'wall' && s.azimuth === -90);
  const heightM =
    south && south.area > 0 ? south.area / Math.max(1e-6, lengthFromFloorArea(building)) : 2.6;
  return {
    lengthM: lengthFromFloorArea(building),
    widthM: east
      ? east.area / Math.max(1e-6, heightM)
      : building.floorArea / Math.max(1e-6, lengthFromFloorArea(building)),
    heightM,
  };
}

/** `floorArea = length * width`; without a second independent equation the
 * aspect ratio is otherwise unrecoverable from `floorArea` alone, so this
 * derives `length` from the south wall's own area and the building height
 * where possible, falling back to a square footprint. */
function lengthFromFloorArea(building: Building): number {
  const south = building.surfaces.find((s) => s.type === 'wall' && s.azimuth === 0);
  const east = building.surfaces.find((s) => s.type === 'wall' && s.azimuth === -90);
  if (south && east && south.area > 0 && east.area > 0) {
    // south.area = L*H, east.area = W*H => L = south.area * sqrt(floorArea / (south.area*east.area))
    const h2 = (south.area * east.area) / Math.max(1e-9, building.floorArea);
    const h = Math.sqrt(Math.max(1e-9, h2));
    return south.area / Math.max(1e-9, h);
  }
  return Math.sqrt(Math.max(1e-9, building.floorArea));
}

export function setSize(request: SimulationRequest, size: SizeM): SimulationRequest {
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
      if (s.azimuth === 0 || s.azimuth === 180) return { ...s, area: lengthM * heightM }; // S/N walls
      if (s.azimuth === -90 || s.azimuth === 90) return { ...s, area: widthM * heightM }; // E/W walls
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

export function setOccupancyPreset(
  request: SimulationRequest,
  occupancyId: string,
): SimulationRequest {
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

// ============================== SHELTER-TYPE PRESET CARD ==============================

/** Applies one preset card's building/operation shape (materials, layers,
 * windows, ACH, occupancy) to the CURRENT request, keeping whatever
 * site/weather is already loaded (see catalog.ts's header for why a
 * genuinely different location's weather cannot be fetched from here). The
 * building's own current footprint (length/width/height) is preserved --
 * loading a shelter type changes ITS envelope, not the size the user already
 * dialled in. */
export function applyPresetSummary(
  request: SimulationRequest,
  presetId: string,
  catalogue: Material[],
): SimulationRequest {
  const p: PresetSummary = presetSummaryById(presetId);

  // `area`/`tilt`/`azimuth`/`boundary`/`id` are left untouched on every
  // surface -- those encode the CURRENT footprint (whatever the size control
  // last set), which loading a shelter-type card must not silently reset.
  const surfaces: Surface[] = request.building.surfaces.map((s) => {
    if (s.type === 'wall') {
      return {
        ...s,
        construction: p.wallLayers,
        exteriorAbsorptivity: p.exteriorAbsorptivity,
        exteriorEmissivity: p.exteriorEmissivity,
      };
    }
    if (s.type === 'roof') {
      return {
        ...s,
        construction: p.roofLayers,
        exteriorAbsorptivity: p.exteriorAbsorptivity,
        exteriorEmissivity: p.exteriorEmissivity,
      };
    }
    if (s.type === 'floor') return { ...s, construction: p.floorLayers };
    return s;
  });

  const southWall = surfaces.find((s) => s.type === 'wall' && s.azimuth === 0);
  const windows: WindowSpec[] = southWall
    ? [defaultWindowSpecFor(southWall.id, p.window)]
    : request.building.windows;

  const building: Building = { ...request.building, surfaces, windows };

  const occ = occupancyPresetById(p.occupancyPresetId);
  const operation: Operation = {
    ...request.operation,
    internalGainsSchedule: occ.internalGainsSchedule.slice(),
    achSchedule: new Array(24).fill(p.achLevel),
    auxHeating: {
      enabled: occ.auxHeatingEnabled,
      setpoint: toK(occ.auxHeatingSetpointC),
      maxPower: occ.auxHeatingMaxPowerW,
    },
    hasUnventedCombustion: occ.hasUnventedCombustion,
  };

  return finalizeWithCatalogue({ ...request, operation }, building, catalogue);
}

// ============================== LOCATION / DATE (weather re-slicing) ==============================

/** Slices a full-year (or otherwise longer-than-one-day) `WeatherSeries`
 * down to a `daysCount`-day window starting at `dayOfYear` (1-365, relative
 * to the series' own `startDayOfYear`), for the "date" control. One extra
 * hourly sample past the window's end is kept when available so the
 * integrator's own linear interpolation (`solve/integrator.ts`'s `sample()`)
 * has a real right-hand point at the last timestep instead of repeating the
 * final one -- `sample()` clamps safely either way, so this is an accuracy
 * nicety, not a correctness requirement. */
export function sliceWeatherToDay(
  full: WeatherSeries,
  dayOfYear: number,
  daysCount = 1,
): WeatherSeries {
  const stepsPerHour = 3600 / full.stepSeconds;
  const startIdx = Math.round((dayOfYear - full.startDayOfYear) * 24 * stepsPerHour);
  const lengthIdx = Math.round(daysCount * 24 * stepsPerHour);
  const n = full.T_amb.length;
  const clampedStart = Math.max(0, Math.min(startIdx, Math.max(0, n - lengthIdx)));
  const end = Math.min(n, clampedStart + lengthIdx + 1); // +1 boundary sample

  const out: WeatherSeries = {
    stepSeconds: full.stepSeconds,
    startDayOfYear: dayOfYear,
    startHour: full.startHour,
    T_amb: full.T_amb.slice(clampedStart, end),
    GHI: full.GHI.slice(clampedStart, end),
    v_wind: full.v_wind.slice(clampedStart, end),
    provenance: full.provenance,
  };
  // Each optional array is sliced only inside its own narrowed `if`, so the
  // assigned value's static type is always `Float64Array`, never
  // `Float64Array | undefined` -- `exactOptionalPropertyTypes` (this repo's
  // strict tsconfig) rejects assigning the latter to an optional field even
  // when a runtime guard makes it unreachable.
  if (full.DNI) out.DNI = full.DNI.slice(clampedStart, end);
  if (full.DHI) out.DHI = full.DHI.slice(clampedStart, end);
  if (full.LW_down) out.LW_down = full.LW_down.slice(clampedStart, end);
  if (full.RH) out.RH = full.RH.slice(clampedStart, end);
  return out;
}

/** ISO 'YYYY-MM-DD' -> day of year (1-365/366), UTC, no timezone surprises. */
export function isoDateToDayOfYear(iso: string): number {
  const d = new Date(`${iso}T00:00:00Z`);
  const startOfYear = Date.UTC(d.getUTCFullYear(), 0, 1);
  return Math.floor((d.getTime() - startOfYear) / 86_400_000) + 1;
}

/** day-of-year -> ISO 'YYYY-MM-DD', for a fixed reference year (the bundled
 * TMY files are all a single non-leap calendar year, `tmy/README.md`). */
export function dayOfYearToIsoDate(dayOfYear: number, referenceYear = 2023): string {
  const d = new Date(Date.UTC(referenceYear, 0, dayOfYear));
  return d.toISOString().slice(0, 10);
}
