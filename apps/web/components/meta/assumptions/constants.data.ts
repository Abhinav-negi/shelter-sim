// apps/web/components/meta/assumptions/constants.data.ts
//
// T-52(a). Every physical constant, correlation and conversion factor the
// engine uses, in ONE place, each with value/unit/source. This is the data
// the assumptions panel renders; `constants.data.test.ts` mechanically diffs
// the `ENGINE_CONSTANTS` half of this list against `packages/engine/src/
// constants.ts`'s own export list (acceptance test 1) so the two can never
// silently drift.
//
// Values for ENGINE_CONSTANTS are read straight from `@shelter/engine`'s
// public barrel (`export * from './constants.js'` in packages/engine/src/
// index.ts) -- never retyped by hand -- so a value change on disk is picked
// up here automatically; only the metadata (unit/source/note) is hand
// maintained.
//
// GOTCHA for a future reader: `ACH_PER_GLAZING_FRACTION` (loads/
// infiltration.ts) and the air-capacitance multiplier `M` (the default
// `multiplier = 4` parameter of `effectiveAirCapacitance`, same file) are
// NOT part of the engine's public barrel -- `packages/engine/src/index.ts`
// only re-exports `infiltration`/`effectiveAirCapacitance` from that module,
// not the constant itself, and `packages/engine/package.json`'s `exports`
// map has no subpath entry, so a deep import (`@shelter/engine/dist/loads/
// infiltration.js`) is not resolvable either. `packages/engine/src` and its
// `exports` map are both outside this task's allow-list
// (`apps/web/components/meta/**` only per LOG.md rule 3), so this file
// states their values as SOURCED LITERALS (mirroring the exact numbers on
// disk, cited by file and line) rather than a live import. Reported upward
// in this task's Evidence block per LOG.md rule 16, not routed around.

import * as engine from '@shelter/engine';

export type ConstantKind = 'engineConstant' | 'engineDefault' | 'correlation' | 'metaField';

export interface AssumptionEntry {
  id: string;
  /** Exact export name in packages/engine/src/constants.ts, or undefined for
   * entries that are not a constants.ts export (correlations, defaults that
   * live elsewhere, meta fields). */
  constantsTsExportName?: string;
  value: string;
  unit: string;
  source: string;
  /** LOG.md rule 14: what evidence would justify changing this value. */
  calibrationNote?: string;
  /** LOG.md rule 13: a deliberate simplification's ceiling, if this entry is one. */
  editable?: boolean;
}

const num = (n: number): string => String(n);

/**
 * Every export of packages/engine/src/constants.ts, sourced live off the
 * `@shelter/engine` barrel. `constants.data.test.ts` asserts this array's
 * `constantsTsExportName` set is EXACTLY the set of `export const` names in
 * that file -- the mechanical diff acceptance test 1 requires.
 */
export const ENGINE_CONSTANTS: AssumptionEntry[] = [
  {
    id: 'SIGMA',
    constantsTsExportName: 'SIGMA',
    value: num(engine.SIGMA),
    unit: 'W/(m^2*K^4)',
    source: 'Stefan-Boltzmann constant (CODATA); ENGINE_BLUEPRINT.md §5.1',
  },
  {
    id: 'G_SC',
    constantsTsExportName: 'G_SC',
    value: num(engine.G_SC),
    unit: 'W/m^2',
    source: 'Solar constant; BLUEPRINT.md §5.3',
  },
  {
    id: 'C_P_AIR',
    constantsTsExportName: 'C_P_AIR',
    value: num(engine.C_P_AIR),
    unit: 'J/(kg*K)',
    source: 'Specific heat of dry air at constant pressure; ENGINE_BLUEPRINT.md §5.1',
  },
  {
    id: 'R_AIR',
    constantsTsExportName: 'R_AIR',
    value: num(engine.R_AIR),
    unit: 'J/(kg*K)',
    source: 'Specific gas constant, dry air; ENGINE_BLUEPRINT.md §5.1',
  },
  {
    id: 'P0',
    constantsTsExportName: 'P0',
    value: num(engine.P0),
    unit: 'Pa',
    source: 'ISA sea-level standard pressure; BLUEPRINT.md §5.2',
  },
  {
    id: 'ACH_MIN',
    constantsTsExportName: 'ACH_MIN',
    value: num(engine.ACH_MIN),
    unit: 'air changes/hour',
    source: 'WORKERS.md §1.5 rule 7; LOG.md global rule 10 -- hard ventilation safety floor',
    calibrationNote:
      'Not a fitted number -- a safety floor. Only ever raised by a documented carbon-monoxide/' +
      'ventilation-standard review, never lowered; the thermally optimal answer is always "seal it ' +
      'completely," which is exactly why this is code, not operator judgement.',
  },
  {
    id: 'LAPSE_RATE',
    constantsTsExportName: 'LAPSE_RATE',
    value: num(engine.LAPSE_RATE),
    unit: 'K/m',
    source: 'Environmental (not dry-adiabatic) lapse rate; standard atmosphere',
    calibrationNote:
      'LOG.md rule 14 calibration knob. A site-specific inversion-layer study for the Leh/Indus ' +
      'valley (temperature vs. elevation, measured, not modelled) would justify a different value; ' +
      '6.5e-3 K/m is the generic ISA figure, not a Ladakh measurement.',
  },
  {
    id: 'T_MIN_PLAUSIBLE',
    constantsTsExportName: 'T_MIN_PLAUSIBLE',
    value: num(engine.T_MIN_PLAUSIBLE),
    unit: 'K',
    source:
      'Solver divergence guard; CONTRACTS.md §7.8 -- not a physical assumption, a numerical one',
  },
  {
    id: 'T_MAX_PLAUSIBLE',
    constantsTsExportName: 'T_MAX_PLAUSIBLE',
    value: num(engine.T_MAX_PLAUSIBLE),
    unit: 'K',
    source:
      'Solver divergence guard; CONTRACTS.md §7.8 -- not a physical assumption, a numerical one',
  },
  {
    id: 'PRIMARY_METRIC',
    constantsTsExportName: 'PRIMARY_METRIC',
    value: String(engine.PRIMARY_METRIC),
    unit: 'metric name (lower is better)',
    source: 'CONTRACTS.md §7.9, added by T-06 -- design-search ranking key',
  },
  {
    id: 'SECONDARY_METRIC',
    constantsTsExportName: 'SECONDARY_METRIC',
    value: String(engine.SECONDARY_METRIC),
    unit: 'metric name (higher is better, tie-break)',
    source: 'CONTRACTS.md §7.9, added by T-06',
  },
  {
    id: 'RANK_NOISE_FLOOR',
    constantsTsExportName: 'RANK_NOISE_FLOOR',
    value: num(engine.RANK_NOISE_FLOOR),
    unit: 'kWh/day',
    source:
      'CONTRACTS.md §7.9 -- variants closer than this on the primary metric are TIED, never ordered',
  },
  {
    id: 'ACH_MIN_COMBUSTION_ALLOWANCE',
    constantsTsExportName: 'ACH_MIN_COMBUSTION_ALLOWANCE',
    value: num(engine.ACH_MIN_COMBUSTION_ALLOWANCE),
    unit: 'air changes/hour',
    source:
      'LOG.md global rule 10 -- floors an unvented-combustion design (e.g. a bukhari) at 0.70 ACH',
  },
  {
    id: 'KEROSENE_KWH_PER_L',
    constantsTsExportName: 'KEROSENE_KWH_PER_L',
    value: num(engine.KEROSENE_KWH_PER_L),
    unit: 'kWh/L',
    source: 'TECH.md §10.4 (~37.6 MJ/L)',
    editable: true,
  },
  {
    id: 'KEROSENE_STOVE_EFFICIENCY',
    constantsTsExportName: 'KEROSENE_STOVE_EFFICIENCY',
    value: num(engine.KEROSENE_STOVE_EFFICIENCY),
    unit: 'dimensionless (0-1)',
    source: 'TECH.md §10.4 -- typical unvented kerosene heater, delivered/chemical',
    editable: true,
  },
  {
    id: 'KEROSENE_CO2_KG_PER_L',
    constantsTsExportName: 'KEROSENE_CO2_KG_PER_L',
    value: num(engine.KEROSENE_CO2_KG_PER_L),
    unit: 'kg CO2/L',
    source: 'TECH.md §10.4',
    editable: true,
  },
  {
    id: 'KEROSENE_INR_PER_L',
    constantsTsExportName: 'KEROSENE_INR_PER_L',
    value: num(engine.KEROSENE_INR_PER_L),
    unit: 'INR/L',
    source:
      'ASSUMPTION -- no source document states a kerosene price (packages/engine/src/constants.ts). ' +
      'Edit this to the price you cite.',
    editable: true,
  },
];

/**
 * Values documented outside the engine's public barrel (see this file's
 * header GOTCHA). Sourced literals, not live imports -- values verified
 * against the cited source line at the time this file was written.
 */
export const UNEXPORTED_CALIBRATION_KNOBS: AssumptionEntry[] = [
  {
    id: 'ACH_PER_GLAZING_FRACTION',
    value: '1.2',
    unit: 'ACH per (m^2 glazing / m^2 envelope)',
    source:
      'packages/engine/src/loads/infiltration.ts:83 (AUDIT.md F-6). Not re-exported by the engine’s ' +
      'public barrel (packages/engine/src/index.ts) -- shown here as a sourced literal, not a live import.',
    calibrationNote:
      'LOG.md rule 14 calibration knob. Couples requested ACH to the glazed fraction of the envelope ' +
      'because a larger window area correlates with a leakier, less-carefully-sealed opening in the ' +
      'kind of shelter this tool targets. A measured blower-door series across several Ladakhi ' +
      'shelters of varying window area, regressed against glazing fraction, would justify a different ' +
      'slope than 1.2; today it is an engineering estimate, not a fitted regression.',
  },
  {
    id: 'AIR_CAPACITANCE_MULTIPLIER_M',
    value: '4',
    unit: 'dimensionless multiplier on rho*V*C_P_AIR',
    source:
      'packages/engine/src/loads/infiltration.ts, effectiveAirCapacitance()’s default `multiplier` ' +
      'parameter; CONTRACTS.md §7.10. Not a named export -- shown here as a sourced literal.',
    calibrationNote:
      'LOG.md rule 14 calibration knob. Bare room air alone has a laughably small heat capacity; ' +
      'furniture, bedding, clothing and thin finishes respond within minutes and effectively move with ' +
      'the air, and ignoring them makes the simulated air twitchy and unrealistic. M = 4 is defensible ' +
      'standard practice, not a measurement of any specific shelter’s furnishings. A furniture/' +
      'contents survey of a real occupied shelter, converted to an equivalent air-mass multiplier, ' +
      'would justify a different value.',
  },
];

/** Interior solar distribution -- also outside the public barrel (surfaces/interior.ts exports
 * these, but index.ts only re-exports `hConvInterior` from that module). */
export const SOLAR_DISTRIBUTION: AssumptionEntry[] = [
  {
    id: 'SOLAR_TO_FLOOR_FRACTION',
    value: '0.6',
    unit: 'fraction of transmitted solar (0-1)',
    source: 'packages/engine/src/surfaces/interior.ts:66; CONTRACTS.md §7.10',
  },
  {
    id: 'SOLAR_TO_AIR_FRACTION',
    value: '0.05',
    unit: 'fraction of transmitted solar (0-1)',
    source: 'packages/engine/src/surfaces/interior.ts:68; CONTRACTS.md §7.10',
  },
];

/** Correlations and methods -- documentary, not single numbers. */
export const CORRELATIONS: AssumptionEntry[] = [
  {
    id: 'ERBS',
    value: 'k_t = GHI / I0, three-branch diffuse-fraction correlation',
    unit: 'n/a (correlation)',
    source: 'Erbs, Klein & Duffie; packages/engine/src/solar/decomposition.ts; BLUEPRINT.md §5.4',
  },
  {
    id: 'SWINBANK',
    value: 'T_sky = 0.0552 * T_amb^1.5 (used only when measured LW_down is absent)',
    unit: 'K in, K out',
    source: 'Swinbank (1963); packages/engine/src/surfaces/exterior.ts; CONTRACTS.md §7.10',
  },
  {
    id: 'CONVECTION_EXTERIOR',
    value: 'hConvExterior(v,h) = max(1.0, (2.8 + 3.0*v) * convectionAltitudeFactor(h))',
    unit: 'W/(m^2*K)',
    source:
      'packages/engine/src/surfaces/exterior.ts; BLUEPRINT.md §5.7. Convective-only, not McAdams.',
    calibrationNote:
      'The altitude factor sqrt(rho(h)/rho(0)) is mandatory, not a refinement (AUDIT.md F-5): at 3500 m ' +
      'there is ~35% less air to carry heat away by convection than at sea level.',
  },
  {
    id: 'CONVECTION_INTERIOR',
    value:
      'hConvInterior: wall 3.08; floor warmer 4.04 / cooler 0.95; roof warmer 0.95 / cooler 4.04 ' +
      '(all x convectionAltitudeFactor(h))',
    unit: 'W/(m^2*K)',
    source: 'packages/engine/src/surfaces/interior.ts; BLUEPRINT.md §5.8',
  },
  {
    id: 'KUSUDA_ACHENBACH',
    value:
      'T_g(z,t) = T_mean - A_s*exp(-z*sqrt(pi/(a_soil*P)))*cos(2*pi/P*(t - t0 - (z/2)*sqrt(P/(pi*a_soil))))',
    unit: 'K, periodic ground temperature at depth z',
    source: 'Kusuda & Achenbach (1965); packages/engine/src/loads/ground.ts; BLUEPRINT.md §5.11',
  },
];

/** Not a constant at all -- the annualisation method string the engine
 * returns in `meta.annualisationMethod` (CONTRACTS.md §7.7), which the UI
 * must show, never hide. Read live off the current result when one exists;
 * falls back to the engine's own fixed string otherwise, so the panel is
 * never empty before the first run. */
export function annualisationMethodNote(current: string | undefined): AssumptionEntry {
  return {
    id: 'ANNUALISATION_METHOD',
    value:
      current ??
      'Annual fuel, cost and CO2 figures scale this single simulated day by 365. That is only valid ' +
        'for a genuinely representative day -- use the twelve-monthly-day scenario set for a ' +
        'defensible annual total.',
    unit: 'n/a (method description)',
    source:
      'SimulationResult.meta.annualisationMethod, packages/engine/src/index.ts; CONTRACTS.md §7.7',
  };
}
