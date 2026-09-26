// apps/studio/e2e/scratch-server.mjs — boots a throwaway studio-server
// (an in-memory Mongo via `mongodb-memory-server` + `buildApp({jwtSecret:
// 'scratch'})`, same recipe as F2b/F2c/F3/F4's own scratch QA servers) for
// flow.mjs's E2E run. Not meant to be run by a person directly — flow.mjs
// spawns it via `tsx` (app.ts/db.ts are TypeScript).
//
//   tsx apps/studio/e2e/scratch-server.mjs <port>
import { MongoMemoryServer } from 'mongodb-memory-server';
import { buildApp } from '../../studio-server/src/app.js';
import { connectDb } from '../../studio-server/src/db.js';

const port = Number(process.argv[2] ?? 4109);

async function main() {
  const mongo = await MongoMemoryServer.create();
  await connectDb(mongo.getUri());
  const app = buildApp({ jwtSecret: 'scratch' });
  await app.listen({ port, host: '127.0.0.1' });
  // flow.mjs polls GET /api/health instead of parsing this, but it's a
  // useful marker when running the script by hand for debugging.
  console.log(`SCRATCH_SERVER_READY ${port}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
