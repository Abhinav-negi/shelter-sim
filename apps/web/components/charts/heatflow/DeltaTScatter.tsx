// apps/web/components/charts/heatflow/DeltaTScatter.tsx
'use client';

import React from 'react';
import type { HeatFlows } from '@shelter/engine';
import styles from './HeatFlowPanel.module.css';
import { buildScatterLayout } from './scatter';

const WIDTH = 480;
const HEIGHT = 320;
const KEY = 'Q5_envelopeConduction' as const;

export function DeltaTScatter({ heatFlows }: { heatFlows: HeatFlows }) {
  const { points, linePath, fit } = buildScatterLayout(heatFlows, KEY, WIDTH, HEIGHT);

  return (
    <div className={styles.scrollBox} data-testid="heatflow-scatter">
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} role="img" aria-label="Envelope conduction versus ambient-shelter temperature difference" className={styles.svg}>
        {points.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r={2.5} fill="#5b8dd6" fillOpacity={0.55} />
        ))}
        <path d={linePath} stroke="#c1440e" strokeWidth={2} fill="none" data-testid="scatter-fit-line" />
      </svg>
      <p className={styles.caption} data-testid="scatter-fit-stats">
        Fitted slope {fit.slope.toFixed(2)} W/K, R² {fit.r2.toFixed(3)} — envelope conduction (Q5) vs. ambient–shelter ΔT.
      </p>
    </div>
  );
}
