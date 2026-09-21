# log/contracts/00-core.md — always required, every task, every session

> Extracted from `log/CONTRACTS.md` (the original single-file contracts doc). Read this file in full every session (`LOG.md` §2 ritual step 3) — it is small on purpose. The other files under `log/contracts/` are read only when your Area's README (`log/AREA-<letter>/README.md`) names them for your task.

---

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


### 7.13 Approved dependencies

No task may add anything outside this list. If you need something that is not here, implement it
without, or stop and report.

| Package | Runtime dependencies |
|---|---|
| root (dev only) | `typescript`, `vitest`, `@types/node`, `prettier`, `eslint`, `eslint-config-next` |
| `@shelter/engine` | **ZERO.** Never any. Not prisma, not react, not a numerics library. |
| `@shelter/data` | `@shelter/engine` only (D-10). TMY payloads are JSON files in the repo. |
| `@shelter/optimise` | `@shelter/engine` only. |
| `apps/web` | `next`, `react`, `react-dom`, `@prisma/client`, `prisma` (dev), `d3-shape`, `d3-scale`, `d3-sankey`, `d3-array`, and their `@types/*` as dev deps. |

PDF export uses the browser's own print pipeline (a print stylesheet plus `window.print()`), **not**
a PDF library. The 3D view, if it is ever built, is the single documented exception and requires an
explicit decision first.


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
