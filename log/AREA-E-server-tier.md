> This file is one Area of the ShelterSim build ledger. The index and full file map are in
> `LOG.md` at the repo root. Shared contracts, constants and the eleven heat pathways referenced
> below as "§7.x" live in `log/CONTRACTS.md` (§7–§10 of the original single-file ledger).
> References to "§5" or "§6" below mean the corresponding section still in `LOG.md`.
> Read `log/CONTRACTS.md` once per session (per the ritual in `LOG.md` §2), not once per task.

---

# AREA E — SERVER TIER

> Next.js App Router route handlers. **No feature on the demo path may require any of these routes.**
> The app must build and run as a static export with the whole `app/api/` directory deleted, and
> every route here must return a clean, typed error the client can ignore rather than a blank screen.

---

### [~] T-36 — Next.js scaffold, the store, the unit boundary, and the layout slots

**Area:** E — Server (≈ W-33) · **Status:** CLAIMED by orchestrator-session at 2026-09-17T14:52:41Z · **Est:** 8 h
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

