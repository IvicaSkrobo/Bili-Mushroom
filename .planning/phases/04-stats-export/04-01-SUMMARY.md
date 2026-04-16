---
phase: 04-stats-export
plan: "01"
subsystem: stats-data-layer
tags: [rust, sqlite, typescript, tanstack-query, ipc, tests, security]
dependency_graph:
  requires: []
  provides:
    - stats Rust commands (get_stats_cards, get_top_spots, get_best_months, get_calendar, get_species_stats, read_photos_as_base64)
    - TypeScript IPC wrappers in src/lib/stats.ts
    - TanStack Query hooks in src/hooks/useStats.ts
    - Test mocks for stats + export in src/test/tauri-mocks.ts
  affects:
    - src-tauri/src/commands/ (new stats.rs module)
    - src-tauri/src/lib.rs (invoke_handler extended)
    - src-tauri/capabilities/default.json (export permissions added)
    - src/test/tauri-mocks.ts (stat + dialog + fs mocks added)
tech_stack:
  added: []
  patterns:
    - rusqlite query_map + collect pattern for all stat aggregations
    - tokio::runtime::Runtime::new().block_on() for sync test wrappers
    - TanStack Query useQuery with enabled: !!storagePath guard (disabled when no storage)
    - invokeHandlers dispatch table override for per-test mock control
key_files:
  created:
    - src-tauri/src/commands/stats.rs
    - src/lib/stats.ts
    - src/hooks/useStats.ts
    - src/hooks/useStats.test.tsx
  modified:
    - src-tauri/src/commands/mod.rs
    - src-tauri/src/lib.rs
    - src-tauri/capabilities/default.json
    - src/test/tauri-mocks.ts
decisions:
  - "T-04-01 mitigation applied: read_photos_as_base64 validates that no photo_path component contains '..' before constructing absolute path, rejecting with descriptive error if found"
  - "Rust tests use direct synchronous DB queries (not async command wrappers) to avoid tokio runtime nesting complexity"
  - "5 Rust tests (including 1 security test for path traversal) + 5 TS hook tests"
metrics:
  duration_seconds: 333
  completed_date: "2026-04-16"
  tasks_completed: 2
  files_created: 4
  files_modified: 4
---

# Phase 04 Plan 01: Stats Data Layer Summary

**One-liner:** Six Rust SQLite aggregation commands + matching TS IPC wrappers + five TanStack Query hooks with path-traversal security mitigation.

## Tasks Completed

| Task | Name | Commit | Key Files |
|------|------|--------|-----------|
| 1 | Rust stat commands + capabilities + invoke_handler | 9d90da7 | stats.rs, mod.rs, lib.rs, default.json |
| 2 | TypeScript types, IPC wrappers, TQ hooks, test mocks, hook tests | 172d756 | stats.ts, useStats.ts, tauri-mocks.ts, useStats.test.tsx |

## What Was Built

### Task 1 — Rust stat aggregation commands

`src-tauri/src/commands/stats.rs` implements six `#[tauri::command]` async functions:

- `get_stats_cards` — aggregate totals: total_finds, unique_species, locations_visited, most_active_month
- `get_top_spots` — GROUP BY country+region+location_note ORDER BY count DESC LIMIT 10
- `get_best_months` — GROUP BY strftime('%m') with integer cast for 1-12 month_num
- `get_calendar` — all finds ordered by month ASC, date_found ASC for seasonal view
- `get_species_stats` — per-species aggregation with two sub-queries per species (best_month + locations)
- `read_photos_as_base64` — reads photo files as base64 for export, with path traversal guard

All commands follow the established `open_db(&storage_path)?` pattern from `import.rs`.

Six commands registered in `invoke_handler` in `lib.rs`. `pub mod stats` added to `commands/mod.rs`.

Capabilities: `dialog:allow-save`, `fs:allow-write-text-file`, `fs:allow-write-file` added to `default.json` for Plan 03 (export).

### Task 2 — TypeScript data layer

`src/lib/stats.ts`: 6 interfaces mirroring Rust structs exactly (snake_case), 5 query key constants, 6 `invoke<T>()` wrappers.

`src/hooks/useStats.ts`: 5 TanStack Query hooks (`useStatsCards`, `useTopSpots`, `useBestMonths`, `useCalendar`, `useSpeciesStats`) following `useFinds()` pattern with `enabled: !!storagePath`.

`src/test/tauri-mocks.ts` extended with:
- 6 stat command handlers in `invokeHandlers`
- `save` added to `@tauri-apps/plugin-dialog` mock
- `writeTextFile` and `writeFile` added to `@tauri-apps/plugin-fs` mock

`src/hooks/useStats.test.tsx`: 5 tests across 4 describe blocks covering data fetch, disabled state, calendar entries, species stats with locations, and top spots ranking.

## Test Results

- Rust: `cargo test stats` → 6/6 passed (5 aggregation tests + 1 path traversal security test)
- TS hooks: `npm run test -- --run src/hooks/useStats.test.tsx` → 5/5 passed
- Full suite: 143 passing (40 pre-existing failures in unrelated test files — unchanged)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Security] Applied T-04-01 path traversal mitigation**
- **Found during:** Task 1 (threat model review)
- **Issue:** Threat model assigned `mitigate` disposition to T-04-01 (read_photos_as_base64 path construction). Plan action text described the command without the guard.
- **Fix:** Added `if rel.contains("..") { return Err(...) }` check before constructing absolute path in `read_photos_as_base64`. Added dedicated security test `test_read_photos_as_base64_rejects_path_traversal`.
- **Files modified:** src-tauri/src/commands/stats.rs
- **Commit:** 9d90da7

**2. [Rule 1 - Bug] Removed unused import warnings**
- **Found during:** Task 1 (cargo test output)
- **Issue:** `make_find_record` and `insert_find_row` were imported but unused in stats.rs tests (tests use direct SQL instead of the higher-level helpers).
- **Fix:** Removed the two unused imports, kept only `setup_in_memory_db`.
- **Files modified:** src-tauri/src/commands/stats.rs
- **Commit:** 9d90da7 (pre-commit fix)

## Known Stubs

None. No UI components in this plan — pure data layer. No hardcoded empty values flow to rendering.

## Threat Flags

None. All new surface is either read-only SQLite aggregation (T-04-03 accepted) or read-only filesystem access with path traversal mitigation applied (T-04-01 mitigated).

## Self-Check: PASSED

| Item | Status |
|------|--------|
| src-tauri/src/commands/stats.rs | FOUND |
| src/lib/stats.ts | FOUND |
| src/hooks/useStats.ts | FOUND |
| src/hooks/useStats.test.tsx | FOUND |
| .planning/phases/04-stats-export/04-01-SUMMARY.md | FOUND |
| Commit 9d90da7 (Task 1) | FOUND |
| Commit 172d756 (Task 2) | FOUND |
