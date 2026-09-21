'use client';

// apps/web/components/charts/solar/AlbedoComparison.tsx
//
// T-48 View 4: "A with/without-snow-albedo comparison, exposing the
// Ladakh-specific effect: raising ground albedo 0.20 -> 0.80 multiplies the
// ground-reflected component by exactly 4."
//
// Two things are shown, because `SimulationResult.solar` cannot answer both
// from one run:
//  (a) A live BEFORE/AFTER: the same request re-simulated with only
//      `site.groundAlbedo` changed (0.20 vs 0.80, `ALBEDO.genericGround`/
//      `ALBEDO.freshSnow` -- already-named engine constants, CONTRACTS.md
//      7.10, not invented here), diffing the south wall's real
//      `dailyTotalKWh.bySurface` total. This calls the SAME canonical
//      `simulate()` the whole app runs on, not a reimplementation -- exactly
//      how every other comparison in this app (the sweep, the survival
//      grid) produces a counterfactual.
//  (b) The ISOLATED ground-reflected component (kWh/m^2, `groundAlbedo.ts`),
//      because (a)'s totals also include beam and diffuse, which do not
//      scale with albedo at all -- so the total in (a) will NOT itself
//      quadruple, only rise, and asserting "x4" against it would be the
//      "plausible-looking wrong number" CONTRACTS.md 7.8 warns against. The
//      literal x4 claim is only true of the isolated component, which is
//      exactly what `groundAlbedo.ts` computes without reimplementing
//      `solar/transposition.ts`.
import React, { useMemo } from 'react';
import { ALBEDO, simulate, type SimulationRequest } from '@shelter/engine';
import { formatEnergy } from '../../../lib/units';
import { classifySurface, surfaceCaptures } from './orientation';
import { groundReflectedKWhPerM2 } from './groundAlbedo';

function withAlbedo(request: SimulationRequest, albedo: number): SimulationRequest {
  return { ...request, site: { ...request.site, groundAlbedo: albedo } };
}

function southTotalKWh(request: SimulationRequest): number {
  const result = simulate(request);
  const rows = surfaceCaptures(result, request);
  const south = rows.filter((r) => r.orientation === 'S');
  return south.reduce((sum, r) => sum + r.totalKWh, 0);
}

/** The south wall's tilt, for the isolated ground-reflected calculation --
 * falls back to 90 (vertical) if the building somehow has no south-facing
 * surface, since the comparison is meaningless without one. Same
 * `classifySurface` (nominal azimuth, `orientation.ts`) as every other view,
 * so "south" means the same wall here as it does in the bar chart. */
function southTilt(request: SimulationRequest): number {
  const south = request.building.surfaces.find((s) => classifySurface(s) === 'S');
  return south?.tilt ?? 90;
}

export function AlbedoComparison({ request }: { request: SimulationRequest }) {
  const { bare, snow, groundBare, groundSnow, tilt } = useMemo(() => {
    const bareReq = withAlbedo(request, ALBEDO.genericGround);
    const snowReq = withAlbedo(request, ALBEDO.freshSnow);
    const tiltDeg = southTilt(request);
    return {
      bare: southTotalKWh(bareReq),
      snow: southTotalKWh(snowReq),
      // `groundReflectedKWhPerM2` takes the albedo as an explicit argument
      // and never reads `request.site.groundAlbedo` -- `bareReq`/`snowReq`
      // would be equivalent inputs here, so the plain `request` is used.
      groundBare: groundReflectedKWhPerM2(request, tiltDeg, ALBEDO.genericGround),
      groundSnow: groundReflectedKWhPerM2(request, tiltDeg, ALBEDO.freshSnow),
      tilt: tiltDeg,
    };
  }, [request]);

  const ratio = groundBare > 0 ? groundSnow / groundBare : 0;
  const max = Math.max(1e-9, bare, snow);

  return (
    <div data-testid="solar-albedo-comparison">
      <h3 style={{ fontSize: '0.95rem', margin: '0 0 0.5rem' }}>
        Ground albedo: bare ground vs. fresh snow
      </h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
        {[
          {
            label: `Bare ground (albedo ${ALBEDO.genericGround.toFixed(2)})`,
            value: bare,
            testid: 'solar-albedo-bare',
          },
          {
            label: `Fresh snow (albedo ${ALBEDO.freshSnow.toFixed(2)})`,
            value: snow,
            testid: 'solar-albedo-snow',
          },
        ].map((row) => (
          <div key={row.testid} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <div style={{ width: '11rem', flexShrink: 0, fontSize: '0.78rem' }}>{row.label}</div>
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
                  width: `${(row.value / max) * 100}%`,
                  minWidth: '2px',
                  background: '#0891b2',
                  height: '1.1rem',
                }}
              />
            </div>
            <div
              data-testid={row.testid}
              style={{ width: '6rem', flexShrink: 0, fontSize: '0.78rem', textAlign: 'right' }}
            >
              {formatEnergy(row.value)}
            </div>
          </div>
        ))}
      </div>
      <p style={{ fontSize: '0.75rem', color: '#475569', marginTop: '0.4rem' }}>
        South wall total, same building and day, only ground albedo changed.
      </p>
      <p
        data-testid="solar-albedo-ground-only"
        style={{ fontSize: '0.75rem', marginTop: '0.4rem' }}
      >
        Ground-reflected component only (tilt {tilt.toFixed(0)}&deg;): {groundBare.toFixed(3)}{' '}
        kWh/m² (bare) &rarr; {groundSnow.toFixed(3)} kWh/m² (snow) &mdash;{' '}
        <strong data-testid="solar-albedo-ratio">{ratio.toFixed(2)}&times;</strong>
      </p>
    </div>
  );
}
