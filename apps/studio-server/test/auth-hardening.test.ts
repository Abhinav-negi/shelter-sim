// apps/studio-server/test/auth-hardening.test.ts — the JWT itself carries
// an expiry (not only the cookie's maxAge).

import { describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';

describe('auth hardening', () => {
  it('signed tokens expire in 7 days', async () => {
    const app = buildApp();
    await app.ready();
    const decoded = app.jwt.decode<{ iat: number; exp: number }>(app.jwt.sign({ sub: 'x' }))!;
    expect(decoded.exp - decoded.iat).toBe(7 * 24 * 3600);
    await app.close();
  });
});
