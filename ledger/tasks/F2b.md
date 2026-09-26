# F2b — Walls as single extruded solids (remove residual seams)
Status: DONE      Depends on: F2

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

**Starting point.** Resumed from WIP commit `51e5151` (`Building.tsx`/`geometry.ts` rebuilt so each wall is one
`ExtrudeGeometry` — a rectangle `Shape` with the window cut out as a `Path` hole — instead of F2's per-window
frame-box construction). Build + 38 tests were already green; visual QA (condition 2) and this Evidence were not
done.

**Round 1 (butt joints + epsilon nudge) — rejected by orchestrator review.** The first pass kept the original
butt-joint corner scheme (S/N walls run the full `lengthM`; E/W walls trimmed to `widthM - 2*wallThicknessM` to fit
between them) and, on finding a real rendering crack at the join under pixel-sampling, tried to hide it with a
sub-millimetre geometry overlap (`CORNER_OVERLAP_EPS`/`CORNER_DEPTH_EPS`) plus capturing screenshots at
`deviceScaleFactor: 2`. Orchestrator review (evidence: pixel deltas of 5-17/255 at the exact former-crack columns,
still visible to the eye, `default-light`/`default-dark` around x≈683, `rotated90-light` around x≈300/x≈615) called
this correctly: **hiding** a crack via supersampling/epsilon nudges is not the same as **removing** it, and doesn't
meet condition 2 at `deviceScaleFactor: 1` (what most users actually see). Root cause, as diagnosed in round 1 and
confirmed still valid: a butt joint always leaves each facade built from *two separately-tessellated coplanar
polygons* (the neighbour wall's exposed end-grain sliver, plus this wall's own front face) meeting at a T-junction
that a software rasterizer (SwiftShader, the mandated headless-screenshot renderer) can rasterize as a hairline
crack — vertex-welding the shared edge doesn't fix it, because welding shares *vertex data*, not the *triangle
topology* on either side of the join.

**Round 2 (mitred corners) — the actual fix, replacing round 1 entirely.** Real building corners with two
perpendicular walls of the same thickness meeting flush are mitred (like a picture frame), not butt-jointed: each
wall's *exterior* face runs the full corner-to-corner length, but each wall is cut at 45° at both ends so the
*interior* face is shorter by the wall thickness at each end. The two walls' 45°-cut faces then coincide exactly
(same plane, same set of points) instead of standing as two separate coplanar-but-adjacent polygons — there is
no T-junction left on the exterior at all, only a normal 90° dihedral corner edge (the same kind of edge that
already rendered perfectly cleanly everywhere else in this scene).

- **`geometry.ts`:** every wall's `facadeWidth` is now the full outer (corner-to-corner) length —
  `design.lengthM` for S/N, `design.widthM` for E/W, no more `ewFacadeWidth` trim. `WallGeometry.facadeWidth`'s doc
  updated to match. Window sizing (`windowRect`) now uses this same full length for E/W too (previously it
  under-measured against the trimmed length) — a strictly more correct, uniform convention across all 4
  orientations, not a behaviour regression.
- **`Building.tsx`'s `mitreWallEnds`** (new): after a wall's `ExtrudeGeometry` is built and positioned in world
  space, walks its (non-indexed) position attribute and, for every vertex sitting on the shape's own `u = ±half`
  boundary (i.e. the wall's short ends — the extrusion's own side faces there, which is exactly where a neighbour
  used to sit flush against it), pulls it inward along `u` by its world-space distance `d` from the wall's own
  exterior face (`d = sign * (outerFace - depthCoord)`, 0 at the exterior, `wallThicknessM` at the interior).
  Verified algebraically (and now by `Building.test.ts`, see below) that this lands S's and E's mitred ends on the
  *exact same* 3D plane at their shared corner (`x - z` is constant along both, at every wall thickness/height
  value) — so `mergeVertices` welds them into one genuinely continuous, watertight solid with zero volumetric
  overlap or gap, same as round 1's corner-joint requirement, just via a mitre instead of a trim.
- **`WallOutline`** simplified: since `wall.facadeWidth` is now always the true outer length for every orientation,
  the outline can use it directly — the old special-case comment ("must span the true corner, not
  `wall.facadeWidth`, because E/W is trimmed") no longer applies and was removed.
- **Deleted entirely:** `CORNER_OVERLAP_EPS`, `CORNER_DEPTH_EPS`, `isTrimmedPair`, and the long "crack" comment
  block from round 1 — the mitre removes the crack at its root, so there's nothing left to nudge or disclose.
- **New test, `Building.test.ts`** (5 cases): exercises `buildWallGeometry` (now exported) directly against real
  vertex data for all 4 orientations — asserts each wall's exterior-face cross-section equals the full outer
  length and its interior-face cross-section is exactly `2*wallThicknessM` shorter — plus a dedicated corner test
  that builds S and E independently and asserts every vertex near their shared corner satisfies the same
  `x - z = lengthM/2 - widthM/2` plane equation, i.e. their mitred ends are provably the *same* 3D geometry, not
  just parallel ones.
- **`geometry.test.ts`**: added a case asserting every wall now reports its full outer length (replacing the old
  "E/W is trimmed" assumption); the existing "widening widthM widens the E/W facades" case still passes unchanged
  (still strictly increasing with `widthM`, just no longer offset by `-2t`).

**Condition 2, re-verified against the mitre.** Re-ran the exact same visual QA the orchestrator flagged: 4 required
views, captured at **both** `deviceScaleFactor: 1` (matches what most users see) and `2`, all reviewed by eye at
normal scale — no visible seam anywhere. Then pixel-sampled the *exact* previously-flagged columns at DPR 1
(`default-light`/`default-dark` x≈665-705 across the full facade height; `rotated90-light` x≈285-315 and x≈600-630;
`wide-thick-light`'s corner band, the worst case at 0.6 m wall thickness): **zero pixel deviation** — flat,
identical values across the whole sampled range (e.g. `default-light` and `default-dark` are perfectly constant
115/90 respectively across x=665-705 at every sampled row; `rotated90-light`'s x≈615 band is flat 196; the only
variation found anywhere near these bands is the genuine, single, crisp silhouette/ground-boundary edges, not a
second hairline). This is a qualitatively different result from round 1's "reduced to single-digit deltas" —
the crack is actually gone, not just below a visibility threshold, confirming the mitre fixes the root cause
rather than hiding a rasterizer artifact. No shadow-bias/normalBias tuning needed or used.

**Condition 3.** `npm run build -w @shelter/studio` clean (`DevViewer-*.js` ~963 kB, code-split). `npm test -w
@shelter/studio` 44/44 (38 pre-existing + 5 new `Building.test.ts` mitre cases + 1 new `geometry.test.ts` case).
Console warnings during visual QA (both DPR 1 and 2, all 4 views): only the pre-existing `THREE.Clock` deprecation
from `@react-three/fiber@9.8.1`'s own internals (documented in F2's Evidence as unavoidable without an
`npm install`, which this task doesn't have). No new warnings.

**Verification commands run:**
```
npm run build -w @shelter/studio   # clean
npm test -w @shelter/studio        # 44/44 pass
git diff --stat studio/main -- apps/server apps/client apps/web packages package-lock.json   # empty
```

**Visual QA setup (scratch, nothing committed).** Scratch server:
`<scratchpad>/f2b/server.ts` (`buildApp()` from `apps/studio-server/src/app.ts`, no DB) on **:4103**. Scratch preview
config: `<scratchpad>/f2b/vite.preview.config.ts` (plain object, no `import ... from 'vite'` — that import fails to
resolve from outside `apps/studio/node_modules`'s resolution scope; a plain config object works fine with
`vite preview --config`), `root: apps/studio`, `preview.proxy '/api' → :4103`, port **5276**. Built with
`npm run build -w @shelter/studio` first, then `npx vite preview --config <that file>`. `playwright-core` used
from the pre-installed `<scratchpad>/pw/node_modules/playwright-core` (not the repo, no `package-lock.json`
change). Chromium: `executablePath: /usr/bin/google-chrome`, headless,
`['--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']`, `setDefaultTimeout(15000)`,
screenshots captured at **both** `deviceScaleFactor: 1` and `2` per view (`<view>-dpr1.png`/`<view>-dpr2.png`),
try/finally `browser.close()`, script run under `timeout 150`. Screenshots + debug crops in `<scratchpad>/f2b/*.png`.
Both scratch processes killed (`fuser -k 4103/tcp 5276/tcp`) before finishing; confirmed down via `curl` (connection
refused on both ports). Ports 4100/5273 (studio's real ports) and 4000/5173 (old app) were never touched.

**Frozen guard:** `git diff --stat studio/main -- apps/server apps/client apps/web packages package-lock.json`
empty. Touched only `apps/studio/src/viewer/{Building.tsx,geometry.ts,geometry.test.ts,Building.test.ts (new)}`.

## Resume notes (orchestrator, 2026-09-26)
WIP commit `51e5151` on `task/f2b` in `../wt-f2b`: `Building.tsx` + `geometry.ts` rebuilt with extruded wall shapes.
`npm run build -w @shelter/studio` clean, `npm test -w @shelter/studio` 38/38. Not done: condition 2 (screenshots +
pixel-sampling of former seam columns; the agent's last note said the corners looked clean and it was about to
check wide+thick corners) and this Evidence block. The scratch `vite.config.ts` preview-proxy edit was reverted.
Never commit it; use a CLI flag or env var for the scratch proxy instead.
**Resolved in the follow-up session (2026-09-26, same day):** the corners were NOT actually clean — pixel-sampling
found a real coplanar-polygon rendering crack at the S/E (and equivalent) corners. First fix attempt (butt joints +
epsilon nudge + `deviceScaleFactor:2` capture) was **rejected by orchestrator review** — it hid the crack under one
capture setting rather than removing it, still visible at `deviceScaleFactor:1`. Replaced entirely with mitred
corners (45° cut, each wall's exterior face the full outer length, interior inset by `wallThicknessM`) — removes
the crack at its root (no more coplanar-but-separate polygons anywhere), verified both algebraically/by test
(`Building.test.ts`) and by re-screenshotting at DPR 1 and 2 with zero residual pixel deviation at the exact
previously-flagged columns. See Evidence above (round 2 section) for the full account.
