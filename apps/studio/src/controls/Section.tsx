// A collapsible control group with a quiet heading — the one layout wrapper
// every control section uses (F3.md condition 1: Environment / Geometry /
// Materials / Openings / Orientation / Advanced; Advanced collapsed by
// default).
import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';

export interface SectionProps {
  title: string;
  defaultOpen?: boolean;
  /** G4 (condition 3): true forces the section open — e.g. selecting one of
   *  its parts in the 3D viewer. One-way (still user-toggleable afterward),
   *  not a fully controlled `open`: nothing here re-closes the section, so a
   *  parent never fights the person's own click on the header. */
  open?: boolean;
  children: ReactNode;
}

export function Section({ title, defaultOpen = true, open, children }: SectionProps) {
  const [isOpen, setOpen] = useState(defaultOpen);
  useEffect(() => {
    if (open) setOpen(true);
  }, [open]);
  return (
    <div className="border-b border-hairline py-4 first:pt-0">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={isOpen}
        className="flex w-full items-center justify-between text-left"
      >
        <span className="text-xs font-medium tracking-wide text-ink-muted uppercase">{title}</span>
        <span aria-hidden className="text-ink-muted">
          {isOpen ? '−' : '+'}
        </span>
      </button>
      {isOpen ? <div className="mt-4 flex flex-col gap-4">{children}</div> : null}
    </div>
  );
}
