import { Link, Outlet, useLocation, useNavigate } from 'react-router';
import { logout } from '../../api/auth';
import { Button } from '../ui';
import { ThemeToggle } from './ThemeToggle';

/** The app frame: wordmark, minimal nav, theme toggle, then the routed page.
 *  Log out (A2.md condition 5) only shows inside the app, not on the public
 *  marketing/login/register pages. */
export function AppShell() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const inApp = pathname.startsWith('/app');

  async function handleLogout() {
    await logout().catch(() => {});
    navigate('/');
  }

  return (
    <div className="flex min-h-screen flex-col bg-paper text-ink">
      <header className="flex items-center justify-between gap-4 border-b border-hairline px-4 py-3 sm:px-6">
        <Link to="/" className="text-sm font-semibold tracking-tight">
          ShelterSim
        </Link>
        <nav className="flex items-center gap-4 sm:gap-6">
          <Link to="/app" className="text-sm text-ink-muted transition-colors hover:text-ink">
            Studio
          </Link>
          {inApp ? (
            // !px-0 !py-0: Tailwind utilities of equal specificity are
            // ordered by the compiled sheet, not by class-list position, so
            // a plain `py-0` here loses to Button's own `py-2` -- `!` forces
            // it. Needed so this reads as plain nav text (like "Studio"
            // beside it) instead of growing this shared header past the
            // ~56px Studio.tsx hardcodes for its own fixed-height layout (S1).
            <Button variant="ghost" onClick={handleLogout} className="!px-0 !py-0 text-sm">
              Log out
            </Button>
          ) : null}
          <ThemeToggle />
        </nav>
      </header>
      <main className="flex-1">
        <Outlet />
      </main>
    </div>
  );
}
