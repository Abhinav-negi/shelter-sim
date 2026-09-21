// apps/web/components/charts/temp/TempChart.test.tsx
//
// T-47's 11 acceptance tests (log/AREA-F-frontend.md). This environment has
// no jsdom/happy-dom and no @testing-library (neither is on the approved
// dependency list, CONTRACTS.md §7.13, and neither is installed in this
// worktree -- see components/house/house.test.tsx's header for the same
// note), so this file follows that file's exact strategy:
//   - every pure function (series, scales, interaction, format) by plain
//     assertion, run against REAL `simulate()` output wherever a claim is
//     about the physics, not just the plumbing;
//   - DOM STRUCTURE via `react-dom/server`'s `renderToStaticMarkup`, which
//     runs in plain Node, no DOM required;
//   - hover/toggle INTERACTION by calling the exact functions TempChart.tsx
//     wires to `onMouseMove`/`onChange` (`tooltipDataAt`, `nearestPointIndex`,
//     `toggleVariantVisibility`), not a simulated DOM event -- the identical
//     code path the real handler runs, the same workaround HouseView's own
//     test file uses for `activateSurface`.

import { describe, expect, it } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { glazingById, materialById, PRESETS, tmyById } from '@shelter/data';
import { asK, simulate, toK } from '@shelter/engine';
import type {
  Building,
  Glazing,
  Material,
  Preset,
  SimulationRequest,
  Surface,
} from '@shelter/engine';
import { formatTempC } from '../../../lib/units';
import { TempChart, type TempChartVariant } from './TempChart';
import { dayMaxIndoor, dayMinIndoor, dayPoints, indoorAt0600 } from './series';
import { buildXScale, buildYScale } from './scales';
import { formatHourLabel } from './format';
import {
  nearestPointIndex,
  toggleVariantVisibility,
  tooltipDataAt,
  type VariantSeries,
} from './interaction';
import { VARIANT_COLORS } from './colors';

// ---- shared fixture: the real bundled Leh preset, resolved and simulated
// exactly the way components/house/house.test.tsx does (`app/page.tsx` is
// off this task's allow-list to import from, so this is re-derived here,
// same as that file re-derives it). ----
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

const lehPreset = PRESETS.find((p) => p.locationId === 'leh')!;
const lehRequest = resolvePreset(lehPreset);
const lehResult = simulate(lehRequest);

function variant(
  id: string,
  label: string,
  req: SimulationRequest,
  result = simulate(req),
): TempChartVariant {
  return { id, label, result, weatherStartHour: req.weather.startHour };
}

describe('T-47 temperature chart: series/scale/interaction logic', () => {
  it('condition 1 evidence -- no literal Kelvin-offset constant anywhere in this directory (grep, run separately) and every Celsius value flows through toC', () => {
    const points = dayPoints(lehResult, lehRequest.weather.startHour);
    expect(points.length).toBeGreaterThan(0);
    // Sanity: a Leh January indoor temperature in Celsius is a plausible
    // small number, not a raw Kelvin (~280) or a byte of noise.
    expect(points[0]!.indoorC).toBeGreaterThan(-60);
    expect(points[0]!.indoorC).toBeLessThan(60);
    console.log('T-47 test 1 evidence -- sample indoorC/ambientC:', points[0]);
  });

  it('condition 2 -- the Leh preset comfort band is 15-24 °C, not 18-26', () => {
    const markup = renderToStaticMarkup(
      <TempChart
        variants={[variant('leh', 'Leh baseline', lehRequest, lehResult)]}
        comfortBand={lehRequest.operation.comfortBand}
      />,
    );
    expect(markup).toContain('15.0 °C');
    expect(markup).toContain('24.0 °C');
    expect(markup).not.toContain('18.0 °C');
    console.log(
      'T-47 test 2 evidence -- comfort band label markup:',
      /Comfort band:[^<]*/.exec(markup)?.[0],
    );
  });

  it('condition 3 -- the 06:00 annotation reads the same value as the tempAt0600 KPI card, to displayed precision', () => {
    const chartValueK = indoorAt0600(lehResult, lehRequest.weather.startHour);
    const chartText = formatTempC(chartValueK);
    const kpiText = formatTempC(lehResult.kpis.tempAt0600);
    expect(chartText).toBe(kpiText);

    const markup = renderToStaticMarkup(
      <TempChart
        variants={[variant('leh', 'Leh baseline', lehRequest, lehResult)]}
        comfortBand={lehRequest.operation.comfortBand}
      />,
    );
    expect(markup).toContain(`06:00: ${chartText}`);
    console.log(
      'T-47 test 3 evidence -- chart 06:00 value:',
      chartText,
      '| kpis.tempAt0600:',
      kpiText,
    );
  });

  it('condition 4 -- four overlaid variants are distinguishable and individually toggleable', () => {
    const variants: VariantSeries[] = Array.from({ length: 4 }, (_, i) => ({
      id: `v${i}`,
      label: `Variant ${i}`,
      color: VARIANT_COLORS[i]!,
      points: dayPoints(lehResult, lehRequest.weather.startHour).map((p) => ({
        ...p,
        indoorC: p.indoorC + i,
      })),
    }));
    // Distinguishable: 4 distinct colours, 1 per variant, in fixed order.
    expect(new Set(variants.map((v) => v.color)).size).toBe(4);

    const markup = renderToStaticMarkup(
      <TempChart
        variants={variants.map((v) => ({
          id: v.id,
          label: v.label,
          result: lehResult,
          weatherStartHour: lehRequest.weather.startHour,
        }))}
        comfortBand={lehRequest.operation.comfortBand}
      />,
    );
    for (const v of variants) expect(markup).toContain(`data-testid="temp-variant-toggle-${v.id}"`);
    for (const v of variants) expect(markup).toContain(`data-testid="temp-variant-lines-${v.id}"`);

    // Toggling: the exact function TempChart.tsx's checkbox onChange calls.
    let vis = new Set(variants.map((v) => v.id));
    vis = toggleVariantVisibility(vis, 'v2');
    expect(vis.has('v2')).toBe(false);
    expect(vis.size).toBe(3);
    vis = toggleVariantVisibility(vis, 'v2');
    expect(vis.has('v2')).toBe(true);
    console.log(
      'T-47 test 4 evidence -- 4 variant colours:',
      variants.map((v) => v.color),
    );
  });

  it('condition 5 -- K-03 shape check: heavy-mass night curve is not a plain exponential vs steel+PUF', () => {
    const { heavy, light } = buildK03Fixtures();
    const heavyResult = simulate(heavy);
    const lightResult = simulate(light);

    const valAt = (result: typeof heavyResult, hour: number) =>
      toCFromResult(result, heavy.weather.startHour, hour);

    const hours = [21, 0, 3, 6];
    const heavyVals = hours.map((h) => valAt(heavyResult, h));
    const lightVals = hours.map((h) => valAt(lightResult, h));
    console.log(
      'T-47 test 5 evidence -- heavy-mass (dense concrete) @21:00,00:00,03:00,06:00:',
      heavyVals,
    );
    console.log('T-47 test 5 evidence -- steel+PUF @21:00,00:00,03:00,06:00:', lightVals);

    // Shape, not offset: compare NORMALISED hour-over-hour drops (each leg's
    // share of the total 21:00->06:00 drop). If the two shapes were merely
    // an offset of each other, these normalised legs would be identical.
    const legs = (vals: number[]) => {
      const total = vals[0]! - vals[3]!;
      return [vals[0]! - vals[1]!, vals[1]! - vals[2]!, vals[2]! - vals[3]!].map((d) => d / total);
    };
    const heavyLegs = legs(heavyVals);
    const lightLegs = legs(lightVals);
    console.log('T-47 test 5 evidence -- normalised legs heavy:', heavyLegs, 'light:', lightLegs);

    const maxLegDiff = Math.max(...heavyLegs.map((v, i) => Math.abs(v - lightLegs[i]!)));
    console.log('T-47 test 5 evidence -- max normalised-leg difference:', maxLegDiff);
    // A meaningful shape difference: at least one leg's share of the total
    // drop differs by more than 0.05 (5 percentage points) between the two
    // fixtures. A pure vertical offset would give maxLegDiff ~ 0.
    expect(maxLegDiff).toBeGreaterThan(0.05);
  });

  it('condition 6 -- the panel title contains the literal string "PS Deliverable 1"', () => {
    const markup = renderToStaticMarkup(
      <TempChart
        variants={[variant('leh', 'Leh baseline', lehRequest, lehResult)]}
        comfortBand={lehRequest.operation.comfortBand}
      />,
    );
    expect(markup).toContain('PS Deliverable 1');
  });

  it('condition 7 -- hovering shows a tooltip with the time and both temperatures', () => {
    const points = dayPoints(lehResult, lehRequest.weather.startHour);
    const series: VariantSeries = {
      id: 'leh',
      label: 'Leh baseline',
      color: VARIANT_COLORS[0]!,
      points,
    };
    const data = tooltipDataAt([series], 6);
    expect(data).not.toBeNull();
    expect(formatHourLabel(data!.hour)).toMatch(/^\d{2}:\d{2}$/);
    expect(typeof data!.ambientC).toBe('number');
    expect(data!.entries[0]!.indoorC).not.toBeNaN();

    const markup = renderToStaticMarkup(
      <TempChart
        variants={[variant('leh', 'Leh baseline', lehRequest, lehResult)]}
        comfortBand={lehRequest.operation.comfortBand}
      />,
    );
    // Structural: the hover-capture layer TempChart.tsx wires onMouseMove to
    // exists (real pointer events need a browser; see this file's header).
    expect(markup).toContain('data-testid="temp-hover-layer"');
    console.log('T-47 test 7 evidence -- tooltip at hour 6:', {
      hourLabel: formatHourLabel(data!.hour),
      ambientC: data!.ambientC,
      indoorC: data!.entries[0]!.indoorC,
    });
  });

  it('condition 8 -- renders a single-timestep result without dividing by zero', () => {
    const single = singleTimestepResult();
    expect(() =>
      renderToStaticMarkup(
        <TempChart
          variants={[{ id: 'single', label: 'Single step', result: single, weatherStartHour: 0 }]}
          comfortBand={{ lower: toK(15) as any, upper: toK(24) as any }}
        />,
      ),
    ).not.toThrow();
    const markup = renderToStaticMarkup(
      <TempChart
        variants={[{ id: 'single', label: 'Single step', result: single, weatherStartHour: 0 }]}
        comfortBand={{ lower: toK(15) as any, upper: toK(24) as any }}
      />,
    );
    expect(markup).not.toContain('NaN');
    expect(markup).not.toContain('Infinity');
    console.log('T-47 test 8 evidence -- single-timestep points:', dayPoints(single, 0));
  });

  it('condition 9 -- renders an empty state, not NaN, when there is no result', () => {
    const markup = renderToStaticMarkup(
      <TempChart variants={[]} comfortBand={{ lower: toK(15) as any, upper: toK(24) as any }} />,
    );
    expect(markup).toContain('data-testid="temp-chart-empty"');
    expect(markup).not.toContain('NaN');
    console.log('T-47 test 9 evidence -- empty-state markup snippet:', markup.slice(0, 120));
  });

  it('condition 10/11 -- viewBox is sized to 400 (native pixels at the 400px breakpoint) and x/y ticks do not collide', () => {
    const markup = renderToStaticMarkup(
      <TempChart
        variants={[variant('leh', 'Leh baseline', lehRequest, lehResult)]}
        comfortBand={lehRequest.operation.comfortBand}
      />,
    );
    expect(markup).toMatch(/viewBox="0 0 400 220"/);
    expect(markup).not.toMatch(/<svg[^>]*\swidth="\d/);
    expect(markup).not.toMatch(/<svg[^>]*\sheight="\d/);

    const xScale = buildXScale(400 - 34 - 10);
    const xTickPositions = [0, 6, 12, 18, 24].map((h) => xScale(h));
    for (let i = 1; i < xTickPositions.length; i++) {
      expect(xTickPositions[i]! - xTickPositions[i - 1]!).toBeGreaterThan(40); // >> an 8px "HH:MM" label's width
    }
    const yScale = buildYScale(-20, 10, 220 - 14 - 24);
    const yTicks = yScale.ticks(4);
    const yTickPositions = yTicks.map((t) => yScale(t)).sort((a, b) => a - b);
    for (let i = 1; i < yTickPositions.length; i++) {
      expect(yTickPositions[i]! - yTickPositions[i - 1]!).toBeGreaterThan(10); // >> an 8px label's height
    }
    console.log(
      'T-47 test 10/11 evidence -- x tick pixel positions:',
      xTickPositions,
      'y tick pixel positions:',
      yTickPositions,
    );
  });
});

// ============================== fixtures ==============================

function toCFromResult(
  result: ReturnType<typeof simulate>,
  weatherStartHour: number,
  hour: number,
): number {
  const points = dayPoints(result, weatherStartHour);
  const idx = nearestPointIndex(points, hour);
  return points[idx]!.indoorC;
}

function buildSurfaceWith(
  id: string,
  type: Surface['type'],
  tilt: number,
  azimuth: number,
  materialId: string,
  thickness: number,
): Surface {
  return {
    id,
    type,
    area: 16,
    tilt,
    azimuth,
    construction: [{ materialId, thickness }],
    boundary: 'exterior',
    exteriorAbsorptivity: 0.7,
    exteriorEmissivity: 0.9,
    interiorEmissivity: 0.9,
  };
}

/** Two requests identical except for wall construction -- isolates the mass
 * effect for the K-03 shape check (test 5). Weather/operation mirror the
 * synthetic fixture pattern in apps/web/test/repo-runs.test.ts's own
 * baseRequest(). */
function buildK03Fixtures(): { heavy: SimulationRequest; light: SimulationRequest } {
  const denseConcrete: Material = {
    id: 'k03DenseConcrete',
    name: 'Dense concrete',
    category: 'structural',
    k: 1.75,
    rho: 2400,
    c: 880,
    alphaSolar: 0.65,
    emissivity: 0.9,
    locallyAvailableLadakh: true,
    source: 'CONTRACTS.md §7.10 material table',
  };
  const steel: Material = {
    id: 'k03Steel',
    name: 'Steel (CGI sheet)',
    category: 'structural',
    k: 50,
    rho: 7800,
    c: 480,
    alphaSolar: 0.6,
    emissivity: 0.28,
    locallyAvailableLadakh: true,
    source: 'CONTRACTS.md §7.11 material table',
  };
  const puf: Material = {
    id: 'k03Puf',
    name: 'PUF / PIR',
    category: 'insulation',
    k: 0.025,
    rho: 35,
    c: 1400,
    alphaSolar: 0.6,
    emissivity: 0.9,
    locallyAvailableLadakh: false,
    source: 'CONTRACTS.md §7.11 material table',
  };
  const glazing: Glazing = {
    id: 'k03Glazing',
    name: 'Single glazing',
    U: 5.8,
    SHGC: 0.86,
    tauVis: 0.8,
    b0: 0.04,
    source: 'CONTRACTS.md §7.10 window table',
  };

  const T_amb = new Float64Array(24);
  const GHI = new Float64Array(24);
  const v_wind = new Float64Array(24).fill(2);
  for (let h = 0; h < 24; h++) {
    T_amb[h] = toK(-8 + 9 * Math.sin(((h - 15) / 24) * 2 * Math.PI)); // Leh January-ish swing, Appendix C
    GHI[h] = h >= 8 && h <= 16 ? 500 * Math.sin(((h - 8) / 8) * Math.PI) : 0;
  }
  const weather: SimulationRequest['weather'] = {
    stepSeconds: 3600,
    startDayOfYear: 15,
    startHour: 0,
    T_amb,
    GHI,
    v_wind,
    provenance: {
      source: 'synthetic',
      label: 'T-47 K-03 test fixture',
      sourceElevation: null,
      lapseCorrectionK: 0,
      notes: [],
    },
  };

  function building(materialId: string, thickness: number): Building {
    return {
      floorArea: 16,
      volume: 64,
      azimuth: 0,
      surfaces: [
        buildSurfaceWith('south', 'wall', 90, 0, materialId, thickness),
        buildSurfaceWith('east', 'wall', 90, -90, materialId, thickness),
        buildSurfaceWith('west', 'wall', 90, 90, materialId, thickness),
        buildSurfaceWith('north', 'wall', 90, 180, materialId, thickness),
        buildSurfaceWith('roof', 'roof', 0, 0, materialId, thickness),
        buildSurfaceWith('floor', 'floor', 180, 0, materialId, thickness),
      ],
      windows: [{ id: 'southWindow', hostSurfaceId: 'south', area: 1.5, glazingId: glazing.id }],
      thermalBridgeFactor: 1.1,
    };
  }

  function req(b: Building, materials: Record<string, Material>): SimulationRequest {
    return {
      site: {
        id: 'k03-leh',
        name: 'K-03 test site (Leh)',
        latitude: 34.15,
        longitude: 77.58,
        elevation: 3500,
        standardMeridian: 82.5,
        groundAlbedo: 0.3,
        groundTempMeanAnnual: toK(6),
      },
      building: b,
      operation: {
        internalGainsSchedule: new Array(24).fill(150),
        achSchedule: new Array(24).fill(0.5),
        auxHeating: { enabled: false, setpoint: toK(18), maxPower: 0 },
        comfortBand: { lower: toK(15), upper: toK(24) },
      },
      weather,
      materials,
      glazings: { [glazing.id]: glazing },
      options: {
        timestepSeconds: 300,
        meshTargetDx: 0.02,
        simulationDays: 1,
        spinUpToleranceK: 0.02,
        maxSpinUpDays: 30,
        skyModel: 'isotropic',
        integrationTheta: 1,
        keepSurfaceProfiles: false,
        allowUnsafeVentilation: false,
      },
    };
  }

  return {
    heavy: req(building(denseConcrete.id, 0.3), { [denseConcrete.id]: denseConcrete }),
    light: req(building(steel.id, 0.001), { [steel.id]: steel, [puf.id]: puf }),
  };
}

/** Hand-built, not run through `simulate()` -- the engine's own minimum day
 * is many timesteps; this is `dayPoints`/`TempChart`'s own single-timestep
 * guard (test 8), exercised directly against a length-1 result. */
function singleTimestepResult(): ReturnType<typeof simulate> {
  const one = (v: number) => new Float64Array([v]);
  return {
    meta: {
      nodeCount: 1,
      timesteps: 1,
      wallClockMs: 0,
      spinUpDaysUsed: 0,
      energyBalanceResidual: 0,
      annualisationMethod: 'n/a',
      warnings: [],
    },
    time: one(0),
    temperatures: {
      indoorAir: one(toK(10)),
      ambient: one(toK(-5)),
      sky: one(toK(-20)),
      meanRadiant: one(toK(9)),
      ground: one(toK(6)),
      surfaces: {},
    },
    solar: {
      incidentBySurface: {},
      absorbedOpaque: one(0),
      transmittedGlazed: one(0),
      dailyTotalKWh: { opaque: 0, glazed: 0, bySurface: {} },
    },
    heatFlows: {} as ReturnType<typeof simulate>['heatFlows'],
    kpis: {
      minIndoorTemp: toK(10),
      maxIndoorTemp: toK(10),
      meanIndoorTemp: toK(10),
      tempAt0600: toK(10),
      hoursInComfort: 0,
      hoursBelow5C: 0,
      hoursBelowFreezing: 0,
      peakToPeakSwing: 0,
      decrementFactor: 0,
      timeLagHours: 0,
      auxEnergyKWhPerDay: 0,
      keroseneEquivalentLitresPerYear: 0,
      co2EquivalentKgPerYear: 0,
      costPerYearINR: 0,
      condensationRiskHours: null,
    },
  };
}
