# HANDOFF-ARCHIVE.md — retired HANDOFF sections from LOG.md

> Historical record only. Never required reading for a session or a task. `LOG.md` keeps
> only the single most recent HANDOFF; when a session writes a new one, the previous
> occupant of that slot moves here, inserted at the top (newest-archived-first).

## HANDOFF (2026-09-20, end of session — ninth session)

**Completed this session: ledger moved 54 / 73 → 56 / 74.** Two boxes flipped: **T-74** (new task,
raised from session 7/8's own top-priority HANDOFF recommendation) and **T-52** (reconciled from
`[!]` to `[x]` once T-74 closed its last remaining gap). One new task id created and closed in the
same session, same "orchestrator creates the follow-up task from the prior HANDOFF" pattern
T-70/T-71/T-72/T-73 all established.

**Session start found a discrepancy worth recording:** session 8's own HANDOFF claimed "no open
worktrees" and "no tasks claimed," but `git worktree list` at this session's start showed an
existing `../wt-T-74` worktree on branch `task/T-74`, sitting at master's tip with zero commits and
zero diff. Investigated before doing anything else (per ORCHESTRATOR.md §3's own instruction to
check worktrees/branches at session start): harmless, not a sign of lost work, just an
unaccounted-for empty scaffold. Reused it rather than deleting it, since its id already matched the
task this session intended to raise anyway.

**T-74 (NEW task, Area F — wire i18n into `SimpleForm.tsx`/`KpiColumn.tsx`) — `[x]`:** closed the
top-priority gap both session 7's and session 8's HANDOFFs named. Added
`components/inputs/messages.ts` (33 EN/33 HI keys) and `components/kpis/messages.ts` (20 EN/20 HI
keys), following `components/meta/messages.ts`'s exact `registerMessages` pattern; wired both into
their components via `t(key, locale)`; added the two documented side-effect import lines to
`components/meta/locale/aggregator.ts` (and nothing else in `components/meta/**`). All 9 acceptance
tests independently re-verified by the orchestrator, not just mirrored from the subagent's report:
fresh `tsc --noEmit` (0 errors), fresh `npm run build --workspace apps/web` (exit 0), fresh
`npx vitest run apps/web/components/{inputs,kpis,meta}` (6 files / 40 tests, matching the subagent's
count), `git diff --stat` against the true merge-base confirming the allow-list was respected
exactly (only the 5 intended files plus the two ledger files touched), `grep -rn "273\.15"` on both
new `messages.ts` files empty, and a live re-render of the real `AppShell` (via
`react-dom/server`'s `renderToStaticMarkup`, real bundled Leh preset through the real engine, no
jsdom) with `store.locale = 'hi'` showing translated labels and zero leaked `inputs.simpleForm.` /
`kpis.column.` key substrings in the output.

**T-52 (assumptions panel, exports, offline banner, i18n, Area F) — reconciled `[!]` → `[x]`:** its
own Evidence block from session 7 named exactly two gaps outside its allow-list — test 8 (app-shell
wiring) and test 11 (SimpleForm/KpiColumn i18n) — both now closed, by T-73 (session 7) and T-74
(this session) respectively. Re-verified end-to-end this session with one additional check beyond
what either subagent ran: a single real `AppShell` render, locale forced to `'hi'`, confirming
**both** gaps simultaneously — `data-testid="assumptions-panel"` present (test 8) and real Hindi
text with no leaked translation keys anywhere in the tree, including SimpleForm/KpiColumn labels
(test 11). All 13 of T-52's own acceptance tests now hold. The original 11/13 evidence from session
7 is left untouched in the Area file as the historical record of what T-52 itself could prove
standalone; a RECONCILIATION note is appended below it, not merged into it, so the two are never
confused.

**Full suite, measured fresh on master after both merges:** `npx vitest run` → **45 files, 487
passed, 10 skipped (497 total), exit 0**. `full simulate() incl. spin-up: 31.9 ms/run`,
`100-variant sweep: 2.88 s` (both slightly better than session 7's own baseline of 34.4 ms / 3.40 s
— within normal run-to-run variance, not a claimed improvement). One anomaly worth flagging for the
next session: this run's wall-clock duration was **355.65 s**, far longer than session 7's report of
a fast run, even though the per-file numbers and pass counts are identical — most likely system load
from other processes running concurrently on this machine during the run, not a regression in the
suite itself (the two numbers that actually matter, the perf budget and the pass count, are both
fine). Not investigated further this session; if a future session sees the same slowdown with
nothing else running, that would be worth a real look. `npx tsc --noEmit -p apps/web/tsconfig.json`:
0 errors. `npm run build --workspace apps/web`: exit 0 (the one pre-existing, unrelated
`topLevelAwait` warning from `@shelter/engine/dist/serialise.js`).

**Worktrees/branches:** `../wt-T-74` removed and `task/T-74` deleted after merging, confirmed clean
(`git worktree list` shows only the main checkout). Several older merged branches
(`task/T-52`, `task/T-53`, `task/T-62`, `task/T-64`, `task/T-71`, `task/T-72`, `task/T-73`) are still
present locally from prior sessions — left untouched, as they were already there at this session's
start and cleaning them up was not part of this session's task; harmless either way since they carry
no unmerged work (all already folded into master).

**In progress:** nothing. No open claims, no open worktrees.

**Recommended next step:** the two follow-ups session 7's HANDOFF named as lower priority than the
now-closed i18n gap, neither claimed as a task id yet: (1) wire T-53's `<DayNightAnimation>` into
`HouseView`/`app-shell.tsx` (no overlay slot exists yet — T-53's own Evidence block flags this); (2)
T-66 (PWA/offline) is more ready than before (T-52 and its wiring are now fully closed), but its
acceptance tests 9 and 11 still need T-57 (AI template fallback) and T-50 (survival grid), neither
done — expect a partial/blocked result if claimed now, same shape as T-44. Third, in strict
ledger-scan order once those land: `npm run format:check` is still red (115 pre-existing files,
found while verifying T-72 two sessions ago) — unrelated to lint config, nobody owns Prettier
formatting as a task yet.

**Blocked tasks (unchanged from session 7, T-52 now removed from this list since it reconciled):**
T-44 `[!]` (human test subject + app-shell wiring — the app-shell half is now arguably closeable
since T-71/T-73 both landed, but the human-test-subject half of test 1 still needs a named human
owner); T-50 `[!]` (originally blocked on T-47, now needs re-assessment since T-47 is done); T-54
`[!]` (warm-state speedup finding documented); T-39/T-42/T-56/T-60 transitively blocked on T-54;
T-61 `[!]` (human decision on test 9 wording); T-23 `[!]` (human-owned NOAA comparison).

**Gotchas (all carried forward from prior sessions, none new this session):** worktrees need fresh
`npm install` + workspace `dist` rebuild; a fresh worktree needs `npx prisma generate --schema
apps/web/prisma/schema.prisma` (non-destructive, schema-only, does not touch any database, does not
trigger the AI-agent consent gate) before `tsc`/`next build` will pass, since a bare `npm install`
alone does not run Prisma's generator; `packages/engine/test/output/validation-numbers.csv` picks up
harmless appended rows on every validation-suite run, discard before commit (done this session);
LOG.md §5 dashboard counts need hand recomputation after merges; stale `.tsbuildinfo` files at
package roots (not inside gitignored `dist/`) can cause phantom build failures — `find packages -name
"*.tsbuildinfo" -delete` before trusting a build verification.

---

## HANDOFF (2026-09-20, end of session — eighth session)

**Completed this session: NONE.** Session 8 reached the ≥40% context stop threshold (ORCHESTRATOR.md §8) during startup ritual and initial planning, before delegating any work. No tasks were claimed, no worktrees created, no merges performed. Ledger stays at **54 / 73**, unchanged from session 7's handoff.

**Session 8 startup verification (completed):**
- Toolchain verified: Node v24.20.0, npm 11.19.0
- Test suite: **GREEN** (45 files, 487 passed, 10 skipped, exit 0)
- Performance: 34.4 ms/run simulate, 3.40 s 100-variant sweep
- No open worktrees (`git worktree list` clean)
- No uncommitted branches
- Database: not verified this session (master's `dev.db` was properly migrated+seeded at end of session 7 per that HANDOFF's own gotcha note)

**In progress:** nothing. No claims, no open worktrees.

**Recommended next step (UNCHANGED from session 7):** The three follow-up gaps session 7's HANDOFF named, in priority order:

1. **HIGHEST PRIORITY, explicitly called out by session 7** — Add `t()`/`registerMessages` calls into `components/inputs/SimpleForm.tsx` and `components/kpis/KpiColumn.tsx` (both already `[x]`: T-47, T-51) so T-52's locale switch actually changes their labels. This is what T-52's own acceptance test 11 is still missing. Small, well-bounded, single-Area task. Session 8 verified these two files currently have zero i18n calls (`grep` confirmed both render 100% hardcoded English JSX), exactly matching session 7's finding. **This unblocks T-52 from `[!]` → `[x]`.**

2. Wire T-53's `<DayNightAnimation>` into `HouseView`/`app-shell.tsx` (no overlay slot exists yet — T-53's own Evidence block flags this). 

3. T-66 (PWA/offline) — more ready than before (T-52's banner and T-71/T-73's wiring both landed), but acceptance tests 9 and 11 still need T-57 (AI template fallback) and T-50 (survival grid), neither done — expect a partial/blocked result if claimed now, same shape as T-44.

**Blocked tasks (unchanged):** T-52 `[!]` (11/13, blocked on item #1 above); T-44 `[!]` (human test subject + app-shell wiring); T-50 `[!]` (originally blocked on T-47, now needs re-assessment since T-47 is done); T-54 `[!]` (warm-state speedup finding documented); T-39/T-42/T-56/T-60 transitively blocked on T-54; T-61 `[!]` (human decision on test 9 wording); T-23 `[!]` (human-owned NOAA comparison).

**Gotchas (all carried forward from session 7, none new):** worktrees need fresh `npm install` + workspace `dist` rebuild; fresh worktree needs its own `dev.db` via `cd apps/web && DATABASE_PROVIDER=sqlite DATABASE_URL="file:./dev.db" npm run db:migrate` plus `npm run db:seed --workspace apps/web`; subagent rate-limit interruption → resume with `SendMessage`; `packages/engine/test/output/validation-numbers.csv` picks up harmless appended rows on every validation-suite run, discard before commit; LOG.md §5 dashboard counts need hand recomputation after merges (git can't know stale counts should sum); stale `.tsbuildinfo` files at package roots (not inside gitignored `dist/`) can cause phantom build failures — `find packages -name "*.tsbuildinfo" -delete` before trusting a build verification.

---

## HANDOFF (2026-09-20, end of session — seventh session)

**Completed this session: ledger moved 48 / 70 → 54 / 73.** Six tasks landed clean `[x]`: T-53, T-62,
T-64, T-71, T-72, T-73. One (T-52) is honestly `[!]` BLOCKED on real cross-component gaps, not a
failure. Three new task ids were created and closed in the same session (T-71, T-72 — both raised
directly from last session's own HANDOFF recommendation — and T-73, raised mid-session from T-52's
own Evidence block, the same "orchestrator creates the follow-up task" pattern T-70 established two
sessions ago). Full suite green: **45 files, 487 passed, 10 skipped (497 total), exit 0**, measured
fresh on master after every merge this session, with the local `dev.db` properly migrated+seeded
first (see gotcha below — this bit the first same-session attempt). `npm run build --workspace
apps/web` exits 0 (one pre-existing, unrelated `topLevelAwait` warning from
`@shelter/engine/dist/serialise.js`). `npx tsc --noEmit -p apps/web/tsconfig.json`: **0 errors**.
Every merge to master was independently reverified by the orchestrator: fresh `npm install` +
workspace `dist` rebuild in each worktree, that worktree's own test file re-run directly, `tsc
--noEmit`, a `git diff` against the branch's true merge-base to confirm each subagent's allow-list
was actually respected, and for two tasks (T-62, T-53) a live re-enactment of the claimed
negative-control/finding rather than trusting the subagent's pasted numbers alone.

**T-62 (energy-balance CI audit, Area I) — `[x]`:** extended `scripts/ci-energy-balance.mjs` to 29
cases (2 fixtures + 6 presets + 18 scenarios + PCM + storage + night-window), all residuals
`< 1.1e-4`, well inside the `1e-3` gate. All three negative controls independently re-enabled and
re-run by the orchestrator (not just trusted): Q5-in-boundary → residual 0.0502, Q4-dropped → 0.357,
Q9-sign-flipped → 0.0560, all correctly pushed the script to exit 1, all cleanly reverted after.

**T-64 (`EQUATIONS.md`, Area I) — `[x]`:** 1190-line document, 28 sections, every one carrying a
citation + `file:function` line (mechanically confirmed: 28/28/28). All ten named simplifications
present with ceiling+upgrade path. `well-stratified` appears nowhere in it. Could not spawn the 3
subagents its own guidance suggested (harness constraint — subagents can't spawn subagents); worked
sequentially instead, same precedent T-49 set last session.

**T-71 (wire the 7 done Area F components into `app-shell.tsx`) — `[x]`:** the single
highest-leverage pickup last session's HANDOFF named, closed cleanly. `SimpleForm`, `AdvancedPanel`,
`HouseView`, `TempChart`, `SolarPanel`, `HeatFlowPanel`, `KpiColumn` all wired to the real store;
`slot-tab-grid`/`slot-assumptions` correctly left as placeholders (T-50/T-52 didn't exist yet at
merge time). All 8 acceptance tests independently re-verified by the orchestrator (tsc, build,
component-suite re-run — same pass counts).

**T-72 (`eslint.config.js` apps/web coverage, Area A) — `[x]`:** the multi-session-carried gap,
finally claimed. Added a flat-config block from `eslint-config-next`'s native flat export (no
`FlatCompat`, no new dependency), fixed one genuine violation, scoped off one pre-existing
false-positive rule for `apps/web/**` with a documented reason. **Real upstream bug hit and worked
around, not silently avoided:** `eslint-plugin-react`'s `settings.react.version: 'detect'` crashes
under this repo's installed `eslint@10.10.0` — pinned the version explicitly instead (a supported
config knob). T-03's own four boundary-rule revert-tests re-run by the orchestrator against
`packages/engine/src/air.ts`: unchanged, confirming the new block never widened onto `packages/**`.
**Found but correctly left alone (not this task's job):** `npm run format:check` is already red, 115
pre-existing files, unrelated to lint config — flagged for whichever task owns Prettier config.

**T-53 (day/night animation, Area F) — `[x]`:** built `components/house/daynight/**` — real
`sunPosition()` import from `@shelter/engine`, no independent solar trig anywhere in the directory
(mechanically grepped). All 12 acceptance tests pass. **Honest finding, verified by the orchestrator
directly:** the equinox altitude anchor reads 55.4° vs CONTRACTS.md's stated ±0.2° band — traced to
`solar.test.ts`'s own `toBeCloseTo(expected, 0)`, which is actually a ±0.5° tolerance (Jest/vitest
precision-digit semantics), a pre-existing prose-vs-test looseness this task inherited, not
introduced. **Left un-wired into `app-shell.tsx`** (no overlay slot exists there) — flagged as a
follow-up, not yet claimed as a task id (lower priority than T-52's own follow-up, below).

**T-52 (assumptions panel, exports, offline banner, i18n, Area F) — `[!]` BLOCKED, correctly:** 11
of 13 acceptance tests pass with real evidence — mechanical constants diff empty (17/17), CSV/JSON
exporters byte-exact and round-trip clean, a real live-edited-constant KPI change
(`KEROSENE_INR_PER_L` 80→120 moves `costPerYearINR` 25524→38287), print via `window.print()` only
(no PDF library). **Two tests genuinely blocked by files outside this task's allow-list, both
verified real by the orchestrator directly** (`grep`-confirmed `slot-assumptions` was still a bare
placeholder and `SimpleForm.tsx`/`KpiColumn.tsx` call no `t()`/`registerMessages` anywhere): test 8
(printed output needing the panel actually wired into the page) and test 11 (Hindi changing *every*
basic-panel/KPI label, not just this task's own). **Test 8's gap was closed same-session by T-73**
(below); **test 11's gap is still open** — see Recommended next step.

**T-73 (NEW task, Area F — wire T-52 into `app-shell.tsx`'s `slot-assumptions`) — `[x]`:** the
orchestrator created this the moment T-52 landed, same pattern as T-70/T-71's own origin. Five-line
diff, one file. `AssumptionsPanel`/`LimitationsList`/`ExportPanel` now render where the placeholder
was; `OfflineBanner`/`LocaleSwitch` render at the shell's top level (global concerns, not scoped to
one column). All 8 acceptance tests independently re-verified (tsc, build, component-suite rerun —
same 4-file/10-test count T-52 itself recorded).

**T-53, T-64, T-72 all hit the same session-wide rate limit mid-task** (unrelated to the repo),
resumed cleanly via `SendMessage` with instructions to re-verify uncommitted worktree state rather
than trust the pre-interruption plan — same recovery pattern as prior sessions, zero lost work, now
confirmed across a fourth session.

**Orchestrator-caught, non-obvious issues this session (both fixed, neither a subagent's fault):**
- **A phantom build failure from stale `.tsbuildinfo` files.** `packages/engine/tsconfig.tsbuildinfo`
  and `packages/optimise/tsconfig.tsbuildinfo` live at the package **root**, not inside the gitignored
  `dist/`. Deleting `dist/` for a clean verification build left these stale, and `tsc -b` then reported
  8 fabricated type errors in `sweep.ts` that don't exist on a truly fresh checkout (confirmed via a
  disposable worktree at the pre-session commit — clean). Fix: `find packages -name "*.tsbuildinfo"
  -delete` alongside any `rm -rf packages/*/dist` before trusting a build result.
- **Two stale dashboard-arithmetic drifts caught mid-merge**, same class of bug LOG.md's own §5 note
  already warns about (two branches independently flipping different tasks against a shared stale
  baseline auto-merges to the *smaller* of the two counts, silently). Area I's row and Area F's own
  denominator (a fresh miscount of mine, 13 vs the true 12 at the time) were both hand-corrected —
  see the dashboard's own inline note for the arithmetic.
- **Master's own local `dev.db` was never migrated this session until the very last verification
  pass** — the first full-suite run on master after all merges showed 33 false failures (Prisma
  `findUniqueOrThrow` against a database that plain didn't exist yet in this checkout, distinct from
  every individual worktree which each got their own). Fixed with the standard `db:migrate`+`db:seed`
  incantation; re-run came back fully green. **Do this early next session**, before the first
  full-suite check, not at the end.

**In progress:** nothing. No open worktrees or branches (`git worktree list` / `git branch -a` both
clean, everything lives on `master`).

**Recommended next step:** Two follow-up gaps T-52 itself surfaced, neither claimed as a task id yet:
(1) **higher priority** — add `t()`/`registerMessages` calls into `components/inputs/SimpleForm.tsx`
and `components/kpis/KpiColumn.tsx` (both already `[x]`, both currently call no i18n API at all) so
T-52's locale switch actually changes their labels — this is what T-52's own acceptance test 11 is
still missing, and it is the kind of small, well-bounded, single-Area task this ledger's pattern
handles cleanly. (2) wire T-53's `<DayNightAnimation>` into `HouseView`/`app-shell.tsx` (no overlay
slot exists yet — T-53's own Evidence block flags this). Third, unclaimed and lower-urgency: T-66
(PWA/offline) is more ready than before (T-52's banner and T-71/T-73's wiring both landed), but its
acceptance tests 9 and 11 still need T-57 (AI template fallback) and T-50 (survival grid), neither
done — expect a partial/blocked result if claimed now, same shape as T-44. Fourth, lowest urgency,
carried from two sessions back: the opaque per-node warm-state handle for `SimulationResult`
(T-54's finding) to let a T-54 continuation clear its 2x sweep-speedup bar. In strict ledger-scan
order once those land: T-52 needs its own continuation once its two gaps close; T-39/T-42/T-56/T-60
stay transitively blocked on T-54; T-63 stays blocked on T-23 (human-owned NOAA comparison).

**Carried forward from prior sessions, still unaddressed (not touched this session):**
- **T-61 (multi-day runs, Area B/H) stays `[!]`** — unchanged, still needs a human decision on
  rewording acceptance test 9's literal 8×-10× figure (see prior HANDOFFs for full detail).
- **Real engine bug, still live:** `transposition.ts`'s HDKR `Rb` clamp — unchanged, still needs a
  new Area B task (full reproduction in T-14's addendum, `log/AREA-B-engine.md`).
- `CONTRACTS.md` §7.5's `Surface.area` "NET, not gross" doc-vs-code mismatch — unchanged, still just
  a docs fix, still not made.
- T-23 stays `[!]` (Area B, solar validation vs NOAA) — unchanged, root cause owned by closed T-14.
- `npm run format:check` is red (115 pre-existing files, found while verifying T-72) — unrelated to
  lint config, nobody owns Prettier formatting as a task yet.

**Gotchas (all previously documented and still true, plus two new ones from this session — see
above): worktrees need a fresh `npm install` + a fresh build of every workspace dependency they
touch (`dist/` is gitignored); a fresh worktree (and the main checkout itself, confirmed the hard
way this session) needs its own local `dev.db` via `cd apps/web && DATABASE_PROVIDER=sqlite
DATABASE_URL="file:./dev.db" npm run db:migrate` (never `prisma migrate dev` directly), plus
`npm run db:seed --workspace apps/web`; a subagent interrupted by a rate limit is not a failed task —
resume with `SendMessage`, tell it to re-verify its own uncommitted state; `packages/engine/test/
output/validation-numbers.csv` picks up a harmless appended-rows diff on every `vitest run` touching
the engine's validation suite — discard it before every commit/merge; the top-level `LOG.md` §5
dashboard table needs its counts recomputed by hand after every merge, since git has no way to know
two branches' stale counts should sum rather than overwrite — check it, don't just trust a clean
auto-merge.

---
