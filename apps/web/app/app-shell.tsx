'use client';

// apps/web/app/app-shell.tsx
//
// The client half of the keystone layout. `lib/store.ts` cannot hold this
// JSX itself (it is a plain `.ts` module, deliberately not bundled from a
// client entry point directly importing `@shelter/data` -- see its file
// header) and `app/page.tsx` cannot be 'use client' either (it is the Server
// Component that resolves the default preset via `@shelter/data`, which is
// not browser-bundle-safe). This file is the minimal client boundary that
// bridges the two: `page.tsx` renders `<AppShell .../>` with the
// server-resolved preset as plain serializable props, and everything
// interactive from here on (the store subscription, tab switching, the
// advanced-panel toggle) lives in this one file.
//
// TECH.md §11.2's three-column layout: inputs left, house + tab strip
// centre, KPI cards right. Each slot below was originally a labelled
// placeholder so each Area F task (T-44..T-53) could edit its own directory
// under `components/` without touching this file or `store.ts`. T-71 wired
// the seven components that were done ([x]) at the time into their slots;
// `slot-tab-grid` (T-50) and `slot-assumptions` (T-52) remain placeholders
// because those tasks do not exist yet -- see log/AREA-F-frontend.md T-71.
//
// The inline KPI readout (`PresetReadout`) is intentionally kept alongside
// the real `KpiColumn` (T-51): it reads real numbers out of the
// preset-loaded `result` and is the "first screen shows a preset result"
// requirement (acceptance test 9), distinct from the KPI card component.

import React, { useState } from 'react';
import type { SimulationRequest, SimulationResult } from '@shelter/engine';
import { actions, hydrateStore, useStore, type TabId } from '../lib/store';
import { formatEnergy, formatPercent, formatTempC } from '../lib/units';
import { t } from '../lib/i18n';
import { SimpleForm } from '../components/inputs';
import { AdvancedPanel } from '../components/advanced/AdvancedPanel';
import { HouseView } from '../components/house';
import { DayNightAnimation } from '../components/house/daynight';
import { TempChart, type TempChartVariant } from '../components/charts/temp/TempChart';
import { SolarPanel } from '../components/charts/solar/SolarPanel';
import { HeatFlowPanel } from '../components/charts/heatflow';
import { KpiColumn } from '../components/kpis/KpiColumn';
import {
  AssumptionsPanel,
  LimitationsList,
  ExportPanel,
  OfflineBanner,
  LocaleSwitch,
} from '../components/meta';

const TABS: TabId[] = ['temp', 'solar', 'heatflow', 'grid'];

function Placeholder({ label, testId }: { label: string; testId: string }) {
  return (
    <div className="placeholder" data-testid={testId}>
      {label}
    </div>
  );
}

function PresetReadout({ result, presetId }: { result: SimulationResult; presetId: string }) {
  return (
    <div className="preset-readout" data-testid="slot-preset-readout">
      <div>Preset: {presetId}</div>
      <div>Indoor min: {formatTempC(result.kpis.minIndoorTemp)}</div>
      <div>06:00 temp: {formatTempC(result.kpis.tempAt0600)}</div>
      <div>Aux energy: {formatEnergy(result.kpis.auxEnergyKWhPerDay)}/day</div>
      <div>Energy balance: {formatPercent(result.meta.energyBalanceResidual)}</div>
    </div>
  );
}

export interface AppShellProps {
  initialRequest: SimulationRequest;
  initialResult: SimulationResult;
  initialPresetId: string;
}

export function AppShell({ initialRequest, initialResult, initialPresetId }: AppShellProps) {
  // Lazy initializer runs exactly once per mount, identically during SSR and
  // client hydration (same props both times), before `useStore()` below
  // ever reads the store.
  useState(() => {
    hydrateStore({ request: initialRequest, result: initialResult, presetId: initialPresetId });
    return null;
  });

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
    <div className="app-shell">
      {/* T-52: global, shell-wide concerns -- not scoped to any one column */}
      <OfflineBanner />
      <LocaleSwitch />

      <aside className="col" aria-label="inputs">
        {/* T-44: the five-control simple form (value-add per T-71; T-44 itself stays [!]) */}
        <SimpleForm />
        {/* T-45: the Advanced panel -- owns its own collapsed-by-default <details> disclosure */}
        <AdvancedPanel />
      </aside>

      <main className="col" aria-label="house and views">
        {/* T-46: the isometric house, click-a-wall, scrub-the-day.
            T-75: T-53's DayNightAnimation stacked behind it -- same order
            matters: DayNightAnimation first (painted behind, pointer-events
            none), HouseView second (painted on top, clickable). */}
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
          {appState.activeTab === 'grid' && (
            <Placeholder label="Survival grid (T-50)" testId="slot-tab-grid" />
          )}
        </div>
      </main>

      <aside className="col" aria-label="kpis">
        {/* Acceptance test 8: must not crash when result is null. Acceptance
         * test 9: the first screen shows a real preset result, not an empty
         * form -- these numbers come from the store's preset-loaded state. */}
        {appState.result ? (
          <PresetReadout result={appState.result} presetId={appState.presetId} />
        ) : (
          <Placeholder label="No result yet" testId="slot-preset-readout-empty" />
        )}
        {/* T-51: KPI cards, the integrity badge and the safety warning */}
        <KpiColumn />
        {/* T-52: assumptions panel, exports, offline banner, bilingual labels */}
        <AssumptionsPanel />
        <LimitationsList />
        <ExportPanel />
      </aside>
    </div>
  );
}
