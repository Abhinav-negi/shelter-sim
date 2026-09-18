> This file is one Area of the ShelterSim build ledger. The index and full file map are in
> `LOG.md` at the repo root. Shared contracts, constants and the eleven heat pathways referenced
> below as "§7.x" live in `log/CONTRACTS.md` (§7–§10 of the original single-file ledger).
> References to "§5" or "§6" below mean the corresponding section still in `LOG.md`.
> Read `log/CONTRACTS.md` once per session (per the ritual in `LOG.md` §2), not once per task.

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

### [x] T-43 — The browser Web Worker and the offline fallback path

**Area:** F — Frontend (≈ W-34) · **Status:** DONE · **Est:** 6 h
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
All 11 acceptance tests + 2 bonus tests (runScenarios, isServerReachable) pass together in one
unfiltered run: `npx vitest run apps/web/test/worker.test.ts` -> "Test Files 1 passed (1), Tests 13
passed (13), Duration 152.89s". Timing-sensitive tests 1 and 11 were each run 3 separate times
(isolated, combined-without-test-4, and the final full-file run) with no flakiness observed -- see
below.

1. Main thread responsiveness (real off-main-thread run via a genuine node:worker_threads.Worker
   bridging apps/web/workers/sim.worker.ts unmodified -- see "worker bridge" note below). A 5ms
   setInterval timer measured tick lateness across the whole run (mirrors pool.test.ts's own test-6
   technique for the identical claim on the server side):
     run 1 (isolated):            ticks=40, late(>16ms)=0, on-time=100.0%, longest gap=6.24 ms
     run 2 (combined w/o test 4): ticks=26, late(>16ms)=0, on-time=100.0%, longest gap=6.70 ms
     run 3 (full-file run):       ticks=32, late(>16ms)=0, on-time=100.0%, longest gap=5.70 ms
   Longest main-thread task duration observed across all 3 runs: 6.70 ms (< 16 ms every time).

2. Firing 3 requests in quick succession: settled = [rejected, rejected, fulfilled].
   Store-write counter = 1 (exactly 1, as required).

3. EngineError('INVALID_INPUT') (negative building.volume, fails validateRequest()'s own basic
   checks) arrives as a typed rejection carrying `.code === 'INVALID_INPUT'`, `instanceof
   EngineError`, never an unhandled rejection. Also spot-checked the sibling UNKNOWN_MATERIAL code
   (thrown later than validateRequest()'s pass) through the same path to confirm this isn't
   special-cased to one code.

4. 1,000 sequential requests through the real worker bridge, strictly increasing internal gains
   (monotonic aux-energy correlation, same technique as pool.test.ts's own test 10): 0 non-monotonic
   (mismatched) adjacent pairs across 1,000 requests. Total wall time 24.5 s (in the full-file run) /
   15.3 s (separate solo run) -- variance is IPC/OS scheduling noise, not correctness.

5. viaWorker result deep-equal (minus each side's own self-reported wallClockMs) to in-process
   simulate() on the same request. `viaWorker.time`, `.temperatures.indoorAir`, `.temperatures.ambient`,
   `.heatFlows.Q1_solarOpaque` all `instanceof Float64Array` -- confirmed true.

6. Synchronous fallback (workerFactory reset to default, no DOM Worker global under vitest) result
   deep-equal (minus wallClockMs) to the worker-path result on the same request.

7. OFFLINE / C-12 (global.fetch mocked to always reject -- network fully blocked): elapsed = 112.5 ms
   (well under the 5000 ms budget), tempAt0600 = -6.1 degC (via lib/units.ts's own formatTempC, no
   raw -273.15 anywhere in this task's files), store.online = false.

8. Server 500 (global.fetch mocked to resolve `new Response('server error', {status:500})`): a valid
   result is still returned, store.online = false.

9. Server timeout / no response (fetch's HEAD leg resolves immediately so isServerReachable() sees a
   reachable server; the POST leg hangs until workerClient.ts's own AbortController fires): elapsed =
   5167.3 ms / 5194.6 ms / 5149.1 ms across 3 separate runs -- consistently ~5.15-5.2s, i.e. the real
   SERVER_TIMEOUT_MS=5000 budget plus a small local-compute tail, and nowhere near a naive 30s.

10. Terminating the (real, bridged) worker ~5ms into an in-flight run: the pending promise rejects
    immediately (`instanceof Error`) instead of hanging -- verified via `await expect(promise)....`
    resolving before the test's own 10s timeout.

11. 10,000 sequential requests through the real worker bridge: `__workersCreatedForTest()` stayed at
    exactly 1 in all 3 separate runs (139.9s, 144.1s, 121.2s wall time respectively) -- one always-on
    worker, never spawned per request.

Full-repo regression check (`npx vitest run`, whole monorepo):
  BEFORE this task (baseline, measured after `npm install` + engine/data build, before any T-43
  file existed): Test Files 8 failed | 22 passed (30); Tests 16 failed | 290 passed | 35 skipped
  (341); Duration 267.32s. All 16 pre-existing failures are in apps/web/test/repo-designs.test.ts
  and apps/web/test/repo-materials.test.ts -- Prisma/DB-tier tests failing because this worktree has
  no live database configured (`@prisma/client did not initialize yet` / DB connection errors),
  entirely unrelated to T-43's files.
  AFTER this task (clean run): Test Files 8 failed | 23 passed (31); Tests 16 failed | 303 passed |
  35 skipped (354); Duration 384.33s. Same 16 pre-existing DB-tier failures (identical test names to
  the baseline list above), zero new failures; +1 test file (worker.test.ts, 13/13 passing, 193.4s)
  and +13 passing tests overall (290 -> 303). One earlier intermediate rerun (between the baseline
  and this clean run, while worker.test.ts's fixture was still being adjusted) showed 17 failed
  instead of 16 -- one extra apps/web/test/repo-designs.test.ts case flipped pass/fail. Re-run
  cleanly and it returned to exactly the baseline's 16; vitest.config.ts's own header comment
  documents this exact class of pre-existing cross-file DB-tier races (shared process-wide
  process.env.DATABASE_URL / Prisma-client-stash state), which this task's files never touch --
  workerClient.ts and sim.worker.ts have no relationship to the database tier. Reported here per
  rule 15/16 rather than silently discarded.

Worker bridge note (why tests 1/4/5/10/11 are genuine, not simulated): vitest's default environment
is plain Node, which has no DOM `Worker` global, so apps/web/test/worker.test.ts bridges a real
`node:worker_threads.Worker` -- running apps/web/workers/sim.worker.ts completely unmodified -- to
the `WorkerLike` interface workerClient.ts expects, via the test-only `__setWorkerFactoryForTest`
hook. The bridge's only job is polyfilling the 3 DOM globals sim.worker.ts actually uses (`self`,
`postMessage`, `addEventListener('message', ...)`) on top of `parentPort`; it never modifies
sim.worker.ts itself. Node >=22.18/23.6's default TypeScript type-stripping loads the .ts worker
file directly, no build step or extra dependency required. This means test 1's/11's timing numbers
above reflect a genuine second OS thread, not a deferred-callback stand-in.

Gotcha for a future task (not fixed here -- app/api/* is off this task's allow-list): T-38's
POST /api/simulate (apps/web/app/api/simulate/route.ts) responds to a cache HIT with only
`{kpis, meta}`, omitting `time`/`temperatures`/`solar`/`heatFlows`. workerClient.ts's `resultFromJson`
call on that response throws EngineError('DATA_SCHEMA_MISMATCH') (missing required fields per
CONTRACTS.md sec 7.7), which this task's routing logic silently treats as "server failed" and falls
back to the local worker -- never crashes, but it means a cache hit is effectively wasted from this
client's point of view instead of being used. Whoever wires the store up to workerClient.ts (a T-44+
follow-on) should know a server "success" response is not always a full SimulationResult today.
```

**Completed by:** subagent (session claude-sonnet-5, orch-T-43)  **Date:** 2026-09-18

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

### [~] T-45 — The Advanced panel

**Area:** F — Frontend (≈ W-38) · **Status:** CLAIMED by orch-T-45 at 2026-09-18T15:41:30Z · **Est:** 5 h
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

### [~] T-46 — The isometric house: click a wall, scrub the day

**Area:** F — Frontend (≈ W-39) · **Status:** CLAIMED by orch-T-46 at 2026-09-18T15:41:30Z · **Est:** 12 h
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

### [~] T-50 — The survival grid

**Area:** F — Frontend · **Status:** CLAIMED by orch-T-50 at 2026-09-18T15:41:30Z · **Est:** 5 h
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

