// apps/web/components/charts/heatflow/HeatFlowPanel.tsx
//
// T-49. The container for all three PS-deliverable-3 views. Title carries
// the literal problem-statement phrasing (acceptance test 5). Renders an
// honest empty state for `result === null` (acceptance test 10) instead of
// letting any of the three sub-views compute against a missing result.

'use client';

import React from 'react';
import type { SimulationResult } from '@shelter/engine';
import styles from './HeatFlowPanel.module.css';
import { StackedAreaChart } from './StackedAreaChart';
import { SankeyDiagram } from './SankeyDiagram';
import { DeltaTScatter } from './DeltaTScatter';

export function HeatFlowPanel({ result }: { result: SimulationResult | null }) {
  return (
    <section className={styles.panel} data-testid="heatflow-panel">
      <h2>PS Deliverable 3 — Heat flow vs. ambient–shelter ΔT over time</h2>
      {result === null ? (
        <p className={styles.empty} data-testid="heatflow-empty-state">
          No simulation result yet — run a design to see its heat-flow breakdown.
        </p>
      ) : (
        <div className={styles.grid}>
          <div>
            <h3>Gains and losses over the day</h3>
            <StackedAreaChart heatFlows={result.heatFlows} time={result.time} />
          </div>
          <div>
            <h3>Where the heat goes</h3>
            <SankeyDiagram dailyTotalsKWh={result.heatFlows.dailyTotalsKWh} />
          </div>
          <div>
            <h3>The self-check: Q vs. ΔT</h3>
            <DeltaTScatter heatFlows={result.heatFlows} />
          </div>
        </div>
      )}
    </section>
  );
}
