# Phase 2: Import & Organization - Context

**Gathered:** 2026-04-09
**Status:** Ready for planning
**Mode:** Smart discuss (autonomous) — all proposals accepted

<domain>
## Phase Boundary

Users can get their mushroom photos into the app with metadata correctly detected and files organized on disk.

Phase 2 owns: import UI (CollectionTab), EXIF parsing (Rust), file copy+rename (Rust), DB record creation, metadata preview + editing before confirm.

Phase 2 does NOT own: interactive map picker (Phase 3), species DB lookup (Phase 4), search/filter (Phase 5).

</domain>

<decisions>
## Implementation Decisions

### 1. Database Schema
`finds` table with columns: `id INTEGER PRIMARY KEY`, `photo_path TEXT` (relative path within StorageRoot), `original_filename TEXT`, `species_name TEXT`, `date_found TEXT` (ISO date), `country TEXT`, `region TEXT`, `lat REAL`, `lng REAL`, `notes TEXT`, `created_at TEXT`.

### 2. EXIF Parsing
Rust Tauri command `parse_exif` using `kamadak-exif` crate (already in CLAUDE.md stack). Returns `{ date: Option<String>, lat: Option<f64>, lng: Option<f64> }`. Applied per-file before preview.

### 3. Import UI Flow
CollectionTab shows "Import Photos" button → `tauri-plugin-dialog` file/folder picker → scrollable preview list (one card per photo, all fields editable inline) → "Import All" confirm button. Single-screen — no wizard steps.

### 4. Location Input (No GPS)
Text fields in the preview card: Country + Region (free text) + optional Lat + Lng (numeric). Map picker deferred to Phase 3 when the full Leaflet component exists.

### 5. File Organization Path
`<StorageRoot>/<Country>/<Region>/<YYYY-MM-DD>/<species>_<YYYY-MM-DD>_<seq><ext>`
Falls back to `unknown_country/unknown_region` if location is empty. Sequence number resets per folder per day.

### 6. Duplicate Detection
By `original_filename` + `date_found` match in the `finds` table. Duplicates are silently skipped; a count of skipped files is shown in the completion toast.

### 7. Rust vs JS for File Copy
Single Rust Tauri command `import_find(payload)` — reads EXIF, resolves path, copies + renames file, inserts DB row atomically. Avoids IPC round-trips per file.

### 8. Batch Progress
Sequential processing in Rust; progress emitted to frontend via `tauri::Window::emit("import-progress", { current, total, filename })`. No parallelism in Phase 2.

### 9. Species Name at Import
Free-text input in preview card. No species DB lookup (Phase 4). Stored as-is in `finds.species_name`.

</decisions>

<code_context>
## Existing Code Insights

**From Phase 1:**
- `src/stores/appStore.ts` — `useAppStore` with `storagePath`, `activeTab`, `setActiveTab`
- `src/lib/db.ts` — `getDatabase(storageFolderPath)`, `initializeDatabase`, `DatabaseInitError`
- `src/lib/storage.ts` — `loadStoragePath`, `pickAndSaveStoragePath`
- `src/tabs/CollectionTab.tsx` — currently an EmptyState placeholder; Phase 2 replaces its content
- `src-tauri/migrations/0001_initial.sql` — WAL + app_metadata; Phase 2 adds migration `0002_finds.sql`
- Tauri plugins already wired: `tauri-plugin-sql`, `tauri-plugin-store`, `tauri-plugin-dialog`, `tauri-plugin-fs`
- `kamadak-exif` must be added to `src-tauri/Cargo.toml`

**Pattern from Phase 1:** heavy I/O lives in Rust Tauri commands; React calls via `invoke()`.

</code_context>

<specifics>
## Specific Ideas

- Manual location entry is the primary UX; EXIF GPS auto-populates as a convenience (user's stated preference)
- Preview cards should show: thumbnail, species name (editable), date (editable, pre-filled from EXIF/filename), country (editable), region (editable), lat/lng (editable, pre-filled from EXIF)
- "Import All" button runs sequentially, shows progress bar with filename + N/total counter
- After import, CollectionTab shows the imported finds as a card list (Phase 2 also owns the basic find list view)
- ORG-04: each find card has an edit button that opens an inline edit form or dialog

</specifics>

<deferred>
## Deferred Ideas

- Map-based location picker (Phase 3)
- Species autocomplete from built-in DB (Phase 4)
- Parallel/chunked import for large batches (v2)
- File hash-based duplicate detection (v2)
- Move/copy prompt when changing storage folder (noted in SettingsDialog TODO)

</deferred>
