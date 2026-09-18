'use client';

// apps/web/components/advanced/AdvancedPanel.tsx
//
// T-45 -- collapsed-by-default disclosure panel for every expert/advanced
// simulation control (AUDIT.md F-9 / CONTRACTS.md §7.5). NOT wired into
// `app/app-shell.tsx`'s `slot-advanced-panel` placeholder -- that's outside
// this task's file allow-list (`apps/web/components/advanced/**` only), a
// gap left for a future integration task per the brief.
//
// Uses the native <details>/<summary> disclosure element: free keyboard
// operability (Tab + Enter/Space), and the body is ALSO only rendered while
// open (not merely CSS-hidden), so "collapsed on first paint, no advanced
// field visible" (acceptance test 1) is verifiable straight from the
// rendered markup, not from an assumption about browser default CSS.
//
// All field metadata, defaults, ranges and get/set logic live in
// `./fieldDefs.ts` (plain TS, no React) so they stay testable without a
// DOM -- this repo has no jsdom/@testing-library on the approved dependency
// list (CONTRACTS.md §7.13).

// `React` itself is unused by name under Next's real build (automatic JSX
// runtime), but vitest's plain esbuild transform (no React vite-plugin in
// this repo) falls back to the classic `React.createElement` pragma, which
// needs `React` in scope -- kept for that test path; harmless either way.
import React, { useMemo, useState } from 'react';
import type { SimOptions, SimulationRequest } from '@shelter/engine';
import { actions, useStore } from '../../lib/store';
import {
  ACH_SCHEDULE_LENGTH,
  ALLOW_UNSAFE_VENTILATION_DEFAULT,
  GROUND_ALBEDO_SNOW,
  KEEP_SURFACE_PROFILES_DEFAULT,
  NUMERIC_SIM_OPTION_FIELDS,
  SKY_MODEL_DEFAULT,
  SKY_MODEL_OPTIONS,
  UNSAFE_VENTILATION_WARNING,
  achScheduleField,
  groundAlbedoField,
  groundTempAmplitudeField,
  groundTempMeanAnnualField,
  horizonProfileField,
  setAllowUnsafeVentilation,
  setKeepSurfaceProfiles,
  setSkyModel,
  surfaceOpticalFields,
  thermalBridgeFactorField,
  validateArrayEntry,
  validateRange,
  type ArrayFieldDef,
  type NumericFieldDef,
} from './fieldDefs';

type Mutate = (req: SimulationRequest) => SimulationRequest;

// ============================== generic controls ==============================

function NumberControl({
  field,
  initialValue,
  onCommit,
}: {
  field: NumericFieldDef;
  initialValue: number;
  onCommit: (value: number) => void;
}) {
  const [draft, setDraft] = useState(() => String(initialValue));
  const [error, setError] = useState<string | null>(null);

  function handleChange(raw: string) {
    setDraft(raw);
    const value = Number(raw);
    let err = validateRange(value, field.range, field.label);
    if (!err && field.integer && !Number.isInteger(value)) {
      err = { message: `${field.label} must be a whole number` };
    }
    setError(err?.message ?? null);
    if (!err) onCommit(value); // rejected at the control: never dispatched when invalid
  }

  function reset() {
    setDraft(String(field.defaultValue));
    setError(null);
    onCommit(field.defaultValue);
  }

  const inputId = `advanced-input-${field.key}`;
  const errorId = `advanced-error-${field.key}`;

  return (
    <div className="advanced-field" data-testid={`field-${field.key}`}>
      <label htmlFor={inputId}>
        {field.label}
        {field.unit ? ` (${field.unit})` : ''}
      </label>
      <input
        id={inputId}
        type="number"
        min={field.range.min}
        max={field.range.max}
        step={field.integer ? 1 : 'any'}
        value={draft}
        onChange={(e) => handleChange(e.target.value)}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
      />
      <button type="button" onClick={reset} data-testid={`reset-${field.key}`}>
        Reset to default
      </button>
      <div className="advanced-hint" data-testid={`hint-${field.key}`}>
        default {field.defaultValue}
        {field.unit ? ` ${field.unit}` : ''} · range {field.range.min}–{field.range.max}
      </div>
      <p className="advanced-note">{field.note}</p>
      {error && (
        <div role="alert" id={errorId} className="advanced-error" data-testid={`error-${field.key}`}>
          {error}
        </div>
      )}
    </div>
  );
}

function BoolControl({
  id,
  label,
  checked,
  defaultValue,
  note,
  onCommit,
}: {
  id: string;
  label: string;
  checked: boolean;
  defaultValue: boolean;
  note: string;
  onCommit: (value: boolean) => void;
}) {
  const inputId = `advanced-input-${id}`;
  return (
    <div className="advanced-field" data-testid={`field-${id}`}>
      <label htmlFor={inputId}>
        <input id={inputId} type="checkbox" checked={checked} onChange={(e) => onCommit(e.target.checked)} />
        {label}
      </label>
      <button type="button" onClick={() => onCommit(defaultValue)} data-testid={`reset-${id}`}>
        Reset to default
      </button>
      <div className="advanced-hint" data-testid={`hint-${id}`}>
        default {String(defaultValue)}
      </div>
      <p className="advanced-note">{note}</p>
    </div>
  );
}

function ArrayFieldControl({
  field,
  initialValues,
  onCommit,
}: {
  field: ArrayFieldDef;
  initialValues: number[];
  onCommit: (values: number[]) => void;
}) {
  const [drafts, setDrafts] = useState<string[]>(() => initialValues.map(String));
  const [errors, setErrors] = useState<(string | null)[]>(() => initialValues.map(() => null));

  function handleChange(index: number, raw: string) {
    const nextDrafts = drafts.slice();
    nextDrafts[index] = raw;
    setDrafts(nextDrafts);

    const value = Number(raw);
    const err = validateArrayEntry(value, field.range, field.label, index);
    const nextErrors = errors.slice();
    nextErrors[index] = err?.message ?? null;
    setErrors(nextErrors);
    if (err) return; // rejected at the control: never dispatched when invalid

    const values = nextDrafts.map(Number);
    if (values.some((v) => !Number.isFinite(v))) return; // a sibling cell is still mid-edit
    onCommit(values);
  }

  function resetAll() {
    setDrafts(field.defaultValues.map(String));
    setErrors(field.defaultValues.map(() => null));
    onCommit(field.defaultValues.slice());
  }

  return (
    <fieldset className="advanced-field advanced-array-field" data-testid={`field-${field.key}`}>
      <legend>
        {field.label}
        {field.unit ? ` (${field.unit})` : ''}
      </legend>
      <div className="advanced-hint" data-testid={`hint-${field.key}`}>
        default {field.defaultValues[0]}
        {field.unit ? ` ${field.unit}` : ''} every hour · range {field.range.min}–{field.range.max}
      </div>
      <p className="advanced-note">{field.note}</p>
      <button type="button" onClick={resetAll} data-testid={`reset-${field.key}`}>
        Reset all to default
      </button>
      <div className="advanced-array-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(3.5rem, 1fr))', gap: '0.25rem' }}>
        {drafts.map((d, i) => {
          const cellId = `advanced-input-${field.key}-${i}`;
          return (
            <div key={i} className="advanced-array-cell">
              <label htmlFor={cellId}>{i}</label>
              <input
                id={cellId}
                type="number"
                min={field.range.min}
                max={field.range.max}
                value={d}
                onChange={(e) => handleChange(i, e.target.value)}
                aria-invalid={errors[i] ? true : undefined}
                style={{ width: '100%' }}
              />
            </div>
          );
        })}
      </div>
      {errors.some(Boolean) && (
        <div role="alert" className="advanced-error" data-testid={`error-${field.key}`}>
          {errors.map((e, i) => (e ? <div key={i}>{e}</div> : null))}
        </div>
      )}
    </fieldset>
  );
}

function SkyModelControl({ value, onCommit }: { value: SimOptions['skyModel']; onCommit: (value: SimOptions['skyModel']) => void }) {
  return (
    <div className="advanced-field" data-testid="field-skyModel">
      <label htmlFor="advanced-input-skyModel">Sky model</label>
      <select
        id="advanced-input-skyModel"
        value={value}
        onChange={(e) => onCommit(e.target.value as SimOptions['skyModel'])}
      >
        {SKY_MODEL_OPTIONS.map((opt) => (
          <option key={opt} value={opt}>
            {opt}
          </option>
        ))}
      </select>
      <button type="button" onClick={() => onCommit(SKY_MODEL_DEFAULT)} data-testid="reset-skyModel">
        Reset to default
      </button>
      <div className="advanced-hint" data-testid="hint-skyModel">
        default {SKY_MODEL_DEFAULT} · one of {SKY_MODEL_OPTIONS.join(', ')}
      </div>
      <p className="advanced-note">
        Sky diffuse transposition model: Liu &amp; Jordan isotropic vs Hay-Davies/Klucher/Reindl (CONTRACTS §7.10).
      </p>
    </div>
  );
}

function UnsafeVentilationControl({ value, onCommit }: { value: boolean; onCommit: (value: boolean) => void }) {
  const [confirming, setConfirming] = useState(false);

  function handleToggle(next: boolean) {
    if (next) {
      setConfirming(true); // enabling requires an explicit separate confirmation
    } else {
      onCommit(false);
      setConfirming(false);
    }
  }

  function confirmEnable() {
    onCommit(true);
    setConfirming(false);
  }

  return (
    <div className="advanced-field advanced-field-danger" data-testid="field-allowUnsafeVentilation">
      <label htmlFor="advanced-input-allowUnsafeVentilation">
        <input
          id="advanced-input-allowUnsafeVentilation"
          type="checkbox"
          checked={value}
          onChange={(e) => handleToggle(e.target.checked)}
        />
        Allow unsafe ventilation (disable the ventilation safety floor)
      </label>
      <div className="advanced-hint" data-testid="hint-allowUnsafeVentilation">
        default {String(ALLOW_UNSAFE_VENTILATION_DEFAULT)} · escape hatch only (CONTRACTS §7.5)
      </div>
      <p role="alert" className="advanced-note advanced-warning" data-testid="warning-allowUnsafeVentilation">
        {UNSAFE_VENTILATION_WARNING}
      </p>
      {confirming && (
        <div className="advanced-confirm" data-testid="confirm-allowUnsafeVentilation">
          <p role="alert">{UNSAFE_VENTILATION_WARNING}</p>
          <button type="button" onClick={confirmEnable} data-testid="confirm-allowUnsafeVentilation-yes">
            I understand the carbon monoxide risk — enable anyway
          </button>
          <button type="button" onClick={() => setConfirming(false)} data-testid="confirm-allowUnsafeVentilation-cancel">
            Cancel
          </button>
        </div>
      )}
      {value && (
        <div className="advanced-badge advanced-badge-danger" role="status" data-testid="badge-unsafe-ventilation">
          ⚠ Unsafe ventilation floor disabled
        </div>
      )}
    </div>
  );
}

function GroundAlbedoControl({ req, onCommit }: { req: SimulationRequest; onCommit: (value: number) => void }) {
  // Forces `NumberControl` to re-read from the store only when the snow
  // button is pressed (not on every keystroke, which would fight the local
  // draft) -- see fieldDefs.ts's groundAlbedoField comment.
  const [snowGeneration, setSnowGeneration] = useState(0);
  const raw = req.site.groundAlbedo;
  const isSeries = Array.isArray(raw);
  const scalarValue = isSeries ? (raw[0] ?? groundAlbedoField.defaultValue) : raw;

  return (
    <div>
      <NumberControl key={`albedo-${snowGeneration}`} field={groundAlbedoField} initialValue={scalarValue} onCommit={onCommit} />
      {isSeries && (
        <p className="advanced-note">
          A custom per-timestep albedo series is currently set ({raw.length} values); editing here replaces it with a constant.
        </p>
      )}
      <button
        type="button"
        data-testid="apply-snow-albedo"
        onClick={() => {
          onCommit(GROUND_ALBEDO_SNOW);
          setSnowGeneration((g) => g + 1);
        }}
      >
        Apply snow-cover albedo ({GROUND_ALBEDO_SNOW})
      </button>
    </div>
  );
}

// ============================== the panel ==============================

export interface AdvancedPanelProps {
  /** Test-only seam: lets `apps/web/test/*.test.ts` inspect the rendered
   * field list (acceptance tests 2-7, 9, 11) without a DOM/click simulator
   * (no jsdom or @testing-library on the approved dependency list,
   * CONTRACTS.md §7.13). Real usage never passes this -- the panel is
   * collapsed by default (acceptance test 1) either way. */
  initialOpen?: boolean;
}

export function AdvancedPanel({ initialOpen = false }: AdvancedPanelProps = {}) {
  const { request } = useStore();
  const [open, setOpen] = useState(initialOpen);
  // Captured once at mount: per-surface fields have no single CONTRACTS-
  // stated default (fieldDefs.ts), so "reset to default" restores THIS
  // design's starting values, not whatever has since been typed.
  const [initialRequest] = useState<SimulationRequest>(request);
  const surfaceFields = useMemo(() => surfaceOpticalFields(initialRequest), [initialRequest]);

  function commit(mutate: Mutate): void {
    actions.setRequest(mutate);
  }

  const achField = achScheduleField(request.options.allowUnsafeVentilation);

  return (
    <details
      className="advanced-panel"
      data-testid="advanced-panel"
      open={open}
      onToggle={(e) => setOpen((e.target as HTMLDetailsElement).open)}
      style={{ maxWidth: '100%', boxSizing: 'border-box', overflowX: 'hidden' }}
    >
      <summary data-testid="advanced-panel-toggle">Advanced options (expert)</summary>

      {open && (
        <div
          className="advanced-panel-body"
          data-testid="advanced-panel-body"
          style={{ maxHeight: '70vh', overflowY: 'auto', overflowX: 'hidden', maxWidth: '100%', boxSizing: 'border-box' }}
        >
          <section aria-label="Simulation options">
            <h3>Simulation options</h3>
            {NUMERIC_SIM_OPTION_FIELDS.map((field) => (
              <NumberControl
                key={field.key}
                field={field}
                initialValue={field.get(request)}
                onCommit={(value) => commit((r) => field.set(r, value))}
              />
            ))}
            <SkyModelControl value={request.options.skyModel} onCommit={(value) => commit((r) => setSkyModel(r, value))} />
            <BoolControl
              id="keepSurfaceProfiles"
              label="Keep surface profiles"
              checked={request.options.keepSurfaceProfiles}
              defaultValue={KEEP_SURFACE_PROFILES_DEFAULT}
              note="Retain the full through-wall temperature profile array per timestep (CONTRACTS §7.5). Heavy: only needed for surface-profile debug views."
              onCommit={(value) => commit((r) => setKeepSurfaceProfiles(r, value))}
            />
            <UnsafeVentilationControl
              value={request.options.allowUnsafeVentilation}
              onCommit={(value) => commit((r) => setAllowUnsafeVentilation(r, value))}
            />
          </section>

          <section aria-label="Building and envelope">
            <h3>Building &amp; envelope</h3>
            <NumberControl
              field={thermalBridgeFactorField}
              initialValue={thermalBridgeFactorField.get(request)}
              onCommit={(value) => commit((r) => thermalBridgeFactorField.set(r, value))}
            />
          </section>

          <section aria-label="Site and ground">
            <h3>Site &amp; ground</h3>
            <GroundAlbedoControl req={request} onCommit={(value) => commit((r) => groundAlbedoField.set(r, value))} />
            <NumberControl
              field={groundTempMeanAnnualField}
              initialValue={groundTempMeanAnnualField.get(request)}
              onCommit={(value) => commit((r) => groundTempMeanAnnualField.set(r, value))}
            />
            <NumberControl
              field={groundTempAmplitudeField}
              initialValue={groundTempAmplitudeField.get(request)}
              onCommit={(value) => commit((r) => groundTempAmplitudeField.set(r, value))}
            />
            <ArrayFieldControl
              field={horizonProfileField}
              initialValues={horizonProfileField.get(request)}
              onCommit={(values) => commit((r) => horizonProfileField.set(r, values))}
            />
          </section>

          <section aria-label="Surface optical properties">
            <h3>Surface optical properties</h3>
            {surfaceFields.map((field) => (
              <NumberControl
                key={field.key}
                field={field}
                initialValue={field.get(request)}
                onCommit={(value) => commit((r) => field.set(r, value))}
              />
            ))}
          </section>

          <section aria-label="Ventilation schedule">
            <h3>Ventilation schedule ({ACH_SCHEDULE_LENGTH}h)</h3>
            <ArrayFieldControl
              field={achField}
              initialValues={achField.get(request)}
              onCommit={(values) => commit((r) => achField.set(r, values))}
            />
          </section>
        </div>
      )}
    </details>
  );
}
