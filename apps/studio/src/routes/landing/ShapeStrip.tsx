// G5 condition 2(a): three small live viewers (box/cylinder/dome), each
// mounted only once scrolled into view — `useInView` (hooks.ts) defers even
// requesting the (already-lazy) ShelterViewer chunk/instance until then, so
// three idle WebGL contexts never sit on the page at load. Shapes reuse the
// already-merged G3 contract: `{...options.defaults, shape: 'cylinder'}`
// (cylinder/dome read `lengthM` as the diameter).
import { Suspense } from 'react';
import type { ComponentType } from 'react';
import type { Options, Shape } from '@shelter/studio-server';
import type { ShelterViewerProps } from '../../viewer/ShelterViewer';
import { useInView } from './hooks';

const SHAPES: { shape: Shape; label: string }[] = [
  { shape: 'box', label: 'Box' },
  { shape: 'cylinder', label: 'Cylinder' },
  { shape: 'dome', label: 'Dome' },
];

const NOON_HOUR = 12;

function ShapeCard({
  options,
  shape,
  label,
  Viewer,
}: {
  options: Options;
  shape: Shape;
  label: string;
  Viewer: ComponentType<ShelterViewerProps>;
}) {
  const [ref, inView] = useInView<HTMLDivElement>();
  return (
    <div className="flex flex-col gap-3">
      <div ref={ref} className="aspect-square border border-hairline bg-surface">
        {inView && (
          <Suspense fallback={null}>
            <Viewer design={{ ...options.defaults, shape }} options={options} hour={NOON_HOUR} />
          </Suspense>
        )}
      </div>
      <p className="font-mono text-xs tracking-widest text-ink-muted uppercase">{label}</p>
    </div>
  );
}

export function ShapeStrip({ options, Viewer }: { options: Options; Viewer: ComponentType<ShelterViewerProps> }) {
  return (
    <section className="border-b border-hairline">
      <div className="mx-auto max-w-4xl px-4 py-16 sm:px-6">
        <h2 className="text-xs tracking-widest text-ink-muted uppercase">Any footprint</h2>
        <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-3">
          {SHAPES.map(({ shape, label }) => (
            <ShapeCard key={shape} options={options} shape={shape} label={label} Viewer={Viewer} />
          ))}
        </div>
      </div>
    </section>
  );
}
