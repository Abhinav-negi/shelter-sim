/**
 * Air leakage and ventilation. BLUEPRINT.md 5.10. WORKERS.md W-18.
 *
 * Frequently the LARGEST single night-time loss in a real shelter, and by far the
 * cheapest to fix -- weatherstripping and a door gasket cost almost nothing. If
 * the tool's headline advice is "seal the envelope before you spend a rupee on
 * insulation", that is a real, deployable finding.
 */

import { ACH_MIN, ACH_MIN_COMBUSTION_ALLOWANCE, C_P_AIR } from '../constants.js';
import { airDensity } from '../air.js';
import type { Kelvin } from '../units.js';
import { EngineError } from '../types.js';

export interface InfiltrationResult {
  /** kg/s. */
  massFlow: number;
  /** W/K. Conductance from indoor air to outdoor air. */
  conductance: number;
  /** True when the requested ACH was raised to the safety floor. */
  clampedToSafetyFloor: boolean;
}

/**
 * Mass flow and conductance for a given air change rate.
 *
 * SAFETY: ACH is clamped to ACH_MIN and never allowed below it. Ladakhi shelters
 * are heated by bukhari stoves burning dung, wood or kerosene. The thermally
 * optimal answer is always "seal it completely", and a sealed shelter with
 * unvented combustion inside is a carbon-monoxide fatality. This floor is enforced
 * in code rather than left to the operator's judgement.
 */
export function infiltration(
  achRequested: number,
  volumeM3: number,
  altitudeM: number,
  indoorTemp: Kelvin | number,
  allowUnsafe = false,
): InfiltrationResult {
  const clamped = achRequested < ACH_MIN && !allowUnsafe;
  const ach = allowUnsafe ? Math.max(0, achRequested) : Math.max(ACH_MIN, achRequested);
  const rho = airDensity(altitudeM, indoorTemp);
  const massFlow = (rho * volumeM3 * ach) / 3600;
  return { massFlow, conductance: massFlow * C_P_AIR, clampedToSafetyFloor: clamped };
}

/**
 * Effective heat capacity of the indoor air node, J/K.
 *
 * The bare air in a room has a laughably small heat capacity. Furniture, bedding,
 * clothing and thin finishes all respond within minutes and effectively move with
 * the air; ignoring them makes the system numerically stiff and the temperature
 * curve unrealistically twitchy. M = 4 is defensible standard practice.
 */
export interface EffectiveAchResult {
  /** Air changes per hour actually used, after the opening-area coupling and safety floor. */
  ach: number;
  /** True when the coupled value was below the safety floor and was raised to it. */
  clampedBySafetyFloor: boolean;
}

/**
 * CALIBRATION KNOB. Additional air changes per hour per unit of glazing-area fraction.
 *
 * Physical justification: crack length scales with opening perimeter, and openable glazing
 * leaks more per m^2 than opaque envelope does. This is an empirical coupling, not a derived
 * one -- it is here so that the glazing sweep can produce the non-monotonic optimum the physics
 * should show (CHALLENGE.md C-06, K-05; AUDIT.md F-6).
 *
 * The `glazingAreaM2 / envelopeAreaM2` fraction this multiplies is only LINEAR in glazing area
 * -- and can therefore combine with the roughly-linear solar-gain/window-conduction trade-off to
 * produce a genuine interior minimum, per K-05 -- when `envelopeAreaM2` is the FIXED total
 * exterior envelope area of the building. If a caller instead grows the denominator alongside the
 * swept glazing (e.g. by adding glazing area to an already glazing-inclusive envelope total), the
 * fraction becomes concave (saturating) in glazing area, which is algebraically incapable of ever
 * producing an interior minimum, no matter this constant's value (T-21 / AUDIT F-6: the coupling
 * caller in index.ts was doing exactly this before it was fixed). See `effectiveAch()` below for
 * the caller contract on `envelopeAreaM2`.
 *
 * TUNE THIS if a measured blower-door figure for a real Ladakhi shelter ever becomes available.
 * That single measurement is what would turn this from a plausible coupling into a calibrated one.
 */
export const ACH_PER_GLAZING_FRACTION = 1.2;

/**
 * Couples the air-change rate to the fraction of the envelope that is openable glazing
 * (AUDIT.md F-6). Without this, the glazing sweep's loss side never moves as glazing grows,
 * so the tool could recommend glazing an entire wall -- actively harmful advice on a
 * -25 degC Ladakh night.
 *
 * `envelopeAreaM2` MUST be the FIXED total exterior envelope area: every exterior surface's
 * area, opaque and glazed alike, summed once. It must NEVER be envelope-plus-glazing (i.e. never
 * add glazing area on top of a sum that already includes it) -- each host surface's area is
 * GROSS and already covers any window carved into it, so glazing area is counted once by simply
 * summing exterior surface areas. Passing a denominator that grows alongside the glazing area
 * being swept makes `glazingAreaM2 / envelopeAreaM2` concave instead of linear, which can never
 * produce the interior-minimum K-05 diagnostic (see `ACH_PER_GLAZING_FRACTION`'s doc above) --
 * this was T-21's exact bug, in the caller (`index.ts`), not in this function.
 *
 * SAFETY: the combined floor is enforced here exactly as in `infiltration()` above -- this is
 * intentional defence in depth (global rule 10), not redundancy to be cleaned up. A design with
 * unvented combustion floors at ACH_MIN + ACH_MIN_COMBUSTION_ALLOWANCE (0.70), not ACH_MIN (0.35).
 */
export function effectiveAch(
  baseAch: number,
  glazingAreaM2: number,
  envelopeAreaM2: number,
  hasUnventedCombustion: boolean,
  allowUnsafe = false,
): EffectiveAchResult {
  if (envelopeAreaM2 <= 0) {
    throw new EngineError(
      'INVALID_INPUT',
      'envelopeAreaM2 must be greater than zero to compute the opening-area infiltration coupling.',
    );
  }
  const coupled = baseAch + ACH_PER_GLAZING_FRACTION * (glazingAreaM2 / envelopeAreaM2);
  const achMin = ACH_MIN + (hasUnventedCombustion ? ACH_MIN_COMBUSTION_ALLOWANCE : 0);
  if (coupled < achMin && !allowUnsafe) {
    return { ach: achMin, clampedBySafetyFloor: true };
  }
  return { ach: coupled, clampedBySafetyFloor: false };
}

export function effectiveAirCapacitance(
  volumeM3: number,
  altitudeM: number,
  temperature: Kelvin | number,
  multiplier = 4,
): number {
  return airDensity(altitudeM, temperature) * volumeM3 * C_P_AIR * multiplier;
}
