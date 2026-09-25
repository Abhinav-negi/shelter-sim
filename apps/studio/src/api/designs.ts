// Designs + simulations routes are P2's to implement (API.md §7 "planned routes");
// shapes below follow PLAN.md's `designs`/`simulations` collections. Update
// alongside API.md if P2 lands a different shape.
import type { SimulationKpis } from '@shelter/engine';
import type { PreviewResponse, ShelterDesign } from '@shelter/studio-server';
import { del, get, post, put } from './client';

export interface DesignRecord {
  id: string;
  ownerId: string;
  name: string;
  design: ShelterDesign;
  createdAt: string;
  updatedAt: string;
}

export const listDesigns = () => get<DesignRecord[]>('/designs');

export const createDesign = (name: string, design: ShelterDesign) =>
  post<DesignRecord>('/designs', { name, design });

export const getDesign = (id: string) => get<DesignRecord>(`/designs/${id}`);

export const updateDesign = (id: string, patch: Partial<Pick<DesignRecord, 'name' | 'design'>>) =>
  put<DesignRecord>(`/designs/${id}`, patch);

export const deleteDesign = (id: string) => del<{ ok: true }>(`/designs/${id}`);

export interface SimulationRecord {
  id: string;
  ownerId: string;
  designId: string;
  provider: string;
  engineVersion: string;
  requestHash: string;
  kpis: SimulationKpis;
  createdAt: string;
}

export const runSimulation = (designId: string) =>
  post<PreviewResponse & { id: string }>(`/designs/${designId}/simulations`);

export const listSimulations = (designId: string) =>
  get<SimulationRecord[]>(`/designs/${designId}/simulations`);

export const getSimulation = (id: string) =>
  get<SimulationRecord & { result: unknown }>(`/simulations/${id}`);
