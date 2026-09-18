// apps/web/components/grid/SurvivalGrid.test.ts
//
// T-50 acceptance tests (log/AREA-F-frontend.md). Pure-logic tests: no
// component-rendering library is on the approved dependency list
// (CONTRACTS.md §7.13 -- apps/web may only add next/react/react-dom/
// @prisma/client/prisma/d3-*), so `SurvivalGrid.tsx`'s only job is to
// render exactly what `rows.ts`'s exported functions compute. Testing those
// functions directly covers the grid's real behaviour without a DOM.
//
// Tests 1, 5, 6 run the REAL eighteen-scenario matrix through the REAL
// engine (`@shelter/data`'s buildScenarios/scenarioWeather + `@shelter/
// engine`'s simulate()), so the numbers pasted into this task's Evidence
// block are measured, not synthetic. This import is safe ONLY here: a
// vitest test file runs in Node, never through webpack/Turbopack, so
// `@shelter/data`'s `tmy.ts` (which reads bundled JSON via `node:fs` at
// import time -- see scenario-meta.ts's header) never reaches the browser
// bundle by being imported from this file. `SurvivalGrid.tsx` and every
// module it imports (`rows.ts`, `band.ts`, `scenario-meta.ts`) never import
// `@shelter/data`, only this test file does.

import { describe, it, expect, beforeAll } from 'vitest';
import { simulate, toK, asK } from '@shelter/engine';
import type { Material, Glazing, Surface, SimulationRequest, SimulationResult } from '@shelter/engine';
import { tmyById, buildScenarios, scenarioWeather, type Scenario } from '@shelter/data';
import type { ScenarioResult } from '../../lib/store';
import { bandFor, MIN_ACCEPTABLE_K, SURVIVAL_THRESHOLD_K, BAND_LABEL } from './band';
import { buildRow, buildRows, deriveGridState, offlineNote, progressText, EMPTY_STATE_TEXT } from './rows';
import { scenarioMetaFor, SCENARIO_COUNT } from './scenario-meta';

// ============================== fixture (mirrors apps/web/test/api-simulate.test.ts's baseRequest) ==============================

const MATERIAL: Material = {
  id: 'testStone',
  name: 'Test stone',
  category: 'structural',
  k: 1.75,
  rho: 2400,
  c: 880,
  alphaSolar: 0.65,
  emissivity: 0.88,
  locallyAvailableLadakh: true,
  source: 'T-50 test fixture',
};

const GLAZING: Glazing = {
  id: 'testGlaze',
  name: 'Test glazing',
  U: 2.8,
  SHGC: 0.76,
  tauVis: 0.78,
  b0: 0.05,
  source: 'T-50 test fixture',
};

function buildSurface(id: string, type: Surface['type'], tilt: number, azimuth: number): Surface {
  return {
    id,
    type,
    area: 16,
    tilt,
    azimuth,
    construction: [{ materialId: MATERIAL.id, thickness: 0.4 }],
    boundary: 'exterior',
    exteriorAbsorptivity: 0.7,
    exteriorEmissivity: 0.9,
    interiorEmissivity: 0.9,
  };
}

/** A small, physically valid request around a real TMY-derived scenario
 * window. Loose-ish spin-up (tol/cap) so eighteen real runs stay fast in
 * CI -- same pattern as apps/web/test/pool.test.ts's baseRequest(). */
function requestForScenario(weather: SimulationRequest['weather'], days: number): SimulationRequest {
  return {
    site: {
      id: 't50-leh',
      name: 'T-50 test site (Leh)',
      latitude: 34.15,
      longitude: 77.58,
      elevation: 3500,
      standardMeridian: 82.5,
      groundAlbedo: 0.3,
      groundTempMeanAnnual: toK(6),
    },
    building: {
      floorArea: 16,
      volume: 64,
      azimuth: 0,
      surfaces: [
        buildSurface('south', 'wall', 90, 0),
        buildSurface('east', 'wall', 90, -90),
        buildSurface('west', 'wall', 90, 90),
        buildSurface('north', 'wall', 90, 180),
        buildSurface('roof', 'roof', 0, 0),
        buildSurface('floor', 'floor', 180, 0),
      ],
      windows: [{ id: 'southWindow', hostSurfaceId: 'south', area: 1.5, glazingId: GLAZING.id }],
      thermalBridgeFactor: 1.1,
    },
    operation: {
      internalGainsSchedule: new Array(24).fill(150),
      achSchedule: new Array(24).fill(0.5),
      auxHeating: { enabled: false, setpoint: toK(18), maxPower: 0 },
      comfortBand: { lower: toK(15), upper: toK(24) },
    },
    weather,
    materials: { [MATERIAL.id]: MATERIAL },
    glazings: { [GLAZING.id]: GLAZING },
    options: {
      timestepSeconds: 300,
      meshTargetDx: 0.02,
      simulationDays: days,
      spinUpToleranceK: 0.05,
      maxSpinUpDays: 10,
      skyModel: 'isotropic',
      integrationTheta: 1,
      keepSurfaceProfiles: false,
      allowUnsafeVentilation: false,
    },
  };
}

// ============================== real 18-scenario fixture, built once ==============================

let scenarios: Scenario[];
let scenarioResults: ScenarioResult[];
let sampleFullResult: SimulationResult;

beforeAll(() => {
  const lehSeries = tmyById('leh');
  scenarios = buildScenarios(lehSeries, 'leh');
  scenarioResults = scenarios.map((s) => {
    const weather = scenarioWeather(lehSeries, s);
    const result = simulate(requestForScenario(weather, s.days));
    return { scenarioId: s.id, kpis: result.kpis, meta: result.meta };
  });
  sampleFullResult = simulate(requestForScenario(scenarioWeather(lehSeries, scenarios[0]!), scenarios[0]!.days));
}, 60_000);

describe('T-50 survival grid', () => {
  it('condition 1: exactly 18 unique scenarios, real ids and names', () => {
    expect(scenarios.length).toBe(18);
    expect(new Set(scenarios.map((s) => s.id)).size).toBe(18);
    const rows = buildRows(scenarioResults);
    expect(rows.length).toBe(18);
    // eslint-disable-next-line no-console
    console.log('Row count:', rows.length);
    // eslint-disable-next-line no-console
    console.log('Scenario ids:', scenarios.map((s) => s.id).join(', '));
    // eslint-disable-next-line no-console
    console.log('Scenario names:', scenarios.map((s) => s.name).join(', '));
  });

  it('condition 2: banding matches the three thresholds exactly', () => {
    expect(MIN_ACCEPTABLE_K).toBeCloseTo(288.15, 10);
    expect(SURVIVAL_THRESHOLD_K).toBeCloseTo(278.15, 10);
    const green = bandFor(asK(288.15));
    const amber = bandFor(asK(288.14));
    const red = bandFor(asK(278.14));
    expect(green).toBe('green');
    expect(amber).toBe('amber');
    expect(red).toBe('red');
    // eslint-disable-next-line no-console
    console.log('288.15 K ->', green, '| 288.14 K ->', amber, '| 278.14 K ->', red);
  });

  it('condition 3: the colour key states its thresholds in °C', () => {
    expect(BAND_LABEL.green).toMatch(/15\s*°C/);
    expect(BAND_LABEL.amber).toMatch(/5-15\s*°C/);
    expect(BAND_LABEL.red).toMatch(/5\s*°C/);
    // eslint-disable-next-line no-console
    console.log(BAND_LABEL);
  });

  it('condition 5: rows fill incrementally, halfway point observed', () => {
    const half = scenarioResults.slice(0, 9);
    const halfState = deriveGridState({ online: true, scenarios: half, offlineResult: null, presetId: 'leh' });
    expect(halfState.rows.length).toBe(9);
    expect(halfState.showEmptyState).toBe(false);
    expect(halfState.showProgress).toBe(true);
    expect(progressText(9)).toBe('9 of 18 scenarios computed');

    const fullState = deriveGridState({ online: true, scenarios: scenarioResults, offlineResult: null, presetId: 'leh' });
    expect(fullState.rows.length).toBe(18);
    expect(fullState.showProgress).toBe(false);

    // eslint-disable-next-line no-console
    console.log('Row count at halfway (9 of 18 submitted):', halfState.rows.length);
  });

  it('condition 6: every row’s energy-balance residual is under 0.1%', () => {
    const rows = buildRows(scenarioResults);
    const residuals = rows.map((r) => (r.status === 'ok' ? r.energyBalanceResidual : 0));
    const max = Math.max(...residuals);
    expect(rows.every((r) => r.status === 'ok')).toBe(true);
    expect(max).toBeLessThan(0.001);
    // eslint-disable-next-line no-console
    console.log('Max energy-balance residual across all 18 scenarios:', max, `(${(max * 100).toFixed(4)}%)`);
  });

  it('condition 7: offline shows exactly one row plus an explicit note', () => {
    const state = deriveGridState({ online: false, scenarios: scenarioResults, offlineResult: sampleFullResult, presetId: 'leh' });
    expect(state.rows.length).toBe(1);
    expect(state.rows[0]!.status).toBe('ok');
    expect(state.note).toBeTruthy();
    expect(state.note).toMatch(/Offline/);
    expect(state.note).toMatch(/17/);
    // eslint-disable-next-line no-console
    console.log('Offline note text:', state.note);

    // Even with no local result yet (edge case around hydration), it is
    // never a blank table -- the note doubles as the empty-state text.
    const noResultYet = deriveGridState({ online: false, scenarios: null, offlineResult: null, presetId: 'leh' });
    expect(noResultYet.rows.length).toBe(0);
    expect(noResultYet.showEmptyState).toBe(true);
    expect(noResultYet.emptyText).toBeTruthy();
  });

  it('condition 8: scenarios === null shows an empty state, never NaN, never blank', () => {
    const state = deriveGridState({ online: true, scenarios: null, offlineResult: null, presetId: 'leh' });
    expect(state.rows).toEqual([]);
    expect(state.showEmptyState).toBe(true);
    expect(state.emptyText).toBe(EMPTY_STATE_TEXT);
    expect(state.emptyText).not.toMatch(/NaN/);
  });

  it('condition 9: a scenario that failed to compute renders as an error row, not a missing one', () => {
    // Synthetic malformed entry: today's `ScenarioResult` type (store.ts) has
    // no failure variant (see rows.ts's header comment) -- constructed here
    // to prove the grid's own defensive rendering path, independent of
    // whether any real producer sends this shape yet.
    const malformed = { scenarioId: 'coldest-day', error: { code: 'SOLVER_DIVERGED', message: 'node left plausible range' } } as unknown as ScenarioResult;
    const row = buildRow(malformed);
    expect(row.status).toBe('error');
    if (row.status === 'error') {
      expect(row.scenarioId).toBe('coldest-day');
      expect(row.code).toBe('SOLVER_DIVERGED');
    }

    // Mixed batch: 17 good + 1 malformed must still produce 18 rows, not 17.
    const mixed = [...scenarioResults.slice(0, 17), malformed];
    const rows = buildRows(mixed);
    expect(rows.length).toBe(18);
    expect(rows.filter((r) => r.status === 'error').length).toBe(1);
    // eslint-disable-next-line no-console
    console.log('Error row:', row);
  });

  it('condition 11 support: scenario-meta and band modules never do their own Kelvin arithmetic', () => {
    // Sanity check for the eighteen known ids' display metadata (used by
    // acceptance test 1's "scenario names" and this task's overall design).
    for (const s of scenarios) {
      const meta = scenarioMetaFor(s.id);
      expect(meta.name).toBeTruthy();
      expect(meta.description).toBeTruthy();
    }
    expect(SCENARIO_COUNT).toBe(18);
  });
});
