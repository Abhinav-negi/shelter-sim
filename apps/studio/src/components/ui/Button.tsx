import type { ButtonHTMLAttributes } from 'react';
import { cx } from '../../lib/cx';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost';
}

const base =
  'inline-flex items-center justify-center gap-2 rounded-sm px-4 py-2 text-sm font-medium ' +
  'transition-colors duration-100 disabled:cursor-not-allowed disabled:opacity-40';

const variants: Record<NonNullable<ButtonProps['variant']>, string> = {
  primary: 'bg-accent text-accent-fg hover:enabled:bg-accent-hover',
  secondary: 'border border-hairline text-ink hover:enabled:bg-surface',
  ghost: 'text-ink-muted hover:enabled:bg-surface hover:enabled:text-ink',
};

/** The one button primitive. No "PrimaryCTA"/"GlassButton" variants — this is it. */
export function Button({ variant = 'primary', className, ...props }: ButtonProps) {
  return <button className={cx(base, variants[variant], className)} {...props} />;
}
