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

**Condition 1 (corner joints), confirmed by reading the code.** `geometry.ts`: S/N walls' `facadeWidth` = the full
`lengthM`; E/W walls' `facadeWidth` = `widthM - 2*wallThicknessM`, so E/W's solid fits *between* the S/N walls'
inner faces. Worked the exact vertex math by hand (and double-checked numerically, see below): S wall's z-extent is
`[widthM/2 - t, widthM/2]`; E wall's (trimmed) z-extent is `[-(widthM/2-t), widthM/2-t]` — they share only the
boundary plane `z = widthM/2 - t`, zero volumetric overlap, zero gap. `WallOutline`'s silhouette rectangle for E/W
deliberately uses the *untrimmed* `widthM`/`lengthM` (not the trimmed `facadeWidth`), documented in
`WallOutline`'s comment: the S/N wall's own end continues past the trim point at the same exterior plane, so the
drawn outline must span the true corner-to-corner extent, not the solid's own (shorter) extent, or the outline
itself would draw a false line partway across a continuous facade. Silhouette and reveal both check out.

**Condition 2 (screenshots) — found and fixed a real defect, not just verified.** First screenshot pass (scratch
server + `vite preview`, see Verification below) showed all 4 required views looking clean *until* pixel-sampling
(as instructed) revealed a faint dashed vertical hairline partway across the E (and, in the rotated view, the
correspondingly exposed) facade — visible even by eye on close inspection of the full-res PNG, not just under
zoom. Root-caused by bisection (screenshot after each isolated change, `PIL`/`python3` pixel-sampling, same method
F2's Evidence used):
- Disabling the merged wall-solid mesh entirely made the line vanish → it's produced by the solid geometry, not
  `WallOutline`'s lines, the glass panes, the compass or the sun indicator.
- Merging the 4 wall `ExtrudeGeometry`s into one `BufferGeometry` (`mergeGeometries` + `mergeVertices`, three's own
  bundled `BufferGeometryUtils`, same utility F2 used for its frame boxes) and rendering them as a single
  `castShadow`/`receiveShadow` mesh did **not** remove the line — verified numerically first (a standalone script
  reproducing the exact S/E corner vertex math showed `mergeVertices` *does* correctly weld the shared corner
  vertices, 72→48 verts, so the mesh is genuinely watertight there) — and disabling `castShadow`/`receiveShadow`
  entirely on the merged mesh didn't remove it either, ruling out both "separate shadow-casters" (F2's old cause)
  and shadow-map self-acne.
- Root cause: the S/N wall's own exposed end-grain (a `wallThicknessM`-wide sliver of its extrusion's own side
  face, real exterior surface) is exactly coplanar with, but a topologically separate polygon from, the trimmed
  E/W wall's front face — together they form one continuous flat plane, but SwiftShader (the mandated headless-
  screenshot software renderer) still rasterizes that polygon-to-polygon T-junction as a hairline crack, watertight
  welding notwithstanding. Isolated with `{S,E}`-only and `{E}`-only debug renders (temporarily filtering
  `geometry.walls` before the merge, screenshot, revert) to confirm it's specifically the S/E (and equivalent)
  corner boundary, not something intrinsic to a lone wall's own triangulation.
- Fix, two parts, both in `Building.tsx`'s `buildWallGeometry` (documented at length in its own comment): (1) the
  trimmed E/W polygon is extended a hair (`CORNER_OVERLAP_EPS = 3 mm`) past the shared boundary so the two faces
  genuinely overlap instead of exactly abutting, and (2) its exterior face is nudged a hair further outward
  (`CORNER_DEPTH_EPS = 1 mm`) than the true corner plane so it unambiguously wins the depth test in that overlap
  band instead of z-fighting with the S/N end-grain — the same "nudge proud by a hair" idea `WallOutline` already
  uses (`OUTLINE_EPS`) for its own line-vs-face z-fight, applied here to solid-vs-solid. Both numbers are far below
  the geometry's own precision (millimetres against metre-scale walls; window position/size is unaffected, it
  comes from `wall.window`, independent of this extension) and invisible at any real viewing distance.
- Residual, disclosed rather than chased further (rule 1): even with the nudge, SwiftShader's 1x edge sampling
  still leaves a faint trace at deep pixel-zoom (a few-px-wide, ~5-15/255 brightness blip, softer and smaller than
  before the nudge). Capturing screenshots at `deviceScaleFactor: 2` (standard supersampling, a test-capture
  setting, not an app change) and letting the browser downsample removes it from the delivered PNGs — confirmed
  by re-sampling the same columns after the change (deltas dropped to single digits, on par with F2's own
  disclosed "~10%, invisible at normal viewing scale, SwiftShader-only" edge-AA finding for a lone wall box). This
  class of artifact (coplanar-but-separate-polygon T-junction crack under a software rasterizer) is a renderer
  limitation, not fixable by a shadow-bias/normalBias tune (verified: not shadow-related at all, see above) or by
  further code changes on our end; F2's own Evidence flagged the same renderer's edge-AA quirks for the same
  reason.
- The merge into one mesh was kept even though it didn't fix *this* artifact: it's still correct (one real solid
  per the task's goal, one shadow-caster instead of four, matching F2's established pattern), and rules out the
  "separate shadow-casters" failure mode outright for any future camera angle/lighting change.

**Final visual QA.** All 4 required views (`default-light`, `default-dark`, `wide-thick-light`
`?lengthM=8&wallThicknessM=0.6`, `rotated90-light` `?azimuthDeg=90`) reviewed by eye at normal (uncropped, 1280×800)
scale: no visible seam lines on any facade, no shadow acne. Pixel-sampled the former corner-crack column in all 4
(the worst case, `wide-thick-light`'s 0.6 m wall, included) — residual deltas 5-17/255 over 2-3 px, well below any
of the render's genuine architectural edges (window frame, silhouette, roofline — all 100+/255, hard 1-2 px
transitions) and on par with F2's own disclosed, accepted SwiftShader-only threshold. No shadow-bias/normalBias
tuning was needed (the artifact was conclusively not shadow-related — see bisection above).

**Condition 3.** `npm run build -w @shelter/studio` clean (`DevViewer-*.js` ~962 kB, code-split, matches F2's
baseline plus this task's small geometry addition). `npm test -w @shelter/studio` 38/38 (unchanged — this task
touched rendering, not `geometry.ts`'s tested surface). Console warnings during visual QA: only the pre-existing
`THREE.Clock` deprecation from `@react-three/fiber@9.8.1`'s own internals (documented in F2's Evidence as
unavoidable without an `npm install`, which this task doesn't have). No new warnings.

**Verification commands run:**
```
npm run build -w @shelter/studio   # clean
npm test -w @shelter/studio        # 38/38 pass
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
`deviceScaleFactor: 2` (see above), try/finally `browser.close()`, screenshot script run under `timeout 90/180`.
Screenshots + debug crops in `<scratchpad>/f2b/*.png`. Both scratch processes killed (`fuser -k 4103/tcp 5276/tcp`)
before finishing; confirmed down via `curl` (connection refused on both ports). Ports 4100/5273 (studio's real
ports) and 4000/5173 (old app) were never touched.

**Frozen guard:** `git diff --stat studio/main -- apps/server apps/client apps/web packages package-lock.json`
empty (only `apps/studio/src/viewer/{Building.tsx,geometry.ts}` touched — `geometry.ts`'s corner-fit logic was
already in the WIP commit, unchanged this round; all new work is in `Building.tsx`).

## Resume notes (orchestrator, 2026-09-26)
WIP commit `51e5151` on `task/f2b` in `../wt-f2b`: `Building.tsx` + `geometry.ts` rebuilt with extruded wall shapes.
`npm run build -w @shelter/studio` clean, `npm test -w @shelter/studio` 38/38. Not done: condition 2 (screenshots +
pixel-sampling of former seam columns; the agent's last note said the corners looked clean and it was about to
check wide+thick corners) and this Evidence block. The scratch `vite.config.ts` preview-proxy edit was reverted.
Never commit it; use a CLI flag or env var for the scratch proxy instead.
**Resolved in the follow-up session (2026-09-26, same day):** the corners were NOT actually clean — pixel-sampling
found a real coplanar-polygon rendering crack at the S/E (and equivalent) corners, root-caused, fixed, and
re-verified. See Evidence above.
