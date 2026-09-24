// apps/server/src/index.ts — process entry point.

import { buildApp } from './app.js';

const port = Number(process.env['PORT'] ?? 4000);
const host = process.env['HOST'] ?? '127.0.0.1';

const app = buildApp();

app
  .listen({ port, host })
  .then((address) => {
    console.log(`shelter-sim server listening on ${address}`);
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
