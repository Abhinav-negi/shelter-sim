// apps/studio-server/test/helpers/fetch.ts — shared test-only helpers: load
// a recorded fixture from test/fixtures/, and build a fake `fetch` Response
// around it. No live network (ledger/tasks/P3.md condition 5).

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export function loadFixture(name: string): unknown {
  const url = new URL(`../fixtures/${name}`, import.meta.url);
  return JSON.parse(readFileSync(fileURLToPath(url), 'utf8'));
}

export function jsonResponse(json: unknown, ok = true, status = 200): Response {
  return { ok, status, json: async () => json } as unknown as Response;
}
