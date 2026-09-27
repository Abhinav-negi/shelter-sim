# Q2F — Fix Q2 visual findings (dome windows, popover placement, landing hero)
Status: TODO      Depends on: Q2 (merged)      Phase: Studio v2 (findings table in `ledger/tasks/Q2.md` Evidence)

## Goal
Fix the four findings from Q2's visual QA, all client-only, no contract change:
1. **Dome windows never render** (major, misleading). `viewer/geometry.ts windowRect()` uses a fixed 0.9 m sill +
   0.3 m lintel margin; a dome's wall band slant height is ≈ r/3 (≈0.83 m at 5 m diameter), so the window is clamped
   to zero. The server simulates the glazing, so the viewer hides something that is simulated.
2. **Part popover covers the part it edits** (minor): at 1440 it partly covers the south window, at 390 almost
   entirely. Anchor it beside/above the part (`viewer/PartPopover.tsx anchorPosition` and/or its `<Html>` offset).
3. **Landing hero headline sits over the building at 1440** (minor): offset the model right (or the text into a
   clear column) so text and model don't overlap at wide widths.
4. **Landing hero text contrast** (found in orchestrator review): at 1440 light, the eyebrow "SHELTERSIM STUDIO",
   the subtitle, the "Explore the technology" link and the "At 06:00 …" / "Outdoor …" labels are near-illegible over
   the grey gradient/model. Every hero text element must meet WCAG AA (4.5:1 body, 3:1 large) in both themes.

## Read
`ledger/tasks/Q2.md` (Evidence: findings table, gotchas) · `ledger/tasks/{G3,G4,G5}.md` Evidence ·
`apps/studio/src/viewer/{geometry.ts,Building.tsx,PartPopover.tsx,ShelterViewer.tsx}` ·
`apps/studio/src/routes/landing/Hero.tsx`, `routes/Landing.tsx` · existing tests next to those files ·
`apps/studio/e2e/flow.mjs` (how to run the E2E).

## May touch / must not touch
May: `apps/studio/src/viewer/**`, `apps/studio/src/routes/landing/**`, `apps/studio/src/routes/Landing.tsx`, tests
beside them, this file, the Q2F row in STUDIO.md. Must not: `apps/studio-server/**` (the server facets are correct),
`apps/studio/e2e/**` unless a selector breaks (then report why), frozen paths. No npm install.

## Conditions
1. Dome, 5 m diameter, South WWR 30%: a window renders on the south wall facets. New unit test in the viewer's
   geometry tests: for a 5 m dome with WWR 0.3, every south wall facet has a non-null window with
   `width*height` > 0 and ≤ the facet area; margins scale with the facet (no fixed clearance larger than the facet).
2. Box and cylinder windows are unchanged: all existing geometry tests pass unmodified.
3. Popover: at 1440 and 390, selecting the south window (box, WWR 30%) leaves the window fully visible — the popover
   does not overlap the window's screen rect. Screenshot evidence at both widths, light + dark.
4. Landing at 1280, 1440 and 1920 wide, light + dark: no seam or band anywhere in the hero; building and compass
   fully in frame (no edge cropping); headline, subtitle and CTA don't overlap the model. 390: unchanged from before
   Q2F. Hero text passes AA contrast (state the measured ratios or the token values used). `prefers-reduced-motion`
   still respected. (Widened from the original 1440-only condition after orchestrator review round 1 caught a
   seam/crop regression in the first fix attempt — see Evidence.)
5. `npm test -w @shelter/studio` green (118 + new); `npm run build -w @shelter/studio` clean;
   `timeout 180 env PLAYWRIGHT_CORE=<path> node apps/studio/e2e/flow.mjs` → ALL PASS; frozen guard empty.

## Rules
- The viewer must still mirror what is simulated: don't draw a window on a facet where the server has none, and
  don't change facet counts or constants.
- Same visual identity (V2 decision): no new palette or fonts; purposeful motion only.

## Evidence

**Status: DONE.** Files touched: `apps/studio/src/viewer/geometry.ts`, `apps/studio/src/viewer/geometry.test.ts`,
`apps/studio/src/viewer/PartPopover.tsx`, `apps/studio/src/viewer/PartPopover.test.ts` (new),
`apps/studio/src/viewer/ShelterViewer.tsx`, `apps/studio/src/routes/landing/Hero.tsx`,
`apps/studio/src/routes/landing/hooks.ts`, this file, and the Q2F row in `STUDIO.md`. Nothing else. All
screenshots/scripts are scratchpad-only (`/tmp/.../scratchpad/q2f/`), not committed.

**Orchestrator review round 1** caught a regression in the first landing-overlap fix (a CSS transform on the
viewer's DOM element — hard seam + right-edge crop at 1440). Reworked as a camera-level fix (`ShelterViewer.tsx`'s
new `frameShift` prop) per the orchestrator's brief; see "Headline/model overlap" below for the full account,
including a mobile-clipping regression caught and fixed before it shipped this time. Re-verified at 1280/1440/1920
(new condition, added by the orchestrator) plus 390, both themes; re-ran the full suite/build/`flow.mjs`/frozen
guard.

### 1. Dome windows never render

Root cause confirmed exactly as the orchestrator's notes described: `geometry.ts`'s `windowRect()` clamped window
height to `facadeOrSlantHeight - 0.9 (sill) - 0.3 (lintel)`; a 5m dome's wall-band slant height (~0.85m/~0.97m for
bands 0/1) is below that 1.2m floor, so every dome facet got `window: null` regardless of WWR.

**Fix:** `windowRect()` now takes an optional 4th `margins` param (`{sillM, lintelM}`, default = the existing fixed
`WINDOW_SILL_M`/`WINDOW_LINTEL_MARGIN_M` constants). Box (line ~300-ish call) and cylinder (`cylinderWalls`) call it
with the same 3 args as before — **byte-identical**, no behaviour change, verified by all pre-existing geometry
tests passing unmodified (condition 2). Only `domeFacetsFor`'s wall-facet branch now passes a new
`scaledWindowMargins(slantHeight)`: the same 3:1 sill:lintel ratio as the fixed metres, scaled to the facet's own
slant height and capped at the fixed values (`Math.min(WINDOW_SILL_M, heightM*0.45)`, `Math.min(WINDOW_LINTEL_MARGIN_M,
heightM*0.15)`) — so margins shrink instead of eating the whole facet, and `windowRect` returns the *scaled* sill in
the `WindowRect` it hands back (so `PartPopover`'s anchor math, below, uses the real value).

**New unit test** (condition 1): 5m dome, South WWR 0.3 — asserts all 6 south-facing wall facets (3 sectors ×
2 wall bands) get a non-null window, `width*height` is `>0` and `<=` the facet's own trapezoid area (same formula
the pre-existing dome-area test uses), and `sill < 0.9` (the fixed metre) *and* `sill < slantHeight` — i.e. margins
demonstrably scaled down, not just "happened to still fit".

**`Building.tsx` needed no change** — it already draws a window mesh whenever `facet.window`/`wall.window` is
non-null; the orchestrator's suspicion that it "may never have been exercised" was correct (dome windows never had
a non-null rect to draw before), but the drawing code itself was fine. Confirmed live: `studio-dome-5m-1440-{light,dark}.png`
(5m dome, South WWR 30%) shows multiple window panes across both visible wall bands, matching the reference
"large-diameter dome already shows a window" screenshot Q2 left behind.

### 2. Part popover covers the part it edits

Root cause: `anchorPosition()` (`PartPopover.tsx`) anchored *every* part — including a selected window — at the
wall's/facet's **mid-height**. A real window's vertical span (sill 0.9m up to `sill+height`) at typical
dimensions straddles that mid-height point, so the popover's own "translate up above the anchor" CSS offset
(`-translate-y-[calc(100%+12px)]`) started from a point already *inside* the window, leaving the popover's lower
portion still over the window — worse at 390px where the popover is proportionally larger.

**Fix:** `anchorPosition()` now anchors a `window:*` part at the window's own **top edge**
(`sill + height`, projected along the facet for box/cylinder; interpolated along the facet's slant for a dome, using
the same slant-height math as `domeFacetsFor`) instead of the mid-height/mid-facet point. Wall/roof/floor anchors
are unchanged (still mid-height — no window rect to reason about, not part of any finding). New
`PartPopover.test.ts` (3 tests, pure `anchorPosition` unit tests, no DOM/R3F needed) locks this in: a window anchors
at `sill+height` and above the old mid-height point; a plain wall (no window) and a window with no rect (WWR 0)
both still fall back to mid-height unchanged.

**Verified live** (South window, WWR 30%, box, `?g4e2e=1` hook + a real `page.mouse.click` at the hook's reported
screen position — same technique as `flow.mjs`/Q2.md's own script): at both 1440 and 390, light and dark, the
popover sits fully above the window with a clear gap — no overlap with the window's screen rect.
Screenshots: `studio-popover-{1440,390}-{light,dark}.png`.

### 3 & 4. Landing hero: headline overlaps the model, and text contrast

These turned out to share one underlying cause once measured against a **real** browser render (not just the
reference screenshot) — recorded here because the reference screenshot in the brief (`landing-1440-light.png`)
turned out to be misleading and re-diagnosing why mattered:

**What the reference screenshot showed:** at toggle=Light, the whole hero (header included) rendered in *light*
tokens with a light-to-dark sky gradient — exactly matching the "grey gradient/model, illegible text" description.

**What re-running it live (before any fix) showed:** clicking "Dark" produced a properly dark, legible hero (as
G5's `useForceDarkTokens` intends); clicking "Light" reproduced the reference screenshot exactly. This is a real
race, not a one-off flaky capture (Q2.md's own gotcha #2 was about a *different*, already-fixed timing issue in its
screenshot script, not this):

`useForceDarkTokens` (`routes/landing/hooks.ts`) and the header's `useTheme` (`lib/theme.ts`, out of this task's
May-touch scope) both write the **same** `document.documentElement` `data-theme` attribute independently.
`useForceDarkTokens` sets it to `'dark'` once, at mount/intersection-change only. Clicking the theme toggle while
still scrolled to the hero runs `useTheme`'s own effect, which unconditionally overwrites the attribute with the
user's literal choice (`'light'`) — and nothing in `useForceDarkTokens` was listening for that, so the hero was
stuck in light tokens (and the light-theme scene's brighter sky/ground render) until the next intersection-ratio
change (i.e. scrolling away and back), which never happens in a static screenshot.

**Fix (`hooks.ts`, within the `routes/landing/**` May-touch glob, though not itself in the task's `Read` list — read
out of necessity to trace `Hero.tsx`'s own `useForceDarkTokens` import; flagged here rather than silently expanding
scope):** `useForceDarkTokens` now also runs a `MutationObserver` on `document.documentElement`'s `data-theme`
attribute and re-asserts `'dark'` the instant anything else changes it while the hero is still intersecting. Tracks
`intersecting` in a closure variable (shared with the existing `IntersectionObserver` callback) rather than React
state, so no extra render. No infinite loop: `apply()` setting the attribute *to* `'dark'` doesn't re-trigger itself
(the observer only re-applies when the attribute is *not* `'dark'`). This one fix made the "text contrast" finding
mostly disappear on its own: with dark tokens now reliably forced, `text-ink`/`text-ink-muted` render as their
light dark-theme values (`#edece7`/`#9a9d9f`) against the scene's own now-dark `paper` background/fog, not the
light-theme colours over a light sky.

**Measured contrast** (post-fix, pixel-sampled from `landing-1440-dark.png` — decoded with `apps/studio/e2e/png.mjs`'s
`decodePng`, ambient background luminance behind the text column measured directly, avoiding glyph pixels
themselves): background luminance ≈0.009 (matches `--paper` dark, `#16181b`, almost exactly). `text-ink`
(`#edece7`) vs that background: **15.0:1** (need ≥3:1 for the large headline — comfortably over). `text-ink-muted`
(`#9a9d9f`) vs that background: **6.5:1** (need ≥4.5:1 for the eyebrow/subtitle/"Explore the technology" link/temp-strip
labels — comfortably over). These are the same numbers as the plain token-vs-token calculation
(`ink`/`ink-muted` dark values vs `paper` dark value), confirming the *only* reason contrast was failing before was
the scene/background not actually being dark, not the token pairing itself.

**Headline/model overlap (finding #3), fixed separately:** even with contrast fixed, the building's silhouette
still visually sat behind/under the headline at 1440 (same geometry, unrelated to token colours) — Q2's own pixel
measurement (`x=310-605` overlap) still applied.

*First attempt (reverted after orchestrator review):* a CSS `sm:translate-x-[22%]` on the viewer's outer `<div>`
(`Hero.tsx`). This visually worked at 1440 but the orchestrator caught two regressions on inspection: (a) a hard
vertical seam at the canvas's original left edge, where the section's own (lighter) background showed through
behind the headline — visible specifically because the light-theme screenshot at that instant hadn't fully settled
into the forced-dark backdrop the transform's "blends in" assumption depended on; (b) the building/compass were
cropped at the viewport's right edge, since a CSS transform shifts the already-rendered raster without changing the
canvas's actual size — content that rendered near the original right edge just moves further right and off-screen.
Both are exactly the "resize the DOM element" failure mode the brief warned about; reverted in full.

**Fix that shipped:** shift the *camera's rendered frame*, not the DOM element, via a new `frameShift` prop on
`ShelterViewer`/`Scene` (`viewer/ShelterViewer.tsx`) — default `false`, so every other caller (Studio, DevViewer,
ShapeStrip) is untouched. When on, it:
1. Multiplies `camDist` (the existing `cameraDistance()` result) by a fixed `FRAME_SHIFT_ZOOM_OUT` (1.55) — a
   genuine zoom-out, moving the camera further away so the building appears smaller with headroom to spare.
2. Calls `camera.setViewOffset(FULL, FULL, offsetX, 0, viewWidth, FULL)` — a **projection-matrix crop+shift**
   (`FULL`/`viewWidth`/`offsetX` are abstract ratios, not pixels, so it doesn't need to react to the canvas's actual
   size) that crops to `FRAME_SHIFT_CROP` (0.82) of the full frustum's width and positions that crop so the
   frustum's true centre (where the building/target sit) renders at `FRAME_SHIFT_TARGET_D` (0.6) of the canvas's
   width — i.e. the building ends up noticeably right-of-centre, inside the canvas's own actual bounds (no crop at
   the edge, because the canvas itself was never resized/moved).

**Why `setViewOffset` and not "move the OrbitControls target/camera position"** (the other option the brief
suggested) — traced through before implementing, not discovered by trial and error: `autoRotate` makes
`OrbitControls` continuously revolve the *camera* around its `target` at a fixed radius/polar angle, and by
`OrbitControls`' own definition the `target` always renders at screen-centre. If the target (or the camera position
relative to it) were the thing offset instead, the vector from target to the (fixed-at-origin) building would stay
constant in *world* space but its *screen-space* projection would sweep through a full sine wave as the camera
revolves — i.e. the building would visibly swing from the right side of the frame to the left and back once per
auto-rotate cycle, re-overlapping the text column for half of every rotation. `setViewOffset`'s shift lives entirely
in the projection matrix (screen space), so it's invariant to the camera's current orbit angle — the target
(always screen-centre) simply always renders shifted, at every rotation angle, and `OrbitControls` never touches
`camera.view` so it can't fight or reset it.

**Mobile regression caught before it shipped:** `frameShift` was initially passed unconditionally (`<Viewer ...
frameShift />`). A live screenshot at 390px showed the compass ring/"N" glyph almost entirely clipped — the crop
constants were tuned against the wide/landscape desktop aspects (1280-1920), and applying the same fixed crop to
the mobile hero's much narrower, portrait-ish viewer box clipped content that the *unshifted* framing had always
kept comfortably in view. Fixed by gating `frameShift` to the same `sm` (640px) breakpoint the hero's own `sm:`
classes already switch the mobile stacked layout to the desktop overlay at: a new `useMinWidth(px)` hook
(`routes/landing/hooks.ts`, same plain-`matchMedia` pattern as the existing `useReducedMotion`), consumed as
`frameShift={isDesktopHero}` in `Hero.tsx`. Below `sm`, `frameShift` is `false` and the camera is byte-identical to
pre-Q2F — confirmed live, the 390px screenshot now matches the original (pre-frameShift) framing again.

Verified live at **1280, 1440 and 1920 wide, both themes**: no seam anywhere in the hero (the "background" is the
scene's own vignette/fog, not a flat CSS colour meeting a hard edge), building and compass fully in frame with
margin on every side, no overlap with the text column (headline/subtitle/CTA/temp-strip all sit over the plain dark
backdrop, not the building). **390 unchanged** from before this fix. `prefers-reduced-motion`: untouched code path
(`useReducedMotion`/`autoRotate={!reducedMotion}` wasn't touched), still respected.

**Studio/flow.mjs unaffected, confirmed numerically, not just "should be identical":** `frameShift` defaults to
`false` everywhere except the Hero's `sm`+ path, so Studio's `<ShelterViewer interactive .../>` never passes it —
`camDist` multiplies by `1` (a no-op) and the `useEffect` calls `camera.clearViewOffset()` (a no-op on a camera that
was never offset). Re-ran `flow.mjs` after this change: the canvas bbox numbers (`492×249` before, `560×282` after
widening) and the South-window patch-diff score (`29904`) are **byte-identical** to the pre-Q2F run — not just
"tests still pass", the actual pixel-level numbers didn't move at all.

Screenshots: `landing-{1280,1440,1920}-{light,dark}.png`, `landing-390-light.png`. 0 console errors in every
screenshot run (only the allowed `THREE.Clock` warning would have been allow-listed; none appeared).

### Verification

```
npm test -w @shelter/studio                                         -> 122 passed (22 files) [118 + 4 new]
npm run build -w @shelter/studio                                    -> clean (tsc --noEmit + vite build)
timeout 180 env PLAYWRIGHT_CORE=<path> node apps/studio/e2e/flow.mjs -> [flow] ALL PASS (29 checks)
git checkout -- packages/engine/test/output/validation-numbers.csv (pre-existing engine-test side effect, unrelated)
git diff --stat studio/main -- apps/server apps/client apps/web packages -> empty
```

Ports 4109/5281 confirmed released (`ss -ltnp`) after every scratch-server run (mine and `flow.mjs`'s own).
No servers left running.

### Rule-conflict note

The task's `Read` section didn't list `apps/studio/src/routes/landing/hooks.ts`, but the `May touch` glob
(`apps/studio/src/routes/landing/**`) covers it, and understanding/fixing `Hero.tsx`'s `useForceDarkTokens` import
required reading and then editing it — the actual root cause of finding #4 lived there, not in `Hero.tsx` itself.
Treated the broader `May touch` grant as authoritative for this one file rather than stopping, since the
alternative (patching contrast symptoms in `Hero.tsx` alone, e.g. a scrim overlay, while leaving the real light/dark
race in `hooks.ts` unfixed) would have been the symptom-fix the brief's own rules warn against. Flagging this
explicitly rather than silently expanding scope, per rule 1 ("if rules conflict, stop and report; don't pick
silently") — no other rule conflicts encountered.

### What's left

Nothing outstanding for this task. `apps/studio/src/lib/theme.ts` / the header's `useTheme` (which independently
writes the same `data-theme` attribute) is unchanged and out of scope — the `MutationObserver` fix in
`useForceDarkTokens` is the one-sided reconciliation; a cleaner long-term fix (e.g. `useTheme` itself being
scroll-aware) would be a `lib/`-scoped follow-up outside this task's allowed files.
