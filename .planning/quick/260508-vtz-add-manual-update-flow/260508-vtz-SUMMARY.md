---
phase: quick
plan: 260508-vtz
subsystem: settings/updater
tags: [update, settings, ui, tauri]
dependency_graph:
  requires: []
  provides: [manual-update-flow]
  affects: [SettingsDialog]
tech_stack:
  added: []
  patterns: [checkStatus state machine, Tauri guard pattern, dynamic import of tauri-apps/api/core]
key_files:
  created: []
  modified:
    - src/components/dialogs/SettingsDialog.tsx
decisions:
  - Used inline English strings consistent with Map Cache section pattern
  - Type alias declared inside component function (consistent with local scope)
  - Dynamic import of @tauri-apps/api/core inside handlers avoids top-level import failures in non-Tauri dev mode
metrics:
  duration: "5 minutes"
  completed: "2026-05-08"
  tasks_completed: 1
  files_modified: 1
---

# Phase quick Plan 260508-vtz: Manual Update Check UI Summary

Expanded the plain version row in SettingsDialog into a full update check/install panel with all state transitions and Forest Codex aesthetic.

## What Was Built

`SettingsDialog` version section now has: version label row, status feedback line (up-to-date/available/done/error), "Check for updates" button, and conditional "Update now" button when update is available.

State machine: `CheckStatus = 'idle' | 'checking' | 'up-to-date' | 'available' | 'installing' | 'done' | 'error'`

Store's `availableUpdate` (set by startup auto-check) pre-populates `localUpdate` + sets `checkStatus='available'` when dialog opens, so users see the available update without having to manually check.

## Commits

| Task | Commit | Files |
|------|--------|-------|
| Task 1: Replace version row with manual update panel | 7d4b762 | src/components/dialogs/SettingsDialog.tsx |

## Deviations from Plan

None - plan executed exactly as written.

## Known Stubs

None.

## Threat Flags

None - no new network endpoints or auth paths introduced. Tauri IPC calls use existing `check_app_update` / `install_app_update` commands registered in the backend.

## Self-Check: PASSED

- [x] src/components/dialogs/SettingsDialog.tsx modified
- [x] Commit 7d4b762 exists
- [x] `npx tsc --noEmit` passes with no errors
