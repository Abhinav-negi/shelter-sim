# ShelterSim

Software thermal model for area-specific passive shelter design.
DRDO / DIHAR Leh · SIH Problem Statement 26051.

See `LOG.md` for the build ledger index — task status, dependencies and which file in `log/`
holds each task's full entry (shared contracts are in `log/CONTRACTS.md`). Start there.

## Branch protocol

- **one branch per task**, named for the task id in lower case: `t-18-shading`.
- **Every commit message begins with the task id**: `T-18: ...`, so
  `git log --grep='^T-18'` shows exactly what a task touched.
- A task is not `[x]` in `LOG.md` until both the ledger and the branch are updated.

## Before the demo

The database is a cache and a share layer, never a dependency (`LOG.md` global rule 18) — every
feature on the demo path must work with it stopped or absent. Run this before walking into a room
with no network and no Postgres:

```bash
node apps/web/scripts/check-db-off.mjs
```

It unsets `DATABASE_URL` and runs the DB-off half of `apps/web/test/db-off.integration.test.ts`
(T-35) — the material catalogue, a full Leh simulation, the weather/design/run caches and the
eighteen-scenario matrix, all with a 5-second-per-call ceiling and zero tolerated exceptions —
then prints one `PASS`/`FAIL` line and exits `0`/`1` accordingly. There is no page to boot yet
(Area F is not built); once one exists this script should be extended to also start the server
and hit it over HTTP.
