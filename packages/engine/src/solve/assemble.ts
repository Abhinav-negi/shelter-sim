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
import { storageNodeSpec } from '../storage/waterMass.js';
import { EngineError } from '../types.js';
import type { Building, Glazing, Material, StorageElement, Surface, WindowSpec } from '../types.js';
import type { Kelvin } from '../units.js';

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

/**
 * One allocated node per `Building.storageElements` entry (T-20), placed after
 * every surface's through-thickness chain. Coupled ONLY to the air node
 * (`solve/integrator.ts` adds a symmetric `conductanceToRoom` link there) --
 * no radiative coupling, no surface coupling, per the task's own cut list.
 */
export interface StorageNode {
  element: StorageElement;
  material: Material;
  /** Global node index. */
  index: number;
  /**
   * Seed capacitance, J/K, used only to initialise `Model.C`. For 'water' and
   * 'rock' this is the true, constant, run-long value. For 'pcm' it is a
   * bootstrap guess (evaluated at `meltPoint`): `solve/integrator.ts`
   * re-evaluates the real, state-dependent value at every coefficient
   * refresh and that value -- never this seed -- is what the solver actually
   * uses (T-19's apparent-heat-capacity contract).
   */
  capacityJPerK: number;
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
  /** One entry per `Building.storageElements`, in the same order. */
  storageNodes: StorageNode[];
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

  // T-20: one node per storage element, allocated after every surface chain.
  const storageNodes: StorageNode[] = (building.storageElements ?? []).map((el) => {
    // Seed temp only (see StorageNode.capacityJPerK doc); meltPoint is a
    // physically reasonable bootstrap guess for 'pcm', unused otherwise.
    const seedTemp = (el.kind === 'pcm' ? el.meltPoint : undefined) ?? (293.15 as Kelvin);
    const spec = storageNodeSpec(el, materials, seedTemp);
    const node: StorageNode = { element: el, material: materials[el.materialId]!, index: cursor, capacityJPerK: spec.capacityJPerK };
    cursor += 1;
    return node;
  });

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
  for (const sn of storageNodes) C[sn.index] = sn.capacityJPerK;

  return { n, surfaces, C, totalInteriorArea, floorArea, materials, glazings, storageNodes };
}

/** Wrap an azimuth into (-180, 180]. */
export function normaliseAzimuth(a: number): number {
  let x = ((a + 180) % 360 + 360) % 360 - 180;
  if (x === -180) x = 180;
  return x;
}
