// apps/web/lib/units.ts
//
// THE UNIT BOUNDARY. CONTRACTS.md §7.1: `SimulationRequest`/`SimulationResult`
// are entirely in Kelvin. Celsius may exist ONLY here and in the presentation
// code this file serves. This is the ONLY file in the whole repository
// permitted to call `toC`/`toK` -- enforced by the grep in T-36 acceptance
// test 3 (`grep -rn "273\.15\|toC(\|toK(" apps/web ... | grep -v lib/units.ts`
// must return nothing). A component that does its own `- 273.15` is a defect
// regardless of whether the displayed number looks right (LOG.md global rule 5).
//
// Temperature DIFFERENCES (a delta-K) are identical in Kelvin and Celsius and
// must never be run through `toC`/`toK` -- that is exactly the bug this file
// exists to prevent (see `formatDeltaT` below).

import { toC, type Kelvin } from '@shelter/engine';

/** A single indoor/ambient/surface temperature, Kelvin in -> "°C" string out. */
export function formatTempC(k: Kelvin): string {
  return `${toC(k).toFixed(1)} °C`;
}

/** A temperature DIFFERENCE (e.g. decrement swing, ΔT series). Never subtract
 * 273.15 from a delta -- it is already the same number in K and °C. */
export function formatDeltaT(deltaK: number): string {
  return `${deltaK.toFixed(1)} K`;
}

/** A heat-flow / power quantity, watts in. */
export function formatPower(watts: number): string {
  return Math.abs(watts) >= 1000 ? `${(watts / 1000).toFixed(2)} kW` : `${watts.toFixed(0)} W`;
}

/** Daily/annual energy, kWh in. */
export function formatEnergy(kWh: number): string {
  return `${kWh.toFixed(2)} kWh`;
}

/** Cost, INR in. */
export function formatINR(amountINR: number): string {
  return `₹${amountINR.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
}

/** A dimensionless fraction (e.g. the energy-balance residual), rendered per
 * CONTRACTS.md §7.4's UI display rule: `(residual * 100).toFixed(3) + '%'`. */
export function formatPercent(fraction: number): string {
  return `${(fraction * 100).toFixed(3)}%`;
}

/** An hours count that may be `null` (no humidity data). CONTRACTS.md §7.7:
 * null must render as "not available", never as "0 hours" -- that would be a
 * lie about data quality. */
export function formatHours(hours: number | null): string {
  return hours === null ? 'not available — no humidity data' : `${hours.toFixed(1)} h`;
}
