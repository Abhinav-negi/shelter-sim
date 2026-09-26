import { useId } from 'react';
import type { MaterialOption, Options, SurfaceConstruction } from '@shelter/studio-server';
import { FieldRow, Select } from '../components/ui';
import { useShelterDesign } from '../design/store';
import { Section } from './Section';
import { SliderField } from './SliderField';

const KEEP_PRESET = '';

interface SurfaceFieldProps {
  label: string;
  construction: SurfaceConstruction | null;
  materials: MaterialOption[];
  thicknessRange: { min: number; max: number; step?: number };
  onChange: (construction: SurfaceConstruction | null) => void;
}

function SurfaceMaterialField({ label, construction, materials, thicknessRange, onChange }: SurfaceFieldProps) {
  const fieldId = useId();
  const material = materials.find((m) => m.id === construction?.materialId);

  function handleMaterialChange(materialId: string) {
    if (materialId === KEEP_PRESET) {
      onChange(null);
      return;
    }
    const chosen = materials.find((m) => m.id === materialId);
    onChange({
      materialId,
      thicknessM: construction?.thicknessM ?? chosen?.defaultThicknessM ?? thicknessRange.min,
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <FieldRow label={label} htmlFor={fieldId} {...(material?.blurb ? { hint: material.blurb } : {})}>
        <Select
          id={fieldId}
          value={construction?.materialId ?? KEEP_PRESET}
          onChange={(e) => handleMaterialChange(e.target.value)}
          options={[
            { value: KEEP_PRESET, label: 'Preset default' },
            ...materials.map((m) => ({ value: m.id, label: m.name })),
          ]}
        />
      </FieldRow>
      {construction ? (
        <SliderField
          label={`${label} thickness`}
          value={construction.thicknessM}
          onChange={(thicknessM) => onChange({ materialId: construction.materialId, thicknessM })}
          min={thicknessRange.min}
          max={thicknessRange.max}
          step={thicknessRange.step ?? 0.01}
          unit="m"
          decimals={2}
        />
      ) : null}
    </div>
  );
}

export function MaterialsSection({ options }: { options: Options }) {
  const wallConstruction = useShelterDesign((s) => s.design?.wallConstruction ?? null);
  const roofConstruction = useShelterDesign((s) => s.design?.roofConstruction ?? null);
  const floorConstruction = useShelterDesign((s) => s.design?.floorConstruction ?? null);
  const setWallConstruction = useShelterDesign((s) => s.setWallConstruction);
  const setRoofConstruction = useShelterDesign((s) => s.setRoofConstruction);
  const setFloorConstruction = useShelterDesign((s) => s.setFloorConstruction);

  return (
    <Section title="Materials">
      <SurfaceMaterialField
        label="Walls"
        construction={wallConstruction}
        materials={options.materials}
        thicknessRange={options.ranges.thicknessM}
        onChange={setWallConstruction}
      />
      <SurfaceMaterialField
        label="Roof"
        construction={roofConstruction}
        materials={options.materials}
        thicknessRange={options.ranges.thicknessM}
        onChange={setRoofConstruction}
      />
      <SurfaceMaterialField
        label="Floor"
        construction={floorConstruction}
        materials={options.materials}
        thicknessRange={options.ranges.thicknessM}
        onChange={setFloorConstruction}
      />
    </Section>
  );
}
