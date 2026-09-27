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
4. Landing 1440 light + dark: headline, subtitle and CTA don't overlap the model; 390 unchanged. Hero text passes AA
   contrast (state the measured ratios or the token values used). `prefers-reduced-motion` still respected.
5. `npm test -w @shelter/studio` green (118 + new); `npm run build -w @shelter/studio` clean;
   `timeout 180 env PLAYWRIGHT_CORE=<path> node apps/studio/e2e/flow.mjs` → ALL PASS; frozen guard empty.

## Rules
- The viewer must still mirror what is simulated: don't draw a window on a facet where the server has none, and
  don't change facet counts or constants.
- Same visual identity (V2 decision): no new palette or fonts; purposeful motion only.

## Evidence
(filled by the subagent)
