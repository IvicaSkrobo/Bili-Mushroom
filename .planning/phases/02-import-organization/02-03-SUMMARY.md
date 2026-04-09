---
phase: 02-import-organization
plan: 03
status: complete
completed: 2026-04-09
tests_added: 14
total_phase_tests: 97
---

# Plan 03 Summary — CollectionTab + FindCard + EditFindDialog

## What Was Built

| Artifact | Description |
|----------|-------------|
| `src/hooks/useFinds.ts` | `useFinds` + `useUpdateFind` TanStack Query hooks |
| `src/hooks/useFinds.test.tsx` | 5 tests: loading, data, disabled, mutation, invalidation |
| `src/components/finds/FindCard.tsx` | Compact card: thumbnail (HEIC branch), species, date, country/region, Edit button |
| `src/components/finds/FindCard.test.tsx` | 5 tests: renders, HEIC placeholder, unnamed, edit trigger, GPS display |
| `src/components/finds/EditFindDialog.tsx` | Dialog: all editable fields, save → useUpdateFind, error Alert, cancel |
| `src/components/finds/EditFindDialog.test.tsx` | 5 tests: pre-fill, save mutation, success close, error stays open, cancel |
| `src/tabs/CollectionTab.tsx` | Full find list, ImportDialog + EditFindDialog wiring, empty/loading/error states |
| `src/tabs/CollectionTab.test.tsx` | 6 tests: empty, 2 finds, import opens, edit opens, loading, error |
| `src-tauri/src/commands/import.rs` | `update_find` command (UpdateFindPayload → DB UPDATE → SELECT → FindRecord) |
| `src/lib/finds.ts` | `updateFind` wrapper + `UpdateFindPayload` interface + `FINDS_QUERY_KEY` const |
| `src/App.tsx` | `QueryClientProvider` wrapping AppShell branch |
| `src/components/import/ImportDialog.tsx` | `qc.invalidateQueries` on import success → CollectionTab auto-refresh |

## Key Decisions

**`update_find` does NOT move the file on disk** — even if country/region/date change, only DB columns are updated. Re-deriving `photo_path` and physically moving the file is deferred to a later phase (file management phase). This avoids race conditions and keeps the command atomic.

**Query key:** `['finds', storagePath]` — invalidated by both `ImportDialog` (on import success) and `EditFindDialog` (via `useUpdateFind.onSuccess`).

**QueryClientProvider scope:** Wraps only the `AppShell` branch in `App.tsx`, not `FirstRunDialog`/`MigrationErrorDialog`. Keeps Phase 1 tests isolated.

## Phase 2 Completion Checklist (vs 02-VALIDATION.md)

| Task | Requirement | Status |
|------|-------------|--------|
| 2-01-01 | IMP-03/04 EXIF parsing | ✅ complete (Plan 01) |
| 2-01-02 | ORG-01/03 path builder | ✅ complete (Plan 01) |
| 2-01-03 | IMP-01/02 DB migration + dupe detect | ✅ complete (Plan 01) |
| 2-02-01 | IMP-05 preview cards | ✅ complete (Plan 02) |
| 2-02-02 | IMP-01/02 ImportDialog picker | ✅ complete (Plan 02) |
| 2-03-01 | IMP-01-05, ORG-01/03/04 CollectionTab | ✅ complete (this plan) |
| 2-03-02 | ORG-04 edit updates DB + refreshes list | ✅ complete (this plan) |

**Requirements covered:** IMP-01 ✅ IMP-02 ✅ IMP-03 ✅ IMP-04 ✅ IMP-05 ✅ ORG-01 ✅ ORG-03 ✅ ORG-04 ✅

## Test Counts

| Layer | Before Plan 03 | After Plan 03 |
|-------|---------------|---------------|
| Vitest (frontend) | 83 | 97 |
| Rust (`cargo test`) | 29 | 31 (+ update_find success + not-found) |

## Deviations

None. All tasks executed as planned.
