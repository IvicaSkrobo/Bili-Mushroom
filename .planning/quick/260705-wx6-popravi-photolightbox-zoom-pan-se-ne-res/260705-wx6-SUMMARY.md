---
phase: quick-260705-wx6
plan: 01
subsystem: ui
tags: [react, useEffect, lightbox, regression-fix, vitest]

requires: []
provides:
  - PhotoLightbox reset effect now fires on reopen (open transitioning to true), not only on photo/find change
affects: [PhotoLightbox.tsx consumers in CollectionTab, SpeciesTab]

tech-stack:
  added: []
  patterns:
    - "Lightbox/viewer components that stay mounted while closed must include `open` in reset-on-change useEffect dependency arrays (already established in StagedPhotoViewer.tsx; now consistently applied in PhotoLightbox.tsx)"

key-files:
  created:
    - src/components/finds/PhotoLightbox.test.tsx
  modified:
    - src/components/finds/PhotoLightbox.tsx

key-decisions:
  - "Reset effect dependency array changed from [currentIndex, fallbackFind?.id] to [currentIndex, fallbackFind?.id, open] — matches the sibling StagedPhotoViewer.tsx pattern from the same session"

patterns-established:
  - "PhotoLightbox.test.tsx introduces the mocking conventions (useAppStore, useT, useUpdateFind, useQueryClient, resolvePhotoSrc, LocationPickerMap) for future tests of this component"

requirements-completed: [QUICK-260705-WX6]

duration: 15min
completed: 2026-07-05
---

# Quick Task 260705-wx6: Fix PhotoLightbox zoom/pan not resetting on reopen Summary

**One-line dependency-array fix so PhotoLightbox always reopens a photo at zoom=1/pan={0,0}, instead of preserving stale zoom state from before the dialog was closed.**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-07-05T21:35:00Z (approx)
- **Completed:** 2026-07-05T21:50:33Z
- **Tasks:** 1 completed
- **Files modified:** 2 (1 created, 1 modified)

## Accomplishments
- Root-caused and fixed the reported bug: reopening a photo previewed from Collection/Species tabs showed it zoomed-in instead of full-size, because `PhotoLightbox`'s reset `useEffect` never re-ran on reopen (component stays mounted with `open={false}` rather than unmounting).
- Added `PhotoLightbox.test.tsx` (no prior test file existed for this component) with a RED-first regression test proving the bug, plus a sanity test guarding the pre-existing reset-on-photo-change behavior.
- Verified fix does not affect any other PhotoLightbox behavior (crop, rotate, delete, notes, species cover, fullscreen) — none of those code paths were touched.

## Task Commits

Each task was committed atomically following TDD RED → GREEN:

1. **Task 1 (RED): Add failing regression test** - `227c9d8` (test)
2. **Task 1 (GREEN): Fix reset effect dependency array** - `5817730` (fix)

_Note: this was a TDD task (`tdd="true"`); RED commit added the test proving the bug before any fix, GREEN commit applied the one-line dependency-array change that makes both tests pass._

## Files Created/Modified
- `src/components/finds/PhotoLightbox.tsx` - Reset `useEffect` dependency array changed from `[currentIndex, fallbackFind?.id]` to `[currentIndex, fallbackFind?.id, open]`; updated the adjacent comment to document why `open` is now included. No other lines touched.
- `src/components/finds/PhotoLightbox.test.tsx` - New file. Two tests: (1) zoom persists through a close/reopen cycle on the *same* photo before the fix, reset to 1 after; (2) zoom still resets correctly when `currentIndex` changes (pre-existing behavior, unaffected by the fix).

## TDD Gate Compliance

- RED gate: `227c9d8` — `test(quick-260705-wx6): add failing test for lightbox zoom reset on reopen`. Confirmed failing before the fix (assertion `expected 2.5 to be close to 1` on the reopen scenario); the index-change sanity test passed both before and after, as expected.
- GREEN gate: `5817730` — `fix(quick-260705-wx6): reset lightbox zoom/pan when reopened on same photo`. Both tests pass after the fix.
- REFACTOR gate: not needed — the fix was a single dependency-array edit already matching the target shape called for in the plan; no cleanup pass required.

## Deviations from Plan

None - plan executed exactly as written. The one-line dependency-array change and new test file match the plan's `must_haves` and `<action>` steps precisely (dependency array is exactly `[currentIndex, fallbackFind?.id, open]`).

## Verification

- `npx vitest run src/components/finds/PhotoLightbox.test.tsx` — 2/2 tests pass.
- Full suite `npx vitest run` — 13 pre-existing failures across 5 unrelated files (`CreateFindDialog.test.tsx`, `EditFindDialog.test.tsx`, `FindCard.test.tsx`, `BulkMetadataBar.test.tsx`, `SpeciesTab.test.tsx`) were confirmed present on the base commit (`git stash` + rerun against pre-fix state reproduced the identical 13 failures). None involve `PhotoLightbox` and none were introduced or worsened by this change — out of scope per deviation-rule scope boundary, not touched.
- No unexpected file deletions or leftover untracked files after either commit.

## Self-Check: PASSED

- FOUND: src/components/finds/PhotoLightbox.tsx
- FOUND: src/components/finds/PhotoLightbox.test.tsx
- FOUND commit: 227c9d8
- FOUND commit: 5817730
