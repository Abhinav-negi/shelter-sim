# ShelterSim Studio — Architecture (for agents)

Condensed map of the Studio product (`apps/studio` + `apps/studio-server`). The contract is
`apps/studio-server/API.md`; this file tells you where things live. Paths are relative to the repo root.
The frozen original app (`apps/server`, `apps/client`, `apps/web`, `packages/**`) is out of scope: never edit it.

## 1. System

```
Browser ── apps/studio (Vite + React 19 + TS + Tailwind v4 + R3F, :5273)
              │ fetch('/api/*', same-origin cookie)   dev: vite proxy → :4100
              ▼
          apps/studio-server (Fastify 5 + Mongoose + @fastify/jwt cookie, :4100)
              │ runtime imports                    │ HTTP (custom locations only)
              ▼                                    ▼
          @shelter/engine (simulate)          Open-Meteo archive → NASA POWER fallback
          @shelter/data (presets, TMY, catalogues)  Open-Meteo geocoding
              │
          MongoDB: users · designs · simulations · weatherCache
```

- The client never runs physics: only `import type` from `@shelter/engine`, and no `@shelter/data` import at all.
  Client API types come from `@shelter/studio-server` (`package.json` `"types"` → `src/design/types.ts`).
- `packages/optimise` is not used by Studio.

## 2. Server (`apps/studio-server/src`)

**Boot:** `index.ts` → `loadEnv()` (`env.ts`; `PORT`=4100, `HOST`=127.0.0.1, `MONGODB_URI`, `JWT_SECRET`,
`NODE_ENV`; loaded via `--env-file-if-exists=.env`) → exits if DB URI/secret missing → `buildApp()` (`app.ts`) →
`connectDb()` (`db.ts`) → listen.

**`app.ts buildApp`:** 5 MB body limit; one error handler mapping errors to codes (ajv → 400 `VALIDATION_ERROR`,
`CustomLocationUnavailableError` 422, `UpstreamUnavailableError` 502, `EngineError` via `STATUS_BY_CODE`,
`EmailTakenError` 409, `InvalidCredentialsError` 401, `NotFoundError` 404, 413, else 500); cookie + jwt plugins;
route plugins; `shelterDesignSchema()` (the ajv schema for `ShelterDesign`, reused by `designs/routes.ts`).

| Route | Auth | Handler → service → model |
|---|---|---|
| `GET /api/health` · `GET /api/options` | – | `app.ts`; options memoised in `options.ts buildOptions` |
| `POST /api/simulate/preview` | – | `app.ts` → `design/prepare.ts prepareRequest` → `design/assemble.ts assemble` → `providers fastPhysics.run` (not persisted) |
| `GET /api/locations/search?q=` | – | `locations/routes.ts` → `weather/geocode.ts` (Open-Meteo, ≤8 results) |
| `POST /api/auth/{register,login,logout}` · `GET /api/auth/me` | me only | `auth/routes.ts` → `auth/service.ts` → `User` |
| `GET/POST /api/designs` · `GET/PUT/DELETE /api/designs/:id` | owner | `designs/routes.ts` → `designs/service.ts` → `Design` (not owned → 404) |
| `POST/GET /api/designs/:id/simulations` · `GET /api/simulations/:id` | owner | `simulations/routes.ts` → `simulations/service.ts` → `Simulation` |

**Auth:** scrypt + 16-byte salt (`auth/password.ts`), `timingSafeEqual`; unknown emails hash against `DUMMY_HASH`
(no timing enumeration). JWT `{sub:userId}`, 7 d, in cookie `token` (`httpOnly`, `sameSite:lax`, `secure` in
production). Guard: `auth/authenticate.ts` (preHandler hook on designs/simulations routes).

**Models:** `User` (unique email) · `Design {ownerId, name, design: ShelterDesign}` index `{ownerId, updatedAt:-1}` ·
`Simulation {ownerId, designId, provider, engineVersion, requestHash, inputSnapshot, kpis, weatherProvenance?,
result}` index `{designId, createdAt:-1}`, no `updatedAt` · `weatherCache` unique `{source, lat, lon, year}`.

**Provider seam:** `providers/index.ts` `SimulationProvider {id, run}`; one implementation `fast-physics` wrapping
`@shelter/engine simulate`. Routes/services call the provider, never `simulate`.

**Saved run:** `simulations/service.ts runSimulation` clones the design's current doc into `inputSnapshot`, runs
it, stores snapshot + `requestHash` + kpis + result + engine version. Editing the design later never changes it.

**Weather (custom locations):** `design/prepare.ts` resolves weather *before* `assemble` (which is sync) via
`weather/resolve.ts resolveCustomWeather`: cache read (lat/lon rounded to 2 dp, year 2023; always-miss when Mongo
isn't connected) → Open-Meteo archive → NASA POWER fallback → 502 if both fail (no silent fallback to a preset) →
upsert cache. Preset locations use bundled TMY from `@shelter/data`.

**`design/assemble.ts assemble`** (copy of the frozen server's, extended) — `ShelterDesign` → `SimulationRequest`:
1. base request from the preset; 2. weather + site from `design.location`; 2b. `building.azimuth = azimuthDeg`;
3. shape: box → `setSize` (byte-identical to the frozen app when 1 storey, `test/parity.test.ts`); cylinder → 12
   wall sectors + roof + floor (`cylinderGeometry`); dome → 3 bands × 12 sectors, tilt ≥ 60° = wall else roof
   (`domeGeometry`); `storeys: 2` adds one rock slab storage element (`addIntermediateSlab`, 0.15 m, 8 W/m²K —
   documented assumptions, API.md §3c);
4. construction overrides (only when non-null); 5. WWR per quadrant (±45°); 6–8. glazing, night shutters,
   occupancy (`OCCUPANCY_PRESETS` table); 9. options: 1 day, `skyModel: 'isotropic'` (load-bearing, keep it).

## 3. `ShelterDesign` (`apps/studio-server/src/design/types.ts`)

`location` (preset id | custom name/lat/lon/elevation) · `date` · `presetId` · `lengthM` (diameter for
cylinder/dome) · `widthM` (box only) · `heightM` (per storey; unused for dome) · `azimuthDeg` (0 = south) ·
`wall/roof/floorConstruction` (null = preset stack) · `windowWwr {S,E,W,N}` · `glazingId` · `nightShutters` ·
`occupancyPresetId` · **`shape?`** `box|cylinder|dome` (default box) · **`storeys?`** `1|2` (default 1; dome + 2 is
rejected). Old saved designs without `shape`/`storeys` load as a 1-storey box (client `design/store.ts loadDesign`,
`viewer/geometry.ts`).

## 4. Client (`apps/studio/src`)

- **Routes** (`App.tsx`): `/` Landing · `/login` · `/register` · `/dev/viewer` · behind `routes/RequireAuth.tsx`
  (`getMe()` → redirect to `/login`): `/app` Dashboard · `/app/design/:id` Studio · `/app/compare` Compare.
- **API** (`api/*.ts`): one `request<T>()` in `client.ts` normalising every failure to `ApiError{code,message,field?}`;
  thin wrappers per domain (auth, designs, simulate, locations, options, health).
- **Design store** (`design/store.ts useShelterDesign`, zustand + `subscribeWithSelector`): the single `ShelterDesign`
  + `dirty`, setters grouped by panel section. `setShape('dome')` forces 1 storey.
- **Edit → preview:** controls write to the store → `routes/Studio.tsx` → `controls/useDebouncedRequest.ts`
  (400 ms, stale responses discarded) → `POST /simulate/preview` → `results/ResultsPanel.tsx` (insights, charts,
  `Kpis.tsx`).
- **Viewer:** `viewer/geometry.ts buildSceneGeometry` (pure; mirrors the server's facet constants by hand) →
  `viewer/Building.tsx` → `viewer/ShelterViewer.tsx` (lights from `viewer/solar.ts`, framing, compass, sun).
- **Select-to-edit** (UI-only, never saved or sent): `design/selection.ts` (`hoveredPart`/`selectedPart`) ·
  `design/partMapping.ts` (part → section/field) · `viewer/usePartInteraction.ts` · `viewer/PartPopover.tsx`
  (writes through the same store setters) · `components/ui/FieldRow.tsx` (scroll + flash on match).
- **Typed entry:** `components/ui/NumberInput.tsx` (draft string, commit on Enter/blur, clamp + round, Esc reverts).
- **Compare:** `routes/Compare.tsx` + `routes/compare/kpiTable.ts` (deltas vs the first design, no rankings).
- **Landing:** `routes/Landing.tsx` — hero with auto-rotating viewer; its chart is a real preview call.

## 5. Commands and ports

| What | Command |
|---|---|
| Setup | `npm run setup` |
| Run | `npm run dev:studio` (server :4100 needs `apps/studio-server/.env`; client :5273 proxies `/api`) |
| Tests | `npm test -w @shelter/studio-server` (mongodb-memory-server) · `npm test -w @shelter/studio` |
| Build | `npm run build -w @shelter/studio` |
| E2E | `timeout 180 env PLAYWRIGHT_CORE=<path> node apps/studio/e2e/flow.mjs` (scratch server :4109, preview :5281) |
| Frozen guard | `git diff --stat studio/main -- apps/server apps/client apps/web packages` → empty (engine tests rewrite `packages/engine/test/output/validation-numbers.csv`; `git checkout` it first) |

## 6. Where to change what

| Change | Files |
|---|---|
| New design field | `design/types.ts`, `app.ts` schema, `design/assemble.ts`, `options.ts` (defaults/ranges), client `design/store.ts`, a `controls/*Section.tsx`, `viewer/geometry.ts` if visual, API.md §3 first |
| New shape | the above + `assemble.ts` `*Geometry`, client `viewer/geometry.ts` + `Building.tsx`, `controls/GeometrySection.tsx` |
| New API route | `<domain>/routes.ts` (+ service/model), register in `app.ts`, API.md first |
| KPI shown | `results/Kpis.tsx`, `routes/compare/kpiTable.ts` (engine KPIs themselves are frozen) |
| Weather source | `weather/resolve.ts` (fallback order) |
| Occupancy preset | `design/assemble.ts OCCUPANCY_PRESETS` |
| Cookie/auth policy | `app.ts` jwt options, `auth/routes.ts` cookie flags |
