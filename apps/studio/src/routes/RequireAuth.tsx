import { useEffect, useState } from 'react';
import { Navigate, Outlet } from 'react-router';
import { getMe } from '../api/auth';

type Status = 'checking' | 'authed' | 'anon';

/** Guards /app/*: GET /api/auth/me decides; anything but a 200 sends the visitor to /login. */
export function RequireAuth() {
  const [status, setStatus] = useState<Status>('checking');

  useEffect(() => {
    let cancelled = false;
    getMe().then((user) => {
      if (!cancelled) setStatus(user ? 'authed' : 'anon');
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (status === 'checking') {
    return <p className="px-6 py-8 text-sm text-ink-muted">Checking session…</p>;
  }
  if (status === 'anon') {
    return <Navigate to="/login" replace />;
  }
  return <Outlet />;
}
