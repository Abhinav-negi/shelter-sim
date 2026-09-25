// apps/studio-server/src/auth/authenticate.ts — shared preHandler guard used
// by every protected route (auth/me, designs/**, simulations/**). Relies on
// @fastify/jwt's cookie extraction (registered in app.ts), which reads the
// httpOnly `token` cookie set at register/login.

import type { FastifyReply, FastifyRequest } from 'fastify';

export interface JwtPayload {
  sub: string; // user id
}

export async function authenticate(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  try {
    await request.jwtVerify();
  } catch {
    reply.code(401).send({ code: 'UNAUTHENTICATED', message: 'Authentication required.' });
  }
}

/** The authenticated user's id. Only valid after `authenticate` succeeded. */
export function userId(request: FastifyRequest): string {
  return (request.user as JwtPayload).sub;
}
