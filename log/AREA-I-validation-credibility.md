> This file is one Area of the ShelterSim build ledger. The index and full file map are in
> `LOG.md` at the repo root. Shared contracts, constants and the eleven heat pathways referenced
> below as "§7.x" live in `log/CONTRACTS.md` (§7–§10 of the original single-file ledger).
> References to "§5" or "§6" below mean the corresponding section still in `LOG.md`.
> Read `log/CONTRACTS.md` once per session (per the ritual in `LOG.md` §2), not once per task.

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

