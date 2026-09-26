// The building itself: walls (each wall is ONE extruded solid — a rectangle
// `THREE.Shape` with the window opening cut out as a `Path` hole, extruded
// by the wall thickness, then mitred at each end — see `mitreWallEnds`'s
// comment — so corners meet as a true picture-frame mitre instead of a butt
// joint; there is no internal coplanar face anywhere, inside a wall or
// between two neighbouring walls, to seam or shadow-acne — plus a separate
// glass pane sitting in each window opening), a flat roof slab and a floor
// slab. Pure render component: all the numbers come from `SceneGeometry`
// (geometry.ts).

import { Edges, Line } from '@react-three/drei';
import { useEffect, useMemo } from 'react';
import { type BufferGeometry, DoubleSide, ExtrudeGeometry, Matrix4, Path, Quaternion, Shape, Vector3 } from 'three';
import { mergeGeometries, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import {
  azimuthDirection,
  CYLINDER_SECTORS,
  DOME_SECTORS,
  type DomeFacet,
  type Orientation,
  type SceneGeometry,
  type WallGeometry,
  type WindowRect,
} from './geometry';

const DEG2RAD = Math.PI / 180;

// A fixed, theme-independent material palette — a real shelter's plaster and
// timber don't change colour when someone toggles the app's UI theme. Only
// the backdrop (background, ground, compass — ShelterViewer.tsx/Compass.tsx)
// follows the design tokens so it harmonises with light/dark chrome; the
// model itself always renders as this restrained, neutral daylight palette,
// so it stays equally legible (and equally true to the physical design) in
// either theme.
const WALL_COLOR = '#d9d5c9';
const ROOF_COLOR = '#a9a596';
const FLOOR_COLOR = '#bdb8a9';
const EDGE_COLOR = '#3a362c';
const GLASS_COLOR = '#a9c3d6';

/** Box walls meet at 90° corners — see `mitreWallEnds`'s comment. */
const BOX_MITRE_ANGLE_DEG = 45;
/** G3: generalises the box's 45° (=180/4) to a 12-gon ring (cylinder walls,
 *  and — via the same shared constant — the dome's sector half-angle). */
const RING_HALF_ANGLE_DEG = 180 / CYLINDER_SECTORS;

/** The wall's outline as a `Shape` (u = across the facade, v = up the wall),
 *  with the window opening (if any) cut out as a `Path` hole. `half` is
 *  floored to a hair above 0 so a degenerate (near-zero) facadeWidth still
 *  produces valid, if sliver, geometry instead of a zero-area shape. This is
 *  the wall's *exterior* outline — `buildWallGeometry` below mitres the
 *  extruded solid's thickness-direction ends so the interior face is
 *  shorter; the 2D shape here (and the window hole) is unaffected by that,
 *  it only describes the exterior-face rectangle that gets extruded. */
function wallShape(facadeWidth: number, heightM: number, win: WindowRect | null): Shape {
  const half = Math.max(1e-4, facadeWidth) / 2;
  const shape = new Shape();
  shape.moveTo(-half, 0);
  shape.lineTo(half, 0);
  shape.lineTo(half, heightM);
  shape.lineTo(-half, heightM);
  shape.closePath();

  if (win) {
    const halfWin = win.width / 2;
    const top = win.sill + win.height;
    const hole = new Path();
    hole.moveTo(-halfWin, win.sill);
    hole.lineTo(halfWin, win.sill);
    hole.lineTo(halfWin, top);
    hole.lineTo(-halfWin, top);
    hole.closePath();
    shape.holes.push(hole);
  }
  return shape;
}

/** Which world axis a facade runs along, and which side of the footprint it
 *  sits on (+/-). See geometry.ts's header for the world-frame convention. */
const WALL_SIDE: Record<Orientation, { runAxis: 'x' | 'z'; sign: 1 | -1 }> = {
  S: { runAxis: 'x', sign: 1 },
  N: { runAxis: 'x', sign: -1 },
  E: { runAxis: 'z', sign: 1 },
  W: { runAxis: 'z', sign: -1 },
};

/** The rectangle outline (4 edges, as [u,v] point pairs) of the wall's own
 *  silhouette, plus the window opening's outline if there is one. These are
 *  the only lines a real building corner/reveal actually has — NOT drawn
 *  from each frame-piece box's own geometry (drei's <Edges> on every pier/
 *  sill/lintel box was picking up the seams *between* those pieces too,
 *  reading as construction panel lines, plus a stray inset line near each
 *  building corner where two perpendicular wall boxes' side faces meet).
 *  u = across the facade, v = up the wall. */
type Point = [number, number];
type Segment = [Point, Point];

function outlineSegments(facadeWidth: number, heightM: number, win: WindowRect | null): Segment[] {
  const rect = (u0: number, u1: number, v0: number, v1: number): Segment[] => [
    [[u0, v0], [u1, v0]],
    [[u1, v0], [u1, v1]],
    [[u1, v1], [u0, v1]],
    [[u0, v1], [u0, v0]],
  ];
  const half = facadeWidth / 2;
  const segments = rect(-half, half, 0, heightM);
  if (win) {
    segments.push(...rect(-win.width / 2, win.width / 2, win.sill, win.sill + win.height));
  }
  return segments;
}

/** Flush against the wall's exterior face, nudged out by a hair to avoid
 *  z-fighting with the frame boxes' own faces. */
const OUTLINE_EPS = 0.003;

function WallOutline({
  geometry,
  wall,
  runAxis,
  outerFace,
}: {
  geometry: SceneGeometry;
  wall: WallGeometry;
  runAxis: 'x' | 'z';
  outerFace: number;
}) {
  // wall.facadeWidth is always the full outer (corner-to-corner) length now
  // (mitred corners, geometry.ts) — every wall's exterior silhouette really
  // does span it, so the outline can just use it directly.
  const segments = useMemo(
    () => outlineSegments(wall.facadeWidth, geometry.heightM, wall.window),
    [wall.facadeWidth, geometry.heightM, wall.window],
  );

  const points = useMemo(() => {
    const depth = outerFace + Math.sign(outerFace || 1) * OUTLINE_EPS;
    const toWorld = (u: number, v: number): [number, number, number] =>
      runAxis === 'x' ? [u, v, depth] : [depth, v, u];
    return segments.flatMap(([[u0, v0], [u1, v1]]) => [toWorld(u0, v0), toWorld(u1, v1)]);
  }, [segments, runAxis, outerFace]);

  return <Line segments points={points} color={EDGE_COLOR} transparent opacity={0.4} lineWidth={1} />;
}

/** Shifts an `ExtrudeGeometry`'s two thickness-direction end faces (the
 *  extrusion's side faces at the shape's own `u = ±half` boundary — i.e.
 *  each wall's short ends, where it meets its neighbour at a building
 *  corner) into a 45° mitre cut, in-place, on the already-world-positioned
 *  geometry: a vertex at world depth-coordinate `d` away from the exterior
 *  face gets pulled inward (toward u=0) by exactly `d`. At the exterior
 *  face (`d=0`) nothing moves — the facade stays the true, full
 *  corner-to-corner length. At the interior face (`d=depth`, i.e.
 *  `wallThicknessM` in) the end pulls in by the full wall thickness, same
 *  as the neighbour's own mitred end pulls in from the other direction —
 *  worked out algebraically (see F2b Evidence) to land on the *exact same*
 *  3D plane as the neighbouring wall's own mitred end, so the two walls'
 *  cut faces coincide exactly, like a picture-frame corner, instead of
 *  abutting as two separate coplanar polygons (the earlier butt-joint
 *  scheme's unfixable rendering crack — see F2b Evidence for why nudging
 *  that scheme with epsilons only hid it under one capture setting).
 *  `depthAxis`/`uAxis` say which world axis is which for this wall;
 *  `outerFace`/`sign` (already computed by the caller) locate the exterior
 *  plane and which way is "outward". Window-hole vertices are untouched —
 *  their u is always well inside `±half`.
 *
 *  `mitreAngleDeg` (G3, V2.md §G3: "mitreWallEnds generalised from 45° to
 *  180°/N so facets close with no seams") is the mitre bisector's own
 *  angle: for a box (N=4 walls meeting at 90° corners) that's 45°, and
 *  `d*tan(45°)` is (up to float noise) exactly `d`, the box's original
 *  pull-in — so passing 45 here reproduces the pre-G3 box math unchanged.
 *  For a regular N-gon ring (cylinder, N=12) adjacent walls meet at an
 *  exterior turn of `360/N`, whose bisector is `180/N` — the general mitre
 *  pull-in is `d*tan(180/N)`. */
function mitreWallEnds(
  geom: BufferGeometry,
  half: number,
  outerFace: number,
  sign: 1 | -1,
  runAxis: 'x' | 'z',
  mitreAngleDeg: number,
): void {
  const pos = geom.attributes.position!; // ExtrudeGeometry always has a position attribute
  const EPS = 1e-4; // far below any real dimension; just tight enough to hit exactly the u=±half vertices
  const tanMitre = Math.tan(mitreAngleDeg * DEG2RAD);
  const getU = runAxis === 'x' ? (i: number) => pos.getX(i) : (i: number) => pos.getZ(i);
  const setU = runAxis === 'x' ? (i: number, v: number) => pos.setX(i, v) : (i: number, v: number) => pos.setZ(i, v);
  const getDepthCoord = runAxis === 'x' ? (i: number) => pos.getZ(i) : (i: number) => pos.getX(i);
  for (let i = 0; i < pos.count; i++) {
    const u = getU(i);
    const d = sign * (outerFace - getDepthCoord(i)); // 0 at the exterior face, +wallThicknessM at the interior face
    if (Math.abs(u - half) < EPS) setU(i, half - d * tanMitre);
    else if (Math.abs(u + half) < EPS) setU(i, -(half - d * tanMitre));
  }
  pos.needsUpdate = true;
  geom.computeVertexNormals(); // non-indexed (ExtrudeGeometry) -> flat per-face normals, correct for the new mitre faces
}

/** Builds one wall's solid as a positioned `ExtrudeGeometry`: a rectangle
 *  `Shape` (u,v = across/up the facade) with the window cut out as a `Path`
 *  hole, extruded by the wall thickness, then mitred (`mitreWallEnds`) at
 *  both ends so the exterior face is the true corner-to-corner length and
 *  the interior face is inset by `wallThicknessM` — a single, continuous
 *  exterior polygon per facade with no neighbour's end-grain ever exposed
 *  on it (F2b's mitre fix; see `mitreWallEnds`'s comment for why).
 *
 *  `ExtrudeGeometry` extrudes the shape's local (x,y) along local +z from 0
 *  to `depth`; local (x,y) are exactly (u,v) here, so no transform is
 *  needed for S/N walls (runAxis 'x': local x/y/z = world x/y/z already) —
 *  just translate z so the thickness band lands on
 *  [centerDepth-depth/2, centerDepth+depth/2]. E/W walls (runAxis 'z') need
 *  the extrude/thickness axis on world x and u on world z: `rotateY(-90deg)`
 *  (three's Ry(theta): x'=x·cosθ+z·sinθ, z'=-x·sinθ+z·cosθ, θ=-90°) sends
 *  local z (extrude, 0..depth) to world x'=-z and local x (u) to world
 *  z'=x=u — u lands on world z unflipped via a genuine rotation, so
 *  winding/normals stay correct (no mirror). Since world x'=-z runs
 *  0..-depth, the center offset flips sign to `centerDepth + depth/2` (vs.
 *  `- depth/2` for S/N).
 *
 *  Exported for `Building.test.ts` — the mitre construction is worth
 *  testing directly against real vertex data, not just eyeballed. */
export function buildWallGeometry(geometry: SceneGeometry, wall: WallGeometry): BufferGeometry {
  const { runAxis, sign } = WALL_SIDE[wall.orientation];
  const depthHalfExtent = runAxis === 'x' ? geometry.widthM / 2 : geometry.lengthM / 2;
  const outerFace = sign * depthHalfExtent;
  const centerDepth = outerFace - (sign * geometry.wallThicknessM) / 2;

  const half = Math.max(1e-4, wall.facadeWidth) / 2;
  const shape = wallShape(wall.facadeWidth, geometry.heightM, wall.window);
  const depth = geometry.wallThicknessM;
  const geom = new ExtrudeGeometry(shape, { depth, bevelEnabled: false, curveSegments: 1 });
  if (runAxis === 'x') {
    geom.translate(0, 0, centerDepth - depth / 2);
  } else {
    geom.rotateY(-Math.PI / 2);
    geom.translate(centerDepth + depth / 2, 0, 0);
  }
  mitreWallEnds(geom, half, outerFace, sign, runAxis, BOX_MITRE_ANGLE_DEG);
  return geom;
}

/** All 4 walls' solids as ONE merged, vertex-welded mesh. With the mitred
 *  corners above, each wall's own mitred end face lands exactly on the same
 *  3D plane as its neighbour's — worked out algebraically and confirmed by
 *  a dedicated test (`Building.test.ts`) — so `mergeVertices` welds those
 *  coincident corner vertices into a single continuous solid with no
 *  internal seam anywhere, exterior or interior. Kept as one mesh (not 4)
 *  regardless: it's still the more correct "one solid" reading of F2b's
 *  goal, and gives a single shadow-caster for the whole envelope rather
 *  than four independently shadow-mapped ones. */
function WallsSolid({ geometry }: { geometry: SceneGeometry }) {
  const merged = useMemo(() => {
    const parts = geometry.walls.map((wall) => buildWallGeometry(geometry, wall));
    const combined = mergeGeometries(parts, false);
    parts.forEach((g) => g.dispose());
    const welded = mergeVertices(combined);
    combined.dispose();
    return welded;
  }, [geometry]);

  useEffect(() => () => merged.dispose(), [merged]);

  return (
    <mesh geometry={merged} castShadow receiveShadow>
      <meshStandardMaterial color={WALL_COLOR} roughness={0.92} metalness={0} />
    </mesh>
  );
}

function Wall({ geometry, wall }: { geometry: SceneGeometry; wall: WallGeometry }) {
  const { runAxis, sign } = WALL_SIDE[wall.orientation];
  const depthHalfExtent = runAxis === 'x' ? geometry.widthM / 2 : geometry.lengthM / 2;
  const outerFace = sign * depthHalfExtent;
  const centerDepth = outerFace - (sign * geometry.wallThicknessM) / 2;

  return (
    <group>
      <WallOutline geometry={geometry} wall={wall} runAxis={runAxis} outerFace={outerFace} />
      {wall.window && (
        <mesh
          position={
            runAxis === 'x'
              ? [0, wall.window.sill + wall.window.height / 2, centerDepth]
              : [centerDepth, wall.window.sill + wall.window.height / 2, 0]
          }
        >
          <boxGeometry
            args={
              runAxis === 'x'
                ? [wall.window.width, wall.window.height, Math.max(0.02, geometry.wallThicknessM * 0.3)]
                : [Math.max(0.02, geometry.wallThicknessM * 0.3), wall.window.height, wall.window.width]
            }
          />
          <meshPhysicalMaterial
            color={GLASS_COLOR}
            transparent
            opacity={0.35}
            roughness={0.05}
            metalness={0}
            reflectivity={0.4}
          />
        </mesh>
      )}
    </group>
  );
}

/** G3 (V2.md §G3, API.md §3c): the intermediate floor between two storeys —
 *  a single-zone approximation on the server (one `rock` StorageElement,
 *  not a real second floor); here just a thin visual slab at `heightM`
 *  (the first storey's own ceiling / second storey's own floor). Thickness
 *  mirrors `SLAB_THICKNESS_M` (assemble.ts) — a visual echo of that
 *  constant, not a load-bearing number in the viewer. `radiusM` picks a
 *  circular slab (cylinder) over the default box. */
const SLAB_THICKNESS_M = 0.15;

function IntermediateSlab({ geometry, radiusM }: { geometry: SceneGeometry; radiusM?: number }) {
  return (
    <mesh position={[0, geometry.heightM, 0]} receiveShadow castShadow>
      {radiusM !== undefined ? (
        <cylinderGeometry args={[radiusM, radiusM, SLAB_THICKNESS_M, CYLINDER_SECTORS]} />
      ) : (
        <boxGeometry args={[geometry.lengthM, SLAB_THICKNESS_M, geometry.widthM]} />
      )}
      <meshStandardMaterial color={FLOOR_COLOR} roughness={0.95} />
    </mesh>
  );
}

/** Box: unchanged for `storeys:1` (a single `<group position-y={0}>` wrapper
 *  around the exact pre-G3 walls/floor/roof adds nothing visually or
 *  numerically). `storeys:2` stacks a second, identical wall ring at
 *  `heightM` (condition 2: "stacked walls ... one window row per storey")
 *  and inserts the intermediate slab between them; the roof moves up to
 *  `buildingHeightM` (`heightM*storeys`, same value as `heightM` at
 *  storeys:1). */
function BoxBuilding({ geometry }: { geometry: SceneGeometry }) {
  return (
    <group>
      {Array.from({ length: geometry.storeys }, (_, storey) => (
        <group key={storey} position={[0, storey * geometry.heightM, 0]}>
          <WallsSolid geometry={geometry} />
          {geometry.walls.map((wall) => (
            <Wall key={wall.orientation} geometry={geometry} wall={wall} />
          ))}
        </group>
      ))}

      {geometry.storeys > 1 && <IntermediateSlab geometry={geometry} />}

      {/* Floor slab: top face at y=0, the walls' base. */}
      <mesh position={[0, -geometry.floorThicknessM / 2, 0]} receiveShadow>
        <boxGeometry args={[geometry.lengthM, geometry.floorThicknessM, geometry.widthM]} />
        <meshStandardMaterial color={FLOOR_COLOR} roughness={0.95} />
      </mesh>

      {/* Flat roof slab, flush with the wall footprint — no eaves, no roof type
          control (F2.md Rules: the model reflects only what the physics
          models, and the engine only knows a flat roof). */}
      <mesh
        position={[0, geometry.buildingHeightM + geometry.roofThicknessM / 2, 0]}
        castShadow
        receiveShadow
      >
        <boxGeometry args={[geometry.lengthM, geometry.roofThicknessM, geometry.widthM]} />
        <meshStandardMaterial color={ROOF_COLOR} roughness={0.85} />
        <Edges threshold={20} color={EDGE_COLOR} opacity={0.35} transparent linewidth={1} />
      </mesh>
    </group>
  );
}

// ============================== CYLINDER (G3) ==============================
// A 12-facet ring: same wall-panel construction as the box (`wallShape` +
// `mitreWallEnds`), just placed by azimuth around a circle instead of the
// box's 4 fixed orientations. The mitre step runs in the RAW, pre-placement
// local frame (u=local x, depth=local z, exactly the box's own S/N case) —
// rotation/translation happen afterwards, so `mitreWallEnds` needs no
// azimuth-aware generalisation of its own; only the placement differs.

/** Exported for Building.test.ts — the generalised (180°/N) mitre is worth
 *  testing directly against real vertex data too, same as the box's
 *  `buildWallGeometry` (F2b). */
export function buildRingWallGeometry(geometry: SceneGeometry, wall: WallGeometry): BufferGeometry {
  const half = Math.max(1e-4, wall.facadeWidth) / 2;
  const depth = geometry.wallThicknessM;
  const shape = wallShape(wall.facadeWidth, geometry.heightM, wall.window);
  const geom = new ExtrudeGeometry(shape, { depth, bevelEnabled: false, curveSegments: 1 });
  // Raw extrude occupies local z in [0, depth]; outerFace=depth, sign=1 ->
  // exterior (z=depth) unmoved, interior (z=0) pulled in by depth*tan(15°).
  mitreWallEnds(geom, half, depth, 1, 'x', RING_HALF_ANGLE_DEG);
  const r = geometry.lengthM / 2; // diameter -> radius, API.md §3b
  geom.translate(0, 0, r - depth); // exterior face -> radius r; interior -> r-depth
  geom.rotateY(-(wall.azimuthDeg ?? 0) * DEG2RAD); // sweep to this facet's azimuth (geometry.ts header's sign convention)
  return geom;
}

function RingWallsSolid({ geometry }: { geometry: SceneGeometry }) {
  const merged = useMemo(() => {
    const parts = geometry.walls.map((wall) => buildRingWallGeometry(geometry, wall));
    const combined = mergeGeometries(parts, false);
    parts.forEach((g) => g.dispose());
    const welded = mergeVertices(combined);
    combined.dispose();
    return welded;
  }, [geometry]);

  useEffect(() => () => merged.dispose(), [merged]);

  return (
    <mesh geometry={merged} castShadow receiveShadow>
      <meshStandardMaterial color={WALL_COLOR} roughness={0.92} metalness={0} />
    </mesh>
  );
}

/** Outline + window for one cylinder facet, in a group already
 *  positioned/rotated to that facet's azimuth (mid-thickness radius) — so
 *  the outline/window's own local coordinates are exactly the box's own
 *  (u,v) wall-local frame, just like `WallOutline`/`Wall`'s box case. */
function RingWall({ geometry, wall }: { geometry: SceneGeometry; wall: WallGeometry }) {
  const azimuthDeg = wall.azimuthDeg ?? 0;
  const r = geometry.lengthM / 2;
  const depth = geometry.wallThicknessM;
  const centerRadius = r - depth / 2;
  const dir = azimuthDirection(azimuthDeg);
  const azimuthRad = -azimuthDeg * DEG2RAD;

  const outlinePoints = useMemo(() => {
    const segments = outlineSegments(wall.facadeWidth, geometry.heightM, wall.window);
    const faceZ = depth / 2 + OUTLINE_EPS; // flush against the exterior face, nudged out (see OUTLINE_EPS)
    return segments.flatMap(([[u0, v0], [u1, v1]]): Array<[number, number, number]> => [
      [u0, v0, faceZ],
      [u1, v1, faceZ],
    ]);
  }, [wall.facadeWidth, geometry.heightM, wall.window, depth]);

  return (
    <group position={[dir.x * centerRadius, 0, dir.z * centerRadius]} rotation={[0, azimuthRad, 0]}>
      <Line segments points={outlinePoints} color={EDGE_COLOR} transparent opacity={0.4} lineWidth={1} />
      {wall.window && (
        <mesh position={[0, wall.window.sill + wall.window.height / 2, 0]}>
          <boxGeometry args={[wall.window.width, wall.window.height, Math.max(0.02, depth * 0.3)]} />
          <meshPhysicalMaterial
            color={GLASS_COLOR}
            transparent
            opacity={0.35}
            roughness={0.05}
            metalness={0}
            reflectivity={0.4}
          />
        </mesh>
      )}
    </group>
  );
}

/** Same storeys-stacking as `BoxBuilding` (a second ring at `heightM`, plus
 *  the intermediate slab), with circular floor/roof/slab primitives
 *  (three.js's built-in `cylinderGeometry`, `radialSegments=12` to match
 *  the facet count — no CSG needed for a flat-topped drum). */
function CylinderBuilding({ geometry }: { geometry: SceneGeometry }) {
  const r = geometry.lengthM / 2;
  return (
    <group>
      {Array.from({ length: geometry.storeys }, (_, storey) => (
        <group key={storey} position={[0, storey * geometry.heightM, 0]}>
          <RingWallsSolid geometry={geometry} />
          {geometry.walls.map((wall) => (
            <RingWall key={wall.azimuthDeg} geometry={geometry} wall={wall} />
          ))}
        </group>
      ))}

      {geometry.storeys > 1 && <IntermediateSlab geometry={geometry} radiusM={r} />}

      <mesh position={[0, -geometry.floorThicknessM / 2, 0]} receiveShadow>
        <cylinderGeometry args={[r, r, geometry.floorThicknessM, CYLINDER_SECTORS]} />
        <meshStandardMaterial color={FLOOR_COLOR} roughness={0.95} />
      </mesh>

      <mesh position={[0, geometry.buildingHeightM + geometry.roofThicknessM / 2, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[r, r, geometry.roofThicknessM, CYLINDER_SECTORS]} />
        <meshStandardMaterial color={ROOF_COLOR} roughness={0.85} />
        <Edges threshold={20} color={EDGE_COLOR} opacity={0.35} transparent linewidth={1} />
      </mesh>
    </group>
  );
}

// ============================== DOME (G3) ==============================
// A hemisphere as 3 stacked frustum bands (mirrors `domeGeometry`,
// assemble.ts) — each band/sector is a FLAT trapezoid, the standard "a
// regular-polygon frustum's lateral faces are planar" identity, so no CSG
// is needed: 4 corner points (two elevation rings x two sector edges) via
// `ringPoint`, then an orthonormal basis (right/up/normal) built from those
// corners places a plain rectangle-ish `Shape` (extruded by thickness) onto
// the real 3D panel. Deliberately NOT mitred between neighbours (ponytail:
// unlike the cylinder ring, adjacent sectors' EXTERIOR corners are already
// the exact same `ringPoint` by construction — only the invisible interior
// thickness corners could gap slightly; add mitring if a screenshot shows
// it).

const DOME_HALF_ANGLE_DEG = RING_HALF_ANGLE_DEG; // 180/12 — DOME_SECTORS === CYLINDER_SECTORS (both 12, contract)

function ringPoint(azimuthDeg: number, radius: number, height: number): Vector3 {
  const dir = azimuthDirection(azimuthDeg);
  return new Vector3(dir.x * radius, height, dir.z * radius);
}

interface DomeFacetFrame {
  basis: Matrix4;
  halfBottom: number;
  halfTop: number;
  slantHeight: number;
}

function domeFacetFrame(facet: DomeFacet): DomeFacetFrame {
  const bottomLeft = ringPoint(facet.azimuthDeg - DOME_HALF_ANGLE_DEG, facet.radiusLow, facet.heightLow);
  const bottomRight = ringPoint(facet.azimuthDeg + DOME_HALF_ANGLE_DEG, facet.radiusLow, facet.heightLow);
  const topLeft = ringPoint(facet.azimuthDeg - DOME_HALF_ANGLE_DEG, facet.radiusHigh, facet.heightHigh);
  const topRight = ringPoint(facet.azimuthDeg + DOME_HALF_ANGLE_DEG, facet.radiusHigh, facet.heightHigh);
  const bottomMid = bottomLeft.clone().add(bottomRight).multiplyScalar(0.5);
  const topMid = topLeft.clone().add(topRight).multiplyScalar(0.5);

  const right = bottomRight.clone().sub(bottomLeft).normalize();
  const upRaw = topMid.clone().sub(bottomMid);
  const up = upRaw.clone().sub(right.clone().multiplyScalar(right.dot(upRaw))).normalize();
  const normal = right.clone().cross(up).normalize();
  const outward = new Vector3(bottomMid.x, 0, bottomMid.z).normalize();
  if (normal.dot(outward) < 0) normal.negate();

  return {
    basis: new Matrix4().makeBasis(right, up, normal).setPosition(bottomMid),
    halfBottom: bottomRight.distanceTo(bottomLeft) / 2,
    halfTop: topRight.distanceTo(topLeft) / 2,
    slantHeight: bottomMid.distanceTo(topMid),
  };
}

/** Like `wallShape` but tapered (bottom/top half-widths can differ) — the
 *  band-2 roof cap's `halfTop` is ~0 (the dome's apex), degenerating this
 *  to a triangle, which just works. */
function domeFacetShape(halfBottom: number, halfTop: number, slantHeight: number, win: WindowRect | null): Shape {
  const hb = Math.max(1e-4, halfBottom);
  const ht = Math.max(1e-4, halfTop);
  const shape = new Shape();
  shape.moveTo(-hb, 0);
  shape.lineTo(hb, 0);
  shape.lineTo(ht, slantHeight);
  shape.lineTo(-ht, slantHeight);
  shape.closePath();

  if (win) {
    const halfWin = win.width / 2;
    const top = win.sill + win.height;
    const hole = new Path();
    hole.moveTo(-halfWin, win.sill);
    hole.lineTo(halfWin, win.sill);
    hole.lineTo(halfWin, top);
    hole.lineTo(-halfWin, top);
    hole.closePath();
    shape.holes.push(hole);
  }
  return shape;
}

function buildDomeFacetGeometry(facet: DomeFacet, thicknessM: number): BufferGeometry {
  const { basis, halfBottom, halfTop, slantHeight } = domeFacetFrame(facet);
  const shape = domeFacetShape(halfBottom, halfTop, slantHeight, facet.window);
  const geom = new ExtrudeGeometry(shape, { depth: thicknessM, bevelEnabled: false, curveSegments: 1 });
  geom.translate(0, 0, -thicknessM); // exterior face (z=0) -> the true ring points; interior insets inward
  geom.computeVertexNormals();
  geom.applyMatrix4(basis);
  return geom;
}

function DomeFacetsSolid({ geometry, kind, thicknessM }: { geometry: SceneGeometry; kind: 'wall' | 'roof'; thicknessM: number }) {
  const merged = useMemo(() => {
    const facets = geometry.domeFacets.filter((f) => f.kind === kind);
    const parts = facets.map((f) => buildDomeFacetGeometry(f, thicknessM));
    const combined = mergeGeometries(parts, false);
    parts.forEach((g) => g.dispose());
    const welded = mergeVertices(combined);
    combined.dispose();
    return welded;
  }, [geometry, kind, thicknessM]);

  useEffect(() => () => merged.dispose(), [merged]);

  const color = kind === 'wall' ? WALL_COLOR : ROOF_COLOR;
  const roughness = kind === 'wall' ? 0.92 : 0.85;
  return (
    <mesh geometry={merged} castShadow receiveShadow>
      <meshStandardMaterial color={color} roughness={roughness} metalness={0} side={DoubleSide} />
    </mesh>
  );
}

/** A dome band's window, oriented flush with its tilted facet — same basis
 *  as the facet's own solid, so a plain `boxGeometry` just needs that
 *  basis's rotation (as a quaternion) and a mid-thickness position. */
function DomeWindow({ facet, wallThicknessM }: { facet: DomeFacet; wallThicknessM: number }) {
  const frame = useMemo(() => domeFacetFrame(facet), [facet]);
  const quaternion = useMemo(() => new Quaternion().setFromRotationMatrix(frame.basis), [frame]);
  const win = facet.window;
  const position = useMemo(
    () => (win ? new Vector3(0, win.sill + win.height / 2, -wallThicknessM / 2).applyMatrix4(frame.basis) : null),
    [frame, win, wallThicknessM],
  );

  if (!win || !position) return null;
  return (
    <mesh position={position} quaternion={quaternion}>
      <boxGeometry args={[win.width, win.height, Math.max(0.02, wallThicknessM * 0.3)]} />
      <meshPhysicalMaterial color={GLASS_COLOR} transparent opacity={0.35} roughness={0.05} metalness={0} reflectivity={0.4} />
    </mesh>
  );
}

/** Dome is always 1 storey (API.md §3: "dome ⇒ storeys must be 1") — no
 *  stacking, no intermediate slab. */
function DomeBuilding({ geometry }: { geometry: SceneGeometry }) {
  const r = geometry.lengthM / 2;
  return (
    <group>
      <DomeFacetsSolid geometry={geometry} kind="wall" thicknessM={geometry.wallThicknessM} />
      <DomeFacetsSolid geometry={geometry} kind="roof" thicknessM={geometry.roofThicknessM} />
      {geometry.domeFacets
        .filter((f) => f.kind === 'wall')
        .map((f) => (
          <DomeWindow key={f.id} facet={f} wallThicknessM={geometry.wallThicknessM} />
        ))}

      <mesh position={[0, -geometry.floorThicknessM / 2, 0]} receiveShadow>
        <cylinderGeometry args={[r, r, geometry.floorThicknessM, DOME_SECTORS]} />
        <meshStandardMaterial color={FLOOR_COLOR} roughness={0.95} />
      </mesh>
    </group>
  );
}

export function Building({ geometry }: { geometry: SceneGeometry }) {
  if (geometry.shape === 'dome') return <DomeBuilding geometry={geometry} />;
  if (geometry.shape === 'cylinder') return <CylinderBuilding geometry={geometry} />;
  return <BoxBuilding geometry={geometry} />;
}
