'use client';

// apps/web/app/(workspace)/results/page.tsx
//
// The store is already hydrated by the time this renders -- see
// `app/(workspace)/workspace-shell.tsx`, the one hydration point shared by
// every route in this layout.
//
// The old inline `PresetReadout` (a second, duplicate KPI readout that used
// to sit next to `KpiColumn`, showing the same 5 numbers) is gone:
// `KpiColumn` already shows a superset of those numbers and already has its
// own tested null-result empty state, so nothing here needs to reimplement
// either.
//
// The "grid" tab now renders the real `SurvivalGrid` (it was a placeholder
// before -- the component existed, it just was never imported).

import { actions, useStore, type TabId } from '../../../lib/store';
import { t } from '../../../lib/i18n';
import { HouseView } from '../../../components/house';
import { DayNightAnimation } from '../../../components/house/daynight';
import { TempChart, type TempChartVariant } from '../../../components/charts/temp/TempChart';
import { SolarPanel } from '../../../components/charts/solar/SolarPanel';
import { HeatFlowPanel } from '../../../components/charts/heatflow';
import { SurvivalGrid } from '../../../components/grid/SurvivalGrid';
import { KpiColumn } from '../../../components/kpis/KpiColumn';
import { AssumptionsPanel, LimitationsList, ExportPanel } from '../../../components/meta';

const TABS: TabId[] = ['temp', 'solar', 'heatflow', 'grid'];

function Placeholder({ label, testId }: { label: string; testId: string }) {
  return (
    <div className="placeholder" data-testid={testId}>
      {label}
    </div>
  );
}

export default function ResultsPage() {
  const appState = useStore();

  const tempVariants: TempChartVariant[] = appState.result
    ? [
        {
          id: appState.presetId,
          label: appState.presetId,
          result: appState.result,
          weatherStartHour: appState.request.weather.startHour,
        },
      ]
    : [];

  return (
    <div className="page page--wide">
      <h1>Results</h1>

      <div style={{ position: 'relative' }}>
        <DayNightAnimation />
        <HouseView />
      </div>

      <nav className="tabstrip" role="tablist" aria-label="views">
        {TABS.map((tab) => (
          <button
            key={tab}
            type="button"
            role="tab"
            aria-selected={appState.activeTab === tab}
            onClick={() => actions.setActiveTab(tab)}
          >
            {t(`tabs.${tab}`) === `tabs.${tab}` ? tab : t(`tabs.${tab}`)}
          </button>
        ))}
      </nav>

      <div className="tab-content" role="tabpanel">
        {appState.activeTab === 'temp' &&
          (appState.result ? (
            <TempChart
              variants={tempVariants}
              comfortBand={appState.request.operation.comfortBand}
            />
          ) : (
            <Placeholder label="No result yet" testId="slot-tab-temp-empty" />
          ))}
        {appState.activeTab === 'solar' && <SolarPanel />}
        {appState.activeTab === 'heatflow' && <HeatFlowPanel result={appState.result} />}
        {appState.activeTab === 'grid' && <SurvivalGrid />}
      </div>

      <KpiColumn />
      <AssumptionsPanel />
      <LimitationsList />
      <ExportPanel />
    </div>
  );
}
