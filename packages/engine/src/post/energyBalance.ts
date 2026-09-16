/**
 * The self-check that proves the engine is not lying. ENGINE_BLUEPRINT.md 7.
 * WORKERS.md W-23, TASK.md T-03.
 *
 * ---------------------------------------------------------------------------
 * THE RESIDUAL, DEFINED EXACTLY -- so it is inspectable in code and not merely
 * asserted in prose (AUDIT.md convergent finding #1).
 *
 *   residual = | sum(Q_boundary * dt) - deltaStored | / sum(|Q_boundary| * dt)
 *
 * It is a DIMENSIONLESS FRACTION, not a percent. The contract requires < 1e-3.
 *
 * Q_boundary is the eight-and-two terms that CROSS the system boundary:
 *   Q1, Q2, Q3, Q4, Q8, Q9, Q10, Q11, Qaux
 * Q5, Q6 and Q7 are EXCLUDED because they move heat around inside the system --
 * fabric conduction, surface-to-air convection, and surface-to-surface radiation
 * never cross the boundary. Including them is the single easiest way to break
 * this check, and it is why they are named explicitly here.
 *
 * deltaStored = sum over all nodes of C_i * (T_i_final - T_i_initial),
 * which includes the indoor air node's effective capacitance.
 * ---------------------------------------------------------------------------
 */

import type { StepRecord } from '../solve/integrator.js';
import type { StorageNode } from '../solve/assemble.js';
import { pcmEnthalpy } from '../storage/pcm.js';
import type { Kelvin } from '../units.js';

export interface EnergyBalance {
  /** Dimensionless fraction. Must be < 1e-3. */
  residual: number;
  /** J. Net energy across the system boundary over the period. */
  netBoundaryJ: number;
  /** J. Change in energy stored in the fabric and air. */
  deltaStoredJ: number;
  /** J. Sum of absolute boundary flows -- the normaliser. */
  throughputJ: number;
}

export function energyBalance(
  records: StepRecord[],
  capacitance: Float64Array,
  airCapacitance: number,
  initialT: Float64Array,
  finalT: Float64Array,
  dt: number,
  storageNodes: StorageNode[] = [],
): EnergyBalance {
  let net = 0;
  let throughput = 0;

  for (const r of records) {
    const boundary = [r.Q1, r.Q2, r.Q3, r.Q4, r.Q8, r.Q9, r.Q10, r.Q11, r.Qaux];
    for (const q of boundary) {
      net += q * dt;
      throughput += Math.abs(q) * dt;
    }
  }

  let deltaStored = 0;
  for (let i = 0; i < capacitance.length; i++) {
    const c = i === 0 ? airCapacitance : capacitance[i]!;
    deltaStored += c * (finalT[i]! - initialT[i]!);
  }

  // T-20 / CONTRACTS.md 7.4: a PCM node's capacitance is state-dependent, so the
  // C(T_end)*deltaT term above silently mis-counts latent heat crossed mid-run.
  // Replace it with the closed-form enthalpy integral from storage/pcm.ts
  // (T-19's pcmEnthalpy) -- it is a function of T alone, so
  // pcmEnthalpy(T_end) - pcmEnthalpy(T_0) equals the trapezoidal per-step sum
  // the contract describes, without needing the full per-step T history.
  for (const sn of storageNodes) {
    if (sn.element.kind !== 'pcm') continue;
    const i = sn.index;
    deltaStored -= capacitance[i]! * (finalT[i]! - initialT[i]!);
    const { massKg, latentHeat, meltPoint, meltRangeK } = sn.element;
    deltaStored += massKg * pcmEnthalpy(
      sn.material.c, latentHeat!, meltPoint!, meltRangeK ?? 3,
      finalT[i]! as Kelvin, initialT[i]! as Kelvin,
    );
  }

  const residual = throughput > 0 ? Math.abs(net - deltaStored) / throughput : 0;
  return { residual, netBoundaryJ: net, deltaStoredJ: deltaStored, throughputJ: throughput };
}
