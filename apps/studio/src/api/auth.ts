// Auth routes, API.md §7. Every route wraps its user in `{user}`; logout
// returns `{ok: true}`. Shapes are typed from @shelter/studio-server
// (PublicUser), never hand-copied (condition 2).
import type { PublicUser } from '@shelter/studio-server';
import { get, post } from './client';

export const login = (email: string, password: string) =>
  post<{ user: PublicUser }>('/auth/login', { email, password }).then((r) => r.user);

export const register = (email: string, password: string, name: string) =>
  post<{ user: PublicUser }>('/auth/register', { email, password, name }).then((r) => r.user);

export const logout = () => post<{ ok: true }>('/auth/logout');

/** Never throws: no session (401) or an unreachable server both resolve to `null`. */
export async function getMe(): Promise<PublicUser | null> {
  try {
    const { user } = await get<{ user: PublicUser }>('/auth/me');
    return user;
  } catch {
    return null;
  }
}
