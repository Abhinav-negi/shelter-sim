// apps/web/components/charts/heatflow/scatter.ts
//
// T-49(c). The problem statement's own axis: "heat flow details as per the
// temperature difference between ambient and shelter temperature"
// (`heatFlows.deltaT`, added by T-22 for exactly this chart). Plotting
// `Q5_envelopeConduction` against `deltaT` and fitting a line gives the user
// an implicit self-check they can see: a near-straight line with slope near
// the envelope's own ΣUA means the model's conduction term is behaving the
// way basic building physics says it should.
//
// Pure point/regression math, no JSX/DOM -- unit-testable with plain vitest,
// same pattern as `stackedArea.ts`/`sankey.ts`.

import type { HeatFlows } from '@shelter/engine';

export interface ScatterPoint {
  deltaT: number;
  q: number;
}

export function scatterPoints(heatFlows: HeatFlows, key: keyof HeatFlows & string): ScatterPoint[] {
  const series = heatFlows[key] as Float64Array;
  const { deltaT } = heatFlows;
  const n = Math.min(series.length, deltaT.length);
  const points: ScatterPoint[] = new Array(n);
  for (let i = 0; i < n; i++) points[i] = { deltaT: deltaT[i]!, q: series[i]! };
  return points;
}

export interface LinearFit {
  slope: number;
  intercept: number;
  r2: number;
}

/** Ordinary least squares, `q = slope*deltaT + intercept`. Degenerates to a
 * zero-slope, zero-R^2 fit (never NaN/divide-by-zero) when every point
 * shares the same `deltaT` -- acceptance test 10's "never NaN" requirement
 * for an edge-case series. */
export function linearFit(points: ScatterPoint[]): LinearFit {
  const n = points.length;
  if (n < 2) return { slope: 0, intercept: 0, r2: 0 };

  let sx = 0;
  let sy = 0;
  for (const p of points) {
    sx += p.deltaT;
    sy += p.q;
  }
  const mx = sx / n;
  const my = sy / n;

  let sxx = 0;
  let sxy = 0;
  for (const p of points) {
    sxx += (p.deltaT - mx) * (p.deltaT - mx);
    sxy += (p.deltaT - mx) * (p.q - my);
  }
  if (sxx === 0) return { slope: 0, intercept: my, r2: 0 };

  const slope = sxy / sxx;
  const intercept = my - slope * mx;

  let ssRes = 0;
  let ssTot = 0;
  for (const p of points) {
    const pred = slope * p.deltaT + intercept;
    ssRes += (p.q - pred) ** 2;
    ssTot += (p.q - my) ** 2;
  }
  const r2 = ssTot === 0 ? 1 : 1 - ssRes / ssTot;
  return { slope, intercept, r2 };
}

export interface ScatterLayout {
  points: Array<{ x: number; y: number }>;
  linePath: string;
  fit: LinearFit;
  xDomain: [number, number];
  yDomain: [number, number];
}

function domainOf(values: number[]): [number, number] {
  if (values.length === 0) return [-1, 1];
  let min = values[0]!;
  let max = values[0]!;
  for (const v of values) {
    if (v < min) min = v;
    if (v > max) max = v;
  }
  if (min === max) return [min - 1, max + 1];
  const pad = (max - min) * 0.05;
  return [min - pad, max + pad];
}

/** Pixel-space points plus a fitted-line path, inside a `width`x`height`
 * viewBox -- same fixed-viewBox-plus-CSS-scaling pattern as the other two
 * views (acceptance test 11). */
export function buildScatterLayout(
  heatFlows: HeatFlows,
  key: keyof HeatFlows & string,
  width: number,
  height: number,
): ScatterLayout {
  const raw = scatterPoints(heatFlows, key);
  const fit = linearFit(raw);
  const xDomain = domainOf(raw.map((p) => p.deltaT));
  const yDomain = domainOf(raw.map((p) => p.q));

  const sx = (v: number) => ((v - xDomain[0]) / (xDomain[1] - xDomain[0])) * width;
  const sy = (v: number) => height - ((v - yDomain[0]) / (yDomain[1] - yDomain[0])) * height;

  const points = raw.map((p) => ({ x: sx(p.deltaT), y: sy(p.q) }));
  const x1 = xDomain[0];
  const x2 = xDomain[1];
  const y1 = fit.slope * x1 + fit.intercept;
  const y2 = fit.slope * x2 + fit.intercept;
  const linePath = `M ${sx(x1)} ${sy(y1)} L ${sx(x2)} ${sy(y2)}`;

  return { points, linePath, fit, xDomain, yDomain };
}
