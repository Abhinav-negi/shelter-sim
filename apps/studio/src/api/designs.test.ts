import type { ShelterDesign } from '@shelter/studio-server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createDesign,
  deleteDesign,
  getDesign,
  getSimulation,
  listDesigns,
  listSimulations,
  runSimulation,
  updateDesign,
} from './designs';

function jsonResponse(body: unknown): Response {
  return { ok: true, text: async () => JSON.stringify(body) } as Response;
}
function emptyResponse(): Response {
  return { ok: true, text: async () => '' } as Response;
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

const summary = { id: 'd1', name: 'Byre', design, createdAt: '2024-01-01T00:00:00Z', updatedAt: '2024-01-01T00:00:00Z' };

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn());
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('designs wrappers', () => {
  it('listDesigns GETs /designs', async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse([summary]));
    const result = await listDesigns();
    expect(fetch).toHaveBeenCalledWith('/api/designs', {
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
    });
    expect(result).toEqual([summary]);
  });

  it('createDesign POSTs {name, design}', async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse(summary));
    await createDesign('Byre', design);
    expect(fetch).toHaveBeenCalledWith('/api/designs', {
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      method: 'POST',
      body: JSON.stringify({ name: 'Byre', design }),
    });
  });

  it('getDesign GETs /designs/:id', async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse(summary));
    await getDesign('d1');
    expect(fetch).toHaveBeenCalledWith('/api/designs/d1', {
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
    });
  });

  it('updateDesign PUTs the whole {name, design} replacement', async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse(summary));
    await updateDesign('d1', 'Byre v2', design);
    expect(fetch).toHaveBeenCalledWith('/api/designs/d1', {
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      method: 'PUT',
      body: JSON.stringify({ name: 'Byre v2', design }),
    });
  });

  it('deleteDesign DELETEs /designs/:id with no body', async () => {
    vi.mocked(fetch).mockResolvedValue(emptyResponse());
    await deleteDesign('d1');
    expect(fetch).toHaveBeenCalledWith('/api/designs/d1', {
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      method: 'DELETE',
    });
  });

  it('runSimulation POSTs /designs/:id/simulations with no body', async () => {
    const full = { ...summary, id: 's1', designId: 'd1', provider: 'fast-physics', result: {} };
    vi.mocked(fetch).mockResolvedValue(jsonResponse(full));
    const result = await runSimulation('d1');
    expect(fetch).toHaveBeenCalledWith('/api/designs/d1/simulations', {
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      method: 'POST',
    });
    expect(result).toEqual(full);
  });

  it('listSimulations GETs /designs/:id/simulations', async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse([]));
    await listSimulations('d1');
    expect(fetch).toHaveBeenCalledWith('/api/designs/d1/simulations', {
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
    });
  });

  it('getSimulation GETs /simulations/:id', async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse({ ...summary, result: {} }));
    await getSimulation('s1');
    expect(fetch).toHaveBeenCalledWith('/api/simulations/s1', {
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
    });
  });
});
