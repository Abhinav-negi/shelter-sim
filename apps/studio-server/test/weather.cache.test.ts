// apps/studio-server/test/weather.cache.test.ts — condition 3: weatherCache
// Mongo model keyed by {source, lat(2dp), lon(2dp), year}, second request
// makes no network call. Connects mongodb-memory-server itself
// (beforeAll/afterAll) against mongoose's default connection -- P3 owns no
// src/db.ts (that's P2's, running in parallel; ledger conflict-avoidance
// rule).

import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { resolveCustomWeather } from '../src/weather/resolve.js';
import type { CustomLocation } from '../src/weather/resolve.js';
import { jsonResponse, loadFixture } from './helpers/fetch.js';

const OPEN_METEO_FIXTURE = loadFixture('open-meteo-shimla-2023.json');

describe('weatherCache (mongoose connected)', () => {
  let mongod: MongoMemoryServer;

  beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    await mongoose.connect(mongod.getUri());
  }, 60_000);

  afterAll(async () => {
    await mongoose.disconnect();
    await mongod.stop();
  });

  it('second request for the same {source,lat,lon,year} makes no network call', async () => {
    let calls = 0;
    const fetchImpl = (async () => {
      calls++;
      return jsonResponse(OPEN_METEO_FIXTURE);
    }) as unknown as typeof fetch;

    // Distinct coords from weather.resolve.test.ts's fixture-matching point
    // -- this suite runs in its own vitest worker/module registry, but keep
    // the cache key obviously scoped to this file regardless.
    const loc: CustomLocation = { kind: 'custom', name: 'Shimla (cache test)', lat: 31.11, lon: 77.17, elevation: 2073 };

    const first = await resolveCustomWeather(loc, fetchImpl);
    expect(calls).toBe(1);

    const second = await resolveCustomWeather(loc, fetchImpl);
    expect(calls).toBe(1); // no second network call -- served from weatherCache
    expect(second.site.standardMeridian).toBeCloseTo(first.site.standardMeridian, 9);
    expect(second.site.groundTempMeanAnnual).toBeCloseTo(first.site.groundTempMeanAnnual, 9);
    expect(second.provenance.notes.some((n) => n.includes('weatherCache'))).toBe(true);
  });

  it('a different location is a separate cache key (own network call)', async () => {
    let calls = 0;
    const fetchImpl = (async () => {
      calls++;
      return jsonResponse(OPEN_METEO_FIXTURE);
    }) as unknown as typeof fetch;

    const locA: CustomLocation = { kind: 'custom', name: 'A', lat: 20, lon: 30, elevation: 100 };
    const locB: CustomLocation = { kind: 'custom', name: 'B', lat: 21, lon: 31, elevation: 100 };

    await resolveCustomWeather(locA, fetchImpl);
    expect(calls).toBe(1);
    await resolveCustomWeather(locB, fetchImpl);
    expect(calls).toBe(2);
  });
});

describe('weatherCache degrades gracefully with no Mongo connection', () => {
  it('mongoose.connection.readyState !== 1: skips the cache, fetches directly every time', async () => {
    expect(mongoose.connection.readyState).not.toBe(1);
    let calls = 0;
    const fetchImpl = (async () => {
      calls++;
      return jsonResponse(OPEN_METEO_FIXTURE);
    }) as unknown as typeof fetch;
    const loc: CustomLocation = { kind: 'custom', name: 'No DB', lat: 10, lon: 20, elevation: 100 };

    const first = await resolveCustomWeather(loc, fetchImpl);
    const second = await resolveCustomWeather(loc, fetchImpl);

    expect(calls).toBe(2); // no cache without a DB connection, but still succeeds
    expect(first.provenance.source).toBe('open-meteo');
    expect(second.provenance.source).toBe('open-meteo');
  });
});
