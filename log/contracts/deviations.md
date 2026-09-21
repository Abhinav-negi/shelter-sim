# log/contracts/deviations.md — environment variables and deviations from the frozen plan

> Extracted from `log/CONTRACTS.md` §7.16 and §9. Read this when your task's Area README names it, or when a ritual step (e.g. D-2, toolchain) points here.

---

### 7.16 Environment variables

**The application must run with none of these set.** Every one is an enhancement.

| Name                                  | Used by            | Default when unset                                                                            |
| ------------------------------------- | ------------------ | --------------------------------------------------------------------------------------------- |
| `DATABASE_URL`                        | T-29…T-35          | unset → the app runs in **DB-off mode**: no cache, no share links, catalogue served from code |
| `DATABASE_PROVIDER`                   | T-29               | `postgresql`; set to `sqlite` for local dev                                                   |
| `NEXT_PUBLIC_ENABLE_LIVE_WEATHER`     | T-37, T-45         | `false` — bundled TMY only, fetch UI hidden                                                   |
| `NEXT_PUBLIC_DEFAULT_LOCATION`        | T-36               | `leh`                                                                                         |
| `NEXT_PUBLIC_DEFAULT_LOCALE`          | T-52               | `en`                                                                                          |
| `NASA_POWER_BASE_URL`                 | T-37 (server only) | the public NASA POWER endpoint                                                                |
| `OPEN_METEO_BASE_URL`                 | T-37 (server only) | the public Open-Meteo endpoint                                                                |
| `ANTHROPIC_API_KEY` _(or equivalent)_ | T-58 (server only) | unset → the non-AI template write-up is used                                                  |

Browser-visible variables are `NEXT_PUBLIC_*`; anything without that prefix is server-only and must
never be referenced from a component or a worker. Both weather sources are **keyless**.

---

## 9. DEVIATIONS FROM THE FROZEN PLAN

Every place where this ledger departs from the source documents, and why. These are decisions, not
drift. A task that finds itself fighting one of these should re-read it, not route around it.

### D-1 — A thin database tier is added. The "no persistence" cut is PARTIALLY reversed.

`plan.md` §9 ("User accounts, logins, saved projects — nothing to secure, nothing to breach,
nothing to lose. Designs download as files"), `plan.md` Part 2d ("What the server deliberately does
not have: a database"), `TECH.md` §3 ("Persistence: **None**") and `TECH.md` §9.6 ("no auth API, no
user API, no database, no persistence service") all explicitly cut the database.

**That cut is now partially reversed, by decision, as follows.**

**What is added:** a thin server-side persistence tier — Next.js App Router API routes as the
server, Prisma as the client, PostgreSQL in production and SQLite for local development —
persisting **exactly four things**:

1. **Weather cache.** A normalised `WeatherSeries` keyed by `(source, latitude, longitude,
startDate, endDate)`, stored with the raw upstream payload, the fetch timestamp and the source
   grid elevation. _Reason:_ NASA POWER and Open-Meteo are slow and rate-limited, and the
   eighteen-scenario matrix plus the design sweep re-ask for the same cell constantly. Never fetch
   the same cell twice.
2. **Design snapshots.** A `SimulationRequest` stored under a short opaque share id, so a design is
   retrievable by URL. _Reason:_ this upgrades "designs download as files" to "designs download as
   files **or** get a link", which is what a field engineer actually wants when emailing a
   colleague at another post.
3. **Simulation runs.** The `SimulationResult` KPIs plus `meta`, keyed by a hash of the request, so
   a repeat run is served from the database. _Reason:_ the survival grid re-runs eighteen scenarios
   every time the page loads; there is no reason to recompute an answer that has not changed.
4. **Material catalogue.** The `Material` rows of `BLUEPRINT.md` Appendix B, seeded from code and
   served to the client. Every row keeps its mandatory `source` citation. _Reason:_ the browser
   should not ship the whole catalogue in its bundle, and the citations are the thing a judge asks
   about.

**What is still cut, and is not negotiable:** no users table, no authentication, no sessions, no
JWT, no permissions, no telemetry, no analytics. **Do not write auth tasks.** (Global rule 19.)

**What must remain true, and is proved by test in every Area D task:** the database is a **cache
and a share layer, never a dependency**. The offline PWA story in `plan.md` Part 4 survives intact —
with the server and the database both unreachable, the browser still runs the bundled engine on
bundled TMY weather and shows the main scenario, with an honest banner saying so. The engine stays
a pure package with zero runtime dependencies, and **`packages/**` may never import
`@prisma/client`** (global rule 17, lint-enforced in T-03).

### D-2 — npm workspaces, not pnpm.

`WORKERS.md` A1 and W-01 assume `pnpm` workspaces. **The disk is npm workspaces + vitest**, with a
committed `package-lock.json`, and the test suite is green on it. **The disk wins.** Every command
in this ledger is `npm` / `npx`. Do not migrate; there is nothing to gain and a green suite to lose.

### D-3 — Documentation lives at the repository root, not in `docs/`.

`TECH.md` §5 shows a `docs/` directory. On disk every `.md` sits at the root of `SIH/` or of
`shelter-sim/`. `VALIDATION.md`, `EQUATIONS.md` and this file are root-level in `shelter-sim/`.
The `docs/` directory is dropped.

### D-4 — Field names on disk differ from `WORKERS.md` §3.8 in eight places. The disk wins.

| `WORKERS.md` §3.8                      | On disk                                  | Consequence                              |
| -------------------------------------- | ---------------------------------------- | ---------------------------------------- |
| `Window`                               | `WindowSpec`                             | avoids the DOM `Window` global collision |
| `Surface.area` is **gross**            | `Surface.area` is **net** of windows     | do not subtract twice                    |
| `Q7_interiorRadiation`                 | `Q7_interiorLongwave`                    | rename nothing                           |
| `heatFlows.storageChange`              | `heatFlows.storageRate`                  |                                          |
| `Glazing.u`, `.shgc`                   | `Glazing.U`, `.SHGC`                     |                                          |
| `tAmb`, `ghi`, `windSpeed`, `number[]` | `T_amb`, `GHI`, `v_wind`, `Float64Array` | JSON boundaries convert                  |
| `provenance: string`                   | `provenance: WeatherProvenance` object   | carries the lapse correction             |
| `SimOptions.spinUp: {...}` object      | flat `spinUpToleranceK`, `maxSpinUpDays` |                                          |

Resolution used throughout this ledger: **§7 restates the disk, and §7 is authoritative.**

### D-5 — Default timestep is 300 s, not the 60 s `BLUEPRINT.md` suggests.

Justified by measurement, recorded in `packages/engine/src/index.ts`, and re-verified by the
timestep-independence tests in `integrator.test.ts`. See §7.5.

### D-6 — `AUDIT.md` F-1 is already fixed. It is NOT outstanding work.

`AUDIT.md`'s first kill-shot — "the matrix can be factorised once" contradicted by three
time-varying coefficients living inside it — is **closed on disk**. `solve/integrator.ts` freezes
coefficients per weather-hour and refactorises only on refresh, and `solve/schur.ts` implements an
arrow/Schur factorisation so the cost is O(N) rather than O(N³). The measured evidence is in §10.
Any task list that still shows "fix F-1" as pending is out of date; this ledger does not.

### D-7 — `envelope/conduction.ts` and `post/heatFlows.ts` were never separate files.

`TECH.md` §5 lists both. Investigated directly:

- **`envelope/conduction.ts` does not exist.** Its contract was folded into
  `envelope/mesh.ts`, which exports `constructionUValue(mesh, hOuter, hInner)` (the steady-state U
  of a meshed composite wall) and `analyticalWavePenetration(...)`. Validation Test 3 is green
  against it. **This is fine; do not split it out.** A separate `constructions.ts` **is** still
  needed and is T-24's job — but for the _named construction catalogue_, not for conduction physics.
- **`post/heatFlows.ts` does not exist.** `assembleHeatFlows(records, dt)` lives in
  `post/kpis.ts` alongside `computeKpis`. T-22 splits it out into its own file **and** adds the
  missing `deltaT` series while it is there, because that split is cheap and the ΔT series is a
  named problem-statement deliverable.
- **`envelope/response.ts` is not a conduction module.** It is the analytical validation apparatus
  (`driveWall`, `harmonicFit`, `lagSeconds`, `nodeSeries`, `nodeAtDepth`) used by the gate test.
  Leave it where it is.
- **Genuinely missing:** `solar/shading.ts` (T-18), `storage/pcm.ts` (T-19),
  `storage/waterMass.ts` (T-20).

### D-8 — `AUDIT.md` F-6 (ACH coupled to opening area) is still open.

`loads/infiltration.ts` takes `achRequested` directly and applies only the safety floor. There is
**no coupling to glazing area**, so the glazing sweep cannot yet produce the non-monotonic optimum
that `CHALLENGE.md` C-06 and K-05 both test for. T-21 closes it.

### D-9 — `simulate()` already runs without a weather resolver.

`WORKERS.md` W-22 specifies a caller-injected `WeatherRef` resolver. The disk has no `WeatherRef` at
all; the caller always hands over a resolved `WeatherSeries`, and the materials and glazings needed
are handed over inline on the request. This is simpler and preserves the no-I/O property equally
well. Keep it.

### D-10 — `@shelter/data` is allowed one runtime dependency: `@shelter/engine`.

T-24 established, and this table originally required, that `@shelter/data` carries **zero** runtime
dependencies — not even on `@shelter/engine` — to stay decoupled from the physics package
(`packages/data/src/errors.ts`'s own doc comment records that decision and mirrors `EngineError`
locally instead of importing it). T-25 then needed `packages/data/src/weather/pipeline.ts` to derive
missing weather fields (`DNI`/`DHI` via Erbs, `LW_down` via Swinbank, pressure via the barometric
formula) and its own task text was explicit: **import these from `@shelter/engine`, do not
reimplement them** — the same rule that governs every other physics function in this project (global
rule 11: name the source; global rule 16 discourages parallel implementations that can drift).

Those two decisions directly conflict — the human user was asked and chose to keep one canonical
implementation of each correlation in `@shelter/engine` rather than fork three functions into
`@shelter/data` by hand. `@shelter/engine`'s own runtime-dependency count stays **zero** either way
(nothing changes in `packages/engine`); only `@shelter/data`'s stays revised, from `ZERO` to
`@shelter/engine only`, matching the row `@shelter/optimise` already had. `packages/data/package.json`
moves `@shelter/engine` from `devDependencies` to `dependencies` accordingly. T-24's completed work is
unaffected — it never imported `@shelter/engine` at runtime and still doesn't; this only lifts the
constraint for T-25 onward.

---
