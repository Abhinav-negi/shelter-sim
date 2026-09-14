/**
 * Glazing. BLUEPRINT.md 5.9. WORKERS.md W-17.
 * Glass has negligible heat capacity, so it is a pure resistance plus a
 * solar transmitter -- no nodes, no chain.
 */

import type { Glazing, WindowSpec } from '../types.js';

/**
 * Incidence angle modifier, 0-1. How transmission falls off at glancing sun.
 *
 * Matters in Ladakh: at midday the winter sun strikes a vertical south wall at a
 * favourable angle, but early and late in the day the angle is glancing and
 * transmission collapses. Omitting the IAM overpredicts window gains.
 */
export function iam(cosTheta: number, b0: number): number {
  if (cosTheta <= 1e-6) return 0;
  return Math.max(0, Math.min(1, 1 - b0 * (1 / cosTheta - 1)));
}

/** Is the night shutter closed at this local hour? */
export function shutterClosed(w: WindowSpec, hourOfDay: number): boolean {
  if (!w.shadingSchedule) return false;
  return w.shadingSchedule[Math.floor(hourOfDay) % 24] === true;
}

/**
 * Effective window U-value, W/(m^2*K), accounting for a closed night shutter.
 *
 * Single glazing U = 5.8 with a R = 0.4 quilted shutter becomes
 * 1/(1/5.8 + 0.4) = 1.75 -- a 70% cut in window loss for a few hundred rupees of
 * material. When the optimiser ranks this above triple glazing on
 * cost-effectiveness, that is a genuinely deployable recommendation.
 */
export function effectiveWindowU(g: Glazing, w: WindowSpec, closed: boolean): number {
  if (!closed) return g.U;
  const R = w.shutterResistance ?? 0.4;
  return 1 / (1 / g.U + R);
}

/** Transmitted solar power through one window, W. A closed shutter blocks it all. */
export function transmittedSolar(
  g: Glazing,
  w: WindowSpec,
  incident: number,
  cosTheta: number,
  closed: boolean,
): number {
  if (closed) return 0;
  return w.area * g.SHGC * iam(cosTheta, g.b0) * incident;
}
