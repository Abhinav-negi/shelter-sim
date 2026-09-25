import type { ComponentType } from 'react';
import { Check, ClipboardCheck, Home, Layers, MapPin } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface StepMeta {
  label: string;
  title: string;
  hint: string;
  icon: ComponentType<{ className?: string }>;
}

export const STEPS: StepMeta[] = [
  {
    label: 'Location',
    title: 'Where is the shelter?',
    hint: 'Weather and sun angle both come from the site you pick here.',
    icon: MapPin,
  },
  {
    label: 'Shelter',
    title: 'What are you building?',
    hint: 'Shape and size set how much wall, roof and floor there is to lose heat through.',
    icon: Home,
  },
  {
    label: 'Envelope',
    title: 'What is it made of?',
    hint: 'Materials, glazing and windows control how fast heat escapes overnight.',
    icon: Layers,
  },
  {
    label: 'Review',
    title: 'Review & run',
    hint: 'Check the design, then simulate a cold winter night in under a second.',
    icon: ClipboardCheck,
  },
];

interface StepperProps {
  step: number;
  maxReached: number;
  onJump: (index: number) => void;
}

export function Stepper({ step, maxReached, onJump }: StepperProps) {
  return (
    <ol className="flex items-start" aria-label="Wizard progress">
      {STEPS.map((s, i) => {
        const complete = i < step;
        const current = i === step;
        const reachable = i <= maxReached;
        const Icon = s.icon;
        return (
          <li key={s.label} className="flex flex-1 items-center last:flex-none">
            <div className="flex flex-col items-center gap-1.5">
              <button
                type="button"
                onClick={() => reachable && onJump(i)}
                disabled={!reachable}
                aria-current={current ? 'step' : undefined}
                aria-label={`Step ${i + 1}: ${s.label}${complete ? ' (complete)' : ''}`}
                className={cn(
                  'flex size-9 shrink-0 items-center justify-center rounded-full border text-sm font-medium transition-colors sm:size-10',
                  complete && 'border-primary bg-primary text-primary-foreground hover:opacity-90',
                  current && 'border-primary bg-primary/10 text-primary',
                  !complete && !current && 'border-border text-muted-foreground',
                  reachable && !current ? 'cursor-pointer' : 'cursor-default',
                  !reachable && 'opacity-50',
                )}
              >
                {complete ? <Check className="size-4" /> : <Icon className="size-4" />}
              </button>
              <span
                className={cn(
                  'text-center text-[11px] font-medium sm:text-xs',
                  current ? 'text-foreground' : 'text-muted-foreground',
                )}
              >
                {s.label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div
                aria-hidden
                className={cn(
                  'mx-1.5 mb-4 h-0.5 flex-1 rounded-full sm:mx-2',
                  i < step ? 'bg-primary' : 'bg-border',
                )}
              />
            )}
          </li>
        );
      })}
    </ol>
  );
}
