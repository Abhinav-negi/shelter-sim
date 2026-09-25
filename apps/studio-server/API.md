# API.md — `apps/studio-server` contract (P1)

Fastify server, port **4100** (env `PORT`), all routes under prefix **`/api`**. This file fixes the
contract every other Studio task (P2, P3, the client) builds against — keep it honest against the
code. `apps/studio-server` is a fresh workspace, independent of `apps/server` (S1, frozen); the two
do not share runtime code, only conventions.

`ShelterDesign` (`src/design/types.ts`) is the one shelter representation. The client imports
**only types** from `@shelter/engine` and from this package's `"types"` field
(`src/design/types.ts`) — never `simulate()`, never `@shelter/data` (uses `node:fs`, not
browser-safe).

## 1. `GET /api/health`

```ts
interface HealthResponse {
  ok: true;
}
```

200, always. No auth, no body required.

## 2. `GET /api/options`

```ts
interface LocationOption {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  elevation: number;
} // m
interface PresetOption {
  id: string;
  name: string;
  description: string;
  locationId: string;
  thicknessM: { wall: number; roof: number; floor: number }; // m, total of the preset's own layer stack
}
interface MaterialOption {
  id: string;
  name: string;
  category: 'structural' | 'insulation' | 'finish' | 'storage';
  conductivity: number;
  defaultThicknessM: number; // m, starting thickness when picked for a surface
  blurb?: string;
} // conductivity W/(m*K)
interface GlazingOption {
  id: string;
  name: string;
  U: number;
  SHGC: number;
  blurb?: string;
} // U: W/(m^2*K)
interface OccupancyPresetOption {
  id: string;
  name: string;
  blurb: string;
}
interface Range {
  min: number;
  max: number;
  step?: number;
}

interface Options {
  locations: LocationOption[]; // @shelter/data TMY_LOCATIONS -- valid `location.id` for kind:'preset'
  presets: PresetOption[]; // @shelter/data PRESETS
  materials: MaterialOption[]; // @shelter/data MATERIALS -- valid materialId for wall/roof/floorConstruction
  glazings: GlazingOption[]; // @shelter/data GLAZING
  occupancyPresets: OccupancyPresetOption[]; // NOT in @shelter/data -- see §6 note 2
  defaults: ShelterDesign; // the traditionalLadakhiByre (Leh) preset, expressed as ShelterDesign
  ranges: {
    azimuthDeg: Range; // -180..180
    lengthM: Range; // 2..30, step 0.5
    widthM: Range; // 2..30, step 0.5
    heightM: Range; // 2..6, step 0.1
    thicknessM: Range; // 0.02..1.0 -- wall/roof/floorConstruction.thicknessM
    windowWwr: Range; // 0..0.9, step 0.05
  };
}
```

## 3. `ShelterDesign`

```ts
type DesignLocation =
  | { kind: 'preset'; id: string } // TMY_LOCATIONS id: 'leh' | 'kargil' | 'drass' | 'nubra' | 'jaisalmer'
  | { kind: 'custom'; name: string; lat: number; lon: number; elevation: number }; // (P3)

interface SurfaceConstruction {
  materialId: string; // @shelter/data MATERIALS id
  thicknessM: number; // 0.02..1.0 -- single layer at EXACTLY this thickness
}

interface ShelterDesign {
  location: DesignLocation;
  date: string; // ISO 'YYYY-MM-DD', reference year 2023 (isoDateToDayOfYear)
  presetId: string; // shelter-type card id, e.g. 'traditionalLadakhiByre'
  lengthM: number; // 2-30 -- S/N wall run
  widthM: number; // 2-30 -- E/W wall run
  heightM: number; // 2-6
  azimuthDeg: number; // -180..180, 0 = long side faces south -> Building.azimuth
  wallConstruction: SurfaceConstruction | null; // null = keep the preset's own (multi-layer) construction
  roofConstruction: SurfaceConstruction | null; // same rule
  floorConstruction: SurfaceConstruction | null; // same rule
  windowWwr: { S: number; E: number; W: number; N: number }; // 0-0.9, window-to-wall-area ratio per orientation
  glazingId: string; // @shelter/data GLAZING id
  nightShutters: boolean; // closed 20:00-06:00 when true, adds shutterResistance=0.4 m^2*K/W
  occupancyPresetId: string; // server-side table id -- see §6 note 2
}
```

`ShelterDesign` is `apps/server`'s `DesignInput` (S1) with: `locationId` replaced by `location`
(preset | custom), `azimuthDeg` added (new -- maps to `Building.azimuth`), and the three
`*MaterialId` fields replaced by `SurfaceConstruction | null` (the thickness is now given directly,
not looked up from a category default).

## 4. `POST /api/simulate/preview`

Body: `ShelterDesign` (§3). Not persisted (P2's `POST /api/designs/:id/simulations` is the
persisted version).

### Server assembly (`src/design/assemble.ts`)

Same nine steps as `apps/server/src/assemble.ts` (`apps/server/API.md` §4), with:

1. Weather + site resolve from `design.location`, not a bare `locationId`. `location.kind==='preset'`
   uses the bundled TMY exactly as before. `location.kind==='custom'` calls an injected
   `weatherFor(location)` hook (P3 implements the real one: Open-Meteo geocoding + a year of hourly
   weather + `normaliseWeather` + Mongo cache); P1 has no real implementation and the route 422s
   with `CUSTOM_LOCATION_UNAVAILABLE` (§6) when no `weatherFor` is wired up.
2. `building.azimuth = design.azimuthDeg` (new step -- the engine applies the rotation itself,
   `packages/engine/src/solve/assemble.ts:121`; per-surface `azimuth` stays relative to south,
   unrotated).
3. `wallConstruction`/`roofConstruction`/`floorConstruction`, when non-null, become a single
   construction layer at the design's own `thicknessM` (no category-default lookup, unlike
   `apps/server`'s `defaultThicknessM`).
4. `options = { ...DEFAULT_SIM_OPTIONS, simulationDays: 1, skyModel: 'isotropic' }` -- unchanged,
   load-bearing (see `apps/server/API.md` §4 step 9).

### Response 200

```ts
interface PreviewResponse {
  kpis: SimulationKpis; // @shelter/engine
  result: ResultJson; // resultToJson(simulate(request)) -- see apps/server/API.md §4 for the full shape
}
```

`ResultJson`'s shape (KPI keys, heat-flow pathway keys, units) is identical to `apps/server/API.md`
§4's `ResultJson`/`SimulationKpis` tables -- not repeated here, that file is the source of truth for
the engine-result wire shape shared by both servers.

## 5. `src/providers/` — the simulation seam

```ts
interface SimulationProvider {
  id: string;
  run(req: SimulationRequest): Promise<{ kpis: SimulationKpis; result: SimulationResult }>;
}
```

`fastPhysics` (`id: 'fast-physics'`) wraps `@shelter/engine`'s `simulate()`; routes call the
provider, never `simulate` directly. A future ANSYS/high-fidelity provider is a second
implementation of the same interface -- no fake provider exists today.

## 6. Errors

Every response, success or failure, is JSON. Failures are always:

```ts
interface ApiError {
  code: string;
  message: string;
  field?: string;
} // field only on VALIDATION_ERROR
```

| Code                          | HTTP | Source                                                                 |
| ------------------------------ | ---- | ----------------------------------------------------------------------- |
| `VALIDATION_ERROR`             | 400  | `ShelterDesign` itself malformed (bad type, out-of-range, unknown id) — `field` names the offending dotted key, e.g. `"wallConstruction.thicknessM"` |
| `CUSTOM_LOCATION_UNAVAILABLE`  | 422  | `location.kind==='custom'` and no `weatherFor` hook is wired up yet (P1; P3 closes this) |
| `INVALID_INPUT`                | 400  | engine: assembled `SimulationRequest` invalid                          |
| `GEOMETRY_INCONSISTENT`        | 400  | engine                                                                  |
| `WEATHER_INVALID`               | 422  | engine                                                                  |
| `UNKNOWN_MATERIAL`             | 422  | engine                                                                  |
| `UNKNOWN_GLAZING`              | 422  | engine                                                                  |
| `DATA_SCHEMA_MISMATCH`         | 422  | engine                                                                  |
| `SOLVER_DIVERGED`              | 500  | engine                                                                  |
| `SINGULAR_MATRIX`              | 500  | engine                                                                  |
| `PAYLOAD_TOO_LARGE`            | 413  | body over 5 MB                                                         |
| `INTERNAL_ERROR`               | 500  | anything unexpected                                                    |

`STATUS_BY_CODE` for the engine codes is reused verbatim from `apps/server/src/app.ts`.

**Notes**

1. CORS: every response carries `Access-Control-Allow-Origin: *`, `-Methods: GET,POST,OPTIONS`,
   `-Headers: Content-Type`; `OPTIONS /api/*` returns 204 (ported from `apps/server`).
2. `occupancyPresets` has no `@shelter/data` export -- `src/design/assemble.ts` reproduces the same
   hand-copied table as `apps/server/src/assemble.ts` (ids `familyLivestock`, `barrackPersonnel`,
   `smallHousehold`, `heatedOffice`).

## 7. Planned routes (P2, P3 — not implemented in P1)

| Route                                                              | Auth    | Task |
| -------------------------------------------------------------------- | ------- | ---- |
| `GET /api/locations/search?q=` (Open-Meteo geocoding)                | –       | P3   |
| `POST /api/auth/register` · `POST /api/auth/login` · `POST /api/auth/logout` · `GET /api/auth/me` | –/✓ | P2 |
| `GET /api/designs` · `POST /api/designs`                             | ✓ owner | P2   |
| `GET /api/designs/:id` · `PUT /api/designs/:id` · `DELETE /api/designs/:id` | ✓ owner | P2 |
| `POST /api/designs/:id/simulations` (run + persist frozen snapshot)  | ✓ owner | P2   |
| `GET /api/designs/:id/simulations` · `GET /api/simulations/:id`      | ✓ owner | P2   |

Auth: email+password, `crypto.scrypt` + per-user salt, `@fastify/jwt` + `@fastify/cookie` issue a
7-day JWT in an httpOnly, SameSite=Lax cookie (Secure in production). Ownership misses return 404,
not 403. `env.ts`'s `MONGODB_URI`/`JWT_SECRET` are optional in P1 and become required at startup
once P2 lands.
