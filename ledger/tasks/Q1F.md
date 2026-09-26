# Q1F — Fix Q1 findings (#1 landing hero at 390, #2 dark color-scheme, #3 Studio loading state)
Status: DONE      Depends on: Q1

## Goal
Close the three findings in `ledger/tasks/Q1.md` Evidence. Nothing else.

## Read
`ledger/tasks/Q1.md` (findings table) · `ledger/PLAN.md` §Design system (States, Banned) ·
`apps/studio/src/routes/{Landing,Studio}.tsx` · `apps/studio/src/styles/tokens.css`

## May touch / must not touch
May: `apps/studio/src/routes/Landing.tsx`, `apps/studio/src/routes/Studio.tsx` (loading branch only),
`apps/studio/src/styles/tokens.css`. Must not: anything else. **No npm install.**

## Conditions
1. #1 (major): at 390 px (light + dark) the landing hero shows the 3D building clearly. The text panel sits below the
   building, not over it. 1440 is unchanged.
2. #2: `color-scheme` follows the active theme (light/dark/auto toggle included), so native controls (Compare
   checkboxes, date input, selects) render dark in dark mode.
3. #3: Studio's loading state keeps the page frame (design header + three-pane layout, a calm placeholder in each
   pane) instead of bare "Loading design…" text. Real stage text only, no fake progress.
4. `node apps/studio/e2e/flow.mjs` (see Q1 Evidence for the command) → ALL PASS. `npm test -w @shelter/studio` and
   `npm run build -w @shelter/studio` green. Frozen guard empty.
5. Before/after screenshots for each finding, looked at.

## Evidence

**Build gotcha (per-worktree, not this task's discovery — same as F2c/Q1's own Evidence):** `npm run build
-w @shelter/studio`/`tsc -p tsconfig.json --noEmit` fails with `Cannot find module '@shelter/engine'`/`'@shelter/data'`
until `packages/{engine,data}`'s own gitignored `dist/` exists in *this* worktree — run once: `npx tsc -b
packages/engine packages/data`. Not an install, not tracked by git, unrelated to this task's diff.

### Fix #1 — Landing hero at 390 (`apps/studio/src/routes/Landing.tsx`)

Root cause: the hero was one `absolute inset-0` viewer plus an `absolute z-10 flex h-full flex-col justify-end`
text panel overlaying it, inside a `h-[64vh] min-h-[420px]` section. At 390 px the copy wraps to more lines (no
`max-w-xl` cap kicks in below `sm`), so the panel's content-driven height ate most of that fixed-height section,
leaving only a roof sliver visible above it.

Fix: below `sm` (640 px), stop overlaying — stack instead. The viewer gets its own box (`h-[50vh] min-h-[320px]`,
normal flow) and the text panel sits below it in normal flow (no `absolute`, no `h-full`). At `sm`+ the original
`absolute inset-0` overlay + fixed-height section returns unchanged (`sm:absolute sm:inset-0 sm:h-full`), which is
why 1440 (`>> sm`) is provably unchanged — confirmed pixel-identical against the pre-fix screenshot (before/after
`landing-1440-light.png` in scratch screenshots, byte-different only in unrelated hashed asset filenames baked into
`vite build` — visually identical on inspection).

### Fix #2 — `color-scheme` (`apps/studio/src/styles/tokens.css`)

One line per existing theme block, exactly as Q1's own suggested fix said: `color-scheme: light;` added to the
top of `:root` (covers both explicit light and "system, OS light"); `color-scheme: dark;` added inside
`@media (prefers-color-scheme: dark) { :root:not([data-theme='light']) { ... } }` (covers "system, OS dark");
`color-scheme: dark;` added inside `:root[data-theme='dark'] { ... }` (covers explicit dark regardless of OS).
Three declarations, same selectors the toggle (`src/lib/theme.ts`, read-only — not touched) already drives via
`data-theme` on `<html>`. No JS/toggle changes needed, as the brief's "prefer pure CSS" fallback allowed.

### Fix #3 — Studio loading state (`apps/studio/src/routes/Studio.tsx`, loading branch only)

Only the `if (loading || !design) { return <p>...</p>; }` branch inside `StudioLoaded` (the one place the May-touch
list scopes this file to) was changed. It now returns the same header-row + three-pane shell structure/classes as
the loaded render below it (mirrored, not shared, since the loaded branch renders real interactive content and this
one only needs static placeholders): a header row with a muted "Loading design…" label and disabled Save
design/Save run buttons, then the three-pane grid with "Loading viewer…" (centred, matches `ShelterViewer`'s own
Suspense fallback copy), "Loading controls…" and "Loading results…" (matches `ResultsPanel`'s own Suspense
fallback copy/classes) placeholders — real stage text, no invented progress bar/percentage. Nothing else in
`Studio.tsx` was touched (`StudioLoaded`'s other branches, `StudioOptionsGate`, `Studio` unchanged).

### Verification

**Screenshots (before/after, all read with the Read tool).** Own scratch server (:4110) + `vite preview` (:5282,
`apps/studio/e2e/scratch-server.mjs`/new local `preview.config.mjs` reused/cloned at those ports per the brief),
script at `<scratchpad>/q1f/shots.mjs`, run twice against the identical seeded data (`git stash` / `git stash pop`
around the fix to get true before/after without re-registering separate users) into `<scratchpad>/q1f/{before,after}/`:

- `landing-390-{light,dark}.png`, `landing-1440-{light,dark}.png` — 390: before shows only a roof sliver above the
  text panel; after shows the full building (walls, base, compass) with the panel below it. 1440 before/after
  visually identical in both themes.
- `compare-checkboxes-1440-dark.png` — before: unchecked checkbox renders as a plain white square (light UA
  default) against the dark page; after: unchecked checkbox renders with the dark UA palette (dark fill, light
  border), matching the theme.
- `<scratchpad>/q1f/{before,after}/dateinput-crop.png` (tight element-screenshot crop, `deviceScaleFactor:3`, via a
  second small script `<scratchpad>/q1f/dateshot.mjs` — the full-page 1440 shot was too small to read the calendar
  icon by eye) — before: the native calendar-picker icon renders as the browser's dark-on-transparent default,
  nearly invisible on the dark input; after: the icon renders light/outlined, clearly visible. (`studio-dateinput-
  1440-dark.png`, the full-page version, is also in `before`/`after` for context but the crop is what actually
  shows the fix.)
- `studio-loading-1440-{light,dark}.png`, `studio-loading-390-{light,dark}.png` — before: bare "Loading design…"
  text line on an otherwise blank page (header/nav still visible above it, but no design-page frame). After: full
  header row (name-loading label, disabled Save design/Save run) + three-pane layout with "Loading viewer…"/
  "Loading controls…"/"Loading results…" placeholders, at both widths and both themes, no layout jump vs. the
  loaded state's own frame.

**Gotcha found + fixed in the verification script itself, recorded for whoever reruns it:** a `context.
addInitScript(() => localStorage.setItem('shelter-theme', theme))` set once at context creation re-runs on
*every* navigation in that context (that's how Playwright's `addInitScript` works), which silently clobbered a
later per-iteration `page.evaluate(() => localStorage.setItem(...))` back to the context's original theme on each
`page.goto` — the studio-loading screenshots initially all came out in the context's original (dark) theme
regardless of the loop variable, caught by eye (the "Light" segmented button wasn't highlighted in a shot named
`-light`). Fixed by not using `addInitScript` for the authenticated multi-navigation context at all; theme is set
via a plain `page.evaluate` immediately before each navigation that needs a specific one instead. Also fixed a
second bug: reusing one `page.route(pattern, ...)` per loop iteration without waiting for that specific delayed
handler's own completion (not just `page.goto`'s, which resolves once the HTML/JS document loads, independent of
the in-page `fetch`) let the next iteration re-register the same pattern while the previous handler was still
mid-`sleep`, which threw `Route is already handled` once — fixed by awaiting a per-iteration completion promise
before `unroute`.

**Condition 4:**
```
timeout 180 env PLAYWRIGHT_CORE=<scratchpad>/pw/node_modules/playwright-core node apps/studio/e2e/flow.mjs
  → ALL PASS (13/13 checks), 0 unexpected console errors
npm test -w @shelter/studio      → 73 passed (16 files)
npm run build -w @shelter/studio → clean (tsc --noEmit + vite build)
git diff --stat studio/main -- apps/server apps/client apps/web packages package-lock.json → empty
git status --porcelain → only the 3 May-touch files modified (no validation-numbers.csv side effect this
  session — packages/engine's test suite was never run here)
```
All ports (4109/5281 for flow.mjs, 4110/5282 for the scratch verification script) confirmed released after every
run (`ss -ltnp`); no orphaned processes left running at any point (one crash during script development did leave
a scratch server/preview pair on :4110/:5282 orphaned — killed manually, confirmed via `ss`/`ps`, before the next
run; not a product-code issue, see the addInitScript/route gotchas above).

### Scope check

Only `apps/studio/src/routes/Landing.tsx`, `apps/studio/src/routes/Studio.tsx` (loading branch only) and
`apps/studio/src/styles/tokens.css` touched — matches the May-touch list exactly. `src/lib/theme.ts` (the toggle)
was read but not edited, per the brief's "prefer pure CSS ... if that's impossible without touching the toggle
code, stop and report" — it wasn't impossible, so no report needed there.
