// apps/studio-server/src/providers/index.ts — the simulation seam
// (PLAN.md "Server"). Routes call a provider, never `simulate` directly, so
// a future ANSYS/high-fidelity provider can be added as a second
// implementation without touching route code. No fake/mock provider here --
// `fastPhysics` is the one real implementation, wrapping @shelter/engine.

import { simulate } from '@shelter/engine';
import type { SimulationKpis, SimulationRequest, SimulationResult } from '@shelter/engine';

export interface SimulationProvider {
  id: string;
  run(req: SimulationRequest): Promise<{ kpis: SimulationKpis; result: SimulationResult }>;
}

export const fastPhysics: SimulationProvider = {
  id: 'fast-physics',
  async run(req) {
    const result = simulate(req);
    return { kpis: result.kpis, result };
  },
};
