// apps/web/components/inputs/catalog.ts
//
// Small, STABLE, non-physics catalogue data the basic form needs but cannot
// get from `@shelter/data` at runtime.
//
// ponytail: this file duplicates plain configuration rows (which materials/
// how thick/how many windows a "shelter type" card implies, the glazing
// product table, the five bundled TMY town names) from
// `packages/data/src/{presets,glazing,tmy}.ts` instead of importing that
// package. That is a deliberate, documented ceiling, not an oversight --
// `lib/store.ts`'s own file header explains why: `@shelter/data`'s only
// export path is its barrel `index.ts`, which imports `tmy.ts`, which reads
// bundled JSON off disk via `new URL(literal, import.meta.url)`. Next's
// bundler (Turbopack/webpack) statically intercepts that exact syntax the
// moment ANY module reachable from the browser bundle imports
// `@shelter/data` at all -- even if the call is never reached at runtime --
// and fails the build ("Module not found: Can't resolve '../tmy/'"), the
// same wall `apps/web/next.config.mjs`'s header comment documents working
// around from the SERVER side (`serverExternalPackages` + a webpack
// `externals` entry) for `app/page.tsx`. `apps/web/components/inputs/**` is
// a browser (client) component tree, off that server-only path, and this
// task's allow-list is `components/inputs/** only` -- `next.config.mjs`,
// `app/page.tsx` and `@shelter/data` itself are all out of reach. No
// `/api/presets` or `/api/tmy` route exists to fetch this from either (only
// `/api/materials`, which this file's sibling `materialsApi.ts` DOES use).
//
// Upgrade path once someone owns it (an Area E task, not this one): add a
// small `/api/glazings` and `/api/presets` route (mirroring `/api/materials`,
// T-41) that serve `GLAZING`/`PRESETS` as JSON, and fetch them here instead
// of the static arrays below -- the shapes already match.
//
// The one thing this file genuinely CANNOT reproduce client-side is a
// location's actual weather (the bundled TMY hourly series) -- see
// `SimpleForm.tsx`'s location-control comment for how that gap is handled
// honestly rather than silently faked.

import type { Layer, WindowSpec } from '@shelter/engine';

// ============================== TMY LOCATIONS ==============================
// Plain geography, not physics -- copied verbatim from
// `packages/data/src/tmy.ts`'s `TMY_LOCATIONS`.

export interface TmyLocationSummary {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  elevation: number;
}

export const TMY_LOCATIONS: readonly TmyLocationSummary[] = [
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

// ============================== GLAZING CATALOGUE ==============================
// Copied verbatim (id/U/SHGC/tauVis/b0/source/blurb) from
// `packages/data/src/glazing.ts`'s `GLAZING` table, itself BLUEPRINT.md
// Appendix B. Kept in perfect sync manually today; see the header note above
// for the real fix.

export interface GlazingSummary {
  id: string;
  name: string;
  U: number;
  SHGC: number;
  tauVis: number;
  b0: number;
  source: string;
  blurb: string;
}

const GLAZING_TABLE_SOURCE =
  'BLUEPRINT.md Appendix B glazing table (U, SHGC, b0), compiled from ASHRAE Handbook of Fundamentals Ch. 15 (Fenestration) typical values per product class';

export const GLAZINGS: readonly GlazingSummary[] = [
  {
    id: 'singleGlazing',
    name: 'Single glazing',
    U: 5.8,
    SHGC: 0.86,
    tauVis: 0.9,
    b0: 0.04,
    source: GLAZING_TABLE_SOURCE,
    blurb: 'Single glazing: one sheet of glass, the cheapest window but loses heat fast.',
  },
  {
    id: 'doubleAirFilled',
    name: 'Double glazing, air-filled',
    U: 2.8,
    SHGC: 0.76,
    tauVis: 0.8,
    b0: 0.05,
    source: GLAZING_TABLE_SOURCE,
    blurb: 'Double glazing: two panes with an air gap between, a big step up from a single pane.',
  },
  {
    id: 'doubleArgonLowE',
    name: 'Double glazing, argon + low-E',
    U: 1.6,
    SHGC: 0.6,
    tauVis: 0.7,
    b0: 0.06,
    source: GLAZING_TABLE_SOURCE,
    blurb:
      'Double glazing with argon gas and a low-emissivity coating: keeps in much more heat than plain double glazing.',
  },
  {
    id: 'tripleGlazing',
    name: 'Triple glazing',
    U: 0.9,
    SHGC: 0.5,
    tauVis: 0.6,
    b0: 0.07,
    source: GLAZING_TABLE_SOURCE,
    blurb:
      'Triple glazing: three panes, the warmest window available here, but also the most expensive.',
  },
  {
    id: 'polycarbonateTwinWall',
    name: 'Polycarbonate twin-wall',
    U: 3.0,
    SHGC: 0.7,
    tauVis: 0.78,
    b0: 0.05,
    source: `${GLAZING_TABLE_SOURCE}; typical structured-polycarbonate sheet datasheet range (e.g. Danpalon / Palram twin-wall polycarbonate technical data sheet)`,
    blurb:
      'Twin-wall polycarbonate: a light plastic sheeting material, cheaper and tougher than glass for a Trombe wall or greenhouse face.',
  },
] as const;

export function glazingSummaryById(id: string): GlazingSummary {
  const g = GLAZINGS.find((x) => x.id === id);
  if (!g) throw new Error(`No bundled glazing summary for id "${id}"`);
  return g;
}

/** Single glazing + a closed night shutter, LOG.md 7.10: U_eff = 1/(1/U + R_shutter). */
export const NIGHT_SHUTTER_RESISTANCE = 0.4; // m^2*K/W, midpoint of the table's 0.3-0.5 range

// ============================== DEFAULT LAYER THICKNESS ==============================
// CALIBRATION KNOB (LOG.md global rule 14): when a beginner picks "wall
// material: X" with no thickness field on this basic panel, some default
// thickness must be assumed. These are representative, sourced values from
// `packages/data/src/constructions.ts`'s own named constructions (0.4 m
// stone/rammed-earth, 0.23 m fired brick, 0.15 m RCC, 0.1 m insulation board,
// a thin steel sheet), not invented -- see that file for the per-material
// sourcing. The material-stack editor (below) lets anyone who cares adjust
// this per surface with a slider; nobody has to accept it uncritically.
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

// ============================== SHELTER-TYPE PRESET CARDS ==============================
// The "shelter type / preset picker" control's six cards. Each summary
// carries only PLAIN CONFIGURATION data (which material, how thick, how many
// windows, how leaky, whose gains schedule) -- not weather -- reproduced
// from `packages/data/src/presets.ts`'s six named presets (same ids, same
// names, same layer lists) so a design loaded here matches the numbers in
// `VALIDATION.md`/CI. Only the SITE/WEATHER half of each preset cannot be
// reproduced client-side (see the file header); every preset here is applied
// against whatever location/weather the panel already has loaded.

export interface PresetSummary {
  id: string;
  name: string;
  blurb: string;
  locationId: string;
  wallLayers: Layer[];
  roofLayers: Layer[];
  floorLayers: Layer[];
  exteriorAbsorptivity: number;
  exteriorEmissivity: number;
  /** One window on the south wall, the common case for every bundled preset. */
  window: { areaM2: number; glazingId: string; nightShutter: boolean };
  achLevel: number;
  occupancyPresetId: string;
}

export const PRESET_SUMMARIES: readonly PresetSummary[] = [
  {
    id: 'traditionalLadakhiByre',
    name: 'Traditional Ladakhi house (with livestock byre)',
    blurb:
      'Thick rammed-earth walls, a mud-and-poplar roof, small windows, animals stabled below for their body heat.',
    locationId: 'leh',
    wallLayers: [{ materialId: 'rammedEarth', thickness: 0.4 }],
    roofLayers: [
      { materialId: 'mudPlaster', thickness: 0.08 },
      { materialId: 'timberPoplarWillow', thickness: 0.05 },
    ],
    floorLayers: [
      { materialId: 'gravelSoilFill', thickness: 0.1 },
      { materialId: 'rammedEarth', thickness: 0.05 },
    ],
    exteriorAbsorptivity: 0.7,
    exteriorEmissivity: 0.9,
    window: { areaM2: 0.8, glazingId: 'singleGlazing', nightShutter: false },
    achLevel: 2.0,
    occupancyPresetId: 'familyLivestock',
  },
  {
    id: 'armyBroBarrack',
    name: 'Army / BRO barrack (CGI sheet)',
    blurb:
      'Bare corrugated-galvanised-iron sheet walls and roof, no board insulation, large single-glazed windows.',
    locationId: 'leh',
    wallLayers: [{ materialId: 'steelCGI', thickness: 0.0006 }],
    roofLayers: [{ materialId: 'steelCGI', thickness: 0.0006 }],
    floorLayers: [{ materialId: 'rcc', thickness: 0.15 }],
    exteriorAbsorptivity: 0.6,
    exteriorEmissivity: 0.28,
    window: { areaM2: 4.0, glazingId: 'singleGlazing', nightShutter: false },
    achLevel: 0.8,
    occupancyPresetId: 'barrackPersonnel',
  },
  {
    id: 'modernRccNoInsulation',
    name: 'Modern RCC house (no insulation)',
    blurb:
      'Reinforced-concrete walls, roof and floor slab, reasonable double glazing, but no insulation anywhere.',
    locationId: 'leh',
    wallLayers: [{ materialId: 'rcc', thickness: 0.15 }],
    roofLayers: [{ materialId: 'rcc', thickness: 0.15 }],
    floorLayers: [{ materialId: 'rcc', thickness: 0.1 }],
    exteriorAbsorptivity: 0.65,
    exteriorEmissivity: 0.88,
    window: { areaM2: 2.0, glazingId: 'doubleAirFilled', nightShutter: false },
    achLevel: 0.5,
    occupancyPresetId: 'smallHousehold',
  },
  {
    id: 'geresTrombeRetrofit',
    name: 'GERES Trombe-wall retrofit (approximated)',
    blurb:
      'A massive, black-painted solar-absorber south wall behind a glazed cavity (approximated), rest unchanged.',
    locationId: 'leh',
    wallLayers: [{ materialId: 'denseConcrete', thickness: 0.3 }],
    roofLayers: [
      { materialId: 'mudPlaster', thickness: 0.08 },
      { materialId: 'timberPoplarWillow', thickness: 0.05 },
    ],
    floorLayers: [
      { materialId: 'gravelSoilFill', thickness: 0.1 },
      { materialId: 'rammedEarth', thickness: 0.05 },
    ],
    exteriorAbsorptivity: 0.95,
    exteriorEmissivity: 0.9,
    window: { areaM2: 0.5, glazingId: 'singleGlazing', nightShutter: false },
    achLevel: 1.0,
    occupancyPresetId: 'smallHousehold',
  },
  {
    id: 'optimisedPassivePlaceholder',
    name: 'Optimised passive design (placeholder)',
    blurb:
      'Rammed earth wrapped in outer insulation, insulated roof and floor, argon low-E glazing with a night shutter.',
    locationId: 'leh',
    wallLayers: [
      { materialId: 'eps', thickness: 0.1 },
      { materialId: 'rammedEarth', thickness: 0.35 },
    ],
    roofLayers: [
      { materialId: 'xps', thickness: 0.075 },
      { materialId: 'rcc', thickness: 0.12 },
    ],
    floorLayers: [
      { materialId: 'xps', thickness: 0.05 },
      { materialId: 'rcc', thickness: 0.1 },
    ],
    exteriorAbsorptivity: 0.25,
    exteriorEmissivity: 0.9,
    window: { areaM2: 3.0, glazingId: 'doubleArgonLowE', nightShutter: true },
    achLevel: 0.35,
    occupancyPresetId: 'smallHousehold',
  },
  {
    id: 'jaisalmerHotDryContrast',
    name: 'Jaisalmer hot-dry desert house',
    blurb:
      'Thick stone walls, whitewashed exterior, small shaded windows -- the same tool applied outside Ladakh.',
    locationId: 'jaisalmer',
    wallLayers: [{ materialId: 'stoneMasonryGranite', thickness: 0.4 }],
    roofLayers: [{ materialId: 'rcc', thickness: 0.15 }],
    floorLayers: [
      { materialId: 'gravelSoilFill', thickness: 0.1 },
      { materialId: 'rammedEarth', thickness: 0.05 },
    ],
    exteriorAbsorptivity: 0.25,
    exteriorEmissivity: 0.9,
    window: { areaM2: 0.6, glazingId: 'singleGlazing', nightShutter: false },
    achLevel: 1.0,
    occupancyPresetId: 'smallHousehold',
  },
] as const;

export function presetSummaryById(id: string): PresetSummary {
  const p = PRESET_SUMMARIES.find((x) => x.id === id);
  if (!p) throw new Error(`No preset summary for id "${id}"`);
  return p;
}

// ============================== OCCUPANCY / HEATING PRESETS ==============================
// The 10th basic control. Each preset is a plain (schedule, aux-heater)
// pair, not a physics computation -- gains figures copied from
// `packages/data/src/presets.ts`'s own per-preset schedules and
// `GAIN_WATTS`-derived constants (adultSeated=70W, adultActive=150W typical
// metabolic figures, livestock=500W/animal), all cited there.
export interface OccupancyPreset {
  id: string;
  name: string;
  blurb: string;
  internalGainsSchedule: number[]; // 24 values, W
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
    hasUnventedCombustion: true, // a bukhari stove is typical in this archetype
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

export function defaultWindowSpecFor(
  hostSurfaceId: string,
  window: PresetSummary['window'],
): WindowSpec {
  return window.nightShutter
    ? {
        id: `${hostSurfaceId}Window`,
        hostSurfaceId,
        area: window.areaM2,
        glazingId: window.glazingId,
        shadingSchedule: Array.from({ length: 24 }, (_, h) => h >= 20 || h < 6),
        shutterResistance: NIGHT_SHUTTER_RESISTANCE,
      }
    : {
        id: `${hostSurfaceId}Window`,
        hostSurfaceId,
        area: window.areaM2,
        glazingId: window.glazingId,
      };
}
