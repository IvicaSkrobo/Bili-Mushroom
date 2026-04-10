# Quick Task: Auto-import existing species folders when storage path is set

## Goal
When a user picks their storage folder (first run or folder change), automatically scan
its immediate subfolders, treat each subfolder name as `species_name`, find all image
files inside, parse EXIF, and import them into the DB — skipping already-imported files.
Show a progress dialog during the scan, then a summary when done.

## Tasks

### T1: Add `pendingScan` to appStore
File: `src/stores/appStore.ts`
- Add `pendingScan: boolean` (default false) + `setPendingScan: (v: boolean) => void`

### T2: Create `src/lib/autoImport.ts`
- `scanAndImport(storagePath, onProgress)` → `AutoImportResult`
- Read immediate subfolders of storagePath (skip dotfiles)
- For each subfolder: readDir, filter image extensions, parseExif, build ImportPayload[]
- Default date to today when EXIF has none
- Call importFind() per species, accumulate imported/skipped counts

### T3: Add i18n strings
File: `src/i18n/index.ts`
- Add `autoImport.*` keys to both hr and en

### T4: Create `src/components/dialogs/AutoImportDialog.tsx`
- Runs scanAndImport on mount
- Shows progress bar + current species name while running
- Shows result summary (species count, imported, skipped) when done
- "Done" button calls onDone(); "Skip" button available while running (cancels by calling onDone immediately)

### T5: Wire into App.tsx
- Read `pendingScan` + `setPendingScan` from store
- `FirstRunDialog.onFolderSelected` → also call `setPendingScan(true)` before `setStoragePath`
- When `dbReady && pendingScan`: render `<AutoImportDialog storagePath={storagePath} onDone={() => setPendingScan(false)} />` wrapped in QueryClientProvider instead of AppShell

### T6: Wire into SettingsDialog
- Call `setPendingScan(true)` before `setDbReady(true)` in `handleChangeFolder`

## Commit
Single atomic commit: `feat: auto-import species folders on storage path selection`
