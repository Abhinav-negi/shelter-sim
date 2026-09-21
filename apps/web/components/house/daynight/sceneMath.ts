// apps/web/components/house/daynight/sceneMath.ts
//
// T-53. Pure, DOM-free maths for the day/night animation layer. The sun's
// position ALWAYS comes from `sunPosition()` in `@shelter/engine` -- imported
// at the call site, never reimplemented here (this task's entire honesty
// claim; LOG.md rule 11: every physics function names its source). This file
// contributes NO solar trigonometry of its own -- the `Math.sin`/`Math.cos`
// calls below are for (a) turning an ALREADY-COMPUTED compass bearing
// (`sun.azimuth`) into this component's own isometric SCREEN geometry, the
// same job `geometry.ts`'s own (unexported) `wallAxes` does for a wall's
// azimuth, and (b) decorative star placement. Neither computes where the sun
// is. See ACCEPTANCE TEST 2's grep check, which this file is written to pass.
//
// Compass-to-model-space convention -- identical to `geometry.ts`'s
// `wallAxes` and CONTRACTS.md §7.5 (`Surface.azimuth`: "deg from south...
// -90 = East, +90 = West"). `solar/geometry.ts`'s own header states the SAME
// convention for `SunPosition.azimuth` ("measured FROM SOUTH, negative =
// East, positive = West") -- one convention, two consumers, no re-derivation:
//   compassDir(azimuthDeg) = (-sin(az), -cos(az))   -- unit vector pointing
//   FROM the building TOWARD that compass bearing (south=0 -> (0,-1)).
//
// ⚠ FIELD-NAME NOTE (same resolution `solar/shading.ts`, T-18, already
// documents for the identical mismatch): this task's own PROMPT was written
// against `sun.altitudeDeg` / `sun.azimuthDeg` / `sun.isUp`. The `SunPosition`
// actually on disk (`solar/geometry.ts`, done, not edited by this task) uses
// `altitude` / `azimuth` (already degrees) and has NO `isUp` field. Per
// LOG.md's own rule ("this section wins... it describes the code that is
// actually on disk"), disk wins: this file reads `sun.altitude`/`sun.azimuth`
// and treats "the sun is up" as `sun.altitude > 0` -- exactly what
// `solar/shading.ts` already does for the same reason.

import type { SunPosition } from '@shelter/engine';
import { project, type HouseGeometry, type Point2, type Vec3 } from '../geometry';

const DEG = Math.PI / 180;

export function isSunUp(sun: SunPosition): boolean {
  return sun.altitude > 0;
}

function compassDir(azimuthDeg: number): { x: number; y: number } {
  const a = azimuthDeg * DEG;
  return { x: -Math.sin(a), y: -Math.cos(a) };
}

// ============================== SUN DISC ==============================

/** How far (house-model metres) the sun disc is placed from the building
 * centre -- purely for a legible on-screen arc; has no physical meaning (the
 * real sun is not six house-heights away). LOG.md rule 14: named,
 * commented calibration knob. */
const SUN_DISTANCE_FACTOR = 6;

export interface SunScreenPosition {
  point: Point2;
  isUp: boolean;
}

/** Projects the computed `sun.altitude`/`sun.azimuth` onto the SAME
 * isometric screen space `geometry.ts`'s `project()` already defines for the
 * house itself, so the sun's on-screen arc and the house silhouette share
 * one coordinate system. */
export function sunScreenPosition(sun: SunPosition, geom: HouseGeometry): SunScreenPosition {
  const dir = compassDir(sun.azimuth);
  const altRad = sun.altitude * DEG;
  const radius = SUN_DISTANCE_FACTOR * Math.max(geom.widthEW, geom.depthNS, geom.height);
  const p: Vec3 = {
    x: dir.x * Math.cos(altRad) * radius,
    y: dir.y * Math.cos(altRad) * radius,
    z: Math.sin(altRad) * radius + geom.height / 2,
  };
  return { point: project(p), isUp: isSunUp(sun) };
}

// ============================== SHADOW ==============================

/** Below this altitude, `1/tan(altitude)` blows past anything worth
 * rendering. A RENDERING-ONLY floor -- it does not touch the `sun.altitude`
 * value reported anywhere else (the text readout, the acceptance-test
 * numbers) and only engages at the last couple of degrees before sunrise/
 * sunset. LOG.md rule 14: named calibration knob, not a physics change. */
const MIN_SHADOW_ALTITUDE_DEG = 3;

export interface ShadowResult {
  /** metres, the antisolar extrusion distance. 0 when the sun is not up. */
  lengthM: number;
  /** SVG path `d`. Empty string when the sun is not up (no shadow at night). */
  d: string;
}

function toPath(points: Point2[]): string {
  return (
    points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(4)},${p.y.toFixed(4)}`).join(' ') +
    ' Z'
  );
}

/** Convex hull, monotone chain (Andrew's algorithm). No dependency --
 * `computeShadow`'s footprint-plus-shifted-footprint point set below is
 * exactly the case this exists for. */
function convexHull(pts: Array<[number, number]>): Array<[number, number]> {
  const sorted = [...pts].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cross = (o: [number, number], a: [number, number], b: [number, number]) =>
    (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lower: Array<[number, number]> = [];
  for (const p of sorted) {
    while (lower.length >= 2 && cross(lower[lower.length - 2]!, lower[lower.length - 1]!, p) <= 0)
      lower.pop();
    lower.push(p);
  }
  const upper: Array<[number, number]> = [];
  for (let i = sorted.length - 1; i >= 0; i--) {
    const p = sorted[i]!;
    while (upper.length >= 2 && cross(upper[upper.length - 2]!, upper[upper.length - 1]!, p) <= 0)
      upper.pop();
    upper.push(p);
  }
  lower.pop();
  upper.pop();
  return [...lower, ...upper];
}

/**
 * Shadow of the house's box footprint on flat ground. ACCEPTANCE TEST 4:
 * direction opposite the sun's azimuth, length growing as altitude falls.
 * Standard flat-ground box-shadow construction: extrude each footprint
 * corner along the antisolar horizontal vector by `height / tan(altitude)`
 * (the distance a point at eave height casts to the ground along the sun's
 * ray), then take the convex hull of the footprint and its extruded copy --
 * this always yields a correctly-oriented, correctly-sized shadow polygon
 * for a box under a directional light.
 *
 * ponytail: extrudes the derived box FOOTPRINT (`deriveGeometry`'s
 * `widthEW`/`depthNS`), not the roof/overhang silhouette -- a Ladakh flat or
 * mono-pitch roof's own shadow error from this is small next to the wall
 * shadow that dominates at the low winter sun angles this tool cares about.
 * Upgrade path: extrude `surfaceQuads()`'s own vertices instead of the
 * derived box corners, if a non-box footprint or a true gable roof (see
 * `geometry.ts`'s own `ponytail:` notes) is ever added.
 */
export function computeShadow(sun: SunPosition, geom: HouseGeometry): ShadowResult {
  if (!isSunUp(sun)) return { lengthM: 0, d: '' };
  const altForLength = Math.max(sun.altitude, MIN_SHADOW_ALTITUDE_DEG);
  const lengthM = geom.height / Math.tan(altForLength * DEG);
  const dir = compassDir(sun.azimuth);
  const antisolar = { x: -dir.x, y: -dir.y };
  const shiftX = antisolar.x * lengthM;
  const shiftY = antisolar.y * lengthM;

  const hw = geom.widthEW / 2;
  const hd = geom.depthNS / 2;
  const footprint: Array<[number, number]> = [
    [-hw, -hd],
    [hw, -hd],
    [hw, hd],
    [-hw, hd],
  ];
  const shifted = footprint.map(([x, y]): [number, number] => [x + shiftX, y + shiftY]);
  const hull = convexHull([...footprint, ...shifted]);
  const points3d: Vec3[] = hull.map(([x, y]) => ({ x, y, z: 0 }));
  return { lengthM, d: toPath(points3d.map(project)) };
}

// ============================== SKY ==============================

function lerp3(
  a: [number, number, number],
  b: [number, number, number],
  t: number,
): [number, number, number] {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

function rgbStr(c: [number, number, number]): string {
  return `rgb(${Math.round(c[0])}, ${Math.round(c[1])}, ${Math.round(c[2])})`;
}

const NIGHT: [number, number, number] = [6, 10, 26];
const DUSK: [number, number, number] = [255, 148, 97];
const DAY: [number, number, number] = [123, 191, 255];

/** Sky colour as a function of solar altitude only -- night below -12deg,
 * a dawn/dusk band from -12 to 0, full day by +35. Cosmetic only: the
 * night/day RENDERING split (stars vs sun) is governed by `isSunUp`
 * (altitude > 0), not by this gradient. */
export function skyColor(altitudeDeg: number): string {
  const t1 = Math.max(0, Math.min(1, (altitudeDeg + 12) / 12));
  const t2 = Math.max(0, Math.min(1, altitudeDeg / 35));
  return rgbStr(lerp3(lerp3(NIGHT, DUSK, t1), DAY, t2));
}

export function skyGradientCss(altitudeDeg: number): string {
  const top = skyColor(Math.min(90, altitudeDeg + 15));
  const bottom = skyColor(altitudeDeg);
  return `linear-gradient(to bottom, ${top}, ${bottom})`;
}

// ============================== STARS ==============================

/** Deterministic pseudo-random star field (a tiny LCG, no `Math.random` --
 * keeps the layout stable across renders/tests). Purely decorative; not part
 * of any acceptance test's numeric claim. */
export function starPositions(count: number): Array<{ x: number; y: number; r: number }> {
  let seed = 1337;
  function next(): number {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return seed / 0x7fffffff;
  }
  const stars: Array<{ x: number; y: number; r: number }> = [];
  for (let i = 0; i < count; i++) {
    stars.push({ x: next(), y: next() * 0.6, r: 0.4 + next() * 0.8 });
  }
  return stars;
}
