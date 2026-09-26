# HANDOFF archive (newest first)

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

