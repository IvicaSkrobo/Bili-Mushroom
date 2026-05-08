---
quick_id: 260509-0fm
slug: hide-map-clutter-during-zone-edit
description: Hide map clutter during zone polygon editing
date: 2026-05-09
status: complete
---

# Summary

## What was done

Modified `src/components/map/FindsMap.tsx` with three targeted changes:

1. **Added `useMemo`** to React import (line 3).

2. **`focusFinds` computed value** — derived from `finds`, `polygonEditorActive`, `polygonEditorZoneType`, and `drawTargetFind`:
   - Not editing → full `finds` array (no change)
   - Local edit + drawTargetFind set → single find filtered by `f.id === drawTargetFind.id`
   - Region edit + drawTargetFind set → all finds where `f.species_name === drawTargetFind.species_name`
   - Editing but no drawTargetFind → empty array (safe fallback)

3. **`hiddenZoneIds` on `<ZoneLayers>`** — changed from `[activeZoneId]` to `zones.map((z) => z.id)` when `polygonEditorActive`. Hides all static zone overlays; the draft polygon (`PolygonDraftLayer` / `PolygonEditHandles`) renders the active boundary.

4. **`<CollectionPins>`** — removed `!focusMode` gate, now always renders but passes `focusFinds` instead of `finds`. `OnlineStatusBadge` `!focusMode` gate untouched.

## Behaviour after change

| Context | Zones shown | Pins shown |
|---|---|---|
| Not editing | All (normal) | All (normal) |
| Local polygon edit | None (draft polygon only) | Single target find pin |
| Region polygon edit | None (draft polygon only) | All pins for that species |
| After save / cancel | All (normal) | All (normal) |

## Files changed

- `src/components/map/FindsMap.tsx`
