// "Your shelters" — the grid of saved designs (F4.md condition 3): name,
// location, updated, last dawn temp if a run exists; "+ New shelter"; an
// empty state; delete with an inline confirm (no native `confirm()` — this
// app has no other native browser dialogs either, so a two-step inline
// control matches the rest of the UI better than a modal would).
import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import type { DesignSummary, Options } from '@shelter/studio-server';
import { logout } from '../api/auth';
import { ApiError } from '../api/client';
import { deleteDesign, listDesigns, listSimulations } from '../api/designs';
import { useOptions } from '../design/useOptions';
import { Button } from '../components/ui';
import { fmtC } from '../results/format';

interface Row {
  summary: DesignSummary;
  /** null once the fetch settles with no saved run yet; undefined while loading. */
  dawnTempC: string | null | undefined;
}

function errorMessage(err: unknown, fallback: string): string {
  return err instanceof ApiError ? err.message : fallback;
}

function locationLabel(design: DesignSummary, options: Options | null): string {
  const location = design.design.location;
  if (location.kind === 'custom') return location.name;
  return options?.locations.find((l) => l.id === location.id)?.name ?? location.id;
}

function DesignRow({
  row,
  options,
  confirming,
  deleting,
  onDeleteClick,
  onCancel,
  onConfirmDelete,
}: {
  row: Row;
  options: Options | null;
  confirming: boolean;
  deleting: boolean;
  onDeleteClick: () => void;
  onCancel: () => void;
  onConfirmDelete: () => void;
}) {
  const { summary, dawnTempC } = row;
  return (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-2 py-4">
      <div className="min-w-0 flex-1">
        <Link
          to={`/app/design/${summary.id}`}
          className="text-sm font-medium text-ink hover:text-accent hover:underline"
        >
          {summary.name}
        </Link>
        <p className="mt-0.5 text-xs text-ink-muted">
          {locationLabel(summary, options)} · updated {new Date(summary.updatedAt).toLocaleDateString()}
        </p>
      </div>
      <div className="shrink-0 text-right font-mono text-xs text-ink-muted">
        {dawnTempC === undefined ? '…' : dawnTempC === null ? 'Not run yet' : `${dawnTempC}°C at dawn`}
      </div>
      <div className="flex shrink-0 items-center gap-3">
        {confirming ? (
          <>
            <span className="text-xs text-ink-muted">Delete this design?</span>
            <Button variant="secondary" onClick={onConfirmDelete} disabled={deleting} className="px-2 py-1 text-xs">
              {deleting ? 'Deleting…' : 'Delete'}
            </Button>
            <Button variant="ghost" onClick={onCancel} disabled={deleting} className="px-2 py-1 text-xs">
              Cancel
            </Button>
          </>
        ) : (
          <Button variant="ghost" onClick={onDeleteClick} className="px-2 py-1 text-xs">
            Delete
          </Button>
        )}
      </div>
    </div>
  );
}

export function Dashboard() {
  const navigate = useNavigate();
  const { options } = useOptions();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [retryToken, setRetryToken] = useState(0);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setError(null);
    setRows(null);
    listDesigns().then(
      (list) => {
        if (cancelled) return;
        setRows(list.map((summary) => ({ summary, dawnTempC: undefined })));
        // N+1: one GET /api/designs/:id/simulations per design, to read the
        // latest run's dawn temp. Acceptable for a small per-user list — see
        // F4.md Evidence; there is no listSimulations-for-all-designs route.
        list.forEach((summary) => {
          listSimulations(summary.id).then(
            (sims) => {
              if (cancelled) return;
              const latest = sims[0];
              setRows((prev) =>
                prev
                  ? prev.map((r) =>
                      r.summary.id === summary.id
                        ? { ...r, dawnTempC: latest ? fmtC(latest.kpis.tempAt0600) : null }
                        : r,
                    )
                  : prev,
              );
            },
            () => {
              if (cancelled) return;
              setRows((prev) =>
                prev ? prev.map((r) => (r.summary.id === summary.id ? { ...r, dawnTempC: null } : r)) : prev,
              );
            },
          );
        });
      },
      (err: unknown) => {
        if (!cancelled) setError(errorMessage(err, 'Could not load your shelters.'));
      },
    );
    return () => {
      cancelled = true;
    };
  }, [retryToken]);

  async function handleDelete(id: string) {
    setDeletingId(id);
    try {
      await deleteDesign(id);
      setRows((prev) => (prev ? prev.filter((r) => r.summary.id !== id) : prev));
      setConfirmingId(null);
    } catch {
      // Leave the confirm open with the row still present; the button
      // reverts to enabled so the person can try again.
    } finally {
      setDeletingId(null);
    }
  }

  async function handleLogout() {
    await logout().catch(() => {});
    navigate('/login');
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-xl font-semibold">Your shelters</h1>
        <div className="flex items-center gap-4">
          {rows && rows.length >= 2 ? (
            <Link to="/app/compare" className="text-sm text-ink-muted transition-colors hover:text-ink">
              Compare
            </Link>
          ) : null}
          <Button variant="ghost" onClick={handleLogout} className="px-0 text-sm">
            Log out
          </Button>
        </div>
      </div>

      {error ? (
        <div className="mt-8 flex flex-col items-start gap-3 border-t border-hairline pt-8">
          <p className="text-sm text-thermal-hottest">{error}</p>
          <Button variant="secondary" onClick={() => setRetryToken((t) => t + 1)}>
            Retry
          </Button>
        </div>
      ) : rows === null ? (
        <p className="mt-8 border-t border-hairline pt-8 text-sm text-ink-muted">Loading…</p>
      ) : rows.length === 0 ? (
        <div className="mt-8 border-t border-hairline pt-8">
          <p className="text-sm text-ink-muted">Start your first shelter.</p>
          <Link
            to="/app/design/new"
            className="mt-4 inline-flex items-center justify-center rounded-sm bg-accent px-4 py-2 text-sm font-medium text-accent-fg transition-colors hover:bg-accent-hover"
          >
            New shelter
          </Link>
        </div>
      ) : (
        <>
          <div className="mt-8 divide-y divide-hairline border-t border-hairline">
            {rows.map((row) => (
              <DesignRow
                key={row.summary.id}
                row={row}
                options={options}
                confirming={confirmingId === row.summary.id}
                deleting={deletingId === row.summary.id}
                onDeleteClick={() => setConfirmingId(row.summary.id)}
                onCancel={() => setConfirmingId(null)}
                onConfirmDelete={() => handleDelete(row.summary.id)}
              />
            ))}
          </div>
          <Link
            to="/app/design/new"
            className="mt-8 inline-flex items-center justify-center rounded-sm border border-hairline px-4 py-2 text-sm font-medium text-ink transition-colors hover:bg-surface"
          >
            + New shelter
          </Link>
        </>
      )}
    </div>
  );
}
