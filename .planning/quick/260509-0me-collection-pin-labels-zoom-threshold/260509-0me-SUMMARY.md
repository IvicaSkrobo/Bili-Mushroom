---
quick_id: 260509-0me
slug: collection-pin-labels-zoom-threshold
description: Improve CollectionPins label visibility with zoom threshold and mixed-species grouped labels
date: 2026-05-09
status: complete
---

# Summary

## What was done

Modified `src/components/map/CollectionPins.tsx` and `CollectionPins.test.tsx`.

### CollectionPins.tsx

1. **`LABEL_ZOOM_THRESHOLD = 13`** — exported constant. Labels only appear at zoom ≥ 13 (neighborhood/village level and closer).

2. **`Collection` interface** — added `labelText: string` and `suppressLabel: boolean`.

3. **`collectionsFromFinds` proximity post-pass** — after species-first grouping, a second pass groups Collections by `SAME_LOCATION_DEG` proximity across species:
   - Single species at location → `labelText = Latin name`, `suppressLabel = false`
   - Multiple species at location → first gets `"N species"` label; others get `suppressLabel = true`

4. **`collectionIcon` / `getCollectionIcon`** — signature changed from `name: string` to `labelText: string`. Label text is used directly (no more Latin name extraction in icon function).

5. **`CollectionPinsInner`** — added `zoom` state initialized from `map.getZoom()`, updated on `zoomend`. `showLabel` now: `zoom >= LABEL_ZOOM_THRESHOLD && !crowded.has(c.key) && !c.suppressLabel`.

### CollectionPins.test.tsx

Added 3 new tests (11 total, all pass):
- Single-species pin: `labelText` = Latin name, `suppressLabel = false`
- Two species at same location: first `"2 species"` + `suppressLabel=false`, second `suppressLabel=true`
- `LABEL_ZOOM_THRESHOLD` exported and equals 13

## Behaviour after change

| Context | Labels shown |
|---|---|
| Zoom < 13 | None (dots only; hover still reveals) |
| Zoom ≥ 13, not crowded, single species | Species Latin name |
| Zoom ≥ 13, not crowded, mixed location | "N species" on primary pin, others suppressed |
| Zoom ≥ 13, crowded | Dot (hover reveals) |

Popup content unchanged — full details on click at any zoom.

## Files changed

- `src/components/map/CollectionPins.tsx`
- `src/components/map/CollectionPins.test.tsx`
