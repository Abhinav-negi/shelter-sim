// apps/web/app/api/simulate/route.ts
//
// POST /api/simulate -- one SimulationRequest in, one SimulationResult out. T-38
// (log/AREA-E-server-tier.md). A thin wrapper over @shelter/engine's simulate(),
// cached via T-33's lib/repo/runs.ts, so the exact same physics that runs in the
// browser also runs here -- same request, same answer, on both sides.
//
// Flow: requestFromJson (T-06) -> readRun (T-33) -> on a miss, simulate() ->
// writeRun -> respond. Every response is JSON, including every error -- a
// Next.js default error page is a blank screen to a JSON parser, and the
// client cannot tell that apart from a network failure.
//
// ponytail: a cache hit responds with readRun's own {kpis, meta} shape only --
// no time-series data -- rather than paying for a ~500x larger full-result row
// (T-33's own measured ratio, log/AREA-D-database-tier.md test 13) to serve a
// single run that already completes in ~32ms uncached. If a future task needs
// full charts to come back on a hit too, switch to readFullRun / writeRun(...,
// storeFull: true) -- the response shapes below are already compatible with
// either a SimulationResult (miss) or its {kpis, meta} subset (hit).

import { NextResponse } from 'next/server';
import { EngineError, requestFromJson, resultToJson, simulate } from '@shelter/engine';
import type { EngineErrorCode, SimulationRequest } from '@shelter/engine';
import { readRun, writeRun } from '../../../lib/repo/runs.js';
import { logError } from '../../../lib/log.js';

/**
 * 5 MB. A SimulationRequest carrying an 8,760-hour weather series is about
 * 1 MB (T-38's own brief), so this is generous and still bounds the blast
 * radius of a hostile or broken client.
 */
const MAX_BODY_BYTES = 5 * 1024 * 1024;

/** Every EngineErrorCode maps to exactly one HTTP status. T-38's brief, verbatim. */
const STATUS_BY_CODE: Record<EngineErrorCode, number> = {
  INVALID_INPUT: 400,
  GEOMETRY_INCONSISTENT: 400,
  WEATHER_INVALID: 422,
  UNKNOWN_MATERIAL: 422,
  UNKNOWN_GLAZING: 422,
  DATA_SCHEMA_MISMATCH: 422,
  SOLVER_DIVERGED: 500,
  SINGULAR_MATRIX: 500,
};

function jsonError(status: number, code: string, message: string, detail?: unknown): NextResponse {
  return NextResponse.json({ code, message, ...(detail !== undefined ? { detail } : {}) }, { status });
}

/**
 * requestFromJson (T-06) always throws DATA_SCHEMA_MISMATCH for a malformed or
 * incomplete wire body (missing top-level fields, wrong shapes), with a single
 * `{ path }` detail. From this route's own caller's point of view that is a bad
 * request, not a data-integrity problem with someone else's data, so it is
 * reported as INVALID_INPUT (400) with a one-entry detail array -- matching how
 * every other input-validation failure on this route looks. DATA_SCHEMA_MISMATCH's
 * 422 mapping above is kept for completeness (per the brief's taxonomy table) but
 * is not reachable from this particular parsing step.
 */
function parseRequestBody(json: unknown): SimulationRequest {
  try {
    return requestFromJson(json);
  } catch (err) {
    if (err instanceof EngineError) {
      const path = (err.detail as { path?: string } | undefined)?.path ?? '$';
      throw new EngineError('INVALID_INPUT', err.message, [{ path, message: err.message }]);
    }
    throw err;
  }
}

function mapEngineError(err: unknown): NextResponse {
  if (err instanceof EngineError) {
    const status = STATUS_BY_CODE[err.code];
    return jsonError(status, err.code, err.message, err.detail);
  }
  logError('POST /api/simulate: unexpected error', err);
  return jsonError(500, 'INTERNAL_ERROR', 'An unexpected server error occurred.');
}

export async function POST(req: Request): Promise<Response> {
  let bodyText: string;
  try {
    bodyText = await req.text();
  } catch (err) {
    logError('POST /api/simulate: failed to read request body', err);
    return jsonError(400, 'INVALID_INPUT', 'Could not read the request body.', [
      { path: '$', message: 'Could not read the request body.' },
    ]);
  }

  if (Buffer.byteLength(bodyText, 'utf8') > MAX_BODY_BYTES) {
    return jsonError(413, 'PAYLOAD_TOO_LARGE', `Request body exceeds the ${MAX_BODY_BYTES}-byte limit.`);
  }

  let json: unknown;
  try {
    json = JSON.parse(bodyText);
  } catch {
    return jsonError(400, 'INVALID_INPUT', 'Request body is not valid JSON.', [
      { path: '$', message: 'Request body is not valid JSON.' },
    ]);
  }

  let request: SimulationRequest;
  try {
    request = parseRequestBody(json);
  } catch (err) {
    return mapEngineError(err);
  }

  try {
    const cached = await readRun(request);
    if (cached) {
      return NextResponse.json({ kpis: cached.kpis, meta: cached.meta });
    }

    const result = simulate(request);
    await writeRun(request, result, false);
    return NextResponse.json(resultToJson(result));
  } catch (err) {
    return mapEngineError(err);
  }
}
