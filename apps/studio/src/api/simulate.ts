import type { PreviewResponse, ShelterDesign } from '@shelter/studio-server';
import { post } from './client';

/** Not persisted — see api/designs.ts for the saved-run equivalent. */
export const previewSimulation = (design: ShelterDesign) =>
  post<PreviewResponse>('/simulate/preview', design);
