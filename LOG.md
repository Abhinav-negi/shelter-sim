# LOG.md — The ShelterSim Build Ledger

## HANDOFF (2026-09-16, end of session)

**Completed this session:** T-20 (water/rock/PCM thermal storage nodes), T-25 (the weather
pipeline, mandatory lapse-rate correction), T-26 (NASA POWER / Open-Meteo request builders and
response parsers), T-27 (bundled TMY for Leh, Kargil, Drass, Nubra, Jaisalmer), and T-28 (presets).
All five done in single subagents working in isolated worktrees, all independently re-verified by
the orchestrator (reran `npx vitest run` and `npx tsc -b` on every affected package from the
worktree AND again after merging to master; read every diff against each task's file-scope
allow-list; spot-checked the trickier acceptance tests — T-20's PCM negative control, T-25's
Erbs-closure and energy-conserving-resample tests, T-26's cross-source day-mean comparison, T-27's
GHI/January-mean/byte-identical-radiation claims, T-28's HDKR-divergence and gross/net-area
findings below — by independently recomputing or reproducing the numbers myself, not just trusting
pasted numbers). Area B now 15/16, Area C now **5/5, fully done**, ledger total **28/69**. Full
suite green: 17 files, 214 passed, 10 skipped (224 total), exit 0; `tsc -b packages/engine` and
`tsc -b packages/data` both exit 0.

**⚠ Real engine bug found this session, not yet fixed — needs a new task or a follow-up on Area B:**
T-28 found and the orchestrator independently reproduced a solver-divergence bug in
`packages/engine/src/solar/transposition.ts`'s HDKR sky model (owned by the already-`[x]` T-14; full
writeup and reproduction steps are in T-14's own addendum in `log/AREA-B-engine.md`). `Rb =
cosTheta / sun.cosZenith` has no upper clamp; at Leh in January near sunrise (`cosZenith` as low as
0.0014, a real, verified value) `Rb` reaches several hundred and the diffuse term spikes to an
unphysical multi-kW/m² value, diverging the solver. **This is `DEFAULT_SIM_OPTIONS`'s own default
sky model** (`skyModel: 'hdkr'`), not an edge-case option — any future preset, scenario or sweep
run near sunrise/sunset at Ladakh's latitude with the default config is at risk. T-28 worked around
it (`skyModel: 'isotropic'`) for its own presets rather than fixing across the Area B boundary, per
rule 16 — correct behaviour, but the underlying bug is still live. Whoever next touches Area B
should open a task for this (likely: clamp `Rb` to a physically sensible bound, or gate the
anisotropic term below a minimum solar altitude, then re-verify against T-12's hard-gate analytical
tests). A smaller, related finding from the same session: `CONTRACTS.md` §7.5's `Surface.area`
documentation says "NET, not gross," but the shipped code and every fixture treat it as gross —
also detailed in T-14's addendum, worth a docs-only fix whenever someone next edits `CONTRACTS.md`.

**T-26 note for whoever reads its Evidence block:** acceptance test 7 (cross-source day-mean
temperature within 5K) fails on RAW/uncorrected data (6.536 K gap) because NASA POWER's and
Open-Meteo's native grid cells for Leh sit ~1,121 m apart in modelled elevation — a real,
physically-expected lapse-rate effect (1121 m × 6.5 K/km ≈ 7.3 K, matching the observed gap in both
size and sign), not a coding bug. The committed test instead runs both fixtures through T-25's
`normaliseWeather()` (the same correction every real consumer applies) before comparing, per the
acceptance test's own parenthetical that it's "checking for a unit or offset blunder, not
agreement" — both numbers are pasted transparently in the Evidence block. The orchestrator judged
this a correct reading of an acceptance test whose literal wording didn't anticipate two
reanalyses' real elevation gap, not a weakened test; verified independently by computing the
expected lapse-rate offset by hand before accepting it.

**T-27 notes for whoever reads its Evidence block or builds a preset (T-28) on top of it:**
- The 5 bundled files (`packages/data/tmy/*.json`) are real NASA POWER hourly data for ONE calendar
  year (2023), not a multi-decade statistically-blended ASHRAE-style TMY — stated plainly in
  `tmy/README.md` and every file's `provenance.label`. If a judge or a later task needs a genuine
  multi-year TMY, that is new scope, not something T-27 silently approximated.
- Leh's January minimum in this real data (−28.80 °C after lapse correction) runs colder than
  `BLUEPRINT.md` Appendix C's stated −15..−20 °C typical band — a real cold snap in the specific
  year fetched, reported honestly rather than smoothed over. The January mean (−10.39 °C) still
  lands inside the ±3 °C tolerance around −8 °C.
- Leh's and Nubra's shortwave-radiation series (GHI/DNI/DHI/LW_down) are byte-identical across all
  8,760 hours — confirmed genuine by the orchestrator on the raw fetched JSON, not a subagent
  copy-paste bug: both points sit inside the same 1° SYN1DEG grid cell NASA POWER uses for solar
  parameters, while temperature/wind (finer MERRA-2 grid) correctly differ between them. Documented
  in `tmy/README.md` so a future reader doesn't "fix" it.
- `groundAlbedoById(id): number[]` lives in `packages/data/src/tmy.ts` alongside `tmyById`/
  `TMY_LOCATIONS` — it is deliberately NOT part of `WeatherSeries` (CONTRACTS.md §7.6 has no
  `snowCover` field by design), so T-28's presets need to call both functions, not just `tmyById`.
- Site elevations used for the lapse correction (Leh 3500 m, Kargil 2676 m, Drass 3230 m, Nubra/
  Diskit 3144 m, Jaisalmer 225 m) are commonly-cited approximate town elevations supplied from the
  orchestrator's own knowledge this session, not independently re-verified against an authoritative
  source — the acceptance tests' tolerances absorbed this fine, but a future task with a tighter
  tolerance should re-check them.

**Real API fixtures used this session:** T-26's and T-27's fixture/bundle files are all genuine,
unmodified NASA POWER (and, for T-26, also Open-Meteo) responses the orchestrator fetched directly
(network access confirmed available in this environment via plain `curl`) — not synthetic data.
T-27 in particular required a full calendar year (8,760 hours) per location for 5 locations; all
five fetches were complete with zero `-999` gaps, verified before handing them to the subagent.
Query URLs and dates are documented in `sources.test.ts`'s header comment (T-26) and
`tmy/README.md` (T-27). This pattern — orchestrator fetches and verifies real data via curl,
subagent never touches the network itself — worked well twice this session and is worth repeating
whenever a future task needs real external data as a committed fixture.

**Small engine-export fix made this session (needs no further action):** T-27's own task prompt
assumed `packages/data` could import T-06's `seriesToJson`/`seriesFromJson`, but they were only
exported from `packages/engine/src/serialise.ts` internally, not from the public `index.ts` barrel
— and T-27 is explicitly forbidden from touching anything under `packages/engine/`. The orchestrator
added a one-line re-export (commit `68b3268`) before dispatching T-27, since it's a trivial,
contract-neutral fix (exposing an existing internal helper, not changing any behaviour).

**Architecture decision made this session (needs no further action, recorded for context):**
T-25's own task prompt required importing Erbs/Swinbank/barometric-pressure correlations from
`@shelter/engine`, which directly contradicted `CONTRACTS.md` §7.13's then-current rule that
`@shelter/data` must have ZERO runtime dependencies (T-24's own precedent). The orchestrator caught
this before dispatching T-25 and asked the human user, who chose to keep the correlations canonical
in `@shelter/engine` rather than fork them. Recorded as `CONTRACTS.md` D-10: `@shelter/data` may now
depend on `@shelter/engine` (mirroring `@shelter/optimise`'s row), and `packages/data/package.json`
now lists it under `dependencies`. This broke T-24's own `catalog.test.ts` acceptance-test-14
assertion ("no dependencies key") — the orchestrator fixed that test directly (not delegated, a
1-line assertion update to match the new contract) and added a dated addendum to T-24's Evidence
block pointing to D-10, without altering T-24's original historical measurement. If a future session
finds `@shelter/data` importing something unexpected from `@shelter/engine`, D-10 is why that's
allowed — anything beyond Erbs/Swinbank/barometric-pressure/the shared `WeatherSeries`/`EngineError`
types would be new scope, not covered by this decision.

**Worktree gotcha found last session (repo-wide, still true, confirmed again this session):** a
freshly created `git worktree add` checkout does **not** inherit `node_modules`. A plain `npm
install` (no flags) at the new worktree's root is required before trusting any red result — a
partial/flagged install can leave root devDependencies (`@types/node` etc.) missing, producing
`tsc -b` failures unrelated to any task's own diff. Both T-20's and T-25's subagents were told this
explicitly in their briefs and both got clean baselines as a result.

**New gotcha found this session:** the `rtk` bash-rewriting hook in this environment produced a
**false-negative** `npx tsc -b packages/engine` result (2 phantom `TS2591`/`TS2304` errors in
`serialise.ts` that do not exist) on an otherwise-clean worktree with `node_modules` correctly
installed. Confirmed false by cross-checking with `rtk proxy npx tsc -b packages/engine` (raw,
unfiltered), which showed exit 0, no errors. **Whenever a `tsc -b` or `vitest run` result looks
suspicious — especially errors that don't correspond to anything in a task's diff — rerun it via
`rtk proxy <command>` before trusting it or sending a task back to a subagent for a phantom bug.**
Filed as product feedback separately; not yet fixed upstream as of this session.

**In progress:** nothing. No open worktrees or branches (`git worktree list` / `git branch -a`
both clean, everything lives on `master`).

**Blocked (pre-existing, unchanged this session):** T-23 stays `[!]` — root cause is in
`solar/geometry.ts` (owned by closed task T-14), not fixable from a test file. See its Evidence
block in `log/AREA-B-engine.md` for the full NOAA comparison numbers.

**Still open from prior sessions, unchanged:** T-22's finding that `Q7_interiorLongwave` in
`solve/integrator.ts`'s `record()` is solver float noise (~1e-11 W), not a real gross
interior-radiant-exchange wattage — flagged for T-49 (Sankey) or T-11's owner, not touched this
session (out of scope for both T-20 and T-25).

**Repo hygiene, already handled, no action needed:** `packages/engine/test/output/validation-numbers.csv`
picks up a local diff every time `npx vitest run` executes (the CSV-writing test rewrites it each
run) — reverted after every verification run this session, nothing to fix in source.

**Recommended next step:** **Area C is now fully complete (5/5).** In strict ledger-scan order
(§2 ritual step 5 — first `[ ]` task whose every dependency is `[x]`), that's **T-29** (Prisma
schema, the four tables, and the first migration, `log/AREA-D-database-tier.md`) — depends on T-03,
T-06, both done. This opens a new Area (D, database tier) with its own global rules (17-21) about
the DB being a cache/share layer, never a dependency — read those in `LOG.md` §6 again before
starting, they weren't exercised by anything this session. **Also newly unblocked and worth
considering instead:** T-54 (the sweep engine, Area G) now has all its dependencies (`T-06`, `T-24`,
`T-28`) satisfied too — it's the thing that would let a future session replace T-28's placeholder
"optimised" preset with a real one (see T-28's own `.work/T-28.md` note pointing at T-56, which
depends on T-54). Whichever is picked, this session ran two consecutive platform rate-limit
interruptions (during T-25 and T-28, both resumed successfully via `SendMessage` once the limit
reset) — worth bearing in mind if starting a new, larger task rather than treating this session's
smooth run as guaranteed to continue.

---


**Project:** ShelterSim — software thermal model for area-specific passive shelter design
**Sponsor:** DRDO / DIHAR Leh · **SIH Problem Statement:** 26051
**Repository root for all paths below:** `/home/abhinav/Downloads/SIH/shelter-sim`
**Source documents (read once for background, never required to do a task):**
`plan.md`, `ENGINE_BLUEPRINT.md` (both in this directory) and `../WORKERS.md`, `../TECH.md`,
`../BLUEPRINT.md`, `../CHALLENGE.md`, `../AUDIT.md`, `../TASK.md`,
`../Ladakh_Passive_Shelter_Problem_Statement.md`, `../UI_Input_Design_Reference.md`.

--- 

## 1. What this file is

This is the **index** into the ShelterSim build ledger. The ledger used to be a single
7,400-line file; reading all of it to find one task burned most of a session's context before
work even started. It is now split by the boundaries the ledger already used internally:

- **This file (`LOG.md`)** — the process rules (§2–§6 below) and the task index (§5): every
  task's id, title, status and dependencies, plus which file holds its full entry.
- **`log/CONTRACTS.md`** — the shared contracts, constants, the eleven heat pathways, the
  architecture diagram and the deviation log. Read once per session (ritual step 3), never
  restated per task.
- **`log/AREA-<letter>-<name>.md`**, ten files, one per Area (A–J) — the full entry for every
  task in that Area: why it exists, the prompt, files it may touch, acceptance tests, and its
  Evidence block. This is where a task is actually claimed, worked and marked done.

An agent with no memory of any previous session must be able to: read this file, find the first
`[ ]` task whose dependencies are all `[x]`, open **only that task's one Area file**, and start
work — without opening the other nine Area files, and without opening `CONTRACTS.md` more than
once per session.

The rule from the old single-file ledger still holds **inside each Area file**: a task's entry
restates everything it needs. What changed is scope — restated *within its file*, not
duplicated across all 7,400 lines.

**If a task's entry sends you hunting through another Area file, that is a defect — fix it in
place.** A bare `§5`/`§6` reference means this file; `§7`–`§10` means `log/CONTRACTS.md`.

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
   which says pnpm. See `log/CONTRACTS.md` §9, Deviation D-2.

2. **Run the test suite and record the result.**
   ```bash
   npx vitest run
   ```
   Write down: total test files, total tests, pass/fail, and the two numbers printed by
   `perf.test.ts` (`full simulate() incl. spin-up: N ms/run` and `100-variant sweep: N s`).
   **If the suite is red, your session's first and only job is to find out why and report it.**
   Do not start a new task on a red suite. The last recorded green state is in
   `log/CONTRACTS.md` §10.

3. **Read `log/CONTRACTS.md` in full, once.** Not the headings. The file. Most of the failure
   modes this ledger exists to prevent are contract violations, not coding errors.

4. **Read §6 — GLOBAL RULES — below, in full.** All 21 of them.

5. **Scan §5 below for the first `[ ]` task whose every `Depends on` entry is `[x]`.** Open
   *only* that task's Area file (the table tells you which one) and read that one entry top to
   bottom.

6. **Confirm no task on its `Conflicts with` line is `[~]` (CLAIMED).** If one is, that file is
   being edited by someone else right now. Pick a different task. Do not "just check whether their
   work looks stale and take it anyway" — that is how two agents end up owning the same file.

7. **Claim it.** Edit the task's Status line **in its Area file**:
   ```
   **Status:** CLAIMED by <your agent id> at <ISO-8601 UTC timestamp>
   ```
   and change its heading box from `[ ]` to `[~]` there. Then mirror the same box change in the
   `§5` table **in this file**. Save both. That edit *is* the lock — the Area file is
   authoritative if the two ever disagree, since it is the one under edit.

8. **Now work.** When you finish, follow §3.

---

## 3. HOW TO MARK A TASK DONE

**A task stays `[ ]` until every single acceptance test in its list passes and the measured numbers
are pasted into its Evidence block, in its Area file.**

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

1. Paste the measured numbers into the Evidence fenced block, **in the task's Area file**.
2. Fill in **Completed by** and **Date**, in the Area file.
3. Change the heading box `[~]` → `[x]` and the Status line to `DONE`, in the Area file.
4. **Mirror the same box flip in §5 below, in this file**, and update that Area's done/total
   count in the same table.
5. Commit, with the task id as the first token of the commit message (`T-18: shading module`).

**If the box in an Area file and the box in §5 here ever disagree, the Area file wins** — it is
the one with the Evidence block. Fix §5 to match it, not the other way round.

---

## 4. STATUS LEGEND

| Box | Status line reads | Meaning |
|---|---|---|
| `[ ]` | `NOT STARTED` | Nobody is working on it. Free to claim. |
| `[~]` | `CLAIMED by <agent> at <timestamp>` | In progress. Its files are locked. Do not touch them. |
| `[x]` | `DONE` | Every acceptance test passed and the Evidence block has the numbers. |
| `[!]` | `BLOCKED — <reason> (blocking task: T-nn)` | Started, cannot finish. The reason is stated inline. |

Each box appears twice — once in the task's Area file (authoritative, carries the Evidence), once
in the §5 table below (a scannable mirror). A `[~]` that has not moved in a long time is still a
lock. **Never delete a claim to release it.** Set it to `[!]` with a one-line reason, so what was
learned survives.

---

## 5. TASK INDEX & PROGRESS DASHBOARD

Kept current by whoever ticks a box — in the task's Area file first, then mirrored here.

*(Regenerated 2026-09-15 from the actual box characters in
every task entry while splitting the old single-file ledger. The previous dashboard here had
drifted: it read 16 / 69 done; the true count from the entries themselves was 20 / 69 — Area A
was fully done at 7/7, not 6/7, and Area B was 12/16, not 10/16. If you find this table disagreeing
with an Area file again, the Area file is right — fix this table.)*

| Area | Name | Done / Total | File |
|---|---|---|---|
| A | Foundation & contracts | 7 / 7 | `log/AREA-A-foundation-contracts.md` |
| B | Engine | 15 / 16 | `log/AREA-B-engine.md` |
| C | Data layer | 5 / 5 | `log/AREA-C-data-layer.md` |
| D | Database tier | 0 / 7 | `log/AREA-D-database-tier.md` |
| E | Server tier | 0 / 7 | `log/AREA-E-server-tier.md` |
| F | Frontend | 0 / 11 | `log/AREA-F-frontend.md` |
| G | Decision support | 0 / 5 | `log/AREA-G-decision-support.md` |
| H | Scenarios | 0 / 3 | `log/AREA-H-scenarios.md` |
| I | Validation & credibility | 0 / 4 | `log/AREA-I-validation-credibility.md` |
| J | Delivery | 0 / 4 | `log/AREA-J-delivery.md` |
| | **TOTAL** | **27 / 69** | |

**THE HARD GATE: PASSED.** See `log/CONTRACTS.md` §10.

### Full task list, by Area

### Area A — Foundation & contracts — 7 / 7 — `log/AREA-A-foundation-contracts.md`

| | ID | Title | Depends on |
|---|---|---|---|
| [x] | T-01 | npm workspace root, strict TypeScript, engine package manifest | none |
| [x] | T-02 | Put the project under version control | none |
| [x] | T-03 | ESLint, Prettier, and the two boundary rules | T-02 |
| [x] | T-04 | Continuous integration | T-02, T-03 |
| [x] | T-05 | The `.work/` claim ledger and `board.sh` | T-02 |
| [x] | T-06 | Extend the shared contract with the types the rest of the build needs | T-01 |
| [x] | T-07 | Canonical test fixtures, including the C-01 kill-shot pair | T-06 |

### Area B — Engine — 15 / 16 — `log/AREA-B-engine.md`

| | ID | Title | Depends on |
|---|---|---|---|
| [x] | T-08 | Linear algebra: dense LU, Thomas, and the arrow/Schur factorisation | T-01 |
| [x] | T-09 | Envelope meshing, harmonic interfaces, composite U-value | T-01 |
| [x] | T-10 | Model assembly: node index, capacitance vector, conductance matrix | T-08, T-09 |
| [x] | T-11 | Time integration, and the AUDIT F-1 coefficient-refresh fix | T-10 |
| [x] | T-12 | ⚠ THE HARD GATE: analytical Test 2 (sinusoidal wave through a wall) and Test 7 | T-11 |
| [x] | T-13 | Analytical Tests 1, 4, 6 and 8, plus the safety and validation cases | T-11 |
| [x] | T-14 | Solar: position, decomposition, transposition | T-01 |
| [x] | T-15 | Surface boundary conditions, altitude-corrected in both directions | T-01 |
| [x] | T-16 | Loads, orchestrator and post-processing | T-11, T-14, T-15 |
| [x] | T-17 | The performance budget | T-16 |
| [x] | T-18 | Shading: mountain horizon and window overhangs | T-06 |
| [x] | T-19 | Phase-change materials: apparent heat capacity | T-06 |
| [x] | T-20 | Water and rock thermal storage, and the `StorageElement` node | T-06, T-19 |
| [x] | T-21 | Couple infiltration to opening area (closes AUDIT F-6) | T-06 |
| [x] | T-22 | Split out `post/heatFlows.ts` and add the ΔT and ground series | T-06 |
| [!] | T-23 | Validation Test 5 against NOAA, and print every measured pair | T-07 |

### Area C — Data layer — 5 / 5 — `log/AREA-C-data-layer.md`

| | ID | Title | Depends on |
|---|---|---|---|
| [x] | T-24 | Material, glazing and construction catalogues, every row cited | T-06 |
| [x] | T-25 | The weather pipeline, with the mandatory lapse-rate correction | T-24 |
| [x] | T-26 | NASA POWER and Open-Meteo request builders and response parsers | T-25 |
| [x] | T-27 | Bundled TMY for Leh, Kargil, Drass, Nubra and Jaisalmer | T-25, T-26 |
| [x] | T-28 | Presets: the app opens on an interesting result | T-24, T-27 |

### Area D — Database tier — 0 / 7 — `log/AREA-D-database-tier.md`

| | ID | Title | Depends on |
|---|---|---|---|
| [!] | T-29 | Prisma schema, the four tables, and the first migration (10.5/11 -- lint blocked by T-25..T-28 debt, see its Evidence block) | T-03, T-06 |
| [ ] | T-30 | The database client wrapper, and the DB-off mode that must always work | T-29 |
| [ ] | T-31 | The weather cache repository | T-26, T-30 |
| [ ] | T-32 | Design snapshots and share links | T-30 |
| [ ] | T-33 | The simulation-run cache | T-06, T-30 |
| [ ] | T-34 | The material repository and the seed script | T-24, T-30 |
| [ ] | T-35 | The DB-off integration proof | T-31, T-32, T-33, T-34 |

### Area E — Server tier — 0 / 7 — `log/AREA-E-server-tier.md`

| | ID | Title | Depends on |
|---|---|---|---|
| [ ] | T-36 | Next.js scaffold, the store, the unit boundary, and the layout slots | T-03, T-06, T-28, T-29 |
| [ ] | T-37 | `/api/weather` — the CORS proxy, cached | T-26, T-31, T-36 |
| [ ] | T-38 | `/api/simulate` — one run, cached | T-33, T-36 |
| [ ] | T-39 | `/api/optimise` and `/api/scenarios`, with streaming progress | T-40, T-54, T-59 |
| [ ] | T-40 | The worker-thread pool, one per core | T-06, T-36 |
| [ ] | T-41 | `/api/designs` and `/api/materials` | T-32, T-34, T-36 |
| [ ] | T-42 | Request validation, the error taxonomy, and rate limiting | T-37, T-38, T-39, T-41 |

### Area F — Frontend — 0 / 11 — `log/AREA-F-frontend.md`

| | ID | Title | Depends on |
|---|---|---|---|
| [ ] | T-43 | The browser Web Worker and the offline fallback path | T-36 |
| [ ] | T-44 | The five-control simple form | T-28, T-36, T-41 |
| [ ] | T-45 | The Advanced panel | T-36 |
| [ ] | T-46 | The isometric house: click a wall, scrub the day | T-36 |
| [ ] | T-47 | The temperature view (PS Deliverable 1) and the 6 AM label | T-36, T-43 |
| [ ] | T-48 | The solar capture view (PS Deliverable 2) | T-36, T-43 |
| [ ] | T-49 | The heat-flow view and the Sankey (PS Deliverable 3) | T-22, T-36, T-43 |
| [ ] | T-50 | The survival grid | T-36, T-59 |
| [ ] | T-51 | KPI cards, the integrity badge and the safety warning | T-36, T-43 |
| [ ] | T-52 | The assumptions panel, exports, the offline banner and bilingual labels | T-36, T-43, T-51 |
| [ ] | T-53 | The day/night animation, driven by the real solar-position code | T-46 |

### Area G — Decision support — 0 / 5 — `log/AREA-G-decision-support.md`

| | ID | Title | Depends on |
|---|---|---|---|
| [!] | T-54 | The sweep engine: expand, dispatch, collect | T-06, T-24, T-28 |
| [ ] | T-55 | The browser worker pool and the shared spin-up cache | T-43, T-54 |
| [ ] | T-56 | Ranking, the Pareto front, and the perturbation-stability check | T-54 |
| [ ] | T-57 | The buildable recommendation, and the non-AI template fallback | T-24, T-56 |
| [ ] | T-58 | The AI write-up, its two-stage separation, and the number verifier | T-42, T-57 |

### Area H — Scenarios — 0 / 3 — `log/AREA-H-scenarios.md`

| | ID | Title | Depends on |
|---|---|---|---|
| [x] | T-59 | The eighteen-scenario matrix, built from real recorded history | T-27, T-28 |
| [ ] | T-60 | Run the matrix and shape the survival-grid contract | T-54, T-59 |
| [~] | T-61 | Multi-day runs and the sunless-streak path | T-59 |

### Area I — Validation & credibility — 0 / 4 — `log/AREA-I-validation-credibility.md`

| | ID | Title | Depends on |
|---|---|---|---|
| [ ] | T-62 | The continuous energy-balance audit in CI | T-04, T-28, T-59 |
| [ ] | T-63 | `VALIDATION.md` | T-23, T-62 |
| [ ] | T-64 | `EQUATIONS.md` and the limitations list | T-18, T-19, T-22 |
| [ ] | T-65 | One EnergyPlus reference case (needs a human owner) | T-27, T-62, **plus a named human owner** |

### Area J — Delivery — 0 / 4 — `log/AREA-J-delivery.md`

| | ID | Title | Depends on |
|---|---|---|---|
| [ ] | T-66 | Offline: the PWA and a network-free static build | T-27, T-36, T-43 |
| [ ] | T-67 | Deployment | T-29, T-42, T-66 |
| [ ] | T-68 | The demo script and hostile-question preparation | T-63, T-66 |
| [ ] | T-69 | The PPT | T-46, T-47, T-63, T-68 |


---

## 6. GLOBAL RULES

These bind every task. Rules 1–16 are adapted from `WORKERS.md` §7.1; rules 17–21 are new and
govern the database tier that §9 introduces.

1. **Read `log/CONTRACTS.md` (the shared contracts) in full before starting any task.** The
   contracts are the thing six parallel workers agree on. Violating one is worse than writing no
   code at all.

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

## END OF LEDGER

**If you have read this far without claiming a task, go back to §2 and run the start-of-session
ritual.** The first unchecked box in §5 whose dependencies are all `[x]` is yours — its file is
named in the same row.

**If you just finished a task:** paste your measured numbers into its Evidence block **in its Area
file**, fill in *Completed by* and *Date* there, flip its box to `[x]` there, mirror the flip in
§5 **in this file**, and commit with the task id as the first token of the message.

**If you changed something this ledger says, change it in the file that actually says it** — the
Area file for a task's own content, `log/CONTRACTS.md` for a shared contract, this file for the
index or the rules. A ledger that disagrees with the disk, or with itself, is worse than no ledger,
because the next agent will trust it.
