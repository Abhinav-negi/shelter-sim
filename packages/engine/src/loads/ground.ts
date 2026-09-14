/**
 * Ground coupling. BLUEPRINT.md 5.11. WORKERS.md W-19.
 *
 * Deep soil sits near the site's ANNUAL MEAN air temperature -- about 5-7 degC for
 * Leh. In midwinter with the air at -20 degC, the ground is therefore a heat
 * SOURCE relative to ambient. That is precisely why semi-buried and earth-bermed
 * shelters perform so well at altitude, and the tool should be able to show it.
 */

import type { Kelvin } from '../units.js';

/** Soil thermal diffusivity, m^2/s. Typical moist soil. */
export const SOIL_DIFFUSIVITY = 5e-7;

/**
 * Kusuda-Achenbach undisturbed soil temperature at depth z, K.
 * The annual wave is damped and delayed with depth exactly as the daily wave is
 * damped and delayed through a wall -- same equation, different period.
 */
export function soilTemperature(
  meanAnnual: Kelvin | number,
  amplitude: number,
  depthM: number,
  dayOfYear: number,
  dayOfMinimumSurfaceTemp = 20,
): Kelvin {
  const P = 365;
  const damping = Math.exp(-depthM * Math.sqrt(Math.PI / (SOIL_DIFFUSIVITY * P * 86400)));
  const phase = (depthM / 2) * Math.sqrt(P / (Math.PI * SOIL_DIFFUSIVITY * 86400));
  const wave = Math.cos(((2 * Math.PI) / P) * (dayOfYear - dayOfMinimumSurfaceTemp - phase));
  return ((meanAnnual as number) - amplitude * damping * wave) as Kelvin;
}

/**
 * Simplified slab-to-soil conductance, W/(m^2*K). ISO 13370 style.
 * ponytail: fixed equivalent soil resistance; upgrade to the full ISO 13370
 * perimeter/area method if ground losses ever dominate a result.
 */
export const SLAB_SOIL_CONDUCTANCE = 1 / 1.5;
