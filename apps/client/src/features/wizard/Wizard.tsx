import { useState } from 'react';
import { ChevronLeft, ChevronRight, Lightbulb } from 'lucide-react';
import type { DesignInput, Options } from '@/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { STEPS, Stepper } from './Stepper';
import {
  HEIGHT_RANGE,
  LENGTH_RANGE,
  Step1Location,
  Step2Shelter,
  Step3Envelope,
  Step4Review,
  WIDTH_RANGE,
  WWR_RANGE,
} from './steps';

/**
 * PROP CONTRACT — do not change without updating App.tsx's usage.
 * `value`/`onChange` is the single source of truth for the in-progress DesignInput;
 * App.tsx owns the state and persists it to localStorage. `onRun` fires simulate().
 */
export interface WizardProps {
  options: Options;
  value: DesignInput;
  onChange: (value: DesignInput) => void;
  onRun: () => void;
  running: boolean;
  error: string | null;
  /** Step to open on mount (0-indexed into STEPS). Defaults to 0 (Location); App.tsx passes
   *  the Review step (3) when re-entering the wizard via "Modify design" so the previously
   *  reviewed design and its Edit links are immediately usable, not buried three Next clicks away. */
  initialStep?: number;
}

function inRange(n: number, range: { min: number; max: number }) {
  return n >= range.min && n <= range.max;
}

function isStep1Valid(value: DesignInput, options: Options) {
  return (
    options.locations.some((l) => l.id === value.locationId) &&
    /^2023-\d{2}-\d{2}$/.test(value.date) &&
    !Number.isNaN(new Date(value.date).getTime())
  );
}

function isStep2Valid(value: DesignInput, options: Options) {
  return (
    options.presets.some((p) => p.id === value.presetId) &&
    inRange(value.lengthM, LENGTH_RANGE) &&
    inRange(value.widthM, WIDTH_RANGE) &&
    inRange(value.heightM, HEIGHT_RANGE) &&
    options.occupancyPresets.some((o) => o.id === value.occupancyPresetId)
  );
}

function isStep3Valid(value: DesignInput, options: Options) {
  const materialOk = (id: string | null) =>
    id === null || options.materials.some((m) => m.id === id);
  return (
    options.glazings.some((g) => g.id === value.glazingId) &&
    materialOk(value.wallMaterialId) &&
    materialOk(value.roofMaterialId) &&
    materialOk(value.floorMaterialId) &&
    (['S', 'E', 'W', 'N'] as const).every((k) => inRange(value.windowWwr[k], WWR_RANGE))
  );
}

function isStepValid(step: number, value: DesignInput, options: Options) {
  if (step === 0) return isStep1Valid(value, options);
  if (step === 1) return isStep2Valid(value, options);
  if (step === 2) return isStep3Valid(value, options);
  return true;
}

export function Wizard({
  options,
  value,
  onChange,
  onRun,
  running,
  error,
  initialStep = 0,
}: WizardProps) {
  const [step, setStep] = useState(initialStep);
  const [maxReached, setMaxReached] = useState(initialStep);

  const meta = STEPS[step];
  const valid = isStepValid(step, value, options);

  const goTo = (i: number) => setStep(i);
  const next = () => {
    if (!valid || step >= STEPS.length - 1) return;
    const nextStep = step + 1;
    setStep(nextStep);
    setMaxReached((m) => Math.max(m, nextStep));
  };
  const back = () => setStep((s) => Math.max(0, s - 1));

  return (
    <Card>
      <CardHeader>
        <Stepper step={step} maxReached={maxReached} onJump={goTo} />
      </CardHeader>
      <CardContent className="space-y-5">
        <div>
          <h2 className="text-lg font-semibold">{meta.title}</h2>
          <p className="text-muted-foreground mt-1 flex items-start gap-1.5 text-sm">
            <Lightbulb className="mt-0.5 size-3.5 shrink-0" aria-hidden />
            {meta.hint}
          </p>
        </div>

        <Separator />

        {step === 0 && <Step1Location options={options} value={value} onChange={onChange} />}
        {step === 1 && <Step2Shelter options={options} value={value} onChange={onChange} />}
        {step === 2 && <Step3Envelope options={options} value={value} onChange={onChange} />}
        {step === 3 && (
          <Step4Review
            options={options}
            value={value}
            onChange={onChange}
            onEdit={goTo}
            onRun={onRun}
            running={running}
            error={error}
          />
        )}

        <Separator />
        <div className="flex justify-between">
          <Button variant="outline" onClick={back} disabled={step === 0}>
            <ChevronLeft className="size-4" />
            Back
          </Button>
          {step < STEPS.length - 1 && (
            <Button onClick={next} disabled={!valid}>
              Next
              <ChevronRight className="size-4" />
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
