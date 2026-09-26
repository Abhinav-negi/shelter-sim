import { useId } from 'react';
import type { Options } from '@shelter/studio-server';
import { FieldRow, Segmented, Select } from '../components/ui';
import { useShelterDesign } from '../design/store';
import { Section } from './Section';
import { SliderField } from './SliderField';

const FACADES = [
  { key: 'S', label: 'South window' },
  { key: 'E', label: 'East window' },
  { key: 'W', label: 'West window' },
  { key: 'N', label: 'North window' },
] as const;

export function OpeningsSection({ options }: { options: Options }) {
  const windowWwr = useShelterDesign((s) => s.design?.windowWwr ?? { S: 0, E: 0, W: 0, N: 0 });
  const glazingId = useShelterDesign((s) => s.design?.glazingId ?? '');
  const nightShutters = useShelterDesign((s) => s.design?.nightShutters ?? false);
  const setWindowWwr = useShelterDesign((s) => s.setWindowWwr);
  const setGlazingId = useShelterDesign((s) => s.setGlazingId);
  const setNightShutters = useShelterDesign((s) => s.setNightShutters);
  const glazingFieldId = useId();

  const wwrRange = options.ranges.windowWwr;
  const glazing = options.glazings.find((g) => g.id === glazingId);

  return (
    <Section title="Openings">
      {FACADES.map(({ key, label }) => (
        <SliderField
          key={key}
          label={label}
          value={windowWwr[key] * 100}
          onChange={(pct) => setWindowWwr(key, Math.round(pct) / 100)}
          min={wwrRange.min * 100}
          max={wwrRange.max * 100}
          step={(wwrRange.step ?? 0.05) * 100}
          unit="%"
          decimals={0}
          hint="Share of that wall's area that is glazed"
        />
      ))}
      <FieldRow label="Glazing" htmlFor={glazingFieldId} {...(glazing?.blurb ? { hint: glazing.blurb } : {})}>
        <Select
          id={glazingFieldId}
          value={glazingId}
          onChange={(e) => setGlazingId(e.target.value)}
          options={options.glazings.map((g) => ({ value: g.id, label: g.name }))}
        />
      </FieldRow>
      <FieldRow label="Night shutters" hint="Closes windows 20:00–06:00, adding insulation">
        <Segmented
          aria-label="Night shutters"
          value={nightShutters ? 'closed' : 'open'}
          onChange={(v) => setNightShutters(v === 'closed')}
          options={[
            { value: 'open', label: 'Open' },
            { value: 'closed', label: 'Closed at night' },
          ]}
        />
      </FieldRow>
    </Section>
  );
}
