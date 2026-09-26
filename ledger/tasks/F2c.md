# F2c — Viewer camera fits the canvas aspect
Status: TODO      Depends on: F3

## Goal
The default camera distance is tuned for a landscape canvas. In the Studio page's near-square centre pane (1440 px)
and in the 45vh mobile pane (390 px), the compass "N" glyph is cut off at the right edge. Fit the default framing to
the canvas aspect (building + compass + sun line always fully in frame at load), keeping the current look on landscape.

## Read
`apps/studio/src/viewer/{ShelterViewer.tsx,Compass.tsx,geometry.ts}` · `ledger/tasks/F3.md` Evidence (review round 2)

## May touch / must not touch
May: `apps/studio/src/viewer/**` (no `ShelterViewer` prop changes). Must not: anything else. **No npm install.**

## Conditions
1. Studio page screenshots at 1440×900 and 390×844, light and dark: building, full compass (incl. "N") and sun line in
   frame at load. Also /dev/viewer at 1280×800 looks unchanged from F2b.
2. A pure, tested framing function (distance from footprint + aspect + fov).
3. Build clean, tests pass, no new console warnings.

## Evidence
