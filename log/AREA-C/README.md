> This folder holds one file per task for Area C. The task index and full file map are
> in `LOG.md` at the repo root — its §5 table's `File` column points directly at
> `log/AREA-C/T-<NN>.md`.
>
> **Contracts this Area's tasks generally need**, beyond the always-required
> `log/contracts/00-core.md`: `log/contracts/data-layer.md`
> If a task needs a contract clause outside these files, that is a ledger defect — report it
> (Global Rule 3), don't guess.
> References to "§5" or "§6" mean the corresponding section still in `LOG.md`. A bare "§7.x"
> reference (e.g. "§7.4") means the matching topic file under `log/contracts/`.

---

# AREA C — DATA LAYER

> Everything here lives in a new package `packages/data` (`@shelter/data`), which has **zero runtime
> dependencies** — TMY payloads are JSON files in the repository. It must never import
> `@prisma/client` (global rule 17); the database *serves* this data, it does not *own* it.
