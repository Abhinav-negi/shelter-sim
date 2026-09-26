import type { ShelterDesign } from '@shelter/studio-server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { previewSimulation } from './simulate';

function jsonResponse(body: unknown): Response {
  return { ok: true, text: async () => JSON.stringify(body) } as Response;
}

const design: ShelterDesign = {
  location: { kind: 'preset', id: 'leh' },
  date: '2023-01-15',
  presetId: 'traditionalLadakhiByre',
  lengthM: 8,
  widthM: 5,
  heightM: 3,
  azimuthDeg: 0,
  wallConstruction: null,
  roofConstruction: null,
  floorConstruction: null,
  windowWwr: { S: 0.2, E: 0.1, W: 0.1, N: 0.05 },
  glazingId: 'doubleClear',
  nightShutters: true,
  occupancyPresetId: 'familyLivestock',
};

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn());
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('simulate wrapper', () => {
  it('previewSimulation POSTs the whole ShelterDesign as the body', async () => {
    const response = { kpis: {}, result: {} };
    vi.mocked(fetch).mockResolvedValue(jsonResponse(response));
    const result = await previewSimulation(design);
    expect(fetch).toHaveBeenCalledWith('/api/simulate/preview', {
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      method: 'POST',
      body: JSON.stringify(design),
    });
    expect(result).toEqual(response);
  });

  it('carries weatherProvenance through for a custom location', async () => {
    const response = {
      kpis: {},
      result: {},
      weatherProvenance: { source: 'open-meteo', year: 2023, notes: ['note'] },
    };
    vi.mocked(fetch).mockResolvedValue(jsonResponse(response));
    const result = await previewSimulation({
      ...design,
      location: { kind: 'custom', name: 'Base camp', lat: 34.1, lon: 77.5, elevation: 3500 },
    });
    expect(result.weatherProvenance).toEqual(response.weatherProvenance);
  });
});
