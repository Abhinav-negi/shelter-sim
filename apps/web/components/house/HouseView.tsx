'use client';

// apps/web/components/house/HouseView.tsx
//
// T-46 -- "the screenshot that carries the pitch". A hand-authored 2.5D
// isometric SVG of `store.request.building`, no WebGL/Three.js. Each
// `Surface` is one clickable `<path>`, coloured by
// `result.temperatures.surfaces[id].exterior` at `store.scrubberHour`, plus a
// time scrubber with play/pause and a colour legend.
//
// Reads `useStore()`/`actions` directly (the same pattern `app-shell.tsx`'s
// `PresetReadout` already uses) rather than threading `building`/`result` in
// as props from a parent this task does not own (`app/app-shell.tsx` is off
// this task's allow-list) -- this component is meant to be rendered
// standalone, and wiring it into the app shell's `slot-house` placeholder is
// explicitly a gap for a future task (see this task's brief / Evidence
// block).
//
// This file only ever calls `actions.setSelectedSurfaceId` -- it never opens
// an editor itself; T-44 (not built this round) is the consumer of that
// field.

// Explicit `React` import: this file's JSX must also compile under a classic
// (non-automatic) JSX transform -- this task's own test file renders it via
// `react-dom/server` under vitest's default esbuild transform, which is
// classic, unlike Next's own SWC pipeline (automatic runtime, no import
// needed there). Harmless either way; required for this one.
import React, { useEffect, useState } from 'react';
import type { Kelvin, SimulationResult } from '@shelter/engine';
import { actions, getStoreState, useStore } from '../../lib/store';
import { formatTempC } from '../../lib/units';
import { boundingBox, surfaceQuads } from './geometry';
import { colorForTemp, NEUTRAL_FILL, tempDomainForIndex } from './color';
import { hourToTimeIndex } from './time';

/** ms per simulated hour while playing -- a 24 h loop in ~9.6 s. LOG.md rule
 * 14: named calibration knob, not a magic number. */
const PLAY_TICK_MS = 400;

/** Pure loop step, independently testable without mounting anything
 * (acceptance test 6: "completes a 24 h loop"). */
export function nextScrubberHour(hour: number): number {
  return (Math.floor(hour) + 1) % 24;
}

/** The one thing a click or an Enter/Space key on a surface does. Exported so
 * it can be exercised directly in a test without simulating a real DOM event
 * (this environment has no jsdom -- see `house.test.ts`'s header). */
export function activateSurface(id: string): void {
  actions.setSelectedSurfaceId(id);
}

function Legend({ result, domain }: { result: SimulationResult | null; domain: [Kelvin, Kelvin] | null }) {
  if (!result || !domain) {
    return (
      <div className="house-legend" data-testid="house-legend">
        No simulation result yet
      </div>
    );
  }
  const [lo, hi] = domain;
  const mid = ((lo as number) + (hi as number)) / 2;
  return (
    <div className="house-legend" data-testid="house-legend">
      <span data-testid="house-legend-text">
        Exterior surface temperature: {formatTempC(lo)} to {formatTempC(hi)}
      </span>
      <div
        className="house-legend-bar"
        style={{
          background: `linear-gradient(90deg, ${colorForTemp(lo, domain)}, ${colorForTemp(mid, domain)}, ${colorForTemp(hi, domain)})`,
        }}
      />
    </div>
  );
}

export function HouseView() {
  const state = useStore();
  const { request, result, scrubberHour, selectedSurfaceId } = state;
  const building = request.building;
  const [isPlaying, setIsPlaying] = useState(false);

  // Play/pause: advances `store.scrubberHour` only -- never touches
  // `request`, so it never triggers `setRequest`'s debounced simulation
  // dispatch (acceptance test 11).
  useEffect(() => {
    if (!isPlaying) return undefined;
    const id = setInterval(() => {
      actions.setScrubberHour(nextScrubberHour(getStoreState().scrubberHour));
    }, PLAY_TICK_MS);
    return () => clearInterval(id);
  }, [isPlaying]);

  const quads = surfaceQuads(building);
  const bbox = boundingBox(building);
  const pad = 1;
  const viewBox = `${(bbox.minX - pad).toFixed(2)} ${(bbox.minY - pad).toFixed(2)} ${(bbox.maxX - bbox.minX + 2 * pad).toFixed(2)} ${(bbox.maxY - bbox.minY + 2 * pad).toFixed(2)}`;

  const timeIndex = result ? hourToTimeIndex(result, request.weather.startHour, scrubberHour) : 0;
  const domain = result ? tempDomainForIndex(result, timeIndex) : null;

  function fillFor(id: string): string {
    if (!result || !domain) return NEUTRAL_FILL;
    const series = result.temperatures.surfaces[id];
    const v = series?.exterior[timeIndex];
    if (v === undefined) return NEUTRAL_FILL;
    return colorForTemp(v, domain);
  }

  const hourLabel = `${String(Math.floor(scrubberHour)).padStart(2, '0')}:00`;

  return (
    <div className="house-view" data-testid="house-view" style={{ maxWidth: '100%' }}>
      {/* No `width`/`height` SVG attributes (acceptance test 7) -- `viewBox`
          is the only sizing source. The CSS below (not an SVG attribute) is
          what makes it actually shrink to fit a narrow container instead of
          falling back to the SVG spec's 300x150 default intrinsic size. */}
      <svg viewBox={viewBox} role="group" aria-label="Shelter isometric view" style={{ width: '100%', height: 'auto', display: 'block' }}>
        {quads.map((q) => (
          <path
            key={q.id}
            data-testid="house-surface"
            data-surface-id={q.id}
            data-surface-kind={q.kind}
            d={q.d}
            fill={fillFor(q.id)}
            stroke={selectedSurfaceId === q.id ? '#0f172a' : '#475569'}
            strokeWidth={selectedSurfaceId === q.id ? 0.06 : 0.03}
            tabIndex={0}
            role="button"
            aria-label={`Surface ${q.id}`}
            aria-pressed={selectedSurfaceId === q.id}
            onClick={() => activateSurface(q.id)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                activateSurface(q.id);
              }
            }}
          />
        ))}
      </svg>

      <Legend result={result} domain={domain} />

      <div className="house-scrubber">
        <button
          type="button"
          data-testid="house-play-pause"
          aria-pressed={isPlaying}
          onClick={() => setIsPlaying((p) => !p)}
        >
          {isPlaying ? 'Pause' : 'Play'}
        </button>
        <input
          type="range"
          min={0}
          max={23}
          step={1}
          value={Math.floor(scrubberHour)}
          aria-label="Hour of day"
          data-testid="house-scrubber"
          onChange={(e) => actions.setScrubberHour(Number(e.target.value))}
        />
        <span data-testid="house-scrubber-label">{hourLabel}</span>
      </div>
    </div>
  );
}
