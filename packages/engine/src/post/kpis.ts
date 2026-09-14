/**
 * KPIs and heat-flow assembly. WORKERS.md W-24, W-25.
 * This is where the solver's raw state becomes the numbers a human decides on.
 */

import { T0, type Kelvin } from '../units.js';
import { CONVERSIONS, keroseneLitres } from './conversions.js';
import type { HeatFlows, SimulationKpis, SimulationRequest } from '../types.js';
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
