import { Link, Outlet, useLocation, useNavigate } from 'react-router';
import { logout } from '../../api/auth';
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
            <button onClick={handleLogout} className="text-sm text-ink-muted transition-colors hover:text-ink">
              Log out
            </button>
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
