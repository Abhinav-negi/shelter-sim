'use client';

// apps/web/components/inputs/SimpleForm.tsx
//
// T-44: the five-control simple form (in practice, ten controls -- see the
// count comment below). LOG.md `CHALLENGE.md` C-13: someone who cannot
// define thermal conductivity must be able to compare two wall materials for
// a Leh shelter, unaided, in under five minutes. Every field here inherits a
// sane default from the catalogue or the Ladakh defaults (CONTRACTS.md
// §7.11); nothing requires a number the user has to look up.
//
// Explicitly NOT here (T-45's Advanced panel owns all of these):
// `SimOptions` fields, `thermalBridgeFactor`, emissivity, absorptivity, a raw
// ACH number, node counts, solver settings, ground albedo, sky model.
//
// This component is not wired into `app/app-shell.tsx`'s `slot-simple-form`
// placeholder -- that file is off this task's allow-list
// (`apps/web/components/inputs/** only`), and no task in the ledger yet owns
// swapping Area F's placeholders for the real components (the same gap
// T-43/T-45/T-46/T-50 each hit and documented; see this task's Evidence
// block). It is built and tested standalone, exactly like those four.

import React, { useRef, useState } from 'react';
import type { Material, SimulationRequest, WeatherSeries } from '@shelter/engine';
import { actions, useStore } from '../../lib/store';
import { t, type Locale } from '../../lib/i18n';
import './messages';
import {
  GLAZINGS,
  OCCUPANCY_PRESETS,
  PRESET_SUMMARIES,
  TMY_LOCATIONS,
} from './catalog';
import { useMaterialsCatalogue } from './materialsApi';
import {
  ORIENTATIONS,
  applyPresetSummary,
  currentFloorMaterialId,
  currentGlazingId,
  currentRoofMaterialId,
  currentSize,
  currentWallMaterialId,
  currentWwr,
  dayOfYearToIsoDate,
  isoDateToDayOfYear,
  nightShuttersEnabled,
  setFloorMaterial,
  setGlazingType,
  setNightShutters,
  setOccupancyPreset,
  setRoofMaterial,
  setSize,
  setWallMaterial,
  setWwr,
  sliceWeatherToDay,
  type Orientation,
} from './requestOps';
import { MaterialStackEditor } from './MaterialStackEditor';
import { CsvUpload } from './CsvUpload';

// ============================== CONTROL COUNT (acceptance test 2) ==============================
// Exactly ten top-level controls are rendered at first paint, each wrapped in
// a `data-testid="control-<name>"` container -- the definition this task's
// own test file counts against. Two of the eleven concepts the task prompt
// names are folded into a sibling control rather than given their own
// top-level slot, both documented here and in the Evidence block:
//   - "night shutters" is a checkbox INSIDE `control-glazing` (a shutter is
//     a glazing-related choice, not an independent one).
//   - "window amount ... per orientation" is ONE control (`control-windows`)
//     containing four small per-orientation sliders, not four controls.
// The material-stack editor and the CSV upload are NOT first-paint controls
// (`data-testid="stack-editor"`/`"csv-upload"`, no `control-` prefix): the
// former only renders once a wall is clicked in the house (T-46 integration,
// acceptance test 7), the latter is a secondary "or upload your own" escape
// hatch under the location control, not a distinct field a first-time user
// must fill in.
export const CONTROL_NAMES = [
  'location',
  'date',
  'size',
  'shelterType',
  'wallMaterial',
  'roofMaterial',
  'floorMaterial',
  'windows',
  'glazing',
  'occupancy',
] as const;

function orientationLabel(o: Orientation, locale: Locale): string {
  return t(`inputs.simpleForm.windows.orientation.${o}`, locale);
}

function MaterialSelect({
  id,
  label,
  title,
  value,
  materials,
  locale,
  onChange,
}: {
  id: string;
  label: string;
  title: string;
  value: string;
  materials: Material[];
  locale: Locale;
  onChange: (materialId: string) => void;
}) {
  const selected = materials.find((m) => m.id === value);
  return (
    <div>
      <label htmlFor={id} title={title}>
        {label}
      </label>
      <select id={id} value={value} onChange={(e) => onChange(e.target.value)}>
        {materials.length === 0 && (
          <option value={value}>{value || t('inputs.simpleForm.materialSelect.loading', locale)}</option>
        )}
        {materials.map((m) => (
          <option key={m.id} value={m.id}>
            {m.name}
          </option>
        ))}
      </select>
      {selected?.blurb && <p style={{ fontSize: 12, color: '#475569', margin: '2px 0' }}>{selected.blurb}</p>}
      {selected?.source && (
        <details>
          <summary style={{ cursor: 'pointer', fontSize: 12 }}>
            {t('inputs.simpleForm.materialSelect.sourceSummary', locale)}
          </summary>
          <p data-testid={`citation-${id}`} style={{ fontSize: 12, color: '#475569' }}>
            {selected.source}
          </p>
        </details>
      )}
    </div>
  );
}

export function SimpleForm() {
  const state = useStore();
  const { request, selectedSurfaceId, locale } = state;
  const materialsState = useMaterialsCatalogue();
  const materials: Material[] = materialsState.status === 'ready' ? materialsState.materials : [];

  // The full, unsliced year is what `app/page.tsx` (T-36) hydrates the store
  // with (`tmyById()`, T-27) -- captured ONCE on mount so the "date" control
  // can always re-slice a fresh day out of it, even after a previous date
  // change has already replaced `request.weather` with a one-day slice. See
  // `requestOps.sliceWeatherToDay`'s header for why the engine needs the
  // chosen day to sit at the START of the array it is given.
  const fullYearWeatherRef = useRef<WeatherSeries>(request.weather);
  const [locationNotice, setLocationNotice] = useState<string | null>(null);

  function update(next: SimulationRequest) {
    actions.setRequest(() => next);
  }

  const size = currentSize(request.building);

  return (
    <form aria-label="Simple design form" style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: '100%' }}>
      {/* Error state (AREA F header rule: every component renders correctly in
       * loading/empty/error/offline). A bad combination of basic-panel values
       * (an extreme thickness, an oversized window) can make the physics
       * genuinely diverge or fail validation -- this says so plainly instead
       * of leaving the rest of the app silently stuck on stale numbers. */}
      {state.status === 'error' && state.error && (
        <p role="alert" data-testid="simple-form-error" style={{ fontSize: 13, color: '#991b1b', margin: 0 }}>
          {t('inputs.simpleForm.error', locale).replace('{message}', state.error.message)}
        </p>
      )}
      {/* 1. LOCATION */}
      <div data-testid="control-location">
        <label htmlFor="input-location" title={t('inputs.simpleForm.location.title', locale)}>
          {t('inputs.simpleForm.location.label', locale)}
        </label>
        <select
          id="input-location"
          value={request.site.id}
          onChange={(e) => {
            const loc = TMY_LOCATIONS.find((l) => l.id === e.target.value);
            if (!loc || loc.id === request.site.id) {
              setLocationNotice(null);
              return;
            }
            setLocationNotice(
              t('inputs.simpleForm.location.notice', locale)
                .replace('{location}', loc.name)
                .replace('{site}', request.site.name),
            );
          }}
        >
          {TMY_LOCATIONS.map((l) => (
            <option key={l.id} value={l.id}>
              {l.name}
            </option>
          ))}
        </select>
        {locationNotice && (
          <p role="status" data-testid="location-notice" style={{ fontSize: 12, color: '#92400e' }}>
            {locationNotice}
          </p>
        )}
        <CsvUpload
          startDayOfYear={request.weather.startDayOfYear}
          site={request.site}
          onWeatherParsed={(series) => {
            fullYearWeatherRef.current = series;
            update({ ...request, weather: series });
          }}
        />
      </div>

      {/* 2. DATE */}
      <div data-testid="control-date">
        <label htmlFor="input-date" title={t('inputs.simpleForm.date.title', locale)}>
          {t('inputs.simpleForm.date.label', locale)}
        </label>
        <input
          id="input-date"
          type="date"
          value={dayOfYearToIsoDate(request.weather.startDayOfYear)}
          onChange={(e) => {
            if (!e.target.value) return;
            const dayOfYear = isoDateToDayOfYear(e.target.value);
            const full = fullYearWeatherRef.current;
            update({ ...request, weather: sliceWeatherToDay(full, dayOfYear, request.options.simulationDays) });
          }}
        />
      </div>

      {/* 3. SIZE */}
      <fieldset data-testid="control-size">
        <legend title={t('inputs.simpleForm.size.title', locale)}>{t('inputs.simpleForm.size.legend', locale)}</legend>
        <label htmlFor="input-length">{t('inputs.simpleForm.size.length', locale)}</label>
        <input
          id="input-length"
          type="number"
          min={2}
          max={30}
          step={0.5}
          value={size.lengthM}
          onChange={(e) => update(setSize(request, { ...size, lengthM: Number(e.target.value) }))}
        />
        <label htmlFor="input-width">{t('inputs.simpleForm.size.width', locale)}</label>
        <input
          id="input-width"
          type="number"
          min={2}
          max={30}
          step={0.5}
          value={size.widthM}
          onChange={(e) => update(setSize(request, { ...size, widthM: Number(e.target.value) }))}
        />
        <label htmlFor="input-height">{t('inputs.simpleForm.size.height', locale)}</label>
        <input
          id="input-height"
          type="number"
          min={2}
          max={6}
          step={0.1}
          value={size.heightM}
          onChange={(e) => update(setSize(request, { ...size, heightM: Number(e.target.value) }))}
        />
      </fieldset>

      {/* 4. SHELTER TYPE / PRESET PICKER */}
      <div
        data-testid="control-shelterType"
        role="radiogroup"
        aria-label={t('inputs.simpleForm.shelterType.label', locale)}
      >
        <p title={t('inputs.simpleForm.shelterType.title', locale)}>
          {t('inputs.simpleForm.shelterType.label', locale)}
        </p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {PRESET_SUMMARIES.map((p) => (
            <button
              key={p.id}
              type="button"
              role="radio"
              aria-checked={state.presetId === p.id}
              data-testid={`preset-card-${p.id}`}
              onClick={() => {
                actions.setPresetId(p.id);
                update(applyPresetSummary(request, p.id, materials));
              }}
              style={{
                textAlign: 'left',
                width: 160,
                border: state.presetId === p.id ? '2px solid #0f172a' : '1px solid #cbd5e1',
                borderRadius: 8,
                padding: 8,
                background: 'white',
              }}
            >
              <div style={{ fontWeight: 600, fontSize: 13 }}>{p.name}</div>
              <div style={{ fontSize: 11, color: '#475569' }}>{p.blurb}</div>
            </button>
          ))}
        </div>
      </div>

      {/* 5-7. WALL / ROOF / FLOOR MATERIAL */}
      <div data-testid="control-wallMaterial">
        <MaterialSelect
          id="input-wall-material"
          label={t('inputs.simpleForm.wallMaterial.label', locale)}
          title={t('inputs.simpleForm.wallMaterial.title', locale)}
          value={currentWallMaterialId(request.building)}
          materials={materials}
          locale={locale}
          onChange={(id) => update(setWallMaterial(request, id, materials))}
        />
      </div>
      <div data-testid="control-roofMaterial">
        <MaterialSelect
          id="input-roof-material"
          label={t('inputs.simpleForm.roofMaterial.label', locale)}
          title={t('inputs.simpleForm.roofMaterial.title', locale)}
          value={currentRoofMaterialId(request.building)}
          materials={materials}
          locale={locale}
          onChange={(id) => update(setRoofMaterial(request, id, materials))}
        />
      </div>
      <div data-testid="control-floorMaterial">
        <MaterialSelect
          id="input-floor-material"
          label={t('inputs.simpleForm.floorMaterial.label', locale)}
          title={t('inputs.simpleForm.floorMaterial.title', locale)}
          value={currentFloorMaterialId(request.building)}
          materials={materials}
          locale={locale}
          onChange={(id) => update(setFloorMaterial(request, id, materials))}
        />
      </div>

      {/* 8. WINDOW AMOUNT (per orientation) */}
      <fieldset data-testid="control-windows">
        <legend title={t('inputs.simpleForm.windows.title', locale)}>
          {t('inputs.simpleForm.windows.legend', locale)}
        </legend>
        {ORIENTATIONS.map((o) => {
          const pct = Math.round(currentWwr(request.building, o) * 100);
          const id = `input-wwr-${o}`;
          return (
            <div key={o}>
              <label htmlFor={id}>
                {orientationLabel(o, locale)}{' '}
                {t('inputs.simpleForm.windows.percentSuffix', locale).replace('{pct}', String(pct))}
              </label>
              <input
                id={id}
                type="range"
                min={0}
                max={90}
                step={5}
                value={pct}
                onChange={(e) => update(setWwr(request, o, Number(e.target.value) / 100))}
              />
            </div>
          );
        })}
      </fieldset>

      {/* 9. GLAZING TYPE (+ night shutters) */}
      <div data-testid="control-glazing">
        <label htmlFor="input-glazing" title={t('inputs.simpleForm.glazing.title', locale)}>
          {t('inputs.simpleForm.glazing.label', locale)}
        </label>
        <select
          id="input-glazing"
          value={currentGlazingId(request.building)}
          onChange={(e) => update(setGlazingType(request, e.target.value))}
        >
          {GLAZINGS.map((g) => (
            <option key={g.id} value={g.id}>
              {g.name}
            </option>
          ))}
        </select>
        <p style={{ fontSize: 12, color: '#475569', margin: '2px 0' }}>
          {GLAZINGS.find((g) => g.id === currentGlazingId(request.building))?.blurb}
        </p>
        <label htmlFor="input-night-shutter">
          <input
            id="input-night-shutter"
            type="checkbox"
            checked={nightShuttersEnabled(request.building)}
            onChange={(e) => update(setNightShutters(request, e.target.checked))}
          />{' '}
          {t('inputs.simpleForm.glazing.nightShutter', locale)}
        </label>
      </div>

      {/* 10. OCCUPANCY / HEATING PRESET */}
      <div data-testid="control-occupancy">
        <label htmlFor="input-occupancy" title={t('inputs.simpleForm.occupancy.title', locale)}>
          {t('inputs.simpleForm.occupancy.label', locale)}
        </label>
        <select
          id="input-occupancy"
          value={inferOccupancyPresetId(request)}
          onChange={(e) => update(setOccupancyPreset(request, e.target.value))}
        >
          {OCCUPANCY_PRESETS.map((o) => (
            <option key={o.id} value={o.id}>
              {o.name}
            </option>
          ))}
        </select>
        <p style={{ fontSize: 12, color: '#475569', margin: '2px 0' }}>
          {OCCUPANCY_PRESETS.find((o) => o.id === inferOccupancyPresetId(request))?.blurb}
        </p>
      </div>

      {/* Material-stack editor: T-46 integration (acceptance test 7). */}
      {selectedSurfaceId && (
        <MaterialStackEditor
          request={request}
          selectedSurfaceId={selectedSurfaceId}
          catalogue={materials}
          onChange={update}
        />
      )}
    </form>
  );
}

/** Best-effort reverse lookup: which occupancy preset the current
 * `operation.internalGainsSchedule` matches, so the dropdown reflects a
 * loaded preset instead of always resetting to the first option. Falls back
 * to the first preset id when nothing matches exactly (e.g. a hand-edited
 * schedule from the Advanced panel, T-45) -- this dropdown always shows
 * SOME valid value, never a blank one (acceptance test 4). */
function inferOccupancyPresetId(request: SimulationRequest): string {
  const gains = request.operation.internalGainsSchedule;
  const match = OCCUPANCY_PRESETS.find((o) => o.internalGainsSchedule.every((v, i) => v === gains[i]));
  return match?.id ?? OCCUPANCY_PRESETS[0]!.id;
}
