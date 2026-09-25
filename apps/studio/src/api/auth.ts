// Auth routes are P2's to implement (API.md §7 "planned routes"); shapes below
// follow PLAN.md's "email+password, JWT in an httpOnly cookie" description.
// Update alongside API.md if P2 lands a different shape.
import { get, post } from './client';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
}

export const login = (email: string, password: string) =>
  post<AuthUser>('/auth/login', { email, password });

export const register = (email: string, password: string, name: string) =>
  post<AuthUser>('/auth/register', { email, password, name });

export const logout = () => post<{ ok: true }>('/auth/logout');

/** Never throws: no session (401) or an unreachable server both resolve to `null`. */
export async function getMe(): Promise<AuthUser | null> {
  try {
    return await get<AuthUser>('/auth/me');
  } catch {
    return null;
  }
}
