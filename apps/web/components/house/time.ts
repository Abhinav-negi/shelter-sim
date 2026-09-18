// apps/web/components/house/time.ts
//
// T-46. Maps `store.scrubberHour` (0-24, CONTRACTS.md §7.7 -- "06:00 is THE
// reference hour for Ladakh") onto an index into `SimulationResult.time` /
// `temperatures.surfaces[id].exterior`, which are per-timestep, not per-hour
// (`options.timestepSeconds`, default 300 s -- CONTRACTS.md §7.5).
//
// Mirrors the same hour-to-index arithmetic `packages/engine/src/index.ts`
// already uses for `kpis.tempAt0600PerDay` (its own `idx0600Local`), so a
// wall's colour at hour 6 lines up with the same sample the KPI card reports
// -- not a second, independently-invented convention.

import type { SimulationResult } from '@shelter/engine';

/** Resolves `hour` (0-24, may be fractional) against the FINAL reported day
 * (CONTRACTS.md §7.7: a genuine multi-day run reports the last day), aligned
 * to `weatherStartHour` (`request.weather.startHour`) the way the engine
 * itself aligns 06:00. */
export function hourToTimeIndex(result: SimulationResult, weatherStartHour: number, hour: number): number {
  const n = result.time.length;
  if (n === 0) return 0;
  const dt = n > 1 ? result.time[1]! - result.time[0]! : 3600;
  const stepsPerDay = Math.max(1, Math.round(86400 / dt));
  const hourInDay = (((hour - weatherStartHour) % 24) + 24) % 24;
  const idxWithinDay = Math.round((hourInDay * 3600) / dt) % stepsPerDay;
  const lastDayStart = Math.max(0, n - stepsPerDay);
  return Math.min(lastDayStart + idxWithinDay, n - 1);
}
