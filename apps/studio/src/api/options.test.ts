import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getOptions } from './options';

function jsonResponse(body: unknown): Response {
  return { ok: true, text: async () => JSON.stringify(body) } as Response;
}

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn());
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('options wrapper', () => {
  it('getOptions GETs /options', async () => {
    const options = { locations: [], presets: [], materials: [], glazings: [], occupancyPresets: [] };
    vi.mocked(fetch).mockResolvedValue(jsonResponse(options));
    const result = await getOptions();
    expect(fetch).toHaveBeenCalledWith('/api/options', {
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
    });
    expect(result).toEqual(options);
  });
});
