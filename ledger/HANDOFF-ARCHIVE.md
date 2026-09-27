# HANDOFF archive (newest first)

## HANDOFF (2026-09-27, session 6 — Q2 merged, D1 published, Q2F running)

**Phase:** Studio v2 (plan `ledger/V2.md`, batches `ORCHESTRATOR.md` §10).

**Done this session:** **Q2** merged (`2e17ed2`): `apps/studio/e2e/flow.mjs` now covers typed entry, cylinder,
2 storeys, 3D click → field highlight, save/reload persistence and old-shape designs (29/29, 3× green; orchestrator
re-ran it). **D1** (REVIEW): `ARCHITECTURE-STUDIO.md` + page https://claude.ai/artifact/4hcTeGv6GQPQFD9f3fRsEv
(source `ledger/d1-architecture-page.html`); stale API.md §10 and env.ts comment fixed.

**In progress:** **Q2F** (`ledger/tasks/Q2F.md`) — Sonnet agent in worktree `../wt-q2f`, branch `task/q2f`: dome
windows never render in the viewer (`windowRect` fixed margins > dome band height), popover covers its part,
landing hero overlap at 1440 + hero text contrast. If the session was cut off: check `git -C ../wt-q2f log`, the
Q2F Evidence block, then verify per ORCHESTRATOR.md §7 or re-brief.

**Recommended next step:** verify + merge Q2F (screenshots by eye: dome window, popover 1440/390, landing 1440
light/dark), then re-check the D1 page for staleness (popover/landing wording only) and mark D1 DONE. That closes v2.

**Known follow-ups (carried):** Dashboard/Compare N+1 `GET .../simulations`; duplicated KPI labels
(`routes/compare/kpiTable.ts` vs `results/Kpis.tsx`); sun line leaves the frame; engine tests rewrite
`packages/engine/test/output/validation-numbers.csv` (`git checkout` it before the frozen guard); two-storey slab
constants (0.15 m, 8 W/m²K) are documented assumptions (API.md §3c); the `?g4e2e=1` test hook ships in production
(inert without the param). playwright-core for E2E is staged per session in the scratchpad (`npm i playwright-core`
in `<scratchpad>/pw`).

## HANDOFF (2026-09-26, end of session 4 — Studio v2 build tasks complete)

**Phase:** Studio v2 (plan `ledger/V2.md`, batches `ORCHESTRATOR.md` §10). User ended the day after G4.

**Merged into `studio/main` (each verified per ORCHESTRATOR.md §7; see each task file's "Orchestrator review"):**
G1 typed numeric entry · G2 shape contract + server facets (box/cylinder/dome, 1–2 storeys single-zone) · G3 shapes in
viewer + Geometry controls · G5 landing redesign · **G4 select-to-edit** (session 4: orchestrator rebased onto
studio/main, resolved `ShelterViewer.tsx` keeping both `autoRotate` + `interactive`, fixed a build error; a fresh
agent verified all 8 conditions live). Suites on `studio/main` (`ab7d70a`): studio 118/118, studio-server 69 (+2
skipped), studio build clean, frozen guard empty.

**In progress:** nothing. No task worktrees or branches remain. No orchestrator-started servers running
(:4100/:5273 are the user's own `dev:studio`).

**Recommended next step:** batch 4 — **Q2** (E2E + visual QA, `ledger/tasks/Q2.md`). Fold in the two polish
follow-ups found in review: (a) landing at 1440 — headline runs across the building (offset the model right);
(b) Studio at 1440 — the part popover partly covers the south window it edits (anchor beside/above the part).
Route any findings as `Q2F`. Then batch 5 — **D1** architecture map (Explore agent for facts, orchestrator writes +
publishes the HTML page and `ARCHITECTURE-STUDIO.md`).

**Known follow-ups (carried):** Dashboard/Compare N+1 `GET .../simulations`; duplicated KPI labels
(`routes/compare/kpiTable.ts` vs `results/Kpis.tsx`); sun line leaves the frame; engine tests rewrite
`packages/engine/test/output/validation-numbers.csv` (`git checkout` it before the frozen guard); two-storey slab
constants (0.15 m, 8 W/m²K) are documented assumptions (API.md §3c); the `?g4e2e=1` test hook ships in production but
is inert without the query param (needed because the E2E runs against the production build).

**Rate limits:** Sonnet agents hit the session limit twice (G2 first attempt, G4 first attempt). Brief agents to commit
WIP at clean points; after a cut-off, commit what's in the worktree and record the state in the task file first.

## HANDOFF (2026-09-26, end of session 3 — Studio v2 partly built)

**Phase:** Studio v2 (plan `ledger/V2.md`, batches `ORCHESTRATOR.md` §10). The user asked to wrap up after batch 3.

**Merged into `studio/main` this session (each verified per ORCHESTRATOR.md §7; see each task file's "Orchestrator
review"):** G1 typed numeric entry (+ orchestrator fixes: arrows commit, round-before-clamp, float noise), G2 shape
contract + server facets (box/cylinder/dome, 1–2 storeys single-zone), G3 shapes in viewer + Geometry controls
(+ per-storey Height hint), G5 landing redesign (+ theme-restore bug fix). Suites on `studio/main`: studio-server
69 (+2 skipped), studio 103. Frozen guard empty.

**In progress — NOT merged:** **G4** select-to-edit, worktree `../wt-g4`, branch `task/g4` (tip `fe2c8f6`). Its agent
hit the Sonnet rate limit mid-task. Tests 114/114 pass there, but **the build fails** (`ShelterViewer.tsx:132`, `size`
used before declaration, from a half-done QA-hook edit). Branch predates G5 → rebase and hand-merge
`ShelterViewer.tsx` (keep both `autoRotate` and `interactive` props). Full state + resume steps: `ledger/tasks/G4.md`
§Evidence "State at cut-off".

**Blocked:** nothing. **Servers:** none started by the orchestrator are running; :4100/:5273 are the user's own.

**Session 4 (in progress):** G4 rebased + build fixed by the orchestrator; verification agent launched. **User: last task of
the day — finish G4, start nothing new, then wrap up.**

**Recommended next step:** (1) re-brief a Sonnet agent on G4 in `../wt-g4` per its task file's resume note, verify,
merge; (2) Q2 (E2E + visual QA) — include the G5 follow-up (at 1440 the landing headline runs across the building;
offset the model right); (3) D1 architecture map (orchestrator + Explore agent).

**Known follow-ups (carried):** Dashboard/Compare N+1 `GET .../simulations`; duplicated KPI labels
(`routes/compare/kpiTable.ts` vs `results/Kpis.tsx`); sun line leaves the frame; engine tests rewrite
`packages/engine/test/output/validation-numbers.csv` (`git checkout` it before the frozen guard). Two-storey slab
constants (0.15 m, 8 W/m²K) are documented assumptions (API.md §3c).

## HANDOFF (2026-09-26, end of session 2)

**All tasks DONE and merged into `studio/main`** (each verified by the orchestrator per ORCHESTRATOR.md §7: tests,
build, frozen guard, screenshots read by eye): F2b (mitred extruded walls; round 1 rejected for visible corner seams),
F3 (Studio page; round 1 rejected for roof-only viewer framing + heat-flow label overlap; also fixed a real Save-run
500 in `api/client.ts`), F4 (landing, auth, dashboard, compare; orchestrator fixed a `-0.0` KPI formatting bug),
F2c (aspect-aware camera framing), Q1 (committed E2E `apps/studio/e2e/flow.mjs`, 13/13; 3 findings), Q1F (those 3
findings fixed). Suites at Q1: studio-server 49 (+2 skipped), studio 73, server 12, engine 160 (+10 skipped), data 86.

**In progress:** nothing. No task worktrees or branches remain. No servers left running on studio/scratch ports.

**Run the E2E:** `timeout 180 env PLAYWRIGHT_CORE=<path to a playwright-core install> node apps/studio/e2e/flow.mjs`
(playwright-core is deliberately not a repo dependency; `npm i playwright-core` into any scratch dir).

**Known follow-ups (not bugs, not scheduled):** Dashboard/Compare do one `GET .../simulations` per design (N+1; a
batch route would be an API.md change → ask the user); KPI labels are duplicated in `routes/compare/kpiTable.ts` and
`results/Kpis.tsx` (export one `KPI_DEFS` next time results is touched); the sun line's far end leaves the frame at
all aspects (accepted since F2); engine tests rewrite `packages/engine/test/output/validation-numbers.csv`, so
`git checkout` it before the frozen guard.

**Recommended next step:** ask the user what is next. The planned scope is complete. `apps/studio-server/.env` now
exists, so `npm run dev:studio` (:4100/:5273) is the way to try the app for real. Old-app servers on :4000/:5173 are
the user's; leave them alone.

## HANDOFF (2026-09-26, end of session 1)

**Merged into `studio/main` (verified by the orchestrator):** S0, P1, P2, P3, F1, F1b, F2, plus orchestrator fixes:
shared `design/prepare.ts` (saved runs of custom-location designs fetch weather too), JWT `expiresIn 7d`, dummy-hash
login timing, ISO-string timestamps, `/api/options` default/preset thicknesses. Server 49 tests, client 38 tests green.

**In progress — both agents were cut off by the Sonnet session limit; their work is committed as WIP, NOT merged:**
- **F2b** — `../wt-f2b`, branch `task/f2b` (`51e5151`). Walls rebuilt as extruded shapes. Build + 38 tests green.
  Left: the visual QA screenshots + pixel check (conditions 2), then Evidence. Scratch vite proxy change was reverted.
- **F3** — `../wt-f3`, branch `task/f3` (`76665da`). `src/controls/**` (all 6 sections, location search, orientation
  dial, debounced-request hook), `src/results/**` (explain port, °C formatting, temperature + heat-flow charts, KPIs),
  `routes/Studio.tsx`. Build + 56 tests green. Left (the agent's last step was "wrap ResultsPanel usage in
  Suspense"): finish Studio page wiring, the full flow check (register → new design → edit → preview → save → run →
  reload) against the scratch Mongo server, screenshots, Evidence.

**Recommended next step:** re-brief a fresh Sonnet agent for each IN the existing worktrees (`npm ci` is already done
there), pointing at its task file's "Resume notes". Review both (§7), merge F2b first, then F3. Then F4 → Q1.
No servers are left running on studio ports. Old app dev servers on :4000/:5173 are the user's; leave them.
Main tree `node_modules`: after merging lockfile changes run `npm install` (NOT `npm ci`; the old app runs from it).
**Waiting on the user for** `MONGODB_URI` + `JWT_SECRET` (only needed to run the app, not for tests).

### HANDOFF (2026-09-25, session 1 — in progress)

Merged into `studio/main`: P1, P3, P2 (+ orchestrator integration fix: `design/prepare.ts` so saved runs of
custom-location designs resolve weather), security fixes (JWT `expiresIn 7d`, dummy-hash login timing), F1.
F1's agent hit the Sonnet session limit mid-rebase; orchestrator finished the rebase and verified it.
Main tree `node_modules` must be refreshed with `npm install` (NOT `npm ci`: old app dev servers on :4000/:5173 run
from it) after merges that change the lockfile.
**Waiting on the user for** `MONGODB_URI` + `JWT_SECRET` (running the app only).
F1b + F2 merged. **Next step:** F2b ∥ F3 in worktrees, then F4 → Q1.

