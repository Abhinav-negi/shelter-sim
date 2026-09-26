import { get } from './client';

export interface HealthResponse {
  ok: true;
}

export const getHealth = () => get<HealthResponse>('/health');
