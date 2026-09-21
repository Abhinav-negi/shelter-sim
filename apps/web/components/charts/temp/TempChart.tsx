'use client';

// apps/web/components/charts/temp/TempChart.tsx
//
// T-47 (log/AREA-F-frontend.md) -- "PS Deliverable 1". A 24 h line chart of
// T_indoor / T_ambient with a shaded comfort band, up to four overlaid
// design variants, and the 06:00 pre-dawn minimum labelled explicitly --
// "the single number to look at" per this task's own brief.
//
// Hand-authored SVG, d3-shape/d3-scale only (CONTRACTS.md §7.13 -- no chart
// framework). All non-JSX logic lives in sibling modules (series.ts,
// scales.ts, interaction.ts, colors.ts, format.ts) so it is unit-testable
// without a DOM, the same split components/grid/rows.ts and
// components/house/color.ts already use in this codebase.
//
// This component takes `variants`/`comfortBand` as PROPS rather than reading
// `lib/store.ts` directly. `lib/store.ts` (off this task's allow-list) has
// no field for "up to four compared designs" today -- only a single
// `result`/`request` -- so there is no honest way to read a real multi-
// variant comparison from the store yet. A caller with exactly one design
// (the common case today) passes a single-element `variants` array built
// from `useStore()`'s `result`/`request`; wiring an actual multi-run Compare
// picker into that array is future work for whichever task owns that
// picker (T-36's store already documents this same kind of gap for T-46 and
// T-50 -- see their own file headers).

import React, { useMemo, useRef, useState } from 'react';
import { line as d3line, curveMonotoneX } from 'd3-shape';
import type { Kelvin, SimulationResult } from '@shelter/engine';
import { toC } from '@shelter/engine';
import { formatTempC } from '../../../lib/units';
import { dayMaxIndoor, dayMinIndoor, dayPoints, indoorAt0600, type HourPoint } from './series';
import { buildXScale, buildYScale } from './scales';
import { formatHourLabel } from './format';
import {
  AMBIENT_COLOR,
  AMBIENT_DASH,
  COMFORT_BAND_FILL,
  COMFORT_BAND_STROKE,
  MAX_MARKER_COLOR,
  MAX_VARIANTS,
  MEAN_RADIANT_DASH,
  MIN_MARKER_COLOR,
  REF_0600_COLOR,
  VARIANT_COLORS,
} from './colors';
import {
  nearestPointIndex,
  toggleVariantVisibility,
  tooltipDataAt,
  type VariantSeries,
} from './interaction';
import styles from './TempChart.module.css';

export interface TempChartVariant {
  id: string;
  label: string;
  result: SimulationResult;
  /** `request.weather.startHour` for THIS variant's run -- needed to align
   * its samples onto the clock-hour axis (see series.ts's `dayPoints`). */
  weatherStartHour: number;
}

export interface TempChartProps {
  /** 1-4 compared designs. Anything past the 4th is ignored (documented,
   * not silently truncated -- see the slice below). */
  variants: TempChartVariant[];
  comfortBand: { lower: Kelvin; upper: Kelvin };
}

// viewBox is sized to the WORST CASE (400 px), not the desktop case, so
// "legible at 400 px" (acceptance test 10) is 1:1 native pixels rather than
// something shrunk down and hoped to still be readable; wider containers
// simply scale the whole thing up, which never creates an overlap that
// wasn't already there at 400. Mirrors components/house/HouseView.tsx's
// viewBox-only, no-fixed-width/height convention (its own test 7).
const VB_WIDTH = 400;
const VB_HEIGHT = 220;
const MARGIN = { top: 14, right: 10, bottom: 24, left: 34 };
const PLOT_WIDTH = VB_WIDTH - MARGIN.left - MARGIN.right;
const PLOT_HEIGHT = VB_HEIGHT - MARGIN.top - MARGIN.bottom;
const X_TICKS = [0, 6, 12, 18, 24];

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

export function TempChart({ variants, comfortBand }: TempChartProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const limited = variants.slice(0, MAX_VARIANTS);

  const renderable = useMemo(
    () =>
      limited
        .map((v, i) => ({
          id: v.id,
          label: v.label,
          color: VARIANT_COLORS[i % VARIANT_COLORS.length]!,
          result: v.result,
          weatherStartHour: v.weatherStartHour,
          points: dayPoints(v.result, v.weatherStartHour),
        }))
        .filter((v) => v.points.length > 0),
    [limited],
  );

  // Every variant starts visible. Deliberately initialised once (not kept
  // in sync with a later change of `variants`' id set) -- a session-scoped
  // comparison is not expected to swap its variant set under the user's
  // feet; if a future Compare picker needs that, it remounts this component
  // with a `key`, which is the normal React way to reset local state.
  const [visible, setVisible] = useState<Set<string>>(() => new Set(renderable.map((v) => v.id)));
  const [showMeanRadiant, setShowMeanRadiant] = useState(false);
  const [hoverHour, setHoverHour] = useState<number | null>(null);

  if (renderable.length === 0) {
    return (
      <div className={styles.container} data-testid="temp-chart-empty">
        <h3 data-testid="temp-chart-title">PS Deliverable 1 — Predicted inside temperature</h3>
        <p>No simulation result yet.</p>
      </div>
    );
  }

  const primary = renderable[0]!;
  const comfortLowerC = toC(comfortBand.lower);
  const comfortUpperC = toC(comfortBand.upper);

  // Stable domain across ALL renderable variants (not just the currently
  // visible ones) so toggling a variant on/off never rescales the axes --
  // acceptance test 4's "individually toggleable" should not also mean
  // "individually re-scaling".
  const allValuesC: number[] = [comfortLowerC, comfortUpperC];
  for (const v of renderable) {
    for (const p of v.points) {
      allValuesC.push(p.indoorC, p.ambientC, p.meanRadiantC);
    }
  }
  const minC = Math.min(...allValuesC);
  const maxC = Math.max(...allValuesC);

  const xScale = buildXScale(PLOT_WIDTH);
  const yScale = buildYScale(minC, maxC, PLOT_HEIGHT);
  const yTicks = yScale.ticks(4);

  function linePath(points: HourPoint[], y: (p: HourPoint) => number): string {
    return (
      d3line<HourPoint>()
        .x((d) => xScale(d.hour))
        .y((d) => yScale(y(d)))
        .curve(curveMonotoneX)(points) ?? ''
    );
  }

  const idx0600K = indoorAt0600(primary.result, primary.weatherStartHour);
  const temp0600C = toC(idx0600K);
  const minPoint = dayMinIndoor(primary.points)!;
  const maxPoint = dayMaxIndoor(primary.points)!;

  const visibleSeries: VariantSeries[] = renderable
    .filter((v) => visible.has(v.id))
    .map((v) => ({ id: v.id, label: v.label, color: v.color, points: v.points }));

  const tooltip =
    hoverHour === null
      ? null
      : tooltipDataAt(visibleSeries.length > 0 ? visibleSeries : renderable, hoverHour);

  function hourFromClientX(clientX: number): number {
    const svg = svgRef.current;
    if (!svg) return 0;
    const rect = svg.getBoundingClientRect();
    if (rect.width === 0) return 0;
    const xViewBox = ((clientX - rect.left) / rect.width) * VB_WIDTH;
    const xPlot = xViewBox - MARGIN.left;
    return clamp(xScale.invert(xPlot), 0, 24);
  }

  return (
    <div className={styles.container} data-testid="temp-chart">
      <h3 data-testid="temp-chart-title">PS Deliverable 1 — Predicted inside temperature</h3>

      <div className={styles.svgWrap}>
        <svg
          ref={svgRef}
          viewBox={`0 0 ${VB_WIDTH} ${VB_HEIGHT}`}
          className={styles.svg}
          data-testid="temp-chart-svg"
          role="img"
          aria-label="24 hour indoor and ambient temperature chart"
        >
          <g transform={`translate(${MARGIN.left},${MARGIN.top})`}>
            {/* comfort band */}
            <rect
              data-testid="temp-comfort-band"
              x={0}
              y={yScale(comfortUpperC)}
              width={PLOT_WIDTH}
              height={Math.max(0, yScale(comfortLowerC) - yScale(comfortUpperC))}
              fill={COMFORT_BAND_FILL}
              stroke={COMFORT_BAND_STROKE}
              strokeDasharray="2,2"
            />

            {/* y gridlines + ticks, recessive per dataviz guidance */}
            {yTicks.map((t) => (
              <g key={`y-${t}`}>
                <line
                  x1={0}
                  x2={PLOT_WIDTH}
                  y1={yScale(t)}
                  y2={yScale(t)}
                  stroke="#e5e5e0"
                  strokeWidth={1}
                />
                <text
                  x={-4}
                  y={yScale(t)}
                  textAnchor="end"
                  dominantBaseline="middle"
                  fontSize={8}
                  fill="#52514e"
                >
                  {Math.round(t)}
                </text>
              </g>
            ))}
            <text
              transform={`translate(${-MARGIN.left + 8},${PLOT_HEIGHT / 2}) rotate(-90)`}
              textAnchor="middle"
              fontSize={8}
              fill="#52514e"
            >
              °C
            </text>

            {/* x ticks */}
            {X_TICKS.map((h) => (
              <text
                key={`x-${h}`}
                x={xScale(h)}
                y={PLOT_HEIGHT + 14}
                textAnchor="middle"
                fontSize={8}
                fill="#52514e"
              >
                {formatHourLabel(h)}
              </text>
            ))}

            {/* ambient -- one shared dashed line, common weather context */}
            <path
              data-testid="temp-line-ambient"
              d={linePath(primary.points, (p) => p.ambientC)}
              fill="none"
              stroke={AMBIENT_COLOR}
              strokeWidth={1.5}
              strokeDasharray={AMBIENT_DASH}
            />

            {/* per-variant indoor (+ optional mean-radiant) lines */}
            {renderable.map((v) =>
              visible.has(v.id) ? (
                <g key={v.id} data-testid={`temp-variant-lines-${v.id}`}>
                  <path
                    d={linePath(v.points, (p) => p.indoorC)}
                    fill="none"
                    stroke={v.color}
                    strokeWidth={2}
                  />
                  {showMeanRadiant && (
                    <path
                      d={linePath(v.points, (p) => p.meanRadiantC)}
                      fill="none"
                      stroke={v.color}
                      strokeWidth={1}
                      strokeDasharray={MEAN_RADIANT_DASH}
                    />
                  )}
                </g>
              ) : null,
            )}

            {/* 06:00 annotation -- THE number */}
            <line
              x1={xScale(6)}
              x2={xScale(6)}
              y1={0}
              y2={PLOT_HEIGHT}
              stroke={REF_0600_COLOR}
              strokeWidth={1}
              strokeDasharray="3,3"
            />
            <circle cx={xScale(6)} cy={yScale(temp0600C)} r={3} fill={REF_0600_COLOR} />
            <text
              data-testid="temp-annotation-0600"
              x={xScale(6) + 4}
              y={Math.max(8, yScale(temp0600C) - 6)}
              fontSize={8}
              fill={REF_0600_COLOR}
            >
              {`06:00: ${formatTempC(idx0600K)}`}
            </text>

            {/* daily min / max annotations */}
            <circle
              cx={xScale(minPoint.hour)}
              cy={yScale(minPoint.indoorC)}
              r={3}
              fill={MIN_MARKER_COLOR}
            />
            <text
              data-testid="temp-annotation-min"
              x={clamp(xScale(minPoint.hour) + 4, 0, PLOT_WIDTH - 60)}
              y={Math.min(PLOT_HEIGHT - 2, yScale(minPoint.indoorC) + 10)}
              fontSize={8}
              fill={MIN_MARKER_COLOR}
            >
              {`Min ${minPoint.indoorC.toFixed(1)} °C`}
            </text>
            <circle
              cx={xScale(maxPoint.hour)}
              cy={yScale(maxPoint.indoorC)}
              r={3}
              fill={MAX_MARKER_COLOR}
            />
            <text
              data-testid="temp-annotation-max"
              x={clamp(xScale(maxPoint.hour) + 4, 0, PLOT_WIDTH - 60)}
              y={Math.max(8, yScale(maxPoint.indoorC) - 6)}
              fontSize={8}
              fill={MAX_MARKER_COLOR}
            >
              {`Max ${maxPoint.indoorC.toFixed(1)} °C`}
            </text>

            {/* hover crosshair */}
            {tooltip !== null && (
              <line
                x1={xScale(tooltip.hour)}
                x2={xScale(tooltip.hour)}
                y1={0}
                y2={PLOT_HEIGHT}
                stroke="#0b0b0b"
                strokeWidth={1}
                strokeDasharray="1,2"
                data-testid="temp-crosshair"
              />
            )}

            {/* invisible hover-capture layer -- MUST be drawn last so it
                sits on top of every line/marker above. */}
            <rect
              data-testid="temp-hover-layer"
              x={0}
              y={0}
              width={PLOT_WIDTH}
              height={PLOT_HEIGHT}
              fill="transparent"
              onMouseMove={(e) => setHoverHour(hourFromClientX(e.clientX))}
              onMouseLeave={() => setHoverHour(null)}
            />
          </g>
        </svg>

        {tooltip !== null && (
          <div
            className={styles.tooltip}
            data-testid="temp-tooltip"
            style={{ left: `${(tooltip.hour / 24) * 100}%` }}
          >
            <div>{formatHourLabel(tooltip.hour)}</div>
            <div>Ambient: {tooltip.ambientC.toFixed(1)} °C</div>
            {tooltip.entries.map((e) => (
              <div key={e.id} style={{ color: e.color }}>
                {e.label}: {e.indoorC.toFixed(1)} °C
              </div>
            ))}
          </div>
        )}
      </div>

      <ul className={styles.legend} data-testid="temp-legend">
        {renderable.map((v) => (
          <li key={v.id}>
            <label>
              <input
                type="checkbox"
                data-testid={`temp-variant-toggle-${v.id}`}
                checked={visible.has(v.id)}
                onChange={() => setVisible((prev) => toggleVariantVisibility(prev, v.id))}
              />
              <span className={styles.swatch} style={{ backgroundColor: v.color }} />
              {v.label}
            </label>
          </li>
        ))}
        <li>
          <span className={styles.swatchDashed} style={{ borderColor: AMBIENT_COLOR }} />
          Ambient
        </li>
        <li>
          <label>
            <input
              type="checkbox"
              data-testid="temp-toggle-mean-radiant"
              checked={showMeanRadiant}
              onChange={() => setShowMeanRadiant((s) => !s)}
            />
            Mean radiant temperature
          </label>
        </li>
      </ul>

      <p data-testid="temp-comfort-band-label">
        Comfort band: {formatTempC(comfortBand.lower)} – {formatTempC(comfortBand.upper)}
      </p>
    </div>
  );
}

// Exported for tests only, mirroring the exact code path the hover-capture
// rect's onMouseMove calls (nearestPointIndex is exercised via tooltipDataAt).
export { nearestPointIndex };
