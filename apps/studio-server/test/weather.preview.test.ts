// apps/studio-server/test/weather.preview.test.ts — condition 4:
// POST /api/simulate/preview for a custom location returns
// weatherProvenance {source, year, notes[]} listing the assumptions
// (meridian, albedo), end to end through the real route (not just
// resolveCustomWeather in isolation).

import { describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';
import { buildOptions } from '../src/options.js';
import { jsonResponse, loadFixture } from './helpers/fetch.js';

const OPEN_METEO_FIXTURE = loadFixture('open-meteo-shimla-2023.json');

describe('POST /api/simulate/preview — custom location', () => {
  it('200 with {kpis, result, weatherProvenance} for a custom (Shimla) location', async () => {
    const app = buildApp({
      fetchImpl: (async () => jsonResponse(OPEN_METEO_FIXTURE)) as unknown as typeof fetch,
    });
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
    const body = res.json();
    expect(body.kpis).toBeDefined();
    expect(body.result.kpis).toBeDefined();
    expect(body.weatherProvenance).toBeDefined();
    expect(body.weatherProvenance.source).toBe('open-meteo');
    expect(body.weatherProvenance.year).toBe(2023);
    expect(Array.isArray(body.weatherProvenance.notes)).toBe(true);
    expect(body.weatherProvenance.notes.some((n: string) => n.includes('standardMeridian'))).toBe(true);
    expect(body.weatherProvenance.notes.some((n: string) => n.includes('groundAlbedo'))).toBe(true);
  });

  it('a preset location gets no weatherProvenance (unaffected by P3)', async () => {
    const app = buildApp();
    const { defaults } = buildOptions();
    const res = await app.inject({ method: 'POST', url: '/api/simulate/preview', payload: defaults });
    expect(res.statusCode).toBe(200);
    expect(res.json().weatherProvenance).toBeUndefined();
  });
});
