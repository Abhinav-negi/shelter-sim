/**
 * KPIs. WORKERS.md W-24, W-25.
 * This is where the solver's raw state becomes the numbers a human decides on.
 *
 * `assembleHeatFlows` used to live here too; T-22 moved it to `./heatFlows.js`
 * (LOG.md section 9, deviation D-7) and this re-export keeps every existing
 * importer of it from `kpis.js` working unchanged.
 */

import { T0, type Kelvin } from '../units.js';
import { CONVERSIONS, keroseneLitres } from './conversions.js';
import type { SimulationKpis, SimulationRequest } from '../types.js';
import type { StepRecord } from '../solve/integrator.js';
import { AIR_NODE } from '../solve/assemble.js';

export { assembleHeatFlows } from './heatFlows.js';

const J_TO_KWH = 1 / 3.6e6;

export function computeKpis(
  req: SimulationRequest,
  records: StepRecord[],
  dt: number,
): SimulationKpis {
  const n = records.length;
  const indoor = records.map((r) => r.T[AIR_NODE]!);
  const ambient = records.map((r) => r.T_amb);
  const days = (n * dt) / 86400;

  const min = Math.min(...indoor);
  const max = Math.max(...indoor);
  const mean = indoor.reduce((a, b) => a + b, 0) / n;

  const { lower, upper } = req.operation.comfortBand;
  const hoursPerStep = dt / 3600;
  let hoursInComfort = 0;
  let hoursBelow5C = 0;
  let hoursBelowFreezing = 0;
  for (const t of indoor) {
    if (t >= (lower as number) && t <= (upper as number)) hoursInComfort += hoursPerStep;
    if (t < T0 + 5) hoursBelow5C += hoursPerStep;
    if (t < T0) hoursBelowFreezing += hoursPerStep;
  }

  // Temperature at 06:00 -- the pre-dawn minimum, and the number that actually
  // decides whether anyone had to burn fuel last night.
  const startHour = req.weather.startHour;
  const idx0600 = Math.round((((6 - startHour + 24) % 24) * 3600) / dt) % n;
  const tempAt0600 = indoor[idx0600] ?? min;

  const swingIn = max - min;
  const swingOut = Math.max(...ambient) - Math.min(...ambient);

  const auxJ = records.reduce((s, r) => s + r.Qaux, 0) * dt;
  const auxKWhPerDay = (auxJ * J_TO_KWH) / Math.max(days, 1e-9);
  const litresPerYear = keroseneLitres(auxKWhPerDay) * 365;

  let condensationRiskHours: number | null = null;
  if (req.weather.RH) {
    condensationRiskHours = 0;
    for (let i = 0; i < n; i++) {
      const r = records[i]!;
      const rh = req.weather.RH[Math.min(i, req.weather.RH.length - 1)] ?? 0;
      // Magnus dew point of the indoor air, compared with the coldest interior surface.
      const tC = r.T[AIR_NODE]! - T0;
      const gamma = Math.log(Math.max(rh, 1) / 100) + (17.62 * tC) / (243.12 + tC);
      const dewC = (243.12 * gamma) / (17.62 - gamma);
      if (coldestInteriorSurface(r) - T0 < dewC) condensationRiskHours += hoursPerStep;
    }
  }

  return {
    minIndoorTemp: min as Kelvin,
    maxIndoorTemp: max as Kelvin,
    meanIndoorTemp: mean as Kelvin,
    tempAt0600: tempAt0600 as Kelvin,
    hoursInComfort,
    hoursBelow5C,
    hoursBelowFreezing,
    peakToPeakSwing: swingIn,
    decrementFactor: swingOut > 1e-9 ? swingIn / swingOut : 0,
    timeLagHours: peakLagHours(indoor, ambient, dt),
    auxEnergyKWhPerDay: auxKWhPerDay,
    keroseneEquivalentLitresPerYear: litresPerYear,
    co2EquivalentKgPerYear: litresPerYear * CONVERSIONS.keroseneCo2KgPerLitre,
    costPerYearINR: litresPerYear * CONVERSIONS.kerosenePriceInrPerLitre,
    condensationRiskHours,
  };
}

/** The coldest interior surface at a step -- where condensation forms first. */
function coldestInteriorSurface(r: StepRecord): number {
  // Node 0 is air and node 1 the radiant star node; fabric nodes start at 2.
  let coldest = Infinity;
  for (let i = 2; i < r.T.length; i++) coldest = Math.min(coldest, r.T[i]!);
  return coldest;
}

/** Hours by which the indoor peak trails the outdoor peak. */
function peakLagHours(indoor: number[], ambient: number[], dt: number): number {
  const argmax = (a: number[]) => a.reduce((best, v, i) => (v > a[best]! ? i : best), 0);
  const lagSteps = argmax(indoor) - argmax(ambient);
  const period = indoor.length;
  return (((lagSteps % period) + period) % period) * (dt / 3600);
}
