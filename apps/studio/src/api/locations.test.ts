import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { searchLocations } from './locations';

function jsonResponse(body: unknown): Response {
  return { ok: true, text: async () => JSON.stringify(body) } as Response;
}

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn());
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('locations wrapper', () => {
  it('searchLocations GETs /locations/search?q= with the query encoded', async () => {
    const results = [{ name: 'Leh', country: 'India', lat: 34.16, lon: 77.58, elevation: 3500 }];
    vi.mocked(fetch).mockResolvedValue(jsonResponse(results));
    const result = await searchLocations('Leh, IN');
    expect(fetch).toHaveBeenCalledWith('/api/locations/search?q=Leh%2C%20IN', {
      credentials: 'same-origin',
    });
    expect(result).toEqual(results);
  });
});
