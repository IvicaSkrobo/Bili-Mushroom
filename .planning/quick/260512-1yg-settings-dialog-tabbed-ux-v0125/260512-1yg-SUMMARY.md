---
phase: quick
plan: 260512-1yg
subsystem: settings-ui
tags: [settings, tabs, i18n, version-bump]
key-files:
  modified:
    - src/components/dialogs/SettingsDialog.tsx
    - src/components/dialogs/SettingsDialog.test.tsx
    - src/i18n/index.ts
    - package.json
    - src-tauri/tauri.conf.json
    - src-tauri/Cargo.toml
decisions:
  - Mock @/components/ui/tabs in jsdom tests — Radix Presence does not mount inactive TabsContent panels; all-visible mock avoids flaky tab-click simulation
metrics:
  completed: "2026-05-12"
  tasks: 2
  files: 6
---

# Quick Task 260512-1yg: Settings Dialog Tabbed UX + v0.1.25

Redesigned SettingsDialog from a single-scroll modal into a compact 3-tab layout (General / Map / Advanced) using the existing shadcn Tabs component; version bumped to 0.1.25.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Add tab i18n keys + bump version | 2d6ef64 | src/i18n/index.ts, package.json, tauri.conf.json, Cargo.toml |
| 2 | Rewrite SettingsDialog with tabbed layout | 798f540 | src/components/dialogs/SettingsDialog.tsx |
| fix | Update SettingsDialog tests | 1404bb6 | src/components/dialogs/SettingsDialog.test.tsx |

## What Was Built

- **General tab**: library path display + Change Folder button, language toggle, theme toggle, version footer (Bili Mushroom v0.1.25)
- **Map tab**: tile cache size display, max cache size input, Clear tile cache AlertDialog — all text via i18n (replaced hardcoded English)
- **Advanced tab**: Reset to First Run button; reset AlertDialog remains outside Tabs (controlled by `resetConfirmOpen` state, unchanged)
- All existing state/handler logic preserved exactly; only JSX structure changed

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] SettingsDialog tests broke after tabbed layout**
- **Found during:** `npm test` after Task 2
- **Issue:** Tests used hardcoded English strings (`'Map Cache'`, `'Clear tile cache'`) and expected content without tab navigation. Radix Presence does not mount inactive `TabsContent` panels in jsdom, so tab-click simulation could not reveal Map tab content.
- **Fix:** Added `vi.mock('@/components/ui/tabs', ...)` to render all tab panels unconditionally in tests; updated text lookups to use i18n key strings (matching the `useT` mock that returns the key); removed tab-click navigation steps.
- **Files modified:** `src/components/dialogs/SettingsDialog.test.tsx`
- **Commit:** 1404bb6

## Self-Check: PASSED

- `src/components/dialogs/SettingsDialog.tsx` — exists
- `src/i18n/index.ts` — 6 `settings.tab*` keys confirmed
- `package.json` version 0.1.25 — confirmed
- `src-tauri/tauri.conf.json` version 0.1.25 — confirmed
- `src-tauri/Cargo.toml` version 0.1.25 — confirmed
- Commits 2d6ef64, 798f540, 1404bb6 — confirmed in git log
- Tag v0.1.25 — confirmed
- Tests: 280 passed, 0 failed
