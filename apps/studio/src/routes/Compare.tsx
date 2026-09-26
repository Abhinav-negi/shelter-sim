// Compare: pick 2-4 saved designs, overlay their indoor curves, and read a
// plain KPI delta table against the first pick. No scores or rankings
// (F4.md condition 4) — every number here is a real saved run's own KPIs,
// nothing invented or aggregated into a "winner".
import { lazy, Suspense, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import type { DesignSummary, Options, SimulationFull } from '@shelter/studio-server';
import { ApiError } from '../api/client';
import { getSimulation, listDesigns, listSimulations } from '../api/designs';
import { useOptions } from '../design/useOptions';
import { Button } from '../components/ui';
import type { ResultJson } from '../results/types';
import { buildKpiTable, type CompareDesign } from './compare/kpiTable';
import type { OverlayDesign } from './compare/OverlayChart';

// recharts is a big dependency — lazy so Dashboard/Compare's own shell stays
// light until 2+ designs with runs are actually picked (same reasoning as
// Studio.tsx's ResultsPanel/Landing.tsx's TemperatureChart).
const OverlayChart = lazy(() => import('./compare/OverlayChart').then((m) => ({ default: m.OverlayChart })));

const MAX_SELECTED = 4;
const MIN_SELECTED = 2;

function errorMessage(err: unknown, fallback: string): string {
  return err instanceof ApiError ? err.message : fallback;
}

function locationLabel(design: DesignSummary, options: Options | null): string {
  const location = design.design.location;
  if (location.kind === 'custom') return location.name;
  return options?.locations.find((l) => l.id === location.id)?.name ?? location.id;
}

type RunState =
  | { status: 'loading' }
  | { status: 'none' }
  | { status: 'error'; message: string }
  | { status: 'done'; full: SimulationFull };

function DesignPicker({
  designs,
  options,
  selectedIds,
  onToggle,
}: {
  designs: DesignSummary[];
  options: Options | null;
  selectedIds: string[];
  onToggle: (id: string) => void;
}) {
  return (
    <div className="divide-y divide-hairline border-y border-hairline">
      {designs.map((d) => {
        const checked = selectedIds.includes(d.id);
        const disabled = !checked && selectedIds.length >= MAX_SELECTED;
        return (
          <label
            key={d.id}
            className={`flex cursor-pointer items-center gap-3 py-2.5 text-sm ${disabled ? 'cursor-not-allowed opacity-40' : ''}`}
          >
            <input
              type="checkbox"
              checked={checked}
              disabled={disabled}
              onChange={() => onToggle(d.id)}
              className="size-4 shrink-0 accent-accent"
            />
            <span className="min-w-0 flex-1 truncate">{d.name}</span>
            <span className="shrink-0 text-xs text-ink-muted">{locationLabel(d, options)}</span>
            <span className="shrink-0 font-mono text-xs text-ink-muted">
              {new Date(d.updatedAt).toLocaleDateString()}
            </span>
          </label>
        );
      })}
    </div>
  );
}

export function Compare() {
  const { options } = useOptions();
  const [searchParams, setSearchParams] = useSearchParams();
  const [designs, setDesigns] = useState<DesignSummary[] | null>(null);
  const [listError, setListError] = useState<string | null>(null);
  const [retryToken, setRetryToken] = useState(0);
  const [selectedIds, setSelectedIds] = useState<string[]>(
    () => searchParams.get('ids')?.split(',').filter(Boolean) ?? [],
  );
  const [urlApplied, setUrlApplied] = useState(false);
  const [runs, setRuns] = useState<Record<string, RunState>>({});

  useEffect(() => {
    let cancelled = false;
    listDesigns().then(
      (d) => {
        if (!cancelled) setDesigns(d);
      },
      (err: unknown) => {
        if (!cancelled) setListError(errorMessage(err, 'Could not load your designs.'));
      },
    );
    return () => {
      cancelled = true;
    };
  }, [retryToken]);

  // Drop any ?ids= that don't match a real design, once, after the list loads.
  useEffect(() => {
    if (designs && !urlApplied) {
      setSelectedIds((ids) => ids.filter((id) => designs.some((d) => d.id === id)).slice(0, MAX_SELECTED));
      setUrlApplied(true);
    }
  }, [designs, urlApplied]);

  // Keep the URL shareable.
  useEffect(() => {
    setSearchParams(selectedIds.length ? { ids: selectedIds.join(',') } : {}, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedIds]);

  // Fetch each selected design's latest run, once, keyed by id.
  useEffect(() => {
    for (const id of selectedIds) {
      if (runs[id]) continue;
      setRuns((r) => ({ ...r, [id]: { status: 'loading' } }));
      listSimulations(id).then(
        (sims) => {
          const latest = sims[0];
          if (!latest) {
            setRuns((r) => ({ ...r, [id]: { status: 'none' } }));
            return;
          }
          getSimulation(latest.id).then(
            (full) => setRuns((r) => ({ ...r, [id]: { status: 'done', full } })),
            (err: unknown) =>
              setRuns((r) => ({ ...r, [id]: { status: 'error', message: errorMessage(err, 'Could not load this run.') } })),
          );
        },
        (err: unknown) =>
          setRuns((r) => ({ ...r, [id]: { status: 'error', message: errorMessage(err, 'Could not load this run.') } })),
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedIds]);

  function toggle(id: string) {
    setSelectedIds((ids) => {
      if (ids.includes(id)) return ids.filter((x) => x !== id);
      if (ids.length >= MAX_SELECTED) return ids;
      return [...ids, id];
    });
  }

  if (listError) {
    return (
      <div className="mx-auto flex max-w-3xl flex-col items-start gap-3 px-4 py-16 sm:px-6">
        <p className="text-sm text-thermal-hottest">{listError}</p>
        <Button variant="secondary" onClick={() => setRetryToken((t) => t + 1)}>
          Retry
        </Button>
      </div>
    );
  }

  if (!designs) {
    return <p className="px-6 py-16 text-sm text-ink-muted">Loading your designs…</p>;
  }

  const nameOf = (id: string) => designs.find((d) => d.id === id)?.name ?? id;
  const readyIds = selectedIds.filter((id) => runs[id]?.status === 'done');
  const noRunIds = selectedIds.filter((id) => runs[id]?.status === 'none');
  const errorEntries = selectedIds
    .map((id) => ({ id, run: runs[id] }))
    .filter((e): e is { id: string; run: Extract<RunState, { status: 'error' }> } => e.run?.status === 'error');
  const stillLoading = selectedIds.some((id) => !runs[id] || runs[id]!.status === 'loading');

  const readyDesigns: CompareDesign[] = readyIds.map((id) => ({
    id,
    name: nameOf(id),
    kpis: (runs[id] as Extract<RunState, { status: 'done' }>).full.kpis,
  }));
  const overlayDesigns: OverlayDesign[] = readyIds.map((id) => ({
    id,
    name: nameOf(id),
    result: (runs[id] as Extract<RunState, { status: 'done' }>).full.result as ResultJson,
  }));
  const kpiRows = buildKpiTable(readyDesigns);

  return (
    <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
      <h1 className="text-xl font-semibold">Compare</h1>
      <p className="mt-2 max-w-md text-sm text-ink-muted">
        Pick 2–4 saved designs to overlay their indoor temperature curves and compare KPIs, each against the
        first one you pick.
      </p>

      {designs.length === 0 ? (
        <p className="mt-8 border-t border-hairline pt-8 text-sm text-ink-muted">
          You don't have any saved designs yet.{' '}
          <Link to="/app/design/new" className="text-accent hover:text-accent-hover">
            Start your first shelter →
          </Link>
        </p>
      ) : (
        <>
          <div className="mt-8">
            <DesignPicker designs={designs} options={options} selectedIds={selectedIds} onToggle={toggle} />
            <p className="mt-2 text-xs text-ink-muted">
              {selectedIds.length}/{MAX_SELECTED} selected{selectedIds.length < MIN_SELECTED ? ' — pick at least 2' : ''}.
            </p>
          </div>

          {selectedIds.length >= MIN_SELECTED ? (
            <div className="mt-10 flex flex-col gap-8">
              {noRunIds.map((id) => (
                <p key={id} className="text-sm text-ink-muted">
                  <strong className="text-ink">{nameOf(id)}</strong> has no saved run yet.{' '}
                  <Link to={`/app/design/${id}`} className="text-accent hover:text-accent-hover">
                    Open in Studio →
                  </Link>
                </p>
              ))}
              {errorEntries.map(({ id, run }) => (
                <p key={id} className="text-sm text-thermal-hottest">
                  {nameOf(id)}: {run.message}
                </p>
              ))}

              {stillLoading ? <p className="text-sm text-ink-muted">Loading saved runs…</p> : null}

              {!stillLoading && readyDesigns.length >= MIN_SELECTED ? (
                <>
                  <section>
                    <h2 className="mb-3 text-xs font-medium uppercase tracking-wide text-ink-muted">
                      Indoor air — 24 h
                    </h2>
                    <Suspense fallback={<p className="text-sm text-ink-muted">Loading chart…</p>}>
                      <OverlayChart designs={overlayDesigns} />
                    </Suspense>
                  </section>

                  <section className="overflow-x-auto">
                    <h2 className="mb-3 text-xs font-medium uppercase tracking-wide text-ink-muted">
                      Key figures (Δ vs {readyDesigns[0]!.name})
                    </h2>
                    <table className="w-full border-collapse text-sm">
                      <thead>
                        <tr className="border-b border-hairline text-left">
                          <th className="py-2 pr-4 text-xs font-medium uppercase tracking-wide text-ink-muted">
                            KPI
                          </th>
                          {readyDesigns.map((d) => (
                            <th
                              key={d.id}
                              className="py-2 pr-4 text-xs font-medium uppercase tracking-wide text-ink-muted"
                            >
                              {d.name}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {kpiRows.map((row) => (
                          <tr key={row.label} className="border-b border-hairline last:border-b-0">
                            <td className="py-2 pr-4 text-xs text-ink-muted">{row.label}</td>
                            {row.cells.map((cell, i) => (
                              <td key={i} className="py-2 pr-4 font-mono text-sm text-ink">
                                {cell.value}
                                {row.unit ? <span className="ml-1 text-xs text-ink-muted">{row.unit}</span> : null}
                                {cell.delta ? (
                                  <span className="ml-2 text-xs text-ink-muted">({cell.delta})</span>
                                ) : null}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </section>
                </>
              ) : !stillLoading && readyDesigns.length < MIN_SELECTED ? (
                <p className="text-sm text-ink-muted">Save a run for at least 2 of the selected designs to compare.</p>
              ) : null}
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
