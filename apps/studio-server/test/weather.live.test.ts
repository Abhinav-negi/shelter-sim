// apps/studio-server/test/weather.live.test.ts — condition 5's one optional
// live smoke test: a real network call against the real Open-Meteo
// geocoding + archive APIs (global fetch, no fixture). Skipped unless
// LIVE=1 so the default `npm test` never touches the network.

import { describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';
import { buildOptions } from '../src/options.js';

describe.skipIf(process.env['LIVE'] !== '1')('live smoke (LIVE=1 only)', () => {
  it('GET /api/locations/search?q=Shimla hits the real Open-Meteo geocoding API', async () => {
    const app = buildApp();
    const res = await app.inject({ method: 'GET', url: '/api/locations/search?q=Shimla' });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.length).toBeGreaterThan(0);
    expect(body[0]).toHaveProperty('lat');
    expect(body[0]).toHaveProperty('lon');
  }, 30_000);

  it('POST /api/simulate/preview for a real custom location (Shimla) hits the real archive API', async () => {
    const app = buildApp();
    const { defaults } = buildOptions();
    const res = await app.inject({
      method: 'POST',
      url: '/api/simulate/preview',
      payload: {
        ...defaults,
        location: { kind: 'custom', name: 'Shimla', lat: 31.10442, lon: 77.16662, elevation: 2073 },
      },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().weatherProvenance.source).toMatch(/open-meteo|nasa-power/);
  }, 60_000);
});
