// A restrained, data-true sun indicator (not decoration): a small disc
// placed exactly where the light in the scene comes from — along
// `sunDirection` (solar.ts) at a fixed radius from the building — plus a
// thin dashed line back to the building centre so the direction reads at a
// glance. Uses the thermal scale's warm stop (a data colour reserved for
// physical quantities, PLAN.md §Design system) rather than the UI accent,
// since this represents the actual sun position, not a UI affordance.
// The caller (ShelterViewer) only renders this when the sun is above the
// horizon — below it, there is nothing to show (F2.md review: "hide the
// disc and show nothing").

import { Line } from '@react-three/drei';
import type { Vec3 } from './solar';

export function Sun({
  direction,
  radius,
  center,
  color,
}: {
  direction: Vec3;
  /** Distance from `center` to the disc, world units (metres) — the same
   *  radius the directional light itself is placed at, so the indicator
   *  points at the scene's actual light source, not an arbitrary spot. */
  radius: number;
  center: [number, number, number];
  color: string;
}) {
  // Trivial arithmetic — not worth memoising (it's 3 additions, no useMemo).
  const position: [number, number, number] = [
    center[0] + direction.x * radius,
    center[1] + direction.y * radius,
    center[2] + direction.z * radius,
  ];
  const discRadius = Math.max(0.15, radius * 0.035);

  return (
    <group>
      <Line
        points={[center, position]}
        color={color}
        dashed
        dashSize={radius * 0.02}
        gapSize={radius * 0.015}
        transparent
        opacity={0.55}
      />
      <mesh position={position}>
        <sphereGeometry args={[discRadius, 20, 20]} />
        <meshBasicMaterial color={color} />
      </mesh>
    </group>
  );
}
