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
// centre, KPI cards right. Every slot below is pre-wired with a labelled
// placeholder so each Area F task (T-44..T-53) only ever edits its own
// directory under `components/` -- none of them need to touch this file or
// `store.ts` just to make their slot exist, only to fill it in.
//
// No visual component beyond placeholders is built here (T-36's prompt): no
// charts, no house, no inputs. The KPI readout below reads real numbers out
// of the preset-loaded `result` -- that is the "first screen shows a preset
// result" requirement (acceptance test 9), not a real KPI card component
// (T-51 owns that).

import { useState } from 'react';
import type { SimulationRequest, SimulationResult } from '@shelter/engine';
import { actions, hydrateStore, useStore, type TabId } from '../lib/store';
import { formatEnergy, formatPercent, formatTempC } from '../lib/units';
import { t } from '../lib/i18n';

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

  function toggleAdvanced() {
    actions.setAdvancedOpen(!appState.advancedOpen);
  }

  return (
    <div className="app-shell">
      <aside className="col" aria-label="inputs">
        {/* T-44: the five-control simple form */}
        <Placeholder label="Simple form (T-44)" testId="slot-simple-form" />
        <button type="button" onClick={toggleAdvanced}>
          {appState.advancedOpen ? 'Hide advanced' : 'Show advanced'}
        </button>
        {/* T-45: the Advanced panel */}
        {appState.advancedOpen && <Placeholder label="Advanced panel (T-45)" testId="slot-advanced-panel" />}
      </aside>

      <main className="col" aria-label="house and views">
        {/* T-46: the isometric house, click-a-wall, scrub-the-day */}
        <Placeholder label="Isometric house (T-46)" testId="slot-house" />

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
          {appState.activeTab === 'temp' && <Placeholder label="Temperature view (T-47)" testId="slot-tab-temp" />}
          {appState.activeTab === 'solar' && <Placeholder label="Solar capture view (T-48)" testId="slot-tab-solar" />}
          {appState.activeTab === 'heatflow' && (
            <Placeholder label="Heat-flow view + Sankey (T-49)" testId="slot-tab-heatflow" />
          )}
          {appState.activeTab === 'grid' && <Placeholder label="Survival grid (T-50)" testId="slot-tab-grid" />}
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
        <Placeholder label="KPI cards + integrity badge (T-51)" testId="slot-kpi-cards" />
        {/* T-52: assumptions panel, exports, offline banner, bilingual labels */}
        <Placeholder label="Assumptions panel + exports (T-52)" testId="slot-assumptions" />
      </aside>
    </div>
  );
}
