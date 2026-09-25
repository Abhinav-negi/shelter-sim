import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getHealth } from './health';

function jsonResponse(body: unknown): Response {
  return { ok: true, text: async () => JSON.stringify(body) } as Response;
}

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn());
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('health wrapper', () => {
  it('getHealth GETs /health', async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse({ ok: true }));
    const result = await getHealth();
    expect(fetch).toHaveBeenCalledWith('/api/health', {
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
    });
    expect(result).toEqual({ ok: true });
  });
});
