// apps/web/components/charts/heatflow/stackedArea.ts
//
// T-49(a). Pure data-prep for the stacked-area chart -- no JSX, no DOM, so it
// is unit-testable with plain vitest (no jsdom/@testing-library on the
// approved dependency list, CONTRACTS.md §7.13). `StackedAreaChart.tsx` is a
// thin renderer over this module's output.
//
// "Gains above the zero line, losses below" (this task's own prompt) is
// exactly `d3.stackOffsetDiverging`: each series' band is placed entirely
// above zero when its value is >= 0 at that timestep, and entirely below
// zero when it is < 0 -- CONTRACTS.md §7.2's sign convention, made visual.

import { area as d3area, stack as d3stack, stackOffsetDiverging, type Series, type SeriesPoint } from 'd3-shape';
import { scaleLinear } from 'd3-scale';
import type { HeatFlows } from '@shelter/engine';
import { PATHWAY_KEYS, type PathwayKey } from './pathways';

export type StackDatum = { hour: number } & Record<PathwayKey, number>;

/** One row per timestep, `time` (seconds from period start) converted to
 * hours for the x-axis -- CONTRACTS.md §7.1: hours are the natural clock
 * unit for a chart like this, and `time` itself carries no unit conversion
 * risk (it is already plain seconds, never a branded temperature). */
export function toStackData(heatFlows: HeatFlows, time: Float64Array): StackDatum[] {
  const n = time.length;
  const rows: StackDatum[] = new Array(n);
  for (let i = 0; i < n; i++) {
    const row = { hour: time[i]! / 3600 } as StackDatum;
    for (const key of PATHWAY_KEYS) row[key] = heatFlows[key][i]!;
    rows[i] = row;
  }
  return rows;
}

/** The diverging stack layout, keyed by `PATHWAY_KEYS` in that fixed order. */
export function computeStack(data: StackDatum[]): Series<StackDatum, PathwayKey>[] {
  const stackGen = d3stack<StackDatum, PathwayKey>()
    .keys(PATHWAY_KEYS)
    .value((d, key) => d[key])
    .offset(stackOffsetDiverging);
  return stackGen(data);
}

/** The y-domain spanning every band, symmetric-ish padding so the topmost
 * and bottommost bands are not clipped against the SVG edge. Falls back to
 * a +-1 W band around zero so a flat/empty series never yields a degenerate
 * (zero-height) domain -- the same guard `house/color.ts` uses for its own
 * temperature domain. */
export function yDomainOf(series: Series<StackDatum, PathwayKey>[]): [number, number] {
  let min = 0;
  let max = 0;
  for (const layer of series) {
    for (const [y0, y1] of layer) {
      if (y0 < min) min = y0;
      if (y1 < min) min = y1;
      if (y0 > max) max = y0;
      if (y1 > max) max = y1;
    }
  }
  if (min === 0 && max === 0) return [-1, 1];
  const pad = (max - min) * 0.05;
  return [min - pad, max + pad];
}

export interface StackedAreaLayout {
  /** One SVG path `d` string per pathway, same order as `PATHWAY_KEYS`. */
  paths: Record<PathwayKey, string>;
  xDomain: [number, number];
  yDomain: [number, number];
}

/** Builds ready-to-render SVG path strings for every pathway band, inside a
 * `width` x `height` viewBox. Pure function -- no DOM read, no ResizeObserver;
 * `StackedAreaChart.tsx` picks a fixed viewBox and lets CSS scale it, the
 * same pattern `HouseView.tsx` (T-46) already uses for a legible 400px view
 * (acceptance test 11). */
export function buildStackedAreaLayout(heatFlows: HeatFlows, time: Float64Array, width: number, height: number): StackedAreaLayout {
  const data = toStackData(heatFlows, time);
  const series = computeStack(data);
  const xDomain: [number, number] = [data[0]?.hour ?? 0, data[data.length - 1]?.hour ?? 24];
  const yDomain = yDomainOf(series);

  const x = scaleLinear().domain(xDomain).range([0, width]);
  const y = scaleLinear().domain(yDomain).range([height, 0]);

  const areaGen = d3area<SeriesPoint<StackDatum>>()
    .x((d) => x(d.data.hour))
    .y0((d) => y(d[0]!))
    .y1((d) => y(d[1]!));

  const paths = {} as Record<PathwayKey, string>;
  series.forEach((layer, i) => {
    const key = PATHWAY_KEYS[i]!;
    paths[key] = areaGen(layer) ?? '';
  });

  return { paths, xDomain, yDomain };
}

/** Acceptance test 2: every timestep of every series sits on the correct
 * side of zero. Exported so the test file can assert it directly against
 * the real `computeStack` output (the diverging offset's own contract),
 * not just trust the library. */
export function everyBandOnCorrectSide(data: StackDatum[]): boolean {
  const series = computeStack(data);
  for (const layer of series) {
    for (const point of layer) {
      const raw = point.data[layer.key];
      const [y0, y1] = point;
      if (raw >= 0 && (y0 < -1e-9 || y1 < -1e-9)) return false;
      if (raw < 0 && (y0 > 1e-9 || y1 > 1e-9)) return false;
    }
  }
  return true;
}
