import { Link } from 'react-router';

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
    body: 'Future work: a slower, higher-fidelity solver for final sign-off.',
  },
];

const ctaClass =
  'inline-flex items-center justify-center rounded-sm bg-accent px-4 py-2 text-sm font-medium text-accent-fg transition-colors hover:bg-accent-hover';
const secondaryClass =
  'inline-flex items-center justify-center text-sm text-ink-muted transition-colors hover:text-ink';

export function Landing() {
  return (
    <>
      <section className="mx-auto max-w-5xl px-4 py-16 sm:px-6 sm:py-24">
        <p className="font-mono text-xs tracking-widest text-ink-muted uppercase">
          ShelterSim Studio
        </p>
        <h1 className="mt-4 max-w-2xl text-3xl leading-tight font-semibold sm:text-4xl">
          Design for the cold.
        </h1>
        <p className="mt-3 max-w-md text-ink-muted">
          Simulate your shelter before you build it.
        </p>
        <div className="mt-8 flex flex-wrap items-center gap-6">
          <Link to="/login" className={ctaClass}>
            Design a shelter →
          </Link>
          <a href="#stages" className={secondaryClass}>
            Explore the technology
          </a>
        </div>

        <div className="mt-16 flex aspect-video w-full items-center justify-center rounded border border-hairline bg-surface">
          <p className="font-mono text-xs text-ink-muted">
            3D shelter preview — arrives with the viewer
          </p>
        </div>
      </section>

      <section id="stages" className="border-t border-hairline">
        <div className="mx-auto max-w-5xl px-4 py-16 sm:px-6">
          <h2 className="text-xs tracking-widest text-ink-muted uppercase">How it works</h2>
          <ol className="mt-6 divide-y divide-hairline">
            {stages.map((stage, i) => (
              <li key={stage.title} className="flex gap-6 py-5">
                <span className="font-mono text-sm text-ink-muted">0{i + 1}</span>
                <div>
                  <h3 className="text-sm font-medium">{stage.title}</h3>
                  <p className="mt-1 text-sm text-ink-muted">{stage.body}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>
    </>
  );
}
