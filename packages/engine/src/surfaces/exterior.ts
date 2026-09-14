/**
 * Exterior surface boundary conditions. BLUEPRINT.md 5.7. WORKERS.md W-15.
 * Convection to the outdoor air, and infrared radiation to the sky.
 */

import { SIGMA } from '../constants.js';
import { convectionAltitudeFactor } from '../air.js';
import { rad } from '../units.js';
import type { Kelvin } from '../units.js';

/**
 * Exterior convection coefficient, W/(m^2*K).
 *
 * Convective-only linear form. NOT McAdams (5.7 + 3.8v): that is a COMBINED
 * convective+radiative coefficient, and we model longwave radiation explicitly
 * and separately, so McAdams here would double-count radiation.
 *
 * The altitude factor is mandatory, not a refinement (AUDIT.md F-5): convection
 * is heat carried away BY AIR, and at 3500 m there is 35% less air to carry it.
 */
export function hConvExterior(windSpeed: number, altitudeM: number): number {
  const h = 2.8 + 3.0 * Math.max(0, windSpeed);
  // Floor of 1.0 so a surface in dead calm is not perfectly insulated.
  return Math.max(1.0, h * convectionAltitudeFactor(altitudeM));
}

/**
 * Effective sky temperature, K.
 *
 * The sky is not at air temperature. On a clear night it behaves as a body far
 * colder, and every exterior surface radiates into that sink all night long.
 * At Leh with T_amb = 258 K the sky sits near 229 K -- a 29 K driving difference
 * that never switches off. A model without this predicts comfortable Ladakh
 * nights that do not exist.
 */
export function skyTemperature(ambient: Kelvin | number, lwDown?: number): Kelvin {
  if (lwDown !== undefined && lwDown > 0) {
    // Measured downward longwave (NASA POWER ALLSKY_SFC_LW_DWN) inverted via
    // Stefan-Boltzmann. This is the accurate path; prefer it whenever available.
    return Math.pow(lwDown / SIGMA, 0.25) as Kelvin;
  }
  // Swinbank clear-sky estimate. Conservative for Ladakh, where skies really are clear.
  return (0.0552 * Math.pow(ambient as number, 1.5)) as Kelvin;
}

/**
 * Linearised radiative coefficient to the sky, W/(m^2*K).
 *
 * The true exchange is eps*sigma*(T_s^4 - T_sky^4), which is nonlinear and would
 * destroy the linear matrix. Linearising about the mean of the two temperatures
 * from the PREVIOUS timestep is accurate to well under 1% at dt = 60 s, because
 * temperatures move only fractions of a degree per step.
 */
export function hRadSky(emissivity: number, surfaceT: Kelvin | number, skyT: Kelvin | number): number {
  const mean = ((surfaceT as number) + (skyT as number)) / 2;
  return 4 * emissivity * SIGMA * mean ** 3;
}

/**
 * Sky view factor: the fraction of the hemisphere a surface exchanges with the sky.
 * A roof (tilt 0) sees the whole dome; a vertical wall sees half.
 *
 * This is why ROOFS LOSE THE MOST HEAT AT NIGHT, and hence why roof insulation is
 * usually the highest-value intervention. The optimiser should rediscover this
 * on its own, which makes a good demo moment.
 */
export function skyViewFactor(tilt: number): number {
  return (1 + Math.cos(rad(tilt))) / 2;
}
