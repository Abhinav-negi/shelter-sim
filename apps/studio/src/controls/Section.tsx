// A collapsible control group with a quiet heading — the one layout wrapper
// every control section uses (F3.md condition 1: Environment / Geometry /
// Materials / Openings / Orientation / Advanced; Advanced collapsed by
// default).
import { useState } from 'react';
import type { ReactNode } from 'react';

export interface SectionProps {
  title: string;
  defaultOpen?: boolean;
  children: ReactNode;
}

export function Section({ title, defaultOpen = true, children }: SectionProps) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-b border-hairline py-4 first:pt-0">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center justify-between text-left"
      >
        <span className="text-xs font-medium tracking-wide text-ink-muted uppercase">{title}</span>
        <span aria-hidden className="text-ink-muted">
          {open ? '−' : '+'}
        </span>
      </button>
      {open ? <div className="mt-4 flex flex-col gap-4">{children}</div> : null}
    </div>
  );
}
