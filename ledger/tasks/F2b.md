# F2b — Walls as single extruded solids (remove residual seams)
Status: IN-PROGRESS (WIP committed, agent hit session limit)      Depends on: F2

## Goal
After F2's merge, faint dashed hairlines remain on facades where frame pieces meet (internal coplanar faces left
inside `mergeGeometries` output cause shading and shadow streaks). Build each wall as ONE solid: a `THREE.Shape`
rectangle with the window as a `Path` hole, `ExtrudeGeometry` depth = wall thickness (bevel off). Then there are no
internal faces anywhere.

## Read
`apps/studio/src/viewer/{Building.tsx,geometry.ts,geometry.test.ts}` · `ledger/tasks/F2.md` Evidence (round 2)

## May touch / must not touch
May: `apps/studio/src/viewer/**` except `ShelterViewer.tsx` props. Must not: anything else. **No npm install.**

## Conditions
1. Walls built from extruded shapes with holes. Corner joints between S/N and E/W walls don't overlap or leave gaps
   (one pair runs full length, the other fits between). The outline (silhouette + reveal) still matches.
2. Screenshots (default light/dark, wide+thick, rotated 90°): no seam lines on any facade and no shadow acne (tune
   `shadow-bias`/`normalBias` if needed). Pixel-sample the former seam columns to confirm.
3. geometry tests still pass; build clean; no new console warnings.

## Evidence

## Resume notes (orchestrator, 2026-09-26)
WIP commit `51e5151` on `task/f2b` in `../wt-f2b`: `Building.tsx` + `geometry.ts` rebuilt with extruded wall shapes.
`npm run build -w @shelter/studio` clean, `npm test -w @shelter/studio` 38/38. Not done: condition 2 (screenshots +
pixel-sampling of former seam columns; the agent's last note said the corners looked clean and it was about to
check wide+thick corners) and this Evidence block. The scratch `vite.config.ts` preview-proxy edit was reverted.
Never commit it; use a CLI flag or env var for the scratch proxy instead.
