// apps/studio-server/src/designs/routes.ts — /api/designs CRUD (API.md
// §7). `design` bodies are validated with P1's ShelterDesign ajv schema,
// reused from app.ts (exported there for exactly this reuse).

import type { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { authenticate, userId } from '../auth/authenticate.js';
import { shelterDesignSchema } from '../app.js';
import type { ShelterDesign } from '../design/types.js';
import { createDesign, deleteDesign, getDesign, listDesigns, updateDesign } from './service.js';

const designsRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  // Built inside the plugin body (registration time), not at module load,
  // so this module's static import of `shelterDesignSchema` from app.ts
  // (which itself registers this plugin -- a deliberate, safe cycle) never
  // races app.ts's own top-level evaluation.
  const designBodySchema = {
    type: 'object',
    additionalProperties: false,
    required: ['name', 'design'],
    properties: {
      name: { type: 'string', minLength: 1 },
      design: shelterDesignSchema(),
    },
  };

  app.addHook('preHandler', authenticate);

  app.post('/api/designs', { schema: { body: designBodySchema } }, async (request, reply) => {
    const { name, design } = request.body as { name: string; design: ShelterDesign };
    const created = await createDesign(userId(request), name, design);
    reply.code(201);
    return created;
  });

  app.get('/api/designs', async (request) => {
    return listDesigns(userId(request));
  });

  app.get('/api/designs/:id', async (request) => {
    const { id } = request.params as { id: string };
    return getDesign(userId(request), id);
  });

  app.put('/api/designs/:id', { schema: { body: designBodySchema } }, async (request) => {
    const { id } = request.params as { id: string };
    const { name, design } = request.body as { name: string; design: ShelterDesign };
    return updateDesign(userId(request), id, name, design);
  });

  app.delete('/api/designs/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    await deleteDesign(userId(request), id);
    reply.code(204);
  });
};

export default designsRoutes;
