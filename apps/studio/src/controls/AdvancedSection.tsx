import { useId } from 'react';
import type { Options } from '@shelter/studio-server';
import { FieldRow, Select } from '../components/ui';
import { useShelterDesign } from '../design/store';
import { Section } from './Section';

export function AdvancedSection({ options }: { options: Options }) {
  const occupancyPresetId = useShelterDesign((s) => s.design?.occupancyPresetId ?? '');
  const setOccupancyPresetId = useShelterDesign((s) => s.setOccupancyPresetId);
  const fieldId = useId();
  const occupancy = options.occupancyPresets.find((o) => o.id === occupancyPresetId);

  return (
    <Section title="Advanced" defaultOpen={false}>
      <FieldRow label="Occupancy" htmlFor={fieldId} {...(occupancy?.blurb ? { hint: occupancy.blurb } : {})}>
        <Select
          id={fieldId}
          value={occupancyPresetId}
          onChange={(e) => setOccupancyPresetId(e.target.value)}
          options={options.occupancyPresets.map((o) => ({ value: o.id, label: o.name }))}
        />
      </FieldRow>
    </Section>
  );
}
