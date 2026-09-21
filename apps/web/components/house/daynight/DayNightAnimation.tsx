'use client';

// apps/web/components/house/daynight/DayNightAnimation.tsx
//
// T-53 -- "the sun rises over your shelter, tracks across the sky, casts
// moving shadows, sets, and night falls, and it loops until the results are
// ready." An animation LAYER, not a second house: this component draws only
// sky / stars / sun / shadow / a clock-and-altitude readout / the progress
// ring, in its own absolutely-positioned overlay, and imports T-46's
// geometry (`project`, `boundingBox`, `deriveGeometry`) so that layer shares
// exactly one coordinate system with `HouseView`'s own SVG.
//
// GOTCHA -- "renders inside T-46's SVG" vs. this task's own file allow-list
// (`daynight/**` only; `components/house/HouseView.tsx` may be imported from,
// never edited): `HouseView.tsx` has no child/overlay slot to render INTO
// its actual `<svg>` element, and adding one is exactly the kind of edit this
// task is not allowed to make. The honest resolution taken here, matching
// this task's own "Conflicts with: T-46 (coordinate the layer)" line: this
// component owns a SIBLING `<svg>` that reproduces `HouseView.tsx`'s own
// `viewBox` formula verbatim (`boundingBox(building)`, `pad = 1` -- see the
// comment at that line below) so that when a parent stacks
// `<DayNightAnimation/>` absolutely behind `<HouseView/>` inside one
// `position: relative` wrapper, the shadow polygon lands exactly where
// HouseView's own house silhouette sits, pixel for pixel. The house block
// itself (SVG + legend + scrubber, all HouseView's own layout) is taller
// than just its `<svg>`, so the sky gradient's box will also show faintly
// behind HouseView's legend/scrubber text when stacked this way -- a
// cosmetic-only side effect, not a functional one.
// ponytail: wiring the actual stacking (`app/app-shell.tsx`'s `slot-house`)
// is off this task's allow-list, exactly as it was for T-46's own
// app-shell integration -- a future task drops
// `<div style={{position:'relative'}}><DayNightAnimation/><HouseView/></div>`
// in, or gives `HouseView` a proper overlay slot if it wants the gradient
// confined to just the SVG box. Nothing here blocks that.

import React, { useEffect, useState } from 'react';
import { sunPosition } from '@shelter/engine';
import { useStore } from '../../../lib/store';
import { boundingBox, deriveGeometry } from '../geometry';
import {
  computeShadow,
  isSunUp,
  skyGradientCss,
  starPositions,
  sunScreenPosition,
} from './sceneMath';
import { attachDayNightLoop, prefersReducedMotion } from './loop';
import { getProgress, subscribeProgress, type Progress } from './progress';

/** Simulated hours advanced per real second while looping in waiting mode --
 * a full 24 h day plays out in 8 s. LOG.md rule 14: named calibration knob. */
const HOURS_PER_SECOND = 3;

function ProgressRing({
  progress,
  reducedMotion,
}: {
  progress: Progress | null;
  reducedMotion: boolean;
}) {
  const r = 11;
  const c = 2 * Math.PI * r;

  if (!progress) {
    // ACCEPTANCE TEST 7: no progress data available yet -> an INDETERMINATE
    // spinner, never a fabricated percentage (no number is rendered at all).
    return (
      <div
        className="daynight-ring daynight-ring-indeterminate"
        data-testid="daynight-ring-indeterminate"
        role="progressbar"
        aria-label="Running scenarios"
        style={{
          position: 'absolute',
          top: 4,
          right: 4,
          width: 28,
          height: 28,
          pointerEvents: 'none',
        }}
      >
        {!reducedMotion && (
          <style>{'@keyframes daynight-spin { to { transform: rotate(360deg); } }'}</style>
        )}
        <svg
          viewBox="0 0 28 28"
          style={{
            width: '100%',
            height: '100%',
            animation: reducedMotion ? undefined : 'daynight-spin 1s linear infinite',
          }}
        >
          <circle
            cx={14}
            cy={14}
            r={r}
            fill="none"
            stroke="#e2e8f0"
            strokeWidth={3}
            strokeDasharray={`${c * 0.28} ${c}`}
            strokeLinecap="round"
          />
        </svg>
      </div>
    );
  }

  const { done, total } = progress;
  const frac = total > 0 ? Math.min(1, done / total) : 0;
  return (
    <div
      className="daynight-ring"
      data-testid="daynight-ring"
      role="progressbar"
      aria-label="Scenario progress"
      aria-valuenow={done}
      aria-valuemin={0}
      aria-valuemax={total}
      style={{
        position: 'absolute',
        top: 4,
        right: 4,
        width: 28,
        height: 28,
        pointerEvents: 'none',
      }}
    >
      <svg viewBox="0 0 28 28" style={{ width: '100%', height: '100%' }}>
        <circle cx={14} cy={14} r={r} fill="none" stroke="#e2e8f0" strokeWidth={3} />
        <circle
          cx={14}
          cy={14}
          r={r}
          fill="none"
          stroke="#0ea5e9"
          strokeWidth={3}
          strokeDasharray={`${frac * c} ${c}`}
          strokeLinecap="round"
          transform="rotate(-90 14 14)"
        />
      </svg>
      <span
        data-testid="daynight-ring-text"
        style={{ display: 'block', fontSize: 8, textAlign: 'center' }}
      >
        {done}/{total}
      </span>
    </div>
  );
}

export function DayNightAnimation() {
  const state = useStore();
  const { request, status, scrubberHour } = state;
  const { site, weather, building } = request;

  // Computed once at mount (SSR-safe: `false` -- motion allowed -- when
  // `matchMedia` is unavailable, exactly like `loop.ts`'s own doc comment).
  const [reducedMotion] = useState<boolean>(prefersReducedMotion);
  const [waitingHour, setWaitingHour] = useState<number>(scrubberHour);
  const [progress, setProgressState] = useState<Progress | null>(getProgress());

  useEffect(() => subscribeProgress(() => setProgressState(getProgress())), []);

  // ACCEPTANCE TEST 9: reduced motion -> no self-driven loop at all, ever,
  // regardless of `status`. Otherwise: waiting mode loops continuously while
  // a scenario run is in flight (`status === 'running'`); scrubber mode
  // (`status !== 'running'`) never starts a loop -- the sun just follows
  // `store.scrubberHour` on whatever re-render that produces.
  const animate = status === 'running' && !reducedMotion;

  useEffect(() => {
    const raf = typeof requestAnimationFrame !== 'undefined' ? requestAnimationFrame : undefined;
    const caf = typeof cancelAnimationFrame !== 'undefined' ? cancelAnimationFrame : undefined;
    if (!raf || !caf) return undefined; // no browser rAF in this environment (SSR) -- nothing to attach
    let last: number | null = null;
    const handle = attachDayNightLoop(
      animate,
      (t) => {
        if (last === null) last = t;
        const dtSeconds = Math.max(0, (t - last) / 1000);
        last = t;
        setWaitingHour((h) => (h + dtSeconds * HOURS_PER_SECOND) % 24);
      },
      raf,
      caf,
    );
    // ACCEPTANCE TEST 12: unmount (or `animate` flipping) always calls
    // `.stop()`, which releases the outstanding `requestAnimationFrame`
    // handle via `cancelAnimationFrame` exactly once. No leak.
    return () => handle.stop();
  }, [animate]);

  // Scrubber mode reads `store.scrubberHour` directly -- the same field
  // `HouseView.tsx` reads for its own surface colours, so the two stay in
  // sync automatically (ACCEPTANCE TEST 8) without any extra wiring: both
  // components subscribe to the same store.
  const clockHour = animate ? waitingHour : scrubberHour;
  const dayOfYear = weather.startDayOfYear;
  const geom = deriveGeometry(building);

  // THE import this entire task exists to make honest.
  const sun = sunPosition(
    site.latitude,
    site.longitude,
    site.standardMeridian,
    dayOfYear,
    clockHour,
  );
  const shadow = computeShadow(sun, geom);
  const sunPos = sunScreenPosition(sun, geom);
  const up = isSunUp(sun);

  const bbox = boundingBox(building);
  const pad = 1; // MUST mirror HouseView.tsx's own viewBox pad -- see this file's header GOTCHA.
  const vbW = bbox.maxX - bbox.minX + 2 * pad;
  const vbH = bbox.maxY - bbox.minY + 2 * pad;
  const viewBox = `${(bbox.minX - pad).toFixed(2)} ${(bbox.minY - pad).toFixed(2)} ${vbW.toFixed(2)} ${vbH.toFixed(2)}`;

  const hh = Math.floor(clockHour) % 24;
  const mm = Math.floor((clockHour % 1) * 60);
  const hourLabel = `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;

  const stars = up ? [] : starPositions(28);

  return (
    // No fixed pixel width/height anywhere (ACCEPTANCE TEST 11, same rule
    // T-46's own `<svg>` follows) -- `width: 100%` + the SVG's `viewBox` are
    // the only sizing sources, so this shrinks to fit any container,
    // including 400px.
    <div
      className="daynight"
      data-testid="daynight"
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        maxWidth: '100%',
        background: skyGradientCss(sun.altitude),
        transition: reducedMotion ? undefined : 'background 0.6s linear',
        overflow: 'hidden',
        pointerEvents: 'none',
      }}
    >
      <svg
        data-testid="daynight-scene"
        viewBox={viewBox}
        role="presentation"
        aria-hidden="true"
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          display: 'block',
          overflow: 'visible',
        }}
      >
        {stars.map((s, i) => (
          <circle
            key={i}
            data-testid="daynight-star"
            cx={bbox.minX - pad + s.x * vbW}
            cy={bbox.minY - pad + s.y * vbH}
            r={s.r * 0.06}
            fill="#f8fafc"
            opacity={0.85}
          />
        ))}
        {shadow.d && (
          <path data-testid="daynight-shadow" d={shadow.d} fill="rgba(15, 23, 42, 0.32)" />
        )}
        {up && (
          <circle
            data-testid="daynight-sun"
            cx={sunPos.point.x}
            cy={sunPos.point.y}
            r={Math.max(geom.widthEW, geom.depthNS, geom.height) * 0.12}
            fill="#ffd76a"
          />
        )}
      </svg>

      <div
        className="daynight-info"
        data-testid="daynight-info"
        style={{
          position: 'absolute',
          top: 4,
          left: 4,
          fontSize: 12,
          lineHeight: 1.3,
          color: sun.altitude > 5 ? '#0f172a' : '#f8fafc',
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        <div data-testid="daynight-hour">{hourLabel}</div>
        <div data-testid="daynight-altitude">sun altitude {sun.altitude.toFixed(1)}°</div>
      </div>

      {status === 'running' && <ProgressRing progress={progress} reducedMotion={reducedMotion} />}
    </div>
  );
}
