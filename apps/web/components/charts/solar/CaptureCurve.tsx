'use client';

// apps/web/components/charts/solar/CaptureCurve.tsx
//
// T-48 View 3: "A time-of-day curve of instantaneous capture." Plots
// `result.solar.absorbedOpaque` and `.transmittedGlazed` (both W, CONTRACTS
// .md 7.7) against hour-of-day, straight off the raw per-timestep arrays --
// no aggregation, no recompute. Hand-drawn SVG polylines (no chart library,
// CONTRACTS.md 7.13), with a `viewBox` and no fixed pixel width/height so it
// scales down cleanly at 400px (acceptance test 10), the same technique
// `HouseView.tsx` (T-46) already uses in this codebase.
import React from 'react';
import type { SimulationResult } from '@shelter/engine';

const WIDTH = 480;
const HEIGHT = 160;
const PAD_LEFT = 42;
const PAD_BOTTOM = 20;
const PAD_TOP = 10;
const PAD_RIGHT = 8;

function points(time: Float64Array, series: Float64Array, maxW: number): string {
  const plotW = WIDTH - PAD_LEFT - PAD_RIGHT;
  const plotH = HEIGHT - PAD_TOP - PAD_BOTTOM;
  const maxT = time[time.length - 1] || 1;
  const out: string[] = [];
  for (let i = 0; i < time.length; i++) {
    const x = PAD_LEFT + (time[i]! / maxT) * plotW;
    const y = PAD_TOP + plotH - (series[i]! / maxW) * plotH;
    out.push(`${x.toFixed(1)},${y.toFixed(1)}`);
  }
  return out.join(' ');
}

export function CaptureCurve({
  solar,
  time,
}: {
  solar: SimulationResult['solar'];
  time: Float64Array;
}) {
  const { absorbedOpaque, transmittedGlazed } = solar;
  let maxW = 1e-9;
  for (let i = 0; i < absorbedOpaque.length; i++) {
    maxW = Math.max(maxW, absorbedOpaque[i]! + transmittedGlazed[i]!);
  }
  const total = new Float64Array(absorbedOpaque.length);
  for (let i = 0; i < total.length; i++) total[i] = absorbedOpaque[i]! + transmittedGlazed[i]!;

  const maxT = time[time.length - 1] || 1;
  const hourTicks = [0, 6, 12, 18, 24].filter((h) => h * 3600 <= maxT + 1);

  return (
    <div data-testid="solar-capture-curve">
      <h3 style={{ fontSize: '0.95rem', margin: '0 0 0.5rem' }}>
        Instantaneous solar capture over the day (W)
      </h3>
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        style={{ width: '100%', height: 'auto', display: 'block' }}
        role="img"
        aria-label="Instantaneous solar capture, watts, over the day"
      >
        {/* axes */}
        <line
          x1={PAD_LEFT}
          y1={PAD_TOP}
          x2={PAD_LEFT}
          y2={HEIGHT - PAD_BOTTOM}
          stroke="#94a3b8"
          strokeWidth={1}
        />
        <line
          x1={PAD_LEFT}
          y1={HEIGHT - PAD_BOTTOM}
          x2={WIDTH - PAD_RIGHT}
          y2={HEIGHT - PAD_BOTTOM}
          stroke="#94a3b8"
          strokeWidth={1}
        />
        <text x={4} y={PAD_TOP + 4} fontSize="9" fill="var(--color-text-muted)">
          {maxW.toFixed(0)} W
        </text>
        <text x={4} y={HEIGHT - PAD_BOTTOM} fontSize="9" fill="var(--color-text-muted)">
          0 W
        </text>
        {hourTicks.map((h) => {
          const x = PAD_LEFT + ((h * 3600) / maxT) * (WIDTH - PAD_LEFT - PAD_RIGHT);
          return (
            <text
              key={h}
              x={x}
              y={HEIGHT - 4}
              fontSize="9"
              fill="var(--color-text-muted)"
              textAnchor="middle"
            >
              {h}h
            </text>
          );
        })}
        <polyline
          points={points(time, total, maxW)}
          fill="none"
          stroke="#d97706"
          strokeWidth={2}
          data-testid="solar-curve-total"
        />
        <polyline
          points={points(time, transmittedGlazed, maxW)}
          fill="none"
          stroke="#2563eb"
          strokeWidth={1.5}
          data-testid="solar-curve-glazed"
        />
      </svg>
      <div style={{ display: 'flex', gap: '1rem', fontSize: '0.75rem', marginTop: '0.25rem' }}>
        <span>
          <span
            style={{
              display: 'inline-block',
              width: '1em',
              height: '2px',
              background: '#d97706',
              marginRight: '0.3em',
              verticalAlign: 'middle',
            }}
          />
          Total capture (opaque + glazed)
        </span>
        <span>
          <span
            style={{
              display: 'inline-block',
              width: '1em',
              height: '2px',
              background: '#2563eb',
              marginRight: '0.3em',
              verticalAlign: 'middle',
            }}
          />
          Glazed (transmitted) only
        </span>
      </div>
    </div>
  );
}
