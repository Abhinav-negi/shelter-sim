// Q2F regression: the popover used to anchor every part (wall AND window) at
// the wall's mid-height, which for a real window (sill 0.9m, tall enough to
// span past mid-height) sits *inside* the window's own screen rect — the
// popover's "translate up above the anchor" offset (PartPopover.tsx's Html
// wrapper) then still overlapped the window it was editing (Q2.md finding
// #2). anchorPosition() now anchors a window part at the window's own TOP
// edge instead, so the popover clears it. This only checks the pure
// geometry (anchorPosition), not the rendered DOM offset/screenshot, which
// is verified separately in ledger/tasks/Q2F.md's screenshot evidence.
import { describe, expect, it } from 'vitest';
import { anchorPosition } from './PartPopover';
import type { SceneGeometry, WallGeometry } from './geometry';

function makeScene(overrides: Partial<SceneGeometry> = {}): SceneGeometry {
  return {
    shape: 'box',
    storeys: 1,
    lengthM: 5,
    widthM: 5,
    heightM: 2.6,
    wallThicknessM: 0.4,
    roofThicknessM: 0.13,
    floorThicknessM: 0.15,
    rotationY: 0,
    buildingHeightM: 2.6,
    walls: [],
    domeFacets: [],
    ...overrides,
  };
}

function wall(orientation: WallGeometry['orientation'], window: WallGeometry['window']): WallGeometry {
  return { orientation, facadeWidth: 5, window };
}

describe('anchorPosition — Q2F window-top anchor', () => {
  it('a south window anchors at the window top (sill + height), not the wall mid-height', () => {
    const southWindow = { width: 1.5, height: 1.4, sill: 0.9 };
    const scene = makeScene({ walls: [wall('S', southWindow)] });
    const [, y] = anchorPosition(scene, 'window:S');
    expect(y).toBeCloseTo(southWindow.sill + southWindow.height, 9); // 2.3
    expect(y).toBeGreaterThan(scene.heightM / 2); // above the old wall-mid anchor
  });

  it('a south WALL (no window) still anchors at the wall mid-height, unaffected', () => {
    const scene = makeScene({ walls: [wall('S', null)] });
    const [, y] = anchorPosition(scene, 'wall:S');
    expect(y).toBe(scene.heightM / 2);
  });

  it('falls back to wall mid-height when the window part has no window rect (e.g. WWR 0)', () => {
    const scene = makeScene({ walls: [wall('S', null)] });
    const [, y] = anchorPosition(scene, 'window:S');
    expect(y).toBe(scene.heightM / 2);
  });
});
