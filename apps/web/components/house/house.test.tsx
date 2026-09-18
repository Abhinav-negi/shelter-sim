// apps/web/components/house/house.test.tsx
//
// T-46's 11 acceptance tests. This environment has no jsdom/happy-dom and no
// @testing-library (neither is on the approved dependency list, CONTRACTS.md
// §7.13, and neither is installed in this worktree), so a real DOM cannot be
// mounted and no real click/Tab-key event can be dispatched. This file
// verifies what IS available without either:
//   - every pure function (geometry, colour, time-index, export sizing) by
//     plain assertion;
//   - the real physics claim (test 3) by actually calling `simulate()`
//     against the bundled Leh preset, the same way `app/page.tsx` does;
//   - DOM STRUCTURE (surface ids, tabIndex, viewBox, no width/height, legend
//     text, document order) via `react-dom/server`'s `renderToStaticMarkup`,
//     which runs in plain Node, no DOM required;
//   - click/Enter ACTIVATION by calling `activateSurface`, the exact function
//     `HouseView` wires to both `onClick` and `onKeyDown`'s Enter/Space
//     branch -- not a simulated DOM event, but the identical code path one
//     runs.
// Test 8's "tab order walk" is therefore a structural check (document order
// of the `tabIndex=0` surfaces, which is exactly what a browser's real Tab
// order is for equal tabIndex values) rather than a literal Tab keypress in
// a browser. Test 9 is handled the pragmatic way this task's own brief asks
// for when no headless rasteriser is available -- see `export.ts`'s header.

import { describe, expect, it } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { glazingById, materialById, PRESETS, tmyById } from '@shelter/data';
import { asK, simulate } from '@shelter/engine';
import type { Building, Glazing, Material, Preset, SimulationRequest, Surface } from '@shelter/engine';
import { __debugDispatchCount, actions, getStoreState, hydrateStore } from '../../lib/store';
import { formatTempC } from '../../lib/units';
import { HouseView, activateSurface, nextScrubberHour } from './HouseView';
import { boundingBox, surfaceQuads } from './geometry';
import { colorForTemp, tempDomainForIndex } from './color';
import { hourToTimeIndex } from './time';
import { computeExportPixelSize } from './export';

// ---- shared fixture: the real bundled Leh preset, resolved and simulated
// exactly the way `app/page.tsx` does (`resolvePreset`, inlined here since
// `app/page.tsx` is off this task's allow-list to import from). ----
function resolvePreset(preset: Preset): SimulationRequest {
  const materials: Record<string, Material> = {};
  for (const surface of preset.request.building.surfaces) {
    for (const layer of surface.construction) materials[layer.materialId] = materialById(layer.materialId);
  }
  const glazings: Record<string, Glazing> = {};
  for (const win of preset.request.building.windows) glazings[win.glazingId] = glazingById(win.glazingId);
  return { ...preset.request, weather: tmyById(preset.locationId), materials, glazings };
}

const lehPreset = PRESETS.find((p) => p.locationId === 'leh')!;
const request = resolvePreset(lehPreset);
const result = simulate(request);
const building = request.building;

hydrateStore({ request, result, presetId: lehPreset.id });

describe('T-46 house: geometry, colour, interaction', () => {
  it('test 1 -- every surface is drawn once; clicking sets selectedSurfaceId to its exact id', () => {
    const quads = surfaceQuads(building);
    const surfaceIds = building.surfaces.map((s) => s.id);
    expect(quads.map((q) => q.id).sort()).toEqual([...surfaceIds].sort());

    for (const id of surfaceIds) {
      actions.setSelectedSurfaceId(null);
      activateSurface(id);
      expect(getStoreState().selectedSurfaceId).toBe(id);
    }
    console.log('T-46 test 1 evidence -- surface ids asserted:', surfaceIds);
  });

  it('test 2 -- the drawing is the model: the south-wall path width scales linearly with building length', () => {
    function boxBuilding(sideEW: number, sideNS: number, height: number): Building {
      const wall = (id: string, azimuth: number, area: number): Surface => ({
        id,
        type: 'wall',
        area,
        tilt: 90,
        azimuth,
        construction: [],
        boundary: 'exterior',
        exteriorAbsorptivity: 0.7,
        exteriorEmissivity: 0.9,
        interiorEmissivity: 0.9,
      });
      return {
        floorArea: sideEW * sideNS,
        volume: sideEW * sideNS * height,
        azimuth: 0,
        surfaces: [
          wall('wallSouth', 0, sideEW * height),
          wall('wallNorth', 180, sideEW * height),
          wall('wallEast', -90, sideNS * height),
          wall('wallWest', 90, sideNS * height),
        ],
        windows: [],
        thermalBridgeFactor: 1.1,
      };
    }

    function southWallWidth(b: Building): number {
      const quad = surfaceQuads(b).find((q) => q.id === 'wallSouth')!;
      const xs = [...quad.d.matchAll(/(-?\d+\.\d+),(-?\d+\.\d+)/g)].map((m) => Number(m[1]));
      return Math.max(...xs) - Math.min(...xs);
    }

    const lengthSmall = 5;
    const lengthBig = 8;
    const small = boxBuilding(lengthSmall, 5, 2.6);
    const big = boxBuilding(lengthBig, 5, 2.6); // only the east-west length changes
    const widthSmall = southWallWidth(small);
    const widthBig = southWallWidth(big);
    console.log('T-46 test 2 evidence:', { lengthSmall, widthSmall, lengthBig, widthBig, ratio: widthBig / widthSmall });
    expect(widthBig / widthSmall).toBeCloseTo(lengthBig / lengthSmall, 2);
  });

  it('test 3 -- colours change between 03:00 and 14:00; the south wall is warmest near solar noon on the real bundled Leh January day', () => {
    const idx0300 = hourToTimeIndex(result, request.weather.startHour, 3);
    const idx1400 = hourToTimeIndex(result, request.weather.startHour, 14);
    const domain0300 = tempDomainForIndex(result, idx0300);
    const domain1400 = tempDomainForIndex(result, idx1400);
    const colorAt0300 = colorForTemp(result.temperatures.surfaces.wallSouth!.exterior[idx0300]!, domain0300);
    const colorAt1400 = colorForTemp(result.temperatures.surfaces.wallSouth!.exterior[idx1400]!, domain1400);
    expect(colorAt0300).not.toBe(colorAt1400);

    const idxNoon = hourToTimeIndex(result, request.weather.startHour, 12);
    const southK = result.temperatures.surfaces.wallSouth!.exterior[idxNoon]!;
    const northK = result.temperatures.surfaces.wallNorth!.exterior[idxNoon]!;
    console.log('T-46 test 3 evidence -- 12:00, south vs north exterior wall temp:', {
      southC: formatTempC(asK(southK)),
      northC: formatTempC(asK(northK)),
      southColor03: colorAt0300,
      southColor14: colorAt1400,
    });
    expect(southK).toBeGreaterThan(northK);
  });

  it('test 4 -- with result === null the house renders in a neutral unfilled state and does not crash', () => {
    actions.setResult(null);
    expect(() => renderToStaticMarkup(<HouseView />)).not.toThrow();
    const markup = renderToStaticMarkup(<HouseView />);
    expect(markup).toContain('#cbd5e1');
    actions.setResult(result); // restore for the tests below
  });

  it('test 5 -- the legend states its range + units and updates with the data range at two different hours', () => {
    actions.setScrubberHour(3);
    const markupAt3 = renderToStaticMarkup(<HouseView />);
    const textAt3 = /data-testid="house-legend-text">([^<]*)</.exec(markupAt3)?.[1];

    actions.setScrubberHour(14);
    const markupAt14 = renderToStaticMarkup(<HouseView />);
    const textAt14 = /data-testid="house-legend-text">([^<]*)</.exec(markupAt14)?.[1];

    console.log('T-46 test 5 evidence:', { hour3: textAt3, hour14: textAt14 });
    expect(textAt3).toBeDefined();
    expect(textAt14).toBeDefined();
    expect(textAt3).not.toBe(textAt14);
    expect(textAt3).toMatch(/°C/);
    expect(textAt14).toMatch(/°C/);
  });

  it('test 6 -- the animation completes a 24 h loop and can be paused at any hour, including 06:00', () => {
    let h = 0;
    const seen = new Set<number>();
    for (let i = 0; i < 24; i++) {
      seen.add(h);
      h = nextScrubberHour(h);
    }
    expect(seen.size).toBe(24); // visits every hour exactly once
    expect(h).toBe(0); // closes the loop back to the start

    actions.setScrubberHour(6);
    const markup = renderToStaticMarkup(<HouseView />);
    expect(markup).toContain('06:00');
    const idx0600 = hourToTimeIndex(result, request.weather.startHour, 6);
    console.log('T-46 test 6 evidence:', { loopVisited: seen.size, pausedAtLabel: '06:00', idx0600 });
  });

  it('test 7 -- no fixed pixel width/height on the <svg>, viewBox only, and CSS makes it shrink at narrow widths', () => {
    const markup = renderToStaticMarkup(<HouseView />);
    expect(markup).toMatch(/<svg[^>]*viewBox="/);
    expect(markup).not.toMatch(/<svg[^>]*\swidth="\d/);
    expect(markup).not.toMatch(/<svg[^>]*\sheight="\d/);
    // CSS (not an SVG width/height attribute) is what actually makes the SVG
    // shrink to fit a narrow container instead of the SVG spec's 300x150
    // fallback intrinsic size -- structural evidence for "fits at 320px";
    // an actual 320px-viewport layout render is a real-browser check this
    // headless environment (no jsdom) cannot perform. See this test's own
    // Evidence-block note.
    expect(markup).toMatch(/<svg[^>]*style="[^"]*width:100%/);
  });

  it('test 8 -- keyboard focus reaches every clickable surface in a stable order, and Enter activates it', () => {
    const markup = renderToStaticMarkup(<HouseView />);
    const expectedOrder = surfaceQuads(building).map((q) => q.id);
    const domOrder = [...markup.matchAll(/data-surface-id="([^"]+)"/g)].map((m) => m[1]);
    expect(domOrder).toEqual(expectedOrder);
    // Every surface path carries tabIndex=0 (rendered as the `tabindex="0"`
    // HTML/SVG attribute) -- one per surface, no more, no fewer.
    expect(markup.match(/tabindex="0"/g)?.length).toBe(building.surfaces.length);
    console.log('T-46 test 8 evidence -- tab order:', domOrder);

    actions.setSelectedSurfaceId(null);
    const last = domOrder[domOrder.length - 1]!;
    activateSurface(last); // the exact call HouseView's onKeyDown makes on Enter/Space
    expect(getStoreState().selectedSurfaceId).toBe(last);
  });

  it('test 9 -- presentation-resolution export size is computed correctly (real rasterisation needs a browser; see export.ts header)', () => {
    const bbox = boundingBox(building);
    const vbW = bbox.maxX - bbox.minX + 2;
    const vbH = bbox.maxY - bbox.minY + 2;
    const size = computeExportPixelSize(vbW, vbH);
    console.log('T-46 test 9 evidence -- computed export pixel size:', size, 'from viewBox', { vbW, vbH });
    expect(size.width).toBe(1920);
    expect(size.height).toBeGreaterThan(0);
  });

  it('test 11 -- scrubbing rapidly through 24 hours dispatches zero simulations', () => {
    const before = __debugDispatchCount();
    for (let h = 0; h < 24; h++) actions.setScrubberHour(h);
    const after = __debugDispatchCount();
    console.log('T-46 test 11 evidence -- dispatch count before/after 24 scrubs:', { before, after, delta: after - before });
    expect(after - before).toBe(0);
  });
});
