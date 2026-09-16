/**
 * Discrete thermal storage nodes: water drums, rock beds, PCM packs. T-20.
 * LOG.md `### [~] T-20`; `StorageElement` itself is T-06's, `types.ts`.
 *
 * LUMPED-NODE JUSTIFICATION (per-element, not a mesh): a water drum is kept
 * near-isothermal by its own internal natural convection (buoyancy-driven
 * mixing inside the liquid as it heats/cools), not by conduction alone -- so
 * the relevant internal transport is far faster than the drum's own
 * conduction-only Biot number would suggest. A rock bed or PCM pack is
 * physically thin in its short dimension by design (both are sized precisely
 * so they respond within a day). One well-mixed lumped node is therefore the
 * right model for all three kinds here, the same simplification
 * `envelope/mesh.ts` makes for a single wall slice, just taken to its limit of
 * one node.
 * CEILING (rule 13): a tall, unstirred water tank can stratify (hot water
 * floats), which this single node cannot represent. Upgrade path: a vertical
 * stack of 2-4 lumped nodes coupled by conduction, if a design ever needs it.
 */

import { apparentHeatCapacity } from './pcm.js';
import { EngineError } from '../types.js';
import type { Material, StorageElement } from '../types.js';
import type { Kelvin } from '../units.js';

export interface StorageNodeSpec {
  id: string;
  /** J/K. `massKg * c` for water/rock; `massKg * apparentHeatCapacity(...)` for PCM. */
  capacityJPerK: number;
  /** W/K, copied from `StorageElement.conductanceToRoom`. */
  conductanceToRoom: number;
  kind: 'water' | 'pcm' | 'rock';
}

/**
 * `nodeTemp` only matters for `kind: 'pcm'`, where capacity is a function of
 * the node's own current temperature (T-19's apparent-heat-capacity method,
 * `storage/pcm.ts` -- imported, never reimplemented here).
 */
export function storageNodeSpec(
  el: StorageElement,
  materials: Record<string, Material>,
  nodeTemp: Kelvin,
): StorageNodeSpec {
  const material = materials[el.materialId];
  if (!material) {
    throw new EngineError(
      'UNKNOWN_MATERIAL',
      `Storage element "${el.id}" references unknown material "${el.materialId}".`,
      { materialId: el.materialId },
    );
  }

  let capacityJPerK: number;
  if (el.kind === 'pcm') {
    if (el.latentHeat === undefined || el.meltPoint === undefined) {
      throw new EngineError(
        'INVALID_INPUT',
        `PCM storage element "${el.id}" is missing latentHeat or meltPoint.`,
      );
    }
    const meltRangeK = el.meltRangeK ?? 3; // default per types.ts's own doc comment
    const cApparent = apparentHeatCapacity(material.c, el.latentHeat, el.meltPoint, meltRangeK, nodeTemp);
    capacityJPerK = el.massKg * cApparent;
  } else {
    capacityJPerK = el.massKg * material.c; // water or rock: constant specific heat
  }

  return { id: el.id, capacityJPerK, conductanceToRoom: el.conductanceToRoom, kind: el.kind };
}
