# Codebase guide (D2) — source

Published at https://claude.ai/artifact/4hcTeGv6GQPQFD9f3fRsEv (republish with the Artifact tool's `url`).

- `client.json`, `server.json`, `packages.json` — per-file facts gathered by reading every source file (session 6).
  Refresh them when files are added, renamed or change role.
- `template.html` — page shell + renderer (reads the inlined JSON). `d1-diagrams.html` — the D1 page; `build.py`
  lifts its five SVG diagrams and the auth / change / run sections from it.
- `build.py` — run inside this folder: `python3 build.py` → `guide.html` (the published page).
- Corrections applied in `build.py` (verified by grep): `@shelter/optimise` is imported by no app yet; engine and data
  are used by studio-server.
