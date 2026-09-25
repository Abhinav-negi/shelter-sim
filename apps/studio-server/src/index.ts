// apps/studio-server/src/index.ts — process entry point.

import { buildApp } from './app.js';
import { loadEnv } from './env.js';

const env = loadEnv();
const app = buildApp();

app
  .listen({ port: env.PORT, host: env.HOST })
  .then((address) => {
    console.log(`shelter-sim studio-server listening on ${address}`);
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
