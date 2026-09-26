# Q1F — Fix Q1 findings (#1 landing hero at 390, #2 dark color-scheme, #3 Studio loading state)
Status: TODO      Depends on: Q1

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
