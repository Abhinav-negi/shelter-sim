// apps/studio-server/src/app.ts — Fastify instance. P1 routes: GET
// /api/health, GET /api/options, POST /api/simulate/preview. Contract:
// apps/studio-server/API.md. Validation/error conventions ported from
// apps/server/src/app.ts (ajv schema -> VALIDATION_ERROR, engine
// STATUS_BY_CODE, 5 MB body limit, no stack traces).

import Fastify, { type FastifyError, type FastifyInstance } from 'fastify';
import { GLAZING, MATERIALS, PRESETS, TMY_LOCATIONS } from '@shelter/data';
import { EngineError, resultToJson } from '@shelter/engine';
import type { EngineErrorCode } from '@shelter/engine';
import { assemble, CustomLocationUnavailableError, OCCUPANCY_PRESETS } from './design/assemble.js';
import type { WeatherFor } from './design/assemble.js';
import type { ShelterDesign } from './design/types.js';
import { locationsRoutes } from './locations/routes.js';
import { buildOptions } from './options.js';
import { fastPhysics } from './providers/index.js';
import { UpstreamUnavailableError } from './weather/errors.js';
import { resolveCustomWeather } from './weather/resolve.js';

const MAX_BODY_BYTES = 5 * 1024 * 1024; // 5 MB, API.md §5

// Reused verbatim from apps/server/src/app.ts (apps/server/API.md §5).
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

function surfaceConstructionSchema(materialIds: string[]) {
  // ['object','null'] + required: JSON Schema's `required`/`properties` only
  // constrain object instances, so a `null` value skips them and validates
  // (same trick apps/server/src/app.ts uses for the nullable *MaterialId
  // fields, one level up).
  return {
    type: ['object', 'null'],
    additionalProperties: false,
    required: ['materialId', 'thicknessM'],
    properties: {
      materialId: { type: 'string', enum: materialIds },
      thicknessM: { type: 'number', minimum: 0.02, maximum: 1.0 },
    },
  };
}

function shelterDesignSchema() {
  const locationIds = TMY_LOCATIONS.map((l) => l.id);
  const presetIds = PRESETS.map((p) => p.id);
  const materialIds = MATERIALS.map((m) => m.id);
  const glazingIds = GLAZING.map((g) => g.id);
  const occupancyIds = OCCUPANCY_PRESETS.map((o) => o.id);
  const wwr = { type: 'number', minimum: 0, maximum: 0.9 };
  const construction = surfaceConstructionSchema(materialIds);

  return {
    type: 'object',
    additionalProperties: false,
    required: [
      'location',
      'date',
      'presetId',
      'lengthM',
      'widthM',
      'heightM',
      'azimuthDeg',
      'wallConstruction',
      'roofConstruction',
      'floorConstruction',
      'windowWwr',
      'glazingId',
      'nightShutters',
      'occupancyPresetId',
    ],
    properties: {
      location: {
        oneOf: [
          {
            type: 'object',
            additionalProperties: false,
            required: ['kind', 'id'],
            properties: { kind: { const: 'preset' }, id: { type: 'string', enum: locationIds } },
          },
          {
            type: 'object',
            additionalProperties: false,
            required: ['kind', 'name', 'lat', 'lon', 'elevation'],
            properties: {
              kind: { const: 'custom' },
              name: { type: 'string', minLength: 1 },
              lat: { type: 'number', minimum: -90, maximum: 90 },
              lon: { type: 'number', minimum: -180, maximum: 180 },
              elevation: { type: 'number' },
            },
          },
        ],
      },
      date: { type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$' },
      presetId: { type: 'string', enum: presetIds },
      lengthM: { type: 'number', minimum: 2, maximum: 30 },
      widthM: { type: 'number', minimum: 2, maximum: 30 },
      heightM: { type: 'number', minimum: 2, maximum: 6 },
      azimuthDeg: { type: 'number', minimum: -180, maximum: 180 },
      wallConstruction: construction,
      roofConstruction: construction,
      floorConstruction: construction,
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

/** ajv validation error -> ShelterDesign's own offending field name, e.g.
 * "/windowWwr/S" -> "windowWwr.S"; a missing required top-level property has
 * an empty instancePath and only `params.missingProperty`. Ported from
 * apps/server/src/app.ts. */
function fieldFromValidationError(first: {
  instancePath?: string;
  params?: Record<string, unknown>;
}): string | undefined {
  if (first.instancePath) return first.instancePath.slice(1).replace(/\//g, '.');
  const missing = first.params?.['missingProperty'];
  return typeof missing === 'string' ? missing : undefined;
}

export interface BuildAppOptions {
  /** Injected for tests (recorded fixtures, no live network); defaults to
   * global `fetch` (Node 24) for the real weather/geocoding calls. */
  fetchImpl?: typeof fetch;
}

export function buildApp(opts: BuildAppOptions = {}): FastifyInstance {
  const app = Fastify({ bodyLimit: MAX_BODY_BYTES, logger: false });
  const { fetchImpl } = opts;

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
    if (err instanceof CustomLocationUnavailableError) {
      reply.code(422).send({ code: err.code, message: err.message });
      return;
    }
    if (err instanceof UpstreamUnavailableError) {
      reply.code(502).send({ code: err.code, message: err.message });
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
    console.error('[studio-server] unexpected error:', err);
    reply
      .code(500)
      .send({ code: 'INTERNAL_ERROR', message: 'An unexpected server error occurred.' });
  });

  // CORS, ported from apps/server/src/app.ts (LAN dev client).
  app.addHook('onSend', async (_req, reply, payload) => {
    reply.header('Access-Control-Allow-Origin', '*');
    reply.header('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    reply.header('Access-Control-Allow-Headers', 'Content-Type');
    return payload;
  });
  app.options('/api/*', async (_req, reply) => {
    reply.code(204).send();
  });

  app.register(locationsRoutes, fetchImpl ? { fetchImpl } : {});

  app.get('/api/health', async () => ({ ok: true }));

  app.get('/api/options', async () => buildOptions());

  // location.kind==='custom': resolve weather ASYNCHRONOUSLY first (fetch/
  // cache -> normalise -> Site), then pass a SYNCHRONOUS closure as
  // `weatherFor` -- assemble()'s seam is sync (design/assemble.ts), the
  // fetch behind it is not. `location.kind==='preset'` skips this entirely,
  // same as before P3 (weatherFor stays undefined).
  app.post(
    '/api/simulate/preview',
    { schema: { body: shelterDesignSchema() } },
    async (req) => {
      const design = req.body as ShelterDesign;
      let weatherFor: WeatherFor | undefined;
      let weatherProvenance: { source: string; year: number; notes: string[] } | undefined;
      if (design.location.kind === 'custom') {
        const resolved = await resolveCustomWeather(design.location, fetchImpl);
        weatherFor = () => ({ weather: resolved.weather, site: resolved.site });
        weatherProvenance = resolved.provenance;
      }
      const request = assemble(design, weatherFor);
      const { kpis, result } = await fastPhysics.run(request);
      return {
        kpis,
        result: resultToJson(result),
        ...(weatherProvenance ? { weatherProvenance } : {}),
      };
    },
  );

  return app;
}
