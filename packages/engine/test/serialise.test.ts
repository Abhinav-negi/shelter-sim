/**
 * T-06 -- the JSON boundary. LOG.md acceptance tests 5-10 for T-06.
 */

import { describe, it, expect } from 'vitest';
import {
  seriesToJson,
  seriesFromJson,
  requestToJson,
  requestFromJson,
  canonicalRequestHash,
} from '../src/serialise.js';
import { EngineError } from '../src/types.js';
import { buildBox } from './box.js';

describe('seriesToJson / seriesFromJson', () => {
  it('round-trips a 1,000-element random Float64Array to exact bit equality', () => {
    const a = new Float64Array(1000);
    for (let i = 0; i < a.length; i++) a[i] = Math.random() * 1000 - 500;

    const roundTripped = seriesFromJson(seriesToJson(a));

    expect(roundTripped).toEqual(a);
    expect(roundTripped).toBeInstanceOf(Float64Array);
  });
});

describe('requestToJson / requestFromJson', () => {
  it('round-trips a full SimulationRequest to deep equality, Float64Array fields included', () => {
    const req = buildBox({ ambient: 260, windSpeed: 3, ghiAt: (h) => (h > 6 && h < 18 ? 400 : 0) });

    const roundTripped = requestFromJson(JSON.parse(JSON.stringify(requestToJson(req))));

    expect(roundTripped).toEqual(req);
    expect(roundTripped.weather.T_amb).toBeInstanceOf(Float64Array);
    expect(roundTripped.weather.GHI).toBeInstanceOf(Float64Array);
    expect(roundTripped.weather.v_wind).toBeInstanceOf(Float64Array);
  });

  it('round-trips optional weather series (DNI/DHI/LW_down/RH) as Float64Array', () => {
    const req = buildBox();
    req.weather.DNI = new Float64Array([1, 2, 3]);
    req.weather.RH = new Float64Array([40, 41, 42]);

    const roundTripped = requestFromJson(JSON.parse(JSON.stringify(requestToJson(req))));

    expect(roundTripped.weather.DNI).toBeInstanceOf(Float64Array);
    expect(roundTripped.weather.RH).toBeInstanceOf(Float64Array);
    expect(roundTripped).toEqual(req);
  });

  it('throws EngineError DATA_SCHEMA_MISMATCH with a non-empty detail on an empty object', () => {
    expect.assertions(4);
    try {
      requestFromJson({});
    } catch (e) {
      expect(e).toBeInstanceOf(EngineError);
      const err = e as EngineError;
      expect(err.code).toBe('DATA_SCHEMA_MISMATCH');
      expect(err.detail).toBeTruthy();
      expect(err.detail).not.toEqual({});
    }
  });

  it('throws EngineError DATA_SCHEMA_MISMATCH when weather is missing required fields', () => {
    const req = buildBox();
    const bad = { ...requestToJson(req) as Record<string, unknown> };
    bad.weather = { stepSeconds: 3600 }; // missing T_amb, GHI, v_wind, etc.

    expect(() => requestFromJson(bad)).toThrow(EngineError);
    try {
      requestFromJson(bad);
    } catch (e) {
      expect((e as EngineError).code).toBe('DATA_SCHEMA_MISMATCH');
    }
  });
});

describe('canonicalRequestHash', () => {
  it('is identical for two requests differing only in object key insertion order', () => {
    const reqA = buildBox();
    const reqB = {
      operation: reqA.operation,
      site: reqA.site,
      weather: reqA.weather,
      options: reqA.options,
      building: reqA.building,
      glazings: reqA.glazings,
      materials: reqA.materials,
    };

    expect(canonicalRequestHash(reqB)).toBe(canonicalRequestHash(reqA));
  });

  it('changes when site.elevation changes', () => {
    const base = buildBox();
    const changed = buildBox({ altitude: base.site.elevation + 500 });

    expect(canonicalRequestHash(changed)).not.toBe(canonicalRequestHash(base));
  });

  it('changes when building.volume changes', () => {
    const base = buildBox();
    const changed = { ...base, building: { ...base.building, volume: base.building.volume + 10 } };

    expect(canonicalRequestHash(changed)).not.toBe(canonicalRequestHash(base));
  });

  it('changes when operation.achSchedule[3] changes', () => {
    const base = buildBox();
    const achSchedule = [...base.operation.achSchedule];
    achSchedule[3] = achSchedule[3]! + 0.2;
    const changed = { ...base, operation: { ...base.operation, achSchedule } };

    expect(canonicalRequestHash(changed)).not.toBe(canonicalRequestHash(base));
  });

  it('is stable across a Float64Array and the equivalent number[] form of the same weather series', () => {
    const req = buildBox();
    const asArray = {
      ...req,
      weather: {
        ...req.weather,
        T_amb: Array.from(req.weather.T_amb),
        GHI: Array.from(req.weather.GHI),
        v_wind: Array.from(req.weather.v_wind),
      },
    };

    // canonicalRequestHash accepts the branded SimulationRequest type; the point
    // of this test is that the *value* is stable regardless of array kind, so we
    // deliberately bypass the type system the way a JSON-boundary caller would.
    expect(canonicalRequestHash(asArray as unknown as typeof req)).toBe(canonicalRequestHash(req));
  });
});
