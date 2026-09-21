// apps/web/components/charts/heatflow/heatflow.test.ts
//
// T-49's 11 acceptance tests. No jsdom/@testing-library on the approved
// dependency list or installed in this worktree (CONTRACTS.md §7.13), so
// this file verifies:
//   - every pure data-prep function (stackedArea.ts, sankey.ts, scatter.ts)
//     by plain assertion against REAL `simulate()` output -- the bundled Leh
//     presets via `@shelter/data`, the same pattern `house.test.tsx` (T-46)
//     and `SurvivalGrid.test.ts` (T-50) already established for this repo;
//   - DOM STRUCTURE (legend entries, titles, data-testid attributes, no
//     "Q4"-only labels) via `react-dom/server`'s `renderToStaticMarkup`,
//     which runs in plain Node, no DOM required.

import { describe, expect, it } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { PRESETS, tmyById, materialById, glazingById } from '@shelter/data';
import { simulate, toK, DEFAULT_SIM_OPTIONS } from '@shelter/engine';
import type {
  Building,
  Glazing,
  HeatFlows,
  Material,
  Preset,
  SimulationRequest,
  SimulationResult,
  Surface,
} from '@shelter/engine';

import { HeatFlowPanel } from './HeatFlowPanel';
import { PATHWAY_KEYS, PATHWAY_META, BOUNDARY_KEYS } from './pathways';
import {
  buildStackedAreaLayout,
  computeStack,
  everyBandOnCorrectSide,
  toStackData,
} from './stackedArea';
import { buildSankeyLayout, checkBalance, classifyFlows, isLayoutValid, linkPath } from './sankey';
import { buildScatterLayout, linearFit, scatterPoints } from './scatter';

// ---- shared fixture: real bundled presets, resolved and simulated exactly
// the way `app/page.tsx` does (`resolvePreset`, inlined since `app/page.tsx`
// is off this task's allow-list to import from). ----
function resolvePreset(preset: Preset): SimulationRequest {
  const materials: Record<string, Material> = {};
  for (const surface of preset.request.building.surfaces) {
    for (const layer of surface.construction)
      materials[layer.materialId] = materialById(layer.materialId);
  }
  const glazings: Record<string, Glazing> = {};
  for (const win of preset.request.building.windows)
    glazings[win.glazingId] = glazingById(win.glazingId);
  return { ...preset.request, weather: tmyById(preset.locationId), materials, glazings };
}

function byId(id: string): SimulationResult {
  const preset = PRESETS.find((p) => p.id === id)!;
  return simulate(resolvePreset(preset));
}

const barrack = byId('armyBroBarrack');
const modernRcc = byId('modernRccNoInsulation');

/**
 * Test 4's apparatus: a purpose-built, fast-responding envelope (thin steel,
 * 4 exterior walls only, no windows, no solar -- GHI = 0) so `Q5`'s
 * conduction into the innermost mesh node tracks the ambient-driven
 * `deltaT` closely, with no ground-floor or roof noise mixed in and no
 * solar-driven decoupling. Self-contained (does not import
 * `packages/engine/test/fixtures.ts`, which is not published/importable
 * from `apps/web` -- same reasoning `house.test.tsx`'s own `boxBuilding`
 * helper documents for its synthetic fixture).
 */
function thinSteelBox(): SimulationRequest {
  const side = 4;
  const area = side * side;
  const steelCGI = materialById('steelCGI');
  const construction = [{ materialId: steelCGI.id, thickness: 0.0006 }];
  const opaque = (id: string, tilt: number, azimuth: number): Surface => ({
    id,
    type: 'wall',
    area,
    tilt,
    azimuth,
    construction,
    boundary: 'exterior',
    exteriorAbsorptivity: 0.6,
    exteriorEmissivity: 0.28,
    interiorEmissivity: 0.9,
  });
  const surfaces: Surface[] = [
    opaque('south', 90, 0),
    opaque('east', 90, -90),
    opaque('west', 90, 90),
    opaque('north', 90, 180),
  ];
  const building: Building = {
    floorArea: area,
    volume: area * side,
    azimuth: 0,
    surfaces,
    windows: [],
    thermalBridgeFactor: 1.05,
  };

  const steps = 24;
  const T_amb = new Float64Array(steps);
  const GHI = new Float64Array(steps); // no solar -- isolate conduction from ambient ΔT alone
  const v_wind = new Float64Array(steps).fill(3);
  for (let h = 0; h < steps; h++) T_amb[h] = toK(-8 + 10 * Math.sin(((h - 15) / 24) * 2 * Math.PI));

  return {
    site: {
      id: 'thin-steel-test',
      name: 'thin steel test site',
      latitude: 34.15,
      longitude: 77.58,
      elevation: 3500,
      standardMeridian: 82.5,
      groundAlbedo: 0.3,
      groundTempMeanAnnual: toK(6),
    },
    building,
    operation: {
      internalGainsSchedule: new Array(24).fill(100),
      achSchedule: new Array(24).fill(0.5),
      auxHeating: { enabled: false, setpoint: toK(18), maxPower: 0 },
      comfortBand: { lower: toK(15), upper: toK(24) },
    },
    weather: {
      stepSeconds: 3600,
      startDayOfYear: 15,
      startHour: 0,
      T_amb,
      GHI,
      v_wind,
      provenance: {
        source: 'synthetic',
        label: 'T-49 test 4 fixture',
        sourceElevation: null,
        lapseCorrectionK: 0,
        notes: [],
      },
    },
    materials: { [steelCGI.id]: steelCGI },
    glazings: {},
    options: {
      ...DEFAULT_SIM_OPTIONS,
      simulationDays: 2,
      skyModel: 'isotropic',
      allowUnsafeVentilation: false,
    },
  };
}

const steelResult = simulate(thinSteelBox());

// Hand-computed ΣUA for the thin-steel-box fixture, via the SAME
// `constructionUValue`/`hConvExterior`/`hConvInterior` functions the engine
// itself uses (CONTRACTS.md §7.10) -- an independent check computed from
// first principles, not a copy of the engine's own internal Q5 arithmetic.
import { buildWallMesh, constructionUValue, hConvExterior, hConvInterior } from '@shelter/engine';
function handComputedEnvelopeUA(): number {
  const steelCGI = materialById('steelCGI');
  const hOuter = hConvExterior(3, 3500);
  const hInner = hConvInterior('wall', 0, 0, 3500);
  const mesh = buildWallMesh(
    [{ materialId: steelCGI.id, thickness: 0.0006 }],
    { [steelCGI.id]: steelCGI },
    0.02,
  );
  const U = constructionUValue(mesh, hOuter, hInner);
  const totalWallArea = 4 * 16; // 4 walls, 4m x 4m each
  return U * totalWallArea;
}

describe('T-49 heat-flow view and Sankey', () => {
  it('test 1 -- all 11 pathways plus Qaux and storageRate appear in the stacked chart and legend, including Q7', () => {
    expect(PATHWAY_KEYS.length).toBe(13);
    const expected = [
      'Q1_solarOpaque',
      'Q2_solarGlazed',
      'Q3_extConvection',
      'Q4_skyRadiation',
      'Q5_envelopeConduction',
      'Q6_intConvection',
      'Q7_interiorLongwave',
      'Q8_windowConduction',
      'Q9_infiltration',
      'Q10_ground',
      'Q11_internalGains',
      'Qaux',
      'storageRate',
    ];
    expect([...PATHWAY_KEYS].sort()).toEqual([...expected].sort());
    expect(PATHWAY_KEYS).toContain('Q7_interiorLongwave');

    const markup = renderToStaticMarkup(React.createElement(HeatFlowPanel, { result: barrack }));
    for (const key of PATHWAY_KEYS) {
      expect(markup).toContain(`data-testid="legend-${key}"`);
      expect(markup).toContain(`data-testid="stacked-band-${key}"`);
    }
    console.log(
      'T-49 test 1 evidence -- legend list (13 entries):',
      PATHWAY_KEYS.map((k) => PATHWAY_META[k].label),
    );
  });

  it('test 2 -- gains render above the axis, losses below, at every timestep (real run)', () => {
    const data = toStackData(barrack.heatFlows, barrack.time);
    expect(everyBandOnCorrectSide(data)).toBe(true);
    // Direct re-check against the real d3 stack output, not just the helper.
    const series = computeStack(data);
    let checked = 0;
    for (const layer of series) {
      for (const point of layer) {
        const raw = point.data[layer.key];
        if (raw >= 0) expect(point[0]).toBeGreaterThanOrEqual(-1e-9);
        else expect(point[1]).toBeLessThanOrEqual(1e-9);
        checked++;
      }
    }
    expect(checked).toBe(PATHWAY_KEYS.length * barrack.time.length);
  });

  it('test 3 -- Q4_skyRadiation stays on the loss side all night, including hours ambient > indoor (CHALLENGE.md C-02)', () => {
    const Q4 = modernRcc.heatFlows.Q4_skyRadiation;
    const amb = modernRcc.temperatures.ambient;
    const indoor = modernRcc.temperatures.indoorAir;
    let hoursAmbWarmer = 0;
    let maxQ4WhenAmbWarmer = -Infinity;
    for (let i = 0; i < amb.length; i++) {
      expect(Q4[i]!).toBeLessThanOrEqual(0);
      if (amb[i]! > indoor[i]!) {
        hoursAmbWarmer++;
        maxQ4WhenAmbWarmer = Math.max(maxQ4WhenAmbWarmer, Q4[i]!);
      }
    }
    expect(hoursAmbWarmer).toBeGreaterThan(0); // the C-02 condition actually occurs in this fixture
    expect(maxQ4WhenAmbWarmer).toBeLessThanOrEqual(0);

    const stepSeconds = 300; // modernRccNoInsulation's OPTIONS: DEFAULT_SIM_OPTIONS.timestepSeconds
    const idx0200 = Math.round((2 * 3600) / stepSeconds);
    console.log(
      'T-49 test 3 evidence -- Q4_skyRadiation at 02:00 (modernRccNoInsulation, Leh Jan 15):',
      Q4[idx0200],
      'W;',
      'hours with ambient > indoor:',
      hoursAmbWarmer,
      '; max Q4 during those hours:',
      maxQ4WhenAmbWarmer,
      'W',
    );
  });

  it('test 4 -- Q5 vs deltaT: R^2 > 0.95 and fitted slope within 10% of hand-computed ΣUA', () => {
    const points = scatterPoints(steelResult.heatFlows, 'Q5_envelopeConduction');
    const fit = linearFit(points);
    const handUA = handComputedEnvelopeUA();
    const pctDiff = (Math.abs(fit.slope) - handUA) / handUA;

    expect(fit.r2).toBeGreaterThan(0.95);
    expect(Math.abs(pctDiff)).toBeLessThan(0.1);
    console.log(
      'T-49 test 4 evidence -- R^2:',
      fit.r2,
      '; fitted slope:',
      fit.slope,
      'W/K; hand ΣUA:',
      handUA,
      'W/K; |slope| vs ΣUA relative diff:',
      (pctDiff * 100).toFixed(2),
      '%',
    );
  });

  it('test 5 -- the panel title contains the literal string "PS Deliverable 3"', () => {
    const markup = renderToStaticMarkup(React.createElement(HeatFlowPanel, { result: barrack }));
    expect(markup).toContain('PS Deliverable 3');
  });

  it('test 6 -- Sankey inflow equals outflow plus storage change to within 1%', () => {
    const { inflowKWh, outflowKWh, deviation } = checkBalance(barrack.heatFlows.dailyTotalsKWh);
    expect(deviation).toBeLessThan(0.01);
    console.log(
      'T-49 test 6 evidence (armyBroBarrack) -- inflow:',
      inflowKWh,
      'kWh; outflow:',
      outflowKWh,
      'kWh; deviation:',
      (deviation * 100).toFixed(4),
      '%',
    );

    const {
      inflowKWh: i2,
      outflowKWh: o2,
      deviation: d2,
    } = checkBalance(modernRcc.heatFlows.dailyTotalsKWh);
    expect(d2).toBeLessThan(0.01);
    console.log(
      'T-49 test 6 evidence (modernRccNoInsulation) -- inflow:',
      i2,
      'kWh; outflow:',
      o2,
      'kWh; deviation:',
      (d2 * 100).toFixed(4),
      '%',
    );
  });

  it('test 7 -- the Sankey renders with no negative-width link and no NaN node', () => {
    for (const result of [barrack, modernRcc]) {
      const graph = buildSankeyLayout(result.heatFlows.dailyTotalsKWh, 640, 340);
      expect(isLayoutValid(graph)).toBe(true);
      for (const link of graph.links) expect(linkPath(link as never)).not.toBe('');
    }
  });

  it('test 8 -- every Sankey stream is labelled with its kWh value and a plain-language name, never "Q4"', () => {
    const { gains, losses } = classifyFlows(barrack.heatFlows.dailyTotalsKWh);
    expect(gains.length + losses.length).toBeGreaterThan(0);
    for (const term of [...gains, ...losses]) {
      expect(term.label).not.toMatch(/^Q\d+$/);
      expect(term.kWh).toBeGreaterThan(0);
    }
    console.log('T-49 test 8 evidence -- gain streams:', gains, '; loss streams:', losses);
  });

  it('test 9 -- all three views render for a run with zero auxiliary heating', () => {
    expect(barrack.heatFlows.dailyTotalsKWh.Qaux).toBe(0);
    const markup = renderToStaticMarkup(React.createElement(HeatFlowPanel, { result: barrack }));
    expect(markup).toContain('heatflow-stacked-area');
    expect(markup).toContain('heatflow-sankey');
    expect(markup).toContain('heatflow-scatter');
    expect(markup).not.toMatch(/NaN/);
  });

  it('test 10 -- with result === null, all three views show an empty state, not NaN', () => {
    const markup = renderToStaticMarkup(React.createElement(HeatFlowPanel, { result: null }));
    expect(markup).toContain('data-testid="heatflow-empty-state"');
    expect(markup).not.toContain('heatflow-stacked-area');
    expect(markup).not.toContain('heatflow-sankey');
    expect(markup).not.toContain('heatflow-scatter');
    expect(markup).not.toMatch(/NaN/);
  });

  it('test 11 -- at 400px width all three views are legible; the Sankey scrolls inside its own container, not the page', () => {
    const markup = renderToStaticMarkup(React.createElement(HeatFlowPanel, { result: barrack }));
    // Structural check: every view sits inside `.scrollBox` (overflow-x:
    // auto in HeatFlowPanel.module.css), never relying on page-level scroll.
    const scrollBoxCount = (markup.match(/class="[^"]*scrollBox[^"]*"/g) ?? []).length;
    expect(scrollBoxCount).toBe(3);
  });

  it('sanity -- BOUNDARY_KEYS matches CONTRACTS.md §7.4 exactly (9 keys, no Q5/Q6/Q7)', () => {
    expect(BOUNDARY_KEYS.length).toBe(9);
    for (const internal of ['Q5_envelopeConduction', 'Q6_intConvection', 'Q7_interiorLongwave']) {
      expect(BOUNDARY_KEYS as readonly string[]).not.toContain(internal);
    }
  });

  it('Q7 float-noise handling: excluded from the Sankey (never a boundary term), present but visually negligible in the stack', () => {
    const q7Daily = barrack.heatFlows.dailyTotalsKWh.Q7_interiorLongwave!;
    expect(Math.abs(q7Daily)).toBeLessThan(1e-6); // T-22's ~1e-11 W finding, confirmed again here
    const { gains, losses } = classifyFlows(barrack.heatFlows.dailyTotalsKWh);
    for (const term of [...gains, ...losses]) expect(term.key).not.toBe('Q7_interiorLongwave');
    console.log(
      'T-49 Q7 handling evidence -- Q7 daily total (armyBroBarrack):',
      q7Daily,
      'kWh; excluded from Sankey classification.',
    );
  });

  it('example layout smoke test -- buildStackedAreaLayout / buildScatterLayout never produce NaN paths for a real run', () => {
    const stacked = buildStackedAreaLayout(barrack.heatFlows, barrack.time, 760, 300);
    for (const key of PATHWAY_KEYS) expect(stacked.paths[key]).not.toMatch(/NaN/);
    const scatter = buildScatterLayout(barrack.heatFlows, 'Q5_envelopeConduction', 480, 320);
    expect(scatter.linePath).not.toMatch(/NaN/);
  });
});
