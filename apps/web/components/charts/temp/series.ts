// apps/web/components/charts/temp/series.ts
//
// T-47. Pure data-shaping for the temperature chart -- no JSX, no d3-scale,
// so this is unit-testable without a component-rendering library (none is on
// the approved dependency list, CONTRACTS.md §7.13; same rationale as
// components/grid/rows.ts and components/house/color.ts).
//
// Kelvin discipline (LOG.md rule 5): every `toC` call in this whole directory
// happens here and nowhere else in this file's own callers -- `series.ts` is
// the ONE conversion point components/charts/temp/** uses, so a reviewer
// checking "where does the Kelvin offset enter this chart" has exactly one
// file to read. `toC`/`toK` are imported straight from `@shelter/engine`
// (the same pattern already used by `components/advanced/fieldDefs.ts`);
// nothing here spells out the offset constant as a literal number -- this
// task's acceptance test 1 greps for exactly that literal.

import type { Kelvin, SimulationResult } from '@shelter/engine';
import { toC } from '@shelter/engine';
import { hourToTimeIndex } from '../../house/time';

export interface HourPoint {
  /** Clock hour of day, 0-24, ascending -- see the sort below. */
  hour: number;
  indoorC: number;
  ambientC: number;
  meanRadiantC: number;
}

/**
 * One point per timestep of the FINAL reported day (CONTRACTS.md §7.7: "a
 * genuine multi-day run reports the last day"), re-ordered to run 00:00 ->
 * 24:00 by clock hour rather than by array index.
 *
 * Why re-order: `weather.startHour` need not be 0, so the array's own index
 * order does not run left-to-right through the clock. Because the reported
 * day is the spin-up-converged steady periodic response, re-ordering by
 * clock hour is exactly the same physical day, just relabelled onto a
 * conventional 00:00-24:00 axis -- not a resampling or an approximation.
 *
 * Returns `[]` for a zero-length result rather than throwing (acceptance
 * test 9's `result === null` path never reaches this function at all --
 * see `TempChart.tsx` -- but an empty `time` array is guarded here too).
 * A **single-timestep** result (`n === 1`, acceptance test 8) takes the
 * `n > 1 ? ... : 3600` branch below and returns exactly one point; no
 * division touches a length that could be zero.
 */
export function dayPoints(result: SimulationResult, weatherStartHour: number): HourPoint[] {
  const n = result.time.length;
  if (n === 0) return [];
  const dt = n > 1 ? result.time[1]! - result.time[0]! : 3600;
  const stepsPerDay = Math.max(1, Math.round(86400 / dt));
  const start = Math.max(0, n - stepsPerDay);

  const points: HourPoint[] = [];
  for (let i = start; i < n; i++) {
    const hour = (((weatherStartHour + ((i - start) * dt) / 3600) % 24) + 24) % 24;
    points.push({
      hour,
      indoorC: toC(result.temperatures.indoorAir[i]! as Kelvin),
      ambientC: toC(result.temperatures.ambient[i]! as Kelvin),
      meanRadiantC: toC(result.temperatures.meanRadiant[i]! as Kelvin),
    });
  }
  points.sort((a, b) => a.hour - b.hour);
  return points;
}

/** The point (hour + value) at the day's indoor-temperature minimum. `null`
 * for an empty series -- callers must check before drawing an annotation. */
export function dayMinIndoor(points: HourPoint[]): HourPoint | null {
  if (points.length === 0) return null;
  return points.reduce((a, b) => (b.indoorC < a.indoorC ? b : a));
}

export function dayMaxIndoor(points: HourPoint[]): HourPoint | null {
  if (points.length === 0) return null;
  return points.reduce((a, b) => (b.indoorC > a.indoorC ? b : a));
}

/**
 * The indoor temperature AT 06:00, resolved through the exact same
 * hour-to-index arithmetic `packages/engine/src/index.ts` uses for
 * `kpis.tempAt0600` (via the shared `hourToTimeIndex`, components/house/
 * time.ts) -- not a nearest-point lookup into `dayPoints` above, which could
 * legitimately disagree by half a timestep. This is what makes acceptance
 * test 3 ("reads the same value as the tempAt0600 KPI card") true by
 * construction rather than by coincidence.
 */
export function indoorAt0600(result: SimulationResult, weatherStartHour: number): Kelvin {
  const idx = hourToTimeIndex(result, weatherStartHour, 6);
  return result.temperatures.indoorAir[idx]! as Kelvin;
}
