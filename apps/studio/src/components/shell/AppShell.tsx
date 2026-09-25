import { Link, Outlet } from 'react-router';
import { ThemeToggle } from './ThemeToggle';

/** The app frame: wordmark, minimal nav, theme toggle, then the routed page. */
export function AppShell() {
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
          <ThemeToggle />
        </nav>
      </header>
      <main className="flex-1">
        <Outlet />
      </main>
    </div>
  );
}
