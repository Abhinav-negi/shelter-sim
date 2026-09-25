import type { InputHTMLAttributes } from 'react';
import { cx } from '../../lib/cx';

export interface SliderProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'value' | 'onChange'> {
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  step?: number;
}

/** A native range input, restyled to the hairline instrument look. */
export function Slider({ value, onChange, className, ...props }: SliderProps) {
  return (
    <input
      type="range"
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
      className={cx('shelter-slider w-full disabled:cursor-not-allowed disabled:opacity-40', className)}
      {...props}
    />
  );
}
