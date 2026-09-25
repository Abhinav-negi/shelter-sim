// The building itself: walls (with real window openings, no CSG — each wall
// is framed from up to four non-overlapping boxes: two piers, a sill band
// and a lintel band, merged into one mesh — see the comment on `wallGeometry`
// below — plus a separate glass pane, so there is nothing coplanar to
// z-fight), a flat roof slab and a floor slab. Pure render component: all
// the numbers come from `SceneGeometry` (geometry.ts).

import { Edges, Line } from '@react-three/drei';
import { useEffect, useMemo } from 'react';
import { BoxGeometry } from 'three';
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

interface Rect {
  uCenter: number;
  uSize: number;
  vCenter: number;
  vSize: number;
}

/** The wall's opening broken into the solid boxes that frame it (or one box
 *  for a blank wall). u = across the facade, v = up the wall. */
function frameRects(facadeWidth: number, heightM: number, win: WindowRect | null): Rect[] {
  if (!win) {
    return [{ uCenter: 0, uSize: facadeWidth, vCenter: heightM / 2, vSize: heightM }];
  }

  const half = facadeWidth / 2;
  const halfWin = win.width / 2;
  const top = win.sill + win.height;
  const pierWidth = half - halfWin;
  const rects: Rect[] = [];

  if (pierWidth > 1e-6) {
    rects.push({ uCenter: -(half + halfWin) / 2, uSize: pierWidth, vCenter: heightM / 2, vSize: heightM });
    rects.push({ uCenter: (half + halfWin) / 2, uSize: pierWidth, vCenter: heightM / 2, vSize: heightM });
  }
  if (win.sill > 1e-6) {
    rects.push({ uCenter: 0, uSize: win.width, vCenter: win.sill / 2, vSize: win.sill });
  }
  if (heightM - top > 1e-6) {
    rects.push({ uCenter: 0, uSize: win.width, vCenter: (top + heightM) / 2, vSize: heightM - top });
  }
  return rects;
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

function Wall({ geometry, wall }: { geometry: SceneGeometry; wall: WallGeometry }) {
  const { runAxis, sign } = WALL_SIDE[wall.orientation];
  const depthHalfExtent = runAxis === 'x' ? geometry.widthM / 2 : geometry.lengthM / 2;
  const outerFace = sign * depthHalfExtent;
  const centerDepth = outerFace - (sign * geometry.wallThicknessM) / 2;

  const rects = useMemo(
    () => frameRects(wall.facadeWidth, geometry.heightM, wall.window),
    [wall.facadeWidth, geometry.heightM, wall.window],
  );

  // One real mesh per wall, not one per frame piece: piers/sill/lintel boxes
  // are geometrically coplanar and share the same material, but as SEPARATE
  // meshes each casts/receives shadows independently, and a shadow-map depth
  // difference of a fraction of a texel right at their shared boundary shows
  // up as a thin seam line — invisible-looking "identical material" doesn't
  // stop that (review: "no shading step"). Merging into one BufferGeometry
  // (three's own bundled BufferGeometryUtils, no new dependency) makes it a
  // single shadow-caster with no internal boundary at all.
  const wallGeometry = useMemo(() => {
    const pieces = rects.map((r) => {
      const size: [number, number, number] =
        runAxis === 'x'
          ? [r.uSize, r.vSize, geometry.wallThicknessM]
          : [geometry.wallThicknessM, r.vSize, r.uSize];
      const position: [number, number, number] =
        runAxis === 'x' ? [r.uCenter, r.vCenter, centerDepth] : [centerDepth, r.vCenter, r.uCenter];
      const box = new BoxGeometry(...size);
      box.translate(...position);
      return box;
    });
    const concatenated = mergeGeometries(pieces);
    for (const piece of pieces) piece.dispose();
    // mergeGeometries only concatenates attribute buffers — adjacent pieces'
    // shared-boundary vertices are numerically equal but stay topologically
    // separate, which some renderers (notably SwiftShader, the software
    // WebGL used for headless screenshots) rasterize as a hairline crack
    // right at that boundary — exactly the seam this was meant to fix.
    // mergeVertices welds spatially-coincident vertices into one shared
    // vertex, making it a genuinely continuous indexed mesh.
    const merged = mergeVertices(concatenated, 1e-5);
    concatenated.dispose();
    return merged;
  }, [rects, runAxis, centerDepth, geometry.wallThicknessM]);

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
