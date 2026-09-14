/**
 * Shared verification apparatus for the validation suite (T-07, LOG.md).
 *
 * Every downstream validation task (T-23, T-62, T-63) compares a numerical
 * result against a closed-form or known answer. This file is the ONE place
 * that comparison logic lives, so every task reports the same numbers the
 * same way -- `VALIDATION.md` is assembled straight from `assertWithin`'s
 * stdout.
 */

import { harmonicFit, lagSeconds } from '../src/envelope/response.js';

/**
 * Recovers the decrement factor and time lag between a driving sinusoid and
 * the sinusoid it produced elsewhere in the system, by fitting both with a
 * single-bin DFT and comparing amplitude and phase.
 *
 * Reuses `harmonicFit`/`lagSeconds` from `envelope/response.ts` rather than
 * reimplementing the fit -- global ladder rule, reuse before write.
 */
export function decrementAndLag(
  driveSeries: Float64Array,
  responseSeries: Float64Array,
  dtSeconds: number,
  periodSeconds: number,
): { f: number; phiHours: number } {
  const drive = harmonicFit(driveSeries, dtSeconds, periodSeconds);
  const response = harmonicFit(responseSeries, dtSeconds, periodSeconds);
  const f = response.amplitude / drive.amplitude;
  const phiHours = lagSeconds(drive, response, periodSeconds) / 3600;
  return { f, phiHours };
}

/**
 * The closed-form decrement factor and time lag for a homogeneous
 * semi-infinite solid driven by a period-P sinusoid. `BLUEPRINT.md` 5.6.5 --
 * the analytical answer the numerical scheme (via `decrementAndLag`) has to
 * reproduce.
 *
 *   d   = sqrt(2a/omega)      penetration depth of the wave, m
 *   f   = e^(-x/d)            decrement factor at depth x
 *   phi = x/(d*omega)         lag, seconds
 *   omega = 2*pi/P
 */
export function analyticalDecrementLag(a: number, thicknessM: number, periodSeconds: number): { f: number; phiHours: number } {
  const omega = (2 * Math.PI) / periodSeconds;
  const d = Math.sqrt((2 * a) / omega);
  const f = Math.exp(-thicknessM / d);
  const phiHours = thicknessM / (d * omega) / 3600;
  return { f, phiHours };
}

/**
 * Asserts `actual` is within `tol` of `expected`, printing the measured pair
 * on BOTH pass and fail -- `VALIDATION.md` (T-63) is assembled from exactly
 * this stdout, so a silent pass is a missing data point, not a clean result.
 */
export function assertWithin(actual: number, expected: number, tol: number, label: string): void {
  const diff = Math.abs(actual - expected);
  const verdict = diff <= tol ? 'PASS' : 'FAIL';
  console.log(`[${verdict}] ${label}: actual=${actual} expected=${expected} tol=${tol} diff=${diff}`);
  if (diff > tol) {
    throw new Error(`${label}: actual ${actual} is not within ${tol} of expected ${expected} (diff ${diff})`);
  }
}
