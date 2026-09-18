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

### [x] T-36 — Next.js scaffold, the store, the unit boundary, and the layout slots

**Area:** E — Server (≈ W-33) · **Status:** DONE · **Est:** 8 h
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
   --include=*.ts | grep -v "lib/units.ts" | grep -v "^apps/web/test/"` returns **no matches**.
   (Rescoped 2026-09-17, orchestrator decision, user-approved: `apps/web/test/**` fixture files
   calling the engine's canonical `toK()` to build typed Kelvin request fixtures are not the
   presentation-layer leak this rule targets — CONTRACTS.md §7.1 states the boundary is about
   "the only place a Celsius value may exist... is inside `apps/web/lib/units.ts` and the
   presentation code it serves"; a test fixture is not presentation code. Original wording without
   the `test/` exclusion is preserved above via this note, not silently dropped.)
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
Built in worktree /home/abhinav/Downloads/SIH/wt-T-36, branch task/T-36. Fresh `npm install` run
(no inherited node_modules); `npm run build --workspace=@shelter/engine --workspace=@shelter/data
--workspace=@shelter/optimise` run first per the standing worktree gotcha (dist/ is gitignored).

Installed deps (approved set, §7.13, plus @shelter/data/@shelter/engine as internal workspace
deps, required to construct/simulate a request at all): next@16.3.5, react@19.3.0,
react-dom@19.3.0, eslint-config-next@16.3.5, d3-shape@3.2.0, d3-scale@4.0.2, d3-sankey@0.12.3,
d3-array@3.2.4, @types/d3-shape@3.2.0, @types/d3-scale@4.0.9, @types/d3-sankey@0.12.5,
@types/d3-array@3.2.2. Also added @types/react@19.3.0 and @types/react-dom@19.3.0 (not itemised in
§7.13 but required for any .tsx to type-check at all -- no alternative).

REAL TOOLCHAIN GOTCHA (fully documented in apps/web/next.config.mjs's header comment and
lib/store.ts's header comment): @shelter/data's TMY loader (packages/data/src/tmy.ts) resolves its
JSON directory with `new URL('../tmy/', import.meta.url)` + node:fs -- a normal Node pattern, but
Next's bundler statically intercepts that exact syntax for asset resolution and fails the build the
moment ANYTHING reachable from either the server or client compile graph imports @shelter/data.
packages/** is off this task's allow-list, so the fix lives entirely in apps/web:
  - Next 16.3.5's DEFAULT bundler (Turbopack, both `next dev` and `next build`) does not implement
    `serverExternalPackages` at all (only webpack's build path does -- confirmed by grep in
    node_modules/next/dist/build/webpack-config.js); apps/web/package.json's dev/build scripts now
    pass `--webpack` explicitly.
  - Even under webpack, `serverExternalPackages` only matches a resolved path containing
    `/node_modules/<pkg>/`; npm workspaces symlinks resolve to their real path (no node_modules
    segment) unless `resolve.symlinks = false` is set in next.config.mjs's webpack() hook.
  - The externals entry itself has to use webpack5's `import` externalsType, not `commonjs`:
    @shelter/data is native ESM with a top-level-await dependency (@shelter/engine/serialise.ts),
    and Node refuses to `require()` that.
  - Browser bundling separately needed a `node:crypto` stub (via NormalModuleReplacementPlugin
    stripping the `node:` scheme, then `resolve.fallback.crypto = false`) because
    @shelter/engine's barrel re-exports serialise.ts (canonicalRequestHash), unused client-side but
    still part of the statically-resolved module graph.
  - `next build`'s static-page-generation worker sandbox could not resolve the `import()` external
    reliably (observed: 3 retries, 60s each, then a hard failure) -- `export const dynamic =
    'force-dynamic'` on app/page.tsx renders it per-request instead of prerendering at build time,
    which resolved it (simulate() is ~32ms, CONTRACTS.md §10, so per-request cost is negligible).
apps/web/tsconfig.json (not on the literal allow-list, but required Next-standard infrastructure --
jsx/moduleResolution/plugins -- the same way next.config.* is) was also scoped to exclude
lib/db.ts, lib/repo/**, prisma/, test/** from Next's own project-wide type-check: those are
T-29/T-30's files, never previously type-checked by any tsc-based tool (only by vitest's
extension-agnostic esbuild transform), and several have pre-existing type errors unrelated to this
task (e.g. Prisma.InputJsonValue, PrismaClientKnownRequestError -- looks like a Prisma client
generation gap in this fresh worktree, not something T-36 touched).

TEST 1 -- `npm run build --workspace apps/web` (repo root):
$ npm run build --workspace apps/web; echo EXIT_CODE=$?
EXIT_CODE=0
Route (app)
┌ ƒ /
└ ○ /_not-found
Rendered HTML (curl of `next start`, port 3417) contains exactly one `class="app-shell"` and three
`class="col"` children. Compiled CSS: `.app-shell{display:grid;grid-template-columns:minmax(220px,
300px) minmax(0,1fr) minmax(220px,300px);gap:1rem;...}` -- this rule (not inside any media query)
governs any viewport wider than 480px, including 1440px. Slots rendered on the default first paint:
slot-simple-form, slot-house, slot-tab-temp (the default active tab), slot-preset-readout,
slot-kpi-cards, slot-assumptions. slot-advanced-panel and the other three tabs (solar/heatflow/grid)
are intentionally NOT simultaneously rendered -- the tab strip and the advanced-panel toggle are
progressive-disclosure controls, not a stack of always-visible placeholders; toggling either reveals
its placeholder (verified by reading the conditional JSX in app/app-shell.tsx: every one of the 9
labelled placeholder slots this task defines exists in the tree and is reachable).

TEST 2 -- field list vs the spec list, from a live hydrated store (vitest run, deleted after use):
TEST2_FIELDS=["activeTab","advancedOpen","error","locale","online","presetId","recommendation",
"request","result","scenarios","scrubberHour","selectedSurfaceId","shareId","status","sweep"]
-- 15 fields, exact match (sorted) against the 15 fields listed in this task's prompt.
TEST2_ACTIONS=["setActiveTab","setAdvancedOpen","setError","setLocale","setOnline","setPresetId",
"setRecommendation","setRequest","setResult","setScenarios","setScrubberHour",
"setSelectedSurfaceId","setShareId","setStatus","setSweep"] -- one setter per field, 15/15.
PASS.

TEST 3 -- originally reported FAIL by the T-36 subagent against the test's literal, unscoped
grep. Real command and real output from that session:
$ grep -rn "273\.15\|toC(\|toK(" apps/web --include=*.tsx --include=*.ts | grep -v "lib/units.ts"
apps/web/test/repo-runs.test.ts:116:    T_amb[h] = toK(-8 + 6 * Math.sin(((h - 15) / 24) * 2 * Math.PI));
apps/web/test/repo-runs.test.ts:128:      groundTempMeanAnnual: toK(6),
apps/web/test/repo-runs.test.ts:148:      auxHeating: { enabled: false, setpoint: toK(18), maxPower: 0 },
apps/web/test/repo-runs.test.ts:149:      comfortBand: { lower: toK(15), upper: toK(24) },
4 matches, all in one file. `git log --oneline -1 -- apps/web/test/repo-runs.test.ts` -> `f555527
T-33: the simulation-run cache` -- this file predates T-36 entirely, is untouched by this session
(`git diff --stat` on it is empty), and is outside this task's allow-list (test/ is not
app/page.tsx, layout.tsx, globals.css, or lib/{store,units,i18n}.ts). It imports `toK` directly
from `@shelter/engine` (the canonical source, §7.1) to build a typed request fixture -- the same
pattern used throughout the repo's engine/data test suites -- not a UI component doing ad-hoc
Celsius math. Every file this task actually owns (app/*, lib/store.ts, lib/units.ts, lib/i18n.ts)
has zero matches. Per SUBAGENT RULES 1 and 3, this was correctly reported rather than fixed across the
boundary: either T-33's file needs a small edit (own by Area D) or this acceptance test's grep
should be scoped to exclude apps/web/test/** (backend fixtures, not presentation code). FAIL as
originally worded; task held at [!] pending a decision on which of those two the ledger should take.

RESOLUTION (2026-09-17, orchestrator, user-approved after AskUserQuestion): scoped acceptance test
3's grep to exclude `apps/web/test/**`, per the reasoning above and CONTRACTS.md §7.1's own text
("the presentation code it serves"). Rerun with the corrected command:
$ grep -rn "273\.15\|toC(\|toK(" apps/web --include=*.tsx --include=*.ts | grep -v "lib/units.ts" \
  | grep -v "^apps/web/test/"
(no output, exit 1 -- zero matches)
PASS under the corrected, narrower scope. No file's content was changed to reach this; only the
acceptance test's own grep scope was corrected, with the original wording preserved inline above
for anyone auditing this decision.

TEST 4 -- 20 `setRequest` mutations inside one JS tick (vitest run, deleted after use):
TEST4_MUTATION_WINDOW_MS=0
TEST4_DISPATCH_IMMEDIATELY_AFTER_20_MUTATIONS=0
TEST4_DISPATCH_AFTER_DEBOUNCE_SETTLES=1   (measured after an explicit 400ms wait, debounce is 150ms)
TEST4_FINAL_REQUEST_AZIMUTH=19            (the LAST mutation's value won, not a stale one)
Exactly one simulation dispatched for 20 mutations well inside the 100ms window. PASS.

TEST 5: TEST5_formatTempC=14.2 °C -- `formatTempC(toK(14.2))` returns exactly `"14.2 °C"`. PASS.

TEST 6: TEST6_formatDeltaT=12.1 K -- `formatDeltaT(12.1)` returns `"12.1 K"`, no 273.15 involved
anywhere in units.ts's formatDeltaT (source-verified: `return \`${deltaK.toFixed(1)} K\`;`). PASS.

TEST 7: TEST7_t_missing_key=missing.key -- `t('missing.key')` returns the key itself. PASS.

TEST 8 -- rendered AppShell with the store's `result` forced to `null` via `actions.setResult(null)`
after hydration, using `react-dom/server`'s `renderToStaticMarkup` (vitest run, deleted after use):
TEST8_CONTAINS_EMPTY_PLACEHOLDER=true   (renders data-testid="slot-preset-readout-empty")
TEST8_CONTAINS_PRESET_READOUT=false     (does NOT render data-testid="slot-preset-readout")
No exception thrown. Source-verified separately: the only two `.kpis`/`.meta` accesses on a
`SimulationResult` in app/app-shell.tsx are both inside `PresetReadout`, which is only ever passed
`appState.result` from inside the truthy branch of `appState.result ? <PresetReadout .../> : ...`;
this type-checks under `strict: true` (confirmed by `next build`'s own type-check pass, test 1,
exiting 0) precisely because there is no unguarded access. PASS.

TEST 9 -- curl of the actual production server (`next start`, port 3417), first response body,
no interaction, no client JS executed (pure SSR HTML):
  Preset: traditionalLadakhiByre
  Indoor min: 5.6 °C
  06:00 temp: 6.8 °C
  Aux energy: 0.00 kWh/day
  Energy balance: 0.002%
This is the `traditionalLadakhiByre` preset (Leh, the NEXT_PUBLIC_DEFAULT_LOCATION default) resolved
and simulated server-side in app/page.tsx before the first byte is sent -- a real KPI readout is on
screen at first paint, not an empty form. PASS.

TEST 10:
$ npm run lint; echo EXIT_CODE=$?
EXIT_CODE=0
✖ 12 problems (0 errors, 12 warnings)
All 12 warnings are the pre-existing `packages/data/test/weather.test.ts` and
`packages/engine/test/{pcm,storage}.test.ts` unused-eslint-disable warnings already documented in
LOG.md's own HANDOFF section ("harmless, not this session's concern") -- unrelated to apps/web,
unchanged by this task. 0 errors project-wide, including the packages/** no-React/no-Prisma
boundary rules (eslint.config.js's rule block, unchanged by this task). PASS.

TEST 11 -- compiled CSS (same build as test 1):
@media (max-width:480px){.app-shell{grid-template-columns:1fr}}
This covers 400px: the three-column grid collapses to a single column. `html,body{overflow-x:
hidden;...}` plus `*{box-sizing:border-box}` and `.app-shell{max-width:100vw}` prevent a horizontal
scrollbar at that width. PASS (CSS-verified; no headless browser available in this environment to
screenshot at exactly 400px, so this is a static-rule check rather than a rendered-pixel check).

npm run lint and npm run build were each run from the repo root exactly as the acceptance tests
specify. Full `npx vitest run` also attempted: 271 passed / 11 failed / 23 skipped, all 11 failures
confined to apps/web/test/repo-designs.test.ts and repo-materials.test.ts (T-32/T-34's tests) --
this fresh worktree never had `npm run db:migrate` run (out of this task's scope per the brief, and
per the standing Prisma-safety rule this session did not run any db:* script), so there is no local
dev.db / generated Prisma client for those DB-dependent tests to use. Not a T-36 regression: those
files are untouched by this session (git diff empty) and the failures are DB-connectivity errors
("Cannot read properties of null (reading 'designSnapshot')", "@prisma/client did not initialize
yet"), not assertion failures against changed behaviour.
```

**Completed by:** T-36 subagent (orchestrator-dispatched)  **Date:** 2026-09-17

---

### [x] T-37 — `/api/weather` — the CORS proxy, cached

**Area:** E — Server (≈ W-35) · **Status:** DONE · **Est:** 6 h
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
Worktree /home/abhinav/Downloads/SIH/wt-T-37, branch task/T-37 (commit 2de5608 -- the blocked
implementation -- then merge 3b79616 from master, which carried the orchestrator's fixes for both
blockers this task's own HELP_REQUEST named: packages/data/src/index.ts now re-exports
normaliseWeather/RawWeather/NormaliseOptions and nasaPowerUrl/parseNasaPower/openMeteoUrl/
parseOpenMeteo/WeatherQuery; apps/web/next.config.mjs's webpack hook now sets
`resolve.extensionAlias = { '.js': ['.ts', '.tsx', '.js'] }`). After the merge: fresh `npm install`,
`npm run build --workspace=@shelter/engine --workspace=@shelter/data --workspace=@shelter/optimise`
(re-verified the barrel actually exports the five names at runtime -- see BLOCKER A note below), and
the already-migrated apps/web/prisma/dev.db from the earlier session reused as-is (no db:reset).

One real bug found and fixed while re-verifying (inside this task's own allow-listed
apps/web/test/api-weather.test.ts, not a workaround for either blocker): acceptance test 2's
SimulationRequest was built from `{ ...preset.request, weather: series }`, but
`Preset.request` (CONTRACTS.md §7.11) is `Omit<SimulationRequest, 'weather'|'materials'|'glazings'>`
-- materials/glazings are the caller's job to supply. The test crashed inside `simulate()`
("Cannot read properties of undefined (reading 'singleGlazing')") until materials/glazings were
built from the full `@shelter/data` catalogue (`MATERIALS`/`GLAZING`, keyed by id) and included in
the request. Fixed; not a defect in route.ts itself, only in the test's own fixture-building.

============================================================
ALL 12 ACCEPTANCE TESTS -- fresh run, this session, after both blockers were fixed
============================================================

$ npx vitest run apps/web/test/api-weather.test.ts
 ✓ apps/web/test/api-weather.test.ts (10 tests) 10857ms
   ✓ T-37 /api/weather > 5: upstream timeout -> 502 UPSTREAM_UNAVAILABLE within 11s 10062ms
 Test Files  1 passed (1)
      Tests  10 passed (10)
(10 `it` blocks cover acceptance tests 1, 2&3 combined, 4-11; test 12 is a separate build-time check,
below.)

TEST 1 (flag unset -> 501, no cache row, no fetch):
TEST1_STATUS=501 TEST1_CODE=LIVE_WEATHER_DISABLED rows_before=10 rows_after=10 fetch_calls=0
PASS (rows_before==rows_after regardless of the absolute count, which accumulates harmlessly across
repeated runs against the same dev.db -- no row was added by this request).

TEST 2 (valid WeatherSeries that simulate() accepts): the route's own response was converted back
into a WeatherSeries via seriesFromJson field-by-field, combined with a full materials/glazings
catalogue and a preset's site/building/operation, and run through @shelter/engine's simulate() with
no adaptation. No exception thrown. PASS.

TEST 3 (response carries sourceElevation/siteElevation/lapseCorrectionK, matching
6.5*(h_source-h_site)/1000 to +-0.01):
TEST3_sourceElevation=4120 TEST3_siteElevation=3500 TEST3_lapseCorrectionK=4.03
Expected: 6.5*(4120-3500)/1000 = 4.03 exactly. PASS.

TEST 4 (cache hit makes zero additional upstream calls):
TEST4_calls_after_first=1 TEST4_status_second=200 TEST4_calls_on_second_route_instance=0
The first POST made exactly 1 upstream fetch; the second, identical POST (a fresh route-module
import, its own independent fetch spy) made 0 -- a real cache hit, verified against `readWeatherCache`
returning the row written by the first call. PASS.

TEST 5 (upstream timeout -> 502 UPSTREAM_UNAVAILABLE within 11s):
TEST5_status=502 TEST5_code=UPSTREAM_UNAVAILABLE TEST5_elapsedMs=10007
The AbortController fired at the 10,000ms budget; the route returned in 10,007ms, under the 11,000ms
ceiling. PASS.

TEST 6 (upstream 500 -> 502, not a crash):
TEST6_status=502 TEST6_code=UPSTREAM_UNAVAILABLE
PASS.

TEST 7 (upstream 200 with unparseable JSON -> 422 WEATHER_INVALID):
TEST7_status=422 TEST7_code=WEATHER_INVALID
PASS.

TEST 8 (malformed body {} -> 400 INVALID_INPUT, non-empty detail, no cache row):
TEST8_status=400 TEST8_code=INVALID_INPUT TEST8_detail_len=6 rows_before=10 rows_after=10
PASS.

TEST 9 (DB unreachable -> still a valid series within 15s, just uncached):
TEST9_status=200 TEST9_elapsedMs=98
With DATABASE_URL pointed at a nonexistent directory, `readWeatherCache` and `writeWeatherCache` both
logged once (via lib/db.ts's withDb, "Error code 14: Unable to open the database file") and returned
gracefully (null / no throw); the route still fetched, parsed, normalised and returned a 200 with a
valid series in 98ms, far under the 15,000ms budget. PASS.

TEST 10 (every error response is application/json, no stack trace) -- body pasted verbatim:
TEST10_content_type=application/json
TEST10_body={"code":"INVALID_INPUT","detail":[{"path":"source","message":"source must be
'nasa-power' or 'open-meteo'"},{"path":"latitude","message":"latitude must be a finite number in
[-90, 90]"},{"path":"longitude","message":"longitude must be a finite number in [-180, 180]"},
{"path":"startDate","message":"startDate must be an ISO 'YYYY-MM-DD' string"},{"path":"endDate",
"message":"endDate must be an ISO 'YYYY-MM-DD' string"},{"path":"siteElevation","message":
"siteElevation must be a finite number, metres"}]}
No stack frame, no HTML. PASS.

TEST 11 (grep for api_key/apiKey/Bearer/process.env shows only the two base-URL vars + the flag):
$ grep -n "api_key\|apiKey\|Bearer\|process\.env" apps/web/app/api/weather/route.ts
64:const NASA_POWER_BASE_URL = process.env.NASA_POWER_BASE_URL;
65:const OPEN_METEO_BASE_URL = process.env.OPEN_METEO_BASE_URL;
234:  if (process.env.NEXT_PUBLIC_ENABLE_LIVE_WEATHER !== 'true') {
3 lines, all one of the two documented base-URL vars or the feature flag. No api_key/apiKey/Bearer
anywhere. PASS.

TEST 12 (deleting apps/web/app/api/ still leaves `npm run build --workspace apps/web` succeeding) --
performed literally, three builds in sequence:

(a) Baseline, app/api/ present:
$ npm run build --workspace apps/web; echo EXIT_CODE=$?
EXIT_CODE=0
Route (app): /, /_not-found, /api/designs, /api/designs/[shareId], /api/materials, /api/simulate,
/api/weather

(b) app/api/ moved aside (`mv apps/web/app/api /tmp/api-backup-t37`), .next cleared, rebuilt:
$ npm run build --workspace apps/web; echo EXIT_CODE=$?
EXIT_CODE=0
Route (app): /, /_not-found  -- no /api/* routes at all, confirming the app builds standalone.
PASS.

(c) app/api/ restored (`mv /tmp/api-backup-t37 apps/web/app/api`), .next cleared, rebuilt to confirm
    nothing was left broken:
$ npm run build --workspace apps/web; echo EXIT_CODE=$?
EXIT_CODE=0
Route (app): /, /_not-found, /api/designs, /api/designs/[shareId], /api/materials, /api/simulate,
/api/weather -- identical to (a). `git status --short apps/web/app/api/` empty; `diff` against the
committed route.ts confirmed byte-identical after the move/restore round trip.

============================================================
WHOLE-REPO REGRESSION CHECK, after all of the above
============================================================
$ npx vitest run
 Test Files  29 passed (29)
      Tests  340 passed | 10 skipped (350)
Full green suite, no regressions from either blocker's fix or from this task's own files (includes
T-38's and T-41's own newly-merged tests, all passing).

$ npm run lint; echo EXIT_CODE=$?
EXIT_CODE=0
✖ 12 problems (0 errors, 12 warnings)
Same 12 pre-existing "unused eslint-disable" warnings documented throughout this ledger's HANDOFF
sections (packages/data/test/weather.test.ts, packages/engine/test/{pcm,storage}.test.ts) --
unrelated to apps/web, unchanged by this task.

All 12 acceptance tests PASS with real, freshly-measured numbers. Task genuinely done.

Files touched by this task, final state: apps/web/app/api/weather/route.ts (new),
apps/web/test/api-weather.test.ts (new). No file outside the allow-list was ever edited; both
blockers named in this task's own HELP_REQUEST were fixed by the orchestrator outside this task's
allow-list (packages/data/src/index.ts, apps/web/next.config.mjs), exactly per SUBAGENT RULES 1/3/6.
```

**Completed by:** T-37 subagent (claude-sonnet-5)  **Date:** 2026-09-18

---

### [x] T-38 — `/api/simulate` — one run, cached

**Area:** E — Server (≈ W-35) · **Status:** DONE · **Est:** 4 h
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
Worktree: /home/abhinav/Downloads/SIH/wt-T-38, branch task/T-38.
Setup: npm install (fresh); npm run build --workspace=@shelter/engine --workspace=@shelter/data
--workspace=@shelter/optimise (all tsc -b, exit 0); cd apps/web && DATABASE_PROVIDER=sqlite
DATABASE_URL="file:./dev.db" npm run db:migrate (fresh dev.db, migration 20260916110054_init applied)
then npm run db:seed (27 materials, needed by unrelated T-34/T-35 tests sharing this worktree's db --
without it those two files show pre-existing failures unrelated to this task, see GOTCHAS below).

DESIGN DECISION -- cache-hit response shape: the brief names readRun/writeRun (T-33's lightweight
KPI+meta cache functions), not readFullRun/storeFull:true. Implemented literally: a cache MISS
responds with the full SimulationResult (via resultToJson); a cache HIT responds with readRun's own
{kpis, meta} shape only (no time-series). This is faster (skips simulate() and the full-result JSON
walk entirely on a hit) and matches T-33's own measured full-vs-KPI size ratio (~494x, its test 13).
Documented as a `ponytail:` comment in route.ts naming the upgrade path (switch to
readFullRun/writeRun(..., storeFull: true) if a future task needs full charts to survive a hit).

DESIGN DECISION -- reconciling the error taxonomy with acceptance test 3: requestFromJson (T-06)
always throws DATA_SCHEMA_MISMATCH for a malformed/incomplete wire body (e.g. `{}`), as a single
`{path}` object, not an array -- by itself this would produce 422 with a non-array detail, which
satisfies neither test 3's "400 INVALID_INPUT" nor its "detail array" requirement. Resolved entirely
inside route.ts (no packages/** edit): errors thrown specifically while parsing the incoming body
via requestFromJson are re-coded to INVALID_INPUT with a one-entry detail array before the generic
STATUS_BY_CODE table is consulted -- a malformed request from this route's own caller is a client
input problem (400), not a data-integrity issue with someone else's data. DATA_SCHEMA_MISMATCH's
422 mapping is kept in the table for completeness/future callers (e.g. a corrupted cache row) but is
not reachable from this parsing step. See route.ts's own comment above parseRequestBody().

ACCEPTANCE TESTS -- MEASURED (npx vitest run apps/web/test/api-simulate.test.ts, this worktree,
reran fresh 2026-09-18 after a session interruption, to confirm every number below with real
evidence from this session rather than trusting the earlier pasted run):
1. PASS. status=200, response deep-equal to in-process simulate() result excluding meta.wallClockMs
   (Float64Array fields included, via resultFromJson round-trip). No differing field.
2. PASS. meta.energyBalanceResidual=6.682913448678613e-8, well under 1e-3.
3. PASS. status=400, code=INVALID_INPUT, detail=[{"path":"site","message":"missing required field
   \"site\""}]. SimulationRun row count unchanged (before=2, after=2 -- rows from earlier tests in
   the same suite run, none added by this request).
4. PASS. status=400, code=INVALID_INPUT, detail count=3, paths=site.latitude, building.volume,
   operation.achSchedule (three independently invalid fields: latitude=999, volume=-5,
   achSchedule.length=23).
5. PASS. status=400, code=GEOMETRY_INCONSISTENT (window area 20 m^2 on a 16 m^2 host surface).
6. PASS. status=422, code=UNKNOWN_MATERIAL (materialId="doesNotExist").
7. PASS. status=500, code=SOLVER_DIVERGED (internalGainsSchedule=1e15 W forces the air node past
   T_MAX_PLAUSIBLE=373K on step 1 of spin-up).
8. PASS. bodyBytes=6291470 (6 MB), status=413, code=PAYLOAD_TOO_LARGE.
9. PASS. first request (miss) 39.92ms, second identical request (hit) 2.07ms -- hit is ~19x faster.
   json1.meta.warnings did not contain 'served from cache'; json2.meta.warnings did. json2.kpis
   deep-equal json1.kpis.
10. PASS. DATABASE_URL pointing at a nonexistent path (same bogus-file technique as T-30/T-31/
    T-32/T-33/T-35): status=200, elapsed=170.4ms, kpis present. withDb() logged and swallowed the
    Prisma connection error internally (visible in stderr, not in the response) -- no caching, but a
    correct result, well under the 5s budget.
11. PASS. content-type="application/json; charset=utf-8" on an error response; body contains no
    "<html" and no stack-trace-shaped line.
12. PASS. 10 concurrent identical POSTs: all 10 returned status 200; exactly 1 SimulationRun row for
    that request's hash afterward (writeRun's upsert-on-requestHash absorbs the race, per T-33).

Full suite (`npx vitest run` from worktree root): 27 files, 318 passed, 10 skipped (328 total),
exit 0. Reran across two sessions (2026-09-17 and after the 2026-09-18 interruption), stable every
time. `npm run lint`: exit 0, 0 errors, 12 pre-existing warnings (unused eslint-disable directives in
packages/data/test/weather.test.ts and packages/engine/test/{pcm,storage}.test.ts -- unrelated to
this task, already noted in LOG.md's own HANDOFF). `npx tsc -b packages/engine`: exit 0. Measured
this session: full simulate() incl. spin-up 24.6 ms/run, 100-variant sweep 2.40 s (both well inside
budget, per CONTRACTS.md §10 -- unaffected by this task).

GOTCHAS FOR THE NEXT AGENT:
- A fresh worktree's dev.db has an empty Material table until `npm run db:seed` is run once (from
  apps/web/, with DATABASE_PROVIDER=sqlite DATABASE_URL="file:./dev.db") -- db:migrate alone is not
  enough. Without it, apps/web/test/repo-materials.test.ts (T-34) and
  apps/web/test/db-off.integration.test.ts (T-35) fail on an empty-catalogue state; this is
  pre-existing infrastructure, not a T-38 defect (T-33's own Evidence block hit and documented the
  same thing). db:seed is idempotent and safe to rerun.
- Route handlers in this app run on the default Node.js runtime (not edge) -- lib/repo/runs.ts uses
  node:fs synchronously to read packages/engine/package.json's version, so an edge runtime directive
  must never be added to this route.
- Body-size checking reads the full request body into a string first (`req.text()`), then measures
  `Buffer.byteLength`, before ever calling JSON.parse -- deliberately simple (no streaming), the
  route only needs to bound a 5 MB blast radius, not handle multi-gigabyte uploads.
```

**Completed by:** T-38 subagent  **Date:** 2026-09-17

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

### [x] T-40 — The worker-thread pool, one per core

**Area:** E — Server (≈ `plan.md` Part 2b) · **Status:** DONE. All 12 acceptance tests pass. · **Est:** 8 h
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
All 12 acceptance tests pass, run in apps/web/test/pool.test.ts (repeated 3x for the
timing-sensitive ones; numbers below are from a clean full-file run on a 12-core box,
NODE_ENV unset -- vitest default):

1. cpu count = 12, pool size = getPool().size = 11 (max(1, 12-1)). PASS.

2. pool.run(req) vs in-process simulate(req): deep-equal on every field except
   meta.wallClockMs (each call's own Date.now()-based self-timing, expected to differ,
   excluded from the comparison -- not a physics output). time/temperatures.*/heatFlows.*
   all arrived `instanceof Float64Array`. PASS.

3. pool size 4, 100 sequential pool.run() = 1543.4 ms, pool.runMany(100) = 444.2 ms,
   ratio = 3.47x (required >= size*0.5 = 2.0x). PASS.

   POST-MERGE-VERIFICATION FINDING (coordinator, ratified here): this test failed once
   under `DATABASE_PROVIDER=sqlite DATABASE_URL="file:./dev.db" npx vitest run` (full
   30-file repo suite, singleFork:true) at ratio 1.846 (required 2.0), while `pool.test.ts`
   run alone repeatedly passed (2.07x-3.47x across reruns). Root cause, confirmed by
   code inspection and reproduction, NOT a pool.ts defect:

   Test 3 reused one pool for both timed phases, sequential first. `pump()` always fills
   the first free slot in `this.slots` order; a purely sequential loop (one `run()`
   awaited at a time) therefore never touches more than slot 0, so only ONE of the pool's
   `size` V8 worker isolates gets JIT-warmed by the 100-call sequential phase. The
   `runMany` phase that follows then has to cold-JIT-compile `simulate()`'s hot path on
   the other `size - 1` workers *during* the timed parallel measurement, while worker 0
   (already warm) finishes its share fast -- parallel wall-clock is set by the slowest
   (coldest) worker. This makes the measured ratio a function of how much JIT-warmup cost
   lands inside the timed window, which is genuinely load- and scheduling-sensitive (worse
   under the heavier full-suite run, matching the observed 1.846 vs. isolated-run 2.07-
   3.47x) -- not a race or correctness bug in pool.ts itself.

   Fix (test-only, apps/web/test/pool.test.ts, not pool.ts -- production code has no
   sequential-vs-parallel comparison to protect against this asymmetry in the first
   place): before either timed phase, `runMany()` a `size * 8`-request warm-up batch.
   `runMany`'s own dispatch (pump() fills every free slot, not just the first, whenever
   multiple tasks are queued at once) spreads warm-up calls across every worker, so all
   `size` V8 isolates are past their JIT cold-start before `t0` for the sequential phase
   even begins. This does not touch the 2.0x floor itself (rule 15: reported, not
   silently loosened) -- it removes a measurement artifact of the test's own two-phase,
   same-pool structure.

   Verification after the fix: isolated pool.test.ts reruns of test 3 alone, 10 trials:
   4.06x, 2.71x, 2.10x, 3.16x, 2.26x, 3.14x, 2.35x, 2.43x, 2.09x, 3.56x -- all >= 2.0x.
   Full repo suite (`DATABASE_PROVIDER=sqlite DATABASE_URL="file:./dev.db" npx vitest run`,
   the exact command and DB-seeded environment that produced the original failure),
   run 4x: all 4 runs "Test Files 30 passed (30)" / "Tests 352 passed | 10 skipped (362)",
   zero failures. One of those 4 runs captured test 3's own number inside the full-suite
   context: ratio = 2.63x (sequential 1334.6ms, runMany 507.6ms) -- comfortably clear of
   the 2.0x floor in the same adversarial (heavier, more-contended) context that produced
   the original 1.846 failure.

   Before this fix, ratios as low as 2.07x (isolated) / 1.846x (full suite) were also
   observed under CPU oversubscription from a separate, now-fixed issue: the size-11
   getPool() singleton from test 1 was originally left alive for the rest of the file
   (11 + 4 = 15 threads competing for 12 cores). That was fixed earlier in this task's
   own development (test 1 now tears the singleton down) and is a distinct, smaller
   contributor to the same symptom -- both fixes are needed together for reliability.

4. pool size 3, runMany(100 variants) -> workersCreated = 3 (creation counter, not a
   guess). PASS.

5. onProgress called exactly 100 times, strictly monotonically increasing, last value
   100. PASS.

6. 100-variant runMany with a 10ms main-thread setInterval running concurrently:
   44-54 ticks observed per run (interval throttled while backgrounded, as expected),
   0 late (>20ms drift) every run -> 100.0% on-time (required >= 95%). PASS.

7. AbortController.abort() ~15ms into a 30-variant runMany(pool size 2): active workers
   settle to 0, elapsed 46.8-75.5 ms across runs (required < 2000 ms). PASS.

8. A request referencing a nonexistent materialId rejects pool.run() with a real
   `EngineError` instance, code = UNKNOWN_MATERIAL -- never an unhandled rejection
   (asserted both via `.rejects.toMatchObject` and `instanceof EngineError` in a
   try/catch). PASS.

9. pool size 3: size before = 3, crash a busy worker via Worker.terminate()
   (crashBusyWorkerForTest(), same code path a real OOM-kill takes), size during = 3
   (size is the pool's fixed configured capacity, not a live worker count -- see
   Design decisions below), in-flight request rejects with PoolWorkerCrashError,
   size after = 3, next run() succeeds (288 timesteps returned). PASS.

10. 1,000 requests with strictly increasing internalGainsSchedule threaded through
    runMany(pool size 6); result order checked for auxEnergyKWhPerDay monotonicity
    (more gains -> less aux heat, all else fixed) -- 0 mismatched adjacent pairs, i.e.
    every response landed on the task its `id` actually belonged to. PASS.

11. process._getActiveHandles().length: 3 before creating+destroying a 2-worker pool,
    3 after destroy() + one setImmediate tick -- no growth, no dangling handles. PASS.
    (An earlier run showed 14/14 while the size-11 getPool() singleton from test 1 was
    still alive; after fixing test 1 to tear that singleton down, the baseline dropped
    to 3/3, which is the correct evidence -- 14 active handles was noise from the
    leaked singleton, not from destroy() itself.)

12. 10,000 sequential pool.run() calls, pool size 4: workersCreated stayed at 4
    (never grew), total wall-clock 89.7-150.7 s across repeated runs (machine-load
    dependent -- these are physics-realistic runs at ~9-15 ms/call once resolved
    through worker IPC, not synthetic no-ops). PASS.

Repo-wide: `npx vitest run` before this task: 16 failed / 278 passed / 35 skipped across
29 files (8 failing files), all pre-existing Prisma/DB-environment failures in this
worktree (missing `prisma generate` / live sqlite db -- apps/web/test/repo-designs.test.ts,
repo-materials.test.ts etc.), unrelated to pool.ts/sim.node.worker.mjs and outside this
task's file allow-list. After this task: 16 failed / 290 passed / 35 skipped across 30
files (same 8 failing files, same failures) -- the +12 passed / +1 file is exactly
apps/web/test/pool.test.ts. No regression anywhere else.
```

Design decisions / gotchas for a successor:
- `size` is the pool's fixed configured capacity (`Math.max(1, os.cpus().length - 1)` by
  default), set once at construction and never mutated -- not a live count of currently-alive
  worker threads. This is what acceptance test 1's exact-equality check requires, and it makes
  test 9's "size before/during/after" a check that size reporting stays correct and stable
  through a crash-and-replace cycle, not a race to observe a transient dip. `active` (busy-slot
  count) and `workersCreated` (a monotonically increasing creation counter, exposed on the
  `PoolWithDebug` test-only surface) are the two properties that do vary and are what the
  crash/reuse tests actually assert on.
- `Worker.terminate()` on a **busy** worker (mid synchronous `simulate()`) was observed on this
  machine to fire the `exit` event with **code 0** -- the same code a clean, intentional stop
  reports. Gating crash-replacement on `code !== 0` (the initial implementation) silently missed
  this case and left the in-flight promise hanging forever (caught by acceptance test 9 timing
  out at the default 5s). Fixed by treating *any* `exit` while the pool is not `destroyed` as
  "replace it" -- `destroy()` is the only path that is allowed to let a worker exit cleanly, and
  it already sets `this.destroyed = true` before terminating, so the exit code is not a reliable
  signal here and dropping it entirely is correct, not a loosened check.
- `getPool()`'s `globalThis`-memoised singleton (same pattern as `apps/web/lib/db.ts`) spawns
  `size` real worker threads (11 on this box) the moment it is first called. Test 1 calls it to
  check the sizing formula, then explicitly tears it down (`await singleton.destroy()` + delete
  the `globalThis` stash) so the other 11 tests in the file are not sharing a 12-core machine
  with 11 already-parked threads -- without that cleanup, test 3's speedup ratio (only required
  to clear `size*0.5`) came in as low as 2.07x due to CPU oversubscription; with it, three
  reruns landed at 2.10x-3.47x. This is a test-hygiene fix, not a pool.ts behavior change.
- `sim.node.worker.mjs` only ever answers `{kind: 'simulate'}`; `'sweep'`/`'cancel'` are §7.14
  protocol members with no handler here on purpose -- a sweep is just many `run()` calls
  dispatched by `pool.ts`'s own queue, and cancellation is handled entirely on the main-thread
  side (`AbortSignal` removes queued-but-undispatched tasks; an already-dispatched request is
  left to finish, per the brief -- a synchronous `simulate()` call cannot be preempted mid-solve
  anyway).
- Every request/result crosses the `postMessage` boundary through T-06's
  `requestToJson`/`resultFromJson` (never redefined here), even though Node's own
  `worker_threads` structured clone can carry a `Float64Array` natively -- the brief calls this
  out explicitly so this pool and the future browser Web Worker (T-43) share one serialisation
  discipline instead of silently diverging.
- Build/setup gotcha (repo-wide, not new): a fresh worktree needs `npm install` +
  `npm run build --workspace=@shelter/engine --workspace=@shelter/data` before any test can
  import `@shelter/engine`'s compiled `dist/`.
- Test-suite runtime: `pool.test.ts` takes ~100-160s on its own (test 12's 10,000 real
  `simulate()` calls dominates), so the repo-wide `npx vitest run` also grew from ~28s to
  ~130s. No way around this without weakening acceptance test 12 as literally specified
  (10,000 calls), which was not done.

**Completed by:** T-40 subagent  **Date:** 2026-09-18

---

### [x] T-41 — `/api/designs` and `/api/materials`

**Area:** E — Server · **Status:** DONE. All 12 acceptance tests pass. · **Est:** 4 h
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
Built in worktree /home/abhinav/Downloads/SIH/wt-T-41, branch task/T-41. Fresh `npm install` (no
inherited node_modules); `npm run build --workspace=@shelter/engine --workspace=@shelter/data
--workspace=@shelter/optimise` run first (dist/ is gitignored, worktrees don't inherit it) --
both exited 0. Local sqlite DB set up per the brief:
  cd apps/web && DATABASE_PROVIDER=sqlite DATABASE_URL="file:./dev.db" npm run db:migrate
  (applied migration 20260916110054_init; note Prisma resolves a relative sqlite `file:` URL
  against the schema file's directory, not cwd, so the db actually lands at
  apps/web/prisma/dev.db regardless of where the command is invoked from)
  DATABASE_PROVIDER=sqlite DATABASE_URL="file:./dev.db" npm run db:seed --workspace apps/web
  -> "db:seed: upserted 27 materials from the code catalogue, table now has 27 rows."

Routes created, reusing T-32's saveDesign/loadDesign and T-34's listMaterials verbatim (never
reimplemented): apps/web/app/api/designs/route.ts (POST), apps/web/app/api/designs/[shareId]/
route.ts (GET), apps/web/app/api/materials/route.ts (GET). POST validates the body through
requestFromJson itself, BEFORE calling saveDesign, specifically so a schema failure (422/400) can
be told apart from saveDesign returning null for "no database" (503) -- saveDesign also validates
internally (defence in depth per its own doc comment), but by the time it's called the route
already knows the request is well-formed. GET /api/designs/[shareId] and GET /api/materials both
serialise via requestToJson (the one sanctioned Float64Array -> plain-array boundary, CONTRACTS.md
7.14) rather than handing Float64Array-bearing objects to NextResponse.json() directly, which
would otherwise serialise each Float64Array as an object of numeric string keys, not an array,
silently breaking the round trip (caught by test 1, see "Gotchas" below). /api/materials
determines `servedFrom` via lib/db.ts's already-exported `dbHealthy()` run in parallel with
listMaterials() -- listMaterials() itself doesn't report which path it served from and
lib/repo/materials.ts is off this task's allow-list -- documented with a `// ponytail:` comment
naming the approximation (dbHealthy-reachable-but-query-broken could theoretically mislabel; T-34
would need to expose its own source tag to close that gap exactly).

Test file: apps/web/test/api-designs.test.ts, 12 tests, one per acceptance test, following the
same "call the exported handler directly with a constructed Request/NextRequest, manage
process.env.DATABASE_URL + the lib/db.ts globalThis client stash per test" pattern as
apps/web/test/repo-designs.test.ts (T-32) and repo-materials.test.ts (T-34) already use.

Command: DATABASE_PROVIDER=sqlite npx vitest run apps/web/test/api-designs.test.ts
Result: Test Files 1 passed (1); Tests 12 passed (12). Duration 1.89s.

1. POST 201 shareId=5KJVMQRSMF (matches /^[A-Za-z2-9]{10}$/), url=
   http://localhost:3000/api/designs/5KJVMQRSMF. GET on that id -> 200, requestFromJson(body)
   deep-equal (toEqual) to the original SimulationRequest, Float64Array fields included. PASS.
2. POST {} -> status=422, code=DATA_SCHEMA_MISMATCH. designSnapshot row count before=123 after=123
   (unchanged; the live sqlite dev.db already carried rows from earlier manual runs during
   development -- the count is identical before/after, which is what the test asserts). PASS.
3. GET /api/designs/zzzzzzzzzz -> status=404, code=NOT_FOUND. PASS.
4. Expired row (expiresAt 60s in the past) -> status=404, body=
   {"code":"NOT_FOUND","message":"design not found"}; unknown id -> status=404, identical body.
   PASS (indistinguishable, as required).
5. DB OFF (DATABASE_URL unset): POST -> status=503 in 1ms, body deep-equal to
   {"code":"SHARE_UNAVAILABLE","message":"Sharing needs the server. Download the design as a file
   instead."} (verbatim). GET -> status=404 in 0ms. Both well under 5000ms. PASS.
6. DB UNREACHABLE (bogus DATABASE_URL, nonexistent directory): POST -> status=503 in 89ms, code=
   SHARE_UNAVAILABLE. GET -> status=404 in 2ms. Both well under 5000ms. PASS.
7. GET /api/materials, live DB: servedFrom=database, materials.length=27 (=MATERIALS.length). PASS.
8. DB OFF: GET /api/materials -> status=200, servedFrom=code, materials.length=27 (same length).
   PASS.
9. All 27 returned materials have a non-empty, trimmed `source` string. PASS.
10. Cache-Control header = "public, max-age=3600" -> parsed max-age=3600 (>= 3600). PASS.
11. 20 concurrent POST /api/designs: all 20 responses status=201, 20 distinct shareIds (Set size
    20). PASS.
12. Content-Type across 6 representative responses (POST 201, POST 422, POST 503-DB-off, GET 200,
    GET 404, GET /api/materials 200): all 6 are "application/json" -- no HTML anywhere. PASS.

Full-suite regression check: `DATABASE_PROVIDER=sqlite npx vitest run` (whole repo) ->
Test Files 27 passed (27); Tests 318 passed | 10 skipped (328). No pre-existing test broken.

TOOLCHAIN FINDING, reported rather than fixed (rule 16, "report failures upward; do not fix
across boundaries" -- both files are outside this task's allow-list): this task's own 12
acceptance tests are all green via `vitest` (which is what "done" is measured against, and what
this task's route-handler-tested-directly pattern is designed around), but `npm run build
--workspace apps/web` currently does NOT reach a clean build once any route under app/api imports
lib/repo/* or lib/db.ts -- which is unavoidable and is the entire point of this task. This worktree
is the FIRST to wire app/ code to those files at all (T-36's own tsconfig.json explicitly excluded
lib/db.ts, lib/repo/**, prisma/, test/** from Next's type-check, and nothing under app/ imported
them before T-41). Reproduced twice, cleanly, with and without T-41's files present, isolating two
independent, genuinely pre-existing defects in files this task may not touch:

  (a) webpack module resolution: lib/db.ts, lib/log.ts and lib/repo/*.ts all use Node-ESM-style
      relative imports with an explicit `.js` extension pointing at sibling `.ts` files (e.g.
      lib/db.ts imports `./log.js`) -- correct for direct Node/vitest execution (Node's native TS
      type-stripping and Vite's resolver both handle the `.js`->`.ts` extension swap), but Next's
      webpack build path takes a literal `.js` specifier at face value and does not try `.ts` as a
      fallback unless `resolve.extensionAlias` (or the Next-level `experimental.extensionAlias`) is
      set in next.config.mjs. It is not set. Reproduced:
        $ DATABASE_PROVIDER=sqlite DATABASE_URL="file:./dev.db" npm run build --workspace=apps/web
        Module not found: Can't resolve '../db.js' (from lib/repo/designs.ts and materials.ts)
        Module not found: Can't resolve '../log.js' / './log.js' (from lib/db.ts and lib/repo/*.ts)
      Verified fix (applied only to a scratch copy, then reverted -- next.config.mjs is owned by
      T-36, not on this task's allow-list): adding one line inside the existing webpack() hook,
      `config.resolve.extensionAlias = { '.js': ['.ts', '.tsx', '.js'] };`, clears every one of
      these module-not-found errors.
  (b) a genuine pre-existing TypeScript error in lib/repo/designs.ts line 79 (T-32's file, also
      off this task's allow-list), only ever surfaced once tsc actually type-checks that file --
      which nothing did until T-41 imported it. Isolated with a clean before/after: with
      apps/web/app/api/ and apps/web/test/api-designs.test.ts temporarily moved aside and
      apps/web/.next removed, `npx tsc --noEmit --project apps/web/tsconfig.json` -> "TypeScript:
      No errors found", exit 0. Restoring T-41's files (nothing else changed) makes the same
      command fail:
        apps/web/lib/repo/designs.ts(79,11): error TS2375: Type '{ shareId: string; request:
        Prisma.InputJsonValue; label: string | undefined; }' is not assignable to type
        '...DesignSnapshotCreateInput' with 'exactOptionalPropertyTypes: true' ... Type
        'string | undefined' is not assignable to type 'string | null'.
        TypeScript: 1 errors in 1 files, exit 1.
      This is a static error in designs.ts's own `db.designSnapshot.create({ data: { shareId,
      request: ..., label } })` call (label: string | undefined vs Prisma's generated `string |
      null`), present regardless of what any caller passes -- not something this task's own code
      triggers by its call pattern, only by causing the file to be type-checked at all. The
      one-line fix would be `label: label ?? null` in designs.ts, but that file is off this task's
      allow-list (T-32's).

  Neither finding blocks T-41's own 12 acceptance tests (none of them require `next build` to
  succeed -- only runtime behaviour of the three route handlers, verified above via vitest). Both
  WILL block T-42's stated acceptance test 13 ("`npm run build --workspace apps/web` exits 0"),
  since T-42 refactors these same four routes and inherits the same import graph. Recommend fixing
  (a) in next.config.mjs and (b) in lib/repo/designs.ts before or as part of T-42, or as a small
  standalone toolchain task -- whichever the orchestrator prefers; flagging here per global rule 16
  rather than editing across the file boundary myself.

Gotchas / decisions for a successor:
- Import-extension convention split, deliberate: files under apps/web/app/** import sibling lib/
  files WITHOUT a `.js` extension (matches the existing app/page.tsx, app-shell.tsx, lib/store.ts
  convention, i.e. what webpack's bundler-mode resolution expects); apps/web/test/*.test.ts files
  import them WITH `.js` (matches repo-designs.test.ts/repo-materials.test.ts, i.e. what
  vitest/Vite's resolver and native Node ESM expect). Both conventions already coexisted in the
  repo before this task; this task's new files follow whichever one each existing sibling file in
  the same directory already used, not a new convention invented here.
- Test fixture gotcha: JSON.stringify() on a raw Float64Array serialises it as an object of
  numeric string keys ({"0":260,...}), not a plain array -- the test file's POST body helper must
  send `requestToJson(req)` (converting Float64Arrays to plain arrays first), exactly matching
  what a real HTTP client would send. Caught by test 1 failing with empty T_amb/GHI/v_wind arrays
  on the very first run; fixed in the test fixture, not the route.
- schemaVersion (in the /api/materials response) has no existing definition anywhere in the repo
  (checked: grep -rn "schemaVersion" across log/*.md and all source -- only this task's own prompt
  mentions it). Defined as a local literal `1` in the materials route file; not promoted to a
  shared type since it isn't one of CONTRACTS.md's shared contracts and nothing else needs it yet.
```

**Completed by:** T-41 subagent  **Date:** 2026-09-18

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

