# API.md — `apps/server` contract (S1)

Fastify server, port **4000**, all routes under prefix **`/api`**. Owns all simulation
(`@shelter/engine`, `@shelter/data`) and the weather/materials/preset catalogues. The Vite
client (`apps/client`) imports **only types** from `@shelter/engine` — never `simulate()`,
never `@shelter/data` (that package uses `node:fs` and is not browser-safe). This file is the
only thing shared between the two teams; keep both sides honest against it.

## 1. `GET /api/health`

```ts
interface HealthResponse { ok: true }
```
200, always. No auth, no body required.

## 2. `GET /api/options`

Returns every catalogue the wizard needs to render cards, plus the default design. One flat
`materials` list serves wall/roof/floor dropdowns — see §5 note 2 for why there is no separate
`wallConstructions`/`roofConstructions` split.

```ts
interface LocationOption { id: string; name: string; latitude: number; longitude: number; elevation: number } // m
interface PresetOption { id: string; name: string; description: string; locationId: string }
interface MaterialOption { id: string; name: string; category: 'structural'|'insulation'|'finish'|'storage'; conductivity: number; blurb?: string } // conductivity W/(m*K), for a UI badge
interface GlazingOption { id: string; name: string; U: number; SHGC: number; blurb?: string } // U: W/(m^2*K)
interface OccupancyPresetOption { id: string; name: string; blurb: string }

interface Options {
  locations: LocationOption[];       // @shelter/data TMY_LOCATIONS
  presets: PresetOption[];           // @shelter/data PRESETS (id/name/description/locationId)
  materials: MaterialOption[];       // @shelter/data MATERIALS — used for wallMaterialId, roofMaterialId, floorMaterialId
  glazings: GlazingOption[];         // @shelter/data GLAZING
  occupancyPresets: OccupancyPresetOption[]; // NOT in @shelter/data — see §5 note 3
  defaults: DesignInput;             // the traditionalLadakhiByre (Leh) preset, expressed as DesignInput
}
```

## 3. `DesignInput`

The small, flat, non-expert body `SimpleForm.tsx`'s ten controls actually edit. Every field
below is one `requestOps.ts` setter's input — nothing here has no home in that file.

```ts
interface DesignInput {
  locationId: string;        // TMY_LOCATIONS id: 'leh' | 'kargil' | 'drass' | 'nubra' | 'jaisalmer'
  date: string;               // ISO 'YYYY-MM-DD', reference year 2023 (isoDateToDayOfYear)
  presetId: string;           // shelter-type card id, e.g. 'traditionalLadakhiByre'
  lengthM: number;            // 2–30, step 0.5 — S/N wall run
  widthM: number;             // 2–30, step 0.5 — E/W wall run
  heightM: number;            // 2–6, step 0.1
  wallMaterialId: string | null;  // @shelter/data MATERIALS id → single layer; null = keep the preset's own (multi-layer) construction
  roofMaterialId: string | null;  // same rule
  floorMaterialId: string | null; // same rule
  windowWwr: { S: number; E: number; W: number; N: number }; // 0–0.9, step 0.05 (window-to-wall-area ratio per orientation)
  glazingId: string;          // @shelter/data GLAZING id
  nightShutters: boolean;     // closed 20:00–06:00 when true, adds shutterResistance=0.4 m^2*K/W
  occupancyPresetId: string;  // server-side table id — see §5 note 3
}
```

Not included (Advanced-panel territory, per `SimpleForm.tsx`'s own header comment): raw ACH,
`thermalBridgeFactor`, emissivity/absorptivity overrides, node counts, solver/`SimOptions`
settings, ground albedo, sky model, per-layer thickness (the stack editor), building azimuth,
CSV weather upload, `simulationDays` (server fixes this at 1).

## 4. `POST /api/simulate`

Body: `DesignInput` (§3).

### Server assembly

In order, mirroring `apps/web/components/inputs/requestOps.ts` + `resolveInitialState.ts`:

1. Resolve `presetId` against `@shelter/data` `PRESETS` (`presetById`) the way
   `resolveInitialState.resolvePreset` does: fill `materials`/`glazings` records from
   `materialById`/`glazingById` for every id the preset's `request.building` references. This
   gives the full (possibly multi-layer) starting `SimulationRequest`.
2. **Weather**: `weather = tmyById(locationId)` — **`locationId` from `DesignInput`, not the
   preset's own `locationId`**. This is the fix for the current bug where changing location in
   the UI never changed the weather; then slice to the chosen day with
   `sliceWeatherToDay(full, isoDateToDayOfYear(date), 1)`. `site` is rebuilt for `locationId`
   too (lat/long/elevation from `TMY_LOCATIONS`, `standardMeridian: 82.5`, `groundAlbedo` from
   `groundAlbedoById(locationId)`, `groundTempMeanAnnual`: Leh's literal 279.15 K if
   `locationId==='leh'`, else the mean of that location's own `tmyById(locationId).T_amb` —
   `presets.ts`'s own fallback rule).
3. `setSize(request, { lengthM, widthM, heightM })` — resizes all wall/roof/floor surfaces,
   re-applies existing WWR per orientation.
4. `setWallMaterial` / `setRoofMaterial` / `setFloorMaterial` with the three `*MaterialId`
   fields, **only when the field is non-null** (null keeps the preset's multi-layer
   construction untouched — `Options.defaults` sends all three as null) — each replaces that surface type's construction with **one layer** of the chosen
   material at `defaultThicknessM(materialId, category)`.
5. `setWwr(request, o, windowWwr[o])` for each of S/E/W/N.
6. `setGlazingType(request, glazingId)`.
7. `setNightShutters(request, nightShutters)`.
8. `setOccupancyPreset(request, occupancyPresetId)` — sets `internalGainsSchedule`, `auxHeating`,
   `hasUnventedCombustion` from the occupancy table (§5 note 3).
9. `options = { ...DEFAULT_SIM_OPTIONS, simulationDays: 1, skyModel: 'isotropic' }` — the
   `isotropic` override is load-bearing: `presets.ts`'s own header documents an unclamped-`Rb`
   engine bug that makes every Ladakh preset diverge under the engine's default `'hdkr'` model.
10. Call `simulate(request)`.

### Response 200

```ts
interface SimulateResponse {
  input: DesignInput;
  kpis: SimulationKpis;
  result: ResultJson; // resultToJson(simulate(request)) — see below
}
```

`resultToJson` is a structural mirror of `SimulationResult` with every `Float64Array` turned
into a plain `number[]` (same field names, same nesting, same lengths, no unit change):

```ts
interface ResultJson {
  meta: { nodeCount: number; timesteps: number; wallClockMs: number; spinUpDaysUsed: number;
          energyBalanceResidual: number; annualisationMethod: string; warnings: string[] };
  time: number[];                        // seconds from period start, one per timestep
  temperatures: {
    indoorAir: number[]; ambient: number[]; sky: number[]; meanRadiant: number[]; ground: number[]; // Kelvin
    surfaces: Record<string, { exterior: number[]; interior: number[] }>; // Kelvin, keyed by Surface.id
  };
  solar: {
    incidentBySurface: Record<string, number[]>;  // W/m^2, keyed by Surface.id
    absorbedOpaque: number[]; transmittedGlazed: number[];               // W
    dailyTotalKWh: { opaque: number; glazed: number; bySurface: Record<string, number> };
  };
  heatFlows: HeatFlowsJson; // see table below — all W except deltaT (K) and dailyTotalsKWh (kWh)
  kpis: SimulationKpis;
}
```

**Charting note**: plot indoor vs ambient from `temperatures.indoorAir`/`temperatures.ambient`
against `time` (seconds; divide by 3600 for hours). Solar by surface: `solar.incidentBySurface`.
Heat flows by pathway: `heatFlows.<key>`, all same length as `time`.

**Heat-flow pathway keys** (`heatFlows`, all `number[]`, Watts, one value per timestep; sign:
positive = heat entering the indoor air node):

| Key | Meaning |
|---|---|
| `Q1_solarOpaque` | Solar absorbed on opaque exterior surfaces |
| `Q2_solarGlazed` | Solar transmitted through glazing |
| `Q3_extConvection` | Exterior surface ↔ outdoor air convection |
| `Q4_skyRadiation` | Longwave, exterior surface ↔ sky (usually negative) |
| `Q5_envelopeConduction` | Conduction through opaque envelope (internal) |
| `Q6_intConvection` | Interior surface ↔ indoor air convection (internal) |
| `Q7_interiorLongwave` | Longwave between interior surfaces (internal) |
| `Q8_windowConduction` | Conduction through glazing |
| `Q9_infiltration` | Infiltration / ventilation |
| `Q10_ground` | Conduction to ground through floor |
| `Q11_internalGains` | Internal gains (people, stove, livestock) |
| `Qaux` | Auxiliary heating actually delivered |
| `storageRate` | Rate of change of energy stored in the fabric |
| `deltaT` | `indoorAir - ambient`, **Kelvin-degrees**, not Watts |
| `dailyTotalsKWh` | `Record<pathwayName, number>` — period totals, **kWh**, feeds a Sankey |

**KPI keys** (`kpis: SimulationKpis`):

| Key | Unit | Meaning |
|---|---|---|
| `minIndoorTemp` / `maxIndoorTemp` / `meanIndoorTemp` | K | over the reported period |
| `tempAt0600` | K | pre-dawn minimum, final simulated day |
| `tempAt0600PerDay` | K[] (optional) | one value per simulated day |
| `hoursInComfort` / `hoursBelow5C` / `hoursBelowFreezing` | h | |
| `peakToPeakSwing` | K | |
| `decrementFactor` | ratio | indoor swing / outdoor swing, lower is better |
| `timeLagHours` | h | outdoor peak → indoor peak |
| `auxEnergyKWhPerDay` | kWh/day | |
| `keroseneEquivalentLitresPerYear` | L/yr | |
| `co2EquivalentKgPerYear` | kg/yr | |
| `costPerYearINR` | INR/yr | |
| `condensationRiskHours` | h \| null | `null` when the weather series has no RH |

Temperatures throughout `result` are **Kelvin** (subtract 273.15 for °C); `DesignInput` itself
carries no temperature fields, so the client never converts.

## 4a. `POST /api/assemble`

Body: `DesignInput` (§3). Runs the same "Server assembly" steps as `POST /api/simulate` (§4) but
does **not** call `simulate()` — responds `requestToJson(assemble(input))` (from
`apps/server/src/assemble.ts`), i.e. the exact wire-JSON `SimulationRequest` `/api/simulate`
would run. Same body validation/errors as `/api/simulate` (`VALIDATION_ERROR` on bad `DesignInput`
shape).

## 4b. `POST /api/simulate/raw`

Body: a full engine `SimulationRequest` in wire JSON — the shape `requestToJson` produces (e.g.
`/api/assemble`'s own response). Parsed with `requestFromJson`; a malformed/incomplete body 400s
as `{code:'INVALID_INPUT', message, field?}` (`field` is the offending path, e.g. `"weather"`,
when `requestFromJson` reports one — ported from the old `apps/web/app/api/simulate/route.ts`'s
`parseRequestBody`). Engine errors from `simulate()` use the same `STATUS_BY_CODE` mapping as
`/api/simulate` (§5). Response 200: `{kpis, result: resultToJson(result)}` — same as
`SimulateResponse` (§4) minus `input`.

## CORS / LAN

Every response carries `Access-Control-Allow-Origin: *`, `-Methods: GET,POST,OPTIONS`,
`-Headers: Content-Type`; `OPTIONS /api/*` returns 204. `npm run dev:lan` (root `package.json`)
runs the server with `HOST=0.0.0.0` and the Vite client with `--host`, so both are reachable from
other devices on the LAN — plain `npm run dev` stays bound to `127.0.0.1`.

## 5. Errors

Every response, success or failure, is JSON. Failures are always:

```ts
interface ApiError { code: string; message: string; field?: string } // field only on VALIDATION_ERROR
```

| Code | HTTP | Source |
|---|---|---|
| `VALIDATION_ERROR` | 400 | `DesignInput` itself is malformed (bad type, out-of-range, unknown id) — `field` names the offending key, e.g. `"lengthM"` |
| `INVALID_INPUT` | 400 | engine: assembled `SimulationRequest` invalid |
| `GEOMETRY_INCONSISTENT` | 400 | engine |
| `WEATHER_INVALID` | 422 | engine |
| `UNKNOWN_MATERIAL` | 422 | engine |
| `UNKNOWN_GLAZING` | 422 | engine |
| `DATA_SCHEMA_MISMATCH` | 422 | engine |
| `SOLVER_DIVERGED` | 500 | engine |
| `SINGULAR_MATRIX` | 500 | engine |
| `PAYLOAD_TOO_LARGE` | 413 | body over 5 MB |
| `INTERNAL_ERROR` | 500 | anything unexpected |

(`STATUS_BY_CODE` for the engine codes is reused verbatim from
`apps/web/app/api/simulate/route.ts`; `VALIDATION_ERROR` is new, for `DesignInput`-shape
problems caught before the request is even assembled — request-level `EngineError`s from step 1
onward use their own code from the table above, no `field`.)

**Notes**

1. Every field in `DesignInput` maps to one existing `requestOps.ts` function; nothing here
   requires new physics.
2. `@shelter/data`'s `CONSTRUCTIONS` (multi-layer named wall/roof/floor assemblies) has **no**
   `requestOps` setter — `SimpleForm.tsx`'s wall/roof/floor dropdowns bind the *same* flat
   `materials` array to all three selects and always write a single-layer construction
   (`setWallMaterial`/`setRoofMaterial`/`setFloorMaterial`). `Options.materials` mirrors that:
   one list, no wall/roof/floor split, because the data has none either.
3. `occupancyPresets` has no `@shelter/data` export at all — it lives only in
   `apps/web/components/inputs/catalog.ts`'s hand-copied `OCCUPANCY_PRESETS` table. The server
   must reproduce that same table (ids `familyLivestock`, `barrackPersonnel`, `smallHousehold`,
   `heatedOffice`) rather than import it, since `apps/web` is off-limits and `@shelter/data` has
   no occupancy concept.
