// apps/web/components/meta/assumptions/fuelCost.ts
//
// T-52(a): the pure recompute behind "editing KEROSENE_INR_PER_L in the
// panel changes the ₹/yr KPI card" (acceptance test 5). Same formula
// packages/engine/src/post/kpis.ts uses via keroseneLitres() -- reproduced
// here (not imported) only because that function always reads the engine's
// OWN fixed CONVERSIONS, which is exactly what editing in this panel needs
// to override without re-running the physics solve. Kept as one small pure
// function, independent of React, so it is directly unit-testable (no DOM
// needed) and is the single place both the component and its test call.

export interface FuelCostInputs {
  auxKWhPerDay: number;
  kWhPerL: number;
  efficiency: number;
  co2PerL: number;
  inrPerL: number;
}

export interface FuelCostDerived {
  litresPerYear: number;
  costPerYearINR: number;
  co2PerYearKg: number;
}

export function recomputeFuelCost(inputs: FuelCostInputs): FuelCostDerived {
  const litresPerYear = (inputs.auxKWhPerDay / (inputs.kWhPerL * inputs.efficiency)) * 365;
  return {
    litresPerYear,
    costPerYearINR: litresPerYear * inputs.inrPerL,
    co2PerYearKg: litresPerYear * inputs.co2PerL,
  };
}
