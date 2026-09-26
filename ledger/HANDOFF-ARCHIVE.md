# HANDOFF archive (newest first)

### HANDOFF (2026-09-25, session 1 — in progress)

Merged into `studio/main`: P1, P3, P2 (+ orchestrator integration fix: `design/prepare.ts` so saved runs of
custom-location designs resolve weather), security fixes (JWT `expiresIn 7d`, dummy-hash login timing), F1.
F1's agent hit the Sonnet session limit mid-rebase; orchestrator finished the rebase and verified it.
Main tree `node_modules` must be refreshed with `npm install` (NOT `npm ci`: old app dev servers on :4000/:5173 run
from it) after merges that change the lockfile.
**Waiting on the user for** `MONGODB_URI` + `JWT_SECRET` (running the app only).
F1b + F2 merged. **Next step:** F2b ∥ F3 in worktrees, then F4 → Q1.

