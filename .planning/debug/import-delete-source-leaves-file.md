---
status: investigating
slug: import-delete-source-leaves-file
trigger: "Fix the import flow so 'Delete from source folder after import' does not leave one source image behind."
created: 2026-05-07
updated: 2026-05-07
---

## Symptoms

- expected: All imported source images deleted from source folder when "Delete from source folder after import" is checked
- actual: One image consistently remains in the source folder after import completes
- errors: No visible error — deletion failure is silently swallowed
- timeline: Ongoing bug, not a regression
- reproduction: Import any folder of photos with deleteSource=true checkbox enabled

## Context

- Platform: Windows-first Tauri 2 + React 18 + Rust
- Frontend import dialog: src/components/import/ImportDialog.tsx
- Rust command: src-tauri/src/commands/import.rs
- Frontend invoke wrapper: src/lib/finds.ts

## Flow Summary

- ImportDialog sends ONE payload: source_path=photos[0], additional_photos=photos.slice(1)
- Rust import_find copies each file into storage, then calls remove_file if delete_source=true
- Both delete calls are best-effort / silent on error (lines ~388-389 and ~461-462)
- Likely cause: photos[0] is previewed in WebView2 and still file-locked when Rust tries to delete it

## Hypotheses

1. PRIMARY: photos[0] (primary source) is held by WebView2 preview while Rust delete runs → remove_file returns sharing violation on Windows → silently ignored
2. SECONDARY: Some other file-locking mechanism (parseExif Rust handle still open)

## Current Focus

- hypothesis: photos[0] is file-locked by WebView2 at delete time, remove_file silently fails
- test: Inspect remove_file return values; check if always photos[0] that remains
- expecting: Error on primary delete, success on additional photos
- next_action: Read Rust import_find delete paths; evaluate backend retry vs trash crate vs frontend unlock approach; implement fix with reporting

## Evidence

## Eliminated

## Resolution

- root_cause:
- fix:
- verification:
- files_changed:
