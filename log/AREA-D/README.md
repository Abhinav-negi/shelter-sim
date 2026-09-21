> This folder holds one file per task for Area D. The task index and full file map are
> in `LOG.md` at the repo root — its §5 table's `File` column points directly at
> `log/AREA-D/T-<NN>.md`.
>
> **Contracts this Area's tasks generally need**, beyond the always-required
> `log/contracts/00-core.md`: `log/contracts/data-layer.md`
> If a task needs a contract clause outside these files, that is a ledger defect — report it
> (Global Rule 3), don't guess.
> References to "§5" or "§6" mean the corresponding section still in `LOG.md`. A bare "§7.x"
> reference (e.g. "§7.4") means the matching topic file under `log/contracts/`.

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
