// apps/studio-server/src/index.ts — process entry point.

import { buildApp } from './app.js';
import { connectDb } from './db.js';
import { loadEnv } from './env.js';

const env = loadEnv();

// MONGODB_URI/JWT_SECRET are optional for buildApp() itself (so tests can
// build an app without a real DB/secret, P1's original design), but a real
// server boot needs both -- fail fast with a clear message rather than
// serving auth/design/simulation routes that can never work (condition 5).
if (!env.MONGODB_URI || !env.JWT_SECRET) {
  console.error(
    '[studio-server] MONGODB_URI and JWT_SECRET must both be set to start the server.',
  );
  process.exit(1);
}

const app = buildApp({ jwtSecret: env.JWT_SECRET, nodeEnv: env.NODE_ENV });

connectDb(env.MONGODB_URI)
  .then(() => app.listen({ port: env.PORT, host: env.HOST }))
  .then((address) => {
    console.log(`shelter-sim studio-server listening on ${address}`);
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
