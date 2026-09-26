// Pure ShelterDesign -> scene geometry. No React, no three.js runtime — just
// numbers, so it is trivially unit-testable and the R3F components that
// consume it (Building.tsx) stay thin.
//
// GEOMETRY TRUTH (ledger/tasks/F2.md): surfaces are walls S/E/W/N + a flat
// roof + a floor. `lengthM` is the S/N wall run (E-W extent, so it sizes the
// S/N facades and runs along world X below); `widthM` is the E/W wall run
// (N-S extent, sizes the E/W facades, runs along world Z). Wall/roof/floor
// thickness is the construction's own `thicknessM`, or, when a construction
// is null, the preset's total stack thickness for that surface. Corner
// joints (F2b): S/N walls run the full `lengthM`; E/W walls' `facadeWidth`
// is shortened to `widthM - 2*wallThicknessM` so they fit flush between the
// S/N walls' inner faces instead of both pairs running full-length and their
// solids overlapping at each corner.
//
// World frame (see ShelterViewer.tsx): Y up, +X = East, +Z = South — chosen
// to match the engine's own "azimuth measured from south, negative = East,
// positive = West" convention (packages/engine/src/solar/geometry.ts), so a
// surface's azimuth and its world-space compass bearing use the same signs.
// `azimuthDeg` (API.md: "0 = long side faces south, positive = toward
// west") rotates the whole footprint: the engine composes it as
// `surfaceAzimuth + building.azimuth` (packages/engine/src/solve/assemble.ts),
// so at azimuthDeg=90 the wall that was facing south (local azimuth 0) now
// has effective azimuth 90 = facing west. In three.js's right-handed Y-up
// rotation, `Ry(theta)` sends local +Z to `(sin theta, 0, cos theta)`; we
// want local +Z (south) to end up pointing toward -X (west, our world
// convention), i.e. `sin theta = -sin(azimuthDeg)`, solved by
// `theta = -azimuthDeg`. Hence `rotationY = -azimuthDeg` (radians) below.

import type { Options, ShelterDesign } from '@shelter/studio-server';

const DEG2RAD = Math.PI / 180;

/** Fallback wall/roof/floor thickness (m) if a design's presetId isn't found
 *  in options — shouldn't happen, but keeps the viewer from throwing on a
 *  transient/stale combination (e.g. mid preset-switch). */
const FALLBACK_THICKNESS_M = 0.3;

const WINDOW_MARGIN_SIDE_M = 0.15;
const WINDOW_SILL_M = 0.9;
const WINDOW_LINTEL_MARGIN_M = 0.3;
const WINDOW_ASPECT = 1.3; // width:height, a plain daylighting proportion

export type Orientation = 'S' | 'E' | 'W' | 'N';

export interface WindowRect {
  /** m, opening width along the facade. */
  width: number;
  /** m, opening height. */
  height: number;
  /** m, sill height above the interior floor. */
  sill: number;
}

export interface WallGeometry {
  orientation: Orientation;
  /** m, this facade's width — lengthM for S/N (the full footprint run); for
   *  E/W, widthM minus twice the wall thickness, so the E/W walls fit
   *  *between* the S/N walls' inner faces (S/N run the full length, E/W fit
   *  between — F2b's corner-joint rule: flush at the corner, no overlap, no
   *  gap) rather than both pairs running the full footprint and their solid
   *  volumes overlapping in the corner cube. */
  facadeWidth: number;
  /** null when WWR is 0 or the facade is too small to fit a margined opening. */
  window: WindowRect | null;
}

export interface SceneGeometry {
  lengthM: number;
  widthM: number;
  heightM: number;
  wallThicknessM: number;
  roofThicknessM: number;
  floorThicknessM: number;
  /** radians, three.js `group.rotation.y` — see the file header for the sign. */
  rotationY: number;
  walls: WallGeometry[];
}

function resolveThickness(
  override: { thicknessM: number } | null,
  presetThickness: number | undefined,
): number {
  return override?.thicknessM ?? presetThickness ?? FALLBACK_THICKNESS_M;
}

function windowRect(facadeWidth: number, heightM: number, wwr: number): WindowRect | null {
  if (wwr <= 0 || facadeWidth <= 0 || heightM <= 0) return null;

  const area = wwr * facadeWidth * heightM;
  let height = Math.sqrt(area / WINDOW_ASPECT);
  let width = height * WINDOW_ASPECT;

  const maxWidth = Math.max(0, facadeWidth - 2 * WINDOW_MARGIN_SIDE_M);
  const maxHeight = Math.max(0, heightM - WINDOW_SILL_M - WINDOW_LINTEL_MARGIN_M);
  width = Math.min(width, maxWidth);
  height = Math.min(height, maxHeight);
  if (width <= 0 || height <= 0) return null;

  return { width, height, sill: WINDOW_SILL_M };
}

/** ShelterDesign -> scene geometry. Cheap to call; memoise on (design, options)
 *  in the component that owns the render (ShelterViewer does). */
export function buildSceneGeometry(design: ShelterDesign, options: Options): SceneGeometry {
  const preset = options.presets.find((p) => p.id === design.presetId);

  const wallThicknessM = resolveThickness(design.wallConstruction, preset?.thicknessM.wall);
  const roofThicknessM = resolveThickness(design.roofConstruction, preset?.thicknessM.roof);
  const floorThicknessM = resolveThickness(design.floorConstruction, preset?.thicknessM.floor);

  // S/N run the full lengthM footprint; E/W fit between their inner faces
  // (see WallGeometry.facadeWidth doc). Floored at a hair above 0 so a
  // pathological wallThicknessM >= widthM/2 degenerates to a sliver instead
  // of a negative/zero-width shape crashing the extrude in Building.tsx.
  const ewFacadeWidth = Math.max(1e-4, design.widthM - 2 * wallThicknessM);

  const facades: Array<{ orientation: Orientation; facadeWidth: number; wwr: number }> = [
    { orientation: 'S', facadeWidth: design.lengthM, wwr: design.windowWwr.S },
    { orientation: 'N', facadeWidth: design.lengthM, wwr: design.windowWwr.N },
    { orientation: 'E', facadeWidth: ewFacadeWidth, wwr: design.windowWwr.E },
    { orientation: 'W', facadeWidth: ewFacadeWidth, wwr: design.windowWwr.W },
  ];

  const walls: WallGeometry[] = facades.map((f) => ({
    orientation: f.orientation,
    facadeWidth: f.facadeWidth,
    window: windowRect(f.facadeWidth, design.heightM, f.wwr),
  }));

  return {
    lengthM: design.lengthM,
    widthM: design.widthM,
    heightM: design.heightM,
    wallThicknessM,
    roofThicknessM,
    floorThicknessM,
    rotationY: -design.azimuthDeg * DEG2RAD,
    walls,
  };
}
