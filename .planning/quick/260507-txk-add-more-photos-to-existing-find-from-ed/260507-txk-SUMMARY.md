---
phase: quick
plan: 260507-txk
subsystem: finds
tags: [rust, tauri, react, ui, file-io]
dependency_graph:
  requires: []
  provides: [add_find_photos Tauri command, useAddFindPhotos hook, EditFindDialog add-photos flow]
  affects: [src-tauri/src/commands/finds.rs, src-tauri/src/lib.rs, src/lib/finds.ts, src/hooks/useFinds.ts, src/components/finds/EditFindDialog.tsx]
tech_stack:
  added: []
  patterns: [TanStack Query useMutation, Tauri file copy + SQLite insert, tauri-plugin-dialog open]
key_files:
  created: []
  modified:
    - src-tauri/src/commands/finds.rs
    - src-tauri/src/lib.rs
    - src/lib/finds.ts
    - src/hooks/useFinds.ts
    - src/components/finds/EditFindDialog.tsx
decisions:
  - Used find's first existing photo parent directory as dest_folder, with build_dest_path fallback when no photos exist yet
  - Photos are always copied (never moved) — source files are untouched
  - is_primary always false for added photos; primary photo never reassigned
  - pendingPhotos resets on find change and on successful add
metrics:
  duration: ~12 min
  completed: "2026-05-07T19:43:57Z"
  tasks: 2
  files_modified: 5
---

# Quick 260507-txk: Add More Photos to Existing Find from EditFindDialog

**One-liner:** New `add_find_photos` Tauri command copies source photos into find's species folder with sequential numbering, wired to a file-picker + preview UI in EditFindDialog.

## What Was Built

### Task 1: Rust command + frontend wiring

**`add_find_photos` Rust command** (`src-tauri/src/commands/finds.rs`):
- Queries the find record for species_name, date_found, location_note
- Derives dest_folder from the first existing photo's parent directory; falls back to `build_dest_path`-derived folder when no photos exist
- For each source path: gets extension, calls `next_seq_for_folder` + `build_dest_path`, copies file, inserts DB row via `insert_find_photo` with `is_primary=false`
- Re-queries full FindRecord + photos and returns it
- Registered in `lib.rs` `generate_handler![]`

**`addFindPhotos` wrapper** (`src/lib/finds.ts`): `invoke<Find>('add_find_photos', { storagePath, findId, sourcePaths })`

**`useAddFindPhotos` hook** (`src/hooks/useFinds.ts`): follows `useUpdateFind` pattern, invalidates `[FINDS_QUERY_KEY, storagePath]` on success.

### Task 2: EditFindDialog UI

- Imports: `open as openDialog` from tauri-plugin-dialog, `ImagePlus` + `X` from lucide-react, `SUPPORTED_EXTENSIONS`, `useAddFindPhotos`
- State: `addPhotosMutation`, `pendingPhotos: string[]`
- `pendingPhotos` resets when `find` prop changes
- `handlePickPhotos`: opens native file picker filtered to image extensions; sets pendingPhotos
- `handleAddPhotos`: triggers mutation; clears pendingPhotos on success; dialog stays open
- UI: "Add photos" ghost button with ImagePlus icon added to action button row; preview section (count, filename list, dismiss X, confirmation button) shown when pendingPhotos.length > 0; `addPhotosMutation.isError` alert displayed inline
- Styling follows Forest Codex: dark card bg (`bg-card/50`), muted borders (`border-border/60`), DM Sans body text

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check: PASSED

| Item | Status |
|------|--------|
| src-tauri/src/commands/finds.rs | FOUND |
| src/lib/finds.ts | FOUND |
| src/hooks/useFinds.ts | FOUND |
| src/components/finds/EditFindDialog.tsx | FOUND |
| Commit 27ca574 (Task 1) | FOUND |
| Commit 544e19a (Task 2) | FOUND |
