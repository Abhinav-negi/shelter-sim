/**
 * Air leakage and ventilation. BLUEPRINT.md 5.10. WORKERS.md W-18.
 *
 * Frequently the LARGEST single night-time loss in a real shelter, and by far the
 * cheapest to fix -- weatherstripping and a door gasket cost almost nothing. If
 * the tool's headline advice is "seal the envelope before you spend a rupee on
 * insulation", that is a real, deployable finding.
 */

import { ACH_MIN, C_P_AIR } from '../constants.js';
import { airDensity } from '../air.js';
import type { Kelvin } from '../units.js';

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
export function effectiveAirCapacitance(
  volumeM3: number,
  altitudeM: number,
  temperature: Kelvin | number,
  multiplier = 4,
): number {
  return airDensity(altitudeM, temperature) * volumeM3 * C_P_AIR * multiplier;
}
