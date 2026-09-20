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
import { t, type Locale } from '../../lib/i18n';
import './messages';
import { badgeFor } from './badge';
import { deltaVsAmbientAt0600 } from './cards';
import styles from './KpiColumn.module.css';

function IntegrityBadge({ meta, locale }: { meta: SimulationResult['meta']; locale: Locale }) {
  const badge = badgeFor(meta.energyBalanceResidual);
  return (
    <div
      className={`${styles.badge} ${badge.ok ? styles.badgeOk : styles.badgeBad}`}
      data-testid="integrity-badge"
      data-status={badge.ok ? 'ok' : 'bad'}
      title={t('kpis.column.integrityBadge.title', locale)}
    >
      {t('kpis.column.integrityBadge.label', locale)}
      {badge.text}
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
  const { result, locale } = useStore();

  if (!result) {
    return (
      <div className={styles.column} data-testid="kpi-column-empty">
        {t('kpis.column.empty', locale)}
      </div>
    );
  }

  const { kpis, meta } = result;
  const delta = deltaVsAmbientAt0600(result);
  const deltaSub =
    delta === null
      ? undefined
      : `${delta >= 0 ? '+' : ''}${formatDeltaT(delta)} ${t('kpis.column.vsOutsideAir', locale)}`;
  const dimensionless = t('kpis.column.dimensionlessSuffix', locale);

  return (
    <div className={styles.column} data-testid="kpi-column">
      <IntegrityBadge meta={meta} locale={locale} />
      <WarningsList warnings={meta.warnings} />

      <div className={styles.grid}>
        <Card
          label={t('kpis.column.card.temp0600', locale)}
          value={formatTempC(kpis.tempAt0600)}
          sub={deltaSub}
          testId="kpi-0600"
        />
        <Card
          label={t('kpis.column.card.hoursComfort', locale)}
          value={`${kpis.hoursInComfort.toFixed(1)} h`}
          testId="kpi-hours-comfort"
        />
        <Card
          label={t('kpis.column.card.auxHeating', locale)}
          value={`${formatEnergy(kpis.auxEnergyKWhPerDay)}/day`}
          testId="kpi-aux"
        />
        <Card
          label={t('kpis.column.card.fuel', locale)}
          value={`${kpis.keroseneEquivalentLitresPerYear.toFixed(1)} L/yr`}
          testId="kpi-fuel"
        />
        <Card
          label={t('kpis.column.card.cost', locale)}
          value={`${formatINR(kpis.costPerYearINR)}/yr`}
          testId="kpi-cost"
        />
        <Card
          label={t('kpis.column.card.co2', locale)}
          value={`${kpis.co2EquivalentKgPerYear.toFixed(1)} kg/yr`}
          testId="kpi-co2"
        />
        <Card label={t('kpis.column.card.minTemp', locale)} value={formatTempC(kpis.minIndoorTemp)} testId="kpi-min" />
        <Card label={t('kpis.column.card.maxTemp', locale)} value={formatTempC(kpis.maxIndoorTemp)} testId="kpi-max" />
        <Card
          label={t('kpis.column.card.meanTemp', locale)}
          value={formatTempC(kpis.meanIndoorTemp)}
          testId="kpi-mean"
        />
        <Card
          label={t('kpis.column.card.swing', locale)}
          value={formatDeltaT(kpis.peakToPeakSwing)}
          testId="kpi-swing"
        />
        <Card
          label={t('kpis.column.card.decrement', locale)}
          value={`${kpis.decrementFactor.toFixed(3)} ${dimensionless}`}
          testId="kpi-decrement"
        />
        <Card label={t('kpis.column.card.timeLag', locale)} value={`${kpis.timeLagHours.toFixed(1)} h`} testId="kpi-lag" />
        <Card
          label={t('kpis.column.card.below5', locale)}
          value={`${kpis.hoursBelow5C.toFixed(1)} h`}
          testId="kpi-below5"
        />
        <Card
          label={t('kpis.column.card.belowFreezing', locale)}
          value={`${kpis.hoursBelowFreezing.toFixed(1)} h`}
          testId="kpi-freezing"
        />
        {/* CONTRACTS.md §7.7: null must render as "not available", never as
         * "0 hours" -- rendering null as zero is a lie about data quality.
         * `formatHours` (lib/units.ts) already implements exactly that. */}
        <Card
          label={t('kpis.column.card.condensation', locale)}
          value={formatHours(kpis.condensationRiskHours)}
          testId="kpi-condensation"
        />
      </div>
    </div>
  );
}
