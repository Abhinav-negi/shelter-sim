// The building itself: walls (each wall is ONE extruded solid — a rectangle
// `THREE.Shape` with the window opening cut out as a `Path` hole, extruded
// by the wall thickness — so there is no internal coplanar face anywhere
// inside a wall to seam or shadow-acne; see the comment on `wallGeometry`
// below — plus a separate glass pane sitting in the opening), a flat roof
// slab and a floor slab. Pure render component: all the numbers come from
// `SceneGeometry` (geometry.ts).

import { Edges, Line } from '@react-three/drei';
import { useEffect, useMemo } from 'react';
import { ExtrudeGeometry, Path, Shape } from 'three';
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
 *  floored to a hair above 0 so a degenerate (near-zero) facadeWidth — see
 *  geometry.ts's `ewFacadeWidth` floor — still produces valid, if sliver,
 *  geometry instead of a zero-area shape. */
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
  // The outline's own silhouette rectangle must span the BUILDING's true
  // outer corner (geometry.lengthM / geometry.widthM), not wall.facadeWidth:
  // for E/W walls, facadeWidth is trimmed short of that (F2b corner-joint
  // fit, so the E/W *solid* stops at the S/N walls' inner faces) — but the
  // S/N wall's own end continues past that point, same material, same
  // exterior plane, all the way to the true corner. Drawing the outline at
  // the trimmed facadeWidth would put a false construction line partway
  // across an otherwise-continuous facade — exactly the seam defect F2b
  // exists to remove, just self-inflicted by the outline this time.
  const outlineWidth = runAxis === 'x' ? geometry.lengthM : geometry.widthM;
  const segments = useMemo(
    () => outlineSegments(outlineWidth, geometry.heightM, wall.window),
    [outlineWidth, geometry.heightM, wall.window],
  );

  const points = useMemo(() => {
    const depth = outerFace + Math.sign(outerFace || 1) * OUTLINE_EPS;
    const toWorld = (u: number, v: number): [number, number, number] =>
      runAxis === 'x' ? [u, v, depth] : [depth, v, u];
    return segments.flatMap(([[u0, v0], [u1, v1]]) => [toWorld(u0, v0), toWorld(u1, v1)]);
  }, [segments, runAxis, outerFace]);

  return <Line segments points={points} color={EDGE_COLOR} transparent opacity={0.4} lineWidth={1} />;
}

function Wall({ geometry, wall }: { geometry: SceneGeometry; wall: WallGeometry }) {
  const { runAxis, sign } = WALL_SIDE[wall.orientation];
  const depthHalfExtent = runAxis === 'x' ? geometry.widthM / 2 : geometry.lengthM / 2;
  const outerFace = sign * depthHalfExtent;
  const centerDepth = outerFace - (sign * geometry.wallThicknessM) / 2;

  // ONE real mesh per wall, built as ONE extruded solid (F2b): a rectangle
  // `Shape` (u,v = across/up the facade) with the window cut out as a `Path`
  // hole, extruded by the wall thickness. F2's approach (piers/sill/lintel
  // as separate boxes merged+vertex-welded into one BufferGeometry) still
  // left internal coplanar *faces* inside the merged mesh at each former
  // piece boundary — invisible in the wireframe/outline (those were already
  // fixed) but still shading/shadow-acne-prone at glancing light angles,
  // since the geometry is still, internally, several abutting slabs. A
  // single extruded solid has no internal face at all: the only faces are
  // the two facade faces, the outer silhouette side, and the window reveal
  // side — nothing coplanar left to seam.
  //
  // `ExtrudeGeometry` extrudes the shape's local (x,y) along local +z from 0
  // to `depth`; local (x,y) are exactly (u,v) here, so no transform is
  // needed for S/N walls (runAxis 'x': local x/y/z = world x/y/z already) —
  // just translate z so the thickness band lands on
  // [centerDepth-depth/2, centerDepth+depth/2], matching where the F2 boxes
  // sat. E/W walls (runAxis 'z') need the extrude/thickness axis on world x
  // and u on world z: `rotateY(-90deg)` (three's Ry(theta): x'=x·cosθ+z·sinθ,
  // z'=-x·sinθ+z·cosθ, θ=-90°) sends local z (extrude, 0..depth) to world
  // x'=-z and local x (u) to world z'=x=u — u lands on world z unflipped
  // (matches F2's box placement) via a genuine rotation, so winding/normals
  // stay correct (no mirror). Since world x'=-z runs 0..-depth, the center
  // offset flips sign to `centerDepth + depth/2` (vs. `- depth/2` for S/N).
  const wallGeometry = useMemo(() => {
    const shape = wallShape(wall.facadeWidth, geometry.heightM, wall.window);
    const depth = geometry.wallThicknessM;
    const geom = new ExtrudeGeometry(shape, { depth, bevelEnabled: false, curveSegments: 1 });
    if (runAxis === 'x') {
      geom.translate(0, 0, centerDepth - depth / 2);
    } else {
      geom.rotateY(-Math.PI / 2);
      geom.translate(centerDepth + depth / 2, 0, 0);
    }
    return geom;
  }, [wall.facadeWidth, wall.window, geometry.heightM, geometry.wallThicknessM, runAxis, centerDepth]);

  useEffect(() => () => wallGeometry.dispose(), [wallGeometry]);

  return (
    <group>
      <mesh geometry={wallGeometry} castShadow receiveShadow>
        <meshStandardMaterial color={WALL_COLOR} roughness={0.92} metalness={0} />
      </mesh>
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
