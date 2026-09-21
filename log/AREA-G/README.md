> This folder holds one file per task for Area G. The task index and full file map are
> in `LOG.md` at the repo root — its §5 table's `File` column points directly at
> `log/AREA-G/T-<NN>.md`.
>
> **Contracts this Area's tasks generally need**, beyond the always-required
> `log/contracts/00-core.md`: `log/contracts/engine-physics.md`, `log/contracts/worker-sweep.md`
> If a task needs a contract clause outside these files, that is a ledger defect — report it
> (Global Rule 3), don't guess.
> References to "§5" or "§6" mean the corresponding section still in `LOG.md`. A bare "§7.x"
> reference (e.g. "§7.4") means the matching topic file under `log/contracts/`.

---

# AREA G — DECISION SUPPORT

> _"This is the feature that makes this a design tool rather than a slower ANSYS."_ `AUDIT.md` F-3
> records that Compare and Optimise were **the least-specified, least-owned and least-scheduled part
> of the whole plan**, despite being explicitly the product's reason to exist. This area closes that.
> Everything here lives in `packages/optimise` (`@shelter/optimise`), whose only runtime dependency
> is `@shelter/engine`.
