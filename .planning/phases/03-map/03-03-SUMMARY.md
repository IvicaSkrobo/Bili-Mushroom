---
plan: 03-03
phase: 03-map
subsystem: map-interactive
tags: [map, react-leaflet, pins, clusters, popups, leaflet, tdd]
dependency_graph:
  requires: [03-01, 03-02]
  provides: [FindPins, FindPopup, FitBoundsControl, LayerSwitcher, OnlineStatusBadge, groupFindsByCoords, editingFindId-round-trip]
  affects: [src/components/map/, src/stores/appStore.ts, src/tabs/CollectionTab.tsx]
tech_stack:
  added: []
  patterns: [DivIcon-SVG-pin, cluster-DivIcon-badge, two-level-popup-useState, useEffect-Leaflet-control, useMap-imperative-attach]
key_files:
  created:
    - src/components/map/groupFindsByCoords.ts
    - src/components/map/groupFindsByCoords.test.ts
    - src/components/map/FitBoundsControl.tsx
    - src/components/map/FitBoundsControl.test.tsx
    - src/components/map/FindPopup.tsx
    - src/components/map/FindPopup.test.tsx
    - src/components/map/FindPins.tsx
    - src/components/map/FindPins.test.tsx
    - src/components/map/LayerSwitcher.tsx
    - src/components/map/OnlineStatusBadge.tsx
    - src/components/map/OnlineStatusBadge.test.tsx
  modified:
    - src/stores/appStore.ts
    - src/tabs/CollectionTab.tsx
    - src/components/map/FindsMap.tsx
    - src/components/map/FindsMap.test.tsx
decisions:
  - groupFindsByCoords uses toFixed(6) key — two finds within 0.000001 degrees cluster
  - FitBoundsControl only fires when any find is outside Croatia bbox [42.3-46.6, 13.5-19.5]
  - LayerSwitcher owns OSM layer attachment — removed inline OsmProxyLayer from FindsMap
  - FindPopup img uses alt="" (presentational) — test uses container.querySelector not getByRole
  - CollectionTab useEffect watches editingFindId — finds target, opens EditFindDialog, clears store
metrics:
  duration_minutes: 15
  completed_date: 2026-04-15
  tasks_completed: 3
  files_created_or_modified: 15
---

# Phase 03 Plan 03: Map Pins, Popups, Layers, and Status Summary

**One-liner:** Amber DivIcon find pins with coordinate grouping, two-level species popup (Level 1 list + Level 2 thumbnail+Edit), OSM/Esri layer switcher via Rust proxy, Croatia fitBounds auto-zoom, and online/offline dot.

## What Was Built

### Task 1: groupFindsByCoords + FitBoundsControl + appStore editingFindId

- `groupFindsByCoords.ts`: pure function grouping finds by rounded-6-decimal lat/lng key, insertion-order preserved, null-coord finds excluded
- `FitBoundsControl.tsx`: react-leaflet child that calls `map.fitBounds` with padding [40,40] when any find is outside Croatia bbox
- `appStore.ts`: added `editingFindId: number | null` and `setEditingFindId` — enables map popup Edit button to target a specific find in collection tab
- 9 tests: 6 groupFindsByCoords edge cases + 3 FitBoundsControl scenarios

### Task 2: FindPopup (Level 1 + Level 2) + FindPins (single + cluster)

- `FindPopup.tsx`: Level 1 shows species name (font-serif italic semibold) + date; clicking expands to Level 2 mini card with thumbnail via `convertFileSrc`, species name, and "Edit find" ghost button
- Level 2 Edit button calls `setEditingFindId(id)` + `setActiveTab('collection')` for round-trip
- Level 2 back chevron (ChevronLeft, aria-label="Back to summary") returns to Level 1
- `FindPins.tsx`: renders one Marker per coordinate group; single finds get amber teardrop SVG DivIcon (16x22, anchor [8,22]); clusters get 24px amber circle DivIcon with count badge
- `CollectionTab.tsx`: added `useEffect` watching `editingFindId` — finds the record, opens EditFindDialog, then clears `editingFindId` back to null
- 8 tests: 5 FindPopup + 3 FindPins

### Task 3: LayerSwitcher + OnlineStatusBadge + FindsMap wiring

- `LayerSwitcher.tsx`: attaches `L.control.layers` topright with Street (OSM) + Satellite (Esri World Imagery) base layers, both via `createRustProxyTileLayer`; OSM default on mount; cleans up on unmount
- `OnlineStatusBadge.tsx`: Leaflet Control at bottomleft; green `#4ade80` dot + "Online" / muted dot + "Cached" label; reacts to `window` online/offline events
- `FindsMap.tsx`: replaced inline OsmProxyLayer with declarative children: LayerSwitcher, FindPins, FitBoundsControl, OnlineStatusBadge
- `FindsMap.test.tsx`: updated mocks to stub all 4 child components
- 2 OnlineStatusBadge tests passing

## Test Results

All 31 worktree tests pass:
- groupFindsByCoords: 6/6
- FitBoundsControl: 3/3
- FindPopup: 5/5
- FindPins: 3/3
- OnlineStatusBadge: 2/2
- FindsMap: 2/2
- RustProxyTileLayer: 6/6 (pre-existing)
- LocationPickerMap: 4/4 (pre-existing)

## Commits

| Hash | Message |
|------|---------|
| 36c0bda | feat(03-03): groupFindsByCoords helper + FitBoundsControl + appStore editingFindId |
| 166d4cd | feat(03-03): FindPopup two-level popup + FindPins cluster/single markers |
| 0516321 | feat(03-03): LayerSwitcher + OnlineStatusBadge + wire FindsMap children |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed presentational img role in FindPopup test**
- **Found during:** Task 2 (GREEN phase test run)
- **Issue:** Plan's prescribed test used `getByRole('img', { hidden: true })` but `<img alt="">` has ARIA role `presentation`, not `img` — Testing Library could not find it
- **Fix:** Updated test to use `container.querySelector('img')` to assert on src attribute directly
- **Files modified:** `src/components/map/FindPopup.test.tsx`
- **Commit:** 166d4cd

## Known Stubs

None. All components are fully wired to live data.

## Threat Flags

No new security surface beyond the plan's threat model. All three mitigations from the threat register are implemented:
- T-03-03-01: JSX auto-escapes species_name and date_found — no dangerouslySetInnerHTML used
- T-03-03-03: Cluster DivIcon interpolates only a `count: number` — no user input in HTML string

## Self-Check: PASSED
