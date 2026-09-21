# ShelterSim

Software thermal model for area-specific passive shelter design.
DRDO / DIHAR Leh · SIH Problem Statement 26051.

See `LOG.md` for the build ledger index — task status, dependencies and the exact
`log/AREA-<letter>/T-<NN>.md` file that holds each task's full entry (shared contracts are split
by topic under `log/contracts/`). Start there.

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

### Zero network (T-66)

`AUDIT.md`'s subtlety: a PWA needs one prior online visit to install its service worker, so it
cannot survive "cold start, no network, unfamiliar machine, ten minutes before presenting." Two
independent mechanisms cover the two real scenarios:

**(a) Field deployment — the PWA.** `apps/web/public/manifest.webmanifest` and
`apps/web/public/sw.js` precache the app shell and all five of T-27's bundled TMY files
(`apps/web/public/tmy/*.json`). Once the app has been opened online once, it keeps working with
the network off. `sw.js` is network-first for the HTML document (so a redeploy is never served
stale while a server is reachable) and cache-first for content-hashed `/_next/static/...` assets
(safe forever, since the hash changes the moment the content does) — the cache-busting mechanism
for acceptance test 12. **Known gap, reported rather than routed around:** nothing in this app
currently calls `navigator.serviceWorker.register()` or links `<link rel="manifest">` into
`<head>` — the only place that could live is `apps/web/app/layout.tsx`, which is outside this
task's allow-list (`apps/web/public/**`, `next.config.*`, `scripts/build-static.mjs`). Likewise,
`store.online` never flips to `false` in the live app today: `lib/store.ts`'s `dispatchSimulation()`
calls `simulate()` synchronously in-process and never calls `lib/workerClient.ts`'s
`isServerReachable()`/`runSimulation()` (T-43's own offline-detection logic exists and is tested,
but nothing wires it into the store's real dispatch path), and `lib/store.ts` is off this task's
allow-list too. Both `sw.js` and the connectivity semantics are built and self-tested in isolation;
wiring them into the live render tree needs a few lines in one of those two files. See
`log/AREA-J/T-66.md`'s Evidence block for the full reasoning.

**(b) Demo day — the static export.** No prior visit, no install, no server, ever — the mechanism
that survives an unfamiliar machine and bad venue Wi-Fi:

```bash
npm run build --workspace @shelter/engine
npm run build --workspace @shelter/data
node apps/web/scripts/build-static.mjs
npx serve apps/web/static-export        # or any other local static file server
```

The script computes the default (Leh) preset's result directly in Node — the same
`resolvePreset()`/`simulate()` `apps/web/app/page.tsx` runs, just outside Next's build sandbox —
then assembles a throwaway copy of the app (production source only: no `app/api/`, no
`app/page.tsx`, no test files) with a replacement client-only entry point
(`next/dynamic(..., { ssr: false })`, needed because statically prerendering `<AppShell>` hangs
Next's static-generation sandbox on `@shelter/engine`'s top-level await — see the script's header
comment for the exact reasoning and the two independent hangs reproduced while building this),
and runs Next's own `output: 'export'` against that copy. Nothing under `app/`, `lib/store.ts`,
`components/**` or `app/api/**` is ever edited in place. The result: a self-contained
`apps/web/static-export/` directory (44 files, ~4.0 MB, all five TMY files included, zero
`localhost`/`127.0.0.1` references) that shows the Leh result immediately, offline, on a fresh
machine, with the offline banner correctly reading _"Offline — showing 1 scenario, AI advice
unavailable."_ from the first client-side effect.

**Known ledger defect, unrelated to either mechanism above:** deleting `apps/web/app/api/`
entirely and running the ordinary `npm run build --workspace apps/web` currently fails —
`apps/web/components/inputs/inputs.test.ts` does `await import('../../app/api/materials/route')`,
which Next's build-time TypeScript pass cannot resolve once that directory is gone. That file is
outside this task's allow-list (`components/**`); `apps/web/scripts/build-static.mjs` sidesteps it
by never copying test files into its own throwaway build, but the _ordinary_ build is still
affected. See `log/AREA-J/T-66.md` acceptance test 5.
