'use client';

// apps/web/components/charts/solar/OrientationBars.tsx
//
// T-48 View 2, "the most important of the four": a horizontal bar per
// surface orientation (S/E/W/N/Roof), in kWh. This is the chart the task's
// own "why this exists" quote is about: the south bar towering over the
// north bar makes the orientation principle obvious without a caption.
//
// Bars are plain CSS flex boxes sized by PERCENTAGE of the largest bar (no
// canvas/SVG, no chart library -- CONTRACTS.md 7.13 has none on the approved
// list and none is needed), so they degrade gracefully to a narrow viewport
// (acceptance test 10) without any JS resize logic.
//
// A SECOND number is shown next to each bar: solar INTENSITY (kWh/m^2/day,
// straight off `incidentBySurface`, CONTRACTS.md 7.7 -- no new computation,
// a plain time integral of an existing series). This is deliberate, not
// decoration: CONTRACTS.md 7.10's own "Ladakh headline" anchor ("the
// vertical south wall's daily total EXCEEDS the horizontal roof's") is
// stated for irradiance intensity (W/m^2), not for this specific building's
// absorbed kWh -- and the two can disagree. The six bundled presets all
// share one box geometry where the flat roof (25 m^2) is ~1.9x a single
// wall's face area (13 m^2), so the roof's absolute kWh bar can exceed the
// south wall's kWh bar even though the south wall receives far more energy
// per square metre -- i.e. the "south beats the roof" physics claim is true
// per unit area, not true of this building's raw absorbed energy. Showing
// both numbers is the honest way to demonstrate BOTH real facts at once
// without silently picking the one that makes a tidier headline (see
// solar.test.ts test 3 and this task's Evidence block for the measured
// numbers on both sides of that distinction).
import React from 'react';
import type { SimulationRequest, SimulationResult } from '@shelter/engine';
import { formatEnergy } from '../../../lib/units';
import {
  BAR_ORIENTATIONS,
  ORIENTATION_LABELS,
  surfaceCaptures,
  byOrientation,
  type Orientation,
} from './orientation';

const BAR_COLOR: Record<Orientation, string> = {
  S: '#d97706',
  E: '#2563eb',
  W: '#7c3aed',
  N: '#334155',
  Roof: '#059669',
  Floor: '#9ca3af',
};

function intensityKWhPerM2(result: SimulationResult, surfaceId: string, dt: number): number {
  const series = result.solar.incidentBySurface[surfaceId];
  if (!series) return 0;
  let joules = 0;
  for (let i = 0; i < series.length; i++) joules += series[i]! * dt;
  return joules / 3.6e6;
}

export function OrientationBars({
  result,
  request,
}: {
  result: SimulationResult;
  request: SimulationRequest;
}) {
  const rows = surfaceCaptures(result, request);
  const totals = byOrientation(rows);
  const dt = request.options.timestepSeconds;

  // one representative surface id per orientation, for the intensity figure
  // -- the shared building geometry has exactly one, but pick the largest
  // total if a future building ever has more than one per octant.
  const representative: Partial<Record<Orientation, string>> = {};
  for (const row of rows) {
    const current = representative[row.orientation];
    if (!current || row.totalKWh > (byIdKWh(rows, current) ?? -Infinity))
      representative[row.orientation] = row.surfaceId;
  }
  function byIdKWh(list: typeof rows, id: string): number | undefined {
    return list.find((r) => r.surfaceId === id)?.totalKWh;
  }

  const max = Math.max(1e-9, ...BAR_ORIENTATIONS.map((o) => totals[o]));

  return (
    <div data-testid="solar-orientation-bars">
      <h3 style={{ fontSize: '0.95rem', margin: '0 0 0.5rem' }}>Solar capture by orientation</h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
        {BAR_ORIENTATIONS.map((o) => {
          const kWh = totals[o];
          const widthPct = (kWh / max) * 100;
          const surfaceId = representative[o];
          const intensity = surfaceId ? intensityKWhPerM2(result, surfaceId, dt) : 0;
          return (
            <div
              key={o}
              data-testid={`solar-bar-${o}`}
              style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', minWidth: 0 }}
            >
              <div style={{ width: '3.2rem', flexShrink: 0, fontSize: '0.8rem' }}>
                {ORIENTATION_LABELS[o]}
              </div>
              <div
                style={{
                  flex: '1 1 auto',
                  minWidth: 0,
                  background: '#f1f5f9',
                  borderRadius: '3px',
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    width: `${widthPct}%`,
                    minWidth: kWh > 0 ? '2px' : 0,
                    background: BAR_COLOR[o],
                    height: '1.1rem',
                  }}
                />
              </div>
              <div
                data-testid={`solar-bar-${o}-value`}
                style={{ width: '5.5rem', flexShrink: 0, fontSize: '0.78rem', textAlign: 'right' }}
              >
                {formatEnergy(kWh)}
              </div>
              <div
                data-testid={`solar-bar-${o}-intensity`}
                style={{
                  width: '5.5rem',
                  flexShrink: 0,
                  fontSize: '0.7rem',
                  textAlign: 'right',
                  color: '#64748b',
                }}
                title="Solar intensity, independent of this surface's real area"
              >
                {intensity.toFixed(2)} kWh/m²
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
