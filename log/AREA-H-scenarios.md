> This file is one Area of the ShelterSim build ledger. The index and full file map are in
> `LOG.md` at the repo root. Shared contracts, constants and the eleven heat pathways referenced
> below as "§7.x" live in `log/CONTRACTS.md` (§7–§10 of the original single-file ledger).
> References to "§5" or "§6" below mean the corresponding section still in `LOG.md`.
> Read `log/CONTRACTS.md` once per session (per the ritual in `LOG.md` §2), not once per task.

---

# AREA H — SCENARIOS

> *"A tool that takes four hours per run structurally cannot answer 'what happens during the longest
> sunless streak on record?' You would need three days of computing. Speed is not a convenience here
> — it makes a whole category of question askable for the first time."* (`plan.md` §7.)
> **Every scenario is pulled from the real recorded history of that specific site, not invented.**

---

### [~] T-59 — The eighteen-scenario matrix, built from real recorded history

**Area:** H — Scenarios (≈ `plan.md` §7) · **Status:** CLAIMED by orchestrator at 2026-09-16T15:27:04Z · **Est:** 8 h
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

