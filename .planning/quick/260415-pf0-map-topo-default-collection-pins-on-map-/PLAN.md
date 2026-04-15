---
quick_id: 260415-pf0
slug: map-topo-default-collection-pins-on-map-highlight
description: "Map topo default + collection pins on map + collection tab active highlight"
date: 2026-04-15
status: planned
---

# Quick Task 260415-pf0

Map topo default + collection pins on map + collection tab active highlight

## Tasks

### T1 — Topo as default map layer
**File:** `src/components/map/LayerSwitcher.tsx`

Change `osmLayer.addTo(map)` → `topoLayer.addTo(map)` so OpenTopoMap is the active layer on first load.
Update the layers control object order to put Topo first: `{ Topo: topoLayer, Street: osmLayer, Satellite: esriLayer }`.

### T2 — Collection pins on map
**New file:** `src/components/map/CollectionPins.tsx`

Shows one pin per species collection on the map, positioned at centroid of all geolocated finds for that species.

Logic:
- Group `finds` by `species_name`
- For each group, compute average lat/lng of finds where `lat !== null && lng !== null`
- Skip species with no geolocated finds
- Render a distinct amber pin (different visual from find pins — larger, square label badge with species name)

Pin style: DivIcon with species name abbreviation (first 2 chars) + count badge. Amber bg `oklch(0.72 0.12 80)`, dark border.

Popup: shows full species name + "N finds" count.

**File:** `src/components/map/FindsMap.tsx`
Add `<CollectionPins finds={finds} />` inside MapContainer (alongside existing FindPins).

### T3 — Collection tab active highlight
**File:** `src/tabs/CollectionTab.tsx`

When a species folder is expanded (`isOpen === true`), highlight the folder header:
- Add amber left border: `border-l-2 border-primary`
- Slightly warmer background: `bg-accent/40`
- Apply to the outer folder `<div>` (the one with `border border-border/70 bg-card`)

Specifically, change the outer folder div className to conditionally add `border-l-primary border-l-2` when `isOpen`.
Also change folder header button div to add `bg-accent/30` when `isOpen`.

## Commit plan
Single atomic commit: `feat(quick-260415-pf0): topo default, collection map pins, collection active highlight`
