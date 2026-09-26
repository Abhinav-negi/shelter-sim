// G5 condition 2(c): the live chart gets its own section (previously folded
// into a stage's body, F4). Same real preview as the hero strip (Landing.tsx
// fetches it once, passed down here) — never a separate/fake call.
import { Suspense } from 'react';
import type { ComponentType } from 'react';
import type { Options, PreviewResponse } from '@shelter/studio-server';
import type { ResultJson } from '../../results/types';

export function Chart({
  options,
  preview,
  TemperatureChart,
}: {
  options: Options;
  preview: PreviewResponse | null;
  TemperatureChart: ComponentType<{ result: ResultJson }>;
}) {
  if (!preview) return null; // no fake chart — same rule as the hero strip

  return (
    <section className="border-b border-hairline">
      <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
        <h2 className="text-xs tracking-widest text-ink-muted uppercase">A full day, in ~65 ms</h2>
        <p className="mt-3 max-w-md text-sm text-ink-muted">
          A live run of the default shelter —{' '}
          {options.presets.find((p) => p.id === options.defaults.presetId)?.name ?? options.defaults.presetId}.
        </p>
        <div className="mt-8">
          <Suspense fallback={null}>
            <TemperatureChart result={preview.result as ResultJson} />
          </Suspense>
        </div>
      </div>
    </section>
  );
}
