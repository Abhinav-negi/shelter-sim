# ShelterSim

Predicts how warm a passive-solar shelter stays through a Ladakh winter night, so a design can
be checked in seconds instead of built and found wrong. DRDO / DIHAR Leh · SIH Problem Statement 26051.

The repo holds two apps on the same thermal engine:

- **ShelterSim Studio** (`apps/studio` + `apps/studio-server`): the new design-driven product. You shape a shelter
  and see it as a live 3D model. You tune materials, openings and orientation, and a debounced simulation shows
  indoor vs outdoor temperature, heat-flow pathways, key figures and a plain-language "what happened / why". Accounts,
  saved designs, frozen simulation runs, side-by-side comparison of 2–4 designs, and any location worldwide (bundled
  presets or live weather from Open-Meteo / NASA POWER).
- **ShelterSim classic** (`apps/client` + `apps/server`): the original form-based app. Frozen and kept running
  unchanged.

## Architecture

### Studio

```
apps/studio  (Vite + React 19 + Tailwind v4 + react-three-fiber, :5273)
     │  fetch /api/*  — proxied by Vite in dev
     ▼
apps/studio-server  (Fastify 5 + Mongoose + JWT cookie auth, :4100)  ── contract: apps/studio-server/API.md
     │  imports (read-only)                    │
     ▼                                         ▼
packages/engine, packages/data             MongoDB (users, designs, runs, weather cache)
```

`ShelterDesign` (defined in `apps/studio-server/API.md`) is the single representation of a shelter. It drives the 3D
model, the simulation, saved designs and comparisons. The client never runs physics: it only has `import type` from
`@shelter/engine`. Saved runs keep a frozen input snapshot, so editing a design never changes past results. The
build ledger is `STUDIO.md` (task table + handoff), with the architecture in `ledger/PLAN.md`.

### Classic

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

### Setup (once)

```bash
npm run setup   # npm install, then build packages/engine and packages/data
```

### Run Studio

Studio needs a MongoDB (a local `mongod` or an Atlas free tier) and a JWT secret, in `apps/studio-server/.env`
(gitignored, never commit it):

```
MONGODB_URI=mongodb://127.0.0.1:27017/sheltersim
JWT_SECRET=<output of: openssl rand -hex 32>
```

```bash
npm run dev:studio   # runs apps/studio-server (:4100) and apps/studio (:5273) together
```

Open **http://localhost:5273**, register, and start a shelter.

### Run classic

```bash
npm run dev     # runs apps/server (:4000) and apps/client (:5173) together
```

Open **http://localhost:5173**. Both apps can run at the same time.

## API

**Studio:** `apps/studio-server/API.md` is the contract: health, options, `POST /api/simulate/preview`, location
search, auth (`/api/auth/*`), designs and simulation runs. Any shape change goes into that file first.

**Classic:** `apps/server` exposes `GET /api/health`, `GET /api/options`, `POST /api/simulate`. Full request/
response shapes, error codes and the `DesignInput` contract live in `apps/server/API.md` — that
is the only file shared between client and server, and the one to update first if either side's
data shape needs to change.

Calling the API from outside this repo (curl/Python/JS, both the simple `DesignInput` form and
the full engine `SimulationRequest`)? See [`INPUT.md`](INPUT.md) — every example there is verified.

## Tests

```bash
npm test --workspace @shelter/studio-server # Studio API (mongodb-memory-server, no real DB needed)
npm test --workspace @shelter/studio        # Studio client unit tests
npm run build --workspace @shelter/studio   # Studio type-check + production build
npm test --workspace @shelter/server        # Fastify route tests
npm test --workspace @shelter/engine        # thermal model
npm test --workspace @shelter/data          # material / location catalogue
npm run build --workspace @shelter/client   # type-check + production build
```

Studio end-to-end (register → design → preview → save → run → compare → logout), headless system Chrome.
`playwright-core` is deliberately not a repo dependency; install it into any scratch directory:

```bash
timeout 180 env PLAYWRIGHT_CORE=/path/to/node_modules/playwright-core node apps/studio/e2e/flow.mjs
```

## Troubleshooting

| Symptom                                                            | Fix                                                                                                             |
| ------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------- |
| Client shows the "Server offline" banner                           | Start the server — `npm run dev --workspace @shelter/server`, or `npm run dev` from the repo root for both apps |
| Module/import errors from `@shelter/engine` or `@shelter/data`     | Rebuild them: `npm run build --workspace @shelter/engine --workspace @shelter/data`                             |
| Port 4000 or 5173 already in use                                   | Stop the other process, or change the port in `apps/server/src/index.ts` / `apps/client/vite.config.ts`         |
| Node version errors                                                | Upgrade to Node 20+                                                                                             |
| Studio server exits: "MONGODB_URI and JWT_SECRET must both be set" | Create `apps/studio-server/.env` (see Run Studio). The dev script loads it automatically                        |
| Studio server can't connect to MongoDB                             | Check `mongod` is running / the Atlas URI and IP allow-list are right                                           |
| Port 4100 or 5273 already in use                                   | Stop the other process, or set `PORT` in `apps/studio-server/.env` / change `apps/studio/vite.config.ts`        |

## Branch protocol

**Studio:** the integration branch is `studio/main`. Each task gets a worktree on `task/<id>` and is merged with
`--no-ff` after review. Commit messages start with the task id (`F3: ...`). See `ORCHESTRATOR.md` and `STUDIO.md`.

**Classic:**

- **one branch per task**, named for the task id in lower case: `t-18-shading`.
- **Every commit message begins with the task id**: `T-18: ...`, so
  `git log --grep='^T-18'` shows exactly what a task touched.
- A task is not `[x]` in `LOG.md` until both the ledger and the branch are updated.
