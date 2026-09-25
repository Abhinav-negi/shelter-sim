// apps/studio-server/test/mongo.test.ts — P2 conditions 1-4, against a real
// mongodb-memory-server instance (condition 6). One shared instance for the
// whole file (MongoMemoryServer boot is slow); `beforeEach` wipes every
// collection so tests don't leak into each other.

import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../src/app.js';
import { connectDb, disconnectDb } from '../src/db.js';
import { buildOptions } from '../src/options.js';
import { User } from '../src/auth/model.js';

let mongod: MongoMemoryServer;

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await connectDb(mongod.getUri());
}, 120_000);

afterAll(async () => {
  await disconnectDb();
  await mongod.stop();
});

beforeEach(async () => {
  const { collections } = mongoose.connection;
  await Promise.all(Object.values(collections).map((c) => c.deleteMany({})));
});

function app(nodeEnv?: string): FastifyInstance {
  return buildApp(nodeEnv ? { jwtSecret: 'test-secret', nodeEnv } : { jwtSecret: 'test-secret' });
}

async function register(
  a: FastifyInstance,
  email: string,
  name = 'Alice',
  password = 'password123',
) {
  const res = await a.inject({
    method: 'POST',
    url: '/api/auth/register',
    payload: { email, password, name },
  });
  const token = res.cookies.find((c) => c.name === 'token')?.value;
  return { res, cookie: `token=${token}` };
}

const { defaults } = buildOptions();

describe('auth', () => {
  it('register creates a user, sets an httpOnly SameSite=Lax cookie, never returns the password', async () => {
    const a = app();
    const { res, cookie } = await register(a, 'alice@example.com');
    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.user).toMatchObject({ email: 'alice@example.com', name: 'Alice' });
    expect(body.user.passwordHash).toBeUndefined();
    expect(JSON.stringify(body)).not.toMatch(/passwordHash|scrypt/i);

    const setCookie = res.cookies.find((c) => c.name === 'token')!;
    expect(setCookie.httpOnly).toBe(true);
    expect(setCookie.sameSite).toBe('Lax');
    expect(setCookie.secure).not.toBe(true); // NODE_ENV != production in this test
    expect(cookie).toBeTruthy();

    // scrypt: salt(16B hex) + ':' + hash(64B hex), never the plaintext password.
    const stored = await User.findOne({ email: 'alice@example.com' });
    expect(stored!.passwordHash).toMatch(/^[0-9a-f]{32}:[0-9a-f]{128}$/);
  });

  it('duplicate email -> 409 EMAIL_TAKEN', async () => {
    const a = app();
    await register(a, 'dup@example.com');
    const res = await a.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: { email: 'dup@example.com', password: 'password123', name: 'Someone else' },
    });
    expect(res.statusCode).toBe(409);
    expect(res.json().code).toBe('EMAIL_TAKEN');
  });

  it('login with correct credentials sets the cookie', async () => {
    const a = app();
    await register(a, 'bob@example.com', 'Bob', 'correct-horse');
    const res = await a.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: 'bob@example.com', password: 'correct-horse' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().user.email).toBe('bob@example.com');
    expect(res.cookies.find((c) => c.name === 'token')).toBeDefined();
  });

  it('wrong password -> 401 INVALID_CREDENTIALS', async () => {
    const a = app();
    await register(a, 'carol@example.com', 'Carol', 'correct-horse');
    const res = await a.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: 'carol@example.com', password: 'wrong-password' },
    });
    expect(res.statusCode).toBe(401);
    expect(res.json().code).toBe('INVALID_CREDENTIALS');
  });

  it('unknown email -> 401 INVALID_CREDENTIALS, same message as a wrong password', async () => {
    const a = app();
    await register(a, 'dave@example.com', 'Dave', 'correct-horse');
    const wrongPassword = await a.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: 'dave@example.com', password: 'wrong-password' },
    });
    const unknownEmail = await a.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: 'nobody@example.com', password: 'wrong-password' },
    });
    expect(unknownEmail.statusCode).toBe(401);
    expect(unknownEmail.json()).toEqual(wrongPassword.json());
  });

  it('GET /api/auth/me requires auth', async () => {
    const a = app();
    const res = await a.inject({ method: 'GET', url: '/api/auth/me' });
    expect(res.statusCode).toBe(401);
    expect(res.json().code).toBe('UNAUTHENTICATED');
  });

  it('GET /api/auth/me returns the authenticated user', async () => {
    const a = app();
    const { cookie } = await register(a, 'erin@example.com', 'Erin');
    const res = await a.inject({ method: 'GET', url: '/api/auth/me', headers: { cookie } });
    expect(res.statusCode).toBe(200);
    expect(res.json().user).toMatchObject({ email: 'erin@example.com', name: 'Erin' });
  });

  it('logout clears the cookie', async () => {
    const a = app();
    const { cookie } = await register(a, 'frank@example.com');
    const res = await a.inject({ method: 'POST', url: '/api/auth/logout', headers: { cookie } });
    expect(res.statusCode).toBe(200);
    const cleared = res.cookies.find((c) => c.name === 'token')!;
    expect(cleared.value).toBe('');
  });

  it('the auth cookie is Secure when NODE_ENV=production', async () => {
    const a = app('production');
    const { res } = await register(a, 'grace@example.com');
    const setCookie = res.cookies.find((c) => c.name === 'token')!;
    expect(setCookie.secure).toBe(true);
  });
});

describe('designs', () => {
  it('POST /api/designs requires auth', async () => {
    const a = app();
    const res = await a.inject({
      method: 'POST',
      url: '/api/designs',
      payload: { name: 'My shelter', design: defaults },
    });
    expect(res.statusCode).toBe(401);
  });

  it('POST /api/designs validates the design with the ShelterDesign schema', async () => {
    const a = app();
    const { cookie } = await register(a, 'owner1@example.com');
    const res = await a.inject({
      method: 'POST',
      url: '/api/designs',
      headers: { cookie },
      payload: { name: 'Bad', design: { ...defaults, lengthM: 999 } },
    });
    expect(res.statusCode).toBe(400);
    const body = res.json();
    expect(body.code).toBe('VALIDATION_ERROR');
    expect(body.field).toBe('design.lengthM');
  });

  it('create, list (newest first), get, update, delete', async () => {
    const a = app();
    const { cookie } = await register(a, 'owner2@example.com');

    const first = await a.inject({
      method: 'POST',
      url: '/api/designs',
      headers: { cookie },
      payload: { name: 'First', design: defaults },
    });
    expect(first.statusCode).toBe(201);
    const firstId = first.json().id;

    const second = await a.inject({
      method: 'POST',
      url: '/api/designs',
      headers: { cookie },
      payload: { name: 'Second', design: defaults },
    });
    const secondId = second.json().id;

    const list = await a.inject({ method: 'GET', url: '/api/designs', headers: { cookie } });
    expect(list.statusCode).toBe(200);
    const listBody = list.json();
    expect(listBody.map((d: { id: string }) => d.id)).toEqual([secondId, firstId]);

    const got = await a.inject({
      method: 'GET',
      url: `/api/designs/${firstId}`,
      headers: { cookie },
    });
    expect(got.statusCode).toBe(200);
    expect(got.json().name).toBe('First');

    const updated = await a.inject({
      method: 'PUT',
      url: `/api/designs/${firstId}`,
      headers: { cookie },
      payload: { name: 'First (renamed)', design: { ...defaults, lengthM: 6 } },
    });
    expect(updated.statusCode).toBe(200);
    expect(updated.json().name).toBe('First (renamed)');
    expect(updated.json().design.lengthM).toBe(6);

    const deleted = await a.inject({
      method: 'DELETE',
      url: `/api/designs/${firstId}`,
      headers: { cookie },
    });
    expect(deleted.statusCode).toBe(204);

    const afterDelete = await a.inject({
      method: 'GET',
      url: `/api/designs/${firstId}`,
      headers: { cookie },
    });
    expect(afterDelete.statusCode).toBe(404);
  });

  it("another user's design id -> 404 (not 403), for get/update/delete", async () => {
    const a = app();
    const { cookie: ownerCookie } = await register(a, 'owner3@example.com');
    const { cookie: otherCookie } = await register(a, 'other3@example.com');

    const created = await a.inject({
      method: 'POST',
      url: '/api/designs',
      headers: { cookie: ownerCookie },
      payload: { name: 'Mine', design: defaults },
    });
    const id = created.json().id;

    const get = await a.inject({
      method: 'GET',
      url: `/api/designs/${id}`,
      headers: { cookie: otherCookie },
    });
    expect(get.statusCode).toBe(404);

    const put = await a.inject({
      method: 'PUT',
      url: `/api/designs/${id}`,
      headers: { cookie: otherCookie },
      payload: { name: 'Stolen', design: defaults },
    });
    expect(put.statusCode).toBe(404);

    const del = await a.inject({
      method: 'DELETE',
      url: `/api/designs/${id}`,
      headers: { cookie: otherCookie },
    });
    expect(del.statusCode).toBe(404);
  });

  it('a malformed id -> 404, not a 500', async () => {
    const a = app();
    const { cookie } = await register(a, 'owner4@example.com');
    const res = await a.inject({
      method: 'GET',
      url: '/api/designs/not-a-valid-object-id',
      headers: { cookie },
    });
    expect(res.statusCode).toBe(404);
  });
});

describe('simulations', () => {
  async function createDesign(a: FastifyInstance, cookie: string, name = 'Shelter') {
    const res = await a.inject({
      method: 'POST',
      url: '/api/designs',
      headers: { cookie },
      payload: { name, design: defaults },
    });
    return res.json().id as string;
  }

  it('runs through the provider and stores the frozen snapshot + result', async () => {
    const a = app();
    const { cookie } = await register(a, 'sim1@example.com');
    const designId = await createDesign(a, cookie);

    const res = await a.inject({
      method: 'POST',
      url: `/api/designs/${designId}/simulations`,
      headers: { cookie },
    });
    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.provider).toBe('fast-physics');
    expect(typeof body.engineVersion).toBe('string');
    expect(typeof body.requestHash).toBe('string');
    expect(body.inputSnapshot).toEqual(defaults);
    expect(body.kpis).toBeDefined();
    expect(body.result).toBeDefined();
    expect(body.designId).toBe(designId);
  }, 20_000);

  it('editing the design afterward leaves the stored snapshot/result unchanged', async () => {
    const a = app();
    const { cookie } = await register(a, 'sim2@example.com');
    const designId = await createDesign(a, cookie);

    const ran = await a.inject({
      method: 'POST',
      url: `/api/designs/${designId}/simulations`,
      headers: { cookie },
    });
    const simId = ran.json().id;
    const originalSnapshot = ran.json().inputSnapshot;
    const originalKpis = ran.json().kpis;
    const originalResult = ran.json().result;

    const putRes = await a.inject({
      method: 'PUT',
      url: `/api/designs/${designId}`,
      headers: { cookie },
      payload: { name: 'Shelter', design: { ...defaults, lengthM: 6, azimuthDeg: 90 } },
    });
    expect(putRes.statusCode).toBe(200);

    const after = await a.inject({
      method: 'GET',
      url: `/api/simulations/${simId}`,
      headers: { cookie },
    });
    expect(after.statusCode).toBe(200);
    const afterBody = after.json();
    expect(afterBody.inputSnapshot).toEqual(originalSnapshot);
    expect(afterBody.inputSnapshot.lengthM).toBe(defaults.lengthM); // NOT 6
    expect(afterBody.kpis).toEqual(originalKpis);
    expect(afterBody.result).toEqual(originalResult);
  }, 20_000);

  it('GET .../simulations lists newest first, without `result`', async () => {
    const a = app();
    const { cookie } = await register(a, 'sim3@example.com');
    const designId = await createDesign(a, cookie);

    const first = await a.inject({
      method: 'POST',
      url: `/api/designs/${designId}/simulations`,
      headers: { cookie },
    });
    const second = await a.inject({
      method: 'POST',
      url: `/api/designs/${designId}/simulations`,
      headers: { cookie },
    });

    const list = await a.inject({
      method: 'GET',
      url: `/api/designs/${designId}/simulations`,
      headers: { cookie },
    });
    expect(list.statusCode).toBe(200);
    const items = list.json();
    expect(items.map((s: { id: string }) => s.id)).toEqual([second.json().id, first.json().id]);
    for (const item of items) expect('result' in item).toBe(false);
  }, 20_000);

  it('GET /api/simulations/:id returns the full record including `result`', async () => {
    const a = app();
    const { cookie } = await register(a, 'sim4@example.com');
    const designId = await createDesign(a, cookie);
    const ran = await a.inject({
      method: 'POST',
      url: `/api/designs/${designId}/simulations`,
      headers: { cookie },
    });
    const res = await a.inject({
      method: 'GET',
      url: `/api/simulations/${ran.json().id}`,
      headers: { cookie },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().result).toBeDefined();
  }, 20_000);

  it('cross-user isolation: another user gets 404 for the design, its simulations, and running a new one', async () => {
    const a = app();
    const { cookie: ownerCookie } = await register(a, 'sim5-owner@example.com');
    const { cookie: otherCookie } = await register(a, 'sim5-other@example.com');
    const designId = await createDesign(a, ownerCookie);
    const ran = await a.inject({
      method: 'POST',
      url: `/api/designs/${designId}/simulations`,
      headers: { cookie: ownerCookie },
    });
    const simId = ran.json().id;

    const runAsOther = await a.inject({
      method: 'POST',
      url: `/api/designs/${designId}/simulations`,
      headers: { cookie: otherCookie },
    });
    expect(runAsOther.statusCode).toBe(404);

    const listAsOther = await a.inject({
      method: 'GET',
      url: `/api/designs/${designId}/simulations`,
      headers: { cookie: otherCookie },
    });
    expect(listAsOther.statusCode).toBe(404);

    const getAsOther = await a.inject({
      method: 'GET',
      url: `/api/simulations/${simId}`,
      headers: { cookie: otherCookie },
    });
    expect(getAsOther.statusCode).toBe(404);
  }, 20_000);
});
