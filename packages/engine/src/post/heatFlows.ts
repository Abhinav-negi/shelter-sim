/**
 * Heat-flow assembly. WORKERS.md W-24/W-25; TECH.md section 5 names this file.
 *
 * Moved out of `post/kpis.ts` verbatim by T-22 (LOG.md section 9, deviation D-7),
 * which also adds the `deltaT` series and aligns `dailyTotalsKWh`'s keys to the
 * series field names while it is here.
 */

import type { HeatFlows } from '../types.js';
import type { StepRecord } from '../solve/integrator.js';
import { AIR_NODE } from '../solve/assemble.js';

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
    deltaT: alloc(),
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
    // PS deliverable 3: "heat flow details as per the temperature difference
    // between ambient and shelter temperature". Plain number, Kelvin-degrees --
    // a difference is never branded (LOG.md section 6 rule 5 / CONTRACTS.md 7.1).
    out.deltaT[i] = r.T[AIR_NODE]! - r.T_amb;
  }

  const days = (n * dt) / 86400;
  const totalOf = (a: Float64Array) => (a.reduce((s, v) => s + v, 0) * dt * J_TO_KWH) / Math.max(days, 1e-9);
  // Keyed by the EXACT same field names as the series above, one-for-one, so
  // the Sankey (T-49) can iterate `Object.keys(heatFlows)` and look up a total
  // without a name-mapping table -- a mapping table is exactly how Q7 went
  // missing once already (CONTRACTS.md 7.3). `deltaT` is deliberately excluded:
  // it is a temperature difference in Kelvin-degrees, not a power series, and
  // has no physically meaningful "kWh" total.
  out.dailyTotalsKWh = {
    Q1_solarOpaque: totalOf(out.Q1_solarOpaque),
    Q2_solarGlazed: totalOf(out.Q2_solarGlazed),
    Q3_extConvection: totalOf(out.Q3_extConvection),
    Q4_skyRadiation: totalOf(out.Q4_skyRadiation),
    Q5_envelopeConduction: totalOf(out.Q5_envelopeConduction),
    Q6_intConvection: totalOf(out.Q6_intConvection),
    Q7_interiorLongwave: totalOf(out.Q7_interiorLongwave),
    Q8_windowConduction: totalOf(out.Q8_windowConduction),
    Q9_infiltration: totalOf(out.Q9_infiltration),
    Q10_ground: totalOf(out.Q10_ground),
    Q11_internalGains: totalOf(out.Q11_internalGains),
    Qaux: totalOf(out.Qaux),
    storageRate: totalOf(out.storageRate),
  };
  return out;
}
