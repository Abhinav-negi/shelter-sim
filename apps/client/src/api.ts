/**
 * Typed fetch wrapper for `apps/server`'s REST API. Mirrors apps/server/API.md exactly —
 * that file is the contract; if it changes, this file changes to match, nothing else.
 *
 * Only `import type` from '@shelter/engine' is allowed here (SimulationKpis, below) — never a
 * runtime import. The engine is not browser-safe and must never end up in the client bundle.
 */
import type { SimulationKpis } from '@shelter/engine';

// ---------- §2 GET /api/options ----------

export interface LocationOption {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  elevation: number; // m
}

export interface PresetOption {
  id: string;
  name: string;
  description: string;
  locationId: string;
}

export interface MaterialOption {
  id: string;
  name: string;
  category: 'structural' | 'insulation' | 'finish' | 'storage';
  conductivity: number; // W/(m*K)
  blurb?: string;
}

export interface GlazingOption {
  id: string;
  name: string;
  U: number; // W/(m^2*K)
  SHGC: number;
  blurb?: string;
}

export interface OccupancyPresetOption {
  id: string;
  name: string;
  blurb: string;
}

export interface Options {
  locations: LocationOption[];
  presets: PresetOption[];
  materials: MaterialOption[];
  glazings: GlazingOption[];
  occupancyPresets: OccupancyPresetOption[];
  defaults: DesignInput;
}

// ---------- §3 DesignInput ----------

export interface DesignInput {
  locationId: string;
  date: string; // ISO 'YYYY-MM-DD'
  presetId: string;
  lengthM: number;
  widthM: number;
  heightM: number;
  wallMaterialId: string | null;
  roofMaterialId: string | null;
  floorMaterialId: string | null;
  windowWwr: { S: number; E: number; W: number; N: number };
  glazingId: string;
  nightShutters: boolean;
  occupancyPresetId: string;
}

// ---------- §4 POST /api/simulate ----------

export interface ResultJson {
  meta: {
    nodeCount: number;
    timesteps: number;
    wallClockMs: number;
    spinUpDaysUsed: number;
    energyBalanceResidual: number;
    annualisationMethod: string;
    warnings: string[];
  };
  time: number[];
  temperatures: {
    indoorAir: number[];
    ambient: number[];
    sky: number[];
    meanRadiant: number[];
    ground: number[];
    surfaces: Record<string, { exterior: number[]; interior: number[] }>;
  };
  solar: {
    incidentBySurface: Record<string, number[]>;
    absorbedOpaque: number[];
    transmittedGlazed: number[];
    dailyTotalKWh: { opaque: number; glazed: number; bySurface: Record<string, number> };
  };
  heatFlows: HeatFlowsJson;
  kpis: SimulationKpis;
}

export interface HeatFlowsJson {
  Q1_solarOpaque: number[];
  Q2_solarGlazed: number[];
  Q3_extConvection: number[];
  Q4_skyRadiation: number[];
  Q5_envelopeConduction: number[];
  Q6_intConvection: number[];
  Q7_interiorLongwave: number[];
  Q8_windowConduction: number[];
  Q9_infiltration: number[];
  Q10_ground: number[];
  Q11_internalGains: number[];
  Qaux: number[];
  storageRate: number[];
  deltaT: number[];
  dailyTotalsKWh: Record<string, number>;
}

export interface SimulateResponse {
  input: DesignInput;
  kpis: SimulationKpis;
  result: ResultJson;
}

// ---------- §5 Errors ----------

export type ApiErrorCode =
  | 'VALIDATION_ERROR'
  | 'INVALID_INPUT'
  | 'GEOMETRY_INCONSISTENT'
  | 'WEATHER_INVALID'
  | 'UNKNOWN_MATERIAL'
  | 'UNKNOWN_GLAZING'
  | 'DATA_SCHEMA_MISMATCH'
  | 'SOLVER_DIVERGED'
  | 'SINGULAR_MATRIX'
  | 'PAYLOAD_TOO_LARGE'
  | 'INTERNAL_ERROR'
  | 'NETWORK'; // client-side only: server unreachable

export interface ApiErrorBody {
  code: ApiErrorCode;
  message: string;
  field?: string;
}

/** Thrown by every function below on failure. `error.apiError` carries the typed body. */
export class ApiError extends Error {
  apiError: ApiErrorBody;
  constructor(apiError: ApiErrorBody) {
    super(apiError.message);
    this.name = 'ApiError';
    this.apiError = apiError;
  }
}

export interface HealthResponse {
  ok: true;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`/api${path}`, {
      headers: init?.body ? { 'Content-Type': 'application/json' } : undefined,
      ...init,
    });
  } catch {
    throw new ApiError({ code: 'NETWORK', message: 'Could not reach the server.' });
  }

  let body: unknown;
  try {
    body = await res.json();
  } catch {
    throw new ApiError({ code: 'NETWORK', message: 'Server returned an invalid response.' });
  }

  if (!res.ok) {
    const err = body as Partial<ApiErrorBody>;
    throw new ApiError({
      code: (err.code as ApiErrorCode) ?? 'INTERNAL_ERROR',
      message: err.message ?? `Request failed with status ${res.status}`,
      field: err.field,
    });
  }

  return body as T;
}

export function getHealth(): Promise<HealthResponse> {
  return request<HealthResponse>('/health');
}

export function getOptions(): Promise<Options> {
  return request<Options>('/options');
}

export function simulate(input: DesignInput): Promise<SimulateResponse> {
  return request<SimulateResponse>('/simulate', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}
