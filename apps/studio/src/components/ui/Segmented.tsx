import { useId } from 'react';
import { cx } from '../../lib/cx';

export interface SegmentedProps<T extends string> {
  options: Array<{ value: T; label: string }>;
  value: T;
  onChange: (value: T) => void;
  'aria-label': string;
  disabled?: boolean;
}

/** A radio group styled as a row of segments. Native inputs give free keyboard support. */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  disabled,
  ...rest
}: SegmentedProps<T>) {
  const name = useId();
  return (
    <div
      role="radiogroup"
      aria-label={rest['aria-label']}
      className="inline-flex rounded-sm border border-hairline p-0.5"
    >
      {options.map((opt) => {
        const checked = opt.value === value;
        return (
          <label
            key={opt.value}
            className={cx(
              'cursor-pointer rounded-[2px] px-3 py-1 text-xs font-medium transition-colors duration-100',
              'has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-accent has-[:focus-visible]:outline-offset-2',
              checked ? 'bg-accent text-accent-fg' : 'text-ink-muted hover:text-ink',
              disabled && 'cursor-not-allowed opacity-40',
            )}
          >
            <input
              type="radio"
              name={name}
              value={opt.value}
              checked={checked}
              disabled={disabled}
              onChange={() => onChange(opt.value)}
              className="sr-only"
            />
            {opt.label}
          </label>
        );
      })}
    </div>
  );
}
