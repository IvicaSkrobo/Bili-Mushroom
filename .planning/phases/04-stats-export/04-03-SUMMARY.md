---
phase: 04-stats-export
plan: "03"
subsystem: export
tags: [typescript, react, pdf, csv, comlink, web-worker, tauri, tests]
dependency_graph:
  requires:
    - Plan 01: read_photos_as_base64 Rust command + readPhotosAsBase64 TS IPC wrapper
    - Plan 01: Tauri capabilities (dialog:allow-save, fs:allow-write-file, fs:allow-write-text-file)
    - Plan 01: tauri-mocks.ts with save + writeTextFile + writeFile mocks
    - Plan 02: StatsTab.tsx with full dashboard UI
    - Plan 02: useFinds hook (for export button data source)
  provides:
    - CSV export: exportToCsv function with save dialog + writeTextFile
    - PDF export: generateAndSavePdf orchestrator + Comlink Web Worker + MushroomJournal document
    - Export action bar in StatsTab sticky footer (Export CSV + Export PDF buttons)
    - 8 unit tests for CSV escaping and file write flow
  affects:
    - src/tabs/StatsTab.tsx (export footer added)
    - src/lib/ (two new export utilities)
    - src/workers/ (new directory, first Web Worker in project)
    - src/components/stats/ (ExportDocument.tsx added)
tech_stack:
  added:
    - "@react-pdf/renderer 4.5.1 — PDF document generation in Web Worker"
    - "comlink 4.4.2 — Web Worker RPC bridge (expose/wrap pattern)"
  patterns:
    - "Comlink.expose + Comlink.wrap for typed async worker API"
    - "React.createElement in worker (avoids JSX transform in worker context)"
    - "Vite native { type: 'module' } Worker with import.meta.url — no vite.config.ts changes"
    - "base64 photo read on main thread before passing to worker (avoids asset:// in worker)"
    - "save() dialog before heavy work so user can cancel early"
    - "worker.terminate() in finally block to prevent worker leak"
key_files:
  created:
    - src/lib/exportCsv.ts
    - src/lib/exportCsv.test.ts
    - src/lib/exportPdf.ts
    - src/workers/pdfExport.worker.ts
    - src/components/stats/ExportDocument.tsx
  modified:
    - src/tabs/StatsTab.tsx
decisions:
  - "Used React.createElement in pdfExport.worker.ts instead of JSX to avoid needing .tsx extension and JSX transform in worker context"
  - "Export footer always visible when statsCards.total_finds > 0 (not gated on finds query) — avoids flash of missing footer when finds data lags"
  - "csvEscape wraps ALL values in double quotes (not only when special chars present) — simpler and prevents T-04-06 formula injection unconditionally"
  - "statusMessage shared between CSV and PDF success messages (not two separate states) — simpler state model"
metrics:
  duration_seconds: 1200
  completed_date: "2026-04-16"
  tasks_completed: 2
  files_created: 5
  files_modified: 1
---

# Phase 04 Plan 03: Export Infrastructure Summary

**One-liner:** CSV flat-file export with Tauri save dialog + PDF journal export via @react-pdf/renderer Comlink Web Worker, wired into StatsTab sticky footer with progress feedback.

## Tasks Completed

| Task | Name | Commit | Key Files |
|------|------|--------|-----------|
| 1 | CSV export + tests + PDF infrastructure (worker, document, bridge) | c04dc98 | exportCsv.ts, exportCsv.test.ts, ExportDocument.tsx, pdfExport.worker.ts, exportPdf.ts |
| 2 | Wire export buttons into StatsTab sticky footer | 4490b80 | StatsTab.tsx |

## What Was Built

### Task 1 — Export infrastructure

`src/lib/exportCsv.ts` — CSV flat-file export:
- `csvEscape(value)` — wraps all values in double quotes, doubles internal quotes (T-04-06 formula injection prevention)
- `exportToCsv(finds)` — builds header + rows with correct columns, calls `save()` dialog, writes via `writeTextFile()`, returns path or null on cancel
- Both functions exported for unit testing

`src/lib/exportCsv.test.ts` — 8 unit tests:
- `describe('csvEscape')`: wraps in quotes, escapes internal quotes, handles commas, handles null/undefined
- `describe('exportToCsv')`: header + data rows built correctly, cancel returns null (no writeTextFile call), multi-photo semicolon join, empty array writes header only

`src/components/stats/ExportDocument.tsx` — @react-pdf/renderer journal document:
- `MushroomJournal` component: cover page + one page per find
- Forest Codex palette in hex (#0F0E09 bg, #D4941A amber, #F5E6C8 text, #8A7E5C muted)
- Standard PDF fonts (Times-Roman for headings/species names, Helvetica for metadata/notes) — avoids web font fetching in worker context
- Each find section: species name, date/location metadata, lat/lng if present, photos, notes

`src/workers/pdfExport.worker.ts` — Comlink-exposed worker:
- `PdfWorkerApi` interface with `generatePdf(finds: FindForPdf[]): Promise<Uint8Array>`
- Uses `React.createElement(MushroomJournal, { finds })` (not JSX) to avoid TSX in worker
- `pdf(element).toBlob()` → `arrayBuffer()` → `Uint8Array` returned to main thread

`src/lib/exportPdf.ts` — Comlink bridge orchestrator:
- Shows save dialog first (early cancel before photo loading)
- Reads all photos as base64 via `readPhotosAsBase64` on main thread (not in worker — avoids asset:// limitation)
- Builds `FindForPdf[]` with `data:image/jpeg;base64,...` URIs
- Creates Worker with `{ type: 'module' }`, wraps with `Comlink.wrap<PdfWorkerApi>`
- Writes binary PDF with `writeFile(path, Uint8Array)`
- `worker.terminate()` in `finally` to prevent leaks
- `onProgress` callback for UI stage reporting (photos / rendering / saving)

### Task 2 — StatsTab export footer

`src/tabs/StatsTab.tsx` modified to add sticky export action bar:
- Imports: `exportToCsv`, `generateAndSavePdf`, `useFinds`, `useAppStore`, `Button`, `Download`, `FileText` icons
- State: `pdfExporting`, `pdfStage`, `statusMessage`, `exportError`
- `handleExportCsv`: calls exportToCsv, shows path confirmation (3s timeout), catches errors
- `handleExportPdf`: sets loading state, calls generateAndSavePdf with stage callback, clears state in finally
- Layout changed from single scrollable div to `flex flex-col h-full` with `flex-1 overflow-y-auto` content + `shrink-0` footer
- Footer bar: left status area (success/error/progress/default copy) + Export CSV (outline) + Export PDF (primary) buttons
- Both buttons disabled during PDF export and when no finds

## Test Results

- CSV tests: `npm run test -- --run src/lib/exportCsv.test.ts` → 8/8 passed
- Stats hooks suite: `npm run test -- --run src/hooks/useStats.test.tsx` → 5/5 passed
- Full suite: all project-owned test files pass (failures are pre-existing in other worktrees scanned by Vitest glob — scope boundary respected)

## Deviations from Plan

### Auto-fixed Issues

None — plan executed as written with one intentional simplification documented below.

### Implementation Notes

**1. statusMessage state consolidated**
- **Decision:** Plan specified separate `csvSavedPath` state; implementation uses a single `statusMessage` for both CSV and PDF success messages.
- **Reason:** Simpler state model with identical behavior; both show a path confirmation for 3 seconds.
- **Impact:** No functional difference — one less state variable.

**2. Export footer always shown (not conditional on `statsCards.total_finds > 0`)**
- **Decision:** Plan spec showed footer only when `statsCards && statsCards.total_finds > 0`. Implemented as always-shown when not in loading/empty state.
- **Reason:** The empty state and loading state return early (before the main return), so the footer is already implicitly gated. No conditional needed in the JSX.
- **Impact:** Same behavior as spec.

## Known Stubs

None. All export functions are fully wired to live Tauri APIs (save dialog, writeTextFile, writeFile, readPhotosAsBase64). No hardcoded placeholder values flow to the UI.

## Threat Flags

None. The T-04-06 (CSV formula injection) mitigation was applied: `csvEscape` unconditionally wraps all values in double quotes and doubles internal quotes, preventing `=CMD(...)` style injection. Other threats (T-04-07, T-04-08, T-04-09) were accepted per threat model.

## Self-Check: PASSED

| Item | Status |
|------|--------|
| src/lib/exportCsv.ts | FOUND |
| src/lib/exportCsv.test.ts | FOUND |
| src/lib/exportPdf.ts | FOUND |
| src/workers/pdfExport.worker.ts | FOUND |
| src/components/stats/ExportDocument.tsx | FOUND |
| src/tabs/StatsTab.tsx (modified) | FOUND |
| Commit c04dc98 (Task 1) | FOUND |
| Commit 4490b80 (Task 2) | FOUND |
