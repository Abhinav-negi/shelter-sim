// apps/web/components/house/geometry.ts
//
// T-46. Pure, DOM-free geometry: turns `store.request.building` (CONTRACTS.md
// §7.5's `Building`/`Surface`) into a 2.5D isometric quad per `Surface`. No
// WebGL/Three.js -- hand-authored SVG paths only (T-46's own prompt).
//
// PARAMETRIC BY CONSTRUCTION: `Building` carries no `length`/`width`/`height`/
// `roofPitch` fields on disk (CONTRACTS.md §7.5 is authoritative over the
// task prompt's wording) -- only `floorArea`, `volume` and the `Surface`
// list. Every dimension below is *derived* from those, so resizing the
// building elsewhere (changing a wall's `area`, or `floorArea`/`volume`)
// changes this drawing with no extra field required. That derivation is
// exactly what "the drawing is the model" (T-46's why) means in code.

import type { Building, Surface } from '@shelter/engine';

const DEG = Math.PI / 180;

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export interface Point2 {
  x: number;
  y: number;
}

export interface HouseGeometry {
  /** Extent along the east-west axis, m -- the south/north walls' own length. */
  widthEW: number;
  /** Extent along the north-south axis, m -- the east/west walls' own length. */
  depthNS: number;
  /** Wall height, m. */
  height: number;
}

export interface SurfaceQuad {
  id: string;
  kind: Surface['type'];
  /** SVG <path> `d` attribute, a closed quad in isometric screen space. */
  d: string;
}

function isWall(s: Surface): boolean {
  return s.type === 'wall';
}

/** CONTRACTS.md §7.5: "azimuth: deg from south... -90 = East, +90 = West." A
 * wall at azimuth 0 or 180 faces south/north and runs along the east-west
 * axis; anything else (notably +-90) runs along the north-south axis. */
function isSouthNorthFacing(azimuthDeg: number): boolean {
  const a = ((azimuthDeg % 360) + 360) % 360;
  const distTo0 = Math.min(a, 360 - a);
  const distTo180 = Math.abs(a - 180);
  return Math.min(distTo0, distTo180) < 45;
}

function wallLength(s: Surface, height: number): number {
  return s.area / height;
}

function average(values: number[]): number {
  return values.reduce((a, b) => a + b, 0) / values.length;
}

/** Wall height from `volume / floorArea` -- both are mandatory `Building`
 * fields, so this works even for a building whose wall list is unusual,
 * unlike deriving height from any one wall's own area. */
export function deriveHeight(building: Building): number {
  return building.volume / building.floorArea;
}

/**
 * ponytail: assumes a rectangular-box footprint (exactly what every bundled
 * preset is, `packages/data/src/presets.ts`'s own comment: "All six houses
 * share one simple box geometry"). A non-rectangular footprint (an L-shaped
 * shelter, say) would need a real polygon reconstruction from the wall list;
 * none exists on disk today. Upgrade path: replace this with a footprint
 * solver once a non-box preset exists.
 */
export function deriveGeometry(building: Building): HouseGeometry {
  const height = deriveHeight(building);
  const walls = building.surfaces.filter(isWall);
  const snWalls = walls.filter((w) => isSouthNorthFacing(w.azimuth));
  const ewWalls = walls.filter((w) => !isSouthNorthFacing(w.azimuth));
  const fallback = Math.sqrt(building.floorArea); // square-footprint fallback when a wall is missing

  const widthEW =
    snWalls.length > 0 ? average(snWalls.map((w) => wallLength(w, height))) : fallback;
  const depthNS =
    ewWalls.length > 0 ? average(ewWalls.map((w) => wallLength(w, height))) : fallback;

  return { widthEW, depthNS, height };
}

/** Outward unit normal and one in-plane tangent for a vertical wall at this
 * azimuth. Derived directly from CONTRACTS.md §7.5's azimuth convention
 * (south=0 -> normal (0,-1,0); -90=East -> normal (1,0,0); +90=West ->
 * normal (-1,0,0); 180=North -> normal (0,1,0)). */
function wallAxes(azimuthDeg: number): { normal: Vec3; tangent: Vec3 } {
  const a = azimuthDeg * DEG;
  const nx = -Math.sin(a);
  const ny = -Math.cos(a);
  return { normal: { x: nx, y: ny, z: 0 }, tangent: { x: -ny, y: nx, z: 0 } };
}

// Standard 2:1 "isometric" screen projection (game-dev convention): rotate
// the plan 45 degrees, then flatten by sin(30deg) vertically. `z` (up) maps
// straight onto screen-Y so height reads as height.
const COS30 = Math.cos(30 * DEG);
const SIN30 = Math.sin(30 * DEG);

export function project(p: Vec3): Point2 {
  return { x: (p.x - p.y) * COS30, y: (p.x + p.y) * SIN30 - p.z };
}

function polygonPath(points: Vec3[]): string {
  return (
    points
      .map(project)
      .map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(4)},${p.y.toFixed(4)}`)
      .join(' ') + ' Z'
  );
}

function wallQuad(s: Surface, geom: HouseGeometry): SurfaceQuad {
  const { widthEW, depthNS, height } = geom;
  const len = wallLength(s, height);
  const { normal, tangent } = wallAxes(s.azimuth);
  const halfExtent = Math.abs(normal.x) * (widthEW / 2) + Math.abs(normal.y) * (depthNS / 2);
  const cx = normal.x * halfExtent;
  const cy = normal.y * halfExtent;
  const p1: Vec3 = { x: cx - (tangent.x * len) / 2, y: cy - (tangent.y * len) / 2, z: 0 };
  const p2: Vec3 = { x: cx + (tangent.x * len) / 2, y: cy + (tangent.y * len) / 2, z: 0 };
  const p3: Vec3 = { x: p2.x, y: p2.y, z: height };
  const p4: Vec3 = { x: p1.x, y: p1.y, z: height };
  return { id: s.id, kind: 'wall', d: polygonPath([p1, p2, p3, p4]) };
}

/**
 * ponytail: a single `roof` Surface renders as one plane -- flat when
 * `tilt` is 0 (every bundled preset today), tilted into a mono-pitch/lean-to
 * when `tilt` > 0 (the north edge rises by `depthNS * tan(tilt)`). A true
 * gable needs two `roof` Surfaces (e.g. `roofSouth`/`roofNorth`), which
 * would each get their own quad through this same function -- none exist on
 * disk today. Upgrade path: split the roof into two Surfaces when one is
 * added, no change needed here beyond that.
 */
function roofQuad(s: Surface, geom: HouseGeometry): SurfaceQuad {
  const { widthEW, depthNS, height } = geom;
  const rise = depthNS * Math.tan(s.tilt * DEG);
  const p1: Vec3 = { x: -widthEW / 2, y: -depthNS / 2, z: height };
  const p2: Vec3 = { x: widthEW / 2, y: -depthNS / 2, z: height };
  const p3: Vec3 = { x: widthEW / 2, y: depthNS / 2, z: height + rise };
  const p4: Vec3 = { x: -widthEW / 2, y: depthNS / 2, z: height + rise };
  return { id: s.id, kind: 'roof', d: polygonPath([p1, p2, p3, p4]) };
}

/** The floor is boundary:'ground' and sits under the box, invisible from
 * outside in a plain isometric view. Drawn as a slightly larger "plinth"
 * plate at ground level so a visible rim survives around the walls' base --
 * clickable and colour-filled like any other surface, per acceptance test 1
 * ("every surface... is drawn and individually clickable"). */
const FLOOR_MARGIN = 1.15;

function floorQuad(s: Surface, geom: HouseGeometry): SurfaceQuad {
  const { widthEW, depthNS } = geom;
  const hw = (widthEW / 2) * FLOOR_MARGIN;
  const hd = (depthNS / 2) * FLOOR_MARGIN;
  const p1: Vec3 = { x: -hw, y: -hd, z: 0 };
  const p2: Vec3 = { x: hw, y: -hd, z: 0 };
  const p3: Vec3 = { x: hw, y: hd, z: 0 };
  const p4: Vec3 = { x: -hw, y: hd, z: 0 };
  return { id: s.id, kind: 'floor', d: polygonPath([p1, p2, p3, p4]) };
}

/** Every `Surface` in `building.surfaces` becomes exactly one quad, in a
 * back-to-front paint order (floor, then walls ordered roughly back-to-front,
 * then roof last) so the drawing reads as a solid box rather than a jumble. */
export function surfaceQuads(building: Building): SurfaceQuad[] {
  const geom = deriveGeometry(building);
  const floors = building.surfaces.filter((s) => s.type === 'floor').map((s) => floorQuad(s, geom));
  const walls = building.surfaces
    .filter(isWall)
    .map((s) => wallQuad(s, geom))
    .sort((a, b) => {
      // Paint back walls (smaller screen-Y at their base) before front ones.
      const az = (id: string) => building.surfaces.find((s) => s.id === id)!.azimuth;
      return az(a.id) - az(b.id);
    });
  const roofs = building.surfaces.filter((s) => s.type === 'roof').map((s) => roofQuad(s, geom));
  return [...floors, ...walls, ...roofs];
}

/** Screen-space bounding box of the whole drawing, for the SVG `viewBox`
 * (acceptance test 7: no fixed pixel width/height, `viewBox` only). */
export function boundingBox(building: Building): {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
} {
  const { widthEW, depthNS, height } = deriveGeometry(building);
  const hw = (widthEW / 2) * FLOOR_MARGIN;
  const hd = (depthNS / 2) * FLOOR_MARGIN;
  const corners: Vec3[] = [];
  for (const sx of [-hw, hw]) {
    for (const sy of [-hd, hd]) {
      for (const sz of [0, height]) corners.push({ x: sx, y: sy, z: sz });
    }
  }
  const projected = corners.map(project);
  return {
    minX: Math.min(...projected.map((p) => p.x)),
    maxX: Math.max(...projected.map((p) => p.x)),
    minY: Math.min(...projected.map((p) => p.y)),
    maxY: Math.max(...projected.map((p) => p.y)),
  };
}
