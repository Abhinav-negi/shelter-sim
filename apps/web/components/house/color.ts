// apps/web/components/house/color.ts
//
// T-46. Colour-by-value, Ladybug/Insight-style (T-46's own prompt). All maths
// here stays in Kelvin -- CONTRACTS.md §7.1/LOG.md rule 5: Celsius may exist
// only in `apps/web/lib/units.ts`, which is where display text is formatted
// (`HouseView.tsx` imports `formatTempC` from there for the legend). A colour
// ramp's shape does not depend on the unit it is fed, so there is no reason
// for this file to convert at all.

import type { Kelvin, SimulationResult } from '@shelter/engine';

/** Fill used when there is no result yet (acceptance test 4: renders in a
 * neutral, unfilled state, never crashes). */
export const NEUTRAL_FILL = '#cbd5e1';

/** Cold -> neutral -> hot, a diverging ramp (Ladybug/Insight convention).
 * Hand-rolled 3-stop lerp -- no colour-scale dependency is on the approved
 * list (CONTRACTS.md §7.13) and three stops is a few lines, not a library. */
const STOPS: Array<[number, [number, number, number]]> = [
  [0, [43, 89, 195]], // cold blue
  [0.5, [237, 237, 230]], // neutral
  [1, [200, 40, 40]], // hot red
];

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** The exterior-temperature range across every surface at one time index --
 * the colour legend's own range, and it changes hour to hour (acceptance
 * test 5). Degenerates to a +-0.5 K band around a single value rather than a
 * zero-width domain (a divide-by-zero and an invisible legend bar). */
export function tempDomainForIndex(result: SimulationResult, index: number): [Kelvin, Kelvin] {
  let min = Infinity;
  let max = -Infinity;
  for (const surface of Object.values(result.temperatures.surfaces)) {
    const v = surface.exterior[index];
    if (v === undefined) continue;
    if (v < min) min = v;
    if (v > max) max = v;
  }
  if (!Number.isFinite(min) || !Number.isFinite(max)) {
    return [280 as Kelvin, 280 as Kelvin]; // defensive only -- every real result has surface data
  }
  if (min === max) return [(min - 0.5) as Kelvin, (max + 0.5) as Kelvin];
  return [min as Kelvin, max as Kelvin];
}

export function colorForTemp(k: number, domain: readonly [number, number]): string {
  const [lo, hi] = domain;
  const t = hi === lo ? 0.5 : Math.min(1, Math.max(0, (k - lo) / (hi - lo)));
  let i = 0;
  while (i < STOPS.length - 2 && t > STOPS[i + 1]![0]) i++;
  const [t0, c0] = STOPS[i]!;
  const [t1, c1] = STOPS[i + 1]!;
  const localT = t1 === t0 ? 0 : (t - t0) / (t1 - t0);
  const r = Math.round(lerp(c0[0], c1[0], localT));
  const g = Math.round(lerp(c0[1], c1[1], localT));
  const b = Math.round(lerp(c0[2], c1[2], localT));
  return `rgb(${r}, ${g}, ${b})`;
}
