# ShelterSim

Predicts how warm a passive-solar shelter stays through a Ladakh winter night, so a design can
be checked in seconds instead of built and found wrong. DRDO / DIHAR Leh · SIH Problem Statement
26051.

## Architecture

```
apps/client  (Vite + React + Tailwind v4 + shadcn/ui, :5173)
     │  fetch /api/*  — proxied by Vite in dev
     ▼
apps/server  (Fastify, :4000)  ── contract: apps/server/API.md
     │  imports
     ▼
packages/engine, packages/data   (thermal model, material & location catalogue)
```

`apps/server` is the only thing that touches `@shelter/engine`/`@shelter/data` at runtime;
`apps/client` only knows the JSON shapes in `apps/server/API.md` — that file is the sole contract
between the two apps. `apps/web` (the earlier Next.js build, with the engine running in-browser)
is legacy, kept only until it's removed — see `REBUILD.md` for the rebuild ledger and status of
that removal.

## Quick start

### Prerequisites

- **Node.js ≥ 20** (`node -v`)
- npm (comes with Node)

### Run it

```bash
npm run setup   # npm install, then build packages/engine and packages/data
npm run dev     # runs apps/server (:4000) and apps/client (:5173) together
```

Open **http://localhost:5173**.

## API

`apps/server` exposes `GET /api/health`, `GET /api/options`, `POST /api/simulate`. Full request/
response shapes, error codes and the `DesignInput` contract live in `apps/server/API.md` — that
is the only file shared between client and server, and the one to update first if either side's
data shape needs to change.

Calling the API from outside this repo (curl/Python/JS, both the simple `DesignInput` form and
the full engine `SimulationRequest`)? See [`INPUT.md`](INPUT.md) — every example there is verified.

## Tests

```bash
npm test --workspace @shelter/server        # Fastify route tests
npm test --workspace @shelter/engine        # thermal model
npm test --workspace @shelter/data          # material / location catalogue
npm run build --workspace @shelter/client   # type-check + production build
```

## Troubleshooting

| Symptom                                                              | Fix                                                                                         |
| ---------------------------------------------------------------------| -------------------------------------------------------------------------------------------- |
| Client shows the "Server offline" banner                             | Start the server — `npm run dev --workspace @shelter/server`, or `npm run dev` from the repo root for both apps |
| Module/import errors from `@shelter/engine` or `@shelter/data`       | Rebuild them: `npm run build --workspace @shelter/engine --workspace @shelter/data`         |
| Port 4000 or 5173 already in use                                     | Stop the other process, or change the port in `apps/server/src/index.ts` / `apps/client/vite.config.ts` |
| Node version errors                                                  | Upgrade to Node 20+                                                                          |

## Branch protocol

- **one branch per task**, named for the task id in lower case: `t-18-shading`.
- **Every commit message begins with the task id**: `T-18: ...`, so
  `git log --grep='^T-18'` shows exactly what a task touched.
- A task is not `[x]` in `LOG.md` until both the ledger and the branch are updated.
