> This folder holds one file per task for Area E. The task index and full file map are
> in `LOG.md` at the repo root — its §5 table's `File` column points directly at
> `log/AREA-E/T-<NN>.md`.
>
> **Contracts this Area's tasks generally need**, beyond the always-required
> `log/contracts/00-core.md`: `log/contracts/io-contracts.md`, `log/contracts/worker-sweep.md`
> If a task needs a contract clause outside these files, that is a ledger defect — report it
> (Global Rule 3), don't guess.
> References to "§5" or "§6" mean the corresponding section still in `LOG.md`. A bare "§7.x"
> reference (e.g. "§7.4") means the matching topic file under `log/contracts/`.

---

# AREA E — SERVER TIER

> Next.js App Router route handlers. **No feature on the demo path may require any of these routes.**
> The app must build and run as a static export with the whole `app/api/` directory deleted, and
> every route here must return a clean, typed error the client can ignore rather than a blank screen.
