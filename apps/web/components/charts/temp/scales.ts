// apps/web/components/charts/temp/scales.ts
//
// T-47. Thin d3-scale wrappers -- CONTRACTS.md §7.13 approves d3-scale for
// apps/web. All arithmetic here is plain Celsius `number`, never Kelvin --
// series.ts is the one place that converts (LOG.md rule 5).

import { scaleLinear, type ScaleLinear } from 'd3-scale';

/** Fixed 00:00 -> 24:00 domain -- a 24 h chart never rescales its x-axis to
 * the data, which is what keeps a single-timestep result (acceptance test 8)
 * and a full 288-step day visually comparable and keeps toggling a variant
 * (acceptance test 4) from jumping the axis. */
export function buildXScale(plotWidth: number): ScaleLinear<number, number> {
  return scaleLinear().domain([0, 24]).range([0, plotWidth]);
}

/** Degenerate-domain guard: a single-timestep result (test 8) or a
 * perfectly flat series gives `minC === maxC`, which would otherwise hand
 * d3 a zero-height domain -- not a crash, but every point would collapse
 * onto one pixel row. Padding by at least 1 K keeps the line visible and
 * the axis non-degenerate without ever dividing by the (possibly zero)
 * span. */
export function buildYScale(minC: number, maxC: number, plotHeight: number): ScaleLinear<number, number> {
  const span = maxC - minC;
  const pad = span < 2 ? 1 : span * 0.1;
  // SVG y grows downward -- range is inverted so higher temperatures sit
  // higher on screen.
  return scaleLinear()
    .domain([minC - pad, maxC + pad])
    .range([plotHeight, 0]);
}
