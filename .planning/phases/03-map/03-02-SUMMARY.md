---
phase: 03-map
plan: 02
subsystem: map-frontend
tags: [map, react-leaflet, leaflet, tiles, tauri, csp, tdd]
dependency_graph:
  requires: []
  provides: [FindsMap, RustProxyTileLayer, leafletIconFix, MapTab-map-foundation]
  affects: [src/tabs/MapTab.tsx, src/components/map/]
tech_stack:
  added: []
  patterns: [GridLayer.extend, useMap+useEffect tile layer attach, TDD red-green]
key_files:
  created:
    - src/components/map/RustProxyTileLayer.ts
    - src/components/map/FindsMap.tsx
    - src/components/map/leafletIconFix.ts
    - src/components/map/RustProxyTileLayer.test.ts
    - src/components/map/FindsMap.test.tsx
    - src/tabs/MapTab.test.tsx
  modified:
    - src/test/setup.ts
    - src/test/tauri-mocks.ts
    - src/index.css
    - src-tauri/tauri.conf.json
    - src/tabs/MapTab.tsx
decisions:
  - RustProxyTileLayer uses L.GridLayer.extend for Leaflet v1 compatibility
  - OsmProxyLayer uses useMap+useEffect for imperative tile layer attachment
  - MapTab shows muted hint when storagePath is null
  - CSP img-src no longer allows https://*.tile.openstreetmap.org
metrics:
  duration_minutes: 8
  completed_date: 2026-04-13
  tasks_completed: 3
  files_created_or_modified: 11
---

# Phase 03 Plan 02: Frontend Map Foundation Summary

**One-liner:** React-leaflet map foundation with RustProxyTileLayer routing tiles through invoke(fetch_tile), Croatia default center [45.1, 15.2] zoom 7, Forest Codex CSS overrides, tightened CSP.

## What Was Built

### Task 1: Test Infrastructure + CSP + Global CSS/Icon Setup

- ResizeObserver stub added to src/test/setup.ts for jsdom react-leaflet support
- 5 new invoke mock handlers in tauri-mocks.ts: fetch_tile, get_tile_cache_stats, clear_tile_cache, set_cache_max, get_cache_max_bytes
- leaflet/dist/leaflet.css already imported in main.tsx (no change needed)
- Created src/components/map/leafletIconFix.ts with L.Icon.Default.mergeOptions patch
- Forest Codex Leaflet CSS overrides appended to src/index.css
- Removed https://*.tile.openstreetmap.org from CSP img-src (D-12 enforced)

### Task 2: RustProxyTileLayer GridLayer Subclass + Unit Tests (TDD)

- src/components/map/RustProxyTileLayer.ts: L.GridLayer.extend with createTile calling invoke(fetch_tile)
- resolveTileUrl exported: handles {z}/{x}/{y}/{s}, including Esri {z}/{y}/{x} order
- 6 unit tests: OSM/subdomain/Esri URL resolution + GridLayer duck-type + invoke call + error forwarding

### Task 3: FindsMap Container + MapTab Integration (TDD)

- src/components/map/FindsMap.tsx: MapContainer at [45.1, 15.2] zoom 7, animate-fade-up wrapper, OsmProxyLayer via useMap+useEffect
- src/tabs/MapTab.tsx: reads storagePath from useAppStore, renders FindsMap full-height or shows muted hint
- 4 unit tests: FindsMap center/zoom + animate-fade-up, MapTab null-hint + renders-map

## Test Results

- New tests added: 10 (all pass)
- Pre-existing failures: 32 (unchanged baseline, not caused by this plan)

## Commits

| Hash | Message |
|------|---------|
| 0dd425a | feat(03-02): test infra + CSP tightening + global CSS/icon setup |
| 48f2819 | test(03-02): add failing tests for RustProxyTileLayer |
| 9bc9cb3 | feat(03-02): implement RustProxyTileLayer GridLayer subclass |
| 40929d4 | test(03-02): add failing tests for FindsMap and MapTab |
| a8960ef | feat(03-02): FindsMap container + MapTab integration with Croatia center |

## Deviations from Plan

None - plan executed exactly as written.

## Known Stubs

The _finds parameter in FindsMap.tsx is intentionally unused (underscore prefix). Plan 03 wires it for pins, clusters, and fitBounds. This does not prevent Plan 02 goal from being achieved.

## Threat Flags

No new security surface beyond what was planned. CSP tightened (T-03-02-02 mitigated). Data URI img src is accepted risk per T-03-02-03.

## Self-Check: PASSED

- src/components/map/RustProxyTileLayer.ts: FOUND
- src/components/map/FindsMap.tsx: FOUND
- src/components/map/leafletIconFix.ts: FOUND
- src/tabs/MapTab.tsx: FOUND (updated)
- Commits 0dd425a, 48f2819, 9bc9cb3, 40929d4, a8960ef: all present
