'use client';

// apps/web/components/meta/assumptions/AssumptionsPanel.tsx
//
// T-52(a). Every constant, correlation and conversion factor in one place,
// each with value/unit/source (constants.data.ts, mechanically diffed
// against packages/engine/src/constants.ts by constants.data.test.ts --
// acceptance test 1). The fuel/cost constants are editable and the derived
// yearly figures move live (acceptance test 5) -- "the demo moment plan.md
// §10 describes."
//
// Reads `useStore()` for the current result (read-only; lib/store.ts is
// off this task's allow-list) to source `auxEnergyKWhPerDay` and
// `meta.annualisationMethod`. Recomputes litres/cost/CO2-per-year with the
// IDENTICAL formula packages/engine/src/post/kpis.ts uses
// (`keroseneLitres`), imported from @shelter/engine rather than
// reimplemented, so editing a constant here can never drift from the
// engine's own arithmetic.

import React, { useMemo, useState } from 'react';
import { CONVERSIONS } from '@shelter/engine';
import { useStore } from '../../../lib/store';
import { t } from '../../../lib/i18n';
import '../messages';
import {
  ENGINE_CONSTANTS,
  UNEXPORTED_CALIBRATION_KNOBS,
  SOLAR_DISTRIBUTION,
  CORRELATIONS,
  annualisationMethodNote,
  type AssumptionEntry,
} from './constants.data';
import { recomputeFuelCost } from './fuelCost';
import styles from './AssumptionsPanel.module.css';

function ConstantsTable({
  rows,
  locale,
  testId,
}: {
  rows: AssumptionEntry[];
  locale: 'en' | 'hi';
  testId: string;
}) {
  return (
    <table className={styles.table} data-testid={testId}>
      <thead>
        <tr>
          <th>{t('meta.assumptions.col.name', locale)}</th>
          <th>{t('meta.assumptions.col.value', locale)}</th>
          <th>{t('meta.assumptions.col.unit', locale)}</th>
          <th>{t('meta.assumptions.col.source', locale)}</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.id} data-testid={`assumption-${row.id}`}>
            <td data-label={t('meta.assumptions.col.name', locale)}>
              {row.constantsTsExportName ?? row.id}
            </td>
            <td data-label={t('meta.assumptions.col.value', locale)}>{row.value}</td>
            <td data-label={t('meta.assumptions.col.unit', locale)}>{row.unit}</td>
            <td data-label={t('meta.assumptions.col.source', locale)}>
              {row.source}
              {row.calibrationNote && (
                <div className={styles.note} data-testid={`calibration-note-${row.id}`}>
                  {t('meta.assumptions.calibrationNote', locale)}: {row.calibrationNote}
                </div>
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** Litres/cost/CO2 per year, recomputed client-side with the SAME formula
 * packages/engine/src/post/kpis.ts uses (`keroseneLitres` -- imported, not
 * reimplemented), so this can never silently drift from the engine's own
 * arithmetic. Live-editable inputs feed straight back in. */
function FuelCostSection({ locale }: { locale: 'en' | 'hi' }) {
  const { result } = useStore();
  const [kWhPerL, setKWhPerL] = useState<number>(CONVERSIONS.keroseneKWhPerLitre);
  const [efficiency, setEfficiency] = useState<number>(CONVERSIONS.keroseneStoveEfficiency);
  const [co2PerL, setCo2PerL] = useState<number>(CONVERSIONS.keroseneCo2KgPerLitre);
  const [inrPerL, setInrPerL] = useState<number>(CONVERSIONS.kerosenePriceInrPerLitre);

  const auxKWhPerDay = result?.kpis.auxEnergyKWhPerDay ?? null;

  const derived = useMemo(() => {
    if (auxKWhPerDay === null) return null;
    return recomputeFuelCost({ auxKWhPerDay, kWhPerL, efficiency, co2PerL, inrPerL });
  }, [auxKWhPerDay, kWhPerL, efficiency, co2PerL, inrPerL]);

  return (
    <section>
      <h3 className={styles.sectionTitle}>{t('meta.assumptions.fuelCost', locale)}</h3>
      <p className={styles.subtitle}>{t('meta.assumptions.fuelCostHint', locale)}</p>
      <table className={styles.table} data-testid="fuel-cost-editable-table">
        <tbody>
          <tr className={styles.editRow} data-testid="edit-KEROSENE_KWH_PER_L">
            <td data-label="KEROSENE_KWH_PER_L">KEROSENE_KWH_PER_L (kWh/L)</td>
            <td>
              <input
                type="number"
                step="0.1"
                value={kWhPerL}
                data-testid="input-KEROSENE_KWH_PER_L"
                onChange={(e) => setKWhPerL(Number(e.target.value) || 0)}
              />
            </td>
          </tr>
          <tr className={styles.editRow} data-testid="edit-KEROSENE_STOVE_EFFICIENCY">
            <td data-label="KEROSENE_STOVE_EFFICIENCY">KEROSENE_STOVE_EFFICIENCY (0-1)</td>
            <td>
              <input
                type="number"
                step="0.01"
                value={efficiency}
                data-testid="input-KEROSENE_STOVE_EFFICIENCY"
                onChange={(e) => setEfficiency(Number(e.target.value) || 0)}
              />
            </td>
          </tr>
          <tr className={styles.editRow} data-testid="edit-KEROSENE_CO2_KG_PER_L">
            <td data-label="KEROSENE_CO2_KG_PER_L">KEROSENE_CO2_KG_PER_L (kg/L)</td>
            <td>
              <input
                type="number"
                step="0.1"
                value={co2PerL}
                data-testid="input-KEROSENE_CO2_KG_PER_L"
                onChange={(e) => setCo2PerL(Number(e.target.value) || 0)}
              />
            </td>
          </tr>
          <tr className={styles.editRow} data-testid="edit-KEROSENE_INR_PER_L">
            <td data-label="KEROSENE_INR_PER_L">KEROSENE_INR_PER_L (INR/L)</td>
            <td>
              <input
                type="number"
                step="1"
                value={inrPerL}
                data-testid="input-KEROSENE_INR_PER_L"
                onChange={(e) => setInrPerL(Number(e.target.value) || 0)}
              />
            </td>
          </tr>
        </tbody>
      </table>

      {derived === null ? (
        <p data-testid="fuel-cost-no-result">{t('meta.assumptions.noResult', locale)}</p>
      ) : (
        <div className={styles.fuelCards}>
          <div className={styles.fuelCard}>
            <div className={styles.fuelCardLabel}>
              {t('meta.assumptions.litresPerYear', locale)}
            </div>
            <div className={styles.fuelCardValue} data-testid="derived-litres-per-year">
              {derived.litresPerYear.toFixed(1)} L
            </div>
          </div>
          <div className={styles.fuelCard}>
            <div className={styles.fuelCardLabel}>{t('meta.assumptions.costPerYear', locale)}</div>
            <div className={styles.fuelCardValue} data-testid="derived-cost-per-year">
              {`₹${derived.costPerYearINR.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`}
            </div>
          </div>
          <div className={styles.fuelCard}>
            <div className={styles.fuelCardLabel}>{t('meta.assumptions.co2PerYear', locale)}</div>
            <div className={styles.fuelCardValue} data-testid="derived-co2-per-year">
              {derived.co2PerYearKg.toFixed(0)} kg
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

export function AssumptionsPanel() {
  const { result, locale } = useStore();

  return (
    <div className={styles.panel} data-testid="assumptions-panel">
      <div>
        <h2 className={styles.sectionTitle}>{t('meta.assumptions.title', locale)}</h2>
        <p className={styles.subtitle}>{t('meta.assumptions.subtitle', locale)}</p>
      </div>

      <FuelCostSection locale={locale} />

      <section>
        <h3 className={styles.sectionTitle}>{t('meta.assumptions.engineConstants', locale)}</h3>
        <ConstantsTable rows={ENGINE_CONSTANTS} locale={locale} testId="engine-constants-table" />
      </section>

      <section>
        <h3 className={styles.sectionTitle}>{t('meta.assumptions.calibrationKnobs', locale)}</h3>
        <ConstantsTable
          rows={UNEXPORTED_CALIBRATION_KNOBS}
          locale={locale}
          testId="calibration-knobs-table"
        />
      </section>

      <section>
        <h3 className={styles.sectionTitle}>{t('meta.assumptions.solarDistribution', locale)}</h3>
        <ConstantsTable
          rows={SOLAR_DISTRIBUTION}
          locale={locale}
          testId="solar-distribution-table"
        />
      </section>

      <section>
        <h3 className={styles.sectionTitle}>{t('meta.assumptions.correlations', locale)}</h3>
        <ConstantsTable rows={CORRELATIONS} locale={locale} testId="correlations-table" />
      </section>

      <section>
        <h3 className={styles.sectionTitle}>{t('meta.assumptions.annualisation', locale)}</h3>
        <ConstantsTable
          rows={[annualisationMethodNote(result?.meta.annualisationMethod)]}
          locale={locale}
          testId="annualisation-table"
        />
      </section>
    </div>
  );
}
