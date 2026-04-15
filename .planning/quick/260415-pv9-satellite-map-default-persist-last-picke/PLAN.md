---
quick_id: 260415-pv9
slug: satellite-map-default-persist-last-picke
description: "Satellite map default + persist last picked layer"
date: 2026-04-15
status: planned
---

# Quick Task 260415-pv9

Satellite as default map layer. Persist last picked layer across sessions via localStorage.

## Tasks

### T1 — Add mapLayer to appStore
**File:** `src/stores/appStore.ts`

Add `mapLayer` field (type `'Satellite' | 'Topo' | 'Street'`) with:
- `loadMapLayer()` reads `localStorage.getItem('bili_map_layer')`, validates, defaults to `'Satellite'`
- `setMapLayer(layer)` persists to localStorage + updates store

### T2 — LayerSwitcher reads/writes store
**File:** `src/components/map/LayerSwitcher.tsx`

- Read `mapLayer` from store on mount → add that layer to map as default
- Listen to `map.on('baselayerchange', ...)` → call `setMapLayer` with the new layer name
- Cleanup: `map.off('baselayerchange', handler)` in return fn

## Commit
`feat(quick-260415-pv9): satellite default + persist last picked map layer`
