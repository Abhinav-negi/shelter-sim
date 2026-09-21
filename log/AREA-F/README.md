> This folder holds one file per task for Area F. The task index and full file map are
> in `LOG.md` at the repo root — its §5 table's `File` column points directly at
> `log/AREA-F/T-<NN>.md`.
>
> **Contracts this Area's tasks generally need**, beyond the always-required
> `log/contracts/00-core.md`: `log/contracts/io-contracts.md`
> If a task needs a contract clause outside these files, that is a ledger defect — report it
> (Global Rule 3), don't guess.
> References to "§5" or "§6" mean the corresponding section still in `LOG.md`. A bare "§7.x"
> reference (e.g. "§7.4") means the matching topic file under `log/contracts/`.

---

# AREA F — FRONTEND

> Every task here creates **only** its own `apps/web/components/<name>/` directory, containing its
> component(s) and its own `messages.ts`. **None of them edits `page.tsx`, `store.ts`, `units.ts` or
> `i18n.ts`** — T-36 already wired the slot and declared every store field.
> **Every temperature arrives as Kelvin and is formatted through `lib/units.ts`.** A `- 273.15`
> anywhere in a component is a defect even if the number displayed looks right.
> Every component must render correctly in four states: **loading, empty (`result === null`), error,
> and offline** — and at **400 px** width without horizontal scroll.
