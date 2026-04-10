---
phase: quick
plan: 260410-ew8
subsystem: import-ui
tags: [import, map, offline, location, ui]
one_liner: "Shared name+location header in ImportDialog cascading to all cards, offline-capable OSM tile map with locate-me button, lat/lng inputs replaced by map-only picker"
key_files:
  modified:
    - src/components/import/ImportDialog.tsx
    - src/components/import/FindPreviewCard.tsx
    - src/components/map/LocationPickerMap.tsx
    - src/components/map/LocationPickerMap.test.tsx
    - src/components/import/FindPreviewCard.test.tsx
    - src/components/import/ImportDialog.test.tsx
    - src-tauri/tauri.conf.json
    - package.json
  created:
    - src-tauri/Entitlements.plist
decisions:
  - "leaflet.offline@3.2.1 used for IndexedDB tile caching — caches on first online use, serves cached tiles offline; uncached areas show grey but map remains interactive"
  - "OfflineTileLayer implemented as useMap() inner component (imperative addTo) since leaflet.offline has no react-leaflet wrapper"
  - "sharedName cascade uses useEffect on [sharedName] — only fires when non-empty so clearing shared field does not blank individually-set names"
  - "Folder picker pre-fills sharedName from last path segment; file picker does not (no single folder context)"
metrics:
  completed_date: "2026-04-10"
  tasks_completed: 4
  files_changed: 9
---

# Quick Task 260410-ew8: Shared Name/Location Header in ImportDialog

## What Was Done

Reduced repetitive data entry when importing multiple photos from the same foraging trip.

### Task 1: Shared name+location header in ImportDialog

- Added `sharedName`, `sharedLocation`, and `sharedMapOpen` state to ImportDialog
- Shared header renders above the card list when pending items exist: a name input + map pick button + coordinate display
- `useEffect` on `sharedName` cascades the value to all pending cards' `species_name` (only when non-empty)
- `handleSharedMapConfirm` sets `sharedLocation` and cascades `lat`/`lng` to all pending cards immediately
- `handlePickFolder` now extracts the last path segment and sets `sharedName` — so picking `/photos/Lisičarka` pre-fills "Lisičarka" for all cards
- Individual cards retain their own name/location inputs for per-card overrides

### Task 2: Remove lat/lng text inputs from FindPreviewCard

- Deleted `handleLatChange` and `handleLngChange` functions
- Replaced the three-column lat/lng/map-button row with a single `Button` that shows "Set location" when empty or `"45.1000, 13.9000"` (green tint) when coordinates are set
- `LocationPickerMap` per-card picker retained for individual overrides
- Tests updated to assert absence of Latitude/Longitude placeholders and presence of map picker button

### Task 3: Offline-capable map with locate-me button (LocationPickerMap)

- Installed `leaflet.offline@3.2.1`
- Replaced `<TileLayer>` with `<OfflineTileLayer>` — an inner component using `useMap()` that adds `tileLayerOffline(...)` imperatively; tiles cached in IndexedDB on first load, served from cache when offline
- Default center: Croatia `[45.1, 15.2]` at zoom 7 — shows the whole country; user can pan/zoom anywhere
- Added `<LocateMeButton>` inner component: crosshair icon in top-right, uses `navigator.geolocation.getCurrentPosition`, flies map to position and places pin; shows toast on error
- LocationPickerMap test mocks updated to include `useMap` and `leaflet.offline`

### Task 4: macOS location entitlement

- `tauri.conf.json`: added `bundle.macOS` with `entitlements` path and `NSLocationWhenInUseUsageDescription`
- `tauri.conf.json`: updated CSP `img-src` to include `https://*.tile.openstreetmap.org` for online tile loading
- Created `src-tauri/Entitlements.plist` with location, app-sandbox, and network.client entitlements

## Deviations from Plan

None — plan executed exactly as written. The offline map approach was adjusted mid-task when the user clarified they want the map to work offline (view Croatia without GPS/internet), which was already the intended implementation using `leaflet.offline`.

## Commits

- `28311fd` — feat(260410-ew8): shared name/location header, offline map tiles, locate-me button
- `d7de597` — feat(260410-ew8): remove lat/lng inputs from cards, add macOS entitlements

## Self-Check: PASSED

- `src/components/import/ImportDialog.tsx` — exists, shared header implemented
- `src/components/import/FindPreviewCard.tsx` — exists, lat/lng inputs removed
- `src/components/map/LocationPickerMap.tsx` — exists, offline tiles + locate-me
- `src-tauri/Entitlements.plist` — exists
- All 116 tests passing (1 pre-existing integration test failure unrelated to these changes)
