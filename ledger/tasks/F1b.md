# F1b — Reconcile client API layer with the real server contract
Status: TODO      Depends on: F1, P2, P3

## Goal
F1 wrote `apps/studio/src/api/{auth,designs,locations}.ts` against guessed shapes (P2/P3 hadn't landed). Make every
client wrapper and type match `apps/studio-server/API.md` exactly, typed from the server where the server exports types.

## Read
`apps/studio-server/API.md` (all) · `apps/studio/src/api/**` · `apps/studio-server/src/{auth/service.ts,designs/service.ts,simulations/service.ts,weather/resolve.ts,design/types.ts}` (exported types only)

## May touch / must not touch
May: `apps/studio/src/api/**`, callers of changed functions inside `apps/studio/src/routes/{Login,Register,RequireAuth}*`,
`apps/studio-server/src/design/types.ts` (ONLY to add type re-exports the client needs, e.g. `PublicUser`,
`DesignSummary`, `SimulationSummary`, `SimulationFull`, `WeatherProvenanceSummary`, `LocationSearchResult`, as
`export type { … } from '…'`). Must not: viewer, anything else in studio-server, frozen paths. **No npm install.**

## Conditions
1. Every route in API.md has exactly one typed wrapper; request/response field names match API.md verbatim.
2. Types come from `@shelter/studio-server` via `import type` wherever the server defines them (no hand copies).
3. `PreviewResponse` includes optional `weatherProvenance`; simulation records include optional `weatherProvenance`.
4. A vitest per wrapper module with a mocked `fetch` asserting method, URL, body and credentials (`credentials:
   'same-origin'` so the auth cookie flows).
5. `npm run build -w @shelter/studio`, `npm test -w @shelter/studio`, `npx tsc -p apps/studio-server --noEmit` clean.

## Evidence
