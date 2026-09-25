// apps/studio-server/test/custom-run.test.ts — a PERSISTED run of a custom-
// location design resolves weather the same way the preview does
// (design/prepare.ts) and stores its weatherProvenance with the snapshot.

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { buildApp } from '../src/app.js';
import { connectDb, disconnectDb } from '../src/db.js';
import { buildOptions } from '../src/options.js';
import { jsonResponse, loadFixture } from './helpers/fetch.js';

const OPEN_METEO_FIXTURE = loadFixture('open-meteo-shimla-2023.json');
let mongod: MongoMemoryServer;

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await connectDb(mongod.getUri());
});
afterAll(async () => {
  await disconnectDb();
  await mongod.stop();
});

describe('POST /api/designs/:id/simulations — custom location', () => {
  it('runs with resolved weather and stores weatherProvenance', async () => {
    const app = buildApp({
      fetchImpl: (async () => jsonResponse(OPEN_METEO_FIXTURE)) as unknown as typeof fetch,
    });
    const reg = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: { email: 'custom@example.com', password: 'password123', name: 'C' },
    });
    const cookie = `token=${reg.cookies.find((c) => c.name === 'token')?.value}`;
    const design = {
      ...buildOptions().defaults,
      location: { kind: 'custom', name: 'Shimla', lat: 31.10442, lon: 77.16662, elevation: 2073 },
    };
    const created = await app.inject({
      method: 'POST',
      url: '/api/designs',
      headers: { cookie },
      payload: { name: 'Shimla hut', design },
    });
    const run = await app.inject({
      method: 'POST',
      url: `/api/designs/${created.json().id}/simulations`,
      headers: { cookie },
    });
    expect(run.statusCode).toBe(201);
    expect(run.json().weatherProvenance.source).toBe('open-meteo');

    const list = await app.inject({
      method: 'GET',
      url: `/api/designs/${created.json().id}/simulations`,
      headers: { cookie },
    });
    expect(list.json()[0].weatherProvenance.source).toBe('open-meteo');
  });
});
