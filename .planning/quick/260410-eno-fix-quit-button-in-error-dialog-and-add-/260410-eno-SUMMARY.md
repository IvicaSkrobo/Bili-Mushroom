---
phase: quick
plan: 260410-eno
subsystem: ui
tags: [bug-fix, ux, tauri-api, import]
key_files:
  modified:
    - src/App.tsx
    - src/components/import/ImportDialog.tsx
decisions:
  - Use getCurrentWindow().close() from @tauri-apps/api/window instead of window.close() for Tauri window close
metrics:
  duration: ~5 min
  completed: 2026-04-10
  tasks: 2
  files: 2
---

# Quick 260410-eno: Fix Quit Button and Add Clear All Summary

**One-liner:** Replaced broken `window.close()` with Tauri IPC `getCurrentWindow().close()` and added a conditional "Clear All" ghost button to the import picker.

## Tasks Completed

| Task | Description | Commit |
|------|-------------|--------|
| 1 | Fix Quit button in error dialog — `getCurrentWindow().close()` via Tauri IPC | 6e024bd |
| 2 | Add Clear All button to ImportDialog picker row | 6e024bd |

## Changes

**src/App.tsx**
- Added `import { getCurrentWindow } from '@tauri-apps/api/window'`
- Changed `handleQuit` from `window.close()` to `getCurrentWindow().close()`

**src/components/import/ImportDialog.tsx**
- Added Clear All button inside the picker `div` (after Pick Folder)
- Button: `variant="ghost"`, `className="ml-auto text-destructive"`, conditional on `pending.length > 0`, disabled during `importing`, calls `setPending([])`

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check: PASSED

- `src/App.tsx` modified: FOUND
- `src/components/import/ImportDialog.tsx` modified: FOUND
- Commit 6e024bd: FOUND
- `npx tsc --noEmit`: no errors
