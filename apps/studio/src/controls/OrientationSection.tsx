import type { Options } from '@shelter/studio-server';
import { useShelterDesign } from '../design/store';
import { OrientationDial } from './OrientationDial';
import { Section } from './Section';

export function OrientationSection({ options }: { options: Options }) {
  const azimuthDeg = useShelterDesign((s) => s.design?.azimuthDeg ?? 0);
  const setAzimuthDeg = useShelterDesign((s) => s.setAzimuthDeg);
  const range = options.ranges.azimuthDeg;

  return (
    <Section title="Orientation">
      <OrientationDial value={azimuthDeg} onChange={setAzimuthDeg} min={range.min} max={range.max} step={range.step ?? 1} />
    </Section>
  );
}
