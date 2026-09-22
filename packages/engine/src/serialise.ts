/**
 * The JSON boundary. LOG.md 7.14/7.15, added by T-06.
 *
 * This is the ONLY place in the repository permitted to convert between
 * Float64Array and number[]. Every API route, worker message and database write
 * goes through the functions here instead of inventing its own conversion.
 */

import type { HeatFlows, SimulationKpis, SimulationRequest, SimulationResult, WeatherSeries } from './types.js';
import { EngineError } from './types.js';

// ============================== Float64Array <-> number[] ==============================

export function seriesToJson(a: Float64Array): number[] {
  return Array.from(a);
}

export function seriesFromJson(a: number[]): Float64Array {
  return Float64Array.from(a);
}

// Bound recursion depth against a maliciously deep JSON tree (e.g. `{"a":{"a":{...}}}`
// thousands of levels deep reaching resultFromJson/canonicalRequestHash from an API
// boundary): a real SimulationRequest/Result never nests anywhere near this deep, so this
// only ever bites a crafted payload. A stack overflow crashes the whole Node process;
// a clean thrown error does not.
const MAX_SERIALISE_DEPTH = 64;

/** Recursively converts every Float64Array in a value tree to a plain array. */
function toJsonDeep(v: unknown, depth = 0): unknown {
  if (depth > MAX_SERIALISE_DEPTH) {
    throw new EngineError('DATA_SCHEMA_MISMATCH', 'value nested too deeply to serialise', { path: '$' });
  }
  if (v instanceof Float64Array) return Array.from(v);
  if (Array.isArray(v)) return v.map((x) => toJsonDeep(x, depth + 1));
  if (v && typeof v === 'object') {
    // Object.create(null) -- not {} -- so an attacker-supplied key literally named
    // "__proto__" lands as an ordinary own property instead of tripping the inherited
    // Object.prototype.__proto__ setter and reassigning this object's prototype.
    const out: Record<string, unknown> = Object.create(null);
    for (const [k, val] of Object.entries(v)) out[k] = toJsonDeep(val, depth + 1);
    return out;
  }
  return v;
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v) && !(v instanceof Float64Array);
}

function requireFields(obj: Record<string, unknown>, fields: readonly string[], base: string): void {
  for (const f of fields) {
    if (!(f in obj)) {
      throw new EngineError('DATA_SCHEMA_MISMATCH', `missing required field "${base}${f}"`, { path: `${base}${f}` });
    }
  }
}

// ============================== SimulationRequest ==============================

const REQUEST_FIELDS = ['site', 'building', 'operation', 'weather', 'materials', 'glazings', 'options'] as const;
const WEATHER_REQUIRED_FIELDS = ['stepSeconds', 'startDayOfYear', 'startHour', 'T_amb', 'GHI', 'v_wind', 'provenance'] as const;
const WEATHER_OPTIONAL_SERIES = ['DNI', 'DHI', 'LW_down', 'RH'] as const;

export function requestToJson(r: SimulationRequest): unknown {
  return toJsonDeep(r);
}

export function requestFromJson(j: unknown): SimulationRequest {
  if (!isPlainObject(j)) {
    throw new EngineError('DATA_SCHEMA_MISMATCH', 'SimulationRequest must be a JSON object', { path: '$' });
  }
  requireFields(j, REQUEST_FIELDS, '');

  const weatherJson = j.weather;
  if (!isPlainObject(weatherJson)) {
    throw new EngineError('DATA_SCHEMA_MISMATCH', 'weather must be a JSON object', { path: 'weather' });
  }
  requireFields(weatherJson, WEATHER_REQUIRED_FIELDS, 'weather.');

  const weather = {
    ...(weatherJson as unknown as WeatherSeries),
    T_amb: seriesFromJson(weatherJson.T_amb as number[]),
    GHI: seriesFromJson(weatherJson.GHI as number[]),
    v_wind: seriesFromJson(weatherJson.v_wind as number[]),
  } as WeatherSeries;
  for (const key of WEATHER_OPTIONAL_SERIES) {
    const v = weatherJson[key];
    if (v !== undefined) (weather as unknown as Record<string, unknown>)[key] = seriesFromJson(v as number[]);
  }

  return { ...(j as unknown as SimulationRequest), weather };
}

// ============================== SimulationResult ==============================

const RESULT_FIELDS = ['meta', 'time', 'temperatures', 'solar', 'heatFlows', 'kpis'] as const;
const TEMPS_FIELDS = ['indoorAir', 'ambient', 'sky', 'meanRadiant', 'ground', 'surfaces'] as const;
const SOLAR_FIELDS = ['incidentBySurface', 'absorbedOpaque', 'transmittedGlazed', 'dailyTotalKWh'] as const;
const HEAT_FLOW_SERIES_KEYS = [
  'Q1_solarOpaque',
  'Q2_solarGlazed',
  'Q3_extConvection',
  'Q4_skyRadiation',
  'Q5_envelopeConduction',
  'Q6_intConvection',
  'Q7_interiorLongwave',
  'Q8_windowConduction',
  'Q9_infiltration',
  'Q10_ground',
  'Q11_internalGains',
  'Qaux',
  'storageRate',
  'deltaT',
] as const;

function seriesRecordFromJson(obj: Record<string, unknown>): Record<string, Float64Array> {
  // Object.create(null): keys here are attacker-controlled surface ids from JSON.
  const out: Record<string, Float64Array> = Object.create(null);
  for (const [k, v] of Object.entries(obj)) out[k] = seriesFromJson(v as number[]);
  return out;
}

export function resultToJson(r: SimulationResult): unknown {
  return toJsonDeep(r);
}

export function resultFromJson(j: unknown): SimulationResult {
  if (!isPlainObject(j)) {
    throw new EngineError('DATA_SCHEMA_MISMATCH', 'SimulationResult must be a JSON object', { path: '$' });
  }
  requireFields(j, RESULT_FIELDS, '');

  const temps = j.temperatures;
  if (!isPlainObject(temps)) {
    throw new EngineError('DATA_SCHEMA_MISMATCH', 'temperatures must be a JSON object', { path: 'temperatures' });
  }
  requireFields(temps, TEMPS_FIELDS, 'temperatures.');
  const surfacesJson = temps.surfaces;
  if (!isPlainObject(surfacesJson)) {
    throw new EngineError('DATA_SCHEMA_MISMATCH', 'temperatures.surfaces must be a JSON object', { path: 'temperatures.surfaces' });
  }
  // Object.create(null): `id` here is an attacker-controlled surface id from JSON.
  const surfaces: SimulationResult['temperatures']['surfaces'] = Object.create(null);
  for (const [id, sv] of Object.entries(surfacesJson)) {
    if (!isPlainObject(sv)) {
      throw new EngineError('DATA_SCHEMA_MISMATCH', `temperatures.surfaces.${id} must be a JSON object`, {
        path: `temperatures.surfaces.${id}`,
      });
    }
    surfaces[id] = {
      exterior: seriesFromJson(sv.exterior as number[]),
      interior: seriesFromJson(sv.interior as number[]),
      ...(sv.profile !== undefined ? { profile: sv.profile as number[][] } : {}),
    };
  }

  const solar = j.solar;
  if (!isPlainObject(solar)) {
    throw new EngineError('DATA_SCHEMA_MISMATCH', 'solar must be a JSON object', { path: 'solar' });
  }
  requireFields(solar, SOLAR_FIELDS, 'solar.');
  const incidentJson = solar.incidentBySurface;
  if (!isPlainObject(incidentJson)) {
    throw new EngineError('DATA_SCHEMA_MISMATCH', 'solar.incidentBySurface must be a JSON object', {
      path: 'solar.incidentBySurface',
    });
  }

  const heatFlowsJson = j.heatFlows;
  if (!isPlainObject(heatFlowsJson)) {
    throw new EngineError('DATA_SCHEMA_MISMATCH', 'heatFlows must be a JSON object', { path: 'heatFlows' });
  }
  requireFields(heatFlowsJson, [...HEAT_FLOW_SERIES_KEYS, 'dailyTotalsKWh'], 'heatFlows.');
  const heatFlows = { dailyTotalsKWh: heatFlowsJson.dailyTotalsKWh } as Record<string, unknown>;
  for (const k of HEAT_FLOW_SERIES_KEYS) heatFlows[k] = seriesFromJson(heatFlowsJson[k] as number[]);

  return {
    meta: j.meta as SimulationResult['meta'],
    time: seriesFromJson(j.time as number[]),
    temperatures: {
      indoorAir: seriesFromJson(temps.indoorAir as number[]),
      ambient: seriesFromJson(temps.ambient as number[]),
      sky: seriesFromJson(temps.sky as number[]),
      meanRadiant: seriesFromJson(temps.meanRadiant as number[]),
      ground: seriesFromJson(temps.ground as number[]),
      surfaces,
    },
    solar: {
      incidentBySurface: seriesRecordFromJson(incidentJson),
      absorbedOpaque: seriesFromJson(solar.absorbedOpaque as number[]),
      transmittedGlazed: seriesFromJson(solar.transmittedGlazed as number[]),
      dailyTotalKWh: solar.dailyTotalKWh as SimulationResult['solar']['dailyTotalKWh'],
    },
    heatFlows: heatFlows as unknown as HeatFlows,
    kpis: j.kpis as SimulationKpis,
    ...(j.warmState !== undefined ? { warmState: seriesFromJson(j.warmState as number[]) } : {}),
  };
}

// ============================== canonicalRequestHash ==============================

/**
 * Rounds to N significant figures (not decimal places), so both 1234.5 and
 * 0.00012345 round sensibly at N=9.
 */
function roundToSigFigs(n: number, sig: number): number {
  if (n === 0 || !Number.isFinite(n)) return n;
  const magnitude = Math.pow(10, sig - Math.ceil(Math.log10(Math.abs(n))));
  return Math.round(n * magnitude) / magnitude;
}

/**
 * Canonicalisation rule (must stay stable -- the SimulationRun table, LOG.md 7.12
 * / T-33, keys on the hash this feeds): recursively sort object keys, render any
 * Float64Array as a plain array, and round every number to 9 significant figures
 * so floating-point noise (e.g. 0.1 + 0.2) never produces a spurious cache miss.
 * Do not change the rounding or sort rule without a migration plan for that table.
 */
function canonicalize(v: unknown, depth = 0): unknown {
  if (depth > MAX_SERIALISE_DEPTH) {
    throw new EngineError('DATA_SCHEMA_MISMATCH', 'value nested too deeply to hash', { path: '$' });
  }
  if (v instanceof Float64Array) return Array.from(v, (n) => roundToSigFigs(n, 9));
  if (typeof v === 'number') return roundToSigFigs(v, 9);
  if (Array.isArray(v)) return v.map((x) => canonicalize(x, depth + 1));
  if (v && typeof v === 'object') {
    // Object.create(null): a SimulationRequest reaching this from requestFromJson can
    // carry arbitrary attacker-supplied keys past validation (extra fields are not
    // rejected); a literal "__proto__" key must not reassign this object's prototype.
    const out: Record<string, unknown> = Object.create(null);
    for (const k of Object.keys(v).sort()) out[k] = canonicalize((v as Record<string, unknown>)[k], depth + 1);
    return out;
  }
  return v;
}

export function canonicalRequestHash(r: SimulationRequest): string {
  return sha256Hex(JSON.stringify(canonicalize(r)));
}

// ============================== SHA-256 ==============================
//
// Pure-JS FIPS 180-4 — identical digests to node:crypto, sync module load so
// the browser webpack bundle (and Client Components that import the engine)
// stay free of top-level await.

function sha256Hex(input: string): string {
  return pureSha256Hex(input);
}

const SHA256_K = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5, 0xd807aa98,
  0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786,
  0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da, 0x983e5152, 0xa831c66d, 0xb00327c8,
  0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13,
  0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819,
  0xd6990624, 0xf40e3585, 0x106aa070, 0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a,
  0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7,
  0xc67178f2,
]);

function rightRotate(x: number, n: number): number {
  return (x >>> n) | (x << (32 - n));
}

/** Small, dependency-free SHA-256 (FIPS 180-4) for environments without node:crypto. */
function pureSha256Hex(message: string): string {
  const bytes = new TextEncoder().encode(message);
  const bitLen = bytes.length * 8;
  const total = Math.ceil((bytes.length + 9) / 64) * 64;
  const buf = new Uint8Array(total);
  buf.set(bytes);
  buf[bytes.length] = 0x80;
  const dv = new DataView(buf.buffer);
  dv.setUint32(total - 4, bitLen >>> 0, false);
  dv.setUint32(total - 8, Math.floor(bitLen / 2 ** 32), false);

  let h0 = 0x6a09e667,
    h1 = 0xbb67ae85,
    h2 = 0x3c6ef372,
    h3 = 0xa54ff53a,
    h4 = 0x510e527f,
    h5 = 0x9b05688c,
    h6 = 0x1f83d9ab,
    h7 = 0x5be0cd19;

  const w = new Uint32Array(64);
  for (let chunk = 0; chunk < total; chunk += 64) {
    for (let i = 0; i < 16; i++) w[i] = dv.getUint32(chunk + i * 4, false);
    for (let i = 16; i < 64; i++) {
      const w15 = w[i - 15]!;
      const w2 = w[i - 2]!;
      const s0 = rightRotate(w15, 7) ^ rightRotate(w15, 18) ^ (w15 >>> 3);
      const s1 = rightRotate(w2, 17) ^ rightRotate(w2, 19) ^ (w2 >>> 10);
      w[i] = (w[i - 16]! + s0 + w[i - 7]! + s1) >>> 0;
    }

    let a = h0,
      b = h1,
      c = h2,
      d = h3,
      e = h4,
      f = h5,
      g = h6,
      h = h7;

    for (let i = 0; i < 64; i++) {
      const S1 = rightRotate(e, 6) ^ rightRotate(e, 11) ^ rightRotate(e, 25);
      const ch = (e & f) ^ (~e & g);
      const temp1 = (h + S1 + ch + SHA256_K[i]! + w[i]!) >>> 0;
      const S0 = rightRotate(a, 2) ^ rightRotate(a, 13) ^ rightRotate(a, 22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (S0 + maj) >>> 0;

      h = g;
      g = f;
      f = e;
      e = (d + temp1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (temp1 + temp2) >>> 0;
    }

    h0 = (h0 + a) >>> 0;
    h1 = (h1 + b) >>> 0;
    h2 = (h2 + c) >>> 0;
    h3 = (h3 + d) >>> 0;
    h4 = (h4 + e) >>> 0;
    h5 = (h5 + f) >>> 0;
    h6 = (h6 + g) >>> 0;
    h7 = (h7 + h) >>> 0;
  }

  return [h0, h1, h2, h3, h4, h5, h6, h7].map((x) => x.toString(16).padStart(8, '0')).join('');
}
