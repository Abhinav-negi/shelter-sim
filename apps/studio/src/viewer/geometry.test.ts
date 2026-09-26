import type { Options, ShelterDesign } from '@shelter/studio-server';
import { describe, expect, it } from 'vitest';
import { buildSceneGeometry, CYLINDER_SECTORS, DOME_BANDS, DOME_SECTORS, orientationForAzimuth } from './geometry';

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

  it('a box design is shape-tagged and unaffected by the G3 defaults', () => {
    const g = buildSceneGeometry(makeDesign(), options);
    expect(g.shape).toBe('box');
    expect(g.storeys).toBe(1);
    expect(g.buildingHeightM).toBe(g.heightM);
    expect(g.domeFacets).toEqual([]);
    expect(g.walls).toHaveLength(4);
  });

  it('storeys:2 doubles buildingHeightM but leaves heightM (per-storey) alone', () => {
    const g = buildSceneGeometry(makeDesign({ storeys: 2 }), options);
    expect(g.heightM).toBe(2.6);
    expect(g.buildingHeightM).toBeCloseTo(5.2, 9);
  });

  it('orientationForAzimuth mirrors assemble.ts: ties at ±45/±135 go to S/N, never E/W', () => {
    expect(orientationForAzimuth(0)).toBe('S');
    expect(orientationForAzimuth(45)).toBe('S');
    expect(orientationForAzimuth(-45)).toBe('S');
    expect(orientationForAzimuth(46)).toBe('W');
    expect(orientationForAzimuth(90)).toBe('W');
    expect(orientationForAzimuth(-90)).toBe('E');
    expect(orientationForAzimuth(-135)).toBe('N');
    expect(orientationForAzimuth(135)).toBe('N');
    expect(orientationForAzimuth(180)).toBe('N');
  });

  describe('cylinder', () => {
    it('has 12 wall facets at -150 + k*30, and no dome facets', () => {
      const g = buildSceneGeometry(makeDesign({ shape: 'cylinder', lengthM: 8 }), options);
      expect(g.shape).toBe('cylinder');
      expect(g.walls).toHaveLength(CYLINDER_SECTORS);
      expect(g.domeFacets).toEqual([]);
      const azimuths = g.walls.map((w) => w.azimuthDeg).sort((a, b) => a! - b!);
      expect(azimuths).toEqual([-150, -120, -90, -60, -30, 0, 30, 60, 90, 120, 150, 180]);
    });

    it('a cylinder with the same diameter and height as a box has less wall area than the box', () => {
      // Mirrors the server's own condition (V2.md §G2): a circle has less
      // perimeter than the square of the same "diameter" (here, lengthM).
      const design = makeDesign({ shape: 'cylinder', lengthM: 8, heightM: 3 });
      const g = buildSceneGeometry(design, options);
      const cylinderWallArea = g.walls.reduce((sum, w) => sum + w.facadeWidth * g.heightM, 0);
      const boxWallArea = 2 * (design.lengthM + design.widthM) * design.heightM;
      expect(cylinderWallArea).toBeLessThan(boxWallArea);
    });

    it('storeys:2 doubles buildingHeightM (2h), matching the shared box/cylinder rule', () => {
      const g = buildSceneGeometry(makeDesign({ shape: 'cylinder', lengthM: 8, heightM: 3, storeys: 2 }), options);
      expect(g.buildingHeightM).toBeCloseTo(6, 9);
    });
  });

  describe('dome', () => {
    it('has 3 bands x 12 sectors: bands 0/1 are walls, band 2 is roof, and no box walls', () => {
      const g = buildSceneGeometry(makeDesign({ shape: 'dome', lengthM: 10 }), options);
      expect(g.shape).toBe('dome');
      expect(g.walls).toEqual([]);
      expect(g.domeFacets).toHaveLength(DOME_BANDS * DOME_SECTORS);
      expect(g.domeFacets.filter((f) => f.band === 0).every((f) => f.kind === 'wall')).toBe(true);
      expect(g.domeFacets.filter((f) => f.band === 1).every((f) => f.kind === 'wall')).toBe(true);
      expect(g.domeFacets.filter((f) => f.band === 2).every((f) => f.kind === 'roof')).toBe(true);
      expect(g.domeFacets.filter((f) => f.kind === 'wall')).toHaveLength(2 * DOME_SECTORS);
      expect(g.domeFacets.filter((f) => f.kind === 'roof')).toHaveLength(DOME_SECTORS);
    });

    it('band tilts match the closed-form mid-height elevation (bands ≈ 80.4°, 60.0°, 33.6°)', () => {
      const g = buildSceneGeometry(makeDesign({ shape: 'dome', lengthM: 10 }), options);
      const tiltOf = (band: number) => g.domeFacets.find((f) => f.band === band)!.tiltDeg;
      expect(tiltOf(0)).toBeCloseTo(80.4, 1);
      expect(tiltOf(1)).toBeCloseTo(60.0, 1);
      expect(tiltOf(2)).toBeCloseTo(33.6, 1);
    });

    it('band radii match the closed-form sphere section R(z) = sqrt(r^2 - z^2)', () => {
      const design = makeDesign({ shape: 'dome', lengthM: 10 });
      const g = buildSceneGeometry(design, options);
      const r = design.lengthM / 2;
      for (const facet of g.domeFacets) {
        expect(facet.radiusLow).toBeCloseTo(Math.sqrt(r * r - facet.heightLow * facet.heightLow), 9);
        expect(facet.radiusHigh).toBeCloseTo(Math.sqrt(r * r - facet.heightHigh * facet.heightHigh), 9);
      }
    });

    it("each band's total facet area is close to the closed-form spherical-zone area 2*pi*r*dz (hat-box identity)", () => {
      // The viewer approximates each band with 12 FLAT trapezoid panels (no
      // CSG), not the true curved zone -- a low-poly-sphere effect, not the
      // server's exact identity (assemble.ts's domeGeometry): bands 0/1 are
      // within ~3%, but band 2 (the apex cap, a flat triangle standing in
      // for the pole's tightest curvature) is ~10% low, so the tolerance
      // here is deliberately loose.
      const design = makeDesign({ shape: 'dome', lengthM: 10 });
      const g = buildSceneGeometry(design, options);
      const r = design.lengthM / 2;
      const dz = r / DOME_BANDS;
      const closedForm = 2 * Math.PI * r * dz;
      const halfAngle = (180 / DOME_SECTORS) * (Math.PI / 180);

      for (let band = 0; band < DOME_BANDS; band++) {
        const facets = g.domeFacets.filter((f) => f.band === band);
        const totalArea = facets.reduce((sum, f) => {
          const halfBottom = f.radiusLow * Math.sin(halfAngle);
          const halfTop = f.radiusHigh * Math.sin(halfAngle);
          const slant = Math.hypot(f.radiusHigh - f.radiusLow, f.heightHigh - f.heightLow);
          return sum + (halfBottom + halfTop) * slant; // trapezoid area = avg width * height
        }, 0);
        expect(totalArea).toBeGreaterThan(closedForm * 0.85);
        expect(totalArea).toBeLessThan(closedForm * 1.05);
      }
    });

    it('storeys is ignored/irrelevant: dome buildingHeightM is the radius, not heightM*storeys', () => {
      const g = buildSceneGeometry(makeDesign({ shape: 'dome', lengthM: 10, heightM: 3 }), options);
      expect(g.buildingHeightM).toBe(5);
    });
  });
});
