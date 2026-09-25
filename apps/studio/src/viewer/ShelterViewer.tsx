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

// Fixed daylight colours for the sun/sky — deliberately NOT the paper/ink
// design tokens. The tokens style the app chrome (background, ground,
// materials) and correctly go near-black in dark mode; the *light sources*
// model physical daylight, which doesn't get dark just because the UI theme
// did. Conflating the two made the dark-theme render nearly black — the
// "sun" was lighting the scene with near-black light. Only the backdrop
// (background colour, ground, hairlines, wall/roof/floor materials) follows
// the theme; illumination stays constant so the sun/hour controls (not the
// theme toggle) are what changes how lit the scene looks.
const SUN_COLOR = '#fff6e8';
const SKY_COLOR = '#eef3f7';

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
  const groundRadius = footprint * 16;
  const fogNear = footprint * 4;
  const fogFar = footprint * 11;

  return (
    <>
      <color attach="background" args={[colors.paper]} />
      <fog attach="fog" args={[colors.paper, fogNear, fogFar]} />
      <hemisphereLight args={[SKY_COLOR, colors.hairline, sunUp ? 0.65 : 0.35]} />
      <ambientLight intensity={sunUp ? 0.2 : 0.3} />
      <directionalLight
        position={[sunDir.x * sunDistance, Math.max(sunDir.y, 0.05) * sunDistance, sunDir.z * sunDistance]}
        intensity={sunUp ? 1.9 : 0.15}
        color={SUN_COLOR}
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

      <Ground radius={groundRadius} color={colors.surface} />
      <Compass geometry={geometry} colors={colors} />

      <group rotation={[0, geometry.rotationY, 0]}>
        <Building geometry={geometry} />
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
  const camDist = footprint * 2.1;

  return (
    <Canvas
      frameloop="demand"
      shadows="percentage"
      dpr={[1, 2]}
      camera={{ position: [camDist, camDist * 0.62, camDist * 1.05], fov: 28, near: 0.1, far: footprint * 60 }}
    >
      <Scene design={design} options={options} hour={hour} />
    </Canvas>
  );
}
