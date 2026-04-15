---
plan: 03-04
phase: 03-map
status: complete
completed_at: 2026-04-15
---

# Plan 03-04 Summary: Location Picker + Settings Cache Controls

## What was built

Delivered MAP-06 (map-based location picker) and D-09 (Settings cache controls).

**Task 1 — LocationPickerMap refactored** (`272b743`):
- Removed `leaflet.offline` from package.json
- `LocationPickerMap.tsx` rewritten using `RustProxyOsmLayer` via `createRustProxyTileLayer` (useMap+useEffect pattern)
- Full-screen dialog, Croatia default [45.1, 15.2] zoom 7, opens at zoom 13 when find has existing coords
- Draggable marker, JetBrains Mono coordinate preview at 6 decimal places
- Confirm button disabled until pin placed
- 8 tests passing

**Task 2 — EditFindDialog "Pick on map" button** (`3f051d1`):
- Ghost button opens `LocationPickerMap` modal
- Rendered after `</DialogContent>` to avoid nested dialog violations
- `onConfirm` writes lat/lng strings back to form fields

**Task 3 — tileCache.ts + SettingsDialog Map Cache section** (`34e8612`, `34be424`):
- `src/lib/tileCache.ts`: `getTileCacheStats`, `clearTileCache`, `formatMb` typed IPC wrappers
- `SettingsDialog.tsx`: Map Cache section with `data-testid="tile-cache-size"`, read-only 200 MB max input, `AlertDialogTrigger` clear button with confirmation
- 10 tests passing (5 unit + 5 settings)

## Key files

### Created
- `src/lib/tileCache.ts`
- `src/lib/tileCache.test.ts`
- `src/components/dialogs/SettingsDialog.test.tsx`

### Modified
- `src/components/map/LocationPickerMap.tsx` — rewritten to use RustProxyTileLayer
- `src/components/map/LocationPickerMap.test.tsx` — expanded to 8 tests
- `src/components/finds/EditFindDialog.tsx` — Pick on map button wired
- `src/components/dialogs/SettingsDialog.tsx` — Map Cache section added
- `package.json` — leaflet.offline removed

## Test results

127 passed / 32 pre-existing failures (unchanged baseline from Plan 02)

## Self-Check: PASSED
