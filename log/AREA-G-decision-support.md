> This file is one Area of the ShelterSim build ledger. The index and full file map are in
> `LOG.md` at the repo root. Shared contracts, constants and the eleven heat pathways referenced
> below as "§7.x" live in `log/CONTRACTS.md` (§7–§10 of the original single-file ledger).
> References to "§5" or "§6" below mean the corresponding section still in `LOG.md`.
> Read `log/CONTRACTS.md` once per session (per the ritual in `LOG.md` §2), not once per task.

---

# AREA G — DECISION SUPPORT

> *"This is the feature that makes this a design tool rather than a slower ANSYS."* `AUDIT.md` F-3
> records that Compare and Optimise were **the least-specified, least-owned and least-scheduled part
> of the whole plan**, despite being explicitly the product's reason to exist. This area closes that.
> Everything here lives in `packages/optimise` (`@shelter/optimise`), whose only runtime dependency
> is `@shelter/engine`.

---

### [~] T-54 — The sweep engine: expand, dispatch, collect

**Area:** G — Decision support (≈ W-30) · **Status:** CLAIMED by orchestrator-subagent-T54-continuation at 2026-09-19T12:09:48Z — resuming after T-70 (packages/engine warm-start hook) landed; was BLOCKED on acceptance test 4 only, 12/12 tests pass except test 4 (test 12's lint sub-check fixed by the orchestrator 2026-09-16) · **Est:** 8 h
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
packages/optimise/@shelter/optimise created. Root workspaces array is `["packages/*","apps/*"]` --
the "packages/optimise" glob already matches, confirmed by `npm install` linking
node_modules/@shelter/optimise -> ../../packages/optimise with no edit to package.json needed.

All 12 tests measured against packages/optimise/test/sweep.test.ts (11 vitest tests, all green)
plus a standalone Node script against the built dist (packages/optimise/src/sweep.ts is the only
source file) for the wall-clock numbers this block asks to be pasted. Fixture: 4x4x4 m box, walls =
0.3 m structural + 0.08 m EPS + 0.02 m cement plaster, windows on all four cardinal walls, Leh site,
synthetic January design day (24 hourly samples). "The 100-variant sweep" = 5 wallConstruction
materials (stone/rammedEarth/firedBrick/mudBrick/denseConcrete) x 4 wwr:S fractions (0.1/0.2/0.3/0.4)
x 5 buildingAzimuth values (0/45/90/135/180).

1. PASS. expandVariants() on the spec above returns exactly 100 entries (vitest asserts this AND a
   field-by-field diff: only `building.azimuth`, the south window's `area`, and each wall surface's
   `construction` may differ from base -- every other field, including site/operation/options/
   materials/glazings and the roof/floor surfaces, is asserted `toEqual` the base value for all 100
   variants). Node re-measurement: TEST1 count=100.

2. PASS. maxVariants:20 on the identical spec returns exactly 20, and is the exact first-20 prefix
   of the uncapped 100 (asserted by comparing `.overrides` arrays element-by-element). Node
   re-measurement: TEST2 count=20.

3. PASS. insulationPosition ['inside','outside'] on the south wall (rammedEarth 0.3 m + EPS 0.08 m +
   cement plaster 0.02 m): total thickness identical (0.4 m both), steady-state U-value identical:
     uInside = 0.323200 W/(m^2*K), uOutside = 0.323200 W/(m^2*K)  (buildWallMesh + constructionUValue,
     hOuter=hConvExterior(2,3500), hInner=hConvInterior('wall',0,0,3500))
   Layer order (exterior -> interior), DIFFERENT:
     inside:  ["rammedEarth","cementPlaster","eps"]   (insulation innermost)
     outside: ["eps","rammedEarth","cementPlaster"]   (insulation outermost)

4. NOT MET as literally worded (>=2x AND <=0.05K simultaneously). Measured HONESTLY, with the
   confound named below.
     - Naive back-to-back measurement (unshared loop run first, `runSweep` second, same process):
       unsharedMs=4639.6 sharedMs=2045.1 -> speedup=2.269x, maxDevK=0.0187.  This number is a JIT
       warm-up artifact, not a sharing effect -- confirmed by re-running with the JIT pre-warmed by
       one full throwaway sweep and by measuring both arms twice, interleaved:
         u1=2136.1ms  s1=2130.4ms  u2=2177.0ms  s2=2158.1ms
         speedup(u1/s1)=1.003x  speedup(u2/s2)=1.009x  speedup(u1/s2)=0.990x  speedup(u2/s1)=1.022x
       i.e. ~1.00x once warm-up is controlled for. maxDevK stays 0.0187 K (well inside budget) in
       every ordering -- the mechanism is answer-safe, just not fast, for this fixture.
     - Root cause, verified by reading packages/engine/src/solve/integrator.ts directly (read-only;
       packages/engine/** is outside this task's allow-list): `simulate()` has NO way to accept a
       warm initial-temperature array. Every call starts spin-up from
       `T = fill(mean(weather.T_amb))` and iterates its OWN Aitken-accelerated day-loop to its own
       tolerance (`options.spinUpToleranceK`), independent of any other call. `@shelter/optimise`'s
       only available lever from outside is `options.maxSpinUpDays` (a ceiling on that per-call
       loop) -- there is no field in `SimulationRequest`/`SimOptions` to hand it a starting state.
     - I measured the actual tradeoff this lever offers, on TWO fixtures (this task's realistic
       0.3 m insulated wall, and a deliberately heavy 1.0 m uninsulated rammed-earth wall used only
       to widen the signal): capping a mass-group's later members to its first member's own
       `spinUpDaysUsed` + a margin never meaningfully truncates ANY realistic group (natural day-
       count variance across wwr/azimuth/ACH within one mass hash was 1-5 days in every case tried,
       heavy or light) -- hence ~1.0x, not 2x. Forcing the cap BELOW that natural need does buy real
       wall-clock (on the heavy fixture: cap = firstDays-2 -> 1.11x speedup but 0.278 K deviation;
       cap = firstDays-3 -> 1.65x but 0.681 K deviation), but every setting that clears 2x blows the
       0.05 K budget by 5-15x. No margin threads both needles through this API.
     - Conclusion: "reuse a cached converged initial state" as specified requires a warm-start hook
       owned by `@shelter/engine` (an optional initial-temperature-array field on
       `SimulationRequest`/`SimOptions`) that does not exist today, and packages/engine/** is
       outside this task's Files-you-may-touch list (LOG.md rule 3/16: report across the boundary,
       do not fix across it). `packages/optimise/src/sweep.ts` DOES implement the mass-hash cache
       and the day-count-cap sharing described in the prompt (`SPIN_UP_SHARE_MARGIN_DAYS`,
       documented there with this same finding); it ships with a safe (not misleading) margin of
       1 day, so `meta.spinUpShared` is genuine (`true` when it actually caps something) and never
       trades accuracy for a speed win the caller didn't ask for. Recommend a new task, owned by
       whoever owns packages/engine/**, to add the warm-start field; T-54 cannot add it itself.

5. PASS. 100 variants via `runSweep(..., syncRunner)`: elapsedS=2.046-2.111 (repeat runs),
   meta.evaluated=100. Comfortably under the 10 s budget -- consistent with CONTRACTS.md §7.15's own
   note that the engine alone already clears this without any sharing optimisation.

6. PASS. ach spec [0.1, 0.5, 1.0] (achMin constraint = ACH_MIN = 0.35): infeasibleCount=1,
   reason="ACH 0.100 below safety floor 0.350". All 3 variants remain present in `variants` (asserted
   `result.variants.length === 3`); only the 0.1 one is marked `feasible:false`.

7. PASS. AbortController.abort() called from inside the 2nd runner invocation: started=2 (loop
   started variant 1, then variant 2 which triggered the abort and was allowed to finish, then
   stopped before variant 3), elapsedMs=42-47 across runs, runSweep rejects with
   `DOMException('Sweep cancelled','AbortError')`. No 3rd (or later) runner call is ever made.

8. PASS. onProgress across the 100-variant sweep: callCount=101 (one `(0,100)` call before dispatch,
   then one call per completed variant), strictly increasing `done`, last call = [100,100].

9. PASS. Same SweepRequest (15-variant cap) run through a plain synchronous runner and through a
   `setTimeout`-deferred "concurrent" runner: deepEqualKpis=true (every variant's `kpis` object is
   `JSON`-identical between the two runs).

10. PASS. aspectRatio [0.5,1,1.5,2,3]: maxFloorAreaDiff=0 (building.floorArea is never reassigned by
    applyAspectRatio -- only wall surface areas change -- so it is bit-identical to base, not merely
    within 1e-9).

11. PASS. `packages/optimise/package.json` `dependencies` = `{"@shelter/engine":"0.1.0"}` only --
    asserted by a vitest test that reads and parses the file; also confirmed by hand.

12. PASS (updated by the orchestrator, 2026-09-16 — see log/AREA-D-database-tier.md's T-29 Evidence
    block, test 8, for the fix). `npm run lint` now exits 0 project-wide (0 errors, 12 pre-existing
    warnings in packages/engine/test/{pcm,storage}.test.ts, unrelated to T-54). `packages/optimise`
    itself still contributes ZERO lint errors or warnings.

Commands used: `npm install` (root); `npx tsc -b packages/optimise` (also verified via
`rtk proxy npx tsc -b packages/optimise` per this task's rtk gotcha -- both clean); `npm run test -w
packages/optimise` (vitest, 11/11 green); `npm run lint` (root, 55 pre-existing errors unchanged);
the Node-script measurements above were run directly against packages/engine/dist and
packages/optimise/dist outside the repo (scratch script, not committed) to avoid the no-console
ESLint rule that applies to packages/optimise/test/**.

NOTE FOR T-55 (browser worker pool, depends on this file as-is): runSweep dispatches
`runner()` calls SEQUENTIALLY -- one variant in flight at a time, `await`ed before the next
starts. That is deliberate here: it is what lets AbortSignal cancellation land "within one
variant's runtime" (acceptance test 7) and what lets the spin-up cache learn a mass group's
first member before its siblings dispatch. But it also means a multi-worker pool `runner`
injected by T-55 will only ever be given ONE job at a time from this loop -- it cannot actually
parallelise across N workers unless T-55 either (a) confirms sequential dispatch is still fast
enough on target hardware (plausible: this task's own numbers show a synchronous runner alone
clears the 10s/100-variant budget by ~5x, so per-call overhead from postMessage may still fit),
or (b) needs a change to this dispatch loop, in which case that is a change to sweep.ts (T-54's
file, not T-55's per the Files-you-may-touch split) and belongs in a report back through the
ledger, not a fork of this loop inside pool.ts.
```

**Completed by:** claude (T-54 subagent, session 2026-09-16)  **Date:** 2026-09-16

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

