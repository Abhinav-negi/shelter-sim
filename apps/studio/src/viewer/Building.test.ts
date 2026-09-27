// Tests the mitred-corner construction (F2b) directly against the real
// BufferGeometry vertex data, not just by eyeballing screenshots: every
// wall's EXTERIOR face must reach the true corner-to-corner length, and its
// INTERIOR face must be inset by wallThicknessM at each end (a 45° mitre,
// like a picture-frame corner), with S/N and E/W meeting on the exact same
// cut plane so mergeVertices can weld them with no gap or overlap.
import { describe, expect, it } from 'vitest';
import { buildRingWallGeometry, buildWallGeometry } from './Building';
import type { SceneGeometry, WallGeometry } from './geometry';

const DEG2RAD = Math.PI / 180;
const CYLINDER_SECTORS = 12;
const RING_HALF_ANGLE_DEG = 180 / CYLINDER_SECTORS;

function makeScene(overrides: Partial<SceneGeometry> = {}): SceneGeometry {
  return {
    shape: 'box',
    storeys: 1,
    lengthM: 5,
    widthM: 6,
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

function wall(orientation: WallGeometry['orientation'], facadeWidth: number): WallGeometry {
  return { orientation, facadeWidth, window: null };
}

/** The max |coordinate along `uAxis`| among vertices sitting at a given
 *  coordinate along the other (depth) axis — i.e. "how wide is this wall's
 *  cross-section at this particular depth slice". */
function maxUAt(geom: ReturnType<typeof buildWallGeometry>, uAxis: 'x' | 'z', depthValue: number): number {
  const pos = geom.attributes.position!; // ExtrudeGeometry always has a position attribute
  const getU = uAxis === 'x' ? (i: number) => pos.getX(i) : (i: number) => pos.getZ(i);
  const getDepth = uAxis === 'x' ? (i: number) => pos.getZ(i) : (i: number) => pos.getX(i);
  let max = 0;
  for (let i = 0; i < pos.count; i++) {
    if (Math.abs(getDepth(i) - depthValue) < 1e-6) {
      max = Math.max(max, Math.abs(getU(i)));
    }
  }
  return max;
}

describe('buildWallGeometry — mitred corners (F2b)', () => {
  it('S wall: exterior face is the full outer length; interior face is inset by wallThicknessM at each end', () => {
    const scene = makeScene();
    const t = scene.wallThicknessM;
    const geom = buildWallGeometry(scene, wall('S', scene.lengthM));
    const outerFace = scene.widthM / 2; // S's exterior plane (world z)
    const innerFace = outerFace - t;

    expect(maxUAt(geom, 'x', outerFace)).toBeCloseTo(scene.lengthM / 2, 6);
    expect(maxUAt(geom, 'x', innerFace)).toBeCloseTo(scene.lengthM / 2 - t, 6);
  });

  it('N wall: exterior face is the full outer length; interior face is inset by wallThicknessM at each end', () => {
    const scene = makeScene();
    const t = scene.wallThicknessM;
    const geom = buildWallGeometry(scene, wall('N', scene.lengthM));
    const outerFace = -scene.widthM / 2; // N's exterior plane
    const innerFace = outerFace + t;

    expect(maxUAt(geom, 'x', outerFace)).toBeCloseTo(scene.lengthM / 2, 6);
    expect(maxUAt(geom, 'x', innerFace)).toBeCloseTo(scene.lengthM / 2 - t, 6);
  });

  it('E wall: exterior face is the full outer width; interior face is inset by wallThicknessM at each end', () => {
    const scene = makeScene();
    const t = scene.wallThicknessM;
    const geom = buildWallGeometry(scene, wall('E', scene.widthM));
    const outerFace = scene.lengthM / 2; // E's exterior plane (world x)
    const innerFace = outerFace - t;

    expect(maxUAt(geom, 'z', outerFace)).toBeCloseTo(scene.widthM / 2, 6);
    expect(maxUAt(geom, 'z', innerFace)).toBeCloseTo(scene.widthM / 2 - t, 6);
  });

  it('W wall: exterior face is the full outer width; interior face is inset by wallThicknessM at each end', () => {
    const scene = makeScene();
    const t = scene.wallThicknessM;
    const geom = buildWallGeometry(scene, wall('W', scene.widthM));
    const outerFace = -scene.lengthM / 2; // W's exterior plane
    const innerFace = outerFace + t;

    expect(maxUAt(geom, 'z', outerFace)).toBeCloseTo(scene.widthM / 2, 6);
    expect(maxUAt(geom, 'z', innerFace)).toBeCloseTo(scene.widthM / 2 - t, 6);
  });

  it('S and E walls mitre onto the exact same cut plane at their shared (SE) corner', () => {
    // The corner joint is only gap/overlap-free if both walls' mitred end
    // faces are the SAME set of 3D points, not just parallel/coplanar ones
    // (see Building.tsx's mitreWallEnds comment for the derivation this
    // checks). x - z is constant along that shared cut plane.
    const scene = makeScene({ lengthM: 5, widthM: 6, wallThicknessM: 0.4 });
    const sGeom = buildWallGeometry(scene, wall('S', scene.lengthM));
    const eGeom = buildWallGeometry(scene, wall('E', scene.widthM));
    const t = scene.wallThicknessM;
    const target = scene.lengthM / 2 - scene.widthM / 2; // x - z on the shared plane

    const collectNearCorner = (geom: ReturnType<typeof buildWallGeometry>) => {
      const pos = geom.attributes.position!; // ExtrudeGeometry always has a position attribute
      const pts: Array<[number, number, number]> = [];
      for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i);
        const z = pos.getZ(i);
        // near the SE corner region, within the wall-thickness band both walls actually occupy there
        if (x > scene.lengthM / 2 - t - 1e-6 && z > scene.widthM / 2 - t - 1e-6) {
          pts.push([x, pos.getY(i), z]);
        }
      }
      return pts;
    };

    const sPts = collectNearCorner(sGeom);
    const ePts = collectNearCorner(eGeom);
    expect(sPts.length).toBeGreaterThan(0);
    expect(ePts.length).toBeGreaterThan(0);
    for (const [x, , z] of [...sPts, ...ePts]) {
      expect(x - z).toBeCloseTo(target, 6);
    }
  });
});

function ringWall(azimuthDeg: number, facadeWidth: number): WallGeometry {
  return { orientation: 'S', azimuthDeg, facadeWidth, window: null };
}

describe('buildRingWallGeometry — generalised mitre, N=12 (G3)', () => {
  it('an unrotated (azimuth 0) facet: exterior face at radius r, interior inset by wallThicknessM, mitred at 180/12=15°', () => {
    const scene = makeScene({ shape: 'cylinder', lengthM: 10, wallThicknessM: 0.4, heightM: 2.6 });
    const r = scene.lengthM / 2;
    const t = scene.wallThicknessM;
    const chord = 2 * r * Math.tan(RING_HALF_ANGLE_DEG * DEG2RAD);
    const geom = buildRingWallGeometry(scene, ringWall(0, chord));

    // azimuth 0 -> no rotation (geometry.ts's convention: 0=S=+Z, no
    // rotateY applied) -- world x/z equal the pre-rotation local u/depth
    // exactly, so the box's own `maxUAt` helper applies unchanged, just
    // against the 15° mitre instead of 45°.
    const half = chord / 2;
    const innerHalf = half - t * Math.tan(RING_HALF_ANGLE_DEG * DEG2RAD);
    expect(maxUAt(geom, 'x', r)).toBeCloseTo(half, 6);
    expect(maxUAt(geom, 'x', r - t)).toBeCloseTo(innerHalf, 6);
  });

  it('12 facets close the ring with no seam: adjacent facets (azimuth 0 and 30) share their mitred corner exactly', () => {
    const scene = makeScene({ shape: 'cylinder', lengthM: 10, wallThicknessM: 0.4, heightM: 2.6 });
    const r = scene.lengthM / 2;
    const chord = 2 * r * Math.tan(RING_HALF_ANGLE_DEG * DEG2RAD);
    const geomA = buildRingWallGeometry(scene, ringWall(0, chord));
    const geomB = buildRingWallGeometry(scene, ringWall(30, chord));

    const xzSet = (geom: ReturnType<typeof buildRingWallGeometry>) => {
      const pos = geom.attributes.position!;
      const set = new Set<string>();
      for (let i = 0; i < pos.count; i++) set.add(`${pos.getX(i).toFixed(6)},${pos.getZ(i).toFixed(6)}`);
      return set;
    };

    const setA = xzSet(geomA);
    const setB = xzSet(geomB);
    const shared = [...setA].filter((p) => setB.has(p));
    // Both the exterior corner and the mitred interior corner should
    // coincide exactly (2 distinct (x,z) points, each present at both the
    // wall's base and top -- i.e. present regardless of y).
    expect(shared.length).toBe(2);
  });

  it('all 12 facets have the same exterior corner-to-origin radius (a closed, regular ring)', () => {
    const scene = makeScene({ shape: 'cylinder', lengthM: 10, wallThicknessM: 0.4, heightM: 2.6 });
    const r = scene.lengthM / 2;
    const chord = 2 * r * Math.tan(RING_HALF_ANGLE_DEG * DEG2RAD);
    const expectedCornerRadius = Math.hypot(chord / 2, r);
    for (let k = 0; k < CYLINDER_SECTORS; k++) {
      const geom = buildRingWallGeometry(scene, ringWall(-150 + k * 30, chord));
      const pos = geom.attributes.position!;
      let maxRadius = 0;
      for (let i = 0; i < pos.count; i++) maxRadius = Math.max(maxRadius, Math.hypot(pos.getX(i), pos.getZ(i)));
      expect(maxRadius).toBeCloseTo(expectedCornerRadius, 6);
    }
  });
});
