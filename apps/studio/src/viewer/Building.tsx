// The building itself: walls (with real window openings, no CSG — each wall
// is up to five non-overlapping boxes: two piers, a sill band, a lintel band
// and the glass pane, so there is nothing coplanar to z-fight), a flat roof
// slab and a floor slab. Pure render component: all the numbers come from
// `SceneGeometry` (geometry.ts).

import { Edges } from '@react-three/drei';
import { useMemo } from 'react';
import { Color } from 'three';
import type { Orientation, SceneGeometry, WallGeometry, WindowRect } from './geometry';
import type { SceneColors } from './useThemeColors';

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

function Wall({
  geometry,
  wall,
  color,
  edgeColor,
}: {
  geometry: SceneGeometry;
  wall: WallGeometry;
  color: string;
  edgeColor: string;
}) {
  const { runAxis, sign } = WALL_SIDE[wall.orientation];
  const depthHalfExtent = runAxis === 'x' ? geometry.widthM / 2 : geometry.lengthM / 2;
  const outerFace = sign * depthHalfExtent;
  const centerDepth = outerFace - (sign * geometry.wallThicknessM) / 2;

  const rects = useMemo(
    () => frameRects(wall.facadeWidth, geometry.heightM, wall.window),
    [wall.facadeWidth, geometry.heightM, wall.window],
  );

  return (
    <group>
      {rects.map((r, i) => {
        const position: [number, number, number] =
          runAxis === 'x' ? [r.uCenter, r.vCenter, centerDepth] : [centerDepth, r.vCenter, r.uCenter];
        const size: [number, number, number] =
          runAxis === 'x'
            ? [r.uSize, r.vSize, geometry.wallThicknessM]
            : [geometry.wallThicknessM, r.vSize, r.uSize];
        return (
          <mesh key={i} position={position} castShadow receiveShadow>
            <boxGeometry args={size} />
            <meshStandardMaterial color={color} roughness={0.92} metalness={0} />
            <Edges threshold={20} color={edgeColor} opacity={0.3} transparent linewidth={1} />
          </mesh>
        );
      })}
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
            color="#a9c3d6"
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

function mix(a: string, b: string, t: number): string {
  return new Color(a).lerp(new Color(b), t).getStyle();
}

export function Building({ geometry, colors }: { geometry: SceneGeometry; colors: SceneColors }) {
  const wallColor = colors.surface;
  const roofColor = useMemo(() => mix(colors.surface, colors.ink, 0.18), [colors.surface, colors.ink]);
  const floorColor = useMemo(() => mix(colors.surface, colors.hairline, 0.5), [colors.surface, colors.hairline]);

  return (
    <group>
      {geometry.walls.map((wall) => (
        <Wall
          key={wall.orientation}
          geometry={geometry}
          wall={wall}
          color={wallColor}
          edgeColor={colors.ink}
        />
      ))}

      {/* Floor slab: top face at y=0, the walls' base. */}
      <mesh position={[0, -geometry.floorThicknessM / 2, 0]} receiveShadow>
        <boxGeometry args={[geometry.lengthM, geometry.floorThicknessM, geometry.widthM]} />
        <meshStandardMaterial color={floorColor} roughness={0.95} />
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
        <meshStandardMaterial color={roofColor} roughness={0.85} />
        <Edges threshold={20} color={colors.ink} opacity={0.3} transparent linewidth={1} />
      </mesh>
    </group>
  );
}
