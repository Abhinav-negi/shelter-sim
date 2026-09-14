/**
 * Slicing a wall through its thickness. ENGINE_BLUEPRINT.md 5.5, BLUEPRINT.md 5.6.
 * WORKERS.md W-06, W-07.
 *
 * THIS IS THE HEART OF THE ENGINE. A wall modelled as a single lump responds
 * instantly to a temperature difference. A real 300 mm wall delays heat by ~7.6
 * hours and damps the swing to ~14%. That delay is the entire mechanism by which
 * a passive shelter survives the night, so the mesh is what makes the model able
 * to answer DRDO's question at all.
 *
 * ---------------------------------------------------------------------------
 * NODE PLACEMENT -- and why the harmonic-mean warning does not apply here.
 *
 * BLUEPRINT.md 5.6.4 warns to use a harmonic (series) conductance at layer
 * interfaces and never an arithmetic mean of k. That warning is correct for a
 * mesh whose nodes sit at CONTROL-VOLUME CENTRES, where an interface falls
 * between two nodes made of different materials.
 *
 * This mesh instead places nodes ON the interfaces (and on both outer faces).
 * Every edge therefore lies wholly inside ONE material, so its conductance is
 * simply k/dx, and the series resistance across a layer sums to exactly L/k.
 * The steady-state U-value is then analytically exact rather than approximated,
 * and the arithmetic-vs-harmonic bug is structurally impossible rather than
 * merely guarded against. Capacitance at a shared interface node is the sum of
 * the half control volumes from each side, so total capacitance is exactly
 * sum(rho*c*L) over the layers.
 * ---------------------------------------------------------------------------
 */

import { EngineError } from '../types.js';
import type { Layer, Material } from '../types.js';

export interface WallMesh {
  /** Number of nodes. Node 0 is the exterior face, node n-1 the interior face. */
  n: number;
  /** Capacitance per unit area of each node, J/(m^2*K). */
  C: Float64Array;
  /** Conductance between node i and node i+1, W/(m^2*K). Length n-1. */
  U: Float64Array;
  /** Depth of each node from the exterior face, m. Diagnostics and profiles. */
  x: Float64Array;
  /** Total thickness, m. */
  thickness: number;
  /** Steady-state fabric conductance excluding surface films, W/(m^2*K). */
  fabricU: number;
}

/** Thermal diffusivity, m^2/s. Controls how fast a disturbance propagates -> LAG. */
export const diffusivity = (m: Material): number => m.k / (m.rho * m.c);

/**
 * Diurnal penetration depth, m: how far a 24 h thermal wave reaches into a material.
 * d = sqrt(a*P/pi). Dense concrete gives ~0.151 m.
 */
export function penetrationDepth(m: Material, periodSeconds = 86400): number {
  return Math.sqrt((diffusivity(m) * periodSeconds) / Math.PI);
}

/**
 * Maximum slices per layer. Purely a guard against a pathological input blowing
 * up the node count; it must stay high enough that the penetration-depth rule
 * below is never the thing being clamped for any realistic wall.
 *
 * It was 24, which silently defeated the resolution rule on thick walls: a 1 m
 * rammed-earth or earth-bermed wall wants ~40 slices, got 24, and produced a
 * ~3% error in decrement factor with no warning. Earth-bermed construction is
 * exactly the Ladakh case, so that failure mode was pointed at the most
 * important geometry in the project.
 */
const MAX_SLICES_PER_LAYER = 80;

/**
 * Slice count for one layer. The mesh must resolve the daily wave, so we want at
 * least ~5 nodes per penetration depth, bounded so a thin skin still gets a few
 * nodes and a pathological input cannot explode the node count.
 */
export function sliceCount(layer: Layer, m: Material, targetDx: number): number {
  const d = penetrationDepth(m);
  const dxWave = d / 5;
  const dx = Math.min(targetDx, dxWave);
  return Math.max(2, Math.min(MAX_SLICES_PER_LAYER, Math.ceil(layer.thickness / dx)));
}

/** Build the node chain for one construction, ordered EXTERIOR -> INTERIOR. */
export function buildWallMesh(
  construction: Layer[],
  materials: Record<string, Material>,
  targetDx = 0.02,
): WallMesh {
  if (construction.length === 0) {
    throw new EngineError('GEOMETRY_INCONSISTENT', 'A construction must have at least one layer.');
  }

  // Per-layer slice geometry.
  const slices = construction.map((layer) => {
    const m = materials[layer.materialId];
    if (!m) {
      throw new EngineError('UNKNOWN_MATERIAL', `No material with id "${layer.materialId}".`, {
        materialId: layer.materialId,
      });
    }
    if (!(layer.thickness > 0)) {
      throw new EngineError('GEOMETRY_INCONSISTENT', `Layer "${layer.materialId}" has non-positive thickness.`);
    }
    const N = sliceCount(layer, m, targetDx);
    return { m, N, dx: layer.thickness / N, thickness: layer.thickness };
  });

  // Nodes: one at the exterior face, then N per layer (the last of each layer sits
  // on the interface with the next, and is shared).
  const n = 1 + slices.reduce((acc, s) => acc + s.N, 0);
  const C = new Float64Array(n);
  const U = new Float64Array(n - 1);
  const x = new Float64Array(n);

  let node = 0;
  let depth = 0;
  for (const s of slices) {
    const halfC = s.m.rho * s.m.c * (s.dx / 2);
    const edgeU = s.m.k / s.dx;
    for (let i = 0; i < s.N; i++) {
      // Each control volume contributes half its capacitance to the node on each
      // of its two faces. A node shared by two layers therefore accumulates a
      // half-volume from each side, which is exactly what we want.
      C[node] = C[node]! + halfC;
      C[node + 1] = C[node + 1]! + halfC;
      U[node] = edgeU;
      depth += s.dx;
      x[node + 1] = depth;
      node++;
    }
  }

  // Series resistance of the fabric alone -- exact, since every edge is single-material.
  let R = 0;
  for (let i = 0; i < n - 1; i++) R += 1 / U[i]!;

  return { n, C, U, x, thickness: depth, fabricU: 1 / R };
}

/**
 * Steady-state U-value of a construction including surface films, W/(m^2*K).
 * R_total = 1/h_o + sum(L/k) + 1/h_i. Used by validation Test 3 and by the UI.
 */
export function constructionUValue(mesh: WallMesh, hOuter: number, hInner: number): number {
  return 1 / (1 / hOuter + 1 / mesh.fabricU + 1 / hInner);
}

/**
 * Analytical decrement factor and time lag for a homogeneous semi-infinite solid
 * driven by a sinusoid of period P. BLUEPRINT.md 5.6.5 / validation Test 2.
 *
 * This is the closed form the numerical solver has to reproduce, and it is the
 * strongest evidence the engine is right -- an analytical solution cannot itself
 * be buggy the way a reference program can.
 */
export function analyticalWavePenetration(
  m: Material,
  depthM: number,
  periodSeconds = 86400,
): { decrement: number; lagHours: number; penetrationDepth: number } {
  const omega = (2 * Math.PI) / periodSeconds;
  const d = Math.sqrt((2 * diffusivity(m)) / omega);
  return {
    decrement: Math.exp(-depthM / d),
    lagHours: depthM / d / omega / 3600,
    penetrationDepth: d,
  };
}
