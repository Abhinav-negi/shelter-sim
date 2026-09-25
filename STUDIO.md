# STUDIO.md — ShelterSim Studio build ledger (index)

Orchestrator protocol: `ORCHESTRATOR.md`. Architecture: `ledger/PLAN.md`. One file per task: `ledger/tasks/<ID>.md`.
Integration branch: **`studio/main`**. Task branches: `task/<id>` in worktrees `../wt-<id>`.

## HANDOFF (2026-09-25, session 1 — in progress)

Merged into `studio/main`: P1, P3, P2 (+ orchestrator integration fix: `design/prepare.ts` so saved runs of
custom-location designs resolve weather), security fixes (JWT `expiresIn 7d`, dummy-hash login timing), F1.
F1's agent hit the Sonnet session limit mid-rebase; orchestrator finished the rebase and verified it.
Main tree `node_modules` must be refreshed with `npm install` (NOT `npm ci`: old app dev servers on :4000/:5173 run
from it) after merges that change the lockfile.
**Waiting on the user for** `MONGODB_URI` + `JWT_SECRET` (running the app only).
**Next step:** F1b ∥ F2 in worktrees, then F3 → F4 → Q1.

## Decisions (approved by user unless marked "orchestrator")
1. New apps `apps/studio` + `apps/studio-server` (orchestrator: naming). Old apps and `packages/*` frozen.
2. MongoDB + Mongoose. Tests use `mongodb-memory-server`.
3. Locations: 5 bundled presets **plus** any lat/lon via Open-Meteo / NASA POWER (keyless), cached in Mongo.
4. 3D: react-three-fiber + drei, flat roof only (it matches the engine), view-only (no direct editing).
5. Auth: email/password, scrypt, JWT in an httpOnly cookie (orchestrator: minor, per brief §7).
6. The client imports `ShelterDesign` etc. **type-only** from `apps/studio-server/src/design/types.ts`, the single
   definition (orchestrator).
7. Ports: studio server :4100, client :5273 (orchestrator; :4000/:5173 belong to the old app).
8. Parallel agents use git worktrees; the orchestrator merges `--no-ff` after verification.

## Tasks

| ID | Task | Depends | Owner | Status | Evidence |
|---|---|---|---|---|---|
| S0 | Branch, commits, ORCHESTRATOR.md, ledger | – | orchestrator | DONE | `git log --oneline -1 rebuild/client-server` = 0700e7a; ledger files present |
| P1 | Server foundation: scaffold, ShelterDesign, assemble copy+ext, provider, preview, API.md, parity test | S0 | | DONE | `apps/studio-server` created; `npm test -w @shelter/studio-server` 13/13 pass incl. parity; `tsc -p apps/studio-server --noEmit` clean; `npm test -w @shelter/server` still 12/12; frozen-app diff empty. See `ledger/tasks/P1.md` Evidence. Orchestrator review fix: `/api/options` now has `materials[].defaultThicknessM` + `presets[].thicknessM{wall,roof,floor}`. Note: `weatherFor` seam is **sync**; P3 pre-fetches async in the route. |
| P2 | Auth + designs + simulations (Mongo) | P1 | | DONE | `apps/studio-server/src/{db.ts,auth/**,designs/**,simulations/**}` added; `app.ts` registers `@fastify/cookie`+`@fastify/jwt` and the three route plugins (minimal diff, routes only); `index.ts` fails fast if `MONGODB_URI`/`JWT_SECRET` missing. `npm test -w @shelter/studio-server` 34/34 pass (13 P1 + 21 P2, incl. `mongodb-memory-server`); `tsc -p apps/studio-server --noEmit` clean; frozen-app diff empty; scratch run on :4102 against a real Mongo confirmed register/me over real HTTP+cookies. See `ledger/tasks/P2.md` Evidence. |
| P3 | Weather + location search + custom-location assembly | P1 | | DONE | `apps/studio-server/src/{weather/**,locations/**}` added; `GET /api/locations/search?q=` (Open-Meteo geocoding, 502 `UPSTREAM_UNAVAILABLE` upstream); custom-location preview resolves weather async (Open-Meteo archive, falling back to NASA POWER) → `normaliseWeather` → `weatherCache` Mongo model (`{source,lat(2dp),lon(2dp),year}` unique) → sync `weatherFor` closure into P1's seam, unchanged. `npm test -w @shelter/studio-server` 26/26 pass (2 live-only skipped) incl. parity; `tsc -p apps/studio-server --noEmit` clean; `npm test -w @shelter/server` still 12/12; frozen-app diff empty. Live smoke: Shimla (31.10442, 77.16662) preview → 200, `weatherProvenance:{source:'open-meteo',year:2023,notes:[...]}`. See `ledger/tasks/P3.md` Evidence. |
| F1 | Client scaffold: design system, shell, routing, store, api client | P1 | | DONE | `apps/studio` (`@shelter/studio`, Vite :5273, proxy `/api`→:4100) created: tokens (light/dark + toggle), app shell (wordmark/nav/theme toggle), routes `/`, `/login`, `/register`, `/app`, `/app/design/:id`, `/app/compare` (`/app/*` guarded by `GET /api/auth/me`), zustand `ShelterDesign` store w/ per-group setters + `dirty` + selectors (`subscribeWithSelector`), typed `src/api/*` wrappers normalising errors to `{code,message,field?}`, 6 UI primitives (Button/Input/Slider/Select/Segmented/FieldRow). `npm run build -w @shelter/studio` clean; `npm test -w @shelter/studio` 9/9 pass; `grep -rl "hdkr\|meshTargetDx" apps/studio/dist` empty; 8 screenshots (light/dark × 1440/390 × `/`,`/login`) 0 console errors. See `ledger/tasks/F1.md` Evidence. |
| F1b | Reconcile client api/ (auth, designs, simulations, locations) with real API.md | F1 P2 P3 | | DONE | `apps/studio/src/api/{auth,designs,locations,client}.ts` rewritten against `apps/studio-server/API.md`: auth wrappers unwrap `{user}` (register/login/me) and return `{ok:true}` (logout); designs wrappers use `DesignSummary`/`SimulationSummary`/`SimulationFull` (no `ownerId`), `updateDesign` is now a whole `{name,design}` PUT (was a partial patch), `deleteDesign` expects 204/no body; `locations.ts` now returns `{name,country,admin1?,lat,lon,elevation}` (was `{latitude,longitude,country?}`); `client.ts`'s `credentials` fixed `'include'`→`'same-origin'` (condition 4). Added `PublicUser`/`DesignSummary`/`SimulationSummary`/`SimulationFull`/`WeatherProvenanceSummary`/`LocationSearchResult` re-exports plus `PreviewResponse.weatherProvenance?` to `apps/studio-server/src/design/types.ts` (all `export type {...} from` — type-only, no runtime cycle despite `design/types.ts` ↔ `weather/resolve.ts` ↔ `designs·simulations/service.ts` mutual references). 6 new vitest files (one per wrapper module) mock `fetch` and assert method/URL/body/credentials. `npm run build -w @shelter/studio` clean; `npm test -w @shelter/studio` 28/28 pass; `npx tsc -p apps/studio-server --noEmit` clean; `npm test -w @shelter/studio-server` 49/49 pass (2 live-only skipped); frozen-path diff (`apps/server apps/client apps/web packages package-lock.json`) empty. `Login.tsx`/`Register.tsx`/`RequireAuth.tsx` needed no changes (they don't destructure the old flat shape). See `ledger/tasks/F1b.md` Evidence. |
| F2 | 3D ShelterViewer | F1 | | DONE | `apps/studio/src/viewer/{geometry,solar,ShelterViewer,Building,Compass,useThemeColors,DevViewer}.{ts,tsx}` + `src/design/useOptions.ts` (new, cached `GET /api/options` hook) + one route in `App.tsx` (`/dev/viewer`, lazy-loaded). Pure `geometry.ts`: ShelterDesign→dimensions/thickness/window rects/azimuth rotation, documented world-frame + sign convention. `solar.ts`: independent declination/hour-angle sun-position function (client only imports *types* from `@shelter/engine`), checked against the engine's own documented Leh winter-solstice reference (32.4°). Walls built as non-overlapping frame boxes around each window opening (no CSG, no z-fighting); flat roof+floor slabs; world-space compass (Billboard + box-built "N" glyph, no font/DOM dependency); fog-faded ground disc; fixed daylight light colours decoupled from the paper/ink theme tokens (bug found + fixed: using the theme token as the light *color* made dark mode render almost black — see Building.tsx/ShelterViewer.tsx headers); `frameloop="demand"`, `OrbitControls` clamped polar angle. `npm run build -w @shelter/studio` clean (three code-split into its own `DevViewer-*.js` chunk, ~956 kB, out of the ~271 kB landing/login chunk); `npm test -w @shelter/studio` 38/38 pass (10 new: geometry.test.ts, solar.test.ts); frozen-path diff empty. Visual QA: 6 screenshots (default × light/dark, wide+thick, azimuth 90°, hour 8/16 sun-direction sanity check) against a scratch `buildApp()` + `vite preview` (production build — dev-mode StrictMode double-invoke triggers an unrelated-to-F2 R3F/React-19 console error that doesn't occur in production or affect shipped behaviour, see Evidence). 0 console errors/warnings except one unavoidable upstream `THREE.Clock` deprecation notice from `@react-three/fiber@9.8.1`'s own internals (pinned version, no install allowed). See `ledger/tasks/F2.md` Evidence. |
| F3 | Studio page: controls, live preview, results | F1 F2 | | TODO | |
| F4 | Landing, auth pages, dashboard, compare | F3 P2 | | TODO | |
| Q1 | E2E + visual QA pass, fixes routed back | all | | TODO | |

## Required from user
```
apps/studio-server/.env
MONGODB_URI=   # Atlas free tier, or a local mongod: mongodb://127.0.0.1:27017/sheltersim
JWT_SECRET=    # openssl rand -hex 32
```
