---
quick_id: 260415-rpv
slug: crowded-pins-dot-hover-reveal
description: Crowded/overlapping pins show amber dot; hover reveals full pill label
date: 2026-04-15
status: complete
---

## Task

Overlapping pins currently show semi-transparent pill (opacity 0.35). Replace with small amber dot; hover expands to full pill.

## Approach

- `bili-collection-marker--crowded` class on divIcon when `!showLabel`
- CSS: dot state = max-width:10px, height:10px, font-size:0, overflow:hidden
- CSS hover: max-width:200px, font-size:11px, full padding — animated via transition
- Remove opacity inline style hack

## Files

- `src/components/map/CollectionPins.tsx` — classes array, remove opacity
- `src/index.css` — crowded + crowded:hover rules
