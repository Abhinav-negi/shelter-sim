import type { Options, ShelterDesign } from '@shelter/studio-server';
import { describe, expect, it } from 'vitest';
import { buildSceneGeometry } from './geometry';

function makeOptions(): Options {
  return {
    locations: [],
    presets: [
      {
        id: 'p1',
        name: 'Preset',
        description: '',
        locationId: 'leh',
        thicknessM: { wall: 0.4, roof: 0.3, floor: 0.2 },
      },
    ],
    materials: [],
    glazings: [],
    occupancyPresets: [],
    defaults: {} as ShelterDesign,
    ranges: {
      azimuthDeg: { min: -180, max: 180 },
      lengthM: { min: 2, max: 30 },
      widthM: { min: 2, max: 30 },
      heightM: { min: 2, max: 6 },
      thicknessM: { min: 0.02, max: 1 },
      windowWwr: { min: 0, max: 0.9 },
    },
  };
}

function makeDesign(overrides: Partial<ShelterDesign> = {}): ShelterDesign {
  return {
    location: { kind: 'preset', id: 'leh' },
    date: '2023-01-15',
    presetId: 'p1',
    lengthM: 5,
    widthM: 5,
    heightM: 2.6,
    azimuthDeg: 0,
    wallConstruction: null,
    roofConstruction: null,
    floorConstruction: null,
    windowWwr: { S: 0.2, E: 0, W: 0, N: 0 },
    glazingId: 'g',
    nightShutters: false,
    occupancyPresetId: 'o',
    ...overrides,
  };
}

describe('buildSceneGeometry', () => {
  const options = makeOptions();

  it('widening widthM widens the E/W facades (and leaves lengthM-driven S/N alone)', () => {
    const narrow = buildSceneGeometry(makeDesign({ widthM: 4 }), options);
    const wide = buildSceneGeometry(makeDesign({ widthM: 6 }), options);
    const facadeWidth = (g: typeof narrow, o: 'E' | 'W' | 'S' | 'N') =>
      g.walls.find((w) => w.orientation === o)!.facadeWidth;

    expect(facadeWidth(wide, 'E')).toBeGreaterThan(facadeWidth(narrow, 'E'));
    expect(facadeWidth(wide, 'W')).toBeGreaterThan(facadeWidth(narrow, 'W'));
    expect(wide.widthM).toBe(6);
    expect(facadeWidth(wide, 'S')).toBe(facadeWidth(narrow, 'S'));
  });

  it('corner joints are mitred: every wall reports its full outer (corner-to-corner) length, not a trimmed one', () => {
    const g = buildSceneGeometry(makeDesign({ lengthM: 5, widthM: 6 }), options);
    const facadeWidth = (o: 'E' | 'W' | 'S' | 'N') => g.walls.find((w) => w.orientation === o)!.facadeWidth;

    // S/N run the lengthM span, E/W run the widthM span — none of them
    // trimmed by wallThicknessM (the mitre taper that keeps interior
    // corners from overlapping is applied in Building.tsx, not here).
    expect(facadeWidth('S')).toBe(5);
    expect(facadeWidth('N')).toBe(5);
    expect(facadeWidth('E')).toBe(6);
    expect(facadeWidth('W')).toBe(6);
  });

  it('an explicit wallConstruction.thicknessM makes the walls thicker', () => {
    const thin = buildSceneGeometry(
      makeDesign({ wallConstruction: { materialId: 'm', thicknessM: 0.1 } }),
      options,
    );
    const thick = buildSceneGeometry(
      makeDesign({ wallConstruction: { materialId: 'm', thicknessM: 0.2 } }),
      options,
    );
    expect(thin.wallThicknessM).toBe(0.1);
    expect(thick.wallThicknessM).toBeGreaterThan(thin.wallThicknessM);
  });

  it('falls back to the preset construction thickness when a construction is null', () => {
    const g = buildSceneGeometry(makeDesign({ wallConstruction: null }), options);
    expect(g.wallThicknessM).toBe(0.4);
    expect(g.roofThicknessM).toBe(0.3);
    expect(g.floorThicknessM).toBe(0.2);
  });

  it('azimuth 0 -> 90 rotates the group', () => {
    const a0 = buildSceneGeometry(makeDesign({ azimuthDeg: 0 }), options);
    const a90 = buildSceneGeometry(makeDesign({ azimuthDeg: 90 }), options);
    expect(a0.rotationY).toBeCloseTo(0);
    expect(a90.rotationY).toBeCloseTo(-Math.PI / 2);
  });

  it('windows clamp to fit inside the wall with margins', () => {
    const g = buildSceneGeometry(
      makeDesign({ lengthM: 2, heightM: 2, windowWwr: { S: 0.9, E: 0, W: 0, N: 0 } }),
      options,
    );
    const south = g.walls.find((w) => w.orientation === 'S')!;
    expect(south.window).not.toBeNull();
    expect(south.window!.width).toBeLessThanOrEqual(2 - 2 * 0.15 + 1e-9);
    expect(south.window!.height).toBeLessThanOrEqual(2 - 0.9 - 0.3 + 1e-9);
  });

  it('zero WWR gives no window', () => {
    const g = buildSceneGeometry(makeDesign(), options);
    expect(g.walls.find((w) => w.orientation === 'E')!.window).toBeNull();
    expect(g.walls.find((w) => w.orientation === 'W')!.window).toBeNull();
  });
});
