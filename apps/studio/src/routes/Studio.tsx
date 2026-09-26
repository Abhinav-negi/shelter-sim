// The Studio page: design controls (left), live 3D preview (centre), results
// (right). "You are designing a shelter, not filling out a form" — controls
// write straight to the ShelterDesign store, the viewer reads the store and
// updates immediately, and a debounced preview (F3.md condition 2) drives the
// results panel.
import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import type { DesignSummary, Options, ShelterDesign } from '@shelter/studio-server';
import { createDesign, getDesign, runSimulation, updateDesign } from '../api/designs';
import { previewSimulation } from '../api/simulate';
import { ApiError } from '../api/client';
import { Button } from '../components/ui';
import { ControlsPanel } from '../controls/ControlsPanel';
import { useDebouncedRequest } from '../controls/useDebouncedRequest';
import { useOptions } from '../design/useOptions';
import { useShelterDesign } from '../design/store';
import { sunAngle } from '../viewer/solar';

const ShelterViewer = lazy(() =>
  import('../viewer/ShelterViewer').then((m) => ({ default: m.ShelterViewer })),
);
// recharts is a big dependency (F1.md: installed for F2/F3's tools, adds no
// weight until imported) — lazy so Landing/Login stay light, same reasoning
// as ShelterViewer/three above.
const ResultsPanel = lazy(() => import('../results/ResultsPanel').then((m) => ({ default: m.ResultsPanel })));

function resolveLatLon(design: ShelterDesign, options: Options) {
  const location = design.location;
  if (location.kind === 'custom') return { lat: location.lat, lon: location.lon };
  const loc = options.locations.find((l) => l.id === location.id);
  return loc ? { lat: loc.latitude, lon: loc.longitude } : { lat: 34.1642, lon: 77.5771 };
}

function errorMessage(err: unknown, fallback: string): string {
  return err instanceof ApiError ? err.message : fallback;
}

/** The route body once options + design are both loaded — split out so a
 * failed GET /api/options can be retried by remounting this (F3.md condition
 * 3: errors say what happened and offer a retry). */
function StudioLoaded({ id, isNew, options }: { id: string | undefined; isNew: boolean; options: Options }) {
  const navigate = useNavigate();
  const design = useShelterDesign((s) => s.design);
  const dirty = useShelterDesign((s) => s.dirty);
  const loadDesign = useShelterDesign((s) => s.loadDesign);
  const reset = useShelterDesign((s) => s.reset);

  const [name, setName] = useState('Untitled shelter');
  const [savedId, setSavedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loadRetryToken, setLoadRetryToken] = useState(0);
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'error'>('idle');
  const [saveError, setSaveError] = useState<string | null>(null);
  const [runState, setRunState] = useState<'idle' | 'saving' | 'done' | 'error'>('idle');
  const [runError, setRunError] = useState<string | null>(null);
  const [hour, setHour] = useState(12);

  const loadedIdRef = useRef<string | null>(null);
  const lastSavedNameRef = useRef('Untitled shelter');

  // Load the design: `new` seeds the store from options.defaults, an existing
  // id fetches it. Guarded so a save-triggered navigate (new -> real id)
  // doesn't re-fetch what we just got back from the server.
  useEffect(() => {
    if (isNew) {
      if (loadedIdRef.current !== 'new') {
        reset(options.defaults);
        setName('Untitled shelter');
        lastSavedNameRef.current = 'Untitled shelter';
        setSavedId(null);
        loadedIdRef.current = 'new';
      }
      setLoading(false);
      return;
    }
    if (loadedIdRef.current === id) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    getDesign(id!).then(
      (d) => {
        if (cancelled) return;
        loadDesign(d.design);
        setName(d.name);
        lastSavedNameRef.current = d.name;
        setSavedId(d.id);
        loadedIdRef.current = d.id;
        setLoading(false);
      },
      (err: unknown) => {
        if (cancelled) return;
        setLoadError(errorMessage(err, 'Could not load this design.'));
        setLoading(false);
      },
    );
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, isNew, loadRetryToken]);

  const preview = useDebouncedRequest(design, 400, (d) => previewSimulation(d));

  async function handleSaveDesign(): Promise<DesignSummary> {
    if (!design) throw new Error('No design loaded');
    setSaveState('saving');
    setSaveError(null);
    try {
      const result = savedId ? await updateDesign(savedId, name, design) : await createDesign(name, design);
      loadDesign(result.design); // clears `dirty` (store.ts's loadDesign)
      setName(result.name);
      lastSavedNameRef.current = result.name;
      if (!savedId) {
        loadedIdRef.current = result.id;
        setSavedId(result.id);
        navigate(`/app/design/${result.id}`, { replace: true });
      }
      setSaveState('idle');
      return result;
    } catch (err) {
      setSaveState('error');
      setSaveError(errorMessage(err, 'Could not save the design.'));
      throw err;
    }
  }

  async function handleSaveRun() {
    setRunState('saving');
    setRunError(null);
    try {
      let runId = savedId;
      if (!runId || dirty || name !== lastSavedNameRef.current) {
        const saved = await handleSaveDesign();
        runId = saved.id;
      }
      await runSimulation(runId!); // non-null: the branch above sets it whenever it started out null
      setRunState('done');
    } catch (err) {
      setRunState('error');
      setRunError(errorMessage(err, 'Could not save this run.'));
    }
  }

  if (loading || !design) {
    // Q1F #3: keep the page frame (header row + three-pane layout) so the
    // fetch doesn't read as a near-blank/broken page; only the pane bodies
    // swap for calm placeholders. Real stage text, matching the Suspense
    // fallbacks already used below ("Loading viewer…"/"Loading results…") —
    // no fake progress bar.
    return (
      <div className="flex h-[calc(100dvh-56px)] flex-col overflow-hidden">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-hairline px-4 py-2.5 sm:px-6">
          <span className="min-w-0 basis-full text-sm font-medium text-ink-muted sm:basis-auto sm:flex-1">
            Loading design…
          </span>
          <Button variant="secondary" disabled>
            Save design
          </Button>
          <Button variant="primary" disabled>
            Save run
          </Button>
        </div>
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto lg:flex-row lg:overflow-hidden">
          <div className="flex h-[45vh] shrink-0 items-center justify-center text-sm text-ink-muted lg:order-2 lg:h-auto lg:min-h-0 lg:flex-1">
            Loading viewer…
          </div>
          <aside className="shrink-0 border-hairline px-4 py-6 text-xs text-ink-muted lg:order-1 lg:w-85 lg:overflow-y-auto lg:border-r">
            Loading controls…
          </aside>
          <aside className="shrink-0 border-hairline px-4 py-6 text-xs text-ink-muted lg:order-3 lg:w-95 lg:overflow-y-auto lg:border-l">
            Loading results…
          </aside>
        </div>
      </div>
    );
  }
  if (loadError) {
    return (
      <div className="flex flex-col items-start gap-3 px-6 py-8">
        <p className="text-sm text-thermal-hottest">{loadError}</p>
        <Button
          variant="secondary"
          onClick={() => {
            loadedIdRef.current = null;
            setLoadRetryToken((t) => t + 1);
          }}
        >
          Retry
        </Button>
      </div>
    );
  }

  const { lat, lon } = resolveLatLon(design, options);
  const altitude = sunAngle(lat, lon, design.date, hour).altitude;
  const hasUnsavedChanges = dirty || name !== lastSavedNameRef.current || savedId === null;
  const saveStateLabel = saveState === 'saving' ? 'Saving…' : hasUnsavedChanges ? 'Unsaved changes' : 'Saved';

  return (
    // Fixed to (viewport - AppShell's header, measured ~54px, rounded up for
    // safety) instead of the natural `flex-1` this used to be: AppShell's own
    // wrapper is only `min-h-screen` (a minimum, not a cap), so an unbounded
    // Studio subtree could grow taller than the viewport and the *document*
    // would scroll instead of this page's own panes -- which is exactly what
    // broke the 3D viewer's framing (orchestrator review, F3 e9e0211): a
    // viewer pane inside an unbounded column takes on the height of its
    // tallest sibling (the controls column), so the fixed-FOV camera ends up
    // looking through a very tall, narrow frustum and only the roof reads.
    // Capping the page's own height here, `overflow-hidden`, makes every
    // descendant's `flex-1`/`min-h-0` actually mean something.
    <div className="flex h-[calc(100dvh-56px)] flex-col overflow-hidden">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-hairline px-4 py-2.5 sm:px-6">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          aria-label="Design name"
          className="min-w-0 basis-full bg-transparent text-sm font-medium text-ink outline-none focus-visible:underline sm:basis-auto sm:flex-1"
        />
        <span className="shrink-0 text-xs text-ink-muted">{saveStateLabel}</span>
        <Button variant="secondary" onClick={() => handleSaveDesign().catch(() => {})} disabled={saveState === 'saving'}>
          Save design
        </Button>
        <Button variant="primary" onClick={handleSaveRun} disabled={runState === 'saving'}>
          {runState === 'saving' ? 'Saving run…' : 'Save run'}
        </Button>
      </div>
      {saveState === 'error' && saveError ? (
        <p className="border-b border-hairline px-4 py-1.5 text-xs text-thermal-hottest sm:px-6">{saveError}</p>
      ) : null}
      {runState === 'error' && runError ? (
        <p className="border-b border-hairline px-4 py-1.5 text-xs text-thermal-hottest sm:px-6">{runError}</p>
      ) : null}
      {runState === 'done' ? (
        <p className="border-b border-hairline px-4 py-1.5 text-xs text-ink-muted sm:px-6">Run saved.</p>
      ) : null}

      {/* Mobile (<lg): one scrolling column, viewer first ("designing a
       * shelter, not filling a form" -- PLAN.md) at a fixed 45vh so its
       * aspect ratio stays sane regardless of how tall controls/results are,
       * then controls, then results, all in natural document-style flow
       * (`overflow-y-auto` on this row itself, since the page above is now
       * height-capped). Desktop (lg+): three independent-scroll panes side
       * by side (`lg:overflow-hidden` here, each pane scrolls its own
       * content) in the original Controls|Viewer|Results visual order via
       * `lg:order-*` -- DOM order stays Viewer-first for mobile, only the
       * visual position moves at the breakpoint. */}
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto lg:flex-row lg:overflow-hidden">
        <div className="flex h-[45vh] shrink-0 flex-col lg:order-2 lg:h-auto lg:min-h-0 lg:flex-1">
          <div className="relative min-h-0 flex-1">
            <Suspense
              fallback={<div className="flex h-full items-center justify-center text-sm text-ink-muted">Loading viewer…</div>}
            >
              <ShelterViewer design={design} options={options} hour={hour} />
            </Suspense>
          </div>
          <div className="flex shrink-0 items-center gap-3 border-t border-hairline px-4 py-2.5">
            <span className="shrink-0 text-xs text-ink-muted">Time of day</span>
            <input
              type="range"
              min={0}
              max={24}
              step={0.25}
              value={hour}
              onChange={(e) => setHour(Number(e.target.value))}
              className="shelter-slider flex-1"
              aria-label="Time of day"
            />
            <span className="w-14 shrink-0 text-right font-mono text-xs text-ink">{hour.toFixed(1)}h</span>
            {altitude < 0 ? <span className="shrink-0 text-xs text-ink-muted">Sun below horizon</span> : null}
          </div>
        </div>

        <aside className="shrink-0 border-hairline py-2 lg:order-1 lg:w-85 lg:overflow-y-auto lg:border-r">
          <ControlsPanel options={options} weatherProvenance={preview.data?.weatherProvenance} />
        </aside>

        <aside className="shrink-0 border-hairline lg:order-3 lg:w-95 lg:overflow-y-auto lg:border-l">
          <Suspense fallback={<div className="px-4 py-6 text-xs text-ink-muted">Loading results…</div>}>
            <ResultsPanel status={preview.status} data={preview.data} error={preview.error} onRetry={preview.retry} />
          </Suspense>
        </aside>
      </div>
    </div>
  );
}

/** Calls useOptions() itself so the parent can force a real refetch on retry
 * by remounting this component (useOptions.ts's cache is only cleared, and so
 * only re-fetched, on a fresh mount's effect — F3.md's May-touch list doesn't
 * include design/useOptions.ts, so this is the retry path available without
 * changing it). */
function StudioOptionsGate({ id, isNew, onRetry }: { id: string | undefined; isNew: boolean; onRetry: () => void }) {
  const { options, error } = useOptions();

  if (error) {
    return (
      <div className="flex flex-col items-start gap-3 px-6 py-8">
        <p className="text-sm text-thermal-hottest">Could not load design options. {error}</p>
        <Button variant="secondary" onClick={onRetry}>
          Retry
        </Button>
      </div>
    );
  }
  if (!options) {
    return <p className="px-6 py-8 text-sm text-ink-muted">Loading…</p>;
  }
  return <StudioLoaded id={id} isNew={isNew} options={options} />;
}

export function Studio() {
  const { id } = useParams<{ id: string }>();
  const isNew = id === 'new' || !id;
  const [optionsRetryToken, setOptionsRetryToken] = useState(0);
  return (
    <StudioOptionsGate
      key={optionsRetryToken}
      id={id}
      isNew={isNew}
      onRetry={() => setOptionsRetryToken((t) => t + 1)}
    />
  );
}
