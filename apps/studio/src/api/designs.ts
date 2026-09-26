// Designs + simulations routes, API.md §8/§9. Shapes are typed from
// @shelter/studio-server (DesignSummary, SimulationSummary, SimulationFull),
// never hand-copied (condition 2).
import type { DesignSummary, ShelterDesign, SimulationFull, SimulationSummary } from '@shelter/studio-server';
import { del, get, post, put } from './client';

export const listDesigns = () => get<DesignSummary[]>('/designs');

export const createDesign = (name: string, design: ShelterDesign) =>
  post<DesignSummary>('/designs', { name, design });

export const getDesign = (id: string) => get<DesignSummary>(`/designs/${id}`);

/** Whole replacement, same schema as POST (API.md §8). */
export const updateDesign = (id: string, name: string, design: ShelterDesign) =>
  put<DesignSummary>(`/designs/${id}`, { name, design });

export const deleteDesign = (id: string) => del<void>(`/designs/${id}`);

export const runSimulation = (designId: string) =>
  post<SimulationFull>(`/designs/${designId}/simulations`);

export const listSimulations = (designId: string) =>
  get<SimulationSummary[]>(`/designs/${designId}/simulations`);

export const getSimulation = (id: string) => get<SimulationFull>(`/simulations/${id}`);
