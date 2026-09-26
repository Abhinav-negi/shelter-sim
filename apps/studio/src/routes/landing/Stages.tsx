// G5 condition 2(b): the 4 stages, revealed on scroll. `useInView` flips a
// class once each item is seen (and stays revealed — no re-hide on scroll-up,
// which would read as distracting rather than purposeful); the `.reveal`
// CSS transition in styles/index.css does the actual motion, and its own
// `prefers-reduced-motion` rule forces full opacity/no transform unconditionally,
// so content is visible even if this component never mounts (condition 3).
import { useInView } from './hooks';

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

function StageItem({ title, body, index }: { title: string; body: string; index: number }) {
  const [ref, inView] = useInView<HTMLLIElement>(0.2);
  return (
    <li
      ref={ref}
      className={`reveal flex gap-6 border-t border-hairline pt-6 first:border-t-0 first:pt-0 ${inView ? 'is-visible' : ''}`}
    >
      <span className="shrink-0 font-mono text-sm text-ink-muted">0{index + 1}</span>
      <div className="min-w-0 flex-1">
        <h3 className="text-lg font-medium">{title}</h3>
        <p className="mt-1.5 max-w-md text-sm text-ink-muted">{body}</p>
      </div>
    </li>
  );
}

export function Stages() {
  return (
    <section id="stages" className="border-b border-hairline">
      <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
        <h2 className="text-xs tracking-widest text-ink-muted uppercase">How it works</h2>
        <ol className="mt-8 flex flex-col gap-10">
          {stages.map((stage, i) => (
            <StageItem key={stage.title} title={stage.title} body={stage.body} index={i} />
          ))}
        </ol>
      </div>
    </section>
  );
}
