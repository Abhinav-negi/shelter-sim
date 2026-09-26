import { describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';
import { buildOptions } from '../src/options.js';

describe('apps/studio-server', () => {
  it('GET /api/health is ok', async () => {
    const app = buildApp();
    const res = await app.inject({ method: 'GET', url: '/api/health' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ ok: true });
  });

  it('GET /api/options has 5 locations, a ShelterDesign default, and ranges', async () => {
    const app = buildApp();
    const res = await app.inject({ method: 'GET', url: '/api/options' });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.locations).toHaveLength(5);
    expect(body.defaults).toBeDefined();
    expect(body.defaults.location).toEqual({ kind: 'preset', id: 'leh' });
    expect(body.ranges.azimuthDeg).toEqual({ min: -180, max: 180 });
    expect(body.ranges.thicknessM).toEqual({ min: 0.02, max: 1.0 });
  });

  it('POST /api/simulate/preview with defaults returns 200 with {kpis, result}', async () => {
    const app = buildApp();
    const { defaults } = buildOptions();
    const res = await app.inject({
      method: 'POST',
      url: '/api/simulate/preview',
      payload: defaults,
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.kpis).toBeDefined();
    expect(body.result.kpis).toBeDefined();
    expect(body.result.temperatures.indoorAir.length).toBe(body.result.time.length);
  });

  it('rotating azimuthDeg 0 -> 90 changes kpis.meanIndoorTemp', async () => {
    const app = buildApp();
    const { defaults } = buildOptions();
    const at0 = await app.inject({
      method: 'POST',
      url: '/api/simulate/preview',
      payload: { ...defaults, azimuthDeg: 0 },
    });
    const at90 = await app.inject({
      method: 'POST',
      url: '/api/simulate/preview',
      payload: { ...defaults, azimuthDeg: 90 },
    });
    expect(at0.statusCode).toBe(200);
    expect(at90.statusCode).toBe(200);
    expect(at90.json().kpis.meanIndoorTemp).not.toBeCloseTo(at0.json().kpis.meanIndoorTemp, 6);
  });

  it('wallConstruction.thicknessM 0.2 -> 0.6 changes the result', async () => {
    const app = buildApp();
    const { defaults } = buildOptions();
    const thin = await app.inject({
      method: 'POST',
      url: '/api/simulate/preview',
      payload: { ...defaults, wallConstruction: { materialId: 'rcc', thicknessM: 0.2 } },
    });
    const thick = await app.inject({
      method: 'POST',
      url: '/api/simulate/preview',
      payload: { ...defaults, wallConstruction: { materialId: 'rcc', thicknessM: 0.6 } },
    });
    expect(thin.statusCode).toBe(200);
    expect(thick.statusCode).toBe(200);
    expect(thick.json().kpis.meanIndoorTemp).not.toBeCloseTo(thin.json().kpis.meanIndoorTemp, 6);
  });

  it('lengthM: 999 -> 400 VALIDATION_ERROR field lengthM', async () => {
    const app = buildApp();
    const { defaults } = buildOptions();
    const res = await app.inject({
      method: 'POST',
      url: '/api/simulate/preview',
      payload: { ...defaults, lengthM: 999 },
    });
    expect(res.statusCode).toBe(400);
    const body = res.json();
    expect(body.code).toBe('VALIDATION_ERROR');
    expect(body.field).toBe('lengthM');
  });

  it('azimuthDeg out of range -> 400 VALIDATION_ERROR field azimuthDeg', async () => {
    const app = buildApp();
    const { defaults } = buildOptions();
    const res = await app.inject({
      method: 'POST',
      url: '/api/simulate/preview',
      payload: { ...defaults, azimuthDeg: 181 },
    });
    expect(res.statusCode).toBe(400);
    const body = res.json();
    expect(body.code).toBe('VALIDATION_ERROR');
    expect(body.field).toBe('azimuthDeg');
  });

  it('wallConstruction.thicknessM out of range -> 400 VALIDATION_ERROR field wallConstruction.thicknessM', async () => {
    const app = buildApp();
    const { defaults } = buildOptions();
    const res = await app.inject({
      method: 'POST',
      url: '/api/simulate/preview',
      payload: { ...defaults, wallConstruction: { materialId: 'rcc', thicknessM: 5 } },
    });
    expect(res.statusCode).toBe(400);
    const body = res.json();
    expect(body.code).toBe('VALIDATION_ERROR');
    expect(body.field).toBe('wallConstruction.thicknessM');
  });

  it('unknown glazingId -> 400 VALIDATION_ERROR field glazingId', async () => {
    const app = buildApp();
    const { defaults } = buildOptions();
    const res = await app.inject({
      method: 'POST',
      url: '/api/simulate/preview',
      payload: { ...defaults, glazingId: 'not-a-real-glazing' },
    });
    expect(res.statusCode).toBe(400);
    const body = res.json();
    expect(body.code).toBe('VALIDATION_ERROR');
    expect(body.field).toBe('glazingId');
  });

  // P3 wires a real weatherFor into this route (design/assemble.ts's seam is
  // filled in, see src/weather/resolve.ts); this used to assert the P1
  // placeholder 422 for ANY custom location. The meaningful thing left to
  // test at this layer (no live network allowed, condition 5) is the "both
  // upstream sources unreachable" failure path -- see test/weather.test.ts
  // for the happy-path custom-location preview against recorded fixtures.
  it('custom location, both weather sources unreachable -> 502 UPSTREAM_UNAVAILABLE', async () => {
    const failingFetch: typeof fetch = async () => {
      throw new Error('simulated network failure');
    };
    const app = buildApp({ fetchImpl: failingFetch });
    const { defaults } = buildOptions();
    const res = await app.inject({
      method: 'POST',
      url: '/api/simulate/preview',
      payload: {
        ...defaults,
        location: { kind: 'custom', name: 'Test spot', lat: 34.1, lon: 77.6, elevation: 3500 },
      },
    });
    expect(res.statusCode).toBe(502);
    expect(res.json().code).toBe('UPSTREAM_UNAVAILABLE');
  });

  it('GET /api/health has CORS header', async () => {
    const app = buildApp();
    const res = await app.inject({ method: 'GET', url: '/api/health' });
    expect(res.headers['access-control-allow-origin']).toBe('*');
  });

  it('OPTIONS /api/simulate/preview -> 204 with CORS headers', async () => {
    const app = buildApp();
    const res = await app.inject({ method: 'OPTIONS', url: '/api/simulate/preview' });
    expect(res.statusCode).toBe(204);
    expect(res.headers['access-control-allow-origin']).toBe('*');
    expect(res.headers['access-control-allow-methods']).toBe('GET,POST,OPTIONS');
    expect(res.headers['access-control-allow-headers']).toBe('Content-Type');
  });
});
