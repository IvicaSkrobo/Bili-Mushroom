---
phase: quick
plan: 260705-wdb
subsystem: ui
tags: [react, radix-ui, tauri, import, lightbox, zoom]

requires: []
provides:
  - "StagedPhotoViewer component: self-contained zoom/pan lightbox for staged (not-yet-saved) import photos"
  - "ImportDialog thumbnail-click-to-preview wiring"
affects: [import, photo-viewing]

tech-stack:
  added: []
  patterns:
    - "Staged (pre-save) photo preview reuses PhotoLightbox's zoom/pan/keyboard-nav state machine but as a smaller, storage-independent component driven only by raw path strings + convertFileSrc"

key-files:
  created:
    - src/components/import/StagedPhotoViewer.tsx
    - src/components/import/StagedPhotoViewer.test.tsx
  modified:
    - src/components/import/ImportDialog.tsx
    - src/components/import/ImportDialog.test.tsx
    - src/i18n/index.ts

key-decisions:
  - "StagedPhotoViewer takes no dependency on storagePath/Find/FindPhoto/TanStack Query — purely presentational, driven by photos: string[] prop, since staged photos aren't persisted yet"
  - "Reused existing lightbox.* i18n keys (zoomIn/zoomOut/resetZoom/prev/next/close/photoCount) instead of duplicating; only added import.viewPhoto as a new key"

requirements-completed: []

duration: 45min
completed: 2026-07-05
---

# Phase quick Plan 260705-wdb: Staged Photo Zoom/Lightbox Summary

**Added a self-contained zoom/pan lightbox (`StagedPhotoViewer`) for unsaved import photos, wired to thumbnail clicks in `ImportDialog`, so foragers can inspect gill/cap/stem detail before committing an import.**

## Performance

- **Duration:** 45 min
- **Started:** 2026-07-05T22:48:00Z (approx, pre-task read/context)
- **Completed:** 2026-07-05T21:33:19Z
- **Tasks:** 2 completed
- **Files modified:** 5 (2 created, 3 modified)

## Accomplishments

- New `StagedPhotoViewer` component: Radix Dialog-based cinematic lightbox matching the existing `PhotoLightbox.tsx` Forest Codex treatment (dark overlay, translucent circular icon buttons), supporting scroll-to-zoom (clamped 1x-5x), double-click zoom toggle (1x/2.5x), drag-to-pan, zoom in/out buttons, prev/next navigation, and Escape/X to close.
- Wired into `ImportDialog.tsx`: clicking any staged thumbnail opens the viewer at that photo's index; the existing remove (X) button still works and no longer also opens the viewer (event propagation stopped).
- Full TDD cycle (RED then GREEN) for both tasks, each independently verified failing before implementation.

## Task Commits

Each task was committed atomically (TDD: test then feat commits):

1. **Task 1: Create StagedPhotoViewer component with zoom/pan/navigation**
   - `c732f81` (test) - add failing tests for StagedPhotoViewer
   - `fe65598` (feat) - implement StagedPhotoViewer zoom/pan lightbox
2. **Task 2: Wire StagedPhotoViewer into ImportDialog thumbnail grid**
   - `731916e` (test) - add failing tests for StagedPhotoViewer wiring
   - `47553d6` (feat) - wire StagedPhotoViewer into import thumbnail grid

_Note: RED phase for each task was independently verified by reverting the corresponding implementation file and confirming the new tests failed, then reapplying and confirming GREEN, before committing._

## Files Created/Modified

- `src/components/import/StagedPhotoViewer.tsx` - New lightbox component: zoom/pan/prev-next/keyboard-nav, driven by `photos: string[]` + `convertFileSrc`, no DB/storagePath dependency.
- `src/components/import/StagedPhotoViewer.test.tsx` - 15 Vitest tests covering open/close, zoom clamping, double-click toggle, prev/next bounds, keyboard nav, zoom-reset-on-index-change, and zoom buttons.
- `src/components/import/ImportDialog.tsx` - Added `viewerOpen`/`viewerIndex` state; thumbnail click opens viewer at index; remove (X) button `stopPropagation()`; renders `<StagedPhotoViewer>` alongside `<LocationPickerMap>`.
- `src/components/import/ImportDialog.test.tsx` - Added a lightweight `StagedPhotoViewer` mock plus 3 new tests (opens at correct index, remove button doesn't open viewer, metadata unaffected by open/close).
- `src/i18n/index.ts` - Added `import.viewPhoto` key in both `hr` ("Pregledaj fotografiju") and `en` ("View photo") blocks.

## Decisions Made

- Followed the plan's explicit instruction to build a new, simpler component rather than reusing `PhotoLightbox` directly, since that component is tightly coupled to saved `Find`/`FindPhoto` records, `storagePath` resolution, and edit/delete/species-cover mutations that don't apply to staged (pre-save) photos.
- Reused existing `lightbox.*` i18n keys directly in the new component (as instructed) instead of duplicating translation strings.

## Deviations from Plan

None - plan executed exactly as written.

### Out-of-scope discoveries (not fixed, logged per Scope Boundary rule)

While running the full test suite to confirm no regressions, 5 pre-existing test files were found failing independent of this plan's changes (`SpeciesTab.test.tsx`, `CreateFindDialog.test.tsx`, `EditFindDialog.test.tsx`, `FindCard.test.tsx`, `BulkMetadataBar.test.tsx` — 13 tests total, mostly date-formatting/locale and `SpeciesNameEditor` contentEditable query issues). Verified these failures exist identically at the pre-plan base commit (`cb9000e`), confirming they are unrelated to `StagedPhotoViewer`/`ImportDialog` changes. Left untouched per the Scope Boundary rule (fixes limited to files directly touched by the current task).

## Issues Encountered

None blocking. TypeScript compiles cleanly (`npx tsc --noEmit`) and the full plan verification command (`npx vitest run src/components/import/StagedPhotoViewer.test.tsx src/components/import/ImportDialog.test.tsx`) passes with 36/36 tests green.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Feature is complete and self-contained; no follow-up work required for this task.
- The 5 pre-existing failing test files noted above are recommended for a future maintenance/quick task to investigate (likely date-locale or `SpeciesNameEditor` mock/query changes unrelated to this plan).

---
*Phase: quick*
*Completed: 2026-07-05*

## Self-Check: PASSED

All created files verified present; all 4 task commits (c732f81, fe65598, 731916e, 47553d6) verified present in git log.
