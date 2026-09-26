// apps/studio-server/src/design/types.ts — THE STUDIO CONTRACT.
//
// ShelterDesign is apps/server's DesignInput (apps/server/src/assemble.ts)
// with: `locationId` -> `location` (preset | custom), `azimuthDeg` (new,
// maps to Building.azimuth), and the three *MaterialId fields replaced by
// SurfaceConstruction | null (null keeps the preset's own multi-layer
// stack; a given SurfaceConstruction is now a single layer at the given
// thickness, not a looked-up default). PLAN.md §ShelterDesign is the source
// of truth; changes here are a contract change for every other task.
//
// package.json's "types" field points here so apps/studio (the client) can
// `import type` these shapes without pulling in @shelter/data (node:fs,
// not browser-safe) or any server code. `SimulationKpis` is a type-only
// import from @shelter/engine, which the client is allowed to import types
// from (STUDIO.md / ledger rules).

import type { SimulationKpis } from '@shelter/engine';
import type { WeatherProvenanceSummary } from '../weather/resolve.js';

export type DesignLocation =
  | { kind: 'preset'; id: string }
  | { kind: 'custom'; name: string; lat: number; lon: number; elevation: number };

export interface SurfaceConstruction {
  materialId: string;
  /** Metres. Single layer at this exact thickness (0.02-1.0 m, condition 5). */
  thicknessM: number;
}

export interface ShelterDesign {
  location: DesignLocation;
  date: string; // ISO 'YYYY-MM-DD'
  presetId: string;
  lengthM: number;
  widthM: number;
  heightM: number;
  /** Degrees, -180..180. 0 = long side faces south. -> Building.azimuth. */
  azimuthDeg: number;
  wallConstruction: SurfaceConstruction | null;
  roofConstruction: SurfaceConstruction | null;
  floorConstruction: SurfaceConstruction | null;
  windowWwr: { S: number; E: number; W: number; N: number };
  glazingId: string;
  nightShutters: boolean;
  occupancyPresetId: string;
}

// ============================== GET /api/options ==============================

export interface LocationOption {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  elevation: number;
}
export interface PresetOption {
  id: string;
  name: string;
  description: string;
  locationId: string;
  /** Total thickness (m) of the preset's own construction per surface type. */
  thicknessM: { wall: number; roof: number; floor: number };
}
export interface MaterialOption {
  id: string;
  name: string;
  category: 'structural' | 'insulation' | 'finish' | 'storage';
  conductivity: number;
  /** Starting thickness (m) when this material is picked for a surface. */
  defaultThicknessM: number;
  blurb?: string;
}
export interface GlazingOption {
  id: string;
  name: string;
  U: number;
  SHGC: number;
  blurb?: string;
}
export interface OccupancyPresetOption {
  id: string;
  name: string;
  blurb: string;
}

export interface Range {
  min: number;
  max: number;
  step?: number;
}

/** One range per numeric ShelterDesign control (condition 7). */
export interface OptionsRanges {
  azimuthDeg: Range;
  lengthM: Range;
  widthM: Range;
  heightM: Range;
  thicknessM: Range;
  windowWwr: Range;
}

export interface Options {
  locations: LocationOption[];
  presets: PresetOption[];
  materials: MaterialOption[];
  glazings: GlazingOption[];
  occupancyPresets: OccupancyPresetOption[];
  defaults: ShelterDesign;
  ranges: OptionsRanges;
}

// ============================== POST /api/simulate/preview ==============================

/** kpis duplicated top-level (as apps/server does) and inside `result.kpis`. */
export interface PreviewResponse {
  kpis: SimulationKpis;
  result: unknown; // ResultJson, i.e. resultToJson(SimulationResult) -- the
  // engine only types the pre-JSON SimulationResult (Float64Array fields);
  // the JSON shape is documented in API.md, same as apps/server/API.md §4.
  /** Present iff location.kind === 'custom' (P3, API.md §4). */
  weatherProvenance?: WeatherProvenanceSummary;
}

// ======================= re-exports for apps/studio (F1b) =======================
// The client `import type`s these from here (package.json's "types" field),
// never from the server modules directly -- keeps the client's only server
// dependency this one file. No hand-copied shapes (condition 2).

export type { PublicUser } from '../auth/service.js';
export type { DesignSummary } from '../designs/service.js';
export type { SimulationSummary, SimulationFull } from '../simulations/service.js';
export type { WeatherProvenanceSummary } from '../weather/resolve.js';
export type { LocationSearchResult } from '../weather/geocode.js';
