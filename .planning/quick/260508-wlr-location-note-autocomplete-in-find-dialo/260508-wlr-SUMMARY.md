---
phase: quick-260508-wlr
plan: 01
subsystem: finds/import-dialogs
tags: [autocomplete, location-note, ux, controlled-input]
dependency_graph:
  requires: []
  provides: [LocationNoteInput component, location_note autocomplete in CreateFindDialog/EditFindDialog/ImportDialog]
  affects: [src/components/finds, src/components/import]
tech_stack:
  added: []
  patterns: [controlled-input with internal localValue state for filter, 150ms blur delay for suggestion click]
key_files:
  created:
    - src/components/finds/LocationNoteInput.tsx
    - src/components/finds/LocationNoteInput.test.tsx
  modified:
    - src/components/finds/CreateFindDialog.tsx
    - src/components/finds/EditFindDialog.tsx
    - src/components/import/ImportDialog.tsx
decisions:
  - "LocationNoteInput uses internal localValue state (not the controlled value prop) to drive the dropdown filter — required because controlled-component tests do not propagate onChange back as a prop update"
  - "Deduplication of suggestions is the parent's responsibility; LocationNoteInput renders whatever filtered set it receives"
  - "EditFindDialog pre-existing test failures (14 tests) are not caused by this plan — sampleFind fixture missing photos field is a prior regression"
metrics:
  duration_minutes: 8
  completed_date: "2026-05-08"
  tasks_completed: 2
  files_changed: 5
---

# Phase quick Plan 260508-wlr: location_note autocomplete in find dialogs Summary

**One-liner:** Reusable LocationNoteInput autocomplete component wired into CreateFindDialog, EditFindDialog, and ImportDialog — suggests previously-used location_note values with case-insensitive dedup filtering.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 (RED) | Failing tests for LocationNoteInput | 9008a02 | LocationNoteInput.test.tsx |
| 1 (GREEN) | Implement LocationNoteInput component | c18bd9b | LocationNoteInput.tsx, LocationNoteInput.test.tsx |
| 2 | Wire into CreateFindDialog, EditFindDialog, ImportDialog | b6d789d | CreateFindDialog.tsx, EditFindDialog.tsx, ImportDialog.tsx |

## What Was Built

**LocationNoteInput** (`src/components/finds/LocationNoteInput.tsx`) — a controlled `<Input>` wrapper with an autocomplete dropdown that:

- Filters the `suggestions` prop by case-insensitive substring match against typed text
- Skips empty/whitespace-only suggestion entries
- Shows max 8 suggestions at a time
- Keyboard nav: ArrowDown/Up navigate, Enter/Tab select, Escape close
- 150ms blur delay so mouseDown on suggestion fires before the blur closes the dropdown
- Internal `localValue` state drives the filter — necessary because controlled-component tests don't propagate `onChange` back as a prop update; external `value` prop synced via `useEffect`

**Parent wiring pattern** (identical in all three dialogs):
```tsx
const locationNoteSuggestions = useMemo(() => {
  if (!findsData) return [];
  const seen = new Set<string>();
  return findsData
    .map((f) => f.location_note ?? '')
    .filter((v) => {
      const trimmed = v.trim();
      if (!trimmed || seen.has(trimmed.toLowerCase())) return false;
      seen.add(trimmed.toLowerCase());
      return true;
    });
}, [findsData]);
```

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] LocationNoteInput used controlled value prop for filtering, breaking test isolation**

- **Found during:** Task 1 GREEN phase
- **Issue:** The plan spec for the component computed `visibleSuggestions` from the `value` prop. In controlled-component tests where `onChange` is a mock (not a state updater), `value` prop never changes after `fireEvent.change`, so the dropdown never opened and tests always failed.
- **Fix:** Added `localValue` internal state initialized from `value` prop; `useEffect` syncs external changes. `visibleSuggestions` and the input `value` use `localValue`. `handleChange` updates both `localValue` and calls `onChange`.
- **Files modified:** `src/components/finds/LocationNoteInput.tsx`
- **Commit:** c18bd9b

## Pre-existing Issues (Out of Scope)

The `EditFindDialog.test.tsx` has 14 pre-existing test failures caused by the `sampleFind` fixture missing the `photos` field (added in a prior task). `find?.photos.length` crashes at render time. These failures existed before this plan (confirmed via git stash verification) and are not caused by any change made here. Logged for future fix.

## Known Stubs

None. All three dialogs are fully wired with live data from `useFinds()`.

## Threat Flags

None. Suggestions are derived from the user's own local SQLite data — no new trust boundary introduced.

## Self-Check: PASSED

- FOUND: src/components/finds/LocationNoteInput.tsx
- FOUND: src/components/finds/LocationNoteInput.test.tsx
- FOUND: commit 9008a02 (test RED)
- FOUND: commit c18bd9b (feat GREEN)
- FOUND: commit b6d789d (feat wiring)
