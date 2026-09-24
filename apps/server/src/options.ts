// apps/server/src/options.ts — GET /api/options payload. Built once, memoised
// (the catalogues are static for the process lifetime).

import { GLAZING, MATERIALS, PRESETS, TMY_LOCATIONS } from '@shelter/data';
import { OCCUPANCY_PRESETS, type DesignInput } from './assemble.js';

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
}
export interface MaterialOption {
  id: string;
  name: string;
  category: 'structural' | 'insulation' | 'finish' | 'storage';
  conductivity: number;
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

export interface Options {
  locations: LocationOption[];
  presets: PresetOption[];
  materials: MaterialOption[];
  glazings: GlazingOption[];
  occupancyPresets: OccupancyPresetOption[];
  defaults: DesignInput;
}

// The traditionalLadakhiByre (Leh) preset expressed as a DesignInput. Mid-
// January: the coldest-quarter design day this preset's winter-performance
// story is meant to be judged on. All three *MaterialId fields null so the
// preset's own multi-layer construction is used untouched (API.md §4 step 4).
const DEFAULTS: DesignInput = {
  locationId: 'leh',
  date: '2023-01-15',
  presetId: 'traditionalLadakhiByre',
  lengthM: 5,
  widthM: 5,
  heightM: 2.6,
  wallMaterialId: null,
  roofMaterialId: null,
  floorMaterialId: null,
  windowWwr: { S: 0.032, E: 0, W: 0, N: 0 }, // 0.8 m^2 / (5*2.6 m^2) south wall, this preset's window
  glazingId: 'singleGlazing',
  nightShutters: false,
  occupancyPresetId: 'familyLivestock',
};

let cached: Options | undefined;

export function buildOptions(): Options {
  if (cached) return cached;
  cached = {
    locations: TMY_LOCATIONS.map((l) => ({
      id: l.id,
      name: l.name,
      latitude: l.latitude,
      longitude: l.longitude,
      elevation: l.elevation,
    })),
    presets: PRESETS.map((p) => ({
      id: p.id,
      name: p.name,
      description: p.description,
      locationId: p.locationId,
    })),
    materials: MATERIALS.map((m) => ({
      id: m.id,
      name: m.name,
      category: m.category,
      conductivity: m.k,
      ...(m.blurb !== undefined ? { blurb: m.blurb } : {}),
    })),
    glazings: GLAZING.map((g) => ({
      id: g.id,
      name: g.name,
      U: g.U,
      SHGC: g.SHGC,
      ...(g.blurb !== undefined ? { blurb: g.blurb } : {}),
    })),
    occupancyPresets: OCCUPANCY_PRESETS.map((o) => ({ id: o.id, name: o.name, blurb: o.blurb })),
    defaults: DEFAULTS,
  };
  return cached;
}
