/**
 * Phase-change material (PCM) storage: the apparent-heat-capacity method.
 * BLUEPRINT.md 5.14.1, T-19 (LOG.md).
 *
 * A PCM does not have one specific heat -- it has one specific heat away from its
 * melt point, and a huge *effective* one across the melt band, because most of
 * the energy exchanged there goes into breaking/forming bonds (latent heat)
 * rather than raising temperature. The apparent-heat-capacity method folds that
 * latent heat into a temperature-dependent c(T): a rectangular spike of height
 * `latentHeat / meltRangeK` spread across the melt band, added on top of the
 * base specific heat. This is the ONLY name used for the method in this file --
 * BLUEPRINT.md also calls it by another name and never reconciles the two
 * (AUDIT.md); that other name must not reappear here.
 *
 * `pcmEnthalpy` is the closed-form (piecewise-linear, not numerically
 * integrated) antiderivative of `apparentHeatCapacity` from a reference
 * temperature. It is what LOG.md 7.4 requires for a PCM node's contribution to
 * the energy-balance residual's `ΔStored`: that contribution must be evaluated
 * by integrating apparent heat capacity along the node's own temperature
 * history by trapezoidal rule -- i.e. `pcmEnthalpy(T_end) - pcmEnthalpy(T_0)` at
 * each step, summed -- never `C_j(T_end) · ΔT`, which silently mis-counts
 * latent heat crossed mid-step.
 *
 * SOLVER CONSEQUENCE (read before wiring a PCM node into the integrator, T-20+):
 * apparent heat capacity makes the node's capacitance a function of its own
 * temperature, i.e. the C matrix becomes state-dependent. The refresh-cadence
 * contract of LOG.md 7.10 / T-11 (coefficients frozen per weather-hour, matrix
 * refactorised only on refresh) is NOT to be changed for this. A run containing
 * a PCM node must instead either (a) run more than one nonlinear iteration per
 * step so the capacitance converges within the step, or (b) evaluate it once
 * per step (lagged, i.e. using the previous step's temperature) and emit a
 * `meta.warnings` entry saying so. If the apparent heat capacity moves by more
 * than a set fraction within a single refresh interval, that should raise a
 * warning rather than being used as an excuse to refactorise more often.
 */

import { EngineError } from '../types.js';
import type { Kelvin } from '../units.js';

/**
 * Apparent specific heat capacity at temperature `t`, J/(kg*K).
 * `cBase` away from the melt band; `cBase + latentHeat / meltRangeK` inside the
 * band `[meltPoint - meltRangeK/2, meltPoint + meltRangeK/2]`.
 */
export function apparentHeatCapacity(
  cBase: number,
  latentHeat: number,
  meltPoint: Kelvin,
  meltRangeK: number,
  t: Kelvin,
): number {
  if (meltRangeK <= 0) {
    throw new EngineError('INVALID_INPUT', `meltRangeK must be > 0, got ${meltRangeK}.`);
  }
  const half = meltRangeK / 2;
  const inBand = t >= (meltPoint as number) - half && t <= (meltPoint as number) + half;
  return inBand ? cBase + latentHeat / meltRangeK : cBase;
}

/**
 * Specific enthalpy relative to `tRef`, J/kg: the closed-form integral of
 * `apparentHeatCapacity` from `tRef` to `t`. Piecewise-linear in `t` (slope
 * `cBase` outside the band, `cBase + latentHeat/meltRangeK` inside it) --
 * computed directly, never by numerical quadrature.
 */
export function pcmEnthalpy(
  cBase: number,
  latentHeat: number,
  meltPoint: Kelvin,
  meltRangeK: number,
  t: Kelvin,
  tRef: Kelvin,
): number {
  if (meltRangeK <= 0) {
    throw new EngineError('INVALID_INPUT', `meltRangeK must be > 0, got ${meltRangeK}.`);
  }
  const a = (meltPoint as number) - meltRangeK / 2; // band start
  const b = (meltPoint as number) + meltRangeK / 2; // band end
  const cBand = cBase + latentHeat / meltRangeK;

  // Continuous antiderivative of apparentHeatCapacity, G'(tau) = apparentHeatCapacity(tau).
  const g = (tau: number): number => {
    if (tau <= a) return cBase * tau;
    if (tau >= b) return cBase * tau + latentHeat; // (cBand-cBase)*(b-a) === latentHeat since b-a===meltRangeK
    return cBase * tau + (cBand - cBase) * (tau - a);
  };

  return g(t as number) - g(tRef as number);
}
