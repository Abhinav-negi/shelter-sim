import { useId } from 'react';
import type { Options, Shape, Storeys } from '@shelter/studio-server';
import { FieldRow, Segmented, Select } from '../components/ui';
import { useShelterDesign } from '../design/store';
import { Section } from './Section';
import { SliderField } from './SliderField';

const SHAPE_OPTIONS: Array<{ value: Shape; label: string }> = [
  { value: 'box', label: 'Box' },
  { value: 'cylinder', label: 'Cylinder' },
  { value: 'dome', label: 'Dome' },
];

const STOREYS_OPTIONS: Array<{ value: '1' | '2'; label: string }> = [
  { value: '1', label: '1' },
  { value: '2', label: '2' },
];

export function GeometrySection({ options }: { options: Options }) {
  const presetId = useShelterDesign((s) => s.design?.presetId ?? '');
  const shape = useShelterDesign((s) => s.design?.shape ?? 'box');
  const storeys = useShelterDesign((s) => s.design?.storeys ?? 1);
  const lengthM = useShelterDesign((s) => s.design?.lengthM ?? 0);
  const widthM = useShelterDesign((s) => s.design?.widthM ?? 0);
  const heightM = useShelterDesign((s) => s.design?.heightM ?? 0);
  const setPresetId = useShelterDesign((s) => s.setPresetId);
  const setShape = useShelterDesign((s) => s.setShape);
  const setStoreys = useShelterDesign((s) => s.setStoreys);
  const setLengthM = useShelterDesign((s) => s.setLengthM);
  const setWidthM = useShelterDesign((s) => s.setWidthM);
  const setHeightM = useShelterDesign((s) => s.setHeightM);
  const presetFieldId = useId();

  const preset = options.presets.find((p) => p.id === presetId);
  const { lengthM: lengthR, widthM: widthR, heightM: heightR } = options.ranges;
  // Cylinder/dome: lengthM is the DIAMETER and widthM is ignored (API.md §3
  // "lengthM ... DIAMETER for 'cylinder'/'dome' (widthM ignored then)").
  const isRing = shape === 'cylinder' || shape === 'dome';
  const isDome = shape === 'dome';

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

      <FieldRow label="Shape">
        <Segmented aria-label="Shape" value={shape} onChange={setShape} options={SHAPE_OPTIONS} />
      </FieldRow>

      <FieldRow
        label="Storeys"
        hint={isDome ? 'A dome is simulated as one storey only.' : 'Two storeys are simulated as one connected air volume.'}
      >
        <Segmented
          aria-label="Storeys"
          value={String(storeys) as '1' | '2'}
          onChange={(value) => setStoreys(Number(value) as Storeys)}
          options={STOREYS_OPTIONS}
          disabled={isDome}
        />
      </FieldRow>

      <SliderField
        label={isRing ? 'Diameter' : 'Length'}
        value={lengthM}
        onChange={setLengthM}
        min={lengthR.min}
        max={lengthR.max}
        step={lengthR.step ?? 0.5}
        unit="m"
      />
      {!isRing && (
        <SliderField label="Width" value={widthM} onChange={setWidthM} min={widthR.min} max={widthR.max} step={widthR.step ?? 0.5} unit="m" />
      )}
      {!isDome && (
        <SliderField label="Height" value={heightM} onChange={setHeightM} min={heightR.min} max={heightR.max} step={heightR.step ?? 0.1} unit="m" />
      )}
    </Section>
  );
}
