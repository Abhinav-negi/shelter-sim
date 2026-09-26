// apps/studio-server/src/auth/routes.ts — POST /api/auth/{register,login,
// logout}, GET /api/auth/me (API.md §7). A Fastify plugin, registered by
// app.ts alongside @fastify/jwt + @fastify/cookie (condition 1).

import type { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { authenticate, userId } from './authenticate.js';
import { authenticateUser, getUserById, registerUser } from './service.js';

const COOKIE_NAME = 'token';
const MAX_AGE_S = 7 * 24 * 60 * 60; // 7 days (condition 1)

const EMAIL_PATTERN = '^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$';

const registerBodySchema = {
  type: 'object',
  additionalProperties: false,
  required: ['email', 'password', 'name'],
  properties: {
    email: { type: 'string', pattern: EMAIL_PATTERN },
    password: { type: 'string', minLength: 8 },
    name: { type: 'string', minLength: 1 },
  },
};

const loginBodySchema = {
  type: 'object',
  additionalProperties: false,
  required: ['email', 'password'],
  properties: {
    email: { type: 'string', pattern: EMAIL_PATTERN },
    password: { type: 'string', minLength: 1 },
  },
};

export interface AuthRoutesOptions {
  secureCookies: boolean;
}

const authRoutes: FastifyPluginAsync<AuthRoutesOptions> = async (
  app: FastifyInstance,
  opts: AuthRoutesOptions,
) => {
  function setAuthCookie(reply: import('fastify').FastifyReply, token: string) {
    reply.setCookie(COOKIE_NAME, token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: opts.secureCookies,
      path: '/',
      maxAge: MAX_AGE_S,
    });
  }

  app.post('/api/auth/register', { schema: { body: registerBodySchema } }, async (request, reply) => {
    const { email, password, name } = request.body as {
      email: string;
      password: string;
      name: string;
    };
    const user = await registerUser(email, name, password);
    setAuthCookie(reply, app.jwt.sign({ sub: user.id }));
    reply.code(201);
    return { user };
  });

  app.post('/api/auth/login', { schema: { body: loginBodySchema } }, async (request, reply) => {
    const { email, password } = request.body as { email: string; password: string };
    const user = await authenticateUser(email, password);
    setAuthCookie(reply, app.jwt.sign({ sub: user.id }));
    return { user };
  });

  app.post('/api/auth/logout', async (_request, reply) => {
    reply.clearCookie(COOKIE_NAME, { path: '/' });
    return { ok: true };
  });

  app.get('/api/auth/me', { preHandler: authenticate }, async (request, reply) => {
    const user = await getUserById(userId(request));
    if (!user) {
      reply.code(401).send({ code: 'UNAUTHENTICATED', message: 'Authentication required.' });
      return;
    }
    return { user };
  });
};

export default authRoutes;
