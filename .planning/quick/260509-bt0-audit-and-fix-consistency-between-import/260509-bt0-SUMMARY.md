---
phase: quick
plan: 260509-bt0
subsystem: import-flow, create-flow, species-metadata
tags: [consistency, cleanup, dead-code, species-metadata, import, create-find]
dependency_graph:
  requires: [quick-260509-1u6]
  provides: [consistent-species-metadata-across-all-creation-paths, clean-import-module]
  affects: [ImportDialog, CreateFindDialog, species-profiles]
tech_stack:
  added: []
  patterns: [species-profile-upsert-on-create, separate-find-vs-species-notes]
key_files:
  created: []
  modified:
    - src/components/import/ImportDialog.tsx
    - src/components/finds/CreateFindDialog.tsx
    - src/components/import/ImportDialog.test.tsx
  deleted:
    - src/components/import/FindPreviewCard.tsx
    - src/components/import/FindPreviewCard.test.tsx
decisions:
  - "ImportDialog: species notes (sharedFolderNotes) and find notes (sharedFindNotes) are now semantically distinct fields wired to separate DB destinations"
  - "CreateFindDialog now matches ImportDialog and FolderEditDialog for species metadata fields (edibility, protected status)"
  - "FindPreviewCard was dead code — ImportDialog redesigned to single-find inline flow; deleted to reduce maintenance surface"
  - "ImportDialog.test.tsx deleteSource expectation corrected to true (component default); sampleSummary extended with delete_failures:[] to match ImportSummary type"
metrics:
  duration: "~12 minutes"
  completed: "2026-05-09"
  tasks_completed: 3
  files_changed: 5
---

# Phase quick Plan 260509-bt0: Import/Create Flow Consistency Summary

**One-liner:** Separated find-level notes from species notes in ImportDialog, added edibility/protected-status dropdowns to CreateFindDialog, and deleted dead FindPreviewCard code with full test cleanup.

## What Was Done

Three targeted consistency fixes across the find creation paths:

### Task 1 — Separate find-level notes from species notes in ImportDialog (8c258a1)

ImportDialog was conflating two semantically different text fields into one `sharedFolderNotes` state:
- Species description (general, saved to `species_notes` table via `upsertSpeciesNote`)
- Find-level observations (per-find, saved to `finds.notes` column)

Fix: Added `sharedFindNotes` state and a second Textarea labeled "Notes about this specific find...". The payload now correctly passes `sharedFindNotes.trim()` to `notes`, while `sharedFolderNotes` continues to flow to `upsertSpeciesNote`.

### Task 2 — Add edibility and protected status to CreateFindDialog (16d3527)

CreateFindDialog had no species metadata fields while ImportDialog and FolderEditDialog both offered edibility and protected-status selects. Fix:
- Imported `EDIBILITY_VALUES`, `EDIBILITY_LABELS`, `PROTECTED_STATUS_VALUES`, `PROTECTED_STATUS_LABELS` from `speciesMetadata.ts`
- Added `useSpeciesProfiles` and `useUpsertSpeciesProfile` hooks
- Added `edibility` and `protectedStatus` state (both default `'unknown'`)
- Pre-fills from existing species profile when species name changes (same pattern as ImportDialog)
- Resets to `'unknown'` when dialog opens
- Upserts species profile on save when either value is not `'unknown'`
- Two `<select>` dropdowns in `grid-cols-2` layout matching FolderEditDialog styling

### Task 3 — Remove dead FindPreviewCard and fix stale tests (700f448)

`FindPreviewCard.tsx` was dead code — ImportDialog was redesigned to a single-find inline flow with photo thumbnails, never rendering `FindPreviewCard`. Deleted both the component and its test file.

Fixed `ImportDialog.test.tsx` — 10 stale tests were referencing old FindPreviewCard behavior:
- `'Species name'` placeholder → `'Mushroom name'` (actual ImportDialog shared input)
- `'remove from list'` buttons → `'Remove photo'` (photo thumbnail X buttons)
- `'pick on map'` button text content check → span text content check for coordinates
- Added `delete_failures: []` to `sampleSummary` (was missing from `ImportSummary` type)
- Fixed `deleteSource: false` → `deleteSource: true` (component default is true)

## Test Results

| Suite | Before | After |
|-------|--------|-------|
| ImportDialog.test.tsx (worktree) | 5/15 pass | 15/15 pass |
| CreateFindDialog.test.tsx (worktree) | 22/22 pass | 22/22 pass |
| CollectionTab.test.tsx (worktree) | 8/11 pass | 8/11 pass (3 pre-existing failures unchanged) |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] sampleSummary missing delete_failures field**
- **Found during:** Task 3 test fixing
- **Issue:** `sampleSummary` in `ImportDialog.test.tsx` didn't include `delete_failures: []`, causing `PostImportReviewDialog` to throw `TypeError: Cannot read properties of undefined (reading 'length')` when the dialog opened during tests
- **Fix:** Added `delete_failures: []` to `sampleSummary` to match `ImportSummary` type
- **Files modified:** `src/components/import/ImportDialog.test.tsx`
- **Commit:** 700f448

**2. [Rule 1 - Bug] deleteSource test expectation wrong**
- **Found during:** Task 3 test fixing
- **Issue:** Test expected `deleteSource: false` but the component defaults `deleteSource` to `true` (the "Delete from source folder" checkbox is checked by default)
- **Fix:** Changed expectation to `deleteSource: true`
- **Files modified:** `src/components/import/ImportDialog.test.tsx`
- **Commit:** 700f448

## Known Stubs

None — all data flows are properly wired.

## Threat Flags

None — no new network endpoints, auth paths, or trust boundary changes.

## Self-Check

- [x] `src/components/import/ImportDialog.tsx` — modified, Task 1 changes present (sharedFindNotes state + textarea + payload wiring)
- [x] `src/components/finds/CreateFindDialog.tsx` — modified, Task 2 changes present (edibility/protectedStatus state + dropdowns + upsert on save)
- [x] `src/components/import/FindPreviewCard.tsx` — deleted
- [x] `src/components/import/FindPreviewCard.test.tsx` — deleted
- [x] `src/components/import/ImportDialog.test.tsx` — updated, 15/15 tests pass
- [x] Commits: 8c258a1, 16d3527, 700f448 — all exist in git log

## Self-Check: PASSED
