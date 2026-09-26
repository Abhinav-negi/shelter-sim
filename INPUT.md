# INPUT.md — calling the ShelterSim backend

For anyone who has never seen this codebase and wants to POST a design and get back an
hour-by-hour thermal simulation of a shelter in Ladakh (or elsewhere). You should not need to
read any source file after this one — every example below was run against the live server while
writing this doc (see "Verified" notes).

## 1. What this does

`apps/server` is a Fastify HTTP API that wraps `@shelter/engine`, a finite-difference thermal
simulator, and `@shelter/data`, a catalogue of Ladakh materials/weather/building presets. Send it
a building description (either a simple 13-field form, or a full physics-engine request), get
back hour-by-hour indoor/outdoor temperatures, solar gain, heat-flow pathways, and summary KPIs
(minimum night temperature, hours below freezing, heating energy needed, etc).

**Base URLs**

| Where                                    | URL                                                                                                                                                                                                  |
| ---------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Local (same machine)                     | `http://127.0.0.1:4000`                                                                                                                                                                              |
| LAN (another device on the same network) | host runs `npm run dev:lan`; teammates use `http://<host-LAN-IP>:4000`. Find the host's IP with `hostname -I` (Linux) or `ipconfig` (Windows), then use whichever address is on your shared network. |

CORS is wide open (`Access-Control-Allow-Origin: *`) — browser JS can call this API directly from
any origin, no proxy needed.

## 2. Endpoints

| Method | Path                | Body                                            | Returns                                                                                                        |
| ------ | ------------------- | ----------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| GET    | `/api/health`       | —                                               | `{ ok: true }`                                                                                                 |
| GET    | `/api/options`      | —                                               | Catalogues (locations, presets, materials, glazings, occupancy presets) + a ready-to-use default `DesignInput` |
| POST   | `/api/simulate`     | `DesignInput` (simple form, §3)                 | `{ input, kpis, result }` — full simulation                                                                    |
| POST   | `/api/assemble`     | `DesignInput`                                   | The full engine `SimulationRequest` that `/api/simulate` would have run (wire JSON) — does not simulate        |
| POST   | `/api/simulate/raw` | Full engine `SimulationRequest` (wire JSON, §5) | `{ kpis, result }` — same as `/api/simulate` minus `input`                                                     |

Verified live: all five return the documented shape (`curl -s localhost:4000/api/health` →
`{"ok":true}`; `/api/options` → 200, 11386 bytes).

## 3. Level 1 — Simple design input (`POST /api/simulate`)

Send a `DesignInput`: 13 fields, no physics knowledge required. The server fills in the rest
(construction layers, weather, solver settings) from its own catalogues.

| Field               | Type               | Range / allowed values                                                        | Meaning                                                                                                                   |
| ------------------- | ------------------ | ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `locationId`        | string             | `leh` \| `kargil` \| `drass` \| `nubra` \| `jaisalmer`                        | Which bundled weather/site to use                                                                                         |
| `date`              | string             | ISO `YYYY-MM-DD`, reference year 2023                                         | Day to simulate (1 day)                                                                                                   |
| `presetId`          | string             | see preset table below                                                        | Starting shelter design (walls/roof/windows)                                                                              |
| `lengthM`           | number             | 2–30, step 0.5                                                                | Building footprint, S/N wall run, metres                                                                                  |
| `widthM`            | number             | 2–30, step 0.5                                                                | Building footprint, E/W wall run, metres                                                                                  |
| `heightM`           | number             | 2–6, step 0.1                                                                 | Wall height, metres                                                                                                       |
| `wallMaterialId`    | string \| `null`   | a material id, or `null`                                                      | `null` = keep the preset's own (possibly multi-layer) wall; a material id replaces it with **one layer** of that material |
| `roofMaterialId`    | string \| `null`   | same rule, roof                                                               |
| `floorMaterialId`   | string \| `null`   | same rule, floor                                                              |
| `windowWwr`         | object `{S,E,W,N}` | each 0–0.9, step 0.05                                                         | Window-to-wall-area ratio per orientation (fraction of that wall's area that is glazed)                                   |
| `glazingId`         | string             | see glazing table below                                                       | Window glass type                                                                                                         |
| `nightShutters`     | boolean            | —                                                                             | If true, windows get an insulating shutter closed 20:00–06:00 (adds 0.4 m²·K/W resistance)                                |
| `occupancyPresetId` | string             | `familyLivestock` \| `barrackPersonnel` \| `smallHousehold` \| `heatedOffice` | Who/what is inside — sets internal heat gains and whether there's a stove/heater                                          |

**Locations** (`GET /api/options` → `locations`, live-verified):

| id        | name                  | lat     | lon     | elevation (m) |
| --------- | --------------------- | ------- | ------- | ------------- |
| leh       | Leh                   | 34.15   | 77.58   | 3500          |
| kargil    | Kargil                | 34.5539 | 76.1349 | 2676          |
| drass     | Drass                 | 34.4239 | 75.7666 | 3230          |
| nubra     | Nubra Valley (Diskit) | 34.5443 | 77.5584 | 3144          |
| jaisalmer | Jaisalmer             | 26.9157 | 70.9083 | 225           |

**Presets** (`presets`, live-verified — one line each, see `/api/options` for full descriptions):

| id                            | locationId | design                                                         |
| ----------------------------- | ---------- | -------------------------------------------------------------- |
| `traditionalLadakhiByre`      | leh        | Rammed-earth walls, mud/poplar roof, livestock byre below      |
| `armyBroBarrack`              | leh        | Bare CGI sheet walls/roof, no insulation                       |
| `modernRccNoInsulation`       | leh        | RCC walls/roof/floor, double glazing, no insulation            |
| `geresTrombeRetrofit`         | leh        | Traditional house + black-painted Trombe solar wall            |
| `optimisedPassivePlaceholder` | leh        | Insulated rammed-earth + argon low-E glazing + night shutter   |
| `jaisalmerHotDryContrast`     | jaisalmer  | Stone walls, whitewash, small shaded windows — hot-dry climate |

**Materials** (`materials`, id → conductivity `k` W/(m·K), live-verified), grouped by `category`:

| structural                 | insulation         | finish               | storage               |
| -------------------------- | ------------------ | -------------------- | --------------------- |
| mudBrickAdobe (0.75)       | eps (0.036)        | mudPlaster (0.75)    | water (0.6)           |
| rammedEarth (1.0)          | xps (0.033)        | cementPlaster (0.72) | gravelSoilFill (1.4)  |
| stoneMasonryGranite (2.8)  | puf (0.025)        | cgiBright (50)       | pcmParaffinRT25 (0.2) |
| firedClayBrick (0.72)      | glassWool (0.04)   | whitewashLime (0.7)  |                       |
| denseConcrete (1.75)       | rockWool (0.038)   | whitePaint (0.2)     |                       |
| rcc (2.1)                  | strawBale (0.06)   | blackPaint (0.2)     |                       |
| aacBlock (0.16)            | sheepWool (0.04)   |                      |                       |
| timberPoplarWillow (0.14)  | airGap25mm (0.139) |                      |                       |
| compressedEarthBlock (0.9) |                    |                      |                       |
| steelCGI (50)              |                    |                      |                       |

**Glazings** (`glazings`, U = W/(m²·K), live-verified):

| id                        | U    | SHGC |
| ------------------------- | ---- | ---- |
| singleGlazing             | 5.8  | 0.86 |
| doubleAirFilled           | 2.8  | 0.76 |
| doubleArgonLowE           | 1.6  | 0.6  |
| tripleGlazing             | 0.9  | 0.5  |
| polycarbonateTwinWall     | 3.0  | 0.7  |
| singleGlazingNightShutter | 1.75 | 0.86 |

**Occupancy presets** (`occupancyPresets`, live-verified):

| id                 | meaning                                                      |
| ------------------ | ------------------------------------------------------------ |
| `familyLivestock`  | Family of two + 3 animals stabled below, no auxiliary heater |
| `barrackPersonnel` | Two personnel on duty, morning/evening activity              |
| `smallHousehold`   | One person home most of the day, no auxiliary heater         |
| `heatedOffice`     | Staffed all day, electric heater keeps room above 15 °C      |

**Full example body** — this is exactly `GET /api/options` → `defaults` (Leh, traditional byre
preset), verified against the live server:

```json
{
  "locationId": "leh",
  "date": "2023-01-15",
  "presetId": "traditionalLadakhiByre",
  "lengthM": 5,
  "widthM": 5,
  "heightM": 2.6,
  "wallMaterialId": null,
  "roofMaterialId": null,
  "floorMaterialId": null,
  "windowWwr": { "S": 0.032, "E": 0, "W": 0, "N": 0 },
  "glazingId": "singleGlazing",
  "nightShutters": false,
  "occupancyPresetId": "familyLivestock"
}
```

**curl** (verified: `http 200`, `kpis.minIndoorTemp` = 273.10 K):

```bash
curl -s http://127.0.0.1:4000/api/options -o options.json
python3 -c "import json;json.dump(json.load(open('options.json'))['defaults'],open('defaults.json','w'))"
curl -s -X POST http://127.0.0.1:4000/api/simulate \
  -H 'Content-Type: application/json' \
  -d @defaults.json
```

**Python (`requests`)** (verified output: `minIndoorTemp (C): -0.05`):

```python
import requests

defaults = requests.get("http://127.0.0.1:4000/api/options").json()["defaults"]
resp = requests.post("http://127.0.0.1:4000/api/simulate", json=defaults)
resp.raise_for_status()
data = resp.json()
print("minIndoorTemp (C):", round(data["kpis"]["minIndoorTemp"] - 273.15, 2))
```

**JavaScript (`fetch`, Node 20+ or browser)** (verified output: `status: 200`,
`meanIndoorTemp (C): 2.68`):

```js
const opts = await (await fetch('http://127.0.0.1:4000/api/options')).json();
const resp = await fetch('http://127.0.0.1:4000/api/simulate', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(opts.defaults),
});
const data = await resp.json();
console.log('status:', resp.status);
console.log('meanIndoorTemp (C):', (data.kpis.meanIndoorTemp - 273.15).toFixed(2));
```

## 4. Reading the response

`POST /api/simulate` returns `{ input, kpis, result }`. `input` echoes your `DesignInput`. `kpis`
and `result.kpis` are identical (top-level `kpis` is a convenience copy).

**KPIs** (`kpis`, all temperatures in **Kelvin** — subtract 273.15 for °C):

| Key                                                      | Unit           | Meaning                                                       |
| -------------------------------------------------------- | -------------- | ------------------------------------------------------------- |
| `minIndoorTemp` / `maxIndoorTemp` / `meanIndoorTemp`     | K              | Over the simulated period                                     |
| `tempAt0600`                                             | K              | Pre-dawn temperature, final simulated day                     |
| `tempAt0600PerDay`                                       | K[] (optional) | One value per simulated day                                   |
| `hoursInComfort` / `hoursBelow5C` / `hoursBelowFreezing` | h              |                                                               |
| `peakToPeakSwing`                                        | K              | Indoor max − min                                              |
| `decrementFactor`                                        | ratio          | Indoor swing / outdoor swing — lower is better (more damping) |
| `timeLagHours`                                           | h              | Outdoor peak → indoor peak delay                              |
| `auxEnergyKWhPerDay`                                     | kWh/day        | Heater energy, if `auxHeating.enabled`                        |
| `keroseneEquivalentLitresPerYear`                        | L/yr           |                                                               |
| `co2EquivalentKgPerYear`                                 | kg/yr          |                                                               |
| `costPerYearINR`                                         | INR/yr         |                                                               |
| `condensationRiskHours`                                  | h \| `null`    | `null` when the weather has no relative-humidity data         |

**Key series** in `result` (all `number[]`, one value per timestep, parallel to `result.time`):

- `result.time` — seconds since period start. Divide by 3600 for hours.
- `result.temperatures.indoorAir` / `.ambient` / `.sky` / `.meanRadiant` / `.ground` — **Kelvin**.
- `result.temperatures.surfaces[surfaceId].exterior` / `.interior` — Kelvin, per building surface.
- `result.solar.incidentBySurface[surfaceId]` — W/m² hitting that surface.
- `result.solar.dailyTotalKWh` — `{ opaque, glazed, bySurface }`, daily solar totals in kWh.
- `result.heatFlows.<key>` — Watts, **sign convention: positive = heat entering the indoor air
  node**, negative = heat leaving:

| Key                     | Meaning                                                                  |
| ----------------------- | ------------------------------------------------------------------------ |
| `Q1_solarOpaque`        | Solar absorbed on opaque exterior surfaces                               |
| `Q2_solarGlazed`        | Solar transmitted through glazing                                        |
| `Q3_extConvection`      | Exterior surface ↔ outdoor air convection                                |
| `Q4_skyRadiation`       | Longwave, exterior surface ↔ sky (usually negative)                      |
| `Q5_envelopeConduction` | Conduction through opaque envelope                                       |
| `Q6_intConvection`      | Interior surface ↔ indoor air convection                                 |
| `Q7_interiorLongwave`   | Longwave between interior surfaces                                       |
| `Q8_windowConduction`   | Conduction through glazing                                               |
| `Q9_infiltration`       | Infiltration / ventilation                                               |
| `Q10_ground`            | Conduction to ground through floor                                       |
| `Q11_internalGains`     | Internal gains (people, stove, livestock)                                |
| `Qaux`                  | Auxiliary heating actually delivered                                     |
| `storageRate`           | Rate of change of energy stored in the fabric                            |
| `deltaT`                | `indoorAir - ambient`, **Kelvin-degrees**, not Watts                     |
| `dailyTotalsKWh`        | `Record<pathwayName, number>` — period totals in kWh, for a Sankey chart |

**Python: night-minimum + hourly indoor °C** (verified — prints `night minimum indoor: 0.0 C` and
one line per hour):

```python
import requests

defaults = requests.get("http://127.0.0.1:4000/api/options").json()["defaults"]
r = requests.post("http://127.0.0.1:4000/api/simulate", json=defaults).json()["result"]
indoor_c = [t - 273.15 for t in r["temperatures"]["indoorAir"]]
hours = [t / 3600 for t in r["time"]]
night_min = round(min(indoor_c), 1) or 0.0  # `or 0.0` turns a -0.0 print into 0.0
print(f"night minimum indoor: {night_min} C")
for h, c in zip(hours, indoor_c):
    if h % 1 < 0.02:  # roughly once per hour
        print(f"{h:5.1f}h  {c:6.2f} C")
```

## 5. Level 2 — the physics engine input (`SimulationRequest`)

For full control, bypass `DesignInput` entirely: `POST /api/simulate/raw` with a complete
`SimulationRequest` in "wire JSON" (the shape `requestToJson` in `packages/engine/src/serialise.ts`
produces — every `Float64Array` becomes a plain `number[]`, same names, same nesting). All 7
top-level fields are **required**; there is no partial/patch mode.

```ts
interface SimulationRequest {
  site: Site;
  building: Building;
  operation: Operation;
  weather: WeatherSeries;
  materials: Record<string, Material>; // keyed by materialId, must cover every id used below
  glazings: Record<string, Glazing>; // keyed by glazingId
  options: SimOptions;
}
```

**`site`** — where the building is:

| Field                  | Unit                            | Meaning                                       |
| ---------------------- | ------------------------------- | --------------------------------------------- |
| `id`, `name`           | —                               | Identifiers                                   |
| `latitude`             | degrees, north+                 |                                               |
| `longitude`            | degrees, east+                  |                                               |
| `elevation`            | m                               | Above sea level                               |
| `standardMeridian`     | degrees east                    | e.g. 82.5 for IST — for solar time correction |
| `groundAlbedo`         | 0–1, scalar or one per timestep | Ground reflectivity (snow raises it)          |
| `groundTempMeanAnnual` | K                               | Deep-soil annual mean temperature             |
| `groundTempAmplitude`  | K (optional)                    | Annual soil-surface swing (Kusuda-Achenbach)  |
| `horizonProfile`       | degrees[36] (optional)          | Blocking altitude every 10° of azimuth        |

**`building`**:

| Field                 | Unit           | Meaning                                           |
| --------------------- | -------------- | ------------------------------------------------- |
| `floorArea`           | m²             |                                                   |
| `volume`              | m³             |                                                   |
| `azimuth`             | degrees        | Whole-building rotation from due south            |
| `thermalBridgeFactor` | multiplier     | On envelope UA, typically 1.05–1.20               |
| `surfaces`            | `Surface[]`    | See below                                         |
| `windows`             | `WindowSpec[]` | See below                                         |
| `storageElements`     | optional       | Discrete thermal mass (water drum, PCM, rock bed) |

`Surface`:

| Field                                                              | Unit                                  | Meaning                                                                                    |
| ------------------------------------------------------------------ | ------------------------------------- | ------------------------------------------------------------------------------------------ |
| `id`                                                               | —                                     | Referenced by `windows[].hostSurfaceId` and result keys                                    |
| `type`                                                             | `wall` \| `roof` \| `floor`           |                                                                                            |
| `area`                                                             | m²                                    | Net of window openings                                                                     |
| `tilt`                                                             | degrees from horizontal               | 0 = flat facing up (roof), 90 = vertical (wall), 180 = facing down (floor, in the example) |
| `azimuth`                                                          | degrees from south                    | **−90 = East, +90 = West**, 180/−180 = North, 0 = South (before building rotation)         |
| `construction`                                                     | `Layer[]`                             | **Ordered exterior → interior** — `construction[0]` is the outside face                    |
| `boundary`                                                         | `exterior` \| `ground` \| `adiabatic` | What's on the other side                                                                   |
| `exteriorAbsorptivity`, `exteriorEmissivity`, `interiorEmissivity` | 0–1                                   | Solar/longwave surface properties                                                          |

`Layer`: `{ materialId: string, thickness: number /* m */ }`.

`WindowSpec`: `{ id, hostSurfaceId, area /* m² */, glazingId, shadingSchedule?: boolean[24],
shutterResistance? /* m²·K/W */, overhangDepth?, overhangHeightAbove? }`.

**`operation`** — how the building is used:

| Field                   | Unit                                                            | Meaning                                                                   |
| ----------------------- | --------------------------------------------------------------- | ------------------------------------------------------------------------- |
| `internalGainsSchedule` | W[24]                                                           | Hourly heat from people/stove/livestock/appliances                        |
| `achSchedule`           | ACH[24]                                                         | Air changes per hour, hourly                                              |
| `auxHeating`            | `{enabled, setpoint (K), maxPower (W), schedule?: boolean[24]}` | Heater                                                                    |
| `comfortBand`           | `{lower (K), upper (K)}`                                        | For `hoursInComfort`                                                      |
| `hasUnventedCombustion` | boolean (optional)                                              | true if a stove burns indoors — raises the minimum safe ventilation floor |

**`weather`** — hourly (or finer) time series, all arrays the same length:

| Field            | Unit              | Meaning                                                                                                                              |
| ---------------- | ----------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `stepSeconds`    | s                 | Time between samples (e.g. 3600)                                                                                                     |
| `startDayOfYear` | 1–365             | Day of the first sample                                                                                                              |
| `startHour`      | 0–24 (fractional) | Local clock hour of the first sample                                                                                                 |
| `T_amb`          | **K**             | Dry-bulb air temperature                                                                                                             |
| `GHI`            | W/m²              | Global horizontal irradiance                                                                                                         |
| `v_wind`         | m/s               | Wind speed                                                                                                                           |
| `DNI`, `DHI`     | W/m² (optional)   | Direct/diffuse irradiance — derived via Erbs if absent                                                                               |
| `LW_down`        | W/m² (optional)   | Downward longwave — Swinbank-estimated if absent                                                                                     |
| `RH`             | % (optional)      | Relative humidity — condensation KPI is `null` without it                                                                            |
| `provenance`     | object            | `{source, label, sourceElevation, lapseCorrectionK, fetchedAt?, notes[]}` — required, even if hand-built (use `source: "synthetic"`) |

`requestFromJson` (the strict parser behind `/api/simulate/raw`) requires `weather.stepSeconds`,
`startDayOfYear`, `startHour`, `T_amb`, `GHI`, `v_wind`, and `provenance` — verified: omitting
`GHI` 400s with `{"code":"INVALID_INPUT","field":"weather.GHI"}`.

**`materials`** (keyed by id) and **`glazings`** (keyed by id) — full engine records, richer than
the `/api/options` summary:

`Material`: `{id, name, nameHi?, category, k /* W/(m·K) */, rho /* kg/m³ */, c /* J/(kg·K) */,
alphaSolar /* 0-1 solar absorptivity */, emissivity /* 0-1 */, costPerM3?, locallyAvailableLadakh,
embodiedCarbon?, source, blurb?}`.

`Glazing`: `{id, name, nameHi?, U /* W/(m²·K) */, SHGC /* 0-1 */, tauVis /* 0-1, cosmetic */,
b0 /* incidence-angle-modifier coefficient */, costPerM2?, source, blurb?}`.

**`options`** (`SimOptions`):

| Field                    | Unit                  | Meaning                                                                                                                                            |
| ------------------------ | --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `timestepSeconds`        | s                     | Solver step, e.g. 300                                                                                                                              |
| `meshTargetDx`           | m                     | Target node spacing through wall thickness                                                                                                         |
| `simulationDays`         | days                  | Days actually reported                                                                                                                             |
| `spinUpToleranceK`       | K                     | Day-over-day convergence tolerance before reporting                                                                                                |
| `maxSpinUpDays`          | days                  | Cap on spin-up iterations                                                                                                                          |
| `skyModel`               | `isotropic` \| `hdkr` | **Use `isotropic`** — the server always does, because the bundled Ladakh presets diverge under `hdkr` (an unclamped-`Rb` engine bug, per `API.md`) |
| `integrationTheta`       | 0–1                   | 1.0 = backward Euler (unconditionally stable); don't lower without reason                                                                          |
| `keepSurfaceProfiles`    | boolean               | Retain full through-wall temperature profiles (heavy, off by default)                                                                              |
| `allowUnsafeVentilation` | boolean               | Permits ACH below the safety floor — leave `false`                                                                                                 |

**Trimmed skeleton** of `examples/leh-request.json` (a real, complete request — weather arrays
shortened here with `...`; open the file for the full 25-hour series):

```json
{
  "site": {
    "id": "leh",
    "latitude": 34.15,
    "longitude": 77.58,
    "elevation": 3500,
    "standardMeridian": 82.5,
    "groundAlbedo": [0.75, "... 25 values ..."],
    "groundTempMeanAnnual": 279.15
  },
  "building": {
    "floorArea": 25,
    "volume": 65,
    "azimuth": 0,
    "thermalBridgeFactor": 1.1,
    "surfaces": [
      {
        "id": "wallSouth",
        "type": "wall",
        "area": 13,
        "tilt": 90,
        "azimuth": 0,
        "construction": [{ "materialId": "rammedEarth", "thickness": 0.4 }],
        "boundary": "exterior",
        "exteriorAbsorptivity": 0.7,
        "exteriorEmissivity": 0.9,
        "interiorEmissivity": 0.9
      },
      "... wallEast (azimuth -90), wallWest (+90), wallNorth (180) ...",
      {
        "id": "roof",
        "type": "roof",
        "tilt": 0,
        "azimuth": 0,
        "area": 25,
        "construction": [
          { "materialId": "mudPlaster", "thickness": 0.08 },
          { "materialId": "timberPoplarWillow", "thickness": 0.05 }
        ],
        "boundary": "exterior",
        "...": "..."
      },
      {
        "id": "floor",
        "type": "floor",
        "tilt": 180,
        "azimuth": 0,
        "area": 25,
        "construction": [
          { "materialId": "gravelSoilFill", "thickness": 0.1 },
          { "materialId": "rammedEarth", "thickness": 0.05 }
        ],
        "boundary": "ground",
        "...": "..."
      }
    ],
    "windows": [
      {
        "id": "wallSouthWindow",
        "hostSurfaceId": "wallSouth",
        "area": 0.416,
        "glazingId": "singleGlazing"
      }
    ]
  },
  "operation": {
    "internalGainsSchedule": ["24 values, W"],
    "achSchedule": ["24 values, ACH"],
    "auxHeating": { "enabled": false, "setpoint": 288.15, "maxPower": 0 },
    "comfortBand": { "lower": 288.15, "upper": 297.15 },
    "hasUnventedCombustion": true
  },
  "weather": {
    "stepSeconds": 3600,
    "startDayOfYear": 15,
    "startHour": 0,
    "T_amb": [252.51, 251.91, "... 25 values, K ..."],
    "GHI": ["... 25 values, W/m^2 ..."],
    "v_wind": ["... 25 values, m/s ..."],
    "DNI": ["..."],
    "DHI": ["..."],
    "LW_down": ["..."],
    "RH": ["..."],
    "provenance": {
      "source": "nasa-power",
      "label": "NASA POWER ...",
      "sourceElevation": 4532.61,
      "lapseCorrectionK": 6.71,
      "fetchedAt": "2026-09-16",
      "notes": ["..."]
    }
  },
  "materials": {
    "rammedEarth": { "...": "full Material record" },
    "mudPlaster": {},
    "timberPoplarWillow": {},
    "gravelSoilFill": {}
  },
  "glazings": { "singleGlazing": { "...": "full Glazing record" } },
  "options": {
    "timestepSeconds": 300,
    "meshTargetDx": 0.02,
    "simulationDays": 1,
    "spinUpToleranceK": 0.02,
    "maxSpinUpDays": 30,
    "skyModel": "isotropic",
    "integrationTheta": 1,
    "keepSurfaceProfiles": false,
    "allowUnsafeVentilation": false
  }
}
```

Full file: `examples/leh-request.json` (109 KB, inspect with `python3 -c "import json;
d=json.load(open('examples/leh-request.json')); ..."` or `jq` — don't `cat` the whole thing, the
weather/groundAlbedo arrays are long).

## 6. Workflow: customise at the engine level

Get a starting `SimulationRequest` from the simple form, edit one field with full physics
control, then run it directly:

```bash
curl -s http://127.0.0.1:4000/api/options -o options.json
python3 -c "import json;json.dump(json.load(open('options.json'))['defaults'],open('defaults.json','w'))"
curl -s -X POST http://127.0.0.1:4000/api/assemble \
  -H 'Content-Type: application/json' -d @defaults.json -o req.json
```

Edit `req.json` in Python — example: make the walls more insulating by lowering a material's
conductivity (verified: `minIndoorTemp` rose from **−0.05 °C to 2.63 °C** for this exact edit):

```python
import json

req = json.load(open("req.json"))
req["materials"]["rammedEarth"]["k"] = 0.3   # was 1.0 W/(m*K) — simulates added insulation
json.dump(req, open("req_modified.json", "w"))
```

```bash
curl -s -X POST http://127.0.0.1:4000/api/simulate/raw \
  -H 'Content-Type: application/json' -d @req_modified.json
```

(To add a brand-new insulation layer instead of editing an existing material's `k`, append
`{"materialId": "eps", "thickness": 0.05}` to a surface's `construction` array **and** add a full
`Material` record for `"eps"` to `req["materials"]` — every `materialId` referenced anywhere in
`building` must have a matching entry in `materials`, or the engine responds `UNKNOWN_MATERIAL`.)

## 7. Errors

Every response is JSON. Failures are always:

```ts
interface ApiError {
  code: string;
  message: string;
  field?: string;
} // field only when applicable
```

| Code                    | HTTP | When                                                                                                                           |
| ----------------------- | ---- | ------------------------------------------------------------------------------------------------------------------------------ |
| `VALIDATION_ERROR`      | 400  | `DesignInput` itself is malformed (bad type, out-of-range, unknown id) — `field` names the offending key                       |
| `INVALID_INPUT`         | 400  | `/api/simulate/raw`: the `SimulationRequest` is malformed/incomplete — `field` names the offending path (e.g. `"weather.GHI"`) |
| `GEOMETRY_INCONSISTENT` | 400  | Engine: geometry doesn't make physical sense                                                                                   |
| `WEATHER_INVALID`       | 422  | Engine: weather series bad (e.g. mismatched array lengths)                                                                     |
| `UNKNOWN_MATERIAL`      | 422  | Engine: a `materialId` used in `building` has no entry in `materials`                                                          |
| `UNKNOWN_GLAZING`       | 422  | Engine: same, for `glazingId`                                                                                                  |
| `DATA_SCHEMA_MISMATCH`  | 422  | Engine: JSON shape wrong in a way the parser can't localise                                                                    |
| `SOLVER_DIVERGED`       | 500  | Engine: numerical solver failed to converge                                                                                    |
| `SINGULAR_MATRIX`       | 500  | Engine: ill-posed system                                                                                                       |
| `PAYLOAD_TOO_LARGE`     | 413  | Body over 5 MB                                                                                                                 |
| `INTERNAL_ERROR`        | 500  | Anything unexpected                                                                                                            |

Verified live: bad `locationId` on `/api/simulate` →
`{"code":"VALIDATION_ERROR","message":"body/locationId must be equal to one of the allowed values","field":"locationId"}`
(400). `lengthM: 1` (below the 2 m minimum) →
`{"code":"VALIDATION_ERROR","field":"lengthM"}` (400). Missing `weather.GHI` on
`/api/simulate/raw` → `{"code":"INVALID_INPUT","field":"weather.GHI"}` (400). Missing top-level
`operation` → `{"code":"INVALID_INPUT","field":"operation"}` (400).

**Common mistakes**

- **Kelvin vs °C.** Every temperature in `result`, `weather.T_amb`, `operation.auxHeating.setpoint`
  and `operation.comfortBand` is Kelvin. `DesignInput` itself has no temperature fields, so the
  simple form never needs conversion — only Level 2 (`/api/simulate/raw`) does. °C = K − 273.15.
- **Missing weather fields.** `requestFromJson` requires `stepSeconds`, `startDayOfYear`,
  `startHour`, `T_amb`, `GHI`, `v_wind`, `provenance` — leaving any out 400s with that field name.
- **Unknown ids.** A `materialId`/`glazingId` not present in the request's own `materials`/
  `glazings` map is a 422 (`UNKNOWN_MATERIAL`/`UNKNOWN_GLAZING`), not a 400 — it passes JSON-shape
  validation and fails inside the engine instead.

## 8. Full result schema

This doc covers everything most callers need. For the complete `ResultJson`/`SimulationKpis`
TypeScript interfaces and the server-assembly steps `DesignInput` goes through, see
[`apps/server/API.md`](apps/server/API.md).
