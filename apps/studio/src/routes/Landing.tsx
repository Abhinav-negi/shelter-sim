// The marketing front door. G5 (V2.md §G5, ledger/PLAN.md §Landing): bolder,
// same identity — a cinematic full-viewport dark hero (landing/Hero.tsx) with
// the live 3D shelter auto-rotating and the sun sweeping dawn -> dusk, a live
// temperature strip, then a shape strip, scroll-revealed stages, the live
// chart and a closing CTA. The viewer (three, ~950 kB) and the chart
// (recharts) are both lazy-loaded so the hero text paints immediately, same
// pattern/reasoning as Studio.tsx's ShelterViewer/ResultsPanel. Every
// number/chart shown is a real `POST /api/simulate/preview` call against the
// preset defaults, fetched once here and shared by the hero strip and the
// chart section — API.md §4 takes no auth on this route, so there's no
// reason to fake it.
import { lazy, useEffect, useState } from 'react';
import { Link, Navigate } from 'react-router';
import type { Options, PreviewResponse, PublicUser } from '@shelter/studio-server';
import { getMe } from '../api/auth';
import { previewSimulation } from '../api/simulate';
import { useOptions } from '../design/useOptions';
import { Chart } from './landing/Chart';
import { Hero } from './landing/Hero';
import { ShapeStrip } from './landing/ShapeStrip';
import { Stages } from './landing/Stages';

const ShelterViewer = lazy(() =>
  import('../viewer/ShelterViewer').then((m) => ({ default: m.ShelterViewer })),
);
const TemperatureChart = lazy(() =>
  import('../results/TemperatureChart').then((m) => ({ default: m.TemperatureChart })),
);

const ctaClass =
  'inline-flex items-center justify-center rounded-sm bg-accent px-5 py-2.5 text-base font-medium text-accent-fg transition-colors hover:bg-accent-hover';

/** One real preview of the default shelter, fetched once and shared by the
 *  hero's temperature strip and the chart section — never invented data
 *  (F4.md condition 1's rule still holds). Silently omitted if the call
 *  fails; no placeholder standing in for it. */
function usePreview(options: Options | null): PreviewResponse | null {
  const [preview, setPreview] = useState<PreviewResponse | null>(null);

  useEffect(() => {
    if (!options) return;
    let cancelled = false;
    previewSimulation(options.defaults).then(
      (r) => {
        if (!cancelled) setPreview(r);
      },
      () => {
        // No fallback/fake chart or strip.
      },
    );
    return () => {
      cancelled = true;
    };
  }, [options]);

  return preview;
}

/** `undefined` while GET /api/auth/me is in flight, then the user (or `null`
 *  if logged out) -- a logged-in visitor lands on /app, not the marketing
 *  page (A2.md condition 4). */
function useMe(): PublicUser | null | undefined {
  const [user, setUser] = useState<PublicUser | null | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    getMe().then((u) => {
      if (!cancelled) setUser(u);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return user;
}

export function Landing() {
  const { options } = useOptions();
  const preview = usePreview(options);
  const user = useMe();

  if (user === undefined) return null;
  if (user) return <Navigate to="/app" replace />;

  if (!options) return null;

  return (
    <>
      <Hero options={options} preview={preview} Viewer={ShelterViewer} />
      <ShapeStrip options={options} Viewer={ShelterViewer} />
      <Stages />
      <Chart options={options} preview={preview} TemperatureChart={TemperatureChart} />

      <section>
        <div className="mx-auto max-w-3xl px-4 py-20 text-center sm:px-6">
          <h2 className="text-2xl font-semibold sm:text-3xl">Design for the cold.</h2>
          <p className="mt-3 text-ink-muted">Simulate your shelter before you build it.</p>
          <div className="mt-7">
            <Link to="/register" className={ctaClass}>
              Design a shelter →
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
