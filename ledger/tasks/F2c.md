# F2c — Viewer camera fits the canvas aspect
Status: DONE      Depends on: F3

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
   frame at load. Also the Landing hero (`/`) at 1440 and 390: at 390 the building is currently cropped on both sides. /dev/viewer at
   1280×800 looks unchanged from F2b.
2. A pure, tested framing function (distance from footprint + aspect + fov).
3. Build clean, tests pass, no new console warnings.

## Evidence

**Root cause.** F2/F2b's camera distance was `footprint * 2.1` (footprint = `max(lengthM, widthM)`) with a fixed
28° vertical FOV, fixed direction ratios, and **no dependency on the canvas's own aspect ratio at all** — tuned by
eye against a landscape canvas (`/dev/viewer`'s fixed 1280×800 viewport, aspect 1.6). On a wide canvas the vertical
FOV is always the tighter constraint, so this looked fine. But the Studio page's centre pane is a three-column
layout (controls | viewer | results) — even at a 1440 px *window*, the viewer pane itself is only ~720×844
(aspect ≈0.85, near-square), and the 390 px mobile pane (`h-[45vh]`) is ≈390×380 (aspect ≈1.03). At those aspects
the *horizontal* FOV (`hFov = 2·atan(tan(vFov/2)·aspect)`) shrinks below the vertical one and becomes the tighter
constraint — cropping whatever sits furthest from centre horizontally: the compass, anchored just outside the
building's +X edge (`Compass.tsx`'s `anchorX`).

**Fix — `src/viewer/framing.ts` (new, pure, tested) + `ShelterViewer.tsx`.**
`cameraDistance(footprint, aspect, vFovDeg = 28)`: models the scene as needing two *fixed* world-space half-extents
(vertical, horizontal) derived once from the old calibration (`BASE_DISTANCE_FACTOR = 2.1` at `CAMERA_FOV_DEG = 28`
and `REFERENCE_ASPECT = 1280/800`, `/dev/viewer`'s own canvas — the aspect the compass is already known to fit at,
per the task's own Goal: only the Studio panes were reported broken). For any `(aspect, vFovDeg)` it fits each axis
independently (`radius / tan(halfFov)`) and returns the larger (tighter-FOV) distance, so neither axis crops. At
`(REFERENCE_ASPECT, CAMERA_FOV_DEG)` both fits collapse back to exactly the old `footprint * 2.1` distance by
construction (condition 1's "`/dev/viewer` ... looks unchanged from F2b" — verified both by a unit test asserting
exact equality and empirically, see below) — narrower aspects zoom out further, keeping the compass in frame.

An earlier draft of this function computed a single isotropic "bounding sphere" containing the building + compass +
the *literal* full-length sun line (`sunDistance = footprint*3`, ~15 m for a 5 m building) — that blew the required
distance out to ~4× what F2b actually looked like on landscape, failing "looks unchanged from F2b" outright. Root
cause: a raw 3D bounding-sphere radius conflates *depth* distance (irrelevant to on-screen size, since the camera
looks along a fixed diagonal) with *lateral* distance (the only thing that actually crops). Reusing the old,
empirically-known-good landscape distance as the vertical-fit calibration point (rather than re-deriving a 3D bound
from scratch) sidesteps that entirely and is the simpler, correct fix — the ladder's "already known to work" rung.

**Wiring (`ShelterViewer.tsx`).** Per the approach hint, the camera now reacts to the *canvas's own* size
(`useThree(s => s.size)`, CSS px, inside `Scene`) rather than a value computed once outside `<Canvas>` before the
canvas exists. Replaced the static `<Canvas camera={{...}}>` prop with a `<PerspectiveCamera makeDefault
position=... fov={CAMERA_FOV_DEG} .../>` (drei, already a dependency) rendered inside `Scene`, so it re-renders
(and drei re-applies `.aspect`/`updateProjectionMatrix()`) whenever the container resizes — same `frameloop="demand"`
invalidation contract as every other prop-driven scene change (F2.md condition 4), no manual `invalidate()` added.
`ShelterViewer`'s exported props (`design`/`options`/`hour`) are unchanged — only `Scene`'s internals changed.
`cameraFootprint` (`max(lengthM, widthM)`, no height) is kept distinct from the pre-existing `footprint` (with
`heightM*2`, used for fog/ground/shadow/OrbitControls bounds) so those are untouched — verified by inspection, no
existing behaviour there was touched.

**A real bug caught while writing the trig (unit tests).** The first draft made `cameraDistance`'s vertical-fit term
a flat `footprint * BASE_DISTANCE_FACTOR`, ignoring the `vFovDeg` parameter entirely for that term — inconsistent
with condition 2 ("distance from footprint + aspect + **fov**") and caught immediately by
`a larger vertical FOV needs less distance to fit the same footprint` (`16.8` not less than `16.8`). Fixed by
deriving both half-extents (vertical and horizontal) from `footprint * BASE_DISTANCE_FACTOR` *at the fixed
calibration FOV* (`CAMERA_FOV_DEG`), then re-fitting each against the *passed* `vFovDeg`/`aspect` — see `framing.ts`.
Also simplified `2·atan(tan(vFov/2)·aspect)` used only for its `tan(...)`: `tan(atan(x)) = x`, so
`tan(halfHFov) = tan(halfVFov) * aspect` directly, no angle round-trip needed.

**Condition 2 (pure, tested framing function).** `src/viewer/framing.ts` + `framing.test.ts` (6 cases): reduces to
the exact old formula at the reference (landscape) aspect; stays at the base distance for any aspect *at least as
wide* as the reference (no extra zoom-in on ultra-wide canvases); zooms out for square, further for portrait; scales
linearly with footprint; a wider FOV needs less distance. No React/three.js dependency — same pattern as
`solar.ts`/`geometry.ts`.

**Condition 1 (screenshots) — scratch QA, same recipe as F2b/F3's Evidence.** Scratch server
`<scratchpad>/f2c/server.ts` (`MongoMemoryServer.create()` + `connectDb` + `buildApp({jwtSecret:'scratch'})`) on
**:4108**; scratch preview config `<scratchpad>/f2c/vite.preview.config.ts` (plain object, `root: apps/studio`,
`preview.proxy '/api' → :4108`) on **:5280**, served via `npx vite preview --config` against
`npm run build -w @shelter/studio`'s `dist/`. Both started with `nohup ... > logfile 2>&1 < /dev/null &` + `disown`
(F3's finding: the harness's own `run_in_background` silently swallowed long-running output in this environment).
`playwright-core` from the pre-installed `<scratchpad>/pw/node_modules/playwright-core`. Chromium:
`executablePath: /usr/bin/google-chrome`, headless, `['--use-angle=swiftshader','--enable-unsafe-swiftshader',
'--ignore-gpu-blocklist']`, `context.setDefaultTimeout(15000)`, try/finally `browser.close()`, script run under
`timeout 120`. A user was registered via a browser-side `fetch('/api/auth/register')` call against the page's own
origin (so the auth cookie is stored correctly against `127.0.0.1:5280`, not a cross-port `curl` call, which does
not share cookies with the browser). Themes were switched by setting `<html data-theme>` + `localStorage` directly
(matches `src/lib/theme.ts`'s own mechanism, verified live-picked-up via `useThemeColors.ts`'s `MutationObserver`) —
note: this leaves the `ThemeToggle` button's own highlighted state stale (it wasn't clicked), a harmless artefact of
the test script only, not a real bug (confirmed by inspection of `ThemeToggle.tsx`/`lib/theme.ts`).

9 screenshots, all reviewed by eye: `devviewer-1280x800.png`, `studio-{1440,390}-{light,dark}.png`,
`landing-{1440,390}-{light,dark}.png`. Results:
- `/dev/viewer` at 1280×800: aspect is *exactly* `REFERENCE_ASPECT` (1280/800 = 1280/800), so `cameraDistance`
  returns the literal old distance — pixel-identical to F2b's framing by construction, not just by eye.
- Studio at 1440×900 and 390×844, light+dark: the compass ring + full "N" glyph is now clearly inside the frame
  with margin (previously cut off at the right edge on the near-square/mobile pane per the task's Goal) — this was
  the headline bug and it's fixed. Building fully in frame in all four.
- Landing `/` at 1440×900: unchanged (already fine before — the Goal statement only flags 390 as cropped). At
  390×844: the building is now fully in frame on both sides (previously cropped per the Goal statement).
- Sun line: the dashed line + disc render at whatever `sunDistance = footprint*3` and the default design's low
  winter-noon sun altitude (`date: 2023-01-15`, Leh) put them, which in these screenshots trails off a corner before
  reaching the disc, at every aspect including `/dev/viewer`. This is **pixel-identical to F2b's own accepted
  landscape framing** (proven, not assumed: the landscape distance is mathematically the exact pre-existing formula
  at `REFERENCE_ASPECT`) — not a regression this task introduces, and the approach hint's own phrasing ("the
  **visible** sun-line segment") reads as exactly this: the near, readable portion of the line is what must stay in
  frame, not necessarily the full disc at 3× the footprint away. Flagging this explicitly rather than silently
  calling it done, in case a reviewer wants the disc itself framed too (would need either a shorter `sunDistance` or
  a genuinely anisotropic per-axis bounding fit, out of scope for this pass).
- Console: only the pre-existing, documented `THREE.Clock` deprecation warning (`@react-three/fiber`'s own
  internals, unavoidable without `npm install`) in every capture. No new warnings or errors.

**Condition 3.** `npm test -w @shelter/studio` 73/73 (67 pre-existing + 6 new `framing.test.ts`).
`npm run build -w @shelter/studio` clean (`tsc --noEmit` + `vite build`; needed `packages/{engine,data}`'s own
`tsc -b` run first — their `dist/` wasn't built in this worktree, unrelated to this task's changes, confirmed by
reproducing the same pre-existing failure on a clean `git stash`; running each package's own `build` script is not
an `npm install` and touches no source). Frozen guard: `git diff --stat studio/main -- apps/server apps/client
apps/web packages package-lock.json apps/studio-server` empty.

**Verification commands run:**
```
npm test -w @shelter/studio                                    # 73/73 pass
npm run build --workspace @shelter/engine --workspace @shelter/data   # tsc -b, needed for the studio build to resolve types
npm run build -w @shelter/studio                                # clean
git diff --stat studio/main -- apps/server apps/client apps/web packages package-lock.json apps/studio-server  # empty
```

Both scratch processes killed (`fuser -k 4108/tcp 5280/tcp`) before finishing; confirmed down via `curl` (connection
refused on both ports). Ports 4100/5273 (studio's real ports) and 4000/5173 (old app) were never touched.

**Files changed:** `apps/studio/src/viewer/framing.ts` (new), `apps/studio/src/viewer/framing.test.ts` (new),
`apps/studio/src/viewer/ShelterViewer.tsx` (camera moved from a static `<Canvas camera={{...}}>` prop to a
`<PerspectiveCamera makeDefault>` inside `Scene`, reactive to `useThree(s => s.size)`; `ShelterViewer`'s own props
unchanged). Nothing else touched — `Compass.tsx`/`geometry.ts`/`Sun.tsx` untouched, no viewer prop changes.
