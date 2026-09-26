import { useEffect, useId, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import { cx } from '../../lib/cx';
import { Input } from './Input';

export interface NumberInputProps {
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  step?: number;
  decimals?: number;
  unit?: string;
  /** Accessible name (G1.md condition 1: "accessible label = the field label"). */
  label: string;
  id?: string;
  disabled?: boolean;
  className?: string;
}

function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}

/** Snap to the step grid, then drop float noise (0.1 steps otherwise yield
 *  2.3000000000000003 into the store). */
function roundToStep(v: number, step: number): number {
  return step > 0 ? Number((Math.round(v / step) * step).toPrecision(12)) : v;
}

function format(v: number, decimals: number): string {
  return v.toFixed(decimals);
}

/**
 * Compact typed numeric entry paired with a slider/dial (G1.md). Keeps a local
 * draft string so the user can type freely; commits (clamped to [min,max],
 * rounded to step) on Enter or blur. Escape reverts the draft. Invalid/empty
 * text reverts without calling onChange.
 */
export function NumberInput({
  value,
  onChange,
  min,
  max,
  step = 1,
  decimals = 0,
  unit,
  label,
  id,
  disabled,
  className,
}: NumberInputProps) {
  const autoId = useId();
  const inputId = id ?? autoId;
  const [draft, setDraft] = useState(() => format(value, decimals));
  const editing = useRef(false);

  useEffect(() => {
    if (!editing.current) setDraft(format(value, decimals));
  }, [value, decimals]);

  function commit() {
    const parsed = Number(draft);
    if (draft.trim() === '' || !Number.isFinite(parsed)) {
      setDraft(format(value, decimals));
      return;
    }
    apply(parsed);
  }

  // Round before clamping so a snapped value can never land outside [min,max].
  function apply(raw: number) {
    const next = clamp(roundToStep(raw, step), min, max);
    setDraft(format(next, decimals));
    if (next !== value) onChange(next);
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      // Arrows commit immediately (slider + model follow each press) instead of
      // the native step, which would only change the uncommitted draft.
      e.preventDefault();
      apply(value + (e.key === 'ArrowUp' ? step : -step));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      commit();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setDraft(format(value, decimals));
    }
  }

  return (
    <span className={cx('inline-flex w-20 shrink-0 items-center justify-end gap-1', className)}>
      <Input
        id={inputId}
        mono
        type="number"
        inputMode="decimal"
        aria-label={label}
        min={min}
        max={max}
        step={step}
        disabled={disabled}
        value={draft}
        onFocus={() => {
          editing.current = true;
        }}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={() => {
          commit();
          editing.current = false;
        }}
        className="w-full min-w-0 rounded-sm border-hairline px-1.5 py-1 text-right text-xs"
      />
      {unit ? <span className="text-xs text-ink-muted">{unit}</span> : null}
    </span>
  );
}
