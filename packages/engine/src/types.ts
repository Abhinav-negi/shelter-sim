/**
 * THE FROZEN CONTRACT. WORKERS.md W-02, BLUEPRINT.md Part 10.
 *
 * Every module codes against this file. Changing a shape here breaks every
 * consumer, so treat edits as a team decision, not a refactor.
 *
 * Convention: angles are DEGREES at these boundaries and radians only inside a
 * function body. Temperatures are KELVIN everywhere in this file -- Celsius
 * exists only outside the engine.
 */

import type { Kelvin } from './units.js';

// ============================== MATERIALS ==============================

/** A solid building material is five numbers. ENGINE_BLUEPRINT.md 2.1. */
export interface Material {
  id: string;
  name: string;
  nameHi?: string;
  category: 'structural' | 'insulation' | 'finish' | 'storage';
  /** Thermal conductivity, W/(m*K). How easily heat flows through it. */
  k: number;
  /** Density, kg/m^3. */
  rho: number;
  /** Specific heat capacity, J/(kg*K). */
  c: number;
  /** Solar absorptivity, 0-1. Fraction of sunlight absorbed. */
  alphaSolar: number;
  /** Thermal (longwave) emissivity, 0-1. */
  emissivity: number;
  costPerM3?: number;
  locallyAvailableLadakh: boolean;
  embodiedCarbon?: number;
  /** Citation. MANDATORY -- "where did this number come from" must have an answer. */
  source: string;
  /** One plain sentence for the UI card. No physics jargon. */
  blurb?: string;
}

/** Glazing is four numbers. ENGINE_BLUEPRINT.md 2.2. */
export interface Glazing {
  id: string;
  name: string;
  nameHi?: string;
  /** Overall heat transfer coefficient, W/(m^2*K). */
  U: number;
  /** Solar heat gain coefficient, 0-1. */
  SHGC: number;
  /** Visible transmittance, 0-1. Cosmetic, for the UI only. */
  tauVis: number;
  /** Incidence angle modifier coefficient. How transmission falls at glancing sun. */
  b0: number;
  costPerM2?: number;
  source: string;
  blurb?: string;
}

// ============================== GEOMETRY ==============================

export interface Layer {
  materialId: string;
  /** Metres. */
  thickness: number;
}

export interface Surface {
  id: string;
  type: 'wall' | 'roof' | 'floor';
  /** m^2. Net of any window openings -- windows are separate. */
  area: number;
  /** Degrees from horizontal. 0 = flat facing up, 90 = vertical. */
  tilt: number;
  /** Degrees from south, before whole-building rotation. -90 = East, +90 = West. */
  azimuth: number;
  /** Ordered EXTERIOR -> INTERIOR. */
  construction: Layer[];
  boundary: 'exterior' | 'ground' | 'adiabatic';
  exteriorAbsorptivity: number;
  exteriorEmissivity: number;
  interiorEmissivity: number;
}

export interface WindowSpec {
  id: string;
  hostSurfaceId: string;
  /** m^2. */
  area: number;
  glazingId: string;
  /** 24 values: is the night shutter closed during this hour? */
  shadingSchedule?: boolean[];
  /** Added resistance when the shutter is closed, m^2*K/W. */
  shutterResistance?: number;
  overhangDepth?: number;
  overhangHeightAbove?: number;
}

/**
 * A discrete thermal storage element coupled to the room (water drum, PCM, rock
 * bed). Added by T-06 for T-19 (PCM node) / T-22 (storage in the node graph).
 */
export interface StorageElement {
  id: string;
  kind: 'water' | 'pcm' | 'rock';
  materialId: string;
  massKg: number;
  /** m^2. */
  surfaceAreaToRoom: number;
  /** W/K. */
  conductanceToRoom: number;
  /** K. PCM only. */
  meltPoint?: Kelvin;
  /** K. PCM only, default 3. */
  meltRangeK?: number;
  /** J/kg. PCM only. */
  latentHeat?: number;
}

export interface Building {
  /** m^2. */
  floorArea: number;
  /** m^3. */
  volume: number;
  /** Degrees. Rotation of the whole building from due south. */
  azimuth: number;
  surfaces: Surface[];
  windows: WindowSpec[];
  /** Multiplier on envelope UA to account for thermal bridges. Typically 1.05-1.20. */
  thermalBridgeFactor: number;
  /** Optional discrete storage elements (water drums, PCM, rock bed). Added by T-06. */
  storageElements?: StorageElement[];
}

// ============================== SITE & WEATHER ==============================

export interface Site {
  id: string;
  name: string;
  /** Degrees, north positive. */
  latitude: number;
  /** Degrees, east positive. */
  longitude: number;
  /** Metres above sea level. */
  elevation: number;
  /** Degrees east, e.g. 82.5 for IST. */
  standardMeridian: number;
  /** Scalar, or one value per timestep (snow cover varies). */
  groundAlbedo: number | number[];
  /** Kelvin. Deep-soil annual mean temperature. */
  groundTempMeanAnnual: Kelvin;
  /** Annual amplitude of the soil surface temperature swing, K. Kusuda-Achenbach. */
  groundTempAmplitude?: number;
  /** 36 values: blocking altitude in degrees per 10 degrees of azimuth. */
  horizonProfile?: number[];
}

/**
 * Hourly (or finer) weather. Arrays are parallel and must all be the same length.
 * ENGINE_BLUEPRINT.md 2.4 -- "Ladakh is just a particular set of numbers in here".
 */
export interface WeatherSeries {
  /** Seconds between samples. */
  stepSeconds: number;
  /** Day of year (1-365) of the first sample. */
  startDayOfYear: number;
  /** Local clock hour (0-24, fractional) of the first sample. */
  startHour: number;
  /** Dry-bulb air temperature, K. */
  T_amb: Float64Array;
  /** Global horizontal irradiance, W/m^2. */
  GHI: Float64Array;
  /** Wind speed, m/s. */
  v_wind: Float64Array;
  /** Direct normal irradiance, W/m^2. Derived via Erbs when absent. */
  DNI?: Float64Array;
  /** Diffuse horizontal irradiance, W/m^2. Derived via Erbs when absent. */
  DHI?: Float64Array;
  /** Downward longwave radiation, W/m^2. Essential for Q4; Swinbank-estimated when absent. */
  LW_down?: Float64Array;
  /** Relative humidity, %. Optional -- condensation KPI is null without it. */
  RH?: Float64Array;
  provenance: WeatherProvenance;
}

export interface WeatherProvenance {
  source: 'nasa-power' | 'open-meteo' | 'bundled-tmy' | 'user-csv' | 'synthetic';
  /** Human-readable, shown in the UI. */
  label: string;
  /** Elevation the source data represents, m. Null for user CSV (no correction applied). */
  sourceElevation: number | null;
  /** K added to every temperature by the lapse-rate correction. Shown in the UI. */
  lapseCorrectionK: number;
  fetchedAt?: string;
  /** Non-fatal notes: gaps interpolated, fields derived, etc. */
  notes: string[];
}

// ============================== OPERATION ==============================

export interface Operation {
  /** 24 values, W. People, stove, appliances, livestock. */
  internalGainsSchedule: number[];
  /** 24 values, air changes per hour. Clamped to ACH_MIN. */
  achSchedule: number[];
  auxHeating: {
    enabled: boolean;
    /** K. */
    setpoint: Kelvin;
    /** W. */
    maxPower: number;
    /** 24 values: is heating permitted this hour? */
    schedule?: boolean[];
  };
  /** K. */
  comfortBand: { lower: Kelvin; upper: Kelvin };
  /**
   * True when the shelter has an unvented combustion appliance (a bukhari stove).
   * Raises the infiltration safety floor from ACH_MIN to
   * ACH_MIN + ACH_MIN_COMBUSTION_ALLOWANCE (T-21, closes AUDIT F-6). Default false.
   */
  hasUnventedCombustion?: boolean;
}

// ============================== REQUEST ==============================

export interface SimOptions {
  /** Seconds. Default 60. */
  timestepSeconds: number;
  /** Target node spacing through wall thickness, m. Default 0.02. */
  meshTargetDx: number;
  /** Days of simulation actually reported. */
  simulationDays: number;
  /**
   * Spin-up is convergence-based, not a fixed window (WORKERS.md A9): repeat the
   * design day until day-over-day max node change < this, capped at maxSpinUpDays.
   */
  spinUpToleranceK: number;
  maxSpinUpDays: number;
  skyModel: 'isotropic' | 'hdkr';
  /** 1.0 = backward Euler (unconditionally stable). Do not lower without reason. */
  integrationTheta: number;
  /** Retain full through-thickness profiles in the result. Heavy; off by default. */
  keepSurfaceProfiles: boolean;
  /**
   * Permit an air-change rate below ACH_MIN.
   *
   * The floor exists because the thermally optimal shelter is a sealed one, and a
   * sealed shelter with a bukhari inside is a carbon-monoxide fatality. It stays
   * on by default and the optimiser must never turn it off.
   *
   * It is escapable only because you genuinely need zero infiltration to run the
   * adiabatic validation case, and because showing a user WHY sealing is unsafe
   * is a product feature. Every run that uses it emits a warning.
   */
  allowUnsafeVentilation: boolean;
  /**
   * Optional warm start. When supplied, integrate() seeds the spin-up loop from THIS
   * state instead of fill(mean(T_amb)), then keeps iterating to convergence exactly as
   * before -- a SPEED optimisation only, never an accuracy shortcut. Length must equal
   * the built model's node count; a mismatch throws EngineError('INVALID_INPUT').
   * Added for @shelter/optimise's spin-up-sharing cache (T-54 HELP_REQUEST, see
   * log/AREA-G-decision-support.md T-54 acceptance test 4) -- packages/optimise/** is
   * outside this task's own allow-list, so this task proves the hook in isolation only.
   */
  initialTemperatureK?: Float64Array;
  /**
   * Set true to include `warmState` in the result: the raw per-node converged
   * temperature vector (length = the built model's node count, in the engine's
   * OWN internal order, which is NOT part of this contract and may change).
   * OPAQUE to every caller: store it and hand it straight back via
   * `options.initialTemperatureK` on a later call with the SAME node topology
   * (same constructions/thicknesses/storage elements/volume) -- never index,
   * reorder or otherwise interpret its entries. Off by default: every extra
   * Float64Array costs JSON payload and DB storage nobody asked for. Added
   * for @shelter/optimise's spin-up-sharing cache (T-54 Evidence, 2026-09-19
   * continuation) -- packages/optimise/** is outside this task's own
   * allow-list, so this task proves the field in isolation only.
   */
  keepWarmState?: boolean;
}

export interface SimulationRequest {
  site: Site;
  building: Building;
  operation: Operation;
  weather: WeatherSeries;
  materials: Record<string, Material>;
  glazings: Record<string, Glazing>;
  options: SimOptions;
}

// ============================== RESULT ==============================

/**
 * The eleven pathways. ENGINE_BLUEPRINT.md section 4.
 * Q7 is present -- BLUEPRINT.md's own frontend spec silently dropped it (AUDIT F-1 note).
 *
 * SIGN CONVENTION, one rule, no exceptions:
 *   POSITIVE = heat entering the indoor air node / the building system.
 *   NEGATIVE = heat leaving it.
 * Q5, Q6, Q7 move heat around INSIDE the system and never cross its boundary --
 * which is why the energy-balance check must exclude them.
 */
export interface HeatFlows {
  /** Solar absorbed on opaque exterior surfaces, W. */
  Q1_solarOpaque: Float64Array;
  /** Solar transmitted through glazing, W. */
  Q2_solarGlazed: Float64Array;
  /** Convection, exterior surface <-> outdoor air, W. */
  Q3_extConvection: Float64Array;
  /** Longwave radiation, exterior surface <-> sky, W. Negative essentially always. */
  Q4_skyRadiation: Float64Array;
  /** Conduction through the opaque envelope, W. INTERNAL. */
  Q5_envelopeConduction: Float64Array;
  /** Convection, interior surface <-> indoor air, W. INTERNAL. */
  Q6_intConvection: Float64Array;
  /** Longwave exchange between interior surfaces, W. INTERNAL. */
  Q7_interiorLongwave: Float64Array;
  /** Conduction through glazing, W. */
  Q8_windowConduction: Float64Array;
  /** Infiltration / ventilation, W. */
  Q9_infiltration: Float64Array;
  /** Conduction to ground through the floor, W. */
  Q10_ground: Float64Array;
  /** Internal gains, W. */
  Q11_internalGains: Float64Array;
  /** Auxiliary heating actually delivered, W. */
  Qaux: Float64Array;
  /** Rate of change of energy stored in the fabric, W. */
  storageRate: Float64Array;
  /**
   * indoorAir - ambient, Kelvin-degrees. PS deliverable 3 names this series
   * explicitly ("heat flow details as per the temperature difference between
   * ambient and shelter temperature"). Added by T-22 (CONTRACTS.md 7.7).
   * Plain `number`, never branded `Kelvin` -- a difference is identical in K
   * and degC (LOG.md section 6 rule 5).
   */
  deltaT: Float64Array;
  /** Period totals, kWh, keyed by pathway name. Feeds the Sankey. */
  dailyTotalsKWh: Record<string, number>;
}

export interface SimulationKpis {
  minIndoorTemp: Kelvin;
  maxIndoorTemp: Kelvin;
  meanIndoorTemp: Kelvin;
  /** THE number for Ladakh: the pre-dawn minimum. For a multi-day run, the FINAL day's value. */
  tempAt0600: Kelvin;
  /** T-61: one value per simulated day, so a run-down over a sunless streak can be shown. */
  tempAt0600PerDay?: number[];
  hoursInComfort: number;
  hoursBelow5C: number;
  hoursBelowFreezing: number;
  peakToPeakSwing: number;
  /** indoor swing / outdoor swing. Lower is better. */
  decrementFactor: number;
  /** Hours between the outdoor peak and the indoor peak. */
  timeLagHours: number;
  auxEnergyKWhPerDay: number;
  keroseneEquivalentLitresPerYear: number;
  co2EquivalentKgPerYear: number;
  costPerYearINR: number;
  /** Null when the weather series carried no relative humidity (WORKERS.md A6). */
  condensationRiskHours: number | null;
}

export interface SimulationResult {
  meta: {
    nodeCount: number;
    timesteps: number;
    wallClockMs: number;
    spinUpDaysUsed: number;
    /**
     * |sum of boundary-crossing Q - dStored| / (total absolute energy through boundary).
     * Dimensionless FRACTION, not a percent. Must be < 1e-3.
     */
    energyBalanceResidual: number;
    /** How the annual figures were extrapolated. Shown in the UI, never hidden. */
    annualisationMethod: string;
    warnings: string[];
  };
  /** Seconds from the start of the reported period. */
  time: Float64Array;
  temperatures: {
    indoorAir: Float64Array;
    ambient: Float64Array;
    sky: Float64Array;
    meanRadiant: Float64Array;
    /**
     * The floor's boundary node -- the fabric node adjoining the ground, one
     * per timestep. Added by T-22 (CONTRACTS.md 7.7); the integrator already
     * solved this node, it was just never surfaced. Distinct from any single
     * `temperatures.surfaces[id].exterior`: it stays defined even when the
     * ground-boundary surface isn't named "floor", and falls back to the deep-
     * soil boundary condition when the building has no ground-boundary surface
     * at all (e.g. the fully-adiabatic validation fixture).
     */
    ground: Float64Array;
    surfaces: Record<string, { exterior: Float64Array; interior: Float64Array; profile?: number[][] }>;
  };
  solar: {
    /** Incident irradiance on each surface, W/m^2. */
    incidentBySurface: Record<string, Float64Array>;
    absorbedOpaque: Float64Array;
    transmittedGlazed: Float64Array;
    dailyTotalKWh: { opaque: number; glazed: number; bySurface: Record<string, number> };
  };
  heatFlows: HeatFlows;
  kpis: SimulationKpis;
  /** Present only when `options.keepWarmState` is true. See `SimOptions.keepWarmState`. */
  warmState?: Float64Array;
}

// ============================== ERRORS ==============================

export type EngineErrorCode =
  | 'INVALID_INPUT'
  | 'UNKNOWN_MATERIAL'
  | 'UNKNOWN_GLAZING'
  | 'GEOMETRY_INCONSISTENT'
  | 'WEATHER_INVALID'
  | 'SOLVER_DIVERGED'
  | 'DATA_SCHEMA_MISMATCH'
  | 'SINGULAR_MATRIX';

export class EngineError extends Error {
  constructor(
    readonly code: EngineErrorCode,
    message: string,
    readonly detail?: unknown,
  ) {
    super(message);
    this.name = 'EngineError';
  }
}

// ============================== PRESETS (added by T-06, LOG.md 7.11) ==============================

/**
 * A named, ready-to-run starting point shown in the UI. Resolves against a bundled
 * TMY file via `locationId`; the caller supplies weather/materials/glazings.
 */
export interface Preset {
  id: string;
  name: string;
  nameHi?: string;
  description: string;
  /**
   * Ways this preset is a simplification of reality (e.g. the Trombe-wall caveat).
   * Surfaced in the UI, never hidden -- LOG.md rule 13.
   */
  approximations?: string[];
  /** Resolves to a bundled TMY file. */
  locationId: string;
  request: Omit<SimulationRequest, 'weather' | 'materials' | 'glazings'>;
}

// ============================== WORKER PROTOCOL (added by T-06, LOG.md 7.14) ==============================

/**
 * One protocol shared by the browser Web Worker (T-43) and the server worker-thread
 * pool (T-40), so the two cannot drift. Every request carries a caller-generated id;
 * every response echoes it, so a superseded request (the user moved the slider again)
 * can be cancelled by id instead of racing a stale result into the store.
 */
export type WorkerRequest =
  | { id: string; kind: 'simulate'; payload: SimulationRequest }
  | { id: string; kind: 'sweep'; payload: SweepRequest }
  | { id: string; kind: 'cancel'; targetId: string };

export type WorkerResponse =
  | { id: string; kind: 'result'; payload: SimulationResult }
  | { id: string; kind: 'sweepResult'; payload: SweepResult }
  | { id: string; kind: 'progress'; done: number; total: number }
  | { id: string; kind: 'error'; code: EngineErrorCode; message: string };

// ============================== SWEEP CONTRACT (added by T-06, LOG.md 7.15) ==============================

/**
 * Does not exist in any source document -- AUDIT.md F-3 records that Compare and
 * Optimise existed only as two words in an ASCII mockup, with no contract, no
 * target and no owner. This is that contract.
 */
export type VariableSpec =
  | { kind: 'wallConstruction'; values: string[] }
  | { kind: 'insulationThickness'; values: number[] } // metres
  | { kind: 'insulationPosition'; values: ('inside' | 'outside' | 'cavity')[] }
  | { kind: 'roofConstruction'; values: string[] }
  | { kind: 'glazing'; values: string[] }
  | { kind: 'wwr'; orientation: 'S' | 'E' | 'W' | 'N'; values: number[] } // 0-1
  | { kind: 'buildingAzimuth'; values: number[] } // degrees
  | { kind: 'aspectRatio'; values: number[] }
  | { kind: 'nightShutters'; values: boolean[] }
  | { kind: 'massStrategy'; values: ('none' | 'floor' | 'trombe' | 'water' | 'pcm')[] }
  | { kind: 'ach'; values: number[] };

export interface SweepRequest {
  base: SimulationRequest;
  variables: VariableSpec[];
  mode: 'grid' | 'random' | 'nsga2';
  /** Hard cap. Default 200. */
  maxVariants: number;
  constraints: {
    /** NEVER below ACH_MIN. */
    achMin: number;
    localMaterialsOnly?: boolean;
    budgetCeilingINR?: number;
    fixedFloorArea?: boolean;
  };
  objectives: { metric: keyof SimulationKpis; direction: 'min' | 'max' }[];
}

export interface SweepVariant {
  id: string;
  /** Human-readable, for the UI. */
  overrides: Record<string, string | number | boolean>;
  kpis: SimulationKpis;
  capitalCostINR: number;
  embodiedCarbonKg: number;
  feasible: boolean;
  /** e.g. "ACH below safety floor". */
  infeasibleReason?: string;
  /** 1 = on the Pareto front. */
  paretoRank: number;
}

export interface SweepResult {
  /** Ordered by PRIMARY_METRIC, ties preserved. */
  variants: SweepVariant[];
  /** Ids grouped where |delta| < RANK_NOISE_FLOOR. */
  ties: string[][];
  baselineId: string;
  best: SweepVariant;
  meta: { evaluated: number; wallClockMs: number; workers: number; spinUpShared: boolean };
}
