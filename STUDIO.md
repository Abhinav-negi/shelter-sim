# STUDIO.md — ShelterSim Studio build ledger (index)

Orchestrator protocol: `ORCHESTRATOR.md`. Architecture: `ledger/PLAN.md`. One file per task: `ledger/tasks/<ID>.md`.
Integration branch: **`studio/main`**. Task branches: `task/<id>` in worktrees `../wt-<id>`.

## HANDOFF (2026-09-25, session 1)

Planning done and approved. S0 done: pending rebuild edits committed (`0700e7a`) on `rebuild/client-server`,
`studio/main` created, old orchestrator archived to `log/ORCHESTRATOR-REBUILD.md`, ledger written.
**Waiting on the user for** `MONGODB_URI` + `JWT_SECRET` (needed only for running the app; tests use
mongodb-memory-server). Old app dev servers are running on :4000/:5173; leave them alone.
**Next step:** delegate P1 (alone, it defines the contract), then P2 ∥ P3 ∥ F1.

## Decisions (approved by user unless marked "orchestrator")
1. New apps `apps/studio` + `apps/studio-server` (orchestrator: naming). Old apps and `packages/*` frozen.
2. MongoDB + Mongoose. Tests use `mongodb-memory-server`.
3. Locations: 5 bundled presets **plus** any lat/lon via Open-Meteo / NASA POWER (keyless), cached in Mongo.
4. 3D: react-three-fiber + drei, flat roof only (it matches the engine), view-only (no direct editing).
5. Auth: email/password, scrypt, JWT in an httpOnly cookie (orchestrator: minor, per brief §7).
6. The client imports `ShelterDesign` etc. **type-only** from `apps/studio-server/src/design/types.ts`, the single
   definition (orchestrator).
7. Ports: studio server :4100, client :5273 (orchestrator; :4000/:5173 belong to the old app).
8. Parallel agents use git worktrees; the orchestrator merges `--no-ff` after verification.

## Tasks

| ID | Task | Depends | Owner | Status | Evidence |
|---|---|---|---|---|---|
| S0 | Branch, commits, ORCHESTRATOR.md, ledger | – | orchestrator | DONE | `git log --oneline -1 rebuild/client-server` = 0700e7a; ledger files present |
| P1 | Server foundation: scaffold, ShelterDesign, assemble copy+ext, provider, preview, API.md, parity test | S0 | | TODO | |
| P2 | Auth + designs + simulations (Mongo) | P1 | | TODO | |
| P3 | Weather + location search + custom-location assembly | P1 | | TODO | |
| F1 | Client scaffold: design system, shell, routing, store, api client | P1 | | TODO | |
| F2 | 3D ShelterViewer | F1 | | TODO | |
| F3 | Studio page: controls, live preview, results | F1 F2 | | TODO | |
| F4 | Landing, auth pages, dashboard, compare | F3 P2 | | TODO | |
| Q1 | E2E + visual QA pass, fixes routed back | all | | TODO | |

## Required from user
```
apps/studio-server/.env
MONGODB_URI=   # Atlas free tier, or a local mongod: mongodb://127.0.0.1:27017/sheltersim
JWT_SECRET=    # openssl rand -hex 32
```
