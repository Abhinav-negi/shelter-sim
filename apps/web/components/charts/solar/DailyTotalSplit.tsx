'use client';

// apps/web/components/charts/solar/DailyTotalSplit.tsx
//
// T-48 View 1: "The daily total in kWh with a useful-versus-rejected split."
//
// `result.solar.dailyTotalKWh` has exactly two components (CONTRACTS.md
// 7.7): `glazed` (solar transmitted through glazing -- direct gain, heats
// the interior straightaway) and `opaque` (solar absorbed at the exterior
// envelope surface, most of which re-radiates back out via Q3/Q4 before it
// ever conducts through to the interior, per the envelope's own decrement/
// lag numbers, CONTRACTS.md 7.10). "Useful" = glazed, "rejected" = opaque --
// a presentation label on the SAME two numbers the engine already reports,
// not a new computation.
import React from 'react';
import type { SimulationResult } from '@shelter/engine';
import { formatEnergy } from '../../../lib/units';

export function DailyTotalSplit({ solar }: { solar: SimulationResult['solar'] }) {
  const useful = solar.dailyTotalKWh.glazed;
  const rejected = solar.dailyTotalKWh.opaque;
  const total = useful + rejected;
  const usefulPct = total > 0 ? (useful / total) * 100 : 0;
  const rejectedPct = total > 0 ? (rejected / total) * 100 : 0;

  return (
    <div data-testid="solar-daily-split">
      <h3 style={{ fontSize: '0.95rem', margin: '0 0 0.5rem' }}>Daily solar total (kWh)</h3>
      <div
        style={{
          display: 'flex',
          width: '100%',
          height: '1.5rem',
          borderRadius: '4px',
          overflow: 'hidden',
          border: '1px solid #ccc',
        }}
        role="img"
        aria-label={`Useful ${formatEnergy(useful)}, rejected ${formatEnergy(rejected)}`}
      >
        <div
          data-testid="solar-split-useful"
          style={{
            width: `${usefulPct}%`,
            background: '#e0a933',
            minWidth: useful > 0 ? '2px' : 0,
          }}
          title={`Useful (through glazing): ${formatEnergy(useful)}`}
        />
        <div
          data-testid="solar-split-rejected"
          style={{
            width: `${rejectedPct}%`,
            background: '#6b7280',
            minWidth: rejected > 0 ? '2px' : 0,
          }}
          title={`Rejected (absorbed opaque): ${formatEnergy(rejected)}`}
        />
      </div>
      <div style={{ display: 'flex', gap: '1rem', fontSize: '0.8rem', marginTop: '0.35rem' }}>
        <span>
          <span
            style={{
              display: 'inline-block',
              width: '0.7em',
              height: '0.7em',
              background: '#e0a933',
              marginRight: '0.3em',
            }}
          />
          Useful (glazing, direct gain):{' '}
          <strong data-testid="solar-useful-value">{formatEnergy(useful)}</strong>
        </span>
        <span>
          <span
            style={{
              display: 'inline-block',
              width: '0.7em',
              height: '0.7em',
              background: '#6b7280',
              marginRight: '0.3em',
            }}
          />
          Rejected (opaque absorption):{' '}
          <strong data-testid="solar-rejected-value">{formatEnergy(rejected)}</strong>
        </span>
        <span>
          Total: <strong data-testid="solar-total-value">{formatEnergy(total)}</strong>
        </span>
      </div>
    </div>
  );
}
