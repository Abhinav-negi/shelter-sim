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

import type { Options, ShelterDesign, Shape, Storeys } from '@shelter/studio-server';

const DEG2RAD = Math.PI / 180;

// G3 (V2.md §G3): cylinder/dome facet generation, mirroring
// apps/studio-server/src/design/assemble.ts's own constants/functions
// (`CYLINDER_SECTORS`, `DOME_BANDS`, `DOME_SECTORS`,
// `DOME_WALL_TILT_THRESHOLD_DEG`, `orientationForAzimuth`, `cylinderGeometry`,
// `domeGeometry`) so the viewer draws exactly the facets the server
// simulates. The client never imports server code at runtime (only
// `import type` from @shelter/studio-server) -- these are copies, not
// re-exports, kept in sync by hand; see that file for the derivations.
export const CYLINDER_SECTORS = 12;
export const DOME_BANDS = 3;
export const DOME_SECTORS = 12;
const DOME_WALL_TILT_THRESHOLD_DEG = 60;

/** Same rule as `wallsInQuadrant`'s `orientationForAzimuth`
 *  (assemble.ts): ties at exactly ±45°/±135° go to S/N, never E/W. */
export function orientationForAzimuth(azimuth: number): Orientation {
  if (azimuth >= -45 && azimuth <= 45) return 'S';
  if (azimuth > 45 && azimuth < 135) return 'W';
  if (azimuth <= -135 || azimuth >= 135) return 'N';
  return 'E';
}

/** `-150, -120, ..., 180` (30° apart) -- the exact azimuth list
 *  `cylinderGeometry`/`domeGeometry` (assemble.ts) place their 12 sectors
 *  at, for any sector count `n` (only ever called with 12 here). */
function ringAzimuths(n: number): number[] {
  const step = 360 / n;
  return Array.from({ length: n }, (_, k) => -150 + k * step);
}

/** World (x,z) unit vector for a local azimuth (see this file's header for
 *  the convention: 0=S=+Z, 90=W=-X, -90=E=+X, 180=N=-Z). Exported for
 *  Building.tsx's ring/dome placement. */
export function azimuthDirection(azimuthDeg: number): { x: number; z: number } {
  const t = azimuthDeg * DEG2RAD;
  return { x: -Math.sin(t), z: Math.cos(t) };
}

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
   *  file's header for why (F2b corner-joint rule). For a cylinder facet
   *  (12 of these instead of 4) this is the flat chord length, not an arc. */
  facadeWidth: number;
  /** Local azimuth (degrees, this file's convention), set for cylinder
   *  facets only (`-150 + k*30`, mirrors `cylinderGeometry`) — box walls
   *  are placed by `orientation` alone and leave this undefined. */
  azimuthDeg?: number;
  /** null when WWR is 0 or the facade is too small to fit a margined opening. */
  window: WindowRect | null;
}

/** One dome band×sector facet (G3; mirrors `domeGeometry`, assemble.ts).
 *  `radiusLow`/`radiusHigh` and `heightLow`/`heightHigh` are the two
 *  elevation rings this facet spans (a flat frustum trapezoid between them
 *  — Building.tsx builds the actual 3D panel from these). */
export interface DomeFacet {
  id: string;
  /** `wall` (bands 0/1, tilt >= 60°, can host a window) or `roof` (band 2,
   *  the cap) — same threshold as `DOME_WALL_TILT_THRESHOLD_DEG`. */
  kind: 'wall' | 'roof';
  orientation: Orientation;
  azimuthDeg: number;
  band: number;
  tiltDeg: number;
  radiusLow: number;
  radiusHigh: number;
  heightLow: number;
  heightHigh: number;
  window: WindowRect | null;
}

export interface SceneGeometry {
  shape: Shape;
  storeys: Storeys;
  lengthM: number;
  widthM: number;
  /** m, PER STOREY (ignored for a dome, which has no independent height). */
  heightM: number;
  wallThicknessM: number;
  roofThicknessM: number;
  floorThicknessM: number;
  /** radians, three.js `group.rotation.y` — see the file header for the sign. */
  rotationY: number;
  /** m, the real total envelope height for camera framing (F2c/G3
   *  condition 3): `heightM * storeys` for box/cylinder, the radius for a
   *  dome (a hemisphere's height is its radius, not `heightM`, which a
   *  dome ignores). */
  buildingHeightM: number;
  /** Box: 4 facets, orientation-keyed. Cylinder: 12, azimuth-keyed too.
   *  Empty for a dome (see `domeFacets`). */
  walls: WallGeometry[];
  /** Dome only (36 = 3 bands × 12 sectors); empty otherwise. */
  domeFacets: DomeFacet[];
}

function resolveThickness(
  override: { thicknessM: number } | null,
  presetThickness: number | undefined,
): number {
  return override?.thicknessM ?? presetThickness ?? FALLBACK_THICKNESS_M;
}

interface WindowMargins {
  sillM: number;
  lintelM: number;
}

const FIXED_WINDOW_MARGINS: WindowMargins = { sillM: WINDOW_SILL_M, lintelM: WINDOW_LINTEL_MARGIN_M };

/** Q2F: a dome wall band's slant height (≈0.85m at a 5m-diameter dome) is
 *  shorter than the fixed 1.2m sill+lintel clearance, so `windowRect` always
 *  returned null for every dome facet regardless of WWR — the 3D preview hid
 *  a window the server actually simulates (Q2.md finding #3). Scales the same
 *  3:1 sill:lintel ratio to the facet's own height instead, capped at the
 *  fixed metres, so a short facet keeps proportionally smaller (but still
 *  present) margins rather than clamping the window to zero. Box/cylinder
 *  walls don't pass this (they call `windowRect` with the default fixed
 *  margins below), so their output is unchanged. */
function scaledWindowMargins(heightM: number): WindowMargins {
  return {
    sillM: Math.min(WINDOW_SILL_M, heightM * 0.45),
    lintelM: Math.min(WINDOW_LINTEL_MARGIN_M, heightM * 0.15),
  };
}

function windowRect(
  facadeWidth: number,
  heightM: number,
  wwr: number,
  margins: WindowMargins = FIXED_WINDOW_MARGINS,
): WindowRect | null {
  if (wwr <= 0 || facadeWidth <= 0 || heightM <= 0) return null;

  const area = wwr * facadeWidth * heightM;
  let height = Math.sqrt(area / WINDOW_ASPECT);
  let width = height * WINDOW_ASPECT;

  const maxWidth = Math.max(0, facadeWidth - 2 * WINDOW_MARGIN_SIDE_M);
  const maxHeight = Math.max(0, heightM - margins.sillM - margins.lintelM);
  width = Math.min(width, maxWidth);
  height = Math.min(height, maxHeight);
  if (width <= 0 || height <= 0) return null;

  return { width, height, sill: margins.sillM };
}

/** 12 wall facets at `-150 + k*30`, each a flat side of the regular 12-gon
 *  whose APOTHEM (flat-to-flat radius, Building.tsx places each facet's
 *  exterior face at exactly this distance) is `lengthM/2` — mirrors
 *  `cylinderGeometry` (assemble.ts), whose facet AREA uses the
 *  circumference/12 arc-length approximation instead; for a flat-panel
 *  renderer (no CSG) an apothem-r polygon (side = `2*r*tan(180/N)`, the
 *  standard apothem->side formula) is the natural visual analogue, close to
 *  the arc for 12 sectors (~1% long, vs ~1% short for a chord-of-circumradius-r
 *  polygon — the mitre placement in Building.tsx is what fixes this choice,
 *  not the reverse, so this MUST use tan, not sin). */
function cylinderWalls(design: ShelterDesign): WallGeometry[] {
  const r = design.lengthM / 2;
  const halfAngleDeg = 180 / CYLINDER_SECTORS;
  const chord = 2 * r * Math.tan(halfAngleDeg * DEG2RAD);
  return ringAzimuths(CYLINDER_SECTORS).map((azimuthDeg) => {
    const orientation = orientationForAzimuth(azimuthDeg);
    return {
      orientation,
      azimuthDeg,
      facadeWidth: chord,
      window: windowRect(chord, design.heightM, design.windowWwr[orientation]),
    };
  });
}

/** 3 bands × 12 sectors, mirroring `domeGeometry` (assemble.ts) exactly:
 *  equal-HEIGHT bands (`dz = r/3`), tilt from the band's mid-HEIGHT
 *  elevation, `tiltDeg >= 60` -> wall (can host a window), else roof. */
function domeFacetsFor(design: ShelterDesign): DomeFacet[] {
  const r = design.lengthM / 2;
  const dz = r / DOME_BANDS;
  const halfAngleDeg = 180 / DOME_SECTORS;
  const azimuths = ringAzimuths(DOME_SECTORS);
  const facets: DomeFacet[] = [];

  for (let band = 0; band < DOME_BANDS; band++) {
    const heightLow = band * dz;
    const heightHigh = (band + 1) * dz;
    const zMid = (band + 0.5) * dz;
    const elevationMidDeg = (Math.asin(zMid / r) * 180) / Math.PI;
    const tiltDeg = 90 - elevationMidDeg;
    const kind: 'wall' | 'roof' = tiltDeg >= DOME_WALL_TILT_THRESHOLD_DEG ? 'wall' : 'roof';
    const radiusLow = Math.sqrt(Math.max(0, r * r - heightLow * heightLow));
    const radiusHigh = Math.sqrt(Math.max(0, r * r - heightHigh * heightHigh));
    // Slant height and chord width, both approximated from the two rings'
    // scalar radii (not the true chord-midpoint distance) — a window-fit
    // heuristic, not a precision figure; windowRect's own margins absorb it.
    const slantHeight = Math.hypot(radiusHigh - radiusLow, heightHigh - heightLow);
    const chordEstimate = 2 * Math.min(radiusLow, radiusHigh) * Math.sin(halfAngleDeg * DEG2RAD);

    for (let k = 0; k < azimuths.length; k++) {
      const azimuthDeg = azimuths[k]!;
      const orientation = orientationForAzimuth(azimuthDeg);
      facets.push({
        id: `${kind}D${band}S${k}`,
        kind,
        orientation,
        azimuthDeg,
        band,
        tiltDeg,
        radiusLow,
        radiusHigh,
        heightLow,
        heightHigh,
        window:
          kind === 'wall'
            ? windowRect(chordEstimate, slantHeight, design.windowWwr[orientation], scaledWindowMargins(slantHeight))
            : null,
      });
    }
  }
  return facets;
}

/** ShelterDesign -> scene geometry. Cheap to call; memoise on (design, options)
 *  in the component that owns the render (ShelterViewer does). */
export function buildSceneGeometry(design: ShelterDesign, options: Options): SceneGeometry {
  const preset = options.presets.find((p) => p.id === design.presetId);

  const wallThicknessM = resolveThickness(design.wallConstruction, preset?.thicknessM.wall);
  const roofThicknessM = resolveThickness(design.roofConstruction, preset?.thicknessM.roof);
  const floorThicknessM = resolveThickness(design.floorConstruction, preset?.thicknessM.floor);
  const shape: Shape = design.shape ?? 'box';
  const storeys: Storeys = design.storeys ?? 1;

  const base = {
    shape,
    storeys,
    lengthM: design.lengthM,
    widthM: design.widthM,
    heightM: design.heightM,
    wallThicknessM,
    roofThicknessM,
    floorThicknessM,
    rotationY: -design.azimuthDeg * DEG2RAD,
  };

  if (shape === 'dome') {
    return { ...base, buildingHeightM: design.lengthM / 2, walls: [], domeFacets: domeFacetsFor(design) };
  }
  if (shape === 'cylinder') {
    return { ...base, buildingHeightM: design.heightM * storeys, walls: cylinderWalls(design), domeFacets: [] };
  }

  // box (default) — byte-identical to the pre-G3 function (condition 1:
  // "unchanged output for a box design").
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

  return { ...base, buildingHeightM: design.heightM * storeys, walls, domeFacets: [] };
}
