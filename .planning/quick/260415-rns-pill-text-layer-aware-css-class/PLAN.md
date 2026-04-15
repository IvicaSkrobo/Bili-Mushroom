---
quick_id: 260415-rns
slug: pill-text-layer-aware-css-class
description: Pill text dark on street/topo, white on satellite — CSS class approach, not inline style
date: 2026-04-15
status: complete
---

## Task

Pill text was always white after rjf fix — needs dark text on street/topo, white on satellite.

## Approach

CSS class `.bili-collection-marker--satellite` added to divIcon className when `isSatellite`.
Avoids inline style specificity/timing issues.

## Files

- `src/index.css` — base `#1C1A0C`, satellite override `#fff + text-shadow`
- `src/components/map/CollectionPins.tsx` — `isSatellite` → `markerClass` → `className`
