---
quick_id: 260415-sj5
slug: map-species-filter-panel
description: Map species filter — search + checkboxes, "See all", filtered pins
date: 2026-04-15
status: complete
---

## Task

Add species filter panel to map tab. Users can isolate one or multiple species on the map.

## Implementation

- `SpeciesFilterPanel.tsx` — toggle button (top-right), search input, "See all", per-species checkboxes with Latin + Croatian names
- `MapTab.tsx` — selectedSpecies Set state, filteredFinds derived, panel overlay outside MapContainer
- Filter: empty set = all shown; non-empty = only matching species

## Files

- `src/components/map/SpeciesFilterPanel.tsx` (new)
- `src/tabs/MapTab.tsx` (updated)
