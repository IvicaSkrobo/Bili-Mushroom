---
phase: quick
plan: 260415-li5
subsystem: collection-ui, map
tags: [folder-edit, bulk-update, reverse-geocode, tile-layers, opentopomap]
dependency_graph:
  requires: []
  provides:
    - FolderEditDialog (species folder bulk-edit dialog)
    - pencil icon on CollectionTab folder headers
    - EditFindDialog reverse geocode after map pick
    - OpenTopoMap layer in LayerSwitcher + LocationPickerMap
  affects:
    - src/tabs/CollectionTab.tsx
    - src/components/finds/FolderEditDialog.tsx
    - src/components/finds/EditFindDialog.tsx
    - src/components/map/LayerSwitcher.tsx
    - src/components/map/LocationPickerMap.tsx
    - src-tauri/src/commands/tile_proxy.rs
tech_stack:
  added: []
  patterns:
    - reverseGeocode called in onConfirm async callback (same as FindPreviewCard pattern)
    - PickerLayerSwitcher replaces single RustProxyOsmLayer in LocationPickerMap
    - useAppStore.getState() used outside React hook context for lang in EditFindDialog callback
key_files:
  created:
    - src/components/finds/FolderEditDialog.tsx
  modified:
    - src/tabs/CollectionTab.tsx
    - src/components/finds/EditFindDialog.tsx
    - src/components/map/LayerSwitcher.tsx
    - src/components/map/LocationPickerMap.tsx
    - src-tauri/src/commands/tile_proxy.rs
decisions:
  - Native <input type="checkbox"> used in FolderEditDialog instead of shadcn Checkbox (component not installed in this project)
  - FolderEditDialog overwrite logic: when overwriteExisting=false, skips finds where the targeted field is already non-empty (field-level granularity: a find with country but no region still gets region filled)
  - PickerLayerSwitcher uses L.control.layers directly (same pattern as LayerSwitcher.tsx) — no new abstraction needed
metrics:
  duration: ~15min
  completed: "2026-04-15"
  tasks_completed: 2
  files_changed: 6
---

# Quick Task 260415-li5: Folder Edit Dialog + EditFindDialog Reverse Geocode + OpenTopoMap

**One-liner:** Folder bulk-edit dialog with map-pick + reverse geocode, EditFindDialog geocode fix, OpenTopoMap as third tile layer in LayerSwitcher and LocationPickerMap.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | FolderEditDialog + pencil icon on folder headers | cf1e9d3 | FolderEditDialog.tsx (new), CollectionTab.tsx |
| 2 | EditFindDialog reverse geocode fix + OpenTopoMap layer | b3278b2 | EditFindDialog.tsx, LayerSwitcher.tsx, LocationPickerMap.tsx, tile_proxy.rs |

## What Was Built

### Task 1: FolderEditDialog + pencil icon

New `src/components/finds/FolderEditDialog.tsx` component:
- Props: `speciesName: string | null` (null = closed), `finds: Find[]`, `onOpenChange`
- Species name input pre-filled from prop, editable
- "Pick on map" button opens LocationPickerMap; on confirm calls `reverseGeocode` and fills country + region
- Country + Region inputs
- Overwrite checkbox (default unchecked): when unchecked, only fills empty fields per-find; when checked, overwrites all
- Save: calls `bulkRenameSpecies` if name changed, then `updateFind` per affected find for country/region
- Inline `LocationPickerMap` rendered outside the main Dialog to avoid nesting issues

`src/tabs/CollectionTab.tsx` changes:
- Added `Pencil` to lucide-react imports, `FolderEditDialog` import
- Added `folderEditing: string | null` state
- Folder header refactored from a single `<button>` to a `<div class="group">` containing: accordion toggle button, pencil icon button (`opacity-0 group-hover:opacity-100`), chevron button
- Pencil calls `e.stopPropagation()` + `setFolderEditing(speciesName)`
- `<FolderEditDialog>` rendered after `<EditFindDialog>`, finds resolved from both `filteredGroups` and `groups` fallback

### Task 2: EditFindDialog reverse geocode + OpenTopoMap

`src/components/finds/EditFindDialog.tsx`:
- Added `import { reverseGeocode } from '@/lib/geocoding'`
- `onConfirm` callback made async; after setting lat/lng and closing picker, calls `reverseGeocode(lat, lng, lang)` using `useAppStore.getState().language` (Zustand outside-hook read)
- Fills country/region if geo result is non-empty, preserving existing values when geocode returns empty

`src/components/map/LayerSwitcher.tsx`:
- Added `TOPO_TEMPLATE` constant for `https://tile.opentopomap.org/{z}/{x}/{y}.png`
- Created `topoLayer` via `createRustProxyTileLayer` (maxZoom 17)
- Layer control updated: `{ Street: osmLayer, Satellite: esriLayer, Topo: topoLayer }`
- Cleanup: `topoLayer` removed if active on unmount

`src/components/map/LocationPickerMap.tsx`:
- Replaced `RustProxyOsmLayer` function with `PickerLayerSwitcher`
- `PickerLayerSwitcher` creates OSM + Topo layers, adds `L.control.layers({ Street, Topo })` — same pattern as LayerSwitcher but without Esri satellite
- JSX updated: `<PickerLayerSwitcher storagePath={storagePath} />`

`src-tauri/src/commands/tile_proxy.rs`:
- Added four opentopomap.org prefixes to `ALLOWED_PREFIXES`: `tile.`, `a.tile.`, `b.tile.`, `c.tile.`
- Added `accepts_allowlisted_opentopomap` test with assertions for all four subdomains

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing component] Native checkbox used instead of shadcn Checkbox**
- **Found during:** Task 1 implementation
- **Issue:** `@/components/ui/checkbox` does not exist in this project (not installed via shadcn CLI)
- **Fix:** Used native `<input type="checkbox">` with Tailwind `accent-primary` styling
- **Files modified:** `src/components/finds/FolderEditDialog.tsx`
- **Commit:** cf1e9d3

**2. [Rule 1 - Logic refinement] Overwrite logic uses field-level granularity**
- **Found during:** Task 1 implementation
- **Issue:** Plan spec said "skip finds where `find.country` is already non-empty (for country) and `find.region` is already non-empty (for region)" — AND logic would skip a find that has country but no region even when setting region
- **Fix:** Changed to OR logic: apply update if ANY targeted field is empty (find needs country OR needs region)
- **Files modified:** `src/components/finds/FolderEditDialog.tsx`
- **Commit:** cf1e9d3

## Verification

- TypeScript: `npx tsc --noEmit` — no errors (both after Task 1 and Task 2)
- Rust: `cargo test tile_proxy` — 6/6 tests pass including new `accepts_allowlisted_opentopomap`

## Self-Check: PASSED

- `src/components/finds/FolderEditDialog.tsx` — EXISTS
- `src/tabs/CollectionTab.tsx` — MODIFIED (pencil icon + FolderEditDialog render)
- `src/components/finds/EditFindDialog.tsx` — MODIFIED (reverseGeocode in onConfirm)
- `src/components/map/LayerSwitcher.tsx` — MODIFIED (Topo third layer)
- `src/components/map/LocationPickerMap.tsx` — MODIFIED (PickerLayerSwitcher)
- `src-tauri/src/commands/tile_proxy.rs` — MODIFIED (opentopomap prefixes + test)
- Commit cf1e9d3 — EXISTS
- Commit b3278b2 — EXISTS
