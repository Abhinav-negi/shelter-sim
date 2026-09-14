/**
 * Interior surface boundary conditions. BLUEPRINT.md 5.8. WORKERS.md W-16.
 */

import { SIGMA } from '../constants.js';
import { convectionAltitudeFactor } from '../air.js';
import type { Kelvin } from '../units.js';
import type { Surface } from '../types.js';

/**
 * Interior natural-convection coefficient, W/(m^2*K).
 *
 * Direction of heat flow matters, because buoyancy either drives the flow or
 * opposes it. The asymmetry is large and real: a warm ceiling transfers heat
 * downward very poorly (0.95) because nothing buoyant drives it, while a warm
 * floor transfers upward easily (4.04).
 *
 * That single fact is why FLOOR-BASED THERMAL MASS BEATS CEILING-BASED MASS in a
 * direct-gain shelter -- a design conclusion the tool can surface on its own.
 *
 * Altitude-corrected, per AUDIT.md F-5: BLUEPRINT.md omitted this for h_i entirely.
 */
export function hConvInterior(
  surfaceType: Surface['type'],
  surfaceTemp: Kelvin | number,
  airTemp: Kelvin | number,
  altitudeM: number,
): number {
  const warmerThanAir = (surfaceTemp as number) > (airTemp as number);
  let h: number;
  if (surfaceType === 'wall') {
    h = 3.08;
  } else if (surfaceType === 'floor') {
    // A warm floor drives heat UP into the room: buoyancy helps.
    h = warmerThanAir ? 4.04 : 0.95;
  } else {
    // Roof/ceiling: warm ceiling pushing heat DOWN is the suppressed case.
    h = warmerThanAir ? 0.95 : 4.04;
  }
  return h * convectionAltitudeFactor(altitudeM);
}

/**
 * Linearised interior longwave coefficient to the mean-radiant star node, W/(m^2*K).
 *
 * Rigorous interior radiation needs an N x N view-factor matrix. Connecting every
 * interior surface to one fictitious zero-capacity radiant node instead captures
 * the redistribution that matters (a sun-warmed mass wall heating a cold window
 * wall) at O(N) instead of O(N^2). This is the ISO 13790 5R1C approach, not a
 * shortcut we invented.
 */
export function hRadInterior(emissivity: number, surfaceT: Kelvin | number, radiantT: Kelvin | number): number {
  const mean = ((surfaceT as number) + (radiantT as number)) / 2;
  return 4 * emissivity * SIGMA * mean ** 3;
}

/**
 * Where transmitted sunlight lands. BLUEPRINT.md 5.8.3.
 *
 * This distribution is not cosmetic. Adding transmitted solar straight to the AIR
 * node makes the room overheat at noon and go cold by 8 PM -- the classic
 * direct-gain failure. Depositing it on a massive floor lets the floor store it
 * and release it through the night, which is the entire mechanism the tool exists
 * to demonstrate.
 */
export const SOLAR_TO_FLOOR_FRACTION = 0.6;
/** Small fraction absorbed by air and light furnishings directly. */
export const SOLAR_TO_AIR_FRACTION = 0.05;
