# SUMMARY - 260513-popup-arrow-native-events

Completed on: 2026-05-13

## Outcome

Reworked map popup previous/next arrows to use native DOM `pointerdown` listeners attached directly to button refs. This avoids Leaflet popup propagation guards blocking React delegated event handlers in Windows WebView.

Follow-up: removed the old image-overlay arrow buttons and moved the same native-listener refs to larger custom side controls on the popup card. These controls only render when a pin contains more than one find.

Follow-up 2: moved the side controls outside the clipped card body so they no longer overlap the photo/date/content. The inner card keeps the rounded clipped visual styling.

## Files Updated

- `src/components/map/CollectionPins.tsx`

## Verification

- `npm.cmd test -- src/components/map/CollectionPins.test.tsx src/components/map/groupFindsByCoords.test.ts src/components/map/LocationPickerMap.test.tsx src/components/map/FindPins.test.tsx`
- `npm.cmd run build`
