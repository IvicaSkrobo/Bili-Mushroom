---
quick_id: 260506-prz
slug: polygon-region-zones
description: Add map-driven polygon creation and editing for region zones
date: 2026-05-06
status: complete
---

## Task

Finish the next planned species-zone slice by adding polygon region zones on the map.

## Implementation

- extend zone geometry helpers beyond circles so region membership works for polygons too
- add a guided draw/edit flow on the map for region polygons without introducing a heavy drawing dependency
- render polygon region overlays alongside existing circle zones and keep the Forest Codex map controls cohesive
- verify with focused frontend tests and a build

## Files

- `src/lib/zones.ts`
- `src/components/map/FindsMap.tsx`
- `src/components/map/ZoneLayers.tsx`
- `src/components/map/ZoneEditorPanel.tsx`
- `src/components/map/ZoneModeControl.tsx`
- tests in `src/components/map/` and/or `src/tabs/`
