import type { InputHTMLAttributes } from 'react';
import { cx } from '../../lib/cx';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  /** Numeric/unit fields read better in mono, matching the rest of the instrument UI. */
  mono?: boolean;
}

export function Input({ mono, className, ...props }: InputProps) {
  return (
    <input
      className={cx(
        'w-full rounded-sm border border-hairline bg-paper px-3 py-2 text-sm text-ink',
        'placeholder:text-ink-muted disabled:cursor-not-allowed disabled:opacity-40',
        mono && 'font-mono',
        className,
      )}
      {...props}
    />
  );
}
