// apps/studio-server/src/simulations/routes.ts — POST/GET
// /api/designs/:id/simulations, GET /api/simulations/:id (API.md §7).
// Design-scoped and simulation-scoped paths live together here since both
// operate on the same `simulations` collection/service.

import type { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { authenticate, userId } from '../auth/authenticate.js';
import { getSimulation, listSimulations, runSimulation } from './service.js';

const simulationsRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  app.addHook('preHandler', authenticate);

  app.post('/api/designs/:id/simulations', async (request, reply) => {
    const { id } = request.params as { id: string };
    const created = await runSimulation(userId(request), id);
    reply.code(201);
    return created;
  });

  app.get('/api/designs/:id/simulations', async (request) => {
    const { id } = request.params as { id: string };
    return listSimulations(userId(request), id);
  });

  app.get('/api/simulations/:id', async (request) => {
    const { id } = request.params as { id: string };
    return getSimulation(userId(request), id);
  });
};

export default simulationsRoutes;
