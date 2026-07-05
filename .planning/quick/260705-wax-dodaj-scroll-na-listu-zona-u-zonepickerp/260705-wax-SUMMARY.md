---
phase: quick
plan: 260705-wax
subsystem: ui
tags: [react, tailwind, leaflet, map, zone-picker]
provides:
  - Scrollable zone list inside ZonePickerPopup when many zones overlap at one map point
affects: [map]
tech-stack:
  added: []
  patterns: []
key-files:
  created: []
  modified: [src/components/map/ZoneLayers.tsx]
key-decisions: []
requirements-completed: [QUICK-260705-WAX]
duration: 5min
completed: 2026-07-05
---

# Quick Task 260705-wax: Scroll for Zone Picker List Summary

**Bounded the ZonePickerPopup's inner zone list to `max-h-[240px]` with `overflow-y-auto` so overlapping-zone lists scroll instead of growing past the map viewport.**

## Performance

- **Duration:** ~5 min
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments
- ZonePickerPopup's inner list div now caps at 240px height and scrolls vertically when more zones overlap than fit
- Outer wrapper's `overflow-hidden` (rounded corners) preserved unchanged

## Task Commits

1. **Task 1: Add max-height + scroll to ZonePickerPopup's zone list** - `6187573` (fix)

## Files Created/Modified
- `src/components/map/ZoneLayers.tsx` - `ZonePickerPopup` inner list div className changed from `flex flex-col gap-1 px-2 pb-2 pt-1.5` to `flex max-h-[240px] flex-col gap-1 overflow-y-auto px-2 pb-2 pt-1.5`

## Decisions Made
None - followed plan as specified.

## Deviations from Plan
None - plan executed exactly as written.

## Issues Encountered
None. `npm run build` (tsc + vite build) passed with no errors on first attempt.

## Next Phase Readiness
No follow-up needed; change is isolated and verified via full production build.

---
*Phase: quick*
*Completed: 2026-07-05*

## Self-Check: PASSED
- FOUND: src/components/map/ZoneLayers.tsx
- FOUND: .planning/quick/260705-wax-dodaj-scroll-na-listu-zona-u-zonepickerp/260705-wax-SUMMARY.md
- FOUND: commit 6187573
- FOUND: `max-h-[240px] overflow-y-auto` present in inner list div className
