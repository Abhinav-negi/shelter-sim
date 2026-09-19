'use client';

// apps/web/components/kpis/KpiColumn.tsx
//
// T-51 (log/AREA-F-frontend.md): the right-hand summary column. Renders
// `result.kpis` / `result.meta` -- COMPUTES NOTHING (this task's own
// prompt); every number on screen is read straight off the result, through
// the one boundary allowed to touch Kelvin (`lib/units.ts`, CONTRACTS.md
// §7.1). The one arithmetic exception is `deltaVsAmbientAt0600` (`cards.ts`),
// which is itself just an index lookup into an already-assembled series.
//
// Reads the store directly (`useStore()`), the same pattern `SurvivalGrid`
// (T-50) and `HouseView` (T-46) use, rather than taking props: wiring this
// component into `app/app-shell.tsx`'s "KPI cards (T-51)" placeholder is
// off this task's allow-list (`apps/web/components/kpis/**` only).

import React from 'react';
import type { SimulationResult } from '@shelter/engine';
import { useStore } from '../../lib/store';
import { formatDeltaT, formatEnergy, formatHours, formatINR, formatTempC } from '../../lib/units';
import { badgeFor } from './badge';
import { deltaVsAmbientAt0600 } from './cards';
import styles from './KpiColumn.module.css';

function IntegrityBadge({ meta }: { meta: SimulationResult['meta'] }) {
  const badge = badgeFor(meta.energyBalanceResidual);
  return (
    <div
      className={`${styles.badge} ${badge.ok ? styles.badgeOk : styles.badgeBad}`}
      data-testid="integrity-badge"
      data-status={badge.ok ? 'ok' : 'bad'}
      title="Energy balance residual: |net energy in − stored energy| ÷ gross energy throughput, over the reported run (CONTRACTS.md §7.4). Below 0.1% is a converged, trustworthy result."
    >
      Energy balance: {badge.text}
    </div>
  );
}

/** Rule 10, non-negotiable: every `meta.warnings` entry visible, always, with
 * no collapse/dismiss affordance to hide behind -- "a warning behind a
 * collapsed panel is a warning nobody reads" (this task's prompt). There is
 * deliberately no dismiss button anywhere in this file: the only way for a
 * warning to disappear is for the next simulation result to no longer carry
 * it. */
function WarningsList({ warnings }: { warnings: string[] }) {
  if (warnings.length === 0) return null;
  return (
    <ul className={styles.warnings} data-testid="kpi-warnings" role="alert">
      {warnings.map((warning) => (
        <li key={warning} data-testid="kpi-warning">
          {warning}
        </li>
      ))}
    </ul>
  );
}

function Card({
  label,
  value,
  sub,
  testId,
}: {
  label: string;
  value: string;
  sub?: string | undefined;
  testId: string;
}) {
  return (
    <div className={styles.card} data-testid={testId}>
      <div className={styles.cardLabel}>{label}</div>
      <div className={styles.cardValue} data-testid={`${testId}-value`}>
        {value}
      </div>
      {sub !== undefined && <div className={styles.cardSub}>{sub}</div>}
    </div>
  );
}

export function KpiColumn() {
  const { result } = useStore();

  if (!result) {
    return (
      <div className={styles.column} data-testid="kpi-column-empty">
        No result yet.
      </div>
    );
  }

  const { kpis, meta } = result;
  const delta = deltaVsAmbientAt0600(result);
  const deltaSub = delta === null ? undefined : `${delta >= 0 ? '+' : ''}${formatDeltaT(delta)} vs outside air`;

  return (
    <div className={styles.column} data-testid="kpi-column">
      <IntegrityBadge meta={meta} />
      <WarningsList warnings={meta.warnings} />

      <div className={styles.grid}>
        <Card label="06:00 temperature" value={formatTempC(kpis.tempAt0600)} sub={deltaSub} testId="kpi-0600" />
        <Card label="Hours in comfort" value={`${kpis.hoursInComfort.toFixed(1)} h`} testId="kpi-hours-comfort" />
        <Card label="Auxiliary heating" value={`${formatEnergy(kpis.auxEnergyKWhPerDay)}/day`} testId="kpi-aux" />
        <Card label="Fuel (kerosene-equivalent)" value={`${kpis.keroseneEquivalentLitresPerYear.toFixed(1)} L/yr`} testId="kpi-fuel" />
        <Card label="Running cost" value={`${formatINR(kpis.costPerYearINR)}/yr`} testId="kpi-cost" />
        <Card label="CO2 emitted" value={`${kpis.co2EquivalentKgPerYear.toFixed(1)} kg/yr`} testId="kpi-co2" />
        <Card label="Min indoor temperature" value={formatTempC(kpis.minIndoorTemp)} testId="kpi-min" />
        <Card label="Max indoor temperature" value={formatTempC(kpis.maxIndoorTemp)} testId="kpi-max" />
        <Card label="Mean indoor temperature" value={formatTempC(kpis.meanIndoorTemp)} testId="kpi-mean" />
        <Card label="Daily swing (peak to peak)" value={formatDeltaT(kpis.peakToPeakSwing)} testId="kpi-swing" />
        <Card label="Decrement factor" value={`${kpis.decrementFactor.toFixed(3)} (dimensionless)`} testId="kpi-decrement" />
        <Card label="Time lag" value={`${kpis.timeLagHours.toFixed(1)} h`} testId="kpi-lag" />
        <Card label="Hours below 5 °C" value={`${kpis.hoursBelow5C.toFixed(1)} h`} testId="kpi-below5" />
        <Card label="Hours below freezing" value={`${kpis.hoursBelowFreezing.toFixed(1)} h`} testId="kpi-freezing" />
        {/* CONTRACTS.md §7.7: null must render as "not available", never as
         * "0 hours" -- rendering null as zero is a lie about data quality.
         * `formatHours` (lib/units.ts) already implements exactly that. */}
        <Card label="Condensation risk" value={formatHours(kpis.condensationRiskHours)} testId="kpi-condensation" />
      </div>
    </div>
  );
}
