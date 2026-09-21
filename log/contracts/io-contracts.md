# log/contracts/io-contracts.md — the request/response/error contracts

> Extracted from `log/CONTRACTS.md` §7.5-7.8. Read this when your task's Area README names it (Area E, F).

---

### 7.5 `SimulationRequest` — the input contract (as implemented)

File: `packages/engine/src/types.ts`. **Every temperature is `Kelvin`.**

```ts
export interface SimulationRequest {
  site: Site;
  building: Building;
  operation: Operation;
  weather: WeatherSeries;                    // always a resolved series; the engine does no I/O
  materials: Record<string, Material>;       // keyed by Material.id, supplied by the caller
  glazings:  Record<string, Glazing>;        // keyed by Glazing.id, supplied by the caller
  options: SimOptions;
}

export interface Site {
  id: string;
  name: string;
  latitude: number;                  // deg, north positive
  longitude: number;                 // deg, east positive
  elevation: number;                 // m above sea level
  standardMeridian: number;          // deg east, 82.5 for IST
  groundAlbedo: number | number[];   // scalar, or one value per timestep (snow cover)
  groundTempMeanAnnual: Kelvin;
  groundTempAmplitude?: number;      // K, annual soil-surface swing, Kusuda-Achenbach
  horizonProfile?: number[];         // 36 values: blocking altitude (deg) per 10 deg of azimuth
}

export interface Building {
  floorArea: number;                 // m^2
  volume: number;                    // m^3
  azimuth: number;                   // deg, whole-building rotation from due south
  surfaces: Surface[];
  windows: WindowSpec[];
  thermalBridgeFactor: number;       // multiplier on envelope UA, typ. 1.05-1.20
}

export interface Surface {
  id: string;
  type: 'wall' | 'roof' | 'floor';
  area: number;                      // m^2 -- NET of window openings (see the warning below)
  tilt: number;                      // deg from horizontal; 0 = flat facing up, 90 = vertical
  azimuth: number;                   // deg from south, before building rotation. -90 = E, +90 = W
  construction: Layer[];             // ordered EXTERIOR -> INTERIOR
  boundary: 'exterior' | 'ground' | 'adiabatic';
  exteriorAbsorptivity: number;      // 0-1
  exteriorEmissivity: number;        // 0-1
  interiorEmissivity: number;        // 0-1
}

export interface Layer { materialId: string; thickness: number; }   // thickness in metres

export interface WindowSpec {
  id: string;
  hostSurfaceId: string;             // must match a Surface.id of type 'wall' or 'roof'
  area: number;                      // m^2
  glazingId: string;
  shadingSchedule?: boolean[];       // 24 values: true = night shutter closed in that hour
  shutterResistance?: number;        // m^2*K/W, default 0.4 when a schedule is present
  overhangDepth?: number;            // m
  overhangHeightAbove?: number;      // m
}

export interface Operation {
  internalGainsSchedule: number[];   // 24 values, W -- people, stove, appliances, livestock
  achSchedule: number[];             // 24 values, air changes per hour
  auxHeating: {
    enabled: boolean;
    setpoint: Kelvin;
    maxPower: number;                // W
    schedule?: boolean[];            // 24 values: is heating permitted this hour?
  };
  comfortBand: { lower: Kelvin; upper: Kelvin };
}

export interface SimOptions {
  timestepSeconds: number;           // default 300 -- see the note below
  meshTargetDx: number;              // default 0.02 m
  simulationDays: number;            // days actually reported, default 1
  spinUpToleranceK: number;          // default 0.02 K
  maxSpinUpDays: number;             // default 30
  skyModel: 'isotropic' | 'hdkr';    // default 'hdkr'
  integrationTheta: number;          // 1.0 = backward Euler (default)
  keepSurfaceProfiles: boolean;      // default false (heavy)
  allowUnsafeVentilation: boolean;   // default false -- see the warning below
}
```

⚠ **`Surface.area` is NET, not gross.** `WORKERS.md` §3.8 says gross-including-windows. The disk
says net-of-windows and every consumer assumes net. **Net wins.** A validator (T-06) must reject a
request whose window areas exceed a plausible fraction of their host surface, but it must not
subtract them again.

⚠ **`WindowSpec`, not `Window`.** The disk name avoids colliding with the DOM `Window` global in
`apps/web`. Keep it.

⚠ **Default timestep is 300 s, not 60 s.** This is a measured decision recorded in
`packages/engine/src/index.ts`: against a 30 s reference, 300 s moves the 06:00 temperature by
under 0.01 K and the daily swing by under 0.5 % **for the lightest building in the catalogue** (a
bare tin shed, the fastest dynamics and therefore the worst case), and buys a 5× speedup. Backward
Euler is unconditionally stable, so the timestep is an accuracy choice, not a stability one.
Anyone who wants 60 s can still ask for it.

⚠ **`allowUnsafeVentilation` is an escape hatch, not a feature.** It exists because the adiabatic
validation case genuinely needs zero infiltration, and because showing a user *why* sealing is
unsafe is a product feature. It defaults to `false`, every run that uses it emits a warning, and
**the optimiser must never set it** (rule 10).

**`DEFAULT_SIM_OPTIONS`** is exported from `packages/engine/src/index.ts` and is the only place
defaults live:

```ts
{ timestepSeconds: 300, meshTargetDx: 0.02, simulationDays: 1,
  spinUpToleranceK: 0.02, maxSpinUpDays: 30, skyModel: 'hdkr',
  integrationTheta: 1, keepSurfaceProfiles: false, allowUnsafeVentilation: false }
```


### 7.6 `WeatherSeries` — the weather contract (as implemented)

```ts
export interface WeatherSeries {
  stepSeconds: number;               // seconds between samples, typically 3600
  startDayOfYear: number;            // 1-365, day of the first sample
  startHour: number;                 // local clock hour (0-24, fractional) of the first sample
  T_amb:  Float64Array;              // dry-bulb air temperature, K
  GHI:    Float64Array;              // global horizontal irradiance, W/m^2
  v_wind: Float64Array;              // wind speed, m/s
  DNI?:   Float64Array;              // direct normal irradiance, W/m^2   (Erbs-derived when absent)
  DHI?:   Float64Array;              // diffuse horizontal irradiance     (Erbs-derived when absent)
  LW_down?: Float64Array;            // downward longwave, W/m^2          (Swinbank when absent)
  RH?:    Float64Array;              // relative humidity, %  (absent -> condensationRiskHours null)
  provenance: WeatherProvenance;
}

export interface WeatherProvenance {
  source: 'nasa-power' | 'open-meteo' | 'bundled-tmy' | 'user-csv' | 'synthetic';
  label: string;                     // human-readable, shown in the UI. MANDATORY, non-empty
  sourceElevation: number | null;    // m the source data represents. null for user CSV
  lapseCorrectionK: number;          // K added to every temperature. Shown in the UI, never hidden
  fetchedAt?: string;                // ISO-8601
  notes: string[];                   // non-fatal: gaps interpolated, fields derived, etc.
}
```

⚠ Field names on disk are `T_amb`/`GHI`/`v_wind`/`DNI`/`DHI`/`LW_down`/`RH` and the arrays are
`Float64Array`. `WORKERS.md` §3.8 uses `tAmb`/`ghi`/`windSpeed`/`number[]`. **The disk wins.**
At JSON boundaries (the API, the database, the worker message) a `Float64Array` serialises as a
plain array — the conversion helpers belong in T-06, in one place, and nowhere else.

⚠ There is **no `snowCover` field** on disk. Snow is expressed through `Site.groundAlbedo` as a
per-timestep series. T-27 (bundled TMY) produces that series; do not add a `snowCover` boolean.

⚠ There is **no `WeatherRef`** on disk. The engine always receives a resolved `WeatherSeries`.
Resolving `'leh'` to a series is the caller's job (T-27 / T-38), which is what keeps the engine
free of I/O.


### 7.7 `SimulationResult` — the output contract (as implemented)

```ts
export interface SimulationResult {
  meta: {
    nodeCount: number;
    timesteps: number;
    wallClockMs: number;
    spinUpDaysUsed: number;              // actual, not requested
    energyBalanceResidual: number;       // dimensionless FRACTION, must be < 1e-3 (section 7.4)
    annualisationMethod: string;         // shown in the UI, never hidden
    warnings: string[];
  };
  time: Float64Array;                    // seconds from the start of the reported period
  temperatures: {
    indoorAir:   Float64Array;           // Kelvin
    ambient:     Float64Array;
    sky:         Float64Array;
    meanRadiant: Float64Array;
    surfaces: Record<string, {
      exterior: Float64Array; interior: Float64Array; profile?: number[][];
    }>;
  };
  solar: {                               // PS Deliverable 2
    incidentBySurface: Record<string, Float64Array>;   // W/m^2
    absorbedOpaque:    Float64Array;                   // W
    transmittedGlazed: Float64Array;                   // W
    dailyTotalKWh: { opaque: number; glazed: number; bySurface: Record<string, number> };
  };
  heatFlows: HeatFlows;                  // PS Deliverable 3 -- the thirteen series of section 7.3
  kpis: SimulationKpis;                  // PS Deliverable 1 + decision support
}

export interface SimulationKpis {
  minIndoorTemp: Kelvin;  maxIndoorTemp: Kelvin;  meanIndoorTemp: Kelvin;
  tempAt0600: Kelvin;                    // THE number for Ladakh: the pre-dawn minimum
  hoursInComfort: number;
  hoursBelow5C: number;
  hoursBelowFreezing: number;
  peakToPeakSwing: number;
  decrementFactor: number;               // indoor swing / outdoor swing. Lower is better
  timeLagHours: number;                  // hours between the outdoor peak and the indoor peak
  auxEnergyKWhPerDay: number;            // PRIMARY RANKING METRIC
  keroseneEquivalentLitresPerYear: number;
  co2EquivalentKgPerYear: number;
  costPerYearINR: number;
  condensationRiskHours: number | null;  // null when the weather carried no RH -- never 0
}
```

⚠ **`condensationRiskHours === null` must render as "not available — no humidity data"**,
never as "0 hours". Rendering null as zero is a lie about data quality.

⚠ `heatFlows.storageRate` is the disk name; `WORKERS.md` calls it `storageChange`. Disk wins.

⚠ **`heatFlows.deltaT` does not exist yet.** The problem statement's own deliverable 3 is phrased
"heat flow details **as per the temperature difference between ambient and shelter temperature**",
so the ΔT series is a named requirement. T-22 adds it.

⚠ **`temperatures.ground` does not exist yet.** T-22 adds it alongside `deltaT`.


### 7.8 Errors

```ts
export type EngineErrorCode =
  | 'INVALID_INPUT' | 'UNKNOWN_MATERIAL' | 'UNKNOWN_GLAZING' | 'GEOMETRY_INCONSISTENT'
  | 'WEATHER_INVALID' | 'SOLVER_DIVERGED' | 'SINGULAR_MATRIX';
  // T-06 adds: 'DATA_SCHEMA_MISMATCH'

export class EngineError extends Error {
  constructor(readonly code: EngineErrorCode, message: string, readonly detail?: unknown) {
    super(message); this.name = 'EngineError';
  }
}
```

Rules that go with it:

- **Validation happens once, at the top of `simulate()`**, before any allocation. It collects
  **all** problems and throws **one** `EngineError('INVALID_INPUT')` whose `detail` is a
  `{ path, message }[]`. It never throws on the first problem — a user with three bad fields should
  see three messages. This is implemented and tested
  (`integrator.test.ts` → *"reports every problem at once, not just the first"*).
- **Non-fatal problems become `meta.warnings` strings**, not exceptions: spin-up hit its day cap;
  ACH was raised to the safety floor; a weather gap longer than 3 h was interpolated; RH absent so
  `condensationRiskHours` is null.
- **The engine never calls `console.*` and never throws a bare `Error`.** It has no logger.
  Everything it wants to say comes back in the return value or in an `EngineError`.
- **Numerical guards are mandatory:** `luFactor` throws `SINGULAR_MATRIX` on a zero pivot; the
  integrator throws `SOLVER_DIVERGED` if any node leaves `[173 K, 373 K]` (`T_MIN_PLAUSIBLE` /
  `T_MAX_PLAUSIBLE` in `constants.ts`) or becomes non-finite. **A plausible-looking wrong number is
  worse than a crash** — `CHALLENGE.md` C-08.
