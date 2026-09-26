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
import { type BufferGeometry, ExtrudeGeometry, Path, Shape } from 'three';
import { mergeGeometries, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import type { Orientation, SceneGeometry, WallGeometry, WindowRect } from './geometry';

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
 *  their u is always well inside `±half`. */
function mitreWallEnds(
  geom: BufferGeometry,
  half: number,
  outerFace: number,
  sign: 1 | -1,
  runAxis: 'x' | 'z',
): void {
  const pos = geom.attributes.position!; // ExtrudeGeometry always has a position attribute
  const EPS = 1e-4; // far below any real dimension; just tight enough to hit exactly the u=±half vertices
  const getU = runAxis === 'x' ? (i: number) => pos.getX(i) : (i: number) => pos.getZ(i);
  const setU = runAxis === 'x' ? (i: number, v: number) => pos.setX(i, v) : (i: number, v: number) => pos.setZ(i, v);
  const getDepthCoord = runAxis === 'x' ? (i: number) => pos.getZ(i) : (i: number) => pos.getX(i);
  for (let i = 0; i < pos.count; i++) {
    const u = getU(i);
    const d = sign * (outerFace - getDepthCoord(i)); // 0 at the exterior face, +wallThicknessM at the interior face
    if (Math.abs(u - half) < EPS) setU(i, half - d);
    else if (Math.abs(u + half) < EPS) setU(i, -(half - d));
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
  mitreWallEnds(geom, half, outerFace, sign, runAxis);
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

export function Building({ geometry }: { geometry: SceneGeometry }) {
  return (
    <group>
      <WallsSolid geometry={geometry} />
      {geometry.walls.map((wall) => (
        <Wall key={wall.orientation} geometry={geometry} wall={wall} />
      ))}

      {/* Floor slab: top face at y=0, the walls' base. */}
      <mesh position={[0, -geometry.floorThicknessM / 2, 0]} receiveShadow>
        <boxGeometry args={[geometry.lengthM, geometry.floorThicknessM, geometry.widthM]} />
        <meshStandardMaterial color={FLOOR_COLOR} roughness={0.95} />
      </mesh>

      {/* Flat roof slab, flush with the wall footprint — no eaves, no roof type
          control (F2.md Rules: the model reflects only what the physics
          models, and the engine only knows a flat roof). */}
      <mesh
        position={[0, geometry.heightM + geometry.roofThicknessM / 2, 0]}
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
