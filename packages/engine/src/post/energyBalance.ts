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

  const residual = throughput > 0 ? Math.abs(net - deltaStored) / throughput : 0;
  return { residual, netBoundaryJ: net, deltaStoredJ: deltaStored, throughputJ: throughput };
}
