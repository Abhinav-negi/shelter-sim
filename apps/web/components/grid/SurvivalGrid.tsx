'use client';

// apps/web/components/grid/SurvivalGrid.tsx
//
// T-50, the survival grid (log/AREA-F-frontend.md). "This is the screen
// that answers the question a procurement officer actually has: not 'what
// is the average performance' but 'will this keep people safe on the worst
// day?'" One row per scenario in `store.scenarios`, colour-banded by how
// cold the shelter got at 06:00.
//
// All the non-JSX logic (row derivation, banding, offline fallback, the
// progress/empty/offline copy) lives in `rows.ts` / `band.ts` /
// `scenario-meta.ts` so it is unit-testable without a component-rendering
// library, which is not on the approved dependency list (CONTRACTS.md §7.13).

import { useState } from 'react';
import { actions, useStore } from '../../lib/store';
import { formatEnergy, formatPercent, formatTempC } from '../../lib/units';
import styles from './SurvivalGrid.module.css';
import { BAND_LABEL, type Band } from './band';
import { deriveGridState, progressText } from './rows';

const BAND_ORDER: Band[] = ['green', 'amber', 'red'];

function ColourKey() {
  return (
    <div className={styles.key} data-testid="grid-colour-key">
      {BAND_ORDER.map((band) => (
        <span key={band}>
          <span className={`${styles.keySwatch} ${styles[band]}`} />
          {BAND_LABEL[band]}
        </span>
      ))}
    </div>
  );
}

export function SurvivalGrid() {
  const state = useStore();
  // Purely local UI affordance (which row was last clicked) -- NOT a store
  // field. See condition 4's handling below and this task's Evidence block:
  // there is no honest way to persist "the selected scenario" in `AppState`
  // today without adding a field to `lib/store.ts`, which is off this
  // task's allow-list.
  const [selectedId, setSelectedId] = useState<string | null>(null);

  function selectRow(scenarioId: string) {
    setSelectedId(scenarioId);
    // Condition 4: the temperature chart (T-47) does not exist yet (still a
    // <Placeholder> in app-shell.tsx) and `ScenarioResult` (store.ts) carries
    // no time series to feed it even if it did (T-60 owns that contract,
    // not done). Switching to the tab that will one day hold the chart is
    // the correct forward-compatible partial step; `setActiveTab` is a real,
    // existing store action.
    actions.setActiveTab('temp');
  }

  const { rows, note, showEmptyState, emptyText, showProgress } = deriveGridState({
    online: state.online,
    scenarios: state.scenarios,
    offlineResult: state.result,
    presetId: state.presetId,
  });

  return (
    <div data-testid="survival-grid">
      <ColourKey />
      {note && (
        <p className={styles.note} data-testid="grid-offline-note">
          {note}
        </p>
      )}
      {showProgress && (
        <p data-testid="grid-progress">{progressText(rows.length)}</p>
      )}
      {showEmptyState ? (
        <p className={styles.empty} data-testid="grid-empty-state">
          {emptyText}
        </p>
      ) : (
        <div className={styles.container}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Scenario</th>
                <th>Description</th>
                <th>Date</th>
                <th>06:00 temp</th>
                <th>Min indoor temp</th>
                <th>Hours below 5 °C</th>
                <th>Hours in comfort</th>
                <th>Aux energy</th>
                <th>Energy balance</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) =>
                row.status === 'error' ? (
                  <tr key={row.scenarioId} className={styles.errorRow} data-testid={`grid-row-${row.scenarioId}`}>
                    <td>{row.name}</td>
                    <td colSpan={8}>
                      Failed to compute ({row.code}): {row.message}
                    </td>
                  </tr>
                ) : (
                  <tr
                    key={row.scenarioId}
                    className={[styles.row, styles[row.band], selectedId === row.scenarioId ? styles.rowSelected : ''].join(' ')}
                    data-testid={`grid-row-${row.scenarioId}`}
                    data-band={row.band}
                    tabIndex={0}
                    role="button"
                    aria-pressed={selectedId === row.scenarioId}
                    onClick={() => selectRow(row.scenarioId)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') selectRow(row.scenarioId);
                    }}
                  >
                    <td>{row.name}</td>
                    <td>{row.description}</td>
                    <td>{row.date}</td>
                    <td>{formatTempC(row.tempAt0600)}</td>
                    <td>{formatTempC(row.minIndoorTemp)}</td>
                    <td>{row.hoursBelow5C.toFixed(1)} h</td>
                    <td>{row.hoursInComfort.toFixed(1)} h</td>
                    <td>{formatEnergy(row.auxEnergyKWhPerDay)}/day</td>
                    <td>{formatPercent(row.energyBalanceResidual)}</td>
                  </tr>
                ),
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
