# LOG.md — The ShelterSim Build Ledger

## HANDOFF (2026-09-21, end of session — eleventh session)

**Completed this session: ledger moved 58 / 79 → 61 / 80 (one task landed for real; two
pre-existing dashboard drifts caught and fixed; one new task raised, not yet claimed).**

**Session start found an abandoned, uncommitted claim on T-79** (Prettier formatting sweep): an
earlier session had drafted the task file and flipped its box to `[~]` CLAIMED directly on
master, but did no work and committed nothing. Stashed it (`git stash`, not discarded — the
classifier blocks `git checkout --` on tracked files as irreversible, which is the right call
here) rather than losing the draft, then re-ran the task properly through the worktree/branch
protocol, reusing the draft's content.

**T-79 (Area A — Prettier formatting sweep) — `[x]`, DONE:** ran in its own worktree
(`../wt-T-79`, `task/T-79`). 210 files reformatted (`npm run format:check`: 212 red → 0 red).
**Caught a false-alarm regression before trusting the subagent's report:** its `npx vitest run`
showed only 434/502 passing (8 files failing on a Prisma "must be postgresql://" error) both
before and after formatting — identical counts, which the subagent correctly read as "not caused
by Prettier," but the orchestrator went further and root-caused *why*: the worktree's Prisma
client had been generated via the raw `npx prisma generate --schema .../schema.prisma` (hardcoded
`provider = "postgresql"` in that file), not via `npm run db:migrate`/`db:seed` (which run
`prisma/generate-schema.mjs` first to rewrite the provider from `DATABASE_PROVIDER`). Setting up
sqlite properly (`DATABASE_PROVIDER=sqlite DATABASE_URL="file:./dev.db" npm run db:migrate &&
npm run db:seed`) and re-running hit the exact known-green baseline: **45 files, 492 passed, 10
skipped**. Merged (`--no-ff`), rebuilt `packages/{engine,data,optimise}/dist/` on master (the
carried-forward gotcha), re-ran the full suite fresh on master with the DB configured — same
45/492/10, confirming zero regression. Worktree and branch removed after merge.

**Two stale dashboard drifts caught while verifying the merge, fixed per LOG.md's own "the Area
file is right, fix this table" rule (neither was caused by this session — both pre-dated it):**
Area A's header had been left at `8/10` (true count, from the entries themselves, was already
`9/10` before T-79 — T-72 and T-78 had landed without the header being updated; now `10/10` with
T-79 done, Area A fully complete). Area J's header had been left at `0/5` by T-77's own commit
(T-77 itself was `[x]`, true count was already `1/5`). Grand total corrected `58/79` (itself
already stale) → `61/79`, then `61/80` once T-80 (below) added a task. **Worth flagging again for
next session, third time this pattern has been caught:** a Done/Total header is edited by the
task that just landed, incrementing off whatever number was already there, without re-summing the
table below it — cross-check every row's `[x]` count against its own table at session start, not
just the rows you personally touch.

**T-80 (NEW task, Area J — wire real connectivity detection into `dispatchSimulation()`) —
raised, NOT yet claimed:** T-66's own Evidence block named this as the one live-app gap neither
T-77 (service-worker registration + manifest link, DONE) nor T-78 (a tsconfig type-check fix,
DONE, unrelated) closed — `dispatchSimulation()` in `lib/store.ts` never checks connectivity, so
`store.online` never leaves its `true` default in the live app (T-66 acceptance test 10's
still-open live-app half). Investigated enough to write a precise brief rather than a vague one:
confirmed `lib/workerClient.ts` already imports `actions` from `./store.js`, so `store.ts` cannot
import `workerClient.ts` back (circular import) — the task file calls this out explicitly as a
hard constraint, with the recommended alternative (native `navigator.onLine`/`window` online-
offline events, no new dependency). Also pre-loaded the DB-setup gotcha discovered while merging
T-79 directly into T-80's brief, so its subagent doesn't waste time rediscovering it. Not
delegated this session — the user asked to wrap up before it was dispatched.

**In progress:** nothing. No open claims, no open worktrees, no subagents running.

**Recommended next step:** claim and delegate T-80 (Area J, `log/AREA-J/T-80.md`) — small,
well-scoped, single-file change, brief already written and includes the DB-setup gotcha. After
that, the ledger is essentially fully blocked again: everything else in §5 traces back to
T-54/T-56/T-57/T-58/T-60's engine-mechanism chain (T-54 twice honestly re-attempted and
documented as topping out below its 2x gate, do not re-attempt without a genuinely new mechanism)
or a named-human-owner blocker (T-23, T-44's test-1 half, T-61, T-65).

**Blocked tasks (unchanged from session 10, not re-verified this session):** T-44 `[!]`, T-50
`[!]`, T-54 `[!]`, T-66 `[!]` (now down to one open live-app gap — T-80 — once T-80 lands, T-66's
own Status line and Evidence block should be reconciled, same pattern as T-52's RECONCILIATION
note), T-39/T-42/T-56/T-58/T-60 transitively blocked on T-54, T-61 `[!]`, T-23 `[!]`.

**Gotchas (carried forward, plus two new this session):** **NEW — a fresh worktree's Prisma
client defaults to `postgresql` and 8 test files (33 tests) will fail with a protocol-mismatch
error if you only run `npx prisma generate --schema .../schema.prisma`.** The correct fresh-
worktree DB setup is, from `apps/web/`: `DATABASE_PROVIDER=sqlite DATABASE_URL="file:./dev.db"
npm run db:migrate` then `... npm run db:seed`, and `DATABASE_URL`/`DATABASE_PROVIDER` must also
be set on the `vitest run` invocation itself. Without this, a subagent's "434/502 passed, 8 files
failing" is a false alarm, not a real signal — do the DB setup before trusting any vitest count
that's meaningfully below the known 492/502 baseline. **NEW — `git checkout -- <tracked file>`
and `git stash drop` are both blocked by this environment's permission classifier as irreversible
destruction; use `git stash push -u -m "<tag>"` instead (reversible) and leave superseded stashes
in place rather than fighting the classifier** — two are sitting in the stash list as of this
HANDOFF (both fully superseded by this session's real work, safe to drop whenever the classifier
allows it, harmless to leave otherwise). Carried forward: worktrees need fresh `npm install` +
workspace `dist` rebuild; a fresh worktree needs `npx prisma generate --schema
apps/web/prisma/schema.prisma` before `tsc`/`next build` (not `vitest run` — see the NEW gotcha
above for that) will pass; `packages/engine/test/output/validation-numbers.csv` picks up harmless
appended rows on every validation-suite run, discard before commit; LOG.md §5 dashboard counts
need hand recomputation after merges; stale `.tsbuildinfo` files at package roots can cause
phantom build failures — `find packages -name "*.tsbuildinfo" -delete` before trusting a build
verification.

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
work even started. It was then split into ten Area files — an improvement, but a task in
`AREA-F-frontend.md` still meant opening 3000+ lines for a ~200-line task, and every task still
paid for reading the full 1248-line `CONTRACTS.md`. It is now split one level further, by the
boundaries a task actually needs:

- **This file (`LOG.md`)** — the process rules (§2–§6 below) and the task index (§5): every
  task's id, title, status, dependencies, and the exact path to its one file.
- **`log/contracts/00-core.md`** — the small, always-required core: units, sign convention,
  the eleven heat pathways, constants, approved dependencies, the hard gate. Read in full every
  session (ritual step 3).
- **`log/contracts/<topic>.md`**, six more files (`engine-physics`, `io-contracts`,
  `data-layer`, `worker-sweep`, `architecture`, `deviations`) — the rest of the old
  `CONTRACTS.md`, split by subject. Read only the ones your task's Area README names.
- **`log/AREA-<letter>/README.md`**, ten files, one per Area (A–J) — which `log/contracts/`
  topic files that Area's tasks generally need, plus the Area-wide notes that used to sit at
  the top of the old flat Area file.
- **`log/AREA-<letter>/T-<NN>.md`**, one file per task — the full entry: why it exists, the
  prompt, files it may touch, acceptance tests, and its Evidence block. This is where a task is
  actually claimed, worked and marked done. §5's `File` column names it directly.

An agent with no memory of any previous session must be able to: read this file, find the first
`[ ]` task whose dependencies are all `[x]`, open **only that task's one file** (`log/AREA-<X>/T-<NN>.md`,
from §5), read that Area's `README.md` once for which contract topics apply, and start work —
without opening any other task's file, any other Area, or any `log/contracts/` file its Area
README didn't name.

The rule from the old single-file ledger still holds **inside each task file**: a task's entry
restates everything it needs. What changed is scope — restated *within its own file*, not
duplicated across a whole Area, let alone all 7,400 lines.

**If a task's entry sends you hunting through another task's file, or a contract clause outside
what your Area's README named, that is a defect — fix it in place** (add the reference to the
README, or the missing content to the task file), don't just work around it silently. A bare
`§5`/`§6` reference means this file; `§7`–`§10` means the matching file under `log/contracts/`.

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
   which says pnpm. See `log/contracts/deviations.md`, Deviation D-2.

2. **Run the test suite and record the result.**
   ```bash
   npx vitest run
   ```
   Write down: total test files, total tests, pass/fail, and the two numbers printed by
   `perf.test.ts` (`full simulate() incl. spin-up: N ms/run` and `100-variant sweep: N s`).
   **If the suite is red, your session's first and only job is to find out why and report it.**
   Do not start a new task on a red suite. The last recorded green state is in
   `log/contracts/00-core.md` §10.

3. **Read `log/contracts/00-core.md` in full, once.** Not the headings. The file. It is short
   (~200 lines) on purpose — units, sign convention, the eleven pathways, constants, the hard
   gate. Most of the failure modes this ledger exists to prevent are contract violations, not
   coding errors, but you no longer read all seven `log/contracts/` files to find them: once
   you've picked a task (step 5), read its Area's `README.md` for which of the other six topic
   files apply, and read only those.

4. **Read §6 — GLOBAL RULES — below, in full.** All 21 of them.

5. **Scan §5 below for the first `[ ]` task whose every `Depends on` entry is `[x]`.** Open
   *only* that task's file — the `File` column names it directly, `log/AREA-<letter>/T-<NN>.md` —
   and read that one file top to bottom. Then open that task's `log/AREA-<letter>/README.md`
   once, for the contract topic files it names (step 3).

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
| A | Foundation & contracts | 10 / 10 | `log/AREA-A/` |
| B | Engine | 17 / 18 | `log/AREA-B/` |
| C | Data layer | 5 / 5 | `log/AREA-C/` |
| D | Database tier | 7 / 7 | `log/AREA-D/` |
| E | Server tier | 5 / 7 | `log/AREA-E/` |
| F | Frontend | 13 / 15 | `log/AREA-F/` |
| G | Decision support | 0 / 5 | `log/AREA-G/` |
| H | Scenarios | 1 / 3 | `log/AREA-H/` |
| I | Validation & credibility | 2 / 4 | `log/AREA-I/` |
| J | Delivery | 1 / 6 | `log/AREA-J/` |
| | **TOTAL** | **61 / 80** | |

*(T-79 added and closed this session (Area A, Prettier formatting sweep — raised two sessions ago
from a red `npm run format:check`, drafted then abandoned uncommitted by an interrupted earlier
session, re-claimed and actually run this session, 210 files reformatted, verified regression-free
by the orchestrator: `npx vitest run` hits the exact known-green 45/492/10 baseline both before and
after the reformat once the worktree's database is set up). Two stale dashboard drifts found and
fixed while verifying it, per this file's own "the Area file is right, fix this table" rule: Area
A's true count was already 9/10 before T-79 (not the 8/10 shown here — T-72 and T-78 had landed
without this table being updated), 10/10 after; Area J's true count was already 1/5 (T-77 landed
without this table being updated), before T-80 (below) added a 6th task. Grand total corrected
58 -> 61 (the pre-existing drift) -> stays 61 once T-80 is added as not-yet-done, denominator
79 -> 80.)*

*(T-80 added this session, Area J — raised from T-66's own Evidence block (the one live-app gap
neither T-77 nor T-78 closed): `dispatchSimulation()` in `lib/store.ts` never checks real
connectivity, so `store.online` never leaves its `true` default in the live app. Not yet claimed.)*

*(T-74 added and closed this session — raised from session 7/8's own HANDOFF recommendation, same
pattern as T-71/T-72/T-73. T-52 reconciled `[x]` this session too, once T-74 closed its last
remaining gap (test 11) on top of T-73's earlier closure of test 8 — both re-verified end-to-end by
the orchestrator, not just mirrored from a subagent report. Area F: 10 -> 12 done (T-52 + T-74);
total: 54 -> 56 done, 73 -> 74 tasks.)*

*(T-75 added and closed this session — raised from session 9's own HANDOFF, same "orchestrator
creates the follow-up task" pattern as T-71/T-72/T-73/T-74. Area F: 12 -> 13 done; total: 56 -> 57
done, 74 -> 75 tasks.)*

*(T-76 added this session — raised from T-54's own Evidence block (2026-09-19 continuation), the
specific "second, small, engine-owned addition" it named as the remaining path to closing T-54's
acceptance test 4. Area B denominator moved 17 -> 18 (its header count was also found stale at
15/16 and corrected to the true 16/17 while adding this row), total tasks 75 -> 76. T-76 itself
claimed and verified this session, all 8 acceptance tests passing (see log/AREA-B/T-76.md's
Evidence block): Area B 16 -> 17 done; total 57 -> 58 done, 76 tasks.)*

*(T-71 and T-72 added this session — new tasks the orchestrator raised from the prior HANDOFF's
recommended next steps, same pattern as T-70 last session. Totals above include them as not-yet-done.
Two arithmetic drifts caught and fixed by hand here, per LOG.md's own "the Area file is right, fix
this table" rule: Area I's row had auto-merged to a stale 1/4 from two branches that each
independently flipped one task against a shared 0/4 baseline; Area F's own denominator was wrong at
13 (miscounted when T-71 was added — the true count is 11 original + T-71 = 12).)*

**THE HARD GATE: PASSED.** See `log/contracts/00-core.md` §10.

### Full task list, by Area

### Area A — Foundation & contracts — 10 / 10 — `log/AREA-A/` (header was left at 9/10 by
T-79's own commit — it should have read 10/10, since T-79 was Area A's last remaining task;
fixed here by the orchestrator per this file's own "the Area file is right, fix this table" rule,
using the actual box characters below, which are correct)

| | ID | Title | Depends on | File |
|---|---|---|---|---|
| [x] | T-01 | npm workspace root, strict TypeScript, engine package manifest | none | `log/AREA-A/T-01.md` |
| [x] | T-02 | Put the project under version control | none | `log/AREA-A/T-02.md` |
| [x] | T-03 | ESLint, Prettier, and the two boundary rules | T-02 | `log/AREA-A/T-03.md` |
| [x] | T-04 | Continuous integration | T-02, T-03 | `log/AREA-A/T-04.md` |
| [x] | T-05 | The `.work/` claim ledger and `board.sh` | T-02 | `log/AREA-A/T-05.md` |
| [x] | T-06 | Extend the shared contract with the types the rest of the build needs | T-01 | `log/AREA-A/T-06.md` |
| [x] | T-07 | Canonical test fixtures, including the C-01 kill-shot pair | T-06 | `log/AREA-A/T-07.md` |
| [x] | T-72 | Cover `apps/web/**` in the root ESLint config | T-03 | `log/AREA-A/T-72.md` |
| [x] | T-78 | Exclude test files from `apps/web/tsconfig.json` | T-03 | `log/AREA-A/T-78.md` |
| [x] | T-79 | Prettier formatting sweep | T-03 | `log/AREA-A/T-79.md` |

### Area B — Engine — 17 / 18 (header count was stale at 15/16 — the true count from the entries
themselves was 16 done of 17 pre-existing tasks, already matching the §5 dashboard row; T-76 added
this session, raised from T-54's own Evidence block, bringing the denominator to 18 and, now that
T-76 itself is done, the numerator to 17) — `log/AREA-B/`

| | ID | Title | Depends on | File |
|---|---|---|---|---|
| [x] | T-08 | Linear algebra: dense LU, Thomas, and the arrow/Schur factorisation | T-01 | `log/AREA-B/T-08.md` |
| [x] | T-09 | Envelope meshing, harmonic interfaces, composite U-value | T-01 | `log/AREA-B/T-09.md` |
| [x] | T-10 | Model assembly: node index, capacitance vector, conductance matrix | T-08, T-09 | `log/AREA-B/T-10.md` |
| [x] | T-11 | Time integration, and the AUDIT F-1 coefficient-refresh fix | T-10 | `log/AREA-B/T-11.md` |
| [x] | T-12 | ⚠ THE HARD GATE: analytical Test 2 (sinusoidal wave through a wall) and Test 7 | T-11 | `log/AREA-B/T-12.md` |
| [x] | T-13 | Analytical Tests 1, 4, 6 and 8, plus the safety and validation cases | T-11 | `log/AREA-B/T-13.md` |
| [x] | T-14 | Solar: position, decomposition, transposition | T-01 | `log/AREA-B/T-14.md` |
| [x] | T-15 | Surface boundary conditions, altitude-corrected in both directions | T-01 | `log/AREA-B/T-15.md` |
| [x] | T-16 | Loads, orchestrator and post-processing | T-11, T-14, T-15 | `log/AREA-B/T-16.md` |
| [x] | T-17 | The performance budget | T-16 | `log/AREA-B/T-17.md` |
| [x] | T-18 | Shading: mountain horizon and window overhangs | T-06 | `log/AREA-B/T-18.md` |
| [x] | T-19 | Phase-change materials: apparent heat capacity | T-06 | `log/AREA-B/T-19.md` |
| [x] | T-20 | Water and rock thermal storage, and the `StorageElement` node | T-06, T-19 | `log/AREA-B/T-20.md` |
| [x] | T-21 | Couple infiltration to opening area (closes AUDIT F-6) | T-06 | `log/AREA-B/T-21.md` |
| [x] | T-22 | Split out `post/heatFlows.ts` and add the ΔT and ground series | T-06 | `log/AREA-B/T-22.md` |
| [!] | T-23 | Validation Test 5 against NOAA, and print every measured pair | T-07 | `log/AREA-B/T-23.md` |
| [x] | T-70 | Warm-start hook: optional initial temperature state for `simulate()` | T-06, T-11 | `log/AREA-B/T-70.md` |
| [x] | T-76 | Expose the real per-node warm state as an opaque `SimulationResult.warmState` | T-70 | `log/AREA-B/T-76.md` |

### Area C — Data layer — 5 / 5 — `log/AREA-C/`

| | ID | Title | Depends on | File |
|---|---|---|---|---|
| [x] | T-24 | Material, glazing and construction catalogues, every row cited | T-06 | `log/AREA-C/T-24.md` |
| [x] | T-25 | The weather pipeline, with the mandatory lapse-rate correction | T-24 | `log/AREA-C/T-25.md` |
| [x] | T-26 | NASA POWER and Open-Meteo request builders and response parsers | T-25 | `log/AREA-C/T-26.md` |
| [x] | T-27 | Bundled TMY for Leh, Kargil, Drass, Nubra and Jaisalmer | T-25, T-26 | `log/AREA-C/T-27.md` |
| [x] | T-28 | Presets: the app opens on an interesting result | T-24, T-27 | `log/AREA-C/T-28.md` |

### Area D — Database tier — 7 / 7 — `log/AREA-D/`

*(The header above read "0 / 7" before this edit even though T-29 was already `[x]` --
stale, not touched by T-30. Corrected here while flipping T-30, per §5's own rule: the
Area file's checkboxes are truth and this table is fixed to match them.)*

| | ID | Title | Depends on | File |
|---|---|---|---|---|
| [x] | T-29 | Prisma schema, the four tables, and the first migration | T-03, T-06 | `log/AREA-D/T-29.md` |
| [x] | T-30 | The database client wrapper, and the DB-off mode that must always work | T-29 | `log/AREA-D/T-30.md` |
| [x] | T-31 | The weather cache repository | T-26, T-30 | `log/AREA-D/T-31.md` |
| [x] | T-32 | Design snapshots and share links | T-30 | `log/AREA-D/T-32.md` |
| [x] | T-33 | The simulation-run cache | T-06, T-30 | `log/AREA-D/T-33.md` |
| [x] | T-34 | The material repository and the seed script | T-24, T-30 | `log/AREA-D/T-34.md` |
| [x] | T-35 | The DB-off integration proof | T-31, T-32, T-33, T-34 | `log/AREA-D/T-35.md` |

### Area E — Server tier — 5 / 7 — `log/AREA-E/`

| | ID | Title | Depends on | File |
|---|---|---|---|---|
| [x] | T-36 | Next.js scaffold, the store, the unit boundary, and the layout slots | T-03, T-06, T-28, T-29 | `log/AREA-E/T-36.md` |
| [x] | T-37 | `/api/weather` — the CORS proxy, cached | T-26, T-31, T-36 | `log/AREA-E/T-37.md` |
| [x] | T-38 | `/api/simulate` — one run, cached | T-33, T-36 | `log/AREA-E/T-38.md` |
| [ ] | T-39 | `/api/optimise` and `/api/scenarios`, with streaming progress | T-40, T-54, T-59 | `log/AREA-E/T-39.md` |
| [x] | T-40 | The worker-thread pool, one per core | T-06, T-36 | `log/AREA-E/T-40.md` |
| [x] | T-41 | `/api/designs` and `/api/materials` | T-32, T-34, T-36 | `log/AREA-E/T-41.md` |
| [ ] | T-42 | Request validation, the error taxonomy, and rate limiting | T-37, T-38, T-39, T-41 | `log/AREA-E/T-42.md` |

### Area F — Frontend — 13 / 15 (T-52 reconciled `[x]` a prior session — T-73 and T-74 both closed its remaining gaps, re-verified end-to-end by the orchestrator, see its Evidence block's RECONCILIATION note; T-75 added this session, raised from that session's own HANDOFF, and landed this session) — `log/AREA-F/`

| | ID | Title | Depends on | File |
|---|---|---|---|---|
| [x] | T-43 | The browser Web Worker and the offline fallback path | T-36 | `log/AREA-F/T-43.md` |
| [!] | T-44 | The five-control simple form | T-28, T-36, T-41 | `log/AREA-F/T-44.md` |
| [x] | T-45 | The Advanced panel | T-36 | `log/AREA-F/T-45.md` |
| [x] | T-46 | The isometric house: click a wall, scrub the day | T-36 | `log/AREA-F/T-46.md` |
| [x] | T-47 | The temperature view (PS Deliverable 1) and the 6 AM label | T-36, T-43 | `log/AREA-F/T-47.md` |
| [x] | T-48 | The solar capture view (PS Deliverable 2) | T-36, T-43 | `log/AREA-F/T-48.md` |
| [x] | T-49 | The heat-flow view and the Sankey (PS Deliverable 3) | T-22, T-36, T-43 | `log/AREA-F/T-49.md` |
| [!] | T-50 | The survival grid | T-36, T-59 | `log/AREA-F/T-50.md` |
| [x] | T-51 | KPI cards, the integrity badge and the safety warning | T-36, T-43 | `log/AREA-F/T-51.md` |
| [x] | T-52 | The assumptions panel, exports, the offline banner and bilingual labels | T-36, T-43, T-51 | `log/AREA-F/T-52.md` |
| [x] | T-53 | The day/night animation, driven by the real solar-position code | T-46 | `log/AREA-F/T-53.md` |
| [x] | T-71 | Wire the Area F components into app-shell.tsx's placeholders | T-43, T-45, T-46, T-47, T-48, T-49, T-51 | `log/AREA-F/T-71.md` |
| [x] | T-73 | Wire T-52's meta components into app-shell.tsx's `slot-assumptions` | T-52 | `log/AREA-F/T-73.md` |
| [x] | T-74 | Wire i18n into `SimpleForm.tsx`/`KpiColumn.tsx` to close T-52's test 11 | T-47, T-51, T-52 | `log/AREA-F/T-74.md` |
| [x] | T-75 | Stack T-53's `<DayNightAnimation>` behind `<HouseView>` in `slot-house` | T-53, T-71 | `log/AREA-F/T-75.md` |

### Area G — Decision support — 0 / 5 — `log/AREA-G/`

| | ID | Title | Depends on | File |
|---|---|---|---|---|
| [!] | T-54 | The sweep engine: expand, dispatch, collect | T-06, T-24, T-28 | `log/AREA-G/T-54.md` |
| [ ] | T-55 | The browser worker pool and the shared spin-up cache | T-43, T-54 | `log/AREA-G/T-55.md` |
| [ ] | T-56 | Ranking, the Pareto front, and the perturbation-stability check | T-54 | `log/AREA-G/T-56.md` |
| [ ] | T-57 | The buildable recommendation, and the non-AI template fallback | T-24, T-56 | `log/AREA-G/T-57.md` |
| [ ] | T-58 | The AI write-up, its two-stage separation, and the number verifier | T-42, T-57 | `log/AREA-G/T-58.md` |

### Area H — Scenarios — 0 / 3 — `log/AREA-H/`

| | ID | Title | Depends on | File |
|---|---|---|---|---|
| [x] | T-59 | The eighteen-scenario matrix, built from real recorded history | T-27, T-28 | `log/AREA-H/T-59.md` |
| [ ] | T-60 | Run the matrix and shape the survival-grid contract | T-54, T-59 | `log/AREA-H/T-60.md` |
| [!] | T-61 | Multi-day runs and the sunless-streak path | T-59 | `log/AREA-H/T-61.md` |

### Area I — Validation & credibility — 2 / 4 — `log/AREA-I/`

| | ID | Title | Depends on | File |
|---|---|---|---|---|
| [x] | T-62 | The continuous energy-balance audit in CI | T-04, T-28, T-59 | `log/AREA-I/T-62.md` |
| [ ] | T-63 | `VALIDATION.md` | T-23, T-62 | `log/AREA-I/T-63.md` |
| [x] | T-64 | `EQUATIONS.md` and the limitations list | T-18, T-19, T-22 | `log/AREA-I/T-64.md` |
| [ ] | T-65 | One EnergyPlus reference case (needs a human owner) | T-27, T-62, **plus a named human owner** | `log/AREA-I/T-65.md` |

### Area J — Delivery — 1 / 6 — `log/AREA-J/` (header was left at 0/5 by T-77's own commit — it
should have read 1/5, since T-77 itself was done; fixed here by the orchestrator, T-80 also added,
moving the denominator to 6)

| | ID | Title | Depends on | File |
|---|---|---|---|---|
| [!] | T-66 | Offline: the PWA and a network-free static build | T-27, T-36, T-43 | `log/AREA-J/T-66.md` |
| [ ] | T-67 | Deployment | T-29, T-42, T-66 | `log/AREA-J/T-67.md` |
| [ ] | T-68 | The demo script and hostile-question preparation | T-63, T-66 | `log/AREA-J/T-68.md` |
| [ ] | T-69 | The PPT | T-46, T-47, T-63, T-68 | `log/AREA-J/T-69.md` |
| [x] | T-77 | Wire PWA registration into `app/layout.tsx` | T-66 | `log/AREA-J/T-77.md` |
| [ ] | T-80 | Wire real connectivity detection into `dispatchSimulation()` | T-66 | `log/AREA-J/T-80.md` |


---

## 6. GLOBAL RULES

These bind every task. Rules 1–16 are adapted from `WORKERS.md` §7.1; rules 17–21 are new and
govern the database tier that §9 introduces.

1. **Read `log/contracts/00-core.md` in full before starting any task, plus whichever other
   `log/contracts/<topic>.md` files your task's Area README names.** The contracts are the thing
   six parallel workers agree on. Violating one is worse than writing no code at all. If a task
   turns out to need a contract clause outside the files its Area README named, that is a ledger
   defect — report it and fix the README, don't silently work around the gap.

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

**If you just finished a task:** paste your measured numbers into its Evidence block **in its own
task file**, fill in *Completed by* and *Date* there, flip its box to `[x]` there, mirror the flip
in §5 **in this file**, and commit with the task id as the first token of the message.

**If you changed something this ledger says, change it in the file that actually says it** — the
task's own file (`log/AREA-<letter>/T-<NN>.md`) for its own content, the matching
`log/contracts/<topic>.md` for a shared contract, this file for the index or the rules. A ledger
that disagrees with the disk, or with itself, is worse than no ledger, because the next agent will
trust it.

**Only one HANDOFF section lives in this file at a time.** When you write a new one (§8 in
`ORCHESTRATOR.md`), move whatever HANDOFF was here before yours into `log/HANDOFF-ARCHIVE.md`,
inserted at that file's top. Old HANDOFFs are historical record, never required reading — that is
what keeps this file's fixed per-session cost from growing session over session.
