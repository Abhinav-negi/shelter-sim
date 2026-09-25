# F1b — Reconcile client API layer with the real server contract
Status: DONE      Depends on: F1, P2, P3

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

**What changed and why**

- `apps/studio-server/src/design/types.ts`: added `PreviewResponse.weatherProvenance?: WeatherProvenanceSummary`
  (condition 3 — app.ts's preview route already returned it on custom locations; the type just hadn't caught up),
  and six `export type { … } from '…'` re-exports the client needed: `PublicUser` (`../auth/service.js`),
  `DesignSummary` (`../designs/service.js`), `SimulationSummary`/`SimulationFull` (`../simulations/service.js`),
  `WeatherProvenanceSummary` (`../weather/resolve.js`, also used internally now), `LocationSearchResult`
  (`../weather/geocode.js`). All six are `import type`/`export type` only, so the mutual references this creates
  (`design/types.ts` → `weather/resolve.ts` → `design/types.ts` for `DesignLocation`, etc.) erase at compile time —
  `npx tsc -p apps/studio-server --noEmit` confirms no cycle problem.
- `apps/studio/src/api/client.ts`: `credentials: 'include'` → `'same-origin'` (condition 4 — API.md §7's cookie is
  httpOnly + SameSite=Lax on the same origin the Vite dev proxy serves `/api` from; `'include'` was over-broad).
  This one-line fix applies to every wrapper since they all route through `request()`.
- `apps/studio/src/api/auth.ts`: server wraps the user in `{user}` for register/login/me (API.md §7); the old
  code treated the response as a flat `AuthUser`. Now `login`/`register`/`getMe` unwrap `.user` internally so
  callers (`Login.tsx`, `Register.tsx`, `RequireAuth.tsx`) keep working unchanged — verified no caller destructures
  the wrapper shape itself. `AuthUser` hand-copy replaced by `import type { PublicUser } from '@shelter/studio-server'`.
- `apps/studio/src/api/designs.ts`: `DesignRecord`/`SimulationRecord` hand-copies (which included a nonexistent
  `ownerId` field the server never returns, API.md §8) replaced by `DesignSummary`/`SimulationSummary`/
  `SimulationFull` imported from `@shelter/studio-server`. `updateDesign` was a `Partial` PATCH-shaped call;
  API.md §8 says PUT is a **whole replacement** with the same required `{name, design}` schema as POST — changed
  signature to `updateDesign(id, name, design)`. `deleteDesign` expected a `{ok:true}` body; API.md §8 says
  DELETE returns 204 with an empty body — now typed `Promise<void>` (the shared `request()` already returns
  `null` for an empty body, so no runtime change needed there). `runSimulation` now returns `SimulationFull`
  (API.md §9 — was `PreviewResponse & {id}`, a guessed shape).
- `apps/studio/src/api/locations.ts`: server's `LocationSearchResult` (API.md §4b / `weather/geocode.ts`) is
  `{name, country, admin1?, lat, lon, elevation}`; the old hand-copy guessed `{name, latitude, longitude,
  elevation, country?}` — wrong field names (`lat`/`lon` not `latitude`/`longitude`) and missing `admin1`. Now
  `import type { LocationSearchResult } from '@shelter/studio-server'`.
- `apps/studio/src/api/{health,options,simulate}.ts`: already matched API.md exactly (F1 got these three right
  against P1, which had already landed); no changes, but each still got a new test file (condition 4 is "a
  vitest per wrapper module", not "per changed module").
- No changes needed in `apps/studio/src/routes/{Login,Register,RequireAuth}*`: grepped every studio-src import of
  `api/{auth,designs,simulate,options,locations,health,client}` — only those three route files import any of
  them today, and none destructures the old flat/guessed shapes (Login/Register just `await` the call, RequireAuth
  only checks truthiness of `getMe()`'s already-unwrapped result).

**Gotchas for a successor**

- `DesignSummary`/`SimulationSummary`/`SimulationFull` as defined in `designs/service.ts` /
  `simulations/service.ts` type `createdAt`/`updatedAt` as `Date`, but Fastify JSON-serializes them to ISO
  strings on the wire (API.md documents them as `string`). This is a pre-existing mismatch in server code F1b
  wasn't allowed to touch (`designs/service.ts`/`simulations/service.ts` aren't in F1b's "May touch" — only
  `design/types.ts`, and only for re-exports). The client re-exports the type as-is per the task's explicit
  instruction ("Types come from `@shelter/studio-server`... no hand copies"); at runtime the values are correctly
  ISO strings, only the compile-time type is one field's type optimistic. Not fixed here — would need a
  server-side task with `designs|simulations/service.ts` in scope.
- Test files use `vi.stubGlobal('fetch', vi.fn())` + a tiny local `jsonResponse()`/`emptyResponse()` helper per
  file (no shared test-util module — six call sites of ~2 lines each didn't justify one).

**Commands run**

- `npm ci` (worktree root) — clean, no lockfile change.
- `npm run build --workspace @shelter/engine --workspace @shelter/data` — clean (prerequisite build).
- `npm run build -w @shelter/studio` — clean (`tsc --noEmit` + `vite build`).
- `npm test -w @shelter/studio` — 28/28 pass (8 test files: `auth`, `designs`, `health`, `locations`, `options`,
  `simulate`, `store`, `Segmented`).
- `npx tsc -p apps/studio-server --noEmit` — clean.
- `npm test -w @shelter/studio-server` — 49/49 pass, 2 skipped (`weather.live.test.ts`, live-network-only).
- `git diff studio/main --stat -- apps/server apps/client apps/web packages package-lock.json` — empty.

**What's left:** nothing outstanding for F1b's own scope. F3 (studio page) will be the first real caller of
`designs.ts`/`simulate.ts` beyond auth — worth a quick smoke test against a running `apps/studio-server` once
Mongo creds are available, but that's F3's job, not a gap in this task.
