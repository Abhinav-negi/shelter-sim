# CONTRACTS.md — ShelterSim shared contracts, architecture and deviation log

> Extracted from the original single-file `LOG.md` (§7–§10). Read this file **once per session**,
> per the ritual in `LOG.md` §2 step 3 — not once per task. Task entries live in `log/AREA-*.md`;
> the task index is in `LOG.md`.

---

## 7. THE SHARED CONTRACTS

**This section is authoritative.** Where it disagrees with `WORKERS.md` §3 or `TECH.md` §10, **this
section wins**, because it describes the code that is actually on disk and green. The divergences
are itemised in §9.

No task may restate, extend or contradict this section. A task that needs a type which is not here
defines it **locally in its own module file** and exports it from there — it never edits
`packages/engine/src/types.ts`. The single exception is **T-06**, which exists precisely to add the
missing shared types, once, under this contract.

### 7.1 The unit boundary — Kelvin discipline

File: `packages/engine/src/units.ts` (**exists, done**).

```ts
export type Kelvin  = number & { readonly __unit: 'K' };
export type Celsius = number & { readonly __unit: 'degC' };

export const T0 = 273.15;

export const toK = (c: Celsius | number): Kelvin  => ((c as number) + T0) as Kelvin;
export const toC = (k: Kelvin  | number): Celsius => ((k as number) - T0) as Celsius;

/** Assert a number is already Kelvin. Only for trusted internal state. */
export const asK = (n: number): Kelvin  => n as Kelvin;
export const asC = (n: number): Celsius => n as Celsius;

export const DEG = Math.PI / 180;
export const rad = (deg: number): number => deg * DEG;
export const deg = (r: number): number => r / DEG;
```

**The rule, in one sentence:** `SimulationRequest` and `SimulationResult` are entirely in Kelvin,
including when serialised to JSON and including when stored in the database; the only place a
Celsius value may exist is inside `apps/web/lib/units.ts` and the presentation code it serves.

Why the brands exist: radiation goes as T⁴. Feeding it `0` (meaning 0 °C) instead of `273.15` K
yields `0` instead of `5.6e9`, the heat loss silently vanishes, and the plot still looks plausible.
The brands make that a compile error instead of a lost day.

**Angles:** degrees at every function boundary; radians only inside a function body, and any
variable holding radians is suffixed `Rad`.
**Time:** seconds for durations; `dayOfYear` 1–365 and `clockHour` 0–24 fractional for calendar
position. **Lengths and areas:** metres and m², thicknesses in metres, never millimetres.

### 7.2 Sign convention — one rule for every heat flow

**Every `Q` term is in watts and is positive when it adds energy to the modelled system, negative
when it removes energy from it.** The modelled system = all solved nodes (every wall node, the air
node, every storage node). Ambient air, the sky and deep soil are boundary conditions, outside it.

Consequences every task must respect:

- `Q4_skyRadiation` is **almost always negative**. It is written `hRSky · (T_sky − T_surf)` and
  `T_sky < T_surf` on any Ladakh night.
- `Q3`, `Q8`, `Q9`, `Q10` are written `coefficient · (T_boundary − T_system)` and therefore carry
  their own sign; they go positive on the rare occasions ambient or ground is warmer.
- `Q1`, `Q2`, `Q11`, `Qaux` are **always ≥ 0**.
- `Q5`, `Q6`, `Q7` are **internal redistribution**. They move energy between solved nodes and cross
  no system boundary. They are reported for the user's benefit and are **excluded from the
  energy-balance residual** (§7.4).

### 7.3 The eleven pathways Q1–Q11

| # | Field name (as implemented) | Pathway | Sign |
|---|---|---|---|
| Q1 | `Q1_solarOpaque` | Solar absorbed on opaque exterior surfaces | ≥ 0 |
| Q2 | `Q2_solarGlazed` | Solar transmitted through glazing | ≥ 0 |
| Q3 | `Q3_extConvection` | Exterior surface ↔ ambient air convection | ± |
| Q4 | `Q4_skyRadiation` | Exterior surface ↔ sky longwave | ≤ 0 normally |
| Q5 | `Q5_envelopeConduction` | Conduction through the opaque envelope | ± **internal** |
| Q6 | `Q6_intConvection` | Interior surface ↔ indoor air convection | ± **internal** |
| Q7 | `Q7_interiorLongwave` | Interior surface ↔ interior surface longwave | ± **internal** |
| Q8 | `Q8_windowConduction` | Conduction through glazing | ± |
| Q9 | `Q9_infiltration` | Infiltration / ventilation air exchange | ± |
| Q10 | `Q10_ground` | Conduction to ground through the floor | ± |
| Q11 | `Q11_internalGains` | Internal gains (people, stove, livestock) | ≥ 0 |
| — | `Qaux` | Auxiliary heating actually delivered | ≥ 0 |
| — | `storageRate` | Rate of change of energy stored in the fabric | ± |

⚠ **Naming note.** The field is `Q7_interiorLongwave` on disk. `WORKERS.md` §3.6 calls it
`Q7_interiorRadiation`. **The disk name wins.** Do not rename it; every consumer already uses it.

`AUDIT.md` found Q7 silently dropped from the frontend heat-flow list — precisely the class of
missing term the energy-balance test exists to catch. It is present on disk and must appear in
every heat-flow chart, legend and Sankey.

### 7.4 The energy-balance residual — exact definition

This definition is copied verbatim as a comment above the implementation in
`packages/engine/src/post/energyBalance.ts`, and that implementation is **done and green**.

**Control volume:** all solved nodes (all wall nodes, the air node, all storage nodes).

**Boundary terms** — the only terms that enter the residual, because only these cross the
control-volume boundary:

```
BOUNDARY = { Q1, Q2, Q3, Q4, Q8, Q9, Q10, Q11, Qaux }
```

**Excluded**, because they are internal redistribution between solved nodes and cancel exactly:

```
INTERNAL = { Q5, Q6, Q7 }
```

**Accumulation, per timestep of length Δt:**

```
E_net    = Σ_steps  Δt · Σ_{q ∈ BOUNDARY}  q(t)      [J]  signed, per §7.2
E_gross  = Σ_steps  Δt · Σ_{q ∈ BOUNDARY} |q(t)|     [J]  gross throughput
```

**Stored energy:**

```
ΔStored = Σ_nodes  C_j · ( T_j(t_end) − T_j(0) )
```

with the indoor air node using its **effective** capacitance (`M = 4` multiplier, §7.10).
When a PCM node exists (T-19), its contribution must instead be evaluated by integrating the
**apparent** heat capacity along that node's own temperature history by trapezoidal rule —
never as `C_j(T_end) · ΔT`, which silently mis-counts latent heat.

**Residual:**

```
residual = | E_net − ΔStored | / E_gross        dimensionless FRACTION
```

- **Normalising by `E_gross`, not by `E_in`**, is deliberate. `AUDIT.md` found the `E_in`
  normalisation degenerates for night-only reporting windows where gains are near zero. `E_gross`
  is strictly positive for any window of nonzero length.
- **Units: a dimensionless fraction.** `0.001` means 0.1 %.
- **Pass threshold: `residual < 0.001`.** Asserted in CI on every preset (T-62).
- **UI display rule:** the badge renders `(residual * 100).toFixed(3) + '%'`, labelled
  "energy balance". A displayed `0.020%` corresponds to a stored value of `0.0002`. This resolves
  the `< 0.001` vs `0.02%` dimensional mismatch `AUDIT.md` flagged in the project's own headline
  credibility number.

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

### 7.9 Constants

File: `packages/engine/src/constants.ts` (**exists, done**).

```ts
export const SIGMA  = 5.670374419e-8;  // Stefan-Boltzmann, W/(m^2*K^4)
export const G_SC   = 1367;            // solar constant, W/m^2
export const C_P_AIR = 1005;           // specific heat of air, J/(kg*K)
export const R_AIR  = 287.05;          // gas constant for dry air, J/(kg*K)
export const P0     = 101325;          // sea-level standard pressure, Pa
export const ACH_MIN = 0.35;           // HARD SAFETY FLOOR, air changes per hour
export const LAPSE_RATE = 6.5e-3;      // K per METRE (note the unit: not per km)
export const T_MIN_PLAUSIBLE = 173;    // K, -100 degC  -- solver divergence guard
export const T_MAX_PLAUSIBLE = 373;    // K, +100 degC
```

**Constants that do NOT yet exist and are added by the tasks named:**

```ts
// T-06 -- ranking and honesty
export const PRIMARY_METRIC   = 'auxEnergyKWhPerDay';  // lower is better
export const SECONDARY_METRIC = 'tempAt0600';          // higher is better; tie-break
export const RANK_NOISE_FLOOR = 0.05;                  // kWh/day. Closer than this = TIED, never ordered

// T-06 -- combustion allowance on top of ACH_MIN when a design has unvented combustion
export const ACH_MIN_COMBUSTION_ALLOWANCE = 0.35;      // so the bukhari case floors at 0.70

// T-21 -- the ACH / opening-area coupling knob (AUDIT F-6). CALIBRATION KNOB.
export const ACH_PER_GLAZING_FRACTION = 1.2;

// T-24 -- fuel, cost and carbon. Editable; surfaced in the assumptions panel; never inlined.
export const KEROSENE_KWH_PER_L = 10.4;        // ~37.6 MJ/L. TECH.md 10.4
export const KEROSENE_STOVE_EFFICIENCY = 0.55; // typical unvented kerosene heater. TECH.md 10.4
export const KEROSENE_CO2_KG_PER_L = 2.5;      // TECH.md 10.4
export const KEROSENE_INR_PER_L = 80;
// ^ WARNING: no source document states a kerosene price. This figure is an ASSUMPTION.
//   It must be editable in the UI and the PPT must cite whatever value is used.
// T-24 -- interior solar distribution, already in surfaces/interior.ts:
//   SOLAR_TO_FLOOR_FRACTION = 0.6, SOLAR_TO_AIR_FRACTION = 0.05
```

Note `CONVERSIONS` and `keroseneLitres()` already exist in
`packages/engine/src/post/conversions.ts`; T-24 must reconcile rather than duplicate them.

### 7.10 The physics, restated — every equation a task needs

Cited by source. Do not re-derive; do not re-guess.

**Air at altitude** (`air.ts`, done) — ISA barometric + ideal gas, `BLUEPRINT.md` 5.2:
```
p(h)  = P0 * (1 - 2.25577e-5 * h)^5.25588              [Pa]
rho   = p / (R_AIR * T)                                 [kg/m^3]
convectionAltitudeFactor(h) = sqrt( rho(h) / rho(0) )   [dimensionless]
```
Anchors: `airPressure(3500) = 65790 Pa ± 50`; `airDensity(3500, 263 K) = 0.871 ± 0.005`;
`airDensity(0, 263 K) = 1.342 ± 0.005`; ratio at Leh `= 0.65 ± 0.01`, so the convection factor is
`sqrt(0.65) = 0.806`. `airDensity(0, 288.15) = 1.225 ± 0.005` (ISA sea level).

**Solar position** (`solar/geometry.ts`, done) — `BLUEPRINT.md` 5.3. Declination, equation of time,
solar time `t_solar = t_clock + 4*(L_loc - L_st) + E`, altitude
`sin(alpha_s) = sin(phi)sin(delta) + cos(phi)cos(delta)cos(omega)`, azimuth with **south = 0, east
negative, west positive**, incidence
`cos(theta) = cos(theta_z)cos(beta) + sin(theta_z)sin(beta)cos(gamma_s - gamma)`, clamped at 0.
Anchors at Leh (34.15 °N, 77.58 °E): peak solar altitude **32.4°** on 21 Dec, **55.85°** at the
equinoxes, **79.3°** on 21 Jun, each ± 0.2°. Longitude correction `4*(77.58 - 82.5) = -19.7 min`.

**Irradiance decomposition** (`solar/decomposition.ts`, done) — Erbs, `BLUEPRINT.md` 5.4.
`I0 = G_SC * (1 + 0.033*cos(360n/365)) * cos(theta_z)`; `k_t = GHI/I0` clamped to `[0,1]`;
three-branch Erbs diffuse fraction; `DHI = GHI*ratio`, `DNI = (GHI - DHI)/cos(theta_z)`.
When the source supplies both DNI and DHI (NASA POWER does) they are used unchanged and Erbs is not
run. Guard: for `theta_z > 87°` or `I0 <= 0`, return `{ghi, dni: 0, dhi: ghi}`.
Closure identity: `DNI*cos(theta_z) + DHI === GHI` to 1e-9.

**Transposition** (`solar/transposition.ts`, done) — Liu & Jordan isotropic and HDKR,
`BLUEPRINT.md` 5.5:
```
I_beam    = DNI * cos(theta)
I_diffuse = DHI * (1 + cos(beta))/2                      [isotropic]
I_ground  = GHI * rho_ground * (1 - cos(beta))/2
```
Horizontal identity: at `beta = 0`, `transpose(...) === GHI` to 1e-9 in **both** sky models.
Snow check: raising `rho_ground` 0.20 → 0.80 multiplies the ground-reflected term by exactly 4.0.
The Ladakh headline: at Leh on 21 Dec, integrated daily `I_T` on a **vertical south wall exceeds
that on a horizontal roof**.

**Exterior boundary** (`surfaces/exterior.ts`, done) — `BLUEPRINT.md` 5.7:
```
hConvExterior(v, h) = max(1.0, (2.8 + 3.0*v) * convectionAltitudeFactor(h))   [W/(m^2*K)]
skyTemperature(T_amb, LW_down) = (LW_down/SIGMA)^0.25   when measured LW is present
                               = 0.0552 * T_amb^1.5     otherwise (Swinbank)
skyViewFactor(tilt) = (1 + cos(tilt))/2
hRadSky(eps, T_surf, T_sky) = 4 * eps * SIGMA * ((T_surf+T_sky)/2)^3
```
**Convective-only, NOT McAdams `5.7 + 3.8v`** — McAdams is a *combined* convective+radiative
coefficient and would double-count Q4, which is modelled explicitly.
The altitude factor is **mandatory, not a refinement** (`AUDIT.md` F-5): convection is heat carried
away *by air*, and at 3,500 m there is 35 % less air to carry it.
Anchor: `skyTemperature(258 K) = 228.7 K ± 0.5` (−44.4 °C), which is **29 K below ambient**.
`skyViewFactor(0) = 1.0`, `(90) = 0.5`, `(180) = 0.0`, exact. A roof therefore loses exactly twice
the sky radiation of a wall at the same temperature — which is why roof insulation is usually the
highest-value intervention.

**Interior boundary** (`surfaces/interior.ts`, done) — `BLUEPRINT.md` 5.8:
```
hConvInterior: wall                      -> 3.08
               floor, warmer than air    -> 4.04   (buoyancy helps: heat flows UP)
               floor, cooler than air    -> 0.95
               roof/ceiling, warmer      -> 0.95   (suppressed: heat would flow DOWN)
               roof/ceiling, cooler      -> 4.04
all multiplied by convectionAltitudeFactor(elevation)
hRadInterior(eps, T_surf, T_star) = 4 * eps * SIGMA * ((T_surf+T_star)/2)^3
SOLAR_TO_FLOOR_FRACTION = 0.6      SOLAR_TO_AIR_FRACTION = 0.05
```
The 4.04 / 0.95 asymmetry (a factor of 4.25) is why **floor-based thermal mass beats ceiling-based
mass** in a direct-gain shelter. The single combined `8.3 W/(m^2*K)` scheme that also appears in
`BLUEPRINT.md` is **discarded**; do not reintroduce it. Interior longwave goes through one
zero-capacity **mean-radiant star node** (ISO 13790 5R1C) — O(N), not an O(N²) view-factor matrix.
Transmitted solar is deposited on surfaces, **never on the air node**: adding it to the air makes
the room overheat at noon and go cold by 8 PM, the classic direct-gain failure.

**Envelope meshing** (`envelope/mesh.ts`, done) — `BLUEPRINT.md` 5.6:
```
diffusivity        a = k / (rho * c)                     [m^2/s]
penetration depth  d = sqrt(a * P / pi),   P = 86400 s
node capacity      capacityPerArea = rho * c * dx        [J/(m^2*K)]  (boundary nodes get HALF)
interface conductance, HARMONIC:  1 / ( dx_A/(2*k_A) + dx_B/(2*k_B) )
```
**Harmonic, not arithmetic.** Arithmetic averaging at a layer interface is the most common silent
bug in this kind of code and is exactly what validation Test 3 catches.
Anchors: dense concrete `a = 8.29e-7`, `d = 0.151 m`; 300 mm dense concrete gives decrement
`f ≈ 0.137` and lag `phi ≈ 7.6 h` — **this is the single number the PPT quotes.**

**Analytical decrement and lag** (semi-infinite periodic solution), the gate:
```
d = sqrt(2a/omega),    f = e^(-x/d),    phi = x/(d*omega),    omega = 2*pi/P
```
| Material | a [m²/s] | d [m] | f @ 0.20 m | φ [h] | f @ 0.40 m | φ [h] |
|---|---|---|---|---|---|---|
| Dense concrete | 8.29e-7 | 0.151 | 0.266 | 5.1 | 0.070 | 10.1 |
| Rammed earth | 5.98e-7 | 0.128 | 0.209 | 6.0 | 0.044 | 11.9 |
| Fired brick | 4.49e-7 | 0.111 | 0.164 | 6.9 | 0.027 | 13.7 |
| EPS | 1.29e-6 | 0.188 | 0.344 | 4.1 | 0.118 | 8.1 |

Pass: numerical `f` within **2 %** of analytical, `phi` within **10 minutes**.

**Windows** (`loads/windows.ts`, done) — `BLUEPRINT.md` 5.9:
```
IAM(cos_theta, b0)  = clamp(1 - b0*(1/cos_theta - 1), 0, 1),  = 0 when cos_theta <= 0
U_effective         = closed ? 1/(1/U + R_shutter) : U
transmittedSolarW   = area * SHGC * IAM * I_T
```
Headline anchor: single glazing `U = 5.80` with `R_shutter = 0.4` gives
`U_eff = 1.75 W/(m^2*K) ± 0.01` — a **70 % reduction** from a wooden shutter.

**Infiltration** (`loads/infiltration.ts`, done) — `BLUEPRINT.md` 5.10:
```
ach       = max(ACH_MIN, achRequested)     unless allowUnsafeVentilation
massFlow  = rho(elevation, T_in) * volume * ach / 3600           [kg/s]
conductance = massFlow * C_P_AIR                                 [W/K]
effectiveAirCapacitance = rho * volume * C_P_AIR * M,   M = 4
```
`M = 4` is a **calibration knob**: bare room air has a laughably small heat capacity, and furniture,
bedding, clothing and thin finishes all respond within minutes and effectively move with the air.
Ignoring them makes the system stiff and the curve unrealistically twitchy. `M = 4` is defensible
standard practice; the comment saying so must stay.
Altitude check: infiltration conductance at Leh density (0.871) is **65 %** of the sea-level value
(1.342) for identical ACH and volume.

**Ground** (`loads/ground.ts`, done) — Kusuda–Achenbach, `BLUEPRINT.md` 5.11:
```
T_g(z,t) = T_mean - A_s * exp(-z*sqrt(pi/(a_soil*P)))
                  * cos( 2*pi/P * ( t - t0 - (z/2)*sqrt(P/(pi*a_soil)) ) ),   P = 365 d
```
`a_soil` default `5e-7 m^2/s`, `t0` = day of minimum surface temperature (default day 20),
default depth 2.0 m. The floor is coupled to **this**, not to ambient air, and not adiabatic.
At 2 m with Leh values (`T_mean = 279.15 K`, `A_s = 12 K`) the January value is **above** a −20 °C
January ambient — the ground is a net heat *source* in midwinter.

**The numerical method** (`solve/`, done) — `BLUEPRINT.md` Part 6:
```
C * dT/dt = K*T + f(t)
(C/dt - theta*K) * T^{n+1} = (C/dt + (1-theta)*K) * T^n + f^{n+1},    theta = 1
```
Backward Euler, **unconditionally stable** — the only acceptable choice given that a user will
legally enter a 1 mm steel skin whose explicit stability limit is ~9.7 s (`CHALLENGE.md` C-08).

**Coefficient-refresh contract (closes `AUDIT.md` F-1 — already implemented).** `h_o` is
wind-driven, `h_r,sky` is temperature-linearised and `h_i` flips by flow direction — all three live
*inside* the matrix and all three change every step. Refactorising a dense LU every step is ~400×
over budget. **Therefore: time-varying coefficients are FROZEN PER WEATHER-HOUR and the matrix is
refactorised only when they are refreshed.** Everything that varies faster — solar, internal gains,
ambient temperature, the schedules — lives in the forcing vector `f(t)`, which is rebuilt **every**
timestep. The factorisation itself is an **arrow/Schur** structure (`solve/schur.ts`): per-wall
tridiagonal chains plus a dense coupling to the air and star nodes, so it is O(N) rather than O(N³).

**Spin-up is convergence-based, not a fixed 72 h.** Repeat the design day until the day-over-day
maximum node temperature change is below `spinUpToleranceK` (default 0.02 K), cap at
`maxSpinUpDays` (default 30), emit a `meta.warnings` entry if the cap is hit, and report the actual
count in `meta.spinUpDaysUsed`. A fixed 72 h window **under-converges for exactly the heavy-wall
designs the tool should be recommending** — `CHALLENGE.md` C-10.

### 7.11 Data-layer schemas

```ts
export interface Material {
  id: string; name: string; nameHi?: string;
  category: 'structural' | 'insulation' | 'finish' | 'storage';
  k: number;            // W/(m*K)
  rho: number;          // kg/m^3
  c: number;            // J/(kg*K)
  alphaSolar: number;   // 0-1
  emissivity: number;   // 0-1
  costPerM3?: number;   // INR
  locallyAvailableLadakh: boolean;
  embodiedCarbon?: number;   // kgCO2e/m^3
  source: string;            // MANDATORY, non-empty, a real citation
  blurb?: string;            // one plain sentence for the UI card. No physics jargon
}

export interface Glazing {
  id: string; name: string; nameHi?: string;
  U: number;        // W/(m^2*K)   -- note the CAPITAL U on disk
  SHGC: number;     // 0-1          -- note the CAPITALS on disk
  tauVis: number; b0: number;
  costPerM2?: number;
  source: string;   // MANDATORY
  blurb?: string;
}
```

⚠ `Material.category` has **no `'glazing'` member** on disk — glazing is its own type. Do not add it.

**`Preset` does not exist yet** and is added by T-06:

```ts
export interface Preset {
  id: string; name: string; nameHi?: string; description: string;
  approximations?: string[];       // e.g. the Trombe caveat -- surfaced in the UI, never hidden
  locationId: string;              // resolves to a bundled TMY file
  request: Omit<SimulationRequest, 'weather' | 'materials' | 'glazings'>;
}
```

**Material property values (`BLUEPRINT.md` Appendix B) — the catalogue T-24 must load in full.**

*Structural & mass:*

| Material | k W/(m·K) | ρ kg/m³ | c J/(kg·K) | a ×10⁻⁷ m²/s |
|---|---|---|---|---|
| Mud brick / adobe | 0.75 | 1700 | 880 | 5.01 |
| Rammed earth | 1.00 | 1900 | 880 | 5.98 |
| Stone masonry (granite) | 2.80 | 2600 | 820 | 13.1 |
| Fired clay brick | 0.72 | 1920 | 835 | 4.49 |
| Dense concrete | 1.75 | 2400 | 880 | 8.29 |
| RCC | 2.10 | 2400 | 880 | 9.94 |
| AAC block | 0.16 | 600 | 1000 | 2.67 |
| Timber (poplar/willow) | 0.14 | 500 | 1600 | 1.75 |
| Compressed earth block | 0.90 | 1800 | 880 | 5.68 |
| Mud plaster | 0.75 | 1600 | 880 | 5.33 |
| Cement plaster | 0.72 | 1860 | 840 | 4.61 |

*Insulation:*

| Material | k | ρ | c |
|---|---|---|---|
| EPS (thermocol) | 0.036 | 20 | 1400 |
| XPS | 0.033 | 35 | 1400 |
| PUF / PIR | 0.025 | 35 | 1400 |
| Glass wool | 0.040 | 24 | 840 |
| Rock wool | 0.038 | 100 | 840 |
| Straw bale | 0.060 | 110 | 2000 |
| Sheep wool | 0.040 | 25 | 1800 |
| Air gap, 25 mm unventilated | R ≈ 0.18 m²K/W (pure resistance) | – | – |

*Other:*

| Material | k | ρ | c |
|---|---|---|---|
| Steel (CGI sheet) | 50 | 7800 | 480 |
| Water (drum storage) | 0.60 | 1000 | 4186 |
| Gravel / soil fill | 1.40 | 2050 | 1840 |
| PCM paraffin RT25 | 0.20 | 880 | 2000 (L_f ≈ 200 kJ/kg, melts ~25 °C) |

*Surface optical properties:*

| Finish | α_s | ε |
|---|---|---|
| Black paint | 0.95 | 0.90 |
| Dark mud / earth | 0.70 | 0.90 |
| Red brick | 0.68 | 0.90 |
| Grey concrete | 0.65 | 0.88 |
| Galvanised steel, weathered | 0.60 | 0.28 |
| Galvanised steel, bright | 0.35 | 0.13 |
| Whitewash / lime | 0.25 | 0.90 |
| White paint | 0.20 | 0.90 |

*Glazing:*

| Type | U W/(m²·K) | SHGC | b₀ |
|---|---|---|---|
| Single glazing | 5.80 | 0.86 | 0.04 |
| Double, air-filled | 2.80 | 0.76 | 0.05 |
| Double, argon + low-E | 1.60 | 0.60 | 0.06 |
| Triple glazing | 0.90 | 0.50 | 0.07 |
| Polycarbonate twin-wall | 3.00 | 0.70 | 0.05 |
| + night shutter | `1/(1/U + R_sh)`, R_sh ≈ 0.3–0.5 m²K/W | unchanged | – |

**Ladakh default parameter set (`BLUEPRINT.md` Appendix C):**

```
site: Leh -- lat 34.15 N, lon 77.58 E, elevation 3500 m,
      standardMeridian 82.5, timezone +5.5 (IST)
groundAlbedo:  summer 0.30 (dry high-altitude desert, higher than the textbook 0.2)
               winter snow 0.75
groundTempMeanAnnual: 279.15 K (~6 degC)
air at 3500 m: pressure 65790 Pa, density at -10 degC = 0.871 kg/m^3
climate reference (from the problem statement itself):
    annual GHI 1900-2100 kWh/m^2/yr, mean sunshine 7.9 h/day, 300+ clear days/yr,
    January mean -8 degC, January min -15 to -20 degC, January max +2 degC
    design day: January 15
comfort:  survival threshold 278.15 K (5 degC);  minimum acceptable 288.15 K (15 degC);
          comfortable 291.15-297.15 K (18-24 degC)
```
⚠ **Do NOT default the comfort band to a 22 °C ASHRAE office band.** For a passive Ladakh shelter
the meaningful KPI is the 06:00 minimum and hours above 15 °C. Every Ladakh preset uses
`comfortBand.lower = 288.15 K`.

**Locations to bundle:** Leh, Kargil, Drass, Nubra, plus **Jaisalmer** (hot-dry contrast) to
demonstrate the generality the problem statement explicitly asks for.

### 7.12 The Prisma schema — the four tables

This is the **complete** database. It is a cache and a share layer, nothing more. There is **no
users table, no auth, no sessions**. Written out here as actual `schema.prisma` source; T-29
creates it at `apps/web/prisma/schema.prisma` verbatim.

```prisma
// apps/web/prisma/schema.prisma
//
// FOUR TABLES. No users. No auth. No sessions.
// The database is a cache and a share layer, never a dependency: every feature on
// the demo path must work with this database stopped. See LOG.md section 9, D-1.

generator client {
  provider = "prisma-client-js"
}

datasource db {
  // Local development: DATABASE_URL="file:./dev.db" with provider "sqlite".
  // Production:        DATABASE_URL="postgresql://..." with provider "postgresql".
  // The provider is switched by the DATABASE_PROVIDER env var at generate time.
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

/// Normalised weather, keyed by the cell we asked for.
/// Purpose: NASA POWER and Open-Meteo are slow and rate-limited. Never fetch the
/// same cell twice. Nothing here is user data.
model WeatherCache {
  id               String   @id @default(cuid())

  /// 'nasa-power' | 'open-meteo'. Matches WeatherProvenance.source.
  source           String
  /// Rounded to 4 decimal places BEFORE hashing, so 34.15001 and 34.15 are one cell.
  latitude         Float
  longitude        Float
  /// Inclusive ISO date bounds of the requested range, e.g. "2020-01-01".
  startDate        String
  endDate          String

  /// The normalised WeatherSeries, Float64Arrays serialised as plain number arrays.
  series           Json
  /// The untouched upstream response, so a parsing bug can be fixed without refetching.
  rawPayload       Json
  /// Elevation the source grid cell represents, metres. Drives the lapse-rate correction.
  sourceElevation  Float?

  fetchedAt        DateTime @default(now())
  /// Rows older than this are stale and must be refetched. Set by the TTL policy in T-31.
  expiresAt        DateTime

  @@unique([source, latitude, longitude, startDate, endDate], name: "weather_cell_key")
  @@index([expiresAt])
}

/// A design saved under a short opaque id so it is retrievable by URL.
/// This is the "OR get a link" half of "designs download as files OR get a link".
model DesignSnapshot {
  id          String   @id @default(cuid())

  /// Short, opaque, URL-safe. Generated by T-32, NOT a sequential integer and NOT
  /// derived from content -- two people saving the same design get two links.
  shareId     String   @unique

  /// A complete SimulationRequest, JSON-serialised. Kelvin throughout.
  request     Json
  /// Optional human label the user typed. Never required.
  label       String?

  createdAt   DateTime @default(now())
  /// Null means "keep indefinitely". A date means a cleanup job may remove it.
  expiresAt   DateTime?

  @@index([createdAt])
}

/// A completed simulation, keyed by a hash of its request.
/// Purpose: the eighteen-scenario survival grid and the design sweep re-ask the
/// same questions constantly. A hit here is free.
model SimulationRun {
  id            String   @id @default(cuid())

  /// SHA-256 of the canonically-serialised SimulationRequest. See T-33 for the
  /// canonicalisation rule -- it must be stable across key order and Float64Array form.
  requestHash   String   @unique

  /// SimulationResult.kpis, JSON.
  kpis          Json
  /// SimulationResult.meta, JSON -- carries energyBalanceResidual and warnings.
  meta          Json
  /// Optional full result (time series). Large; written only when T-33 says so.
  fullResult    Json?

  /// The engine version that produced this. A row from a different version is a MISS,
  /// never a hit -- physics changes invalidate the cache.
  engineVersion String

  computedAt    DateTime @default(now())

  @@index([computedAt])
  @@index([engineVersion])
}

/// The material catalogue, seeded from code (BLUEPRINT.md Appendix B) and served
/// to the client. The code catalogue remains the source of truth; this table is a
/// served copy so the browser does not ship the whole catalogue in its bundle.
model Material {
  id                     String  @id          // matches Material.id in the code catalogue
  name                   String
  nameHi                 String?
  category               String               // structural | insulation | finish | storage
  k                      Float                // W/(m*K)
  rho                    Float                // kg/m^3
  c                      Float                // J/(kg*K)
  alphaSolar             Float                // 0-1
  emissivity             Float                // 0-1
  costPerM3              Float?               // INR
  locallyAvailableLadakh Boolean
  embodiedCarbon         Float?               // kgCO2e/m^3
  /// MANDATORY citation. A row with an empty source is a defect; T-30 asserts it.
  source                 String
  blurb                  String?

  @@index([category])
  @@index([locallyAvailableLadakh])
}
```

### 7.13 Approved dependencies

No task may add anything outside this list. If you need something that is not here, implement it
without, or stop and report.

| Package | Runtime dependencies |
|---|---|
| root (dev only) | `typescript`, `vitest`, `@types/node`, `prettier`, `eslint`, `eslint-config-next` |
| `@shelter/engine` | **ZERO.** Never any. Not prisma, not react, not a numerics library. |
| `@shelter/data` | **ZERO.** TMY payloads are JSON files in the repo. |
| `@shelter/optimise` | `@shelter/engine` only. |
| `apps/web` | `next`, `react`, `react-dom`, `@prisma/client`, `prisma` (dev), `d3-shape`, `d3-scale`, `d3-sankey`, `d3-array`, and their `@types/*` as dev deps. |

PDF export uses the browser's own print pipeline (a print stylesheet plus `window.print()`), **not**
a PDF library. The 3D view, if it is ever built, is the single documented exception and requires an
explicit decision first.

### 7.14 The worker message protocol

Added by T-06. One protocol, used by the browser Web Worker (T-43) and the server worker-thread
pool (T-40), so the two cannot drift.

```ts
export type WorkerRequest =
  | { id: string; kind: 'simulate'; payload: SimulationRequest }
  | { id: string; kind: 'sweep';    payload: SweepRequest }
  | { id: string; kind: 'cancel';   targetId: string };

export type WorkerResponse =
  | { id: string; kind: 'result';      payload: SimulationResult }
  | { id: string; kind: 'sweepResult'; payload: SweepResult }
  | { id: string; kind: 'progress';    done: number; total: number }
  | { id: string; kind: 'error';       code: EngineErrorCode; message: string };
```

Every request carries a caller-generated `id`; every response echoes it. A superseded request (the
user moved the slider again) is cancelled **by id**, never left to race. No stale result may ever
reach the store.

### 7.15 The sweep contract

Added by T-06. Does not exist in any source document — `AUDIT.md` F-3 records that Compare and
Optimise existed only as two words in an ASCII mockup, with no contract, no target and no owner.

```ts
export type VariableSpec =
  | { kind: 'wallConstruction';    values: string[] }
  | { kind: 'insulationThickness'; values: number[] }                       // metres
  | { kind: 'insulationPosition';  values: ('inside'|'outside'|'cavity')[] }
  | { kind: 'roofConstruction';    values: string[] }
  | { kind: 'glazing';             values: string[] }
  | { kind: 'wwr'; orientation: 'S'|'E'|'W'|'N'; values: number[] }         // 0-1
  | { kind: 'buildingAzimuth';     values: number[] }                       // degrees
  | { kind: 'aspectRatio';         values: number[] }
  | { kind: 'nightShutters';       values: boolean[] }
  | { kind: 'massStrategy';        values: ('none'|'floor'|'trombe'|'water'|'pcm')[] }
  | { kind: 'ach';                 values: number[] };

export interface SweepRequest {
  base: SimulationRequest;
  variables: VariableSpec[];
  mode: 'grid' | 'random' | 'nsga2';
  maxVariants: number;                       // hard cap, default 200
  constraints: {
    achMin: number;                          // NEVER below ACH_MIN
    localMaterialsOnly?: boolean;
    budgetCeilingINR?: number;
    fixedFloorArea?: boolean;
  };
  objectives: { metric: keyof SimulationKpis; direction: 'min' | 'max' }[];
}

export interface SweepVariant {
  id: string;
  overrides: Record<string, string | number | boolean>;   // human-readable, for the UI
  kpis: SimulationKpis;
  capitalCostINR: number;
  embodiedCarbonKg: number;
  feasible: boolean;
  infeasibleReason?: string;                 // e.g. "ACH below safety floor"
  paretoRank: number;                        // 1 = on the front
}

export interface SweepResult {
  variants: SweepVariant[];                  // ordered by PRIMARY_METRIC, ties preserved
  ties: string[][];                          // ids grouped where |delta| < RANK_NOISE_FLOOR
  baselineId: string;
  best: SweepVariant;
  meta: { evaluated: number; wallClockMs: number; workers: number; spinUpShared: boolean };
}
```

**Performance budget — a requirement, not an aspiration:** 100 variants over a 72 h simulation
complete in **under 10 s**. The engine's current measured sweep speed (§10) already clears this by
a wide margin, so any sweep that misses it has an orchestration bug, not a physics one.

### 7.16 Environment variables

**The application must run with none of these set.** Every one is an enhancement.

| Name | Used by | Default when unset |
|---|---|---|
| `DATABASE_URL` | T-29…T-35 | unset → the app runs in **DB-off mode**: no cache, no share links, catalogue served from code |
| `DATABASE_PROVIDER` | T-29 | `postgresql`; set to `sqlite` for local dev |
| `NEXT_PUBLIC_ENABLE_LIVE_WEATHER` | T-37, T-45 | `false` — bundled TMY only, fetch UI hidden |
| `NEXT_PUBLIC_DEFAULT_LOCATION` | T-36 | `leh` |
| `NEXT_PUBLIC_DEFAULT_LOCALE` | T-52 | `en` |
| `NASA_POWER_BASE_URL` | T-37 (server only) | the public NASA POWER endpoint |
| `OPEN_METEO_BASE_URL` | T-37 (server only) | the public Open-Meteo endpoint |
| `ANTHROPIC_API_KEY` *(or equivalent)* | T-58 (server only) | unset → the non-AI template write-up is used |

Browser-visible variables are `NEXT_PUBLIC_*`; anything without that prefix is server-only and must
never be referenced from a component or a worker. Both weather sources are **keyless**.

---

## 8. ARCHITECTURE DIAGRAM

```
┌───────────────────────────────────────────────────────────────────────────────────┐
│  TIER 1 — THE BROWSER  (apps/web, client components)                              │
│                                                                                   │
│   5-control form ──► isometric SVG house ──► charts: Temp · Solar · HeatFlow ·    │
│   Advanced panel     click-a-wall              Sankey · survival grid · KPIs      │
│                      time scrubber                                                │
│                      day/night animation ◄── real solar-position code             │
│                                                                                   │
│   ┌─────────────────────────────────────────────────────────────────────────┐     │
│   │ Web Worker:  @shelter/engine  ← THE SAME ENGINE, SECOND COPY            │     │
│   │ • instant preview on slider move (150 ms debounce)                      │     │
│   │ • THE OFFLINE FALLBACK: server unreachable -> run here, on bundled TMY  │     │
│   │   -> full temperature curve, heat-flow breakdown and 3D model still work │     │
│   │   -> banner: "Offline — showing 1 scenario, AI advice unavailable."     │     │
│   └─────────────────────────────────────────────────────────────────────────┘     │
└──────────────────────────────────┬────────────────────────────────────────────────┘
                                   │  HTTP / JSON / SSE      (may be entirely absent)
                                   ▼
┌───────────────────────────────────────────────────────────────────────────────────┐
│  TIER 2 — THE SERVER  (apps/web/app/api/*, Next.js App Router route handlers)      │
│                                                                                   │
│   /api/weather    CORS proxy -> NASA POWER / Open-Meteo, lapse-rate corrected      │
│   /api/simulate   one run                                                         │
│   /api/optimise   sweep, streams progress back as SSE                             │
│   /api/scenarios  the eighteen-scenario matrix                                    │
│   /api/designs    POST a design -> short share id;  GET a share id -> the design   │
│   /api/materials  the catalogue, with every citation                              │
│                                                                                   │
│   ┌──────────────────────────────────┐   ┌──────────────────────────────────┐     │
│   │ worker_threads POOL, one per core│   │ @shelter/optimise                │     │
│   │ each thread holds @shelter/engine│◄──│ expand -> dispatch -> rank        │     │
│   │ THE SAME ENGINE, FIRST COPY      │   │ -> Pareto -> recommendation       │     │
│   └──────────────────────────────────┘   └──────────────┬───────────────────┘     │
│                                                          │                        │
│                                          ┌───────────────▼───────────────────┐    │
│                                          │ AI write-up, two stages:          │    │
│                                          │  1. search = REAL PHYSICS, no AI  │    │
│                                          │  2. write-up = AI, numbers        │    │
│                                          │     verified against the result   │    │
│                                          │     or the text is REJECTED       │    │
│                                          │  no key / no net -> template      │    │
│                                          └───────────────────────────────────┘    │
└──────────────────────────────────┬────────────────────────────────────────────────┘
                                   │  Prisma        (may be entirely absent)
                                   ▼
┌───────────────────────────────────────────────────────────────────────────────────┐
│  TIER 3 — THE DATABASE  (PostgreSQL in production, SQLite for local dev)           │
│                                                                                   │
│   WeatherCache     (source, lat, lon, startDate, endDate) -> series + raw payload  │
│   DesignSnapshot   shareId -> SimulationRequest                                    │
│   SimulationRun    requestHash -> kpis + meta  (+ optional full result)            │
│   Material         the catalogue, every row carrying its citation                  │
│                                                                                   │
│   NO users. NO auth. NO sessions. NO JWT. NO permissions.                          │
│   A CACHE AND A SHARE LAYER — NEVER A DEPENDENCY.                                  │
│   Stop this tier and every demo-path feature still works.                          │
└───────────────────────────────────────────────────────────────────────────────────┘

              ┌──────────────────────────────────────────────────────┐
              │  packages/engine  —  pure TypeScript, ZERO runtime    │
              │  dependencies, no React, no Prisma, no I/O, no        │
              │  network, no global state, no console.                │
              │  simulate(request) -> result. Same in, same out.      │
              │  RUNS IDENTICALLY IN BOTH TIER 1 AND TIER 2.          │
              │  That single property is what makes the offline       │
              │  fallback possible at all.                            │
              └──────────────────────────────────────────────────────┘
```

---

## 9. DEVIATIONS FROM THE FROZEN PLAN

Every place where this ledger departs from the source documents, and why. These are decisions, not
drift. A task that finds itself fighting one of these should re-read it, not route around it.

### D-1 — A thin database tier is added. The "no persistence" cut is PARTIALLY reversed.

`plan.md` §9 ("User accounts, logins, saved projects — nothing to secure, nothing to breach,
nothing to lose. Designs download as files"), `plan.md` Part 2d ("What the server deliberately does
not have: a database"), `TECH.md` §3 ("Persistence: **None**") and `TECH.md` §9.6 ("no auth API, no
user API, no database, no persistence service") all explicitly cut the database.

**That cut is now partially reversed, by decision, as follows.**

**What is added:** a thin server-side persistence tier — Next.js App Router API routes as the
server, Prisma as the client, PostgreSQL in production and SQLite for local development —
persisting **exactly four things**:

1. **Weather cache.** A normalised `WeatherSeries` keyed by `(source, latitude, longitude,
   startDate, endDate)`, stored with the raw upstream payload, the fetch timestamp and the source
   grid elevation. *Reason:* NASA POWER and Open-Meteo are slow and rate-limited, and the
   eighteen-scenario matrix plus the design sweep re-ask for the same cell constantly. Never fetch
   the same cell twice.
2. **Design snapshots.** A `SimulationRequest` stored under a short opaque share id, so a design is
   retrievable by URL. *Reason:* this upgrades "designs download as files" to "designs download as
   files **or** get a link", which is what a field engineer actually wants when emailing a
   colleague at another post.
3. **Simulation runs.** The `SimulationResult` KPIs plus `meta`, keyed by a hash of the request, so
   a repeat run is served from the database. *Reason:* the survival grid re-runs eighteen scenarios
   every time the page loads; there is no reason to recompute an answer that has not changed.
4. **Material catalogue.** The `Material` rows of `BLUEPRINT.md` Appendix B, seeded from code and
   served to the client. Every row keeps its mandatory `source` citation. *Reason:* the browser
   should not ship the whole catalogue in its bundle, and the citations are the thing a judge asks
   about.

**What is still cut, and is not negotiable:** no users table, no authentication, no sessions, no
JWT, no permissions, no telemetry, no analytics. **Do not write auth tasks.** (Global rule 19.)

**What must remain true, and is proved by test in every Area D task:** the database is a **cache
and a share layer, never a dependency**. The offline PWA story in `plan.md` Part 4 survives intact —
with the server and the database both unreachable, the browser still runs the bundled engine on
bundled TMY weather and shows the main scenario, with an honest banner saying so. The engine stays
a pure package with zero runtime dependencies, and **`packages/**` may never import
`@prisma/client`** (global rule 17, lint-enforced in T-03).

### D-2 — npm workspaces, not pnpm.

`WORKERS.md` A1 and W-01 assume `pnpm` workspaces. **The disk is npm workspaces + vitest**, with a
committed `package-lock.json`, and the test suite is green on it. **The disk wins.** Every command
in this ledger is `npm` / `npx`. Do not migrate; there is nothing to gain and a green suite to lose.

### D-3 — Documentation lives at the repository root, not in `docs/`.

`TECH.md` §5 shows a `docs/` directory. On disk every `.md` sits at the root of `SIH/` or of
`shelter-sim/`. `VALIDATION.md`, `EQUATIONS.md` and this file are root-level in `shelter-sim/`.
The `docs/` directory is dropped.

### D-4 — Field names on disk differ from `WORKERS.md` §3.8 in eight places. The disk wins.

| `WORKERS.md` §3.8 | On disk | Consequence |
|---|---|---|
| `Window` | `WindowSpec` | avoids the DOM `Window` global collision |
| `Surface.area` is **gross** | `Surface.area` is **net** of windows | do not subtract twice |
| `Q7_interiorRadiation` | `Q7_interiorLongwave` | rename nothing |
| `heatFlows.storageChange` | `heatFlows.storageRate` | |
| `Glazing.u`, `.shgc` | `Glazing.U`, `.SHGC` | |
| `tAmb`, `ghi`, `windSpeed`, `number[]` | `T_amb`, `GHI`, `v_wind`, `Float64Array` | JSON boundaries convert |
| `provenance: string` | `provenance: WeatherProvenance` object | carries the lapse correction |
| `SimOptions.spinUp: {...}` object | flat `spinUpToleranceK`, `maxSpinUpDays` | |

Resolution used throughout this ledger: **§7 restates the disk, and §7 is authoritative.**

### D-5 — Default timestep is 300 s, not the 60 s `BLUEPRINT.md` suggests.

Justified by measurement, recorded in `packages/engine/src/index.ts`, and re-verified by the
timestep-independence tests in `integrator.test.ts`. See §7.5.

### D-6 — `AUDIT.md` F-1 is already fixed. It is NOT outstanding work.

`AUDIT.md`'s first kill-shot — "the matrix can be factorised once" contradicted by three
time-varying coefficients living inside it — is **closed on disk**. `solve/integrator.ts` freezes
coefficients per weather-hour and refactorises only on refresh, and `solve/schur.ts` implements an
arrow/Schur factorisation so the cost is O(N) rather than O(N³). The measured evidence is in §10.
Any task list that still shows "fix F-1" as pending is out of date; this ledger does not.

### D-7 — `envelope/conduction.ts` and `post/heatFlows.ts` were never separate files.

`TECH.md` §5 lists both. Investigated directly:
- **`envelope/conduction.ts` does not exist.** Its contract was folded into
  `envelope/mesh.ts`, which exports `constructionUValue(mesh, hOuter, hInner)` (the steady-state U
  of a meshed composite wall) and `analyticalWavePenetration(...)`. Validation Test 3 is green
  against it. **This is fine; do not split it out.** A separate `constructions.ts` **is** still
  needed and is T-24's job — but for the *named construction catalogue*, not for conduction physics.
- **`post/heatFlows.ts` does not exist.** `assembleHeatFlows(records, dt)` lives in
  `post/kpis.ts` alongside `computeKpis`. T-22 splits it out into its own file **and** adds the
  missing `deltaT` series while it is there, because that split is cheap and the ΔT series is a
  named problem-statement deliverable.
- **`envelope/response.ts` is not a conduction module.** It is the analytical validation apparatus
  (`driveWall`, `harmonicFit`, `lagSeconds`, `nodeSeries`, `nodeAtDepth`) used by the gate test.
  Leave it where it is.
- **Genuinely missing:** `solar/shading.ts` (T-18), `storage/pcm.ts` (T-19),
  `storage/waterMass.ts` (T-20).

### D-8 — `AUDIT.md` F-6 (ACH coupled to opening area) is still open.

`loads/infiltration.ts` takes `achRequested` directly and applies only the safety floor. There is
**no coupling to glazing area**, so the glazing sweep cannot yet produce the non-monotonic optimum
that `CHALLENGE.md` C-06 and K-05 both test for. T-21 closes it.

### D-9 — `simulate()` already runs without a weather resolver.

`WORKERS.md` W-22 specifies a caller-injected `WeatherRef` resolver. The disk has no `WeatherRef` at
all; the caller always hands over a resolved `WeatherSeries`, and the materials and glazings needed
are handed over inline on the request. This is simpler and preserves the no-I/O property equally
well. Keep it.

---

## 10. THE HARD GATE — **PASSED**

`BLUEPRINT.md` Part 11 and `TECH.md` §14 both mark the transient-conduction solver as a hard gate:
**nothing above it may be built until the analytical tests are green**, because if transient
conduction is wrong, every chart built on top of it displays a wrong answer convincingly — which is
worse than displaying nothing.

**Status: GREEN.** Verified by running it, in this session, on this machine.

```
$ cd /home/abhinav/Downloads/SIH/shelter-sim && npx vitest run

 RUN  v2.1.9 /home/abhinav/Downloads/SIH/shelter-sim

 ✓ packages/engine/test/mesh.test.ts        (12 tests)   16ms
 ✓ packages/engine/test/solar.test.ts       (16 tests)   48ms
 ✓ packages/engine/test/gate.test.ts         (8 tests)  760ms
 ✓ packages/engine/test/integrator.test.ts  (27 tests) 1129ms
 ✓ packages/engine/test/perf.test.ts         (2 tests) 2601ms

   full simulate() incl. spin-up: 31.8 ms/run
   100-variant sweep:             2.39 s

 Test Files  5 passed (5)
      Tests  65 passed (65)
   Duration  3.14s
```

**Which analytical tests are covered, and where:**

| Test | What it validates | File | State |
|---|---|---|---|
| 1 | Steady state — `T_in → T_amb`, then the `Q_aux/(ΣUA + ṁc_p)` offset | `integrator.test.ts` | **GREEN** |
| **2** | ⭐ **Sinusoidal wave through a wall — transient conduction** | `gate.test.ts` | **GREEN** |
| 3 | Composite wall U-value — catches arithmetic-vs-harmonic averaging | `mesh.test.ts` | **GREEN** |
| 4 | Adiabatic box — capacitance assembly, linear rise at `Q/ΣC` | `integrator.test.ts` | **GREEN** |
| 5 | Solar geometry vs an external reference | `solar.test.ts` (analytical altitudes only) | **PARTIAL** — T-23 adds the NOAA literals |
| 6 | Energy conservation, residual < 0.1 % | `integrator.test.ts` | **GREEN** |
| 7 | Mesh and timestep independence | `gate.test.ts` + `integrator.test.ts` | **GREEN** |
| 8 | Symmetry and physical sense (6 assertions) | `integrator.test.ts` | **GREEN** |
| 9 | Published Ladakh field data | — | **NOT STARTED** (human owner; out of scope of this ledger) |
| 10 | ASHRAE 140 / BESTEST | — | **NOT STARTED** (stretch, cuttable) |

**Measured performance, this machine, this session:**

| Budget | Target | Measured |
|---|---|---|
| One full `simulate()` including convergence spin-up | ≤ 50 ms | **31.8 ms** |
| 100-variant design sweep, single-threaded | < 10 s | **2.39 s** |

Note: a prior measurement on this machine recorded 38.3 ms/run and 2.59 s. Run-to-run variance of
roughly ±20 % is normal and both readings clear their budgets comfortably. **Record your own
measured number in your own Evidence block; never copy one from here.**

**Consequence for you:** the gate is green, so every area of this ledger is open for work. If a
change you make turns any of these 65 tests red, **your change is wrong** — the tests encode
closed-form answers that cannot themselves be buggy. Revert, do not loosen.

---

