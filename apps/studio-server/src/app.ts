// apps/studio-server/src/app.ts — Fastify instance. P1 routes: GET
// /api/health, GET /api/options, POST /api/simulate/preview. P2 adds auth
// (@fastify/jwt + @fastify/cookie) and the designs/simulations route
// plugins (auth/routes.ts, designs/routes.ts, simulations/routes.ts) --
// this file only registers them and wires the cookie/jwt plugins; the
// route logic itself lives in those plugins' own service.ts files.
// Contract: apps/studio-server/API.md. Validation/error conventions ported
// from apps/server/src/app.ts (ajv schema -> VALIDATION_ERROR, engine
// STATUS_BY_CODE, 5 MB body limit, no stack traces).

import Fastify, { type FastifyError, type FastifyInstance } from 'fastify';
import fastifyCookie from '@fastify/cookie';
import fastifyJwt from '@fastify/jwt';
import { GLAZING, MATERIALS, PRESETS, TMY_LOCATIONS } from '@shelter/data';
import { EngineError, resultToJson } from '@shelter/engine';
import type { EngineErrorCode } from '@shelter/engine';
import { assemble, CustomLocationUnavailableError, OCCUPANCY_PRESETS } from './design/assemble.js';
import type { ShelterDesign } from './design/types.js';
import { locationsRoutes } from './locations/routes.js';
import { buildOptions } from './options.js';
import { prepareRequest } from './design/prepare.js';
import { fastPhysics } from './providers/index.js';
import authRoutes from './auth/routes.js';
import { EmailTakenError, InvalidCredentialsError } from './auth/service.js';
import designsRoutes from './designs/routes.js';
import { NotFoundError } from './designs/service.js';
import simulationsRoutes from './simulations/routes.js';
import { UpstreamUnavailableError } from './weather/errors.js';

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

// Exported so designs/routes.ts can validate a design body with the exact
// same ShelterDesign schema as /api/simulate/preview (condition 2), instead
// of a second, drifting copy.
export function shelterDesignSchema() {
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
  /** Signs/verifies the auth cookie's JWT. Defaults to an insecure dev
   * value -- fine for tests (buildApp() has no DB either), never used by
   * index.ts, which requires a real JWT_SECRET before calling buildApp(). */
  jwtSecret?: string;
  /** Only 'production' makes the auth cookie Secure (condition 1). Defaults
   * to process.env.NODE_ENV, same as env.ts. */
  nodeEnv?: string;
  /** Injected for tests (recorded fixtures, no live network); defaults to
   * global `fetch` (Node 24) for the real weather/geocoding calls. */
  fetchImpl?: typeof fetch;
}

export function buildApp(opts: BuildAppOptions = {}): FastifyInstance {
  const app = Fastify({ bodyLimit: MAX_BODY_BYTES, logger: false });
  const jwtSecret = opts.jwtSecret ?? 'dev-insecure-secret-do-not-use-in-production';
  const nodeEnv = opts.nodeEnv ?? process.env['NODE_ENV'] ?? 'development';
  const secureCookies = nodeEnv === 'production';
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
    if (err instanceof EmailTakenError) {
      reply.code(409).send({ code: err.code, message: err.message });
      return;
    }
    if (err instanceof InvalidCredentialsError) {
      reply.code(401).send({ code: err.code, message: err.message });
      return;
    }
    if (err instanceof NotFoundError) {
      reply.code(404).send({ code: err.code, message: err.message });
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

  // Auth: @fastify/jwt reads the JWT straight out of the httpOnly `token`
  // cookie (its own `cookie` option, backed by @fastify/cookie) -- routes
  // call request.jwtVerify() (auth/authenticate.ts) instead of parsing
  // headers by hand.
  app.register(fastifyCookie);
  // sign.expiresIn: the token itself expires with the cookie (7 d), so a
  // copied token can't outlive the session.
  app.register(fastifyJwt, {
    secret: jwtSecret,
    cookie: { cookieName: 'token', signed: false },
    sign: { expiresIn: '7d' },
  });
  app.register(authRoutes, { secureCookies });
  app.register(designsRoutes);
  app.register(simulationsRoutes, fetchImpl ? { fetchImpl } : {});

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

  // Custom locations resolve weather asynchronously inside prepareRequest
  // (design/prepare.ts), the same path persisted runs use.
  app.post(
    '/api/simulate/preview',
    { schema: { body: shelterDesignSchema() } },
    async (req) => {
      const { request, weatherProvenance } = await prepareRequest(
        req.body as ShelterDesign,
        fetchImpl,
      );
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
