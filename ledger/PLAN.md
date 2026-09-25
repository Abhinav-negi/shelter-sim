# ShelterSim Studio — architecture (shared source of truth)

Mental model: **Design → See → Adjust → Simulate → Understand → Compare → (future) Validate.**
The controls define the design, the 3D model shows it, the engine evaluates it, and the results explain it.

## Existing system (reused, frozen)
- `@shelter/engine`: `simulate(SimulationRequest)` is pure and synchronous, ~65 ms for a 1-day run at 300 s steps.
  The model is surface-based: `Building{azimuth, surfaces[{type,area,tilt,azimuth,construction:Layer[]}], windows}`.
  The engine applies `building.azimuth` itself (`engine/src/solve/assemble.ts:121`). Serialisers: `requestToJson`,
  `resultToJson`, `canonicalRequestHash`. Engine version comes from `packages/engine/package.json`.
- `@shelter/data`: 27 materials, 11 constructions, 6 glazings, 6 presets, 5 bundled TMY sites (leh, kargil, drass,
  nubra, jaisalmer). `weather/sources.ts` has URL builders and parsers for Open-Meteo and NASA POWER (keyless), and
  `weather/pipeline.ts` has `normaliseWeather`.
- `apps/server/src/assemble.ts` is the proven DesignInput→SimulationRequest pipeline: preset → site/weather → setSize →
  materials → WWR → glazing → shutters → occupancy → `skyModel:'isotropic'`.

## ShelterDesign (the one shelter representation)
The old `DesignInput`, with these changes:
```ts
location: { kind: 'preset'; id: string } | { kind: 'custom'; name: string; lat: number; lon: number; elevation: number }
azimuthDeg: number                                          // → Building.azimuth (0 = long side faces south)
wallConstruction | roofConstruction | floorConstruction:
  { materialId: string; thicknessM: number } | null         // null = keep the preset's multi-layer stack
// unchanged: date, presetId, lengthM, widthM, heightM, windowWwr{S,E,W,N}, glazingId, nightShutters, occupancyPresetId
```
There is no engine change and no roof type: the engine models a flat roof, so the 3D model shows a flat roof.

**Custom location:** fetch a full year of hourly weather once (the ground temperature needs the annual mean), then
`normaliseWeather`, then cache it in Mongo, then slice the chosen day. `standardMeridian = utcOffsetHours × 15`
(from Open-Meteo's `utc_offset_seconds`). `groundAlbedo` is 0.2, disclosed in the UI.

## Server (`apps/studio-server`, Fastify :4100)
Layers: `routes → services → models (Mongoose)`. Simulation goes through `providers/`.
```ts
interface SimulationProvider { id: string; run(req: SimulationRequest): Promise<{ kpis; result }> }
// fastPhysics = @shelter/engine. A future ANSYS provider adds a second implementation. No fake one now.
```
**Collections:** `users{email↑unique,name,passwordHash}` · `designs{ownerId,name,design,createdAt,updatedAt}` idx
`{ownerId,updatedAt:-1}` · `simulations{ownerId,designId,provider,engineVersion,requestHash,inputSnapshot,kpis,
result(inline ~250KB),createdAt}` idx `{designId,createdAt:-1}` · `weatherCache{source,lat,lon,year}↑unique`.

**Auth:** email+password, hashed with `crypto.scrypt` and a per-user salt. `@fastify/jwt` + `@fastify/cookie` issue a
7-day JWT in an httpOnly, SameSite=Lax cookie that is Secure in production. No OAuth or refresh tokens.

**API** (full shapes live in `apps/studio-server/API.md`):
| Route | Auth |
|---|---|
| `GET /api/health`, `GET /api/options` (ported + azimuth/thickness ranges) | – |
| `GET /api/locations/search?q=` (Open-Meteo geocoding) | – |
| `POST /api/auth/{register,login,logout}`, `GET /api/auth/me` | –/✓ |
| `GET,POST /api/designs` · `GET,PUT,DELETE /api/designs/:id` | ✓ owner |
| `POST /api/simulate/preview` (ShelterDesign → {kpis,result}; not stored) | – |
| `POST /api/designs/:id/simulations` (run + persist frozen snapshot) · `GET /api/designs/:id/simulations` · `GET /api/simulations/:id` | ✓ owner |

Errors are reused from the old server: `{code,message,field?}`, `VALIDATION_ERROR`, the engine `STATUS_BY_CODE` table,
and the 5 MB limit. Ownership misses return 404, not 403. Comparison is client-side, so there is no compare endpoint.

## Client (`apps/studio`, Vite :5273)
`UI → zustand design store (ShelterDesign) → api/ → server`. The viewer only *reads* the store.
Routes: `/` Landing · `/login` `/register` · `/app` Dashboard (Your shelters) · `/app/design/:id` (or `new`) Studio ·
`/app/compare?ids=` Compare. The `/app/*` routes are guarded.

**Studio layout:** controls on the left (Environment · Geometry · Materials · Openings · Orientation · Advanced), the
3D viewer in the centre, and results on the right or in a bottom drawer. The preview auto-runs with a debounce (~400 ms)
after edits. The **Save run** button persists it. Status text follows the real stages: Preparing → Running thermal model
→ Processing results.

**3D viewer (R3F + drei):** procedural geometry from ShelterDesign: L×W×H; walls as thick as their layer stack; window
openings per facade sized by WWR; a flat roof slab; a group rotated by azimuthDeg; a compass; the sun direction from
date + lat/lon at a chosen hour; a ground plane with shadows. OrbitControls (orbit, zoom, pan, clamped). **No picking,
gizmos or direct editing.** `frameloop="demand"`, geometry memoised, store selectors.

**Results:** indoor vs outdoor over 24 h (recharts); heat-flow pathways Q1–Q11 in daily kWh; engine KPIs only (dawn
temp, min/max, hours <0 °C and <5 °C, decrement factor, time lag, aux kWh/day, kerosene L/yr); a port of `explain.ts`
("what happened, why").

**Compare:** 2–4 designs, overlaid temperature curves, and a KPI table with deltas. No scores.

## Design system
Precise, calm, scientific. Warm off-white / near-black neutrals. One accent (a cold instrument blue). A thermal
diverging scale used **only** for temperature data. Geist for UI, Geist Mono for numbers and units. Hairline rules and
whitespace, not cards. **Banned:** glassmorphism, gradient blobs, purple/blue gradients, pill badges, heavy shadows,
fake stats/logos/testimonials, stock imagery, icon confetti, generic 3-column feature grids, decorative motion.
Light and dark themes via CSS variables.

**Landing:** a full-bleed live 3D shelter at dawn. "Design for the cold." / "Simulate your shelter before you build
it." / **Design a shelter →** · *Explore the technology*. Then 4 quiet stages: Design → Fast physics → Compare →
High-fidelity validation. Stage 4 is text only and states that validation is future work.

**States:** empty ("Start your first shelter" plus an action), loading (the real stages), and errors (what happened,
whether to retry; never a stack trace).
