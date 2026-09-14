/**
 * Turning a building into a node graph. WORKERS.md W-08.
 *
 * Node ordering, fixed for the life of a run:
 *   [0]              indoor air
 *   [1]              mean-radiant star node (zero capacitance -- an algebraic row)
 *   [2 .. ]          each surface's through-thickness chain, EXTERIOR -> INTERIOR
 *
 * Everything downstream indexes through `SurfaceNodes`, so nothing else needs to
 * know this layout.
 */

import { buildWallMesh, type WallMesh } from '../envelope/mesh.js';
import { skyViewFactor } from '../surfaces/exterior.js';
import { EngineError } from '../types.js';
import type { Building, Glazing, Material, Surface, WindowSpec } from '../types.js';

export const AIR_NODE = 0;
export const STAR_NODE = 1;
export const FIRST_SURFACE_NODE = 2;

export interface SurfaceNodes {
  surface: Surface;
  mesh: WallMesh;
  /** Global index of the exterior-face node. */
  first: number;
  /** Global index of the interior-face node. */
  last: number;
  /** Effective azimuth after whole-building rotation, degrees from south. */
  azimuth: number;
  skyViewFactor: number;
  /** Windows hosted on this surface. */
  windows: WindowSpec[];
  /** Opaque area, net of its windows. */
  opaqueArea: number;
}

export interface Model {
  n: number;
  surfaces: SurfaceNodes[];
  /** Capacitance of every node, J/K. Node STAR_NODE is 0 by construction. */
  C: Float64Array;
  /** Total interior surface area, m^2. Used for radiant area weighting. */
  totalInteriorArea: number;
  /** Interior area of floor surfaces, m^2. Transmitted solar lands mostly here. */
  floorArea: number;
  materials: Record<string, Material>;
  glazings: Record<string, Glazing>;
}

export function buildModel(
  building: Building,
  materials: Record<string, Material>,
  glazings: Record<string, Glazing>,
  targetDx: number,
): Model {
  if (building.surfaces.length === 0) {
    throw new EngineError('GEOMETRY_INCONSISTENT', 'The building has no surfaces.');
  }

  const windowsBySurface = new Map<string, WindowSpec[]>();
  for (const w of building.windows) {
    if (!glazings[w.glazingId]) {
      throw new EngineError('UNKNOWN_GLAZING', `No glazing with id "${w.glazingId}".`, { glazingId: w.glazingId });
    }
    const list = windowsBySurface.get(w.hostSurfaceId) ?? [];
    list.push(w);
    windowsBySurface.set(w.hostSurfaceId, list);
  }
  const surfaceIds = new Set(building.surfaces.map((s) => s.id));
  for (const w of building.windows) {
    if (!surfaceIds.has(w.hostSurfaceId)) {
      throw new EngineError('GEOMETRY_INCONSISTENT', `Window "${w.id}" is hosted on unknown surface "${w.hostSurfaceId}".`);
    }
  }

  const surfaces: SurfaceNodes[] = [];
  let cursor = FIRST_SURFACE_NODE;
  for (const s of building.surfaces) {
    const mesh = buildWallMesh(s.construction, materials, targetDx);
    const windows = windowsBySurface.get(s.id) ?? [];
    const windowArea = windows.reduce((a, w) => a + w.area, 0);
    const opaqueArea = s.area - windowArea;
    if (opaqueArea <= 0) {
      throw new EngineError(
        'GEOMETRY_INCONSISTENT',
        `Surface "${s.id}" is ${s.area} m2 but carries ${windowArea} m2 of glazing. Windows cannot fill or exceed their host surface.`,
      );
    }
    surfaces.push({
      surface: s,
      mesh,
      first: cursor,
      last: cursor + mesh.n - 1,
      azimuth: normaliseAzimuth(s.azimuth + building.azimuth),
      skyViewFactor: skyViewFactor(s.tilt),
      windows,
      opaqueArea,
    });
    cursor += mesh.n;
  }

  const n = cursor;
  const C = new Float64Array(n);
  let totalInteriorArea = 0;
  let floorArea = 0;
  for (const sn of surfaces) {
    for (let i = 0; i < sn.mesh.n; i++) {
      C[sn.first + i] = sn.mesh.C[i]! * sn.opaqueArea;
    }
    totalInteriorArea += sn.opaqueArea;
    if (sn.surface.type === 'floor') floorArea += sn.opaqueArea;
  }
  // The star node deliberately has zero capacitance: it is a fictitious radiant
  // temperature, not a physical mass. Its matrix row is an algebraic balance.
  C[STAR_NODE] = 0;

  return { n, surfaces, C, totalInteriorArea, floorArea, materials, glazings };
}

/** Wrap an azimuth into (-180, 180]. */
export function normaliseAzimuth(a: number): number {
  let x = ((a + 180) % 360 + 360) % 360 - 180;
  if (x === -180) x = 180;
  return x;
}
