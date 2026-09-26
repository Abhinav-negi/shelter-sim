// apps/studio-server/src/env.ts — process environment, read once.
//
// DB/auth variables are optional in P1 (no route needs them yet); P2 makes
// MONGODB_URI/JWT_SECRET required at startup once auth/persistence land.

export interface Env {
  PORT: number;
  HOST: string;
  MONGODB_URI: string | undefined;
  JWT_SECRET: string | undefined;
  NODE_ENV: string;
}

// `.env` is loaded by the dev/start scripts (`--env-file-if-exists=.env`). It
// may contain blank entries (`PORT=`), so empty strings fall back like unset
// ones (`||`, not `??` -- `Number('')` would be port 0, i.e. a random port).
export function loadEnv(): Env {
  return {
    PORT: Number(process.env['PORT'] || 4100),
    HOST: process.env['HOST'] || '127.0.0.1',
    MONGODB_URI: process.env['MONGODB_URI'] || undefined,
    JWT_SECRET: process.env['JWT_SECRET'] || undefined,
    NODE_ENV: process.env['NODE_ENV'] || 'development',
  };
}
