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
| `UNAUTHENTICATED`              | 401  | (P2) missing/invalid/expired auth cookie on a protected route          |
| `EMAIL_TAKEN`                  | 409  | (P2) `POST /api/auth/register` with an email already in use            |
| `INVALID_CREDENTIALS`          | 401  | (P2) `POST /api/auth/login` with a wrong password OR an unknown email — same message either way |
| `NOT_FOUND`                    | 404  | (P2) a design/simulation id that doesn't exist, or belongs to another user (ownership misses are 404, never 403) |

`STATUS_BY_CODE` for the engine codes is reused verbatim from `apps/server/src/app.ts`.

**Notes**

1. CORS: every response carries `Access-Control-Allow-Origin: *`, `-Methods: GET,POST,OPTIONS`,
   `-Headers: Content-Type`; `OPTIONS /api/*` returns 204 (ported from `apps/server`).
2. `occupancyPresets` has no `@shelter/data` export -- `src/design/assemble.ts` reproduces the same
   hand-copied table as `apps/server/src/assemble.ts` (ids `familyLivestock`, `barrackPersonnel`,
   `smallHousehold`, `heatedOffice`).

## 7. Auth (P2)

Email+password. Passwords are hashed with `crypto.scrypt` and a random per-user salt
(`src/auth/password.ts`; stored as `"<saltHex>:<hashHex>"`, never returned). `@fastify/jwt` +
`@fastify/cookie` issue a 7-day JWT in a cookie named `token` — httpOnly, `SameSite=Lax`, `Secure`
only when `NODE_ENV=production`. Every route below reuses this same cookie via
`request.jwtVerify()` (`src/auth/authenticate.ts`); a missing/invalid cookie is `UNAUTHENTICATED`
(§6).

```ts
interface PublicUser {
  id: string;
  email: string;
  name: string;
} // never passwordHash
```

| Route | Auth | Body | 200/201 |
|---|---|---|---|
| `POST /api/auth/register` | – | `{email, password (min 8 chars), name}` | 201 `{user: PublicUser}`, sets the cookie. Duplicate email → 409 `EMAIL_TAKEN`. |
| `POST /api/auth/login` | – | `{email, password}` | 200 `{user: PublicUser}`, sets the cookie. Wrong password or unknown email → 401 `INVALID_CREDENTIALS` (identical message either way). |
| `POST /api/auth/logout` | – | – | 200 `{ok: true}`, clears the cookie. |
| `GET /api/auth/me` | ✓ | – | 200 `{user: PublicUser}`. No/invalid cookie → 401 `UNAUTHENTICATED`. |

## 8. Designs (P2)

`design` is a whole `ShelterDesign` (§3), validated with the **same** ajv schema as
`POST /api/simulate/preview` (`shelterDesignSchema()`, exported from `src/app.ts` for this reuse).
All routes require auth; a design id that doesn't exist or belongs to another user is 404
`NOT_FOUND` (never 403), for every route below.

```ts
interface DesignSummary {
  id: string;
  name: string;
  design: ShelterDesign;
  createdAt: string; // ISO
  updatedAt: string; // ISO
}
```

| Route | Body | 200/201 |
|---|---|---|
| `POST /api/designs` | `{name, design}` | 201 `DesignSummary` |
| `GET /api/designs` | – | 200 `DesignSummary[]`, newest (`updatedAt`) first |
| `GET /api/designs/:id` | – | 200 `DesignSummary` |
| `PUT /api/designs/:id` | `{name, design}` (whole replacement, same schema as POST) | 200 `DesignSummary` |
| `DELETE /api/designs/:id` | – | 204, empty body |

## 9. Simulations (P2)

`POST .../simulations` runs the design's **current** state through `fastPhysics`
(§5) and freezes it: `inputSnapshot` is a deep copy (`structuredClone`) of the design at that
moment, so editing the design afterward never changes a past simulation's stored snapshot,
`kpis`, or `result`.

```ts
interface SimulationSummary {
  id: string;
  designId: string;
  provider: string; // 'fast-physics'
  engineVersion: string; // packages/engine/package.json's version at run time
  requestHash: string; // canonicalRequestHash(assembled request)
  inputSnapshot: ShelterDesign; // frozen deep copy
  kpis: SimulationKpis;
  createdAt: string; // ISO
}
interface SimulationFull extends SimulationSummary {
  result: unknown; // resultToJson(SimulationResult), same shape as §4's PreviewResponse.result
}
```

| Route | Auth | 200/201 |
|---|---|---|
| `POST /api/designs/:id/simulations` | ✓ owner | 201 `SimulationFull`. Design not owned → 404 `NOT_FOUND`; engine/validation failures reuse §6's codes. |
| `GET /api/designs/:id/simulations` | ✓ owner | 200 `SimulationSummary[]` (no `result`), newest first. |
| `GET /api/simulations/:id` | ✓ owner | 200 `SimulationFull` (with `result`). Not owned → 404 `NOT_FOUND`. |

## 10. Planned routes (P3 — not implemented yet)

| Route | Auth | Task |
|---|---|---|
| `GET /api/locations/search?q=` (Open-Meteo geocoding) | – | P3 |

`env.ts`'s `MONGODB_URI`/`JWT_SECRET` were optional in P1; `src/index.ts` now requires both and
exits with a clear message if either is missing (§ condition 5, `db.ts` owns the mongoose
connect/disconnect lifecycle; P3's `weatherCache` collection uses the same default connection).
