// The 3D ShelterViewer (F2). View-only: renders the current ShelterDesign
// truthfully and reacts immediately to design/hour changes. No picking, no
// gizmos, no pointer editing (F2.md condition 3) — orbit/zoom/pan only.
//
// `frameloop="demand"`: React-three-fiber invalidates automatically on every
// commit (a design/hour prop change) and drei's OrbitControls invalidates on
// its own 'change' event, so no manual `invalidate()` calls are needed here
// (F2.md condition 4).

import { OrbitControls } from '@react-three/drei';
import { Canvas } from '@react-three/fiber';
import { useMemo } from 'react';
import type { Options, ShelterDesign } from '@shelter/studio-server';
import { Building } from './Building';
import { Compass } from './Compass';
import { buildSceneGeometry } from './geometry';
import { sunDirection } from './solar';
import { useThemeColors } from './useThemeColors';

export interface ShelterViewerProps {
  design: ShelterDesign;
  options: Options;
  /** Local clock hour (0-24) for the sun-direction calculation. */
  hour: number;
}

function resolveLatLon(design: ShelterDesign, options: Options): { lat: number; lon: number } {
  const location = design.location;
  if (location.kind === 'custom') {
    return { lat: location.lat, lon: location.lon };
  }
  const loc = options.locations.find((l) => l.id === location.id);
  // Fallback keeps the scene from throwing on a transient/unknown location id;
  // Leh, the default preset's site.
  return loc ? { lat: loc.latitude, lon: loc.longitude } : { lat: 34.1642, lon: 77.5771 };
}

function Ground({ radius, color }: { radius: number; color: string }) {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]} receiveShadow>
      <circleGeometry args={[radius, 64]} />
      <meshStandardMaterial color={color} roughness={1} />
    </mesh>
  );
}

function Scene({ design, options, hour }: ShelterViewerProps) {
  const colors = useThemeColors();
  const geometry = useMemo(() => buildSceneGeometry(design, options), [design, options]);
  const { lat, lon } = useMemo(() => resolveLatLon(design, options), [design, options]);
  const sunDir = useMemo(() => sunDirection(lat, lon, design.date, hour), [lat, lon, design.date, hour]);

  const footprint = Math.max(geometry.lengthM, geometry.widthM, geometry.heightM * 2);
  const sunDistance = footprint * 3;
  const sunUp = sunDir.y > 0.02; // sun above the horizon
  const shadowExtent = footprint * 1.2;

  return (
    <>
      <color attach="background" args={[colors.paper]} />
      <hemisphereLight
        args={[colors.paper, colors.hairline, sunUp ? 0.55 : 0.3]}
      />
      <ambientLight intensity={sunUp ? 0.15 : 0.25} />
      <directionalLight
        position={[sunDir.x * sunDistance, Math.max(sunDir.y, 0.05) * sunDistance, sunDir.z * sunDistance]}
        intensity={sunUp ? 1.6 : 0.1}
        color={colors.paper}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-shadowExtent}
        shadow-camera-right={shadowExtent}
        shadow-camera-top={shadowExtent}
        shadow-camera-bottom={-shadowExtent}
        shadow-camera-near={0.5}
        shadow-camera-far={sunDistance * 2}
        shadow-bias={-0.0015}
      />

      <Ground radius={footprint * 6} color={colors.surface} />
      <Compass geometry={geometry} colors={colors} />

      <group rotation={[0, geometry.rotationY, 0]}>
        <Building geometry={geometry} colors={colors} />
      </group>

      <OrbitControls
        makeDefault
        target={[0, geometry.heightM / 2, 0]}
        minDistance={footprint * 0.6}
        maxDistance={footprint * 6}
        minPolarAngle={0.15}
        maxPolarAngle={Math.PI / 2 - 0.02}
        enableDamping={false}
      />
    </>
  );
}

/** A view-only R3F scene of the current ShelterDesign. Pure props in, no
 *  store coupling — the caller (e.g. F3's Studio page, or the /dev/viewer
 *  preview route) decides where `design`/`options`/`hour` come from. */
export function ShelterViewer({ design, options, hour }: ShelterViewerProps) {
  const footprint = Math.max(design.lengthM, design.widthM);
  const camDist = footprint * 1.4;

  return (
    <Canvas
      frameloop="demand"
      shadows
      dpr={[1, 2]}
      camera={{ position: [camDist, camDist * 0.75, camDist * 1.15], fov: 32, near: 0.1, far: footprint * 40 }}
    >
      <Scene design={design} options={options} hour={hour} />
    </Canvas>
  );
}
