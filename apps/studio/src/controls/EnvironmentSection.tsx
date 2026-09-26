import { useId, useState } from 'react';
import type { LocationSearchResult, Options, WeatherProvenanceSummary } from '@shelter/studio-server';
import { FieldRow, Input, Segmented, Select } from '../components/ui';
import { useShelterDesign } from '../design/store';
import { LocationSearch } from './LocationSearch';
import { Section } from './Section';

export function EnvironmentSection({
  options,
  weatherProvenance,
}: {
  options: Options;
  weatherProvenance: WeatherProvenanceSummary | undefined;
}) {
  const location = useShelterDesign((s) => s.design?.location ?? null);
  const date = useShelterDesign((s) => s.design?.date ?? '');
  const setLocation = useShelterDesign((s) => s.setLocation);
  const setDate = useShelterDesign((s) => s.setDate);
  const [mode, setMode] = useState<'preset' | 'custom'>(location?.kind ?? 'preset');
  const dateFieldId = useId();
  const presetFieldId = useId();

  function selectCustom(r: LocationSearchResult) {
    setLocation({ kind: 'custom', name: `${r.name}${r.admin1 ? `, ${r.admin1}` : ''}`, lat: r.lat, lon: r.lon, elevation: r.elevation });
  }

  return (
    <Section title="Environment">
      <FieldRow label="Location">
        <Segmented
          aria-label="Location source"
          value={mode}
          onChange={setMode}
          options={[
            { value: 'preset', label: 'Site' },
            { value: 'custom', label: 'Search' },
          ]}
        />
      </FieldRow>
      {mode === 'preset' ? (
        <FieldRow label="Site" htmlFor={presetFieldId}>
          <Select
            id={presetFieldId}
            value={location?.kind === 'preset' ? location.id : ''}
            onChange={(e) => setLocation({ kind: 'preset', id: e.target.value })}
            options={options.locations.map((l) => ({ value: l.id, label: l.name }))}
          />
        </FieldRow>
      ) : (
        <FieldRow label="Search">
          <LocationSearch onSelect={selectCustom} />
          {location?.kind === 'custom' ? (
            <p className="mt-2 text-xs text-ink-muted">
              Selected: <span className="text-ink">{location.name}</span>{' '}
              <span className="font-mono">
                {location.lat.toFixed(2)}, {location.lon.toFixed(2)}
              </span>
            </p>
          ) : null}
        </FieldRow>
      )}
      <FieldRow label="Date" htmlFor={dateFieldId}>
        <Input id={dateFieldId} type="date" mono value={date} onChange={(e) => setDate(e.target.value)} />
      </FieldRow>
      {weatherProvenance ? (
        <p className="text-xs text-ink-muted">
          Weather: {weatherProvenance.source} ({weatherProvenance.year}). {weatherProvenance.notes.join(' ')}
        </p>
      ) : null}
    </Section>
  );
}
