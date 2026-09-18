// apps/web/components/grid/rows.ts
//
// T-50, the survival grid. Pure, framework-free row-derivation logic, kept
// separate from `SurvivalGrid.tsx` so it is unit-testable without a DOM or a
// component-rendering library (none is on the approved dependency list,
// CONTRACTS.md §7.13 -- apps/web may only add next/react/react-dom/
// @prisma/client/prisma/d3-*, nothing test-rendering related).

import type { Kelvin, SimulationKpis, SimulationResult } from '@shelter/engine';
import type { ScenarioResult } from '../../lib/store';
import { bandFor, type Band } from './band';
import { scenarioMetaFor, SCENARIO_COUNT } from './scenario-meta';

export interface OkRow {
  status: 'ok';
  scenarioId: string;
  name: string;
  description: string;
  date: string;
  band: Band;
  tempAt0600: Kelvin;
  minIndoorTemp: Kelvin;
  hoursBelow5C: number;
  hoursInComfort: number;
  auxEnergyKWhPerDay: number;
  energyBalanceResidual: number;
}

export interface ErrorRow {
  status: 'error';
  scenarioId: string;
  name: string;
  code: string;
  message: string;
}

export type GridRow = OkRow | ErrorRow;

function isFiniteNumber(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v);
}

/** Runtime shape guard. `ScenarioResult`'s TS type promises `kpis`/`meta`
 * always exist, but a TS type is not a runtime guarantee -- a future
 * producer (T-39's SSE stream, T-60's real contract) that represents a
 * per-scenario compute failure has nowhere else to put that in today's
 * `store.ts` type (see this task's Evidence block), so it can only arrive
 * as a malformed/partial entry. Rendering it as an error row instead of
 * crashing or silently dropping it is acceptance test 9's own requirement. */
function isWellFormed(entry: unknown): entry is ScenarioResult {
  if (!entry || typeof entry !== 'object') return false;
  const e = entry as Record<string, unknown>;
  if (typeof e.scenarioId !== 'string') return false;
  const kpis = e.kpis as Partial<SimulationKpis> | undefined;
  const meta = e.meta as Partial<SimulationResult['meta']> | undefined;
  if (!kpis || !meta) return false;
  return (
    isFiniteNumber(kpis.tempAt0600) &&
    isFiniteNumber(kpis.minIndoorTemp) &&
    isFiniteNumber(kpis.hoursBelow5C) &&
    isFiniteNumber(kpis.hoursInComfort) &&
    isFiniteNumber(kpis.auxEnergyKWhPerDay) &&
    isFiniteNumber(meta.energyBalanceResidual)
  );
}

/** Best-effort extraction of an error code/message from a malformed entry,
 * without assuming any particular shape -- nothing on disk defines one yet. */
function extractError(entry: unknown): { code: string; message: string } {
  const e = (entry ?? {}) as Record<string, unknown>;
  const nested = (e.error ?? {}) as Record<string, unknown>;
  const code = typeof nested.code === 'string' ? nested.code : typeof e.code === 'string' ? e.code : 'UNKNOWN_ERROR';
  const message =
    typeof nested.message === 'string'
      ? nested.message
      : typeof e.message === 'string'
        ? (e.message as string)
        : 'This scenario failed to compute.';
  return { code, message };
}

export function buildRow(entry: ScenarioResult): GridRow {
  const scenarioId = typeof (entry as { scenarioId?: unknown }).scenarioId === 'string' ? (entry as { scenarioId: string }).scenarioId : 'unknown';
  const meta = scenarioMetaFor(scenarioId);

  if (!isWellFormed(entry)) {
    const { code, message } = extractError(entry);
    return { status: 'error', scenarioId, name: meta.name, code, message };
  }

  return {
    status: 'ok',
    scenarioId: entry.scenarioId,
    name: meta.name,
    description: meta.description,
    date: meta.date,
    band: bandFor(entry.kpis.tempAt0600),
    tempAt0600: entry.kpis.tempAt0600,
    minIndoorTemp: entry.kpis.minIndoorTemp,
    hoursBelow5C: entry.kpis.hoursBelow5C,
    hoursInComfort: entry.kpis.hoursInComfort,
    auxEnergyKWhPerDay: entry.kpis.auxEnergyKWhPerDay,
    energyBalanceResidual: entry.meta.energyBalanceResidual,
  };
}

export function buildRows(scenarios: ScenarioResult[] | null): GridRow[] {
  return (scenarios ?? []).map(buildRow);
}

/** Acceptance test 5: "N of 18 scenarios computed" while the run streams in. */
export function progressText(rowCount: number, total = SCENARIO_COUNT): string {
  return `${rowCount} of ${total} scenarios computed`;
}

/** Acceptance test 8. */
export const EMPTY_STATE_TEXT = 'No scenario run yet — run the eighteen-scenario matrix to populate the survival grid.';

const OFFLINE_ID = 'current-design';

/** Acceptance test 7. Builds the ONE row available offline, from the
 * store's already-locally-computed `result` (see `lib/store.ts`'s
 * `dispatchSimulation`, which calls `simulate()` synchronously in-browser --
 * this is the one thing that never needs the server). Returns `null` when
 * even that is not available yet, so the caller can fall back to the empty
 * state instead of fabricating a row. */
export function buildOfflineRow(result: SimulationResult | null, presetId: string): OkRow | null {
  if (!result) return null;
  return {
    status: 'ok',
    scenarioId: OFFLINE_ID,
    name: `Current design${presetId ? ` (${presetId})` : ''}`,
    description: 'The design currently loaded, computed locally in your browser.',
    date: 'now (locally computed)',
    band: bandFor(result.kpis.tempAt0600),
    tempAt0600: result.kpis.tempAt0600,
    minIndoorTemp: result.kpis.minIndoorTemp,
    hoursBelow5C: result.kpis.hoursBelow5C,
    hoursInComfort: result.kpis.hoursInComfort,
    auxEnergyKWhPerDay: result.kpis.auxEnergyKWhPerDay,
    energyBalanceResidual: result.meta.energyBalanceResidual,
  };
}

/** Acceptance test 7's exact note text. */
export function offlineNote(remaining = SCENARIO_COUNT - 1): string {
  return `Offline — showing only the currently loaded design, computed locally in your browser. The other ${remaining} scenarios in the eighteen-scenario matrix need the server and cannot be computed here.`;
}

export interface GridViewState {
  rows: GridRow[];
  note: string | null;
  showEmptyState: boolean;
  emptyText: string;
  showProgress: boolean;
}

/** The single decision function `SurvivalGrid.tsx` renders from -- pulled
 * out so every branch (online/offline, null/empty/partial/full scenarios,
 * offline result present/absent) is unit-testable without a component-
 * rendering library (none is on the approved dependency list). */
export function deriveGridState(params: {
  online: boolean;
  scenarios: ScenarioResult[] | null;
  offlineResult: SimulationResult | null;
  presetId: string;
}): GridViewState {
  const { online, scenarios, offlineResult, presetId } = params;

  if (!online) {
    const offlineRow = buildOfflineRow(offlineResult, presetId);
    const rows: GridRow[] = offlineRow ? [offlineRow] : [];
    const note = offlineNote();
    return { rows, note, showEmptyState: rows.length === 0, emptyText: note, showProgress: false };
  }

  if (scenarios === null) {
    return { rows: [], note: null, showEmptyState: true, emptyText: EMPTY_STATE_TEXT, showProgress: false };
  }

  const rows = buildRows(scenarios);
  return {
    rows,
    note: null,
    showEmptyState: false,
    emptyText: EMPTY_STATE_TEXT,
    showProgress: rows.length < SCENARIO_COUNT,
  };
}
