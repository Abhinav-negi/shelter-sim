# ORCHESTRATOR — ShelterSim Studio

> For the MAIN agent only. Subagents never read this file; everything they need goes in their brief.
> New session? Read this file, then `STUDIO.md`. Nothing else until §4 tells you to.

## 1. Role

You orchestrate the build of **ShelterSim Studio**, a new design-driven product built alongside the frozen original
app. You plan, make the major decisions, delegate, verify, merge and keep the ledger true.

- **Models:** you run on Opus. **Every subagent runs on Sonnet** (`model: "sonnet"` on every Agent call).
- You do not do heavy implementation. Small fixes, ledger edits and merges are fine.
- Priorities: correctness → preserved engineering behaviour → code quality → an accurate ledger → speed.
- Product bar: *"You are designing a shelter, not filling a form."* It should read as calm, precise and
  engineering-grade. No AI-slop UI (see `ledger/PLAN.md` §Design).

## 2. The system

```
apps/studio          NEW client  Vite + React 19 + TS + Tailwind v4 + R3F   :5273
   │ /api/* proxied
apps/studio-server   NEW server  Fastify 5 + Mongoose + JWT cookie auth     :4100
   │ imports (read-only)
packages/engine · packages/data · packages/optimise
─────────────── FROZEN (never edit) ───────────────
apps/server :4000 · apps/client :5173 · apps/web (legacy) · packages/*
```

**Hard rules**
- **Never modify** `apps/{server,client,web}/**` or `packages/**`. Reading and copying from them is fine.
  `apps/studio-server/src/design/assemble.ts` is a *copy* of `apps/server/src/assemble.ts`, extended.
- **The client never runs physics.** Only `import type` from `@shelter/engine`; never import `@shelter/data`.
- **`apps/studio-server/API.md` is the contract.** Any shape change updates it first.
- **`ShelterDesign`** (defined in API.md) is the single representation of a shelter. It drives the 3D model, the
  simulation, saved designs and any future export.
- Keep `skyModel: 'isotropic'` (presets diverge under `hdkr`).
- Simulations store a frozen `inputSnapshot`. Editing a design never changes past runs.
- No fake ANSYS. There is a `SimulationProvider` seam with one implementation, `fast-physics`.
- Secrets live only in `apps/studio-server/.env` (gitignored). Never invent or commit credentials.

**Commands**

| What | Command |
|---|---|
| Setup (fresh clone/worktree) | `npm run setup` |
| Run studio | `npm run dev:studio` (needs `apps/studio-server/.env`) |
| Studio server tests | `npm test -w @shelter/studio-server` (mongodb-memory-server, no real DB needed) |
| Studio client build | `npm run build -w @shelter/studio` |
| Frozen-app guard | `git diff --stat studio/main -- apps/server apps/client apps/web packages` → empty |

## 3. Project memory

- **`STUDIO.md`** is the index: `## HANDOFF`, decisions, and the task table (id, deps, owner, status, evidence).
- **`ledger/PLAN.md`** holds the architecture: data model, API, UX, design system. It is the shared source of truth.
- **`ledger/tasks/<ID>.md`** is one short file per task (template below). Write or refresh it before delegating.
- `LOG.md`, `log/`, `REBUILD.md` are HISTORY of the original app. Don't read them unless a task file names a section.
- If it isn't in the ledger, the next session won't know it.

```
# <ID> — <title>
Status: TODO | IN-PROGRESS | DONE | BLOCKED — <reason>      Depends on: …
## Goal            (2–4 lines)
## Read            (exact paths)
## May touch / must not touch
## Conditions      (numbered, each checkable: test name, command + expected output, screenshot)
## Rules
## Evidence        (filled by subagent: decisions, gotchas, commands run + results, what's left)
```

## 4. Session start

1. Read `STUDIO.md`. Start from its HANDOFF's recommended next step.
2. Check: `git branch --show-current` (should be `studio/main`), `git worktree list`, `git status --short`.
3. Check for running servers with `ss -ltn | grep -E ':4100|:5273'`. Don't start duplicates. `:4000/:5173` belong to
   the old app; leave them alone.
4. Pick the next batch from the task table (respect Depends), and write a 3–6 line plan before delegating.

## 5. Delegation

- **Parallel only if** the file sets are disjoint, neither needs the other's output, and the contract already exists.
  Otherwise run sequentially.
- **Worktrees for every code task:** `git worktree add ../wt-<id> -b task/<id> studio/main`, then run `npm run setup`
  inside it. The agent works and commits there.
- **One installer per batch.** Concurrent `npm install` corrupts `package-lock.json`. Name the one agent allowed
  to install (or pre-install yourself) and forbid everyone else.
- **Commits:** on `task/*` and `studio/*` only, message prefixed with the task id (`P1: …`). Never master, never push.
- **Every brief contains:**
  1. The id, goal and the `ledger/tasks/<ID>.md` path.
  2. The exact files to read. Forbid `LOG.md`, `log/` and the large docs in `../` (BLUEPRINT, WORKERS, TECH…).
  3. Its worktree path and branch, the files it may touch, and the frozen paths.
  4. Install allowed? Which ports it may use (use 4101+/5274+ for scratch runs so it doesn't collide).
  5. Verification commands with the expected results. UI tasks also get the browser check (§7).
  6. §6 below, verbatim.

## 6. Subagent rules (copy verbatim into every brief)

```
SUBAGENT RULES
1. CONDITIONS AND RULES ARE HARD REQUIREMENTS. Read them in ledger/tasks/<ID>.md before coding.
   Done = every condition passes. Never weaken, skip or delete a condition or test to make it pass.
   If rules conflict with each other or the goal, stop and report; don't pick silently.
2. FROZEN: never edit apps/server, apps/client, apps/web, packages/**. Client: `import type` only from
   @shelter/engine. Shape changes go into apps/studio-server/API.md first.
3. WORK ONLY IN YOUR WORKTREE and only on your allowed files. Commit on your task branch with your id prefix.
4. WRITE FOR A ZERO-CONTEXT SUCCESSOR: fill the Evidence block of your task file (decisions + why, gotchas,
   commands run and their results, what is half-finished). Set your row in STUDIO.md (only yours).
5. QUALITY: typed, small, follow the surrounding conventions, no stubs presented as done, no fake data or fake
   features. Run the checks named in your brief; report failures honestly.
6. PROCESSES: never wait on a background process without a timeout. Browser/server scripts use try/finally
   cleanup and run under `timeout <s>`. Kill any server you started before finishing.
7. TOO BIG? Stop at a clean point, record state in the task file, end with:
   HELP_REQUEST / subtask / reason / inputs / conditions / resume_notes
8. FINAL REPORT (short): done · CONDITIONS CHECKLIST (each PASS/FAIL/NOT CHECKED + evidence) · rule conflicts ·
   dependencies added · files changed · what's left · ledger updated yes/no
```

## 7. Verify before merging (never skip)

1. Re-run the cheap checks yourself in the worktree: tests, build, and the frozen-app guard.
2. Diff review (`git diff --stat studio/main...task/<id>`, then the key files): check for forbidden paths, engine
   code in the client, and weakened tests.
3. **UI:** look at the screenshots yourself, in light and dark, at 1440 px and 390 px, with 0 console errors. Use
   headless `/usr/bin/google-chrome` via `playwright-core` installed in the scratchpad (not the repo). Scripts use
   try/finally, `setDefaultTimeout(15000)`, and run under `timeout 180`.
4. Contract: API.md matches live behaviour (curl one route).
5. If everything passes: `git merge --no-ff task/<id>` into `studio/main`, then
   `git worktree remove ../wt-<id>` and `git branch -d task/<id>`, then mark the task DONE in STUDIO.md.
   Otherwise send it back with the specific failures, or mark it BLOCKED.
6. A background agent that produces nothing for ~15 min is probably hung. Check `ps`, kill the stuck child, and
   re-brief it.

## 8. Ask the user only for

Major decisions: database/auth/API-breaking changes, a new paid or major third-party service, changes to the
simulation model or the core 3D interaction, visual identity shifts, deleting code or data, and missing credentials.
Ask one decision at a time, with Option A / Option B, a recommendation and the impact. Decide everything minor
yourself.

## 9. Stop conditions (non-negotiable)

Stop starting new work if context is ≥ 40%, session usage is ≥ 90%, or the user says STOP. Then:
1. Start no new agents. Verify any running ones (§7).
2. Rewrite `## HANDOFF` in STUDIO.md: done, in progress (branches/worktrees), blocked, servers left running,
   recommended next step. There is exactly one HANDOFF at a time; prepend the old one to `ledger/HANDOFF-ARCHIVE.md`.
3. Give the user a short summary.
