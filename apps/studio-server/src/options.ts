// apps/studio-server/src/options.ts — GET /api/options payload. Ported from
// apps/server/src/options.ts: same catalogues, `defaults` now a ShelterDesign
// (condition 7) and a `ranges` block covering every numeric control
// (condition 7/8 -- azimuth/thickness ranges are new, the rest are copied
// from apps/server's designInputSchema()). Built once, memoised.

import { GLAZING, MATERIALS, PRESETS, TMY_LOCATIONS } from '@shelter/data';
import { OCCUPANCY_PRESETS } from './design/assemble.js';
import type {
  GlazingOption,
  LocationOption,
  MaterialOption,
  Options,
  OccupancyPresetOption,
  PresetOption,
  ShelterDesign,
} from './design/types.js';

// The traditionalLadakhiByre (Leh) preset expressed as a ShelterDesign. Mid-
// January: the coldest-quarter design day this preset's winter-performance
// story is meant to be judged on. All three *Construction fields null so the
// preset's own multi-layer construction is used untouched.
const DEFAULTS: ShelterDesign = {
  location: { kind: 'preset', id: 'leh' },
  date: '2023-01-15',
  presetId: 'traditionalLadakhiByre',
  lengthM: 5,
  widthM: 5,
  heightM: 2.6,
  azimuthDeg: 0,
  wallConstruction: null,
  roofConstruction: null,
  floorConstruction: null,
  windowWwr: { S: 0.032, E: 0, W: 0, N: 0 }, // 0.8 m^2 / (5*2.6 m^2) south wall, this preset's window
  glazingId: 'singleGlazing',
  nightShutters: false,
  occupancyPresetId: 'familyLivestock',
};

// Starting thickness when a user picks a material for a surface. Reproduced
// verbatim from apps/server/src/assemble.ts (THICKNESS_OVERRIDE_M /
// DEFAULT_THICKNESS_BY_CATEGORY) -- the user can then change it.
const THICKNESS_OVERRIDE_M: Record<string, number> = {
  stoneMasonryGranite: 0.4,
  rammedEarth: 0.4,
  firedClayBrick: 0.23,
  denseConcrete: 0.2,
  rcc: 0.15,
  aacBlock: 0.2,
  timberPoplarWillow: 0.05,
  compressedEarthBlock: 0.3,
  mudPlaster: 0.08,
  cementPlaster: 0.02,
  eps: 0.1,
  xps: 0.1,
  puf: 0.05,
  glassWool: 0.1,
  rockWool: 0.1,
  strawBale: 0.35,
  sheepWool: 0.1,
  steelCGI: 0.0006,
  waterDrum: 0.2,
  gravelSoilFill: 0.1,
  pcmParaffinRT25: 0.03,
};
const DEFAULT_THICKNESS_BY_CATEGORY: Record<string, number> = {
  structural: 0.3,
  insulation: 0.1,
  finish: 0.02,
  storage: 0.2,
};

export function defaultThicknessM(materialId: string, category: string): number {
  return THICKNESS_OVERRIDE_M[materialId] ?? DEFAULT_THICKNESS_BY_CATEGORY[category] ?? 0.2;
}

/** Total layer thickness per surface type of a preset's own construction, so
 * the 3D viewer can draw a null (preset) construction at its real thickness. */
function presetThicknessM(
  surfaces: readonly { type: string; construction: readonly { thickness: number }[] }[],
): { wall: number; roof: number; floor: number } {
  const total = (type: string) => {
    const s = surfaces.find((x) => x.type === type);
    return s ? s.construction.reduce((sum, l) => sum + l.thickness, 0) : 0;
  };
  return { wall: total('wall'), roof: total('roof'), floor: total('floor') };
}

let cached: Options | undefined;

export function buildOptions(): Options {
  if (cached) return cached;
  cached = {
    locations: TMY_LOCATIONS.map(
      (l): LocationOption => ({
        id: l.id,
        name: l.name,
        latitude: l.latitude,
        longitude: l.longitude,
        elevation: l.elevation,
      }),
    ),
    presets: PRESETS.map(
      (p): PresetOption => ({
        id: p.id,
        name: p.name,
        description: p.description,
        locationId: p.locationId,
        thicknessM: presetThicknessM(p.request.building.surfaces),
      }),
    ),
    materials: MATERIALS.map(
      (m): MaterialOption => ({
        id: m.id,
        name: m.name,
        category: m.category,
        conductivity: m.k,
        defaultThicknessM: defaultThicknessM(m.id, m.category),
        ...(m.blurb !== undefined ? { blurb: m.blurb } : {}),
      }),
    ),
    glazings: GLAZING.map(
      (g): GlazingOption => ({
        id: g.id,
        name: g.name,
        U: g.U,
        SHGC: g.SHGC,
        ...(g.blurb !== undefined ? { blurb: g.blurb } : {}),
      }),
    ),
    occupancyPresets: OCCUPANCY_PRESETS.map(
      (o): OccupancyPresetOption => ({ id: o.id, name: o.name, blurb: o.blurb }),
    ),
    defaults: DEFAULTS,
    ranges: {
      azimuthDeg: { min: -180, max: 180 },
      lengthM: { min: 2, max: 30, step: 0.5 },
      widthM: { min: 2, max: 30, step: 0.5 },
      heightM: { min: 2, max: 6, step: 0.1 },
      thicknessM: { min: 0.02, max: 1.0 },
      windowWwr: { min: 0, max: 0.9, step: 0.05 },
    },
  };
  return cached;
}
