// apps/web/components/advanced/fieldDefs.ts
//
// T-45 -- The Advanced panel's field metadata, validation and get/set logic.
// Deliberately plain TS with NO React import: this repo has no
// jsdom/@testing-library dependency on the approved list (CONTRACTS.md
// §7.13), so the validation/default/reset behaviour that the acceptance
// tests actually check is written here where it is testable by calling
// plain functions, not by simulating DOM events.
//
// CELSIUS NOTE (LOG.md global rule 5 / CONTRACTS.md §7.1): every temperature
// DIFFERENCE in this panel's scope (`spinUpToleranceK`, `groundTempAmplitude`)
// is a plain unbranded number, identical in K and degC, and is never run
// through a Celsius conversion. The ONE absolute-Kelvin field in scope is
// `site.groundTempMeanAnnual`. This UI is Celsius-facing (task brief), so
// that one field is shown and edited in degC. `apps/web/lib/units.ts`
// (read-only for this task -- see the brief) exports only a Kelvin -> "X.X
// °C" STRING formatter (`formatTempC`); it has no exported Celsius -> Kelvin
// parser, so there is nothing there to import for the round-trip this one
// editable field needs. This module therefore imports `toC`/`toK` directly
// from `@shelter/engine` -- the exact primitives `units.ts` itself wraps --
// which keeps the raw Kelvin-Celsius offset constant out of this file (T-45 acceptance test 11)
// while staying inside units.ts's own stated boundary ("Celsius may exist
// ONLY here and in the presentation code this file serves" -- this panel
// IS that presentation code). Flagged in the T-45 evidence block as a real
// gap in units.ts (no exported Celsius->Kelvin helper), not silently
// patched by editing units.ts, which is outside this task's allow-list.

import {
  ACH_MIN,
  DEFAULT_SIM_OPTIONS,
  toC,
  toK,
  type Celsius,
  type SimOptions,
  type SimulationRequest,
} from '@shelter/engine';

export interface Range {
  min: number;
  max: number;
}

export interface FieldError {
  message: string;
}

export function validateRange(value: number, range: Range, label: string): FieldError | null {
  if (!Number.isFinite(value)) return { message: `${label} must be a number` };
  if (value < range.min || value > range.max) {
    return { message: `${label} must be between ${range.min} and ${range.max}` };
  }
  return null;
}

export function validateArrayEntry(value: number, range: Range, label: string, index: number): FieldError | null {
  if (!Number.isFinite(value)) return { message: `${label}[${index}] must be a number` };
  if (value < range.min || value > range.max) {
    return { message: `${label}[${index}] must be between ${range.min} and ${range.max}` };
  }
  return null;
}

export interface NumericFieldDef {
  key: string;
  label: string;
  unit: string;
  range: Range;
  integer?: boolean;
  defaultValue: number;
  note: string;
  get(req: SimulationRequest): number;
  set(req: SimulationRequest, value: number): SimulationRequest;
}

// ============================== SimOptions -- CONTRACTS.md §7.5 ==============================
// The 6 plain-numeric SimOptions fields. `skyModel` (enum), `keepSurfaceProfiles`
// and `allowUnsafeVentilation` (booleans) are handled separately in AdvancedPanel.tsx.

export const NUMERIC_SIM_OPTION_FIELDS: NumericFieldDef[] = [
  {
    key: 'timestepSeconds',
    label: 'Timestep',
    unit: 's',
    range: { min: 1, max: 3600 },
    integer: true,
    defaultValue: DEFAULT_SIM_OPTIONS.timestepSeconds,
    note:
      'Length of each solved timestep. Default 300 s moves the 06:00 temperature by under 0.01 K ' +
      'against a 30 s reference for the lightest building in the catalogue (CONTRACTS §7.5) and buys ' +
      'a 5x speedup; smaller is always safe, just slower.',
    get: (req) => req.options.timestepSeconds,
    set: (req, value) => ({ ...req, options: { ...req.options, timestepSeconds: value } }),
  },
  {
    key: 'meshTargetDx',
    label: 'Mesh target spacing',
    unit: 'm',
    range: { min: 0.001, max: 0.5 },
    defaultValue: DEFAULT_SIM_OPTIONS.meshTargetDx,
    note: 'Target node spacing through each wall layer (CONTRACTS §7.5). Smaller = more nodes, more accurate, slower.',
    get: (req) => req.options.meshTargetDx,
    set: (req, value) => ({ ...req, options: { ...req.options, meshTargetDx: value } }),
  },
  {
    key: 'simulationDays',
    label: 'Simulation days',
    unit: 'days',
    range: { min: 1, max: 365 },
    integer: true,
    defaultValue: DEFAULT_SIM_OPTIONS.simulationDays,
    note: 'Number of days actually reported, after spin-up converges (CONTRACTS §7.5).',
    get: (req) => req.options.simulationDays,
    set: (req, value) => ({ ...req, options: { ...req.options, simulationDays: value } }),
  },
  {
    key: 'spinUpToleranceK',
    label: 'Spin-up tolerance',
    unit: 'K',
    range: { min: 0.001, max: 5 },
    defaultValue: DEFAULT_SIM_OPTIONS.spinUpToleranceK,
    note:
      'Spin-up repeats the design day until the day-over-day max node change drops below this ' +
      '(CONTRACTS §7.10). A temperature DIFFERENCE, never Celsius-converted (LOG.md rule 5).',
    get: (req) => req.options.spinUpToleranceK,
    set: (req, value) => ({ ...req, options: { ...req.options, spinUpToleranceK: value } }),
  },
  {
    key: 'maxSpinUpDays',
    label: 'Max spin-up days',
    unit: 'days',
    range: { min: 1, max: 365 },
    integer: true,
    defaultValue: DEFAULT_SIM_OPTIONS.maxSpinUpDays,
    note: 'Hard cap on spin-up iterations; a warning is emitted in meta.warnings if the cap is hit (CONTRACTS §7.10).',
    get: (req) => req.options.maxSpinUpDays,
    set: (req, value) => ({ ...req, options: { ...req.options, maxSpinUpDays: value } }),
  },
  {
    key: 'integrationTheta',
    label: 'Integration theta',
    unit: '',
    range: { min: 0, max: 1 },
    defaultValue: DEFAULT_SIM_OPTIONS.integrationTheta,
    note:
      '1.0 = backward Euler, unconditionally stable -- the only supported default (CONTRACTS §7.10). ' +
      'Lower values move toward the explicit end of the theta scheme and are not unconditionally stable.',
    get: (req) => req.options.integrationTheta,
    set: (req, value) => ({ ...req, options: { ...req.options, integrationTheta: value } }),
  },
];

export const SKY_MODEL_OPTIONS = ['isotropic', 'hdkr'] as const;
export const SKY_MODEL_DEFAULT: SimOptions['skyModel'] = DEFAULT_SIM_OPTIONS.skyModel;

export function setSkyModel(req: SimulationRequest, value: SimOptions['skyModel']): SimulationRequest {
  return { ...req, options: { ...req.options, skyModel: value } };
}

export const KEEP_SURFACE_PROFILES_DEFAULT = DEFAULT_SIM_OPTIONS.keepSurfaceProfiles;

export function setKeepSurfaceProfiles(req: SimulationRequest, value: boolean): SimulationRequest {
  return { ...req, options: { ...req.options, keepSurfaceProfiles: value } };
}

export const ALLOW_UNSAFE_VENTILATION_DEFAULT = DEFAULT_SIM_OPTIONS.allowUnsafeVentilation;

export const UNSAFE_VENTILATION_WARNING =
  'Disabling the ventilation floor can let indoor carbon monoxide (CO) accumulate to lethal levels ' +
  'whenever any combustion appliance (a bukhari stove, a kerosene heater) is present and unvented. ' +
  'This control exists so the tool can show why sealing a shelter is unsafe, not because it is a ' +
  `normal setting -- it defaults to off and the ${ACH_MIN} ACH floor is enforced again independently ` +
  'inside the engine (LOG.md global rule 10).';

export function setAllowUnsafeVentilation(req: SimulationRequest, value: boolean): SimulationRequest {
  return { ...req, options: { ...req.options, allowUnsafeVentilation: value } };
}

// ============================== Building ==============================
// CONTRACTS §7.5 states a typical range (1.05-1.20) for thermalBridgeFactor
// but, unlike SimOptions, gives no single canonical default value -- there
// is no `DEFAULT_BUILDING` constant on disk. 1.10 (the midpoint of the
// stated typical range) is used here as a documented, locally-declared
// default (LOG.md rule 13: a simplification volunteered, not hidden).

export const THERMAL_BRIDGE_FACTOR_DEFAULT = 1.1;

export const thermalBridgeFactorField: NumericFieldDef = {
  key: 'thermalBridgeFactor',
  label: 'Thermal bridge factor',
  unit: '×',
  range: { min: 1, max: 2 },
  defaultValue: THERMAL_BRIDGE_FACTOR_DEFAULT,
  note:
    'Multiplier applied to envelope UA to account for thermal bridging at junctions; CONTRACTS §7.5 ' +
    'states a typical range of 1.05-1.20. No single CONTRACTS default exists for this field -- the ' +
    'default shown is the midpoint of that stated range.',
  get: (req) => req.building.thermalBridgeFactor,
  set: (req, value) => ({ ...req, building: { ...req.building, thermalBridgeFactor: value } }),
};

// ============================== Per-surface optical properties ==============================
// CONTRACTS §7.11's surface optical-properties table gives many finish-
// dependent values (black paint alpha 0.95, whitewash 0.25, ...) with no
// single universal default for "a surface" -- it is material-dependent.
// The caller captures the INITIAL request (at panel mount) and passes it in
// here once, so "reset to default" restores this design's starting value
// for that surface, the only well-defined default a per-surface field can
// have (LOG.md rule 13: documented, not hidden).

export type SurfaceOpticalKey = 'exteriorAbsorptivity' | 'exteriorEmissivity' | 'interiorEmissivity';

const SURFACE_OPTICAL_LABELS: Record<SurfaceOpticalKey, string> = {
  exteriorAbsorptivity: 'Exterior solar absorptivity',
  exteriorEmissivity: 'Exterior longwave emissivity',
  interiorEmissivity: 'Interior longwave emissivity',
};

const SURFACE_OPTICAL_NOTES: Record<SurfaceOpticalKey, string> = {
  exteriorAbsorptivity: 'Fraction of incident solar absorbed by the exterior finish (CONTRACTS §7.11 optical-properties table).',
  exteriorEmissivity: 'Longwave emissivity of the exterior finish; drives sky-radiation loss Q4 (CONTRACTS §7.10).',
  interiorEmissivity: 'Longwave emissivity of the interior finish; drives interior longwave exchange Q7 (CONTRACTS §7.10).',
};

function surfaceOpticalField(surfaceId: string, key: SurfaceOpticalKey, defaultValue: number): NumericFieldDef {
  return {
    key: `surface.${surfaceId}.${key}`,
    label: `${SURFACE_OPTICAL_LABELS[key]} — ${surfaceId}`,
    unit: '',
    range: { min: 0, max: 1 },
    defaultValue,
    note: SURFACE_OPTICAL_NOTES[key],
    get: (req) => req.building.surfaces.find((s) => s.id === surfaceId)?.[key] ?? defaultValue,
    set: (req, value) => ({
      ...req,
      building: {
        ...req.building,
        surfaces: req.building.surfaces.map((s) => (s.id === surfaceId ? { ...s, [key]: value } : s)),
      },
    }),
  };
}

/** `initialReq` must be the request captured at panel MOUNT, not the live one. */
export function surfaceOpticalFields(initialReq: SimulationRequest): NumericFieldDef[] {
  return initialReq.building.surfaces.flatMap((s) => [
    surfaceOpticalField(s.id, 'exteriorAbsorptivity', s.exteriorAbsorptivity),
    surfaceOpticalField(s.id, 'exteriorEmissivity', s.exteriorEmissivity),
    surfaceOpticalField(s.id, 'interiorEmissivity', s.interiorEmissivity),
  ]);
}

// ============================== Site & ground ==============================
// Values sourced from CONTRACTS.md Appendix C ("Ladakh default parameter set").

export const GROUND_ALBEDO_DEFAULT = 0.3; // Appendix C: summer, dry high-altitude desert
export const GROUND_ALBEDO_SNOW = 0.75; // Appendix C: winter snow

export const groundAlbedoField: NumericFieldDef = {
  key: 'groundAlbedo',
  label: 'Ground albedo',
  unit: '',
  range: { min: 0, max: 1 },
  defaultValue: GROUND_ALBEDO_DEFAULT,
  note:
    'Fraction of incident solar reflected by the ground. Default 0.30 (dry high-altitude desert, ' +
    'CONTRACTS Appendix C); the snow-cover override sets the winter value 0.75.',
  get: (req) => (Array.isArray(req.site.groundAlbedo) ? (req.site.groundAlbedo[0] ?? GROUND_ALBEDO_DEFAULT) : req.site.groundAlbedo),
  set: (req, value) => ({ ...req, site: { ...req.site, groundAlbedo: value } }),
};

export const GROUND_TEMP_MEAN_ANNUAL_DEFAULT_C = 6; // Appendix C: 279.15 K ~ 6 degC, Leh

export const groundTempMeanAnnualField: NumericFieldDef = {
  key: 'groundTempMeanAnnual',
  label: 'Ground mean annual temperature',
  unit: '°C',
  range: { min: -30, max: 30 },
  defaultValue: GROUND_TEMP_MEAN_ANNUAL_DEFAULT_C,
  note:
    'Deep-soil annual-mean temperature driving the Kusuda-Achenbach ground model (CONTRACTS §7.10). ' +
    'The one absolute-Kelvin field in this panel: shown and edited in °C, stored as Kelvin (CONTRACTS §7.1).',
  get: (req) => toC(req.site.groundTempMeanAnnual),
  set: (req, valueC) => ({ ...req, site: { ...req.site, groundTempMeanAnnual: toK(valueC as Celsius) } }),
};

export const GROUND_TEMP_AMPLITUDE_DEFAULT = 12; // CONTRACTS §7.10 Leh anchor: "A_s = 12 K"

export const groundTempAmplitudeField: NumericFieldDef = {
  key: 'groundTempAmplitude',
  label: 'Ground temperature amplitude',
  unit: 'K',
  range: { min: 0, max: 30 },
  defaultValue: GROUND_TEMP_AMPLITUDE_DEFAULT,
  note:
    'Annual soil-surface temperature swing amplitude, Kusuda-Achenbach model (CONTRACTS §7.10). A ' +
    'temperature DIFFERENCE, never Celsius-converted (LOG.md rule 5). Leh anchor value: 12 K.',
  get: (req) => req.site.groundTempAmplitude ?? GROUND_TEMP_AMPLITUDE_DEFAULT,
  set: (req, value) => ({ ...req, site: { ...req.site, groundTempAmplitude: value } }),
};

// ============================== Array fields ==============================

export interface ArrayFieldDef {
  key: string;
  label: string;
  unit: string;
  length: number;
  range: Range;
  defaultValues: number[];
  note: string;
  get(req: SimulationRequest): number[];
  set(req: SimulationRequest, values: number[]): SimulationRequest;
}

export const HORIZON_PROFILE_LENGTH = 36;
export const HORIZON_PROFILE_DEFAULT: number[] = new Array(HORIZON_PROFILE_LENGTH).fill(0);

export const horizonProfileField: ArrayFieldDef = {
  key: 'horizonProfile',
  label: 'Horizon profile',
  unit: 'deg altitude',
  length: HORIZON_PROFILE_LENGTH,
  range: { min: 0, max: 90 },
  defaultValues: HORIZON_PROFILE_DEFAULT,
  note:
    '36 values: blocking altitude angle per 10° of azimuth, for terrain/mountain shading (CONTRACTS ' +
    '§7.5). Optional on Site; default is a flat horizon (all 0, no obstruction).',
  get: (req) => req.site.horizonProfile ?? HORIZON_PROFILE_DEFAULT,
  set: (req, values) => ({ ...req, site: { ...req.site, horizonProfile: values } }),
};

export const ACH_SCHEDULE_LENGTH = 24;
export const ACH_SCHEDULE_DEFAULT: number[] = new Array(ACH_SCHEDULE_LENGTH).fill(ACH_MIN);

/** Range depends on `allowUnsafeVentilation` -- rule 10's floor is enforced
 * at the control, in addition to (never instead of) the engine's own
 * independent enforcement in `loads/infiltration.ts`. */
export function achScheduleField(allowUnsafeVentilation: boolean): ArrayFieldDef {
  return {
    key: 'achSchedule',
    label: 'ACH schedule',
    unit: 'ACH',
    length: ACH_SCHEDULE_LENGTH,
    range: allowUnsafeVentilation ? { min: 0, max: 20 } : { min: ACH_MIN, max: 20 },
    defaultValues: ACH_SCHEDULE_DEFAULT,
    note:
      `24 hourly air-changes-per-hour values (CONTRACTS §7.5). Floored at ACH_MIN = ${ACH_MIN} unless ` +
      '"allow unsafe ventilation" is enabled above (LOG.md global rule 10) -- the floor is enforced ' +
      'again independently inside the engine regardless of what this control allows.',
    get: (req) => req.operation.achSchedule,
    set: (req, values) => ({ ...req, operation: { ...req.operation, achSchedule: values } }),
  };
}
