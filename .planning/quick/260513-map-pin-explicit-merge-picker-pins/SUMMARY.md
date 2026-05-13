# SUMMARY - 260513-map-pin-explicit-merge-picker-pins

Completed on: 2026-05-13

## Outcome

- Map pin grouping now uses exact saved coordinates instead of a nearby-coordinate tolerance.
- Multi-find collection popups browse between finds, not individual photos. Each find uses its primary/first photo, or the existing placeholder when no photo exists.
- Popup previous/next buttons now stop Leaflet mouse propagation before changing the active find, so clicking arrows stays inside the popup and advances to the next/previous `nalaz`.
- Popup photos now render as full-image `object-contain` over a blurred cover backdrop, so tall or off-center mushroom photos do not crop away the subject.
- `LocationPickerMap` now shows saved pins when opened from create/import flows even when a species filter has no matches, by falling back to all saved pins.

## Files Updated

- `src/components/map/CollectionPins.tsx`
- `src/components/map/groupFindsByCoords.ts`
- `src/components/map/LocationPickerMap.tsx`
- `src/components/map/CollectionPins.test.tsx`
- `src/components/map/groupFindsByCoords.test.ts`
- `src/components/map/LocationPickerMap.test.tsx`

## Verification

- `npm.cmd test -- src/components/map/CollectionPins.test.tsx src/components/map/groupFindsByCoords.test.ts src/components/map/LocationPickerMap.test.tsx src/components/map/FindPins.test.tsx`
- `npm.cmd run build`
