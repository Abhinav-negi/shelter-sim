// Pure camera-framing math for ShelterViewer (F2c). No React/three.js runtime
// dependency, so it's trivially unit-testable on its own — same pattern as
// solar.ts/geometry.ts.
//
// F2/F2b's whole camera-distance formula was `footprint * BASE_DISTANCE_FACTOR`
// with a fixed vertical FOV and fixed direction ratios, tuned by eye against a
// landscape canvas (`/dev/viewer`'s own fixed 1280x800 viewport) and never
// considered the canvas's own aspect ratio at all. That's fine on a wide
// canvas — the vertical FOV is always the tighter constraint there — but on
// the Studio page's near-square/portrait panes the *horizontal* FOV (derived
// from the vertical one and the aspect: `hFov = 2*atan(tan(vFov/2)*aspect)`)
// shrinks below the vertical one and becomes the tighter constraint instead —
// cropping whatever sits furthest from centre horizontally (the compass "N"
// glyph, off to one side of the building; F2c.md's goal).
//
// Model: treat the scene as needing two *fixed* world-space half-extents to
// stay in frame — a vertical one and a horizontal one — both derived once
// from the old, known-good calibration (`BASE_DISTANCE_FACTOR` at
// `CAMERA_FOV_DEG`/`REFERENCE_ASPECT`, the landscape aspect `/dev/viewer`'s
// own fixed 1280x800 canvas uses, where the compass is known to already fit
// — F2c.md's goal). Then, for any given `(aspect, vFovDeg)`, fit each
// half-extent independently (`radius / tan(halfFov)`) and take the larger
// (tighter-FOV) distance, so neither axis crops. At `(REFERENCE_ASPECT,
// CAMERA_FOV_DEG)` both fits collapse back to exactly the old distance
// (F2c.md condition 1, "/dev/viewer ... looks unchanged from F2b").

const DEG2RAD = Math.PI / 180;

/** The default camera's vertical FOV (ShelterViewer.tsx's `<PerspectiveCamera
 *  fov={...}>`), and the fixed reference every framing distance below is
 *  computed against. */
export const CAMERA_FOV_DEG = 28;

/** `footprint * this` was F2/F2b's entire camera-distance formula. Still the
 *  distance at `(REFERENCE_ASPECT, CAMERA_FOV_DEG)` — see file header. */
export const BASE_DISTANCE_FACTOR = 2.1;

/** The landscape aspect (`/dev/viewer`'s own fixed 1280x800 canvas) the
 *  original, aspect-blind framing was tuned against. At this exact aspect
 *  (with the default FOV), `cameraDistance` reduces to the original
 *  `footprint * BASE_DISTANCE_FACTOR` formula (F2c.md condition 1). */
export const REFERENCE_ASPECT = 1280 / 800;

function tanHalf(fovDeg: number): number {
  return Math.tan((fovDeg * DEG2RAD) / 2);
}

/** Camera distance (world units, along the fixed F2 direction ratios) that
 *  keeps a `footprint`-sized scene framed on a canvas of the given `aspect`
 *  (width/height) and vertical FOV. See file header for the model. */
export function cameraDistance(footprint: number, aspect: number, vFovDeg: number = CAMERA_FOV_DEG): number {
  const tanHalfVFovBase = tanHalf(CAMERA_FOV_DEG);
  // tan(halfHFov) = tan(halfVFov) * aspect, directly from `hFov =
  // 2*atan(tan(vFov/2)*aspect)` — the atan/tan cancel, no need to round-trip
  // through the angle at all.
  const tanHalfHFovBase = tanHalfVFovBase * REFERENCE_ASPECT;

  // The two fixed half-extents (world units) implied by the old calibration.
  const verticalRadius = footprint * BASE_DISTANCE_FACTOR * tanHalfVFovBase;
  const horizontalRadius = footprint * BASE_DISTANCE_FACTOR * tanHalfHFovBase;

  const tanHalfVFov = tanHalf(vFovDeg);
  const tanHalfHFov = tanHalfVFov * aspect;

  const distanceForVertical = verticalRadius / tanHalfVFov;
  const distanceForHorizontal = horizontalRadius / tanHalfHFov;
  return Math.max(distanceForVertical, distanceForHorizontal);
}
