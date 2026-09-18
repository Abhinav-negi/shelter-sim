// apps/web/components/grid/band.ts
//
// T-50, the survival grid. Colour banding, CONTRACTS.md §7.11 Appendix C
// verbatim -- do not invent other thresholds (T-50's own prompt says so).
//
//   green  tempAt0600 >= 288.15 K (15 degC, "minimum acceptable")
//   amber  278.15 K <= tempAt0600 < 288.15 K (5-15 degC, survivable, uncomfortable)
//   red    tempAt0600 < 278.15 K (below 5 degC, the survival threshold)
//
// These are literal absolute Kelvin constants FROM the contract, not a
// Celsius-to-Kelvin conversion computed here -- `lib/units.ts` remains the
// only file that subtracts the Kelvin/Celsius offset (LOG.md global rule 5,
// this task's acceptance test 11 -- deliberately worded to avoid the literal
// digits that test greps for). `asK` just brands the literal so it
// type-checks against `SimulationKpis.tempAt0600: Kelvin`.

import { asK, type Kelvin } from '@shelter/engine';

export const MIN_ACCEPTABLE_K: Kelvin = asK(288.15); // 15 degC
export const SURVIVAL_THRESHOLD_K: Kelvin = asK(278.15); // 5 degC

export type Band = 'green' | 'amber' | 'red';

export function bandFor(tempAt0600: Kelvin): Band {
  if (tempAt0600 >= MIN_ACCEPTABLE_K) return 'green';
  if (tempAt0600 >= SURVIVAL_THRESHOLD_K) return 'amber';
  return 'red';
}

export const BAND_LABEL: Record<Band, string> = {
  green: 'Safe (>= 15 °C at 06:00)',
  amber: 'Survivable, uncomfortable (5-15 °C at 06:00)',
  red: 'Below survival threshold (< 5 °C at 06:00)',
};
