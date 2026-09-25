// A compass marking true north in world space. Deliberately NOT a child of
// the azimuth-rotated building group (F2.md: "the compass must show true N
// in world space, independent of the building rotation") — it reads
// `geometry` only to place itself just outside the current footprint, never
// to rotate itself. World frame: +Z = South, so north is -Z (see
// geometry.ts's header for the full convention).

import { Html } from '@react-three/drei';
import type { SceneGeometry } from './geometry';
import type { SceneColors } from './useThemeColors';

export function Compass({ geometry, colors }: { geometry: SceneGeometry; colors: SceneColors }) {
  const margin = 1.5;
  const eastX = geometry.lengthM / 2 + margin;

  return (
    <group position={[eastX, 0.01, 0]}>
      {/* Needle pointing to true north. */}
      <mesh position={[0, 0, -0.5]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[0.03, 1]} />
        <meshBasicMaterial color={colors.inkMuted} />
      </mesh>
      <mesh position={[0, 0, -1]} rotation={[-Math.PI / 2, 0, Math.PI]}>
        <coneGeometry args={[0.09, 0.22, 3]} />
        <meshBasicMaterial color={colors.ink} />
      </mesh>
      <Html position={[0, 0, -1.35]} center transform={false} style={{ pointerEvents: 'none' }}>
        <span
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 11,
            letterSpacing: '0.08em',
            color: colors.ink,
          }}
        >
          N
        </span>
      </Html>
    </group>
  );
}
