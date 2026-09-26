// apps/studio-server/test/weather.geocode.test.ts — condition 1:
// GET /api/locations/search?q= against a recorded Open-Meteo geocoding
// fixture (test/fixtures/geocode-shimla.json), no live network.

import { describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';
import { geocodeUrl } from '../src/weather/geocode.js';
import { jsonResponse, loadFixture } from './helpers/fetch.js';

const GEOCODE_FIXTURE = loadFixture('geocode-shimla.json');

describe('GET /api/locations/search', () => {
  it('returns [{name,country,admin1,lat,lon,elevation}] (<=8) from the geocoding fixture', async () => {
    const app = buildApp({ fetchImpl: (async () => jsonResponse(GEOCODE_FIXTURE)) as unknown as typeof fetch });
    const res = await app.inject({ method: 'GET', url: '/api/locations/search?q=Shimla' });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(Array.isArray(body)).toBe(true);
    expect(body.length).toBeLessThanOrEqual(8);
    expect(body[0]).toMatchObject({
      name: 'Shimla',
      country: 'India',
      admin1: 'Himachal Pradesh',
      lat: 31.10442,
      lon: 77.16662,
    });
    expect(typeof body[0].elevation).toBe('number');
  });

  it('blank q returns [] with no upstream call', async () => {
    let called = false;
    const app = buildApp({
      fetchImpl: (async () => {
        called = true;
        throw new Error('should not be called for a blank query');
      }) as unknown as typeof fetch,
    });
    const res = await app.inject({ method: 'GET', url: '/api/locations/search?q=' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual([]);
    expect(called).toBe(false);
  });

  it('upstream non-2xx -> 502 UPSTREAM_UNAVAILABLE', async () => {
    const app = buildApp({
      fetchImpl: (async () => jsonResponse({}, false, 503)) as unknown as typeof fetch,
    });
    const res = await app.inject({ method: 'GET', url: '/api/locations/search?q=Shimla' });
    expect(res.statusCode).toBe(502);
    expect(res.json().code).toBe('UPSTREAM_UNAVAILABLE');
  });

  it('upstream network error -> 502 UPSTREAM_UNAVAILABLE', async () => {
    const app = buildApp({
      fetchImpl: (async () => {
        throw new Error('boom');
      }) as unknown as typeof fetch,
    });
    const res = await app.inject({ method: 'GET', url: '/api/locations/search?q=Shimla' });
    expect(res.statusCode).toBe(502);
    expect(res.json().code).toBe('UPSTREAM_UNAVAILABLE');
  });

  it('geocodeUrl carries q, count=8 and format=json', () => {
    const url = geocodeUrl('Leh');
    expect(url).toContain('name=Leh');
    expect(url).toContain('count=8');
    expect(url).toContain('format=json');
  });
});
