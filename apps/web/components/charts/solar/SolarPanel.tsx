'use client';

// apps/web/components/charts/solar/SolarPanel.tsx
//
// T-48, PS Deliverable 2: "Solar thermal energy captured" -- four views of
// `result.solar`, recomputing nothing the engine already reports (see each
// view's own file header for exactly what it does and does not compute).
//
// Follows `HouseView.tsx`'s (T-46) own precedent: no props, reads
// `useStore()` directly -- `app/page.tsx`/`app/app-shell.tsx` are outside
// this task's `apps/web/components/charts/solar/**` allow-list, so wiring
// this panel into the tab shell (`store.activeTab === 'solar'`) is a gap for
// whichever task owns that shell, same as T-46 documented for itself.
import React from 'react';
import { useStore } from '../../../lib/store';
import { DailyTotalSplit } from './DailyTotalSplit';
import { OrientationBars } from './OrientationBars';
import { CaptureCurve } from './CaptureCurve';
import { AlbedoComparison } from './AlbedoComparison';

export function SolarPanel() {
  const { request, result } = useStore();

  return (
    <section data-testid="solar-panel">
      <h2 style={{ fontSize: '1.1rem', margin: '0 0 0.75rem' }}>
        PS Deliverable 2 — Solar thermal energy captured
      </h2>
      {result === null ? (
        <p data-testid="solar-empty-state" style={{ color: '#64748b' }}>
          No simulation result yet — run a simulation to see solar capture.
        </p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <DailyTotalSplit solar={result.solar} />
          <OrientationBars result={result} request={request} />
          <CaptureCurve solar={result.solar} time={result.time} />
          <AlbedoComparison request={request} />
        </div>
      )}
    </section>
  );
}
