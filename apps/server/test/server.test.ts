import { describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';
import { buildOptions } from '../src/options.js';

describe('apps/server', () => {
  it('GET /api/health is ok', async () => {
    const app = buildApp();
    const res = await app.inject({ method: 'GET', url: '/api/health' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ ok: true });
  });

  it('GET /api/options has 5 locations and defaults', async () => {
    const app = buildApp();
    const res = await app.inject({ method: 'GET', url: '/api/options' });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.locations).toHaveLength(5);
    expect(body.defaults).toBeDefined();
    expect(body.defaults.locationId).toBe('leh');
  });

  it('POST /api/simulate with defaults returns 200 with consistent series and kpis', async () => {
    const app = buildApp();
    const { defaults } = buildOptions();
    const res = await app.inject({ method: 'POST', url: '/api/simulate', payload: defaults });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.result.temperatures.indoorAir.length).toBe(body.result.time.length);
    expect(body.kpis).toBeDefined();
    expect(body.result.kpis).toBeDefined();
  });

  it('changing locationId to jaisalmer changes meanIndoorTemp vs Leh (weather bug fix)', async () => {
    const app = buildApp();
    const { defaults } = buildOptions();
    const lehRes = await app.inject({ method: 'POST', url: '/api/simulate', payload: defaults });
    const jaisalmerRes = await app.inject({
      method: 'POST',
      url: '/api/simulate',
      payload: { ...defaults, locationId: 'jaisalmer' },
    });
    expect(lehRes.statusCode).toBe(200);
    expect(jaisalmerRes.statusCode).toBe(200);
    expect(jaisalmerRes.json().kpis.meanIndoorTemp).not.toBeCloseTo(
      lehRes.json().kpis.meanIndoorTemp,
      1,
    );
  });

  it('lengthM: 999 -> 400 VALIDATION_ERROR field lengthM', async () => {
    const app = buildApp();
    const { defaults } = buildOptions();
    const res = await app.inject({
      method: 'POST',
      url: '/api/simulate',
      payload: { ...defaults, lengthM: 999 },
    });
    expect(res.statusCode).toBe(400);
    const body = res.json();
    expect(body.code).toBe('VALIDATION_ERROR');
    expect(body.field).toBe('lengthM');
  });

  it('unknown glazingId -> 400 VALIDATION_ERROR field glazingId', async () => {
    const app = buildApp();
    const { defaults } = buildOptions();
    const res = await app.inject({
      method: 'POST',
      url: '/api/simulate',
      payload: { ...defaults, glazingId: 'not-a-real-glazing' },
    });
    expect(res.statusCode).toBe(400);
    const body = res.json();
    expect(body.code).toBe('VALIDATION_ERROR');
    expect(body.field).toBe('glazingId');
  });

  it('setting wallMaterialId changes the result vs null (preset construction)', async () => {
    const app = buildApp();
    const { defaults } = buildOptions();
    const defaultRes = await app.inject({ method: 'POST', url: '/api/simulate', payload: defaults });
    const rccRes = await app.inject({
      method: 'POST',
      url: '/api/simulate',
      payload: { ...defaults, wallMaterialId: 'rcc' },
    });
    expect(defaultRes.statusCode).toBe(200);
    expect(rccRes.statusCode).toBe(200);
    expect(rccRes.json().kpis.meanIndoorTemp).not.toBeCloseTo(
      defaultRes.json().kpis.meanIndoorTemp,
      1,
    );
  });

  it('POST /api/assemble(defaults) then POST /api/simulate/raw with that body matches /api/simulate kpis', async () => {
    const app = buildApp();
    const { defaults } = buildOptions();

    const assembleRes = await app.inject({ method: 'POST', url: '/api/assemble', payload: defaults });
    expect(assembleRes.statusCode).toBe(200);
    const assembledRequest = assembleRes.json();

    const rawRes = await app.inject({
      method: 'POST',
      url: '/api/simulate/raw',
      payload: assembledRequest,
    });
    expect(rawRes.statusCode).toBe(200);

    const simRes = await app.inject({ method: 'POST', url: '/api/simulate', payload: defaults });
    expect(simRes.statusCode).toBe(200);

    const rawKpis = rawRes.json().kpis as Record<string, number | number[] | null>;
    const simKpis = simRes.json().kpis as Record<string, number | number[] | null>;
    expect(Object.keys(rawKpis).sort()).toEqual(Object.keys(simKpis).sort());
    for (const key of Object.keys(simKpis)) {
      const a = rawKpis[key];
      const b = simKpis[key];
      if (typeof a === 'number' && typeof b === 'number') {
        expect(a).toBeCloseTo(b, 9);
      } else {
        expect(a).toEqual(b);
      }
    }
  });

  it('POST /api/simulate/raw with {} -> 400 INVALID_INPUT', async () => {
    const app = buildApp();
    const res = await app.inject({ method: 'POST', url: '/api/simulate/raw', payload: {} });
    expect(res.statusCode).toBe(400);
    const body = res.json();
    expect(body.code).toBe('INVALID_INPUT');
    expect(typeof body.message).toBe('string');
  });

  it('POST /api/simulate/raw with weather removed -> 400 INVALID_INPUT field weather', async () => {
    const app = buildApp();
    const { defaults } = buildOptions();
    const assembleRes = await app.inject({ method: 'POST', url: '/api/assemble', payload: defaults });
    const assembledRequest = assembleRes.json() as Record<string, unknown>;
    const { weather: _weather, ...withoutWeather } = assembledRequest;

    const res = await app.inject({ method: 'POST', url: '/api/simulate/raw', payload: withoutWeather });
    expect(res.statusCode).toBe(400);
    const body = res.json();
    expect(body.code).toBe('INVALID_INPUT');
    expect(body.field).toBe('weather');
  });

  it('GET /api/health has CORS header', async () => {
    const app = buildApp();
    const res = await app.inject({ method: 'GET', url: '/api/health' });
    expect(res.headers['access-control-allow-origin']).toBe('*');
  });

  it('OPTIONS /api/simulate -> 204 with CORS headers', async () => {
    const app = buildApp();
    const res = await app.inject({ method: 'OPTIONS', url: '/api/simulate' });
    expect(res.statusCode).toBe(204);
    expect(res.headers['access-control-allow-origin']).toBe('*');
    expect(res.headers['access-control-allow-methods']).toBe('GET,POST,OPTIONS');
    expect(res.headers['access-control-allow-headers']).toBe('Content-Type');
  });
});
