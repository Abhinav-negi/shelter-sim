import { Link } from 'react-router';

const ctaClass =
  'mt-4 inline-flex items-center justify-center rounded-sm bg-accent px-4 py-2 text-sm font-medium text-accent-fg transition-colors hover:bg-accent-hover';

/** Placeholder — F4 wires this up to GET /api/designs (PLAN.md: empty state "Start your first shelter"). */
export function Dashboard() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
      <h1 className="text-xl font-semibold">Your shelters</h1>
      <p className="mt-2 max-w-md text-sm text-ink-muted">
        This page will list your saved shelter designs, with actions to open, run and delete each
        one.
      </p>
      <div className="mt-8 border-t border-hairline pt-8">
        <p className="text-sm text-ink-muted">Start your first shelter.</p>
        <Link to="/app/design/new" className={ctaClass}>
          New shelter
        </Link>
      </div>
    </div>
  );
}
