# Polygon region zones

Date: 2026-05-06

## Result

Finished the next species-zone slice by adding polygon region drawing on the map.

- Region polygons can now be drawn from the zone toolbar by clicking map points.
- Draft polygons show live boundary points and outline feedback before save.
- Saved polygon regions render on the map and can be reopened through the existing zone editor flow.
- Active polygon regions can now enter an adjust-points mode with draggable map handles, then save or cancel shape changes without full redraw.
- Polygon zone membership now counts same-species finds inside the drawn area.
- Existing local and region circle flows remain available.

## Verification

- `npm run test -- src/lib/zones.test.ts src/components/map/FindsMap.test.tsx src/tabs/MapTab.test.tsx` passed.
- `npm run build` passed.
