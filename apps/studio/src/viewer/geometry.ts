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
// joints (F2b, mitred): every wall's `facadeWidth` is the full outer
// (corner-to-corner) length — `lengthM` for S/N, `widthM` for E/W. Building.tsx
// mitres each wall's thickness-direction ends at 45°, so the *exterior* face
// reaches the true corner (matching its neighbour's exterior face exactly)
// while the *interior* face is inset by `wallThicknessM` at each end — like a
// picture-frame corner. That keeps each facade a single, continuous exterior
// polygon corner-to-corner (no neighbour's end-grain exposed on it, and no
// coplanar-but-separate-polygon seam), instead of an earlier butt-joint
// scheme (one pair full length, the other trimmed to fit between) that left
// a real rendering seam at the join even after vertex-welding.
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
  /** m, this facade's full *outer* (corner-to-corner) width — `lengthM` for
   *  S/N, `widthM` for E/W, the same convention for every orientation.
   *  Building.tsx mitres each wall's thickness-direction ends so the
   *  interior face is inset by `wallThicknessM` at each end while this
   *  (exterior) length stays the true corner-to-corner run — see this
   *  file's header for why (F2b corner-joint rule). */
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

  // Every wall's facadeWidth is its full outer (corner-to-corner) run — see
  // WallGeometry.facadeWidth doc; the mitre taper that keeps interior
  // corners from overlapping is applied in Building.tsx, not here.
  const facades: Array<{ orientation: Orientation; facadeWidth: number; wwr: number }> = [
    { orientation: 'S', facadeWidth: design.lengthM, wwr: design.windowWwr.S },
    { orientation: 'N', facadeWidth: design.lengthM, wwr: design.windowWwr.N },
    { orientation: 'E', facadeWidth: design.widthM, wwr: design.windowWwr.E },
    { orientation: 'W', facadeWidth: design.widthM, wwr: design.windowWwr.W },
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
