import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { cx } from '../../lib/cx';
import { useSelection } from '../../design/selection';
import type { PartId } from '../../design/selection';

export interface FieldRowProps {
  label: string;
  htmlFor?: string;
  hint?: string;
  error?: string | undefined;
  children: ReactNode;
  /** G4 (conditions 3/4): the 3D part this field edits. Hovering/focusing the
   *  row highlights that part in the viewer; the row itself scrolls into view
   *  and briefly flashes when that same part gets selected in 3D. Omit for a
   *  field with no single matching part (e.g. Materials' "Walls", which edits
   *  all four orientations at once) — pass `highlighted` directly instead. */
  part?: PartId;
  /** Overrides the part-match highlight — for a field like "Walls" above that
   *  has no single `part` of its own but should still flash when any wall is
   *  selected. */
  highlighted?: boolean;
}

/** How long the "just selected" flash stays visible before fading (ms). */
const FLASH_MS = 1200;

/** Label + control + optional hint/error. The one layout wrapper every control group uses. */
export function FieldRow({ label, htmlFor, hint, error, children, part, highlighted }: FieldRowProps) {
  const selectedPart = useSelection((s) => s.selectedPart);
  const setHoveredPart = useSelection((s) => s.setHoveredPart);
  const isSelectedMatch = part !== undefined && part === selectedPart;
  const shouldHighlight = highlighted ?? isSelectedMatch;

  const rowRef = useRef<HTMLDivElement>(null);
  const [flash, setFlash] = useState(false);

  useEffect(() => {
    if (!shouldHighlight) return;
    rowRef.current?.scrollIntoView({ block: 'nearest' });
    setFlash(true);
    const timer = setTimeout(() => setFlash(false), FLASH_MS);
    return () => clearTimeout(timer);
  }, [shouldHighlight]);

  return (
    <div
      ref={rowRef}
      onMouseEnter={part ? () => setHoveredPart(part) : undefined}
      onMouseLeave={part ? () => setHoveredPart(null) : undefined}
      onFocus={part ? () => setHoveredPart(part) : undefined}
      onBlur={part ? () => setHoveredPart(null) : undefined}
      className={cx(
        'flex flex-col gap-1.5 rounded-sm outline outline-2 outline-offset-2 transition-colors duration-700',
        flash ? 'outline-accent' : 'outline-transparent',
      )}
    >
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
