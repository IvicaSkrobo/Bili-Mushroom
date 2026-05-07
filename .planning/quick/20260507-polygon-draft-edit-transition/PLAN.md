---
slug: polygon-draft-edit-transition
type: quick
status: complete
date: 2026-05-07
---

# Polygon draft → edit transition (first-draw save)

After a user draws and saves a polygon for the first time, immediately enter
point-adjust (edit) mode so they can refine the shape without exiting and
reopening editing.

## Change

`src/tabs/MapTab.tsx` — `handleSaveRegionPolygon()`

- Capture `savedPoints = draftPolygonZone.points` before the async boundary.
- After the upsert resolves, call `setEditingPolygonZone({ zoneId, zoneType, points: savedPoints })`.
- Works for both `local` and `region` zone types (same handler, `zoneType` from draft).

## Tests

`src/lib/zones.test.ts` — new `draft → edit transition` describe block (6 tests):

- Points survive stringify/parse round-trip losslessly.
- Editing state shape is correct for region + local zone types.
- Minimum 3-point guard still enforced.
- Insertion does not mutate the original captured array.
