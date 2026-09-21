// apps/web/components/charts/heatflow/StackedAreaChart.tsx
'use client';

import React from 'react';
import type { HeatFlows } from '@shelter/engine';
import { formatPower } from '../../../lib/units';
import styles from './HeatFlowPanel.module.css';
import { PATHWAY_KEYS, PATHWAY_META } from './pathways';
import { buildStackedAreaLayout } from './stackedArea';

const WIDTH = 760;
const HEIGHT = 300;

export function StackedAreaChart({
  heatFlows,
  time,
}: {
  heatFlows: HeatFlows;
  time: Float64Array;
}) {
  const { paths, xDomain, yDomain } = buildStackedAreaLayout(heatFlows, time, WIDTH, HEIGHT);
  const zeroY = HEIGHT - ((0 - yDomain[0]) / (yDomain[1] - yDomain[0])) * HEIGHT;

  return (
    <div className={styles.scrollBox} data-testid="heatflow-stacked-area">
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        role="img"
        aria-label="Heat gains and losses over time"
        className={styles.svg}
      >
        <line x1={0} x2={WIDTH} y1={zeroY} y2={zeroY} className={styles.zeroLine} />
        {PATHWAY_KEYS.map((key) => (
          <path
            key={key}
            d={paths[key]}
            fill={PATHWAY_META[key].color}
            data-testid={`stacked-band-${key}`}
            data-pathway={key}
          />
        ))}
        <text x={4} y={12} className={styles.axisLabel}>
          gain ↑
        </text>
        <text x={4} y={HEIGHT - 4} className={styles.axisLabel}>
          loss ↓
        </text>
        <text x={WIDTH - 4} y={HEIGHT - 4} textAnchor="end" className={styles.axisLabel}>
          {xDomain[0].toFixed(0)}h – {xDomain[1].toFixed(0)}h
        </text>
      </svg>
      <ul className={styles.legend} data-testid="heatflow-legend">
        {PATHWAY_KEYS.map((key) => (
          <li key={key} data-testid={`legend-${key}`}>
            <span className={styles.swatch} style={{ background: PATHWAY_META[key].color }} />
            {PATHWAY_META[key].label}
          </li>
        ))}
      </ul>
      <p className={styles.caption}>
        Scale: bands sum to watts at each five-minute step ({formatPower(yDomain[1])} at the top of
        the axis).
      </p>
    </div>
  );
}
