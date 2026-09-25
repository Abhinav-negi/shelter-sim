import type { ReactNode } from 'react';

export interface FieldRowProps {
  label: string;
  htmlFor?: string;
  hint?: string;
  error?: string | undefined;
  children: ReactNode;
}

/** Label + control + optional hint/error. The one layout wrapper every control group uses. */
export function FieldRow({ label, htmlFor, hint, error, children }: FieldRowProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <label
        htmlFor={htmlFor}
        className="text-xs font-medium tracking-wide text-ink-muted uppercase"
      >
        {label}
      </label>
      {children}
      {error ? (
        <p className="text-xs text-thermal-hottest">{error}</p>
      ) : hint ? (
        <p className="text-xs text-ink-muted">{hint}</p>
      ) : null}
    </div>
  );
}
