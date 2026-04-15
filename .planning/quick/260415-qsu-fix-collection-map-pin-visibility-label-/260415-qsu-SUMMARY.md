---
quick_id: 260415-qsu
status: complete
completed: 2026-04-15T17:20:00.000Z
commit: 6b9c03c
---

## Changes

**src/components/map/CollectionPins.tsx**
- `collectionIcon`: iconSize `[0,0]→[28,28]`, iconAnchor `[0,0]→[14,28]`; badge fills real 28×28 box; label positioned below via `top:32px`; removed broken `bottom:4px` on 0-height container
- `CollectionPopup.allPhotos`: now `{photo, findNotes}` objects instead of bare photos
- `displayNote`: `current.findNotes` (non-empty) → `speciesNote` fallback
- Description: scrollable `<div>` with `max-h-[90px] overflow-y-auto`, updates as carousel advances

**src/index.css**
- `.bili-collection-marker { overflow: visible !important }` — label no longer clipped by Leaflet marker container
