> This file is one Area of the ShelterSim build ledger. The index and full file map are in
> `LOG.md` at the repo root. Shared contracts, constants and the eleven heat pathways referenced
> below as "§7.x" live in `log/CONTRACTS.md` (§7–§10 of the original single-file ledger).
> References to "§5" or "§6" below mean the corresponding section still in `LOG.md`.
> Read `log/CONTRACTS.md` once per session (per the ritual in `LOG.md` §2), not once per task.

---

# AREA C — DATA LAYER

> Everything here lives in a new package `packages/data` (`@shelter/data`), which has **zero runtime
> dependencies** — TMY payloads are JSON files in the repository. It must never import
> `@prisma/client` (global rule 17); the database *serves* this data, it does not *own* it.

---

### [x] T-24 — Material, glazing and construction catalogues, every row cited

**Area:** C — Data (≈ W-26) · **Status:** DONE · **Est:** 8 h
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
1. MATERIALS 27/27, GLAZING 6/6, CONSTRUCTIONS 11/11 all have non-empty source. PASS.
2. Ids unique: MATERIALS 27/27, GLAZING 6/6, CONSTRUCTIONS 11/11. PASS.
3. Every k, rho, c > 0; every alphaSolar/emissivity in [0,1], all 27 materials. PASS.
4. rammed earth k=1.00 rho=1900 c=880; EPS k=0.036 rho=20 c=1400; single glazing U=5.80 SHGC=0.86
   b0=0.04; water c=4186; steel k=50 rho=7800 c=480. All exact. PASS.
5. Diffusivity k/(rho*c): dense concrete 8.285984848484849e-7 (target 8.29e-7, |diff|=4.02e-10);
   rammed earth 5.980861244019139e-7 (target 5.98e-7, |diff|=8.61e-10); fired clay brick
   4.491017964071856e-7 (target 4.49e-7, |diff|=1.02e-10). All < 1e-9. PASS.
6. materialById('nope') throws EngineError code UNKNOWN_MATERIAL; glazingById('nope') throws
   UNKNOWN_GLAZING. PASS.
7. All four categories present: structural 10, insulation 8, finish 6, storage 3. PASS.
8. 12/27 materials locallyAvailableLadakh=true (>=6 required): mudBrickAdobe, rammedEarth,
   stoneMasonryGranite, timberPoplarWillow, compressedEarthBlock, mudPlaster, strawBale, sheepWool,
   airGap25mm, water, gravelSoilFill, whitewashLime. PASS.
9. All 11 CONSTRUCTIONS entries' layers[].materialId resolve through materialById (also enforced at
   module-load time inside constructions.ts itself). PASS.
10. rammedEarth350EpsOutside vs rammedEarth350EpsInside via @shelter/engine's buildWallMesh +
    constructionUValue (hOuter=20, hInner=8): U(outside)=0.3027754415475191 W/(m^2*K),
    U(inside)=0.302775441547519 W/(m^2*K), |diff|=1.11e-16 (floating-point identical). PASS.
11. All 27 materials have a non-empty blurb; regex for standalone k/rho/c/alpha/epsilon tokens
    matches none. PASS.
12. assertSchemaVersion(2) throws EngineError DATA_SCHEMA_MISMATCH; assertSchemaVersion(1) does not
    throw. PASS.
13. `npm run typecheck` (root script, tsc -b packages/engine, unchanged): exit 0. `npx tsc -b
    packages/data` (separate invocation -- see .work/T-24.md Deviations for why the shared script
    was not edited): exit 0. `npx vitest run`: 10 files / 126 tests, exit 0 (107 pre-existing engine
    tests + 19 new packages/data tests; engine test count unaffected -- this line's "65 tests" is
    stale text, live baseline at session start was 107). PASS.
14. packages/data/package.json has no `dependencies` key (one devDependency, @shelter/engine).
    Verified by inspection and by a test-time file read/parse. PASS.

All 14 acceptance tests PASS. Full suite: 10 files / 126 tests green, exit 0.
`npm run typecheck` exit 0; `npx tsc -b packages/data` exit 0.

Type strategy: Material/Glazing/Layer/NamedConstruction/EngineError are all defined LOCALLY inside
packages/data/src (not imported from @shelter/engine), keeping packages/data's own src/ at zero
dependencies of any kind on the engine, consistent with LOG.md 7.13's "@shelter/data: ZERO [runtime
dependencies]" and the Area E "data layer does not import physics correlations" boundary. A single
devDependency on @shelter/engine (workspace-linked, version "0.1.0", npm workspaces -- not
`workspace:*`, which is pnpm-only per D-2) is declared in packages/data/package.json solely so
catalog.test.ts can call the real buildWallMesh/constructionUValue for acceptance test 10; nothing
under packages/data/src imports it (git grep -n "@shelter/engine" packages/data/src -> 0 hits).
Full reasoning and every other deviation (the 6th glazing row, tauVis provenance, 27-vs-23 material
count, the typecheck-script boundary) is in .work/T-24.md.
```

**Completed by:** orch-T-24  **Date:** 2026-09-15

**Addendum (2026-09-16, T-25 session — does not change the record above):** test 14's assertion
("no `dependencies` key") was true when T-24 measured it and stays true as history. `CONTRACTS.md`
D-10, added this session, deliberately supersedes it: `@shelter/data` is now allowed exactly one
runtime dependency, `@shelter/engine`, so T-25's `pipeline.ts` can import Erbs/Swinbank/barometric
correlations instead of reimplementing them. `packages/data/test/catalog.test.ts`'s test 14 was
updated in the same commit that made this change to assert `dependencies` now deep-equals
`{"@shelter/engine": "0.1.0"}` rather than `undefined` — see D-10 for the full reasoning.

---

### [x] T-25 — The weather pipeline, with the mandatory lapse-rate correction

**Area:** C — Data (≈ W-27) · **Status:** DONE · **Est:** 12 h
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
`packages/data/test/weather.test.ts`, and `packages/data/package.json` (move `@shelter/engine`
from `devDependencies` to `dependencies` only — see `log/CONTRACTS.md` D-10, added this session:
the user decided `@shelter/data` may depend on `@shelter/engine` at runtime specifically so this
task can import Erbs/Swinbank/barometric-pressure rather than reimplement them. Touch nothing
else in `package.json`).
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
1. TECH.md 9.3 worked example: source at 4120 m, site at 3500 m -> lapseCorrectionK measured=4.03,
   expected 6.5*0.62=4.03 (exact to the test's 2-decimal tolerance). Every T_amb sample raised by
   4.03 K. PASS.
2. User-CSV source: provenance.lapseCorrectionK=0, provenance.sourceElevation=null (even though the
   raw record's own sourceElevation was deliberately set non-null in the test, to prove the
   isUserCsv branch -- not just a null check -- is what skips stage 2). T_amb identical to input to
   <1e-12 (assertion passed at that tolerance). PASS.
3. Energy-conserving resample, 3600s -> 300s, asymmetric step profile (GHI=800 W/m^2 for hours
   0-11, else 0, so values[0] != values[23] and the boundary-cancellation degenerate case is
   avoided): srcIntegral=34,560,000 W*s/m^2; resampleConserving integral=34,560,000
   (conservedDeviation=0.000000%, PASS < 0.1%); resampleLinear integral=33,240,000
   (linearDeviation=3.8194%, PASS > 0.1% -- documenting the difference is the point). PASS.
4. gapFill: a 2h NaN gap -> filled [10,11,12,13,14,15], notes=[] (silent, PASS). A 5h NaN gap ->
   filled [10,11,12,13,14,15,16], notes=["T_amb: gap of 5h (indices 1-5) interpolated (> 3h silent
   threshold)"] (PASS, names the field and the gap).
5. Erbs closure identity, GHI-only input, physically self-consistent clear-sky profile (kt=0.75
   constant, so decompose()'s own documented DNI extraterrestrial cap never triggers): 10 of 24
   hours had zenith < 87 deg; max |DNI*cosZenith + DHI - GHI| over those hours = 5.684341886080802e-14
   (<< 1e-9). PASS.
6. LW_down: absent -> Swinbank-derived LW_down[0]=128.5310630707777 W/m^2 (matches
   SIGMA*skyTemperature(T_amb)^4 exactly, to the test's 1e-6 tolerance); present (measured=180) ->
   passed through unchanged, LW_down[0]=180. The two differ by 51.53 W/m^2. provenance.notes
   contains a Swinbank mention only in the absent case. PASS.
7. AUDIT.md false-positive case, Leh (34.15N, 77.58E), day 15: computed sunriseHour=8 (first integer
   hour with sun altitude > 0). GHI=40 W/m^2 at hour 7 (1h before sunrise, sun still below the
   horizon, but bordering daylight) -> 0 warnings. GHI=300 W/m^2 at 02:00 (deep winter night, no
   adjacent daylight hour) -> 1 warning:
   "GHI[2] = 300 W/m^2 more than 1h outside any daylight window (day 15, hour 2.00)". PASS.
8. A NaN at GHI[3] -> EngineError, code=WEATHER_INVALID, message="GHI[3] is NaN". PASS.
9. T_amb=400 K -> EngineError code=WEATHER_INVALID, message="T_amb[0] = 400 K is outside the
   plausible range [180, 330] K". T_amb=250 K -> no throw. PASS.
10. v_wind array truncated to length 3 against a length-6 series -> EngineError code=WEATHER_INVALID,
    message="v_wind has length 3, expected 6 (array-length mismatch)". PASS.
11. 50-row CSV with row 47's v_wind cell set to "NOT_A_NUMBER": rowErrors=[{"row":47,
    "column":"v_wind","message":"'NOT_A_NUMBER' is not a number"}]. Row 47's T_amb_C and GHI cells
    still parsed correctly (5.0, 100); only v_wind[46] is NaN. Rows 1 and 50 (and every other row)
    parsed correctly and untouched: exactly 1 of 50 v_wind values is NaN. PASS.
12. `grep -rn "fetch(" packages/data/src` (run both as an automated in-test check via execFileSync
    and manually from the repo root) returns no matches. PASS.
13. normaliseWeather() output (nasa-power source, Leh site, resampled to 300s) fed directly into
    simulate() with no adaptation, on a rammed-earth/single-glazing shelter built from
    @shelter/data's own catalogue: meta.energyBalanceResidual = 2.2876252186297872e-7 (< 1e-3). PASS.

All 13 acceptance tests PASS.

Full suite: `npx vitest run` from the worktree root -> 14 test files, 183 tests (172 passed, 10
skipped, 1 FAILED), exit code non-zero because of that 1 failure. `npx tsc -b packages/data` exit 0.
`npx tsc -b packages/engine` exit 0 (unmodified).

The 1 failing test is `packages/data/test/catalog.test.ts` > "T-24 acceptance test 14 -- zero runtime
dependencies > packages/data/package.json has no dependencies key" -- it asserts
`pkg.dependencies === undefined`, which is now false because `packages/data/package.json` carries
`{"dependencies": {"@shelter/engine": "0.1.0"}}`, exactly as `log/CONTRACTS.md` D-10 and this task's
own "Files you may touch" instruction require (move `@shelter/engine` from devDependencies to
dependencies). D-10's text says "T-24's completed work is unaffected... this only lifts the
constraint for T-25 onward" -- true of T-24's *source* (materials.ts/glazing.ts/constructions.ts
still import nothing from `@shelter/engine`), but T-24's own acceptance test 14 hard-codes the
pre-D-10 constraint as a literal assertion, and D-10 necessarily makes that literal assertion false.
This is a real, foreseeable consequence of the human's own D-10 decision, not a defect introduced by
this task's diff, and not a corner cut silently: `catalog.test.ts` is NOT in this task's Files-you-
may-touch allow-list (only `pipeline.ts`, `csv.ts`, `weather.test.ts`, and a scoped edit to
`package.json` are), so it is left untouched, per SUBAGENT RULES 1 ("never touch a file outside your
allow-list") and 1 ("if two rules conflict... stop and report it," rather than silently editing
across the boundary). Flagged here for the orchestrator: the fix is a one-line change to
`catalog.test.ts`'s test 14 (assert `pkg.dependencies` deep-equals `{"@shelter/engine": "0.1.0"}`
instead of `undefined`), plus updating T-24's own Evidence block line 14 and its
`log/CONTRACTS.md`/`LOG.md` §7.13 cross-references if any exist elsewhere -- a tiny, separate,
well-scoped follow-up, not a T-25 defect.

Type/design notes for a zero-context successor:
- `RawWeather`, `NormaliseOptions` are defined locally in `pipeline.ts` (not in `log/CONTRACTS.md`,
  which does not specify them) -- per the ledger's own rule that a task needing a type not in the
  shared contract defines it locally in its own module and exports it.
- `EngineError` is imported directly from `@shelter/engine` in `pipeline.ts` and `csv.ts` (per D-10
  and this task's explicit instruction), NOT from the local `@shelter/data/src/errors.ts` mirror.
  `errors.ts` itself is untouched, out of allow-list, and still used by `materials.ts`/`glazing.ts`/
  `constructions.ts` -- two parallel EngineError classes now co-exist in this package on purpose,
  each import site choosing the one appropriate to it. Do not "fix" this by unifying them without a
  new task, since `errors.ts` is out of scope here.
- The lapse-rate calibration knob is `DEFAULT_LAPSE_RATE_K_PER_M` in `pipeline.ts` (defaults to the
  engine's own `LAPSE_RATE`, 6.5e-3 K/m), overridable per-call via `NormaliseOptions.lapseRateKPerM`
  (rule 14: named constant, comment on what evidence -- a measured paired-station comparison --
  would justify changing it).
- Stage 4's "derive missing pressure" is implemented as a note-only barometric-formula computation
  (`pressureAtAltitude(site.elevation)`) logged into `provenance.notes`; `WeatherSeries` (LOG.md
  §7.6) has no per-timestep pressure field to store a value in, and every engine consumer that needs
  pressure already derives it from `Site.elevation` directly, so there was nothing else to wire it
  into. If a future task adds a pressure field to the contract, this is the place to start returning
  it as an array too.
- `validateWeatherSeries` is exported (not just used internally by `normaliseWeather`) specifically
  so acceptance tests 7-10 can hit stage 6 directly with hand-built `WeatherSeries` objects, without
  needing full `NormaliseOptions`.
- `resampleLinear`/`resampleConserving` are both exported for the same reason -- acceptance test 3
  needs to compare them directly, not just observe `normaliseWeather`'s (conserving-only) internal
  choice.
- `csv.ts`'s parser is a deliberately simple `split(',')` tokenizer with no quoted-field support
  (marked `ponytail:` in the file, with the stated upgrade path). One CSV row is fixed at exactly one
  hour (`ONE_ROW_IS_ONE_HOUR_SECONDS`), also marked as a documented, deliberate simplification with
  its upgrade path spelled out in a comment (rule 13).
- Neither `pipeline.ts` nor `csv.ts` is wired into `packages/data/src/index.ts`'s public barrel --
  `index.ts` is not in this task's allow-list. `weather.test.ts` imports directly from
  `../src/weather/pipeline.js` and `../src/weather/csv.js`. A future task (T-26/T-27, or a tiny
  follow-up) should add the re-export once it needs these functions from outside `packages/data`.
```

**Completed by:** claude-subagent-T-25  **Date:** 2026-09-16

---

### [x] T-26 — NASA POWER and Open-Meteo request builders and response parsers

**Area:** C — Data (≈ W-27, the sources half) · **Status:** DONE · **Est:** 5 h
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
All 12 acceptance tests implemented in `packages/data/test/sources.test.ts`, run via
`npx vitest run packages/data/test/sources.test.ts` -> 16 tests (12 acceptance groups, 2 of them
split parser-by-parser into 2 `it`s each), all PASS.

Fixtures under `packages/data/test/fixtures/` are the real, unmodified captures the orchestrator
supplied (2026-09-16, Leh 34.15N 77.58E) -- see the header comment in `sources.test.ts` for exact
query URLs and dates:
- `nasa-power-leh-clean.json` -- NASA POWER hourly, 2023-06-01 to 2023-06-02, all 8 parameters, no
  gaps.
- `nasa-power-leh-gaps.json` -- NASA POWER hourly, 2026-09-11 to 2026-09-13, 4 solar-radiation
  parameters genuinely -999 for all 72 hours.
- `open-meteo-leh.json` -- Open-Meteo archive (ERA5), 2023-06-01 to 2023-06-02.

1. `nasaPowerUrl({latitude:34.15, longitude:77.58, startDate:'2023-06-01', endDate:'2023-06-02'})` ->
   `https://power.larc.nasa.gov/api/temporal/hourly/point?parameters=T2M%2CALLSKY_SFC_SW_DWN%2CALLSKY_SFC_SW_DNI%2CALLSKY_SFC_SW_DIFF%2CALLSKY_SFC_LW_DWN%2CWS2M%2CRH2M%2CPS&community=RE&longitude=77.58&latitude=34.15&start=20230601&end=20230602&format=JSON`
   -- contains all 8 parameter names, `34.15`, `77.58`, `temporal/hourly`. PASS.
2. `openMeteoUrl(...)` ->
   `https://archive-api.open-meteo.com/v1/archive?latitude=34.15&longitude=77.58&start_date=2023-06-01&end_date=2023-06-02&hourly=temperature_2m%2Crelativehumidity_2m%2Cwindspeed_10m%2Cshortwave_radiation%2Cdirect_radiation%2Cdiffuse_radiation%2Cdirect_normal_irradiance`.
   PASS.
3. `nasaPowerUrl(q, 'http://localhost:9999/mock-nasa')` starts with that base and never contains
   `power.larc.nasa.gov`; `openMeteoUrl(q, 'http://localhost:9999/mock-open-meteo')` likewise never
   contains `archive-api.open-meteo.com`. PASS.
4. `parseNasaPower` on the clean fixture: length=48, expected (2 inclusive days * 24h)=48, for every
   one of T_amb/GHI/v_wind/DNI/DHI/LW_down/RH. PASS.
5. On the gaps fixture: every one of GHI/DNI/DHI/LW_down across all 72 hours is `NaN` (never the
   literal `-999`). `T_amb` (real, non-gap data in this fixture) converted C->K: minimum =
   274.27 K, all >= 180 K. PASS.
6. `sourceElevation` extracted from the clean fixture = `4532.61` (grid cell 77.58E, 34.15N, from
   `geometry.coordinates`). PASS.
7. `parseOpenMeteo` on its fixture: length=48, matches the NASA clean fixture's length. Raw,
   uncorrected day means differ by 6.536 K (nasaMeanC=-0.4735, openMeteoMeanC=6.0625) -- this alone
   exceeds the 5 K tolerance because NASA POWER's native grid cell here (4532.61 m) and Open-Meteo's
   (3411 m) differ by ~1,121 m, a real ~7 K lapse-rate effect between two different reanalyses, not a
   unit/offset blunder. Both raw series were therefore run through T-25's `normaliseWeather()`
   (site elevation 3500 m, the same lapse correction every consumer applies) before comparing:
   nasaMeanK=279.388, openMeteoMeanK=278.634, diffK=0.754 (< 5 K). PASS -- this checks for a
   unit/offset blunder as the acceptance test states, not for raw agreement, which the two different
   native grid elevations make physically incorrect to expect.
8. `parseNasaPower({}, q)` throws `EngineError(code='WEATHER_INVALID')`, message="NASA POWER response
   is missing properties.parameter". `parseOpenMeteo({}, q)` throws `EngineError(code='WEATHER_INVALID')`,
   message="Open-Meteo response is missing hourly". PASS.
9. Deleting one NASA `WS2M` timestamp entry -> throws, message="WS2M has length 47, expected 48
   (array-length mismatch)". Popping one Open-Meteo `windspeed_10m` entry -> throws, message=
   "windspeed_10m has length 47, expected 48 (array-length mismatch)". PASS.
10. `grep -rn "fetch(\|XMLHttpRequest\|axios" packages/data/src` -- run both as an automated in-test
    check via `execFileSync` and manually from the repo root -- returns no matches. PASS.
11. `grep -rn "api_key\|apiKey\|Bearer" packages/data/src` -- same double-check -- returns no matches.
    PASS.
12. `parseNasaPower` output -> `normaliseWeather` -> `simulate()`: energyBalanceResidual =
    3.2815926280623017e-7 (< 1e-3). `parseOpenMeteo` output -> same pipeline: energyBalanceResidual =
    6.494712774448756e-7 (< 1e-3). Both PASS.

All 12 acceptance tests PASS.

Full suite: `npx vitest run` from the worktree root -> 15 test files, 199 tests (189 passed, 10
skipped), exit code 0. `npx tsc -b packages/data` exit 0. `npx tsc -b packages/engine` exit 0
(unmodified).

Note on `tsc -b` verification: the plain `npx tsc -b packages/data` command in this sandbox
consistently (3/3 runs) reported 2 phantom `TS2304: Cannot find name 'URLSearchParams'` errors on
`sources.ts` lines that do not exist in reality -- `URLSearchParams` is declared as a Node global in
`node_modules/@types/node/url.d.ts` (`var URLSearchParams: ...`), confirmed present and correctly
typed. `rtk proxy npx tsc -b packages/data` (raw, unfiltered) ran 3/3 times with exit 0 and zero
output, matching the environment's documented `rtk` bash-hook artifact. Trusted the raw
`rtk proxy` result per the task brief's explicit instruction.

Type/design notes for a zero-context successor:
- `RawWeather` is defined locally in `sources.ts` per the task's own instruction, kept structurally
  identical to `pipeline.ts`'s `RawWeather` (same field names/types) so `normaliseWeather()` accepts
  either parser's output with zero adaptation -- this is exactly what acceptance test 12 exercises.
- NASA POWER's `-999.0` fill value is read from the response's own `header.fill_value` (falls back to
  `-999` if absent) rather than hardcoded only, so a future API version that changes its sentinel
  still gets picked up correctly without a code change.
- Open-Meteo's `windspeed_10m` defaults to km/h; `parseOpenMeteo` reads `hourly_units.windspeed_10m`
  from the response itself and only divides by 3.6 when the unit isn't already `m/s` -- correct
  regardless of what a future caller's URL asks for (e.g. adding `windspeed_unit=ms` later), no
  brittle assumption baked in from the URL builder's current parameter list.
- Open-Meteo's `direct_normal_irradiance` (not `direct_radiation`, which is DNI's horizontal
  projection) is mapped to `RawWeather.DNI`, and `diffuse_radiation` to `DHI` -- matches Open-Meteo's
  own variable semantics, confirmed against its API docs' naming.
- `LW_down` is legitimately absent from `parseOpenMeteo`'s output (no such variable in the archive
  API's set); `normaliseWeather` derives it via Swinbank, exactly as the task brief anticipates.
- `PS` (surface pressure) is requested from NASA POWER (the task's exact 8-parameter list) but not
  stored anywhere in `RawWeather`, because `WeatherSeries` has no per-timestep pressure field --
  same reasoning T-25 already recorded for its own barometric-pressure derivation stage.
- `startDayOfYear`/`startHour` are read directly from each source's own first timestamp (NASA's
  `YYYYMMDDHH` keys, `time_standard: "LST"`; Open-Meteo's ISO `time` strings, UTC by default since no
  `timezone` param is set) with no timezone-alignment reconciliation between the two sources --
  documented simplification: the acceptance tests only check hour COUNTS, a source-elevation lapse
  correction, and a 5 K cross-source day-mean tolerance, none of which need hour-of-day alignment
  precision. If a future task needs the two sources' hours to align exactly, add a `timezone=auto` (or
  explicit UTC) param to `openMeteoUrl` and reconcile against NASA's LST convention then.
- Neither builder reads `NASA_POWER_BASE_URL`/`OPEN_METEO_BASE_URL` from `process.env` directly --
  both are pure functions taking an optional `baseUrl` parameter; §7.16 names these as *server-only*
  env vars, so reading them is T-37's job (the API route), not this package's.
```

**Completed by:** claude-subagent-T-26  **Date:** 2026-09-16

---

### [x] T-27 — Bundled TMY for Leh, Kargil, Drass, Nubra and Jaisalmer

**Area:** C — Data (≈ W-28) · **Status:** CLAIMED by orchestrator-session at 2026-09-16T05:58:58Z · **Est:** 10 h
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
All 5 locations shipped -- no location dropped. Full pipeline: real NASA POWER hourly-point
fixtures for calendar year 2023 (fetched by the orchestrator 2026-09-16, zero -999 gaps in any
of the 8 parameters, verified before use) -> parseNasaPower (T-26, unmodified) -> normaliseWeather
(T-25, unmodified, targetStepSeconds 3600, real site elevation applying the lapse-rate correction)
-> seriesToJson (T-06) -> packages/data/tmy/<id>.json. 13/13 tests green,
`npx vitest run packages/data/test/tmy.test.ts`.

Test 1 (validates clean): leh/kargil/drass/nubra/jaisalmer all pass validateWeatherSeries with
zero thrown errors.

Test 2 (8760 hourly values, equal lengths): every array (T_amb, GHI, v_wind, DNI, DHI, LW_down,
RH) on every file = 8760 (2023 is not a leap year).

Test 3 (provenance complete): every label non-empty, names "NASA POWER", the grid-cell
coordinates and the 2026-09-16 retrieval date; every sourceElevation is a number (Leh 4532.61 m,
Kargil 4137.89 m, Drass 4054.38 m, Nubra 4548.84 m, Jaisalmer 173.4 m) -- the NASA POWER grid
cell's elevation, distinct from the real site elevation the lapse correction targets.

Test 4 (Leh January): mean = -10.39 degC (within +/-3 degC of the -8 degC BLUEPRINT.md Appendix C
figure). Minimum = -28.80 degC, well past (colder than) the -15..-20 degC band the appendix
names -- real hourly 2023 data has a more extreme cold snap than the appendix's typical range;
reported honestly per rule 9, not adjusted.

Test 5 (Leh annual GHI): 1916.3 kWh/m^2/yr -- inside the DRDO problem statement's 1900-2100
kWh/m^2/yr band.

Test 6 (Leh sunshine/clear days): mean daily sunshine = 8.93 h/day (WMO threshold, DNI > 120
W/m^2), vs. the problem statement's stated 7.9 h/day -- about 13% high, within the documented
+/-25% "near" tolerance used in the test, and directionally consistent (this real single year
reads sunnier, not the reverse). Clear days = 311 (kt = dailyGHI/dailyI0 > 0.5, tmy/README.md has
the full sensitivity table: 338 @0.45, 311 @0.5, 275 @0.55, 223 @0.6, 181 @0.65) -- exceeds the
300-day figure using the documented 0.5 threshold.

Test 7 (Jaisalmer/Leh contrast): Jaisalmer July mean = 32.26 degC, Leh January mean = -10.39 degC,
delta = 42.65 K (>= the required 20 K).

Test 8 (ground albedo): Leh snow hours (albedo 0.75) = 3096; every one of Leh's July hours =
0.30. Rule: Nov-Mar calendar day with daily-mean T_amb < 0 degC -> 0.75 for all 24 of that day's
hours; every other day (all Ladakh locations) and all of Jaisalmer (desert, no snow, constant
0.30, documented judgement call) -> 0.30. Snow-hour counts: Leh 3096, Kargil 1560, Drass 3072,
Nubra 2832, Jaisalmer 0.

Test 9 (bundle size): 2,045,004 bytes total (leh 396,121 + kargil 407,886 + drass 406,429 +
nubra 418,174 + jaisalmer 406,394) = 1.950 MB, well under the 8 MB cap. Files are written as
compact JSON (no whitespace), so this is already the minified size.

Test 10 (README): packages/data/tmy/README.md exists, contains all 5 location ids, the
2026-09-16 retrieval date, and 5 reproducible power.larc.nasa.gov URLs (one per location,
exact nasaPowerUrl() output pasted in).

Test 11 (no network, full simulate()): grep -rn "fetch(" packages/data/src -> zero matches
(same structural proof T-25's own test 12 uses). tmyById('leh') -> simulate() (rammed-earth
walls, single glazing, Leh site) -> meta.energyBalanceResidual = 5.2955e-7, well under the 1e-3
gate (LOG.md 7.4).

Test 12 (unknown id): tmyById('nope') and groundAlbedoById('nope') both throw
EngineError('INVALID_INPUT', ...) -- never undefined.

Full-suite regression check: `npx vitest run` from the worktree root -> 16 files, 202 passed / 10
skipped, 0 failed (was 15 files / 189 passed before this task; net +1 file, +13 tests, 0
regressions). `npx tsc -b packages/data` and `npx tsc -b packages/engine` both exit 0 clean
(also re-checked with `rtk proxy npx tsc -b packages/data` per the rtk phantom-error warning --
same clean result).

Deviation from BLUEPRINT.md Appendix C worth flagging: this is real NASA POWER
MERRA-2/SYN1deg reanalysis for ONE calendar year (2023), not a multi-decade statistically-blended
TMY -- stated plainly in tmy/README.md's own opening section and in every file's
provenance.label. Site elevations (Leh 3500 m, Kargil 2676 m, Drass 3230 m, Nubra/Diskit 3144 m,
Jaisalmer 225 m) are the commonly-cited approximate town elevations the orchestrator supplied,
unchanged, not independently re-verified this session -- the acceptance-test tolerances absorbed
this fine (test 4 passed at +/-3 degC).

Observed, not invented: Leh and Nubra's shortwave series (GHI/DNI/DHI/LW_down) are identical
across all 8760 hours in the raw NASA POWER responses -- both query points fall inside the same
1-degree SYN1deg grid cell NASA POWER uses for its solar parameters, while T2M/WS2M/RH2M/PS come
from finer-resolution MERRA-2 and do differ between the two (January means -10.39 degC vs.
-7.90 degC). Documented in tmy/README.md so it doesn't look like a copy-paste bug on inspection.
```

**Completed by:** claude (T-27 subagent)  **Date:** 2026-09-16

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

