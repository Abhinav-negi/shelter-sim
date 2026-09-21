# log/contracts/architecture.md — the architecture diagram

> Extracted from `log/CONTRACTS.md` §8. Background reading, rarely required per-task.

---

## 8. ARCHITECTURE DIAGRAM

```
┌───────────────────────────────────────────────────────────────────────────────────┐
│  TIER 1 — THE BROWSER  (apps/web, client components)                              │
│                                                                                   │
│   5-control form ──► isometric SVG house ──► charts: Temp · Solar · HeatFlow ·    │
│   Advanced panel     click-a-wall              Sankey · survival grid · KPIs      │
│                      time scrubber                                                │
│                      day/night animation ◄── real solar-position code             │
│                                                                                   │
│   ┌─────────────────────────────────────────────────────────────────────────┐     │
│   │ Web Worker:  @shelter/engine  ← THE SAME ENGINE, SECOND COPY            │     │
│   │ • instant preview on slider move (150 ms debounce)                      │     │
│   │ • THE OFFLINE FALLBACK: server unreachable -> run here, on bundled TMY  │     │
│   │   -> full temperature curve, heat-flow breakdown and 3D model still work │     │
│   │   -> banner: "Offline — showing 1 scenario, AI advice unavailable."     │     │
│   └─────────────────────────────────────────────────────────────────────────┘     │
└──────────────────────────────────┬────────────────────────────────────────────────┘
                                   │  HTTP / JSON / SSE      (may be entirely absent)
                                   ▼
┌───────────────────────────────────────────────────────────────────────────────────┐
│  TIER 2 — THE SERVER  (apps/web/app/api/*, Next.js App Router route handlers)      │
│                                                                                   │
│   /api/weather    CORS proxy -> NASA POWER / Open-Meteo, lapse-rate corrected      │
│   /api/simulate   one run                                                         │
│   /api/optimise   sweep, streams progress back as SSE                             │
│   /api/scenarios  the eighteen-scenario matrix                                    │
│   /api/designs    POST a design -> short share id;  GET a share id -> the design   │
│   /api/materials  the catalogue, with every citation                              │
│                                                                                   │
│   ┌──────────────────────────────────┐   ┌──────────────────────────────────┐     │
│   │ worker_threads POOL, one per core│   │ @shelter/optimise                │     │
│   │ each thread holds @shelter/engine│◄──│ expand -> dispatch -> rank        │     │
│   │ THE SAME ENGINE, FIRST COPY      │   │ -> Pareto -> recommendation       │     │
│   └──────────────────────────────────┘   └──────────────┬───────────────────┘     │
│                                                          │                        │
│                                          ┌───────────────▼───────────────────┐    │
│                                          │ AI write-up, two stages:          │    │
│                                          │  1. search = REAL PHYSICS, no AI  │    │
│                                          │  2. write-up = AI, numbers        │    │
│                                          │     verified against the result   │    │
│                                          │     or the text is REJECTED       │    │
│                                          │  no key / no net -> template      │    │
│                                          └───────────────────────────────────┘    │
└──────────────────────────────────┬────────────────────────────────────────────────┘
                                   │  Prisma        (may be entirely absent)
                                   ▼
┌───────────────────────────────────────────────────────────────────────────────────┐
│  TIER 3 — THE DATABASE  (PostgreSQL in production, SQLite for local dev)           │
│                                                                                   │
│   WeatherCache     (source, lat, lon, startDate, endDate) -> series + raw payload  │
│   DesignSnapshot   shareId -> SimulationRequest                                    │
│   SimulationRun    requestHash -> kpis + meta  (+ optional full result)            │
│   Material         the catalogue, every row carrying its citation                  │
│                                                                                   │
│   NO users. NO auth. NO sessions. NO JWT. NO permissions.                          │
│   A CACHE AND A SHARE LAYER — NEVER A DEPENDENCY.                                  │
│   Stop this tier and every demo-path feature still works.                          │
└───────────────────────────────────────────────────────────────────────────────────┘

              ┌──────────────────────────────────────────────────────┐
              │  packages/engine  —  pure TypeScript, ZERO runtime    │
              │  dependencies, no React, no Prisma, no I/O, no        │
              │  network, no global state, no console.                │
              │  simulate(request) -> result. Same in, same out.      │
              │  RUNS IDENTICALLY IN BOTH TIER 1 AND TIER 2.          │
              │  That single property is what makes the offline       │
              │  fallback possible at all.                            │
              └──────────────────────────────────────────────────────┘
```

---
