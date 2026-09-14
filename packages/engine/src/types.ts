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
  /** Period totals, kWh, keyed by pathway name. Feeds the Sankey. */
  dailyTotalsKWh: Record<string, number>;
}

export interface SimulationKpis {
  minIndoorTemp: Kelvin;
  maxIndoorTemp: Kelvin;
  meanIndoorTemp: Kelvin;
  /** THE number for Ladakh: the pre-dawn minimum. */
  tempAt0600: Kelvin;
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
}

// ============================== ERRORS ==============================

export type EngineErrorCode =
  | 'INVALID_INPUT'
  | 'UNKNOWN_MATERIAL'
  | 'UNKNOWN_GLAZING'
  | 'GEOMETRY_INCONSISTENT'
  | 'WEATHER_INVALID'
  | 'SOLVER_DIVERGED'
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
