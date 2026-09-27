// G5: the cinematic hero — full-viewport, pinned to the dark tokens
// regardless of the site's light/dark toggle (useForceDarkTokens, hooks.ts),
// with the live ShelterViewer slowly auto-rotating while the sun sweeps
// dawn -> dusk, and a thin live temperature strip sampled off the same real
// preview the chart section shows (never fake — sampleAtHour.ts).
//
// Below `sm` this keeps Q1F #1's fix: the viewer gets its own box in normal
// flow (not an absolute overlay under the text), so the building stays
// clearly visible at 390px instead of a copy-driven text panel covering it.
import { useRef } from 'react';
import { Link } from 'react-router';
import type { Options, PreviewResponse } from '@shelter/studio-server';
import type { ComponentType } from 'react';
import type { ResultJson } from '../../results/types';
import type { ShelterViewerProps } from '../../viewer/ShelterViewer';
import { useAnimatedHour, useForceDarkTokens, useReducedMotion } from './hooks';
import { sampleAtHour } from './sampleAtHour';

const DAWN_HOUR = 6;
const DUSK_HOUR = 18;

const ctaClass =
  'inline-flex items-center justify-center rounded-sm bg-accent px-5 py-2.5 text-base font-medium text-accent-fg transition-colors hover:bg-accent-hover';
const secondaryClass = 'inline-flex items-center justify-center text-base text-ink-muted transition-colors hover:text-ink';

export function Hero({
  options,
  preview,
  Viewer,
}: {
  options: Options;
  preview: PreviewResponse | null;
  Viewer: ComponentType<ShelterViewerProps>;
}) {
  const reducedMotion = useReducedMotion();
  const heroRef = useRef<HTMLElement>(null);
  useForceDarkTokens(heroRef);
  const hour = useAnimatedHour(!reducedMotion, DAWN_HOUR, DUSK_HOUR);
  const sample = preview ? sampleAtHour(preview.result as ResultJson, hour) : null;

  return (
    <section
      ref={heroRef}
      className="relative w-full overflow-hidden border-b border-hairline bg-paper text-ink sm:h-screen sm:min-h-[560px]"
    >
      {/* Q2F: shifted right (visual-only CSS transform, not a resize -- the
       *  canvas keeps its full-viewport size/aspect, so the camera framing in
       *  ShelterViewer.tsx/framing.ts is untouched) so the building's
       *  silhouette clears the text column at wide widths instead of sitting
       *  directly behind the headline (Q2.md finding #1). Unchanged below
       *  `sm` (no transform class there), matching Q1F #1's existing stacked
       *  mobile layout. */}
      <div className="h-[58vh] min-h-[360px] w-full sm:absolute sm:inset-0 sm:h-full sm:min-h-0 sm:translate-x-[22%]">
        <Viewer design={options.defaults} options={options} hour={hour} autoRotate={!reducedMotion} />
      </div>

      <div className="relative z-10 flex flex-col justify-end gap-6 px-4 pt-6 pb-8 sm:absolute sm:inset-0 sm:h-full sm:px-10 sm:pt-0 sm:pb-14">
        <div className="max-w-2xl">
          <p className="font-mono text-xs tracking-widest text-ink-muted uppercase">ShelterSim Studio</p>
          <h1 className="mt-3 text-4xl leading-[1.05] font-semibold sm:text-6xl">Design for the cold.</h1>
          <p className="mt-4 max-w-md text-lg text-ink-muted">Simulate your shelter before you build it.</p>
          <div className="mt-7 flex flex-wrap items-center gap-6">
            <Link to="/register" className={ctaClass}>
              Design a shelter →
            </Link>
            <a href="#stages" className={secondaryClass}>
              Explore the technology
            </a>
          </div>
        </div>

        {sample && (
          <div className="flex flex-wrap items-baseline gap-x-6 gap-y-1 border-t border-hairline pt-4 font-mono text-sm">
            <span className="text-ink-muted">At {String(Math.round(hour) % 24).padStart(2, '0')}:00 —</span>
            <span>
              Indoor <span className="text-ink">{sample.indoorC.toFixed(1)}°C</span>
            </span>
            <span>
              Outdoor <span className="text-ink-muted">{sample.outdoorC.toFixed(1)}°C</span>
            </span>
          </div>
        )}
      </div>
    </section>
  );
}
