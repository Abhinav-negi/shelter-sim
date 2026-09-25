import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getMe, login, logout, register } from './auth';

function jsonResponse(body: unknown, ok = true): Response {
  return { ok, text: async () => JSON.stringify(body) } as Response;
}

const user = { id: 'u1', email: 'a@b.com', name: 'Ada' };

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn());
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('auth wrappers', () => {
  it('login POSTs credentials and unwraps {user}', async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse({ user }));
    const result = await login('a@b.com', 'password1');
    expect(fetch).toHaveBeenCalledWith('/api/auth/login', {
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      method: 'POST',
      body: JSON.stringify({ email: 'a@b.com', password: 'password1' }),
    });
    expect(result).toEqual(user);
  });

  it('register POSTs email/password/name and unwraps {user}', async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse({ user }));
    const result = await register('a@b.com', 'password1', 'Ada');
    expect(fetch).toHaveBeenCalledWith('/api/auth/register', {
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      method: 'POST',
      body: JSON.stringify({ email: 'a@b.com', password: 'password1', name: 'Ada' }),
    });
    expect(result).toEqual(user);
  });

  it('logout POSTs with no body and returns {ok: true}', async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse({ ok: true }));
    const result = await logout();
    expect(fetch).toHaveBeenCalledWith('/api/auth/logout', {
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      method: 'POST',
    });
    expect(result).toEqual({ ok: true });
  });

  it('getMe GETs /auth/me and unwraps {user}', async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse({ user }));
    const result = await getMe();
    expect(fetch).toHaveBeenCalledWith('/api/auth/me', {
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
    });
    expect(result).toEqual(user);
  });

  it('getMe resolves to null on 401 instead of throwing', async () => {
    vi.mocked(fetch).mockResolvedValue(
      jsonResponse({ code: 'UNAUTHENTICATED', message: 'Authentication required.' }, false),
    );
    await expect(getMe()).resolves.toBeNull();
  });

  it('getMe resolves to null when the server is unreachable', async () => {
    vi.mocked(fetch).mockRejectedValue(new Error('network down'));
    await expect(getMe()).resolves.toBeNull();
  });
});
