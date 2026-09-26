// FieldRow + Slider + a mono value/unit readout — every numeric control in
// the panel is one of these (F3.md Rules: "Units are always shown in mono").
import { useId } from 'react';
import { FieldRow, NumberInput, Slider } from '../components/ui';

export interface SliderFieldProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  step?: number;
  unit: string;
  decimals?: number;
  hint?: string;
  disabled?: boolean;
}

export function SliderField({
  label,
  value,
  onChange,
  min,
  max,
  step,
  unit,
  decimals = 1,
  hint,
  disabled,
}: SliderFieldProps) {
  const id = useId();
  return (
    <FieldRow label={label} htmlFor={id} {...(hint !== undefined ? { hint } : {})}>
      <div className="flex items-center gap-3">
        <Slider
          id={id}
          value={value}
          onChange={onChange}
          min={min}
          max={max}
          {...(step !== undefined ? { step } : {})}
          {...(disabled !== undefined ? { disabled } : {})}
          className="flex-1"
        />
        <NumberInput
          value={value}
          onChange={onChange}
          min={min}
          max={max}
          step={step ?? 1}
          decimals={decimals}
          unit={unit}
          label={label}
          {...(disabled !== undefined ? { disabled } : {})}
        />
      </div>
    </FieldRow>
  );
}
