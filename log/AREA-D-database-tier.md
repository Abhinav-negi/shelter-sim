> This file is one Area of the ShelterSim build ledger. The index and full file map are in
> `LOG.md` at the repo root. Shared contracts, constants and the eleven heat pathways referenced
> below as "§7.x" live in `log/CONTRACTS.md` (§7–§10 of the original single-file ledger).
> References to "§5" or "§6" below mean the corresponding section still in `LOG.md`.
> Read `log/CONTRACTS.md` once per session (per the ritual in `LOG.md` §2), not once per task.

---

# AREA D — DATABASE TIER

> **NEW.** This tier does not appear in any source document — `plan.md` §9, `TECH.md` §3 and §9.6
> all cut the database explicitly. That cut is partially reversed by decision; read **§9, Deviation
> D-1** before starting anything here.
>
> **Three rules bind every task in this area and none of them is negotiable:**
> 1. **No users, no auth, no sessions, no JWT, no permissions, no `userId` column.** If a task seems
>    to need one, it does not.
> 2. **`packages/**` may never import `@prisma/client`.** The lint rule from T-03 enforces it and CI
>    asserts it. The engine must stay runnable in a browser.
> 3. **Every task here carries an acceptance test that stops the database and proves the app still
>    works.** The database is a cache and a share layer, never a dependency.

---

### [ ] T-29 — Prisma schema, the four tables, and the first migration

**Area:** D — Database · **Status:** NOT STARTED · **Est:** 6 h
**Depends on:** T-03, T-06 · **Conflicts with:** T-30…T-35 (all read this schema)

**Why this exists.** Four things need persisting and nothing else does. Getting the schema right
once, with the constraints in the database rather than in application code, is what keeps the other
six database tasks small.

**PROMPT — paste this to start the task:**
> Create `apps/web/` as a workspace package if it does not yet exist (a bare `package.json` and
> `tsconfig.json` are enough for this task — T-36 builds the Next.js app itself), add `prisma` as a
> devDependency and `@prisma/client` as a dependency **of `apps/web` only**, and add `apps/*` to the
> root `workspaces` array.
>
> Create `apps/web/prisma/schema.prisma` **verbatim from `LOG.md` §7.12**. Do not improvise fields,
> do not add a `User` model, do not add `createdBy` anywhere. The four models are `WeatherCache`,
> `DesignSnapshot`, `SimulationRun` and `Material`, with exactly the fields, indexes and unique
> constraints §7.12 lists.
>
> Support **both** providers: PostgreSQL in production, SQLite for local development. Prisma's
> `provider` is not directly env-switchable in older versions, so use whichever mechanism the
> installed Prisma version supports (`provider = env("DATABASE_PROVIDER")` where available,
> otherwise two schema files generated from one source and selected by an npm script). Document the
> choice in `apps/web/prisma/README.md` in under 15 lines. Default local dev to
> `DATABASE_URL="file:./dev.db"`.
>
> Generate the first migration as `apps/web/prisma/migrations/<timestamp>_init/`. Commit it.
> **Never edit a committed migration** — a schema change is always a new migration.
>
> Add npm scripts to `apps/web/package.json`: `db:generate`, `db:migrate` (dev),
> `db:migrate:deploy` (prod), `db:reset`, `db:seed` (T-30 fills the seed script in).
>
> Add `apps/web/.env.example` listing `DATABASE_URL` and `DATABASE_PROVIDER` with their local-dev
> values and a comment saying **the application must run with neither set** (§7.16).
>
> Do not write any repository code, any API route, or any seed data. Those are T-30…T-35.

**Files you may touch.** `apps/web/prisma/**`, `apps/web/package.json`, `apps/web/tsconfig.json`,
`apps/web/.env.example`, the `workspaces` array in the root `package.json`, `.gitignore` (to add
`apps/web/prisma/*.db*` if T-02 did not).
**Files you may NOT touch.** Anything under `packages/`. Any other file under `apps/web/`.

**Subagent guidance.** Single agent. One schema file — fan-out has nothing to divide.

**ACCEPTANCE TESTS — the task is NOT done until every one passes:**
1. `npx prisma validate --schema apps/web/prisma/schema.prisma` exits 0.
2. `npx prisma migrate dev --name init` against a fresh SQLite file applies cleanly and creates all
   four tables. Paste the table list from `.tables` or the equivalent.
3. **The migration rolls back:** `npx prisma migrate reset --force` drops and re-applies cleanly,
   ending with the same four tables and zero rows. Paste the before/after row counts.
4. **The unique constraint actually rejects a duplicate:** inserting two `WeatherCache` rows with
   identical `(source, latitude, longitude, startDate, endDate)` fails with a unique-constraint
   error from the **database**, not from application code. Paste the error.
5. The same for two `DesignSnapshot` rows with the same `shareId`, and two `SimulationRun` rows with
   the same `requestHash`.
6. `Material.source` is a required non-nullable column: inserting a row without it fails at the
   database. Paste the error.
7. `grep -c "model User\|userId\|password\|session\|token" apps/web/prisma/schema.prisma` returns
   **0**.
8. `grep -rn "@prisma/client" packages/ | wc -l` returns **0**, and `npm run lint` exits 0.
9. **The app still works with the database off:** with `DATABASE_URL` unset,
   `npx vitest run` exits 0 and the engine's 65 tests pass — nothing in `packages/` gained a
   database dependency.
10. `apps/web/package.json` lists `@prisma/client` in `dependencies` and `prisma` in
    `devDependencies`, and the root `package.json` lists neither.
11. The committed migration directory exists and contains a `migration.sql`.

**Evidence (fill this in when done — numbers, not adjectives):**
```
```

**Completed by:** ___  **Date:** ___

---

### [ ] T-30 — The database client wrapper, and the DB-off mode that must always work

**Area:** D — Database · **Status:** NOT STARTED · **Est:** 5 h
**Depends on:** T-29 · **Conflicts with:** T-31…T-35 (they all import this)

**Why this exists.** This is the task that makes global rule 18 true in code rather than in
intention. If every repository calls `new PrismaClient()` directly, then the first one that throws on
a missing `DATABASE_URL` takes the whole app down, and the offline story dies quietly. One wrapper,
one place where "the database is not there" is a normal condition rather than an error.

**PROMPT — paste this to start the task:**
> Create `apps/web/lib/db.ts`.
>
> ```ts
> /** null when DATABASE_URL is unset or the database is unreachable. Callers MUST handle null. */
> export function getDb(): PrismaClient | null;
> export async function dbHealthy(): Promise<boolean>;
> export async function withDb<T>(fn: (db: PrismaClient) => Promise<T>): Promise<T | null>;
> ```
>
> - `getDb()` returns `null` when `process.env.DATABASE_URL` is unset. It never throws. It memoises
>   a single `PrismaClient` per process (Next.js dev-mode hot reload otherwise leaks connections —
>   stash it on `globalThis` in development, the standard pattern).
> - `withDb(fn)` is the only call shape the repositories use: it returns `null` when there is no
>   database, and it **catches every database error, logs it once, and returns `null`** rather than
>   propagating. A cache miss and a dead database are the same thing to a caller — that equivalence
>   is the whole design.
> - `dbHealthy()` runs a trivial query with a **2-second timeout** and returns a boolean. It never
>   throws.
>
> Add `apps/web/lib/log.ts` — a thin wrapper that is a **no-op in production** and writes to
> `console` in development. This is the only logging in the repository; `packages/**` has none by
> design (§7.8).
>
> Write the **DB-off contract** as a comment at the top of `db.ts`, in these words or better:
> *"The database is a cache and a share layer, never a dependency. Every feature on the demo path
> must work with this returning null. If you find yourself writing `if (!db) throw`, you are writing
> a bug."*
>
> Add `apps/web/test/db.test.ts`.

**Files you may touch.** `apps/web/lib/db.ts`, `apps/web/lib/log.ts`, `apps/web/test/db.test.ts`.
**Files you may NOT touch.** `apps/web/prisma/**`, anything under `packages/`.

**Subagent guidance.** Single agent. One small file that everything else depends on being exactly
right.

**ACCEPTANCE TESTS — the task is NOT done until every one passes:**
1. With `DATABASE_URL` **unset**, `getDb()` returns `null` and does **not** throw.
2. With `DATABASE_URL` unset, `withDb(async db => db.material.count())` resolves to `null` and does
   not throw. Paste the resolved value.
3. With `DATABASE_URL` set to a **bogus** host, `withDb(...)` resolves to `null` within 5 seconds
   and does not throw. Paste the elapsed time.
4. With `DATABASE_URL` set correctly, `withDb(async db => db.material.count())` resolves to a
   number.
5. `dbHealthy()` returns `false` with no `DATABASE_URL`, `false` with a bogus one (within 3 s), and
   `true` against a live one. Paste all three and the bogus-case elapsed time.
6. Calling `getDb()` 100 times creates **one** client — assert by identity (`===`).
7. A thrown error inside `withDb` is logged **once**, not re-thrown. Assert the log call count.
8. `apps/web/lib/log.ts` produces no output when `NODE_ENV === 'production'`.
9. `grep -c "if (!db) throw\|if (db === null) throw" apps/web/lib apps/web/app -r` returns **0**.
10. `npx vitest run` exits 0 including the new tests; the engine's 65 still pass.

**Evidence (fill this in when done — numbers, not adjectives):**
```
```

**Completed by:** ___  **Date:** ___

---

### [ ] T-31 — The weather cache repository

**Area:** D — Database · **Status:** NOT STARTED · **Est:** 6 h
**Depends on:** T-26, T-30 · **Conflicts with:** none

**Why this exists.** NASA POWER and Open-Meteo are slow and rate-limited. The eighteen-scenario
matrix (T-59) and the design sweep both re-ask for the same cell constantly, and a rate-limit
response mid-demo is a failure the audience sees. **Never fetch the same cell twice.**

**PROMPT — paste this to start the task:**
> Create `apps/web/lib/repo/weather.ts`.
>
> ```ts
> export interface WeatherKey {
>   source: 'nasa-power' | 'open-meteo';
>   latitude: number; longitude: number;         // ROUNDED before use -- see below
>   startDate: string; endDate: string;          // 'YYYY-MM-DD'
> }
> export function weatherCellKey(k: WeatherKey): WeatherKey;   // canonicalises
> export async function readWeatherCache(k: WeatherKey): Promise<WeatherSeries | null>;
> export async function writeWeatherCache(
>   k: WeatherKey, series: WeatherSeries, rawPayload: unknown, sourceElevation: number | null
> ): Promise<void>;
> export async function purgeExpiredWeather(): Promise<number>;   // rows removed
> ```
>
> **Keying.** Round `latitude` and `longitude` to **4 decimal places** before they touch the key, so
> `34.15001` and `34.15` are one cell rather than two. Document why: a 4-decimal degree is about
> 11 m, far below any weather grid's resolution, and un-rounded floats would make the cache miss
> forever while quietly filling the table.
>
> **TTL.** `expiresAt = fetchedAt + 90 days` for a historical range whose `endDate` is in the past
> (reanalysis data for a past year does not change), and `fetchedAt + 24 hours` for any range whose
> `endDate` is today or later. Export the two windows as named constants with that reasoning in a
> comment. `readWeatherCache` treats an expired row as a **miss** and does not delete it inline —
> `purgeExpiredWeather` is a separate, explicitly called operation, so a read is never a write.
>
> **Serialisation.** Store `series` through T-06's `seriesToJson` and read it back through
> `seriesFromJson`, so `Float64Array` survives the round trip. Store `rawPayload` untouched, so a
> parsing bug in T-26 can be fixed later without refetching a single byte.
>
> **Every function returns gracefully when there is no database.** `readWeatherCache` returns `null`
> (indistinguishable from a miss); `writeWeatherCache` resolves without error and writes nothing;
> `purgeExpiredWeather` returns 0. All three go through `withDb`.
>
> Add `apps/web/test/repo-weather.test.ts`.

**Files you may touch.** `apps/web/lib/repo/weather.ts`, `apps/web/test/repo-weather.test.ts`.
**Files you may NOT touch.** `apps/web/lib/db.ts`, `apps/web/prisma/**`, other repositories,
anything under `packages/`.

**Subagent guidance.** Single agent. Straightforward — do not fan out.

**ACCEPTANCE TESTS — the task is NOT done until every one passes:**
1. A write followed by a read with the same key returns a `WeatherSeries` **deep-equal** to the one
   written, with `T_amb` coming back as a `Float64Array` (assert `instanceof`).
2. `weatherCellKey` rounds `34.150014` and `34.149996` to the **same** latitude; a read written
   under one hits under the other.
3. A read with a different `source`, or a different date range, is a **miss** (returns `null`).
4. **The unique constraint rejects a duplicate:** two `writeWeatherCache` calls with the same key
   result in **one** row, not two, and the second call does not throw (upsert semantics). Paste the
   row count.
5. A row whose `expiresAt` is in the past reads as a **miss** and is **still present** in the table
   afterwards. Paste the row count before and after the read.
6. `purgeExpiredWeather()` removes exactly the expired rows and returns their count. Paste it.
7. The TTL is 90 days for a past range and 24 hours for a current one — assert both computed
   `expiresAt` values.
8. **DB OFF:** with `DATABASE_URL` unset, `readWeatherCache` resolves to `null`,
   `writeWeatherCache` resolves without throwing, and `purgeExpiredWeather` returns 0. Paste all
   three.
9. **DB UNREACHABLE:** with a bogus `DATABASE_URL`, the same three behaviours, within 5 seconds
   each.
10. **Concurrent write:** ten simultaneous `writeWeatherCache` calls with the same key leave exactly
    **one** row and none of the ten rejects. Paste the row count and the rejection count.
11. `rawPayload` round-trips byte-identically through a write and a direct database read.

**Evidence (fill this in when done — numbers, not adjectives):**
```
```

**Completed by:** ___  **Date:** ___

---

### [ ] T-32 — Design snapshots and share links

**Area:** D — Database · **Status:** NOT STARTED · **Est:** 5 h
**Depends on:** T-30 · **Conflicts with:** none

**Why this exists.** `plan.md` says *"If you want to keep a design, you download it as a file."*
That is still true and still the offline path. This adds the other half: **a design also gets a
link**, so a BRO engineer at one post can send a design to a colleague at another without attaching
a JSON file to an email that may not get through. Downloads keep working with the database off.

**PROMPT — paste this to start the task:**
> Create `apps/web/lib/repo/designs.ts`.
>
> ```ts
> export async function saveDesign(
>   request: SimulationRequest, label?: string
> ): Promise<{ shareId: string } | null>;
> export async function loadDesign(shareId: string): Promise<SimulationRequest | null>;
> ```
>
> **The share id** is short, opaque and URL-safe: 10 characters from a **base32 alphabet with the
> ambiguous characters removed** (no `0`/`O`, no `1`/`l`/`I`), generated from
> `crypto.randomBytes`. It is **not** sequential — a sequential id lets anyone enumerate every
> design anyone has ever saved, and although nothing here is private, enumerable ids are a habit
> worth not forming. It is **not** derived from the content either: two people saving the same
> design get two links, because a link is a thing a person owns and shares, not a content hash.
> Collision handling: retry up to 5 times on a unique-constraint violation, then return `null`.
> 10 base32 characters is ~50 bits; state that reasoning in a comment.
>
> `saveDesign` validates the request through T-06's `requestFromJson` **before** writing — a
> malformed request must never reach the table, because `loadDesign` would then hand a broken
> design to the engine. It stores through `requestToJson`.
>
> `loadDesign` returns `null` for an unknown id, an expired id, **and** when there is no database.
> All three are the same to a caller. If the stored JSON fails `requestFromJson` (a schema change
> since it was saved), return `null` and log once — never return a half-built object.
>
> No `expiresAt` is set by default (`null` means keep indefinitely). Export
> `purgeExpiredDesigns(): Promise<number>` for a future cleanup job.
>
> Add `apps/web/test/repo-designs.test.ts`.

**Files you may touch.** `apps/web/lib/repo/designs.ts`, `apps/web/test/repo-designs.test.ts`.
**Files you may NOT touch.** `apps/web/lib/db.ts`, `apps/web/prisma/**`, other repositories,
anything under `packages/`.

**Subagent guidance.** Single agent. Straightforward — do not fan out.

**ACCEPTANCE TESTS — the task is NOT done until every one passes:**
1. `saveDesign(req)` then `loadDesign(shareId)` returns a `SimulationRequest` **deep-equal** to the
   original, including `Float64Array` fields coming back as `Float64Array`.
2. The returned `shareId` is exactly 10 characters and matches `/^[A-Za-z2-9]{10}$/` with none of
   `0`, `O`, `1`, `l`, `I` present. Paste five generated ids.
3. Saving the **same** request twice produces **two different** share ids and two rows.
4. 10,000 generated ids contain **zero** duplicates. Paste the count.
5. `loadDesign('nonexistent')` returns `null` and does not throw.
6. **Malformed input is rejected before it is written:** `saveDesign({} as any)` returns `null` (or
   throws a typed `EngineError('DATA_SCHEMA_MISMATCH')`, your choice — state which) and **writes no
   row**. Paste the row count before and after.
7. A row whose stored JSON is corrupted by hand causes `loadDesign` to return `null`, log once, and
   not throw.
8. `loadDesign` on a row with `expiresAt` in the past returns `null`.
9. **DB OFF:** with `DATABASE_URL` unset, `saveDesign` returns `null` and `loadDesign` returns
   `null`, neither throws, and **the JSON download path is unaffected** — demonstrate this by
   round-tripping the same request through `requestToJson`/`requestFromJson` with no database
   present. This is the acceptance test that proves the share layer is not a dependency.
10. **DB UNREACHABLE:** the same two behaviours with a bogus `DATABASE_URL`, within 5 seconds.
11. **Concurrent write:** 20 simultaneous `saveDesign` calls all succeed and produce 20 distinct
    ids. Paste the distinct count.

**Evidence (fill this in when done — numbers, not adjectives):**
```
```

**Completed by:** ___  **Date:** ___

---

### [ ] T-33 — The simulation-run cache

**Area:** D — Database · **Status:** NOT STARTED · **Est:** 6 h
**Depends on:** T-06, T-30 · **Conflicts with:** none

**Why this exists.** The survival grid re-runs eighteen scenarios every time the page loads, and the
sweep re-evaluates variants that have not changed. Both are already fast, but at a measured
31.8 ms/run an eighteen-scenario grid is ~0.6 s of pure recomputation per page view, repeated
forever. A hash-keyed cache makes it free. **The correctness requirement is the interesting part:
a cached result from a different engine version is a wrong answer, not a stale one.**

**PROMPT — paste this to start the task:**
> Create `apps/web/lib/repo/runs.ts`.
>
> ```ts
> export async function readRun(
>   request: SimulationRequest
> ): Promise<{ kpis: SimulationKpis; meta: SimulationResult['meta'] } | null>;
> export async function readFullRun(request: SimulationRequest): Promise<SimulationResult | null>;
> export async function writeRun(
>   request: SimulationRequest, result: SimulationResult, storeFull: boolean
> ): Promise<void>;
> export async function purgeRunsForOtherVersions(): Promise<number>;
> ```
>
> **The key** is T-06's `canonicalRequestHash(request)`. Do not invent a second hashing scheme; if
> the canonicalisation is wrong, fix it there once (global rule 16).
>
> **Version gating.** Read `engineVersion` from `packages/engine/package.json`'s `version` at build
> time and store it on every row. **A row whose `engineVersion` differs from the running engine's is
> a MISS, always**, never a hit — physics changes invalidate the cache, and serving a pre-fix number
> after a physics fix is the worst failure this whole project can have. Write that sentence into the
> file as a comment.
>
> **`storeFull`.** The KPI/meta rows are small; a full `SimulationResult` with per-timestep series
> for every surface is large. Store the full result only when the caller asks (the survival grid
> wants KPIs only; the main chart wants everything). Document the size difference you measure.
>
> **Never let a cache read change an answer.** After a hit, the returned `meta.wallClockMs` is
> meaningless and `meta.warnings` may be stale in one specific way: a warning about the *run* is
> still valid, but any warning about the *environment* is not. Keep it simple — return `meta`
> unchanged and add the literal string `'served from cache'` to `meta.warnings`, so the UI can say
> so and a developer reading a residual knows where it came from.
>
> Add `apps/web/test/repo-runs.test.ts`.

**Files you may touch.** `apps/web/lib/repo/runs.ts`, `apps/web/test/repo-runs.test.ts`.
**Files you may NOT touch.** `apps/web/lib/db.ts`, `apps/web/prisma/**`, other repositories,
`packages/engine/src/serialise.ts` (T-06 owns `canonicalRequestHash`).

**Subagent guidance.** Single agent. Straightforward — do not fan out.

**ACCEPTANCE TESTS — the task is NOT done until every one passes:**
1. `writeRun(req, result, false)` then `readRun(req)` returns KPIs **deep-equal** to
   `result.kpis`, and `meta.energyBalanceResidual` equal to 1e-15.
2. `readRun` on a request differing in **any** physical field is a miss. Test `site.elevation`,
   `building.volume`, `operation.achSchedule[3]` and `options.timestepSeconds` separately.
3. `readRun` on a request differing **only** in object key insertion order is a **hit**.
4. **Version gating:** a row written under `engineVersion: '0.0.1'` is a **miss** for the running
   engine. Paste both version strings.
5. `purgeRunsForOtherVersions()` removes exactly those rows and returns the count.
6. `readFullRun` after `writeRun(..., storeFull: true)` returns a `SimulationResult` deep-equal to
   the original, with `Float64Array` fields as `Float64Array`.
7. `readFullRun` after `writeRun(..., storeFull: false)` returns `null`, **not** a partial object.
8. A cache hit adds `'served from cache'` to `meta.warnings`; a fresh run does not.
9. **The cache never changes an answer:** run the same request through `simulate()` twice, cache the
   first, and assert the cached KPIs are **identical** to the second live run, field by field, to
   exact equality. Paste any field that differs — there must be none.
10. **DB OFF:** with `DATABASE_URL` unset, `readRun` returns `null`, `writeRun` resolves silently,
    and **the eighteen-scenario grid still computes live** — demonstrate by timing eighteen runs
    with no database present and pasting the wall-clock time.
11. **DB UNREACHABLE:** the same, within 5 seconds per call.
12. **Concurrent write:** ten simultaneous `writeRun` calls with the same request leave exactly one
    row and none rejects.
13. Measure and paste the stored row size with and without `storeFull`, in bytes.

**Evidence (fill this in when done — numbers, not adjectives):**
```
```

**Completed by:** ___  **Date:** ___

---

### [ ] T-34 — The material repository and the seed script

**Area:** D — Database · **Status:** NOT STARTED · **Est:** 4 h
**Depends on:** T-24, T-30 · **Conflicts with:** T-24 (code catalogue is the source of truth)

**Why this exists.** The browser should not ship the entire material catalogue in its bundle, and
the citations are the thing a judge asks about, so they must reach the UI. But the **code catalogue
remains the source of truth** — the database holds a served copy. If the two ever disagree, the code
wins and the seed is re-run.

**PROMPT — paste this to start the task:**
> Create `apps/web/lib/repo/materials.ts` and `apps/web/prisma/seed.ts`.
>
> `seed.ts` reads `MATERIALS` from `@shelter/data` and upserts every row by `id`. It is
> **idempotent**: running it twice leaves the same row count and the same content. It **refuses to
> write a row whose `source` is empty**, exiting non-zero and naming the offending id — global rule
> 20, enforced at the point of writing rather than trusted.
>
> `materials.ts`:
> ```ts
> export async function listMaterials(): Promise<Material[]>;
> export async function getMaterial(id: string): Promise<Material | null>;
> ```
> **Both fall back to the code catalogue when there is no database.** `listMaterials()` with the
> database off returns `MATERIALS` from `@shelter/data` — not an empty array, not an error. That
> fallback is the entire reason the material list still renders offline, and it is the single most
> important line in this file. Comment it as such.
>
> When the database *is* present, compare the row count against the code catalogue's length on the
> first call and log a warning if they differ (the seed is stale) — but still serve the database
> rows, and never block.
>
> Wire `db:seed` in `apps/web/package.json` to run `seed.ts`.

**Files you may touch.** `apps/web/lib/repo/materials.ts`, `apps/web/prisma/seed.ts`,
`apps/web/package.json` (the seed script entry), `apps/web/test/repo-materials.test.ts`.
**Files you may NOT touch.** `apps/web/prisma/schema.prisma`, `apps/web/lib/db.ts`, anything under
`packages/data/src` (read it, never edit it).

**Subagent guidance.** Single agent. Straightforward — do not fan out.

**ACCEPTANCE TESTS — the task is NOT done until every one passes:**
1. `npm run db:seed` exits 0 and the `Material` row count equals `MATERIALS.length`. Paste both.
2. **Idempotent:** running `db:seed` a second time leaves the identical row count and identical
   content (compare a checksum over all rows before and after). Paste both checksums.
3. Changing a `k` value in the code catalogue and re-seeding updates the row rather than inserting a
   duplicate. Paste the row count.
4. **The citation rule is enforced at write time:** temporarily blanking one material's `source`
   makes `db:seed` exit **non-zero** and name that material's id. Revert. Paste the exit code and
   the message.
5. `listMaterials()` with a live database returns `MATERIALS.length` rows, each with a non-empty
   `source`.
6. **DB OFF:** with `DATABASE_URL` unset, `listMaterials()` returns the **code catalogue**, with the
   same length and the same ids. Assert deep equality of ids. Paste the length.
7. **DB UNREACHABLE:** with a bogus `DATABASE_URL`, `listMaterials()` returns the code catalogue
   within 5 seconds. Paste the elapsed time.
8. `getMaterial('nope')` returns `null` in all three modes (live, off, unreachable).
9. Deleting half the rows from the database makes `listMaterials()` log a staleness warning but
   still return the rows it has, without throwing.
10. `npx vitest run` exits 0; the engine's 65 tests are unaffected.

**Evidence (fill this in when done — numbers, not adjectives):**
```
```

**Completed by:** ___  **Date:** ___

---

### [ ] T-35 — The DB-off integration proof

**Area:** D — Database · **Status:** NOT STARTED · **Est:** 4 h
**Depends on:** T-31, T-32, T-33, T-34 · **Conflicts with:** none

**Why this exists.** Each database task proves its **own** function degrades gracefully. None of
them proves the **application** does. The failure mode this task exists to catch is the one where
five components each return `null` correctly and the sixth — a page, a route, a hook — does
`result.kpis.tempAt0600` on it and white-screens the demo. This is the task that makes the offline
promise in `plan.md` Part 4 a tested fact rather than an intention.

**PROMPT — paste this to start the task:**
> Create `apps/web/test/db-off.integration.test.ts` — one suite that runs the **entire** repository
> layer and every server-side data path three times: with a live database, with `DATABASE_URL`
> unset, and with `DATABASE_URL` pointing at a host that does not answer.
>
> For each of the three modes, exercise, in order:
> 1. `listMaterials()` — must return a non-empty array in **all three** modes.
> 2. `tmyById('leh')` → `simulate()` — must return a valid result with
>    `meta.energyBalanceResidual < 1e-3` in **all three** modes.
> 3. `readWeatherCache` / `writeWeatherCache` — must resolve, never throw, in all three.
> 4. `saveDesign` / `loadDesign` — must resolve (possibly to `null`) and never throw.
> 5. `readRun` / `writeRun` — must resolve and never throw.
> 6. The eighteen-scenario matrix (once T-59 exists; until then, eighteen `simulate()` calls on the
>    presets) — must complete in **all three** modes, and the wall-clock time in DB-off mode must be
>    recorded.
>
> Assert a **hard rule**: in the unset and unreachable modes, **no call takes longer than 5
> seconds** and **no call throws**. A hang is worse than an error here: an error shows a banner, a
> hang shows a spinner that never stops, and the audience watches it.
>
> Also add a small script `apps/web/scripts/check-db-off.mjs` that a human can run before a demo:
> unset `DATABASE_URL`, boot the app, hit the main page, and report pass/fail in one line. Document
> it in the root `README.md` under a heading `Before the demo`.
>
> This task writes **tests and one script only**. If a component fails one of these checks, that is
> a defect in the owning task — report it by id in your Evidence, set this task `[!]`, and do not
> fix it here (global rule 16).

**Files you may touch.** `apps/web/test/db-off.integration.test.ts`,
`apps/web/scripts/check-db-off.mjs`, the `Before the demo` section of the root `README.md`.
**Files you may NOT touch.** Any `lib/repo/*` file. Any `prisma` file. Anything under `packages/`.

**Subagent guidance.** Single agent. It is one test matrix whose whole value is being run as one
matrix.

**ACCEPTANCE TESTS — the task is NOT done until every one passes:**
1. All six exercises pass in **live-database** mode. Paste the mode's total runtime.
2. All six pass with `DATABASE_URL` **unset**. Paste the total runtime.
3. All six pass with `DATABASE_URL` pointing at an **unreachable** host. Paste the total runtime.
4. **No call in modes 2 or 3 exceeds 5 seconds.** Paste the slowest call and its duration for each
   mode.
5. **No call in modes 2 or 3 throws.** Assert with a `try/catch` around each and a count of caught
   exceptions equal to **0**.
6. `listMaterials()` returns the same number of materials in all three modes. Paste all three counts.
7. `simulate()` on the Leh TMY returns **identical** KPIs in all three modes — the physics does not
   know the database exists. Assert field-by-field equality and paste any mismatch (there must be
   none).
8. The eighteen-scenario matrix completes in DB-off mode. Paste its wall-clock time.
9. `node apps/web/scripts/check-db-off.mjs` prints a single pass line and exits 0 with no
   `DATABASE_URL`.
10. The root `README.md` has a `Before the demo` section naming that script.

**Evidence (fill this in when done — numbers, not adjectives):**
```
```

**Completed by:** ___  **Date:** ___

---

