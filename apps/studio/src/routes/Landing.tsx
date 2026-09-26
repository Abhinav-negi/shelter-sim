// The marketing front door. PLAN.md §Landing: "a full-bleed live 3D shelter
// at dawn", the two headline lines, the CTA pair, then 4 quiet stages (not a
// generic feature grid — banned list). The viewer (three, ~950 kB) and the
// chart (recharts) are both lazy-loaded so the hero text paints immediately,
// same pattern/reasoning as Studio.tsx's ShelterViewer/ResultsPanel. Every
// number/chart shown is a real `POST /api/simulate/preview` call against the
// preset defaults — API.md §4 takes no auth on this route, so there's no
// reason to fake it.
import { lazy, Suspense, useEffect, useState } from 'react';
import { Link } from 'react-router';
import type { Options, PreviewResponse } from '@shelter/studio-server';
import { previewSimulation } from '../api/simulate';
import { useOptions } from '../design/useOptions';
import type { ResultJson } from '../results/types';

const ShelterViewer = lazy(() =>
  import('../viewer/ShelterViewer').then((m) => ({ default: m.ShelterViewer })),
);
const TemperatureChart = lazy(() =>
  import('../results/TemperatureChart').then((m) => ({ default: m.TemperatureChart })),
);

const DAWN_HOUR = 6;

const stages = [
  {
    title: 'Design',
    body: 'Set geometry, materials, openings and orientation for a shelter.',
  },
  {
    title: 'Fast physics',
    body: 'A synchronous thermal model returns a full day of results in about 65 ms.',
  },
  {
    title: 'Compare',
    body: 'Overlay 2–4 designs and read the delta in the numbers that matter.',
  },
  {
    title: 'High-fidelity validation',
    body: 'Future work: a slower, higher-fidelity solver for final sign-off. Not built yet.',
  },
] as const;

const ctaClass =
  'inline-flex items-center justify-center rounded-sm bg-accent px-4 py-2 text-sm font-medium text-accent-fg transition-colors hover:bg-accent-hover';
const secondaryClass =
  'inline-flex items-center justify-center text-sm text-ink-muted transition-colors hover:text-ink';

/** The hero's live 3D preview, dawn hour, resting on the preset defaults
 * until someone actually designs their own. Its own component so the
 * `Suspense` boundary covers only the viewer, not the whole hero. */
function HeroViewer({ options }: { options: Options }) {
  return (
    <Suspense fallback={<div className="h-full w-full bg-surface" aria-hidden />}>
      <ShelterViewer design={options.defaults} options={options} hour={DAWN_HOUR} />
    </Suspense>
  );
}

/** A real preview call's indoor/outdoor curve, shown under "Fast physics" —
 * never invented data (F4.md condition 1: "every chart shown comes from a
 * real preview call"). Silently omitted if the call fails; no placeholder
 * chart pretending to be real. */
function LivePreviewChart({ options }: { options: Options }) {
  const [preview, setPreview] = useState<PreviewResponse | null>(null);

  useEffect(() => {
    let cancelled = false;
    previewSimulation(options.defaults).then(
      (r) => {
        if (!cancelled) setPreview(r);
      },
      () => {
        // No fallback/fake chart — condition 1.
      },
    );
    return () => {
      cancelled = true;
    };
  }, [options]);

  if (!preview) return null;
  return (
    <div className="mt-4 border-t border-hairline pt-4">
      <p className="mb-2 text-xs text-ink-muted">
        A live run of the default shelter —{' '}
        {options.presets.find((p) => p.id === options.defaults.presetId)?.name ?? options.defaults.presetId},{' '}
        {formatLocation(options)}.
      </p>
      <Suspense fallback={null}>
        <TemperatureChart result={preview.result as ResultJson} />
      </Suspense>
    </div>
  );
}

function formatLocation(options: Options): string {
  const location = options.defaults.location;
  if (location.kind === 'custom') return location.name;
  return options.locations.find((l) => l.id === location.id)?.name ?? location.id;
}

export function Landing() {
  const { options } = useOptions();

  return (
    <>
      <section className="relative h-[64vh] min-h-[420px] w-full overflow-hidden border-b border-hairline bg-surface">
        <div className="absolute inset-0">{options ? <HeroViewer options={options} /> : null}</div>
        <div className="relative z-10 flex h-full flex-col justify-end px-4 pb-8 sm:px-6 sm:pb-12">
          <div className="max-w-xl border border-hairline bg-paper px-5 py-6 sm:px-7 sm:py-8">
            <p className="font-mono text-xs tracking-widest text-ink-muted uppercase">
              ShelterSim Studio
            </p>
            <h1 className="mt-3 text-3xl leading-tight font-semibold sm:text-4xl">
              Design for the cold.
            </h1>
            <p className="mt-3 max-w-md text-ink-muted">
              Simulate your shelter before you build it.
            </p>
            <div className="mt-6 flex flex-wrap items-center gap-6">
              <Link to="/register" className={ctaClass}>
                Design a shelter →
              </Link>
              <a href="#stages" className={secondaryClass}>
                Explore the technology
              </a>
            </div>
          </div>
        </div>
      </section>

      <section id="stages" className="border-b border-hairline">
        <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
          <h2 className="text-xs tracking-widest text-ink-muted uppercase">How it works</h2>
          <ol className="mt-8 flex flex-col gap-10">
            {stages.map((stage, i) => (
              <li key={stage.title} className="flex gap-6 border-t border-hairline pt-6 first:border-t-0 first:pt-0">
                <span className="shrink-0 font-mono text-sm text-ink-muted">0{i + 1}</span>
                <div className="min-w-0 flex-1">
                  <h3 className="text-base font-medium">{stage.title}</h3>
                  <p className="mt-1.5 max-w-md text-sm text-ink-muted">{stage.body}</p>
                  {stage.title === 'Fast physics' && options ? <LivePreviewChart options={options} /> : null}
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>
    </>
  );
}
