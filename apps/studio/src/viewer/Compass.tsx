// A compass marking true north in world space. Deliberately NOT a child of
// the azimuth-rotated building group (F2.md: "the compass must show true N
// in world space, independent of the building rotation") — it reads
// `geometry` only to place itself just outside the current footprint, never
// to rotate itself. World frame: +Z = South, so north is -Z (see
// geometry.ts's header for the full convention).
//
// The "N" is built from three thin boxes (a block glyph), not text — no
// font/DOM dependency (drei's Text needs a network font fetch by default;
// Html needs the DOM layer positioned just right) — wrapped in a drei
// <Billboard> so it stays legible from any orbit angle.

import { Billboard } from '@react-three/drei';
import { DoubleSide } from 'three';
import type { SceneGeometry } from './geometry';
import type { SceneColors } from './useThemeColors';

function NGlyph({ color }: { color: string }) {
  const h = 0.5;
  const w = 0.32;
  const stroke = 0.07;
  const diagLength = Math.hypot(w, h);
  const diagAngle = Math.atan2(-h, w);

  return (
    <group>
      <mesh position={[-w / 2, 0, 0]}>
        <boxGeometry args={[stroke, h, stroke]} />
        <meshBasicMaterial color={color} />
      </mesh>
      <mesh position={[w / 2, 0, 0]}>
        <boxGeometry args={[stroke, h, stroke]} />
        <meshBasicMaterial color={color} />
      </mesh>
      <mesh rotation={[0, 0, diagAngle]}>
        <boxGeometry args={[diagLength, stroke, stroke]} />
        <meshBasicMaterial color={color} />
      </mesh>
    </group>
  );
}

export function Compass({ geometry, colors }: { geometry: SceneGeometry; colors: SceneColors }) {
  const margin = 1.5;
  const anchorX = geometry.lengthM / 2 + margin;
  const needleLength = Math.max(1.2, Math.min(geometry.lengthM, geometry.widthM) * 0.35);

  return (
    <group position={[anchorX, 0.02, 0]}>
      {/* A flat ring on the ground, and a needle pointing to true north (-Z). */}
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[needleLength * 0.96, needleLength, 48]} />
        <meshBasicMaterial color={colors.inkMuted} transparent opacity={0.5} side={DoubleSide} />
      </mesh>
      <mesh position={[0, 0, -needleLength / 2]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[0.04, needleLength]} />
        <meshBasicMaterial color={colors.accent} />
      </mesh>
      <mesh position={[0, 0, -needleLength]} rotation={[-Math.PI / 2, 0, Math.PI]}>
        <coneGeometry args={[0.16, 0.4, 3]} />
        <meshBasicMaterial color={colors.accent} />
      </mesh>
      <Billboard position={[0, 0.6, -needleLength]}>
        <NGlyph color={colors.accent} />
      </Billboard>
    </group>
  );
}
