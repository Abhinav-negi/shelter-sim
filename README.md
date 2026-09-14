# ShelterSim

Software thermal model for area-specific passive shelter design.
DRDO / DIHAR Leh · SIH Problem Statement 26051.

See `LOG.md` for the build ledger — the single authoritative source for project
status, contracts and the task list. Start there.

## Branch protocol

- **one branch per task**, named for the task id in lower case: `t-18-shading`.
- **Every commit message begins with the task id**: `T-18: ...`, so
  `git log --grep='^T-18'` shows exactly what a task touched.
- A task is not `[x]` in `LOG.md` until both the ledger and the branch are updated.
