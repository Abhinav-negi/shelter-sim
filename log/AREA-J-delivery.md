> This file is one Area of the ShelterSim build ledger. The index and full file map are in
> `LOG.md` at the repo root. Shared contracts, constants and the eleven heat pathways referenced
> below as "§7.x" live in `log/CONTRACTS.md` (§7–§10 of the original single-file ledger).
> References to "§5" or "§6" below mean the corresponding section still in `LOG.md`.
> Read `log/CONTRACTS.md` once per session (per the ritual in `LOG.md` §2), not once per task.

---

# AREA J — DELIVERY

---

### [ ] T-66 — Offline: the PWA and a network-free static build

**Area:** J — Delivery (≈ W-36) · **Status:** NOT STARTED · **Est:** 8 h
**Depends on:** T-27, T-36, T-43 · **Conflicts with:** none

**Why this exists.** *"Demo-day Wi-Fi fails. Ladakh has no connectivity at all in many places."*
And the subtlety `AUDIT.md` caught that most teams miss: **a PWA requires an initial online load to
install its service worker** — so "cold start, no network, unfamiliar machine, ten minutes before
presenting" is exactly the scenario a service worker alone **cannot** survive. Two mechanisms are
required, not one.

**PROMPT — paste this to start the task:**
> **(a) The PWA** — the field-deployment story. `apps/web/public/manifest.webmanifest`, a service
> worker pre-caching the app shell **and all five TMY files**, and an install prompt.
>
> **(b) A static export** — the demo-day story. A build script producing a **self-contained
> directory** that runs from `npx serve` or a local file server with **no install, no build step and
> no network**, shipped on a USB stick. This is the mechanism that survives an unfamiliar machine.
> **Consequence, and it is binding: no demo-path feature may require an API route.** Every Area E
> route is an enhancement; with `app/api/` deleted the static build must still produce a full
> result via T-43's local worker on T-27's bundled TMY.
>
> **The offline behaviour must be honest, not silent.** With no server: run the main scenario
> locally, show the temperature curve, the heat-flow breakdown and the 3D model, and display
> *"Offline — showing 1 scenario, AI advice unavailable."* (T-52 owns the banner; you make the
> condition true.) It does **not** silently pretend to be fully functional, and it does **not**
> show a blank panel where the advice would be — the template write-up (T-57) still fills it.
>
> **The app opens on a loaded preset**, so the first screen shows a result rather than an empty form
> (`CHALLENGE.md` C-19 calls the empty first screen an underrated failure).
>
> Document both mechanisms in the root `README.md` under `Before the demo`, next to T-35's
> `check-db-off.mjs`.
>
> No new UI components. Do not make any feature depend on service-worker installation.
> Do not edit `page.tsx`.

**Files you may touch.** `apps/web/public/**`, `apps/web/next.config.*` (export config only),
`apps/web/scripts/build-static.mjs`, the `Before the demo` section of the root `README.md`.
**Files you may NOT touch.** `app/page.tsx`, `lib/store.ts`, any component directory,
`app/api/**`.

**Subagent guidance.** Single agent. The two mechanisms share the same asset manifest and the same
offline condition; splitting them produces two different ideas of what "offline" means.

**ACCEPTANCE TESTS — the task is NOT done until every one passes:**
1. **The C-19 cold-start test, run literally:** copy the static export to a machine that has never
   seen the project, **disconnect the network**, open it — a Leh result renders within **5 seconds**
   with no install, no build step and **no console error**. Paste the elapsed time, the rendered
   `tempAt0600` in °C, and the console output (must be empty).
2. Second load with the network still off, **via the PWA path**, works after one online install.
   Paste both load times.
3. **The first screen shows a preset result, not an empty form.** State exactly what is on screen.
4. Blocking the network for a full session produces **zero failed requests** in the network panel.
   Paste the request count and the failure count.
5. **Deleting `apps/web/app/api/` entirely still leaves `npm run build --workspace apps/web`
   succeeding and the app producing a full result.** Paste the build exit code and the resulting
   `tempAt0600`.
6. The static export directory contains **all five TMY files** and **no absolute URLs to a dev
   server**. Paste the file list and the result of
   `grep -rc "localhost\|127.0.0.1" <export dir>` (must be 0).
7. Total transferred size on first load is **under 12 MB**. Paste the measured size.
8. Lighthouse's installability check passes for the PWA path. Paste the score.
9. Offline, the advice panel shows the **template** write-up, not a blank panel and not an error.
   Paste its first sentence.
10. Offline, the banner reads *"Offline — showing 1 scenario, AI advice unavailable."* verbatim.
11. Offline, the survival grid shows one row with its explanatory note (T-50), not eighteen blanks.
12. The service worker does not serve a stale build after a redeploy — verify the cache-busting.

**Evidence (fill this in when done — numbers, not adjectives):**
```
```

**Completed by:** ___  **Date:** ___

---

### [ ] T-67 — Deployment

**Area:** J — Delivery · **Status:** NOT STARTED · **Est:** 5 h
**Depends on:** T-29, T-42, T-66 · **Conflicts with:** none

**Why this exists.** The database tier of Deviation D-1 needs somewhere to live, and the deployed
build must prove — in production, not in a test — that it still works when that tier is switched
off. A deployment that only works with the database up would quietly undo the whole DB-off
guarantee.

**PROMPT — paste this to start the task:**
> Deploy `apps/web` to a Node-capable host (Vercel or equivalent) with a managed PostgreSQL
> instance.
>
> 1. **Environment.** Set only `DATABASE_URL` and `DATABASE_PROVIDER=postgresql` in production.
>    Every other variable in §7.16 stays unset by default — **the application must run with none of
>    them set**, and live weather stays off unless someone deliberately enables it.
> 2. **Migrations run on deploy** via `db:migrate:deploy`, never `migrate dev`. **Never edit a
>    committed migration**; a schema change is always a new one.
> 3. **Seed** the material catalogue as a one-shot post-deploy step (T-34's `db:seed`, which is
>    idempotent).
> 4. **Health endpoint** `apps/web/app/api/health/route.ts` returning
>    `{ ok: true, engineVersion, db: 'up'|'down', tmyLocations: n }` — and returning **200 with
>    `db: 'down'`**, never 503, because a down database is a degraded cache, not a down application.
>    That status code is the whole design stated in one line.
> 5. Document in the root `README.md`: how to deploy, how to run locally with SQLite, how to run
>    locally with **no database at all**, and how to produce the USB static build from T-66.
> 6. **Do not add** analytics, telemetry, error reporting to a third party, or any auth (global rule
>    19). No secret exists in this project except `DATABASE_URL` and the optional AI key.

**Files you may touch.** `apps/web/app/api/health/route.ts`, deployment config files,
the root `README.md`.
**Files you may NOT touch.** `prisma/schema.prisma`, any committed migration, `lib/repo/*`,
any component, anything under `packages/`.

**Subagent guidance.** Single agent. Straightforward — do not fan out.

**ACCEPTANCE TESTS — the task is NOT done until every one passes:**
1. A clean deploy from a fresh clone succeeds: migrations apply, seed runs, the app serves. Paste
   the deploy log's final line and the total time.
2. `GET /api/health` returns **200** with `db: 'up'`, the engine version, and the TMY location
   count. Paste the body.
3. **Stop the database.** `GET /api/health` returns **200** with `db: 'down'` — **not 503**. Paste
   the body.
4. **With the database stopped, the deployed app still loads a preset, runs a simulation and renders
   results.** Paste the rendered `tempAt0600` in °C and the page load time. This is the production
   proof of global rule 18.
5. With the database stopped, the material dropdown still lists the full catalogue (T-34's code
   fallback). Paste the item count.
6. With the database stopped, the share button is hidden or disabled with the download-instead
   explanation (T-41's `SHARE_UNAVAILABLE` message). Paste the message shown.
7. Re-running the deploy applies **no** new migration and the seed is idempotent — row count
   unchanged. Paste both counts.
8. `NEXT_PUBLIC_ENABLE_LIVE_WEATHER` unset in production → `/api/weather` returns **501** and the
   fetch UI is not offered. Paste the status.
9. No analytics, telemetry or third-party error reporter is present:
   `grep -rn "analytics\|telemetry\|sentry\|gtag\|mixpanel" apps/web` returns **0**.
10. `grep -rn "auth\|session\|jwt\|passport\|nextauth" apps/web --include=*.ts --include=*.tsx`
    returns **0** (global rule 19).
11. The root `README.md` documents all four run modes (deployed, local + Postgres, local + SQLite,
    local + no database) and the USB static build.
12. The USB static build from T-66 still works, unchanged by this deployment. Paste its cold-start
    time.

**Evidence (fill this in when done — numbers, not adjectives):**
```
```

**Completed by:** ___  **Date:** ___

---

### [ ] T-68 — The demo script and hostile-question preparation

**Area:** J — Delivery (≈ W-54) · **Status:** NOT STARTED · **Est:** 6 h + rehearsal
**Depends on:** T-63, T-66 · **Conflicts with:** none

**Why this exists.** *"Survive the first gate, and survive the room."* Tiers 1–4 of `CHALLENGE.md`
ask whether the work is sound; Tier 5 asks whether it **survives an expert in the room**. Each of the
five kill-shot questions is one a DRDO evaluator can plausibly ask, and each must have an answer that
does not end the demo.

**PROMPT — paste this to start the task:**
> Create `DEMO.md` at the repository root: a timed run-of-show plus the prepared answers.
>
> **The run of show.** Open on a **loaded preset showing a result**, never on an empty form. Then:
> click a wall → change the material → watch the model recolour and the curve move (this is the
> 150 ms live-recompute moment); press Simulate → **the day/night animation plays while the eighteen
> scenarios stream in**; read the temperature curve with the **6 AM label**; the solar bars showing
> the south wall towering over the north; the **Sankey** — point at the widest outgoing stream and
> say *"that's your problem"*; the survival grid with its red rows; and end on the
> **recommendation**: *"build this, it costs ₹X more and saves ₹Y a year."*
>
> **The five prepared answers**, each traceable to a test or a document in this repository:
>
> - **K-01 "What is your sky temperature model?"** → Swinbank, `T_sky = 0.0552 · T_amb^1.5`;
>   at Leh with ambient 258 K the sky sits at **228.7 K — 29 K below ambient**; a measured
>   `LW_down` path is preferred when NASA POWER supplies it. Show the test
>   *"a clear Ladakh night sky sits far below air temperature"* and the one next to it,
>   *"removing sky radiation makes the shelter measurably warmer at dawn."*
> - **K-02 "Show me a case where you compared this against something other than yourselves."** →
>   **Lead with the analytical decrement-and-lag test.** A closed-form solution cannot itself be
>   buggy, which makes it *stronger* evidence than matching another program. Quote the 300 mm
>   dense-concrete numbers from `VALIDATION.md`. Add EnergyPlus **only if T-65 produced a number**.
>   ⚠ **Never mention matching ANSYS.** There is no ANSYS run.
> - **K-03 "Your night curve — why isn't that just exponential decay?"** → Because the capacitance
>   is **distributed through the wall thickness**, not lumped in the air. Show the two fixture
>   curves side by side: the stone shelter's delayed inflection against the steel+PUF's plain
>   exponential. The graph answers the question by itself.
> - **K-04 "What happens at 3,500 m that doesn't happen at sea level?"** → Four things:
>   lower air density into **both** convection coefficients (`sqrt(0.65) = 0.806`, mandatory not
>   optional); stronger clear-sky radiative cooling; a higher beam fraction; and **snow albedo up to
>   0.75**, which quadruples the ground-reflected component on a vertical south wall. Show the
>   altitude test and the snow-albedo comparison.
> - **K-05 "I make the window bigger. Does it get better or worse?"** → **"Better, then worse — and
>   here is the optimum."** Show it **live** from the sweep curve (T-21 / T-56). One sentence that
>   demonstrates gain physics and loss physics at once.
>
> **Also prepare the cut list, proactively.** `AUDIT.md` C-20 notes the binding cut list never
> reached the deck and the only stated limitation appeared reactively inside hostile-question prep —
> which is the weak position. Volunteer it: no CFD, no ray-traced shading, no multi-zone airflow, no
> HVAC equipment models, no moisture transport, no 3-D FEA, and say **why** each trade is the right
> one for this problem.
>
> **Rehearse five full times**, and **at least once end to end on an unfamiliar machine with the
> network off** (that is T-66's cold-start test, performed for real in front of the team).
>
> **Do not state a validation claim that is not in `VALIDATION.md` with a number attached**
> (global rule 9). Do not edit `VALIDATION.md` or `EQUATIONS.md`.

**Files you may touch.** `DEMO.md` (create).
**Files you may NOT touch.** `VALIDATION.md`, `EQUATIONS.md`, any source file.

**Subagent guidance.** Single agent plus the team for rehearsals.

**ACCEPTANCE TESTS — the task is NOT done until every one passes:**
1. **Every claim in `DEMO.md` traces to a document or a test in this repository.** Paste the trace
   for each of the five kill-shot answers.
2. `grep -ri "ansys" DEMO.md` returns nothing that claims a comparison. Paste every hit.
3. Rehearsed answers exist for **all five** kill-shot questions, and the K-02 answer leads with the
   analytical test.
4. The cut list appears **proactively** in the script, not only as a reactive answer. Paste the
   section.
5. **Five full rehearsals are logged**, with dates and the elapsed time of each. Paste the log.
6. **At least one rehearsal ran start to finish on an unfamiliar machine with the network off.**
   Paste the machine, the date and the observed cold-start time.
7. The demo opens on a **loaded preset showing a result**, never an empty form — confirmed in the
   rehearsal log.
8. The run of show fits the allotted time with at least 20 % margin. Paste the target and the
   median rehearsal time.
9. Every number quoted in the script appears in `VALIDATION.md` or in a named test. Spot-check five
   and paste the traces.
10. A failure-mode plan exists for: no network, no database, the AI unavailable, and the projector
    at a different resolution. Paste the four mitigations.

**Evidence (fill this in when done — numbers, not adjectives):**
```
```

**Completed by:** ___  **Date:** ___

---

### [ ] T-69 — The PPT

**Area:** J — Delivery (≈ W-54) · **Status:** NOT STARTED · **Est:** 8 h
**Depends on:** T-46, T-47, T-63, T-68 · **Conflicts with:** T-63 (quotes it, never edits it)

**Why this exists.** `AUDIT.md` graded `CHALLENGE.md` C-18 **WRONG** — the only WRONG verdict in the
entire audit. The original plan called the PPT *"your first and hardest gate"* and then scheduled it
**last**, while Slide 2 demands a screenshot of the isometric house plus a temperature curve which
the same schedule could not produce in time. **Most teams are eliminated at idea submission**, so an
engine that is perfect in week 4 is worth nothing if the deck was built from mockups.

**PROMPT — paste this to start the task:**
> Revise `../ShelterSim_SIH_Idea_PPT.pptx` (it exists at the parent directory; **revise it, do not
> re-author it from scratch**) onto the six-slide SIH format.
>
> **Use real screenshots from real code** — T-46's isometric house and T-47's temperature curve —
> **never mockups**. Record the capture date of every screenshot; it must be **after** T-46 and T-47
> landed.
>
> **Slide 2 leads with the deployment argument**, because it is the differentiator a DRDO panel
> feels immediately: runs in a browser, **no licence**, works **offline** at 3,500 m, ~**30 ms per
> design** against ANSYS's hours. That gap of roughly half a million times is not a bragging point —
> **it is the entire product.** It is the difference between "simulate the one design you already
> chose" and "try a hundred designs and tell me which is best", and it is what makes the
> eighteen-scenario survival grid and the longest-sunless-stretch test possible at all.
>
> **Put the cut list on a slide.** Proactively. See T-68.
>
> **Quote `VALIDATION.md` and nothing else** for every validation claim. The headline number is the
> analytical decrement and lag: measured versus analytical 0.137 / 7.6 h for 300 mm dense concrete.
> **No ANSYS claim anywhere** (global rule 9).
>
> Cover, across the six slides: the problem in DRDO's own words (*"approach nearly the ambient
> atmospheric temperature after sunset"*); the four outputs (the three named PS deliverables plus the
> recommender); the physics in one honest sentence; the validation evidence; the eighteen scenarios
> and the survival grid; and the recommendation screen with its economics.
>
> Do not add a feature for the deck. Do not edit `VALIDATION.md`, `EQUATIONS.md` or `DEMO.md`.

**Files you may touch.** `../ShelterSim_SIH_Idea_PPT.pptx` and any exported screenshot assets you
place under `docs-assets/`.
**Files you may NOT touch.** `VALIDATION.md`, `EQUATIONS.md`, `DEMO.md`, `LOG.md` (beyond your own
task's lines), any source file.

**Subagent guidance.** Single agent plus the team for review. A deck with three authors has three
voices, and the panel notices.

**ACCEPTANCE TESTS — the task is NOT done until every one passes:**
1. **Every slide's claim traces to a document or a test in this repository.** Paste the trace for
   every numeric claim on every slide.
2. **Slide 2 contains a screenshot from running code**, and its **capture date is after T-46 and
   T-47 were marked `[x]`**. Paste the capture date and both task completion dates.
3. `grep -ri "ansys"` across the deck's extracted text returns either nothing or only text
   explaining why ANSYS was **not** used. Paste every hit.
4. The deck contains a **limitations / cut-list slide**, stated proactively.
5. Every validation number on the deck appears in `VALIDATION.md` with the same value. Diff them and
   paste the result — it must be empty.
6. The headline analytical number (decrement 0.137, lag 7.6 h) appears with its measured counterpart
   and its deviation.
7. The performance claim on Slide 2 quotes the **measured** ms/run from `VALIDATION.md`, not a
   rounded aspiration. Paste both.
8. No mockup, wireframe or placeholder image appears anywhere in the deck. List every image and its
   source.
9. The deck is six slides, matching the required format.
10. The deck states the three named PS deliverables **by name** so an evaluator can find each one.
    Paste the three labels.
11. A reviewer who has not seen the project can state, after reading the deck, what the tool does,
    what it does not do, and why the numbers should be believed. Record the reviewer and their
    three answers.

**Evidence (fill this in when done — numbers, not adjectives):**
```
```

**Completed by:** ___  **Date:** ___

---

