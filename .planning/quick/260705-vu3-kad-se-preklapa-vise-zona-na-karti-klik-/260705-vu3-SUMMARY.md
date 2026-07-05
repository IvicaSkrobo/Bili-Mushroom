---
phase: quick-260705-vu3
plan: 01
subsystem: ui
tags: [react-leaflet, zones, map, i18n]

# Dependency graph
requires:
  - phase: 260507-map-zone-ux-pass
    provides: region/local polygon zone drawing/editing and Zone data model
provides:
  - zonesContainingPoint helper in src/lib/zones.ts for multi-zone hit-testing
  - on-map zone picker popup in ZoneLayers.tsx for overlapping zone clicks
affects: [map-zone-ux, zone-editing]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Hit-test all displayZones on click via zonesContainingPoint before deciding single-open vs picker popup"
    - "Standalone react-leaflet <Popup> (not bound to a shape) driven by local component state, keyed by lat-lng to force remount on new click positions"

key-files:
  created: []
  modified:
    - src/lib/zones.ts
    - src/lib/zones.test.ts
    - src/components/map/ZoneLayers.tsx
    - src/i18n/index.ts

key-decisions:
  - "zonesContainingPoint does not filter by zone_type (unlike findContainingRegionZone) — checks all zones passed in, matching the plan's picker use case"
  - "Picker popup styling mirrors CollectionPins.tsx conventions verbatim (rounded-lg bg-background shadow-xl ring-1 ring-border/30, font-sans) rather than introducing new visual language"

patterns-established:
  - "Multi-match hit-testing on map shape clicks uses local state + keyed standalone Popup, not per-shape bound popups"

requirements-completed: [VU3-01]

# Metrics
duration: 25min
completed: 2026-07-05
---

# Quick Task 260705-vu3: Zone Overlap Click Picker Summary

**On-map popup lets users choose which zone to open when a map click hits 2+ overlapping region/local zones, instead of silently opening whichever shape is topmost in the Leaflet SVG stack.**

## Performance

- **Duration:** 25 min
- **Started:** 2026-07-05T20:38:00Z
- **Completed:** 2026-07-05T21:02:45Z
- **Tasks:** 2 completed
- **Files modified:** 4

## Accomplishments
- Added `zonesContainingPoint(zones, lat, lng)` to `src/lib/zones.ts`, reusing the existing private `isPointInsideZone`/`zoneFootprint` helpers with no duplicated point-in-shape math; returns all matching zones sorted smallest-footprint-first (same convention as `findContainingRegionZone`).
- 14 passing unit tests covering 0/1/2+ match cases and confirming the helper does not filter by `zone_type`.
- `ZoneLayers.tsx` Circle and Polygon click handlers now hit-test `displayZones` on every click; 0-1 matches preserve the exact prior behavior (`onEditZone` called directly), 2+ matches open a Forest-Codex-styled `<Popup>` zone picker.
- New `ZonePickerPopup` component lists each matching zone with its accent-colored left border (`#D4512A` local / `#2D8C7C` region), species name via `renderSpeciesName`, and a `zone.local`/`zone.region` type label; clicking a row opens that zone's editor and closes the picker.
- Added `map.zonePickerTitle` i18n key to both `hr` and `en` blocks, following the existing `map.zoneCreate*` placement/naming convention.

## Task Commits

Each task was committed atomically:

1. **Task 1: Add zonesContainingPoint helper to src/lib/zones.ts with unit test** - `0cbaced` (test)
2. **Task 2: Add on-map zone picker popup to ZoneLayers.tsx and i18n keys** - `b89b705` (feat)

_Note: a repo-local pre-commit hook auto-bumps the app version (package.json, Cargo.toml, tauri.conf.json, etc.) on every commit; this is pre-existing repository behavior unrelated to this plan's scope and was not otherwise modified._

## Files Created/Modified
- `src/lib/zones.ts` - Added exported `zonesContainingPoint(zones, lat, lng): Zone[]` near `findContainingRegionZone`
- `src/lib/zones.test.ts` - Added `describe('zonesContainingPoint', ...)` block with a circle zone fixture and 4 tests (2+ match ordering, single match, no match, mixed zone_type)
- `src/components/map/ZoneLayers.tsx` - Added `pickerState` local state, hit-test branching in both Circle and Polygon click handlers, standalone keyed `<Popup>`, and new `ZonePickerPopup` component
- `src/i18n/index.ts` - Added `map.zonePickerTitle` key to `hr` and `en` blocks under the `// map — storage / zone alerts` comment group

## Decisions Made
- Followed the plan's interface spec exactly: reused `isPointInsideZone`/`zoneFootprint` privately, did not duplicate point-in-shape math, and did not add new local/region label i18n keys (reused existing `zone.local`/`zone.region`).
- Picker popup visual treatment reuses `CollectionPins.tsx` conventions verbatim per the `frontend-design` skill check required by CLAUDE.md and the plan's context note — no new styling language introduced for this small, infrequently-seen picker.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None. A pre-existing pre-commit hook in this repository bumps the semantic version on every commit (visible as modifications to `package.json`, `Cargo.toml`, `tauri.conf.json`, etc. in each task commit) — this is standard repository behavior unrelated to this task and was left as-is per the hook's normal operation.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- The zone picker is code-complete and passes `npm run build` (tsc + vite build, zero type errors) and `npx vitest run src/lib/zones.test.ts` (14/14 passing).
- Manual verification (running `npm run tauri dev`, switching to "all" view mode, clicking overlapping region/local zones, confirming the picker lists both and opens the correct editor) is deferred to the user per the plan's scope — out of scope for this quick task to launch the dev app.
- No blockers for future map/zone work.

---
*Phase: quick-260705-vu3*
*Completed: 2026-07-05*

## Self-Check: PASSED

- FOUND: src/lib/zones.ts
- FOUND: src/lib/zones.test.ts
- FOUND: src/components/map/ZoneLayers.tsx
- FOUND: src/i18n/index.ts
- FOUND: .planning/quick/260705-vu3-kad-se-preklapa-vise-zona-na-karti-klik-/260705-vu3-SUMMARY.md
- FOUND commit: 0cbaced
- FOUND commit: b89b705
