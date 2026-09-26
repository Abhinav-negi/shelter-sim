import { useId } from 'react';
import type { Options } from '@shelter/studio-server';
import { FieldRow, Select } from '../components/ui';
import { useShelterDesign } from '../design/store';
import { Section } from './Section';
import { SliderField } from './SliderField';

export function GeometrySection({ options }: { options: Options }) {
  const presetId = useShelterDesign((s) => s.design?.presetId ?? '');
  const lengthM = useShelterDesign((s) => s.design?.lengthM ?? 0);
  const widthM = useShelterDesign((s) => s.design?.widthM ?? 0);
  const heightM = useShelterDesign((s) => s.design?.heightM ?? 0);
  const setPresetId = useShelterDesign((s) => s.setPresetId);
  const setLengthM = useShelterDesign((s) => s.setLengthM);
  const setWidthM = useShelterDesign((s) => s.setWidthM);
  const setHeightM = useShelterDesign((s) => s.setHeightM);
  const presetFieldId = useId();

  const preset = options.presets.find((p) => p.id === presetId);
  const { lengthM: lengthR, widthM: widthR, heightM: heightR } = options.ranges;

  return (
    <Section title="Geometry">
      <FieldRow label="Shelter type" htmlFor={presetFieldId} {...(preset?.description ? { hint: preset.description } : {})}>
        <Select
          id={presetFieldId}
          value={presetId}
          onChange={(e) => setPresetId(e.target.value)}
          options={options.presets.map((p) => ({ value: p.id, label: p.name }))}
        />
      </FieldRow>
      <SliderField label="Length" value={lengthM} onChange={setLengthM} min={lengthR.min} max={lengthR.max} step={lengthR.step ?? 0.5} unit="m" />
      <SliderField label="Width" value={widthM} onChange={setWidthM} min={widthR.min} max={widthR.max} step={widthR.step ?? 0.5} unit="m" />
      <SliderField label="Height" value={heightM} onChange={setHeightM} min={heightR.min} max={heightR.max} step={heightR.step ?? 0.1} unit="m" />
    </Section>
  );
}
