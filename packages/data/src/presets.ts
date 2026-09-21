/**
 * Named presets. `log/AREA-C-data-layer.md` T-28, `CHALLENGE.md` C-19.
 *
 * `CHALLENGE.md` C-19 calls an empty first screen an underrated failure: a
 * presenter filling in a form while judges watch. These six presets are the
 * fixed points that let the app open on a result instead -- and the same
 * fixture set T-04's CI energy-balance gate checks on every commit, and the
 * archetypes the Compare screen (Area F) starts from.
 *
 * `Preset.request` deliberately omits `weather`/`materials`/`glazings`
 * (`packages/engine/src/types.ts`) -- a caller resolves `locationId` via
 * `tmyById()`/`groundAlbedoById()` (T-27) and the `materialId`/`glazingId`
 * references below via `materialById()`/`glazingById()` (T-24) at call time.
 * This file itself only READS those catalogues (to fail fast on a typo'd id,
 * same pattern as `constructions.ts`'s own self-check loop) -- it never
 * touches `materials.ts`, `glazing.ts`, `constructions.ts` or `tmy/*`.
 *
 * `@shelter/data` is allowed exactly one runtime dependency, `@shelter/engine`
 * (`CONTRACTS.md` D-10, already how `tmy.ts` imports `EngineError`/
 * `seriesFromJson`) -- this file leans on that for `Preset`/`SimulationRequest`
 * and the other request-shape types, `DEFAULT_SIM_OPTIONS`, `toK`/`asK`,
 * `GAIN_WATTS` and `EngineError`, rather than re-declaring any of them.
 *
 * All six houses share one simple box geometry (5 m x 5 m floor, 2.6 m tall,
 * 4 walls + a flat roof + a ground-coupled floor) so the only thing that
 * differs preset to preset is envelope, glazing, operation and site -- the
 * comparison the Compare screen (and acceptance tests 5/6 below) needs is
 * apples to apples, not confounded by a second geometry change at the same
 * time.
 */
import type {
  Building,
  Layer,
  Operation,
  Preset,
  Site,
  Surface,
  SimulationRequest,
  WindowSpec,
} from '@shelter/engine';
import { ACH_MIN, DEFAULT_SIM_OPTIONS, EngineError, GAIN_WATTS, asK, toK } from '@shelter/engine';
import { materialById } from './materials.js';
import { glazingById } from './glazing.js';
import { TMY_LOCATIONS, groundAlbedoById, tmyById } from './tmy.js';

export const SCHEMA_VERSION = 1;

// ============================== SHARED GEOMETRY ==============================

const SIDE = 5; // m
const HEIGHT = 2.6; // m
/** Gross wall face area, m^2 -- INCLUDES any window cut into it. `solve/assemble.ts`
 * subtracts window area from `Surface.area` to get the opaque conduction area
 * (`packages/engine/src/index.ts`'s own `envelopeAreaM2` comment, and every
 * existing fixture, e.g. `packages/data/test/tmy.test.ts` test 11, builds
 * `Surface.area` this way) -- despite `CONTRACTS.md` 7.5's warning text
 * reading "NET, not gross", the code every other task actually shipped against
 * is GROSS. Followed here for consistency with the working, tested precedent;
 * flagged in this task's log entry as a doc/code discrepancy worth a follow-up
 * fix to `CONTRACTS.md` itself, not something to resolve unilaterally here. */
const WALL_AREA = SIDE * HEIGHT; // 13 m^2
const ROOF_AREA = SIDE * SIDE; // 25 m^2
const FLOOR_AREA = SIDE * SIDE; // 25 m^2
const VOLUME = SIDE * SIDE * HEIGHT; // 65 m^3

function wall(
  id: string,
  azimuth: number,
  construction: Layer[],
  exteriorAbsorptivity: number,
  exteriorEmissivity: number,
): Surface {
  return {
    id,
    type: 'wall',
    area: WALL_AREA,
    tilt: 90,
    azimuth, // -90 = east, 0 = south, 90 = west, 180 = north (LOG.md 7.5)
    construction,
    boundary: 'exterior',
    exteriorAbsorptivity,
    exteriorEmissivity,
    interiorEmissivity: 0.9,
  };
}

function roof(
  construction: Layer[],
  exteriorAbsorptivity: number,
  exteriorEmissivity: number,
): Surface {
  return {
    id: 'roof',
    type: 'roof',
    area: ROOF_AREA,
    tilt: 0,
    azimuth: 0,
    construction,
    boundary: 'exterior',
    exteriorAbsorptivity,
    exteriorEmissivity,
    interiorEmissivity: 0.9,
  };
}

/** Ground-coupled per `loads/ground.ts` / `heatFlows.test.ts`'s own `januaryLehDay`
 * fixture -- "the floor is coupled to this, not to ambient air, and not
 * adiabatic" (CONTRACTS.md 7.10). exteriorAbsorptivity/exteriorEmissivity are
 * unused on a ground-boundary surface but still validated to be in [0,1]. */
function floor(construction: Layer[]): Surface {
  return {
    id: 'floor',
    type: 'floor',
    area: FLOOR_AREA,
    tilt: 180,
    azimuth: 0,
    construction,
    boundary: 'ground',
    exteriorAbsorptivity: 0.6,
    exteriorEmissivity: 0.9,
    interiorEmissivity: 0.9,
  };
}

const COMFORT_BAND_LADAKH = { lower: toK(15), upper: toK(24) } as const; // 288.15-297.15 K, LOG.md 7.11 -- NOT the 293.15 ASHRAE office band

const NO_AUX_HEATING = { enabled: false, setpoint: toK(15), maxPower: 0 };

// ============================== SITES ==============================

function siteFor(locationId: string, groundTempMeanAnnual: number): Site {
  const loc = TMY_LOCATIONS.find((l) => l.id === locationId);
  if (!loc)
    throw new EngineError(
      'INVALID_INPUT',
      `No bundled TMY location "${locationId}" to build a preset Site from.`,
      { locationId },
    );
  return {
    id: loc.id,
    name: loc.name,
    latitude: loc.latitude,
    longitude: loc.longitude,
    elevation: loc.elevation,
    standardMeridian: 82.5, // IST, every bundled location (LOG.md 7.11)
    groundAlbedo: groundAlbedoById(loc.id), // seasonal (snow) series, T-27
    groundTempMeanAnnual: asK(groundTempMeanAnnual),
  };
}

// Leh: LOG.md 7.11's own numbers, verbatim -- 279.15 K = 6 degC.
const SITE_LEH = siteFor('leh', toK(6));

// Jaisalmer has no LOG.md-stated groundTempMeanAnnual (only Leh's is given).
// Kusuda-Achenbach's own physical basis is "deep soil sits near the site's
// annual mean air temperature" (loads/ground.ts's header comment) -- so, absent
// a stated figure, the real bundled 2023 NASA POWER series for Jaisalmer
// (T-27) is used to compute that mean directly, rather than inventing a
// number. Documented in the preset's own description too.
function annualMeanK(id: string): number {
  const series = tmyById(id);
  let sum = 0;
  for (let i = 0; i < series.T_amb.length; i++) sum += series.T_amb[i]!;
  return sum / series.T_amb.length;
}
const SITE_JAISALMER = siteFor('jaisalmer', annualMeanK('jaisalmer'));

// ============================== OPTIONS ==============================

/**
 * `skyModel: 'isotropic'`, NOT `DEFAULT_SIM_OPTIONS`'s own `'hdkr'` default.
 *
 * DISCOVERED ENGINE BUG (out of this task's file-scope, `packages/engine/**`
 * -- reported upward per LOG.md global rule 16, not fixed here): every Ladakh
 * preset genuinely diverged (`EngineError('SOLVER_DIVERGED', ...)`, a fabric
 * node past the plausibility guard) with the default `'hdkr'` sky model, at
 * ~07:30 local on Leh's own bundled January 1st weather, regardless of
 * construction -- reproduced on five structurally unrelated envelopes
 * (traditional/barrack/RCC/Trombe/optimised) and bisected down to
 * `packages/engine/src/solar/transposition.ts`'s HDKR branch:
 *   `Rb = sun.cosZenith > 1e-6 ? cosTheta / sun.cosZenith : 0`
 * has a lower floor (1e-6) but NO upper clamp. At Leh's latitude in January,
 * `sunPosition(34.15, 77.58, 82.5, 1, 7.5).cosZenith` is 0.0014 (sun ~0.08 deg
 * above the horizon) while `cosTheta` on a south wall is not similarly tiny,
 * so `Rb` reaches several hundred and `diffuse = DHI * Ai * Rb` spikes to an
 * unphysical multi-kW/m^2 for that one hour -- exactly the failure mode this
 * task hit. `packages/data/test/tmy.test.ts`'s own T-27 fixture already works
 * around this by hardcoding `skyModel: 'isotropic'` rather than the default;
 * this file follows that same precedent rather than leaving the (correct,
 * more accurate on a clear day) HDKR model silently broken for every
 * high-latitude-winter preset. Flagged for Area B / whoever owns
 * `solar/transposition.ts` to add the missing clamp (e.g. cap `Rb` at some
 * plausible bound, or gate the HDKR branch on solar altitude) -- see this
 * task's Evidence block in `log/AREA-C-data-layer.md`.
 */
const OPTIONS: SimulationRequest['options'] = {
  ...DEFAULT_SIM_OPTIONS,
  simulationDays: 1,
  skyModel: 'isotropic',
};

// ============================== BUILDING HELPER ==============================

function building(
  surfaces: Surface[],
  windows: WindowSpec[],
  thermalBridgeFactor: number,
): Building {
  return {
    floorArea: FLOOR_AREA,
    volume: VOLUME,
    azimuth: 0,
    surfaces,
    windows,
    thermalBridgeFactor,
  };
}

function achAll(value: number): number[] {
  return new Array(24).fill(value);
}

// ============================== PRESET 1 -- TRADITIONAL LADAKHI HOUSE ==============================

const RAMMED_EARTH_400: Layer[] = [{ materialId: 'rammedEarth', thickness: 0.4 }];
const MUD_POPLAR_ROOF: Layer[] = [
  { materialId: 'mudPlaster', thickness: 0.08 },
  { materialId: 'timberPoplarWillow', thickness: 0.05 },
];
const EARTH_FLOOR: Layer[] = [
  { materialId: 'gravelSoilFill', thickness: 0.1 },
  { materialId: 'rammedEarth', thickness: 0.05 },
];
// Surface optical properties, CONTRACTS.md 7.11: "Dark mud / earth" alphaSolar 0.70, emissivity 0.90.
const DARK_MUD_EARTH = { exteriorAbsorptivity: 0.7, exteriorEmissivity: 0.9 };

// 3 animals in the ground-floor byre, 500 W each (GAIN_WATTS.livestockPerAnimal,
// loads/internal.ts -- "a real vernacular passive strategy, not a curiosity"),
// present around the clock; people come and go and cook morning/evening.
const LIVESTOCK_ANIMALS = 3;
const traditionalGains: number[] = (() => {
  const livestock = GAIN_WATTS.livestockPerAnimal * LIVESTOCK_ANIMALS; // 1500 W, all 24 h
  const gains = new Array(24).fill(livestock + GAIN_WATTS.adultSeated); // baseline: 1 person home
  for (let h = 6; h < 9; h++)
    gains[h] = livestock + 2 * GAIN_WATTS.adultActive + GAIN_WATTS.cooking; // morning cooking
  for (let h = 18; h < 21; h++)
    gains[h] = livestock + 2 * GAIN_WATTS.adultActive + GAIN_WATTS.cooking; // evening cooking
  for (let h = 21; h < 24; h++) gains[h] = livestock + 2 * GAIN_WATTS.adultSeated; // asleep, 2 people
  for (let h = 0; h < 6; h++) gains[h] = livestock + 2 * GAIN_WATTS.adultSeated; // asleep, 2 people
  return gains;
})();

const PRESET_TRADITIONAL: Preset = {
  id: 'traditionalLadakhiByre',
  name: 'Traditional Ladakhi house (with livestock byre)',
  description:
    'A traditional Ladakhi house: thick rammed-earth (stone-and-mud) walls, a mud-and-poplar roof, and small windows. ' +
    'Animals are stabled in a byre on the ground floor -- their body heat (about 500 W per animal, 3 animals here) ' +
    'rises into the living space above and measurably helps keep it warm overnight, a real vernacular passive-heating ' +
    'strategy still used across Ladakh, not a curiosity. The envelope is leaky (about 2 air changes per hour) by ' +
    "today's standards, with no insulation and no auxiliary heater.",
  locationId: 'leh',
  request: {
    site: SITE_LEH,
    building: building(
      [
        wall(
          'wallSouth',
          0,
          RAMMED_EARTH_400,
          DARK_MUD_EARTH.exteriorAbsorptivity,
          DARK_MUD_EARTH.exteriorEmissivity,
        ),
        wall(
          'wallEast',
          -90,
          RAMMED_EARTH_400,
          DARK_MUD_EARTH.exteriorAbsorptivity,
          DARK_MUD_EARTH.exteriorEmissivity,
        ),
        wall(
          'wallWest',
          90,
          RAMMED_EARTH_400,
          DARK_MUD_EARTH.exteriorAbsorptivity,
          DARK_MUD_EARTH.exteriorEmissivity,
        ),
        wall(
          'wallNorth',
          180,
          RAMMED_EARTH_400,
          DARK_MUD_EARTH.exteriorAbsorptivity,
          DARK_MUD_EARTH.exteriorEmissivity,
        ),
        roof(
          MUD_POPLAR_ROOF,
          DARK_MUD_EARTH.exteriorAbsorptivity,
          DARK_MUD_EARTH.exteriorEmissivity,
        ),
        floor(EARTH_FLOOR),
      ],
      [{ id: 'windowSouth', hostSurfaceId: 'wallSouth', area: 0.8, glazingId: 'singleGlazing' }], // small windows
      1.1,
    ),
    operation: {
      internalGainsSchedule: traditionalGains,
      achSchedule: achAll(2.0), // leaky, ACH ~= 2.0
      auxHeating: NO_AUX_HEATING,
      comfortBand: COMFORT_BAND_LADAKH,
    },
    options: OPTIONS,
  },
};

// ============================== PRESET 2 -- ARMY / BRO BARRACK ==============================

// Bare CGI sheet, no board insulation ("minimal insulation" per the PROMPT) --
// deliberately NOT constructions.ts's `cgiPuf50`, which bonds 50 mm PUF board
// underneath and would contradict "minimal insulation".
const BARE_STEEL_CGI: Layer[] = [{ materialId: 'steelCGI', thickness: 0.0006 }];
const RCC_150: Layer[] = [{ materialId: 'rcc', thickness: 0.15 }];
// "Galvanised steel, weathered" per CONTRACTS.md 7.11 -- the steelCGI material's own finish.
const GALVANISED_WEATHERED = { exteriorAbsorptivity: 0.6, exteriorEmissivity: 0.28 };

const barrackGains: number[] = (() => {
  const gains = new Array(24).fill(2 * GAIN_WATTS.adultSeated); // 2 personnel on quarters duty
  for (let h = 6; h < 8; h++) gains[h] = 4 * GAIN_WATTS.adultActive + GAIN_WATTS.cooking; // morning muster + mess
  for (let h = 18; h < 22; h++) gains[h] = 4 * GAIN_WATTS.adultActive + GAIN_WATTS.cooking; // evening return
  return gains;
})();

const PRESET_BARRACK: Preset = {
  id: 'armyBroBarrack',
  name: 'Army / BRO barrack (CGI sheet)',
  description:
    'A typical high-altitude Army/BRO barrack hut: bare corrugated-galvanised-iron (CGI) sheet walls and roof with ' +
    'no board insulation, and large single-glazed windows for daylight. Thin and lightweight, so it tracks the outdoor ' +
    'temperature far more closely than a heavy earth or stone wall -- the classic "the tin shed is an oven by day and ' +
    'a fridge by night" complaint from troops posted at altitude.',
  locationId: 'leh',
  request: {
    site: SITE_LEH,
    building: building(
      [
        wall(
          'wallSouth',
          0,
          BARE_STEEL_CGI,
          GALVANISED_WEATHERED.exteriorAbsorptivity,
          GALVANISED_WEATHERED.exteriorEmissivity,
        ),
        wall(
          'wallEast',
          -90,
          BARE_STEEL_CGI,
          GALVANISED_WEATHERED.exteriorAbsorptivity,
          GALVANISED_WEATHERED.exteriorEmissivity,
        ),
        wall(
          'wallWest',
          90,
          BARE_STEEL_CGI,
          GALVANISED_WEATHERED.exteriorAbsorptivity,
          GALVANISED_WEATHERED.exteriorEmissivity,
        ),
        wall(
          'wallNorth',
          180,
          BARE_STEEL_CGI,
          GALVANISED_WEATHERED.exteriorAbsorptivity,
          GALVANISED_WEATHERED.exteriorEmissivity,
        ),
        roof(
          BARE_STEEL_CGI,
          GALVANISED_WEATHERED.exteriorAbsorptivity,
          GALVANISED_WEATHERED.exteriorEmissivity,
        ),
        floor(RCC_150),
      ],
      [
        { id: 'windowSouth', hostSurfaceId: 'wallSouth', area: 4.0, glazingId: 'singleGlazing' }, // large single glazing
        { id: 'windowEast', hostSurfaceId: 'wallEast', area: 1.5, glazingId: 'singleGlazing' },
        { id: 'windowWest', hostSurfaceId: 'wallWest', area: 1.5, glazingId: 'singleGlazing' },
      ],
      1.15, // steel-frame fastener/purlin bridging
    ),
    operation: {
      internalGainsSchedule: barrackGains,
      achSchedule: achAll(0.8),
      auxHeating: NO_AUX_HEATING,
      comfortBand: COMFORT_BAND_LADAKH,
    },
    options: OPTIONS,
  },
};

// ============================== PRESET 3 -- MODERN RCC ==============================

const RCC_150_FLOOR: Layer[] = [{ materialId: 'rcc', thickness: 0.1 }];
// "Grey concrete" per CONTRACTS.md 7.11.
const GREY_CONCRETE = { exteriorAbsorptivity: 0.65, exteriorEmissivity: 0.88 };

const modernGains: number[] = (() => {
  const gains = new Array(24).fill(GAIN_WATTS.adultSeated); // 1 person home
  for (let h = 7; h < 9; h++) gains[h] = 3 * GAIN_WATTS.adultActive + GAIN_WATTS.cooking;
  for (let h = 19; h < 23; h++) gains[h] = 3 * GAIN_WATTS.adultActive + GAIN_WATTS.cooking;
  return gains;
})();

const PRESET_MODERN_RCC: Preset = {
  id: 'modernRccNoInsulation',
  name: 'Modern RCC house (no insulation)',
  description:
    'The common new-build failure case: reinforced-concrete (RCC) walls, roof and floor slab, with reasonably good ' +
    'double glazing on the windows but no insulation anywhere in the heavy concrete envelope itself. High thermal ' +
    'mass alone is not enough -- without insulation the concrete simply conducts heat straight out, night after night.',
  locationId: 'leh',
  request: {
    site: SITE_LEH,
    building: building(
      [
        wall(
          'wallSouth',
          0,
          RCC_150,
          GREY_CONCRETE.exteriorAbsorptivity,
          GREY_CONCRETE.exteriorEmissivity,
        ),
        wall(
          'wallEast',
          -90,
          RCC_150,
          GREY_CONCRETE.exteriorAbsorptivity,
          GREY_CONCRETE.exteriorEmissivity,
        ),
        wall(
          'wallWest',
          90,
          RCC_150,
          GREY_CONCRETE.exteriorAbsorptivity,
          GREY_CONCRETE.exteriorEmissivity,
        ),
        wall(
          'wallNorth',
          180,
          RCC_150,
          GREY_CONCRETE.exteriorAbsorptivity,
          GREY_CONCRETE.exteriorEmissivity,
        ),
        roof(RCC_150, GREY_CONCRETE.exteriorAbsorptivity, GREY_CONCRETE.exteriorEmissivity), // flat, uninsulated RCC roof
        floor(RCC_150_FLOOR),
      ],
      [
        { id: 'windowSouth', hostSurfaceId: 'wallSouth', area: 2.0, glazingId: 'doubleAirFilled' },
        { id: 'windowEast', hostSurfaceId: 'wallEast', area: 1.0, glazingId: 'doubleAirFilled' },
        { id: 'windowWest', hostSurfaceId: 'wallWest', area: 1.0, glazingId: 'doubleAirFilled' },
      ],
      1.15, // RCC frame thermal bridging at every slab/column junction
    ),
    operation: {
      internalGainsSchedule: modernGains,
      achSchedule: achAll(0.5), // tighter modern doors/windows
      auxHeating: NO_AUX_HEATING,
      comfortBand: COMFORT_BAND_LADAKH,
    },
    options: OPTIONS,
  },
};

// ============================== PRESET 4 -- GERES TROMBE-WALL RETROFIT (APPROXIMATED) ==============================

// A true Trombe wall is a separate glazing pane over a ventilated air cavity in
// front of a massive absorber wall -- a second glazed surface with its own
// radiative/convective exchange and (often) top/bottom vents, none of which
// exists in `SimulationRequest` today (LOG.md global rule 12: "anything outside
// the eleven energy pathways requires a written justification before a line is
// written" -- a real two-node cavity model is exactly that kind of addition,
// out of scope for this task). Approximated instead as the massive absorber
// wall alone, painted black for high solar absorptance, with an extra sealed
// 25 mm air-gap LAYER (`airGap25mm`, R ~= 0.18 m^2*K/W) on its outside face
// standing in for "added surface resistance" from the glazing + cavity. This
// captures the resistance the glazing adds but NOT the cavity's convection
// suppression, its trapped-air greenhouse boost, or a real installation's vents
// -- named in `approximations` below per LOG.md global rule 13.
const TROMBE_SOUTH_WALL: Layer[] = [
  { materialId: 'airGap25mm', thickness: 0.025 },
  { materialId: 'denseConcrete', thickness: 0.3 },
];
// "Black paint" per CONTRACTS.md 7.11 -- the absorber face is painted black, as a real Trombe wall's is.
const BLACK_PAINT = { exteriorAbsorptivity: 0.95, exteriorEmissivity: 0.9 };

const trombeGains: number[] = (() => {
  const gains = new Array(24).fill(GAIN_WATTS.adultSeated); // 1 person home
  for (let h = 6; h < 9; h++) gains[h] = 2 * GAIN_WATTS.adultActive + GAIN_WATTS.cooking;
  for (let h = 18; h < 21; h++) gains[h] = 2 * GAIN_WATTS.adultActive + GAIN_WATTS.cooking;
  for (let h = 21; h < 24; h++) gains[h] = 2 * GAIN_WATTS.adultSeated;
  for (let h = 0; h < 6; h++) gains[h] = 2 * GAIN_WATTS.adultSeated;
  return gains;
})();

const PRESET_TROMBE: Preset = {
  id: 'geresTrombeRetrofit',
  name: 'GERES Trombe-wall retrofit (approximated)',
  description:
    'A GERES-style passive-solar retrofit of a traditional house: the existing south wall is replaced with a massive, ' +
    'black-painted solar-absorber wall behind a glazed air cavity, which soaks up daytime sun and slowly releases it ' +
    'indoors after dark. The rest of the house (other walls, roof, floor) is unchanged from the traditional design. ' +
    'The glazed cavity itself is approximated, not fully modelled -- see the approximations note.',
  approximations: [
    "The Trombe wall's glazing + ventilated air cavity is approximated as a single extra 25 mm sealed-air-gap layer " +
      'on the outside of the massive absorber wall (added surface resistance only). A real two-air-node Trombe model ' +
      '-- a separate glazing pane, cavity convection, and top/bottom vents -- is out of scope (LOG.md global rule 12); ' +
      "this cannot capture the cavity's trapped-air heat boost or a real installation's summer vent-bypass behaviour.",
  ],
  locationId: 'leh',
  request: {
    site: SITE_LEH,
    building: building(
      [
        wall(
          'wallSouth',
          0,
          TROMBE_SOUTH_WALL,
          BLACK_PAINT.exteriorAbsorptivity,
          BLACK_PAINT.exteriorEmissivity,
        ),
        wall(
          'wallEast',
          -90,
          RAMMED_EARTH_400,
          DARK_MUD_EARTH.exteriorAbsorptivity,
          DARK_MUD_EARTH.exteriorEmissivity,
        ),
        wall(
          'wallWest',
          90,
          RAMMED_EARTH_400,
          DARK_MUD_EARTH.exteriorAbsorptivity,
          DARK_MUD_EARTH.exteriorEmissivity,
        ),
        wall(
          'wallNorth',
          180,
          RAMMED_EARTH_400,
          DARK_MUD_EARTH.exteriorAbsorptivity,
          DARK_MUD_EARTH.exteriorEmissivity,
        ),
        roof(
          MUD_POPLAR_ROOF,
          DARK_MUD_EARTH.exteriorAbsorptivity,
          DARK_MUD_EARTH.exteriorEmissivity,
        ),
        floor(EARTH_FLOOR),
      ],
      [{ id: 'windowEast', hostSurfaceId: 'wallEast', area: 0.5, glazingId: 'singleGlazing' }], // small daylighting window; the south face is the Trombe wall, not a window
      1.1,
    ),
    operation: {
      internalGainsSchedule: trombeGains,
      achSchedule: achAll(1.0), // retrofit tightens the envelope somewhat vs. the fully traditional 2.0
      auxHeating: NO_AUX_HEATING,
      comfortBand: COMFORT_BAND_LADAKH,
    },
    options: OPTIONS,
  },
};

// ============================== PRESET 5 -- "OPTIMISED PASSIVE DESIGN" (PLACEHOLDER) ==============================

// NOT a sweep result. T-56 (the design-search/optimiser, LOG.md 7.15's
// `SweepRequest`/`sweep()`) does not exist yet in this codebase, so there is no
// procedure that could have produced a genuine "optimised" winner to paste here
// -- claiming otherwise would be exactly the failure AUDIT.md C-16 records
// ("hand-authored and presented as optimised" in the original plan). This is a
// hand-authored, reasonably well-insulated stand-in so the UI has *something*
// to show under this preset today: insulation on the outside of a rammed-earth
// mass wall, an insulated roof and floor slab, a south-facing argon/low-E
// double-glazed window with a closable night shutter, and the ACH held exactly
// at the ACH_MIN safety floor (never below it, per LOG.md global rule 10).
// `approximations` below carries the explicit placeholder marker instead of a
// fabricated `SweepRequest` (acceptance test 8 accepts either). When T-56
// ships: run a real sweep over this same base building, take the Pareto winner,
// paste ITS `SweepRequest` and result here in place of this comment, and delete
// this placeholder marker. Tracked for T-56 to close.
const OPTIMISED_WALL: Layer[] = [
  { materialId: 'eps', thickness: 0.1 },
  { materialId: 'rammedEarth', thickness: 0.35 },
];
const OPTIMISED_ROOF: Layer[] = [
  { materialId: 'xps', thickness: 0.075 },
  { materialId: 'rcc', thickness: 0.12 },
];
const OPTIMISED_FLOOR: Layer[] = [
  { materialId: 'xps', thickness: 0.05 },
  { materialId: 'rcc', thickness: 0.1 },
];
// "Whitewash / lime" per CONTRACTS.md 7.11 -- light render over the outer insulation, reduces summer overheating risk.
const WHITEWASH = { exteriorAbsorptivity: 0.25, exteriorEmissivity: 0.9 };
// 24 values: shutter closed 20:00-06:00 (WindowSpec.shadingSchedule, LOG.md 7.5).
const NIGHT_SHUTTER_SCHEDULE: boolean[] = Array.from({ length: 24 }, (_, h) => h >= 20 || h < 6);

const optimisedGains: number[] = (() => {
  const gains = new Array(24).fill(GAIN_WATTS.adultSeated); // 1 person home
  for (let h = 7; h < 9; h++) gains[h] = 2 * GAIN_WATTS.adultActive + GAIN_WATTS.cooking;
  for (let h = 19; h < 22; h++) gains[h] = 2 * GAIN_WATTS.adultActive + GAIN_WATTS.cooking;
  return gains;
})();

const PRESET_OPTIMISED_PLACEHOLDER: Preset = {
  id: 'optimisedPassivePlaceholder',
  name: 'Optimised passive design (placeholder)',
  description:
    'A well-insulated passive design: rammed-earth mass walls wrapped in outer insulation, an insulated roof and ' +
    'floor slab, and a south-facing argon-filled low-E window with a closable night shutter, sealed to exactly the ' +
    'safety-floor ventilation rate. This is a hand-picked stand-in, not the output of a real design search -- see the ' +
    'approximations note.',
  approximations: ['placeholder -- to be replaced by a real sweep winner, see T-56'],
  locationId: 'leh',
  request: {
    site: SITE_LEH,
    building: building(
      [
        wall(
          'wallSouth',
          0,
          OPTIMISED_WALL,
          WHITEWASH.exteriorAbsorptivity,
          WHITEWASH.exteriorEmissivity,
        ),
        wall(
          'wallEast',
          -90,
          OPTIMISED_WALL,
          WHITEWASH.exteriorAbsorptivity,
          WHITEWASH.exteriorEmissivity,
        ),
        wall(
          'wallWest',
          90,
          OPTIMISED_WALL,
          WHITEWASH.exteriorAbsorptivity,
          WHITEWASH.exteriorEmissivity,
        ),
        wall(
          'wallNorth',
          180,
          OPTIMISED_WALL,
          WHITEWASH.exteriorAbsorptivity,
          WHITEWASH.exteriorEmissivity,
        ),
        roof(OPTIMISED_ROOF, WHITEWASH.exteriorAbsorptivity, WHITEWASH.exteriorEmissivity),
        floor(OPTIMISED_FLOOR),
      ],
      [
        {
          id: 'windowSouth',
          hostSurfaceId: 'wallSouth',
          area: 3.0,
          glazingId: 'doubleArgonLowE',
          shadingSchedule: NIGHT_SHUTTER_SCHEDULE,
          shutterResistance: 0.4,
        },
      ],
      1.05, // careful, low-thermal-bridge detailing
    ),
    operation: {
      internalGainsSchedule: optimisedGains,
      achSchedule: achAll(ACH_MIN), // sealed to exactly the 0.35 safety floor, never below it
      auxHeating: NO_AUX_HEATING,
      comfortBand: COMFORT_BAND_LADAKH,
    },
    options: OPTIONS,
  },
};

// ============================== PRESET 6 -- JAISALMER HOT-DRY CONTRAST ==============================

const STONE_MASONRY_400: Layer[] = [{ materialId: 'stoneMasonryGranite', thickness: 0.4 }];
const EARTH_FLOOR_DESERT: Layer[] = [
  { materialId: 'gravelSoilFill', thickness: 0.1 },
  { materialId: 'rammedEarth', thickness: 0.05 },
];

const jaisalmerGains: number[] = (() => {
  const gains = new Array(24).fill(GAIN_WATTS.adultSeated); // 1 person home
  for (let h = 7; h < 9; h++) gains[h] = 3 * GAIN_WATTS.adultActive + GAIN_WATTS.cooking;
  for (let h = 19; h < 22; h++) gains[h] = 3 * GAIN_WATTS.adultActive + GAIN_WATTS.cooking;
  return gains;
})();

const PRESET_JAISALMER: Preset = {
  id: 'jaisalmerHotDryContrast',
  name: 'Jaisalmer hot-dry desert house',
  description:
    'A non-Ladakh contrast case at Jaisalmer, in the Thar desert: the same simulator applied to a different, hot-dry ' +
    'climate to show the tool generalises beyond Ladakh (the problem statement asks for exactly this). Thick stone ' +
    'walls give the house thermal mass to ride out the huge day-night desert swing, a whitewashed exterior reflects ' +
    'the fierce summer sun, and windows are kept small with shading overhangs to cut solar heat gain. The comfort ' +
    'band is kept the same 15-24 degC band as every Ladakh preset here (not re-derived for a hot climate) so the KPIs ' +
    'stay directly comparable on the Compare screen -- a simplification, not a claim that 15-24 degC is the right ' +
    'hot-climate comfort target.',
  locationId: 'jaisalmer',
  request: {
    site: SITE_JAISALMER,
    building: building(
      [
        wall(
          'wallSouth',
          0,
          STONE_MASONRY_400,
          WHITEWASH.exteriorAbsorptivity,
          WHITEWASH.exteriorEmissivity,
        ),
        wall(
          'wallEast',
          -90,
          STONE_MASONRY_400,
          WHITEWASH.exteriorAbsorptivity,
          WHITEWASH.exteriorEmissivity,
        ),
        wall(
          'wallWest',
          90,
          STONE_MASONRY_400,
          WHITEWASH.exteriorAbsorptivity,
          WHITEWASH.exteriorEmissivity,
        ),
        wall(
          'wallNorth',
          180,
          STONE_MASONRY_400,
          WHITEWASH.exteriorAbsorptivity,
          WHITEWASH.exteriorEmissivity,
        ),
        roof(RCC_150, WHITEWASH.exteriorAbsorptivity, WHITEWASH.exteriorEmissivity), // common flat desert roof, whitewashed
        floor(EARTH_FLOOR_DESERT),
      ],
      [
        {
          id: 'windowSouth',
          hostSurfaceId: 'wallSouth',
          area: 0.6,
          glazingId: 'singleGlazing',
          overhangDepth: 0.5,
          overhangHeightAbove: 0.3,
        },
        { id: 'windowNorth', hostSurfaceId: 'wallNorth', area: 0.4, glazingId: 'singleGlazing' },
      ],
      1.1,
    ),
    operation: {
      internalGainsSchedule: jaisalmerGains,
      achSchedule: achAll(1.0),
      auxHeating: NO_AUX_HEATING,
      comfortBand: COMFORT_BAND_LADAKH,
    },
    options: OPTIONS,
  },
};

// ============================== PUBLIC SURFACE ==============================

export const PRESETS: readonly Preset[] = [
  PRESET_TRADITIONAL,
  PRESET_BARRACK,
  PRESET_MODERN_RCC,
  PRESET_TROMBE,
  PRESET_OPTIMISED_PLACEHOLDER,
  PRESET_JAISALMER,
] as const;

const BY_ID = new Map(PRESETS.map((p) => [p.id, p] as const));

export function presetById(id: string): Preset {
  const p = BY_ID.get(id);
  if (!p) throw new EngineError('INVALID_INPUT', `No preset with id "${id}".`, { id });
  return p;
}

// Fail fast at module load, not deep inside a demo or a test (same pattern as
// constructions.ts's own self-check loop): every materialId/glazingId/
// locationId referenced above must resolve in the real catalogues.
for (const preset of PRESETS) {
  for (const surface of preset.request.building.surfaces) {
    for (const layer of surface.construction) materialById(layer.materialId);
  }
  for (const win of preset.request.building.windows) glazingById(win.glazingId);
  if (!TMY_LOCATIONS.some((loc) => loc.id === preset.locationId)) {
    throw new EngineError(
      'INVALID_INPUT',
      `Preset "${preset.id}" references unknown locationId "${preset.locationId}".`,
      {
        presetId: preset.id,
        locationId: preset.locationId,
      },
    );
  }
}
