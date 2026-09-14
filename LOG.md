# LOG.md — The ShelterSim Build Ledger

**Project:** ShelterSim — software thermal model for area-specific passive shelter design
**Sponsor:** DRDO / DIHAR Leh · **SIH Problem Statement:** 26051
**Repository root for all paths below:** `/home/abhinav/Downloads/SIH/shelter-sim`
**Source documents (read once for background, never required to do a task):**
`plan.md`, `ENGINE_BLUEPRINT.md` (both in this directory) and `../WORKERS.md`, `../TECH.md`,
`../BLUEPRINT.md`, `../CHALLENGE.md`, `../AUDIT.md`, `../TASK.md`,
`../Ladakh_Passive_Shelter_Problem_Statement.md`, `../UI_Input_Design_Reference.md`.

---

## 1. What this file is

This is the **single authoritative build ledger**. It is written so that one instruction is enough:

> *"Read `/home/abhinav/Downloads/SIH/shelter-sim/LOG.md` and continue the project from wherever it was left."*

An agent with no memory of any previous session, no context, and possibly a different model must be
able to open this file, scan down to the first unchecked box whose dependencies are all checked,
read that one entry, and start work immediately — **without opening any other document**.

That is why this file repeats itself. Every contract, constant, equation and tolerance a task needs
is restated **inline, in that task's entry**. A pointer that sends you hunting through another file
is a defect in this ledger, not a convenience. If you find one, fix it in place.

Everything in the source documents that is not restated here is background. You never need it.

---

## 2. START-OF-SESSION RITUAL

Run this in order, every session, before touching anything. Including a session that resumes your
own earlier work.

1. **Verify the toolchain.**
   ```bash
   cd /home/abhinav/Downloads/SIH/shelter-sim
   node --version        # must be >= 20
   npm --version
   ```
   The toolchain is **npm workspaces + vitest**. It is **not** pnpm — ignore `WORKERS.md` W-01,
   which says pnpm. See §9, Deviation D-2.

2. **Run the test suite and record the result.**
   ```bash
   npx vitest run
   ```
   Write down: total test files, total tests, pass/fail, and the two numbers printed by
   `perf.test.ts` (`full simulate() incl. spin-up: N ms/run` and `100-variant sweep: N s`).
   **If the suite is red, your session's first and only job is to find out why and report it.**
   Do not start a new task on a red suite. The last recorded green state is in §10.

3. **Read §7 — THE SHARED CONTRACTS — in full.** Not the headings. The section. Most of the
   failure modes this ledger exists to prevent are contract violations, not coding errors.

4. **Read §6 — GLOBAL RULES — in full.** All 21 of them.

5. **Scan the task list for the first `[ ]` task whose every `Depends on` entry is `[x]`.**
   Read that entry top to bottom.

6. **Confirm no task on its `Conflicts with` line is `[~]` (CLAIMED).** If one is, that file is
   being edited by someone else right now. Pick a different task. Do not "just check whether their
   work looks stale and take it anyway" — that is how two agents end up owning the same file.

7. **Claim it.** Edit the task's Status line in place, in this file:
   ```
   **Status:** CLAIMED by <your agent id> at <ISO-8601 UTC timestamp>
   ```
   and change its heading box from `[ ]` to `[~]`. Save the file. That edit *is* the lock.

8. **Now work.** When you finish, follow §3.

---

## 3. HOW TO MARK A TASK DONE

**A task stays `[ ]` until every single acceptance test in its list passes and the measured numbers
are pasted into its Evidence block.**

Read that again. It is the rule this whole ledger rests on.

- Working code with **one** failing acceptance condition is **NOT DONE**. It is `[ ]`, or `[!]`
  blocked. Not `[x]`.
- "It looks right" is not evidence. "The chart renders" is not evidence. A number with a tolerance
  and the command that produced it is evidence.
- Never tick a box for a test you did not personally run in this session.
- Never loosen a tolerance to make a test pass. If a tolerance is wrong, that is a finding — write
  it in the Evidence block, set the task `[!]`, and say so.
- Paste the **numbers at the moment you measure them**. `VALIDATION.md` (T-63) gets written weeks
  later, possibly by someone else. "Test 2 passed" is worthless to them. "decrement 0.1372 vs
  analytical 0.1370 (0.15%), lag 7.58 h vs 7.60 h" is the validation document writing itself.

When every condition passes:

1. Paste the measured numbers into the Evidence fenced block.
2. Fill in **Completed by** and **Date**.
3. Change the heading box `[~]` → `[x]` and the Status line to `DONE`.
4. **Update the PROGRESS DASHBOARD in §5.** Whoever ticks the box updates the count.
5. Commit, with the task id as the first token of the commit message (`T-18: shading module`).

---

## 4. STATUS LEGEND

| Box | Status line reads | Meaning |
|---|---|---|
| `[ ]` | `NOT STARTED` | Nobody is working on it. Free to claim. |
| `[~]` | `CLAIMED by <agent> at <timestamp>` | In progress. Its files are locked. Do not touch them. |
| `[x]` | `DONE` | Every acceptance test passed and the Evidence block has the numbers. |
| `[!]` | `BLOCKED — <reason> (blocking task: T-nn)` | Started, cannot finish. The reason is stated inline. |

A `[~]` that has not moved in a long time is still a lock. **Never delete a claim to release it.**
Set it to `[!]` with a one-line reason, so what was learned survives.

---

## 5. PROGRESS DASHBOARD

Kept current by whoever ticks a box.

| Area | Name | Done / Total |
|---|---|---|
| A | Foundation & contracts | 1 / 7 |
| B | Engine | 10 / 16 |
| C | Data layer | 0 / 5 |
| D | Database tier | 0 / 7 |
| E | Server tier | 0 / 7 |
| F | Frontend | 0 / 11 |
| G | Decision support | 0 / 5 |
| H | Scenarios | 0 / 3 |
| I | Validation & credibility | 0 / 4 |
| J | Delivery | 0 / 4 |
| | **TOTAL** | **11 / 69** |

**THE HARD GATE: PASSED.** See §10.

---

## 6. GLOBAL RULES

These bind every task. Rules 1–16 are adapted from `WORKERS.md` §7.1; rules 17–21 are new and
govern the database tier that §9 introduces.

1. **Read §7 — the shared contracts — in full before starting any task.** The contracts are the
   thing six parallel workers agree on. Violating one is worse than writing no code at all.

2. **Check the `Conflicts with` line before you start.** If a conflicting task is `[~]`, stop and
   pick another. "It is only one small edit to their file" is how a parallel build becomes a merge
   conflict.

3. **Never touch a file outside your task's `Files you may touch` allow-list.** If your task cannot
   be completed without editing someone else's file, that is a defect in this ledger — stop, write
   the problem into your task's Evidence block, set the task `[!]`, and report. Do not edit across
   the line.

4. **Never add a dependency that is not on the approved list (§7.13).** Implement without it, or
   stop and report. The engine's runtime dependency count is **zero** and stays zero.

5. **Kelvin everywhere inside `packages/*`. Celsius only in `apps/web/lib/units.ts`.**
   A `- 273.15` anywhere else in the repository is a defect **even if the number displayed looks
   right**. Temperature *differences* are plain `number` in Kelvin-degrees and are never branded —
   a ΔT is identical in K and °C, and branding it invites a wrong conversion.

6. **One sign convention: positive adds energy to the modelled system.** The modelled system is
   every solved node — every wall node, the air node, every storage node. Ambient air, the sky and
   deep soil are boundary conditions, outside it. **If you are flipping a sign to make a chart look
   right, you have found a bug, not a fix.**

7. **Do not mark a task complete until every acceptance condition passes.** §3. Not negotiable by
   the task's own agent.

8. **Respect the hard gate.** No task above the solver may be marked `[x]` while the analytical
   gate tests are red. They are green today (§10) — if your change turns them red, your change is
   wrong, not the test.

9. **Never state a validation claim without a number and a named test behind it.** In particular:
   **no ANSYS comparison claim may appear anywhere in this repository, ever**, until an actual
   ANSYS run exists with a stated deviation. `AUDIT.md` F-2 calls the sentence "we match ANSYS"
   the single most dangerous sentence in the plan, because no procedure in this project generates
   that evidence. Delete it wherever you find it.

10. **The ventilation safety floor is not negotiable.** `ACH_MIN = 0.35` air changes per hour.
    No code path — not the engine, not the optimiser, not the API, not a preset, not the AI
    write-up — may produce or recommend a design below it. It is enforced **twice, deliberately**:
    once in `packages/engine/src/loads/infiltration.ts` and again independently in the optimiser's
    constraint check (T-56). Defence in depth is intended, not redundancy to be cleaned up.
    A sealed shelter with a bukhari stove inside is a carbon-monoxide fatality. The thermally
    optimal answer is always "seal it completely", which is exactly why this lives in code and not
    in an operator's judgement.

11. **Every physics function names its source.** One comment line with the equation's name and the
    section it came from, e.g. `// Erbs correlation -- BLUEPRINT.md 5.4 step 3`. A number a judge
    asks about must be traceable. A magic constant nobody can source is a liability.

12. **Anything outside the eleven energy pathways (§7.3) requires a written justification before a
    line is written.** This is the binding cut list: no CFD, no ray-traced shading, no multi-zone
    airflow network, no HVAC equipment models, no moisture transport, no 3-D FEA, no native apps.
    (Persistence was on this list and has been **partially** removed — see §9, Deviation D-1.)

13. **Deliberate simplifications get documented, not hidden.** If your implementation takes a
    shortcut with a known ceiling, say so in a comment naming **the ceiling and the upgrade path**,
    and make sure it reaches the limitations list (T-64) and `EQUATIONS.md` (T-64).
    A simplification volunteered is engineering judgement; the same one discovered by an evaluator
    is a gap.

14. **Leave the calibration knob.** Where a coefficient is empirical rather than derived — the
    air-capacitance multiplier `M`, the lapse rate `Γ`, the shutter resistance, the ACH/opening-area
    coupling — expose it as a **named constant** with a comment saying what evidence would justify
    changing it. A real building drifts from the model; the physical world needs tuning a minimal
    model cannot see.

15. **Log measured numbers at the moment you measure them**, into your task's Evidence block.
    Not into a scratch file, not into your head, not only into test stdout — CI rotates its logs.

16. **Report failures upward; do not fix across boundaries.** A validation task that finds an
    engine bug reports it in its Evidence block and names the owning task. Fixing engine code from
    inside a test file hides the defect and breaks the ownership model.

17. **`packages/**` may never import `@prisma/client`, and never `react`.** Both are enforced by
    the lint rule in T-03 and asserted in CI. The engine is a pure package with zero runtime
    dependencies — it is the thing that runs identically on the server and in the browser, and a
    database client in it destroys that property silently.

18. **The database is a cache and a share layer. It is never a dependency.** Every feature on the
    demo path must work with the database stopped. Every database task in Area D carries an
    acceptance test that proves exactly that, by stopping the database and re-running.

19. **No user accounts. No auth. No sessions. No JWT. No permissions. No users table.**
    Do not write an auth task, do not add an auth library, do not add a `userId` column.
    If a task seems to need one, it does not — re-read §9.

20. **Every row of the material catalogue carries a non-empty `source` citation**, in code and in
    the database, enforced by a schema constraint and by a test. `BLUEPRINT.md` 7.4 makes this
    mandatory. When a judge asks where the rammed-earth conductivity came from,
    "IS 3792 / ASHRAE Handbook of Fundamentals Ch. 26" is an answer; silence is not.

21. **Every number in AI-generated advice text must be findable in the simulation output.**
    Checked automatically; text that fails the check is rejected and the template fallback is used
    instead. The AI translates; the physics decides. See T-58.

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

# THE TASK LIST

69 tasks, grouped by area, in dependency order. Task ids are stable: **never renumber**.
Where a task corresponds to a `WORKERS.md` task the cross-reference is noted as `(≈ W-xx)` on the
Area line — **that pointer is for cross-referencing only. Never read it to find out what to do.
Everything you need is in the entry.**

---

# AREA A — FOUNDATION & CONTRACTS

---

### [x] T-01 — npm workspace root, strict TypeScript, engine package manifest

**Area:** A — Foundation (≈ W-01, partial) · **Status:** DONE · **Est:** 2 h
**Depends on:** none
**Conflicts with:** T-02, T-03, T-04 (all touch root config)

**Why this exists.** Without a workspace root that type-checks and runs tests, nothing else can be
built or verified. This is the floor everything stands on.

**PROMPT — paste this to start the task:**
> Already done. No work required. Recorded here so the ledger is honest about what exists.
> The workspace root is `/home/abhinav/Downloads/SIH/shelter-sim/package.json`, private, with
> `workspaces: ["packages/*"]`, `engines.node >= 20`, scripts `build` / `test` / `typecheck`, and
> devDependencies `typescript ^5.6.3`, `@types/node ^22.9.0`, `vitest ^2.1.5`.
> `tsconfig.base.json` sets `target: ES2022`, `module`/`moduleResolution: NodeNext`,
> `strict: true`, `noUncheckedIndexedAccess: true`, `exactOptionalPropertyTypes: true`,
> `noImplicitOverride: true`, `declaration`, `declarationMap`, `sourceMap`, `composite`,
> `skipLibCheck`, `forceConsistentCasingInFileNames`.
> `packages/engine/package.json` is `@shelter/engine`, `"type": "module"`, **zero runtime
> dependencies**, with `build: tsc -b` and `test: vitest run`.

**Files you may touch.** None — this task is complete.
**Files you may NOT touch.** Everything.

**Subagent guidance.** None. Already done.

**ACCEPTANCE TESTS — the task is NOT done until every one passes:**
1. `cd /home/abhinav/Downloads/SIH/shelter-sim && npx vitest run` exits 0.
2. `npm run typecheck` exits 0.
3. `node -e "console.log(require('./package.json').workspaces)"` prints `[ 'packages/*' ]`.
4. `packages/engine/package.json` contains no `dependencies` key at all.
5. `tsconfig.base.json` contains `"strict": true` and `"noUncheckedIndexedAccess": true`.
6. `grep -rn "\bany\b" packages/engine/src --include=*.ts | grep -v "// " ` returns no standalone
   `any` type annotations.

**Evidence (fill this in when done — numbers, not adjectives):**
```
Verified 2026-09-14 by direct execution on this machine.

1. npx vitest run -> exit 0. 5 test files, 65 tests, 65 passed, 0 failed. Duration 3.14 s.
     mesh.test.ts        12 tests   16 ms
     solar.test.ts       16 tests   48 ms
     gate.test.ts         8 tests  760 ms
     integrator.test.ts  27 tests 1129 ms
     perf.test.ts         2 tests 2601 ms
2. tsc -b packages/engine -> exit 0, no diagnostics.
3. workspaces = [ 'packages/*' ]  CONFIRMED.
4. packages/engine/package.json has no "dependencies" key.  CONFIRMED, zero runtime deps.
5. tsconfig.base.json: strict true, noUncheckedIndexedAccess true, exactOptionalPropertyTypes true,
   noImplicitOverride true, target ES2022, module NodeNext.  CONFIRMED.
6. No standalone `any` annotations found in packages/engine/src (3,065 lines across 24 files).
```

**Completed by:** pre-existing work, verified by the ledger author  **Date:** 2026-09-14

---

### [~] T-02 — Put the project under version control

**Area:** A — Foundation (≈ W-01, the `git init` half) · **Status:** CLAIMED by claude-sonnet-5 at 2026-09-14T05:46:51Z · **Est:** 1 h
**Depends on:** none
**Conflicts with:** none — but do this FIRST, before anyone writes anything

**Why this exists.** **The project has never been under version control.** `git status` in
`/home/abhinav/Downloads/SIH/shelter-sim` returns *"fatal: not a git repository"*. Three thousand
lines of verified, green engine code currently exist in exactly one place with no history and no
undo. Every hour this stays true is an hour where one bad `rm` loses the hard gate.

**PROMPT — paste this to start the task:**
> Put `/home/abhinav/Downloads/SIH/shelter-sim` under git.
>
> 1. `git init` in `/home/abhinav/Downloads/SIH/shelter-sim`. The repository root is
>    `shelter-sim/`, **not** the parent `SIH/` directory — the parent holds the historical design
>    documents and a 670 KB `.pptx`, and those are inputs, not source.
> 2. Verify `.gitignore` already covers `node_modules/`, `dist/`, `*.tsbuildinfo`, `.next/`,
>    `.env`, `.env.local`, `.cache/` — it does. **Append** these lines and nothing else:
>    `*.db`, `*.db-journal`, `prisma/dev.db*`, `.work/BOARD.md`, `coverage/`, `test-output/`.
>    (`.work/BOARD.md` is a generated file; see T-05.)
> 3. Make one initial commit containing everything currently on disk that is not ignored:
>    `package.json`, `package-lock.json`, `tsconfig.base.json`, `.gitignore`, the whole of
>    `packages/engine/src` and `packages/engine/test`, `plan.md`, `ENGINE_BLUEPRINT.md`, `LOG.md`.
>    Commit message: `T-02: initial commit -- engine green at 65/65`.
>    Do **not** commit `packages/engine/dist/` or `tsconfig.tsbuildinfo`.
> 4. Establish the branch protocol and write it into the root `README.md` (create it; keep it under
>    30 lines): **one branch per task, named for the task id in lower case**
>    (`t-18-shading`); **every commit message begins with the task id** (`T-18: ...`), so
>    `git log --grep='^T-18'` shows exactly what a task touched; a task is not `[x]` until both
>    this ledger and the branch are updated.
> 5. Verify `git log --oneline` shows the commit and `git status` is clean.
>
> Do not add a remote, do not push, do not configure hooks, do not install any tooling. Do not
> reformat or touch a single line of engine source — a formatting commit here would bury the one
> commit that matters under noise.

**Files you may touch.** `.gitignore`, `README.md` (create), and git's own metadata.
**Files you may NOT touch.** Every `.ts` file. `package.json`. `tsconfig.base.json`. `LOG.md`
(except your own task's Status/Evidence lines).

**Subagent guidance.** Single agent. Straightforward — do not fan out.

**ACCEPTANCE TESTS — the task is NOT done until every one passes:**
1. `cd /home/abhinav/Downloads/SIH/shelter-sim && git status` exits 0 and does not print
   "not a git repository".
2. `git log --oneline | wc -l` returns at least 1, and the message of the first commit begins with
   `T-02:`.
3. `git status --porcelain` prints nothing — the working tree is clean.
4. `git ls-files | grep -c "^packages/engine/src/"` returns **24** (the current source file count).
5. `git ls-files | grep -c "dist/"` returns **0** — build output is not committed.
6. `git ls-files | grep -c "node_modules"` returns **0**.
7. `git ls-files | grep -c "^LOG.md$"` returns **1**.
8. `npx vitest run` still exits 0 with 65/65 — nothing was disturbed.
9. `README.md` exists, is under 30 lines, and contains the literal strings `one branch per task`
   and `git log --grep`.
10. `git show --stat HEAD | grep -c "\.ts "` is greater than 30 — the source really is in there.

**Evidence (fill this in when done — numbers, not adjectives):**
```
```

**Completed by:** ___  **Date:** ___

---

### [ ] T-03 — ESLint, Prettier, and the two boundary rules

**Area:** A — Foundation (≈ W-01, the lint half) · **Status:** NOT STARTED · **Est:** 3 h
**Depends on:** T-02
**Conflicts with:** T-04 (both add root config), T-06 (do not run concurrently with a types edit)

**Why this exists.** Two architectural rules hold this project together and neither can be enforced
by review at the speed six workers move: `packages/**` may never import `react`, and `packages/**`
may never import `@prisma/client`. The first keeps the engine runnable in a Node worker thread; the
second keeps it runnable in a browser at all. A single violation is silent until the offline
fallback dies on demo day.

**PROMPT — paste this to start the task:**
> Add lint and format configuration to `/home/abhinav/Downloads/SIH/shelter-sim`.
>
> 1. Install as **root devDependencies only**: `eslint`, `prettier`, and the TypeScript ESLint
>    parser/plugin. Nothing else. Do not install `eslint-config-next` yet — `apps/web` does not
>    exist. (T-36 adds it when it creates the app.)
> 2. Create `.prettierrc` with exactly: 2-space indent, single quotes, semicolons,
>    100-column print width, trailing commas `all`. These match the existing engine source; a
>    config that disagrees would rewrite 3,000 verified lines and bury the diff.
> 3. Create `eslint.config.js` (flat config). Rules that must be on:
>    - `no-restricted-imports` scoped to `packages/**/*.ts`, forbidding the patterns
>      `react`, `react-dom`, `react/*`, `@prisma/client`, `prisma`, `next`, `next/*`.
>      The message must name the reason, e.g.
>      `"packages/** must stay pure: no React, no Prisma, no Next. LOG.md global rules 17 and 4."`
>    - `@typescript-eslint/no-explicit-any`: error.
>    - `no-console` scoped to `packages/**/*.ts`: error. (The engine has no logger by design —
>      everything it wants to say comes back in the return value or an `EngineError`.)
>    - Ignore `dist/`, `node_modules/`, `**/*.d.ts`, `packages/engine/test/**` for `no-console`
>      only (tests legitimately print measured numbers, which the ledger depends on).
> 4. Add root scripts: `"lint": "eslint ."` and `"format": "prettier --write ."` and
>    `"format:check": "prettier --check ."`.
> 5. Run `npm run lint` and fix **only** genuine violations of the rules above. If the existing
>    engine source trips a stylistic rule, **turn the rule off — do not rewrite the engine.**
>    The engine is green and verified; lint exists to protect it, not to churn it.
> 6. Run `npx vitest run` and confirm still 65/65.
>
> Do not add a formatting-only commit that touches engine source. Do not enable
> `@typescript-eslint/recommended` wholesale — pick the individual rules above.

**Files you may touch.** `eslint.config.js` (create), `.prettierrc` (create), `.prettierignore`
(create), the root `package.json` (scripts + devDependencies only).
**Files you may NOT touch.** Any file under `packages/engine/src` or `packages/engine/test`.
`tsconfig.base.json`. `.gitignore`.

**Subagent guidance.** Single agent. Straightforward — do not fan out.

**ACCEPTANCE TESTS — the task is NOT done until every one passes:**
1. `npm run lint` exits 0 on the tree as it stands.
2. `npm run format:check` exits 0 — no file needs reformatting.
3. **The React rule bites.** Append `import React from 'react';` to
   `packages/engine/src/air.ts`, run `npm run lint`, confirm it exits **non-zero** and the message
   names `packages/**`. **Revert the edit and re-run lint to confirm 0.** Paste both exit codes.
4. **The Prisma rule bites.** Same procedure with `import { PrismaClient } from '@prisma/client';`.
   Non-zero, then revert, then 0. Paste both exit codes.
5. **The `any` rule bites.** Same procedure with `const x: any = 1;`. Non-zero, then revert.
6. **The console rule bites in src but not in test.** `console.log('x')` added to
   `packages/engine/src/air.ts` fails lint; the same line added to
   `packages/engine/test/perf.test.ts` does not. Paste both exit codes.
7. `npx vitest run` still exits 0 with 65/65 after all of the above are reverted.
8. `git diff --stat` shows **zero** lines changed under `packages/engine/src/`.
9. `node -e "const p=require('./package.json'); console.log(Object.keys(p.dependencies||{}).length)"`
   prints `0` — lint tooling went into devDependencies.

**Evidence (fill this in when done — numbers, not adjectives):**
```
```

**Completed by:** ___  **Date:** ___

---

### [ ] T-04 — Continuous integration

**Area:** A — Foundation (≈ W-01, the CI half) · **Status:** NOT STARTED · **Est:** 2 h
**Depends on:** T-02, T-03
**Conflicts with:** none

**Why this exists.** The energy-balance residual is the project's cheapest and most persuasive
credibility signal, and it is only worth anything if it is asserted **on every commit** rather than
claimed in a document. CI is also the only thing that answers "is the gate actually green right
now" without trusting anyone's self-report.

**PROMPT — paste this to start the task:**
> Create `.github/workflows/ci.yml` in `/home/abhinav/Downloads/SIH/shelter-sim`.
>
> One job, `verify`, on `push` and `pull_request`, running on `ubuntu-latest` with Node 20,
> executing **in this order** and failing the build on the first non-zero exit:
> 1. `npm ci`
> 2. `npm run typecheck`
> 3. `npm run lint`
> 4. `npm run format:check`
> 5. `npx vitest run`
>
> Then add a sixth step, `energy-balance-gate`, that is the point of the whole file. Create
> `scripts/ci-energy-balance.mjs` which imports `simulate` from the built engine, runs it over every
> fixture currently exported from `packages/engine/test/fixtures.ts` plus every preset once T-28
> lands, reads `result.meta.energyBalanceResidual` from each, **prints each one as
> `<name>: residual <value>`**, and exits non-zero if any is `>= 1e-3`. Print the maximum observed
> residual as the final line, as `MAX RESIDUAL: <value>`, so the number is greppable out of CI logs
> for `VALIDATION.md` (T-63).
>
> Threshold: `1e-3`, a **dimensionless fraction** meaning 0.1 %. Do not change it. Do not print it
> as a percentage in the script — the UI does that conversion, not CI.
>
> Also add a step that runs `npx vitest run packages/engine/test/gate.test.ts` **separately and
> first among the test steps**, and name the step literally `THE HARD GATE`, so a red gate is
> visible in the job summary without opening the log.
>
> Do not add code coverage, do not add a matrix of Node versions, do not add caching beyond
> `actions/setup-node`'s built-in npm cache, do not add a deploy step.

**Files you may touch.** `.github/workflows/ci.yml` (create), `scripts/ci-energy-balance.mjs`
(create), the root `package.json` (one added script only).
**Files you may NOT touch.** Any engine source or test. `eslint.config.js`. `.prettierrc`.

**Subagent guidance.** Single agent. Straightforward — do not fan out.

**ACCEPTANCE TESTS — the task is NOT done until every one passes:**
1. `node scripts/ci-energy-balance.mjs` exits 0 locally and prints one `residual` line per fixture.
2. Its final line matches `^MAX RESIDUAL: ` and the value is `< 1e-3`. Paste the exact value.
3. Editing `packages/engine/src/post/energyBalance.ts` to include `Q5` in the boundary set makes
   the script exit **non-zero** and the reported residual exceed 0.01. **Revert.** Paste both
   residual values (with and without the injected fault) — this is the negative control that proves
   the gate is not vacuous.
4. `.github/workflows/ci.yml` parses: `npx --yes js-yaml .github/workflows/ci.yml > /dev/null`
   exits 0 (or any equivalent YAML parse check).
5. The workflow contains a step named literally `THE HARD GATE`.
6. The workflow's steps appear in the order: install, typecheck, lint, format:check, gate, tests,
   energy balance. Verify by reading the file and pasting the step names in order.
7. Running every workflow command locally in sequence, each exits 0 and the whole sequence takes
   under 3 minutes. Paste the wall-clock time.
8. The workflow references no secret and no environment variable — this project has no API keys on
   the CI path.

**Evidence (fill this in when done — numbers, not adjectives):**
```
```

**Completed by:** ___  **Date:** ___

---

### [ ] T-05 — The `.work/` claim ledger and `board.sh`

**Area:** A — Foundation (≈ W-01 / W-9.x) · **Status:** NOT STARTED · **Est:** 2 h
**Depends on:** T-02
**Conflicts with:** none

**Why this exists.** This file (`LOG.md`) is the human-readable ledger, but a status edit inside a
5,000-line markdown file is not an atomic lock — two agents can both read `[ ]`, both edit, and both
believe they own a task. `.work/<ID>.md` created with shell `noclobber` **is** atomic: the file
system arbitrates. Without it, parallel work on this project is a coin flip.

**PROMPT — paste this to start the task:**
> Create the claim ledger under `/home/abhinav/Downloads/SIH/shelter-sim/.work/`.
>
> **`.work/TEMPLATE.md`** — the shape every task file copies, exactly these fields:
> ```
> id:
> title:
> status: CLAIMED          # CLAIMED | BLOCKED | DONE | ABANDONED
> owner:
> claimed:
> completed:
>
> ## Files created or changed
>
> ## Verification results
> (one line per numbered acceptance test in LOG.md, WITH THE MEASURED NUMBER)
>
> ## Deviations and notes for downstream tasks
>
> ## Blocked by
> (only when status is BLOCKED)
> ```
>
> **`.work/claim.sh`** — a 6-line script taking a task id. It must use a **shell redirection with
> `noclobber`**, not `cp`: `noclobber` governs `>` only, and `cp TEMPLATE.md T-18.md` silently
> overwrites an existing claim and is therefore not a lock.
> ```bash
> #!/usr/bin/env bash
> # Claim a task. The file IS the lock. Usage: .work/claim.sh T-18 <owner>
> cd "$(dirname "$0")" || exit 1
> set -o noclobber
> cat TEMPLATE.md > "$1.md" 2>/dev/null \
>   || { echo "$1 is already claimed:"; head -6 "$1.md"; exit 1; }
> sed -i "s/^id:.*/id: $1/; s/^owner:.*/owner: ${2:-unknown}/; s/^claimed:.*/claimed: $(date -u +%F)/" "$1.md"
> echo "claimed $1"
> ```
>
> **`.work/board.sh`** — about fifteen lines of `grep` over the task files, regenerating
> `.work/BOARD.md`. It prints a header saying the file is generated and must never be hand-edited,
> a line reporting whether `npx vitest run` last passed (read from `.work/GATE` if present, else
> `UNKNOWN`), a table of `| Task | Status | Owner | Claimed | Completed |` built from the task
> files, a footnote that an absent file means the task is `TODO`, and a `DONE: n / 69` count.
> Use a `field()` helper of the form `grep -m1 "^$2:" "$1" | sed 's/^[^:]*: *//'` so an empty field
> renders empty rather than echoing the key.
>
> **`.work/README.md`** — at most 15 lines, stating: absence of `.work/<ID>.md` means TODO; the
> claim is the file; **never delete a task file to release it** — set `status: ABANDONED` with a
> one-line reason, because a stale `CLAIMED` blocks its conflict row forever while a deleted file
> loses everything that was learned; and that `BOARD.md` is generated and hand-edits are lost.
>
> Run `bash .work/board.sh` once against an empty directory and commit the generated `BOARD.md`
> path to `.gitignore` (T-02 already added it).
>
> Do not build a web dashboard. Do not add a dependency. Do not write a task file for any task.

**Files you may touch.** Everything under `.work/`.
**Files you may NOT touch.** `LOG.md` (except your own Status/Evidence lines). Any engine source.
Any root config other than nothing.

**Subagent guidance.** Single agent. Straightforward — do not fan out.

**ACCEPTANCE TESTS — the task is NOT done until every one passes:**
1. `bash .work/board.sh` exits 0 with no task files present and writes `.work/BOARD.md`.
2. That `BOARD.md` contains the literal string `never hand-edit` and a line reading `DONE: 0 / 69`.
3. `bash .work/claim.sh T-99 tester` exits 0 and creates `.work/T-99.md`.
4. **The lock actually locks:** running `bash .work/claim.sh T-99 other` a second time exits
   **non-zero**, prints `already claimed`, and `.work/T-99.md` is **byte-identical** to before
   (verify with `md5sum` before and after; paste both hashes).
5. `.work/T-99.md` has `id: T-99`, `owner: tester`, and today's date in `claimed:`.
6. `bash .work/board.sh` now lists T-99 with status `CLAIMED` and owner `tester`.
7. Setting `status: DONE` in `.work/T-99.md` and re-running `board.sh` makes the count read
   `DONE: 1 / 69`.
8. `cp .work/TEMPLATE.md .work/T-99.md` **does** overwrite (this is the whole reason `claim.sh`
   uses a redirection) — confirm it, then confirm `claim.sh` still refuses. Document both in your
   Evidence so the next agent knows why `cp` is banned.
9. Delete `.work/T-99.md` and `.work/BOARD.md` when finished; `git status --porcelain` shows only
   the intended new files.
10. `grep -c "" .work/board.sh` returns fewer than 25 — it stays a script, not a tool.

**Evidence (fill this in when done — numbers, not adjectives):**
```
```

**Completed by:** ___  **Date:** ___

---

### [ ] T-06 — Extend the shared contract with the types the rest of the build needs

**Area:** A — Foundation (≈ W-02) · **Status:** NOT STARTED · **Est:** 5 h
**Depends on:** T-01
**Conflicts with:** **every other task** — `types.ts` and `constants.ts` are read by all of them
and writable only by this one. Run it alone.

**Why this exists.** Eight areas of this build need types that do not exist on disk yet:
`Preset`, `StorageElement`, `WorkerRequest`/`WorkerResponse`, `SweepRequest`/`SweepVariant`/
`SweepResult`, `VariableSpec`, the `DATA_SCHEMA_MISMATCH` error code, the ranking constants, and the
`Float64Array` ⇄ `number[]` JSON boundary helpers. Without them every downstream task invents its
own and they silently diverge. This task adds them **once**, and then `types.ts` is frozen again.

**PROMPT — paste this to start the task:**
> Extend, do not rewrite, `packages/engine/src/types.ts` and `packages/engine/src/constants.ts`.
> **Change no existing field, no existing name, no existing shape.** 65 tests depend on them and
> the whole rest of this ledger restates them as the contract. You are adding, only.
>
> **In `types.ts`, add:**
>
> 1. `StorageElement`, and an optional `storageElements?: StorageElement[]` on `Building`:
>    ```ts
>    export interface StorageElement {
>      id: string;
>      kind: 'water' | 'pcm' | 'rock';
>      materialId: string;
>      massKg: number;
>      surfaceAreaToRoom: number;    // m^2
>      conductanceToRoom: number;    // W/K
>      meltPoint?: Kelvin;           // pcm only
>      meltRangeK?: number;          // pcm only, default 3
>      latentHeat?: number;          // pcm only, J/kg
>    }
>    ```
>    Adding the optional field to `Building` must not break any existing test. Verify.
>
> 2. `Preset`, exactly as §7.11 of `LOG.md` states it, with the `approximations?: string[]` field —
>    that array is how a preset that is an approximation (the Trombe wall) says so out loud in the
>    UI instead of hiding it.
>
> 3. `WorkerRequest` and `WorkerResponse`, exactly as §7.14 of `LOG.md` states them.
>
> 4. `VariableSpec`, `SweepRequest`, `SweepVariant`, `SweepResult`, exactly as §7.15 states them.
>
> 5. `'DATA_SCHEMA_MISMATCH'` added to `EngineErrorCode`.
>
> 6. **JSON boundary helpers**, in a new file `packages/engine/src/serialise.ts` (not in
>    `types.ts` — it must stay declaration-only apart from the class):
>    ```ts
>    export function seriesToJson(a: Float64Array): number[];
>    export function seriesFromJson(a: number[]): Float64Array;
>    export function requestToJson(r: SimulationRequest): unknown;
>    export function requestFromJson(j: unknown): SimulationRequest;
>    export function resultToJson(r: SimulationResult): unknown;
>    export function resultFromJson(j: unknown): SimulationResult;
>    ```
>    These are the **only** place in the repository permitted to convert between `Float64Array` and
>    `number[]`. Every API route, every worker message and every database write goes through them.
>    `requestFromJson` must throw `EngineError('DATA_SCHEMA_MISMATCH')` on a shape it does not
>    recognise, with a `detail` naming the offending path — never return a half-built object.
>
> 7. A `canonicalRequestHash(r: SimulationRequest): string` in the same file: SHA-256 (via
>    `node:crypto` when available, else a small pure fallback so the browser can use it too) over a
>    **canonical** serialisation — object keys sorted recursively, `Float64Array` rendered as a
>    plain array, floats rounded to 9 significant figures so that `0.1+0.2` noise does not produce a
>    cache miss. This hash is the key for the `SimulationRun` table (T-33). Document the
>    canonicalisation rule in a comment above it, because the database depends on it being stable.
>
> **In `constants.ts`, add** exactly the block listed in `LOG.md` §7.9 under "Constants that do NOT
> yet exist": `PRIMARY_METRIC`, `SECONDARY_METRIC`, `RANK_NOISE_FLOOR = 0.05`,
> `ACH_MIN_COMBUSTION_ALLOWANCE = 0.35`, and the four kerosene constants. Above
> `KEROSENE_INR_PER_L = 80` write the comment: *no source document states a kerosene price; this is
> an assumption; it is editable in the UI and the PPT must cite whatever value is used.*
> Do **not** add `ACH_PER_GLAZING_FRACTION` here — that belongs to T-21, which owns its
> calibration comment.
>
> Above the `HeatFlows` interface, confirm the existing sign-convention comment block is present and
> complete (it is). Above `energyBalanceResidual`, confirm the residual definition comment is
> present (it is). Do not duplicate them.
>
> Add unit tests in `packages/engine/test/serialise.test.ts`.

**Files you may touch.** `packages/engine/src/types.ts`, `packages/engine/src/constants.ts`,
`packages/engine/src/serialise.ts` (create), `packages/engine/test/serialise.test.ts` (create).
**Files you may NOT touch.** Every other file in the repository. In particular `index.ts`,
`units.ts`, anything under `solve/`, `post/`, `loads/`, `surfaces/`, `solar/`, `envelope/`.

**Subagent guidance.** Single agent. The pieces are small and they all land in two files — fanning
out would just create a merge problem inside `types.ts`, which is the exact file this project most
needs to stay coherent.

**ACCEPTANCE TESTS — the task is NOT done until every one passes:**
1. `npm run typecheck` exits 0.
2. `npx vitest run` exits 0 with **at least 65** tests passing — no pre-existing test changed
   behaviour. Paste the new total.
3. `git diff packages/engine/src/types.ts | grep -c '^-'` returns **0** (excluding the diff header
   line) — you added, you did not modify or delete.
4. A scratch file with `const x: Kelvin = 20;` fails to compile; `toK(20 as Celsius)` compiles.
   Delete the scratch file. Paste the compiler error text.
5. `seriesFromJson(seriesToJson(a))` returns a `Float64Array` element-wise equal to `a` for a
   1,000-element random array, to exact bit equality. Assert with `expect(...).toEqual(...)`.
6. `requestFromJson(JSON.parse(JSON.stringify(requestToJson(req))))` round-trips a full
   `SimulationRequest` to deep equality — including `Float64Array` fields coming back as
   `Float64Array`, not as `Array`. Assert `instanceof Float64Array`.
7. `requestFromJson({})` throws `EngineError` with code `DATA_SCHEMA_MISMATCH` and a non-empty
   `detail`. It does **not** return an object.
8. `canonicalRequestHash` returns the identical string for two requests that differ only in object
   key insertion order. Build both explicitly in the test.
9. `canonicalRequestHash` returns a **different** string when any one physical field changes —
   test at least `site.elevation`, `building.volume`, and `operation.achSchedule[3]`.
10. `canonicalRequestHash` is stable across a `Float64Array` and the equivalent `number[]` form of
    the same weather series.
11. `RANK_NOISE_FLOOR === 0.05` and `ACH_MIN_COMBUSTION_ALLOWANCE === 0.35`, and
    `ACH_MIN + ACH_MIN_COMBUSTION_ALLOWANCE === 0.70` — the bukhari case floor.
12. `grep -c "ACH_PER_GLAZING_FRACTION" packages/engine/src/constants.ts` returns **0** (it belongs
    to T-21).

**Evidence (fill this in when done — numbers, not adjectives):**
```
```

**Completed by:** ___  **Date:** ___

---

### [ ] T-07 — Canonical test fixtures, including the C-01 kill-shot pair

**Area:** A — Foundation (≈ W-04) · **Status:** NOT STARTED · **Est:** 5 h
**Depends on:** T-06
**Conflicts with:** T-23, T-62 (they import these fixtures and must never edit them)

**Why this exists.** `packages/engine/test/fixtures.ts` is currently 25 lines. Six downstream
validation and UI tasks each need a canonical test shelter, and if each invents its own they produce
incomparable results and the validation document becomes a pile of unrelated numbers. More
importantly, **`CHALLENGE.md` C-01 — the single most likely way this project is quietly,
confidently wrong — needs a specific pair of shelters that does not exist yet.**

**PROMPT — paste this to start the task:**
> Extend `packages/engine/test/fixtures.ts`. **Add; do not change what is already exported** —
> 65 tests import from it.
>
> Export, as plain serialisable literals with **no import from `@shelter/data`** (validation must
> not depend on catalogue churn):
>
> 1. **`MAT`** — a frozen record of material properties, values taken **exactly** from
>    `BLUEPRINT.md` Appendix B as restated in `LOG.md` §7.11:
>    `stone` (k 2.80, ρ 2600, c 820), `denseConcrete` (1.75, 2400, 880),
>    `rammedEarth` (1.00, 1900, 880), `firedBrick` (0.72, 1920, 835),
>    `eps` (0.036, 20, 1400), `puf` (0.025, 35, 1400),
>    `steel` (50, 7800, 480), `mudPlaster` (0.75, 1600, 880),
>    `water` (0.60, 1000, 4186), `pcmRt25` (0.20, 880, 2000).
>    Each with `alphaSolar` and `emissivity` from the optical table (dark mud 0.70/0.90,
>    grey concrete 0.65/0.88, weathered galvanised steel 0.60/0.28), a `source` string, and
>    `locallyAvailableLadakh` set honestly (earth, stone, timber, straw, sheep wool true;
>    EPS/XPS/PUF/PCM false — they cross the Zoji La).
>
> 2. **`shelterA_stone400` and `shelterB_steelPuf`** — the `CHALLENGE.md` C-01 pair. **Identical**
>    internal volume, floor plan, glazing area, orientation, operation schedule and weather.
>    - A: 400 mm stone masonry wall.
>    - B: 1 mm steel skin + 50 mm PUF, with a steady-state U-value **equal to or better than** A's.
>    The fixture is only a valid C-01 test **if B is the better-insulated one** — otherwise the
>    test proves nothing, because B could win on insulation alone. Compute both U-values in the
>    fixture file with `constructionUValue` from `envelope/mesh.ts` and assert the relationship.
>
> 3. **`singleWallSemiInfinite(materialKey, thicknessM)`** — the Test 2 case: one homogeneous wall,
>    sinusoidal exterior temperature, interior held constant, zero solar. (The existing gate test
>    already drives walls via `envelope/response.ts`; this wraps that into a named fixture.)
>
> 4. **`adiabaticBox(gainW)`** — the Test 4 case: all exterior conductances zero, constant internal
>    gain. Note this needs `allowUnsafeVentilation: true`, which is the one legitimate use of that
>    flag; comment it so nobody copies the pattern into production code.
>
> 5. **`steadyStateBox(qAuxW)`** — the Test 1 case.
>
> 6. **`sineWeather(meanK, amplitudeK, periodS, steps)`** and **`constantWeather(tK, steps)`** —
>    synthetic `WeatherSeries` builders with
>    `provenance: { source: 'synthetic', label: 'synthetic test fixture', sourceElevation: null,
>    lapseCorrectionK: 0, notes: [] }`.
>
> Create `packages/engine/test/helpers.ts` exporting:
> - `decrementAndLag(series, dtSeconds, periodS)` → `{ f, phiHours }` by comparing input and output
>   sinusoid amplitude and peak offset. (`envelope/response.ts` already has `harmonicFit` and
>   `lagSeconds`; **use them, do not reimplement.** Global ladder rule: reuse before write.)
> - `analyticalDecrementLag(a, thicknessM, periodS)` → the closed form
>   `d = sqrt(2a/omega)`, `f = e^(-x/d)`, `phi = x/(d*omega)`, `omega = 2*pi/P`.
> - `assertWithin(actual, expected, tol, label)` which **prints the measured pair** on both pass
>   and fail, because `VALIDATION.md` (T-63) is assembled from that output.
>
> Write no tests of your own. You are building the apparatus; other tasks write the tests.

**Files you may touch.** `packages/engine/test/fixtures.ts`, `packages/engine/test/helpers.ts`
(create).
**Files you may NOT touch.** Any file under `packages/engine/src`. Any existing `*.test.ts`.
`packages/engine/test/box.ts` and `packages/engine/test/` response helpers — import them, do not
edit them.

**Subagent guidance.** Single agent. Two files, one coherent piece of apparatus — splitting it
across agents guarantees the C-01 pair and the helpers disagree about units.

**ACCEPTANCE TESTS — the task is NOT done until every one passes:**
1. `npx vitest run` still exits 0 with the pre-existing 65 tests passing unchanged.
2. `analyticalDecrementLag(8.29e-7, 0.30, 86400)` returns `f = 0.137 ± 0.002` and
   `phiHours = 7.6 ± 0.1` — the worked example in `BLUEPRINT.md` 5.6.5, and the single number the
   PPT quotes. Paste both computed values.
3. `analyticalDecrementLag(5.98e-7, 0.20, 86400)` returns `f = 0.209 ± 0.01`,
   `phiHours = 6.0 ± 0.2` (rammed earth, `BLUEPRINT.md` 9.2). Paste both.
4. `analyticalDecrementLag(4.49e-7, 0.20, 86400)` returns `f = 0.164 ± 0.01`,
   `phiHours = 6.9 ± 0.2` (fired brick). Paste both.
5. `decrementAndLag` fed a synthetic pair of sinusoids with a known 0.5 amplitude ratio and a known
   3 h offset recovers both to within **1 %** and **5 minutes**.
6. `shelterA_stone400.building.volume === shelterB_steelPuf.building.volume` and the same for
   `floorArea` and total window area, each to within 1e-9. Paste the three pairs.
7. **The C-01 validity condition:** B's hand-computed steady-state U-value is **≤** A's. Paste both
   U-values in W/(m²·K). If B's is higher the fixture is invalid and the task is not done.
8. `MAT.denseConcrete.k / (MAT.denseConcrete.rho * MAT.denseConcrete.c)` equals `8.29e-7 ± 1e-9` —
   the diffusivity every validation test depends on.
9. `MAT.rammedEarth` diffusivity equals `5.98e-7 ± 1e-9`; `MAT.firedBrick` equals `4.49e-7 ± 1e-9`.
10. Both shelter fixtures survive `JSON.parse(JSON.stringify(x))` unchanged after
    `requestToJson`/`requestFromJson` (they must be plain serialisable data).
11. Every entry in `MAT` has a non-empty `source` string.
12. `simulate(shelterA_stone400)` and `simulate(shelterB_steelPuf)` both return without throwing,
    both have `meta.energyBalanceResidual < 1e-3`. Paste both residuals.

**Evidence (fill this in when done — numbers, not adjectives):**
```
```

**Completed by:** ___  **Date:** ___

---

# AREA B — ENGINE

> **Ten of these sixteen are already done and verified.** They are recorded with their real
> measured evidence so that a cold agent can see exactly what exists and does not rebuild it.
> The six unchecked tasks are the genuine remainder. Read §10 before starting any of them: the
> analytical gate is green, and if your change turns it red, your change is wrong.

---

### [x] T-08 — Linear algebra: dense LU, Thomas, and the arrow/Schur factorisation

**Area:** B — Engine (≈ W-05) · **Status:** DONE · **Est:** 8 h
**Depends on:** T-01 · **Conflicts with:** none

**Why this exists.** A dependency-free linear solver the team fully understands, so that when a
judge asks "what solver do you use", the answer is a file you can open, not a library name.

**PROMPT — paste this to start the task:**
> Already done. `packages/engine/src/solve/linalg.ts` (122 lines) exports `luFactor` (dense,
> row-major `Float64Array`, partial pivoting, throws `EngineError('SINGULAR_MATRIX')` on a pivot
> below tolerance), `luSolve` (forward/back substitution, non-mutating, reusable factorisation),
> `thomas` (O(n) tridiagonal) and `residualInf`. `packages/engine/src/solve/schur.ts` (218 lines)
> exports `triFactor`/`triSolve`/`triSolveAt` and `factorArrow`/`solveArrow` — the arrow-matrix
> structure (per-wall tridiagonal chains + dense coupling to the air and star nodes) that makes the
> whole solve O(N) instead of O(N³) and is what actually delivers the performance budget.

**Files you may touch.** None — complete.
**Files you may NOT touch.** Everything.
**Subagent guidance.** None.

**ACCEPTANCE TESTS:**
1. `npx vitest run` exits 0. 2. `luSolve` reused on one factorisation with two different
right-hand sides returns two different correct answers (§7.10's refresh contract depends on it).
3. `thomas` and `luSolve` agree to 1e-10 on the same tridiagonal system. 4. A singular matrix
throws `SINGULAR_MATRIX` rather than returning `NaN`. 5. `residualInf` is available for tests.
6. Zero runtime dependencies.

**Evidence:**
```
Verified 2026-09-14. npx vitest run -> 65/65 pass, exit 0.
solve/linalg.ts 122 lines, solve/schur.ts 218 lines. Zero runtime dependencies confirmed.
Exercised indirectly by all 27 integrator tests and all 8 gate tests, which cannot pass without a
correct factorisation. No standalone linalg.test.ts exists -- see T-23 note.
```
**Completed by:** pre-existing, verified by ledger author  **Date:** 2026-09-14

---

### [x] T-09 — Envelope meshing, harmonic interfaces, composite U-value

**Area:** B — Engine (≈ W-06 + W-07) · **Status:** DONE · **Est:** 8 h
**Depends on:** T-01 · **Conflicts with:** none

**Why this exists.** The node chain through a wall's thickness **is** the physics that makes
passive design work. Without it the only capacitance in the model is the indoor air, every shelter
crashes to ambient after sunset, and the tool cannot answer the one question DRDO asked.

**PROMPT:**
> Already done. `packages/engine/src/envelope/mesh.ts` (169 lines) exports `WallMesh`,
> `diffusivity`, `penetrationDepth`, `sliceCount`, `buildWallMesh`, `constructionUValue` and
> `analyticalWavePenetration`. Node spacing resolves the diurnal wave (`d = sqrt(a*P/pi)`,
> `P = 86400`), boundary nodes take half control volumes, and interface conductance is **harmonic**.
> ⚠ **`envelope/conduction.ts` does not exist and should not be created** — `constructionUValue`
> lives here. See `LOG.md` §9 D-7.

**Files you may touch.** None — complete.
**Files you may NOT touch.** Everything. This task is closed; verify it, do not rework it.
**Subagent guidance.** None — already done. Verify by running the suite; do not fan out.

**ACCEPTANCE TESTS:**
1. `npx vitest run packages/engine/test/mesh.test.ts` → 12/12.
2. Penetration depth for dense concrete = 0.151 m (`BLUEPRINT.md` 5.6.3 worked example).
3. At least 5 nodes per penetration depth.
4. Total capacitance equals `Σ ρ·c·L` exactly, for every construction.
5. Total thickness preserved.
6. Composite-wall U within 0.5 % of `1/(1/h_o + Σ L/k + 1/h_i)` — validation Test 3.
7. Fabric resistance exactly `Σ L/k` across a 25× conductivity contrast — the harmonic check.
8. Adding insulation always lowers U (monotonicity).
9. Node count stays sane on a thick heavy wall; the slice cap does not break the penetration-depth
   rule on thick walls (regression case present).

**Evidence:**
```
Verified 2026-09-14.  npx vitest run packages/engine/test/mesh.test.ts -> 12 passed, 16 ms.
Named cases confirmed present and green:
  "penetration depth for dense concrete is ~0.151 m (BLUEPRINT 5.6.3 worked example)"
  "resolves the daily wave with at least 5 nodes per penetration depth"
  "keeps the node count sane for a thick heavy wall"
  "honours the penetration-depth rule on THICK walls too (regression: slice cap)"
  "total capacitance equals sum(rho*c*L) exactly, for every construction"
  "total thickness is preserved"
  "fabric resistance is exactly sum(L/k) for a 25x conductivity contrast"
  "U including surface films matches 1/(1/h_o + sum(L/k) + 1/h_i) within 0.5%"
  "adding insulation always lowers U (BLUEPRINT 9.8 monotonicity)"
  "300 mm dense concrete: decrement ~0.137, lag ~7.6 h (BLUEPRINT 5.6.5)"
  "a thin steel sheet has essentially no lag and no damping"
  "more thermal mass always means more damping"
```
**Completed by:** pre-existing, verified by ledger author  **Date:** 2026-09-14

---

### [x] T-10 — Model assembly: node index, capacitance vector, conductance matrix

**Area:** B — Engine (≈ W-08) · **Status:** DONE · **Est:** 8 h
**Depends on:** T-08, T-09 · **Conflicts with:** none

**Why this exists.** Turns a meshed building plus a bag of coefficients into the matrices the
integrator marches. It is the boundary that lets numerics and physics be built independently.

**PROMPT:**
> Already done. `packages/engine/src/solve/assemble.ts` (126 lines) exports the node layout
> (`AIR_NODE = 0`, `STAR_NODE = 1`, `FIRST_SURFACE_NODE = 2`), `SurfaceNodes`, `Model`,
> `buildModel(building, materials, glazings, targetDx)` and `normaliseAzimuth`. The air node's
> capacitance uses the `M = 4` effective multiplier from `loads/infiltration.ts`. The mean-radiant
> star node is a zero-capacity node, the ISO 13790 5R1C approach.

**Files you may touch.** None — complete.
**Files you may NOT touch.** Everything. This task is closed; verify it, do not rework it.
**Subagent guidance.** None — already done. Verify by running the suite; do not fan out.

**ACCEPTANCE TESTS:**
1. `npx vitest run` → 65/65. 2. Total capacitance equals the hand-computed building thermal mass.
3. The star node carries zero capacity. 4. `normaliseAzimuth` is stable under ±360°.
5. A 360° building rotation reproduces results exactly (validation Test 8). 6. `assemble.ts`
imports nothing from `solar/`, `surfaces/` or `loads/` beyond the air-capacitance helper.

**Evidence:**
```
Verified 2026-09-14.  65/65 green.
"rotating the whole building 360 degrees reproduces the result exactly" -- PASS (integrator.test.ts)
"total capacitance equals sum(rho*c*L) exactly, for every construction" -- PASS (mesh.test.ts)
assemble.ts = 126 lines. Node layout: AIR_NODE 0, STAR_NODE 1, FIRST_SURFACE_NODE 2.
```
**Completed by:** pre-existing, verified by ledger author  **Date:** 2026-09-14

---

### [x] T-11 — Time integration, and the AUDIT F-1 coefficient-refresh fix

**Area:** B — Engine (≈ W-09) · **Status:** DONE · **Est:** 12 h
**Depends on:** T-10 · **Conflicts with:** T-19 (PCM must not change the refresh cadence)

**Why this exists.** `AUDIT.md`'s first kill-shot: the blueprint claimed the system matrix is
constant and can be LU-factorised once, but `h_o` (wind-driven), `h_r,sky` (temperature-linearised)
and `h_i` (flow-direction-dependent) all live *inside* the matrix and all change every step.
Refactorising a dense LU every step is ~400× over budget and would have silently destroyed the
comparison feature that is the entire reason to build this instead of using ANSYS.

**PROMPT:**
> Already done, and **F-1 is closed** — see `LOG.md` §9 D-6.
> `packages/engine/src/solve/integrator.ts` (704 lines) implements backward Euler
> (θ-parameterised, θ = 1 default) with **coefficients frozen per weather-hour**: the matrix is
> refactorised only when they are refreshed (comment at line 19: *"coefficients are FROZEN PER
> WEATHER-HOUR: the matrix is refactorised only when..."*, refresh at line 277), while the forcing
> vector is rebuilt every timestep. Factorisation goes through `factorArrow`/`solveArrow`.
> Auxiliary heat is solved by linearity within a refresh interval (line 538), so the exact aux power
> is obtained without extra solves. Spin-up is convergence-based (`spinUpToleranceK`,
> `maxSpinUpDays`) per `CHALLENGE.md` C-10. Divergence guard: any node outside
> `[T_MIN_PLAUSIBLE, T_MAX_PLAUSIBLE] = [173, 373] K` or non-finite throws `SOLVER_DIVERGED`.

**Files you may touch.** None — complete.
**Files you may NOT touch.** Everything. This task is closed; verify it, do not rework it.
**Subagent guidance.** None — already done. Verify by running the suite; do not fan out.

**ACCEPTANCE TESTS:**
1. `npx vitest run packages/engine/test/integrator.test.ts` → 27/27.
2. Unconditional stability: a 1 mm steel skin at a long timestep produces finite, non-oscillating
   decay (explicit Euler would need Δt ≤ ~9.7 s).
3. 300 s matches a 30 s reference within the stated tolerance, for the lightest building.
4. Determinism: the same request twice returns identical results.
5. Energy is conserved with `f = 0` and all boundary conductances zero.
6. A divergent forcing throws `SOLVER_DIVERGED`, never a plausible wrong number.
7. Spin-up reports its actual day count in `meta.spinUpDaysUsed`.
8. Coefficients are refreshed per weather-hour, not per step.

**Evidence:**
```
Verified 2026-09-14.  npx vitest run packages/engine/test/integrator.test.ts -> 27 passed, 1129 ms.
Named cases green:
  "Test 7 -- timestep independence on the full model" / "300 s matches a 30 s reference for <label>"
  "Test 1 -- steady state" (2 cases)
  "Test 4 -- adiabatic box (capacitance assembly)" (3 cases)
  "Test 6 -- energy conservation" / "residual stays under 0.1% -- <label>"
  "Test 8 -- symmetry and physical-sense checks" (6 cases)
  "the cold sky is real and is not optional" (2 cases)
  "ventilation safety floor" (2 cases)
  "input validation" (2 cases)
F-1 CLOSED: integrator.ts:19 documents the frozen-per-weather-hour cadence; refresh at :277;
factorArrow/solveArrow at :535. No per-step dense refactorisation exists in the file.
```
**Completed by:** pre-existing, verified by ledger author  **Date:** 2026-09-14

---

### [x] T-12 — ⚠ THE HARD GATE: analytical Test 2 (sinusoidal wave through a wall) and Test 7

**Area:** B — Engine (≈ W-10) · **Status:** DONE · **Est:** 10 h
**Depends on:** T-11 · **Conflicts with:** none

**Why this exists.** *"If this test passes, your core solver is correct. Everything else is
bookkeeping around it."* (`BLUEPRINT.md` 9.2.) It validates the exact physics that makes passive
design work, against a closed-form answer that cannot itself be buggy — which is **stronger**
evidence than matching another program.

**PROMPT:**
> Already done and **GREEN**. `packages/engine/test/gate.test.ts` (133 lines, 8 tests) drives a
> single homogeneous wall with `T(t) = T_m + A·sin(ωt)`, `P = 24 h`, interior held constant, zero
> solar, recovers the numerical decrement factor and time lag with `harmonicFit`/`lagSeconds` from
> `envelope/response.ts`, and compares against the closed form `d = sqrt(2a/ω)`, `f = e^(−x/d)`,
> `φ = x/(d·ω)`. It also asserts that a heavier wall always damps more and delays longer, and runs
> Test 7 (mesh and timestep independence) on the same apparatus.

**Files you may touch.** None — complete.
**Files you may NOT touch.** Everything. This task is closed; verify it, do not rework it.
**Subagent guidance.** None — already done. Verify by running the suite; do not fan out.

**ACCEPTANCE TESTS:**
1. `npx vitest run packages/engine/test/gate.test.ts` → 8/8.
2. Numerical decrement factor within **2 %** of analytical, for every material/thickness case.
3. Time lag within **10 minutes** of analytical, for every case.
4. The 300 mm dense-concrete anchor reproduces `f ≈ 0.137`, `φ ≈ 7.6 h`.
5. A heavier wall damps more and delays longer than a lighter one, monotonically.
6. Halving Δx and then Δt moves the answer by less than **1 %** (Test 7).
7. Total runtime of the gate file is under 30 s.
8. Neither tolerance has been loosened from 2 % / 10 min.

**Evidence:**
```
Verified 2026-09-14.  npx vitest run packages/engine/test/gate.test.ts -> 8 passed, 760 ms.
describe blocks: "Test 2 -- sinusoidal wave through a wall (THE gate test)" and
                 "Test 7 -- mesh and timestep independence".
Cases: "<material> at <N> mm reproduces the analytical decrement and lag" (parameterised),
       "a heavier wall always damps more and delays longer than a lighter one",
       "halving dx and then dt moves the answer by less than 1%".
Runtime 760 ms, far inside the 30 s budget.
NOTE for T-63 (VALIDATION.md): the per-case measured f and phi pairs are asserted but not
currently PRINTED to stdout. T-23 should add the print so the numbers can be lifted directly.
```
**Completed by:** pre-existing, verified by ledger author  **Date:** 2026-09-14

---

### [x] T-13 — Analytical Tests 1, 4, 6 and 8, plus the safety and validation cases

**Area:** B — Engine (≈ W-10 + W-46) · **Status:** DONE · **Est:** 10 h
**Depends on:** T-11 · **Conflicts with:** none

**Why this exists.** Test 1 catches conductance-assembly errors, Test 4 catches capacitance-assembly
errors, Test 6 catches an entire class of dropped-term and sign-flip errors at near-zero cost, and
Test 8's six one-line assertions catch a surprising number of sign errors between them.

**PROMPT:**
> Already done. `packages/engine/test/integrator.test.ts` (376 lines, 27 tests) covers:
> **Test 1** steady state (`T_in → T_amb`; then the `Q_aux/(ΣUA + ṁc_p)` offset by hand);
> **Test 4** adiabatic box (linear rise at exactly `Q/ΣC`, and "no energy is created");
> **Test 6** energy conservation, residual under 0.1 %, parameterised over fixtures;
> **Test 7** timestep independence on the full model;
> **Test 8** all six physical-sense assertions — 360° rotation exact, `T_in` never exceeds
> `max(T_amb)` with no sun and no gains, more insulation monotonically raises the winter minimum,
> more mass monotonically damps, the antiphase-thickness result with leakage, transmitted solar
> never exceeds incident;
> plus **the cold sky is real and is not optional** (2 cases), **the ventilation safety floor**
> (2 cases), and **input validation** (reports every problem at once; catches Celsius passed where
> Kelvin was required).

**Files you may touch.** None — complete.
**Files you may NOT touch.** Everything. This task is closed; verify it, do not rework it.
**Subagent guidance.** None — already done. Verify by running the suite; do not fan out.

**ACCEPTANCE TESTS:**
1. 27/27 pass. 2. Energy-balance residual < 1e-3 on every fixture. 3. All six Test 8 assertions
pass as separately named cases. 4. Removing sky radiation makes the shelter measurably warmer at
dawn — the `CHALLENGE.md` C-02 evidence. 5. A request below `ACH_MIN` is silently raised, not
honoured. 6. Overriding the floor requires the explicit flag **and** emits a warning.
7. Validation reports every problem at once, not just the first. 8. Celsius passed where Kelvin was
required is caught.

**Evidence:**
```
Verified 2026-09-14.  27 passed, 1129 ms.
"a clear Ladakh night sky sits far below air temperature" -- PASS
"removing sky radiation makes the shelter measurably warmer at dawn" -- PASS  (CHALLENGE C-02)
"a request below ACH_MIN is silently raised, not honoured" -- PASS  (SAFETY, global rule 10)
"overriding the floor requires an explicit flag AND emits a warning" -- PASS
"reports every problem at once, not just the first" -- PASS
"catches Celsius passed where Kelvin was required" -- PASS
"with a sealed envelope, more mass monotonically damps BOTH air and surface" -- PASS
"with leakage, the air swing bottoms out at the ANTIPHASE thickness, pi*d" -- PASS
"transmitted solar never exceeds what is incident on the glazing" -- PASS
```
**Completed by:** pre-existing, verified by ledger author  **Date:** 2026-09-14

---

### [x] T-14 — Solar: position, decomposition, transposition

**Area:** B — Engine (≈ W-11, W-12, W-13) · **Status:** DONE · **Est:** 12 h
**Depends on:** T-01 · **Conflicts with:** T-18 (shading reads `SunPosition`, never edits it)

**Why this exists.** The problem statement asks about orientation by name. Without real solar
geometry the tool cannot recommend the single highest-leverage, zero-cost change available to a
builder: point the glazing south.

**PROMPT:**
> Already done. `solar/geometry.ts` (148 lines), `solar/decomposition.ts` (76 lines),
> `solar/transposition.ts` (92 lines). Azimuth convention: **south = 0, east negative, west
> positive**. A sign error in `ENGINE_BLUEPRINT.md`'s solar-noon derivation was found and corrected
> — the test named *"solar noon clock time (catches the ENGINE_BLUEPRINT sign error)"* is the
> regression guard. Do not "fix" it back.

**Files you may touch.** None — complete.
**Files you may NOT touch.** Everything. This task is closed; verify it, do not rework it.
**Subagent guidance.** None — already done. Verify by running the suite; do not fan out.

**ACCEPTANCE TESTS:**
1. `npx vitest run packages/engine/test/solar.test.ts` → 16/16.
2. Declination reaches ±23.45° at the solstices and ~0 at the equinox.
3. Peak solar altitude at Leh: **32.4°** on 21 Dec, **55.85°** at the equinoxes, **79.3°** on
   21 Jun, each ±0.2°.
4. Solar noon at Leh is always after 12:00 IST, never before; the pure longitude offset is
   `4·(77.58 − 82.5) = −19.7 min`.
5. The equation of time stays inside its textbook ±16-minute envelope.
6. Day length is symmetric about solar noon; equinox day length ≈ 12 h at every latitude.
7. Azimuth is east of south in the morning, west of south in the afternoon, due south at solar noon.
8. A horizontal surface sees exactly `cos(zenith)`.
9. **North-facing walls receive zero beam all winter** — `BLUEPRINT.md` 9.8 symmetry check.

**Evidence:**
```
Verified 2026-09-14.  npx vitest run packages/engine/test/solar.test.ts -> 16 passed, 48 ms.
Named cases green:
  "reaches -23.45 at the winter solstice and +23.45 at the summer solstice"
  "is near zero at the equinox"
  "peak solar altitude at Leh (the analytically known check)" (parameterised over the 3 dates)
  "solar noon clock time (catches the ENGINE_BLUEPRINT sign error)"
  "is always after 12:00 IST at Leh, never before"
  "isolates the pure longitude offset on a day when the equation of time is ~0"
  "the equation of time stays within its textbook +/-16 minute envelope"
  "gives a short winter day and a long summer day"
  "day length is symmetric about solar noon"
  "equinox day length is ~12 h at every latitude"
  "is due south at solar noon in the northern hemisphere"
  "is east of south in the morning and west of south in the afternoon"
  "a south wall in midwinter beats a north wall, which sees no beam at all"
  "a horizontal surface sees exactly cos(zenith)"
  "north-facing walls receive zero beam all winter (BLUEPRINT 9.8 symmetry check)"
GAP for T-23: no comparison against NOAA Solar Calculator literals yet. Validation Test 5 is
PARTIAL, not complete.
```
**Completed by:** pre-existing, verified by ledger author  **Date:** 2026-09-14

---

### [x] T-15 — Surface boundary conditions, altitude-corrected in both directions

**Area:** B — Engine (≈ W-15, W-16) · **Status:** DONE · **Est:** 8 h
**Depends on:** T-01 · **Conflicts with:** none

**Why this exists.** The sky term is what decides the Ladakh night — a clear sky behaves like a
surface near −44 °C and every roof radiates into it all night, whether or not there is any wind.
A model without it predicts comfortable Ladakh nights that do not exist, and DRDO's own lab is in
Leh. The altitude factor on **both** convection coefficients is what cashes the "area-specific"
claim (`AUDIT.md` F-5).

**PROMPT:**
> Already done. `surfaces/exterior.ts` (69 lines): `hConvExterior` (convective-only
> `2.8 + 3.0v`, floored at 1.0, times `convectionAltitudeFactor` — **mandatory, with the F-5
> reason in the comment**), `skyTemperature` (measured `LW_down` path preferred, Swinbank
> `0.0552·T^1.5` otherwise), `hRadSky`, `skyViewFactor`. `surfaces/interior.ts` (68 lines):
> `hConvInterior` (direction-dependent 3.08 / 4.04 / 0.95, altitude-corrected — the combined 8.3
> scheme is deliberately **absent**), `hRadInterior` (star node), `SOLAR_TO_FLOOR_FRACTION = 0.6`,
> `SOLAR_TO_AIR_FRACTION = 0.05`.

**Files you may touch.** None — complete.
**Files you may NOT touch.** Everything. This task is closed; verify it, do not rework it.
**Subagent guidance.** None — already done. Verify by running the suite; do not fan out.

**ACCEPTANCE TESTS:**
1. `skyTemperature(258)` returns **228.7 K ± 0.5** and is **below** 258 K.
2. `skyTemperature` with measured `LW_down` takes precedence over Swinbank.
3. `skyViewFactor(0) = 1.0`, `(90) = 0.5`, `(180) = 0.0`, exact to 1e-12.
4. A roof's sky radiative coefficient is exactly twice a wall's at equal temperature.
5. `hConvExterior` at Leh is lower than at sea level by `sqrt(0.65) = 0.806` ± 0.5 %.
6. `hConvExterior(0, ...)` returns 2.8 × factor and never falls below the 1.0 floor.
7. A warm floor returns 4.04 × factor; a warm ceiling returns 0.95 × factor — ratio 4.25.
8. `grep -c "8\.3" packages/engine/src/surfaces/interior.ts` returns **0**.
9. Q4 is negative for a 290 K surface under a 228.7 K sky.

**Evidence:**
```
Verified 2026-09-14 by source inspection + the integrator test suite.
exterior.ts:  hConvExterior = max(1.0, (2.8 + 3.0*v) * convectionAltitudeFactor(h))  CONFIRMED
              skyTemperature: (lwDown/SIGMA)^0.25 when lwDown > 0, else 0.0552*T^1.5  CONFIRMED
              skyViewFactor(tilt) = (1 + cos(tilt))/2                                 CONFIRMED
              F-5 comment present: "The altitude factor is mandatory, not a refinement"
interior.ts:  wall 3.08 / floor 4.04 up, 0.95 down / ceiling 0.95 down, 4.04 up      CONFIRMED
              grep -c "8.3" packages/engine/src/surfaces/interior.ts -> 0             CONFIRMED
              SOLAR_TO_FLOOR_FRACTION 0.6, SOLAR_TO_AIR_FRACTION 0.05                 CONFIRMED
End-to-end: "a clear Ladakh night sky sits far below air temperature" -- PASS
            "removing sky radiation makes the shelter measurably warmer at dawn" -- PASS
```
**Completed by:** pre-existing, verified by ledger author  **Date:** 2026-09-14

---

### [x] T-16 — Loads, orchestrator and post-processing

**Area:** B — Engine (≈ W-17…W-20, W-22…W-25) · **Status:** DONE · **Est:** 16 h
**Depends on:** T-11, T-14, T-15 · **Conflicts with:** T-21, T-22 (they edit files in this set)

**Why this exists.** `simulate(request) → result` is the entire public surface of the engine. One
pure function: no I/O, no network, no global state, no logging, same inputs always the same outputs.
That property is what makes it safe to run in many worker threads at once and cheap enough to call
thousands of times for the design search.

**PROMPT:**
> Already done. `loads/windows.ts` (51), `loads/infiltration.ts` (61), `loads/ground.ts` (39),
> `loads/internal.ts` (28); `validate.ts` (71); `index.ts` (171) exporting `simulate` and
> `DEFAULT_SIM_OPTIONS`; `post/energyBalance.ts` (65) with the §7.4 definition copied verbatim as a
> comment above the implementation; `post/kpis.ts` (151) with `assembleHeatFlows` and `computeKpis`;
> `post/conversions.ts` (27) with `CONVERSIONS` and `keroseneLitres`.
> ⚠ **`post/heatFlows.ts` does not exist** — `assembleHeatFlows` lives in `post/kpis.ts`. T-22
> splits it out and adds the missing `deltaT` series.

**Files you may touch.** None — complete.
**Files you may NOT touch.** Everything. This task is closed; verify it, do not rework it.
**Subagent guidance.** None — already done. Verify by running the suite; do not fan out.

**ACCEPTANCE TESTS:**
1. `simulate(fixture)` returns `temperatures.indoorAir.length === time.length === meta.timesteps`,
   every value finite.
2. `meta.energyBalanceResidual < 1e-3`.
3. Three simultaneously invalid fields produce **one** `EngineError` with three detail entries.
4. `simulate` called twice with the same request returns deep-equal results.
5. `grep -rn "console\.\|fetch(\|require(" packages/engine/src` returns **no matches**.
6. With aux heating enabled, indoor air never falls below setpoint unless `Qaux` is pinned at
   `maxPower`.
7. `meta.spinUpDaysUsed` is reported and reflects actual convergence.
8. `condensationRiskHours` is `null` (not 0) when the weather carries no RH.

**Evidence:**
```
Verified 2026-09-14.  65/65 green; simulate() exercised by integrator, gate and perf suites.
grep -rn "console\.\|fetch(\|require(" packages/engine/src -> NO MATCHES.  CONFIRMED PURE.
post/energyBalance.ts carries the residual definition verbatim, naming the excluded set {Q5,Q6,Q7}
  and stating "DIMENSIONLESS FRACTION, not a percent. The contract requires < 1e-3."  CONFIRMED.
"reports every problem at once, not just the first" -- PASS
DEFAULT_SIM_OPTIONS on disk: timestep 300 s, meshTargetDx 0.02, simulationDays 1,
  spinUpToleranceK 0.02, maxSpinUpDays 30, skyModel 'hdkr', theta 1,
  keepSurfaceProfiles false, allowUnsafeVentilation false.
```
**Completed by:** pre-existing, verified by ledger author  **Date:** 2026-09-14

---

### [x] T-17 — The performance budget

**Area:** B — Engine (≈ `TECH.md` §13) · **Status:** DONE · **Est:** 4 h
**Depends on:** T-16 · **Conflicts with:** none

**Why this exists.** **This performance is the product.** ANSYS takes hours per case. The gap is
what turns "simulate the design you already chose" into "search the design space and tell me which
design to choose" — and it is what makes the eighteen-scenario survival grid and the longest-sunless-
stretch scenario askable questions at all.

**PROMPT:**
> Already done. `packages/engine/test/perf.test.ts` (57 lines, 2 tests) asserts the two budgets and
> **prints both measured numbers to stdout**, which is exactly what `VALIDATION.md` and the PPT
> need to quote.

**Files you may touch.** None — complete.
**Files you may NOT touch.** Everything. This task is closed; verify it, do not rework it.
**Subagent guidance.** None — already done. Verify by running the suite; do not fan out.

**ACCEPTANCE TESTS:**
1. One full `simulate()` **including convergence spin-up** completes in **≤ 50 ms** (median).
2. A 100-variant design sweep completes in **< 10 s** single-threaded.
3. Both numbers are printed to stdout, not merely asserted.
4. `npx vitest run packages/engine/test/perf.test.ts` exits 0.

**Evidence:**
```
Verified 2026-09-14 on this machine.
  full simulate() incl. spin-up:  31.8 ms/run     (budget 50 ms)      PASS, 36% under
  100-variant sweep:               2.39 s          (budget 10 s)       PASS, 76% under
2 tests passed, 2601 ms total.
A prior run on this machine recorded 38.3 ms and 2.59 s; run-to-run variance ~20% is normal and
both readings clear their budgets. Always record your own number, never copy one.
```
**Completed by:** pre-existing, verified by ledger author  **Date:** 2026-09-14

---

### [ ] T-18 — Shading: mountain horizon and window overhangs

**Area:** B — Engine (≈ W-14) · **Status:** NOT STARTED · **Est:** 6 h
**Depends on:** T-06 · **Conflicts with:** none — safe to run in parallel with anything

**Why this exists.** `solar/shading.ts` is listed in `TECH.md` §5 and **does not exist on disk**.
A Ladakh valley site loses real hours of sun to the ridge line: a shelter at the bottom of a valley
whose southern horizon rises 25° does not see the sun until mid-morning in December, when the sun
only reaches 32.4° at noon in the first place. Without this, every valley site is simulated as if
it sat on an open plain, and the solar-gain numbers are optimistic in exactly the place the tool is
meant to be trusted.

**PROMPT — paste this to start the task:**
> Create `packages/engine/src/solar/shading.ts` and
> `packages/engine/test/shading.test.ts`.
>
> Export exactly two functions:
>
> ```ts
> export function horizonBlockFactor(sun: SunPosition, horizonProfile?: number[]): 0 | 1;
> export function overhangSunlitFraction(
>   sun: SunPosition, surfaceAzimuthDeg: number,
>   windowHeight: number, overhangDepth: number, overhangHeightAbove: number
> ): number;   // 0-1
> ```
>
> `horizonBlockFactor`: `Site.horizonProfile` is 36 values — the blocking altitude in **degrees**
> for each 10° sector of azimuth, indexed from the same azimuth convention the rest of the engine
> uses (**south = 0, east negative, west positive**; normalise to 0–360 internally). Linearly
> interpolate the profile at the sun's azimuth and return `0` when `sun.altitudeDeg` is below the
> interpolated blocking altitude, `1` otherwise. With **no** profile, return `1` when `sun.isUp`
> and `0` when it is not. Throw `EngineError('INVALID_INPUT')` if a profile is supplied whose
> length is not 36.
>
> `overhangSunlitFraction`: compute the **profile angle** — the solar altitude projected into the
> plane perpendicular to the wall, `tan(profileAngleRad) = tan(altitudeRad) / cos(wallRelativeAzimuthRad)`
> where `wallRelativeAzimuth = sun.azimuthDeg − surfaceAzimuthDeg` normalised to `[−180, 180]`.
> Shadow depth down the wall from the overhang is `y = overhangDepth * tan(profileAngle)`. The
> window's top sits `overhangHeightAbove` below the overhang, so the shaded height of the window is
> `clamp(y − overhangHeightAbove, 0, windowHeight)` and the sunlit fraction is
> `1 − shadedHeight / windowHeight`. Clamp to `[0, 1]`. Return `0` when the sun is behind the wall
> (`|wallRelativeAzimuth| >= 90`) or below the horizon. Return `1` when `overhangDepth === 0`.
> Guard `windowHeight <= 0` by throwing `EngineError('INVALID_INPUT')`.
>
> **Apply shading to the BEAM component only.** Diffuse and ground-reflected are unaffected in this
> phase. That is a deliberate simplification with a known ceiling: it overestimates gain on a deeply
> overhung or steeply horizon-blocked surface, because a blocked horizon also blocks part of the sky
> dome. Write that ceiling and its upgrade path (a sky-dome view-factor reduction) into a
> `// SIMPLIFICATION:` comment in the file, per global rule 13, so it reaches the limitations list
> (T-64) and `EQUATIONS.md`.
>
> Do **not** wire this into `index.ts` — that is a separate concern and `index.ts` is owned by
> T-16's file set. Instead export the functions and add a one-line note in your `.work/T-18.md`
> "Deviations and notes for downstream tasks" saying they are ready to be called from the forcing
> hook. Do not implement ray tracing, inter-building shading or view factors — all three are on the
> binding cut list (global rule 12). Do not download a DEM.

**Files you may touch.** `packages/engine/src/solar/shading.ts` (create),
`packages/engine/test/shading.test.ts` (create).
**Files you may NOT touch.** `solar/geometry.ts` (read `SunPosition`, never edit it),
`solar/transposition.ts`, `index.ts`, `types.ts`, `constants.ts`.

**Subagent guidance.** Single agent. Two pure functions in one file — do not fan out.

**ACCEPTANCE TESTS — the task is NOT done until every one passes:**
1. With no `horizonProfile`, the factor is `1` at every hour the sun is up and `0` at every hour it
   is not, over a full day at Leh on 21 Dec. Paste the sunrise and sunset hours it implies.
2. A flat 20° horizon in every direction blocks the sun **exactly** while `altitudeDeg < 20`, and
   the transition hour matches a hand-computed value from `sunPosition`. Paste both hours.
3. A profile of 36 zeros reproduces the no-profile result **exactly** at every hour.
4. A profile of length 35 throws `EngineError('INVALID_INPUT')`.
5. `overhangSunlitFraction(..., overhangDepth = 0, ...)` returns exactly `1.0` for 200 sampled sun
   positions.
6. **The classic overhang design check at Leh:** an overhang deep enough to fully shade a 1.2 m
   south window at solar noon on 21 Jun returns `0.0` there, and returns `1.0` at solar noon on
   21 Dec. Paste both fractions and the overhang depth used.
7. The return value is within `[0, 1]` for 1,000 randomly sampled sun positions and surface
   azimuths — assert with a loop, not by inspection.
8. **Continuity:** sweeping solar altitude in 0.1° steps from 0° to 80° produces no jump greater
   than 0.05 in the returned fraction. A discontinuity here means the profile-angle branch is wrong.
9. A sun directly behind the wall (`wallRelativeAzimuth = 150°`) returns `0.0`.
10. The file contains a `// SIMPLIFICATION:` comment naming the beam-only ceiling and its upgrade
    path.
11. `npx vitest run` exits 0 with the pre-existing 65 tests still passing.

**Evidence (fill this in when done — numbers, not adjectives):**
```
```

**Completed by:** ___  **Date:** ___

---

### [ ] T-19 — Phase-change materials: apparent heat capacity

**Area:** B — Engine (≈ W-21) · **Status:** NOT STARTED · **Est:** 8 h
**Depends on:** T-06 · **Conflicts with:** T-11 (the refresh cadence contract — do not change it)

**Why this exists.** The problem statement names *"application of thermal mass storage material"*
explicitly, so its absence is a scope gap a judge can point at directly. `storage/pcm.ts` is listed
in `TECH.md` §5 and **does not exist on disk**. PCM is also the most interesting engineering answer
available for a lightweight deployable shelter that cannot carry 400 mm of stone: enormous storage
in a thin layer. `AUDIT.md` F-4 records that PCM was named in the physics, correct in its numbers,
and then absent from the schedule and the ownership table entirely — an orphan.

**PROMPT — paste this to start the task:**
> Create `packages/engine/src/storage/pcm.ts` and `packages/engine/test/pcm.test.ts`.
>
> ```ts
> export function apparentHeatCapacity(
>   cBase: number, latentHeat: number, meltPoint: Kelvin, meltRangeK: number, t: Kelvin
> ): number;                                      // J/(kg*K)
> export function pcmEnthalpy(
>   cBase: number, latentHeat: number, meltPoint: Kelvin, meltRangeK: number,
>   t: Kelvin, tRef: Kelvin
> ): number;                                      // J/kg
> ```
>
> **Use the apparent-heat-capacity method and call it that, everywhere.** `AUDIT.md` records
> `BLUEPRINT.md` naming this both "apparent heat capacity" and "enthalpy method" and never
> reconciling the two. One name. The strings "enthalpy method" and "apparent heat capacity" must
> not both appear as names for this method in the file.
>
> `apparentHeatCapacity`: below `meltPoint − meltRangeK/2` return `cBase`; inside the band return
> `cBase + latentHeat / meltRangeK`; above return `cBase`. Throw
> `EngineError('INVALID_INPUT')` when `meltRangeK <= 0` — never divide by zero.
>
> `pcmEnthalpy` is the integral of the above from `tRef`, which T-22 and the energy-balance check
> need in order to compute `ΔStored` correctly under a temperature-dependent capacitance
> (`LOG.md` §7.4). Compute it in closed form, piecewise — do **not** numerically integrate.
>
> Add a module-level comment stating the **solver consequence**: capacitance becomes
> temperature-dependent, so a run containing a PCM node must either use more than one nonlinear
> iteration per step or emit a `meta.warnings` entry saying the capacitance was lagged, **and the
> refresh cadence contract of `LOG.md` §7.10 is not to be changed.** If the apparent heat capacity
> moves by more than a set fraction within one refresh interval, raise a warning rather than
> silently refactorising more often.
>
> Reference material: paraffin RT25, `L_f = 200,000 J/kg`, melt range 3 K, `c_base = 2000 J/(kg·K)`,
> melting near 25 °C (`BLUEPRINT.md` Appendix B).
>
> Do **not** modify `integrator.ts`, `assemble.ts` or the refresh cadence. Do **not** implement
> water or Trombe storage — that is T-20.

**Files you may touch.** `packages/engine/src/storage/pcm.ts` (create),
`packages/engine/test/pcm.test.ts` (create).
**Files you may NOT touch.** `solve/integrator.ts`, `solve/assemble.ts`, `post/energyBalance.ts`,
`index.ts`, `types.ts`, `constants.ts`.

**Subagent guidance.** Single agent. One file, two closed-form functions.

**ACCEPTANCE TESTS — the task is NOT done until every one passes:**
1. **The spike:** paraffin RT25 (`L_f = 200000`, range 3 K, `c_base = 2000`) returns
   ≈ **68,667 J/(kg·K)** inside the band — the ~35× spike in `BLUEPRINT.md` 5.14.1 — and exactly
   `2000` at 5 K below and 5 K above the melt point. Paste all three values.
2. **Latent-heat conservation:** integrating `apparentHeatCapacity` numerically across the full melt
   band returns `latentHeat + cBase * meltRangeK` to within **0.1 %**. Paste the computed integral
   and the expected value.
3. `pcmEnthalpy` is monotonically increasing in temperature across a 40 K sweep in 0.1 K steps —
   assert no decrease anywhere.
4. `pcmEnthalpy`'s derivative matches `apparentHeatCapacity` to within **1 %** by central finite
   difference at 50 sampled temperatures spanning below, inside and above the band.
5. `latentHeat = 0` reduces `apparentHeatCapacity` to exactly `cBase` at every temperature, and
   `pcmEnthalpy` to exactly `cBase * (t − tRef)`.
6. The function is symmetric about `meltPoint`: the value at `meltPoint + x` equals the value at
   `meltPoint − x` for 20 sampled `x`.
7. `meltRangeK = 0` throws `EngineError` with code `INVALID_INPUT`.
8. `meltRangeK = -1` throws the same.
9. `grep -c "enthalpy method" packages/engine/src/storage/pcm.ts` returns **0**.
10. The file contains a comment naming the refresh-cadence consequence and stating the cadence must
    not be changed.
11. `npx vitest run` exits 0 with the pre-existing 65 tests still passing.

**Evidence (fill this in when done — numbers, not adjectives):**
```
```

**Completed by:** ___  **Date:** ___

---

### [ ] T-20 — Water and rock thermal storage, and the `StorageElement` node

**Area:** B — Engine (≈ W-55, de-stretched) · **Status:** NOT STARTED · **Est:** 10 h
**Depends on:** T-06, T-19 · **Conflicts with:** T-10, T-11 (you add a node type to their files)

**Why this exists.** Water is the **cheapest thermal mass available** — `c = 4186 J/(kg·K)`, four
times concrete per kilogram, and a Ladakhi household already owns drums. `storage/waterMass.ts` is
listed in `TECH.md` §5 and does not exist. Without a storage node, the "add thermal mass" branch of
the design sweep (`massStrategy: 'water' | 'pcm' | 'rock'`) has nothing to sweep over, and the
strongest cheap recommendation the tool could make cannot be made.

**PROMPT — paste this to start the task:**
> Create `packages/engine/src/storage/waterMass.ts` and `packages/engine/test/storage.test.ts`,
> and wire `Building.storageElements` (added by T-06) into the node graph.
>
> ```ts
> export interface StorageNodeSpec {
>   id: string;
>   capacityJPerK: number;       // massKg * c  (or the PCM apparent capacity at the node's T)
>   conductanceToRoom: number;   // W/K, from StorageElement.conductanceToRoom
>   kind: 'water' | 'pcm' | 'rock';
> }
> export function storageNodeSpec(
>   el: StorageElement, materials: Record<string, Material>, nodeTemp: Kelvin
> ): StorageNodeSpec;
> ```
>
> A storage element is **one well-mixed lumped node** — not a mesh. A 200 L water drum has a Biot
> number low enough that a single node is right; write that justification in a comment.
> For `kind: 'water'` the capacity is `massKg * c` with `c` from the material (4186 for water).
> For `kind: 'pcm'` the capacity is `massKg * apparentHeatCapacity(...)` evaluated at the node's
> current temperature, using T-19's function — **import it, do not reimplement it.**
> For `kind: 'rock'` it is `massKg * c`.
>
> Then extend the assembly and the integrator **minimally**:
> - `solve/assemble.ts`: allocate one node per `StorageElement` after the surface nodes, record the
>   mapping in the model's node index, and put `capacityJPerK` into the capacitance vector.
> - The conductance matrix gains a symmetric `conductanceToRoom` link between each storage node and
>   the **air node**. Nothing else. No radiative coupling, no surface coupling.
> - `solve/integrator.ts`: for a PCM storage node, re-evaluate its capacity at each coefficient
>   refresh (not at each step), and push a `meta.warnings` entry if the apparent capacity changed by
>   more than 25 % within one refresh interval — per T-19's contract. **Do not change the refresh
>   cadence itself.**
> - `post/energyBalance.ts`: for a PCM storage node, compute its `ΔStored` contribution using
>   `pcmEnthalpy` rather than `C·ΔT`, exactly as `LOG.md` §7.4 requires. This is the one case where
>   `C(T_end)·ΔT` silently mis-counts latent heat and the residual would pass while being wrong.
>
> These are **surgical edits to three files owned by T-10, T-11 and T-16**. That is why this task
> conflicts with them. Change nothing else in those files, and re-run the full suite after each.
>
> Do **not** build a two-air-node Trombe wall. Do **not** build an airflow network. Both are on the
> binding cut list. A Trombe wall is approximated for now as a high-mass south wall plus an outer
> glazing layer as added surface resistance — and **that approximation must be declared in the
> preset's `approximations` array** (T-28) and surfaced in the UI.

**Files you may touch.** `packages/engine/src/storage/waterMass.ts` (create),
`packages/engine/test/storage.test.ts` (create), and **only** the specific additions described above
in `solve/assemble.ts`, `solve/integrator.ts`, `post/energyBalance.ts`.
**Files you may NOT touch.** `storage/pcm.ts` (import it), `envelope/`, `solar/`, `surfaces/`,
`loads/`, `types.ts`, `constants.ts`, `index.ts` beyond passing `storageElements` through.

**Subagent guidance.** Single agent. The whole point of this task is a coherent small change across
three coupled files; splitting it guarantees the capacitance vector and the conductance matrix
disagree about node indices, which is the worst class of bug in this codebase and the hardest to see.

**ACCEPTANCE TESTS — the task is NOT done until every one passes:**
1. `npx vitest run` exits 0 with the pre-existing 65 tests **unchanged** — adding an optional field
   broke nothing. Paste the new total.
2. A building with `storageElements: []` or the field absent produces results **deep-equal** to the
   same building before this task. This is the regression that matters most.
3. **Water works:** a 500 kg water drum (`conductanceToRoom = 30 W/K`) raises `tempAt0600` relative
   to the identical design without it, and reduces `peakToPeakSwing`. Paste both deltas in K.
4. `storageNodeSpec` for 500 kg of water returns `capacityJPerK = 500 * 4186 = 2,093,000 ± 1`.
5. **Energy is still conserved with storage present:** `meta.energyBalanceResidual < 1e-3` for the
   water case and for the PCM case. Paste both residuals.
6. **The PCM enthalpy path is actually used:** deliberately replacing `pcmEnthalpy` with
   `C(T_end)·ΔT` in the balance makes the PCM case's residual exceed **0.01**. Revert. Paste both
   residuals — this is the negative control proving the correction is not cosmetic.
7. **`CHALLENGE.md` C-07's observable:** a wall or storage element with PCM produces a visibly
   flatter night-time indoor curve than the identical design without it, with a smaller
   `peakToPeakSwing`, and the curve shows the characteristic plateau near the phase-change point.
   Paste the two swings and the plateau duration in hours.
8. A PCM node whose apparent capacity changes by more than 25 % within one refresh interval produces
   a `meta.warnings` entry naming the node.
9. The refresh cadence is unchanged: `grep -n "3600\|weather-hour" packages/engine/src/solve/integrator.ts`
   shows the same cadence logic as before your change. Paste the diff of that file and confirm it is
   under 40 lines.
10. `simulate` remains deterministic with storage present — two identical calls, deep-equal results.

**Evidence (fill this in when done — numbers, not adjectives):**
```
```

**Completed by:** ___  **Date:** ___

---

### [ ] T-21 — Couple infiltration to opening area (closes AUDIT F-6)

**Area:** B — Engine (≈ W-18, the unfinished half) · **Status:** NOT STARTED · **Est:** 4 h
**Depends on:** T-06 · **Conflicts with:** T-16 (edits `loads/infiltration.ts`)

**Why this exists.** `CHALLENGE.md` calls the glazing sweep **"the sharpest single diagnostic in the
whole suite"**, because it tests gain physics and loss physics *simultaneously* and the correct
answer has a distinctive shape that cannot be faked: performance improves with glazing up to an
optimum, then degrades. Kill-shot question K-05 is exactly this — *"I make the window bigger. Does
it get better or worse?"* — and the right answer is *"better, then worse, and here is the optimum."*
**Right now the tool cannot produce that curve.** `AUDIT.md` F-6: infiltration is a static value
independent of opening size, so the loss side does not move when glazing grows, and the optimum may
never appear. A monotonic answer here would have the tool advising builders to glaze a whole wall,
which on a −25 °C Ladakh night is **actively harmful advice**.

**PROMPT — paste this to start the task:**
> Edit `packages/engine/src/loads/infiltration.ts`. Add — do not replace — an opening-area coupling.
>
> ```ts
> /**
>  * CALIBRATION KNOB. Additional air changes per hour per unit of glazing-area fraction.
>  *
>  * Physical justification: crack length scales with opening perimeter, and openable glazing
>  * leaks more per m^2 than opaque envelope does. This is an empirical coupling, not a derived
>  * one -- it is here so that the glazing sweep can produce the non-monotonic optimum the physics
>  * should show (CHALLENGE.md C-06, K-05; AUDIT.md F-6).
>  *
>  * TUNE THIS if a measured blower-door figure for a real Ladakhi shelter ever becomes available.
>  * That single measurement is what would turn this from a plausible coupling into a calibrated one.
>  */
> export const ACH_PER_GLAZING_FRACTION = 1.2;
>
> export function effectiveAch(
>   baseAch: number, glazingAreaM2: number, envelopeAreaM2: number,
>   hasUnventedCombustion: boolean, allowUnsafe = false,
> ): { ach: number; clampedBySafetyFloor: boolean };
> ```
>
> Compute `ach = baseAch + ACH_PER_GLAZING_FRACTION * (glazingAreaM2 / envelopeAreaM2)`.
> Then apply the floor:
> `achMin = ACH_MIN + (hasUnventedCombustion ? ACH_MIN_COMBUSTION_ALLOWANCE : 0)` — so an ordinary
> shelter floors at **0.35** and a bukhari-heated one at **0.70**. If `ach < achMin` and not
> `allowUnsafe`, return `achMin` with `clampedBySafetyFloor: true`.
> `envelopeAreaM2 <= 0` throws `EngineError('INVALID_INPUT')`.
>
> `hasUnventedCombustion` does not exist on `Operation` on disk. Add it as an **optional**
> `hasUnventedCombustion?: boolean` — that is a one-field addition to `types.ts`, which this task is
> explicitly permitted to make, and only this one field. Default `false`.
>
> Wire `effectiveAch` into the orchestrator's coefficient hook so the ACH actually used each hour is
> the coupled value, computing `glazingAreaM2` as the sum of `building.windows[].area` and
> `envelopeAreaM2` as the sum of exterior-boundary `building.surfaces[].area` plus that glazing area.
> Push a `meta.warnings` entry when `clampedBySafetyFloor` is true, worded so a non-expert
> understands the carbon-monoxide risk — the KPI panel (T-51) renders it verbatim.
>
> **Do not remove the existing `infiltration()` function or its floor.** The floor is enforced twice
> on purpose (global rule 10) and a third enforcement in the optimiser (T-56) is also intended.
> Defence in depth is not redundancy to be cleaned up.

**Files you may touch.** `packages/engine/src/loads/infiltration.ts`,
`packages/engine/test/infiltration.test.ts` (create), the single `hasUnventedCombustion?` field in
`packages/engine/src/types.ts`, and the coefficient hook in `packages/engine/src/index.ts`.
**Files you may NOT touch.** `constants.ts` (T-06 owns `ACH_MIN_COMBUSTION_ALLOWANCE`; declare
`ACH_PER_GLAZING_FRACTION` in your own module, per §7.9). `solve/`, `surfaces/`, `solar/`,
`envelope/`, `post/`.

**Subagent guidance.** Single agent. Small, surgical, safety-critical — one pair of eyes on the
whole change is better than three on parts of it.

**ACCEPTANCE TESTS — the task is NOT done until every one passes:**
1. `effectiveAch` is **strictly increasing** in glazing area with everything else fixed, over 50
   sampled glazing areas. Assert monotonicity in a loop.
2. Sweeping glazing from 0 % to 50 % of a 60 m² envelope raises ACH by exactly
   `1.2 × 0.5 = 0.6` air changes per hour, to within 1e-9.
3. `effectiveAch(0.1, 0, A, false)` returns exactly **0.35** with `clampedBySafetyFloor: true`.
4. `effectiveAch(0.1, 0, A, true)` returns exactly **0.70** with `clampedBySafetyFloor: true` —
   **the bukhari case**.
5. `effectiveAch(2.0, 0, A, false)` returns exactly **2.0** with `clampedBySafetyFloor: false` — a
   leaky building is never "corrected" upward.
6. `envelopeAreaM2 = 0` throws `EngineError('INVALID_INPUT')`.
7. **The K-05 curve, end to end:** sweep south glazing from 0 % to 50 % of the south wall on the
   `shelterA_stone400` fixture with a January Leh day, everything else fixed, and plot
   `auxEnergyKWhPerDay`. **The curve must have an interior optimum** — it improves, then degrades.
   Paste the full series of (glazing %, auxEnergyKWhPerDay) pairs and name the optimum. **If the
   curve is monotonic in either direction, this task is NOT done** — either the coupling is too weak
   or the gain side is broken, and both are findings to report, not to tune away.
8. A run that trips the floor produces a `meta.warnings` entry containing the words "carbon
   monoxide" or "ventilation".
9. `ACH_PER_GLAZING_FRACTION` appears **exactly once** in the whole repository, as a named export
   carrying the calibration comment: `grep -rn "ACH_PER_GLAZING_FRACTION" packages apps | wc -l`
   returns the number of usages, and the *declaration* count is 1.
10. `npx vitest run` exits 0; the pre-existing safety tests *"a request below ACH_MIN is silently
    raised, not honoured"* and *"overriding the floor requires an explicit flag AND emits a
    warning"* both still pass.
11. `meta.energyBalanceResidual < 1e-3` still holds on every fixture. Paste the maximum.

**Evidence (fill this in when done — numbers, not adjectives):**
```
```

**Completed by:** ___  **Date:** ___

---

### [ ] T-22 — Split out `post/heatFlows.ts` and add the ΔT and ground series

**Area:** B — Engine (≈ W-24) · **Status:** NOT STARTED · **Est:** 4 h
**Depends on:** T-06 · **Conflicts with:** T-16 (edits `post/kpis.ts`)

**Why this exists.** The problem statement's **deliverable 3** is phrased *"Heat flow details **as
per the temperature difference between ambient and shelter temperature** for a defined time
period."* The ΔT series is a **named requirement**, and it does not exist in `SimulationResult`.
`CHALLENGE.md` C-16 warns that burying a named deliverable is a needless way to appear to have
missed a stated requirement. The heat-flow chart (T-49) also needs a `Q` vs ΔT scatter, whose slope
should come out at ≈ `ΣUA` — an implicit self-check the user can see on screen.

**PROMPT — paste this to start the task:**
> Move `assembleHeatFlows` out of `packages/engine/src/post/kpis.ts` into a new
> `packages/engine/src/post/heatFlows.ts`, and extend it. `TECH.md` §5 lists this file; it was never
> created (`LOG.md` §9 D-7).
>
> 1. **Move, do not rewrite.** Cut `assembleHeatFlows` and its local helpers into the new file,
>    re-export from `post/kpis.ts` if anything imports it from there, and confirm the 65 tests still
>    pass before you change any behaviour. Commit that move separately from step 2 so a regression
>    is bisectable.
>
> 2. **Add two series to `HeatFlows`** (this is a `types.ts` addition this task is permitted to
>    make, and only these):
>    - `deltaT: Float64Array` — `indoorAir[i] − ambient[i]`, in Kelvin-degrees, a plain number
>      (a ΔT is never branded; §7.1).
>    - and add `ground: Float64Array` to `SimulationResult.temperatures` — the floor's boundary
>      node temperature, which the integrator already computes and currently discards.
>
> 3. Verify `dailyTotalsKWh` is keyed by **exactly the same field names** as the series, with no
>    extra and no missing key, so the Sankey (T-49) can consume it without a mapping table. A
>    mapping table is a place for a term to go missing, which is precisely how Q7 was lost once
>    already.
>
> 4. Confirm the trapezoidal integration in `dailyTotalsKWh` divides by `3.6e6` and not by
>    something else. Add a test that a constant 1000 W series over 24 h integrates to exactly
>    24 kWh.
>
> Do not recompute any physics. You are assembling what the integrator's `record` hook already
> captured. If a term is wrong, that is a defect in the module that produced it — report it, do not
> patch it here (global rule 16).

**Files you may touch.** `packages/engine/src/post/heatFlows.ts` (create),
`packages/engine/src/post/kpis.ts` (move out only), the two named additions in
`packages/engine/src/types.ts`, the `record` hook in `packages/engine/src/solve/integrator.ts`
**only** to surface the already-computed ground temperature,
`packages/engine/test/heatFlows.test.ts` (create).
**Files you may NOT touch.** `post/energyBalance.ts`, `post/conversions.ts`, `solve/assemble.ts`,
anything under `loads/`, `surfaces/`, `solar/`, `envelope/`.

**Subagent guidance.** Single agent. Straightforward — do not fan out.

**ACCEPTANCE TESTS — the task is NOT done until every one passes:**
1. After step 1 alone (the pure move), `npx vitest run` exits 0 with **exactly** 65 tests passing.
2. All fourteen series exist on `heatFlows` (Q1–Q11, `Qaux`, `storageRate`, `deltaT`), are the same
   length as `time`, and contain only finite numbers.
3. `deltaT[i] === indoorAir[i] − ambient[i]` **exactly**, for every `i`, over a full run.
4. `temperatures.ground` exists, is the same length as `time`, and is **not** equal to
   `temperatures.ambient` — the `CHALLENGE.md` C-05 failure mode is floor-as-wall. Paste the
   maximum absolute difference between the two series over a January Leh day.
5. `Q7_interiorLongwave` is present and **non-zero** for a building with more than one interior
   surface. Paste its daily total in kWh.
6. `Q1`, `Q2`, `Q11` and `Qaux` are ≥ 0 at every timestep.
7. `Q4_skyRadiation` is ≤ 0 at every timestep of a clear Leh night.
8. **Redistribution closes:** `Q7` integrated over the whole run sums to 0 within 1e-6 relative —
   interior longwave moves heat, it does not create it.
9. `Object.keys(dailyTotalsKWh)` matches the series field names **one-for-one**: no extra key, no
   missing key. Assert both directions.
10. A constant 1000 W series over 24 h integrates to **24.000 kWh ± 0.001**.
11. Trapezoidal totals agree with a rectangle-rule sum to within **1 %** on a smooth series.
12. `meta.energyBalanceResidual` is unchanged to 1e-12 from before this task — you added reporting,
    not physics. Paste both values.

**Evidence (fill this in when done — numbers, not adjectives):**
```
```

**Completed by:** ___  **Date:** ___

---

### [ ] T-23 — Validation Test 5 against NOAA, and print every measured pair

**Area:** B — Engine (≈ W-46, W-47) · **Status:** NOT STARTED · **Est:** 5 h
**Depends on:** T-07 · **Conflicts with:** T-07 (imports its helpers, never edits them)

**Why this exists.** Two gaps. **(a)** Validation Test 5 is currently **PARTIAL**: `solar.test.ts`
checks the analytically known peak altitudes but never compares against an **external** reference.
`CHALLENGE.md` C-11 is a KILL-SHOT — *"show me a case where you compared this against something
other than yourselves"* — and NOAA's Solar Calculator is free, authoritative and citable.
**(b)** The gate tests assert their tolerances but do not **print** the measured pairs, so
`VALIDATION.md` (T-63) has nothing to quote. `WORKERS.md` §9.6 is right about this: test stdout
evaporates when CI rotates its logs, and "Test 2 passed" is not something a validation document can
quote.

**PROMPT — paste this to start the task:**
> Two pieces of work, both in test files only.
>
> **Piece 1 — `packages/engine/test/validation-noaa.test.ts`.**
> Compare computed sunrise, solar noon, sunset and peak solar altitude at **Leh (34.15 °N,
> 77.58 °E, standard meridian 82.5 °E, IST)** against the **NOAA Solar Calculator** on four dates:
> 21 Mar, 21 Jun, 21 Sep, 21 Dec.
> **Commit the NOAA reference values as literals in the test file, each with the date you retrieved
> it**, so the comparison is reproducible offline and the test never calls the network. A test that
> fetches a reference is not a validation test; it is an outage waiting to happen.
> Pass criteria, from `BLUEPRINT.md` 9.5: times within **2 minutes**, altitudes within **0.2°**.
> Also re-assert the three analytically known peak altitudes — 32.4° / 55.85° / 79.3° — so the
> external and analytical anchors sit side by side in one file.
> ⚠ If you cannot retrieve NOAA values (no network), **do not invent them**. Write the test with
> the literals left as `⚠ VALUE NOT YET RETRIEVED` placeholders that make the test `skip` with an
> explicit message, set this task `[!]` with the reason, and say so in your Evidence. A fabricated
> reference value is worse than a missing one: it produces a validation claim that cannot survive
> one check by a judge.
>
> **Piece 2 — make the numbers quotable.**
> In `packages/engine/test/gate.test.ts`, `integrator.test.ts` and `mesh.test.ts`, add a
> `console.log` (or use T-07's `assertWithin`, which prints on pass as well as fail) beside every
> analytical comparison, printing one line per case in the exact form:
> `TEST<n> <case>: measured <x>, analytical <y>, deviation <z>%`
> Emit a machine-readable copy to `packages/engine/test/output/validation-numbers.csv` with columns
> `test,case,measured,analytical,deviation_pct,tolerance,pass`, and commit it. T-63 lifts this file
> directly into `VALIDATION.md`; T-69 quotes it in the deck.
> **Change no assertion and no tolerance.** You are adding output, not behaviour. If adding a print
> changes a result, something is very wrong and that is the finding.
>
> Do not fix engine code from inside a test file. If a comparison fails, report it in your Evidence
> naming the owning task (global rule 16).

**Files you may touch.** `packages/engine/test/validation-noaa.test.ts` (create),
`packages/engine/test/gate.test.ts`, `packages/engine/test/integrator.test.ts`,
`packages/engine/test/mesh.test.ts` (prints only),
`packages/engine/test/output/validation-numbers.csv` (create).
**Files you may NOT touch.** **Anything** under `packages/engine/src`.
`packages/engine/test/fixtures.ts` and `helpers.ts` (T-07 owns them — import, never edit).

**Subagent guidance.** Two genuinely independent pieces with no shared file, so this is one of the
few places fan-out earns its keep. **Spawn 2 subagents:** one owns
`validation-noaa.test.ts` exclusively; the other owns the print/CSV additions to the three existing
test files exclusively. They share no file. Give each its own acceptance tests from the list below
(1–6 to the first, 7–12 to the second). **Merge only when both report green and
`npx vitest run` passes on the combined tree.**

**ACCEPTANCE TESTS — the task is NOT done until every one passes:**
1. Computed sunrise matches NOAA within **2 minutes** on all four dates. Paste all four pairs.
2. Computed solar noon matches NOAA within **2 minutes** on all four dates. Paste all four pairs.
3. Computed sunset matches NOAA within **2 minutes** on all four dates. Paste all four pairs.
4. Peak solar altitude matches NOAA within **0.2°** on all four dates, and reproduces
   **32.4 / 55.85 / 79.3** for 21 Dec / equinox / 21 Jun.
5. The NOAA reference values are present as **literals with a retrieval date** in the test file.
6. `grep -c "fetch(\|http" packages/engine/test/validation-noaa.test.ts` returns **0** — the test
   does not call the network.
7. Running `npx vitest run` prints at least one `TEST2 ...: measured ..., analytical ...,
   deviation ...%` line per gate case. Paste the full block of printed lines.
8. `packages/engine/test/output/validation-numbers.csv` exists, has the seven named columns, and has
   one row per analytical comparison across tests 1–4 and 6–8.
9. Every `pass` column value in that CSV is `true`.
10. Every `deviation_pct` in that CSV is within its row's `tolerance`.
11. `git diff packages/engine/test/gate.test.ts | grep -c "^-.*expect"` returns **0** — no assertion
    was removed or altered.
12. `npx vitest run` exits 0 with **more than 65** tests passing. Paste the new total.

**Evidence (fill this in when done — numbers, not adjectives):**
```
```

**Completed by:** ___  **Date:** ___

---

# AREA C — DATA LAYER

> Everything here lives in a new package `packages/data` (`@shelter/data`), which has **zero runtime
> dependencies** — TMY payloads are JSON files in the repository. It must never import
> `@prisma/client` (global rule 17); the database *serves* this data, it does not *own* it.

---

### [ ] T-24 — Material, glazing and construction catalogues, every row cited

**Area:** C — Data (≈ W-26) · **Status:** NOT STARTED · **Est:** 8 h
**Depends on:** T-06 · **Conflicts with:** T-28 (reads these by id, never edits them)

**Why this exists.** Every number the engine looks up rather than computes, each with a citation a
judge can check. **`source` is mandatory** (`BLUEPRINT.md` 7.4, global rule 20): when a DRDO
evaluator asks where the rammed-earth conductivity came from, "IS 3792 / ASHRAE Handbook of
Fundamentals Ch. 26" is an answer; silence is not. `locallyAvailableLadakh` drives a real
constraint — EPS shipped over the Zoji La has a logistics cost and a seasonal availability window,
so the optimiser can restrict itself to locally sourceable materials.

**PROMPT — paste this to start the task:**
> Create `packages/data/` as an npm workspace package `@shelter/data`, `"type": "module"`, **zero
> runtime dependencies**, with its own `tsconfig.json` extending `tsconfig.base.json`. Add it to the
> root `workspaces` array — this is the one permitted `package.json` edit in this task.
>
> Create `packages/data/src/materials.ts`, `glazing.ts`, `constructions.ts` and `index.ts`.
>
> **`materials.ts`** exports `MATERIALS: readonly Material[]` and
> `materialById(id): Material` (throwing `EngineError('UNKNOWN_MATERIAL')` on a miss).
> Load **every row** of the tables restated in `LOG.md` §7.11 — all 11 structural/mass materials,
> all 8 insulation entries (the 25 mm air gap is a pure resistance: represent it as a material with
> `k = thickness / 0.18` at its nominal 25 mm and a comment saying so), and the 4 "other" rows
> (steel, water, gravel/soil, PCM paraffin RT25). Apply the 8 surface optical finishes as
> `alphaSolar`/`emissivity` on the appropriate rows.
> Fill `source` on **every single row** with a real citation — "ASHRAE Handbook of Fundamentals
> Ch. 26", "IS 3792", "SP:41", or a named manufacturer datasheet. Fill
> `locallyAvailableLadakh` honestly: earth, stone, timber, straw, sheep wool → `true`;
> EPS, XPS, PUF, PCM → `false`. Add `nameHi` for the common materials and a one-sentence `blurb` in
> plain language for every one — *"Mud brick: cheap, made locally, good at holding daytime heat."*
> Not a table of physical constants. The constants are there if a user expands the card.
>
> **`glazing.ts`** exports `GLAZING: readonly Glazing[]` and `glazingById`. All **6** glazing types
> from §7.11, with the capital-`U`/`SHGC` field names the disk uses.
>
> **`constructions.ts`** exports `CONSTRUCTIONS: readonly NamedConstruction[]` where
> `NamedConstruction = { id, name, nameHi?, layers: Layer[], blurb, source }` — the named wall,
> roof and floor assemblies the sweep's `wallConstruction`/`roofConstruction` variables select from,
> and the thing the UI's material dropdown actually lists. Ship at least: 400 mm stone masonry;
> 400 mm rammed earth; 350 mm rammed earth + 100 mm EPS **outside**; the same with EPS **inside**
> (these two must be distinguishable — insulation position is the single choice that can matter more
> than the amount); 230 mm fired brick; 150 mm RCC; CGI sheet + 50 mm PUF; mud-and-poplar roof;
> insulated roof; earth floor; insulated slab floor.
> ⚠ Define `NamedConstruction` **locally in this file** and export it. Do not add it to
> `packages/engine/src/types.ts`.
>
> Every catalogue file carries `export const SCHEMA_VERSION = 1;` and `index.ts` exports a
> `assertSchemaVersion(v: number)` that throws `EngineError('DATA_SCHEMA_MISMATCH')` on a mismatch.
> There is no runtime migration — the catalogue and the code ship together.
>
> Add `packages/data/test/catalog.test.ts`.
>
> Do not add a preset (T-28). Do not add weather (T-25, T-27). **Do not add a material that has no
> citation, even a plausible one.**

**Files you may touch.** Everything under `packages/data/src/` and `packages/data/test/`,
`packages/data/package.json`, `packages/data/tsconfig.json`, and the `workspaces` array in the root
`package.json`.
**Files you may NOT touch.** Anything under `packages/engine/`.

**Subagent guidance.** Single agent. It is three data files and a test — fan-out would only risk
three different citation conventions.

**ACCEPTANCE TESTS — the task is NOT done until every one passes:**
1. `MATERIALS.every(m => m.source.trim().length > 0)` is **true** — the mandatory-citation rule,
   asserted mechanically, not by inspection. Same for `GLAZING` and `CONSTRUCTIONS`.
2. Every `id` is unique across `MATERIALS`; same across `GLAZING`; same across `CONSTRUCTIONS`.
3. Every `k`, `rho`, `c` is strictly positive; every `alphaSolar` and `emissivity` is within
   `[0, 1]`.
4. **Spot values match §7.11 exactly:** rammed earth `k = 1.00, ρ = 1900, c = 880`;
   EPS `0.036 / 20 / 1400`; single glazing `U = 5.80, SHGC = 0.86, b0 = 0.04`; water `c = 4186`;
   steel `50 / 7800 / 480`. Paste all five.
5. Computed diffusivity `k/(ρ·c)` for dense concrete equals **8.29e-7 ± 1e-9** — the number every
   validation test depends on. Same check for rammed earth (5.98e-7) and fired brick (4.49e-7).
6. `materialById('nope')` throws `EngineError` with code `UNKNOWN_MATERIAL`;
   `glazingById('nope')` throws `UNKNOWN_GLAZING`.
7. At least one material exists in each of the four categories (`structural`, `insulation`,
   `finish`, `storage`).
8. **At least 6** materials have `locallyAvailableLadakh: true`, so T-56's local-materials
   constraint has a feasible search space. Paste the count and the ids.
9. Every `CONSTRUCTIONS` entry's `layers[].materialId` resolves through `materialById`.
10. The two 100 mm EPS constructions differ **only** in layer order, and `constructionUValue` from
    the engine returns the **same** U-value for both (insulation position changes dynamics, not
    steady-state U — if the U-values differ, the layer lists are wrong). Paste both U-values.
11. Every material has a non-empty `blurb` containing no symbol from the physics glossary
    (no `k`, `ρ`, `c`, `α`, `ε` as standalone tokens).
12. `assertSchemaVersion(2)` throws `EngineError('DATA_SCHEMA_MISMATCH')`.
13. `npm run typecheck` and `npx vitest run` both exit 0; the engine's 65 tests are unaffected.
14. `packages/data/package.json` has no `dependencies` key.

**Evidence (fill this in when done — numbers, not adjectives):**
```
```

**Completed by:** ___  **Date:** ___

---

### [ ] T-25 — The weather pipeline, with the mandatory lapse-rate correction

**Area:** C — Data (≈ W-27) · **Status:** NOT STARTED · **Est:** 12 h
**Depends on:** T-24 · **Conflicts with:** T-27 (owns the payloads; you own the schema)

**Why this exists.** NASA POWER's grid cell is ~55 km × 58 km. In the Himalaya **one cell can
contain a 3,000 m valley floor and a 6,500 m ridge**, and POWER reports the cell-mean elevation. At
a 6.5 °C/km lapse rate, a 500 m elevation error is **3.25 °C of temperature error — larger than many
of the design effects the tool is trying to resolve.** Correcting for it, and showing the
correction on screen rather than applying it quietly, is the single clearest signal that this is an
engineering submission rather than a demo. Most teams will use POWER raw and never mention it.

**PROMPT — paste this to start the task:**
> Create `packages/data/src/weather/pipeline.ts` and `packages/data/src/weather/csv.ts`, plus
> `packages/data/test/weather.test.ts`.
>
> `pipeline.ts` exports `normaliseWeather(raw, opts): WeatherSeries`, implementing these stages
> **in this order**:
>
> 1. **Normalise** to the canonical `WeatherSeries` of `LOG.md` §7.6 — field names `T_amb`, `GHI`,
>    `v_wind`, `DNI?`, `DHI?`, `LW_down?`, `RH?`, arrays as `Float64Array`, temperatures converted
>    to **Kelvin** at this boundary and never again afterwards.
>
> 2. **Lapse-rate correction.**
>    `T_corrected = T_source + Γ · (h_source − h_site) / 1000`, with `Γ = 6.5 K/km`
>    (`LAPSE_RATE = 6.5e-3 K/m` in `constants.ts` — **note the unit, it is per metre on disk**;
>    configurable 5–7 and exposed as a **calibration knob** per global rule 14).
>    Record the actual Kelvin offset applied in `provenance.lapseCorrectionK` and the source
>    elevation in `provenance.sourceElevation`. **Skipped entirely for user CSV**, which sets
>    `lapseCorrectionK: 0` and `sourceElevation: null`.
>
> 3. **Gap-fill** by linear interpolation for gaps up to **3 hours**. A longer gap is still
>    interpolated but pushes a `provenance.notes` entry naming the gap's start index and length.
>
> 4. **Derive missing fields**, importing from the engine — do **not** reimplement:
>    no `DNI`/`DHI` → Erbs from `@shelter/engine` `solar/decomposition`;
>    no `LW_down` → Swinbank from `surfaces/exterior`'s `skyTemperature` path;
>    no pressure → the barometric formula in `air.ts`.
>    Each derivation pushes a `notes` entry saying which field was derived and by what correlation,
>    because a judge asking "was that measured or estimated?" deserves an answer on screen.
>
> 5. **Resample** to the requested Δt: **linear for temperature, wind and humidity**, but
>    **energy-conserving for irradiance** so that `∫GHI dt` over the day is preserved. Linear
>    interpolation of an hourly-mean irradiance series changes the daily total, which changes every
>    solar number downstream. Implement the conserving path explicitly and comment why.
>
> 6. **Validate:** no `NaN` anywhere; `GHI >= 0`; temperature within `[180, 330] K`; all arrays the
>    same length. Any failure throws `EngineError('WEATHER_INVALID')` **naming the field and the
>    index**.
>    ⚠ **Do NOT implement "GHI = 0 between sunset and sunrise" as a hard failure.** `AUDIT.md`
>    records that it false-positives on real hourly-averaged data, where the sunrise hour
>    legitimately carries non-zero mean irradiance. Implement it as a **warning**, triggered only
>    when GHI exceeds **20 W/m²** more than one hour outside daylight.
>
> `csv.ts` parses a user upload with a documented column contract and **per-row** errors — a
> malformed row reports its row number and its offending column, and the whole file is rejected only
> if the contract is unmeetable. A user with a data logger at a real Ladakhi post is exactly the
> person this feature is for; a generic "invalid CSV" tells them nothing.
>
> **No `fetch` anywhere in this package.** T-26 owns the URL builders and parsers; T-37's API route
> is the only thing that makes a network call.

**Files you may touch.** `packages/data/src/weather/pipeline.ts`, `packages/data/src/weather/csv.ts`,
`packages/data/test/weather.test.ts`.
**Files you may NOT touch.** `packages/data/src/materials.ts`, `glazing.ts`, `constructions.ts`,
`packages/data/tmy/*`, anything under `packages/engine/`.

**Subagent guidance.** Single agent. The six stages are strictly sequential and share one data
structure; splitting them across agents means six different opinions about where Kelvin starts.

**ACCEPTANCE TESTS — the task is NOT done until every one passes:**
1. **The `TECH.md` §9.3 worked example:** a source at 4,120 m used for a 3,500 m site raises every
   temperature by `6.5 × 0.62 = 4.03 K ± 0.01`, and `provenance.lapseCorrectionK` records `4.03`.
   Paste the computed offset.
2. A user-CSV source has `lapseCorrectionK === 0`, `sourceElevation === null`, and temperatures
   identical to its input to 1e-12.
3. **Energy-conserving resample:** `∫GHI dt` over a day is preserved to within **0.1 %** when
   resampling 3600 s → 300 s. Then assert that a **linear** resample of the same data changes it by
   **more than** 0.1 %. Paste both integrals and both deviations — documenting the difference is the
   point.
4. A 2-hour gap is interpolated with **no** note; a 5-hour gap is interpolated **and** produces a
   note naming the gap.
5. Input with only `GHI` produces `DNI` and `DHI` satisfying `DNI·cos(θ_z) + DHI = GHI` to **1e-9**
   at every hour with `θ_z < 87°`.
6. Input without `LW_down` yields Swinbank sky temperatures; input with `LW_down` uses the measured
   path, and the two differ. Paste a sample pair.
7. **The `AUDIT.md` false-positive case:** real hourly-averaged data with 40 W/m² at the sunrise
   hour produces **no** warning; a series with 300 W/m² at 02:00 **does**.
8. A series containing a `NaN` throws `EngineError('WEATHER_INVALID')` whose message names the field
   and the index.
9. A temperature of 400 K throws `WEATHER_INVALID`; 250 K does not.
10. Arrays of unequal length throw `WEATHER_INVALID`.
11. A CSV with a bad value in row 47 reports **row 47** and the column name, and leaves the
    previously loaded series untouched.
12. `grep -rn "fetch(" packages/data/src` returns **no matches**.
13. The output of `normaliseWeather` passes straight into `simulate()` without adaptation, and
    `meta.energyBalanceResidual < 1e-3`.

**Evidence (fill this in when done — numbers, not adjectives):**
```
```

**Completed by:** ___  **Date:** ___

---

### [ ] T-26 — NASA POWER and Open-Meteo request builders and response parsers

**Area:** C — Data (≈ W-27, the sources half) · **Status:** NOT STARTED · **Est:** 5 h
**Depends on:** T-25 · **Conflicts with:** none

**Why this exists.** The two upstream weather sources have to be reachable from the server tier, but
**`packages/data` performs no network I/O** — that is what keeps it usable inside a Web Worker and
inside a test. So the URL building and the response parsing live here as pure functions, and the one
place that actually calls `fetch` is T-37's API route. This split is also what makes T-31's weather
cache testable without a network.

**PROMPT — paste this to start the task:**
> Create `packages/data/src/weather/sources.ts` and `packages/data/test/sources.test.ts`.
>
> Export pure builders and parsers — **no `fetch`, no `await` on I/O, no side effects**:
>
> ```ts
> export interface WeatherQuery {
>   latitude: number; longitude: number;
>   startDate: string; endDate: string;      // ISO 'YYYY-MM-DD', inclusive
> }
> export function nasaPowerUrl(q: WeatherQuery, baseUrl?: string): string;
> export function parseNasaPower(json: unknown, q: WeatherQuery): RawWeather;
> export function openMeteoUrl(q: WeatherQuery, baseUrl?: string): string;
> export function parseOpenMeteo(json: unknown, q: WeatherQuery): RawWeather;
> ```
>
> `RawWeather` is defined **locally in this file** and is the un-normalised input that T-25's
> `normaliseWeather` consumes: parallel arrays plus the source's own elevation and a provenance stub.
>
> **NASA POWER parameters** (`TECH.md` §9.2) — request exactly these and no others:
> `T2M` (air temperature at 2 m, °C), `ALLSKY_SFC_SW_DWN` (GHI, W/m²),
> `ALLSKY_SFC_SW_DNI` (DNI), `ALLSKY_SFC_SW_DIFF` (DHI),
> `ALLSKY_SFC_LW_DWN` (**essential for Q4**), `WS2M` (wind, m/s), `RH2M` (%), `PS` (kPa).
> Hourly temporal resolution, `community=RE`, JSON format.
> **Open-Meteo** (ERA5 archive): the equivalent hourly variables, keyless.
>
> Both parsers must:
> - detect and convert the source's **fill value for missing data** (NASA POWER uses `-999`) into a
>   gap that T-25's gap-filler will handle, **never** into a literal −999 temperature;
> - read the source **elevation** out of the response where present and put it into
>   `RawWeather.sourceElevation`, because T-25's lapse correction depends on it and a wrong
>   elevation is a silent 3 °C error;
> - throw `EngineError('WEATHER_INVALID')` with a message naming the field on a shape they do not
>   recognise, rather than returning a partially populated object;
> - be tested against **committed fixture JSON** captured from a real response, stored under
>   `packages/data/test/fixtures/`, so the test never touches the network.
>
> Both URL builders take an optional `baseUrl` so `NASA_POWER_BASE_URL` / `OPEN_METEO_BASE_URL`
> (§7.16) can redirect them, and default to the public endpoints. **No API keys** — both sources are
> keyless, and this project has no secrets.

**Files you may touch.** `packages/data/src/weather/sources.ts`,
`packages/data/test/sources.test.ts`, `packages/data/test/fixtures/*.json`.
**Files you may NOT touch.** `pipeline.ts`, `csv.ts`, `materials.ts`, anything under
`packages/engine/` or `apps/`.

**Subagent guidance.** Single agent. Two symmetric parsers — the symmetry is the point, and two
agents would break it.

**ACCEPTANCE TESTS — the task is NOT done until every one passes:**
1. `nasaPowerUrl({lat: 34.15, lon: 77.58, ...})` contains all eight parameter names listed above,
   the coordinates, and `temporal/hourly`. Paste the generated URL.
2. `openMeteoUrl` likewise. Paste it.
3. Both builders honour an injected `baseUrl` and produce no URL pointing at the public endpoint
   when one is supplied.
4. `parseNasaPower` on the committed fixture returns arrays of **equal length** matching the
   requested date range's hour count. Paste the length.
5. A `-999` in the fixture becomes a **gap marker**, not a temperature. Assert that no returned
   temperature is below 180 K after normalisation.
6. `parseNasaPower` extracts a non-null `sourceElevation`. Paste the value and the grid cell.
7. `parseOpenMeteo` on its fixture produces arrays the same length as the NASA fixture for the same
   range, and the two agree on daily mean temperature within **5 K** (they are different
   reanalyses; this checks for a unit or offset blunder, not for agreement).
8. Both parsers throw `EngineError('WEATHER_INVALID')` on `{}`, and the message names a field.
9. Both parsers throw on a response whose arrays have mismatched lengths.
10. `grep -rn "fetch(\|XMLHttpRequest\|axios" packages/data/src` returns **no matches**.
11. `grep -rn "api_key\|apiKey\|Bearer" packages/data/src` returns **no matches**.
12. The output of either parser fed to `normaliseWeather` yields a `WeatherSeries` that
    `simulate()` accepts.

**Evidence (fill this in when done — numbers, not adjectives):**
```
```

**Completed by:** ___  **Date:** ___

---

### [ ] T-27 — Bundled TMY for Leh, Kargil, Drass, Nubra and Jaisalmer

**Area:** C — Data (≈ W-28) · **Status:** NOT STARTED · **Est:** 10 h
**Depends on:** T-25, T-26 · **Conflicts with:** T-25 (schema is theirs, payloads are yours)

**Why this exists.** **Bundle first, fetch second.** A live API call on the demo path is a coin flip
in front of judges, and real Ladakh deployment has no connectivity at all. `CHALLENGE.md` C-12 is
explicit: disconnect the network, run a full Leh simulation end to end. The second, subtler risk is
provenance — *"where did your weather data come from?"* is a fair question and **"we made it up"
undermines the area-specific claim that is the tool's entire premise.**

**PROMPT — paste this to start the task:**
> Acquire hourly annual data for **Leh, Kargil, Drass, Nubra** and **Jaisalmer** (the hot-dry
> contrast city that demonstrates the generality the problem statement asks for) using T-26's
> builders and parsers, run each through T-25's `normaliseWeather`, and write each as
> `packages/data/tmy/<id>.json` conforming **exactly** to `WeatherSeries` (§7.6), with
> `Float64Array` fields serialised as plain number arrays via T-06's `seriesToJson`.
>
> Every file's `provenance` must name: the source, the dataset, the grid cell coordinates, the years
> averaged, the retrieval date, and the source elevation. A file without complete provenance does
> not ship.
>
> Derive a **ground-albedo series** for each Ladakh location and store it so presets can use it as
> `Site.groundAlbedo`: summer **0.30** (dry high-altitude desert, deliberately higher than the
> textbook 0.2) and winter-snow **0.75** (`BLUEPRINT.md` Appendix C — the detail most teams miss).
> Use a documented rule to decide which hours are snow-covered — e.g. daily mean below 0 °C during
> November–March — and write the rule into `packages/data/tmy/README.md`. Do not add a `snowCover`
> boolean field to `WeatherSeries`; the albedo series **is** the representation (§7.6).
>
> Create `packages/data/tmy/README.md` recording **exactly how each file was fetched** — the URL,
> the date, the parameters — so a judge, or a teammate six weeks from now, can reproduce it.
>
> Create `packages/data/src/tmy.ts` exporting `tmyById(id): WeatherSeries` (deserialising through
> `seriesFromJson`) and `TMY_LOCATIONS: readonly { id, name, latitude, longitude, elevation }[]`.
>
> Add `packages/data/test/tmy.test.ts`.
>
> ⚠ **Do not hand-author or synthesise a single value.** Every number is downloaded. "We made it up"
> is the specific failure `CHALLENGE.md` C-12 names. If a location cannot be retrieved, ship the
> ones you have, mark this task `[!]` naming the missing location, and say so in your Evidence —
> four real locations beat five where one is invented.

**Files you may touch.** `packages/data/tmy/*`, `packages/data/src/tmy.ts`,
`packages/data/test/tmy.test.ts`.
**Files you may NOT touch.** `packages/data/src/weather/*` (T-25 and T-26 own them),
`materials.ts`, `glazing.ts`, `constructions.ts`, anything under `packages/engine/`.

**Subagent guidance.** **Spawn 2 subagents** only if network retrieval is slow enough to dominate:
one fetches and writes the four Ladakh locations, the other fetches and writes Jaisalmer plus the
`tmy.ts` loader and the README. They share no file. **Merge only when both report green and the
combined `tmy.test.ts` passes.** Otherwise single agent.

**ACCEPTANCE TESTS — the task is NOT done until every one passes:**
1. All five files parse as `WeatherSeries` and pass T-25's validator with **zero** errors.
2. Every file has **8,760** hourly values in every array (8,784 for a leap year), with equal lengths
   across arrays. Paste each file's length.
3. Every `provenance.label` is non-empty and names a source, a grid cell and a retrieval date;
   every `provenance.sourceElevation` is a number, not null.
4. **Leh's January mean temperature lands within ±3 °C of −8 °C**, and January minima reach the
   −15 to −20 °C band (`BLUEPRINT.md` Appendix C). Paste the computed January mean and minimum.
5. **The strongest reality check:** Leh's annual GHI integrates to **1,900–2,100 kWh/m²/yr** — the
   figure given in the DRDO problem statement itself. Paste the computed total. If it is outside
   that band the data is wrong, the units are wrong, or the integration is wrong; do not ship it.
6. Leh's mean daily sunshine works out near **7.9 h** and clear days exceed **300** by a documented
   clearness criterion (both figures are in the problem statement). Paste both.
7. **Jaisalmer's July mean is at least 20 K above Leh's January mean** — the contrast preset
   genuinely contrasts. Paste both means.
8. The derived ground-albedo series is 0.75 for some winter hours at Leh and 0.30 for all July
   hours. Paste the count of snow hours.
9. Total bundled size of all five files is **under 8 MB** after minification, so the offline bundle
   stays installable. Paste the byte total.
10. `packages/data/tmy/README.md` exists and contains, for each location, a reproducible URL and a
    retrieval date.
11. **With the network disabled**, `tmyById('leh')` → `simulate()` runs end to end and returns
    `meta.energyBalanceResidual < 1e-3`. Paste the residual. This is the C-12 test.
12. `tmyById('nope')` throws rather than returning undefined.

**Evidence (fill this in when done — numbers, not adjectives):**
```
```

**Completed by:** ___  **Date:** ___

---

### [ ] T-28 — Presets: the app opens on an interesting result

**Area:** C — Data (≈ W-29) · **Status:** NOT STARTED · **Est:** 6 h
**Depends on:** T-24, T-27 · **Conflicts with:** T-24 (reads catalogues by id, never edits)

**Why this exists.** `CHALLENGE.md` C-19 calls the empty first screen an **underrated failure**: a
presenter filling in a form while judges watch. A preloaded Leh scenario means the demo opens on a
result. Presets are also the fixture set the CI energy-balance gate (T-04) asserts against, and the
archetypes the Compare screen needs.

**PROMPT — paste this to start the task:**
> Create `packages/data/src/presets.ts` exporting `PRESETS: readonly Preset[]` and
> `presetById(id)`, using the `Preset` type T-06 added. Six presets:
>
> 1. **Traditional Ladakhi house** — stone/mud walls, mud-and-poplar roof, small windows, leaky
>    (ACH ≈ 2.0), **livestock in a byre below** (a real vernacular strategy, not a joke: add their
>    heat to `internalGainsSchedule` at 500 W per animal and say so in the description).
> 2. **Army / BRO barrack** — CGI sheet or RCC, minimal insulation, large single glazing.
> 3. **Modern RCC** — high mass, no insulation. The common new-build failure case.
> 4. **GERES Trombe-wall retrofit** — approximated as a high-mass south wall with an outer glazing
>    layer represented as added surface resistance and suppressed exterior convection.
>    ⚠ **This approximation must be named in `approximations`** and surfaced in the UI. A true
>    two-air-node Trombe model is out of scope (global rule 12).
> 5. **Optimised passive design** — ⚠ **generated by running the sweep once and pasting the winner,
>    NOT hand-authored.** Record in a comment the exact `SweepRequest` that produced it and the
>    date. Until T-56 exists this preset is a placeholder: ship it marked
>    `approximations: ['placeholder -- to be replaced by a real sweep winner, see T-56']` and open a
>    note in your `.work/T-28.md` for T-56 to close. **Do not hand-author it and call it optimised**
>    — `AUDIT.md` C-16 records that exact failure in the original plan.
> 6. **Jaisalmer hot-dry contrast** — a non-Ladakh site with a different `locationId`.
>
> Every Ladakh preset uses the `Site` values from `LOG.md` §7.11 (Leh: 34.15 °N, 77.58 °E, 3,500 m,
> standard meridian 82.5, `groundTempMeanAnnual` 279.15 K, the seasonal albedo series from T-27)
> and sets `comfortBand` to **288.15–297.15 K (15–24 °C)** — ⚠ **not** a 22 °C ASHRAE office band.
> Appendix C says so explicitly: for a passive Ladakh shelter the meaningful KPI is the 06:00
> minimum and hours above 15 °C, not office-grade comfort.
>
> Add `packages/data/test/presets.test.ts`.

**Files you may touch.** `packages/data/src/presets.ts`, `packages/data/test/presets.test.ts`.
**Files you may NOT touch.** `materials.ts`, `glazing.ts`, `constructions.ts`, `tmy/*`,
`weather/*`, anything under `packages/engine/`.

**Subagent guidance.** Single agent. Six data literals that must be mutually comparable — one author
keeps them consistent.

**ACCEPTANCE TESTS — the task is NOT done until every one passes:**
1. All six presets run through `simulate` without throwing.
2. All six produce `meta.energyBalanceResidual < 1e-3`. Paste all six residuals — this is the
   assertion T-04's CI gate runs on every commit.
3. Every `materialId` and `glazingId` referenced resolves in T-24's catalogues.
4. Every `locationId` resolves to a bundled TMY file from T-27.
5. **Ordering sanity on a January Leh day:** preset 5 has a higher `tempAt0600` than presets 1, 2
   and 3. Paste all four values in °C.
6. **Preset 2 (steel barrack) has the largest `peakToPeakSwing`** of the Ladakh presets — the thin
   lightweight envelope should swing hardest. Paste all five swings. If it does not, that is a
   physics finding to report, not a preset to fudge.
7. Preset 4 carries a non-empty `approximations` array naming the Trombe simplification.
8. Preset 5 carries either its generating `SweepRequest` in a comment **or** the explicit
   placeholder marker. It is never silently presented as an optimised result.
9. Preset 6 uses a non-Ladakh site and a different `locationId`, and runs clean — the generality
   demonstration the problem statement asks for.
10. `comfortBand.lower === 288.15` in **every** Ladakh preset, not 293.15. Assert mechanically.
11. Preset 1's `internalGainsSchedule` reflects the livestock contribution and its description says
    so in plain language.
12. `presetById('nope')` throws.

**Evidence (fill this in when done — numbers, not adjectives):**
```
```

**Completed by:** ___  **Date:** ___

---

# AREA D — DATABASE TIER

> **NEW.** This tier does not appear in any source document — `plan.md` §9, `TECH.md` §3 and §9.6
> all cut the database explicitly. That cut is partially reversed by decision; read **§9, Deviation
> D-1** before starting anything here.
>
> **Three rules bind every task in this area and none of them is negotiable:**
> 1. **No users, no auth, no sessions, no JWT, no permissions, no `userId` column.** If a task seems
>    to need one, it does not.
> 2. **`packages/**` may never import `@prisma/client`.** The lint rule from T-03 enforces it and CI
>    asserts it. The engine must stay runnable in a browser.
> 3. **Every task here carries an acceptance test that stops the database and proves the app still
>    works.** The database is a cache and a share layer, never a dependency.

---

### [ ] T-29 — Prisma schema, the four tables, and the first migration

**Area:** D — Database · **Status:** NOT STARTED · **Est:** 6 h
**Depends on:** T-03, T-06 · **Conflicts with:** T-30…T-35 (all read this schema)

**Why this exists.** Four things need persisting and nothing else does. Getting the schema right
once, with the constraints in the database rather than in application code, is what keeps the other
six database tasks small.

**PROMPT — paste this to start the task:**
> Create `apps/web/` as a workspace package if it does not yet exist (a bare `package.json` and
> `tsconfig.json` are enough for this task — T-36 builds the Next.js app itself), add `prisma` as a
> devDependency and `@prisma/client` as a dependency **of `apps/web` only**, and add `apps/*` to the
> root `workspaces` array.
>
> Create `apps/web/prisma/schema.prisma` **verbatim from `LOG.md` §7.12**. Do not improvise fields,
> do not add a `User` model, do not add `createdBy` anywhere. The four models are `WeatherCache`,
> `DesignSnapshot`, `SimulationRun` and `Material`, with exactly the fields, indexes and unique
> constraints §7.12 lists.
>
> Support **both** providers: PostgreSQL in production, SQLite for local development. Prisma's
> `provider` is not directly env-switchable in older versions, so use whichever mechanism the
> installed Prisma version supports (`provider = env("DATABASE_PROVIDER")` where available,
> otherwise two schema files generated from one source and selected by an npm script). Document the
> choice in `apps/web/prisma/README.md` in under 15 lines. Default local dev to
> `DATABASE_URL="file:./dev.db"`.
>
> Generate the first migration as `apps/web/prisma/migrations/<timestamp>_init/`. Commit it.
> **Never edit a committed migration** — a schema change is always a new migration.
>
> Add npm scripts to `apps/web/package.json`: `db:generate`, `db:migrate` (dev),
> `db:migrate:deploy` (prod), `db:reset`, `db:seed` (T-30 fills the seed script in).
>
> Add `apps/web/.env.example` listing `DATABASE_URL` and `DATABASE_PROVIDER` with their local-dev
> values and a comment saying **the application must run with neither set** (§7.16).
>
> Do not write any repository code, any API route, or any seed data. Those are T-30…T-35.

**Files you may touch.** `apps/web/prisma/**`, `apps/web/package.json`, `apps/web/tsconfig.json`,
`apps/web/.env.example`, the `workspaces` array in the root `package.json`, `.gitignore` (to add
`apps/web/prisma/*.db*` if T-02 did not).
**Files you may NOT touch.** Anything under `packages/`. Any other file under `apps/web/`.

**Subagent guidance.** Single agent. One schema file — fan-out has nothing to divide.

**ACCEPTANCE TESTS — the task is NOT done until every one passes:**
1. `npx prisma validate --schema apps/web/prisma/schema.prisma` exits 0.
2. `npx prisma migrate dev --name init` against a fresh SQLite file applies cleanly and creates all
   four tables. Paste the table list from `.tables` or the equivalent.
3. **The migration rolls back:** `npx prisma migrate reset --force` drops and re-applies cleanly,
   ending with the same four tables and zero rows. Paste the before/after row counts.
4. **The unique constraint actually rejects a duplicate:** inserting two `WeatherCache` rows with
   identical `(source, latitude, longitude, startDate, endDate)` fails with a unique-constraint
   error from the **database**, not from application code. Paste the error.
5. The same for two `DesignSnapshot` rows with the same `shareId`, and two `SimulationRun` rows with
   the same `requestHash`.
6. `Material.source` is a required non-nullable column: inserting a row without it fails at the
   database. Paste the error.
7. `grep -c "model User\|userId\|password\|session\|token" apps/web/prisma/schema.prisma` returns
   **0**.
8. `grep -rn "@prisma/client" packages/ | wc -l` returns **0**, and `npm run lint` exits 0.
9. **The app still works with the database off:** with `DATABASE_URL` unset,
   `npx vitest run` exits 0 and the engine's 65 tests pass — nothing in `packages/` gained a
   database dependency.
10. `apps/web/package.json` lists `@prisma/client` in `dependencies` and `prisma` in
    `devDependencies`, and the root `package.json` lists neither.
11. The committed migration directory exists and contains a `migration.sql`.

**Evidence (fill this in when done — numbers, not adjectives):**
```
```

**Completed by:** ___  **Date:** ___

---

### [ ] T-30 — The database client wrapper, and the DB-off mode that must always work

**Area:** D — Database · **Status:** NOT STARTED · **Est:** 5 h
**Depends on:** T-29 · **Conflicts with:** T-31…T-35 (they all import this)

**Why this exists.** This is the task that makes global rule 18 true in code rather than in
intention. If every repository calls `new PrismaClient()` directly, then the first one that throws on
a missing `DATABASE_URL` takes the whole app down, and the offline story dies quietly. One wrapper,
one place where "the database is not there" is a normal condition rather than an error.

**PROMPT — paste this to start the task:**
> Create `apps/web/lib/db.ts`.
>
> ```ts
> /** null when DATABASE_URL is unset or the database is unreachable. Callers MUST handle null. */
> export function getDb(): PrismaClient | null;
> export async function dbHealthy(): Promise<boolean>;
> export async function withDb<T>(fn: (db: PrismaClient) => Promise<T>): Promise<T | null>;
> ```
>
> - `getDb()` returns `null` when `process.env.DATABASE_URL` is unset. It never throws. It memoises
>   a single `PrismaClient` per process (Next.js dev-mode hot reload otherwise leaks connections —
>   stash it on `globalThis` in development, the standard pattern).
> - `withDb(fn)` is the only call shape the repositories use: it returns `null` when there is no
>   database, and it **catches every database error, logs it once, and returns `null`** rather than
>   propagating. A cache miss and a dead database are the same thing to a caller — that equivalence
>   is the whole design.
> - `dbHealthy()` runs a trivial query with a **2-second timeout** and returns a boolean. It never
>   throws.
>
> Add `apps/web/lib/log.ts` — a thin wrapper that is a **no-op in production** and writes to
> `console` in development. This is the only logging in the repository; `packages/**` has none by
> design (§7.8).
>
> Write the **DB-off contract** as a comment at the top of `db.ts`, in these words or better:
> *"The database is a cache and a share layer, never a dependency. Every feature on the demo path
> must work with this returning null. If you find yourself writing `if (!db) throw`, you are writing
> a bug."*
>
> Add `apps/web/test/db.test.ts`.

**Files you may touch.** `apps/web/lib/db.ts`, `apps/web/lib/log.ts`, `apps/web/test/db.test.ts`.
**Files you may NOT touch.** `apps/web/prisma/**`, anything under `packages/`.

**Subagent guidance.** Single agent. One small file that everything else depends on being exactly
right.

**ACCEPTANCE TESTS — the task is NOT done until every one passes:**
1. With `DATABASE_URL` **unset**, `getDb()` returns `null` and does **not** throw.
2. With `DATABASE_URL` unset, `withDb(async db => db.material.count())` resolves to `null` and does
   not throw. Paste the resolved value.
3. With `DATABASE_URL` set to a **bogus** host, `withDb(...)` resolves to `null` within 5 seconds
   and does not throw. Paste the elapsed time.
4. With `DATABASE_URL` set correctly, `withDb(async db => db.material.count())` resolves to a
   number.
5. `dbHealthy()` returns `false` with no `DATABASE_URL`, `false` with a bogus one (within 3 s), and
   `true` against a live one. Paste all three and the bogus-case elapsed time.
6. Calling `getDb()` 100 times creates **one** client — assert by identity (`===`).
7. A thrown error inside `withDb` is logged **once**, not re-thrown. Assert the log call count.
8. `apps/web/lib/log.ts` produces no output when `NODE_ENV === 'production'`.
9. `grep -c "if (!db) throw\|if (db === null) throw" apps/web/lib apps/web/app -r` returns **0**.
10. `npx vitest run` exits 0 including the new tests; the engine's 65 still pass.

**Evidence (fill this in when done — numbers, not adjectives):**
```
```

**Completed by:** ___  **Date:** ___

---

### [ ] T-31 — The weather cache repository

**Area:** D — Database · **Status:** NOT STARTED · **Est:** 6 h
**Depends on:** T-26, T-30 · **Conflicts with:** none

**Why this exists.** NASA POWER and Open-Meteo are slow and rate-limited. The eighteen-scenario
matrix (T-59) and the design sweep both re-ask for the same cell constantly, and a rate-limit
response mid-demo is a failure the audience sees. **Never fetch the same cell twice.**

**PROMPT — paste this to start the task:**
> Create `apps/web/lib/repo/weather.ts`.
>
> ```ts
> export interface WeatherKey {
>   source: 'nasa-power' | 'open-meteo';
>   latitude: number; longitude: number;         // ROUNDED before use -- see below
>   startDate: string; endDate: string;          // 'YYYY-MM-DD'
> }
> export function weatherCellKey(k: WeatherKey): WeatherKey;   // canonicalises
> export async function readWeatherCache(k: WeatherKey): Promise<WeatherSeries | null>;
> export async function writeWeatherCache(
>   k: WeatherKey, series: WeatherSeries, rawPayload: unknown, sourceElevation: number | null
> ): Promise<void>;
> export async function purgeExpiredWeather(): Promise<number>;   // rows removed
> ```
>
> **Keying.** Round `latitude` and `longitude` to **4 decimal places** before they touch the key, so
> `34.15001` and `34.15` are one cell rather than two. Document why: a 4-decimal degree is about
> 11 m, far below any weather grid's resolution, and un-rounded floats would make the cache miss
> forever while quietly filling the table.
>
> **TTL.** `expiresAt = fetchedAt + 90 days` for a historical range whose `endDate` is in the past
> (reanalysis data for a past year does not change), and `fetchedAt + 24 hours` for any range whose
> `endDate` is today or later. Export the two windows as named constants with that reasoning in a
> comment. `readWeatherCache` treats an expired row as a **miss** and does not delete it inline —
> `purgeExpiredWeather` is a separate, explicitly called operation, so a read is never a write.
>
> **Serialisation.** Store `series` through T-06's `seriesToJson` and read it back through
> `seriesFromJson`, so `Float64Array` survives the round trip. Store `rawPayload` untouched, so a
> parsing bug in T-26 can be fixed later without refetching a single byte.
>
> **Every function returns gracefully when there is no database.** `readWeatherCache` returns `null`
> (indistinguishable from a miss); `writeWeatherCache` resolves without error and writes nothing;
> `purgeExpiredWeather` returns 0. All three go through `withDb`.
>
> Add `apps/web/test/repo-weather.test.ts`.

**Files you may touch.** `apps/web/lib/repo/weather.ts`, `apps/web/test/repo-weather.test.ts`.
**Files you may NOT touch.** `apps/web/lib/db.ts`, `apps/web/prisma/**`, other repositories,
anything under `packages/`.

**Subagent guidance.** Single agent. Straightforward — do not fan out.

**ACCEPTANCE TESTS — the task is NOT done until every one passes:**
1. A write followed by a read with the same key returns a `WeatherSeries` **deep-equal** to the one
   written, with `T_amb` coming back as a `Float64Array` (assert `instanceof`).
2. `weatherCellKey` rounds `34.150014` and `34.149996` to the **same** latitude; a read written
   under one hits under the other.
3. A read with a different `source`, or a different date range, is a **miss** (returns `null`).
4. **The unique constraint rejects a duplicate:** two `writeWeatherCache` calls with the same key
   result in **one** row, not two, and the second call does not throw (upsert semantics). Paste the
   row count.
5. A row whose `expiresAt` is in the past reads as a **miss** and is **still present** in the table
   afterwards. Paste the row count before and after the read.
6. `purgeExpiredWeather()` removes exactly the expired rows and returns their count. Paste it.
7. The TTL is 90 days for a past range and 24 hours for a current one — assert both computed
   `expiresAt` values.
8. **DB OFF:** with `DATABASE_URL` unset, `readWeatherCache` resolves to `null`,
   `writeWeatherCache` resolves without throwing, and `purgeExpiredWeather` returns 0. Paste all
   three.
9. **DB UNREACHABLE:** with a bogus `DATABASE_URL`, the same three behaviours, within 5 seconds
   each.
10. **Concurrent write:** ten simultaneous `writeWeatherCache` calls with the same key leave exactly
    **one** row and none of the ten rejects. Paste the row count and the rejection count.
11. `rawPayload` round-trips byte-identically through a write and a direct database read.

**Evidence (fill this in when done — numbers, not adjectives):**
```
```

**Completed by:** ___  **Date:** ___

---

### [ ] T-32 — Design snapshots and share links

**Area:** D — Database · **Status:** NOT STARTED · **Est:** 5 h
**Depends on:** T-30 · **Conflicts with:** none

**Why this exists.** `plan.md` says *"If you want to keep a design, you download it as a file."*
That is still true and still the offline path. This adds the other half: **a design also gets a
link**, so a BRO engineer at one post can send a design to a colleague at another without attaching
a JSON file to an email that may not get through. Downloads keep working with the database off.

**PROMPT — paste this to start the task:**
> Create `apps/web/lib/repo/designs.ts`.
>
> ```ts
> export async function saveDesign(
>   request: SimulationRequest, label?: string
> ): Promise<{ shareId: string } | null>;
> export async function loadDesign(shareId: string): Promise<SimulationRequest | null>;
> ```
>
> **The share id** is short, opaque and URL-safe: 10 characters from a **base32 alphabet with the
> ambiguous characters removed** (no `0`/`O`, no `1`/`l`/`I`), generated from
> `crypto.randomBytes`. It is **not** sequential — a sequential id lets anyone enumerate every
> design anyone has ever saved, and although nothing here is private, enumerable ids are a habit
> worth not forming. It is **not** derived from the content either: two people saving the same
> design get two links, because a link is a thing a person owns and shares, not a content hash.
> Collision handling: retry up to 5 times on a unique-constraint violation, then return `null`.
> 10 base32 characters is ~50 bits; state that reasoning in a comment.
>
> `saveDesign` validates the request through T-06's `requestFromJson` **before** writing — a
> malformed request must never reach the table, because `loadDesign` would then hand a broken
> design to the engine. It stores through `requestToJson`.
>
> `loadDesign` returns `null` for an unknown id, an expired id, **and** when there is no database.
> All three are the same to a caller. If the stored JSON fails `requestFromJson` (a schema change
> since it was saved), return `null` and log once — never return a half-built object.
>
> No `expiresAt` is set by default (`null` means keep indefinitely). Export
> `purgeExpiredDesigns(): Promise<number>` for a future cleanup job.
>
> Add `apps/web/test/repo-designs.test.ts`.

**Files you may touch.** `apps/web/lib/repo/designs.ts`, `apps/web/test/repo-designs.test.ts`.
**Files you may NOT touch.** `apps/web/lib/db.ts`, `apps/web/prisma/**`, other repositories,
anything under `packages/`.

**Subagent guidance.** Single agent. Straightforward — do not fan out.

**ACCEPTANCE TESTS — the task is NOT done until every one passes:**
1. `saveDesign(req)` then `loadDesign(shareId)` returns a `SimulationRequest` **deep-equal** to the
   original, including `Float64Array` fields coming back as `Float64Array`.
2. The returned `shareId` is exactly 10 characters and matches `/^[A-Za-z2-9]{10}$/` with none of
   `0`, `O`, `1`, `l`, `I` present. Paste five generated ids.
3. Saving the **same** request twice produces **two different** share ids and two rows.
4. 10,000 generated ids contain **zero** duplicates. Paste the count.
5. `loadDesign('nonexistent')` returns `null` and does not throw.
6. **Malformed input is rejected before it is written:** `saveDesign({} as any)` returns `null` (or
   throws a typed `EngineError('DATA_SCHEMA_MISMATCH')`, your choice — state which) and **writes no
   row**. Paste the row count before and after.
7. A row whose stored JSON is corrupted by hand causes `loadDesign` to return `null`, log once, and
   not throw.
8. `loadDesign` on a row with `expiresAt` in the past returns `null`.
9. **DB OFF:** with `DATABASE_URL` unset, `saveDesign` returns `null` and `loadDesign` returns
   `null`, neither throws, and **the JSON download path is unaffected** — demonstrate this by
   round-tripping the same request through `requestToJson`/`requestFromJson` with no database
   present. This is the acceptance test that proves the share layer is not a dependency.
10. **DB UNREACHABLE:** the same two behaviours with a bogus `DATABASE_URL`, within 5 seconds.
11. **Concurrent write:** 20 simultaneous `saveDesign` calls all succeed and produce 20 distinct
    ids. Paste the distinct count.

**Evidence (fill this in when done — numbers, not adjectives):**
```
```

**Completed by:** ___  **Date:** ___

---

### [ ] T-33 — The simulation-run cache

**Area:** D — Database · **Status:** NOT STARTED · **Est:** 6 h
**Depends on:** T-06, T-30 · **Conflicts with:** none

**Why this exists.** The survival grid re-runs eighteen scenarios every time the page loads, and the
sweep re-evaluates variants that have not changed. Both are already fast, but at a measured
31.8 ms/run an eighteen-scenario grid is ~0.6 s of pure recomputation per page view, repeated
forever. A hash-keyed cache makes it free. **The correctness requirement is the interesting part:
a cached result from a different engine version is a wrong answer, not a stale one.**

**PROMPT — paste this to start the task:**
> Create `apps/web/lib/repo/runs.ts`.
>
> ```ts
> export async function readRun(
>   request: SimulationRequest
> ): Promise<{ kpis: SimulationKpis; meta: SimulationResult['meta'] } | null>;
> export async function readFullRun(request: SimulationRequest): Promise<SimulationResult | null>;
> export async function writeRun(
>   request: SimulationRequest, result: SimulationResult, storeFull: boolean
> ): Promise<void>;
> export async function purgeRunsForOtherVersions(): Promise<number>;
> ```
>
> **The key** is T-06's `canonicalRequestHash(request)`. Do not invent a second hashing scheme; if
> the canonicalisation is wrong, fix it there once (global rule 16).
>
> **Version gating.** Read `engineVersion` from `packages/engine/package.json`'s `version` at build
> time and store it on every row. **A row whose `engineVersion` differs from the running engine's is
> a MISS, always**, never a hit — physics changes invalidate the cache, and serving a pre-fix number
> after a physics fix is the worst failure this whole project can have. Write that sentence into the
> file as a comment.
>
> **`storeFull`.** The KPI/meta rows are small; a full `SimulationResult` with per-timestep series
> for every surface is large. Store the full result only when the caller asks (the survival grid
> wants KPIs only; the main chart wants everything). Document the size difference you measure.
>
> **Never let a cache read change an answer.** After a hit, the returned `meta.wallClockMs` is
> meaningless and `meta.warnings` may be stale in one specific way: a warning about the *run* is
> still valid, but any warning about the *environment* is not. Keep it simple — return `meta`
> unchanged and add the literal string `'served from cache'` to `meta.warnings`, so the UI can say
> so and a developer reading a residual knows where it came from.
>
> Add `apps/web/test/repo-runs.test.ts`.

**Files you may touch.** `apps/web/lib/repo/runs.ts`, `apps/web/test/repo-runs.test.ts`.
**Files you may NOT touch.** `apps/web/lib/db.ts`, `apps/web/prisma/**`, other repositories,
`packages/engine/src/serialise.ts` (T-06 owns `canonicalRequestHash`).

**Subagent guidance.** Single agent. Straightforward — do not fan out.

**ACCEPTANCE TESTS — the task is NOT done until every one passes:**
1. `writeRun(req, result, false)` then `readRun(req)` returns KPIs **deep-equal** to
   `result.kpis`, and `meta.energyBalanceResidual` equal to 1e-15.
2. `readRun` on a request differing in **any** physical field is a miss. Test `site.elevation`,
   `building.volume`, `operation.achSchedule[3]` and `options.timestepSeconds` separately.
3. `readRun` on a request differing **only** in object key insertion order is a **hit**.
4. **Version gating:** a row written under `engineVersion: '0.0.1'` is a **miss** for the running
   engine. Paste both version strings.
5. `purgeRunsForOtherVersions()` removes exactly those rows and returns the count.
6. `readFullRun` after `writeRun(..., storeFull: true)` returns a `SimulationResult` deep-equal to
   the original, with `Float64Array` fields as `Float64Array`.
7. `readFullRun` after `writeRun(..., storeFull: false)` returns `null`, **not** a partial object.
8. A cache hit adds `'served from cache'` to `meta.warnings`; a fresh run does not.
9. **The cache never changes an answer:** run the same request through `simulate()` twice, cache the
   first, and assert the cached KPIs are **identical** to the second live run, field by field, to
   exact equality. Paste any field that differs — there must be none.
10. **DB OFF:** with `DATABASE_URL` unset, `readRun` returns `null`, `writeRun` resolves silently,
    and **the eighteen-scenario grid still computes live** — demonstrate by timing eighteen runs
    with no database present and pasting the wall-clock time.
11. **DB UNREACHABLE:** the same, within 5 seconds per call.
12. **Concurrent write:** ten simultaneous `writeRun` calls with the same request leave exactly one
    row and none rejects.
13. Measure and paste the stored row size with and without `storeFull`, in bytes.

**Evidence (fill this in when done — numbers, not adjectives):**
```
```

**Completed by:** ___  **Date:** ___

---

### [ ] T-34 — The material repository and the seed script

**Area:** D — Database · **Status:** NOT STARTED · **Est:** 4 h
**Depends on:** T-24, T-30 · **Conflicts with:** T-24 (code catalogue is the source of truth)

**Why this exists.** The browser should not ship the entire material catalogue in its bundle, and
the citations are the thing a judge asks about, so they must reach the UI. But the **code catalogue
remains the source of truth** — the database holds a served copy. If the two ever disagree, the code
wins and the seed is re-run.

**PROMPT — paste this to start the task:**
> Create `apps/web/lib/repo/materials.ts` and `apps/web/prisma/seed.ts`.
>
> `seed.ts` reads `MATERIALS` from `@shelter/data` and upserts every row by `id`. It is
> **idempotent**: running it twice leaves the same row count and the same content. It **refuses to
> write a row whose `source` is empty**, exiting non-zero and naming the offending id — global rule
> 20, enforced at the point of writing rather than trusted.
>
> `materials.ts`:
> ```ts
> export async function listMaterials(): Promise<Material[]>;
> export async function getMaterial(id: string): Promise<Material | null>;
> ```
> **Both fall back to the code catalogue when there is no database.** `listMaterials()` with the
> database off returns `MATERIALS` from `@shelter/data` — not an empty array, not an error. That
> fallback is the entire reason the material list still renders offline, and it is the single most
> important line in this file. Comment it as such.
>
> When the database *is* present, compare the row count against the code catalogue's length on the
> first call and log a warning if they differ (the seed is stale) — but still serve the database
> rows, and never block.
>
> Wire `db:seed` in `apps/web/package.json` to run `seed.ts`.

**Files you may touch.** `apps/web/lib/repo/materials.ts`, `apps/web/prisma/seed.ts`,
`apps/web/package.json` (the seed script entry), `apps/web/test/repo-materials.test.ts`.
**Files you may NOT touch.** `apps/web/prisma/schema.prisma`, `apps/web/lib/db.ts`, anything under
`packages/data/src` (read it, never edit it).

**Subagent guidance.** Single agent. Straightforward — do not fan out.

**ACCEPTANCE TESTS — the task is NOT done until every one passes:**
1. `npm run db:seed` exits 0 and the `Material` row count equals `MATERIALS.length`. Paste both.
2. **Idempotent:** running `db:seed` a second time leaves the identical row count and identical
   content (compare a checksum over all rows before and after). Paste both checksums.
3. Changing a `k` value in the code catalogue and re-seeding updates the row rather than inserting a
   duplicate. Paste the row count.
4. **The citation rule is enforced at write time:** temporarily blanking one material's `source`
   makes `db:seed` exit **non-zero** and name that material's id. Revert. Paste the exit code and
   the message.
5. `listMaterials()` with a live database returns `MATERIALS.length` rows, each with a non-empty
   `source`.
6. **DB OFF:** with `DATABASE_URL` unset, `listMaterials()` returns the **code catalogue**, with the
   same length and the same ids. Assert deep equality of ids. Paste the length.
7. **DB UNREACHABLE:** with a bogus `DATABASE_URL`, `listMaterials()` returns the code catalogue
   within 5 seconds. Paste the elapsed time.
8. `getMaterial('nope')` returns `null` in all three modes (live, off, unreachable).
9. Deleting half the rows from the database makes `listMaterials()` log a staleness warning but
   still return the rows it has, without throwing.
10. `npx vitest run` exits 0; the engine's 65 tests are unaffected.

**Evidence (fill this in when done — numbers, not adjectives):**
```
```

**Completed by:** ___  **Date:** ___

---

### [ ] T-35 — The DB-off integration proof

**Area:** D — Database · **Status:** NOT STARTED · **Est:** 4 h
**Depends on:** T-31, T-32, T-33, T-34 · **Conflicts with:** none

**Why this exists.** Each database task proves its **own** function degrades gracefully. None of
them proves the **application** does. The failure mode this task exists to catch is the one where
five components each return `null` correctly and the sixth — a page, a route, a hook — does
`result.kpis.tempAt0600` on it and white-screens the demo. This is the task that makes the offline
promise in `plan.md` Part 4 a tested fact rather than an intention.

**PROMPT — paste this to start the task:**
> Create `apps/web/test/db-off.integration.test.ts` — one suite that runs the **entire** repository
> layer and every server-side data path three times: with a live database, with `DATABASE_URL`
> unset, and with `DATABASE_URL` pointing at a host that does not answer.
>
> For each of the three modes, exercise, in order:
> 1. `listMaterials()` — must return a non-empty array in **all three** modes.
> 2. `tmyById('leh')` → `simulate()` — must return a valid result with
>    `meta.energyBalanceResidual < 1e-3` in **all three** modes.
> 3. `readWeatherCache` / `writeWeatherCache` — must resolve, never throw, in all three.
> 4. `saveDesign` / `loadDesign` — must resolve (possibly to `null`) and never throw.
> 5. `readRun` / `writeRun` — must resolve and never throw.
> 6. The eighteen-scenario matrix (once T-59 exists; until then, eighteen `simulate()` calls on the
>    presets) — must complete in **all three** modes, and the wall-clock time in DB-off mode must be
>    recorded.
>
> Assert a **hard rule**: in the unset and unreachable modes, **no call takes longer than 5
> seconds** and **no call throws**. A hang is worse than an error here: an error shows a banner, a
> hang shows a spinner that never stops, and the audience watches it.
>
> Also add a small script `apps/web/scripts/check-db-off.mjs` that a human can run before a demo:
> unset `DATABASE_URL`, boot the app, hit the main page, and report pass/fail in one line. Document
> it in the root `README.md` under a heading `Before the demo`.
>
> This task writes **tests and one script only**. If a component fails one of these checks, that is
> a defect in the owning task — report it by id in your Evidence, set this task `[!]`, and do not
> fix it here (global rule 16).

**Files you may touch.** `apps/web/test/db-off.integration.test.ts`,
`apps/web/scripts/check-db-off.mjs`, the `Before the demo` section of the root `README.md`.
**Files you may NOT touch.** Any `lib/repo/*` file. Any `prisma` file. Anything under `packages/`.

**Subagent guidance.** Single agent. It is one test matrix whose whole value is being run as one
matrix.

**ACCEPTANCE TESTS — the task is NOT done until every one passes:**
1. All six exercises pass in **live-database** mode. Paste the mode's total runtime.
2. All six pass with `DATABASE_URL` **unset**. Paste the total runtime.
3. All six pass with `DATABASE_URL` pointing at an **unreachable** host. Paste the total runtime.
4. **No call in modes 2 or 3 exceeds 5 seconds.** Paste the slowest call and its duration for each
   mode.
5. **No call in modes 2 or 3 throws.** Assert with a `try/catch` around each and a count of caught
   exceptions equal to **0**.
6. `listMaterials()` returns the same number of materials in all three modes. Paste all three counts.
7. `simulate()` on the Leh TMY returns **identical** KPIs in all three modes — the physics does not
   know the database exists. Assert field-by-field equality and paste any mismatch (there must be
   none).
8. The eighteen-scenario matrix completes in DB-off mode. Paste its wall-clock time.
9. `node apps/web/scripts/check-db-off.mjs` prints a single pass line and exits 0 with no
   `DATABASE_URL`.
10. The root `README.md` has a `Before the demo` section naming that script.

**Evidence (fill this in when done — numbers, not adjectives):**
```
```

**Completed by:** ___  **Date:** ___

---

# AREA E — SERVER TIER

> Next.js App Router route handlers. **No feature on the demo path may require any of these routes.**
> The app must build and run as a static export with the whole `app/api/` directory deleted, and
> every route here must return a clean, typed error the client can ignore rather than a blank screen.

---

### [ ] T-36 — Next.js scaffold, the store, the unit boundary, and the layout slots

**Area:** E — Server (≈ W-33) · **Status:** NOT STARTED · **Est:** 8 h
**Depends on:** T-03, T-06, T-28, T-29 · **Conflicts with:** **every Area F task** — this lands first

**Why this exists.** This is the file-ownership keystone. Ten UI tasks each build one component, and
if any of them has to edit `page.tsx` or `store.ts` to wire itself in, ten tasks contend for two
files. This task declares **every** layout slot and **every** store field up front, so each UI task
touches only its own directory.

**PROMPT — paste this to start the task:**
> Build the Next.js App Router application in `apps/web/` (T-29 created the package shell). Install
> `next`, `react`, `react-dom`, `eslint-config-next`, `d3-shape`, `d3-scale`, `d3-sankey`,
> `d3-array` and their types — the approved set in §7.13, nothing else.
>
> **`apps/web/app/page.tsx`** — the three-column layout of `TECH.md` §11.2: inputs left, house +
> tab strip centre, KPI cards right. **Import each Area F component from its final path** and render
> a labelled placeholder where the component does not yet exist, so every slot is pre-wired.
> The tab strip declares four tabs: `temp`, `solar`, `heatflow`, `grid`.
>
> **`apps/web/lib/store.ts`** — declare the **complete** state shape now, because a later task
> adding a field is an edit to a file it does not own:
> `request: SimulationRequest`, `result: SimulationResult | null`, `sweep: SweepResult | null`,
> `scenarios: ScenarioResult[] | null`, `recommendation: unknown | null`,
> `status: 'idle'|'running'|'error'`, `error: {code, message} | null`,
> `selectedSurfaceId: string | null`, `scrubberHour: number`,
> `activeTab: 'temp'|'solar'|'heatflow'|'grid'`, `locale: 'en'|'hi'`,
> `advancedOpen: boolean`, `presetId: string`, `online: boolean`, `shareId: string | null`,
> plus an action to set each. Implement a **150 ms debounce** on any `request` mutation before
> dispatching a simulation (`TECH.md` §11.6) — this is the interaction that makes the tool feel
> alive rather than submit-and-wait.
>
> **`apps/web/lib/units.ts`** — the **only** file in the entire repository permitted to call `toC`
> or `toK` (§7.1). Exports `formatTempC`, `formatDeltaT`, `formatPower`, `formatEnergy`,
> `formatINR`, `formatPercent`, `formatHours`, each taking Kelvin/SI and returning a display string.
> A UI component that does its own `- 273.15` is a defect **regardless of whether the number looks
> right**.
>
> **`apps/web/lib/i18n.ts`** — `t(key)` plus a registry components register their own message
> modules into, so no task ever edits a central catalogue. A missing key returns the key itself,
> never `undefined` and never a throw.
>
> **`apps/web/app/layout.tsx`**, **`globals.css`** — minimal; no design system, no CSS framework.
>
> Set `DEFAULT_LOCATION` from `NEXT_PUBLIC_DEFAULT_LOCATION`, defaulting to `leh`, and **open on a
> loaded preset so the first screen shows a result rather than an empty form** (`CHALLENGE.md`
> C-19). Build **no visual component** beyond the placeholders — no charts, no house, no inputs.

**Files you may touch.** `apps/web/app/page.tsx`, `layout.tsx`, `globals.css`,
`apps/web/lib/{store,units,i18n}.ts`, `apps/web/next.config.*`, `apps/web/package.json`
(dependencies).
**Files you may NOT touch.** Anything under `apps/web/components/`, `apps/web/app/api/`,
`apps/web/lib/repo/`, `apps/web/lib/db.ts`, `apps/web/prisma/`, anything under `packages/`.

**Subagent guidance.** Single agent. Every file here is something ten other tasks depend on being
consistent; one author is the point.

**ACCEPTANCE TESTS — the task is NOT done until every one passes:**
1. `npm run build --workspace apps/web` exits 0 and the page renders three columns with every
   placeholder visible at 1440 px.
2. Every store field listed above exists and is typed; **adding a component later requires zero
   edits to `store.ts`** — verify by listing the fields and comparing to the list above.
3. **The unit boundary holds:** `grep -rn "273\.15\|toC(\|toK(" apps/web --include=*.tsx
   --include=*.ts | grep -v "lib/units.ts"` returns **no matches**.
4. Mutating `request` 20 times within 100 ms dispatches **exactly one** simulation. Paste the
   dispatch count.
5. `formatTempC(toK(14.2))` returns `"14.2 °C"`. Paste the exact string.
6. `formatDeltaT(12.1)` renders a Kelvin-degree difference **without** subtracting 273.15.
7. `t('missing.key')` returns `"missing.key"` — it neither throws nor renders `undefined`.
8. The page renders with `result === null` without crashing — first paint precedes first simulation.
9. **The first screen shows a preset result, not an empty form.** State what is on screen.
10. `npm run lint` exits 0, including the no-React-in-`packages/` and no-Prisma-in-`packages/` rules.
11. At **400 px** width the layout stacks to one column with no horizontal scrollbar.

**Evidence (fill this in when done — numbers, not adjectives):**
```
```

**Completed by:** ___  **Date:** ___

---

### [ ] T-37 — `/api/weather` — the CORS proxy, cached

**Area:** E — Server (≈ W-35) · **Status:** NOT STARTED · **Est:** 6 h
**Depends on:** T-26, T-31, T-36 · **Conflicts with:** none

**Why this exists.** NASA POWER may require a proxy for browser calls, and it is the citable source
— **DRDO recognises NASA.** But live weather is an **enhancement, never a dependency**: gated behind
a flag, off by default, and invisible in the UI when off.

**PROMPT — paste this to start the task:**
> Create `apps/web/app/api/weather/route.ts`.
>
> `POST` accepting `{ source, latitude, longitude, startDate, endDate, siteElevation }`.
> Flow: validate the body → **check `readWeatherCache` first** → on a miss, build the URL with
> T-26's builder, `fetch` it with a **10-second timeout** via `AbortController`, parse with T-26's
> parser, normalise with T-25's `normaliseWeather` (applying the lapse-rate correction to
> `siteElevation`), `writeWeatherCache`, and return the `WeatherSeries` serialised through T-06's
> `resultToJson`-equivalent for series.
>
> **This is the only place in the repository permitted to call `fetch` for weather.**
>
> Gating: when `NEXT_PUBLIC_ENABLE_LIVE_WEATHER` is unset or `'false'`, the route returns **501**
> with `{ code: 'LIVE_WEATHER_DISABLED' }` and the UI never offers the option.
>
> Error taxonomy — every response is JSON, never HTML, never a stack trace:
> - malformed body → **400** `{ code: 'INVALID_INPUT', detail: [{path, message}] }`
> - upstream timeout or non-2xx → **502** `{ code: 'UPSTREAM_UNAVAILABLE', message }`
> - upstream returned unparseable data → **422** `{ code: 'WEATHER_INVALID', message }`
> - flag off → **501** `{ code: 'LIVE_WEATHER_DISABLED' }`
>
> Include the **lapse-rate correction in the response body** as
> `{ sourceElevation, siteElevation, lapseCorrectionK }`, so the UI can display
> *"NASA POWER cell elevation 4,120 m; your site 3,500 m; temperature adjusted +4.0 °C."*
> **Showing the correction rather than applying it quietly is the point** (`TECH.md` §9.3).
>
> **No API key. No secret.** Both sources are keyless. `grep` for `Bearer` must come back empty.

**Files you may touch.** `apps/web/app/api/weather/route.ts`,
`apps/web/test/api-weather.test.ts`.
**Files you may NOT touch.** `lib/repo/*`, `lib/db.ts`, `packages/**`, other routes.

**Subagent guidance.** Single agent. Straightforward — do not fan out.

**ACCEPTANCE TESTS — the task is NOT done until every one passes:**
1. With the flag unset, the route returns **501** with `code: 'LIVE_WEATHER_DISABLED'` and writes
   **no** cache row. Paste the status and the row count.
2. With the flag set and a stubbed upstream, the route returns a valid `WeatherSeries` that
   `simulate()` accepts.
3. The response body carries `sourceElevation`, `siteElevation` and `lapseCorrectionK`, and
   `lapseCorrectionK` matches `6.5 × (h_source − h_site)/1000` to ±0.01. Paste all four numbers.
4. **Cache hit:** a second identical request makes **zero** upstream calls. Assert on a call
   counter. Paste both counts.
5. **Upstream timeout:** a stub that never responds produces **502** `UPSTREAM_UNAVAILABLE` within
   **11 seconds**, not a hang. Paste the elapsed time.
6. **Upstream 500:** produces 502 with the same code, not a crash.
7. **Upstream garbage:** a 200 response with unparseable JSON produces **422** `WEATHER_INVALID`.
8. **Malformed body:** `{}` produces **400** `INVALID_INPUT` with a non-empty `detail` array and
   **writes no row**. Paste the row count.
9. **Database unreachable:** with a bogus `DATABASE_URL` and the flag on, the route still returns a
   valid series (it just does not cache) within 15 seconds. Paste the status and elapsed time.
10. Every error response has `Content-Type: application/json` and contains no stack trace. Paste one
    error body verbatim.
11. `grep -rn "api_key\|apiKey\|Bearer\|process.env" apps/web/app/api/weather/route.ts` shows only
    the two documented base-URL variables and the feature flag.
12. **Deleting `apps/web/app/api/` still leaves `npm run build --workspace apps/web` succeeding.**

**Evidence (fill this in when done — numbers, not adjectives):**
```
```

**Completed by:** ___  **Date:** ___

---

### [ ] T-38 — `/api/simulate` — one run, cached

**Area:** E — Server (≈ W-35) · **Status:** NOT STARTED · **Est:** 4 h
**Depends on:** T-33, T-36 · **Conflicts with:** none

**Why this exists.** A thin JSON wrapper over `simulate()`, so a heavy run or a shared link can be
resolved server-side, and so the run cache has a place to be consulted. It must be **exactly**
equivalent to running the engine in the browser — the same request must give the same answer on
both sides, or the offline fallback silently becomes a different product.

**PROMPT — paste this to start the task:**
> Create `apps/web/app/api/simulate/route.ts`. `POST` a JSON `SimulationRequest`.
>
> Flow: `requestFromJson` (T-06) → `readRun` (T-33) → on a miss, `simulate()` → `writeRun` → return
> the result through the series serialiser. Set `meta.warnings` to include `'served from cache'` on
> a hit, per T-33.
>
> Error taxonomy, all JSON:
> **400** `INVALID_INPUT` and `GEOMETRY_INCONSISTENT`; **422** `WEATHER_INVALID`,
> `UNKNOWN_MATERIAL`, `UNKNOWN_GLAZING`, `DATA_SCHEMA_MISMATCH`;
> **500** `SOLVER_DIVERGED`, `SINGULAR_MATRIX`. Every `EngineError` maps to exactly one status, and
> the `detail` array from `INVALID_INPUT` is passed through intact so a user with three bad fields
> sees three messages.
>
> **Never let an exception escape as HTML.** A Next.js default error page is a blank screen to the
> client's JSON parser, and the client cannot distinguish it from a network failure.
>
> Add a **body size limit** (reject over 5 MB with **413** `PAYLOAD_TOO_LARGE`) — a
> `SimulationRequest` carrying an 8,760-hour weather series is about 1 MB, so 5 MB is generous and
> still bounds the blast radius.
>
> Do **not** run the sweep here (T-39) and do **not** spawn worker threads here (T-40): a single run
> at 31.8 ms does not need one, and adding a pool to a route that does not need it is the kind of
> complexity that costs a demo.

**Files you may touch.** `apps/web/app/api/simulate/route.ts`,
`apps/web/test/api-simulate.test.ts`.
**Files you may NOT touch.** Other routes, `lib/repo/*`, `packages/**`.

**Subagent guidance.** Single agent. Straightforward — do not fan out.

**ACCEPTANCE TESTS — the task is NOT done until every one passes:**
1. **Equivalence:** `POST /api/simulate` with a preset returns a `SimulationResult` **deep-equal**
   to the in-process `simulate()` result for the same input, excluding `meta.wallClockMs`. Paste any
   differing field — there must be none.
2. `meta.energyBalanceResidual < 1e-3` on the returned result.
3. A malformed body `{}` returns **400** with `code: 'INVALID_INPUT'` and a `detail` array, and
   **writes no `SimulationRun` row**. Paste the status and the row count.
4. Three simultaneously invalid fields produce **one** response with **three** `detail` entries.
   Paste the body.
5. A window larger than its host surface returns **400** `GEOMETRY_INCONSISTENT`.
6. An unknown `materialId` returns **422** `UNKNOWN_MATERIAL`.
7. A request engineered to diverge returns **500** `SOLVER_DIVERGED` — **not** a plausible-looking
   wrong number (`CHALLENGE.md` C-08).
8. A 6 MB body returns **413** `PAYLOAD_TOO_LARGE`.
9. **Cache hit:** a second identical POST returns the same KPIs with `'served from cache'` in
   `meta.warnings`, and is measurably faster. Paste both latencies.
10. **Database unreachable:** the route still returns a correct result within 5 seconds; only the
    caching is lost. Paste the status and elapsed time.
11. Every error response is `Content-Type: application/json` with no HTML and no stack trace.
12. Ten concurrent identical POSTs all return 200 and leave exactly one cache row.

**Evidence (fill this in when done — numbers, not adjectives):**
```
```

**Completed by:** ___  **Date:** ___

---

### [ ] T-39 — `/api/optimise` and `/api/scenarios`, with streaming progress

**Area:** E — Server (≈ W-35) · **Status:** NOT STARTED · **Est:** 8 h
**Depends on:** T-40, T-54, T-59 · **Conflicts with:** none

**Why this exists.** *"As each scenario finishes, the server pushes a message to the browser. This
is what the loading animation is counting."* (`plan.md` Part 2c.) A sweep that returns one response
after ten seconds gives the day/night animation nothing to count, and a user nothing to watch.

**PROMPT — paste this to start the task:**
> Create `apps/web/app/api/optimise/route.ts` and `apps/web/app/api/scenarios/route.ts`.
>
> Both `POST`, both stream **Server-Sent Events** (`text/event-stream`), because SSE is one-way,
> survives a proxy, and needs no library — a WebSocket here would be a dependency bought for nothing.
>
> Event shapes, matching the worker protocol of §7.14 so the browser can use one handler for both
> the local worker path and the server path:
> ```
> event: progress   data: {"done": 7, "total": 18}
> event: result     data: {"...SweepResult or ScenarioResult[]..."}
> event: error      data: {"code": "...", "message": "..."}
> ```
> Emit a `progress` event **as each variant or scenario completes**, dispatching through T-40's
> worker-thread pool. Emit exactly one terminal event (`result` or `error`) and then close.
>
> **Cancellation:** when the client aborts, stop dispatching within one variant's runtime and
> release the pool slots. A sweep that keeps running after its reader is gone burns every core on
> the server for nothing.
>
> **Heartbeat:** send an SSE comment line every 15 seconds during a long run, so an intermediary
> does not time the connection out.
>
> Both routes consult T-33's run cache **per variant** before dispatching, so a repeated sweep is
> mostly cache hits, and both write results back.
>
> Error taxonomy as in T-38. A failure partway through emits an `error` event and closes — it does
> **not** leave the stream open.

**Files you may touch.** `apps/web/app/api/optimise/route.ts`,
`apps/web/app/api/scenarios/route.ts`, `apps/web/test/api-stream.test.ts`.
**Files you may NOT touch.** `lib/pool.ts` (T-40 owns it), `packages/optimise/**` (Area G owns it),
other routes.

**Subagent guidance.** **Spawn 2 subagents:** one owns `optimise/route.ts`, the other owns
`scenarios/route.ts`. They share no file and have independent acceptance tests (1–6 and 7–12
respectively). **Merge only when both report green and a combined run of `api-stream.test.ts`
passes.** If either needs to change the SSE event shape, both stop and the shape is settled first —
a divergent event shape between the two routes would force the client into two code paths.

**ACCEPTANCE TESTS — the task is NOT done until every one passes:**
1. `POST /api/optimise` with a 100-variant `SweepRequest` emits **100** `progress` events with
   monotonically increasing `done`, ending at `done === total === 100`, then exactly one `result`.
   Paste the event count.
2. The whole 100-variant sweep completes in **under 10 s** end to end (`CHALLENGE.md` C-15). Paste
   the wall-clock time and the `meta.workers` reported.
3. Aborting the client connection at variant 20 stops dispatch **within one variant's runtime** and
   the pool returns to idle. Paste the elapsed time after abort and the pool's active count.
4. A `SweepRequest` with a malformed `base` emits one `error` event with `code: 'INVALID_INPUT'` and
   closes the stream — no `result` follows.
5. Infeasible variants (ACH below the floor) arrive in the `result` with `feasible: false` and a
   non-empty `infeasibleReason` — they are **not** silently dropped. Paste the count.
6. A run longer than 15 s emits at least one heartbeat comment line.
7. `POST /api/scenarios` emits **18** `progress` events and one `result` carrying 18 scenario
   results. Paste the count.
8. The eighteen-scenario run completes in **under 3 s** (`plan.md` build order phase 4). Paste the
   time.
9. Every scenario result has `meta.energyBalanceResidual < 1e-3`. Paste the maximum.
10. **Cache hits work per variant:** a second identical sweep completes measurably faster and
    reports cache hits. Paste both times.
11. **Database unreachable:** both routes still stream correct results; only caching is lost. Paste
    both times.
12. Both routes set `Content-Type: text/event-stream` and never emit HTML.

**Evidence (fill this in when done — numbers, not adjectives):**
```
```

**Completed by:** ___  **Date:** ___

---

### [ ] T-40 — The worker-thread pool, one per core

**Area:** E — Server (≈ `plan.md` Part 2b) · **Status:** NOT STARTED · **Est:** 8 h
**Depends on:** T-06, T-36 · **Conflicts with:** T-43 (both speak the §7.14 protocol; settle it first)

**Why this exists.** `plan.md` Part 2b is worth restating, because it is easy to get wrong: the
engine is a tight loop of arithmetic that **never waits** — no network, no disk. The usual web-server
trick for concurrency (start a job, do something else while it waits) buys **nothing** here, because
the job never waits. It just computes, flat out, and blocks everyone behind it. **A second user
hitting the site during a sweep must still get an instant response**, and the only way to get that
is real threads on real cores.

**PROMPT — paste this to start the task:**
> Create `apps/web/lib/pool.ts` and `apps/web/workers/sim.node.worker.mjs`.
>
> Use Node's **`worker_threads`**, not child processes, not a library. Pool size
> `max(1, os.cpus().length - 1)`, configurable, leaving one core for the main thread so the event
> loop stays responsive — that is the whole point.
>
> ```ts
> export interface Pool {
>   run(req: SimulationRequest, signal?: AbortSignal): Promise<SimulationResult>;
>   runMany(reqs: SimulationRequest[], onProgress: (done: number, total: number) => void,
>           signal?: AbortSignal): Promise<SimulationResult[]>;
>   readonly size: number;
>   readonly active: number;
>   destroy(): Promise<void>;
> }
> export function getPool(): Pool;
> ```
>
> Workers speak the **§7.14 protocol** — `WorkerRequest` / `WorkerResponse` with a caller-generated
> `id` echoed on every response — so the browser worker (T-43) and this pool are interchangeable
> from the caller's point of view.
>
> Requirements:
> - Workers are **created once and reused**; `runMany` must not spawn a worker per variant.
> - A worker that crashes is **replaced**, and its in-flight request rejects with a typed error —
>   the pool does not die with it.
> - `AbortSignal` cancels queued work immediately and stops dispatching; an already-running variant
>   is allowed to finish (killing a thread mid-solve leaks nothing but gains nothing either).
> - `destroy()` terminates every worker and resolves; no dangling handles keep the process alive.
> - The pool is memoised per process, stashed on `globalThis` in development so Next.js hot reload
>   does not leak a pool per edit.
>
> Serialise requests and results through T-06's helpers on both sides of the message boundary —
> `Float64Array` does not survive structured clone in every runtime configuration, and a silent
> `Array` on one side is exactly the kind of bug that shows up as a wrong chart.

**Files you may touch.** `apps/web/lib/pool.ts`, `apps/web/workers/sim.node.worker.mjs`,
`apps/web/test/pool.test.ts`.
**Files you may NOT touch.** `apps/web/workers/sim.worker.ts` (T-43 owns the browser worker),
`app/api/*`, `packages/**`.

**Subagent guidance.** Single agent. Concurrency code with two agents is how you get two mental
models of the same queue.

**ACCEPTANCE TESTS — the task is NOT done until every one passes:**
1. `getPool().size === max(1, os.cpus().length - 1)`. Paste the core count and the pool size.
2. `run()` returns a `SimulationResult` **deep-equal** to the in-process `simulate()` result for the
   same request, with `Float64Array` fields arriving as `Float64Array` (assert `instanceof`).
3. **`runMany` on 100 variants is faster than 100 sequential `run` calls** by a factor of at least
   `size × 0.5`. Paste both wall-clock times, the ratio and the pool size.
4. `runMany` on 100 variants creates **exactly `size`** workers, not 100. Assert on a creation
   counter.
5. `onProgress` fires exactly 100 times with monotonically increasing `done`, ending at 100.
6. **The main thread stays responsive:** during a 100-variant `runMany`, a 10 ms interval timer on
   the main thread fires within 20 ms of schedule at least 95 % of the time. Paste the percentage.
   This is the property `plan.md` Part 2b is actually about.
7. Aborting mid-run stops dispatch and `runMany` rejects or resolves-as-cancelled; `active` returns
   to 0 within 2 s. Paste the elapsed time.
8. A worker that throws an `EngineError` delivers a typed `error` response carrying the code — never
   an unhandled rejection.
9. A worker killed mid-run is **replaced**, `size` returns to its original value, and the next
   `run()` succeeds. Paste `size` before, during and after.
10. Every response's `id` matches its request's `id` across 1,000 requests.
11. `destroy()` resolves and the process exits cleanly (no dangling handles) — verify with
    `process._getActiveHandles().length` or an equivalent.
12. Ten thousand sequential `run()` calls do not grow the worker count beyond `size`.

**Evidence (fill this in when done — numbers, not adjectives):**
```
```

**Completed by:** ___  **Date:** ___

---

### [ ] T-41 — `/api/designs` and `/api/materials`

**Area:** E — Server · **Status:** NOT STARTED · **Est:** 4 h
**Depends on:** T-32, T-34, T-36 · **Conflicts with:** none

**Why this exists.** The share-link half of Deviation D-1, and the served material catalogue with
its citations. Both must degrade to nothing gracefully: with the database off, the share button
disappears and the catalogue comes from code.

**PROMPT — paste this to start the task:**
> Create `apps/web/app/api/designs/route.ts` (POST), `apps/web/app/api/designs/[shareId]/route.ts`
> (GET) and `apps/web/app/api/materials/route.ts` (GET).
>
> `POST /api/designs` — body is `{ request, label? }`. Validate through `requestFromJson` **before**
> writing; a malformed request returns **422** `DATA_SCHEMA_MISMATCH` (or **400** `INVALID_INPUT` if
> the engine's validator rejects it) and writes **no row**. On success returns **201**
> `{ shareId, url }` where `url` is the absolute share URL. With no database, returns **503**
> `{ code: 'SHARE_UNAVAILABLE', message: 'Sharing needs the server. Download the design as a file
> instead.' }` — a message the UI shows verbatim, because "try again later" is useless advice when
> the correct action is "use the download button".
>
> `GET /api/designs/[shareId]` — returns the `SimulationRequest` or **404** `NOT_FOUND` for an
> unknown, expired or undecodable id. It **must not** distinguish between them in the response: a
> 404 for all three is both simpler and avoids turning the endpoint into an existence oracle.
>
> `GET /api/materials` — returns `{ materials, schemaVersion, servedFrom: 'database' | 'code' }`
> from T-34's `listMaterials`, which already falls back to the code catalogue. **Never returns an
> empty array**; if it would, that is a bug in T-34 and the route should surface it as **500**
> rather than render an empty dropdown. Set `Cache-Control: public, max-age=3600` — the catalogue
> changes when the code ships, not between requests.
>
> **Rate limiting** for `POST /api/designs` belongs to T-42; do not implement it here.

**Files you may touch.** `apps/web/app/api/designs/**`, `apps/web/app/api/materials/route.ts`,
`apps/web/test/api-designs.test.ts`.
**Files you may NOT touch.** `lib/repo/*`, other routes, `packages/**`.

**Subagent guidance.** Single agent. Three small handlers.

**ACCEPTANCE TESTS — the task is NOT done until every one passes:**
1. `POST /api/designs` with a valid request returns **201** and a `shareId` matching
   `/^[A-Za-z2-9]{10}$/`. `GET` on that id returns a request deep-equal to the original.
2. `POST` with `{}` returns **400** or **422** with a typed `code`, and writes **no row**. Paste the
   status, the code, and the row count before and after.
3. `GET /api/designs/zzzzzzzzzz` returns **404** `NOT_FOUND`.
4. `GET` on an expired id returns **404**, indistinguishable from an unknown id.
5. **DB OFF:** `POST` returns **503** `SHARE_UNAVAILABLE` with the download-instead message, and
   `GET` returns **404**. Neither throws, neither takes longer than 5 s. Paste both statuses and
   both elapsed times.
6. **DB UNREACHABLE:** the same two behaviours, within 5 s each.
7. `GET /api/materials` with a live database returns `servedFrom: 'database'` and
   `materials.length === MATERIALS.length`. Paste both.
8. **DB OFF:** `GET /api/materials` returns **200** with `servedFrom: 'code'` and the same length.
   Paste it. This is the test that keeps the material dropdown alive offline.
9. Every returned material has a non-empty `source`. Assert across all rows.
10. `GET /api/materials` sets `Cache-Control` with a `max-age` of at least 3600.
11. **Concurrent:** 20 simultaneous `POST /api/designs` return 20 distinct share ids, all 201.
12. No response anywhere in this task is HTML; all are JSON.

**Evidence (fill this in when done — numbers, not adjectives):**
```
```

**Completed by:** ___  **Date:** ___

---

### [ ] T-42 — Request validation, the error taxonomy, and rate limiting

**Area:** E — Server · **Status:** NOT STARTED · **Est:** 5 h
**Depends on:** T-37, T-38, T-39, T-41 · **Conflicts with:** all four of those (it refactors them)

**Why this exists.** Four routes will each have grown their own opinion about how to report a bad
request. One taxonomy, applied once, is the difference between a client that can handle errors and a
client full of special cases. Rate limiting exists for exactly one reason: `/api/weather` fronts a
**rate-limited upstream** and `/api/optimise` will **burn every core** on the machine, so an
unthrottled loop against either is a self-inflicted outage during a demo.

**PROMPT — paste this to start the task:**
> Create `apps/web/lib/api.ts` and refactor the four route files to use it. Add nothing new to any
> route beyond what this task specifies.
>
> ```ts
> export type ApiErrorCode =
>   | EngineErrorCode                      // reused from the engine, section 7.8
>   | 'LIVE_WEATHER_DISABLED' | 'UPSTREAM_UNAVAILABLE' | 'SHARE_UNAVAILABLE'
>   | 'NOT_FOUND' | 'PAYLOAD_TOO_LARGE' | 'RATE_LIMITED' | 'INTERNAL';
> export function apiError(code: ApiErrorCode, message: string, detail?: unknown): Response;
> export function apiOk<T>(body: T, init?: ResponseInit): Response;
> export function withApi(handler: Handler): Handler;   // catches EVERYTHING
> ```
>
> **The status map, applied everywhere, no exceptions:**
> `INVALID_INPUT` 400 · `GEOMETRY_INCONSISTENT` 400 · `WEATHER_INVALID` 422 ·
> `UNKNOWN_MATERIAL` 422 · `UNKNOWN_GLAZING` 422 · `DATA_SCHEMA_MISMATCH` 422 ·
> `NOT_FOUND` 404 · `PAYLOAD_TOO_LARGE` 413 · `RATE_LIMITED` 429 ·
> `LIVE_WEATHER_DISABLED` 501 · `SHARE_UNAVAILABLE` 503 · `UPSTREAM_UNAVAILABLE` 502 ·
> `SOLVER_DIVERGED` 500 · `SINGULAR_MATRIX` 500 · `INTERNAL` 500.
>
> `withApi` wraps every handler and catches **everything**, including a thrown string or a
> `TypeError`, converting it to `INTERNAL` 500 with a **generic** message and logging the real one
> server-side. **No stack trace ever reaches a client.**
>
> **Rate limiting:** a small in-memory fixed-window limiter — `Map<ip, {count, windowStart}>`, no
> Redis, no dependency. Per-IP limits: `/api/weather` **10/min**; `/api/optimise` and
> `/api/scenarios` **6/min**; `/api/designs` POST **30/min**; `/api/simulate` **120/min`;
> `/api/materials` unlimited. Over the limit returns **429** `RATE_LIMITED` with a `Retry-After`
> header. Mark it with a `// ponytail:` comment naming the ceiling and the upgrade path:
> *in-memory limiter, per-process — fine for one instance, replace with a shared store if this ever
> runs multi-instance.* That is global rule 13 and 14 in one line.
>
> Do **not** add an auth check, a session, an API key or a user identifier. The limiter keys on IP
> and nothing else (global rule 19).

**Files you may touch.** `apps/web/lib/api.ts`, `apps/web/lib/ratelimit.ts`, the four route files
(refactor only — no behaviour change beyond the taxonomy and the limiter),
`apps/web/test/api-errors.test.ts`.
**Files you may NOT touch.** `lib/repo/*`, `lib/pool.ts`, `lib/db.ts`, `packages/**`.

**Subagent guidance.** Single agent. It is a cross-cutting refactor of four files; splitting it
guarantees four different interpretations of the status map, which is the exact problem it exists to
solve.

**ACCEPTANCE TESTS — the task is NOT done until every one passes:**
1. Every code in the status map returns its mapped status from at least one route. Paste the full
   observed code→status table.
2. A handler that throws a raw `TypeError` returns **500** `INTERNAL` with a generic message and
   **no stack trace** in the body. Paste the body verbatim.
3. A handler that throws a string returns 500 `INTERNAL`, not a crash.
4. **No route returns HTML** under any tested failure. Assert `Content-Type: application/json` on
   every error response across all four routes.
5. 11 requests to `/api/weather` within one minute from one IP: the 11th returns **429**
   `RATE_LIMITED` with a `Retry-After` header. Paste the header value.
6. 7 requests to `/api/optimise` within one minute: the 7th returns 429.
7. After the window elapses, the next request succeeds. Paste the elapsed time.
8. Two different IPs do **not** share a bucket — IP B is unaffected by IP A exhausting its limit.
9. `/api/materials` is never rate limited — 200 requests all succeed.
10. `grep -rn "auth\|session\|jwt\|token\|userId\|password" apps/web/lib/api.ts
    apps/web/lib/ratelimit.ts` returns **0** matches (global rule 19).
11. `lib/ratelimit.ts` contains a `// ponytail:` comment naming the in-memory ceiling and the
    upgrade path.
12. All pre-existing route tests from T-37, T-38, T-39 and T-41 still pass unchanged.
13. `npm run build --workspace apps/web` exits 0 and `npm run lint` exits 0.

**Evidence (fill this in when done — numbers, not adjectives):**
```
```

**Completed by:** ___  **Date:** ___

---

# AREA F — FRONTEND

> Every task here creates **only** its own `apps/web/components/<name>/` directory, containing its
> component(s) and its own `messages.ts`. **None of them edits `page.tsx`, `store.ts`, `units.ts` or
> `i18n.ts`** — T-36 already wired the slot and declared every store field.
> **Every temperature arrives as Kelvin and is formatted through `lib/units.ts`.** A `- 273.15`
> anywhere in a component is a defect even if the number displayed looks right.
> Every component must render correctly in four states: **loading, empty (`result === null`), error,
> and offline** — and at **400 px** width without horizontal scroll.

---

### [ ] T-43 — The browser Web Worker and the offline fallback path

**Area:** F — Frontend (≈ W-34) · **Status:** NOT STARTED · **Est:** 6 h
**Depends on:** T-36 · **Conflicts with:** T-40 (both speak the §7.14 protocol — settle it first)

**Why this exists.** Two jobs in one file. **(a)** The main thread must never block, so a dragged
slider does not stutter the page. **(b)** This is **the offline fallback**: when the server is
unreachable, this worker runs the bundled engine on bundled TMY and the user still gets a
temperature curve, a heat-flow breakdown and a 3D model. That is `plan.md` Part 4, and it is the
reason the engine was built as a pure zero-dependency package in the first place.

**PROMPT — paste this to start the task:**
> Create `apps/web/workers/sim.worker.ts` and `apps/web/lib/workerClient.ts`.
>
> The worker imports `simulate` from `@shelter/engine`, listens for `WorkerRequest` and replies with
> `WorkerResponse` (§7.14). A thrown `EngineError` becomes
> `{ id, kind: 'error', code, message }` — **never** let an exception escape the worker silently.
> Serialise across the boundary with T-06's helpers so `Float64Array` survives.
>
> `workerClient.ts` exports:
> ```ts
> export async function runSimulation(req: SimulationRequest): Promise<SimulationResult>;
> export async function runScenarios(reqs: SimulationRequest[],
>   onProgress: (done: number, total: number) => void): Promise<SimulationResult[]>;
> export function isServerReachable(): Promise<boolean>;
> ```
> `runSimulation` **automatically cancels any earlier in-flight request** by id. Firing three
> requests in quick succession must resolve only the last, and **no stale result may ever reach the
> store** — a stale result arriving after a newer one is how a user ends up looking at the wrong
> building's numbers.
>
> **The routing rule, and it is the heart of this task:** try the server first when
> `isServerReachable()`; on any failure — network error, non-2xx, timeout of 5 s — **fall back to
> the local worker silently for the main scenario** and set `store.online = false`. The user loses
> the full scenario sweep and the AI advice (both need real compute and a network), but keeps the
> curve, the breakdown and the model. Set a store flag the offline banner (T-52) reads.
>
> Provide a **synchronous fallback path** for environments with no worker support, so a test or an
> old browser still produces a result.
>
> Do not build the sweep worker pool (T-40 owns the server side; the browser sweep reuses this
> client). Do not edit `store.ts`.

**Files you may touch.** `apps/web/workers/sim.worker.ts`, `apps/web/lib/workerClient.ts`,
`apps/web/test/worker.test.ts`.
**Files you may NOT touch.** `lib/store.ts`, `lib/pool.ts`, `app/api/*`, `packages/**`.

**Subagent guidance.** Single agent. Cancellation logic with two authors is a race condition with a
plan.

**ACCEPTANCE TESTS — the task is NOT done until every one passes:**
1. A simulation dispatched from the UI returns a result and **the main thread stays responsive**: a
   CSS animation does not stutter during a run, and no main-thread task exceeds 16 ms. Paste the
   longest main-thread task duration.
2. Firing three requests in quick succession resolves **only the last**; the first two resolve as
   cancelled or reject, and **no stale result reaches the store**. Assert on a store-write counter:
   it must be exactly 1. Paste the count.
3. An `EngineError('INVALID_INPUT')` in the worker arrives as a typed `error` response carrying the
   code — **not** an unhandled rejection.
4. Every response's `id` matches its request's `id` across 1,000 requests.
5. The result from the worker is **deep-equal** to the in-process `simulate()` result, with
   `Float64Array` fields arriving as `Float64Array`. Assert `instanceof`.
6. The synchronous fallback returns results deep-equal to the worker path.
7. **OFFLINE, the C-12 test:** with the network fully blocked, `runSimulation` returns a valid
   result from the local worker within **5 seconds**, and `store.online` is set to `false`. Paste
   the elapsed time and the resulting `tempAt0600` in °C.
8. **Server 500:** falls back to the local worker, sets `online = false`, and returns a result.
9. **Server timeout (no response):** falls back within 5 s, not 30. Paste the elapsed time.
10. Terminating the worker mid-run does not leave a pending promise.
11. Ten thousand sequential requests do not grow the number of live workers beyond one.

**Evidence (fill this in when done — numbers, not adjectives):**
```
```

**Completed by:** ___  **Date:** ___

---

### [ ] T-44 — The five-control simple form

**Area:** F — Frontend (≈ W-37) · **Status:** NOT STARTED · **Est:** 8 h
**Depends on:** T-28, T-36, T-41 · **Conflicts with:** T-46 (coordinate only via `selectedSurfaceId`)

**Why this exists.** *"A tool that opens onto forty numeric input boxes is a tool nobody finishes
using."* (`plan.md` Part 3.) `CHALLENGE.md` C-13 makes this testable: hand the tool to someone who
**cannot define thermal conductivity**, ask them to compare two wall materials for a Leh shelter,
and time them unaided. Under five minutes is a pass. If our tool demands a trained analyst, we have
rebuilt the barrier we set out to remove and shipped worse physics in the process.

**PROMPT — paste this to start the task:**
> Create `apps/web/components/inputs/` with **at most 10 controls visible at first paint**:
> **location** (preset dropdown of the bundled TMY sites), **date**, **size**
> (length × width × height, deriving `floorArea` and `volume`), **shelter type / preset picker**
> (picture cards), **wall material**, **roof material**, **floor material** (all **by name** from
> T-41's catalogue, never by k/ρ/c), **window amount** (a WWR slider, per orientation),
> **glazing type** by name, **night shutters** (a checkbox), and an **occupancy/heating** preset.
>
> Every field inherits a sane default from the catalogue or the Ladakh defaults in §7.11. **Nothing
> on this panel may require a number the user has to look up.** Every label carries its unit and a
> one-line plain-language tooltip. Material cards show the material's **name and its `blurb`**
> — *"Mud brick: cheap, made locally, good at holding daytime heat"* — with the physical constants
> and **the citation** reachable in **one click**, because the citation is what a judge asks for.
>
> Include a **material-stack editor** that opens for `store.selectedSurfaceId` when T-46's house
> sets it, showing the construction's layers as named cards with thickness sliders.
>
> Include the **user-CSV upload** control wired to T-25's parser, with **per-row** error display.
>
> ⚠ **Explicitly forbidden on this panel:** any `SimOptions` field, `thermalBridgeFactor`,
> emissivity, absorptivity, a raw ACH number, node counts, solver settings, ground albedo, sky
> model. Every one of those belongs to T-45's Advanced panel. **`CHALLENGE.md` C-13 fails outright
> if any appears here.**

**Files you may touch.** `apps/web/components/inputs/**` only.
**Files you may NOT touch.** `app/page.tsx`, `lib/store.ts`, `lib/units.ts`, `lib/i18n.ts`, any
other component directory.

**Subagent guidance.** Single agent. A form whose whole quality criterion is coherence is not
something to split.

**ACCEPTANCE TESTS — the task is NOT done until every one passes:**
1. **The C-13 test, run for real:** a person who cannot define thermal conductivity completes a
   two-material comparison **unaided in under 5 minutes**. **Record the person, the elapsed time and
   a transcript of what they got stuck on.** A failure here is a failing task, not a note.
2. The panel exposes **≤ 10** controls at first paint. Paste the count and the list.
3. **No control on this panel is labelled with a physics symbol** — assert that the rendered labels
   contain no standalone `k`, `ρ`, `c`, `α`, `ε`, `U`, `SHGC`, `ACH` or `θ`.
4. Loading any of the six presets populates every control with no empty required field.
5. Changing wall material triggers **exactly one** re-simulation after the 150 ms debounce. Paste
   the dispatch count.
6. Every material dropdown shows the material's **name**, and its **citation is reachable in one
   click**. Paste the citation text shown for rammed earth.
7. Clicking a wall in the isometric house opens that wall's stack editor (integration check with
   T-46).
8. A malformed CSV shows a **row-level** error naming the row number and leaves the previous weather
   in place. Paste the error text.
9. `grep -rn "273\.15" apps/web/components/inputs` returns **no matches**.
10. At **400 px** width every control is reachable with no horizontal scroll.
11. Every control is keyboard-reachable and every input has an associated `<label>`.
12. With the database off, the material dropdown still lists the full catalogue (T-34's code
    fallback). Paste the item count.

**Evidence (fill this in when done — numbers, not adjectives):**
```
```

**Completed by:** ___  **Date:** ___

---

### [ ] T-45 — The Advanced panel

**Area:** F — Frontend (≈ W-38) · **Status:** NOT STARTED · **Est:** 5 h
**Depends on:** T-36 · **Conflicts with:** none

**Why this exists.** Expert controls must exist — a DRDO researcher will want to set the ground
albedo and the sky model — but behind an explicit disclosure, never on the path a first-time user
must walk. `AUDIT.md` F-9 records that the original plan put raw physics fields on the main panel
with no advanced tier and no stated defaults, which fails C-13 and serves the expert no better.

**PROMPT — paste this to start the task:**
> Create `apps/web/components/advanced/` — a **collapsed-by-default** disclosure panel exposing:
> every `SimOptions` field from §7.5 (`timestepSeconds`, `meshTargetDx`, `simulationDays`,
> `spinUpToleranceK`, `maxSpinUpDays`, `skyModel`, `integrationTheta`, `keepSurfaceProfiles`,
> `allowUnsafeVentilation`), `building.thermalBridgeFactor`, per-surface `exteriorAbsorptivity` /
> `exteriorEmissivity` / `interiorEmissivity`, `site.groundAlbedo` (with a snow override),
> `site.groundTempMeanAnnual`, `site.groundTempAmplitude`, `site.horizonProfile`, and the 24-value
> `achSchedule`.
>
> Every field shows **its default, its units, its valid range**, a **"reset to default"** control,
> and a one-line note on **what it changes**. Out-of-range entry is rejected **at the control** with
> an inline message, before it reaches the engine.
>
> ⚠ **`allowUnsafeVentilation` gets special treatment.** It is the one control that can make the
> tool produce an unsafe design. Render it with a **prominent warning** naming carbon monoxide,
> require an explicit confirmation to enable, and display a persistent badge while it is on. It is
> in this panel because showing a user *why* sealing is unsafe is a product feature — not because it
> is a normal setting.
>
> Nothing here appears on T-44's basic panel, and no T-44 control is duplicated here.

**Files you may touch.** `apps/web/components/advanced/**` only.
**Files you may NOT touch.** `app/page.tsx`, `lib/store.ts`, `components/inputs/**`.

**Subagent guidance.** Single agent. Straightforward — do not fan out.

**ACCEPTANCE TESTS — the task is NOT done until every one passes:**
1. The panel is **collapsed on first paint** and no advanced field is visible until it is opened.
2. **Every `SimOptions` field in §7.5 is present and editable.** Paste the list as rendered and diff
   it against §7.5 — there must be no missing field.
3. Every field displays its default, its unit and its valid range. Spot-check three and paste them.
4. Out-of-range entry (`timestepSeconds = -1`, `meshTargetDx = 0`, `integrationTheta = 2`) is
   rejected **at the control** with an inline message and never reaches the engine. Paste all three
   messages.
5. "Reset to default" restores exactly the §7.5 default for every field. Assert field by field.
6. Changing `skyModel` from `hdkr` to `isotropic` changes the result and does not throw. Paste both
   `tempAt0600` values.
7. **Enabling `allowUnsafeVentilation` requires an explicit confirmation**, shows a warning naming
   carbon monoxide, and leaves a persistent visible badge. Paste the warning text.
8. Collapsing the panel does **not** revert any value.
9. Setting `timestepSeconds` to 60 (from the 300 default) changes `tempAt0600` by **less than
   0.1 K** — the user can verify the §7.5 timestep decision themselves. Paste both values and the
   difference.
10. At **400 px** width the panel scrolls vertically with no horizontal overflow.
11. `grep -rn "273\.15" apps/web/components/advanced` returns **no matches**.

**Evidence (fill this in when done — numbers, not adjectives):**
```
```

**Completed by:** ___  **Date:** ___

---

### [ ] T-46 — The isometric house: click a wall, scrub the day

**Area:** F — Frontend (≈ W-39) · **Status:** NOT STARTED · **Est:** 12 h
**Depends on:** T-36 · **Conflicts with:** T-44 (coordinate only via `store.selectedSurfaceId`)

**Why this exists.** This is **the screenshot that carries the pitch** and the asset the PPT's
Slide 2 requires. It is also the source of a lot of trust: *"the model you see is built from the
exact same description the physics engine receives. If the picture shows a 4 m south wall, the
engine is simulating a 4 m south wall."* (`plan.md` Part 3.) No existing tool combines click-to-edit
on the building itself, surfaces coloured by a physical quantity, **and** a time dimension, in a
zero-install browser tool. That gap is the design target.

**PROMPT — paste this to start the task:**
> Create `apps/web/components/house/` — a hand-authored **2.5D isometric SVG**, no WebGL, no
> Three.js (that is out of scope; the SVG house is the default view and the PPT asset).
>
> Geometry is **parametric from `store.request.building`** — length, width, height, roof pitch,
> surface list — so resizing the shelter in T-44 resizes the drawing. Each `Surface` is one
> `<path>`, filled from a temperature colour scale driven by
> `result.temperatures.surfaces[id].exterior` at `store.scrubberHour`.
>
> Clicking a path sets `store.selectedSurfaceId` to **that surface's exact id** (T-44 reacts and
> opens the stack editor). **You only set the field; you never open the editor yourself.**
>
> Include a **time scrubber** writing `store.scrubberHour`, a play/pause control, and a **colour
> legend stating its range and units** (°C, formatted through `lib/units.ts`).
>
> This deliberately adopts Ladybug/Insight's colour-by-value technique and the WWR Calculator's
> click-a-facade interaction, in plain SVG — both are proven patterns, and the novelty is combining
> them offline with a time axis.
>
> The SVG must have **no fixed pixel dimensions** — use a `viewBox` and let it scale.

**Files you may touch.** `apps/web/components/house/**` only.
**Files you may NOT touch.** `app/page.tsx`, `lib/store.ts`, `components/inputs/**`, any chart
directory.

**Subagent guidance.** Single agent. The geometry, the colour scale and the interaction are one
coherent piece; splitting them produces a drawing whose click targets do not match its paths.

**ACCEPTANCE TESTS — the task is NOT done until every one passes:**
1. **Every** surface in `building.surfaces` is drawn and individually clickable; clicking sets
   `selectedSurfaceId` to that surface's **exact** id. Assert for all surfaces of a preset, paste
   the id list.
2. **The drawing is the model:** changing length, width, height or roof pitch in T-44 changes the
   drawn proportions. Assert that the rendered south-wall path's width scales linearly with
   `building` length. Paste two path widths and the two lengths.
3. Surface colours change visibly between 03:00 and 14:00 on the scrubber, and **the south wall is
   warmest near solar noon** on a clear Leh January day. Paste the south and north wall temperatures
   at 12:00 in °C.
4. With `result === null` the house renders in a neutral unfilled state and does **not** crash.
5. The colour legend states its range and units and updates with the data range. Paste the legend
   text at two different scrubber hours.
6. The animation completes a 24 h loop and can be paused at any hour; pausing at 06:00 shows the
   pre-dawn state.
7. The component renders at **320 px** width without overflowing, and the SVG has **no** fixed pixel
   `width`/`height` attributes.
8. **Keyboard focus reaches every clickable surface and Enter activates it.** Assert with a tab
   order walk; paste the order.
9. A screenshot of this component plus a temperature curve is exportable at presentation resolution
   — this is the asset `CHALLENGE.md` C-18 requires before the PPT gate. Paste the exported pixel
   dimensions.
10. `grep -rn "273\.15" apps/web/components/house` returns **no matches**.
11. Scrubbing rapidly through 24 hours does not re-run the simulation (it reads the existing result).
    Paste the dispatch count — it must be 0.

**Evidence (fill this in when done — numbers, not adjectives):**
```
```

**Completed by:** ___  **Date:** ___

---

### [ ] T-47 — The temperature view (PS Deliverable 1) and the 6 AM label

**Area:** F — Frontend (≈ W-40) · **Status:** NOT STARTED · **Est:** 6 h
**Depends on:** T-36, T-43 · **Conflicts with:** none

**Why this exists.** The chart the whole problem statement is about. **The single number to look at
is the temperature at 6 AM** — not the average, not the daytime peak. The pre-dawn minimum is the
coldest moment, the moment that decides whether people had to burn fuel, and the number a Ladakh
engineer actually cares about. It must be **labelled explicitly on the chart**.

**PROMPT — paste this to start the task:**
> Create `apps/web/components/charts/temp/` — a 24 h line chart of `T_indoor` and `T_ambient` with a
> shaded comfort band and optional `T_meanRadiant`, drawn with `d3-shape`/`d3-scale` into
> hand-authored SVG (no chart framework — §7.13).
>
> Overlay **up to four** variants for comparison, visually distinguishable and individually
> toggleable. Annotate the daily minimum, the daily maximum, and **06:00**.
>
> Label the panel visibly as **"PS Deliverable 1 — Predicted inside temperature"**.
> `CHALLENGE.md` C-16 warns that burying a named deliverable is a needless way to appear to have
> missed a stated requirement, and an evaluator will look for all three by name.
>
> Every temperature is converted **only** through `lib/units.ts`. The comfort band comes from
> `operation.comfortBand` — do not hard-code 18–26 °C; the Ladakh presets use 15–24 °C.
>
> Hovering any point shows a tooltip with the time and both temperatures. The chart must render
> without dividing by zero on a single-timestep result.

**Files you may touch.** `apps/web/components/charts/temp/**` only.
**Files you may NOT touch.** `app/page.tsx`, `lib/store.ts`, the tab container, other chart
directories.

**Subagent guidance.** Single agent. Straightforward — do not fan out.

**ACCEPTANCE TESTS — the task is NOT done until every one passes:**
1. Both series render with a legend, axis labels and units in °C, converted only through
   `lib/units.ts`. `grep -rn "273\.15" apps/web/components/charts/temp` returns **no matches**.
2. The comfort band matches `operation.comfortBand` exactly. Load a Ladakh preset and assert the
   shaded band reads **15–24 °C**, not 18–26.
3. **The 06:00 annotation reads the same value as the `tempAt0600` KPI card**, to the displayed
   precision. Paste both.
4. Four overlaid variants are visually distinguishable and individually toggleable.
5. **The K-03 shape check:** for the heavy-mass fixture the night curve is visibly **not** a plain
   exponential — it has the delayed inflection distributed wall mass produces — and a reviewer
   comparing it to the steel+PUF fixture's curve can see the difference on screen. Paste the two
   curves' values at 21:00, 00:00, 03:00 and 06:00 for both fixtures. *(If the two curves differ
   only by an offset, the physics is wrong and this is a finding for T-11, not a chart to restyle.)*
6. The panel title contains the literal string **"PS Deliverable 1"**.
7. Hovering shows a tooltip with the time and both temperatures.
8. The chart renders with a single-timestep result without dividing by zero.
9. The chart renders with `result === null` showing an empty state, not `NaN`.
10. At **400 px** width the chart is legible and does not overflow horizontally.
11. Axis tick labels do not overlap at 400 px.

**Evidence (fill this in when done — numbers, not adjectives):**
```
```

**Completed by:** ___  **Date:** ___

---

### [ ] T-48 — The solar capture view (PS Deliverable 2)

**Area:** F — Frontend (≈ W-41) · **Status:** NOT STARTED · **Est:** 5 h
**Depends on:** T-36, T-43 · **Conflicts with:** none

**Why this exists.** *"This is where orientation stops being an abstraction. You watch the
south-facing bar tower over the north-facing one and it becomes obvious, without anyone explaining
it, why passive solar design says to put your glass on the south wall. The chart teaches the
principle by itself."* (`plan.md` §6.) Orientation is a word the problem statement uses by name.

**PROMPT — paste this to start the task:**
> Create `apps/web/components/charts/solar/` with four views of `result.solar` — **recompute
> nothing**:
> 1. The daily total in kWh with a useful-versus-rejected split.
> 2. **A horizontal bar chart broken down by surface (S / E / W / N / roof)** — this is the one that
>    makes orientation visible, and it is the most important of the four.
> 3. A time-of-day curve of instantaneous capture.
> 4. A **with/without-snow-albedo comparison**, exposing the Ladakh-specific effect: raising ground
>    albedo 0.20 → 0.80 multiplies the ground-reflected component by exactly 4.
>
> Label the panel **"PS Deliverable 2 — Solar thermal energy captured"**.
> Units stated on every axis (kWh, W/m², W).

**Files you may touch.** `apps/web/components/charts/solar/**` only.
**Files you may NOT touch.** `app/page.tsx`, `lib/store.ts`, other chart directories.

**Subagent guidance.** Single agent. Straightforward — do not fan out.

**ACCEPTANCE TESTS — the task is NOT done until every one passes:**
1. Per-surface bars sum to `solar.dailyTotalKWh.opaque + glazed` to within **0.1 %**. Paste the sum
   and the total.
2. **On a Leh January day the south bar is the largest of the four walls and the north bar is
   effectively zero.** Paste all five bar values in kWh. *(A non-zero north bar in winter means beam
   is leaking onto a north wall — a finding for T-14, not a chart fix.)*
3. **The Ladakh headline:** the vertical south wall's daily total **exceeds** the horizontal roof's
   on 21 Dec at Leh. Paste both.
4. The snow-albedo comparison shows a visible increase on the vertical south wall when albedo goes
   0.2 → 0.8, and the **ground-reflected component quadruples**. Paste both components.
5. The panel title contains the literal string **"PS Deliverable 2"**.
6. Units are stated on every axis.
7. **Rotating the building 180° in the inputs visibly redistributes the bars** — the `CHALLENGE.md`
   C-04 demonstration, done live. Paste the before/after south and north values.
8. The chart renders when `solar.dailyTotalKWh.glazed === 0` (a windowless design).
9. The chart renders with `result === null` showing an empty state.
10. At **400 px** width the bars remain labelled and do not overflow.
11. `grep -rn "273\.15" apps/web/components/charts/solar` returns **no matches**.

**Evidence (fill this in when done — numbers, not adjectives):**
```
```

**Completed by:** ___  **Date:** ___

---

### [ ] T-49 — The heat-flow view and the Sankey (PS Deliverable 3)

**Area:** F — Frontend (≈ W-42) · **Status:** NOT STARTED · **Est:** 8 h
**Depends on:** T-22, T-36, T-43 · **Conflicts with:** none

**Why this exists.** *"The Sankey is the most persuasive single image in the app. It answers 'where
is my heat going?' for someone with no technical background, in one glance, with no explanation
needed. You can literally point at the widest outgoing stream and say 'that's your problem.'"*
(`plan.md` §6.) It is also where `AUDIT.md` found **Q7 silently dropped** from the pathway list —
precisely the class of missing term the energy-balance test exists to catch.

**PROMPT — paste this to start the task:**
> Create `apps/web/components/charts/heatflow/` with three views of `result.heatFlows` —
> **aggregate nothing yourself**; `dailyTotalsKWh` comes from T-22.
>
> **(a) A stacked area chart over time** — gains **above** the zero line, losses **below**, one band
> per pathway, **including `Q7_interiorLongwave`**. All eleven pathways plus `Qaux` and
> `storageRate` appear in the legend. The story must read at a glance: a fat block of gain at
> midday, a fat block of loss all night, and — in a well-designed shelter — the walls quietly giving
> back stored heat during the small hours.
>
> **(b) A Sankey diagram** of daily totals via `d3-sankey`: gains flowing in from the left
> (sunlight, body heat, stove), splitting into streams on the right (stored in the walls, out
> through the windows, out through the roof, carried away by draughts, **radiated to the cold night
> sky**).
>
> **(c) A `Q` versus ΔT scatter** using `heatFlows.deltaT`, which should be near-linear for
> conductive paths with slope ≈ `ΣUA` — an implicit self-check the user can see. This is the problem
> statement's own axis and the reason T-22 added the series.
>
> Label the panel **"PS Deliverable 3 — Heat flow vs. ambient–shelter ΔT over time"**, using the
> problem statement's own phrasing.
>
> CSV export of every timestep and every term is handed to T-52's exporter — **do not reimplement
> it here**.

**Files you may touch.** `apps/web/components/charts/heatflow/**` only.
**Files you may NOT touch.** `app/page.tsx`, `lib/store.ts`, other chart directories,
`components/meta/**`.

**Subagent guidance.** **Spawn 2 subagents:** one owns the stacked-area chart and the Q-vs-ΔT
scatter, the other owns the Sankey. They are visually and structurally independent and share no
file within the directory (give each its own subdirectory). Acceptance tests 1–5 and 9–11 to the
first, 6–8 to the second. **Merge only when both report green and the panel renders all three views
together.**

**ACCEPTANCE TESTS — the task is NOT done until every one passes:**
1. **All eleven pathways plus `Qaux` and `storageRate` appear in the stacked chart and in the
   legend, including `Q7_interiorLongwave`.** Paste the legend list — this is the exact list
   `AUDIT.md` found Q7 dropped from.
2. Gains render **above** the axis and losses **below**, consistent with the §7.2 sign convention at
   every timestep. Assert programmatically over the whole series.
3. **`Q4_skyRadiation` appears on the loss side all night, including hours when ambient is warmer
   than indoors** — the visible evidence for `CHALLENGE.md` C-02. Paste its value at 02:00.
4. The `Q` vs ΔT scatter for envelope conduction has **R² > 0.95** and a fitted slope within **10 %**
   of the hand-computed `ΣUA`. Paste R², the fitted slope and the hand-computed `ΣUA`.
5. The panel title contains the literal string **"PS Deliverable 3"**.
6. **The Sankey's inflow total equals its outflow plus storage change to within 1 %.** Paste both
   totals and the deviation.
7. The Sankey renders with no negative-width link and no `NaN` node.
8. The Sankey labels every stream with its kWh value and its plain-language name (not `Q4`).
9. All three views render for a run with **zero** auxiliary heating.
10. All three render with `result === null` showing an empty state, not `NaN`.
11. At **400 px** width all three are legible; the Sankey may scroll horizontally inside its own
    `overflow-x: auto` container, but the page body must not.

**Evidence (fill this in when done — numbers, not adjectives):**
```
```

**Completed by:** ___  **Date:** ___

---

### [ ] T-50 — The survival grid

**Area:** F — Frontend · **Status:** NOT STARTED · **Est:** 5 h
**Depends on:** T-36, T-59 · **Conflicts with:** none

**Why this exists.** *"This is the screen that answers the question a procurement officer actually
has, which is not 'what is the average performance' but 'will this keep people safe on the worst day
this place has ever had?'"* (`plan.md` §6.) A tool that takes four hours per run **structurally
cannot** show this screen.

**PROMPT — paste this to start the task:**
> Create `apps/web/components/grid/` — a table with **one row per scenario** from
> `store.scenarios` (T-59 produces them), colour-coded green / amber / red by how cold it got
> inside.
>
> Columns: scenario name, its plain-English description, the date it is drawn from,
> **`tempAt0600`**, minimum indoor temperature, hours below 5 °C, hours in comfort,
> `auxEnergyKWhPerDay`, and the energy-balance residual for that run.
>
> Banding, stated on screen in a key so a viewer knows what the colours mean:
> **green** `tempAt0600 >= 288.15 K` (15 °C, the minimum acceptable in `BLUEPRINT.md` Appendix C);
> **amber** `278.15 K <= tempAt0600 < 288.15 K` (5–15 °C: survivable, uncomfortable);
> **red** `tempAt0600 < 278.15 K` (below 5 °C — the survival threshold for pipes and health).
> These three thresholds come from Appendix C; do not invent others.
>
> Clicking a row loads that scenario into the temperature chart, so a viewer can go straight from
> "this one is red" to "here is why".
>
> Show a **progress state** while the eighteen scenarios stream in (T-39's SSE `progress` events),
> filling rows as they arrive rather than blocking on all eighteen.
>
> **Offline:** when `store.online === false`, show the one locally computed scenario and a clear
> note that the remaining seventeen need the server — never a blank table and never silently fewer
> rows with no explanation.

**Files you may touch.** `apps/web/components/grid/**` only.
**Files you may NOT touch.** `app/page.tsx`, `lib/store.ts`, chart directories.

**Subagent guidance.** Single agent. Straightforward — do not fan out.

**ACCEPTANCE TESTS — the task is NOT done until every one passes:**
1. **Eighteen rows render** for a complete scenario run. Paste the row count and the scenario names.
2. The colour banding matches the three thresholds exactly: a row at `tempAt0600 = 288.15 K` is
   **green**, at `288.14 K` is **amber**, at `278.14 K` is **red**. Paste all three observed colours.
3. The colour key is visible on screen and states its thresholds in °C.
4. Clicking a row loads that scenario into the temperature chart. Verify by reading the chart's
   06:00 annotation afterwards and matching it to the row.
5. Rows fill **incrementally** as `progress` events arrive; the table is not blank until all
   eighteen complete. Paste the row count observed at the halfway point.
6. Every row shows its own energy-balance residual, and **every one is < 0.1 %**. Paste the maximum.
7. **Offline:** with the network blocked, the grid shows **one** row plus an explicit note naming
   what is missing and why. Paste the note text.
8. With `scenarios === null` the grid shows an empty state, not `NaN` and not a blank box.
9. A scenario that failed to compute shows an error row with its code, not a missing row.
10. At **400 px** width the table scrolls **horizontally inside its own container** and the page body
    does not scroll horizontally.
11. `grep -rn "273\.15" apps/web/components/grid` returns **no matches**.

**Evidence (fill this in when done — numbers, not adjectives):**
```
```

**Completed by:** ___  **Date:** ___

---

### [ ] T-51 — KPI cards, the integrity badge and the safety warning

**Area:** F — Frontend (≈ W-43) · **Status:** NOT STARTED · **Est:** 5 h
**Depends on:** T-36, T-43 · **Conflicts with:** none

**Why this exists.** The numbers a decision rests on, plus the two signals that make the tool
credible and safe: the energy-balance badge, and the ventilation warning. `AUDIT.md` flagged a
**dimensional error in the project's own headline credibility number** — the contract says
`< 0.001` while the mockup displayed `0.02%`. §7.4 settles it and this card is where the settlement
becomes visible.

**PROMPT — paste this to start the task:**
> Create `apps/web/components/kpis/` rendering the right-hand column from `result.kpis` and
> `result.meta`. **Compute nothing** — every number comes from the result.
>
> Cards: **06:00 temperature** with its delta versus the baseline; comfort hours; auxiliary heating
> kWh/day; fuel litres, ₹ and CO₂ per year; min / max / swing; decrement factor; time lag;
> hours below 5 °C; hours below freezing; condensation risk hours.
>
> **The model-integrity badge:** render `(meta.energyBalanceResidual * 100).toFixed(3) + '%'`
> **exactly** as §7.4 specifies — so a stored residual of `0.0002` displays as `0.020%`. Green below
> 0.1 %, red at or above. Tooltip gives the residual's definition in one sentence.
>
> **The safety warning:** whenever a `meta.warnings` entry indicates the ACH was clamped to the
> ventilation floor, show a warning worded so a **non-expert** understands the carbon-monoxide risk,
> styled as a warning, and **never dismissible into invisibility**. Render **every** `meta.warnings`
> entry in a visible list — a warning behind a collapsed panel is a warning nobody reads.
>
> ⚠ Render `condensationRiskHours === null` as **"not available — no humidity data"**, never as
> "0 hours". Rendering null as zero is a lie about data quality (§7.7).

**Files you may touch.** `apps/web/components/kpis/**` only.
**Files you may NOT touch.** `app/page.tsx`, `lib/store.ts`, chart directories,
`components/decide/**`.

**Subagent guidance.** Single agent. Straightforward — do not fan out.

**ACCEPTANCE TESTS — the task is NOT done until every one passes:**
1. **Every field in the §7.7 `kpis` block appears on a card with a unit and a plain-language
   label.** Paste the rendered list and diff it against §7.7 — nothing missing.
2. **The badge shows `0.020%` for a stored residual of `0.0002`.** Paste the stored value and the
   rendered string. This is the dimensional consistency `AUDIT.md` flagged as broken.
3. The badge turns **red** when the residual reaches `0.001`, demonstrated with a deliberately
   broken fixture. Paste both the value and the observed colour.
4. A design clamped by the ventilation floor shows the warning, and **the warning names carbon
   monoxide**. Paste the warning text verbatim.
5. The warning cannot be dismissed into invisibility — assert it is still present after every
   dismiss affordance is exercised.
6. **`condensationRiskHours === null` renders as text, not as "0 hours".** Paste the rendered string.
7. **Every** `meta.warnings` string is visible on screen without opening a panel. Paste the count
   rendered versus the count in `meta.warnings`.
8. The 06:00 card matches T-47's chart annotation to the displayed precision. Paste both.
9. The column renders with `result === null` showing empty states, not `NaN`.
10. `grep -rn "273\.15" apps/web/components/kpis` returns **no matches**.
11. At **400 px** width the cards stack to one column and remain legible.
12. Every KPI's unit is shown (°C, h, kWh/day, L/yr, kg/yr, ₹/yr, dimensionless).

**Evidence (fill this in when done — numbers, not adjectives):**
```
```

**Completed by:** ___  **Date:** ___

---

### [ ] T-52 — The assumptions panel, exports, the offline banner and bilingual labels

**Area:** F — Frontend (≈ W-45) · **Status:** NOT STARTED · **Est:** 8 h
**Depends on:** T-36, T-43, T-51 · **Conflicts with:** all Area F tasks (message-file boundary)

**Why this exists.** Four cheap credibility features in one place. *"Every assumption we make is
visible in one panel in the app. If a judge wants to know what stove efficiency we assumed, it is on
screen, and they can change it and watch the numbers move."* (`plan.md` §10.) And `CHALLENGE.md`
C-20: **a simplification volunteered is engineering judgement; the same one discovered by an
evaluator is a gap.**

**PROMPT — paste this to start the task:**
> Create `apps/web/components/meta/` with four things.
>
> **(a) The assumptions panel.** Every constant, correlation and conversion factor in **one place**,
> each with its value, its units and its **source**: `SIGMA`, `G_SC`, `C_P_AIR`, `R_AIR`, `P0`,
> `ACH_MIN`, `ACH_MIN_COMBUSTION_ALLOWANCE`, `LAPSE_RATE`, `ACH_PER_GLAZING_FRACTION` **with its
> calibration note**, the air-capacitance multiplier `M = 4` **with its calibration note**, the four
> kerosene constants, `SOLAR_TO_FLOOR_FRACTION`, `RANK_NOISE_FLOOR`, the Erbs correlation, Swinbank,
> both convection correlations **with their altitude factor**, Kusuda–Achenbach, and the
> annualisation method string from `meta.annualisationMethod`.
> The fuel/cost constants are **editable** and the numbers move when they change — that is the demo
> moment `plan.md` §10 describes.
>
> **(b) An explicit limitations list**, stated as deliberate choices with their consequences named,
> not as apologies. At minimum: no air stratification (single well-mixed air node); uniform surface
> temperatures; no moisture transport (a condensation *check* only); simplified wind; no 3-D thermal
> bridging beyond a lumped factor; single zone; beam-only shading (T-18's documented ceiling).
> ⚠ The word **"well-stratified"** must appear **nowhere** — `BLUEPRINT.md` 1.4 uses it by mistake
> to argue for the single-air-node assumption, and the argument requires **well-mixed**, the
> opposite.
>
> **(c) Exports:** CSV of every timestep and every term (headers matching the `heatFlows` field
> names exactly); the design as shareable JSON; a share **link** via T-41 when the database is up;
> and a PDF report via a **print stylesheet plus `window.print()`** — no PDF library (§7.13).
>
> **(d) The offline banner and the locale switch.** When `store.online === false`, show
> *"Offline — showing 1 scenario, AI advice unavailable."* — honest, specific, and never silently
> pretending to be fully functional. The locale switch aggregates each component's own
> `messages.ts` into `lib/i18n.ts`'s registry; **you own only the aggregator**, never another
> component's message file.

**Files you may touch.** `apps/web/components/meta/**`, `apps/web/app/globals.css` print styles
only.
**Files you may NOT touch.** Any other component's `messages.ts`. `lib/store.ts`, `lib/i18n.ts`,
`app/page.tsx`.

**Subagent guidance.** **Spawn 3 subagents:** one owns the assumptions panel and the limitations
list; one owns the three exporters and the print stylesheet; one owns the offline banner and the
i18n aggregator. Each gets its own subdirectory and its own acceptance tests (1–4, 5–9, 10–13).
**Merge only when all three report green and the panel renders with all four features present.**

**ACCEPTANCE TESTS — the task is NOT done until every one passes:**
1. **Every constant exported from `packages/engine/src/constants.ts` appears in the assumptions
   panel with a value, a unit and a source.** Diff the two lists mechanically and paste the diff —
   it must be empty.
2. `ACH_PER_GLAZING_FRACTION` and the `M = 4` multiplier each display their **calibration note**
   saying what evidence would justify changing them. Paste both notes.
3. **The limitations list contains at least the seven items named above**, each stated as a
   deliberate choice with its consequence. Paste the list.
4. `grep -rni "well-stratified" apps/web` returns **no matches**.
5. Editing `KEROSENE_INR_PER_L` in the panel changes the ₹/yr KPI card. Paste the before and after.
6. CSV export opens in a spreadsheet with **one row per timestep** and **one column per series**,
   headers matching the `heatFlows` field names exactly. Paste the header row and the row count.
7. JSON export re-imports through `requestFromJson` and reproduces a **deep-equal**
   `SimulationRequest`.
8. PDF output contains the isometric house, the three deliverable charts, the KPI cards and the
   assumptions panel — **on a machine with no PDF library installed**. Paste the page count.
9. **All three exports work offline** with the network blocked. Paste the three file sizes.
10. With the network blocked, the banner shows the literal text *"Offline — showing 1 scenario, AI
    advice unavailable."* and the share button is hidden or disabled with an explanation.
11. Switching to Hindi changes **every** label on the basic input panel and the KPI cards; **no key
    renders as raw text**. Paste three before/after label pairs.
12. A missing translation falls back to **English**, never to the raw key.
13. `grep -rn "273\.15" apps/web/components/meta` returns **no matches**.

**Evidence (fill this in when done — numbers, not adjectives):**
```
```

**Completed by:** ___  **Date:** ___

---

### [ ] T-53 — The day/night animation, driven by the real solar-position code

**Area:** F — Frontend (≈ `plan.md` §5 step 4) · **Status:** NOT STARTED · **Est:** 6 h
**Depends on:** T-46 · **Conflicts with:** T-46 (renders into its SVG — coordinate the layer)

**Why this exists.** While the server works, the 3D scene does not freeze and does not show a
spinner: **it plays out a day.** The sun rises over your shelter, tracks across the sky, casts moving
shadows, sets, and night falls, and it loops until the results are ready. Two reasons this is in the
product and not cut as decoration:
1. **It makes a wait feel like progress.** Watching a shelter stand through a sunrise while a ring
   fills in "7 of 18 scenarios done" is a fundamentally different experience from a spinner.
2. **It is not fake.** The sun's path is computed by **the same `solar/geometry.ts` the physics
   engine uses**. On 21 December in Leh the animated sun climbs to the real height the December sun
   reaches in Leh — low, and in the south. You are watching the actual thing being simulated. It is
   a demonstration, not a screensaver, and that is the only reason it survives the cut list.

**PROMPT — paste this to start the task:**
> Create `apps/web/components/house/daynight/` — an animation layer rendered **inside** T-46's SVG,
> in its own subdirectory, importing T-46's geometry but editing none of its files.
>
> The sun marker's position comes from `sunPosition(latitude, longitude, standardMeridian,
> dayOfYear, clockHour)` in `@shelter/engine` — **import it; do not reimplement it, do not
> approximate it, do not hard-code an arc.** That single import is the entire honesty claim of this
> feature. Project `altitudeDeg` and `azimuthDeg` onto the isometric projection T-46 already uses.
>
> Draw: a sky gradient that shifts with solar altitude (day → dusk → night); a sun disc whose height
> and bearing are the computed ones; **shadows cast from the shelter, whose length and direction
> follow the computed solar altitude and azimuth**; stars at night. Show the clock hour and the
> computed solar altitude as text, so a viewer can check it against the chart.
>
> **Two modes:**
> - **Waiting mode:** loops a full 24 h cycle continuously while `store.status === 'running'`, with
>   a progress ring showing `done / total` from the SSE `progress` events (T-39) or the local worker
>   (T-43). The ring is what the loop is counting, and it must show real counts, never a fake
>   percentage.
> - **Scrubber mode:** when `status !== 'running'`, the sun follows `store.scrubberHour` so it is
>   consistent with T-46's surface colours at the same instant.
>
> **Respect `prefers-reduced-motion`:** when set, render a static daytime frame with the scrubber
> still functional, and do not animate. An animation nobody can switch off is an accessibility
> defect, not a feature.
>
> Use CSS transforms and `requestAnimationFrame`. **No animation library** (§7.13).

**Files you may touch.** `apps/web/components/house/daynight/**` only.
**Files you may NOT touch.** T-46's own files in `components/house/` (import from them),
`app/page.tsx`, `lib/store.ts`, any chart directory.

**Subagent guidance.** Single agent. Straightforward — do not fan out.

**ACCEPTANCE TESTS — the task is NOT done until every one passes:**
1. **The sun path is real:** at Leh on 21 Dec the animated sun's peak altitude reads **32.4° ± 0.2**;
   at the equinoxes **55.85° ± 0.2**; on 21 Jun **79.3° ± 0.2**. Read the displayed altitude at solar
   noon on each date and paste all three. *(These are the same three anchors T-14's tests assert —
   if the animation disagrees with them, it is not using the engine.)*
2. `grep -rn "sunPosition" apps/web/components/house/daynight` shows the import from
   `@shelter/engine`, and `grep -rn "Math.sin\|Math.cos" ` in that directory shows **no independent
   solar calculation** — only projection maths.
3. At solar noon at Leh the sun is **due south** (azimuth 0 ± 1°), and it is east of south in the
   morning and west of south in the afternoon. Paste three sampled azimuths.
4. **Shadow direction is opposite the sun's azimuth** and shadow length increases as altitude falls.
   Paste shadow length at 09:00, 12:00 and 16:00 on 21 Dec.
5. On 21 Dec at Leh the sun is below the horizon (night rendering) before the computed sunrise and
   after the computed sunset, matching `sunPosition(...).isUp` exactly at every hour.
6. **Waiting mode:** during a scenario run the animation loops continuously and the progress ring
   shows real `done / total` counts, incrementing with each SSE event. Paste the observed sequence.
7. The ring never shows a fabricated percentage when no progress data is available — it shows an
   indeterminate state instead. Verify by blocking progress events.
8. **Scrubber mode:** with `status === 'idle'`, moving the scrubber to 06:00 places the sun at the
   computed 06:00 position and T-46's surfaces show their 06:00 colours **at the same instant**.
9. `prefers-reduced-motion: reduce` renders a **static** frame, the scrubber still works, and
   `requestAnimationFrame` is not called in a loop. Assert the call count.
10. The animation runs at ≥ 30 fps on a 4-core laptop and **does not block the main thread** during
    a simulation — assert the longest main-thread task stays under 16 ms. Paste both numbers.
11. At **400 px** width the animation renders without overflow.
12. Stopping the animation releases its `requestAnimationFrame` handle — no leak after unmount.

**Evidence (fill this in when done — numbers, not adjectives):**
```
```

**Completed by:** ___  **Date:** ___

---

# AREA G — DECISION SUPPORT

> *"This is the feature that makes this a design tool rather than a slower ANSYS."* `AUDIT.md` F-3
> records that Compare and Optimise were **the least-specified, least-owned and least-scheduled part
> of the whole plan**, despite being explicitly the product's reason to exist. This area closes that.
> Everything here lives in `packages/optimise` (`@shelter/optimise`), whose only runtime dependency
> is `@shelter/engine`.

---

### [ ] T-54 — The sweep engine: expand, dispatch, collect

**Area:** G — Decision support (≈ W-30) · **Status:** NOT STARTED · **Est:** 8 h
**Depends on:** T-06, T-24, T-28 · **Conflicts with:** T-55 (same package, sequential)

**Why this exists.** *"Because one simulation takes about 50 milliseconds, we do not ask 'how does
this design do on a typical day?' We ask 'how does this design do on every day that matters?'"* The
engine measures **31.8 ms/run** today, so the budget is already met — what is missing is the
orchestration that turns that speed into a hundred answers.

**PROMPT — paste this to start the task:**
> Create `packages/optimise/` as a workspace package `@shelter/optimise`, `"type": "module"`, with
> exactly one runtime dependency: `@shelter/engine`. Add `packages/optimise` to the root workspaces.
>
> `packages/optimise/src/sweep.ts`:
> ```ts
> export function expandVariants(req: SweepRequest): { id: string; request: SimulationRequest;
>                                                      overrides: Record<string, string|number|boolean> }[];
> export async function runSweep(
>   req: SweepRequest,
>   runner: (r: SimulationRequest) => Promise<SimulationResult>,
>   onProgress?: (done: number, total: number) => void,
>   signal?: AbortSignal,
> ): Promise<SweepResult>;
> ```
>
> `expandVariants` is the Cartesian expansion of `VariableSpec[]` over `base`, capped at
> `maxVariants`, each variant carrying a **human-readable** `overrides` map for the UI. It applies
> each spec kind to the request: `wallConstruction` and `roofConstruction` swap layer lists from
> T-24's catalogue; `insulationThickness` changes the insulation layer's thickness;
> `insulationPosition` **reorders** the layers (inside / outside / cavity) without changing their
> total thickness — this single choice can matter more than the amount, and it must be a real
> reordering, not a flag; `wwr` scales the window area on the named orientation;
> `buildingAzimuth` rotates; `aspectRatio` changes plan proportions **at fixed floor area**;
> `nightShutters` sets or clears the 24-value shutter schedule; `massStrategy` adds a
> `StorageElement` (T-20) or a heavy floor; `ach` sets the schedule.
>
> **`runner` is injected**, so the identical code runs against a worker pool in the browser, against
> T-40's thread pool on the server, and against a plain synchronous `simulate` in a Node test. That
> injection is what makes this package testable without any concurrency at all.
>
> **Share spin-up across variants.** Variants differing only in a parameter that does **not** change
> the envelope's thermal mass reuse a cached converged initial state, keyed by a hash of the
> mass-affecting fields (constructions, thicknesses, storage elements, volume). Paying a multi-day
> convergence spin-up 100 times from cold is where the budget is lost. **The sharing must change
> speed and not answers** — that is acceptance test 4 and it is the one that matters.
>
> **Enforce `constraints.achMin`** by marking a variant `feasible: false` with a non-empty
> `infeasibleReason`, and **keeping it in `variants`**. Silently dropping an infeasible design hides
> the reason a user's idea does not work, which is exactly the information they came for.
>
> No ranking, no Pareto logic (T-56). No UI. No worker pool of your own — use the injected runner.

**Files you may touch.** `packages/optimise/**`, the root `package.json` workspaces array.
**Files you may NOT touch.** `packages/engine/**`, `apps/web/**`.

**Subagent guidance.** Single agent. `expandVariants` and `runSweep` share the variant identity
scheme; two authors produce two schemes and the cache keys stop matching.

**ACCEPTANCE TESTS — the task is NOT done until every one passes:**
1. `expandVariants` on **5 wall materials × 4 glazing fractions × 5 orientations** produces exactly
   **100** distinct requests, each differing from `base` **only** in the swept fields. Assert the
   difference set field by field. Paste the count.
2. `maxVariants: 20` on that same spec returns exactly **20** and sets no misleading metadata.
3. `insulationPosition: ['inside','outside']` produces two variants with the **same total
   thickness** and the **same steady-state U-value** but **different layer order**. Paste both
   U-values and both layer lists.
4. **Spin-up sharing changes speed, not answers:** run the same 100-variant sweep with sharing
   enabled and disabled. Sharing must be at least **2× faster**, and every variant's `tempAt0600`
   must agree between the two runs to within **0.05 K**. Paste both wall-clock times and the maximum
   `tempAt0600` deviation.
5. **The C-15 budget:** 100 variants complete in **under 10 s** with a synchronous runner on this
   machine. Paste the wall-clock time and `meta.evaluated`.
6. A variant whose ACH falls below the safety floor is returned with `feasible: false`, a non-empty
   `infeasibleReason`, and **is still present in `variants`**. Paste the count of infeasible
   variants and one reason string.
7. Cancelling mid-sweep via `AbortSignal` stops dispatch **within one variant's runtime** and
   rejects or resolves-as-cancelled cleanly, leaving no runner in flight. Paste the elapsed time.
8. `onProgress` fires monotonically and ends at `done === total`.
9. `runSweep` with a synchronous runner produces results **identical** to a concurrent runner for
   the same input. Assert deep equality of every variant's KPIs.
10. `aspectRatio` variants all have the **same `floorArea`** to within 1e-9.
11. `packages/optimise/package.json` lists `@shelter/engine` and **nothing else** in dependencies.
12. `npm run lint` passes — no React, no Prisma in `packages/optimise`.

**Evidence (fill this in when done — numbers, not adjectives):**
```
```

**Completed by:** ___  **Date:** ___

---

### [ ] T-55 — The browser worker pool and the shared spin-up cache

**Area:** G — Decision support (≈ W-30) · **Status:** NOT STARTED · **Est:** 6 h
**Depends on:** T-43, T-54 · **Conflicts with:** T-43 (worker plumbing — sequential)

**Why this exists.** The sweep has to run in the browser too, because the offline story and the
"instant preview" story both need it. `navigator.hardwareConcurrency` is the browser's equivalent of
T-40's core count, and the same variant-level caching applies.

**PROMPT — paste this to start the task:**
> Create `apps/web/workers/sweep.worker.ts` and `packages/optimise/src/pool.ts`.
>
> `pool.ts` implements a **runner factory**: given a way to post a `WorkerRequest` and receive a
> `WorkerResponse` (§7.14), it returns the `runner` function `runSweep` expects. It knows nothing
> about `Worker` or `worker_threads` — that abstraction is what lets the identical pool logic serve
> the browser and the server.
>
> `sweep.worker.ts` is the browser entry point: it imports `runSweep` from `@shelter/optimise` and
> `simulate` from `@shelter/engine`, sizes its own sub-pool to
> `max(1, (navigator.hardwareConcurrency ?? 4) - 1)`, and streams `progress` messages back on the
> §7.14 protocol so T-53's progress ring and T-50's incremental grid both work offline exactly as
> they do online.
>
> **Reuse T-43's `workerClient` message plumbing; do not fork it.** If it needs a change to be
> reusable, that change belongs to T-43 — report it rather than copying the file (global rule 16).
>
> Cancellation propagates: aborting the client aborts the worker's dispatch loop within one variant.

**Files you may touch.** `packages/optimise/src/pool.ts`, `apps/web/workers/sweep.worker.ts`,
`packages/optimise/test/pool.test.ts`.
**Files you may NOT touch.** `apps/web/lib/workerClient.ts` (T-43 owns it — reuse it),
`apps/web/lib/pool.ts` (T-40 owns it), `packages/optimise/src/sweep.ts` (T-54 owns it).

**Subagent guidance.** Single agent. Concurrency plumbing.

**ACCEPTANCE TESTS — the task is NOT done until every one passes:**
1. A 100-variant sweep run through the browser worker returns a `SweepResult` **deep-equal** to the
   same sweep run synchronously in Node. Assert every variant's KPIs.
2. The sweep completes in **under 10 s** in a browser on a 4-core machine. Paste the time and
   `meta.workers`.
3. **The main thread stays responsive** during the sweep: a 10 ms interval fires within 20 ms of
   schedule at least 95 % of the time. Paste the percentage.
4. `progress` messages arrive monotonically and end at `done === total === 100`.
5. Aborting mid-sweep stops dispatch within one variant's runtime and terminates cleanly. Paste the
   elapsed time.
6. `meta.spinUpShared` is `true` when sharing applied and the sweep is at least 2× faster than with
   it off. Paste both times.
7. Every response's `id` matches its request's `id`.
8. **Offline:** with the network fully blocked, the browser sweep still completes and returns
   correct results. Paste the time and the best variant's `tempAt0600`.
9. `pool.ts` contains no reference to `Worker`, `worker_threads`, `navigator` or `window` — assert
   by grep. It is transport-agnostic.
10. Running the sweep twice does not grow the worker count.
11. `npm run lint` passes.

**Evidence (fill this in when done — numbers, not adjectives):**
```
```

**Completed by:** ___  **Date:** ___

---

### [ ] T-56 — Ranking, the Pareto front, and the perturbation-stability check

**Area:** G — Decision support (≈ W-31) · **Status:** NOT STARTED · **Est:** 8 h
**Depends on:** T-54 · **Conflicts with:** T-54 (same package, sequential)

**Why this exists.** `CHALLENGE.md` C-14: *"Efficient by what measure?"* Minimum night temperature,
mean temperature, comfort hours, degree-hours and backup heating energy can each crown a **different
winner from the same simulation**. And: *"A ranking that flips under a 20 % nudge to a parameter
nobody measured precisely is not decision support; presenting it without an uncertainty caveat is
the kind of overconfidence that collapses under one follow-up question."* **No source document
contains this test.** It is created here.

**PROMPT — paste this to start the task:**
> Create `packages/optimise/src/search.ts`:
> ```ts
> export function rank(variants: SweepVariant[], objectives: SweepRequest['objectives']): SweepResult;
> export function paretoRank(variants: SweepVariant[], objectives: SweepRequest['objectives']): void;
> export async function perturbationStability(
>   req: SweepRequest, runner: Runner, pct?: number
> ): Promise<{ stable: boolean; originalBestId: string; perturbedBestId: string; pct: number }>;
> export function enforceConstraints(variants: SweepVariant[], c: SweepRequest['constraints']): void;
> ```
>
> **Rank by `PRIMARY_METRIC` = `auxEnergyKWhPerDay`, ascending (lower is better)**, tie-broken by
> `SECONDARY_METRIC = tempAt0600`, descending. This is the metric that matches DRDO's stated
> objective — minimising energy use and fossil-fuel dependence — and it stays meaningful even for
> designs that never reach comfort unaided.
>
> **The tie policy is not optional.** Any variants whose primary metric differs by less than
> `RANK_NOISE_FLOOR = 0.05 kWh/day` go into `SweepResult.ties` as a group and are **presented as
> tied, never ordered**. Manufacturing a winner out of numerical noise is exactly the overconfidence
> C-14 is about.
>
> `paretoRank` is non-dominated sorting over the declared objectives; rank 1 is the front.
>
> **`perturbationStability`** re-runs the sweep with the infiltration conductance and both
> convection coefficients perturbed by `±pct` (default **20 %**) and reports **as data** whether the
> top-ranked variant survives. A run where the winner flips **must not throw** — it must report the
> flip, because that is the finding. Return the original and perturbed winner ids either way.
>
> **`enforceConstraints` enforces the ACH floor independently of the engine.** This is the second of
> the two deliberate enforcements in global rule 10 — **defence in depth, not redundancy.** The
> optimiser must never emit an unsafe recommendation even if a coefficient elsewhere changes. It
> also enforces `localMaterialsOnly` (every material `locallyAvailableLadakh`), `budgetCeilingINR`
> (by `capitalCostINR`) and `fixedFloorArea`.
>
> Implement `gridSearch`, `randomSearch` and `nsga2` behind the one `mode` switch on `SweepRequest`.
> Keep `nsga2` simple — a standard non-dominated sort with crowding distance; this is not a research
> contribution.

**Files you may touch.** `packages/optimise/src/search.ts`, `packages/optimise/test/search.test.ts`.
**Files you may NOT touch.** `packages/optimise/src/sweep.ts`, `pool.ts`, `packages/engine/**`,
`apps/web/**`.

**Subagent guidance.** Single agent. Ranking, ties and constraints are one policy; splitting them is
how two of the three end up disagreeing about what "best" means.

**ACCEPTANCE TESTS — the task is NOT done until every one passes:**
1. Ranking is by `auxEnergyKWhPerDay` **ascending**; reversing the input order produces the
   **identical** ranking. Assert on ids.
2. Two variants **0.01 kWh/day** apart appear in the same `ties` group and neither is presented as
   the sole winner; two variants **0.5 kWh/day** apart do not. Paste both groupings.
3. `paretoRank` on a hand-built 2-objective set with a known front assigns rank 1 to **exactly** the
   known front members. Paste the assigned ranks.
4. **The C-14 perturbation test:** `perturbationStability` at ±20 % returns `stable` as **data**,
   naming both winner ids. A run where the winner flips **does not throw**. Run it on the real
   preset sweep and paste `stable`, both ids and the pct.
5. **The C-06 / K-05 non-monotonic optimum:** sweeping south glazing 0 % → 50 % with everything else
   fixed produces a curve with an **interior optimum**, and `rank` identifies it. Paste the full
   series and the identified winner. *(This depends on T-21's ACH coupling — if the curve is
   monotonic, report it against T-21 rather than adjusting anything here.)*
6. **The safety constraint holds:** across **200** randomly generated variants, **no** variant
   returned with `feasible: true` has ACH below `ACH_MIN = 0.35`, and none below **0.70** when
   `hasUnventedCombustion` is set. Paste both minimum ACH values observed among feasible variants.
7. `localMaterialsOnly: true` returns **only** variants whose materials all have
   `locallyAvailableLadakh: true`, and returns a **non-empty** set. Paste the count.
8. A `budgetCeilingINR` excludes exactly the variants above it by `capitalCostINR` — assert the set
   difference exactly.
9. `fixedFloorArea` rejects any variant whose floor area moved by more than 1e-9.
10. `nsga2` produces a front that **dominates** the `randomSearch` front on the same budget of
    evaluations. Paste both hypervolume or front-size comparisons.
11. `rank` on an empty variant list returns an empty result rather than throwing.
12. `enforceConstraints` is called by `rank` — verify that a caller who forgets it still cannot get
    an unsafe winner out of `SweepResult.best`.

**Evidence (fill this in when done — numbers, not adjectives):**
```
```

**Completed by:** ___  **Date:** ___

---

### [ ] T-57 — The buildable recommendation, and the non-AI template fallback

**Area:** G — Decision support (≈ W-32) · **Status:** NOT STARTED · **Est:** 8 h
**Depends on:** T-24, T-56 · **Conflicts with:** none

**Why this exists.** *"A chart is not a decision."* `CHALLENGE.md` C-16: the session must end with a
concrete specification a **site engineer could hand to a mason**, paired with expected performance
in plain terms. `AUDIT.md` F-3 and C-16 both record that the original plan ended at charts. This is
also the **fallback that guarantees the advice panel is never dead**: it produces correct, slightly
less fluent prose from the same numbers with no AI, no network and no API key.

**PROMPT — paste this to start the task:**
> Create `packages/optimise/src/recommend.ts`:
> ```ts
> export interface Recommendation { /* define LOCALLY in this file, not in types.ts */ }
> export function buildRecommendation(
>   best: SweepVariant, baseline: SweepVariant, ties: string[][],
>   catalogue: { materials: Material[]; constructions: NamedConstruction[] },
>   annualisationMethod: string,
> ): Recommendation;
> export function renderTemplateProse(rec: Recommendation): string[];
> ```
>
> `Recommendation` contains:
> - **The specification**, per surface: layer order, material **name** (never an id), thickness, and
>   **the position of the insulation stated explicitly** (inside / outside / cavity); glazing type;
>   window-to-wall ratio per orientation; thermal-mass strategy; the night-shutter decision; and the
>   **target airtightness with the safety floor named**.
> - **Expected performance against the baseline**, so the delta is explicit: `tempAt0600`, comfort
>   hours, `auxEnergyKWhPerDay`, each as a pair (baseline → recommended).
> - **Economics:** incremental capital cost, annual fuel litres, ₹ and CO₂ saved, and simple payback
>   in years. **Every economic figure names the constant it used** (`KEROSENE_KWH_PER_L`,
>   `KEROSENE_STOVE_EFFICIENCY`, `KEROSENE_CO2_KG_PER_L`, `KEROSENE_INR_PER_L`) **and the
>   annualisation method string**, so a judge can recompute it by hand.
> - **A tie notice** when `best` is inside a tie group: the output must say the top designs are
>   statistically indistinguishable **and list them**, rather than manufacturing a false winner.
>
> `renderTemplateProse` emits plain sentences from that structure — the non-AI fallback. Model
> paragraph, for tone and content:
> > *"Move your insulation to the outside of the wall and add a heavy inner leaf. Right now your
> > insulation is on the inside face, which means the thick wall behind it is sitting out in the cold
> > and never gets a chance to store any of the day's sunshine. Your 06:00 temperature goes from
> > 2.1 °C to 14.2 °C, and you stop needing the stove entirely. Extra cost about ₹1.5 lakh. Saves
> > roughly ₹48,000 of kerosene a year. Pays for itself in about three years."*
>
> Every number in that prose is **read from the structure**, never computed here and never
> hard-coded. Every sentence must be under 200 characters and contain no unfilled placeholder.
>
> Payback is `incrementalCostINR / annualSavingsINR`, reported as **"not recoverable"** rather than
> `Infinity` when annual savings are ≤ 0.
>
> No React. No screen-specific formatting. Return structured data **plus** plain-text sentences;
> T-59's UI renders them.

**Files you may touch.** `packages/optimise/src/recommend.ts`,
`packages/optimise/test/recommend.test.ts`.
**Files you may NOT touch.** `packages/engine/src/types.ts` (define `Recommendation` locally),
`search.ts`, `sweep.ts`, `apps/web/**`.

**Subagent guidance.** Single agent. Straightforward — do not fan out.

**ACCEPTANCE TESTS — the task is NOT done until every one passes:**
1. Given a known winner and baseline, the specification names **every** decision variable that
   differed between them and **none** that did not. Assert both directions. Paste the list.
2. Payback equals `incrementalCostINR / annualSavingsINR` to within 0.1, and is reported as
   **"not recoverable"** — not `Infinity`, not `NaN` — when annual savings are ≤ 0. Paste both cases.
3. **Every economic number is traceable:** the returned object names all four kerosene constants and
   the annualisation method it used. Paste them.
4. **When the winner is in a tie group**, the output says the top designs are statistically
   indistinguishable **and lists them** — it does not name a single winner. Paste the notice text.
5. **The airtightness line always names the ventilation floor**, and when the design has unvented
   combustion it states the combustion allowance (0.70). Paste both variants of the line.
6. Insulation **position** is stated explicitly in the specification (the word "outside" or "inside"
   or "cavity" appears). Paste the line.
7. Running it on the optimised preset reproduces that preset's own specification.
8. Every sentence from `renderTemplateProse` is **under 200 characters** and contains no `{`, `}`,
   `undefined`, `NaN` or `[object`. Assert over all sentences; paste the longest.
9. **Every number appearing in the prose is findable in the `Recommendation` structure** — run the
   same verifier T-58 uses and assert zero unmatched numbers. Paste the count of numbers checked.
10. The output is JSON-serialisable: no functions, no `undefined` values.
11. Material **names** appear, never ids: `grep`-assert that no returned string matches a catalogue
    id pattern.
12. The prose works with **no network, no API key and no AI** — it is a pure function.

**Evidence (fill this in when done — numbers, not adjectives):**
```
```

**Completed by:** ___  **Date:** ___

---

### [ ] T-58 — The AI write-up, its two-stage separation, and the number verifier

**Area:** G — Decision support (≈ `plan.md` §8) · **Status:** NOT STARTED · **Est:** 8 h
**Depends on:** T-42, T-57 · **Conflicts with:** none

**Why this exists.** *"If you ask an AI directly 'what insulation should I use in Ladakh?' you get a
plausible-sounding answer drawn from its training data. It might be right. You have no way to check,
and when a DRDO panel asks 'how do you know?', 'the AI said so' is not an answer."* (`plan.md` §8.)
The two-stage separation is the entire reason the advice can be trusted: **stage 1 is real physics
with no AI; stage 2 is the AI turning a table of numbers into a paragraph a human wants to read.**
The AI is explicitly **not** the thing deciding what is good.

**PROMPT — paste this to start the task:**
> Create `apps/web/app/api/advise/route.ts` and `apps/web/lib/verifyNumbers.ts`.
>
> **The route.** `POST` a `{ recommendation, best, baseline, ties }` payload. It sends the AI **only
> the computed results**: the current design's KPIs, the best alternatives the search found, the
> deltas between them, the material catalogue with its citations, and the `Recommendation` structure
> from T-57. It **never** asks the AI to decide what is good, to estimate a temperature, or to
> reason about physics. The system prompt must say so explicitly and must instruct that **every
> number in the output be taken verbatim from the supplied data.**
>
> **`verifyNumbers.ts` — the enforcement, and the point of the whole task:**
> ```ts
> export function extractNumbers(text: string): { raw: string; value: number }[];
> export function collectAllowedNumbers(payload: unknown): Set<number>;
> export function verifyNumbers(text: string, payload: unknown, tolerance?: number
> ): { ok: boolean; unmatched: { raw: string; value: number }[] };
> ```
> Extract **every** numeral from the generated text — including ones inside currency
> (`₹48,000`), percentages, ranges, and lakh/crore forms. Walk the payload recursively collecting
> every numeric leaf, and **also** every rounded form of each leaf to 0, 1 and 2 decimal places and
> to 2 significant figures, because the AI will legitimately write "about 3 years" for 3.1 and
> "₹48,000" for 47,932. Tolerance defaults to the tighter of `0.5 %` or one unit in the last written
> place. Ordinals and small counts that are obviously structural ("the three changes below") are
> matched against the structure's own lengths.
>
> **If `verifyNumbers` returns `ok: false`, the AI text is REJECTED** and the route returns T-57's
> `renderTemplateProse` output instead, with a flag saying the fallback was used and the list of
> unmatched numbers logged server-side. **Retry once** with the unmatched numbers named in the
> prompt before falling back.
>
> **The ACH floor applies to the text too.** If the generated advice recommends any airtightness
> figure, it must be `>= ACH_MIN` (or `>= 0.70` with unvented combustion). A text recommending a
> lower figure is rejected the same way an unverifiable number is — global rule 10 does not stop at
> the engine boundary.
>
> **No key, no network, AI service down → the template.** The panel must never be dead. Gate the
> whole route on the API key being present; without it, return the template output with a 200 and
> the fallback flag, not an error.

**Files you may touch.** `apps/web/app/api/advise/route.ts`, `apps/web/lib/verifyNumbers.ts`,
`apps/web/test/verify-numbers.test.ts`, `apps/web/test/api-advise.test.ts`.
**Files you may NOT touch.** `packages/optimise/**` (import `renderTemplateProse`, never edit it),
other routes, `packages/engine/**`.

**Subagent guidance.** **Spawn 2 subagents:** one owns `verifyNumbers.ts` and its test exclusively
(it is a pure function with a large, sharply testable surface); the other owns the route, the prompt
construction and the fallback wiring. They share no file. Acceptance tests 1–7 to the first, 8–13 to
the second. **Merge only when both report green and an end-to-end advise call returns verified
text.**

**ACCEPTANCE TESTS — the task is NOT done until every one passes:**
1. `extractNumbers("Your 06:00 temperature goes from 2.1 °C to 14.2 °C")` finds `6`(as `06:00`
   handling — state your rule), `2.1` and `14.2`. Paste the extracted list.
2. `extractNumbers("Saves roughly ₹48,000 a year")` finds `48000`, not `48` and `000`.
3. `extractNumbers("about ₹1.5 lakh")` finds `150000` **or** `1.5` with the lakh multiplier
   recorded — state which and be consistent.
4. `collectAllowedNumbers` on a `Recommendation` includes every leaf **and** its 0/1/2-decimal and
   2-significant-figure roundings. Paste the set size.
5. **A fabricated number is caught:** `verifyNumbers("Your 06:00 temperature reaches 19.7 °C", rec)`
   where the real value is 14.2 returns `ok: false` with `19.7` in `unmatched`. Paste the result.
6. **A legitimately rounded number passes:** text saying "about 3 years" against a payload value of
   `3.1` returns `ok: true`.
7. Text containing **no** numbers returns `ok: true`.
8. **End to end with a key present:** the route returns AI prose in which **every number is
   verifiable**, and `verifyNumbers` on the returned text returns `ok: true`. Paste the prose and
   the count of numbers checked.
9. **A fabricating model is caught and retried, then falls back:** stub the AI to return a
   hallucinated figure. The route retries **once**, then returns the **template** output with the
   fallback flag set. Paste the flag and the logged unmatched list.
10. **No API key:** the route returns **200** with the template output and the fallback flag — not
    a 500, not an empty panel. Paste the status and the first sentence.
11. **AI service unreachable / times out at 15 s:** same behaviour, within 20 s. Paste the elapsed
    time.
12. **The ACH floor applies to text:** a stubbed AI recommending "seal to 0.2 air changes per hour"
    is **rejected** and the template is used. Paste the rejection reason.
13. The route is rate-limited by T-42 and returns 429 over the limit.
14. `grep -rn "ANTHROPIC_API_KEY\|OPENAI" apps/web/components apps/web/workers` returns **0** — the
    key is server-only and never reaches the browser.

**Evidence (fill this in when done — numbers, not adjectives):**
```
```

**Completed by:** ___  **Date:** ___

---

# AREA H — SCENARIOS

> *"A tool that takes four hours per run structurally cannot answer 'what happens during the longest
> sunless streak on record?' You would need three days of computing. Speed is not a convenience here
> — it makes a whole category of question askable for the first time."* (`plan.md` §7.)
> **Every scenario is pulled from the real recorded history of that specific site, not invented.**

---

### [ ] T-59 — The eighteen-scenario matrix, built from real recorded history

**Area:** H — Scenarios (≈ `plan.md` §7) · **Status:** NOT STARTED · **Est:** 8 h
**Depends on:** T-27, T-28 · **Conflicts with:** none

**Why this exists.** *"We do not ask 'how does this design do on a typical day?' We ask 'how does
this design do on every day that matters?'"* This is the strongest thing in the pitch, and it rests
entirely on the eighteen being **looked up in forty-plus years of records**, not guessed.

**PROMPT — paste this to start the task:**
> Create `packages/data/src/scenarios.ts`:
> ```ts
> export interface Scenario {
>   id: string; name: string; nameHi?: string;
>   description: string;                  // plain English, shown in the survival grid
>   kind: 'monthly' | 'coldest' | 'hottest' | 'designWinter' | 'sunlessStreak' | 'clearColdNight';
>   startDayOfYear: number; days: number; // days > 1 only for the sunless streak
>   sourceNote: string;                   // e.g. "coldest 24 h in the 1984-2024 record at this cell"
> }
> export function buildScenarios(series: WeatherSeries, locationId: string): Scenario[];
> export function scenarioWeather(series: WeatherSeries, s: Scenario): WeatherSeries;
> ```
>
> The **eighteen**, all derived from the bundled annual series (and, where a multi-year record is
> available, from that record — say which in `sourceNote`):
>
> 1–12. **Twelve seasonal days** — one representative day per month, chosen as the day whose daily
>    mean temperature and daily GHI total are each closest to that month's mean. This is what makes
>    the annual fuel total honest: **never scale a single January day by 365.**
> 13. **The coldest day on record** — the 24 h window with the lowest mean temperature.
> 14. **The hottest day on record** — because a shelter optimised only for winter can bake in July,
>    and we should catch that.
> 15. **The 1-in-100 design winter day** — the **99th-percentile cold** day, the cold-but-not-freak
>    day engineers conventionally design to. Standard professional practice, and defensible when a
>    judge asks. Compute it as the 1st percentile of daily mean temperature; state the method in
>    `sourceNote`.
> 16. **The longest sunless stretch** — the longest run of consecutive days whose daily GHI total is
>    below a documented overcast threshold, **simulated end to end as one multi-day run**. You watch
>    the shelter bleed heat day after day with no sun to recharge it. **This is the real test of
>    thermal storage** — anyone can build something that works on a sunny day. Set `days` to the
>    actual streak length.
> 17. **The clear cold night** — the **coldest night that was also cloudless**. Counter-intuitively
>    worse than the coldest night overall, because clear skies mean maximum heat radiating away
>    upward. **This is Ladakh's true worst case, and almost nobody tests for it.** Select by the
>    lowest overnight mean temperature among nights whose daytime clearness index `k_t` exceeded a
>    documented clear-sky threshold.
> 18. **The annual-mean day** — the reference against which the other seventeen are read.
>
> Every scenario's `sourceNote` names **how it was selected and from what record**. A scenario whose
> provenance is "we picked it" is a scenario a judge can dismiss.
>
> `scenarioWeather` slices the annual series into the scenario's window, preserving
> `provenance` and appending a note naming the scenario. For the sunless streak it returns the full
> multi-day window, not one day repeated.
>
> Every threshold you choose (overcast GHI, clear-sky `k_t`, percentile) is an **exported named
> constant with a comment** saying what it means and what would justify changing it (global rule 14).

**Files you may touch.** `packages/data/src/scenarios.ts`, `packages/data/test/scenarios.test.ts`.
**Files you may NOT touch.** `packages/data/src/weather/**`, `tmy/**`, `presets.ts`,
`packages/engine/**`.

**Subagent guidance.** Single agent. Eighteen selection rules over one series — one author keeps the
selection criteria mutually consistent, and consistency is what makes the grid comparable.

**ACCEPTANCE TESTS — the task is NOT done until every one passes:**
1. `buildScenarios(lehSeries, 'leh')` returns exactly **18** scenarios with unique ids. Paste the
   list of ids and names.
2. The twelve monthly scenarios cover **all twelve months**, one each. Assert by month.
3. **The coldest day is actually the coldest:** no other 24 h window in the series has a lower mean
   temperature. Assert exhaustively. Paste its date and mean in °C.
4. **The hottest day is actually the hottest**, same assertion. Paste its date and mean.
5. The **1-in-100 design winter day** is at the 1st percentile of daily mean temperature — paste the
   percentile computation, the date and the mean, and confirm it is **warmer** than the coldest day.
6. **The sunless streak has `days > 1`** and is genuinely the longest run below the overcast
   threshold — assert no longer run exists. Paste the length, the start date and the mean daily GHI
   over the streak.
7. **The clear cold night is colder in effective sky terms than the coldest night overall:** its
   daytime clearness index exceeds the clear-sky threshold, and its computed sky temperature at
   03:00 is **lower** than the coldest-day scenario's at the same hour. Paste both sky temperatures.
   *(This is the whole reason the scenario exists — if it is not worse, the selection rule is wrong.)*
8. Every scenario's `sourceNote` is non-empty and names its selection rule and its record.
9. Every threshold constant is exported with a comment naming what would justify changing it. Paste
   the three constants and their comments.
10. `scenarioWeather` returns a `WeatherSeries` whose length matches `days × 24 / (stepSeconds/3600)`
    for every scenario. Assert all eighteen.
11. `scenarioWeather` preserves `provenance` and appends a note naming the scenario.
12. All eighteen `scenarioWeather` outputs pass T-25's validator with zero errors.

**Evidence (fill this in when done — numbers, not adjectives):**
```
```

**Completed by:** ___  **Date:** ___

---

### [ ] T-60 — Run the matrix and shape the survival-grid contract

**Area:** H — Scenarios · **Status:** NOT STARTED · **Est:** 5 h
**Depends on:** T-54, T-59 · **Conflicts with:** none

**Why this exists.** Eighteen scenarios that would take about a second one after another finish in a
fraction of that across cores — and a second user hitting the site during all of it still gets an
instant response. This task is the thin layer that turns eighteen `SimulationRequest`s into the one
data structure T-50's grid and T-39's stream both consume.

**PROMPT — paste this to start the task:**
> Create `packages/optimise/src/scenarios.ts`:
> ```ts
> export interface ScenarioResult {
>   scenario: Scenario;
>   kpis: SimulationKpis;
>   meta: SimulationResult['meta'];
>   band: 'green' | 'amber' | 'red';
>   failed?: { code: EngineErrorCode; message: string };
> }
> export async function runScenarioMatrix(
>   base: SimulationRequest, scenarios: Scenario[], series: WeatherSeries,
>   runner: Runner, onProgress?: (done: number, total: number) => void, signal?: AbortSignal,
> ): Promise<ScenarioResult[]>;
> export function annualTotals(results: ScenarioResult[]): {
>   auxKWhPerYear: number; keroseneLitresPerYear: number;
>   co2KgPerYear: number; costINRPerYear: number; method: string;
> };
> ```
>
> Banding thresholds, from `BLUEPRINT.md` Appendix C — **do not invent others**:
> **green** `tempAt0600 >= 288.15 K` (15 °C, minimum acceptable);
> **amber** `278.15 K <= tempAt0600 < 288.15 K` (5–15 °C, survivable but uncomfortable);
> **red** `tempAt0600 < 278.15 K` (below the 5 °C survival threshold for pipes and health).
>
> **`annualTotals` implements the honest annualisation and nothing else.** Take the **twelve monthly
> representative days**, weight each by the number of days in its month, and sum.
> **Never scale a single January day by 365.** Write the method string —
> `"12 monthly representative days, TMY-weighted"` — into the returned `method` and into
> `meta.annualisationMethod`, so the UI can display it. If fewer than twelve monthly results are
> present, still return a number but set the method to
> `"single-day extrapolation -- INDICATIVE ONLY"` and say so.
> `AUDIT.md` records annualised KPIs being presented to three significant figures with the scaling
> method unstated. This is that fix.
>
> A scenario that throws is captured into `failed` and **still returns a row** — a missing row in the
> survival grid is indistinguishable from a scenario nobody ran.
>
> Uses the injected `runner`, same as T-54. No worker pool of its own.

**Files you may touch.** `packages/optimise/src/scenarios.ts`,
`packages/optimise/test/scenarios.test.ts`.
**Files you may NOT touch.** `sweep.ts`, `search.ts`, `recommend.ts`, `packages/data/**`,
`packages/engine/**`.

**Subagent guidance.** Single agent. Straightforward — do not fan out.

**ACCEPTANCE TESTS — the task is NOT done until every one passes:**
1. `runScenarioMatrix` returns **18** `ScenarioResult`s for the Leh presets. Paste the count.
2. **All eighteen complete in under 3 seconds** with a concurrent runner (`plan.md` build order
   phase 4). Paste the wall-clock time and the runner concurrency.
3. Every result has `meta.energyBalanceResidual < 1e-3`. Paste the maximum across all eighteen.
4. Banding is exact at the boundaries: `288.15 K` → green, `288.14 K` → amber, `278.15 K` → amber,
   `278.14 K` → red. Paste all four.
5. `onProgress` fires 18 times, monotonically, ending at `done === total === 18`.
6. **A failing scenario still returns a row** with `failed` populated and does not abort the other
   seventeen. Inject a failure and paste the row count (must still be 18).
7. **`annualTotals` uses the twelve monthly days weighted by days-in-month**, and its result differs
   from a naive `January × 365` by **more than 10 %** — proof the method is actually different.
   Paste both numbers and the percentage difference.
8. `method` reads `"12 monthly representative days, TMY-weighted"` when twelve are present, and the
   `INDICATIVE ONLY` string when they are not. Paste both.
9. Kerosene litres, CO₂ kg and INR are **exactly** the documented conversion applied to the annual
   kWh — recomputable by hand from the constants in §7.9. Paste the hand computation alongside.
10. **The sunless-streak scenario shows monotonic decline:** its `tempAt0600` on the final day is
    **lower** than on the first day. Paste the per-day series. *(If it does not decline, either the
    multi-day run is restarting each day or the storage physics is wrong — report which.)*
11. **The clear cold night scores worse than the coldest day** on `tempAt0600`. Paste both.
    This is the counter-intuitive result almost nobody tests for.
12. Cancelling mid-matrix stops within one scenario's runtime.

**Evidence (fill this in when done — numbers, not adjectives):**
```
```

**Completed by:** ___  **Date:** ___

---

### [ ] T-61 — Multi-day runs and the sunless-streak path

**Area:** H — Scenarios · **Status:** NOT STARTED · **Est:** 5 h
**Depends on:** T-59 · **Conflicts with:** T-11, T-16 (touches the integrator's day loop)

**Why this exists.** Seventeen of the eighteen scenarios are single days. The eighteenth is not, and
it is **the real test of thermal storage**. `SimOptions.simulationDays` exists on disk but the
multi-day path has never been exercised against a real multi-day weather window — the spin-up loop
repeats *one design day*, which is correct for a periodic scenario and **wrong** for a streak where
each day's weather differs and the building must be allowed to run down.

**PROMPT — paste this to start the task:**
> Verify and, where needed, fix the multi-day path in `packages/engine/src/solve/integrator.ts` and
> `packages/engine/src/index.ts`.
>
> The required behaviour:
> - **Spin-up** converges on the **first** day of the window (repeating it until the day-over-day
>   maximum node change is below `spinUpToleranceK`), establishing a physically plausible starting
>   state. It must **not** repeat-and-converge the whole multi-day window, which would erase the
>   run-down the scenario exists to show.
> - **The reported period** then marches through all `simulationDays` of **actual, differing**
>   weather, with no re-initialisation between days.
> - `meta.timesteps` and `time` cover the whole window; `kpis.tempAt0600` reports the **final**
>   day's 06:00 value, and a new optional `kpis.tempAt0600PerDay: number[]` reports each day's, so
>   T-50 can show the decline. **This is the one `types.ts` addition this task may make.**
> - The weather series supplied must be at least as long as the window; a shorter one throws
>   `EngineError('WEATHER_INVALID')` naming the shortfall, rather than wrapping around silently. A
>   silent wrap would make a 9-day streak look like the same day nine times, which is precisely the
>   wrong answer with a convincing shape.
>
> Add `packages/engine/test/multiday.test.ts`.
>
> **Change as little as possible.** The single-day path is exercised by 65 green tests and is the
> demo path; if your change alters a single-day result by more than 1e-9, revert and rethink.

**Files you may touch.** `packages/engine/src/solve/integrator.ts` and
`packages/engine/src/index.ts` (multi-day path only), the one `tempAt0600PerDay` field in
`types.ts`, `packages/engine/test/multiday.test.ts`.
**Files you may NOT touch.** `solve/assemble.ts`, `post/**`, `loads/**`, `surfaces/**`, `solar/**`,
`envelope/**`.

**Subagent guidance.** Single agent. A surgical change inside the most load-bearing file in the
project.

**ACCEPTANCE TESTS — the task is NOT done until every one passes:**
1. **No regression:** `npx vitest run` exits 0 and every single-day result is **unchanged to 1e-9**
   from before this task. Paste the comparison for `shelterA_stone400`'s `tempAt0600`.
2. A 9-day run over 9 **differing** weather days produces 9 distinct daily `tempAt0600` values —
   assert they are not all equal. Paste the series.
3. `meta.timesteps` equals `9 × 86400 / timestepSeconds`. Paste both.
4. `time` spans the full window, monotonically increasing, starting at 0.
5. **Spin-up converges on the first day only:** `meta.spinUpDaysUsed` is reported, and the state at
   the start of the reported window matches the converged first-day state to within
   `spinUpToleranceK`. Paste both.
6. **The run-down is real:** for the Leh sunless-streak window, `tempAt0600PerDay` **declines**
   across the streak for a heavy shelter, and declines **faster** for a light one. Paste both series.
7. **A shorter weather series throws** `EngineError('WEATHER_INVALID')` naming the shortfall — it
   does **not** wrap around. Paste the message.
8. `meta.energyBalanceResidual < 1e-3` over the whole 9-day window. Paste it.
9. A 9-day run is between 8× and 10× the wall-clock of a 1-day run (linear, no accidental quadratic).
   Paste both times and the ratio.
10. `kpis.tempAt0600` equals `tempAt0600PerDay[last]`.
11. The diff to `integrator.ts` is **under 60 lines**. Paste `git diff --stat`.

**Evidence (fill this in when done — numbers, not adjectives):**
```
```

**Completed by:** ___  **Date:** ___

---

# AREA I — VALIDATION & CREDIBILITY

> *"Every team will demo a chart. Almost none will hand the judges a validation report. That
> asymmetry is the strongest differentiator and it costs nothing but discipline."*
> **Global rule 9 applies to everything in this area: no claim without a number and a named test,
> and no ANSYS claim anywhere, ever.**

---

### [ ] T-62 — The continuous energy-balance audit in CI

**Area:** I — Validation (≈ W-23 / `CHALLENGE.md` C-09) · **Status:** NOT STARTED · **Est:** 3 h
**Depends on:** T-04, T-28, T-59 · **Conflicts with:** T-07 (imports fixtures, never edits them)

**Why this exists.** *"This is the highest-value test in the entire suite relative to its cost. It
requires no external tool, no licence, no reference data, and it catches an entire class of errors —
a dropped term, a sign flip, a double-counted surface, an area computed wrong. It is also directly
demonstrable to a judge: 'here is our conservation residual across every run, it is under 0.1 %.'"*
`CHALLENGE.md` C-09 is explicit that it must be **runnable executable code**, not a claim in prose.

**PROMPT — paste this to start the task:**
> Extend `scripts/ci-energy-balance.mjs` (T-04 created it) to cover **every** case the project now
> has, and wire it as a blocking CI step.
>
> Coverage: both `fixtures.ts` shelters; **all six presets** from T-28; **all eighteen scenarios**
> from T-59 for the Leh presets; a PCM-bearing case (T-19/T-20); a storage-element case; and a
> **night-only reporting window** (18:00–06:00, where solar gain is zero) — that last one is the
> degenerate case `E_in` normalisation fails and `E_gross` fixes, and it is the reason §7.4 chose
> `E_gross`.
>
> For each case print `<name>: residual <value>` and finish with `MAX RESIDUAL: <value>`. Exit
> non-zero if any residual is `>= 1e-3`.
>
> Add three **negative controls**, each as a commented-out block with its measured result recorded
> beside it, so the test's sensitivity is documented rather than assumed:
> (a) including `Q5` in the boundary set; (b) dropping `Q4`; (c) flipping the sign of `Q9`.
> Each must push the residual above **0.01**. A conservation test that cannot fail proves nothing.
>
> Also emit `packages/engine/test/output/energy-balance.csv` with columns
> `case,residual,netBoundaryJ,deltaStoredJ,throughputJ`, committed, for T-63 to quote directly.
>
> **Write tests and a script only.** If a case fails, that is a defect in the owning module — report
> it by task id in your Evidence and set this task `[!]` (global rule 16).

**Files you may touch.** `scripts/ci-energy-balance.mjs`, `.github/workflows/ci.yml` (the one step),
`packages/engine/test/output/energy-balance.csv`.
**Files you may NOT touch.** Anything under `packages/engine/src`. `fixtures.ts`, `helpers.ts`.

**Subagent guidance.** Single agent. Straightforward — do not fan out.

**ACCEPTANCE TESTS — the task is NOT done until every one passes:**
1. The script covers **at least 28** cases (2 fixtures + 6 presets + 18 scenarios + PCM + storage +
   night window). Paste the case count and the list.
2. **Every** residual is `< 1e-3`. Paste `MAX RESIDUAL` and the case it came from.
3. **The night-only window** (18:00–06:00, zero solar) produces a finite residual under 1e-3. Paste
   it. *(This is the case an `E_in` normalisation divides by ~zero on.)*
4. The PCM case passes — proving `ΔStored` is being integrated through the apparent heat capacity
   and not approximated as `C·ΔT`. Paste it.
5. **Negative control (a):** including `Q5` in the boundary set pushes the residual above **0.01**.
   Paste the value. Revert.
6. **Negative control (b):** dropping `Q4` pushes it above 0.01. Paste the value. Revert.
7. **Negative control (c):** flipping the sign of `Q9` pushes it above 0.01. Paste the value. Revert.
8. The script exits **non-zero** in each negative-control state and **zero** in the clean state.
9. `energy-balance.csv` exists, is committed, and has one row per case with the four energy columns.
10. `netBoundaryJ − deltaStoredJ` equals `residual × throughputJ` to 1e-9 for every row — the
    arithmetic is self-consistent.
11. The CI workflow fails the build when the script exits non-zero. Demonstrate on a branch.
12. The whole script completes in under **60 s**. Paste the time.

**Evidence (fill this in when done — numbers, not adjectives):**
```
```

**Completed by:** ___  **Date:** ___

---

### [ ] T-63 — `VALIDATION.md`

**Area:** I — Validation (≈ W-49) · **Status:** NOT STARTED · **Est:** 8 h
**Depends on:** T-23, T-62 · **Conflicts with:** T-69 (which quotes it but never edits it)

**Why this exists.** **The document almost no other team will hand the judges** — and the removal of
the one sentence in the plan that could end the demo. `AUDIT.md` F-2 calls
*"We did [compare against ANSYS]. We match it"* **the single most dangerous sentence in the plan**,
because no procedure in this project generates that evidence. This task deletes it and replaces it
with what is actually true, which is stronger: *"for simple cases, heat transfer has exact
mathematical answers, and we check our engine against those. That is stronger evidence than matching
another piece of software, because the formula cannot itself be buggy."*

**PROMPT — paste this to start the task:**
> Create `VALIDATION.md` at `/home/abhinav/Downloads/SIH/shelter-sim/VALIDATION.md`.
>
> One section per validation test, **1 through 10**, each stating: the setup, the analytical or
> reference value, the computed value, the deviation, and a **pass/fail**. **Every number lifted
> from an actual committed test run** — from `packages/engine/test/output/validation-numbers.csv`
> (T-23) and `energy-balance.csv` (T-62). **None aspirational.** A test that has not been run gets a
> section saying so explicitly, not an optimistic sentence.
>
> Current state to write up honestly (verified in this ledger's §10):
> Tests **1, 2, 3, 4, 6, 7, 8 — GREEN**, with their measured pairs.
> Test **5 — GREEN once T-23 lands**, with the NOAA comparison; say "analytical anchors only" if it
> has not.
> Test **9 (published Ladakh field data) — NOT RUN**, say so plainly.
> Test **10 (ASHRAE 140 / BESTEST) — NOT RUN**, say so plainly.
> Test **EnergyPlus (T-65) — NOT RUN** unless it has landed, in which case quote its number.
>
> **Lead with Test 2** — the sinusoidal decrement and lag — because it is exact, already verified,
> and the strongest thing in the document. Quote the 300 mm dense-concrete anchor: measured
> decrement versus analytical 0.137, measured lag versus analytical 7.6 h. That is the number the
> deck quotes.
>
> Include T-61's mesh- and timestep-independence convergence data as a table (a convergence study is
> a standard, expected artefact in any numerical modelling report, and including one signals that
> the team knows what rigour looks like).
>
> Include the **limitations** section in the same voice as T-52's panel — deliberate choices with
> their consequences named, not apologies.
>
> **Delete every ANSYS claim.** `grep -ri "ansys"` across the repository must return either nothing
> or only text explaining why ANSYS was **not** used and what was used instead.
>
> Documentation only — **no code**. Do not edit `BLUEPRINT.md`, `CHALLENGE.md`, `AUDIT.md`,
> `TASK.md`, `plan.md` or `ENGINE_BLUEPRINT.md`; they are historical records.
> **Do not state a claim without a number.**

**Files you may touch.** `VALIDATION.md` (create).
**Files you may NOT touch.** Any source file. Any other `.md` except appending to `README.md`.

**Subagent guidance.** Single agent. It is one document whose entire value is a single consistent
voice and a single standard of evidence.

**ACCEPTANCE TESTS — the task is NOT done until every one passes:**
1. **Every validation claim names a specific test, a specific case and a specific number.** Grep for
   sentences containing "validated", "verified", "matches" or "accurate" and assert each is within
   two lines of a numeral. Paste any that are not — there must be none.
2. `grep -ri "ansys" /home/abhinav/Downloads/SIH/shelter-sim` returns either nothing or **only**
   text explaining why ANSYS was not used. Paste every hit.
3. Every test 1–10 has a section, **including the ones not run, which say so explicitly**. Paste the
   ten section headings and their stated states.
4. Test 2's section quotes the 300 mm dense-concrete measured decrement and lag against the
   analytical 0.137 / 7.6 h, with the deviation. Paste the four numbers.
5. Test 6's section quotes `MAX RESIDUAL` from `energy-balance.csv` and the case count. Paste both.
6. The convergence table from the mesh/timestep independence study is present with at least four
   refinement levels in each direction.
7. The limitations section names **at least the seven items** from T-52 acceptance test 3.
8. `grep -ri "well-stratified" VALIDATION.md` returns **0** — the argument requires **well-mixed**.
9. Every number in the document is traceable to a committed CSV or a named test. Spot-check five and
   paste the trace for each.
10. A reader with **no access to the code** can tell exactly what was verified and what was not.
    Verify by having someone who has not read the source read it and state which tests are green.
11. The document states the measured performance (`ms/run` and sweep seconds) with the machine it
    was measured on.

**Evidence (fill this in when done — numbers, not adjectives):**
```
```

**Completed by:** ___  **Date:** ___

---

### [ ] T-64 — `EQUATIONS.md` and the limitations list

**Area:** I — Validation (≈ W-49) · **Status:** NOT STARTED · **Est:** 6 h
**Depends on:** T-18, T-19, T-22 · **Conflicts with:** T-63 (adjacent document, no shared file)

**Why this exists.** *"Every input has a documented, citable source. This is not bureaucracy — it is
the difference between an engineering submission and a demo."* And `CHALLENGE.md` C-20: **a
simplification volunteered is engineering judgement; the same one discovered by an evaluator is a
gap.** This document is where every shortcut in the engine is volunteered, in writing, with its
ceiling and its upgrade path.

**PROMPT — paste this to start the task:**
> Create `EQUATIONS.md` at the repository root.
>
> **Every governing equation** in the engine, with: its name, its symbols and their units, its
> literature citation, the `BLUEPRINT.md` / `ENGINE_BLUEPRINT.md` section it came from, the file and
> function that implements it, and **the simplification taken at each step with its ceiling named**.
>
> Cover, at minimum, everything restated in `LOG.md` §7.10: the ISA barometric formula and ideal-gas
> density; solar declination, equation of time, solar time, altitude, azimuth and incidence; the
> Erbs decomposition with its three branches; Liu & Jordan isotropic and HDKR transposition; the
> harmonic interface conductance and the diurnal penetration depth; the semi-infinite periodic
> decrement and lag; exterior convection (**and why it is not McAdams**); Swinbank and the measured
> `LW_down` inversion; the sky view factor; the linearised radiative coefficients; the
> direction-dependent interior convection table (**and why the combined 8.3 scheme was discarded**);
> the mean-radiant star node (ISO 13790 5R1C); the IAM and shutter-resistance window relations;
> infiltration mass flow and the ACH floor; Kusuda–Achenbach; the apparent-heat-capacity PCM
> formulation; backward Euler; and the energy-balance residual with its BOUNDARY and INTERNAL sets.
>
> **Named simplifications that must each appear with their ceiling and upgrade path:**
> single well-mixed air node (no stratification — upgrade: two-zone for Trombe only);
> uniform surface temperatures; **beam-only shading** (T-18's documented ceiling);
> the star-node radiation approximation instead of a view-factor matrix;
> lumped thermal-bridge factor instead of 3-D corner conduction;
> no moisture transport (a surface condensation *check* only);
> simplified wind (no pressure-driven infiltration network);
> coefficients frozen per weather-hour (§7.10 — with the measured error);
> the `M = 4` air-capacitance multiplier;
> `ACH_PER_GLAZING_FRACTION` as an empirical coupling.
>
> Also correct, wherever the wording is reused anywhere in the repository, the
> `BLUEPRINT.md` 1.4 slip that argues for the single-air-node assumption by calling the air
> **"well-stratified"**. The argument requires **well-mixed**, which is the opposite. Do not edit
> `BLUEPRINT.md` itself — it is a historical record — but never reuse the wrong word.
>
> Documentation only. No code.

**Files you may touch.** `EQUATIONS.md` (create).
**Files you may NOT touch.** `VALIDATION.md` (T-63 owns it). Any source file. Any historical `.md`.

**Subagent guidance.** **Spawn 3 subagents:** one covers solar (geometry, decomposition,
transposition, shading); one covers the envelope and surfaces (meshing, conduction, exterior,
interior, windows); one covers loads, storage, numerics and the residual. Each writes its own
section file; you concatenate. They share no file. Acceptance tests 2, 3 and 4 split between them by
subject. **Merge only when all three report green and the concatenated document passes tests 1 and
5–10.**

**ACCEPTANCE TESTS — the task is NOT done until every one passes:**
1. **Every equation carries a citation and a source-section reference.** Assert mechanically: every
   `##` section contains both a citation line and a `file:function` line. Paste any section missing
   one — there must be none.
2. Every function exported from `packages/engine/src/solar/`, `surfaces/`, `loads/`, `envelope/`,
   `storage/` and `solve/` appears in the document. Diff the export list against the document's
   `file:function` lines and paste the diff — it must be empty.
3. Every constant in `packages/engine/src/constants.ts` appears with its value and units.
4. **All ten named simplifications appear, each with its ceiling AND its upgrade path.** Paste the
   ten with their ceilings.
5. `grep -ri "well-stratified" /home/abhinav/Downloads/SIH/shelter-sim --include=*.md
   --include=*.ts` returns **0** outside the historical `BLUEPRINT.md`.
6. The symbol glossary defines every symbol used, with its unit.
7. Every `// SIMPLIFICATION:` comment in `packages/engine/src` has a corresponding entry here.
   Assert by grepping the source for the marker and matching each against the document.
8. The document states the sign convention (§7.2) and the residual definition (§7.4) verbatim.
9. Spot-check three equations against their implementations and confirm the document matches the
   code, not the blueprint, where the two differ. Paste the three.
10. No claim in the document lacks a citation. Grep for "we use", "we assume", "we model" and assert
    each is within two lines of a citation.

**Evidence (fill this in when done — numbers, not adjectives):**
```
```

**Completed by:** ___  **Date:** ___

---

### [ ] T-65 — One EnergyPlus reference case (needs a human owner)

**Area:** I — Validation (≈ W-48) · **Status:** NOT STARTED · **Est:** 16 h + a human decision
**Depends on:** T-27, T-62, **plus a named human owner** · **Conflicts with:** none

**Why this exists.** `CHALLENGE.md` C-11 and K-02 are the **kill-shot**: *"Show me a case where you
compared this against something other than yourselves."* This is the single most likely question to
be fatal and the single most valuable one to have prepared for. **The constraint "we have no ANSYS
licence" is false as a barrier to validation** — EnergyPlus is free, open source, DOE-developed, and
accepted by exactly the kind of engineer judging this.

**PROMPT — paste this to start the task:**
> ⚠ **This task requires a human decision first: who installs EnergyPlus and obtains an EPW for
> Leh.** Do not start it without that owner named.
>
> Build a **single-zone** EnergyPlus model matching one of the `fixtures.ts` shelters as closely as
> the two model classes permit: same geometry, same constructions, same weather, same infiltration,
> **no HVAC beyond ideal loads**. Run **72 h**. Compare against this engine on identical inputs:
> indoor air temperature (**RMSE**) and daily heating energy (**percentage difference**).
>
> **Record every deviation and its likely cause.** Commit the IDF, the EPW reference and a
> comparison script under `packages/engine/test/validation/energyplus/`, so the run is reproducible
> from committed files.
>
> **If the deviation is large, report it honestly with an explanation attempt.** An unexplained match
> is worth less than an explained mismatch, and a fabricated match is fatal. List explicitly every
> input difference between the two models that could not be eliminated — different conduction
> transfer function, different interior convection algorithm, different sky model, different ground
> boundary. That list is itself the useful engineering content.
>
> **Do not attempt BESTEST here.** It needs an 8,760 h run against its own prescribed weather file,
> which cuts across the bundle-Leh-only strategy; if it is ever attempted, its weather file is a
> **test fixture under `test/`, never a shipped asset** in `packages/data/tmy/`.
>
> **Do not make any ANSYS claim.** There is no ANSYS run and no plan that produces one (global rule
> 9).
>
> Hand the resulting numbers to T-63 as Test-9 content; **do not edit `VALIDATION.md` yourself.**

**Files you may touch.** `packages/engine/test/validation/energyplus/**`.
**Files you may NOT touch.** `VALIDATION.md`, `EQUATIONS.md`, any engine source, any other test.

**Subagent guidance.** Single agent plus a human. The bottleneck is the EnergyPlus installation and
the model translation, neither of which parallelises.

**ACCEPTANCE TESTS — the task is NOT done until every one passes:**
1. Indoor-air **RMSE** over 72 h is computed and reported as a number, **whatever it is**. Paste it
   in K.
2. Daily heating energy difference is computed and reported as a **percentage**. Paste it.
3. `VALIDATION.md` (T-63) can state *"we track EnergyPlus within **X %** on case **Y**"* with X and
   Y actually filled in from this run. Paste the sentence.
4. **Every input difference** between the two models that could not be eliminated is listed
   explicitly. Paste the list.
5. The IDF, the EPW and the comparison script are committed, and the run is reproducible from the
   committed files by someone who was not there. Paste the reproduction command.
6. **If the deviation is large, it is reported honestly with an explanation attempt** — the task is
   still done. A hidden or fudged deviation means the task is **not** done regardless of the number.
7. `grep -ri "ansys" /home/abhinav/Downloads/SIH/shelter-sim` returns nothing that claims a
   comparison.
8. The BESTEST weather file, if present at all, exists **only** under `test/`, and the shipped
   bundle size is unchanged. Paste both bundle sizes.
9. The comparison script exits 0 and prints both metrics.

**Evidence (fill this in when done — numbers, not adjectives):**
```
```

**Completed by:** ___  **Date:** ___

---

# AREA J — DELIVERY

---

### [ ] T-66 — Offline: the PWA and a network-free static build

**Area:** J — Delivery (≈ W-36) · **Status:** NOT STARTED · **Est:** 8 h
**Depends on:** T-27, T-36, T-43 · **Conflicts with:** none

**Why this exists.** *"Demo-day Wi-Fi fails. Ladakh has no connectivity at all in many places."*
And the subtlety `AUDIT.md` caught that most teams miss: **a PWA requires an initial online load to
install its service worker** — so "cold start, no network, unfamiliar machine, ten minutes before
presenting" is exactly the scenario a service worker alone **cannot** survive. Two mechanisms are
required, not one.

**PROMPT — paste this to start the task:**
> **(a) The PWA** — the field-deployment story. `apps/web/public/manifest.webmanifest`, a service
> worker pre-caching the app shell **and all five TMY files**, and an install prompt.
>
> **(b) A static export** — the demo-day story. A build script producing a **self-contained
> directory** that runs from `npx serve` or a local file server with **no install, no build step and
> no network**, shipped on a USB stick. This is the mechanism that survives an unfamiliar machine.
> **Consequence, and it is binding: no demo-path feature may require an API route.** Every Area E
> route is an enhancement; with `app/api/` deleted the static build must still produce a full
> result via T-43's local worker on T-27's bundled TMY.
>
> **The offline behaviour must be honest, not silent.** With no server: run the main scenario
> locally, show the temperature curve, the heat-flow breakdown and the 3D model, and display
> *"Offline — showing 1 scenario, AI advice unavailable."* (T-52 owns the banner; you make the
> condition true.) It does **not** silently pretend to be fully functional, and it does **not**
> show a blank panel where the advice would be — the template write-up (T-57) still fills it.
>
> **The app opens on a loaded preset**, so the first screen shows a result rather than an empty form
> (`CHALLENGE.md` C-19 calls the empty first screen an underrated failure).
>
> Document both mechanisms in the root `README.md` under `Before the demo`, next to T-35's
> `check-db-off.mjs`.
>
> No new UI components. Do not make any feature depend on service-worker installation.
> Do not edit `page.tsx`.

**Files you may touch.** `apps/web/public/**`, `apps/web/next.config.*` (export config only),
`apps/web/scripts/build-static.mjs`, the `Before the demo` section of the root `README.md`.
**Files you may NOT touch.** `app/page.tsx`, `lib/store.ts`, any component directory,
`app/api/**`.

**Subagent guidance.** Single agent. The two mechanisms share the same asset manifest and the same
offline condition; splitting them produces two different ideas of what "offline" means.

**ACCEPTANCE TESTS — the task is NOT done until every one passes:**
1. **The C-19 cold-start test, run literally:** copy the static export to a machine that has never
   seen the project, **disconnect the network**, open it — a Leh result renders within **5 seconds**
   with no install, no build step and **no console error**. Paste the elapsed time, the rendered
   `tempAt0600` in °C, and the console output (must be empty).
2. Second load with the network still off, **via the PWA path**, works after one online install.
   Paste both load times.
3. **The first screen shows a preset result, not an empty form.** State exactly what is on screen.
4. Blocking the network for a full session produces **zero failed requests** in the network panel.
   Paste the request count and the failure count.
5. **Deleting `apps/web/app/api/` entirely still leaves `npm run build --workspace apps/web`
   succeeding and the app producing a full result.** Paste the build exit code and the resulting
   `tempAt0600`.
6. The static export directory contains **all five TMY files** and **no absolute URLs to a dev
   server**. Paste the file list and the result of
   `grep -rc "localhost\|127.0.0.1" <export dir>` (must be 0).
7. Total transferred size on first load is **under 12 MB**. Paste the measured size.
8. Lighthouse's installability check passes for the PWA path. Paste the score.
9. Offline, the advice panel shows the **template** write-up, not a blank panel and not an error.
   Paste its first sentence.
10. Offline, the banner reads *"Offline — showing 1 scenario, AI advice unavailable."* verbatim.
11. Offline, the survival grid shows one row with its explanatory note (T-50), not eighteen blanks.
12. The service worker does not serve a stale build after a redeploy — verify the cache-busting.

**Evidence (fill this in when done — numbers, not adjectives):**
```
```

**Completed by:** ___  **Date:** ___

---

### [ ] T-67 — Deployment

**Area:** J — Delivery · **Status:** NOT STARTED · **Est:** 5 h
**Depends on:** T-29, T-42, T-66 · **Conflicts with:** none

**Why this exists.** The database tier of Deviation D-1 needs somewhere to live, and the deployed
build must prove — in production, not in a test — that it still works when that tier is switched
off. A deployment that only works with the database up would quietly undo the whole DB-off
guarantee.

**PROMPT — paste this to start the task:**
> Deploy `apps/web` to a Node-capable host (Vercel or equivalent) with a managed PostgreSQL
> instance.
>
> 1. **Environment.** Set only `DATABASE_URL` and `DATABASE_PROVIDER=postgresql` in production.
>    Every other variable in §7.16 stays unset by default — **the application must run with none of
>    them set**, and live weather stays off unless someone deliberately enables it.
> 2. **Migrations run on deploy** via `db:migrate:deploy`, never `migrate dev`. **Never edit a
>    committed migration**; a schema change is always a new one.
> 3. **Seed** the material catalogue as a one-shot post-deploy step (T-34's `db:seed`, which is
>    idempotent).
> 4. **Health endpoint** `apps/web/app/api/health/route.ts` returning
>    `{ ok: true, engineVersion, db: 'up'|'down', tmyLocations: n }` — and returning **200 with
>    `db: 'down'`**, never 503, because a down database is a degraded cache, not a down application.
>    That status code is the whole design stated in one line.
> 5. Document in the root `README.md`: how to deploy, how to run locally with SQLite, how to run
>    locally with **no database at all**, and how to produce the USB static build from T-66.
> 6. **Do not add** analytics, telemetry, error reporting to a third party, or any auth (global rule
>    19). No secret exists in this project except `DATABASE_URL` and the optional AI key.

**Files you may touch.** `apps/web/app/api/health/route.ts`, deployment config files,
the root `README.md`.
**Files you may NOT touch.** `prisma/schema.prisma`, any committed migration, `lib/repo/*`,
any component, anything under `packages/`.

**Subagent guidance.** Single agent. Straightforward — do not fan out.

**ACCEPTANCE TESTS — the task is NOT done until every one passes:**
1. A clean deploy from a fresh clone succeeds: migrations apply, seed runs, the app serves. Paste
   the deploy log's final line and the total time.
2. `GET /api/health` returns **200** with `db: 'up'`, the engine version, and the TMY location
   count. Paste the body.
3. **Stop the database.** `GET /api/health` returns **200** with `db: 'down'` — **not 503**. Paste
   the body.
4. **With the database stopped, the deployed app still loads a preset, runs a simulation and renders
   results.** Paste the rendered `tempAt0600` in °C and the page load time. This is the production
   proof of global rule 18.
5. With the database stopped, the material dropdown still lists the full catalogue (T-34's code
   fallback). Paste the item count.
6. With the database stopped, the share button is hidden or disabled with the download-instead
   explanation (T-41's `SHARE_UNAVAILABLE` message). Paste the message shown.
7. Re-running the deploy applies **no** new migration and the seed is idempotent — row count
   unchanged. Paste both counts.
8. `NEXT_PUBLIC_ENABLE_LIVE_WEATHER` unset in production → `/api/weather` returns **501** and the
   fetch UI is not offered. Paste the status.
9. No analytics, telemetry or third-party error reporter is present:
   `grep -rn "analytics\|telemetry\|sentry\|gtag\|mixpanel" apps/web` returns **0**.
10. `grep -rn "auth\|session\|jwt\|passport\|nextauth" apps/web --include=*.ts --include=*.tsx`
    returns **0** (global rule 19).
11. The root `README.md` documents all four run modes (deployed, local + Postgres, local + SQLite,
    local + no database) and the USB static build.
12. The USB static build from T-66 still works, unchanged by this deployment. Paste its cold-start
    time.

**Evidence (fill this in when done — numbers, not adjectives):**
```
```

**Completed by:** ___  **Date:** ___

---

### [ ] T-68 — The demo script and hostile-question preparation

**Area:** J — Delivery (≈ W-54) · **Status:** NOT STARTED · **Est:** 6 h + rehearsal
**Depends on:** T-63, T-66 · **Conflicts with:** none

**Why this exists.** *"Survive the first gate, and survive the room."* Tiers 1–4 of `CHALLENGE.md`
ask whether the work is sound; Tier 5 asks whether it **survives an expert in the room**. Each of the
five kill-shot questions is one a DRDO evaluator can plausibly ask, and each must have an answer that
does not end the demo.

**PROMPT — paste this to start the task:**
> Create `DEMO.md` at the repository root: a timed run-of-show plus the prepared answers.
>
> **The run of show.** Open on a **loaded preset showing a result**, never on an empty form. Then:
> click a wall → change the material → watch the model recolour and the curve move (this is the
> 150 ms live-recompute moment); press Simulate → **the day/night animation plays while the eighteen
> scenarios stream in**; read the temperature curve with the **6 AM label**; the solar bars showing
> the south wall towering over the north; the **Sankey** — point at the widest outgoing stream and
> say *"that's your problem"*; the survival grid with its red rows; and end on the
> **recommendation**: *"build this, it costs ₹X more and saves ₹Y a year."*
>
> **The five prepared answers**, each traceable to a test or a document in this repository:
>
> - **K-01 "What is your sky temperature model?"** → Swinbank, `T_sky = 0.0552 · T_amb^1.5`;
>   at Leh with ambient 258 K the sky sits at **228.7 K — 29 K below ambient**; a measured
>   `LW_down` path is preferred when NASA POWER supplies it. Show the test
>   *"a clear Ladakh night sky sits far below air temperature"* and the one next to it,
>   *"removing sky radiation makes the shelter measurably warmer at dawn."*
> - **K-02 "Show me a case where you compared this against something other than yourselves."** →
>   **Lead with the analytical decrement-and-lag test.** A closed-form solution cannot itself be
>   buggy, which makes it *stronger* evidence than matching another program. Quote the 300 mm
>   dense-concrete numbers from `VALIDATION.md`. Add EnergyPlus **only if T-65 produced a number**.
>   ⚠ **Never mention matching ANSYS.** There is no ANSYS run.
> - **K-03 "Your night curve — why isn't that just exponential decay?"** → Because the capacitance
>   is **distributed through the wall thickness**, not lumped in the air. Show the two fixture
>   curves side by side: the stone shelter's delayed inflection against the steel+PUF's plain
>   exponential. The graph answers the question by itself.
> - **K-04 "What happens at 3,500 m that doesn't happen at sea level?"** → Four things:
>   lower air density into **both** convection coefficients (`sqrt(0.65) = 0.806`, mandatory not
>   optional); stronger clear-sky radiative cooling; a higher beam fraction; and **snow albedo up to
>   0.75**, which quadruples the ground-reflected component on a vertical south wall. Show the
>   altitude test and the snow-albedo comparison.
> - **K-05 "I make the window bigger. Does it get better or worse?"** → **"Better, then worse — and
>   here is the optimum."** Show it **live** from the sweep curve (T-21 / T-56). One sentence that
>   demonstrates gain physics and loss physics at once.
>
> **Also prepare the cut list, proactively.** `AUDIT.md` C-20 notes the binding cut list never
> reached the deck and the only stated limitation appeared reactively inside hostile-question prep —
> which is the weak position. Volunteer it: no CFD, no ray-traced shading, no multi-zone airflow, no
> HVAC equipment models, no moisture transport, no 3-D FEA, and say **why** each trade is the right
> one for this problem.
>
> **Rehearse five full times**, and **at least once end to end on an unfamiliar machine with the
> network off** (that is T-66's cold-start test, performed for real in front of the team).
>
> **Do not state a validation claim that is not in `VALIDATION.md` with a number attached**
> (global rule 9). Do not edit `VALIDATION.md` or `EQUATIONS.md`.

**Files you may touch.** `DEMO.md` (create).
**Files you may NOT touch.** `VALIDATION.md`, `EQUATIONS.md`, any source file.

**Subagent guidance.** Single agent plus the team for rehearsals.

**ACCEPTANCE TESTS — the task is NOT done until every one passes:**
1. **Every claim in `DEMO.md` traces to a document or a test in this repository.** Paste the trace
   for each of the five kill-shot answers.
2. `grep -ri "ansys" DEMO.md` returns nothing that claims a comparison. Paste every hit.
3. Rehearsed answers exist for **all five** kill-shot questions, and the K-02 answer leads with the
   analytical test.
4. The cut list appears **proactively** in the script, not only as a reactive answer. Paste the
   section.
5. **Five full rehearsals are logged**, with dates and the elapsed time of each. Paste the log.
6. **At least one rehearsal ran start to finish on an unfamiliar machine with the network off.**
   Paste the machine, the date and the observed cold-start time.
7. The demo opens on a **loaded preset showing a result**, never an empty form — confirmed in the
   rehearsal log.
8. The run of show fits the allotted time with at least 20 % margin. Paste the target and the
   median rehearsal time.
9. Every number quoted in the script appears in `VALIDATION.md` or in a named test. Spot-check five
   and paste the traces.
10. A failure-mode plan exists for: no network, no database, the AI unavailable, and the projector
    at a different resolution. Paste the four mitigations.

**Evidence (fill this in when done — numbers, not adjectives):**
```
```

**Completed by:** ___  **Date:** ___

---

### [ ] T-69 — The PPT

**Area:** J — Delivery (≈ W-54) · **Status:** NOT STARTED · **Est:** 8 h
**Depends on:** T-46, T-47, T-63, T-68 · **Conflicts with:** T-63 (quotes it, never edits it)

**Why this exists.** `AUDIT.md` graded `CHALLENGE.md` C-18 **WRONG** — the only WRONG verdict in the
entire audit. The original plan called the PPT *"your first and hardest gate"* and then scheduled it
**last**, while Slide 2 demands a screenshot of the isometric house plus a temperature curve which
the same schedule could not produce in time. **Most teams are eliminated at idea submission**, so an
engine that is perfect in week 4 is worth nothing if the deck was built from mockups.

**PROMPT — paste this to start the task:**
> Revise `../ShelterSim_SIH_Idea_PPT.pptx` (it exists at the parent directory; **revise it, do not
> re-author it from scratch**) onto the six-slide SIH format.
>
> **Use real screenshots from real code** — T-46's isometric house and T-47's temperature curve —
> **never mockups**. Record the capture date of every screenshot; it must be **after** T-46 and T-47
> landed.
>
> **Slide 2 leads with the deployment argument**, because it is the differentiator a DRDO panel
> feels immediately: runs in a browser, **no licence**, works **offline** at 3,500 m, ~**30 ms per
> design** against ANSYS's hours. That gap of roughly half a million times is not a bragging point —
> **it is the entire product.** It is the difference between "simulate the one design you already
> chose" and "try a hundred designs and tell me which is best", and it is what makes the
> eighteen-scenario survival grid and the longest-sunless-stretch test possible at all.
>
> **Put the cut list on a slide.** Proactively. See T-68.
>
> **Quote `VALIDATION.md` and nothing else** for every validation claim. The headline number is the
> analytical decrement and lag: measured versus analytical 0.137 / 7.6 h for 300 mm dense concrete.
> **No ANSYS claim anywhere** (global rule 9).
>
> Cover, across the six slides: the problem in DRDO's own words (*"approach nearly the ambient
> atmospheric temperature after sunset"*); the four outputs (the three named PS deliverables plus the
> recommender); the physics in one honest sentence; the validation evidence; the eighteen scenarios
> and the survival grid; and the recommendation screen with its economics.
>
> Do not add a feature for the deck. Do not edit `VALIDATION.md`, `EQUATIONS.md` or `DEMO.md`.

**Files you may touch.** `../ShelterSim_SIH_Idea_PPT.pptx` and any exported screenshot assets you
place under `docs-assets/`.
**Files you may NOT touch.** `VALIDATION.md`, `EQUATIONS.md`, `DEMO.md`, `LOG.md` (beyond your own
task's lines), any source file.

**Subagent guidance.** Single agent plus the team for review. A deck with three authors has three
voices, and the panel notices.

**ACCEPTANCE TESTS — the task is NOT done until every one passes:**
1. **Every slide's claim traces to a document or a test in this repository.** Paste the trace for
   every numeric claim on every slide.
2. **Slide 2 contains a screenshot from running code**, and its **capture date is after T-46 and
   T-47 were marked `[x]`**. Paste the capture date and both task completion dates.
3. `grep -ri "ansys"` across the deck's extracted text returns either nothing or only text
   explaining why ANSYS was **not** used. Paste every hit.
4. The deck contains a **limitations / cut-list slide**, stated proactively.
5. Every validation number on the deck appears in `VALIDATION.md` with the same value. Diff them and
   paste the result — it must be empty.
6. The headline analytical number (decrement 0.137, lag 7.6 h) appears with its measured counterpart
   and its deviation.
7. The performance claim on Slide 2 quotes the **measured** ms/run from `VALIDATION.md`, not a
   rounded aspiration. Paste both.
8. No mockup, wireframe or placeholder image appears anywhere in the deck. List every image and its
   source.
9. The deck is six slides, matching the required format.
10. The deck states the three named PS deliverables **by name** so an evaluator can find each one.
    Paste the three labels.
11. A reviewer who has not seen the project can state, after reading the deck, what the tool does,
    what it does not do, and why the numbers should be believed. Record the reviewer and their
    three answers.

**Evidence (fill this in when done — numbers, not adjectives):**
```
```

**Completed by:** ___  **Date:** ___

---

## END OF LEDGER

**If you have read this far without claiming a task, go back to §2 and run the start-of-session
ritual.** The first unchecked box whose dependencies are all `[x]` is yours.

**If you just finished a task:** paste your measured numbers into its Evidence block, fill in
*Completed by* and *Date*, flip its box to `[x]`, **update the dashboard in §5**, and commit with the
task id as the first token of the message.

**If you changed something this ledger says, change this ledger too.** A ledger that disagrees with
the disk is worse than no ledger, because the next agent will trust it.
