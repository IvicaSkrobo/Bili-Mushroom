---
phase: quick
plan: 260508-wwb
subsystem: finds/photos
tags: [rust, sqlite, react, tauri, photo-management, delete]
dependency_graph:
  requires: [260507-txk]
  provides: [per-photo-delete, bulk-photo-delete, photo-primary-promotion]
  affects: [EditFindDialog, PhotoLightbox, CollectionTab]
tech_stack:
  added: []
  patterns:
    - Rust delete + primary-promotion: delete row, check is_primary, if true and others remain UPDATE lowest-id to is_primary=1
    - Rust bulk delete: collect any_primary_deleted flag across loop, promote once after all deletes
    - TanStack Query invalidation pattern: both delete hooks invalidate [FINDS_QUERY_KEY, storagePath]
    - Photo grid UX: click toggles selection (Set<number>), hover X for single delete when nothing selected, checkbox indicator when selected
key_files:
  created: []
  modified:
    - src-tauri/src/commands/finds.rs
    - src-tauri/src/lib.rs
    - src/lib/finds.ts
    - src/hooks/useFinds.ts
    - src/test/tauri-mocks.ts
    - src/components/finds/EditFindDialog.tsx
    - src/components/finds/EditFindDialog.test.tsx
    - src/components/finds/PhotoLightbox.tsx
    - src/tabs/CollectionTab.tsx
decisions:
  - Use std::fs::remove_file (not trash::delete) for per-photo delete — individual photo deletion is explicit, not undo-able via recycle bin; consistent with the delete_file=bool parameter pattern
  - Photo grid positioned between form fields and action buttons (not below) so it's visible without scrolling in typical 2-4 photo finds
  - Single X button hidden until hover (selectedPhotoIds.size === 0 guard) — avoids accidental deletion when in multi-select mode
metrics:
  duration: "~25 min"
  completed: "2026-05-08"
  tasks: 3
  files: 9
---

# Phase quick Plan 260508-wwb: Per-Photo Management Summary

## One-liner

Single and bulk photo delete with Rust primary-promotion, 4-col grid in EditFindDialog, and rose-toned delete button in PhotoLightbox.

## What Was Built

Two new Tauri commands (`delete_find_photo`, `bulk_delete_find_photos`) with primary-promotion logic, matching TS wrappers and React hooks, a 4-column existing-photo grid in EditFindDialog with hover-X single delete and checkbox multi-select bulk delete, and a rose-toned Delete photo button in PhotoLightbox's metadata panel.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Rust commands — delete_find_photo + bulk_delete_find_photos | 90bbd0b | finds.rs, lib.rs |
| 2 | TS wrappers + hooks + tauri-mocks | da38a71 | finds.ts, useFinds.ts, tauri-mocks.ts, EditFindDialog.test.tsx |
| 3 | UI — photo grid in EditFindDialog + delete button in PhotoLightbox | 5369395 | EditFindDialog.tsx, PhotoLightbox.tsx, CollectionTab.tsx |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed EditFindDialog.test.tsx sampleFind missing required Find fields**
- **Found during:** Task 2 verification
- **Issue:** sampleFind in the test was created before `photos`, `location_note`, `observed_count_min/max`, `is_favorite` were added to the Find interface. Component crashed at `find?.photos.length` — optional chaining on `find` but direct `.length` on potentially-undefined `photos`.
- **Fix:** Added `photos: []`, `location_note: ''`, `observed_count`, `observed_count_min`, `observed_count_max`, `is_favorite` to sampleFind. Removed stale `photo_path` field.
- **Files modified:** src/components/finds/EditFindDialog.test.tsx
- **Commit:** da38a71

**2. [Rule 2 - Missing] Used std::fs::remove_file instead of trash::delete for per-photo deletes**
- **Found during:** Task 1 design
- **Rationale:** Per the plan constraints, `delete_find_photo` and `bulk_delete_find_photos` must also delete the file from disk using `std::fs::remove_file`. This is correct for explicit photo management where the user intends permanent deletion, not a recycle-bin move.
- **Behavior:** Errors are logged but not surfaced (file may already be gone); NotFound errors are silently ignored.

## Pre-existing Test Failures (not caused by this plan)

Two EditFindDialog tests (`pre-fills species_name from find`, `calls update_find via mutation and closes dialog on success`) fail because `SpeciesNameEditor` renders a custom input that `getByDisplayValue()` cannot locate. These were failing before this plan (7 total failures pre-plan vs 4 post-plan — my sampleFind fix resolved 3 others). Deferred to a future test maintenance task.

## Verification

- `cargo test -p bili-mushroom --lib -- commands::finds::tests`: 12 passed, 0 failed (includes 4 new photo-delete tests)
- `npx vitest run src/components/finds/`: 90 passed, 4 pre-existing failures (SpeciesNameEditor display value)
- Manual: EditFindDialog photo grid shows 4-col thumbnails with hover X + primary badge; bulk select + "Delete N selected" functional; Add photos unchanged
- Manual: PhotoLightbox metadata panel shows rose-toned "Delete photo" button when opened from CollectionTab

## Self-Check: PASSED

All key files exist:
- src/components/finds/EditFindDialog.tsx — FOUND
- src/components/finds/PhotoLightbox.tsx — FOUND
- src/tabs/CollectionTab.tsx — FOUND
- src/lib/finds.ts — FOUND
- src/hooks/useFinds.ts — FOUND

All task commits verified:
- 90bbd0b: Rust commands
- da38a71: TS wrappers + hooks
- 5369395: UI changes
