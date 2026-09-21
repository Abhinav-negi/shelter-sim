// apps/web/lib/store.ts
//
// THE KEYSTONE FILE. LOG.md T-36: this declares the COMPLETE app state shape
// once, so every later Area F task touches only its own component directory
// and never edits this file to add a field.
//
// No state-management dependency is used -- none is on the approved list
// (CONTRACTS.md §7.13) and none is needed: React's own `useSyncExternalStore`
// is the native mechanism for an external store, so this is a small hand-
// rolled pub/sub object, not a library.
//
// The store also owns the ONE place `request` mutations turn into a
// simulation run, debounced 150 ms (TECH.md §11.6) so a slider drag dispatches
// once, not per pixel.
//
// This module has no 'use client' directive of its own -- it holds no JSX,
// just plain state/actions, so it compiles cleanly into WHICHEVER bundle
// imports it: the server bundle (`app/page.tsx`, for `DEFAULT_LOCATION`) and
// the client bundle (`app/app-shell.tsx`, for `useStore`/`actions`) each get
// their own copy, which is normal for a shared utility module.
//
// GOTCHA for whoever builds the next piece on top of this (read before you
// add an import here): this module is reachable from the BROWSER bundle via
// `app/app-shell.tsx`, so everything it imports ships to the browser.
// `@shelter/data`'s TMY loader (`packages/data/src/tmy.ts`) reads bundled
// JSON off disk via `node:fs` + `new URL('../tmy/', import.meta.url)`, which
// is a perfectly normal Node pattern but is NOT browser-bundle-safe: Next's
// bundler (Turbopack) statically intercepts `new URL(literal, import.meta.url)`
// for asset resolution and fails the build the moment ANYTHING reachable
// from the client boundary imports `@shelter/data`, even if the call is
// never reached at runtime -- the import alone is enough. That is why this
// file never imports `@shelter/data`: the initial preset is resolved
// server-side, in `app/page.tsx` (a Server Component, never bundled for the
// browser), and handed to `AppShell` (`app/app-shell.tsx`) as plain
// serializable props via `hydrateStore()`. The browser Web Worker (T-43)
// will hit this exact wall the moment it tries to resolve a *different*
// preset client-side and will need its own browser-safe path to TMY data
// (fetch from an API route is the obvious one, since `@shelter/data` cannot
// be fixed from here -- `packages/**` is off this task's allow-list).
// Documented in this task's Evidence block too.

import { useSyncExternalStore } from 'react';
import {
  EngineError,
  simulate,
  type EngineErrorCode,
  type SimulationKpis,
  type SimulationRequest,
  type SimulationResult,
  type SweepResult,
} from '@shelter/engine';
import { setLocale as setI18nLocale, type Locale } from './i18n';

// ============================== LOCAL TYPES ==============================
// CONTRACTS.md §7: "A task that needs a type which is not here defines it
// locally in its own module file." `ScenarioResult` (the per-scenario output
// of the eighteen-scenario matrix) is not yet defined anywhere shared --
// Area H's T-60 owns shaping that contract. Declared locally here so the
// store's field can be typed today without editing packages/**.
export interface ScenarioResult {
  scenarioId: string;
  kpis: SimulationKpis;
  meta: SimulationResult['meta'];
}

export type TabId = 'temp' | 'solar' | 'heatflow' | 'grid';
export type RunStatus = 'idle' | 'running' | 'error';
export interface AppError {
  code: EngineErrorCode | 'INTERNAL';
  message: string;
}

export interface AppState {
  request: SimulationRequest;
  result: SimulationResult | null;
  sweep: SweepResult | null;
  scenarios: ScenarioResult[] | null;
  recommendation: unknown | null;
  status: RunStatus;
  error: AppError | null;
  selectedSurfaceId: string | null;
  scrubberHour: number;
  activeTab: TabId;
  locale: Locale;
  advancedOpen: boolean;
  presetId: string;
  online: boolean;
  shareId: string | null;
}

/** `NEXT_PUBLIC_DEFAULT_LOCATION`, CONTRACTS.md §7.16 -- default `'leh'`.
 * `NEXT_PUBLIC_*` vars are inlined at build time; `app/page.tsx` (server-side)
 * imports this same constant so the default location is declared once. */
export const DEFAULT_LOCATION = process.env.NEXT_PUBLIC_DEFAULT_LOCATION ?? 'leh';

function toAppError(err: unknown): AppError {
  if (err instanceof EngineError) return { code: err.code, message: err.message };
  return { code: 'INTERNAL', message: err instanceof Error ? err.message : String(err) };
}

// ============================== THE STORE ==============================

type Listener = () => void;

// `request` is seeded synchronously by `hydrateStore()` (called from
// `app/app-shell.tsx`'s lazy `useState` initializer, before any render reads
// the store) with the preset-resolved request `page.tsx` computed
// server-side. The cast below is a documented placeholder that is never
// actually read: `getState()` throws if the store is somehow read before
// `hydrateStore()` runs, instead of silently handing out a fake request
// (CONTRACTS.md's "a plausible-looking wrong number is worse than a crash",
// §7.8 -- the same principle applies here).
let state: AppState = {
  request: null as unknown as SimulationRequest,
  result: null,
  sweep: null,
  scenarios: null,
  recommendation: null,
  status: 'idle',
  error: null,
  selectedSurfaceId: null,
  scrubberHour: 6, // CONTRACTS.md §7.7: 06:00 is THE number for Ladakh
  activeTab: 'temp',
  locale: (process.env.NEXT_PUBLIC_DEFAULT_LOCALE as Locale | undefined) ?? 'en',
  advancedOpen: false,
  presetId: '',
  online: true,
  shareId: null,
};

let hydrated = false;

export interface HydrateSeed {
  request: SimulationRequest;
  result: SimulationResult;
  presetId: string;
}

/** Seeds the store from server-resolved data. Idempotent -- safe to call on
 * every `AppShell` render, only takes effect once. */
export function hydrateStore(seed: HydrateSeed): void {
  if (hydrated) return;
  hydrated = true;
  state = { ...state, request: seed.request, result: seed.result, presetId: seed.presetId };
}

const listeners = new Set<Listener>();

function getState(): AppState {
  if (!hydrated) {
    throw new Error(
      'store read before hydrate() ran -- AppShell must hydrate before any component reads the store',
    );
  }
  return state;
}

function setState(patch: Partial<AppState>): void {
  state = { ...state, ...patch };
  for (const listener of listeners) listener();
}

function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** React binding. `useSyncExternalStore` is the native external-store hook --
 * no state-management library needed for this. */
export function useStore(): AppState {
  return useSyncExternalStore(subscribe, getState, getState);
}

// ============================== REQUEST DEBOUNCE + DISPATCH ==============================

/** TECH.md §11.6: the interaction that makes the tool feel alive rather than
 * submit-and-wait. LOG.md rule 14 -- named calibration constant. */
const REQUEST_DEBOUNCE_MS = 150;

let debounceTimer: ReturnType<typeof setTimeout> | undefined;

/** Exposed ONLY so T-36 acceptance test 4 ("mutating request 20 times within
 * 100 ms dispatches exactly one simulation") can be measured without a
 * mocking framework. Not part of the app's real UI surface. */
let dispatchCount = 0;
export function __debugDispatchCount(): number {
  return dispatchCount;
}

function dispatchSimulation(): void {
  dispatchCount++;
  setState({ status: 'running' });
  try {
    const result = simulate(getState().request);
    setState({ result, status: 'idle', error: null });
  } catch (err) {
    setState({ status: 'error', error: toAppError(err) });
  }
}

// ============================== ACTIONS ==============================
// "an action to set each" field, per this task's prompt.

function setRequest(mutate: (req: SimulationRequest) => SimulationRequest): void {
  setState({ request: mutate(getState().request) });
  if (debounceTimer !== undefined) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    debounceTimer = undefined;
    dispatchSimulation();
  }, REQUEST_DEBOUNCE_MS);
}

function setResult(result: SimulationResult | null): void {
  setState({ result });
}

function setSweep(sweep: SweepResult | null): void {
  setState({ sweep });
}

function setScenarios(scenarios: ScenarioResult[] | null): void {
  setState({ scenarios });
}

function setRecommendation(recommendation: unknown | null): void {
  setState({ recommendation });
}

function setStatus(status: RunStatus): void {
  setState({ status });
}

function setError(error: AppError | null): void {
  setState({ error });
}

function setSelectedSurfaceId(selectedSurfaceId: string | null): void {
  setState({ selectedSurfaceId });
}

function setScrubberHour(scrubberHour: number): void {
  setState({ scrubberHour });
}

function setActiveTab(activeTab: TabId): void {
  setState({ activeTab });
}

function setLocale(locale: Locale): void {
  setI18nLocale(locale);
  setState({ locale });
}

function setAdvancedOpen(advancedOpen: boolean): void {
  setState({ advancedOpen });
}

/** Plain field setter, like every other action here. Resolving a NEW
 * preset's data (weather/materials/glazings) requires `@shelter/data`, which
 * this file cannot import (see the file-header gotcha) -- the caller (a
 * future Area F preset picker) resolves the data through whatever
 * browser-safe path it has and calls `setRequest`/`setResult` itself. */
function setPresetId(presetId: string): void {
  setState({ presetId });
}

function setOnline(online: boolean): void {
  setState({ online });
}

function setShareId(shareId: string | null): void {
  setState({ shareId });
}

export const actions = {
  setRequest,
  setResult,
  setSweep,
  setScenarios,
  setRecommendation,
  setStatus,
  setError,
  setSelectedSurfaceId,
  setScrubberHour,
  setActiveTab,
  setLocale,
  setAdvancedOpen,
  setPresetId,
  setOnline,
  setShareId,
};

// Non-React accessor for code that runs outside a component (e.g. a future
// worker bridge, T-43) without subscribing.
export { getState as getStoreState };
