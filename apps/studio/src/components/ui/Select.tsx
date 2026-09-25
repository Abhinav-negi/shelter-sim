import type { SelectHTMLAttributes } from 'react';
import { cx } from '../../lib/cx';

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  options: Array<{ value: string; label: string }>;
}

export function Select({ options, className, ...props }: SelectProps) {
  return (
    <div className="relative">
      <select
        className={cx(
          'w-full appearance-none rounded-sm border border-hairline bg-paper px-3 py-2 pr-7 text-sm text-ink',
          'disabled:cursor-not-allowed disabled:opacity-40',
          className,
        )}
        {...props}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      <span
        aria-hidden
        className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-ink-muted"
      >
        ▾
      </span>
    </div>
  );
}
