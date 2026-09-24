// apps/server/src/app.ts — Fastify instance: GET /api/health, GET /api/options,
// POST /api/simulate, POST /api/simulate/raw, POST /api/assemble. Contract:
// apps/server/API.md.

import Fastify, { type FastifyError, type FastifyInstance } from 'fastify';
import { GLAZING, MATERIALS, PRESETS, TMY_LOCATIONS } from '@shelter/data';
import { EngineError, requestFromJson, requestToJson, resultToJson, simulate } from '@shelter/engine';
import type { EngineErrorCode, SimulationRequest } from '@shelter/engine';
import { assemble, OCCUPANCY_PRESETS, type DesignInput } from './assemble.js';
import { buildOptions } from './options.js';

const MAX_BODY_BYTES = 5 * 1024 * 1024; // 5 MB, API.md §5

// STATUS_BY_CODE reused verbatim from apps/web/app/api/simulate/route.ts (API.md §5).
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

function designInputSchema() {
  const locationIds = TMY_LOCATIONS.map((l) => l.id);
  const presetIds = PRESETS.map((p) => p.id);
  const materialIds = MATERIALS.map((m) => m.id);
  const glazingIds = GLAZING.map((g) => g.id);
  const occupancyIds = OCCUPANCY_PRESETS.map((o) => o.id);
  const wwr = { type: 'number', minimum: 0, maximum: 0.9 };

  return {
    type: 'object',
    additionalProperties: false,
    required: [
      'locationId',
      'date',
      'presetId',
      'lengthM',
      'widthM',
      'heightM',
      'wallMaterialId',
      'roofMaterialId',
      'floorMaterialId',
      'windowWwr',
      'glazingId',
      'nightShutters',
      'occupancyPresetId',
    ],
    properties: {
      locationId: { type: 'string', enum: locationIds },
      date: { type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$' },
      presetId: { type: 'string', enum: presetIds },
      lengthM: { type: 'number', minimum: 2, maximum: 30 },
      widthM: { type: 'number', minimum: 2, maximum: 30 },
      heightM: { type: 'number', minimum: 2, maximum: 6 },
      wallMaterialId: { type: ['string', 'null'], enum: [...materialIds, null] },
      roofMaterialId: { type: ['string', 'null'], enum: [...materialIds, null] },
      floorMaterialId: { type: ['string', 'null'], enum: [...materialIds, null] },
      windowWwr: {
        type: 'object',
        additionalProperties: false,
        required: ['S', 'E', 'W', 'N'],
        properties: { S: wwr, E: wwr, W: wwr, N: wwr },
      },
      glazingId: { type: 'string', enum: glazingIds },
      nightShutters: { type: 'boolean' },
      occupancyPresetId: { type: 'string', enum: occupancyIds },
    },
  };
}

/** ajv validation error -> DesignInput's own offending field name, e.g.
 * "/windowWwr/S" -> "windowWwr.S"; a missing required top-level property has
 * an empty instancePath and only `params.missingProperty`. */
function fieldFromValidationError(first: {
  instancePath?: string;
  params?: Record<string, unknown>;
}): string | undefined {
  if (first.instancePath) return first.instancePath.slice(1).replace(/\//g, '.');
  const missing = first.params?.['missingProperty'];
  return typeof missing === 'string' ? missing : undefined;
}

export function buildApp(): FastifyInstance {
  const app = Fastify({ bodyLimit: MAX_BODY_BYTES, logger: false });

  app.setErrorHandler((err: FastifyError, _req, reply) => {
    const validation = (err as { validation?: unknown[] }).validation;
    if (validation && validation.length > 0) {
      const field = fieldFromValidationError(
        validation[0] as { instancePath?: string; params?: Record<string, unknown> },
      );
      reply
        .code(400)
        .send({ code: 'VALIDATION_ERROR', message: err.message, ...(field ? { field } : {}) });
      return;
    }
    if (err instanceof EngineError) {
      reply.code(STATUS_BY_CODE[err.code] ?? 500).send({ code: err.code, message: err.message });
      return;
    }
    if ((err as { statusCode?: number }).statusCode === 413) {
      reply.code(413).send({ code: 'PAYLOAD_TOO_LARGE', message: err.message });
      return;
    }
    console.error('[server] unexpected error:', err);
    reply.code(500).send({ code: 'INTERNAL_ERROR', message: 'An unexpected server error occurred.' });
  });

  // CORS: LAN browser callers (dev:lan client on another host on the network
  // hitting this server directly). No new dependency -- just the three headers
  // on every response plus an OPTIONS catch-all for the preflight.
  app.addHook('onSend', async (_req, reply, payload) => {
    reply.header('Access-Control-Allow-Origin', '*');
    reply.header('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    reply.header('Access-Control-Allow-Headers', 'Content-Type');
    return payload;
  });
  app.options('/api/*', async (_req, reply) => {
    reply.code(204).send();
  });

  app.get('/api/health', async () => ({ ok: true }));

  app.get('/api/options', async () => buildOptions());

  app.post(
    '/api/simulate',
    { schema: { body: designInputSchema() } },
    async (req) => {
      const input = req.body as DesignInput;
      const request = assemble(input);
      const result = simulate(request);
      return { input, kpis: result.kpis, result: resultToJson(result) };
    },
  );

  // POST /api/assemble -- DesignInput in, the exact SimulationRequest /api/simulate
  // would run, in wire JSON, out. Same body validation as /api/simulate (API.md).
  app.post(
    '/api/assemble',
    { schema: { body: designInputSchema() } },
    async (req) => {
      const input = req.body as DesignInput;
      return requestToJson(assemble(input));
    },
  );

  // POST /api/simulate/raw -- a full engine SimulationRequest in wire JSON
  // (requestToJson's own output shape) in, {kpis, result} out. Malformed body
  // handling ported from apps/web/app/api/simulate/route.ts's parseRequestBody:
  // requestFromJson always throws DATA_SCHEMA_MISMATCH for a malformed/incomplete
  // body; from this route's point of view that's a bad request (INVALID_INPUT),
  // with the offending path (if any) reported as `field`.
  app.post('/api/simulate/raw', async (req, reply) => {
    let request: SimulationRequest;
    try {
      request = requestFromJson(req.body);
    } catch (err) {
      if (err instanceof EngineError) {
        const field = (err.detail as { path?: string } | undefined)?.path;
        reply
          .code(400)
          .send({ code: 'INVALID_INPUT', message: err.message, ...(field ? { field } : {}) });
        return;
      }
      throw err;
    }
    const result = simulate(request);
    return { kpis: result.kpis, result: resultToJson(result) };
  });

  return app;
}
