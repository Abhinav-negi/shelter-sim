import type { Options, WeatherProvenanceSummary } from '@shelter/studio-server';
import { AdvancedSection } from './AdvancedSection';
import { EnvironmentSection } from './EnvironmentSection';
import { GeometrySection } from './GeometrySection';
import { MaterialsSection } from './MaterialsSection';
import { OpeningsSection } from './OpeningsSection';
import { OrientationSection } from './OrientationSection';

export interface ControlsPanelProps {
  options: Options;
  weatherProvenance: WeatherProvenanceSummary | undefined;
}

/** Environment · Geometry · Materials · Openings · Orientation · Advanced (F3.md
 * condition 1). Each section reads/writes the ShelterDesign store directly via
 * selectors, so an edit anywhere only re-renders the section that changed. */
export function ControlsPanel({ options, weatherProvenance }: ControlsPanelProps) {
  return (
    <div className="flex flex-col px-4">
      <EnvironmentSection options={options} weatherProvenance={weatherProvenance} />
      <GeometrySection options={options} />
      <MaterialsSection options={options} />
      <OpeningsSection options={options} />
      <OrientationSection options={options} />
      <AdvancedSection options={options} />
    </div>
  );
}
