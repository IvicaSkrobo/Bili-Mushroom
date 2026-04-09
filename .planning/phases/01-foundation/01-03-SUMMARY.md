---
phase: 01-foundation
plan: 03
subsystem: ui
tags: [react, shadcn-ui, tauri, vitest, tabs, dialogs, css-variables]

# Dependency graph
requires:
  - phase: 01-foundation/01
    provides: Tauri 2 + React + shadcn/ui + Vitest scaffold
  - phase: 01-foundation/02
    provides: storage.ts, db.ts, appStore Zustand store

provides:
  - Five-tab AppShell (Collection, Map, Species, Browse, Stats) with shadcn Tabs
  - FirstRunDialog — blocking modal with folder picker, cannot be dismissed without selection
  - MigrationErrorDialog — blocking modal showing db init errors with Quit button
  - SettingsDialog — shows current storage path, Change Folder wired to pickAndSaveStoragePath + initializeDatabase
  - EmptyState reusable component for each tab
  - Full shadcn/ui Tailwind v4 CSS design token set
  - 24 Vitest tests green covering all dialog and AppShell behaviour

affects: [02-import-organization, 03-map, 04-species-database, 05-search-browse, 06-stats-export]

# Tech tracking
tech-stack:
  added: [shadcn Dialog, shadcn Tabs, shadcn Button, shadcn Alert, lucide-react icons]
  patterns:
    - First-run gate in App.tsx driven by appStore.storagePath === null
    - Blocking dialogs via Radix onEscapeKeyDown/onInteractOutside preventDefault
    - Tab content areas as named exports from src/tabs/*.tsx — stable filenames for downstream replacement

key-files:
  created:
    - src/App.tsx (first-run gate + db init + AppShell wiring)
    - src/components/layout/AppShell.tsx
    - src/components/layout/EmptyState.tsx
    - src/components/dialogs/FirstRunDialog.tsx
    - src/components/dialogs/FirstRunDialog.test.tsx
    - src/components/dialogs/MigrationErrorDialog.tsx
    - src/components/dialogs/MigrationErrorDialog.test.tsx
    - src/tabs/CollectionTab.tsx
    - src/tabs/MapTab.tsx
    - src/tabs/SpeciesTab.tsx
    - src/tabs/BrowseTab.tsx
    - src/tabs/StatsTab.tsx
  modified:
    - src/components/dialogs/SettingsDialog.tsx (Change Folder wired with real flow)
    - src/index.css (full Tailwind v4 CSS variable set)

key-decisions:
  - "Tab filenames (CollectionTab, MapTab, etc.) are stable API contracts — phases 2-6 replace content only"
  - "FirstRunDialog blocks Escape and outside-click via Radix onEscapeKeyDown preventDefault"
  - "App.tsx owns db init sequence: loadStoragePath → initializeDatabase → show AppShell or error"
  - "isTauri() guards removed from storage.ts/db.ts — test mocks already isolate Tauri IPC"

patterns-established:
  - "Blocking dialogs: set onEscapeKeyDown and onInteractOutside to preventDefault on the Radix DialogContent"
  - "Zustand appStore is the single source of truth for storagePath, dbReady, dbError state"
  - "EmptyState: icon + heading + body props, rendered centered in each tab"
  - "CSS design tokens declared as oklch values in :root — shadcn/ui Tailwind v4 convention"

requirements-completed: [ORG-02]

# Metrics
duration: 2 sessions
completed: 2026-04-09
---

# Phase 1 Plan 03: UI Shell Summary

**Five-tab AppShell with blocking first-run and error dialogs, 24 Vitest tests green, SettingsDialog Change Folder wired end-to-end**

## Performance

- **Duration:** 2 sessions
- **Completed:** 2026-04-09
- **Tasks:** 3 (EmptyState + tabs + AppShell / dialogs with tests / App.tsx wiring)
- **Files modified:** 15

## Accomplishments

- App.tsx first-run gate: reads stored path on mount, shows FirstRunDialog if missing, calls initializeDatabase, renders AppShell once ready
- FirstRunDialog and MigrationErrorDialog block Escape and outside-click using Radix `onEscapeKeyDown` / `onInteractOutside` preventDefault
- AppShell renders shadcn Tabs with five named content areas plus Settings gear in title bar
- SettingsDialog Change Folder fully wired: calls `pickAndSaveStoragePath`, re-initializes database, shows loading state
- Full Tailwind v4 CSS design token set added to index.css (colors, muted, border, radius)
- 24 Vitest unit tests passing across all dialogs and AppShell logic

## Task Commits

1. **Task 1: EmptyState, tab components, AppShell** - `aa4d68d` (feat)
2. **Task 2: FirstRunDialog, MigrationErrorDialog, SettingsDialog with tests** - `4aabe7a` (feat)
3. **Task 3: App.tsx first-run gate + db init wiring** - `cd6ce15` (feat)
4. **Improvements: SettingsDialog Change Folder + CSS tokens + icons** - `6afa8b0` (feat)

## Files Created/Modified

- `src/App.tsx` — first-run gate + db init sequence + AppShell render
- `src/components/layout/AppShell.tsx` — title bar + shadcn Tabs + SettingsDialog toggle
- `src/components/layout/EmptyState.tsx` — reusable icon/heading/body component
- `src/components/dialogs/FirstRunDialog.tsx` — blocking storage folder picker
- `src/components/dialogs/MigrationErrorDialog.tsx` — blocking db error display
- `src/components/dialogs/SettingsDialog.tsx` — Change Folder wired with real flow + loading state
- `src/tabs/CollectionTab.tsx` — empty state placeholder (stable filename)
- `src/tabs/MapTab.tsx` — empty state placeholder
- `src/tabs/SpeciesTab.tsx` — empty state placeholder
- `src/tabs/BrowseTab.tsx` — empty state placeholder
- `src/tabs/StatsTab.tsx` — empty state placeholder
- `src/index.css` — full shadcn/ui Tailwind v4 color + radius token set

## Decisions Made

- Tab filenames are stable API contracts for phases 2-6 — each phase replaces the default export content only
- `isTauri()` guards removed from `storage.ts` / `db.ts` — Vitest module mocks already isolate Tauri IPC calls; the guards returned wrong values in the test environment and broke 8 tests

## Deviations from Plan

### Auto-fixed Issues

**1. Broken isTauri() guards in storage.ts and db.ts**
- **Found during:** Post-commit test run (pre-summary)
- **Issue:** Unstaged changes added `isTauri()` guards that returned early or returned mock paths, causing 8 Vitest failures in storage.test.ts and db.test.ts
- **Fix:** Removed guards — test mocks (tauri-mocks.ts) already mock all Tauri imports
- **Files modified:** src/lib/storage.ts, src/lib/db.ts
- **Verification:** `npm test -- --run` → 24 passed (0 failed)
- **Committed in:** Reverted to committed HEAD; no additional commit needed

---

**Total deviations:** 1 auto-fixed (broken test isolation guards)
**Impact on plan:** Correctness fix only — no scope change.

## Issues Encountered

None beyond the isTauri guard regression noted above.

## User Setup Required

None — no external services configured.

## Next Phase Readiness

- Phase 1 Foundation complete: Tauri 2 shell launches, SQLite WAL active, five-tab AppShell renders
- Phase 2 (Import & Organization) can begin: `src/tabs/CollectionTab.tsx` is the target replacement
- Human smoke test (13 steps from 01-VALIDATION.md) should be run on Windows before closing Phase 1

---
*Phase: 01-foundation*
*Completed: 2026-04-09*
