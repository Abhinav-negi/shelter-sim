/**
 * Heat-flow assembly. WORKERS.md W-24/W-25; TECH.md section 5 names this file.
 *
 * Moved out of `post/kpis.ts` verbatim by T-22 (LOG.md section 9, deviation D-7).
 */

import type { HeatFlows } from '../types.js';
import type { StepRecord } from '../solve/integrator.js';

const J_TO_KWH = 1 / 3.6e6;

export function assembleHeatFlows(records: StepRecord[], dt: number): HeatFlows {
  const n = records.length;
  const alloc = () => new Float64Array(n);
  const out = {
    Q1_solarOpaque: alloc(),
    Q2_solarGlazed: alloc(),
    Q3_extConvection: alloc(),
    Q4_skyRadiation: alloc(),
    Q5_envelopeConduction: alloc(),
    Q6_intConvection: alloc(),
    Q7_interiorLongwave: alloc(),
    Q8_windowConduction: alloc(),
    Q9_infiltration: alloc(),
    Q10_ground: alloc(),
    Q11_internalGains: alloc(),
    Qaux: alloc(),
    storageRate: alloc(),
    dailyTotalsKWh: {} as Record<string, number>,
  } satisfies HeatFlows;

  for (let i = 0; i < n; i++) {
    const r = records[i]!;
    out.Q1_solarOpaque[i] = r.Q1;
    out.Q2_solarGlazed[i] = r.Q2;
    out.Q3_extConvection[i] = r.Q3;
    out.Q4_skyRadiation[i] = r.Q4;
    out.Q5_envelopeConduction[i] = r.Q5;
    out.Q6_intConvection[i] = r.Q6;
    out.Q7_interiorLongwave[i] = r.Q7;
    out.Q8_windowConduction[i] = r.Q8;
    out.Q9_infiltration[i] = r.Q9;
    out.Q10_ground[i] = r.Q10;
    out.Q11_internalGains[i] = r.Q11;
    out.Qaux[i] = r.Qaux;
  }

  const days = (n * dt) / 86400;
  const totalOf = (a: Float64Array) => (a.reduce((s, v) => s + v, 0) * dt * J_TO_KWH) / Math.max(days, 1e-9);
  out.dailyTotalsKWh = {
    solarOpaque: totalOf(out.Q1_solarOpaque),
    solarGlazed: totalOf(out.Q2_solarGlazed),
    extConvection: totalOf(out.Q3_extConvection),
    skyRadiation: totalOf(out.Q4_skyRadiation),
    windowConduction: totalOf(out.Q8_windowConduction),
    infiltration: totalOf(out.Q9_infiltration),
    ground: totalOf(out.Q10_ground),
    internalGains: totalOf(out.Q11_internalGains),
    auxiliary: totalOf(out.Qaux),
  };
  return out;
}
