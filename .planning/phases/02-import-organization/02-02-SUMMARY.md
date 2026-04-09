---
phase: 02-import-organization
plan: "02"
subsystem: react-import-ui
tags: [react, tauri, import, exif, dialog, shadcn, vitest]
dependency_graph:
  requires: [02-01]
  provides: [ImportDialog, FindPreviewCard, useImportProgress, finds.ts]
  affects: [02-03]
tech_stack:
  added: [sonner 2.x (toast), @tauri-apps/plugin-fs 2.x, shadcn Card/Input/Progress/Textarea/Badge]
  patterns: [TDD red-green, mockIPC dispatch table, Tauri event mock with unlisten cleanup]
key_files:
  created:
    - src/lib/finds.ts
    - src/lib/finds.test.ts
    - src/lib/db.integration.test.ts
    - src/components/ui/card.tsx
    - src/components/ui/input.tsx
    - src/components/ui/progress.tsx
    - src/components/ui/textarea.tsx
    - src/components/ui/badge.tsx
    - src/components/import/FindPreviewCard.tsx
    - src/components/import/FindPreviewCard.test.tsx
    - src/components/import/useImportProgress.ts
    - src/components/import/useImportProgress.test.tsx
    - src/components/import/ImportDialog.tsx
    - src/components/import/ImportDialog.test.tsx
  modified:
    - src/test/tauri-mocks.ts
    - src/tabs/CollectionTab.tsx
    - src/App.tsx
    - package.json
decisions:
  - "Folder enumeration uses readDir (JS-side) + SUPPORTED_EXTENSIONS filter — no Rust list_images command needed"
  - "invokeHandlers dispatch table in tauri-mocks enables per-test handler overrides without vi.resetModules"
  - "isHeic() branches on extension lowercase match (.heic/.heif) as specified; no img tag rendered for HEIC"
  - "shadcn CLI wrote to @/components/ui/ literal path — moved to src/components/ui/ manually (Rule 3 auto-fix)"
metrics:
  duration_seconds: 600
  completed_date: "2026-04-09"
  tasks_completed: 3
  files_changed: 18
---

# Phase 02 Plan 02: React Import UI Summary

**One-liner:** React import dialog with EXIF pre-fill, editable preview cards, HEIC placeholder, progress tracking via Tauri event, and 41 new Vitest tests (65 total green).

## What Was Built

### Task 1 — finds.ts wrappers + shadcn components + extended mocks + A5 integration test

**`src/lib/finds.ts`**
- Defines `ExifData`, `ImportPayload`, `Find`, `ImportSummary`, `ImportProgress` interfaces mirroring the Plan 01 Rust structs
- Exports `parseExif(path)`, `importFind(storagePath, payloads)`, `getFinds(storagePath)` wrappers using `invoke` from `@tauri-apps/api/core`
- Exports `SUPPORTED_EXTENSIONS` const and `isHeic(filename)` helper

**`src/test/tauri-mocks.ts` (extended)**
- Added `invokeHandlers` dispatch table — tests mutate handlers per-test without `vi.resetModules`
- Added `@tauri-apps/api/event` mock with `listen`/`unlisten` stub and `listenCallbacks`/`emitMockEvent` helpers
- Added `@tauri-apps/plugin-fs` mock with `readDir` stub

**`src/lib/db.integration.test.ts`**
- Skipped by default (`describe.skipIf(!process.env.TAURI_INTEGRATION)`)
- Documents manual path: set `TAURI_INTEGRATION=1 TAURI_DB_PATH=<path>` to run against a real launched DB
- Leading comment block explains Plan 01 Task 2's Rust test is the authoritative A5 guard

**Shadcn components added:** Card, Input, Progress, Textarea, Badge

**New tests:** 15 (finds.test.ts)

### Task 2 — FindPreviewCard + useImportProgress hook

**`src/components/import/FindPreviewCard.tsx`**
- Props: `{ payload, sourcePath, onChange, onRemove }`
- Thumbnail: `isHeic()` branch → muted div with lucide `Image` icon + "HEIC preview not supported" text; else `<img src={convertFileSrc(sourcePath)} />`
- Editable fields: species (Input), date (Input type="date" with "Date required before import" warning when empty), country, region, lat, lng (numeric, null on empty), notes (Textarea 2 rows)
- Remove button (lucide X) calls `onRemove`
- Uses shadcn Card/CardContent layout, 2-column grid

**`src/components/import/useImportProgress.ts`**
- `useImportProgress(enabled: boolean): ImportProgress | null`
- When `enabled` is true: subscribes via `listen('import-progress', ...)`, returns current payload
- Cleanup: `unlistenPromise.then(fn => fn())` called on unmount or when `enabled` flips false
- Resets progress to null when `enabled` becomes false

**New tests:** 13 (FindPreviewCard 8, useImportProgress 5)

### Task 3 — ImportDialog wiring

**`src/components/import/ImportDialog.tsx`**
- Props: `{ open, onOpenChange }`
- State: `pending: PendingItem[]`, `importing: boolean`, `error: string | null`
- "Pick Photos": `openDialog({ multiple: true, filters })` → for each path, `parseExif(path)` → builds initial payload → appends to `pending`
- "Pick Folder": `openDialog({ directory: true })` → `readDir(dir)` → JS-side SUPPORTED_EXTENSIONS filter → same EXIF pre-fill loop
- Preview list: `pending.map((item, i) => <FindPreviewCard ... onChange={(p) => updateAt(i, p)} onRemove={() => removeAt(i)} />)`
- Import All: disabled when `pending.length === 0` OR any `date_found === ''` OR `importing`; calls `importFind(storagePath, payloads)`
- Progress: `useImportProgress(importing)` → when truthy renders shadcn `<Progress>` + `current/total · filename` text
- Error: `<Alert variant="destructive">` above footer (does not close dialog)
- Completion: `toast.success(...)`, `setPending([])`, `onOpenChange(false)`

**`src/tabs/CollectionTab.tsx` (temporary scaffold)**
- Added "Import Photos" `<Button>` + local `importOpen` state toggle above EmptyState
- Plan 03 will replace this entire tab with the full find list view

**`src/App.tsx`**
- Added `<Toaster richColors />` from sonner for toast rendering

**New tests:** 13 (ImportDialog)

## How Dialog Wires Together

```
CollectionTab (Import Photos button)
  └── ImportDialog (open state)
        ├── openDialog (plugin-dialog) → file/folder paths
        ├── parseExif (finds.ts → Rust parse_exif) → ExifData
        ├── FindPreviewCard[] (editable, state owned by ImportDialog)
        ├── useImportProgress(importing) (listens to import-progress Tauri event)
        ├── importFind (finds.ts → Rust import_find) → ImportSummary
        └── toast.success / error Alert
```

## Confirmation: CollectionTab Scaffold

`src/tabs/CollectionTab.tsx` now renders an "Import Photos" button that opens the ImportDialog. This enables manual end-to-end smoke testing after Plan 02. Plan 03 replaces the tab entirely with a find list view.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] shadcn CLI wrote components to wrong path**
- **Found during:** Task 1, after running `npx shadcn@latest add card input progress textarea badge`
- **Issue:** CLI resolved the `@/components/ui` alias literally and created `./@ /components/ui/*.tsx` instead of `src/components/ui/`
- **Fix:** Manually `cp` each file to `src/components/ui/`, then `rm -rf "@/"` directory
- **Files modified:** src/components/ui/{card,input,progress,textarea,badge}.tsx
- **Commit:** baf10e8

## Known Stubs

None — ImportDialog, FindPreviewCard, and finds.ts are fully wired to Rust commands. No hardcoded empty values flow to UI rendering.

## Threat Flags

None — no new network endpoints. All file I/O and DB writes are Rust-side only. `readDir` from `@tauri-apps/plugin-fs` operates within user-selected directories already covered by existing `fs:allow-read-dir` capability.

## Self-Check: PASSED
